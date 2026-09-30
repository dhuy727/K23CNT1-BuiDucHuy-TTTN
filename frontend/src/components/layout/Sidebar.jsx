import React, { useState, useEffect, useRef } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  HardDrive,
  Star,
  Users,
  Share2,
  Trash2,
  Plus,
  FolderPlus,
  FolderUp,
  UploadCloud,
  Layers,
  ChevronDown,
  Home,
  Shield,
  PanelLeftClose,
  Zap,
  Broom,
  X,
  ShieldCheck,
  BarChart3,
  Pin,
  Clock,
  Network,
  Folder as FolderIcon
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import folderService from '../../services/folderService';
import fileService from '../../services/fileService';
import FolderTree from '../drive/FolderTree';

const Sidebar = ({
  isCollapsed,
  onToggleCollapse,
  isMobileOpen = false,
  onCloseMobile,
  onOpenUpload,
  onOpenUploadFolder,
  onOpenCreateFolder
}) => {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const [showNewMenu, setShowNewMenu] = useState(false);
  const [folderViewTab, setFolderViewTab] = useState(() => localStorage.getItem('sidebar_folder_tab') || 'pinned');
  const [folderTree, setFolderTree] = useState([]);
  const [pinnedFolders, setPinnedFolders] = useState([]);
  const [recentFolders, setRecentFolders] = useState([]);
  const [storageStats, setStorageStats] = useState({
    usedFormatted: '0 B',
    limitFormatted: '10 GB',
    percentage: 0,
    usedBytes: 0,
    limitBytes: 10 * 1024 * 1024 * 1024
  });
  const actionMenuRef = useRef(null);

  useEffect(() => {
    fetchAllFolderData();
    fetchStorage();

    const handleFolderUpdate = () => {
      fetchAllFolderData();
      fetchStorage();
    };
    const handleFileUpdate = () => fetchStorage();

    window.addEventListener('folder:updated', handleFolderUpdate);
    window.addEventListener('folder:pinned', handleFolderUpdate);
    window.addEventListener('file:updated', handleFileUpdate);
    window.addEventListener('drive:refresh', handleFileUpdate);

    return () => {
      window.removeEventListener('folder:updated', handleFolderUpdate);
      window.removeEventListener('folder:pinned', handleFolderUpdate);
      window.removeEventListener('file:updated', handleFileUpdate);
      window.removeEventListener('drive:refresh', handleFileUpdate);
    };
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (actionMenuRef.current && !actionMenuRef.current.contains(e.target)) {
        setShowNewMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchAllFolderData = async () => {
    try {
      const [treeRes, pinnedRes, recentRes] = await Promise.allSettled([
        folderService.getFolderTree(),
        folderService.getFolders({ isPinned: true, sortBy: 'updatedAt', sortOrder: 'desc' }),
        folderService.getFolders({ sortBy: 'updatedAt', sortOrder: 'desc', limit: 8 })
      ]);

      if (treeRes.status === 'fulfilled') {
        setFolderTree(treeRes.value.data || []);
      }
      if (pinnedRes.status === 'fulfilled') {
        const raw = pinnedRes.value.data;
        const list = Array.isArray(raw) ? raw : (raw?.folders || raw?.data || []);
        setPinnedFolders(list);
      }
      if (recentRes.status === 'fulfilled') {
        const raw = recentRes.value.data;
        const list = Array.isArray(raw) ? raw : (raw?.folders || raw?.data || []);
        setRecentFolders(list.slice(0, 8));
      }
    } catch (err) {
      console.error('Không thể lấy danh sách thư mục:', err);
    }
  };

  const handleTabChange = (tab) => {
    setFolderViewTab(tab);
    localStorage.setItem('sidebar_folder_tab', tab);
  };

  const fetchStorage = async () => {
    try {
      const res = await fileService.getStorageStats();
      if (res.data) {
        setStorageStats(res.data);
      }
    } catch (err) {
      console.error('Không thể lấy thống kê dung lượng:', err);
    }
  };

  const handleSelectFolder = (folderId) => {
    onCloseMobile && onCloseMobile();
    if (folderId) {
      navigate(`/drive/folder/${folderId}`);
    } else {
      navigate('/drive');
    }
  };

  return (
    <aside className={`app-sidebar ${isCollapsed ? 'is-collapsed' : ''} ${isMobileOpen ? 'is-mobile-open' : ''}`}>
      {/* Brand Header */}
      <div className="sidebar-header">
        {!isCollapsed ? (
          <>
            <NavLink
              to="/drive"
              className="sidebar-brand"
              title="SmartDocs"
              onClick={() => onCloseMobile && onCloseMobile()}
            >
              <div className="brand-icon">
                <Layers size={18} />
              </div>
              <span>SmartDocs</span>
            </NavLink>
            <div className="sidebar-header-actions" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <button
                type="button"
                className="sidebar-collapse-btn desktop-only-btn"
                onClick={onToggleCollapse}
                title="Thu gọn Sidebar"
                aria-label="Thu gọn Sidebar"
              >
                <PanelLeftClose size={17} />
              </button>
              <button
                type="button"
                className="sidebar-mobile-close-btn"
                onClick={onCloseMobile}
                title="Đóng menu"
                aria-label="Đóng menu"
              >
                <X size={18} />
              </button>
            </div>
          </>
        ) : (
          <div
            className="brand-icon"
            onClick={onToggleCollapse}
            title="Mở rộng Sidebar (SmartDocs)"
            style={{ cursor: 'pointer', margin: '0 auto' }}
          >
            <Layers size={18} />
          </div>
        )}
      </div>

      {/* Studio Action Trigger */}
      <div className="sidebar-action-box" ref={actionMenuRef}>
        <button
          className="btn-studio-action"
          onClick={() => setShowNewMenu(!showNewMenu)}
          title={isCollapsed ? 'Tạo mới & Tải lên' : 'Tạo thư mục hoặc tải lên tệp mới'}
          aria-label="Tạo mới & Tải lên"
        >
          <div className="btn-studio-action-content">
            <Plus size={16} />
            <span>Tạo mới & Tải lên</span>
          </div>
          <ChevronDown size={14} style={{ opacity: 0.8 }} />
        </button>

        {showNewMenu && (
          <div className="studio-action-dropdown">
            <button
              className="studio-action-item"
              onClick={() => {
                setShowNewMenu(false);
                onOpenCreateFolder && onOpenCreateFolder();
              }}
            >
              <FolderPlus size={16} style={{ color: 'var(--primary-600)' }} />
              <span>Thư mục mới</span>
            </button>
            <button
              className="studio-action-item"
              onClick={() => {
                setShowNewMenu(false);
                onOpenUpload && onOpenUpload();
              }}
            >
              <UploadCloud size={16} style={{ color: 'var(--accent-blue)' }} />
              <span>Tải tệp tin lên</span>
            </button>
            <button
              className="studio-action-item"
              onClick={() => {
                setShowNewMenu(false);
                onOpenUploadFolder && onOpenUploadFolder();
              }}
            >
              <FolderUp size={16} style={{ color: 'var(--primary-color)' }} />
              <span>Tải thư mục lên</span>
            </button>
          </div>
        )}
      </div>

      {/* Navigation Links */}
      <nav
        className="sidebar-nav"
        onClick={(e) => {
          if (e.target.closest('a') && onCloseMobile) {
            onCloseMobile();
          }
        }}
      >
        <NavLink
          to="/home"
          end
          className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          title="Trang chủ"
        >
          <Home size={17} />
          <span>Trang chủ</span>
        </NavLink>

        <NavLink
          to="/drive"
          end
          className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          title="Drive của tôi"
        >
          <HardDrive size={17} />
          <span>Drive của tôi</span>
        </NavLink>

        <NavLink
          to="/automation"
          className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          title="Tự động hóa & AI"
        >
          <Zap size={17} />
          <span>Tự động hóa</span>
        </NavLink>

        <NavLink
          to="/drive/cleanup"
          className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          title="Dọn dẹp & Trùng lặp"
        >
          <Broom size={17} />
          <span>Dọn dẹp & Trùng lặp</span>
        </NavLink>

        <NavLink
          to="/starred"
          className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          title="Có gắn dấu sao"
        >
          <Star size={17} />
          <span>Có gắn dấu sao</span>
        </NavLink>

        <NavLink
          to="/shares/shared-with-me"
          className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          title="Được chia sẻ với tôi"
        >
          <Users size={17} />
          <span>Được chia sẻ</span>
        </NavLink>

        <NavLink
          to="/shares/shared-by-me"
          className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          title="Tôi đã chia sẻ"
        >
          <Share2 size={17} />
          <span>Tôi đã chia sẻ</span>
        </NavLink>

        <NavLink
          to="/trash"
          className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          title="Thùng rác"
        >
          <Trash2 size={17} />
          <span>Thùng rác</span>
        </NavLink>

        {isAdmin && (
          <>
            <div className="sidebar-section-title">Hệ thống</div>
            <NavLink
              to="/admin/users"
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
              title="Quản trị người dùng"
            >
              <Shield size={17} />
              <span>Quản trị người dùng</span>
            </NavLink>
            <NavLink
              to="/admin/logs"
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
              title="Nhật ký kiểm toán"
            >
              <ShieldCheck size={17} />
              <span>Nhật ký hệ thống</span>
            </NavLink>
          </>
        )}

        {/* Khu vực thư mục: Đã ghim / Gần đây / Cây đầy đủ */}
        <div className="sidebar-folders-section">
          <div className="sidebar-folders-header">
            <span className="sidebar-section-title">Thư mục</span>
            <div className="sidebar-folder-tabs">
              <button
                type="button"
                className={`sidebar-folder-tab-btn ${folderViewTab === 'pinned' ? 'active' : ''}`}
                onClick={() => handleTabChange('pinned')}
                title="Thư mục đã ghim"
              >
                <Pin size={11} />
                <span className="tab-label">Ghim</span>
                {pinnedFolders.length > 0 && <span className="tab-badge">{pinnedFolders.length}</span>}
              </button>
              <button
                type="button"
                className={`sidebar-folder-tab-btn ${folderViewTab === 'recent' ? 'active' : ''}`}
                onClick={() => handleTabChange('recent')}
                title="Thư mục gần đây"
              >
                <Clock size={11} />
                <span className="tab-label">Gần đây</span>
              </button>
              <button
                type="button"
                className={`sidebar-folder-tab-btn ${folderViewTab === 'tree' ? 'active' : ''}`}
                onClick={() => handleTabChange('tree')}
                title="Cây thư mục phân cấp"
              >
                <Network size={11} />
                <span className="tab-label">Cây</span>
              </button>
            </div>
          </div>

          <div className="sidebar-tree-container">
            {folderViewTab === 'pinned' ? (
              pinnedFolders.length === 0 ? (
                <div className="sidebar-folder-empty-hint">
                  <Pin size={13} style={{ opacity: 0.5, marginBottom: '2px' }} />
                  <span>Chưa có thư mục ghim. Nhấn 📌 trên thư mục để truy cập nhanh tại đây.</span>
                </div>
              ) : (
                <div className="sidebar-folder-mini-list">
                  {pinnedFolders.map((folder) => (
                    <div
                      key={folder._id}
                      className="sidebar-folder-mini-item"
                      onClick={() => handleSelectFolder(folder._id)}
                      title={`Thư mục: ${folder.name}`}
                    >
                      <FolderIcon
                        size={15}
                        style={{
                          color: folder.color || 'var(--primary-500)',
                          fill: folder.color ? `${folder.color}33` : 'rgba(99, 102, 241, 0.2)'
                        }}
                      />
                      <span className="mini-folder-name">{folder.name}</span>
                      <Pin size={11} className="mini-folder-pinned-icon" />
                    </div>
                  ))}
                </div>
              )
            ) : folderViewTab === 'recent' ? (
              recentFolders.length === 0 ? (
                <div className="sidebar-folder-empty-hint">
                  <Clock size={13} style={{ opacity: 0.5, marginBottom: '2px' }} />
                  <span>Chưa có thư mục nào</span>
                </div>
              ) : (
                <div className="sidebar-folder-mini-list">
                  {recentFolders.map((folder) => (
                    <div
                      key={folder._id}
                      className="sidebar-folder-mini-item"
                      onClick={() => handleSelectFolder(folder._id)}
                      title={`Cập nhật: ${new Date(folder.updatedAt).toLocaleDateString('vi-VN')}`}
                    >
                      <FolderIcon
                        size={15}
                        style={{
                          color: folder.color || 'var(--primary-500)',
                          fill: folder.color ? `${folder.color}33` : 'rgba(99, 102, 241, 0.2)'
                        }}
                      />
                      <span className="mini-folder-name">{folder.name}</span>
                      <span className="mini-folder-file-count">{folder.fileCount ?? 0} tệp</span>
                    </div>
                  ))}
                </div>
              )
            ) : (
              <FolderTree
                tree={folderTree}
                folders={folderTree}
                onSelectFolder={handleSelectFolder}
              />
            )}
          </div>
        </div>
      </nav>

      {/* Storage Footer */}
      <div
        className="sidebar-footer"
        title={isCollapsed ? `Dung lượng đã dùng: ${storageStats.usedFormatted || '0 B'} / 10 GB (${storageStats.percentage}%)` : undefined}
      >
        {isCollapsed ? (
          <div
            className="storage-mini-badge"
            onClick={onToggleCollapse}
            title={`Dung lượng: ${storageStats.usedFormatted || '0 B'} / 10 GB (${storageStats.percentage}%) - Nhấn để mở rộng`}
          >
            <HardDrive size={16} />
          </div>
        ) : (
          <div
            className="storage-info"
            onClick={() => navigate('/analytics')}
            style={{ cursor: 'pointer' }}
            title="Nhấn để mở trang Thống kê & Báo cáo lưu trữ"
          >
            <span className="storage-label" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>Dung lượng đã dùng</span>
              <BarChart3 size={13} style={{ opacity: 0.85 }} />
            </span>
            <span className="storage-value tabular-nums">
              {storageStats.usedFormatted || '0 B'} / 10 GB
            </span>
          </div>
        )}
        <div
          className="storage-progress-bar"
          title={`${storageStats.usedFormatted || '0 B'} / 10 GB (${storageStats.percentage}%)`}
        >
          <div
            className={`storage-progress-fill ${storageStats.percentage > 90
              ? 'is-danger'
              : storageStats.percentage > 75
                ? 'is-warning'
                : ''
              }`}
            style={{
              width: '100%',
              transform: `scaleX(${Math.min(
                1,
                storageStats.percentage > 0
                  ? Math.max(0.02, storageStats.percentage / 100)
                  : 0
              )})`
            }}
          />
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;

