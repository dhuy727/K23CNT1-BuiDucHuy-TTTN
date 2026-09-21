import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Clock,
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
  Sparkles,
  ChevronRight,
  TrendingUp
} from 'lucide-react';
import FileIcon from '../../components/drive/FileIcon';
import FilePreviewModal from '../../components/drive/FilePreviewModal';
import RenameModal from '../../components/drive/RenameModal';
import MoveCopyModal from '../../components/drive/MoveCopyModal';
import ShareModal from '../../components/drive/ShareModal';
import FileVersionsModal from '../../components/drive/FileVersionsModal';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import fileService from '../../services/fileService';
import folderService from '../../services/folderService';
import { useToast } from '../../contexts/ToastContext';
import { useAuth } from '../../contexts/AuthContext';

/* ─────────────────────────────────────────────────────── */
/* Dropdown menu 3 chấm                                     */
/* ─────────────────────────────────────────────────────── */
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

/* ─────────────────────────────────────────────────────── */
/* Card cho file đề xuất                                    */
/* ─────────────────────────────────────────────────────── */
const HomeFileCard = ({
  file,
  onPreview,
  onDownload,
  onToggleStar,
  onShare,
  onRename,
  onMove,
  onVersionHistory,
  onDelete
}) => {
  const [menuOpen, setMenuOpen] = useState(false);

  const formatSize = (bytes) => {
    if (!bytes && bytes !== 0) return '';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(Math.max(bytes, 1)) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now - d;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffMins < 1) return 'Vừa xong';
    if (diffMins < 60) return `${diffMins} phút trước`;
    if (diffHours < 24) return `${diffHours} giờ trước`;
    if (diffDays < 7) return `${diffDays} ngày trước`;
    return d.toLocaleDateString('vi-VN');
  };

  const moreMenuItems = [
    { icon: <Share2 size={14} />, label: 'Chia sẻ', onClick: () => onShare && onShare('file', file) },
    { icon: <Edit2 size={14} />, label: 'Đổi tên', onClick: () => onRename && onRename('file', file) },
    { icon: <FolderInput size={14} />, label: 'Di chuyển', onClick: () => onMove && onMove('file', file) },
    { icon: <History size={14} />, label: 'Lịch sử phiên bản', onClick: () => onVersionHistory && onVersionHistory(file) },
    { divider: true },
    { icon: <Trash2 size={14} />, label: 'Xóa vào thùng rác', danger: true, onClick: () => onDelete && onDelete('file', file) }
  ];

  return (
    <div className="home-file-card" onClick={() => onPreview && onPreview(file)}>
      {/* Preview area */}
      <div className="home-file-preview">
        <FileIcon mimeType={file.mimeType} extension={file.extension} size={40} />

        {/* Hover quick actions - hiển thị khi hover */}
        <div className="home-file-hover-actions" onClick={(e) => e.stopPropagation()}>
          <button
            className="btn-icon home-quick-btn"
            title={file.isStarred ? 'Bỏ yêu thích' : 'Yêu thích'}
            onClick={() => onToggleStar && onToggleStar(file._id)}
          >
            <Star
              size={15}
              style={{ color: file.isStarred ? '#f59e0b' : 'inherit', fill: file.isStarred ? '#f59e0b' : 'none' }}
            />
          </button>
          <button
            className="btn-icon home-quick-btn"
            title="Xem trước"
            onClick={() => onPreview && onPreview(file)}
          >
            <Eye size={15} />
          </button>
          <button
            className="btn-icon home-quick-btn"
            title="Tải xuống"
            onClick={() => onDownload && onDownload(file)}
          >
            <Download size={15} />
          </button>
        </div>
      </div>

      {/* Info */}
      <div className="home-file-info">
        <div className="home-file-name" title={file.name}>{file.name}</div>
        <div className="home-file-meta">
          <span>{formatSize(file.size)}</span>
          <span>{formatDate(file.createdAt)}</span>
        </div>

        {/* Footer: badge + 3 chấm */}
        <div className="home-file-footer" onClick={(e) => e.stopPropagation()}>
          {file.aiCategory && file.aiCategory !== 'Chưa phân loại' ? (
            <span className="badge badge-purple" title="Phân loại AI">
              <Sparkles size={10} />
              {file.aiCategory}
            </span>
          ) : (
            <span className="badge badge-slate">{(file.extension || 'file').toUpperCase()}</span>
          )}

          <div style={{ position: 'relative' }}>
            <button
              className="btn-icon home-quick-btn"
              title="Thêm thao tác"
              onClick={(e) => { e.stopPropagation(); setMenuOpen((v) => !v); }}
            >
              <MoreVertical size={15} />
            </button>
            {menuOpen && <MoreMenu items={moreMenuItems} onClose={() => setMenuOpen(false)} />}
          </div>
        </div>
      </div>
    </div>
  );
};

/* ─────────────────────────────────────────────────────── */
/* Card cho thư mục đề xuất                                 */
/* ─────────────────────────────────────────────────────── */
const HomeFolderCard = ({ folder, onOpen, onShare, onRename, onDelete }) => {
  const [menuOpen, setMenuOpen] = useState(false);

  const moreMenuItems = [
    { icon: <Share2 size={14} />, label: 'Chia sẻ', onClick: () => onShare && onShare('folder', folder) },
    { icon: <Edit2 size={14} />, label: 'Đổi tên', onClick: () => onRename && onRename('folder', folder) },
    { divider: true },
    { icon: <Trash2 size={14} />, label: 'Xóa vào thùng rác', danger: true, onClick: () => onDelete && onDelete('folder', folder) }
  ];

  return (
    <div className="home-folder-card" onClick={() => onOpen && onOpen(folder._id)}>
      <div className="home-folder-icon">
        <Folder
          size={28}
          style={{ color: folder.color || '#3b82f6', fill: folder.color ? `${folder.color}22` : '#3b82f622' }}
        />
      </div>
      <div className="home-folder-name" title={folder.name}>{folder.name}</div>
      <div className="home-folder-more" onClick={(e) => e.stopPropagation()}>
        <button
          className="btn-icon home-quick-btn"
          title="Thêm thao tác"
          onClick={(e) => { e.stopPropagation(); setMenuOpen((v) => !v); }}
        >
          <MoreVertical size={14} />
        </button>
        {menuOpen && <MoreMenu items={moreMenuItems} onClose={() => setMenuOpen(false)} />}
      </div>
    </div>
  );
};

/* ─────────────────────────────────────────────────────── */
/* Section wrapper                                          */
/* ─────────────────────────────────────────────────────── */
const HomeSection = ({ icon, title, onViewAll, children, emptyText }) => (
  <section className="home-section">
    <div className="home-section-header">
      <div className="home-section-title">
        {icon}
        <span>{title}</span>
      </div>
      {onViewAll && (
        <button className="home-view-all-btn" onClick={onViewAll}>
          Xem tất cả <ChevronRight size={14} />
        </button>
      )}
    </div>
    <div className="home-section-body">
      {React.Children.count(children) === 0 ? (
        <div className="home-empty-hint">{emptyText || 'Chưa có dữ liệu'}</div>
      ) : (
        children
      )}
    </div>
  </section>
);

/* ─────────────────────────────────────────────────────── */
/* Trang chính: HomePage                                    */
/* ─────────────────────────────────────────────────────── */
const HomePage = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = useAuth();

  const [recentFiles, setRecentFiles] = useState([]);
  const [starredFiles, setStarredFiles] = useState([]);
  const [recentFolders, setRecentFolders] = useState([]);
  const [loading, setLoading] = useState(true);

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
        folderService.getFolders({ parentId: 'root' })
      ]);

      if (recentRes.status === 'fulfilled') {
        setRecentFiles((recentRes.value.data || []).slice(0, 12));
      }
      if (starredRes.status === 'fulfilled') {
        setStarredFiles((starredRes.value.data || []).slice(0, 8));
      }
      if (folderRes.status === 'fulfilled') {
        setRecentFolders((folderRes.value.data?.folders || []).slice(0, 8));
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

  /* ── Handlers ── */
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
      fetchData();
      window.dispatchEvent(new Event('folder:updated'));
    } catch (err) {
      toast.error(err.response?.data?.message || 'Xóa thất bại');
    } finally {
      setDeleting(false);
    }
  };

  const commonFileProps = {
    onPreview: (f) => setPreviewFile(f),
    onDownload: handleDownloadFile,
    onToggleStar: handleToggleStar,
    onShare: (type, item) => setShareTarget({ type, item }),
    onRename: (type, item) => setRenameTarget({ type, item }),
    onMove: (type, item) => setMoveCopyTarget({ type, item, mode: 'move' }),
    onVersionHistory: (f) => setVersionsTarget(f),
    onDelete: (type, item) => setDeleteTarget({ type, item })
  };

  const commonFolderProps = {
    onOpen: (id) => navigate(`/drive/folder/${id}`),
    onShare: (type, item) => setShareTarget({ type, item }),
    onRename: (type, item) => setRenameTarget({ type, item }),
    onDelete: (type, item) => setDeleteTarget({ type, item })
  };

  /* ── Greeting ── */
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? 'Chào buổi sáng' : hour < 18 ? 'Chào buổi chiều' : 'Chào buổi tối';
  const firstName = user?.fullName?.split(' ').pop() || user?.email || '';

  return (
    <div className="home-page">
      {/* Hero greeting */}
      <div className="home-hero">
        <div className="home-hero-text">
          <h1 className="home-greeting">
            {greeting}, <span className="home-greeting-name">{firstName}</span> 👋
          </h1>
          <p className="home-subtitle">
            Đây là những file và thư mục được đề xuất cho bạn hôm nay.
          </p>
        </div>
        <div className="home-hero-stat">
          <TrendingUp size={18} />
          <span>{recentFiles.length + recentFolders.length} mục trong Drive</span>
        </div>
      </div>

      {loading ? (
        <div className="home-loading">
          <span className="spinner" style={{ width: 36, height: 36 }} />
          <div style={{ marginTop: 16, fontSize: '0.875rem', color: 'var(--text-muted)' }}>
            Đang tải dữ liệu trang chủ...
          </div>
        </div>
      ) : (
        <>
          {/* Section: Thư mục của bạn */}
          {recentFolders.length > 0 && (
            <HomeSection
              icon={<Folder size={16} />}
              title="Thư mục của bạn"
              onViewAll={() => navigate('/drive')}
              emptyText="Chưa có thư mục nào"
            >
              <div className="home-folder-grid">
                {recentFolders.map((folder) => (
                  <HomeFolderCard key={folder._id} folder={folder} {...commonFolderProps} />
                ))}
              </div>
            </HomeSection>
          )}

          {/* Section: Upload gần đây */}
          <HomeSection
            icon={<Upload size={16} />}
            title="Upload gần đây"
            onViewAll={() => navigate('/drive')}
            emptyText="Chưa có tệp nào được tải lên. Hãy thử upload file đầu tiên!"
          >
            <div className="home-file-grid">
              {recentFiles.map((file) => (
                <HomeFileCard key={file._id} file={file} {...commonFileProps} />
              ))}
            </div>
          </HomeSection>

          {/* Section: Yêu thích */}
          {starredFiles.length > 0 && (
            <HomeSection
              icon={<Star size={16} />}
              title="Yêu thích"
              onViewAll={() => navigate('/starred')}
              emptyText="Chưa có tệp nào được đánh dấu yêu thích"
            >
              <div className="home-file-grid">
                {starredFiles.map((file) => (
                  <HomeFileCard key={file._id} file={file} {...commonFileProps} />
                ))}
              </div>
            </HomeSection>
          )}
        </>
      )}

      {/* ── Modals ── */}
      <FilePreviewModal
        file={previewFile}
        isOpen={Boolean(previewFile)}
        onClose={() => setPreviewFile(null)}
        onDownload={handleDownloadFile}
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
    </div>
  );
};

export default HomePage;
