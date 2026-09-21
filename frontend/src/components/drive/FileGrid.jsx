import React, { useState, useEffect, useRef } from 'react';
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
  Sparkles,
  Copy
} from 'lucide-react';
import FileIcon from './FileIcon';

/* ── Dropdown menu 3 chấm dùng chung ── */
const MoreMenu = ({ items, onClose }) => {
  const ref = useRef(null);
  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  return (
    <div className="home-more-menu" ref={ref}>
      {items.map((item, i) =>
        item.divider ? (
          <div key={i} className="home-more-divider" />
        ) : (
          <button
            key={i}
            className={`home-more-item ${item.danger ? 'danger' : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              item.onClick();
              onClose();
            }}
          >
            {item.icon}
            <span>{item.label}</span>
          </button>
        )
      )}
    </div>
  );
};

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

  /* ── Folder Card ── */
  const FolderCard = ({ folder }) => {
    const [menuOpen, setMenuOpen] = useState(false);

    const menuItems = [
      onShareItem && { icon: <Share2 size={14} />, label: 'Chia sẻ', onClick: () => onShareItem('folder', folder) },
      onRenameItem && { icon: <Edit2 size={14} />, label: 'Đổi tên', onClick: () => onRenameItem('folder', folder) },
      onMoveItem && { icon: <FolderInput size={14} />, label: 'Di chuyển', onClick: () => onMoveItem('folder', folder) },
      { divider: true },
      onDeleteItem && { icon: <Trash2 size={14} />, label: 'Xóa vào thùng rác', danger: true, onClick: () => onDeleteItem('folder', folder) },
    ].filter(Boolean);

    return (
      <div className="folder-card" onClick={() => onOpenFolder && onOpenFolder(folder._id)}>
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
          <span className="folder-card-name" title={folder.name}>{folder.name}</span>
        </div>

        {!isTrash && (
          <div style={{ position: 'relative' }} onClick={(e) => e.stopPropagation()}>
            <button
              className="btn-icon home-quick-btn"
              title="Thêm thao tác"
              onClick={(e) => { e.stopPropagation(); setMenuOpen(v => !v); }}
            >
              <MoreVertical size={15} />
            </button>
            {menuOpen && <MoreMenu items={menuItems} onClose={() => setMenuOpen(false)} />}
          </div>
        )}

        {isTrash && onRestoreItem && (
          <button
            className="btn btn-secondary"
            style={{ padding: '4px 8px', fontSize: '0.75rem' }}
            onClick={(e) => { e.stopPropagation(); onRestoreItem('folder', folder); }}
          >
            Khôi phục
          </button>
        )}
      </div>
    );
  };

  /* ── File Card ── */
  const FileCard = ({ file }) => {
    const [menuOpen, setMenuOpen] = useState(false);

    const menuItems = [
      onShareItem && { icon: <Share2 size={14} />, label: 'Chia sẻ', onClick: () => onShareItem('file', file) },
      onRenameItem && { icon: <Edit2 size={14} />, label: 'Đổi tên', onClick: () => onRenameItem('file', file) },
      onMoveItem && { icon: <FolderInput size={14} />, label: 'Di chuyển', onClick: () => onMoveItem('file', file) },
      onCopyItem && { icon: <Copy size={14} />, label: 'Sao chép vào', onClick: () => onCopyItem('file', file) },
      onVersionHistory && { icon: <History size={14} />, label: 'Lịch sử phiên bản', onClick: () => onVersionHistory(file) },
      { divider: true },
      onDeleteItem && { icon: <Trash2 size={14} />, label: 'Xóa vào thùng rác', danger: true, onClick: () => onDeleteItem('file', file) },
    ].filter(Boolean);

    return (
      <div className="file-card">
        {/* Preview – quick actions xuất hiện khi hover */}
        <div
          className="file-card-preview"
          onClick={() => onPreviewFile && onPreviewFile(file)}
        >
          <FileIcon mimeType={file.mimeType} extension={file.extension} size={48} />

          {!isTrash && (
            <div className="file-card-actions-hover" onClick={(e) => e.stopPropagation()}>
              {onToggleStar && (
                <button
                  className="btn-icon"
                  title={file.isStarred ? 'Bỏ yêu thích' : 'Yêu thích'}
                  onClick={() => onToggleStar(file._id)}
                >
                  <Star
                    size={16}
                    style={{ color: file.isStarred ? '#f59e0b' : 'inherit', fill: file.isStarred ? '#f59e0b' : 'none' }}
                  />
                </button>
              )}
              {onDownloadFile && (
                <button className="btn-icon" title="Tải xuống" onClick={() => onDownloadFile(file)}>
                  <Download size={16} />
                </button>
              )}
              {onPreviewFile && (
                <button className="btn-icon" title="Xem trước" onClick={() => onPreviewFile(file)}>
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
            <span>{file.createdAt ? new Date(file.createdAt).toLocaleDateString('vi-VN') : ''}</span>
          </div>

          {/* Footer: badge + thao tác */}
          <div className="file-card-footer">
            {file.aiCategory && file.aiCategory !== 'Chưa phân loại' ? (
              <span className="badge badge-purple" title="Phân loại AI">
                <Sparkles size={11} />
                {file.aiCategory}
              </span>
            ) : (
              <span className="badge badge-slate">{(file.extension || 'file').toUpperCase()}</span>
            )}

            {!isTrash ? (
              <div style={{ position: 'relative' }} onClick={(e) => e.stopPropagation()}>
                <button
                  className="btn-icon home-quick-btn"
                  title="Thêm thao tác"
                  onClick={(e) => { e.stopPropagation(); setMenuOpen(v => !v); }}
                >
                  <MoreVertical size={15} />
                </button>
                {menuOpen && <MoreMenu items={menuItems} onClose={() => setMenuOpen(false)} />}
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
    );
  };

  return (
    <div className="file-grid-wrapper">
      {/* Thư mục */}
      {folders.length > 0 && (
        <div style={{ marginBottom: '24px' }}>
          <div className="drive-section-title">Thư mục ({folders.length})</div>
          <div className="folder-grid">
            {folders.map((folder) => (
              <FolderCard key={folder._id} folder={folder} />
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
              <FileCard key={file._id} file={file} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default FileGrid;

