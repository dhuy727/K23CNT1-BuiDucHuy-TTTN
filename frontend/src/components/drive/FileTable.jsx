import React, { useState, useEffect, useRef } from 'react';
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
  MoreVertical
} from 'lucide-react';
import FileIcon from './FileIcon';

/* ── Dropdown menu 3 chấm ── */
const TableMoreMenu = ({ items, onClose }) => {
  const ref = useRef(null);
  const [openUpwards, setOpenUpwards] = useState(false);

  useEffect(() => {
    if (ref.current) {
      const rect = ref.current.getBoundingClientRect();
      if (window.innerHeight - rect.bottom < 15) {
        setOpenUpwards(true);
      }
    }
  }, []);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  return (
    <div
      className={`home-more-menu ${openUpwards ? 'open-upwards' : ''}`}
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
  onRestoreItem
}) => {
  const [menuOpen, setMenuOpen] = useState(false);

  const menuItems = [
    onOpenFolder && { icon: <Folder size={14} />, label: 'Mở thư mục', onClick: () => onOpenFolder(folder._id) },
    onShareItem && { icon: <Share2 size={14} />, label: 'Chia sẻ', onClick: () => onShareItem('folder', folder) },
    onRenameItem && { icon: <Edit2 size={14} />, label: 'Đổi tên', onClick: () => onRenameItem('folder', folder) },
    onMoveItem && { icon: <FolderInput size={14} />, label: 'Di chuyển', onClick: () => onMoveItem('folder', folder) },
    { divider: true },
    onDeleteItem && { icon: <Trash2 size={14} />, label: 'Xóa vào thùng rác', danger: true, onClick: () => onDeleteItem('folder', folder) }
  ].filter(Boolean);

  return (
    <tr
      className={isSelected ? 'is-selected' : ''}
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
        <span className="badge badge-slate">Thư mục</span>
      </td>
      <td className="col-size table-mono-cell">-</td>
      <td className="col-date table-mono-cell">
        {folder.createdAt ? new Date(folder.createdAt).toLocaleDateString('vi-VN') : '-'}
      </td>
      <td className="col-actions table-action-cell">
        <div className="table-action-btns" onClick={(e) => e.stopPropagation()}>
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
                className={`btn-icon home-quick-btn ${menuOpen ? 'active' : ''}`}
                title="Thao tác khác"
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpen((v) => !v);
                }}
              >
                <MoreVertical size={15} />
              </button>
              {menuOpen && <TableMoreMenu items={menuItems} onClose={() => setMenuOpen(false)} />}
            </>
          ) : (
            onRestoreItem && (
              <button
                className="btn btn-secondary"
                style={{ padding: '3px 8px', fontSize: '0.72rem' }}
                onClick={() => onRestoreItem('folder', folder)}
              >
                Khôi phục
              </button>
            )
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
  formatSize
}) => {
  const [menuOpen, setMenuOpen] = useState(false);

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
    { divider: true },
    onDeleteItem && { icon: <Trash2 size={14} />, label: 'Xóa vào thùng rác', danger: true, onClick: () => onDeleteItem('file', file) }
  ].filter(Boolean);

  return (
    <tr
      className={isSelected ? 'is-selected' : ''}
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
          <span title={file.name}>{file.name}</span>
          {file.isStarred && (
            <Star size={13} style={{ color: '#f59e0b', fill: '#f59e0b', flexShrink: 0 }} />
          )}
        </div>
      </td>
      <td className="col-ai">
        {file.aiCategory && file.aiCategory !== 'Chưa phân loại' ? (
          <span className="badge badge-purple" title="Phân loại AI">
            <Sparkles size={11} />
            {file.aiCategory}
          </span>
        ) : (
          <span className="badge badge-mono badge-blue">
            .{(file.extension || 'file').toUpperCase()}
          </span>
        )}
      </td>
      <td className="col-size table-mono-cell">
        {file.formattedSize || formatSize(file.size)}
      </td>
      <td className="col-date table-mono-cell">
        {file.createdAt ? new Date(file.createdAt).toLocaleDateString('vi-VN') : '-'}
      </td>
      <td className="col-actions table-action-cell">
        <div className="table-action-btns" onClick={(e) => e.stopPropagation()}>
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
                className={`btn-icon home-quick-btn ${menuOpen ? 'active' : ''}`}
                title="Thao tác khác"
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpen((v) => !v);
                }}
              >
                <MoreVertical size={15} />
              </button>
              {menuOpen && <TableMoreMenu items={menuItems} onClose={() => setMenuOpen(false)} />}
            </>
          ) : (
            <div style={{ display: 'flex', gap: '4px' }}>

              {onRestoreItem && (
                <button
                  className="btn btn-secondary"
                  style={{ padding: '3px 8px', fontSize: '0.72rem' }}
                  onClick={() => onRestoreItem('file', file)}
                >
                  Khôi phục
                </button>
              )}
              {onDeleteItem && (
                <button
                  className="btn btn-danger"
                  style={{ padding: '3px 8px', fontSize: '0.72rem' }}
                  onClick={() => onDeleteItem('file', file, true)}
                >
                  Xóa
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
            />
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default FileTable;
