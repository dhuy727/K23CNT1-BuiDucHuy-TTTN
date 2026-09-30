import React from 'react';
import {
  X,
  Folder,
  Star,
  Download,
  Share2,
  Eye,
  Trash2,
  FolderInput,
  History,
  Edit2,
  Sparkles,
  Copy,
  Info,
  ExternalLink,
  HardDrive,
  RotateCcw,
  Tags,
  Pin
} from 'lucide-react';
import FileIcon from './FileIcon';

const InspectorPanel = ({
  isOpen = true,
  onClose,
  selectedItem = null,
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
  onRestoreItem,
  isTrash = false,
  onAssignCategory,
  onTogglePinFolder
}) => {
  if (!isOpen) return null;

  const formatBytes = (bytes) => {
    if (!bytes && bytes !== 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const isFolder = selectedItem?.type === 'folder';
  const isFile = selectedItem?.type === 'file';
  const item = selectedItem?.data;

  const isImage = isFile && (
    item?.mimeType?.startsWith('image/') ||
    ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes((item?.extension || '').toLowerCase())
  );

  return (
    <>
      {/* Mobile Bottom Sheet Backdrop */}
      <div
        className="inspector-mobile-backdrop"
        onClick={onClose}
        aria-label="Đóng bảng chi tiết"
      />
      <aside className="inspector-panel" aria-label="Inspector Panel">
        {/* Mobile drag handle for bottom sheet */}
        <div className="mobile-sheet-handle" onClick={onClose} />

        {/* Header */}
        <div className="inspector-header">
        <div className="inspector-title">
          <Info size={15} style={{ color: 'var(--primary-500)' }} />
          <span>Thông tin chi tiết</span>
        </div>
        {onClose && (
          <button className="btn-icon" onClick={onClose} title="Đóng bảng chi tiết (Esc)">
            <X size={16} />
          </button>
        )}
      </div>

      {/* Content Body */}
      <div className="inspector-body">
        {!selectedItem || !item ? (
          <div className="inspector-empty">
            <div className="inspector-empty-icon">
              <HardDrive size={22} />
            </div>
            <div className="inspector-empty-title">Chưa chọn mục nào</div>
            <div className="inspector-empty-desc">
              Nhấp chuột vào bất kỳ tệp hoặc thư mục nào trong danh sách để xem thuộc tính, phân loại AI và thao tác nhanh tại đây.
            </div>
          </div>
        ) : isFolder ? (
          <>
            {/* Folder View */}
            <div className="inspector-preview-box" style={{ minHeight: '110px' }}>
              <Folder
                size={54}
                style={{
                  color: item.color || '#6366f1',
                  fill: item.color ? `${item.color}33` : '#6366f133'
                }}
              />
            </div>

            <div>
              <div className="inspector-item-name">{item.name}</div>
              <div style={{ marginTop: '4px' }}>
                <span className="badge badge-slate">THƯ MỤC</span>
              </div>
            </div>

            {/* Folder Metadata */}
            <div>
              <div className="inspector-section-label">Thông số thư mục</div>
              <div className="inspector-meta-list">
                <div className="inspector-meta-row">
                  <span className="inspector-meta-key">Tên:</span>
                  <span className="inspector-meta-val" title={item.name}>{item.name}</span>
                </div>
                {item.createdAt && (
                  <div className="inspector-meta-row">
                    <span className="inspector-meta-key">Ngày tạo:</span>
                    <span className="inspector-meta-val">
                      {new Date(item.createdAt).toLocaleDateString('vi-VN')}
                    </span>
                  </div>
                )}
                {item.color && (
                  <div className="inspector-meta-row">
                    <span className="inspector-meta-key">Màu nhận diện:</span>
                    <span className="inspector-meta-val" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: item.color, display: 'inline-block' }} />
                      {item.color}
                    </span>
                  </div>
                )}
                <div className="inspector-meta-row">
                  <span className="inspector-meta-key">Lối tắt:</span>
                  <span className="inspector-meta-val" style={{ color: item.isPinned ? 'var(--accent-amber, #f59e0b)' : 'inherit', fontWeight: item.isPinned ? 600 : 400 }}>
                    {item.isPinned ? '📌 Đã ghim' : 'Chưa ghim'}
                  </span>
                </div>
              </div>
            </div>

            {/* Folder Actions */}
            <div className="inspector-action-stack">
              {!isTrash ? (
                <>
                  {onOpenFolder && (
                    <button
                      className="inspector-action-btn primary"
                      onClick={() => onOpenFolder(item._id)}
                    >
                      <ExternalLink size={15} />
                      <span>Mở thư mục</span>
                    </button>
                  )}
                  {onTogglePinFolder && (
                    <button
                      className="inspector-action-btn"
                      onClick={() => onTogglePinFolder(item._id)}
                    >
                      <Pin
                        size={15}
                        style={{
                          color: item.isPinned ? 'var(--accent-amber, #f59e0b)' : 'inherit',
                          fill: item.isPinned ? 'var(--accent-amber, #f59e0b)' : 'none'
                        }}
                      />
                      <span>{item.isPinned ? 'Bỏ ghim thư mục' : 'Ghim lên lối tắt'}</span>
                    </button>
                  )}
                  {onShareItem && (
                    <button
                      className="inspector-action-btn"
                      onClick={() => onShareItem('folder', item)}
                    >
                      <Share2 size={15} />
                      <span>Chia sẻ thư mục</span>
                    </button>
                  )}
                  {onRenameItem && (
                    <button
                      className="inspector-action-btn"
                      onClick={() => onRenameItem('folder', item)}
                    >
                      <Edit2 size={15} />
                      <span>Đổi tên</span>
                    </button>
                  )}
                  {onMoveItem && (
                    <button
                      className="inspector-action-btn"
                      onClick={() => onMoveItem('folder', item)}
                    >
                      <FolderInput size={15} />
                      <span>Di chuyển</span>
                    </button>
                  )}
                  {onDeleteItem && (
                    <button
                      className="inspector-action-btn danger"
                      onClick={() => onDeleteItem('folder', item)}
                    >
                      <Trash2 size={15} />
                      <span>Xóa vào thùng rác</span>
                    </button>
                  )}
                </>
              ) : (
                onRestoreItem && (
                  <button
                    className="inspector-action-btn primary"
                    onClick={() => onRestoreItem('folder', item)}
                  >
                    <RotateCcw size={15} />
                    <span>Khôi phục thư mục</span>
                  </button>
                )
              )}
            </div>
          </>
        ) : (
          <>
            {/* File View */}
            <div
              className="inspector-preview-box"
              style={{ cursor: onPreviewFile ? 'pointer' : 'default' }}
              onClick={() => onPreviewFile && onPreviewFile(item)}
              title="Nhấp để xem trước tệp"
            >
              {isImage && item._id ? (
                <img
                  src={`${import.meta.env.VITE_API_URL || '/api'}/files/${item._id}/preview`}
                  alt={item.name}
                  className="inspector-preview-media"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              ) : (
                <FileIcon mimeType={item.mimeType} extension={item.extension} size={54} />
              )}
            </div>

            <div>
              <div className="inspector-item-name" title={item.name}>{item.name}</div>
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginTop: '6px' }}>
                <span className="badge badge-mono badge-blue">
                  .{(item.extension || 'FILE').toUpperCase()}
                </span>
                {item.isStarred && (
                  <span className="badge badge-amber" style={{ gap: '4px' }}>
                    <Star size={11} style={{ fill: '#d97706' }} />
                    Yêu thích
                  </span>
                )}
              </div>
            </div>

            {/* Category & AI Classification Block */}
            <div className="inspector-ai-block">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <div className="inspector-ai-title" style={{ marginBottom: 0 }}>
                  <Sparkles size={14} />
                  <span>Danh mục & Phân loại</span>
                </div>
                {onAssignCategory && !isTrash && (
                  <button
                    type="button"
                    onClick={() => onAssignCategory(item)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--primary-color)',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '2px 4px'
                    }}
                    title="Đổi hoặc gán danh mục"
                  >
                    <Tags size={12} />
                    <span>Đổi</span>
                  </button>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span
                  style={{
                    display: 'inline-block',
                    padding: '3px 9px',
                    borderRadius: '999px',
                    backgroundColor: 'rgba(99, 102, 241, 0.1)',
                    color: 'var(--primary-color)',
                    fontSize: '0.8rem',
                    fontWeight: 600
                  }}
                >
                  {item.aiCategory || 'Chưa phân loại'}
                </span>
              </div>
              {item.aiSummary && (
                <div className="inspector-ai-summary" style={{ marginTop: '8px' }}>
                  {item.aiSummary}
                </div>
              )}
              {item.aiTags && item.aiTags.length > 0 && (
                <div className="inspector-tags-wrap" style={{ marginTop: '8px' }}>
                  {item.aiTags.map((tag, idx) => (
                    <span key={idx} className="inspector-tag">
                      #{tag}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* File Metadata */}
            <div>
              <div className="inspector-section-label">Thông tin tệp</div>
              <div className="inspector-meta-list">
                <div className="inspector-meta-row">
                  <span className="inspector-meta-key">Kích thước:</span>
                  <span className="inspector-meta-val">
                    {item.formattedSize || formatBytes(item.size)}
                  </span>
                </div>
                <div className="inspector-meta-row">
                  <span className="inspector-meta-key">Định dạng:</span>
                  <span className="inspector-meta-val">{item.mimeType || item.extension || 'Không xác định'}</span>
                </div>
                {item.createdAt && (
                  <div className="inspector-meta-row">
                    <span className="inspector-meta-key">Ngày tạo:</span>
                    <span className="inspector-meta-val">
                      {new Date(item.createdAt).toLocaleString('vi-VN')}
                    </span>
                  </div>
                )}
                {item.folder?.name && (
                  <div className="inspector-meta-row">
                    <span className="inspector-meta-key">Thư mục cha:</span>
                    <span className="inspector-meta-val">{item.folder.name}</span>
                  </div>
                )}
              </div>
            </div>

            {/* File Actions */}
            <div className="inspector-action-stack">
              {!isTrash ? (
                <>
                  {onPreviewFile && (
                    <button
                      className="inspector-action-btn primary"
                      onClick={() => onPreviewFile(item)}
                    >
                      <Eye size={15} />
                      <span>Xem trước tài liệu</span>
                    </button>
                  )}
                  {onDownloadFile && (
                    <button
                      className="inspector-action-btn"
                      onClick={() => onDownloadFile(item)}
                    >
                      <Download size={15} />
                      <span>Tải về máy</span>
                    </button>
                  )}
                  {onToggleStar && (
                    <button
                      className="inspector-action-btn"
                      onClick={() => onToggleStar(item._id)}
                    >
                      <Star
                        size={15}
                        style={{
                          color: item.isStarred ? '#f59e0b' : 'inherit',
                          fill: item.isStarred ? '#f59e0b' : 'none'
                        }}
                      />
                      <span>{item.isStarred ? 'Bỏ gắn sao' : 'Gắn sao yêu thích'}</span>
                    </button>
                  )}
                  {onShareItem && (
                    <button
                      className="inspector-action-btn"
                      onClick={() => onShareItem('file', item)}
                    >
                      <Share2 size={15} />
                      <span>Chia sẻ liên kết</span>
                    </button>
                  )}
                  {onRenameItem && (
                    <button
                      className="inspector-action-btn"
                      onClick={() => onRenameItem('file', item)}
                    >
                      <Edit2 size={15} />
                      <span>Đổi tên tệp</span>
                    </button>
                  )}
                  {onMoveItem && (
                    <button
                      className="inspector-action-btn"
                      onClick={() => onMoveItem('file', item)}
                    >
                      <FolderInput size={15} />
                      <span>Di chuyển</span>
                    </button>
                  )}
                  {onCopyItem && (
                    <button
                      className="inspector-action-btn"
                      onClick={() => onCopyItem('file', item)}
                    >
                      <Copy size={15} />
                      <span>Tạo bản sao</span>
                    </button>
                  )}
                  {onVersionHistory && (
                    <button
                      className="inspector-action-btn"
                      onClick={() => onVersionHistory(item)}
                    >
                      <History size={15} />
                      <span>Lịch sử phiên bản</span>
                    </button>
                  )}
                  {onAssignCategory && (
                    <button
                      className="inspector-action-btn"
                      onClick={() => onAssignCategory(item)}
                    >
                      <Tags size={15} />
                      <span>Phân loại danh mục</span>
                    </button>
                  )}
                  {onDeleteItem && (
                    <button
                      className="inspector-action-btn danger"
                      onClick={() => onDeleteItem('file', item)}
                    >
                      <Trash2 size={15} />
                      <span>Xóa vào thùng rác</span>
                    </button>
                  )}
                </>
              ) : (
                <>
                  {onRestoreItem && (
                    <button
                      className="inspector-action-btn primary"
                      onClick={() => onRestoreItem('file', item)}
                    >
                      <RotateCcw size={15} />
                      <span>Khôi phục tệp</span>
                    </button>
                  )}
                  {onDeleteItem && (
                    <button
                      className="inspector-action-btn danger"
                      onClick={() => onDeleteItem('file', item, true)}
                    >
                      <Trash2 size={15} />
                      <span>Xóa vĩnh viễn</span>
                    </button>
                  )}
                </>
              )}
            </div>
          </>
        )}
      </div>
    </aside>
  </>
  );
};

export default InspectorPanel;
