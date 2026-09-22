import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
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
const MoreMenu = ({ items, onClose, preferUpwards = false }) => {
  const ref = useRef(null);
  const [openUpwards, setOpenUpwards] = useState(preferUpwards);
  const [openRight, setOpenRight] = useState(false);

  useLayoutEffect(() => {
    if (ref.current) {
      const rect = ref.current.getBoundingClientRect();
      const sidebar = document.querySelector('.app-sidebar');
      const sidebarRight = sidebar ? sidebar.getBoundingClientRect().right : 0;

      // Vertical auto-placement:
      if (preferUpwards && rect.top < 65) {
        setOpenUpwards(false);
      } else if (!preferUpwards && window.innerHeight - rect.bottom < 40) {
        setOpenUpwards(true);
      }

      // Horizontal auto-placement (avoid sidebar collision):
      if (rect.left < sidebarRight + 12) {
        setOpenRight(true);
      }
    }
  }, [preferUpwards]);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  return (
    <div
      className={`home-more-menu ${openUpwards ? 'open-upwards' : ''} ${openRight ? 'open-right' : ''}`}
      ref={ref}
      onClick={(e) => e.stopPropagation()}
    >
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
  selectedItem = null,
  onSelectItem,
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

  /* ── Studio Folder Card ── */
  const FolderCard = ({ folder }) => {
    const [menuOpen, setMenuOpen] = useState(false);
    const isSelected = selectedItem?.type === 'folder' && selectedItem?.data?._id === folder._id;

    const menuItems = [
      onOpenFolder && { icon: <Folder size={14} />, label: 'Mở thư mục', onClick: () => onOpenFolder(folder._id) },
      onShareItem && { icon: <Share2 size={14} />, label: 'Chia sẻ', onClick: () => onShareItem('folder', folder) },
      onRenameItem && { icon: <Edit2 size={14} />, label: 'Đổi tên', onClick: () => onRenameItem('folder', folder) },
      onMoveItem && { icon: <FolderInput size={14} />, label: 'Di chuyển', onClick: () => onMoveItem('folder', folder) },
      { divider: true },
      onDeleteItem && { icon: <Trash2 size={14} />, label: 'Xóa vào thùng rác', danger: true, onClick: () => onDeleteItem('folder', folder) },
    ].filter(Boolean);

    return (
      <div
        className={`folder-card ${isSelected ? 'is-selected' : ''} ${menuOpen ? 'menu-open' : ''}`}
        onClick={() => onSelectItem && onSelectItem({ type: 'folder', data: folder })}
        onDoubleClick={() => onOpenFolder && onOpenFolder(folder._id)}
      >
        <div className="folder-card-main">
          <div
            className="folder-card-icon"
            style={{
              backgroundColor: folder.color ? `${folder.color}15` : 'var(--bg-surface-hover)',
              borderColor: folder.color ? `${folder.color}40` : 'var(--border-subtle)'
            }}
          >
            <Folder
              size={18}
              style={{
                color: folder.color || 'var(--primary-600)',
                fill: folder.color ? `${folder.color}33` : 'var(--primary-200)'
              }}
            />
          </div>
          <div className="folder-card-info">
            <span className="folder-card-name" title={folder.name}>
              {folder.name}
            </span>
            <span className="folder-card-sub">Thư mục</span>
          </div>
        </div>

        {!isTrash && (
          <div style={{ position: 'relative' }} onClick={(e) => e.stopPropagation()}>
            <button
              className="btn-icon home-quick-btn"
              title="Thêm thao tác"
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpen((v) => !v);
              }}
            >
              <MoreVertical size={14} />
            </button>
            {menuOpen && <MoreMenu items={menuItems} onClose={() => setMenuOpen(false)} />}
          </div>
        )}

        {isTrash && onRestoreItem && (
          <button
            className="btn btn-secondary"
            style={{ padding: '3px 8px', fontSize: '0.72rem' }}
            onClick={(e) => {
              e.stopPropagation();
              onRestoreItem('folder', folder);
            }}
          >
            Khôi phục
          </button>
        )}
      </div>
    );
  };

  /* ── Studio File Card ── */
  const FileCard = ({ file }) => {
    const [menuOpen, setMenuOpen] = useState(false);
    const isSelected = selectedItem?.type === 'file' && selectedItem?.data?._id === file._id;

    const isImage = (
      file.mimeType?.startsWith('image/') ||
      ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes((file.extension || '').toLowerCase())
    );

    const menuItems = [
      onPreviewFile && { icon: <Eye size={14} />, label: 'Xem trước', onClick: () => onPreviewFile(file) },
      onDownloadFile && { icon: <Download size={14} />, label: 'Tải xuống', onClick: () => onDownloadFile(file) },
      onShareItem && { icon: <Share2 size={14} />, label: 'Chia sẻ', onClick: () => onShareItem('file', file) },
      onRenameItem && { icon: <Edit2 size={14} />, label: 'Đổi tên', onClick: () => onRenameItem('file', file) },
      onMoveItem && { icon: <FolderInput size={14} />, label: 'Di chuyển', onClick: () => onMoveItem('file', file) },
      onCopyItem && { icon: <Copy size={14} />, label: 'Sao chép vào', onClick: () => onCopyItem('file', file) },
      onVersionHistory && { icon: <History size={14} />, label: 'Lịch sử phiên bản', onClick: () => onVersionHistory(file) },
      { divider: true },
      onDeleteItem && { icon: <Trash2 size={14} />, label: 'Xóa vào thùng rác', danger: true, onClick: () => onDeleteItem('file', file) },
    ].filter(Boolean);

    return (
      <div
        className={`file-card ${isSelected ? 'is-selected' : ''} ${menuOpen ? 'menu-open' : ''}`}
        onClick={() => onSelectItem && onSelectItem({ type: 'file', data: file })}
        onDoubleClick={() => onPreviewFile && onPreviewFile(file)}
      >
        {/* Preview Frame */}
        <div className="file-card-preview">
          {/* Extension Tag */}
          <span className="file-ext-tag">
            .{(file.extension || 'file').toUpperCase()}
          </span>

          {isImage && file._id ? (
            <img
              src={`/api/files/${file._id}/preview`}
              alt={file.name}
              className="file-thumbnail"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          ) : (
            <FileIcon mimeType={file.mimeType} extension={file.extension} size={42} />
          )}

          {/* Quick actions on hover */}
          {!isTrash && (
            <div className="file-card-actions-hover" onClick={(e) => e.stopPropagation()}>
              {onToggleStar && (
                <button
                  className="btn-icon"
                  title={file.isStarred ? 'Bỏ yêu thích' : 'Yêu thích'}
                  onClick={() => onToggleStar(file._id)}
                >
                  <Star
                    size={14}
                    style={{
                      color: file.isStarred ? '#f59e0b' : 'inherit',
                      fill: file.isStarred ? '#f59e0b' : 'none'
                    }}
                  />
                </button>
              )}
              {onDownloadFile && (
                <button className="btn-icon" title="Tải xuống" onClick={() => onDownloadFile(file)}>
                  <Download size={14} />
                </button>
              )}
              {onPreviewFile && (
                <button className="btn-icon" title="Xem trước" onClick={() => onPreviewFile(file)}>
                  <Eye size={14} />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Thông tin tệp */}
        <div className="file-card-body">
          <div className="file-card-title" title={file.name}>
            {file.name}
          </div>

          <div className="file-card-meta">
            <span>{file.formattedSize || formatSize(file.size)}</span>
            <span>{file.createdAt ? new Date(file.createdAt).toLocaleDateString('vi-VN') : ''}</span>
          </div>

          {/* Footer: badge AI + thao tác */}
          <div className="file-card-footer">
            {file.aiCategory && file.aiCategory !== 'Chưa phân loại' && (
              <span className="badge badge-purple" title="Phân loại AI">
                <Sparkles size={10} />
                {file.aiCategory}
              </span>
            )}

            {!isTrash ? (
              <div style={{ position: 'relative', marginLeft: 'auto' }} onClick={(e) => e.stopPropagation()}>
                <button
                  className="btn-icon home-quick-btn"
                  title="Thêm thao tác"
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuOpen((v) => !v);
                  }}
                >
                  <MoreVertical size={14} />
                </button>
                {menuOpen && <MoreMenu items={menuItems} onClose={() => setMenuOpen(false)} preferUpwards={true} />}
              </div>
            ) : (
              <div style={{ display: 'flex', gap: '4px', marginLeft: 'auto' }}>
                {onRestoreItem && (
                  <button
                    className="btn btn-secondary"
                    style={{ padding: '2px 6px', fontSize: '0.7rem' }}
                    onClick={(e) => {
                      e.stopPropagation();
                      onRestoreItem('file', file);
                    }}
                  >
                    Khôi phục
                  </button>
                )}
                {onDeleteItem && (
                  <button
                    className="btn btn-danger"
                    style={{ padding: '2px 6px', fontSize: '0.7rem' }}
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteItem('file', file, true);
                    }}
                  >
                    Xóa
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
        <div style={{ marginBottom: '22px' }}>
          <div className="drive-section-header">
            <div className="drive-section-title">
              <span>Thư mục</span>
              <span className="drive-section-count">{folders.length}</span>
            </div>
          </div>
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
          <div className="drive-section-header">
            <div className="drive-section-title">
              <span>Tệp tin</span>
              <span className="drive-section-count">{files.length}</span>
            </div>
          </div>
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
