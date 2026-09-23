import React, { useState, useEffect, useRef } from 'react';
import {
  Download,
  X,
  AlertCircle,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Sparkles,
  Check,
  ChevronRight,
  RefreshCw,
  Tag,
  Folder,
  FileText,
  Clock,
  CheckCircle2,
  XCircle,
  Brain
} from 'lucide-react';
import fileService from '../../services/fileService';
import aiService from '../../services/aiService';
import FileIcon from './FileIcon';

const FilePreviewModal = ({ file, isOpen, onClose, onDownload, onFileUpdated }) => {
  const [currentFile, setCurrentFile] = useState(file);
  const [blobUrl, setBlobUrl] = useState(null);
  const [textContent, setTextContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [showAiPanel, setShowAiPanel] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Sync state when file prop changes
  useEffect(() => {
    setCurrentFile(file);
  }, [file]);

  // Polling AI status if pending or processing
  useEffect(() => {
    if (!isOpen || !currentFile?._id) return;

    const status = currentFile.aiStatus;
    if (status !== 'pending' && status !== 'processing') return;

    const pollInterval = setInterval(async () => {
      try {
        const res = await fileService.getFileById(currentFile._id);
        const updated = res?.data || res;
        if (updated && updated._id) {
          setCurrentFile(updated);
          if (onFileUpdated) {
            onFileUpdated(updated);
          }
          if (updated.aiStatus !== 'pending' && updated.aiStatus !== 'processing') {
            clearInterval(pollInterval);
          }
        }
      } catch (pollErr) {
        console.error('[AI Polling Error]:', pollErr);
      }
    }, 2000);

    return () => clearInterval(pollInterval);
  }, [isOpen, currentFile?._id, currentFile?.aiStatus, onFileUpdated]);

  // Fetch preview blob
  useEffect(() => {
    let activeUrl = null;

    const fetchPreview = async () => {
      if (!currentFile || !isOpen) return;

      setLoading(true);
      setError(null);
      setTextContent('');
      setZoom(1);
      setRotation(0);

      try {
        const blob = await fileService.previewFileBlob(currentFile._id);
        const mime = (blob.type || currentFile.mimeType || '').toLowerCase();

        if (
          mime.startsWith('text/') ||
          mime.includes('json') ||
          mime.includes('javascript') ||
          ['txt', 'js', 'json', 'md', 'html', 'css', 'ts'].includes(
            (currentFile.extension || '').toLowerCase()
          )
        ) {
          const text = await blob.text();
          setTextContent(text);
        }

        activeUrl = URL.createObjectURL(blob);
        setBlobUrl(activeUrl);
      } catch (err) {
        console.error('Lỗi khi tải bản xem trước:', err);
        setError('Không thể tải bản xem trước cho tệp này hoặc định dạng chưa được hỗ trợ.');
      } finally {
        setLoading(false);
      }
    };

    fetchPreview();

    return () => {
      if (activeUrl) {
        URL.revokeObjectURL(activeUrl);
      }
      setBlobUrl(null);
    };
  }, [currentFile?._id, isOpen]);

  if (!isOpen || !currentFile) return null;

  const mime = (currentFile.mimeType || '').toLowerCase();
  const ext = (currentFile.extension || '').toLowerCase();

  const isImage = mime.startsWith('image/') || ['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext);
  const isVideo = mime.startsWith('video/') || ['mp4', 'webm', 'mov'].includes(ext);
  const isAudio = mime.startsWith('audio/') || ['mp3', 'wav', 'ogg'].includes(ext);
  const isPdf = mime.includes('pdf') || ext === 'pdf';
  const isText = Boolean(textContent);

  // AI Actions
  const handleAcceptName = async () => {
    if (!currentFile.aiSuggestedName) return;
    try {
      setActionLoading(true);
      const res = await aiService.acceptName(currentFile._id);
      const updated = res?.data || res;
      setCurrentFile((prev) => ({
        ...prev,
        name: updated.name || prev.aiSuggestedName,
        aiSuggestedName: ''
      }));
      if (onFileUpdated) onFileUpdated(updated);
    } catch (err) {
      alert(err.response?.data?.message || 'Không thể áp dụng tên đề xuất');
    } finally {
      setActionLoading(false);
    }
  };

  const handleAcceptFolder = async () => {
    if (!currentFile.aiSuggestedFolder) return;
    try {
      setActionLoading(true);
      const res = await aiService.acceptFolder(currentFile._id);
      const updated = res?.data || res;
      setCurrentFile((prev) => ({
        ...prev,
        folder: updated.folder || prev.aiSuggestedFolder,
        aiSuggestedFolder: null
      }));
      if (onFileUpdated) onFileUpdated(updated);
    } catch (err) {
      alert(err.response?.data?.message || 'Không thể di chuyển đến thư mục đề xuất');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDismissSuggestions = async () => {
    try {
      setActionLoading(true);
      const res = await aiService.dismissSuggestions(currentFile._id);
      const updated = res?.data || res;
      setCurrentFile((prev) => ({
        ...prev,
        aiSuggestedName: '',
        aiSuggestedFolder: null
      }));
      if (onFileUpdated) onFileUpdated(updated);
    } catch (err) {
      alert(err.response?.data?.message || 'Lỗi khi bỏ qua gợi ý');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRetryAi = async () => {
    try {
      setActionLoading(true);
      const res = await aiService.processFile(currentFile._id);
      const updated = res?.data || res;
      setCurrentFile((prev) => ({
        ...prev,
        aiStatus: 'processing',
        aiError: ''
      }));
      if (onFileUpdated) onFileUpdated(updated);
    } catch (err) {
      alert(err.response?.data?.message || 'Không thể kích hoạt lại phân tích AI');
    } finally {
      setActionLoading(false);
    }
  };

  const renderStatusBadge = () => {
    const status = currentFile.aiStatus;
    if (status === 'processing') {
      return (
        <span className="badge badge-ai-processing">
          <RefreshCw size={12} className="spin-animation" />
          <span>Đang phân tích...</span>
        </span>
      );
    }
    if (status === 'pending') {
      return (
        <span className="badge badge-ai-pending">
          <Clock size={12} />
          <span>Chờ xử lý AI</span>
        </span>
      );
    }
    if (status === 'completed') {
      return (
        <span className="badge badge-ai-completed">
          <CheckCircle2 size={12} />
          <span>Đã phân tích</span>
        </span>
      );
    }
    if (status === 'failed') {
      return (
        <span className="badge badge-ai-failed">
          <XCircle size={12} />
          <span>Thất bại</span>
        </span>
      );
    }
    return (
      <span className="badge badge-ai-skipped">
        <span>Bỏ qua</span>
      </span>
    );
  };

  return (
    <div
      className="modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-card modal-full" role="dialog" aria-modal="true">
        {/* Thanh công cụ Preview */}
        <div className="preview-toolbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
            <FileIcon mimeType={currentFile.mimeType} extension={currentFile.extension} size={24} />
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontWeight: 700,
                  fontSize: '0.9375rem',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}
                title={currentFile.name}
              >
                {currentFile.name}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {currentFile.formattedSize || `${currentFile.size} Bytes`}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {isImage && (
              <>
                <button
                  className="btn-icon"
                  title="Thu nhỏ"
                  onClick={() => setZoom((prev) => Math.max(0.4, prev - 0.2))}
                >
                  <ZoomOut size={18} />
                </button>
                <button
                  className="btn-icon"
                  title="Phóng to"
                  onClick={() => setZoom((prev) => Math.min(3, prev + 0.2))}
                >
                  <ZoomIn size={18} />
                </button>
                <button
                  className="btn-icon"
                  title="Xoay 90°"
                  onClick={() => setRotation((prev) => (prev + 90) % 360)}
                >
                  <RotateCw size={18} />
                </button>
              </>
            )}

            {onDownload && (
              <button
                className="btn btn-secondary"
                onClick={() => onDownload(currentFile)}
                style={{ padding: '6px 12px' }}
              >
                <Download size={16} />
                <span>Tải xuống</span>
              </button>
            )}

            <button
              className={`btn ${showAiPanel ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setShowAiPanel(!showAiPanel)}
              title={showAiPanel ? 'Ẩn bảng phân tích AI' : 'Hiện bảng phân tích AI'}
              style={{ padding: '6px 12px' }}
            >
              <Sparkles size={16} />
              <span>Trợ lý AI</span>
            </button>

            <button className="btn-icon" onClick={onClose} aria-label="Đóng xem trước">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Khung nội dung chia cột Media & AI */}
        <div className="preview-split-body">
          {/* Cột trái: Media Viewer */}
          <div className="preview-media-viewer">
            {loading && (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '12px',
                  color: '#ffffff'
                }}
              >
                <span className="spinner" style={{ width: 32, height: 32 }} />
                <span style={{ fontSize: '0.875rem' }}>Đang tải nội dung tệp...</span>
              </div>
            )}

            {error && (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '12px',
                  color: '#f87171',
                  padding: '24px',
                  textAlign: 'center'
                }}
              >
                <AlertCircle size={48} />
                <div>{error}</div>
                {onDownload && (
                  <button className="btn btn-secondary" onClick={() => onDownload(currentFile)}>
                    <Download size={16} />
                    <span>Tải tệp về máy để xem</span>
                  </button>
                )}
              </div>
            )}

            {!loading && !error && blobUrl && (
              <>
                {isImage && (
                  <img
                    src={blobUrl}
                    alt={currentFile.name}
                    className="preview-image"
                    style={{
                      transform: `scale(${zoom}) rotate(${rotation}deg)`,
                      transition: 'transform 0.15s ease-out'
                    }}
                  />
                )}

                {isVideo && (
                  <video src={blobUrl} controls autoPlay className="preview-media-element">
                    Trình duyệt không hỗ trợ xem video trực tiếp.
                  </video>
                )}

                {isAudio && (
                  <div
                    style={{
                      padding: '40px',
                      background: 'rgba(255, 255, 255, 0.05)',
                      borderRadius: '16px'
                    }}
                  >
                    <audio src={blobUrl} controls autoPlay style={{ width: 360 }}>
                      Trình duyệt không hỗ trợ phát âm thanh trực tiếp.
                    </audio>
                  </div>
                )}

                {isPdf && (
                  <iframe
                    src={`${blobUrl}#toolbar=1`}
                    title={currentFile.name}
                    className="preview-iframe"
                  />
                )}

                {isText && (
                  <pre className="preview-text-box">
                    <code>{textContent}</code>
                  </pre>
                )}

                {!isImage && !isVideo && !isAudio && !isPdf && !isText && (
                  <div style={{ textAlign: 'center', color: '#cbd5e1', padding: '30px' }}>
                    <FileIcon
                      mimeType={currentFile.mimeType}
                      extension={currentFile.extension}
                      size={64}
                    />
                    <div style={{ marginTop: '16px', fontSize: '1rem', fontWeight: 600 }}>
                      Không có bản xem trước trực tuyến khả dụng
                    </div>
                    <div style={{ fontSize: '0.875rem', color: '#94a3b8', marginTop: '6px' }}>
                      Định dạng .{ext} không thể hiển thị trực tiếp trong trình duyệt.
                    </div>
                    {onDownload && (
                      <button
                        className="btn btn-primary"
                        onClick={() => onDownload(currentFile)}
                        style={{ marginTop: '18px' }}
                      >
                        <Download size={16} />
                        <span>
                          Tải về máy ({currentFile.formattedSize || `${currentFile.size} Bytes`})
                        </span>
                      </button>
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Cột phải: Sidebar AI phân tích tài liệu */}
          {showAiPanel && (
            <aside className="preview-ai-sidebar">
              <div className="preview-ai-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Brain size={18} className="text-primary" />
                  <span style={{ fontWeight: 700, fontSize: '0.9375rem' }}>
                    Phân tích thông minh AI
                  </span>
                </div>
                {renderStatusBadge()}
              </div>

              <div className="preview-ai-content">
                {/* Trạng thái đang xử lý */}
                {(currentFile.aiStatus === 'processing' || currentFile.aiStatus === 'pending') && (
                  <div className="ai-processing-state">
                    <div className="ai-pulse-dot" />
                    <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>
                      AI đang đọc & phân loại nội dung...
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      Tự động trích xuất nội dung văn bản và tạo tóm tắt thông minh.
                    </div>
                  </div>
                )}

                {/* Phân loại danh mục & Độ tin cậy */}
                <div className="ai-section-card">
                  <div className="ai-section-title">
                    <FileText size={14} />
                    <span>Danh mục tài liệu</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '8px' }}>
                    <span className="ai-category-tag">
                      {currentFile.aiCategory || 'Chưa phân loại'}
                    </span>
                    {typeof currentFile.aiConfidence === 'number' && (
                      <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-primary)' }}>
                        Độ tin cậy: {Math.round(currentFile.aiConfidence * 100)}%
                      </span>
                    )}
                  </div>
                  {typeof currentFile.aiConfidence === 'number' && (
                    <div className="ai-confidence-bar-bg">
                      <div
                        className="ai-confidence-bar-fill"
                        style={{ width: `${Math.round(currentFile.aiConfidence * 100)}%` }}
                      />
                    </div>
                  )}
                </div>

                {/* Tóm tắt văn bản tệp tin */}
                {currentFile.aiSummary && (
                  <div className="ai-section-card">
                    <div className="ai-section-title">
                      <Sparkles size={14} />
                      <span>Tóm tắt nội dung AI</span>
                    </div>
                    <p className="ai-summary-text">{currentFile.aiSummary}</p>
                  </div>
                )}

                {/* Thẻ từ khóa (Tags) */}
                {Array.isArray(currentFile.aiTags) && currentFile.aiTags.length > 0 && (
                  <div className="ai-section-card">
                    <div className="ai-section-title">
                      <Tag size={14} />
                      <span>Thẻ từ khóa gợi ý</span>
                    </div>
                    <div className="ai-tags-list">
                      {currentFile.aiTags.map((tag, idx) => (
                        <span key={idx} className="ai-tag-chip">
                          #{tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Đề xuất đổi tên */}
                {currentFile.aiSuggestedName && currentFile.aiSuggestedName !== currentFile.name && (
                  <div className="ai-suggestion-box">
                    <div className="ai-suggestion-badge">Đề xuất tên mới</div>
                    <div className="ai-suggestion-value" title={currentFile.aiSuggestedName}>
                      {currentFile.aiSuggestedName}
                    </div>
                    <div className="ai-suggestion-actions">
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={handleAcceptName}
                        disabled={actionLoading}
                      >
                        <Check size={14} />
                        <span>Chấp nhận tên</span>
                      </button>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={handleDismissSuggestions}
                        disabled={actionLoading}
                      >
                        <span>Bỏ qua</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Đề xuất thư mục */}
                {currentFile.aiSuggestedFolder && (
                  <div className="ai-suggestion-box">
                    <div className="ai-suggestion-badge">Đề xuất thư mục đích</div>
                    <div className="ai-suggestion-value" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Folder size={14} />
                      <span>{currentFile.aiSuggestedFolder?.name || 'Thư mục tương ứng'}</span>
                    </div>
                    <div className="ai-suggestion-actions">
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={handleAcceptFolder}
                        disabled={actionLoading}
                      >
                        <Check size={14} />
                        <span>Chuyển vào thư mục</span>
                      </button>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={handleDismissSuggestions}
                        disabled={actionLoading}
                      >
                        <span>Bỏ qua</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Báo lỗi nếu AI failed */}
                {currentFile.aiStatus === 'failed' && (
                  <div className="ai-error-box">
                    <AlertCircle size={16} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600 }}>Không thể hoàn tất phân tích</div>
                      <div style={{ fontSize: '0.75rem', opacity: 0.85 }}>
                        {currentFile.aiError || 'Không thể kết nối đến mô hình AI hoặc thiếu API Key.'}
                      </div>
                    </div>
                  </div>
                )}

                {/* Nút hành động phân tích lại */}
                <div style={{ marginTop: 'auto', paddingTop: '16px' }}>
                  <button
                    className="btn btn-secondary w-full"
                    onClick={handleRetryAi}
                    disabled={actionLoading || currentFile.aiStatus === 'processing'}
                    style={{ width: '100%', justifyContent: 'center' }}
                  >
                    <RefreshCw size={14} className={actionLoading ? 'spin-animation' : ''} />
                    <span>Phân tích lại bằng AI</span>
                  </button>
                </div>
              </div>
            </aside>
          )}
        </div>
      </div>
    </div>
  );
};

export default FilePreviewModal;
