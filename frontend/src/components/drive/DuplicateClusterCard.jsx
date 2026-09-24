import React from 'react';
import {
  Sparkles,
  CheckCircle,
  HardDrive,
  Folder as FolderIcon,
  Columns,
  Trash2,
  FileCheck,
  EyeOff
} from 'lucide-react';
import FileIcon from './FileIcon';

const DuplicateClusterCard = ({
  cluster,
  selectedFileIds,
  onToggleSelectFile,
  onOpenCompare,
  onDeleteSingle,
  onIgnorePair
}) => {
  const original = cluster.originalFile;
  const duplicates = cluster.duplicateFiles || [];

  if (!original) return null;

  // Tính dung lượng có thể tiết kiệm trong cụm này
  const clusterSavingsBytes = duplicates.reduce((sum, item) => sum + (item.file?.size || 0), 0);

  const formatSize = (bytes) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="cluster-card">
      <div className="cluster-header">
        <div className="cluster-header-left">
          <span className={`cluster-badge ${cluster.type}`}>
            {cluster.type === 'exact' ? (
              <>
                <FileCheck size={13} />
                Trùng lặp 100% (SHA-256)
              </>
            ) : (
              <>
                <Sparkles size={13} />
                Tương đồng AI ({cluster.similarityScore}%)
              </>
            )}
          </span>
          <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
            {original.name}
          </span>
        </div>

        <div className="cluster-savings-tag">
          <HardDrive size={13} />
          Tiết kiệm được: {formatSize(clusterSavingsBytes)} ({duplicates.length + 1} tệp)
        </div>
      </div>

      <div className="cluster-body">
        {/* Lời giải thích từ AI */}
        {cluster.aiAnalysis && (
          <div className="cluster-ai-note">
            <Sparkles size={15} style={{ color: 'var(--primary-600)', flexShrink: 0, marginTop: '2px' }} />
            <div>{cluster.aiAnalysis}</div>
          </div>
        )}

        {/* Tệp gốc khuyên giữ lại */}
        <div className="cluster-file-item is-original">
          <div className="file-item-left">
            <div style={{ width: 17, display: 'flex', justifyContent: 'center' }}>
              <CheckCircle size={16} style={{ color: 'var(--accent-emerald)' }} />
            </div>
            <FileIcon mimeType={original.mimeType} extension={original.extension} size={20} />
            <div className="file-info-col">
              <span className="file-primary-name" title={original.name}>
                {original.name}
              </span>
              <div className="file-meta-row">
                <span>{formatSize(original.size)}</span>
                <span>•</span>
                <span>Thư mục: {original.folder?.name || 'Drive của tôi'}</span>
                <span>•</span>
                <span className="badge-keep">Bản chính nên giữ</span>
              </div>
            </div>
          </div>
        </div>

        {/* Danh sách các tệp bản sao / tương đồng cần xóa */}
        {duplicates.map(({ file }) => {
          if (!file) return null;
          const isSelected = selectedFileIds.has(file._id);

          return (
            <div
              key={file._id}
              className={`cluster-file-item ${isSelected ? 'is-selected-delete' : ''}`}
            >
              <div className="file-item-left">
                <input
                  type="checkbox"
                  className="file-checkbox"
                  checked={isSelected}
                  onChange={() => onToggleSelectFile(file._id)}
                  title="Chọn tệp tin này để chuyển vào thùng rác"
                />
                <FileIcon mimeType={file.mimeType} extension={file.extension} size={20} />
                <div className="file-info-col">
                  <span className="file-primary-name" title={file.name}>
                    {file.name}
                  </span>
                  <div className="file-meta-row">
                    <span>{formatSize(file.size)}</span>
                    <span>•</span>
                    <span>Thư mục: {file.folder?.name || 'Drive của tôi'}</span>
                    <span>•</span>
                    <span>Cập nhật: {new Date(file.updatedAt || file.createdAt).toLocaleDateString('vi-VN')}</span>
                  </div>
                </div>
              </div>

              <div className="file-item-actions">
                <button
                  type="button"
                  className="btn-item-action compare"
                  onClick={() => onOpenCompare(original, file, cluster)}
                  title="Mở giao diện so sánh song song với bản chính"
                >
                  <Columns size={13} />
                  So sánh
                </button>
                <button
                  type="button"
                  className="btn-item-action"
                  onClick={() => onIgnorePair && onIgnorePair(original._id, file._id)}
                  title="Bỏ qua cặp này không coi là trùng"
                >
                  <EyeOff size={13} />
                </button>
                <button
                  type="button"
                  className="btn-item-action"
                  style={{ color: 'var(--accent-rose)' }}
                  onClick={() => onDeleteSingle(file._id)}
                  title="Chuyển ngay vào thùng rác"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default DuplicateClusterCard;
