import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  Files
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

/* ── Dropdown menu 3 chấm ── */
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
    <div className="home-more-menu" ref={ref} onClick={(e) => e.stopPropagation()}>
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

  const handleFolderDrop = async (e, targetFolder) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverFolderId(null);
    try {
      const raw = e.dataTransfer.getData('application/json');
      if (!raw) return;
      const dragData = JSON.parse(raw);
      if (dragData.type === 'file' && dragData.id) {
        await fileService.moveFile(dragData.id, targetFolder._id);
        toast.success(`Đã di chuyển "${dragData.name}" vào thư mục "${targetFolder.name}"`);
        fetchData();
        window.dispatchEvent(new Event('folder:updated'));
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Di chuyển tệp thất bại');
    }
  };

  /* ── Card Thư mục gần đây (Horizontal Scroll Card) ── */
  const renderRecentFolderCard = (folder) => {
    const isSelected = selectedItem?.type === 'folder' && selectedItem?.data?._id === folder._id;
    const isDragTarget = dragOverFolderId === folder._id;
    const isMenuOpen = activeFolderMenuId === folder._id;

    const folderMenuItems = [
      {
        icon: <FolderOpen size={14} />,
        label: 'Mở thư mục',
        onClick: () => navigate(`/drive/folder/${folder._id}`)
      },
      {
        icon: <Edit2 size={14} />,
        label: 'Đổi tên',
        onClick: () => setRenameTarget({ type: 'folder', item: folder })
      },
      {
        icon: <FolderInput size={14} />,
        label: 'Di chuyển',
        onClick: () => setMoveCopyTarget({ type: 'folder', item: folder, mode: 'move' })
      },
      {
        icon: <Share2 size={14} />,
        label: 'Sao chép',
        onClick: () => setMoveCopyTarget({ type: 'folder', item: folder, mode: 'copy' })
      },
      { divider: true },
      {
        icon: <Trash2 size={14} />,
        label: 'Xóa thư mục',
        danger: true,
        onClick: () => setDeleteTarget({ type: 'folder', item: folder })
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
        key={folder._id}
        className={`home-folder-scroll-card ${isSelected ? 'is-selected' : ''} ${
          isDragTarget ? 'drop-target-active' : ''
        }`}
        onClick={() => setSelectedItem({ type: 'folder', data: folder })}
        onDoubleClick={() => navigate(`/drive/folder/${folder._id}`)}
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

          <div
            className={`home-folder-card-actions ${isMenuOpen ? 'menu-open' : ''}`}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="home-folder-action-btn"
              title="Thao tác"
              onClick={() => setActiveFolderMenuId(isMenuOpen ? null : folder._id)}
            >
              <MoreVertical size={14} />
            </button>
            {isMenuOpen && (
              <MoreMenu
                items={folderMenuItems}
                onClose={() => setActiveFolderMenuId(null)}
              />
            )}
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
