import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  HardDrive,
  Star,
  Users,
  Share2,
  Trash2,
  Plus,
  FolderPlus,
  UploadCloud,
  Shield,
  Cloud,
  Folder
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import folderService from '../../services/folderService';
import FolderTree from '../drive/FolderTree';

const Sidebar = ({ onOpenUpload, onOpenCreateFolder }) => {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const [showNewMenu, setShowNewMenu] = useState(false);
  const [folderTree, setFolderTree] = useState([]);

  useEffect(() => {
    fetchTree();
    const handleFolderUpdate = () => fetchTree();
    window.addEventListener('folder:updated', handleFolderUpdate);
    return () => window.removeEventListener('folder:updated', handleFolderUpdate);
  }, []);

  const fetchTree = async () => {
    try {
      const res = await folderService.getFolderTree();
      setFolderTree(res.data || []);
    } catch (err) {
      console.error('Không thể lấy cây thư mục:', err);
    }
  };

  const handleSelectFolder = (folderId) => {
    if (folderId) {
      navigate(`/drive/folder/${folderId}`);
    } else {
      navigate('/drive');
    }
  };

  return (
    <aside className="app-sidebar">
      {/* Brand Header */}
      <div className="sidebar-header">
        <NavLink to="/drive" className="sidebar-brand">
          <div className="brand-icon">
            <Cloud size={22} />
          </div>
          <span>CloudDrive</span>
        </NavLink>
      </div>

      {/* Action Button: "+ Tạo mới" */}
      <div className="sidebar-action-box" style={{ position: 'relative' }}>
        <button
          className="btn-new-item"
          onClick={() => setShowNewMenu(!showNewMenu)}
        >
          <Plus size={20} />
          <span>Tạo mới</span>
        </button>

        {showNewMenu && (
          <div
            className="user-dropdown-menu"
            style={{ top: '100%', left: '20px', right: '20px', width: 'auto' }}
          >
            <button
              className="dropdown-item"
              onClick={() => {
                setShowNewMenu(false);
                onOpenCreateFolder && onOpenCreateFolder();
              }}
            >
              <FolderPlus size={18} style={{ color: 'var(--primary-600)' }} />
              <span>Thư mục mới</span>
            </button>
            <button
              className="dropdown-item"
              onClick={() => {
                setShowNewMenu(false);
                onOpenUpload && onOpenUpload();
              }}
            >
              <UploadCloud size={18} style={{ color: 'var(--accent-blue)' }} />
              <span>Tải tệp lên</span>
            </button>
          </div>
        )}
      </div>

      {/* Navigation Links */}
      <nav className="sidebar-nav">
        <NavLink
          to="/drive"
          end
          className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
        >
          <HardDrive size={18} />
          <span>Drive của tôi</span>
        </NavLink>

        <NavLink
          to="/starred"
          className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
        >
          <Star size={18} />
          <span>Có gắn dấu sao</span>
        </NavLink>

        <NavLink
          to="/shares/shared-with-me"
          className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
        >
          <Users size={18} />
          <span>Được chia sẻ với tôi</span>
        </NavLink>

        <NavLink
          to="/shares/shared-by-me"
          className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
        >
          <Share2 size={18} />
          <span>Tôi đã chia sẻ</span>
        </NavLink>

        <NavLink
          to="/trash"
          className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
        >
          <Trash2 size={18} />
          <span>Thùng rác</span>
        </NavLink>

        {isAdmin && (
          <>
            <div className="sidebar-section-title">Hệ thống quản trị</div>
            <NavLink
              to="/admin/users"
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            >
              <Shield size={18} />
              <span>Quản lý người dùng</span>
            </NavLink>
          </>
        )}

        {/* Cây thư mục lồng nhau */}
        {folderTree.length > 0 && (
          <>
            <div className="sidebar-section-title">Cây thư mục</div>
            <div className="sidebar-tree-container">
              <FolderTree
                tree={folderTree}
                onSelectFolder={handleSelectFolder}
                includeRoot={false}
              />
            </div>
          </>
        )}
      </nav>

      {/* Dung lượng lưu trữ */}
      <div className="sidebar-footer">
        <div className="storage-info">
          <span>Bộ nhớ đã dùng</span>
          <span>Đang sử dụng</span>
        </div>
        <div className="storage-progress-bar">
          <div className="storage-progress-fill" style={{ width: '25%' }} />
        </div>
        <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: '6px' }}>
          Được bảo mật với mã hóa 2-Token
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
