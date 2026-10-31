import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Save,
  CheckCircle2,
  RefreshCw,
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
  Edit3,
  Clock,
  Plus,
  Trash2,
  Table as TableIcon,
  Code,
  Quote,
  Columns,
  Eye,
  FileText,
  FileSpreadsheet
} from 'lucide-react';
import collabService from '../../services/collabService';
import { useToast } from '../../contexts/ToastContext';

/**
 * Khôi phục các thẻ img bị rò rỉ mất dấu '<' thành thẻ <img> chuẩn trên giao diện
 */
const sanitizeDocxHtml = (html = '') => {
  if (!html) return '';
  return String(html).replace(
    /(^|>|\s)img\s+(?:alt\s*=\s*(?:"([^"]*)"|'([^']*)'|&quot;([^&]*)&quot;)\s+)?src\s*=\s*(?:"(data:image\/[^"]+)"|'(data:image\/[^']+)'|&quot;(data:image\/[^&]+)&quot;)\s*\/?(?:>|&gt;)?/gi,
    (full, prefix, a1, a2, a3, s1, s2, s3) => {
      const alt = a1 || a2 || a3 || 'Hình ảnh';
      const src = (s1 || s2 || s3 || '').replace(/\s+/g, '');
      if (!src) return prefix;
      return `${prefix}<img alt="${alt}" src="${src}" />`;
    }
  );
};

/**
 * Chuyển chỉ số cột (0 -> A, 25 -> Z, 26 -> AA)
 */
const colIndexToLetter = (colIdx) => {
  let n = colIdx + 1;
  let str = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    str = String.fromCharCode(65 + rem) + str;
    n = Math.floor((n - 1) / 26);
  }
  return str;
};

/**
 * Tạo bảng tính mặc định 12 dòng x 8 cột
 */
const createEmptyGrid = (rows = 12, cols = 8) =>
  Array.from({ length: rows }, () => Array.from({ length: cols }, () => ''));

/**
 * Parse chuỗi JSON Workbook từ backend thành mảng sheets an toàn
 */
const parseWorkbookJson = (rawContent) => {
  try {
    const parsed = typeof rawContent === 'string' ? JSON.parse(rawContent) : rawContent;
    if (parsed && Array.isArray(parsed.sheets) && parsed.sheets.length > 0) {
      return parsed.sheets.map((s, idx) => ({
        name: s.name || `Sheet${idx + 1}`,
        data:
          Array.isArray(s.data) && s.data.length > 0
            ? s.data.map((r) => (Array.isArray(r) ? r.map((c) => String(c ?? '')) : ['']))
            : createEmptyGrid()
      }));
    }
  } catch (e) {
    // Fallback bên dưới
  }
  return [{ name: 'Sheet1', data: createEmptyGrid() }];
};

/**
 * Chuyển đổi văn bản Markdown sang HTML an toàn để xem trước trực tiếp (hỗ trợ tiêu đề, bảng, code, danh sách)
 */
const renderMarkdownToHtml = (md = '') => {
  if (!md) return '<p style="color:#94a3b8;font-style:italic;">Chưa có nội dung Markdown...</p>';
  const escapeHtml = (s) =>
    String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

  const formatInline = (text) =>
    escapeHtml(text)
      .replace(/`([^`]+)`/g, '<code class="md-inline-code">$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\*([^*]+)\*/g, '<em>$1</em>')
      .replace(/~~([^~]+)~~/g, '<del>$1</del>')
      .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');

  const lines = String(md).replace(/\r\n/g, '\n').split('\n');
  const htmlParts = [];
  let inCodeBlock = false;
  let codeBuffer = [];
  let inList = false;
  let tableRows = [];

  const flushList = () => {
    if (inList) {
      htmlParts.push('</ul>');
      inList = false;
    }
  };

  const flushTable = () => {
    if (tableRows.length === 0) return;
    const headerCells = tableRows[0];
    const bodyRows = tableRows.slice(1).filter((r) => !r.every((c) => /^[-:\s]+$/.test(c)));
    const thHtml = headerCells.map((c) => `<th>${formatInline(c.trim())}</th>`).join('');
    const tbHtml = bodyRows
      .map((r) => `<tr>${r.map((c) => `<td>${formatInline(c.trim())}</td>`).join('')}</tr>`)
      .join('');
    htmlParts.push(
      `<div class="md-table-wrap"><table class="md-preview-table"><thead><tr>${thHtml}</tr></thead><tbody>${tbHtml}</tbody></table></div>`
    );
    tableRows = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.trim().startsWith('```')) {
      flushList();
      flushTable();
      if (!inCodeBlock) {
        inCodeBlock = true;
        codeBuffer = [];
      } else {
        inCodeBlock = false;
        htmlParts.push(`<pre class="md-code-block"><code>${escapeHtml(codeBuffer.join('\n'))}</code></pre>`);
      }
      continue;
    }

    if (inCodeBlock) {
      codeBuffer.push(line);
      continue;
    }

    // Dòng bảng Markdown | col1 | col2 |
    if (/^\s*\|(.+)\|\s*$/.test(line)) {
      flushList();
      const cells = line
        .trim()
        .replace(/^\||\|$/g, '')
        .split('|');
      tableRows.push(cells);
      continue;
    } else {
      flushTable();
    }

    if (/^#{1,4}\s+/.test(line)) {
      flushList();
      const level = line.match(/^(#{1,4})\s+/)[1].length;
      const text = line.replace(/^#{1,4}\s+/, '');
      htmlParts.push(`<h${level}>${formatInline(text)}</h${level}>`);
    } else if (/^\s*[-*+]\s+/.test(line)) {
      if (!inList) {
        htmlParts.push('<ul>');
        inList = true;
      }
      htmlParts.push(`<li>${formatInline(line.replace(/^\s*[-*+]\s+/, ''))}</li>`);
    } else if (/^\s*>\s?/.test(line)) {
      flushList();
      htmlParts.push(`<blockquote>${formatInline(line.replace(/^\s*>\s?/, ''))}</blockquote>`);
    } else if (/^\s*---\s*$/.test(line)) {
      flushList();
      htmlParts.push('<hr />');
    } else if (line.trim() === '') {
      flushList();
    } else {
      flushList();
      htmlParts.push(`<p>${formatInline(line)}</p>`);
    }
  }

  flushList();
  flushTable();
  if (inCodeBlock && codeBuffer.length > 0) {
    htmlParts.push(`<pre class="md-code-block"><code>${escapeHtml(codeBuffer.join('\n'))}</code></pre>`);
  }

  return htmlParts.join('\n');
};

/**
 * RealtimeCollaborativeEditor
 * Trình chỉnh sửa tài liệu theo thời gian thực tối ưu chuyên biệt cho 4 định dạng phổ biến:
 * 1. Word (.docx, .doc)
 * 2. Văn bản thuần (.txt)
 * 3. Markdown (.md) - hỗ trợ soạn thảo & xem trước song song
 * 4. Excel (.xlsx, .xls, .csv) - bảng tính nhiều Sheet, thanh công thức & ô tương tác trực tiếp
 */
const RealtimeCollaborativeEditor = ({
  file,
  shareToken = null,
  password = null,
  currentUser = null,
  onSaved = null,
  readOnly = false
}) => {
  const toast = useToast();
  const fileId = file?._id;
  const isCsvFile = (file?.extension || '').toLowerCase().replace(/^\./, '') === 'csv';

  const [sessionId] = useState(() => collabService.getSessionId());
  const [displayName, setDisplayName] = useState(() =>
    currentUser?.name || currentUser?.email || collabService.getGuestDisplayName()
  );
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(displayName);

  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState('txt'); // 'docx' | 'txt' | 'md' | 'excel'
  const [canEdit, setCanEdit] = useState(false);
  const [content, setContent] = useState('');
  const [revision, setRevision] = useState(1);
  const [participants, setParticipants] = useState([]);
  const [syncStatus, setSyncStatus] = useState('saved'); // 'saved' | 'typing' | 'syncing' | 'saving' | 'error'
  const [lastSavedAt, setLastSavedAt] = useState(null);
  const [lastEditor, setLastEditor] = useState(null);

  // Tùy chọn hiển thị cho Markdown ('split' | 'edit' | 'preview') và cỡ chữ cho .txt
  const [mdLayout, setMdLayout] = useState(() =>
    typeof window !== 'undefined' && window.innerWidth <= 768 ? 'edit' : 'split'
  );
  const [txtFontSize, setTxtFontSize] = useState(15);

  // Trạng thái riêng cho Bảng tính Excel
  const [sheets, setSheets] = useState(() => [{ name: 'Sheet1', data: createEmptyGrid() }]);
  const [activeSheetIdx, setActiveSheetIdx] = useState(0);
  const [activeCell, setActiveCell] = useState({ r: 0, c: 0 });
  const [renamingSheetIdx, setRenamingSheetIdx] = useState(null);
  const [sheetNameDraft, setSheetNameDraft] = useState('');

  const docxEditorRef = useRef(null);
  const mdTextareaRef = useRef(null);
  const isLocalTypingRef = useRef(false);
  const syncTimeoutRef = useRef(null);
  const autoSaveTimeoutRef = useRef(null);
  const latestContentRef = useRef('');

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

        const nextMode = data.mode || 'txt';
        const cleanedContent =
          nextMode === 'docx'
            ? sanitizeDocxHtml(data.content || '')
            : data.content || '';

        setMode(nextMode);
        setCanEdit(Boolean(data.canEdit && !readOnly));
        setContent(cleanedContent);
        latestContentRef.current = cleanedContent;
        setRevision(data.revision || 1);
        setParticipants(data.participants || []);
        setLastSavedAt(data.lastSavedAt || null);
        setLastEditor(data.lastUpdatedBy || null);
        setSyncStatus(data.dirty ? 'typing' : 'saved');

        if (nextMode === 'docx' && docxEditorRef.current) {
          docxEditorRef.current.innerHTML = cleanedContent || '<p></p>';
        } else if (nextMode === 'excel') {
          const parsedSheets = parseWorkbookJson(cleanedContent);
          setSheets(parsedSheets);
          setActiveSheetIdx(0);
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
            if (payload.senderSessionId !== sessionId && typeof payload.content === 'string') {
              isLocalTypingRef.current = false;
              const incoming = sanitizeDocxHtml(payload.content);
              latestContentRef.current = incoming;
              setContent(incoming);
              setRevision(payload.revision || 1);

              if (docxEditorRef.current) {
                docxEditorRef.current.innerHTML = incoming;
              }
              setSheets((prevSheets) => {
                try {
                  const parsed = JSON.parse(payload.content);
                  if (parsed && Array.isArray(parsed.sheets)) {
                    return parseWorkbookJson(payload.content);
                  }
                } catch (e) {
                  // Không phải JSON Excel
                }
                return prevSheets;
              });
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
              const incoming = sanitizeDocxHtml(payload.content);
              latestContentRef.current = incoming;
              setContent(incoming);
              if (docxEditorRef.current) {
                docxEditorRef.current.innerHTML = incoming;
              }
              try {
                const parsed = JSON.parse(payload.content);
                if (parsed && Array.isArray(parsed.sheets)) {
                  setSheets(parseWorkbookJson(payload.content));
                }
              } catch (e) {
                // Bỏ qua nếu không phải JSON Excel
              }
            }
            if (onSaved) {
              onSaved(payload);
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
      if (!canEdit) return;
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
    [canEdit, fileId, sessionId, displayName, shareToken, password, onSaved, toast]
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

    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }
    autoSaveTimeoutRef.current = setTimeout(() => {
      handleSaveNow(latestContentRef.current, false);
    }, 1500);
  };

  // ── Các hàm điều khiển Word (.docx) ──
  const execDocxCommand = (command, value = null) => {
    if (!canEdit || !docxEditorRef.current) return;
    docxEditorRef.current.focus();
    document.execCommand(command, false, value);
    const updatedHtml = docxEditorRef.current.innerHTML;
    triggerRealtimeSyncAndAutoSave(updatedHtml);
  };

  // ── Các hàm điều khiển Markdown (.md) ──
  const insertMarkdownSyntax = (prefix, suffix = '', placeholder = 'văn bản') => {
    if (!canEdit) return;
    const el = mdTextareaRef.current;
    if (!el) {
      const next = `${content}\n${prefix}${placeholder}${suffix}`;
      triggerRealtimeSyncAndAutoSave(next);
      return;
    }
    const start = el.selectionStart || 0;
    const end = el.selectionEnd || 0;
    const selected = content.slice(start, end) || placeholder;
    const nextVal = content.slice(0, start) + prefix + selected + suffix + content.slice(end);
    triggerRealtimeSyncAndAutoSave(nextVal);
    setTimeout(() => {
      el.focus();
      el.setSelectionRange(start + prefix.length, start + prefix.length + selected.length);
    }, 0);
  };

  // ── Các hàm điều khiển Bảng tính Excel (.xlsx, .xls, .csv) ──
  const currentSheet = sheets[activeSheetIdx] || sheets[0] || { name: 'Sheet1', data: createEmptyGrid() };
  const currentGrid = currentSheet.data || createEmptyGrid();
  const rowCount = currentGrid.length;
  const colCount = currentGrid[0]?.length || 8;
  const activeCellValue = currentGrid[activeCell.r]?.[activeCell.c] ?? '';
  const activeCellLabel = `${colIndexToLetter(activeCell.c)}${activeCell.r + 1}`;

  const commitSheetsUpdate = (nextSheets) => {
    setSheets(nextSheets);
    const serialized = JSON.stringify({ sheets: nextSheets });
    triggerRealtimeSyncAndAutoSave(serialized);
  };

  const handleCellChange = (rIdx, cIdx, val) => {
    if (!canEdit) return;
    const nextSheets = sheets.map((s, idx) => {
      if (idx !== activeSheetIdx) return s;
      const nextData = s.data.map((row, r) =>
        r === rIdx ? row.map((cell, c) => (c === cIdx ? val : cell)) : row
      );
      return { ...s, data: nextData };
    });
    commitSheetsUpdate(nextSheets);
  };

  const handleAddRow = () => {
    if (!canEdit) return;
    const nextSheets = sheets.map((s, idx) => {
      if (idx !== activeSheetIdx) return s;
      const cols = s.data[0]?.length || 8;
      return {
        ...s,
        data: [...s.data, Array.from({ length: cols }, () => '')]
      };
    });
    commitSheetsUpdate(nextSheets);
  };

  const handleAddColumn = () => {
    if (!canEdit) return;
    const nextSheets = sheets.map((s, idx) => {
      if (idx !== activeSheetIdx) return s;
      return {
        ...s,
        data: s.data.map((row) => [...row, ''])
      };
    });
    commitSheetsUpdate(nextSheets);
  };

  const handleDeleteActiveRow = () => {
    if (!canEdit || currentGrid.length <= 1) return;
    const targetRow = activeCell.r;
    const nextSheets = sheets.map((s, idx) => {
      if (idx !== activeSheetIdx) return s;
      const filtered = s.data.filter((_, r) => r !== targetRow);
      return {
        ...s,
        data: filtered.length > 0 ? filtered : createEmptyGrid(1, colCount)
      };
    });
    setActiveCell((prev) => ({ ...prev, r: Math.max(0, prev.r - 1) }));
    commitSheetsUpdate(nextSheets);
  };

  const handleDeleteActiveColumn = () => {
    if (!canEdit || colCount <= 1) return;
    const targetCol = activeCell.c;
    const nextSheets = sheets.map((s, idx) => {
      if (idx !== activeSheetIdx) return s;
      return {
        ...s,
        data: s.data.map((row) => row.filter((_, c) => c !== targetCol))
      };
    });
    setActiveCell((prev) => ({ ...prev, c: Math.max(0, prev.c - 1) }));
    commitSheetsUpdate(nextSheets);
  };

  const handleAddSheet = () => {
    if (!canEdit || isCsvFile) return;
    const newIndex = sheets.length + 1;
    const nextSheets = [
      ...sheets,
      { name: `Sheet${newIndex}`, data: createEmptyGrid(12, 8) }
    ];
    setActiveSheetIdx(nextSheets.length - 1);
    setActiveCell({ r: 0, c: 0 });
    commitSheetsUpdate(nextSheets);
  };

  const handleDeleteSheet = (idxToDelete, e) => {
    if (e) e.stopPropagation();
    if (!canEdit || sheets.length <= 1) return;
    const nextSheets = sheets.filter((_, idx) => idx !== idxToDelete);
    setActiveSheetIdx((prev) => Math.max(0, Math.min(prev, nextSheets.length - 1)));
    commitSheetsUpdate(nextSheets);
  };

  const handleCommitSheetRename = (idx) => {
    const trimmed = sheetNameDraft.trim().slice(0, 31);
    setRenamingSheetIdx(null);
    if (!trimmed) return;
    const nextSheets = sheets.map((s, i) => (i === idx ? { ...s, name: trimmed } : s));
    commitSheetsUpdate(nextSheets);
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

  // Thống kê cho từng định dạng
  const statsInfo = useMemo(() => {
    if (mode === 'excel') {
      let filledCells = 0;
      for (const row of currentGrid) {
        for (const cell of row) {
          if (String(cell ?? '').trim() !== '') filledCells++;
        }
      }
      return {
        label: 'Bảng tính Excel',
        summary: `${sheets.length} Sheet • ${rowCount} dòng × ${colCount} cột • ${filledCells} ô có dữ liệu`
      };
    }

    const plain =
      mode === 'docx'
        ? content
            .replace(/<[^>]+>/g, ' ')
            .replace(/data:image\/[a-zA-Z0-9+.-]+;base64,[A-Za-z0-9+/=\s]+/gi, ' ')
            .replace(/\s+/g, ' ')
            .trim()
        : content;
    const words = plain ? plain.trim().split(/\s+/).filter(Boolean).length : 0;
    const chars = plain ? plain.length : 0;
    const lines = mode !== 'docx' ? (content ? content.split('\n').length : 1) : 0;

    return {
      label:
        mode === 'docx'
          ? 'Tài liệu Word (.docx)'
          : mode === 'md'
          ? 'Tài liệu Markdown (.md)'
          : 'Văn bản thuần (.txt)',
      summary: `${words.toLocaleString()} từ • ${chars.toLocaleString()} ký tự${
        mode !== 'docx' ? ` • ${lines.toLocaleString()} dòng` : ''
      }`
    };
  }, [mode, content, sheets.length, rowCount, colCount, currentGrid]);

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
    <div className="realtime-editor-root">
      {/* ── Thanh Trạng thái Cộng tác Thời gian thực (Live Collaboration Bar) ── */}
      <div className="realtime-collab-bar">
        <div className="realtime-collab-left">
          <span className="badge badge-emerald tabular-nums" style={{ gap: '6px', padding: '4px 10px' }}>
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

          <div className="realtime-participants-list">
            {participants.map((p) => {
              const isMe = p.sessionId === sessionId;
              return (
                <div
                  key={p.sessionId}
                  title={`${p.displayName}${isMe ? ' (Bạn)' : ''}${p.isTyping ? ' - Đang gõ...' : ''}`}
                  className="realtime-participant-pill"
                  style={{
                    border: `1px solid ${p.isTyping ? p.color : 'var(--border-main)'}`
                  }}
                >
                  <span
                    className="realtime-participant-avatar"
                    style={{ backgroundColor: p.color || '#8b5cf6' }}
                  >
                    {(p.displayName || 'U')[0].toUpperCase()}
                  </span>
                  <span className="realtime-participant-name">
                    {p.displayName}
                    {isMe ? ' (Bạn)' : ''}
                  </span>
                </div>
              );
            })}
          </div>

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

        <div className="realtime-collab-right">
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
                <span>{syncStatus === 'saving' ? 'Đang lưu vào tệp...' : 'Đang đồng bộ...'}</span>
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
                  Đã lưu
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
      </div>

      {/* ── 1. Thanh công cụ cho Word (.docx) ── */}
      {mode === 'docx' && canEdit && (
        <div className="realtime-format-toolbar">
          <button type="button" className="btn-icon" title="Hoàn tác (Ctrl+Z)" onClick={() => execDocxCommand('undo')}>
            <Undo2 size={15} />
          </button>
          <button type="button" className="btn-icon" title="Làm lại (Ctrl+Y)" onClick={() => execDocxCommand('redo')}>
            <Redo2 size={15} />
          </button>
          <span className="realtime-toolbar-divider" />
          <button type="button" className="btn-icon" title="Tiêu đề 1" onClick={() => execDocxCommand('formatBlock', 'H1')}>
            <Heading1 size={15} />
          </button>
          <button type="button" className="btn-icon" title="Tiêu đề 2" onClick={() => execDocxCommand('formatBlock', 'H2')}>
            <Heading2 size={15} />
          </button>
          <span className="realtime-toolbar-divider" />
          <button type="button" className="btn-icon" title="In đậm (Ctrl+B)" onClick={() => execDocxCommand('bold')}>
            <Bold size={15} />
          </button>
          <button type="button" className="btn-icon" title="In nghiêng (Ctrl+I)" onClick={() => execDocxCommand('italic')}>
            <Italic size={15} />
          </button>
          <button type="button" className="btn-icon" title="Gạch chân (Ctrl+U)" onClick={() => execDocxCommand('underline')}>
            <Underline size={15} />
          </button>
          <span className="realtime-toolbar-divider" />
          <button type="button" className="btn-icon" title="Danh sách dấu chấm" onClick={() => execDocxCommand('insertUnorderedList')}>
            <List size={15} />
          </button>
          <button type="button" className="btn-icon" title="Danh sách đánh số" onClick={() => execDocxCommand('insertOrderedList')}>
            <ListOrdered size={15} />
          </button>
          <span className="realtime-toolbar-divider" />
          <button type="button" className="btn-icon" title="Căn trái" onClick={() => execDocxCommand('justifyLeft')}>
            <AlignLeft size={15} />
          </button>
          <button type="button" className="btn-icon" title="Căn giữa" onClick={() => execDocxCommand('justifyCenter')}>
            <AlignCenter size={15} />
          </button>
          <button type="button" className="btn-icon" title="Căn phải" onClick={() => execDocxCommand('justifyRight')}>
            <AlignRight size={15} />
          </button>
        </div>
      )}

      {/* ── 2. Thanh công cụ cho Markdown (.md) ── */}
      {mode === 'md' && (
        <div className="realtime-format-toolbar" style={{ justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            {canEdit && (
              <>
                <button
                  type="button"
                  className="btn-icon"
                  title="Tiêu đề H1"
                  onClick={() => insertMarkdownSyntax('# ', '', 'Tiêu đề lớn')}
                >
                  <Heading1 size={15} />
                </button>
                <button
                  type="button"
                  className="btn-icon"
                  title="Tiêu đề H2"
                  onClick={() => insertMarkdownSyntax('## ', '', 'Tiêu đề mục')}
                >
                  <Heading2 size={15} />
                </button>
                <button
                  type="button"
                  className="btn-icon"
                  title="In đậm (**text**)"
                  onClick={() => insertMarkdownSyntax('**', '**', 'chữ đậm')}
                >
                  <Bold size={15} />
                </button>
                <button
                  type="button"
                  className="btn-icon"
                  title="In nghiêng (*text*)"
                  onClick={() => insertMarkdownSyntax('*', '*', 'chữ nghiêng')}
                >
                  <Italic size={15} />
                </button>
                <span className="realtime-toolbar-divider" />
                <button
                  type="button"
                  className="btn-icon"
                  title="Danh sách gạch đầu dòng"
                  onClick={() => insertMarkdownSyntax('- ', '', 'Mục danh sách')}
                >
                  <List size={15} />
                </button>
                <button
                  type="button"
                  className="btn-icon"
                  title="Trích dẫn (>)"
                  onClick={() => insertMarkdownSyntax('> ', '', 'Nội dung trích dẫn')}
                >
                  <Quote size={15} />
                </button>
                <button
                  type="button"
                  className="btn-icon"
                  title="Khối mã (```)"
                  onClick={() => insertMarkdownSyntax('\n```\n', '\n```\n', 'code')}
                >
                  <Code size={15} />
                </button>
                <button
                  type="button"
                  className="btn-icon"
                  title="Chèn bảng Markdown"
                  onClick={() =>
                    insertMarkdownSyntax(
                      '\n| Cột 1 | Cột 2 | Cột 3 |\n| --- | --- | --- |\n| ',
                      ' | Dữ liệu 2 | Dữ liệu 3 |\n',
                      'Dữ liệu 1'
                    )
                  }
                >
                  <TableIcon size={15} />
                </button>
              </>
            )}
          </div>

          <div className="preview-mode-switcher">
            <button
              type="button"
              className={`btn btn-sm ${mdLayout === 'edit' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setMdLayout('edit')}
              style={{ padding: '4px 9px', fontSize: '0.74rem' }}
            >
              <Edit3 size={13} />
              <span>Mã Markdown</span>
            </button>
            <button
              type="button"
              className={`btn btn-sm ${mdLayout === 'split' ? 'btn-primary' : 'btn-ghost'} hidden-mobile`}
              onClick={() => setMdLayout('split')}
              style={{ padding: '4px 9px', fontSize: '0.74rem' }}
            >
              <Columns size={13} />
              <span>Song song</span>
            </button>
            <button
              type="button"
              className={`btn btn-sm ${mdLayout === 'preview' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setMdLayout('preview')}
              style={{ padding: '4px 9px', fontSize: '0.74rem' }}
            >
              <Eye size={13} />
              <span>Xem kết quả</span>
            </button>
          </div>
        </div>
      )}

      {/* ── 3. Thanh công cụ cho Văn bản thuần (.txt) ── */}
      {mode === 'txt' && (
        <div className="realtime-format-toolbar" style={{ justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
            <FileText size={14} style={{ color: 'var(--primary-500)' }} />
            <span>Trình soạn thảo văn bản thuần UTF-8 (.txt)</span>
          </div>
          <div className=" tabular-nums" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Cỡ chữ:</span>
            {[13, 15, 17].map((sz) => (
              <button
                key={sz}
                type="button"
                className={`btn btn-sm ${txtFontSize === sz ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setTxtFontSize(sz)}
                style={{ padding: '2px 8px', fontSize: '0.72rem' }}
              >
                {sz}px
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── 4. Thanh công cụ & Thanh công thức cho Bảng tính Excel (.xlsx, .xls, .csv) ── */}
      {mode === 'excel' && (
        <div className="realtime-excel-toolbar-wrap">
          <div className="realtime-format-toolbar" style={{ justifyContent: 'space-between', borderBottom: 'none', paddingBottom: '4px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
              <span className="badge badge-emerald" style={{ gap: '5px', fontSize: '0.72rem' }}>
                <FileSpreadsheet size={13} />
                <span>{isCsvFile ? 'Bảng dữ liệu CSV' : 'Bảng tính Excel (.xlsx)'}</span>
              </span>

              {canEdit && (
                <>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={handleAddRow}
                    style={{ padding: '4px 9px', fontSize: '0.74rem' }}
                  >
                    <Plus size={13} />
                    <span>Thêm dòng</span>
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={handleAddColumn}
                    style={{ padding: '4px 9px', fontSize: '0.74rem' }}
                  >
                    <Plus size={13} />
                    <span>Thêm cột</span>
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={handleDeleteActiveRow}
                    disabled={rowCount <= 1}
                    title={`Xóa dòng số ${activeCell.r + 1}`}
                    style={{ padding: '4px 9px', fontSize: '0.74rem', color: 'var(--accent-rose)' }}
                  >
                    <Trash2 size={13} />
                    <span>Xóa dòng {activeCell.r + 1}</span>
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={handleDeleteActiveColumn}
                    disabled={colCount <= 1}
                    title={`Xóa cột ${colIndexToLetter(activeCell.c)}`}
                    style={{ padding: '4px 9px', fontSize: '0.74rem', color: 'var(--accent-rose)' }}
                  >
                    <Trash2 size={13} />
                    <span>Xóa cột {colIndexToLetter(activeCell.c)}</span>
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Thanh ô đang chọn (Active Cell Formula Bar) */}
          <div className="realtime-excel-formula-bar">
            <span className="realtime-excel-cell-badge tabular-nums">{activeCellLabel}</span>
            <input
              type="text"
              className="realtime-excel-formula-input"
              value={activeCellValue}
              readOnly={!canEdit}
              onChange={(e) => handleCellChange(activeCell.r, activeCell.c, e.target.value)}
              placeholder={`Nhập giá trị cho ô ${activeCellLabel}...`}
            />
          </div>
        </div>
      )}

      {/* ── Vùng Soạn thảo Chính ── */}
      <div className="realtime-editor-body">
        {mode === 'docx' ? (
          <div className="realtime-docx-scroll">
            <div
              ref={docxEditorRef}
              className="realtime-docx-sheet"
              contentEditable={canEdit}
              suppressContentEditableWarning
              onInput={(e) => {
                const newHtml = e.currentTarget.innerHTML;
                triggerRealtimeSyncAndAutoSave(newHtml);
              }}
            />
          </div>
        ) : mode === 'md' ? (
          <div className={`realtime-md-split-container layout-${mdLayout}`}>
            {(mdLayout === 'edit' || mdLayout === 'split') && (
              <textarea
                ref={mdTextareaRef}
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
                placeholder="# Nhập nội dung Markdown tại đây..."
                className="realtime-text-area realtime-md-editor-pane"
              />
            )}
            {(mdLayout === 'preview' || mdLayout === 'split') && (
              <div
                className="realtime-md-preview-pane"
                dangerouslySetInnerHTML={{ __html: renderMarkdownToHtml(content) }}
              />
            )}
          </div>
        ) : mode === 'excel' ? (
          <div className="realtime-excel-workspace">
            <div className="realtime-excel-grid-scroll">
              <table className="realtime-excel-table">
                <thead>
                  <tr>
                    <th className="excel-corner-cell">#</th>
                    {Array.from({ length: colCount }).map((_, cIdx) => (
                      <th
                        key={cIdx}
                        className={`excel-col-header ${activeCell.c === cIdx ? 'active-header' : ''}`}
                      >
                        {colIndexToLetter(cIdx)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {currentGrid.map((row, rIdx) => (
                    <tr key={rIdx} className={rIdx === 0 ? 'excel-first-row' : ''}>
                      <td
                        className={`excel-row-header tabular-nums ${
                          activeCell.r === rIdx ? 'active-header' : ''
                        }`}
                      >
                        {rIdx + 1}
                      </td>
                      {row.map((cellVal, cIdx) => {
                        const isSelected = activeCell.r === rIdx && activeCell.c === cIdx;
                        return (
                          <td
                            key={cIdx}
                            className={`excel-data-cell ${isSelected ? 'is-selected' : ''}`}
                            onClick={() => setActiveCell({ r: rIdx, c: cIdx })}
                          >
                            <input
                              type="text"
                              value={cellVal}
                              readOnly={!canEdit}
                              onFocus={() => setActiveCell({ r: rIdx, c: cIdx })}
                              onChange={(e) => handleCellChange(rIdx, cIdx, e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  const nextR = Math.min(rowCount - 1, rIdx + 1);
                                  setActiveCell({ r: nextR, c: cIdx });
                                } else if (e.key === 'Tab') {
                                  e.preventDefault();
                                  const nextC = (cIdx + 1) % colCount;
                                  const nextR = cIdx + 1 >= colCount ? Math.min(rowCount - 1, rIdx + 1) : rIdx;
                                  setActiveCell({ r: nextR, c: nextC });
                                }
                              }}
                              className="excel-cell-input"
                            />
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Thanh chọn Sheet ở đáy bảng tính */}
            <div className="realtime-excel-sheet-bar">
              <div className="realtime-excel-sheets-list">
                {sheets.map((sheet, idx) => {
                  const isActive = idx === activeSheetIdx;
                  return (
                    <div
                      key={idx}
                      className={`excel-sheet-tab ${isActive ? 'active' : ''}`}
                      onClick={() => {
                        setActiveSheetIdx(idx);
                        setActiveCell({ r: 0, c: 0 });
                      }}
                      onDoubleClick={() => {
                        if (!canEdit || isCsvFile) return;
                        setRenamingSheetIdx(idx);
                        setSheetNameDraft(sheet.name);
                      }}
                      title={canEdit && !isCsvFile ? 'Nháy đúp để đổi tên Sheet' : sheet.name}
                    >
                      {renamingSheetIdx === idx ? (
                        <input
                          type="text"
                          value={sheetNameDraft}
                          onChange={(e) => setSheetNameDraft(e.target.value)}
                          onBlur={() => handleCommitSheetRename(idx)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleCommitSheetRename(idx);
                            if (e.key === 'Escape') setRenamingSheetIdx(null);
                          }}
                          autoFocus
                          className="excel-sheet-rename-input"
                          onClick={(e) => e.stopPropagation()}
                        />
                      ) : (
                        <span>{sheet.name}</span>
                      )}

                      {canEdit && !isCsvFile && sheets.length > 1 && (
                        <button
                          type="button"
                          className="excel-sheet-delete-btn"
                          onClick={(e) => handleDeleteSheet(idx, e)}
                          title={`Xóa ${sheet.name}`}
                        >
                          ×
                        </button>
                      )}
                    </div>
                  );
                })}

                {canEdit && !isCsvFile && (
                  <button
                    type="button"
                    className="excel-add-sheet-btn"
                    onClick={handleAddSheet}
                    title="Thêm Sheet mới"
                  >
                    <Plus size={14} />
                    <span>Thêm Sheet</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* Chế độ Văn bản thuần (.txt) */
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
            placeholder="Nhập nội dung văn bản (.txt) tại đây..."
            className="realtime-text-area"
            style={{ fontSize: `${txtFontSize}px` }}
          />
        )}
      </div>

      {/* ── Chân trang Thống kê & Trạng thái Cộng tác ── */}
      <div className="realtime-editor-footer tabular-nums">
        <div className="realtime-footer-stats">
          <span>
            Định dạng: <strong>{statsInfo.label}</strong>
          </span>
          <span>•</span>
          <span>{statsInfo.summary}</span>
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
