import React from 'react';
import {
  Folder,
  Star,
  Download,
  Share2,
  MoreVertical,
  Eye,
  Trash2,
  FolderInput,
  History,
  Edit2,
  Sparkles
} from 'lucide-react';
import FileIcon from './FileIcon';

const FileGrid = ({
  folders = [],
  files = [],
  onOpenFolder,
  onPreviewFile,
  onDownloadFile,
  onToggleStar,
  onShareItem,
  onRenameItem,
  onMoveItem,
  onCopyItem,
  onVersionHistory,
  onDeleteItem,
  isTrash = false,
  onRestoreItem
}) => {
  const formatSize = (bytes) => {
    if (!bytes && bytes !== 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  return (
    <div className="file-grid-wrapper">
      {/* Thư mục */}
      {folders.length > 0 && (
        <div style={{ marginBottom: '24px' }}>
          <div className="drive-section-title">Thư mục ({folders.length})</div>
          <div className="folder-grid">
            {folders.map((folder) => (
              <div
                key={folder._id}
                className="folder-card"
                onClick={() => onOpenFolder && onOpenFolder(folder._id)}
              >
                <div className="folder-card-main">
                  <div className="folder-card-icon">
                    <Folder
                      size={24}
                      style={{
                        color: folder.color || '#3b82f6',
                        fill: folder.color ? `${folder.color}33` : '#3b82f633'
                      }}
                    />
                  </div>
                  <span className="folder-card-name" title={folder.name}>
                    {folder.name}
                  </span>
                </div>

                {!isTrash && (
                  <div
                    style={{ display: 'flex', alignItems: 'center', gap: '2px' }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {onShareItem && (
                      <button
                        className="btn-icon"
                        title="Chia sẻ"
                        onClick={() => onShareItem('folder', folder)}
                      >
                        <Share2 size={15} />
                      </button>
                    )}
                    {onRenameItem && (
                      <button
                        className="btn-icon"
                        title="Đổi tên"
                        onClick={() => onRenameItem('folder', folder)}
                      >
                        <Edit2 size={15} />
                      </button>
                    )}
                    {onDeleteItem && (
                      <button
                        className="btn-icon"
                        title="Xóa"
                        onClick={() => onDeleteItem('folder', folder)}
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                )}

                {isTrash && onRestoreItem && (
                  <button
                    className="btn btn-secondary"
                    style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                    onClick={(e) => {
                      e.stopPropagation();
                      onRestoreItem('folder', folder);
                    }}
                  >
                    Khôi phục
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tệp tin */}
      {files.length > 0 && (
        <div>
          <div className="drive-section-title">Tệp tin ({files.length})</div>
          <div className="file-grid">
            {files.map((file) => (
              <div key={file._id} className="file-card">
                {/* Preview Thumbnail */}
                <div
                  className="file-card-preview"
                  onClick={() => onPreviewFile && onPreviewFile(file)}
                >
                  <FileIcon
                    mimeType={file.mimeType}
                    extension={file.extension}
                    size={48}
                  />

                  {/* Nút hành động nhanh trên hover */}
                  {!isTrash && (
                    <div
                      className="file-card-actions-hover"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {onToggleStar && (
                        <button
                          className="btn-icon"
                          title={file.isStarred ? 'Bỏ yêu thích' : 'Yêu thích'}
                          onClick={() => onToggleStar(file._id)}
                        >
                          <Star
                            size={16}
                            style={{
                              color: file.isStarred ? '#f59e0b' : 'inherit',
                              fill: file.isStarred ? '#f59e0b' : 'none'
                            }}
                          />
                        </button>
                      )}
                      {onDownloadFile && (
                        <button
                          className="btn-icon"
                          title="Tải xuống"
                          onClick={() => onDownloadFile(file)}
                        >
                          <Download size={16} />
                        </button>
                      )}
                      {onPreviewFile && (
                        <button
                          className="btn-icon"
                          title="Xem trước"
                          onClick={() => onPreviewFile(file)}
                        >
                          <Eye size={16} />
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Thông tin tệp */}
                <div className="file-card-body">
                  <div
                    className="file-card-title"
                    title={file.name}
                    onClick={() => onPreviewFile && onPreviewFile(file)}
                  >
                    {file.name}
                  </div>

                  <div className="file-card-meta">
                    <span>{file.formattedSize || formatSize(file.size)}</span>
                    <span>
                      {file.createdAt
                        ? new Date(file.createdAt).toLocaleDateString('vi-VN')
                        : ''}
                    </span>
                  </div>

                  {/* Footer card */}
                  <div className="file-card-footer">
                    {file.aiCategory && file.aiCategory !== 'Chưa phân loại' ? (
                      <span className="badge badge-purple" title="Phân loại AI">
                        <Sparkles size={11} />
                        {file.aiCategory}
                      </span>
                    ) : (
                      <span className="badge badge-slate">
                        {(file.extension || 'file').toUpperCase()}
                      </span>
                    )}

                    {!isTrash ? (
                      <div style={{ display: 'flex', gap: '2px' }}>
                        {onShareItem && (
                          <button
                            className="btn-icon"
                            title="Chia sẻ"
                            onClick={() => onShareItem('file', file)}
                          >
                            <Share2 size={14} />
                          </button>
                        )}
                        {onVersionHistory && (
                          <button
                            className="btn-icon"
                            title="Lịch sử phiên bản"
                            onClick={() => onVersionHistory(file)}
                          >
                            <History size={14} />
                          </button>
                        )}
                        {onMoveItem && (
                          <button
                            className="btn-icon"
                            title="Di chuyển"
                            onClick={() => onMoveItem('file', file)}
                          >
                            <FolderInput size={14} />
                          </button>
                        )}
                        {onRenameItem && (
                          <button
                            className="btn-icon"
                            title="Đổi tên"
                            onClick={() => onRenameItem('file', file)}
                          >
                            <Edit2 size={14} />
                          </button>
                        )}
                        {onDeleteItem && (
                          <button
                            className="btn-icon"
                            title="Xóa vào thùng rác"
                            onClick={() => onDeleteItem('file', file)}
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    ) : (
                      <div style={{ display: 'flex', gap: '6px' }}>
                        {onRestoreItem && (
                          <button
                            className="btn btn-secondary"
                            style={{ padding: '2px 8px', fontSize: '0.75rem' }}
                            onClick={() => onRestoreItem('file', file)}
                          >
                            Khôi phục
                          </button>
                        )}
                        {onDeleteItem && (
                          <button
                            className="btn btn-danger"
                            style={{ padding: '2px 8px', fontSize: '0.75rem' }}
                            onClick={() => onDeleteItem('file', file, true)}
                          >
                            Xóa hẳn
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default FileGrid;
