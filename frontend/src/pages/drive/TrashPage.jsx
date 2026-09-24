import React, { useState, useEffect } from 'react';
import { Trash2, AlertTriangle, LayoutGrid, List } from 'lucide-react';
import FileGrid from '../../components/drive/FileGrid';
import FileTable from '../../components/drive/FileTable';
import ContextualActionBar from '../../components/drive/ContextualActionBar';
import EmptyState from '../../components/common/EmptyState';

import ConfirmDialog from '../../components/common/ConfirmDialog';
import InspectorPanel from '../../components/drive/InspectorPanel';
import fileService from '../../services/fileService';
import { useToast } from '../../contexts/ToastContext';

const TrashPage = () => {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState(() => localStorage.getItem('drive_view_mode') || 'grid');
  const [emptyTrashConfirm, setEmptyTrashConfirm] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Studio Inspector state
  const [selectedItem, setSelectedItem] = useState(null);
  const [isInspectorOpen, setIsInspectorOpen] = useState(true);

  const toast = useToast();

  const fetchTrash = async () => {
    setLoading(true);
    try {
      const res = await fileService.getTrashFiles();
      setFiles(res.data || []);
    } catch (err) {
      console.error('Lỗi lấy thùng rác:', err);
      toast.error('Không thể tải danh sách thùng rác');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTrash();
    setSelectedItem(null);
  }, []);

  // Toggle Inspector global event
  useEffect(() => {
    const handleToggle = () => setIsInspectorOpen((prev) => !prev);
    window.addEventListener('drive:toggle-inspector', handleToggle);
    return () => window.removeEventListener('drive:toggle-inspector', handleToggle);
  }, []);

  const handleRestore = async (type, item) => {
    try {
      await fileService.restoreFile(item._id);
      toast.success(`Đã khôi phục "${item.name}"`);
      if (selectedItem?.data?._id === item._id) setSelectedItem(null);
      fetchTrash();
      window.dispatchEvent(new Event('folder:updated'));
    } catch (err) {
      toast.error('Khôi phục thất bại');
    }
  };

  const handlePermanentDelete = async (type, item) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa VĨNH VIỄN "${item.name}"? Thao tác này không thể hoàn tác.`)) {
      return;
    }

    try {
      await fileService.deleteFile(item._id, true);
      toast.success(`Đã xóa vĩnh viễn "${item.name}"`);
      if (selectedItem?.data?._id === item._id) setSelectedItem(null);
      fetchTrash();
    } catch (err) {
      toast.error('Xóa vĩnh viễn thất bại');
    }
  };

  const handleEmptyTrash = async () => {
    setActionLoading(true);
    try {
      await fileService.emptyTrash();
      toast.success('Đã dọn sạch thùng rác');
      setEmptyTrashConfirm(false);
      setSelectedItem(null);
      fetchTrash();
    } catch (err) {
      toast.error('Dọn thùng rác thất bại');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <>
      <main className={`page-body ${isInspectorOpen ? 'has-inspector' : ''}`}>
        <div className="drive-action-bar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            <Trash2 size={20} style={{ color: 'var(--accent-rose)' }} />
            <span>Thùng rác</span>
            <span className="badge badge-rose">{files.length}</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {files.length > 0 && (
              <button
                className="btn btn-danger"
                style={{ padding: '5px 12px', fontSize: '0.8rem' }}
                onClick={() => setEmptyTrashConfirm(true)}
              >
                <Trash2 size={14} />
                <span>Dọn sạch thùng rác</span>
              </button>
            )}

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
            isTrash={true}
            onRestoreItem={handleRestore}
            onDeleteItem={handlePermanentDelete}
          />
        )}

        <div

          style={{
            padding: '8px 14px',
            backgroundColor: 'var(--bg-surface-hover)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-subtle)',
            fontSize: '0.8rem',
            color: 'var(--text-muted)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <AlertTriangle size={15} style={{ color: 'var(--accent-amber)', flexShrink: 0 }} />
          <span>Các tệp trong thùng rác có thể được khôi phục hoặc xóa vĩnh viễn khỏi hệ thống lưu trữ.</span>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '80px 20px', color: 'var(--text-muted)' }}>
            <span className="spinner" style={{ width: 32, height: 32, margin: '0 auto' }} />
            <div style={{ marginTop: '14px', fontSize: '0.835rem' }}>Đang tải danh sách thùng rác...</div>
          </div>
        ) : files.length === 0 ? (
          <EmptyState
            icon={Trash2}
            title="Thùng rác trống"
            description="Không có tệp tin hoặc thư mục nào nằm trong thùng rác."
          />
        ) : viewMode === 'grid' ? (
          <FileGrid
            folders={[]}
            files={files}
            isTrash={true}
            selectedItem={selectedItem}
            onSelectItem={setSelectedItem}
            onRestoreItem={handleRestore}
            onDeleteItem={handlePermanentDelete}
          />
        ) : (
          <FileTable
            folders={[]}
            files={files}
            isTrash={true}
            selectedItem={selectedItem}
            onSelectItem={setSelectedItem}
            onRestoreItem={handleRestore}
            onDeleteItem={handlePermanentDelete}
          />
        )}
      </main>

      {/* Studio Inspector Panel */}
      <InspectorPanel
        isOpen={isInspectorOpen}
        onClose={() => setIsInspectorOpen(false)}
        selectedItem={selectedItem}
        isTrash={true}
        onRestoreItem={handleRestore}
        onDeleteItem={handlePermanentDelete}
      />

      <ConfirmDialog
        isOpen={emptyTrashConfirm}
        onClose={() => setEmptyTrashConfirm(false)}
        onConfirm={handleEmptyTrash}
        title="Dọn sạch toàn bộ thùng rác?"
        message="Hành động này sẽ xóa VĨNH VIỄN toàn bộ tệp tin trong thùng rác và giải phóng dung lượng. Bạn không thể hoàn tác sau khi thực hiện."
        confirmText="Xóa sạch vĩnh viễn"
        isDanger={true}
        loading={actionLoading}
      />
    </>
  );
};

export default TrashPage;
