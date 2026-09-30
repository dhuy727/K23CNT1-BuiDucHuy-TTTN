import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutGrid,
  List,
  FolderOpen,
  Tags,
  Pin,
  Clock,
  ChevronLeft,
  ChevronRight,
  Folder,
  MoreVertical,
  Edit2,
  Share2,
  FolderInput,
  Trash2,
  Files,
  Sparkles
} from 'lucide-react';
import Breadcrumb from '../../components/drive/Breadcrumb';
import FileGrid from '../../components/drive/FileGrid';
import FileTable from '../../components/drive/FileTable';
import ContextualActionBar from '../../components/drive/ContextualActionBar';
import EmptyState from '../../components/common/EmptyState';

import CategoryModal from '../../components/drive/CategoryModal';
import AssignCategoryModal from '../../components/drive/AssignCategoryModal';
import categoryService from '../../services/categoryService';

import FilePreviewModal from '../../components/drive/FilePreviewModal';
import RenameModal from '../../components/drive/RenameModal';
import MoveCopyModal from '../../components/drive/MoveCopyModal';
import ShareModal from '../../components/drive/ShareModal';
import FileVersionsModal from '../../components/drive/FileVersionsModal';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import InspectorPanel from '../../components/drive/InspectorPanel';
import folderService from '../../services/folderService';
import fileService from '../../services/fileService';
import aiService from '../../services/aiService';
import { useToast } from '../../contexts/ToastContext';

/* ── Menu 3 chấm thẻ Quick Folder ── */
const QuickFolderMenu = ({ items, onClose }) => {
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

const MyDrivePage = () => {
  const { folderId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();

  const [pendingHighlightId, setPendingHighlightId] = useState(
    () => location.state?.highlightFileId || null
  );

  const [folders, setFolders] = useState([]);
  const [files, setFiles] = useState([]);
  const [breadcrumbs, setBreadcrumbs] = useState([{ _id: 'root', name: 'Drive của tôi' }]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState(() => localStorage.getItem('drive_view_mode') || 'grid');
  const [filterType, setFilterType] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [categoriesList, setCategoriesList] = useState([]);
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState('desc');

  // Quick Access Folders Strip (Đã ghim / Gần đây)
  const [quickTab, setQuickTab] = useState(() => localStorage.getItem('drive_quick_tab') || 'pinned');
  const [pinnedFolders, setPinnedFolders] = useState([]);
  const [recentFolders, setRecentFolders] = useState([]);
  const quickScrollRef = useRef(null);
  const [activeQuickMenuId, setActiveQuickMenuId] = useState(null);
  const [dragOverQuickFolderId, setDragOverQuickFolderId] = useState(null);

  // Studio 3-column Inspector state
  const [selectedItem, setSelectedItem] = useState(null);
  const [isInspectorOpen, setIsInspectorOpen] = useState(false);

  // Modals state
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [assignCategoryTarget, setAssignCategoryTarget] = useState(null);
  const [previewFile, setPreviewFile] = useState(null);
  const [renameTarget, setRenameTarget] = useState(null);
  const [moveCopyTarget, setMoveCopyTarget] = useState(null);
  const [shareTarget, setShareTarget] = useState(null);
  const [versionsTarget, setVersionsTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const loadCategories = useCallback(async () => {
    try {
      const res = await categoryService.getCategories();
      setCategoriesList(res.data || []);
    } catch (e) {
      console.error('Lỗi tải danh mục:', e);
    }
  }, []);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  const fetchDriveContent = useCallback(async () => {
    setLoading(true);
    try {
      const currentId = folderId || 'root';

      // 1. Lấy breadcrumbs & chi tiết nếu ở trong subfolder
      if (folderId) {
        try {
          const detailRes = await folderService.getFolderById(folderId);
          const bList = detailRes.metadata?.breadcrumb || detailRes.data?.breadcrumb;
          if (bList && bList.length > 0) {
            setBreadcrumbs(bList);
          } else if (detailRes.data?.name) {
            setBreadcrumbs([
              { _id: 'root', name: 'Drive của tôi' },
              { _id: detailRes.data._id, name: detailRes.data.name }
            ]);
          }
        } catch (e) {
          console.error('Không tìm thấy thư mục con:', e);
        }
      } else {
        setBreadcrumbs([{ _id: 'root', name: 'Drive của tôi' }]);
      }

      // 2. Lấy danh sách thư mục con, thư mục đã ghim và thư mục gần đây song song
      const [folderRes, fileRes, pinnedRes, recentRes] = await Promise.allSettled([
        folderService.getFolders({ parentId: currentId }),
        fileService.getFiles({
          folderId: currentId,
          type: filterType || undefined,
          category: filterCategory || undefined,
          sortBy,
          sortOrder
        }),
        folderService.getFolders({ isPinned: true, sortBy: 'updatedAt', sortOrder: 'desc' }),
        folderService.getFolders({ sortBy: 'updatedAt', sortOrder: 'desc', limit: 10 })
      ]);

      if (folderRes.status === 'fulfilled') {
        const raw = folderRes.value.data;
        const list = Array.isArray(raw) ? raw : (raw?.folders || raw?.data || []);
        setFolders(list);
      }
      if (fileRes.status === 'fulfilled') {
        setFiles(fileRes.value.data || []);
      }
      if (pinnedRes.status === 'fulfilled') {
        const raw = pinnedRes.value.data;
        const list = Array.isArray(raw) ? raw : (raw?.folders || raw?.data || []);
        setPinnedFolders(list);
      }
      if (recentRes.status === 'fulfilled') {
        const raw = recentRes.value.data;
        const list = Array.isArray(raw) ? raw : (raw?.folders || raw?.data || []);
        setRecentFolders(list.slice(0, 10));
      }
    } catch (err) {
      console.error('Lỗi khi tải dữ liệu Drive:', err);
      toast.error('Không thể tải dữ liệu thư mục');
    } finally {
      setLoading(false);
    }
  }, [folderId, filterType, filterCategory, sortBy, sortOrder]);

  const handleTogglePinFolder = async (targetFolderId) => {
    try {
      const res = await folderService.togglePinFolder(targetFolderId);
      const updated = res.data;
      toast.success(
        updated.isPinned
          ? `Đã ghim thư mục "${updated.name}" lên lối tắt`
          : `Đã bỏ ghim thư mục "${updated.name}"`
      );
      fetchDriveContent();
      window.dispatchEvent(new Event('folder:pinned'));
      window.dispatchEvent(new Event('folder:updated'));
      if (selectedItem?.type === 'folder' && selectedItem?.data?._id === targetFolderId) {
        setSelectedItem((prev) => ({
          ...prev,
          data: { ...prev.data, isPinned: updated.isPinned }
        }));
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Thao tác ghim thất bại');
    }
  };

  const handleScrollQuick = (direction) => {
    if (quickScrollRef.current) {
      const offset = direction === 'left' ? -220 : 220;
      quickScrollRef.current.scrollBy({ left: offset, behavior: 'smooth' });
    }
  };

  const handleQuickTabChange = (tab) => {
    setQuickTab(tab);
    localStorage.setItem('drive_quick_tab', tab);
  };

  const handleQuickFolderDrop = async (e, targetFolder) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverQuickFolderId(null);
    try {
      const raw = e.dataTransfer.getData('application/json');
      if (!raw) return;
      const dragData = JSON.parse(raw);
      if (dragData.id === targetFolder._id) return;
      if (dragData.type === 'file') {
        await fileService.moveFile(dragData.id, targetFolder._id);
        toast.success(`Đã di chuyển "${dragData.name}" vào thư mục "${targetFolder.name}"`);
      } else if (dragData.type === 'folder') {
        await folderService.moveFolder(dragData.id, targetFolder._id);
        toast.success(`Đã di chuyển thư mục "${dragData.name}" vào "${targetFolder.name}"`);
      }
      fetchDriveContent();
      window.dispatchEvent(new Event('folder:updated'));
    } catch (err) {
      toast.error(err.response?.data?.message || 'Di chuyển thất bại');
    }
  };

  useEffect(() => {
    fetchDriveContent();
    setSelectedItem(null);

    const handleRefresh = () => fetchDriveContent();
    window.addEventListener('drive:refresh', handleRefresh);
    return () => window.removeEventListener('drive:refresh', handleRefresh);
  }, [fetchDriveContent]);

  // Polling tự động khi có tệp tin đang ở trạng thái pending hoặc processing
  useEffect(() => {
    const hasPending = files.some(
      (f) => f.aiStatus === 'pending' || f.aiStatus === 'processing'
    );
    if (!hasPending) return;

    const timer = setInterval(() => {
      fetchDriveContent();
    }, 3000);

    return () => clearInterval(timer);
  }, [files, fetchDriveContent]);

  const handleRetryAi = async (fileId) => {
    try {
      await aiService.processFile(fileId);
      toast.success('Đã đưa tệp tin vào hàng đợi phân tích lại AI');
      fetchDriveContent();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Không thể phân tích lại AI');
    }
  };

  // Toggle Inspector global event
  useEffect(() => {
    const handleToggle = () => setIsInspectorOpen((prev) => !prev);
    window.addEventListener('drive:toggle-inspector', handleToggle);
    return () => window.removeEventListener('drive:toggle-inspector', handleToggle);
  }, []);

  // Đồng bộ pendingHighlightId khi location.state thay đổi
  useEffect(() => {
    if (location.state?.highlightFileId) {
      setPendingHighlightId(location.state.highlightFileId);
    }
  }, [location.state?.highlightFileId]);

  // Lắng nghe sự kiện chọn tệp từ Menu thông báo hoặc các thành phần khác
  useEffect(() => {
    const handleSelectFile = (e) => {
      const fileId = e.detail?.fileId;
      if (!fileId) return;
      setPendingHighlightId(fileId);
    };
    window.addEventListener('drive:select-file', handleSelectFile);
    return () => window.removeEventListener('drive:select-file', handleSelectFile);
  }, []);

  // Tự động tìm, làm nổi bật, cuộn tới tệp và mở Inspector khi files được tải xong
  useEffect(() => {
    if (!loading && pendingHighlightId && files.length > 0) {
      const target = files.find((f) => String(f._id) === String(pendingHighlightId));
      if (target) {
        setSelectedItem({ type: 'file', data: target });
        setIsInspectorOpen(true);
        setPendingHighlightId(null);

        // Cuộn mượt mà đến tệp và áp dụng hiệu ứng nổi bật (pulse)
        setTimeout(() => {
          const el = document.querySelector(`[data-file-id="${target._id}"]`);
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            el.classList.add('file-highlight-pulse');
            setTimeout(() => {
              el.classList.remove('file-highlight-pulse');
            }, 3000);
          }
        }, 150);

        // Xóa highlightFileId khỏi location state để tránh kích hoạt lại ngoài ý muốn
        try {
          window.history.replaceState({}, document.title);
        } catch (_) {}
      }
    }
  }, [files, loading, pendingHighlightId]);

  // Keyboard Escape listener to clear selection
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setSelectedItem(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleToggleView = (mode) => {
    setViewMode(mode);
    localStorage.setItem('drive_view_mode', mode);
  };

  const handleOpenFolder = (id) => {
    setSelectedItem(null);
    if (id && id !== 'root') {
      navigate(`/drive/folder/${id}`);
    } else {
      navigate('/drive');
    }
  };

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
    } catch (err) {
      console.error('Tải file thất bại:', err);
      toast.error('Không thể tải tệp tin');
    }
  };

  const handleToggleStar = async (fileId) => {
    try {
      const res = await fileService.toggleStar(fileId);
      const updated = res.data;
      setFiles((prev) =>
        prev.map((f) => (f._id === fileId ? { ...f, isStarred: updated.isStarred } : f))
      );
      if (selectedItem?.type === 'file' && selectedItem?.data?._id === fileId) {
        setSelectedItem((prev) => ({
          ...prev,
          data: { ...prev.data, isStarred: updated.isStarred }
        }));
      }
      toast.success(
        updated.isStarred ? 'Đã thêm vào mục yêu thích' : 'Đã bỏ khỏi mục yêu thích'
      );
    } catch (err) {
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
      fetchDriveContent();
      window.dispatchEvent(new Event('folder:updated'));
    } catch (err) {
      toast.error(err.response?.data?.message || 'Xóa thất bại');
    } finally {
      setDeleting(false);
    }
  };

  const handleDirectDrop = async (sourceItem, targetFolder) => {
    try {
      if (sourceItem.type === 'file') {
        await fileService.moveFile(sourceItem.id, targetFolder._id);
        toast.success(`Đã chuyển tệp "${sourceItem.name}" vào "${targetFolder.name}"`);
      } else if (sourceItem.type === 'folder') {
        if (sourceItem.id === targetFolder._id) return;
        await folderService.moveFolder(sourceItem.id, targetFolder._id);
        toast.success(`Đã chuyển thư mục "${sourceItem.name}" vào "${targetFolder.name}"`);
      }
      fetchDriveContent();
      window.dispatchEvent(new Event('folder:updated'));
    } catch (err) {
      toast.error(err.response?.data?.message || 'Không thể di chuyển đến thư mục này');
    }
  };

  /* ── Render thẻ thư mục trong Quick Access Strip ── */
  const renderQuickFolderCard = (folder) => {
    const isSelected = selectedItem?.type === 'folder' && selectedItem?.data?._id === folder._id;
    const isDragTarget = dragOverQuickFolderId === folder._id;
    const isMenuOpen = activeQuickMenuId === folder._id;

    const quickMenuItems = [
      {
        icon: <FolderOpen size={14} />,
        label: 'Mở thư mục',
        onClick: () => handleOpenFolder(folder._id)
      },
      {
        icon: <Pin size={14} style={{ color: folder.isPinned ? '#f59e0b' : 'inherit' }} />,
        label: folder.isPinned ? 'Bỏ ghim thư mục' : 'Ghim thư mục',
        onClick: () => handleTogglePinFolder(folder._id)
      },
      {
        icon: <Share2 size={14} />,
        label: 'Chia sẻ',
        onClick: () => setShareTarget({ type: 'folder', item: folder })
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
      { divider: true },
      {
        icon: <Trash2 size={14} />,
        label: 'Xóa vào thùng rác',
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
        key={`quick-${folder._id}`}
        className={`home-folder-scroll-card ${isSelected ? 'is-selected' : ''} ${
          isDragTarget ? 'drop-target-active' : ''
        }`}
        onClick={() => setSelectedItem({ type: 'folder', data: folder })}
        onDoubleClick={() => handleOpenFolder(folder._id)}
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
          e.dataTransfer.dropEffect = 'move';
          if (dragOverQuickFolderId !== folder._id) setDragOverQuickFolderId(folder._id);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (dragOverQuickFolderId === folder._id) setDragOverQuickFolderId(null);
        }}
        onDrop={(e) => handleQuickFolderDrop(e, folder)}
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

          <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }} onClick={(e) => e.stopPropagation()}>
            <button
              className={`home-folder-action-btn ${folder.isPinned ? 'is-pinned' : ''}`}
              title={folder.isPinned ? 'Bỏ ghim' : 'Ghim lên lối tắt'}
              onClick={(e) => {
                e.stopPropagation();
                handleTogglePinFolder(folder._id);
              }}
            >
              <Pin
                size={13}
                style={{
                  color: folder.isPinned ? 'var(--accent-amber, #f59e0b)' : 'inherit',
                  fill: folder.isPinned ? 'var(--accent-amber, #f59e0b)' : 'none',
                  opacity: folder.isPinned ? 1 : 0.6
                }}
              />
            </button>
            <div className={`home-folder-card-actions ${isMenuOpen ? 'menu-open' : ''}`}>
              <button
                className="home-folder-action-btn"
                title="Thao tác"
                onClick={() => setActiveQuickMenuId(isMenuOpen ? null : folder._id)}
              >
                <MoreVertical size={14} />
              </button>
              {isMenuOpen && (
                <QuickFolderMenu
                  items={quickMenuItems}
                  onClose={() => setActiveQuickMenuId(null)}
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

  const isEmpty = folders.length === 0 && files.length === 0;

  return (
    <>
      <main className={`page-body ${isInspectorOpen ? 'has-inspector' : ''}`}>
        {/* Top Action Bar */}
        <div className="drive-action-bar">
          <Breadcrumb breadcrumbs={breadcrumbs} onSelectFolder={handleOpenFolder} />

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {/* Lọc loại tệp */}
            <select
              className="form-select"
              style={{ width: '130px', padding: '5px 8px', fontSize: '0.8rem' }}
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
            >
              <option value="">Tất cả loại tệp</option>
              <option value="image">Hình ảnh</option>
              <option value="document">Tài liệu</option>
              <option value="video">Video</option>
              <option value="audio">Âm thanh</option>
              <option value="archive">Tệp nén (ZIP)</option>
            </select>

            {/* Lọc theo danh mục */}
            <select
              className="form-select"
              style={{ width: '145px', padding: '5px 8px', fontSize: '0.8rem' }}
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
            >
              <option value="">Tất cả danh mục</option>
              {categoriesList.map((cat) => (
                <option key={cat._id} value={cat.name}>
                  {cat.name} {cat.fileCount !== undefined ? `(${cat.fileCount})` : ''}
                </option>
              ))}
            </select>

            {/* Quản lý danh mục */}
            <button
              type="button"
              className="btn btn-outline-secondary"
              style={{
                padding: '5px 10px',
                fontSize: '0.8rem',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                borderRadius: 'var(--border-radius-sm, 6px)',
                border: '1px solid var(--border-color)',
                background: 'var(--surface-color)',
                color: 'var(--text-main)',
                cursor: 'pointer'
              }}
              onClick={() => setIsCategoryModalOpen(true)}
              title="Quản lý danh mục tài liệu"
            >
              <Tags size={15} style={{ color: 'var(--primary-color)' }} />
              <span>Danh mục</span>
            </button>

            {/* Sắp xếp */}
            <select
              className="form-select"
              style={{ width: '130px', padding: '5px 8px', fontSize: '0.8rem' }}
              value={`${sortBy}-${sortOrder}`}
              onChange={(e) => {
                const [sb, so] = e.target.value.split('-');
                setSortBy(sb);
                setSortOrder(so);
              }}
            >
              <option value="createdAt-desc">Mới nhất</option>
              <option value="createdAt-asc">Cũ nhất</option>
              <option value="name-asc">Tên (A-Z)</option>
              <option value="name-desc">Tên (Z-A)</option>
              <option value="size-desc">Dung lượng lớn</option>
              <option value="size-asc">Dung lượng nhỏ</option>
            </select>

            {/* Chuyển đổi Grid / List View */}
            <div className="view-toggle-group">
              <button
                className={`view-toggle-btn ${viewMode === 'grid' ? 'active' : ''}`}
                onClick={() => handleToggleView('grid')}
                title="Chế độ Lưới"
              >
                <LayoutGrid size={16} />
              </button>
              <button
                className={`view-toggle-btn ${viewMode === 'table' ? 'active' : ''}`}
                onClick={() => handleToggleView('table')}
                title="Chế độ Danh sách"
              >
                <List size={16} />
              </button>
            </div>
          </div>
        </div>

        {/* Thanh thao tác ngữ cảnh khi chọn tệp/thư mục */}
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
            onAssignCategory={(item) => setAssignCategoryTarget(item)}
            onTogglePinFolder={handleTogglePinFolder}
          />
        )}

        {/* Dải Truy cập nhanh (Quick Access Folders Strip: Đã ghim & Gần đây) */}
        {(pinnedFolders.length > 0 || recentFolders.length > 0) && (
          <div className="drive-quick-folders-section">
            <div className="drive-quick-header">
              <div className="drive-quick-tabs">
                <button
                  type="button"
                  className={`drive-quick-tab-btn ${quickTab === 'pinned' ? 'active' : ''}`}
                  onClick={() => handleQuickTabChange('pinned')}
                >
                  <Pin size={13} />
                  <span>Đã ghim</span>
                  <span className="drive-quick-count">{pinnedFolders.length}</span>
                </button>
                <button
                  type="button"
                  className={`drive-quick-tab-btn ${quickTab === 'recent' ? 'active' : ''}`}
                  onClick={() => handleQuickTabChange('recent')}
                >
                  <Clock size={13} />
                  <span>Gần đây</span>
                  <span className="drive-quick-count">{recentFolders.length}</span>
                </button>
              </div>

              <div className="home-folders-nav-controls">
                <button
                  className="home-scroll-nav-btn"
                  title="Cuộn sang trái"
                  onClick={() => handleScrollQuick('left')}
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  className="home-scroll-nav-btn"
                  title="Cuộn sang phải"
                  onClick={() => handleScrollQuick('right')}
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>

            <div className="home-folders-scroll-viewport">
              <div className="home-folders-scroll-row" ref={quickScrollRef}>
                {quickTab === 'pinned' ? (
                  pinnedFolders.length === 0 ? (
                    <div className="drive-quick-empty-hint">
                      <Pin size={16} style={{ color: 'var(--text-muted)' }} />
                      <span>Bạn chưa ghim thư mục nào. Nhấn biểu tượng 📌 trên bất kỳ thư mục nào để ghim lên lối tắt nhanh tại đây.</span>
                    </div>
                  ) : (
                    pinnedFolders.map(renderQuickFolderCard)
                  )
                ) : (
                  recentFolders.length === 0 ? (
                    <div className="drive-quick-empty-hint">
                      <Clock size={16} style={{ color: 'var(--text-muted)' }} />
                      <span>Chưa có thư mục nào gần đây</span>
                    </div>
                  ) : (
                    recentFolders.map(renderQuickFolderCard)
                  )
                )}
              </div>
            </div>
          </div>
        )}

        {/* Content */}

        {loading ? (
          <div style={{ textAlign: 'center', padding: '80px 20px', color: 'var(--text-muted)' }}>
            <span className="spinner" style={{ width: 32, height: 32, margin: '0 auto' }} />
            <div style={{ marginTop: '14px', fontSize: '0.835rem' }}>Đang tải nội dung Drive...</div>
          </div>
        ) : isEmpty ? (
          <EmptyState
            icon={FolderOpen}
            title="Thư mục trống"
            description="Chưa có tệp tin hoặc thư mục nào ở vị trí này. Bạn có thể nhấn nút Tạo mới để bắt đầu."
          />
        ) : viewMode === 'grid' ? (
          <FileGrid
            folders={folders}
            files={files}
            selectedItem={selectedItem}
            onSelectItem={setSelectedItem}
            onOpenFolder={handleOpenFolder}
            onPreviewFile={(f) => setPreviewFile(f)}
            onDownloadFile={handleDownloadFile}
            onToggleStar={handleToggleStar}
            onShareItem={(type, item) => setShareTarget({ type, item })}
            onRenameItem={(type, item) => setRenameTarget({ type, item })}
            onMoveItem={(type, item) => setMoveCopyTarget({ type, item, mode: 'move' })}
            onCopyItem={(type, item) => setMoveCopyTarget({ type, item, mode: 'copy' })}
            onVersionHistory={(f) => setVersionsTarget(f)}
            onDeleteItem={(type, item) => setDeleteTarget({ type, item })}
            onRetryAi={handleRetryAi}
            onDirectDrop={handleDirectDrop}
            onTogglePinFolder={handleTogglePinFolder}
          />
        ) : (
          <FileTable
            folders={folders}
            files={files}
            selectedItem={selectedItem}
            onSelectItem={setSelectedItem}
            onOpenFolder={handleOpenFolder}
            onPreviewFile={(f) => setPreviewFile(f)}
            onDownloadFile={handleDownloadFile}
            onToggleStar={handleToggleStar}
            onShareItem={(type, item) => setShareTarget({ type, item })}
            onRenameItem={(type, item) => setRenameTarget({ type, item })}
            onMoveItem={(type, item) => setMoveCopyTarget({ type, item, mode: 'move' })}
            onCopyItem={(type, item) => setMoveCopyTarget({ type, item, mode: 'copy' })}
            onVersionHistory={(f) => setVersionsTarget(f)}
            onDeleteItem={(type, item) => setDeleteTarget({ type, item })}
            onRetryAi={handleRetryAi}
            onDirectDrop={handleDirectDrop}
            onTogglePinFolder={handleTogglePinFolder}
          />
        )}
      </main>

      {/* Studio Right Inspector Panel (Column 3) */}
      <InspectorPanel
        isOpen={isInspectorOpen}
        onClose={() => setIsInspectorOpen(false)}
        selectedItem={selectedItem}
        onOpenFolder={handleOpenFolder}
        onPreviewFile={(f) => setPreviewFile(f)}
        onDownloadFile={handleDownloadFile}
        onToggleStar={handleToggleStar}
        onShareItem={(type, item) => setShareTarget({ type, item })}
        onRenameItem={(type, item) => setRenameTarget({ type, item })}
        onMoveItem={(type, item) => setMoveCopyTarget({ type, item, mode: 'move' })}
        onCopyItem={(type, item) => setMoveCopyTarget({ type, item, mode: 'copy' })}
        onVersionHistory={(f) => setVersionsTarget(f)}
        onDeleteItem={(type, item) => setDeleteTarget({ type, item })}
        onAssignCategory={(item) => setAssignCategoryTarget(item)}
        onTogglePinFolder={handleTogglePinFolder}
      />

      {/* Modals */}
      <CategoryModal
        isOpen={isCategoryModalOpen}
        onClose={() => {
          setIsCategoryModalOpen(false);
          loadCategories();
          fetchDriveContent();
        }}
        onCategoriesChanged={() => {
          loadCategories();
          fetchDriveContent();
        }}
      />

      <AssignCategoryModal
        isOpen={Boolean(assignCategoryTarget)}
        onClose={() => setAssignCategoryTarget(null)}
        file={assignCategoryTarget}
        onSuccess={(updatedFile) => {
          fetchDriveContent();
          loadCategories();
          if (selectedItem?.type === 'file' && selectedItem?.data?._id === updatedFile._id) {
            setSelectedItem((prev) => ({
              ...prev,
              data: { ...prev.data, aiCategory: updatedFile.aiCategory }
            }));
          }
        }}
      />

      <FilePreviewModal
        file={previewFile}
        isOpen={Boolean(previewFile)}
        onClose={() => setPreviewFile(null)}
        onDownload={handleDownloadFile}
        onFileUpdated={() => {
          fetchDriveContent();
          window.dispatchEvent(new Event('file:updated'));
        }}
      />

      <RenameModal
        isOpen={Boolean(renameTarget)}
        onClose={() => setRenameTarget(null)}
        item={renameTarget?.item}
        itemType={renameTarget?.type}
        onSuccess={() => {
          fetchDriveContent();
          window.dispatchEvent(new Event('folder:updated'));
        }}
      />

      <MoveCopyModal
        isOpen={Boolean(moveCopyTarget)}
        onClose={() => setMoveCopyTarget(null)}
        item={moveCopyTarget?.item}
        itemType={moveCopyTarget?.type}
        mode={moveCopyTarget?.mode}
        onSuccess={() => {
          fetchDriveContent();
          window.dispatchEvent(new Event('folder:updated'));
        }}
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
        onRestoreSuccess={fetchDriveContent}
      />

      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        title={`Chuyển ${deleteTarget?.type === 'folder' ? 'thư mục' : 'tệp tin'} vào thùng rác?`}
        message={`Bạn có chắc chắn muốn chuyển "${deleteTarget?.item?.name}" vào thùng rác? Bạn có thể khôi phục lại bất kỳ lúc nào trong trang Thùng rác.`}
        confirmText="Chuyển vào thùng rác"
        isDanger={true}
        loading={deleting}
      />
    </>
  );
};

export default MyDrivePage;
