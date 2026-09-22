import React, { useState, useEffect } from 'react';
import { Star, LayoutGrid, List } from 'lucide-react';
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
import fileService from '../../services/fileService';
import { useToast } from '../../contexts/ToastContext';

const StarredPage = () => {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState(() => localStorage.getItem('drive_view_mode') || 'grid');

  // Studio Inspector state
  const [selectedItem, setSelectedItem] = useState(null);
  const [isInspectorOpen, setIsInspectorOpen] = useState(true);

  const [previewFile, setPreviewFile] = useState(null);
  const [renameTarget, setRenameTarget] = useState(null);
  const [moveCopyTarget, setMoveCopyTarget] = useState(null);
  const [shareTarget, setShareTarget] = useState(null);
  const [versionsTarget, setVersionsTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const toast = useToast();

  const fetchStarredFiles = async () => {
    setLoading(true);
    try {
      const res = await fileService.getFiles({ isStarred: true });
      setFiles(res.data || []);
    } catch (err) {
      console.error('Lỗi khi tải tệp yêu thích:', err);
      toast.error('Không thể tải danh sách tệp yêu thích');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStarredFiles();
    setSelectedItem(null);
  }, []);

  // Toggle Inspector global event
  useEffect(() => {
    const handleToggle = () => setIsInspectorOpen((prev) => !prev);
    window.addEventListener('drive:toggle-inspector', handleToggle);
    return () => window.removeEventListener('drive:toggle-inspector', handleToggle);
  }, []);

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
      await fileService.toggleStar(fileId);
      setFiles((prev) => prev.filter((f) => f._id !== fileId));
      if (selectedItem?.data?._id === fileId) {
        setSelectedItem(null);
      }
      toast.success('Đã bỏ khỏi danh sách yêu thích');
    } catch (err) {
      toast.error('Thao tác thất bại');
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;

    setDeleting(true);
    try {
      await fileService.deleteFile(deleteTarget.item._id);
      toast.success('Đã chuyển tệp tin vào thùng rác');
      setDeleteTarget(null);
      setSelectedItem(null);
      fetchStarredFiles();
    } catch (err) {
      toast.error('Xóa thất bại');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <main className={`page-body ${isInspectorOpen ? 'has-inspector' : ''}`}>
        <div className="drive-action-bar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            <Star size={20} style={{ color: 'var(--accent-amber)', fill: 'var(--accent-amber)' }} />
            <span>Có gắn dấu sao</span>
            <span className="badge badge-amber">{files.length}</span>
          </div>

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
            <div style={{ marginTop: '14px', fontSize: '0.835rem' }}>Đang tải tệp yêu thích...</div>
          </div>
        ) : files.length === 0 ? (
          <EmptyState
            icon={Star}
            title="Chưa có tệp yêu thích"
            description="Đánh dấu sao các tệp quan trọng để bạn có thể nhanh chóng truy cập tại đây."
          />
        ) : viewMode === 'grid' ? (
          <FileGrid
            folders={[]}
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
            folders={[]}
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
        onSuccess={fetchStarredFiles}
      />

      <MoveCopyModal
        isOpen={Boolean(moveCopyTarget)}
        onClose={() => setMoveCopyTarget(null)}
        item={moveCopyTarget?.item}
        itemType={moveCopyTarget?.type}
        mode={moveCopyTarget?.mode}
        onSuccess={fetchStarredFiles}
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
        onRestoreSuccess={fetchStarredFiles}
      />

      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        title="Chuyển tệp tin vào thùng rác?"
        message={`Bạn có chắc chắn muốn chuyển "${deleteTarget?.item?.name}" vào thùng rác?`}
        confirmText="Chuyển vào thùng rác"
        isDanger={true}
        loading={deleting}
      />
    </>
  );
};

export default StarredPage;
