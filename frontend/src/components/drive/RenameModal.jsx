import React, { useState, useEffect } from 'react';
import Modal from '../common/Modal';
import fileService from '../../services/fileService';
import folderService from '../../services/folderService';
import { useToast } from '../../contexts/ToastContext';

const RenameModal = ({ isOpen, onClose, item, itemType = 'file', onSuccess }) => {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  useEffect(() => {
    if (item && isOpen) {
      setName(item.name || '');
    }
  }, [item, isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.warning('Tên không được để trống');
      return;
    }

    setLoading(true);
    try {
      if (itemType === 'folder') {
        await folderService.renameFolder(item._id, name.trim());
      } else {
        await fileService.renameFile(item._id, name.trim());
      }
      toast.success(`Đã đổi tên ${itemType === 'folder' ? 'thư mục' : 'tệp tin'} thành công`);
      onSuccess && onSuccess();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Đổi tên thất bại');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !item) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Đổi tên ${itemType === 'folder' ? 'thư mục' : 'tệp tin'}`}
      size="sm"
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose} disabled={loading}>
            Hủy
          </button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={loading}>
            {loading ? <span className="spinner" /> : 'Lưu thay đổi'}
          </button>
        </>
      }
    >
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label className="form-label">Tên mới</label>
          <input
            type="text"
            className="form-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            required
          />
        </div>
      </form>
    </Modal>
  );
};

export default RenameModal;
