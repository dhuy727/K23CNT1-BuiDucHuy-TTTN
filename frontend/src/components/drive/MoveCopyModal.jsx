import React, { useState, useEffect } from 'react';
import Modal from '../common/Modal';
import FolderTree from './FolderTree';
import folderService from '../../services/folderService';
import fileService from '../../services/fileService';
import { useToast } from '../../contexts/ToastContext';

const MoveCopyModal = ({
  isOpen,
  onClose,
  item,
  itemType = 'file', // 'file' or 'folder'
  mode = 'move', // 'move' or 'copy'
  onSuccess
}) => {
  const [tree, setTree] = useState([]);
  const [selectedFolderId, setSelectedFolderId] = useState(null); // null = root
  const [loading, setLoading] = useState(false);
  const [fetchingTree, setFetchingTree] = useState(true);
  const toast = useToast();

  useEffect(() => {
    if (isOpen) {
      fetchFolderTree();
    }
  }, [isOpen]);

  const fetchFolderTree = async () => {
    setFetchingTree(true);
    try {
      const res = await folderService.getFolderTree();
      setTree(res.data || []);
    } catch (err) {
      console.error('Lỗi lấy cây thư mục:', err);
      toast.error('Không thể lấy danh sách thư mục');
    } finally {
      setFetchingTree(false);
    }
  };

  const handleAction = async () => {
    if (!item) return;

    setLoading(true);
    try {
      const targetId = selectedFolderId === 'root' ? null : selectedFolderId;

      if (itemType === 'file') {
        if (mode === 'move') {
          await fileService.moveFile(item._id, targetId);
          toast.success('Di chuyển tệp tin thành công');
        } else {
          await fileService.copyFile(item._id, targetId);
          toast.success('Sao chép tệp tin thành công');
        }
      } else {
        // Thư mục chỉ hỗ trợ move
        await folderService.moveFolder(item._id, targetId);
        toast.success('Di chuyển thư mục thành công');
      }

      onSuccess && onSuccess();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Thao tác thất bại');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !item) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`${mode === 'move' ? 'Di chuyển' : 'Sao chép'} "${item.name}"`}
      size="md"
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose} disabled={loading}>
            Hủy
          </button>
          <button className="btn btn-primary" onClick={handleAction} disabled={loading || fetchingTree}>
            {loading ? <span className="spinner" /> : mode === 'move' ? 'Di chuyển đến đây' : 'Sao chép đến đây'}
          </button>
        </>
      }
    >
      <div style={{ marginBottom: '12px', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
        Chọn thư mục đích:
      </div>

      <div
        style={{
          border: '1px solid var(--border-main)',
          borderRadius: 'var(--radius-md)',
          padding: '12px',
          maxHeight: '300px',
          overflowY: 'auto',
          backgroundColor: 'var(--bg-surface-hover)'
        }}
      >
        {fetchingTree ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', gap: '8px' }}>
            <span className="spinner" />
            <span style={{ fontSize: '0.875rem' }}>Đang tải danh sách thư mục...</span>
          </div>
        ) : (
          <FolderTree
            tree={tree}
            activeFolderId={selectedFolderId}
            onSelectFolder={(id) => setSelectedFolderId(id)}
            includeRoot={true}
          />
        )}
      </div>
    </Modal>
  );
};

export default MoveCopyModal;
