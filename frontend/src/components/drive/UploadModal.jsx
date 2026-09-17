import React, { useState, useRef } from 'react';
import Modal from '../common/Modal';
import { UploadCloud, File, X, CheckCircle2 } from 'lucide-react';
import fileService from '../../services/fileService';
import { useToast } from '../../contexts/ToastContext';

const UploadModal = ({ isOpen, onClose, currentFolderId, onUploadSuccess }) => {
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const fileInputRef = useRef(null);
  const toast = useToast();

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      addFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleFileSelect = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      addFiles(Array.from(e.target.files));
    }
  };

  const addFiles = (files) => {
    setSelectedFiles((prev) => {
      const existingNames = new Set(prev.map((f) => f.name));
      const newUnique = files.filter((f) => !existingNames.has(f.name));
      return [...prev, ...newUnique];
    });
  };

  const removeFile = (index) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) return;

    setUploading(true);
    setProgress(10);

    try {
      if (selectedFiles.length === 1) {
        const formData = new FormData();
        formData.append('file', selectedFiles[0]);
        if (currentFolderId && currentFolderId !== 'root') {
          formData.append('folderId', currentFolderId);
        }

        await fileService.uploadFile(formData, (progressEvent) => {
          if (progressEvent.total) {
            const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            setProgress(percent);
          }
        });
      } else {
        const formData = new FormData();
        selectedFiles.forEach((file) => {
          formData.append('files', file);
        });
        if (currentFolderId && currentFolderId !== 'root') {
          formData.append('folderId', currentFolderId);
        }

        await fileService.uploadMultipleFiles(formData, (progressEvent) => {
          if (progressEvent.total) {
            const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            setProgress(percent);
          }
        });
      }

      toast.success(`Đã tải lên thành công ${selectedFiles.length} tệp tin`);
      setSelectedFiles([]);
      setProgress(0);
      onUploadSuccess && onUploadSuccess();
      onClose();
    } catch (err) {
      console.error('Lỗi upload:', err);
      const errMsg = err.response?.data?.message || 'Có lỗi xảy ra trong quá trình tải tệp lên.';
      toast.error(errMsg);
    } finally {
      setUploading(false);
    }
  };

  const formatSize = (bytes) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={uploading ? () => {} : onClose}
      title="Tải tệp lên Drive"
      size="md"
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose} disabled={uploading}>
            Hủy
          </button>
          <button
            className="btn btn-primary"
            onClick={handleUpload}
            disabled={uploading || selectedFiles.length === 0}
          >
            {uploading ? (
              <>
                <span className="spinner" />
                <span>Đang tải lên {progress}%</span>
              </>
            ) : (
              <span>Bắt đầu tải lên ({selectedFiles.length})</span>
            )}
          </button>
        </>
      }
    >
      {/* Dropzone */}
      <div
        className={`dropzone-area ${isDragging ? 'drag-over' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current && fileInputRef.current.click()}
      >
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileSelect}
          multiple
          style={{ display: 'none' }}
        />
        <UploadCloud className="dropzone-icon" />
        <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)', marginBottom: '4px' }}>
          Kéo thả tệp vào đây hoặc nhấn để duyệt
        </div>
        <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
          Hỗ trợ tất cả các loại tệp (ảnh, tài liệu, pdf, video, zip...) tối đa 10 tệp/lần
        </div>
      </div>

      {/* Progress bar */}
      {uploading && (
        <div style={{ marginTop: '16px' }}>
          <div className="storage-progress-bar" style={{ height: '8px' }}>
            <div className="storage-progress-fill" style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}

      {/* Danh sách tệp đã chọn */}
      {selectedFiles.length > 0 && (
        <div className="upload-file-queue">
          {selectedFiles.map((file, idx) => (
            <div key={`${file.name}-${idx}`} className="upload-queue-item">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                <File size={18} style={{ color: 'var(--primary-600)', flexShrink: 0 }} />
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: '0.875rem',
                      fontWeight: 600,
                      color: 'var(--text-primary)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}
                  >
                    {file.name}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {formatSize(file.size)}
                  </div>
                </div>
              </div>

              {!uploading && (
                <button
                  type="button"
                  className="btn-icon"
                  onClick={() => removeFile(idx)}
                  title="Xóa khỏi danh sách"
                >
                  <X size={16} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
};

export default UploadModal;
