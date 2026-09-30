import React, { useState, useEffect, useRef, useCallback, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import {
  Upload,
  Star,
  Download,
  Eye,
  Share2,
  Edit2,
  Trash2,
  FolderInput,
  History,
  MoreVertical,
  Folder,
  FolderOpen,
  FolderClock,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  HardDrive,
  Clock,
  Files,
  Pin
} from 'lucide-react';
import FileIcon from '../../components/drive/FileIcon';
import ContextualActionBar from '../../components/drive/ContextualActionBar';
import FilePreviewModal from '../../components/drive/FilePreviewModal';


import RenameModal from '../../components/drive/RenameModal';
import MoveCopyModal from '../../components/drive/MoveCopyModal';
import ShareModal from '../../components/drive/ShareModal';
import FileVersionsModal from '../../components/drive/FileVersionsModal';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import InspectorPanel from '../../components/drive/InspectorPanel';
import fileService from '../../services/fileService';
import folderService from '../../services/folderService';
import { useToast } from '../../contexts/ToastContext';
import { useAuth } from '../../contexts/AuthContext';

/* ── Dropdown menu 3 chấm qua Portal chống bị che khuất bởi overflow ── */
const MoreMenu = ({ buttonRef, items, onClose }) => {
  const menuRef = useRef(null);
  const [coords, setCoords] = useState(null);

  useLayoutEffect(() => {
    if (!buttonRef?.current) return;
    const btnRect = buttonRef.current.getBoundingClientRect();
    const menuWidth = 200;
    const numItems = items.filter((it) => !it.divider).length;
    const numDividers = items.filter((it) => it.divider).length;
    const estHeight = numItems * 36 + numDividers * 8 + 14;

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

/* ── Thẻ thư mục gần đây trên Trang chủ ── */
const HomeFolderCard = ({
  folder,
  isSelected,
  isDragTarget,
  onSelect,
  onOpen,
  onTogglePin,
  onShare,
  onRename,
  onMove,
  onDelete,
  onDragOver,
  onDragLeave,
  onDrop
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const moreBtnRef = useRef(null);

  const folderMenuItems = [
    {
      icon: <FolderOpen size={14} />,
      label: 'Mở thư mục',
      onClick: () => onOpen(folder._id)
    },
    {
      icon: <Pin size={14} style={{ color: folder.isPinned ? '#f59e0b' : 'inherit' }} />,
      label: folder.isPinned ? 'Bỏ ghim thư mục' : 'Ghim thư mục',
      onClick: () => onTogglePin(folder._id)
    },
    {
      icon: <Share2 size={14} />,
      label: 'Chia sẻ',
      onClick: () => onShare(folder)
    },
    {
      icon: <Edit2 size={14} />,
      label: 'Đổi tên',
      onClick: () => onRename(folder)
    },
    {
      icon: <FolderInput size={14} />,
      label: 'Di chuyển',
      onClick: () => onMove(folder)
    },
    { divider: true },
    {
      icon: <Trash2 size={14} />,
      label: 'Xóa thư mục',
      danger: true,
      onClick: () => onDelete(folder)
    }
  ];

  const updatedAtFormatted = folder.updatedAt
    ? new Date(folder.updatedAt).toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: '2-digit'
      })
    : '';

  return (
    <div
      className={`home-folder-scroll-card ${isSelected ? 'is-selected' : ''} ${
        isDragTarget ? 'drop-target-active' : ''
      }`}
      onClick={() => onSelect(folder)}
      onDoubleClick={() => onOpen(folder._id)}
      onDragOver={(e) => onDragOver(e, folder)}
      onDragLeave={(e) => onDragLeave(e, folder)}
      onDrop={(e) => onDrop(e, folder)}
    >
      <div className="home-folder-card-top">
        <div
          className="home-folder-icon-box"
          style={{
            backgroundColor: folder.color ? `${folder.color}18` : 'rgba(99, 102, 241, 0.1)',
            borderColor: folder.color ? `${folder.color}35` : 'rgba(99, 102, 241, 0.2)'
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

        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }} onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            className={`home-folder-action-btn ${folder.isPinned ? 'is-pinned' : ''}`}
            title={folder.isPinned ? 'Bỏ ghim thư mục' : 'Ghim lên lối tắt'}
            onClick={(e) => {
              e.stopPropagation();
              onTogglePin(folder._id);
            }}
            aria-label={folder.isPinned ? 'Bỏ ghim' : 'Ghim'}
          >
            <Pin
              size={13}
              style={{
                color: folder.isPinned ? 'var(--accent-amber, #f59e0b)' : 'var(--text-secondary)',
                fill: folder.isPinned ? 'var(--accent-amber, #f59e0b)' : 'none',
                opacity: folder.isPinned ? 1 : 0.85
              }}
            />
          </button>
          <div className={`home-folder-card-actions ${isMenuOpen ? 'menu-open' : ''}`}>
            <button
              ref={moreBtnRef}
              type="button"
              className={`home-folder-action-btn ${isMenuOpen ? 'active' : ''}`}
              title="Thao tác"
              onClick={(e) => {
                e.stopPropagation();
                setIsMenuOpen((prev) => !prev);
              }}
              aria-label="Thao tác khác"
            >
              <MoreVertical size={14} style={{ color: 'var(--text-secondary)' }} />
            </button>
            {isMenuOpen && (
              <MoreMenu
                buttonRef={moreBtnRef}
                items={folderMenuItems}
                onClose={() => setIsMenuOpen(false)}
              />
            )}
          </div>
        </div>
      </div>

      <div className="home-folder-card-title" title={folder.name}>
        {folder.name}
      </div>

      <div className="home-folder-card-meta">
        <span className="home-folder-meta-count" title={`${folder.fileCount || 0} tệp tin trong thư mục`}>
          <Files size={12} style={{ color: 'var(--primary-400)' }} />
          <span>{folder.fileCount || 0} tệp</span>
        </span>
        {updatedAtFormatted && (
          <span
            className="home-folder-meta-time"
            title={`Cập nhật: ${new Date(folder.updatedAt).toLocaleString('vi-VN')}`}
          >
            <Clock size={11} />
            <span>{updatedAtFormatted}</span>
          </span>
        )}
      </div>
    </div>
  );
};

/* ── Home Section Container ── */
const HomeSection = ({ icon, title, count, onViewAll, children, emptyText }) => (
  <div className="home-section">
    <div className="home-section-header">
      <div className="home-section-title">
        {icon}
        <span>{title}</span>
        {count !== undefined && <span className="drive-section-count">{count}</span>}
      </div>
      {onViewAll && (
        <button className="home-view-all-btn" onClick={onViewAll}>
          <span>Xem tất cả</span>
          <ChevronRight size={14} />
        </button>
      )}
    </div>
    {children}
  </div>
);

const HomePage = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = useAuth();

  const [recentFiles, setRecentFiles] = useState([]);
  const [starredFiles, setStarredFiles] = useState([]);
  const [recentFolders, setRecentFolders] = useState([]);
  const [loading, setLoading] = useState(true);

  // Studio Inspector state
  const [selectedItem, setSelectedItem] = useState(null);
  const [isInspectorOpen, setIsInspectorOpen] = useState(true);

  // Horizontal scroll ref & active states
  const foldersScrollRef = useRef(null);
  const [activeFolderMenuId, setActiveFolderMenuId] = useState(null);
  const [dragOverFolderId, setDragOverFolderId] = useState(null);

  // Modals state
  const [previewFile, setPreviewFile] = useState(null);
  const [renameTarget, setRenameTarget] = useState(null);
  const [moveCopyTarget, setMoveCopyTarget] = useState(null);
  const [shareTarget, setShareTarget] = useState(null);
  const [versionsTarget, setVersionsTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [recentRes, starredRes, folderRes] = await Promise.allSettled([
        fileService.getFiles({ sortBy: 'createdAt', sortOrder: 'desc', folderId: 'root' }),
        fileService.getFiles({ isStarred: true, sortBy: 'updatedAt', sortOrder: 'desc' }),
        folderService.getFolders({ sortBy: 'updatedAt', sortOrder: 'desc', limit: 10 })
      ]);

      if (recentRes.status === 'fulfilled') {
        setRecentFiles((recentRes.value.data || []).slice(0, 10));
      }
      if (starredRes.status === 'fulfilled') {
        setStarredFiles((starredRes.value.data || []).slice(0, 6));
      }
      if (folderRes.status === 'fulfilled') {
        const raw = folderRes.value.data;
        const list = Array.isArray(raw) ? raw : (raw?.folders || raw?.data || []);
        setRecentFolders(list.slice(0, 10));
      }
    } catch (err) {
      console.error('Lỗi khi tải trang chủ:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const onRefresh = () => fetchData();
    window.addEventListener('drive:refresh', onRefresh);
    return () => window.removeEventListener('drive:refresh', onRefresh);
  }, [fetchData]);

  // Toggle Inspector global event
  useEffect(() => {
    const handleToggle = () => setIsInspectorOpen((prev) => !prev);
    window.addEventListener('drive:toggle-inspector', handleToggle);
    return () => window.removeEventListener('drive:toggle-inspector', handleToggle);
  }, []);

  const handleDownloadFile = async (file) => {
    try {
      toast.info(`Đang chuẩn bị tải về "${file.name}"...`);
      const blob = await fileService.downloadFileBlob(file._id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(`Đã tải xuống "${file.name}"`);
    } catch {
      toast.error('Không thể tải tệp tin');
    }
  };

  const handleToggleStar = async (fileId) => {
    try {
      const res = await fileService.toggleStar(fileId);
      const updated = res.data;
      const patcher = (prev) =>
        prev.map((f) => (f._id === fileId ? { ...f, isStarred: updated.isStarred } : f));
      setRecentFiles(patcher);
      setStarredFiles(patcher);
      if (selectedItem?.type === 'file' && selectedItem?.data?._id === fileId) {
        setSelectedItem((prev) => ({
          ...prev,
          data: { ...prev.data, isStarred: updated.isStarred }
        }));
      }
      toast.success(updated.isStarred ? 'Đã thêm vào yêu thích' : 'Đã bỏ khỏi yêu thích');
    } catch {
      toast.error('Cập nhật trạng thái yêu thích thất bại');
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      if (deleteTarget.type === 'folder') {
        await folderService.deleteFolder(deleteTarget.item._id);
        toast.success(`Đã chuyển thư mục "${deleteTarget.item.name}" vào thùng rác`);
      } else {
        await fileService.deleteFile(deleteTarget.item._id);
        toast.success(`Đã chuyển tệp tin "${deleteTarget.item.name}" vào thùng rác`);
      }
      setDeleteTarget(null);
      setSelectedItem(null);
      fetchData();
      window.dispatchEvent(new Event('folder:updated'));
    } catch (err) {
      toast.error(err.response?.data?.message || 'Xóa thất bại');
    } finally {
      setDeleting(false);
    }
  };

  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? 'Chào buổi sáng' : hour < 18 ? 'Chào buổi chiều' : 'Chào buổi tối';
  const displayName = user?.name || user?.email || 'bạn';

  /* ── Điều khiển cuộn ngang thư mục gần đây ── */
  const handleScrollFolders = (direction) => {
    if (foldersScrollRef.current) {
      const offset = direction === 'left' ? -240 : 240;
      foldersScrollRef.current.scrollBy({ left: offset, behavior: 'smooth' });
    }
  };

  /* ── Kéo thả tệp tin vào thư mục ── */
  const handleFileDragStart = (e, file) => {
    e.dataTransfer.setData(
      'application/json',
      JSON.stringify({
        type: 'file',
        id: file._id,
        name: file.name
      })
    );
    e.dataTransfer.effectAllowed = 'move';
  };

  /* ── Ghim / Bỏ ghim thư mục ── */
  const handleTogglePinFolder = async (folderId) => {
    try {
      const res = await folderService.togglePinFolder(folderId);
      const updated = res.data;
      toast.success(
        updated.isPinned
          ? `Đã ghim thư mục "${updated.name}" lên lối tắt`
          : `Đã bỏ ghim thư mục "${updated.name}"`
      );
      setRecentFolders((prev) =>
        prev.map((f) => (f._id === folderId ? { ...f, isPinned: updated.isPinned } : f))
      );
      if (selectedItem?.type === 'folder' && selectedItem?.data?._id === folderId) {
        setSelectedItem((prev) => ({
          ...prev,
          data: { ...prev.data, isPinned: updated.isPinned }
        }));
      }
      window.dispatchEvent(new Event('folder:pinned'));
      window.dispatchEvent(new Event('folder:updated'));
    } catch (err) {
      toast.error(err.response?.data?.message || 'Thao tác ghim thất bại');
    }
  };

  /* ── Kéo thả tệp tin hoặc thư mục vào thư mục với nút Hoàn tác ── */
  const handleFolderDrop = async (e, targetFolder) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverFolderId(null);
    try {
      const raw = e.dataTransfer.getData('application/json');
      if (!raw) return;
      const dragData = JSON.parse(raw);
      if (dragData.id === targetFolder._id) return;

      if (dragData.type === 'file' && dragData.id) {
        const prevId = dragData.parentId || 'root';
        await fileService.moveFile(dragData.id, targetFolder._id);
        toast.success(`Đã di chuyển "${dragData.name}" vào thư mục "${targetFolder.name}"`, {
          action: {
            label: 'Hoàn tác',
            onClick: async () => {
              try {
                await fileService.moveFile(dragData.id, prevId);
                toast.info(`Đã hoàn tác: chuyển "${dragData.name}" về lại vị trí cũ`);
                fetchData();
                window.dispatchEvent(new Event('file:updated'));
                window.dispatchEvent(new Event('drive:refresh'));
              } catch (err) {
                toast.error('Không thể hoàn tác');
              }
            }
          }
        });
        fetchData();
        window.dispatchEvent(new Event('file:updated'));
        window.dispatchEvent(new Event('drive:refresh'));
      } else if (dragData.type === 'folder' && dragData.id) {
        const prevId = dragData.parentId || 'root';
        await folderService.moveFolder(dragData.id, targetFolder._id);
        toast.success(`Đã di chuyển thư mục "${dragData.name}" vào "${targetFolder.name}"`, {
          action: {
            label: 'Hoàn tác',
            onClick: async () => {
              try {
                await folderService.moveFolder(dragData.id, prevId);
                toast.info(`Đã hoàn tác: chuyển "${dragData.name}" về lại vị trí cũ`);
                fetchData();
                window.dispatchEvent(new Event('folder:updated'));
                window.dispatchEvent(new Event('drive:refresh'));
              } catch (err) {
                toast.error('Không thể hoàn tác');
              }
            }
          }
        });
        fetchData();
        window.dispatchEvent(new Event('folder:updated'));
        window.dispatchEvent(new Event('drive:refresh'));
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Di chuyển thất bại');
    }
  };

  /* ── Card Thư mục gần đây (Horizontal Scroll Card) ── */
  const renderRecentFolderCard = (folder) => {
    const isSelected = selectedItem?.type === 'folder' && selectedItem?.data?._id === folder._id;
    const isDragTarget = dragOverFolderId === folder._id;

    return (
      <HomeFolderCard
        key={folder._id}
        folder={folder}
        isSelected={isSelected}
        isDragTarget={isDragTarget}
        onSelect={(f) => setSelectedItem({ type: 'folder', data: f })}
        onOpen={(id) => navigate(`/drive/folder/${id}`)}
        onTogglePin={handleTogglePinFolder}
        onShare={(f) => setShareTarget({ type: 'folder', item: f })}
        onRename={(f) => setRenameTarget({ type: 'folder', item: f })}
        onMove={(f) => setMoveCopyTarget({ type: 'folder', item: f, mode: 'move' })}
        onDelete={(f) => setDeleteTarget({ type: 'folder', item: f })}
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
          e.dataTransfer.dropEffect = 'move';
          if (dragOverFolderId !== folder._id) setDragOverFolderId(folder._id);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (dragOverFolderId === folder._id) setDragOverFolderId(null);
        }}
        onDrop={(e) => handleFolderDrop(e, folder)}
      />
    );
  };

  /* ── Card tệp tin Studio ── */
  const renderFileCard = (file) => {
    const isSelected = selectedItem?.type === 'file' && selectedItem?.data?._id === file._id;
    const isImage = (
      file.mimeType?.startsWith('image/') ||
      ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes((file.extension || '').toLowerCase())
    );

    return (
      <div
        key={file._id}
        className={`file-card ${isSelected ? 'is-selected' : ''}`}
        draggable={true}
        onDragStart={(e) => handleFileDragStart(e, file)}
        onClick={() => setSelectedItem({ type: 'file', data: file })}
        onDoubleClick={() => setPreviewFile(file)}
      >
        <div className="file-card-preview">
          <span className="file-ext-tag">
            .{(file.extension || 'file').toUpperCase()}
          </span>

          {isImage && file._id ? (
            <img
              src={`${import.meta.env.VITE_API_URL || '/api'}/files/${file._id}/preview`}
              alt={file.name}
              className="file-thumbnail"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          ) : (
            <FileIcon mimeType={file.mimeType} extension={file.extension} size={40} />
          )}

          <div className="file-card-actions-hover" onClick={(e) => e.stopPropagation()}>
            <button
              className="btn-icon"
              title={file.isStarred ? 'Bỏ yêu thích' : 'Yêu thích'}
              onClick={() => handleToggleStar(file._id)}
            >
              <Star
                size={14}
                style={{
                  color: file.isStarred ? '#f59e0b' : 'inherit',
                  fill: file.isStarred ? '#f59e0b' : 'none'
                }}
              />
            </button>
            <button className="btn-icon" title="Tải xuống" onClick={() => handleDownloadFile(file)}>
              <Download size={14} />
            </button>
            <button className="btn-icon" title="Xem trước" onClick={() => setPreviewFile(file)}>
              <Eye size={14} />
            </button>
          </div>
        </div>

        <div className="file-card-body">
          <div className="file-card-title" title={file.name}>
            {file.name}
          </div>
          <div className="file-card-meta">
            <span>{file.formattedSize || ''}</span>
            <span>{file.createdAt ? new Date(file.createdAt).toLocaleDateString('vi-VN') : ''}</span>
          </div>
          <div className="file-card-footer">
            {file.aiCategory && file.aiCategory !== 'Chưa phân loại' && (
              <span className="badge badge-purple" title="Phân loại AI">
                <Sparkles size={10} />
                {file.aiCategory}
              </span>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      <main className={`page-body ${isInspectorOpen ? 'has-inspector' : ''}`}>
        <div className="home-page">
          {/* Thanh thao tác ngữ cảnh khi chọn tệp/thư mục (Ảnh 1) */}
          {selectedItem && (
            <ContextualActionBar
              selectedItem={selectedItem}
              onClearSelection={() => setSelectedItem(null)}
              onOpenFolder={(folderId) => navigate(`/drive/folder/${folderId}`)}
              onTogglePinFolder={handleTogglePinFolder}
              onShareItem={(type, item) => setShareTarget({ type, item })}
              onDownloadFile={handleDownloadFile}
              onRenameItem={(type, item) => setRenameTarget({ type, item })}
              onToggleStar={handleToggleStar}
              onPreviewFile={(f) => setPreviewFile(f)}
              onCopyItem={(type, item) => setMoveCopyTarget({ type, item, mode: 'copy' })}
              onMoveItem={(type, item) => setMoveCopyTarget({ type, item, mode: 'move' })}
              onVersionHistory={(f) => setVersionsTarget(f)}
              onDeleteItem={(type, item) => setDeleteTarget({ type, item })}
            />
          )}

          {/* Studio Workspace Header Hero */}

          <div className="home-studio-hero">
            <div>
              <h1 className="home-studio-greeting-title">
                {greeting}, {displayName}
              </h1>
              <p className="home-studio-subtitle">
                Chào mừng bạn trở lại không gian lưu trữ và quản lý tài liệu thông minh.
              </p>
            </div>
            <div className="home-studio-stats">
              <div className="home-stat-chip">
                <TrendingUp size={14} style={{ color: 'var(--primary-600)' }} />
                <span>{recentFiles.length + recentFolders.length} mục gần đây</span>
              </div>
              <div className="home-stat-chip">
                <Star size={14} style={{ color: 'var(--accent-amber)', fill: 'var(--accent-amber)' }} />
                <span>{starredFiles.length} yêu thích</span>
              </div>
            </div>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
              <span className="spinner" style={{ width: 32, height: 32, margin: '0 auto' }} />
              <div style={{ marginTop: '14px', fontSize: '0.835rem' }}>Đang nạp dữ liệu không gian làm việc...</div>
            </div>
          ) : (
            <>
              {/* Thư mục gần đây (Thanh cuộn ngang) */}
              {recentFolders.length > 0 && (
                <div className="home-section">
                  <div className="home-section-header">
                    <div className="home-section-title">
                      <FolderClock size={16} style={{ color: 'var(--primary-600)' }} />
                      <span>Thư mục gần đây</span>
                      <span className="drive-section-count">{recentFolders.length}</span>
                    </div>
                    <div className="home-folders-header-right">
                      <button className="home-view-all-btn" onClick={() => navigate('/drive')}>
                        <span>Xem tất cả</span>
                        <ChevronRight size={14} />
                      </button>
                      <div className="home-folders-nav-controls">
                        <button
                          className="home-scroll-nav-btn"
                          title="Cuộn sang trái"
                          onClick={() => handleScrollFolders('left')}
                        >
                          <ChevronLeft size={16} />
                        </button>
                        <button
                          className="home-scroll-nav-btn"
                          title="Cuộn sang phải"
                          onClick={() => handleScrollFolders('right')}
                        >
                          <ChevronRight size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="home-folders-scroll-viewport">
                    <div className="home-folders-scroll-row" ref={foldersScrollRef}>
                      {recentFolders.map(renderRecentFolderCard)}
                    </div>
                  </div>
                </div>
              )}

              {/* Tệp tin gần đây */}
              {recentFiles.length > 0 && (
                <HomeSection
                  icon={<Upload size={15} style={{ color: 'var(--accent-blue)' }} />}
                  title="Tài liệu gần đây"
                  count={recentFiles.length}
                  onViewAll={() => navigate('/drive')}
                >
                  <div className="file-grid">
                    {recentFiles.map(renderFileCard)}
                  </div>
                </HomeSection>
              )}

              {/* Mục yêu thích */}
              {starredFiles.length > 0 && (
                <HomeSection
                  icon={<Star size={15} style={{ color: 'var(--accent-amber)', fill: 'var(--accent-amber)' }} />}
                  title="Tài liệu yêu thích"
                  count={starredFiles.length}
                  onViewAll={() => navigate('/starred')}
                >
                  <div className="file-grid">
                    {starredFiles.map(renderFileCard)}
                  </div>
                </HomeSection>
              )}
            </>
          )}
        </div>
      </main>

      {/* Studio Right Inspector Panel */}
      <InspectorPanel
        isOpen={isInspectorOpen}
        onClose={() => setIsInspectorOpen(false)}
        selectedItem={selectedItem}
        onOpenFolder={(id) => navigate(`/drive/folder/${id}`)}
        onPreviewFile={(f) => setPreviewFile(f)}
        onDownloadFile={handleDownloadFile}
        onToggleStar={handleToggleStar}
        onShareItem={(type, item) => setShareTarget({ type, item })}
        onRenameItem={(type, item) => setRenameTarget({ type, item })}
        onMoveItem={(type, item) => setMoveCopyTarget({ type, item, mode: 'move' })}
        onCopyItem={(type, item) => setMoveCopyTarget({ type, item, mode: 'copy' })}
        onVersionHistory={(f) => setVersionsTarget(f)}
        onDeleteItem={(type, item) => setDeleteTarget({ type, item })}
      />

      {/* Modals */}
      <FilePreviewModal
        file={previewFile}
        isOpen={Boolean(previewFile)}
        onClose={() => setPreviewFile(null)}
        onDownload={handleDownloadFile}
        onFileUpdated={() => {
          fetchData();
          window.dispatchEvent(new Event('file:updated'));
        }}
      />
      <RenameModal
        isOpen={Boolean(renameTarget)}
        onClose={() => setRenameTarget(null)}
        item={renameTarget?.item}
        itemType={renameTarget?.type}
        onSuccess={() => { fetchData(); window.dispatchEvent(new Event('folder:updated')); }}
      />
      <MoveCopyModal
        isOpen={Boolean(moveCopyTarget)}
        onClose={() => setMoveCopyTarget(null)}
        item={moveCopyTarget?.item}
        itemType={moveCopyTarget?.type}
        mode={moveCopyTarget?.mode}
        onSuccess={() => { fetchData(); window.dispatchEvent(new Event('folder:updated')); }}
      />
      <ShareModal
        isOpen={Boolean(shareTarget)}
        onClose={() => setShareTarget(null)}
        item={shareTarget?.item}
        itemType={shareTarget?.type}
      />
      <FileVersionsModal
        isOpen={Boolean(versionsTarget)}
        onClose={() => setVersionsTarget(null)}
        file={versionsTarget}
        onRestoreSuccess={fetchData}
      />
      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        title={`Chuyển ${deleteTarget?.type === 'folder' ? 'thư mục' : 'tệp tin'} vào thùng rác?`}
        message={`Bạn có chắc muốn chuyển "${deleteTarget?.item?.name}" vào thùng rác?`}
        confirmText="Chuyển vào thùng rác"
        isDanger={true}
        loading={deleting}
      />
    </>
  );
};

export default HomePage;
