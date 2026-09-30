import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
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
  Sparkles,
  Copy,
  MoreVertical,
  RefreshCw,
  Clock,
  XCircle,
  RotateCcw
} from 'lucide-react';
import FileIcon from './FileIcon';

/* ── Dropdown menu 3 chấm dùng riêng cho Table qua Portal để chống bị che khuất ── */
const TableMoreMenu = ({ buttonRef, items, onClose }) => {
  const menuRef = useRef(null);
  const [coords, setCoords] = useState(null);

  useLayoutEffect(() => {
    if (!buttonRef?.current) return;
    const btnRect = buttonRef.current.getBoundingClientRect();
    const menuWidth = 210;
    const numItems = items.filter((it) => !it.divider).length;
    const numDividers = items.filter((it) => it.divider).length;
    const estHeight = numItems * 35 + numDividers * 8 + 12;

    const spaceBelow = window.innerHeight - btnRect.bottom;
    const openUpwards = spaceBelow < estHeight && btnRect.top > estHeight;

    const top = openUpwards
      ? Math.max(10, btnRect.top - estHeight - 4)
      : Math.min(window.innerHeight - estHeight - 10, btnRect.bottom + 4);

    const left = Math.max(10, Math.min(btnRect.right - menuWidth, window.innerWidth - menuWidth - 10));

    setCoords({ top, left });
  }, [buttonRef, items]);

  useEffect(() => {
    const handler = (e) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target) &&
        buttonRef?.current &&
        !buttonRef.current.contains(e.target)
      ) {
        onClose();
      }
    };
    const scrollHandler = () => onClose();
    document.addEventListener('mousedown', handler);
    window.addEventListener('scroll', scrollHandler, true);
    window.addEventListener('resize', scrollHandler);

    return () => {
      document.removeEventListener('mousedown', handler);
      window.removeEventListener('scroll', scrollHandler, true);
      window.removeEventListener('resize', scrollHandler);
    };
  }, [onClose, buttonRef]);

  if (!coords) return null;

  return createPortal(
    <div
      className="home-more-menu portal-table-menu"
      ref={menuRef}
      style={{
        position: 'fixed',
        top: `${coords.top}px`,
        left: `${coords.left}px`,
        zIndex: 9999
      }}
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
    </div>,
    document.body
  );
};


/* ── Row thư mục ── */
const FolderRow = ({
  folder,
  isSelected,
  onSelectItem,
  onOpenFolder,
  onShareItem,
  onRenameItem,
  onMoveItem,
  onDeleteItem,
  isTrash,
  onRestoreItem,
  onDirectDrop
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [isDropTarget, setIsDropTarget] = useState(false);
  const buttonRef = useRef(null);

  const menuItems = [
    onOpenFolder && { icon: <Folder size={14} />, label: 'Mở thư mục', onClick: () => onOpenFolder(folder._id) },
    onShareItem && { icon: <Share2 size={14} />, label: 'Chia sẻ', onClick: () => onShareItem('folder', folder) },
    onRenameItem && { icon: <Edit2 size={14} />, label: 'Đổi tên', onClick: () => onRenameItem('folder', folder) },
    onMoveItem && { icon: <FolderInput size={14} />, label: 'Di chuyển', onClick: () => onMoveItem('folder', folder) },
    { divider: true },
    onDeleteItem && { icon: <Trash2 size={14} />, label: 'Xóa vào thùng rác', danger: true, onClick: () => onDeleteItem('folder', folder) }
  ].filter(Boolean);

  const handleDragStart = (e) => {
    if (isTrash) return;
    e.dataTransfer.setData('application/json', JSON.stringify({
      type: 'folder',
      id: folder._id,
      name: folder.name
    }));
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e) => {
    if (isTrash) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setIsDropTarget(true);
  };

  const handleDragLeave = (e) => {
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setIsDropTarget(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDropTarget(false);
    if (isTrash) return;
    try {
      const raw = e.dataTransfer.getData('application/json');
      if (!raw) return;
      const item = JSON.parse(raw);
      if (item && item.id !== folder._id && onDirectDrop) {
        onDirectDrop(item, folder);
      }
    } catch (err) {
      console.error('Lỗi drop:', err);
    }
  };

  return (
    <tr
      className={`folder-row ${isSelected ? 'is-selected' : ''} ${menuOpen ? 'menu-open' : ''} ${isDropTarget ? 'drop-target-active' : ''}`}
      draggable={!isTrash}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={() => onSelectItem && onSelectItem({ type: 'folder', data: folder })}
      onDoubleClick={() => onOpenFolder && onOpenFolder(folder._id)}
    >
      <td className="col-name">
        <div className="table-name-cell">
          <Folder
            size={18}
            style={{
              color: folder.color || 'var(--primary-600)',
              fill: folder.color ? `${folder.color}33` : 'var(--primary-200)',
              flexShrink: 0
            }}
          />
          <span title={folder.name}>{folder.name}</span>
        </div>
      </td>
      <td className="col-ai">
        <span className="badge badge-slate" title="Thư mục">
          <span>Thư mục</span>
        </span>
      </td>
      <td className="col-size table-mono-cell">-</td>
      <td className="col-date table-mono-cell">
        {folder.createdAt ? new Date(folder.createdAt).toLocaleDateString('vi-VN') : '-'}
      </td>
      <td className={`col-actions table-action-cell ${menuOpen ? 'menu-open' : ''}`}>
        <div className={`table-action-btns ${menuOpen ? 'menu-open' : ''}`} onClick={(e) => e.stopPropagation()}>
          {!isTrash ? (
            <>
              <div className="table-row-hover-actions">
                {onShareItem && (
                  <button
                    className="btn-icon home-quick-btn"
                    title="Chia sẻ"
                    onClick={(e) => {
                      e.stopPropagation();
                      onShareItem('folder', folder);
                    }}
                  >
                    <Share2 size={14} />
                  </button>
                )}
                {onRenameItem && (
                  <button
                    className="btn-icon home-quick-btn"
                    title="Đổi tên"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRenameItem('folder', folder);
                    }}
                  >
                    <Edit2 size={14} />
                  </button>
                )}
              </div>
              <button
                ref={buttonRef}
                className={`btn-icon home-quick-btn ${menuOpen ? 'active' : ''}`}
                title="Thao tác khác"
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpen((v) => !v);
                }}
              >
                <MoreVertical size={15} />
              </button>
              {menuOpen && <TableMoreMenu buttonRef={buttonRef} items={menuItems} onClose={() => setMenuOpen(false)} />}
            </>
          ) : (
            <div className="trash-action-btns">
              {onRestoreItem && (
                <button
                  className="btn btn-secondary trash-action-btn"
                  title="Khôi phục thư mục"
                  onClick={() => onRestoreItem('folder', folder)}
                >
                  <RotateCcw size={14} className="trash-action-icon" />
                  <span className="trash-action-text">Khôi phục</span>
                </button>
              )}
              {onDeleteItem && (
                <button
                  className="btn btn-danger trash-action-btn"
                  title="Xóa vĩnh viễn"
                  onClick={() => onDeleteItem('folder', folder, true)}
                >
                  <Trash2 size={14} className="trash-action-icon" />
                  <span className="trash-action-text">Xóa</span>
                </button>
              )}
            </div>
          )}
        </div>
      </td>

    </tr>
  );
};

/* ── Row tệp tin ── */
const FileRow = ({
  file,
  isSelected,
  onSelectItem,
  onPreviewFile,
  onDownloadFile,
  onToggleStar,
  onShareItem,
  onRenameItem,
  onMoveItem,
  onCopyItem,
  onVersionHistory,
  onDeleteItem,
  isTrash,
  onRestoreItem,
  formatSize,
  onRetryAi
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const buttonRef = useRef(null);

  const menuItems = [
    onPreviewFile && { icon: <Eye size={14} />, label: 'Xem trước', onClick: () => onPreviewFile(file) },
    onDownloadFile && { icon: <Download size={14} />, label: 'Tải xuống', onClick: () => onDownloadFile(file) },
    onToggleStar && {
      icon: <Star size={14} style={{ color: file.isStarred ? '#f59e0b' : 'inherit', fill: file.isStarred ? '#f59e0b' : 'none' }} />,
      label: file.isStarred ? 'Bỏ yêu thích' : 'Yêu thích',
      onClick: () => onToggleStar(file._id)
    },
    onShareItem && { icon: <Share2 size={14} />, label: 'Chia sẻ', onClick: () => onShareItem('file', file) },
    onRenameItem && { icon: <Edit2 size={14} />, label: 'Đổi tên', onClick: () => onRenameItem('file', file) },
    onMoveItem && { icon: <FolderInput size={14} />, label: 'Di chuyển', onClick: () => onMoveItem('file', file) },
    onCopyItem && { icon: <Copy size={14} />, label: 'Sao chép vào', onClick: () => onCopyItem('file', file) },
    onVersionHistory && { icon: <History size={14} />, label: 'Lịch sử phiên bản', onClick: () => onVersionHistory(file) },
    onRetryAi && (file.aiStatus === 'failed' || file.aiStatus === 'skipped') && {
      icon: <RefreshCw size={14} />,
      label: 'Phân tích lại AI',
      onClick: () => onRetryAi(file._id)
    },
    { divider: true },
    onDeleteItem && { icon: <Trash2 size={14} />, label: 'Xóa vào thùng rác', danger: true, onClick: () => onDeleteItem('file', file) }
  ].filter(Boolean);

  const handleDragStart = (e) => {
    if (isTrash) return;
    e.dataTransfer.setData('application/json', JSON.stringify({
      type: 'file',
      id: file._id,
      name: file.name
    }));
    e.dataTransfer.effectAllowed = 'move';
  };

  return (
    <tr
      data-file-id={file._id}
      className={`${isSelected ? 'is-selected' : ''} ${menuOpen ? 'menu-open' : ''}`}
      draggable={!isTrash}
      onDragStart={handleDragStart}
      onClick={() => onSelectItem && onSelectItem({ type: 'file', data: file })}
      onDoubleClick={() => onPreviewFile && onPreviewFile(file)}
    >
      <td className="col-name">
        <div className="table-name-cell">
          <FileIcon
            mimeType={file.mimeType}
            extension={file.extension}
            size={18}
            className="table-file-icon"
          />
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span title={file.name}>{file.name}</span>
              {file.isStarred && (
                <Star size={13} style={{ color: '#f59e0b', fill: '#f59e0b', flexShrink: 0 }} />
              )}
            </div>
            {Array.isArray(file.aiTags) && file.aiTags.length > 0 && (
              <div style={{ display: 'flex', gap: '4px', marginTop: '2px' }}>
                {file.aiTags.slice(0, 2).map((t, idx) => (
                  <span
                    key={idx}
                    style={{
                    fontSize: '0.6875rem',
                    color: 'var(--text-muted)',
                    background: 'var(--bg-surface-hover)',
                    padding: '1px 5px',
                    borderRadius: '4px'
                  }}
                >
                  #{t}
                </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </td>
      <td className="col-ai">
        {file.aiStatus === 'processing' ? (
          <span className="badge badge-ai-processing" title="AI đang phân tích">
            <RefreshCw size={10} className="spin-animation" style={{ flexShrink: 0 }} />
            <span>Đang xử lý</span>
          </span>
        ) : file.aiStatus === 'pending' ? (
          <span className="badge badge-ai-pending" title="Đang chờ phân tích AI">
            <Clock size={10} style={{ flexShrink: 0 }} />
            <span>Chờ AI</span>
          </span>
        ) : file.aiStatus === 'failed' ? (
          <span
            className="badge badge-ai-failed"
            title={`${file.aiError || 'Phân tích AI thất bại'} - Bấm để phân tích lại`}
            style={{ cursor: onRetryAi ? 'pointer' : 'default' }}
            onClick={(e) => {
              if (onRetryAi) {
                e.stopPropagation();
                onRetryAi(file._id);
              }
            }}
          >
            <XCircle size={10} style={{ flexShrink: 0 }} />
            <span>Lỗi AI</span>
          </span>
        ) : file.aiCategory && file.aiCategory !== 'Chưa phân loại' ? (
          <span className="badge badge-purple" title={`Phân loại AI: ${file.aiCategory}`}>
            <Sparkles size={11} style={{ flexShrink: 0 }} />
            <span>{file.aiCategory}</span>
          </span>
        ) : (
          <span className="badge badge-mono badge-blue" title={file.extension ? `Định dạng .${file.extension}` : 'Tệp'}>
            <span>.{(file.extension || 'file').toUpperCase()}</span>
          </span>
        )}
      </td>
      <td className="col-size table-mono-cell">
        {file.formattedSize || formatSize(file.size)}
      </td>
      <td className="col-date table-mono-cell">
        {file.createdAt ? new Date(file.createdAt).toLocaleDateString('vi-VN') : '-'}
      </td>
      <td className={`col-actions table-action-cell ${menuOpen ? 'menu-open' : ''}`}>
        <div className={`table-action-btns ${menuOpen ? 'menu-open' : ''}`} onClick={(e) => e.stopPropagation()}>
          {!isTrash ? (
            <>
              <div className="table-row-hover-actions">
                {onDownloadFile && (
                  <button
                    className="btn-icon home-quick-btn"
                    title="Tải xuống"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDownloadFile(file);
                    }}
                  >
                    <Download size={14} />
                  </button>
                )}
                {onShareItem && (
                  <button
                    className="btn-icon home-quick-btn"
                    title="Chia sẻ"
                    onClick={(e) => {
                      e.stopPropagation();
                      onShareItem('file', file);
                    }}
                  >
                    <Share2 size={14} />
                  </button>
                )}
                {onToggleStar && (
                  <button
                    className="btn-icon home-quick-btn"
                    title={file.isStarred ? 'Bỏ yêu thích' : 'Yêu thích'}
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleStar(file._id);
                    }}
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
              </div>
              <button
                ref={buttonRef}
                className={`btn-icon home-quick-btn ${menuOpen ? 'active' : ''}`}
                title="Thao tác khác"
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpen((v) => !v);
                }}
              >
                <MoreVertical size={15} />
              </button>
              {menuOpen && <TableMoreMenu buttonRef={buttonRef} items={menuItems} onClose={() => setMenuOpen(false)} />}
            </>
          ) : (
            <div className="trash-action-btns">
              {onRestoreItem && (
                <button
                  className="btn btn-secondary trash-action-btn"
                  title="Khôi phục tệp tin"
                  onClick={() => onRestoreItem('file', file)}
                >
                  <RotateCcw size={14} className="trash-action-icon" />
                  <span className="trash-action-text">Khôi phục</span>
                </button>
              )}
              {onDeleteItem && (
                <button
                  className="btn btn-danger trash-action-btn"
                  title="Xóa vĩnh viễn"
                  onClick={() => onDeleteItem('file', file, true)}
                >
                  <Trash2 size={14} className="trash-action-icon" />
                  <span className="trash-action-text">Xóa</span>
                </button>
              )}
            </div>
          )}
        </div>
      </td>
    </tr>
  );
};

const FileTable = ({
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
  onRestoreItem,
  onRetryAi,
  onDirectDrop
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
      <table className={`file-table ${isTrash ? 'is-trash' : ''}`}>
        <thead>
          <tr>
            <th className="col-name">Tên mục</th>
            <th className="col-ai">Phân loại AI</th>
            <th className="col-size">Kích thước</th>
            <th className="col-date">Ngày tạo</th>
            <th className="col-actions" aria-label="Thao tác" />
          </tr>
        </thead>
        <tbody>
          {/* Danh sách Thư mục */}
          {folders.map((folder) => (
            <FolderRow
              key={`folder-${folder._id}`}
              folder={folder}
              isSelected={selectedItem?.type === 'folder' && selectedItem?.data?._id === folder._id}
              onSelectItem={onSelectItem}
              onOpenFolder={onOpenFolder}
              onShareItem={onShareItem}
              onRenameItem={onRenameItem}
              onMoveItem={onMoveItem}
              onDeleteItem={onDeleteItem}
              isTrash={isTrash}
              onRestoreItem={onRestoreItem}
              onDirectDrop={onDirectDrop}
            />
          ))}

          {/* Danh sách Tệp tin */}
          {files.map((file) => (
            <FileRow
              key={`file-${file._id}`}
              file={file}
              isSelected={selectedItem?.type === 'file' && selectedItem?.data?._id === file._id}
              onSelectItem={onSelectItem}
              onPreviewFile={onPreviewFile}
              onDownloadFile={onDownloadFile}
              onToggleStar={onToggleStar}
              onShareItem={onShareItem}
              onRenameItem={onRenameItem}
              onMoveItem={onMoveItem}
              onCopyItem={onCopyItem}
              onVersionHistory={onVersionHistory}
              onDeleteItem={onDeleteItem}
              isTrash={isTrash}
              onRestoreItem={onRestoreItem}
              formatSize={formatSize}
              onRetryAi={onRetryAi}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default FileTable;
