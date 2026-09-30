import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutGrid,
  List,
  FolderOpen,
  Tags
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

      // 2. Lấy danh sách thư mục con
      const folderRes = await folderService.getFolders({
        parentId: currentId
      });
      setFolders(folderRes.data?.folders || []);

      // 3. Lấy danh sách tệp tin
      const fileRes = await fileService.getFiles({
        folderId: currentId,
        type: filterType || undefined,
        category: filterCategory || undefined,
        sortBy,
        sortOrder
      });
      setFiles(fileRes.data || []);
    } catch (err) {
      console.error('Lỗi khi tải dữ liệu Drive:', err);
      toast.error('Không thể tải dữ liệu thư mục');
    } finally {
      setLoading(false);
    }
  }, [folderId, filterType, filterCategory, sortBy, sortOrder]);

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
          />
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
