import React, { useState, useEffect } from 'react';
import { Download, X, AlertCircle, ZoomIn, ZoomOut, RotateCw } from 'lucide-react';
import fileService from '../../services/fileService';
import FileIcon from './FileIcon';

const FilePreviewModal = ({ file, isOpen, onClose, onDownload }) => {
  const [blobUrl, setBlobUrl] = useState(null);
  const [textContent, setTextContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);

  useEffect(() => {
    let currentUrl = null;

    const fetchPreview = async () => {
      if (!file || !isOpen) return;

      setLoading(true);
      setError(null);
      setTextContent('');
      setZoom(1);
      setRotation(0);

      try {
        const blob = await fileService.previewFileBlob(file._id);
        const mime = (blob.type || file.mimeType || '').toLowerCase();

        // Nếu là text, code, json hoặc markdown thì đọc nội dung text để hiển thị
        if (
          mime.startsWith('text/') ||
          mime.includes('json') ||
          mime.includes('javascript') ||
          ['txt', 'js', 'json', 'md', 'html', 'css', 'ts'].includes(
            (file.extension || '').toLowerCase()
          )
        ) {
          const text = await blob.text();
          setTextContent(text);
        }

        currentUrl = URL.createObjectURL(blob);
        setBlobUrl(currentUrl);
      } catch (err) {
        console.error('Lỗi khi tải bản xem trước:', err);
        setError('Không thể tải bản xem trước cho tệp này hoặc định dạng chưa được hỗ trợ.');
      } finally {
        setLoading(false);
      }
    };

    fetchPreview();

    return () => {
      if (currentUrl) {
        URL.revokeObjectURL(currentUrl);
      }
      setBlobUrl(null);
    };
  }, [file, isOpen]);

  if (!isOpen || !file) return null;

  const mime = (file.mimeType || '').toLowerCase();
  const ext = (file.extension || '').toLowerCase();

  const isImage = mime.startsWith('image/') || ['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext);
  const isVideo = mime.startsWith('video/') || ['mp4', 'webm', 'mov'].includes(ext);
  const isAudio = mime.startsWith('audio/') || ['mp3', 'wav', 'ogg'].includes(ext);
  const isPdf = mime.includes('pdf') || ext === 'pdf';
  const isText = Boolean(textContent);

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
            <FileIcon mimeType={file.mimeType} extension={file.extension} size={24} />
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontWeight: 700,
                  fontSize: '0.9375rem',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}
                title={file.name}
              >
                {file.name}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {file.formattedSize || `${file.size} Bytes`}
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
                onClick={() => onDownload(file)}
                style={{ padding: '6px 12px' }}
              >
                <Download size={16} />
                <span>Tải xuống</span>
              </button>
            )}

            <button className="btn-icon" onClick={onClose} aria-label="Đóng xem trước">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Khung hiển thị nội dung Media */}
        <div className="preview-media-viewer">
          {loading && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', color: '#ffffff' }}>
              <span className="spinner" style={{ width: 32, height: 32 }} />
              <span style={{ fontSize: '0.875rem' }}>Đang tải nội dung tệp...</span>
            </div>
          )}

          {error && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', color: '#f87171', padding: '24px', textAlign: 'center' }}>
              <AlertCircle size={48} />
              <div>{error}</div>
              {onDownload && (
                <button className="btn btn-secondary" onClick={() => onDownload(file)}>
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
                  alt={file.name}
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
                <div style={{ padding: '40px', background: 'rgba(255, 255, 255, 0.05)', borderRadius: '16px' }}>
                  <audio src={blobUrl} controls autoPlay style={{ width: 360 }}>
                    Trình duyệt không hỗ trợ phát âm thanh trực tiếp.
                  </audio>
                </div>
              )}

              {isPdf && (
                <iframe
                  src={`${blobUrl}#toolbar=1`}
                  title={file.name}
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
                  <FileIcon mimeType={file.mimeType} extension={file.extension} size={64} />
                  <div style={{ marginTop: '16px', fontSize: '1rem', fontWeight: 600 }}>
                    Không có bản xem trước trực tuyến khả dụng
                  </div>
                  <div style={{ fontSize: '0.875rem', color: '#94a3b8', marginTop: '6px' }}>
                    Định dạng .{ext} không thể hiển thị trực tiếp trong trình duyệt.
                  </div>
                  {onDownload && (
                    <button
                      className="btn btn-primary"
                      onClick={() => onDownload(file)}
                      style={{ marginTop: '18px' }}
                    >
                      <Download size={16} />
                      <span>Tải về máy ({file.formattedSize || `${file.size} Bytes`})</span>
                    </button>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default FilePreviewModal;
