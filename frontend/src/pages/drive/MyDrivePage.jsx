import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  LayoutGrid,
  List,
  Filter,
  ArrowUpDown,
  HardDrive,
  FolderOpen
} from 'lucide-react';
import Breadcrumb from '../../components/drive/Breadcrumb';
import FileGrid from '../../components/drive/FileGrid';
import FileTable from '../../components/drive/FileTable';
import EmptyState from '../../components/common/EmptyState';
import FilePreviewModal from '../../components/drive/FilePreviewModal';
import RenameModal from '../../components/drive/RenameModal';
import MoveCopyModal from '../../components/drive/MoveCopyModal';
import ShareModal from '../../components/drive/ShareModal';
import FileVersionsModal from '../../components/drive/FileVersionsModal';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import folderService from '../../services/folderService';
import fileService from '../../services/fileService';
import { useToast } from '../../contexts/ToastContext';

const MyDrivePage = () => {
  const { folderId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();

  const [folders, setFolders] = useState([]);
  const [files, setFiles] = useState([]);
  const [breadcrumbs, setBreadcrumbs] = useState([{ _id: 'root', name: 'Drive của tôi' }]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState(() => localStorage.getItem('drive_view_mode') || 'grid');
  const [filterType, setFilterType] = useState('');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState('desc');

  // Modals state
  const [previewFile, setPreviewFile] = useState(null);
  const [renameTarget, setRenameTarget] = useState(null);
  const [moveCopyTarget, setMoveCopyTarget] = useState(null);
  const [shareTarget, setShareTarget] = useState(null);
  const [versionsTarget, setVersionsTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const fetchDriveContent = useCallback(async () => {
    setLoading(true);
    try {
      const currentId = folderId || 'root';

      // 1. Lấy breadcrumbs & chi tiết nếu ở trong subfolder
      if (folderId) {
        try {
          const detailRes = await folderService.getFolderById(folderId);
          if (detailRes.data?.breadcrumb) {
            setBreadcrumbs(detailRes.data.breadcrumb);
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
  }, [folderId, filterType, sortBy, sortOrder]);

  useEffect(() => {
    fetchDriveContent();

    const handleRefresh = () => fetchDriveContent();
    window.addEventListener('drive:refresh', handleRefresh);
    return () => window.removeEventListener('drive:refresh', handleRefresh);
  }, [fetchDriveContent]);

  const handleToggleView = (mode) => {
    setViewMode(mode);
    localStorage.setItem('drive_view_mode', mode);
  };

  const handleOpenFolder = (id) => {
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
      fetchDriveContent();
      window.dispatchEvent(new Event('folder:updated'));
    } catch (err) {
      toast.error(err.response?.data?.message || 'Xóa thất bại');
    } finally {
      setDeleting(false);
    }
  };

  const isEmpty = folders.length === 0 && files.length === 0;

  return (
    <div>
      {/* Top Action Bar */}
      <div className="drive-action-bar" style={{ marginBottom: '16px' }}>
        <Breadcrumb breadcrumbs={breadcrumbs} onSelectFolder={handleOpenFolder} />

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* Lọc loại tệp */}
          <select
            className="form-select"
            style={{ width: '130px', padding: '6px 10px', fontSize: '0.8125rem' }}
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

          {/* Sắp xếp */}
          <select
            className="form-select"
            style={{ width: '130px', padding: '6px 10px', fontSize: '0.8125rem' }}
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
              <LayoutGrid size={18} />
            </button>
            <button
              className={`view-toggle-btn ${viewMode === 'table' ? 'active' : ''}`}
              onClick={() => handleToggleView('table')}
              title="Chế độ Danh sách"
            >
              <List size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '80px 20px', color: 'var(--text-muted)' }}>
          <span className="spinner" style={{ width: 36, height: 36, margin: '0 auto' }} />
          <div style={{ marginTop: '16px', fontSize: '0.875rem' }}>Đang tải nội dung Drive...</div>
        </div>
      ) : isEmpty ? (
        <EmptyState
          icon={FolderOpen}
          title="Thư mục trống"
          description="Chưa có tệp tin hoặc thư mục nào ở vị trí này. Hãy kéo thả tệp vào đây hoặc nhấn nút 'Tạo mới'."
        />
      ) : viewMode === 'grid' ? (
        <FileGrid
          folders={folders}
          files={files}
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
        />
      ) : (
        <FileTable
          folders={folders}
          files={files}
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
        />
      )}

      {/* Modals */}
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
    </div>
  );
};

export default MyDrivePage;
