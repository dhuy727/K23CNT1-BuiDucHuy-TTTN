import React, { useState, useRef, useEffect } from 'react';
import Modal from '../common/Modal';
import { UploadCloud, File, Folder, FolderUp, X, CheckCircle2 } from 'lucide-react';
import fileService from '../../services/fileService';
import folderService from '../../services/folderService';
import { useToast } from '../../contexts/ToastContext';

const UploadModal = ({
  isOpen,
  onClose,
  currentFolderId,
  onUploadSuccess,
  initialMode = 'file' // 'file' or 'folder'
}) => {
  const [activeTab, setActiveTab] = useState(initialMode);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [uploadStatusText, setUploadStatusText] = useState('');

  const fileInputRef = useRef(null);
  const folderInputRef = useRef(null);
  const toast = useToast();

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialMode || 'file');
      setSelectedFiles([]);
      setProgress(0);
      setUploadStatusText('');
    }
  }, [isOpen, initialMode]);

  // Quét đệ quy DataTransferEntry khi người dùng kéo thả cả thư mục vào dropzone
  const scanEntry = async (entry, path = '') => {
    if (entry.isFile) {
      return new Promise((resolve) => {
        entry.file((file) => {
          // Lưu đường dẫn thư mục tương đối vào file
          file.customRelativePath = path ? `${path}/${file.name}` : file.name;
          resolve([file]);
        }, () => resolve([]));
      });
    } else if (entry.isDirectory) {
      const dirReader = entry.createReader();
      const readAllEntries = async () => {
        const entries = [];
        let batch;
        do {
          batch = await new Promise((resolve) => dirReader.readEntries(resolve, () => resolve([])));
          if (batch && batch.length > 0) entries.push(...batch);
        } while (batch && batch.length > 0);
        return entries;
      };

      const entries = await readAllEntries();
      const nextPath = path ? `${path}/${entry.name}` : entry.name;
      const nested = await Promise.all(entries.map((child) => scanEntry(child, nextPath)));
      return nested.flat();
    }
    return [];
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    setIsDragging(false);

    const items = e.dataTransfer.items;
    if (items && items.length > 0) {
      const fileList = [];
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.webkitGetAsEntry) {
          const entry = item.webkitGetAsEntry();
          if (entry) {
            const scanned = await scanEntry(entry);
            fileList.push(...scanned);
          }
        }
      }
      if (fileList.length > 0) {
        addFiles(fileList);
        return;
      }
    }

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      addFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleFileSelect = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      addFiles(Array.from(e.target.files));
    }
    e.target.value = '';
  };

  const handleFolderSelect = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files);
      addFiles(files);
    }
    e.target.value = '';
  };

  const addFiles = (files) => {
    setSelectedFiles((prev) => {
      const existingKeys = new Set(
        prev.map((f) => f.customRelativePath || f.webkitRelativePath || f.name)
      );
      const newUnique = files.filter(
        (f) => !existingKeys.has(f.customRelativePath || f.webkitRelativePath || f.name)
      );
      return [...prev, ...newUnique];
    });
  };

  const removeFile = (index) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const getFileRelativePath = (file) => {
    return file.customRelativePath || file.webkitRelativePath || '';
  };

  const getDirectoryPath = (file) => {
    const rel = getFileRelativePath(file);
    if (!rel) return '';
    const lastSlash = rel.lastIndexOf('/');
    return lastSlash !== -1 ? rel.substring(0, lastSlash) : '';
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) return;

    setUploading(true);
    setProgress(5);
    setUploadStatusText('Đang chuẩn bị tải lên...');

    try {
      // Kiểm tra xem có tệp tin nào thuộc thư mục không
      const hasFolderStructure = selectedFiles.some((f) => Boolean(getFileRelativePath(f)));

      if (!hasFolderStructure) {
        // Tải lên tệp đơn hoặc đa tệp thông thường (giữ nguyên logic gốc tối ưu)
        if (selectedFiles.length === 1) {
          const formData = new FormData();
          formData.append('file', selectedFiles[0]);
          formData.append('fileName', selectedFiles[0].name);
          if (currentFolderId && currentFolderId !== 'root') {
            formData.append('folderId', currentFolderId);
          }

          setUploadStatusText(`Đang tải lên "${selectedFiles[0].name}"...`);
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
          formData.append('fileNames', JSON.stringify(selectedFiles.map((f) => f.name)));
          if (currentFolderId && currentFolderId !== 'root') {
            formData.append('folderId', currentFolderId);
          }

          setUploadStatusText(`Đang tải lên đồng thời ${selectedFiles.length} tệp...`);
          await fileService.uploadMultipleFiles(formData, (progressEvent) => {
            if (progressEvent.total) {
              const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
              setProgress(percent);
            }
          });
        }
      } else {
        // Tải lên có cấu trúc thư mục: Nhóm file theo từng thư mục phân cấp
        const folderCache = new Map();
        const total = selectedFiles.length;

        for (let i = 0; i < total; i++) {
          const file = selectedFiles[i];
          const dirPath = getDirectoryPath(file);

          let targetFolderId = currentFolderId && currentFolderId !== 'root' ? currentFolderId : null;

          if (dirPath) {
            if (folderCache.has(dirPath)) {
              targetFolderId = folderCache.get(dirPath);
            } else {
              setUploadStatusText(`Đang tạo thư mục "${dirPath}"...`);
              const res = await folderService.ensureFolderPath(targetFolderId, dirPath);
              targetFolderId = res.data?.folderId || res.data;
              folderCache.set(dirPath, targetFolderId);
            }
          }

          setUploadStatusText(`Đang tải ${i + 1}/${total}: ${file.name}`);
          const formData = new FormData();
          formData.append('file', file);
          formData.append('fileName', file.name);
          if (targetFolderId) {
            formData.append('folderId', targetFolderId);
          }

          await fileService.uploadFile(formData);
          setProgress(Math.round(((i + 1) / total) * 100));
        }
      }

      toast.success(
        hasFolderStructure
          ? `Đã tải lên thành công toàn bộ thư mục (${selectedFiles.length} tệp)!`
          : 'Đã tải lên thành công, AI đang xử lý...'
      );
      window.dispatchEvent(new CustomEvent('drive:refresh-notifications'));
      window.dispatchEvent(new Event('folder:updated'));
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
      setUploadStatusText('');
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
      title={activeTab === 'folder' ? 'Tải thư mục lên Drive' : 'Tải tệp tin lên Drive'}
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
      {/* Mode Selector Tabs */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          padding: '4px',
          backgroundColor: 'var(--bg-surface-hover)',
          borderRadius: 'var(--border-radius-md, 8px)',
          marginBottom: '14px'
        }}
      >
        <button
          type="button"
          disabled={uploading}
          onClick={() => setActiveTab('file')}
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            padding: '7px 12px',
            borderRadius: '6px',
            border: 'none',
            fontSize: '0.84rem',
            fontWeight: 600,
            cursor: 'pointer',
            backgroundColor: activeTab === 'file' ? 'var(--surface-color)' : 'transparent',
            color: activeTab === 'file' ? 'var(--primary-color)' : 'var(--text-muted)',
            boxShadow: activeTab === 'file' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
            transition: 'all 0.15s ease'
          }}
        >
          <File size={16} />
          <span>Tải tệp tin</span>
        </button>

        <button
          type="button"
          disabled={uploading}
          onClick={() => setActiveTab('folder')}
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            padding: '7px 12px',
            borderRadius: '6px',
            border: 'none',
            fontSize: '0.84rem',
            fontWeight: 600,
            cursor: 'pointer',
            backgroundColor: activeTab === 'folder' ? 'var(--surface-color)' : 'transparent',
            color: activeTab === 'folder' ? 'var(--primary-color)' : 'var(--text-muted)',
            boxShadow: activeTab === 'folder' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
            transition: 'all 0.15s ease'
          }}
        >
          <FolderUp size={16} />
          <span>Tải cả thư mục</span>
        </button>
      </div>

      {/* Dropzone */}
      <div
        className={`dropzone-area ${isDragging ? 'drag-over' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => {
          if (uploading) return;
          if (activeTab === 'folder') {
            folderInputRef.current && folderInputRef.current.click();
          } else {
            fileInputRef.current && fileInputRef.current.click();
          }
        }}
      >
        {/* Hidden inputs */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileSelect}
          multiple
          style={{ display: 'none' }}
        />
        <input
          type="file"
          ref={folderInputRef}
          onChange={handleFolderSelect}
          webkitdirectory=""
          directory=""
          multiple
          style={{ display: 'none' }}
        />

        {activeTab === 'folder' ? (
          <FolderUp className="dropzone-icon" style={{ color: 'var(--primary-color)' }} />
        ) : (
          <UploadCloud className="dropzone-icon" />
        )}

        <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)', marginBottom: '4px' }}>
          {activeTab === 'folder'
            ? 'Kéo thả thư mục vào đây hoặc nhấn để chọn thư mục'
            : 'Kéo thả tệp vào đây hoặc nhấn để duyệt tệp'}
        </div>
        <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
          {activeTab === 'folder'
            ? 'Hệ thống sẽ tự động quét và giữ nguyên cấu trúc phân cấp các thư mục con bên trong'
            : 'Hỗ trợ tất cả các loại tệp (ảnh, tài liệu, PDF, video, code, ZIP...)'}
        </div>
      </div>

      {/* Progress bar */}
      {uploading && (
        <div style={{ marginTop: '16px' }}>
          {uploadStatusText && (
            <div
              style={{
                fontSize: '0.8rem',
                color: 'var(--text-secondary)',
                marginBottom: '6px',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}
            >
              {uploadStatusText}
            </div>
          )}
          <div className="storage-progress-bar" style={{ height: '8px' }}>
            <div className="storage-progress-fill" style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}

      {/* Danh sách tệp đã chọn */}
      {selectedFiles.length > 0 && (
        <div className="upload-file-queue" style={{ marginTop: '14px', maxHeight: '200px', overflowY: 'auto' }}>
          <div
            style={{
              fontSize: '0.78rem',
              fontWeight: 700,
              color: 'var(--text-muted)',
              marginBottom: '6px',
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}
          >
            Danh sách tệp chuẩn bị tải lên ({selectedFiles.length})
          </div>
          {selectedFiles.map((file, idx) => {
            const relPath = getFileRelativePath(file);
            return (
              <div key={`${file.name}-${idx}`} className="upload-queue-item">
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                  {relPath ? (
                    <Folder size={18} style={{ color: 'var(--primary-color)', flexShrink: 0 }} />
                  ) : (
                    <File size={18} style={{ color: 'var(--primary-600)', flexShrink: 0 }} />
                  )}
                  <div style={{ minWidth: 0 }}>
                    {relPath && (
                      <div
                        style={{
                          fontSize: '0.72rem',
                          color: 'var(--text-muted)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis'
                        }}
                      >
                        📁 {relPath}
                      </div>
                    )}
                    <div
                      style={{
                        fontSize: '0.85rem',
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
            );
          })}
        </div>
      )}
    </Modal>
  );
};

export default UploadModal;
