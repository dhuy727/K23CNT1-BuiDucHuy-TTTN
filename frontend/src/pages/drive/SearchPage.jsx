import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, Filter, LayoutGrid, List, Sparkles } from 'lucide-react';
import FileGrid from '../../components/drive/FileGrid';
import FileTable from '../../components/drive/FileTable';
import ContextualActionBar from '../../components/drive/ContextualActionBar';
import EmptyState from '../../components/common/EmptyState';

import FilePreviewModal from '../../components/drive/FilePreviewModal';
import RenameModal from '../../components/drive/RenameModal';
import MoveCopyModal from '../../components/drive/MoveCopyModal';
import ShareModal from '../../components/drive/ShareModal';
import FileVersionsModal from '../../components/drive/FileVersionsModal';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import InspectorPanel from '../../components/drive/InspectorPanel';
import searchService from '../../services/searchService';
import fileService from '../../services/fileService';
import folderService from '../../services/folderService';
import { useToast } from '../../contexts/ToastContext';

const SearchPage = () => {
  const [searchParams] = useSearchParams();
  const queryParam = searchParams.get('q') || '';

  const [keyword, setKeyword] = useState(queryParam);
  const [folders, setFolders] = useState([]);
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState(() => localStorage.getItem('drive_view_mode') || 'grid');

  // Studio Inspector state
  const [selectedItem, setSelectedItem] = useState(null);
  const [isInspectorOpen, setIsInspectorOpen] = useState(true);

  // Filter states
  const [typeFilter, setTypeFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [metadata, setMetadata] = useState(null);

  // Modals
  const [previewFile, setPreviewFile] = useState(null);
  const [renameTarget, setRenameTarget] = useState(null);
  const [moveCopyTarget, setMoveCopyTarget] = useState(null);
  const [shareTarget, setShareTarget] = useState(null);
  const [versionsTarget, setVersionsTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const toast = useToast();

  useEffect(() => {
    setKeyword(queryParam);
    setSelectedItem(null);
  }, [queryParam]);

  // Toggle Inspector global event
  useEffect(() => {
    const handleToggle = () => setIsInspectorOpen((prev) => !prev);
    window.addEventListener('drive:toggle-inspector', handleToggle);
    return () => window.removeEventListener('drive:toggle-inspector', handleToggle);
  }, []);

  useEffect(() => {
    const loadMetadata = async () => {
      try {
        const res = await searchService.getFiltersMetadata();
        setMetadata(res.data);
      } catch (err) {
        console.error('Lỗi lấy metadata bộ lọc:', err);
      }
    };
    loadMetadata();
  }, []);

  const handleSearch = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        q: keyword,
        type: typeFilter || undefined,
        aiCategory: categoryFilter || undefined
      };
      const res = await searchService.search(params);
      const data = res.data || {};
      setFolders(data.folders || []);
      setFiles(data.files || []);
    } catch (err) {
      console.error('Tìm kiếm thất bại:', err);
      toast.error('Tìm kiếm thất bại');
    } finally {
      setLoading(false);
    }
  }, [keyword, typeFilter, categoryFilter]);

  useEffect(() => {
    handleSearch();
  }, [handleSearch]);

  const handleDownloadFile = async (file) => {
    try {
      toast.info(`Đang tải về "${file.name}"...`);
      const blob = await fileService.downloadFileBlob(file._id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
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
      if (selectedItem?.data?._id === fileId) {
        setSelectedItem((prev) => ({
          ...prev,
          data: { ...prev.data, isStarred: updated.isStarred }
        }));
      }
      toast.success(
        updated.isStarred ? 'Đã thêm vào mục yêu thích' : 'Đã bỏ khỏi mục yêu thích'
      );
    } catch (err) {
      toast.error('Thao tác thất bại');
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    try {
      if (deleteTarget.type === 'folder') {
        await folderService.deleteFolder(deleteTarget.item._id);
      } else {
        await fileService.deleteFile(deleteTarget.item._id);
      }
      toast.success('Đã chuyển vào thùng rác');
      setDeleteTarget(null);
      setSelectedItem(null);
      handleSearch();
    } catch (err) {
      toast.error('Xóa thất bại');
    }
  };

  const isEmpty = folders.length === 0 && files.length === 0;

  return (
    <>
      <main className={`page-body ${isInspectorOpen ? 'has-inspector' : ''}`}>
        {/* Search & Filter Header */}
        <div className="drive-action-bar">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              <Search size={18} style={{ color: 'var(--primary-600)' }} />
              <span>Kết quả cho "{keyword || 'Tất cả'}"</span>
              <span className="badge badge-slate">{folders.length + files.length} kết quả</span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {/* Lọc loại tệp */}
            <select
              className="form-select"
              style={{ width: '130px', padding: '5px 8px', fontSize: '0.8rem' }}
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
            >
              <option value="">Tất cả loại tệp</option>
              <option value="image">Hình ảnh</option>
              <option value="document">Tài liệu</option>
              <option value="video">Video</option>
              <option value="audio">Âm thanh</option>
              <option value="archive">Tệp nén (ZIP)</option>
            </select>

            {/* Lọc danh mục AI */}
            {Array.isArray(metadata?.categories) && metadata.categories.length > 0 && (
              <select
                className="form-select"
                style={{ width: '150px', padding: '5px 8px', fontSize: '0.8rem' }}
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
              >
                <option value="">Phân loại AI</option>
                {metadata.categories.map((cat, i) => {
                  const catName = typeof cat === 'object' ? cat.name : cat;
                  const catCount = typeof cat === 'object' && cat.count !== undefined ? ` (${cat.count})` : '';
                  return (
                    <option key={i} value={catName}>
                      {catName}{catCount}
                    </option>
                  );
                })}
              </select>
            )}

            {/* View Mode Toggle */}
            <div className="view-toggle-group">
              <button
                className={`view-toggle-btn ${viewMode === 'grid' ? 'active' : ''}`}
                onClick={() => {
                  setViewMode('grid');
                  localStorage.setItem('drive_view_mode', 'grid');
                }}
                title="Lưới"
              >
                <LayoutGrid size={16} />
              </button>
              <button
                className={`view-toggle-btn ${viewMode === 'table' ? 'active' : ''}`}
                onClick={() => {
                  setViewMode('table');
                  localStorage.setItem('drive_view_mode', 'table');
                }}
                title="Danh sách"
              >
                <List size={16} />
              </button>
            </div>
          </div>
        </div>

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

        {loading ? (
          <div style={{ textAlign: 'center', padding: '80px 20px', color: 'var(--text-muted)' }}>
            <span className="spinner" style={{ width: 32, height: 32, margin: '0 auto' }} />
            <div style={{ marginTop: '14px', fontSize: '0.835rem' }}>Đang tìm kiếm dữ liệu...</div>
          </div>
        ) : isEmpty ? (
          <EmptyState
            icon={Search}
            title="Không tìm thấy kết quả"
            description={`Không có tài liệu hoặc thư mục nào khớp với từ khóa "${keyword}". Vui lòng thử từ khóa khác hoặc điều chỉnh bộ lọc.`}
          />
        ) : viewMode === 'grid' ? (
          <FileGrid
            folders={folders}
            files={files}
            selectedItem={selectedItem}
            onSelectItem={setSelectedItem}
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
            selectedItem={selectedItem}
            onSelectItem={setSelectedItem}
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
      </main>

      {/* Studio Inspector Panel */}
      <InspectorPanel
        isOpen={isInspectorOpen}
        onClose={() => setIsInspectorOpen(false)}
        selectedItem={selectedItem}
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
      />

      <RenameModal
        isOpen={Boolean(renameTarget)}
        onClose={() => setRenameTarget(null)}
        item={renameTarget?.item}
        itemType={renameTarget?.type}
        onSuccess={handleSearch}
      />

      <MoveCopyModal
        isOpen={Boolean(moveCopyTarget)}
        onClose={() => setMoveCopyTarget(null)}
        item={moveCopyTarget?.item}
        itemType={moveCopyTarget?.type}
        mode={moveCopyTarget?.mode}
        onSuccess={handleSearch}
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
        onRestoreSuccess={handleSearch}
      />

      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        title="Chuyển vào thùng rác?"
        message={`Bạn có chắc chắn muốn chuyển "${deleteTarget?.item?.name}" vào thùng rác?`}
        confirmText="Chuyển vào thùng rác"
        isDanger={true}
      />
    </>
  );
};

export default SearchPage;
