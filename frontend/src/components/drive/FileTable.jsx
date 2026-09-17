import React from 'react';
import {
  Folder,
  Star,
  Download,
  Share2,
  Trash2,
  Edit2,
  History,
  FolderInput,
  Eye,
  Sparkles
} from 'lucide-react';
import FileIcon from './FileIcon';

const FileTable = ({
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
    if (!bytes && bytes !== 0) return '-';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  return (
    <div className="file-table-container">
      <table className="file-table">
        <thead>
          <tr>
            <th style={{ width: '40%' }}>Tên</th>
            <th style={{ width: '15%' }}>Phân loại AI</th>
            <th style={{ width: '15%' }}>Kích thước</th>
            <th style={{ width: '15%' }}>Thời gian tạo</th>
            <th style={{ width: '15%', textAlign: 'right' }}>Thao tác</th>
          </tr>
        </thead>
        <tbody>
          {/* Danh sách Thư mục */}
          {folders.map((folder) => (
            <tr key={`folder-${folder._id}`}>
              <td>
                <div
                  className="table-name-cell"
                  onClick={() => onOpenFolder && onOpenFolder(folder._id)}
                >
                  <Folder
                    size={20}
                    style={{
                      color: folder.color || '#3b82f6',
                      fill: folder.color ? `${folder.color}33` : '#3b82f633',
                      flexShrink: 0
                    }}
                  />
                  <span>{folder.name}</span>
                </div>
              </td>
              <td>
                <span className="badge badge-slate">Thư mục</span>
              </td>
              <td>-</td>
              <td>
                {folder.createdAt
                  ? new Date(folder.createdAt).toLocaleDateString('vi-VN')
                  : '-'}
              </td>
              <td>
                <div className="table-action-btns" style={{ justifyContent: 'flex-end' }}>
                  {!isTrash ? (
                    <>
                      {onShareItem && (
                        <button
                          className="btn-icon"
                          title="Chia sẻ"
                          onClick={() => onShareItem('folder', folder)}
                        >
                          <Share2 size={16} />
                        </button>
                      )}
                      {onRenameItem && (
                        <button
                          className="btn-icon"
                          title="Đổi tên"
                          onClick={() => onRenameItem('folder', folder)}
                        >
                          <Edit2 size={16} />
                        </button>
                      )}
                      {onDeleteItem && (
                        <button
                          className="btn-icon"
                          title="Xóa"
                          onClick={() => onDeleteItem('folder', folder)}
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </>
                  ) : (
                    onRestoreItem && (
                      <button
                        className="btn btn-secondary"
                        style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                        onClick={() => onRestoreItem('folder', folder)}
                      >
                        Khôi phục
                      </button>
                    )
                  )}
                </div>
              </td>
            </tr>
          ))}

          {/* Danh sách Tệp tin */}
          {files.map((file) => (
            <tr key={`file-${file._id}`}>
              <td>
                <div
                  className="table-name-cell"
                  onClick={() => onPreviewFile && onPreviewFile(file)}
                >
                  <FileIcon
                    mimeType={file.mimeType}
                    extension={file.extension}
                    size={20}
                  />
                  <span title={file.name}>{file.name}</span>
                  {!isTrash && onToggleStar && (
                    <button
                      className="btn-icon"
                      style={{ padding: '2px' }}
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleStar(file._id);
                      }}
                      title={file.isStarred ? 'Bỏ yêu thích' : 'Yêu thích'}
                    >
                      <Star
                        size={15}
                        style={{
                          color: file.isStarred ? '#f59e0b' : 'var(--text-muted)',
                          fill: file.isStarred ? '#f59e0b' : 'none'
                        }}
                      />
                    </button>
                  )}
                </div>
              </td>
              <td>
                {file.aiCategory && file.aiCategory !== 'Chưa phân loại' ? (
                  <span className="badge badge-purple">
                    <Sparkles size={11} />
                    {file.aiCategory}
                  </span>
                ) : (
                  <span className="badge badge-slate">
                    {(file.extension || 'file').toUpperCase()}
                  </span>
                )}
              </td>
              <td>{file.formattedSize || formatSize(file.size)}</td>
              <td>
                {file.createdAt
                  ? new Date(file.createdAt).toLocaleDateString('vi-VN')
                  : '-'}
              </td>
              <td>
                <div className="table-action-btns" style={{ justifyContent: 'flex-end' }}>
                  {!isTrash ? (
                    <>
                      {onPreviewFile && (
                        <button
                          className="btn-icon"
                          title="Xem trước"
                          onClick={() => onPreviewFile(file)}
                        >
                          <Eye size={16} />
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
                      {onShareItem && (
                        <button
                          className="btn-icon"
                          title="Chia sẻ"
                          onClick={() => onShareItem('file', file)}
                        >
                          <Share2 size={16} />
                        </button>
                      )}
                      {onVersionHistory && (
                        <button
                          className="btn-icon"
                          title="Lịch sử phiên bản"
                          onClick={() => onVersionHistory(file)}
                        >
                          <History size={16} />
                        </button>
                      )}
                      {onMoveItem && (
                        <button
                          className="btn-icon"
                          title="Di chuyển"
                          onClick={() => onMoveItem('file', file)}
                        >
                          <FolderInput size={16} />
                        </button>
                      )}
                      {onRenameItem && (
                        <button
                          className="btn-icon"
                          title="Đổi tên"
                          onClick={() => onRenameItem('file', file)}
                        >
                          <Edit2 size={16} />
                        </button>
                      )}
                      {onDeleteItem && (
                        <button
                          className="btn-icon"
                          title="Xóa vào thùng rác"
                          onClick={() => onDeleteItem('file', file)}
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </>
                  ) : (
                    <>
                      {onRestoreItem && (
                        <button
                          className="btn btn-secondary"
                          style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                          onClick={() => onRestoreItem('file', file)}
                        >
                          Khôi phục
                        </button>
                      )}
                      {onDeleteItem && (
                        <button
                          className="btn btn-danger"
                          style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                          onClick={() => onDeleteItem('file', file, true)}
                        >
                          Xóa hẳn
                        </button>
                      )}
                    </>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default FileTable;
