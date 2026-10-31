import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Save,
  CheckCircle2,
  RefreshCw,
  Users,
  Bold,
  Italic,
  Underline,
  List,
  ListOrdered,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Heading1,
  Heading2,
  Undo2,
  Redo2,
  Upload,
  Sparkles,
  UserCheck,
  Edit3,
  Clock
} from 'lucide-react';
import collabService from '../../services/collabService';
import { useToast } from '../../contexts/ToastContext';

/**
 * RealtimeCollaborativeEditor
 * Trình chỉnh sửa tài liệu theo thời gian thực cho cả Word (.docx), Văn bản/Code (.txt, .md, .json, .js...)
 * và cập nhật phiên bản trực tiếp cho tệp nhị phân (PDF, hình ảnh...)
 */
const RealtimeCollaborativeEditor = ({
  file,
  shareToken = null,
  password = null,
  currentUser = null,
  onSaved = null,
  onFileReplaced = null
}) => {
  const toast = useToast();
  const fileId = file?._id;

  const [sessionId] = useState(() => collabService.getSessionId());
  const [displayName, setDisplayName] = useState(() =>
    currentUser?.name || currentUser?.email || collabService.getGuestDisplayName()
  );
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(displayName);

  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState('text'); // 'docx' | 'text' | 'binary'
  const [canEdit, setCanEdit] = useState(false);
  const [content, setContent] = useState('');
  const [revision, setRevision] = useState(1);
  const [participants, setParticipants] = useState([]);
  const [syncStatus, setSyncStatus] = useState('saved'); // 'saved' | 'typing' | 'syncing' | 'saving' | 'error'
  const [lastSavedAt, setLastSavedAt] = useState(null);
  const [lastEditor, setLastEditor] = useState(null);
  const [uploadingReplacement, setUploadingReplacement] = useState(false);

  const docxEditorRef = useRef(null);
  const fileInputRef = useRef(null);
  const isLocalTypingRef = useRef(false);
  const syncTimeoutRef = useRef(null);
  const autoSaveTimeoutRef = useRef(null);
  const latestContentRef = useRef('');

  // Đồng bộ tên khi currentUser thay đổi
  useEffect(() => {
    if (currentUser?.name) {
      setDisplayName(currentUser.name);
      setNameDraft(currentUser.name);
    }
  }, [currentUser?.name]);

  // Tải phiên cộng tác ban đầu & mở luồng SSE
  useEffect(() => {
    if (!fileId) return;
    let isMounted = true;
    let disconnectStream = null;

    const initCollab = async () => {
      setLoading(true);
      try {
        const res = await collabService.getSession(fileId, {
          shareToken,
          password,
          sessionId,
          displayName
        });
        const data = res?.data || res;
        if (!isMounted || !data) return;

        setMode(data.mode || 'text');
        setCanEdit(Boolean(data.canEdit));
        setContent(data.content || '');
        latestContentRef.current = data.content || '';
        setRevision(data.revision || 1);
        setParticipants(data.participants || []);
        setLastSavedAt(data.lastSavedAt || null);
        setLastEditor(data.lastUpdatedBy || null);
        setSyncStatus(data.dirty ? 'typing' : 'saved');

        if (data.mode === 'docx' && docxEditorRef.current) {
          docxEditorRef.current.innerHTML = data.content || '<p></p>';
        }
      } catch (err) {
        console.error('[RealtimeEditor] Lỗi khởi tạo phiên cộng tác:', err);
        toast.error(err.response?.data?.message || 'Không thể kết nối phiên chỉnh sửa thời gian thực');
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }

      // Kết nối SSE nhận cập nhật thời gian thực
      disconnectStream = collabService.connectStream(
        fileId,
        {
          shareToken,
          password,
          sessionId,
          displayName
        },
        {
          onConnected: (payload) => {
            if (!isMounted) return;
            if (payload.participants) {
              setParticipants(payload.participants);
            }
          },
          onPresenceUpdated: (payload) => {
            if (!isMounted) return;
            if (payload.participants) {
              setParticipants(payload.participants);
            }
          },
          onContentUpdated: (payload) => {
            if (!isMounted) return;
            if (payload.participants) {
              setParticipants(payload.participants);
            }
            if (payload.updatedBy) {
              setLastEditor(payload.updatedBy);
            }
            // Chỉ cập nhật khung soạn thảo nếu bản cập nhật đến từ người dùng khác
            if (payload.senderSessionId !== sessionId && typeof payload.content === 'string') {
              isLocalTypingRef.current = false;
              latestContentRef.current = payload.content;
              setContent(payload.content);
              setRevision(payload.revision || 1);
              if (docxEditorRef.current && document.activeElement !== docxEditorRef.current) {
                docxEditorRef.current.innerHTML = payload.content;
              } else if (docxEditorRef.current) {
                docxEditorRef.current.innerHTML = payload.content;
              }
            }
          },
          onDocumentSaved: (payload) => {
            if (!isMounted) return;
            setSyncStatus('saved');
            if (payload.lastSavedAt) {
              setLastSavedAt(payload.lastSavedAt);
            }
            if (payload.savedBy) {
              setLastEditor(payload.savedBy);
            }
            if (payload.participants) {
              setParticipants(payload.participants);
            }
            if (payload.senderSessionId !== sessionId && typeof payload.content === 'string') {
              latestContentRef.current = payload.content;
              setContent(payload.content);
              if (docxEditorRef.current) {
                docxEditorRef.current.innerHTML = payload.content;
              }
            }
            if (onSaved) {
              onSaved(payload);
            }
          },
          onFileReplaced: (payload) => {
            if (!isMounted) return;
            toast.info(
              `Tệp tin vừa được cập nhật phiên bản mới bởi ${payload.replacedBy?.displayName || 'Cộng tác viên'}`
            );
            if (typeof payload.content === 'string') {
              latestContentRef.current = payload.content;
              setContent(payload.content);
              if (docxEditorRef.current) {
                docxEditorRef.current.innerHTML = payload.content;
              }
            }
            if (onFileReplaced) {
              onFileReplaced(payload);
            }
          }
        }
      );
    };

    initCollab();

    return () => {
      isMounted = false;
      if (disconnectStream) disconnectStream();
      if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
      if (autoSaveTimeoutRef.current) clearTimeout(autoSaveTimeoutRef.current);
    };
  }, [fileId, shareToken, password, sessionId]);

  // Đồng bộ HTML ban đầu vào khung soạn thảo Word khi vừa tải xong
  useEffect(() => {
    if (!loading && mode === 'docx' && docxEditorRef.current) {
      if (docxEditorRef.current.innerHTML !== latestContentRef.current) {
        docxEditorRef.current.innerHTML = latestContentRef.current || '<p></p>';
      }
    }
  }, [loading, mode]);

  // Hàm lưu tài liệu xuống đĩa / S3
  const handleSaveNow = useCallback(
    async (explicitContent = null, showToast = false) => {
      if (!canEdit || mode === 'binary') return;
      const contentToSave =
        explicitContent !== null ? explicitContent : latestContentRef.current;

      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }

      setSyncStatus('saving');
      try {
        const res = await collabService.saveDocument(fileId, {
          content: contentToSave,
          sessionId,
          displayName,
          shareToken,
          password
        });
        const data = res?.data || res;
        setSyncStatus('saved');
        if (data?.lastSavedAt) {
          setLastSavedAt(data.lastSavedAt);
        }
        if (showToast) {
          toast.success('Đã lưu thay đổi vào tệp gốc');
        }
        if (onSaved) {
          onSaved(data);
        }
      } catch (err) {
        setSyncStatus('error');
        if (showToast) {
          toast.error(err.response?.data?.message || 'Không thể lưu tài liệu');
        }
      }
    },
    [canEdit, mode, fileId, sessionId, displayName, shareToken, password, onSaved, toast]
  );

  // Phím tắt Ctrl+S / Cmd+S để lưu ngay
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleSaveNow(null, true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSaveNow]);

  // Xử lý khi người dùng gõ nội dung mới
  const triggerRealtimeSyncAndAutoSave = (newContent) => {
    latestContentRef.current = newContent;
    setContent(newContent);
    setSyncStatus('typing');
    isLocalTypingRef.current = true;

    // 1. Phát tín hiệu Live Sync sau 180ms để đồng bộ tức thì sang màn hình khác
    if (syncTimeoutRef.current) {
      clearTimeout(syncTimeoutRef.current);
    }
    syncTimeoutRef.current = setTimeout(async () => {
      try {
        setSyncStatus('syncing');
        await collabService.syncLiveContent(fileId, {
          content: latestContentRef.current,
          sessionId,
          displayName,
          isTyping: true,
          shareToken,
          password
        });
      } catch (e) {
        // Bỏ qua lỗi mạng tạm thời khi gõ
      }
    }, 180);

    // 2. Tự động lưu (Auto-save) xuống tệp vật lý sau 1.5 giây ngừng gõ
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }
    autoSaveTimeoutRef.current = setTimeout(() => {
      handleSaveNow(latestContentRef.current, false);
    }, 1500);
  };

  // Lệnh định dạng Rich Text cho tài liệu Word (.docx)
  const execDocxCommand = (command, value = null) => {
    if (!canEdit || !docxEditorRef.current) return;
    docxEditorRef.current.focus();
    document.execCommand(command, false, value);
    const updatedHtml = docxEditorRef.current.innerHTML;
    triggerRealtimeSyncAndAutoSave(updatedHtml);
  };

  // Lưu tên hiển thị mới cho khách
  const handleSaveDisplayName = async (e) => {
    e.preventDefault();
    const updated = collabService.setGuestDisplayName(nameDraft);
    setDisplayName(updated);
    setEditingName(false);
    try {
      await collabService.syncLiveContent(fileId, {
        content: latestContentRef.current,
        sessionId,
        displayName: updated,
        isTyping: false,
        shareToken,
        password
      });
    } catch (err) {
      // Bỏ qua
    }
  };

  // Tải phiên bản tệp mới thay thế (dành cho PDF, hình ảnh hoặc file bất kỳ)
  const handleReplaceFileChange = async (e) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setUploadingReplacement(true);
    try {
      const res = await collabService.replaceBinaryFile(fileId, selectedFile, {
        sessionId,
        displayName,
        shareToken,
        password
      });
      toast.success('Đã cập nhật phiên bản tệp mới thành công');
      if (onFileReplaced) {
        onFileReplaced(res?.data || res);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Cập nhật tệp tin thất bại');
    } finally {
      setUploadingReplacement(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Thống kê dòng / từ / ký tự cho trình soạn thảo
  const plainTextForStats =
    mode === 'docx'
      ? content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
      : content;
  const wordCount = plainTextForStats ? plainTextForStats.trim().split(/\s+/).filter(Boolean).length : 0;
  const charCount = plainTextForStats ? plainTextForStats.length : 0;
  const lineCount = mode === 'text' ? (content ? content.split('\n').length : 1) : 0;

  const activeTypers = participants.filter((p) => p.isTyping && p.sessionId !== sessionId);

  if (loading) {
    return (
      <div
        style={{
          padding: '60px 24px',
          textAlign: 'center',
          background: 'var(--bg-surface)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border-main)'
        }}
      >
        <span className="spinner" style={{ width: 32, height: 32, margin: '0 auto' }} />
        <div style={{ marginTop: '12px', fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
          Đang khởi tạo phiên chỉnh sửa thời gian thực...
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        height: '100%',
        minHeight: '540px',
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-main)',
        borderRadius: 'var(--radius-lg)',
        overflow: 'hidden',
        boxShadow: 'var(--shadow-md)'
      }}
    >
      {/* Ẩn input chọn file thay thế */}
      <input
        ref={fileInputRef}
        type="file"
        style={{ display: 'none' }}
        onChange={handleReplaceFileChange}
      />

      {/* ── Thanh Trạng thái Cộng tác Thời gian thực (Live Collaboration Bar) ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
          padding: '10px 16px',
          background: 'var(--bg-surface-hover)',
          borderBottom: '1px solid var(--border-main)'
        }}
      >
        {/* Nhóm trái: Trạng thái Live & Người đang cùng mở */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <span className="badge badge-emerald" style={{ gap: '6px', padding: '4px 10px' }}>
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: '50%',
                backgroundColor: '#10b981',
                display: 'inline-block'
              }}
            />
            <span>Trực tuyến ({participants.length})</span>
          </span>

          {/* Danh sách Avatar những người đang tham gia */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            {participants.map((p) => {
              const isMe = p.sessionId === sessionId;
              return (
                <div
                  key={p.sessionId}
                  title={`${p.displayName}${isMe ? ' (Bạn)' : ''}${p.isTyping ? ' - Đang gõ...' : ''}`}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '3px 8px 3px 4px',
                    borderRadius: '999px',
                    background: 'var(--bg-surface)',
                    border: `1px solid ${p.isTyping ? p.color : 'var(--border-main)'}`,
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    color: 'var(--text-primary)'
                  }}
                >
                  <span
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: '50%',
                      backgroundColor: p.color || '#8b5cf6',
                      color: '#ffffff',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.68rem',
                      fontWeight: 700
                    }}
                  >
                    {(p.displayName || 'U')[0].toUpperCase()}
                  </span>
                  <span>
                    {p.displayName}
                    {isMe ? ' (Bạn)' : ''}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Đổi tên hiển thị nhanh nếu là khách truy cập link công khai */}
          {!currentUser && (
            editingName ? (
              <form onSubmit={handleSaveDisplayName} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <input
                  type="text"
                  className="form-input"
                  value={nameDraft}
                  onChange={(e) => setNameDraft(e.target.value)}
                  placeholder="Tên hiển thị..."
                  style={{ padding: '3px 8px', fontSize: '0.75rem', width: '130px', height: '26px' }}
                  autoFocus
                />
                <button type="submit" className="btn btn-primary btn-sm" style={{ padding: '2px 8px', fontSize: '0.72rem' }}>
                  Lưu tên
                </button>
              </form>
            ) : (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  setNameDraft(displayName);
                  setEditingName(true);
                }}
                style={{ padding: '3px 8px', fontSize: '0.72rem', gap: '4px' }}
                title="Đổi tên hiển thị của bạn khi cộng tác"
              >
                <Edit3 size={11} />
                <span>Đổi tên</span>
              </button>
            )
          )}
        </div>

        {/* Nhóm phải: Trạng thái lưu tự động & Nút Lưu ngay */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {activeTypers.length > 0 && (
            <span style={{ fontSize: '0.75rem', color: 'var(--primary-500)', fontWeight: 600 }}>
              {activeTypers.map((t) => t.displayName).join(', ')} đang soạn thảo...
            </span>
          )}

          <div
            className="tabular-nums"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              fontSize: '0.76rem',
              color:
                syncStatus === 'error'
                  ? 'var(--accent-rose)'
                  : syncStatus === 'saved'
                  ? 'var(--accent-emerald)'
                  : 'var(--text-secondary)',
              fontWeight: 600
            }}
          >
            {syncStatus === 'saving' || syncStatus === 'syncing' ? (
              <>
                <RefreshCw size={13} className="spin-animation" />
                <span>{syncStatus === 'saving' ? 'Đang lưu vào tệp...' : 'Đang đồng bộ trực tiếp...'}</span>
              </>
            ) : syncStatus === 'typing' ? (
              <>
                <Clock size={13} />
                <span>Chưa lưu (Tự động lưu sau 1.5s)</span>
              </>
            ) : syncStatus === 'error' ? (
              <span>Lỗi lưu tự động</span>
            ) : (
              <>
                <CheckCircle2 size={13} />
                <span>
                  Đã lưu tự động
                  {lastSavedAt
                    ? ` lúc ${new Date(lastSavedAt).toLocaleTimeString('vi-VN', {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit'
                      })}`
                    : ''}
                </span>
              </>
            )}
          </div>

          {canEdit && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingReplacement}
                title="Tải tệp tin mới lên để cập nhật phiên bản"
                style={{ padding: '5px 10px', fontSize: '0.78rem' }}
              >
                <Upload size={13} />
                <span>{uploadingReplacement ? 'Đang tải...' : 'Tải bản mới'}</span>
              </button>

              {mode !== 'binary' && (
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => handleSaveNow(null, true)}
                  disabled={syncStatus === 'saving'}
                  title="Lưu ngay lập tức (Ctrl + S)"
                  style={{ padding: '5px 12px', fontSize: '0.78rem' }}
                >
                  <Save size={13} />
                  <span>Lưu ngay</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Thanh công cụ Định dạng cho Tài liệu Word (.docx) ── */}
      {mode === 'docx' && canEdit && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            flexWrap: 'wrap',
            padding: '8px 16px',
            background: 'var(--bg-surface)',
            borderBottom: '1px solid var(--border-subtle)'
          }}
        >
          <button
            type="button"
            className="btn-icon"
            title="Hoàn tác (Ctrl+Z)"
            onClick={() => execDocxCommand('undo')}
          >
            <Undo2 size={15} />
          </button>
          <button
            type="button"
            className="btn-icon"
            title="Làm lại (Ctrl+Y)"
            onClick={() => execDocxCommand('redo')}
          >
            <Redo2 size={15} />
          </button>

          <span style={{ width: 1, height: 18, background: 'var(--border-main)', margin: '0 4px' }} />

          <button
            type="button"
            className="btn-icon"
            title="Tiêu đề lớn (Heading 1)"
            onClick={() => execDocxCommand('formatBlock', 'H1')}
          >
            <Heading1 size={15} />
          </button>
          <button
            type="button"
            className="btn-icon"
            title="Tiêu đề vừa (Heading 2)"
            onClick={() => execDocxCommand('formatBlock', 'H2')}
          >
            <Heading2 size={15} />
          </button>

          <span style={{ width: 1, height: 18, background: 'var(--border-main)', margin: '0 4px' }} />

          <button
            type="button"
            className="btn-icon"
            title="In đậm (Ctrl+B)"
            onClick={() => execDocxCommand('bold')}
          >
            <Bold size={15} />
          </button>
          <button
            type="button"
            className="btn-icon"
            title="In nghiêng (Ctrl+I)"
            onClick={() => execDocxCommand('italic')}
          >
            <Italic size={15} />
          </button>
          <button
            type="button"
            className="btn-icon"
            title="Gạch chân (Ctrl+U)"
            onClick={() => execDocxCommand('underline')}
          >
            <Underline size={15} />
          </button>

          <span style={{ width: 1, height: 18, background: 'var(--border-main)', margin: '0 4px' }} />

          <button
            type="button"
            className="btn-icon"
            title="Danh sách dấu chấm"
            onClick={() => execDocxCommand('insertUnorderedList')}
          >
            <List size={15} />
          </button>
          <button
            type="button"
            className="btn-icon"
            title="Danh sách đánh số"
            onClick={() => execDocxCommand('insertOrderedList')}
          >
            <ListOrdered size={15} />
          </button>

          <span style={{ width: 1, height: 18, background: 'var(--border-main)', margin: '0 4px' }} />

          <button
            type="button"
            className="btn-icon"
            title="Căn trái"
            onClick={() => execDocxCommand('justifyLeft')}
          >
            <AlignLeft size={15} />
          </button>
          <button
            type="button"
            className="btn-icon"
            title="Căn giữa"
            onClick={() => execDocxCommand('justifyCenter')}
          >
            <AlignCenter size={15} />
          </button>
          <button
            type="button"
            className="btn-icon"
            title="Căn phải"
            onClick={() => execDocxCommand('justifyRight')}
          >
            <AlignRight size={15} />
          </button>
        </div>
      )}

      {/* ── Vùng Soạn thảo Chính ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'auto', minHeight: '420px' }}>
        {mode === 'docx' ? (
          <div
            style={{
              flex: 1,
              background: '#0f172a',
              padding: '28px 20px',
              display: 'flex',
              justifyContent: 'center',
              overflowY: 'auto'
            }}
          >
            <div
              ref={docxEditorRef}
              contentEditable={canEdit}
              suppressContentEditableWarning
              onInput={(e) => {
                const newHtml = e.currentTarget.innerHTML;
                triggerRealtimeSyncAndAutoSave(newHtml);
              }}
              style={{
                width: '100%',
                maxWidth: '816px',
                minHeight: '680px',
                background: '#ffffff',
                color: '#0f172a',
                padding: '48px 56px',
                borderRadius: '8px',
                boxShadow: '0 12px 32px rgba(0, 0, 0, 0.35)',
                outline: 'none',
                fontSize: '1rem',
                lineHeight: 1.65,
                fontFamily: 'var(--font-sans)',
                wordBreak: 'break-word'
              }}
            />
          </div>
        ) : mode === 'text' ? (
          <textarea
            value={content}
            readOnly={!canEdit}
            onChange={(e) => triggerRealtimeSyncAndAutoSave(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Tab' && canEdit) {
                e.preventDefault();
                const start = e.target.selectionStart;
                const end = e.target.selectionEnd;
                const nextVal = content.substring(0, start) + '  ' + content.substring(end);
                triggerRealtimeSyncAndAutoSave(nextVal);
                setTimeout(() => {
                  e.target.selectionStart = e.target.selectionEnd = start + 2;
                }, 0);
              }
            }}
            placeholder="Nhập nội dung tài liệu tại đây..."
            style={{
              flex: 1,
              width: '100%',
              minHeight: '460px',
              padding: '20px 24px',
              background: '#0f172a',
              color: '#f8fafc',
              border: 'none',
              outline: 'none',
              resize: 'none',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.875rem',
              lineHeight: 1.65
            }}
          />
        ) : (
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '48px 24px',
              textAlign: 'center',
              gap: '12px'
            }}
          >
            <Upload size={42} style={{ color: 'var(--primary-500)' }} />
            <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              Cập nhật phiên bản mới cho "{file?.name}"
            </div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', maxWidth: '460px' }}>
              Định dạng tệp này không chỉnh sửa văn bản trực tiếp. Với quyền Chỉnh sửa, bạn có thể tải tệp mới lên để cập nhật ngay lập tức cho tất cả mọi người đang xem liên kết này.
            </div>
            {canEdit && (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingReplacement}
                style={{ marginTop: '8px' }}
              >
                <Upload size={16} />
                <span>{uploadingReplacement ? 'Đang tải lên...' : 'Chọn tệp mới thay thế'}</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Chân trang Thống kê & Trạng thái Cộng tác ── */}
      <div
        className="tabular-nums"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '10px',
          padding: '8px 16px',
          background: 'var(--bg-surface-hover)',
          borderTop: '1px solid var(--border-main)',
          fontSize: '0.75rem',
          color: 'var(--text-secondary)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span>
            Chế độ: <strong>{mode === 'docx' ? 'Tài liệu Word (.docx)' : mode === 'text' ? 'Văn bản / Mã nguồn' : 'Tệp nhị phân'}</strong>
          </span>
          {mode !== 'binary' && (
            <>
              <span>•</span>
              <span>{wordCount.toLocaleString()} từ</span>
              <span>•</span>
              <span>{charCount.toLocaleString()} ký tự</span>
              {mode === 'text' && (
                <>
                  <span>•</span>
                  <span>{lineCount.toLocaleString()} dòng</span>
                </>
              )}
            </>
          )}
        </div>

        <div>
          {lastEditor?.displayName ? (
            <span>
              Cập nhật gần nhất bởi <strong>{lastEditor.displayName}</strong>
            </span>
          ) : (
            <span>Phiên bản đồng bộ #{revision}</span>
          )}
        </div>
      </div>
    </div>
  );
};

export default RealtimeCollaborativeEditor;

