import React, { useState, useEffect } from 'react';
import { Trash2, RotateCcw, AlertTriangle, LayoutGrid, List } from 'lucide-react';
import FileGrid from '../../components/drive/FileGrid';
import FileTable from '../../components/drive/FileTable';
import EmptyState from '../../components/common/EmptyState';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import fileService from '../../services/fileService';
import { useToast } from '../../contexts/ToastContext';

const TrashPage = () => {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState(() => localStorage.getItem('drive_view_mode') || 'grid');
  const [emptyTrashConfirm, setEmptyTrashConfirm] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

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
  }, []);

  const handleRestore = async (type, item) => {
    try {
      await fileService.restoreFile(item._id);
      toast.success(`Đã khôi phục "${item.name}"`);
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
      fetchTrash();
    } catch (err) {
      toast.error('Dọn thùng rác thất bại');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div>
      <div className="drive-action-bar" style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.25rem', fontWeight: 800 }}>
          <Trash2 size={24} style={{ color: 'var(--accent-rose)' }} />
          <span>Thùng rác</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {files.length > 0 && (
            <button
              className="btn btn-danger"
              style={{ padding: '6px 14px', fontSize: '0.8125rem' }}
              onClick={() => setEmptyTrashConfirm(true)}
            >
              <Trash2 size={16} />
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
              <LayoutGrid size={18} />
            </button>
            <button
              className={`view-toggle-btn ${viewMode === 'table' ? 'active' : ''}`}
              onClick={() => {
                setViewMode('table');
                localStorage.setItem('drive_view_mode', 'table');
              }}
              title="Danh sách"
            >
              <List size={18} />
            </button>
          </div>
        </div>
      </div>

      <div
        style={{
          padding: '10px 16px',
          backgroundColor: 'var(--bg-surface-hover)',
          borderRadius: 'var(--radius-md)',
          fontSize: '0.8125rem',
          color: 'var(--text-muted)',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}
      >
        <AlertTriangle size={16} style={{ color: 'var(--accent-amber)' }} />
        <span>Các tệp trong thùng rác có thể được khôi phục hoặc xóa vĩnh viễn khỏi máy chủ.</span>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '80px 20px', color: 'var(--text-muted)' }}>
          <span className="spinner" style={{ width: 36, height: 36, margin: '0 auto' }} />
          <div style={{ marginTop: '16px' }}>Đang tải danh sách thùng rác...</div>
        </div>
      ) : files.length === 0 ? (
        <EmptyState
          icon={Trash2}
          title="Thùng rác trống"
          description="Không có tệp tin nào trong thùng rác."
        />
      ) : viewMode === 'grid' ? (
        <FileGrid
          folders={[]}
          files={files}
          isTrash={true}
          onRestoreItem={handleRestore}
          onDeleteItem={handlePermanentDelete}
        />
      ) : (
        <FileTable
          folders={[]}
          files={files}
          isTrash={true}
          onRestoreItem={handleRestore}
          onDeleteItem={handlePermanentDelete}
        />
      )}

      {/* Confirm Empty Trash */}
      <ConfirmDialog
        isOpen={emptyTrashConfirm}
        onClose={() => setEmptyTrashConfirm(false)}
        onConfirm={handleEmptyTrash}
        title="Dọn sạch toàn bộ thùng rác?"
        message="Hành động này sẽ xóa vĩnh viễn toàn bộ tệp tin và giải phóng dung lượng ổ đĩa. Bạn sẽ KHÔNG thể khôi phục lại các tệp này!"
        confirmText="Xác nhận xóa vĩnh viễn"
        isDanger={true}
        loading={actionLoading}
      />
    </div>
  );
};

export default TrashPage;
