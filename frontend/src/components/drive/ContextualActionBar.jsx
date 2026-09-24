import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  Share2,
  Download,
  Edit2,
  Star,
  MoreVertical,
  Eye,
  Copy,
  FolderInput,
  History,
  Trash2,
  RotateCcw,
  Sparkles
} from 'lucide-react';
import FileIcon from './FileIcon';

const ContextualActionBar = ({
  selectedItem,
  onClearSelection,
  onShareItem,
  onDownloadFile,
  onRenameItem,
  onToggleStar,
  onPreviewFile,
  onCopyItem,
  onMoveItem,
  onVersionHistory,
  onDeleteItem,
  isTrash = false,
  onRestoreItem
}) => {
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMoreMenuOpen(false);
      }
    };
    if (moreMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [moreMenuOpen]);

  if (!selectedItem || !selectedItem.data) return null;

  const { type, data } = selectedItem;
  const isFile = type === 'file';
  const isStarred = Boolean(data.isStarred);

  const formatSize = (bytes) => {
    if (!bytes && bytes !== 0) return '-';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const displaySize = isFile
    ? data.formattedSize || formatSize(data.size)
    : null;

  const secondaryMenuItems = isTrash
    ? [
        onRestoreItem && {
          icon: <RotateCcw size={15} />,
          label: 'Khôi phục',
          onClick: () => onRestoreItem(type, data)
        },
        onDeleteItem && {
          icon: <Trash2 size={15} />,
          label: 'Xóa vĩnh viễn',
          danger: true,
          onClick: () => onDeleteItem(type, data, true)
        }
      ].filter(Boolean)
    : [
        isFile && onPreviewFile && {
          icon: <Eye size={15} />,
          label: 'Xem trước',
          onClick: () => onPreviewFile(data)
        },
        isFile && onCopyItem && {
          icon: <Copy size={15} />,
          label: 'Tạo bản sao',
          onClick: () => onCopyItem(type, data)
        },
        onMoveItem && {
          icon: <FolderInput size={15} />,
          label: 'Di chuyển',
          onClick: () => onMoveItem(type, data)
        },
        isFile && onVersionHistory && {
          icon: <History size={15} />,
          label: 'Lịch sử phiên bản',
          onClick: () => onVersionHistory(data)
        },
        { divider: true },
        onDeleteItem && {
          icon: <Trash2 size={15} />,
          label: 'Xóa vào thùng rác',
          danger: true,
          onClick: () => onDeleteItem(type, data)
        }
      ].filter(Boolean);

  return (
    <aside className="contextual-action-bar" aria-label="Thanh thao tác ngữ cảnh">
      {/* Bên trái: Thông tin tệp/thư mục đang chọn */}
      <div className="contextual-info">
        <button
          className="contextual-btn-close"
          onClick={onClearSelection}
          title="Bỏ chọn (Esc)"
          aria-label="Bỏ chọn"
        >
          <X size={16} />
        </button>

        <div className="contextual-item-badge">
          {isFile ? (
            <FileIcon
              mimeType={data.mimeType}
              extension={data.extension}
              size={18}
            />
          ) : (
            <span className="contextual-folder-icon">📁</span>
          )}
          <span className="contextual-item-name" title={data.name}>
            {data.name}
          </span>
        </div>

        {displaySize && (
          <span className="contextual-item-size tabular-nums">
            {displaySize}
          </span>
        )}

        {data.aiCategory && data.aiCategory !== 'Chưa phân loại' && (
          <span className="contextual-ai-tag">
            <Sparkles size={12} />
            {data.aiCategory}
          </span>
        )}
      </div>

      {/* Bên phải: Dãy nút icon ngang giống Ảnh 1 */}
      <div className="contextual-actions">
        {!isTrash ? (
          <>
            {onShareItem && (
              <button
                className="contextual-icon-btn"
                title="Chia sẻ"
                onClick={() => onShareItem(type, data)}
                aria-label="Chia sẻ"
              >
                <Share2 size={17} />
              </button>
            )}

            {isFile && onDownloadFile && (
              <button
                className="contextual-icon-btn"
                title="Tải xuống"
                onClick={() => onDownloadFile(data)}
                aria-label="Tải xuống"
              >
                <Download size={17} />
              </button>
            )}

            {onRenameItem && (
              <button
                className="contextual-icon-btn"
                title="Đổi tên"
                onClick={() => onRenameItem(type, data)}
                aria-label="Đổi tên"
              >
                <Edit2 size={17} />
              </button>
            )}

            {isFile && onToggleStar && (
              <button
                className={`contextual-icon-btn ${isStarred ? 'is-starred' : ''}`}
                title={isStarred ? 'Bỏ yêu thích' : 'Yêu thích'}
                onClick={() => onToggleStar(data._id)}
                aria-label={isStarred ? 'Bỏ yêu thích' : 'Yêu thích'}
              >
                <Star
                  size={17}
                  fill={isStarred ? '#f59e0b' : 'none'}
                  color={isStarred ? '#f59e0b' : 'currentColor'}
                />
              </button>
            )}

            {/* Nút 3 chấm Thao tác khác */}
            <div className="contextual-more-wrapper" ref={menuRef}>
              <button
                className={`contextual-icon-btn ${moreMenuOpen ? 'active' : ''}`}
                title="Thao tác khác"
                onClick={() => setMoreMenuOpen((prev) => !prev)}
                aria-label="Thao tác khác"
                aria-expanded={moreMenuOpen}
              >
                <MoreVertical size={17} />
              </button>

              {moreMenuOpen && (
                <div className="home-more-menu contextual-dropdown">
                  {secondaryMenuItems.map((item, i) =>
                    item.divider ? (
                      <div key={i} className="home-more-divider" />
                    ) : (
                      <button
                        key={i}
                        className={`home-more-item ${item.danger ? 'danger' : ''}`}
                        onClick={() => {
                          setMoreMenuOpen(false);
                          item.onClick();
                        }}
                      >
                        {item.icon}
                        <span>{item.label}</span>
                      </button>
                    )
                  )}
                </div>
              )}
            </div>
          </>
        ) : (
          /* Trạng thái Thùng rác */
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {onRestoreItem && (
              <button
                className="btn btn-secondary"
                style={{ padding: '5px 12px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                onClick={() => onRestoreItem(type, data)}
              >
                <RotateCcw size={14} />
                <span>Khôi phục</span>
              </button>
            )}
            {onDeleteItem && (
              <button
                className="btn btn-danger"
                style={{ padding: '5px 12px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                onClick={() => onDeleteItem(type, data, true)}
              >
                <Trash2 size={14} />
                <span>Xóa vĩnh viễn</span>
              </button>
            )}
          </div>
        )}
      </div>
    </aside>
  );
};

export default ContextualActionBar;
