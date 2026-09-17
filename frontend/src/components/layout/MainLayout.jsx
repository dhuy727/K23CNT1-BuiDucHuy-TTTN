import React, { useState } from 'react';
import { Outlet, useLocation, useParams } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import UploadModal from '../drive/UploadModal';
import Modal from '../common/Modal';
import folderService from '../../services/folderService';
import { useToast } from '../../contexts/ToastContext';

const MainLayout = () => {
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isCreateFolderOpen, setIsCreateFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderColor, setNewFolderColor] = useState('#3b82f6');
  const [creatingFolder, setCreatingFolder] = useState(false);

  const { folderId } = useParams();
  const location = useLocation();
  const toast = useToast();

  const handleCreateFolder = async (e) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;

    setCreatingFolder(true);
    try {
      await folderService.createFolder({
        name: newFolderName.trim(),
        parentId: folderId || null,
        color: newFolderColor
      });
      toast.success('Đã tạo thư mục mới thành công');
      setNewFolderName('');
      setIsCreateFolderOpen(false);
      window.dispatchEvent(new Event('folder:updated'));
      window.dispatchEvent(new Event('drive:refresh'));
    } catch (err) {
      toast.error(err.response?.data?.message || 'Tạo thư mục thất bại');
    } finally {
      setCreatingFolder(false);
    }
  };

  const handleUploadSuccess = () => {
    window.dispatchEvent(new Event('drive:refresh'));
  };

  return (
    <div className="app-container">
      {/* Sidebar */}
      <Sidebar
        onOpenUpload={() => setIsUploadOpen(true)}
        onOpenCreateFolder={() => setIsCreateFolderOpen(true)}
      />

      {/* Main Area */}
      <div className="main-wrapper">
        <Header />
        <main className="page-body">
          <Outlet />
        </main>
      </div>

      {/* Upload Modal */}
      <UploadModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        currentFolderId={folderId || null}
        onUploadSuccess={handleUploadSuccess}
      />

      {/* Create Folder Modal */}
      <Modal
        isOpen={isCreateFolderOpen}
        onClose={() => setIsCreateFolderOpen(false)}
        title="Tạo thư mục mới"
        size="sm"
        footer={
          <>
            <button
              className="btn btn-secondary"
              onClick={() => setIsCreateFolderOpen(false)}
              disabled={creatingFolder}
            >
              Hủy
            </button>
            <button
              className="btn btn-primary"
              onClick={handleCreateFolder}
              disabled={creatingFolder || !newFolderName.trim()}
            >
              {creatingFolder ? <span className="spinner" /> : 'Tạo thư mục'}
            </button>
          </>
        }
      >
        <form onSubmit={handleCreateFolder}>
          <div className="form-group">
            <label className="form-label">Tên thư mục</label>
            <input
              type="text"
              className="form-input"
              placeholder="Nhập tên thư mục..."
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              autoFocus
              required
            />
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Màu sắc đánh dấu</label>
            <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
              {['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#6366f1'].map((c) => (
                <button
                  type="button"
                  key={c}
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    backgroundColor: c,
                    border: newFolderColor === c ? '3px solid var(--text-primary)' : 'none',
                    cursor: 'pointer'
                  }}
                  onClick={() => setNewFolderColor(c)}
                />
              ))}
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default MainLayout;
