import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  Sparkles,
  Zap,
  FolderInput,
  FileText,
  AlertCircle,
  CheckCheck,
  Check,
  Inbox,
  Clock,
  ExternalLink,
  Loader2
} from 'lucide-react';
import notificationService from '../../services/notificationService';
import fileService from '../../services/fileService';
import { formatTimeAgo } from '../../utils/timeAgo';

const NotificationDropdown = () => {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [filter, setFilter] = useState('all'); // 'all' | 'unread' | 'system'
  const [loading, setLoading] = useState(false);
  const [isMarkingAll, setIsMarkingAll] = useState(false);

  const dropdownRef = useRef(null);

  // Lấy dữ liệu thông báo từ backend
  const loadNotifications = async (isBackground = false) => {
    if (!isBackground) setLoading(true);
    try {
      const res = await notificationService.getNotifications({ limit: 30 });
      const notifs = res?.data?.notifications || res?.notifications || [];
      const unread = res?.data?.unreadCount ?? res?.unreadCount ?? 0;
      setNotifications(notifs);
      setUnreadCount(unread);
    } catch (err) {
      console.error('[NotificationDropdown] Lỗi khi tải thông báo:', err);
    } finally {
      if (!isBackground) setLoading(false);
    }
  };

  // Khởi tạo & Polling định kỳ mỗi 30s
  useEffect(() => {
    loadNotifications(false);

    const interval = setInterval(() => {
      loadNotifications(true);
    }, 30000);

    const handleRefresh = () => loadNotifications(true);
    window.addEventListener('drive:refresh-notifications', handleRefresh);

    return () => {
      clearInterval(interval);
      window.removeEventListener('drive:refresh-notifications', handleRefresh);
    };
  }, []);

  // Đóng dropdown khi click ra ngoài hoặc bấm phím Escape
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      window.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const toggleDropdown = () => {
    if (!isOpen) {
      loadNotifications(true);
    }
    setIsOpen((prev) => !prev);
  };

  // Đánh dấu 1 thông báo là đã đọc
  const handleMarkAsRead = async (id, e) => {
    if (e) e.stopPropagation();

    // Cập nhật UI ngay lập tức (optimistic)
    setNotifications((prev) =>
      prev.map((item) => (item._id === id ? { ...item, isRead: true } : item))
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));

    try {
      await notificationService.markAsRead(id);
    } catch (err) {
      console.error('[NotificationDropdown] Lỗi khi đánh dấu đã đọc:', err);
      loadNotifications(true);
    }
  };

  // Đánh dấu tất cả là đã đọc
  const handleMarkAllAsRead = async (e) => {
    if (e) e.stopPropagation();
    if (unreadCount === 0 || isMarkingAll) return;

    setIsMarkingAll(true);
    setNotifications((prev) => prev.map((item) => ({ ...item, isRead: true })));
    setUnreadCount(0);

    try {
      await notificationService.markAllAsRead();
    } catch (err) {
      console.error('[NotificationDropdown] Lỗi khi đánh dấu tất cả đã đọc:', err);
      loadNotifications(true);
    } finally {
      setIsMarkingAll(false);
    }
  };

  // Xử lý khi click vào 1 item thông báo
  // Xử lý khi click vào 1 item thông báo hoặc nút Xem tệp
  const handleItemClick = async (item) => {
    if (!item.isRead) {
      handleMarkAsRead(item._id);
    }

    setIsOpen(false);

    // Nếu thông báo liên kết với tệp hoặc thư mục, điều hướng chính xác tới vị trí của tệp
    if (item.file) {
      const fileId = typeof item.file === 'object' ? item.file._id : item.file;
      let targetFolderId = null;

      // Ưu tiên đọc folder đã populate trong notification
      if (item.file && typeof item.file === 'object' && item.file.folder !== undefined) {
        targetFolderId = item.file.folder ? (item.file.folder._id || item.file.folder) : null;
      }

      // Truy vấn thông tin tệp mới nhất từ server để đảm bảo không bị sai lệch nếu tệp vừa được chuyển thư mục
      try {
        const res = await fileService.getFileById(fileId);
        const fileData = res?.data?.file || res?.data;
        if (fileData) {
          targetFolderId = fileData.folder ? (fileData.folder._id || fileData.folder) : null;
        }
      } catch (err) {
        console.warn('[NotificationDropdown] Không thể lấy thông tin tệp mới nhất, sử dụng vị trí lưu trong thông báo:', err);
      }

      const targetPath = targetFolderId && targetFolderId !== 'root'
        ? `/drive/folder/${targetFolderId}`
        : '/drive';

      // Điều hướng tới đúng thư mục và truyền state highlightFileId
      navigate(targetPath, { state: { highlightFileId: fileId } });

      // Phát sự kiện toàn cục để MyDrivePage chọn tệp và mở Inspector
      setTimeout(() => {
        window.dispatchEvent(
          new CustomEvent('drive:select-file', {
            detail: { fileId, folderId: targetFolderId }
          })
        );
      }, 100);
    }
  };

  // Lọc thông báo theo tab
  const filteredNotifications = notifications.filter((item) => {
    if (filter === 'unread') return !item.isRead;
    if (filter === 'system') return item.type === 'ai' || item.type === 'automation';
    return true;
  });

  // Render icon theo loại thông báo
  const renderTypeIcon = (type, title = '') => {
    const isMoveFile = title.toLowerCase().includes('chuyển') || title.toLowerCase().includes('move');

    if (type === 'ai') {
      return (
        <div className="notif-type-icon notif-type-ai" title="AI phân tích">
          <Sparkles size={16} />
        </div>
      );
    }

    if (type === 'automation') {
      if (isMoveFile) {
        return (
          <div className="notif-type-icon notif-type-move" title="Tự động di chuyển tệp">
            <FolderInput size={16} />
          </div>
        );
      }
      return (
        <div className="notif-type-icon notif-type-auto" title="Tự động hóa">
          <Zap size={16} />
        </div>
      );
    }

    if (type === 'warning') {
      return (
        <div className="notif-type-icon notif-type-warning" title="Cảnh báo">
          <AlertCircle size={16} />
        </div>
      );
    }

    return (
      <div className="notif-type-icon notif-type-info" title="Thông tin">
        <FileText size={16} />
      </div>
    );
  };

  return (
    <div className="notification-menu-container" ref={dropdownRef}>
      {/* Nút Chuông Thông Báo */}
      <button
        className={`btn-icon notification-trigger-btn ${isOpen ? 'is-active' : ''} ${unreadCount > 0 ? 'has-unread' : ''
          }`}
        onClick={toggleDropdown}
        title="Thông báo hệ thống"
        aria-label="Thông báo"
        aria-expanded={isOpen}
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="notification-badge" key={unreadCount}>
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div className="notification-dropdown-panel" role="region" aria-label="Hộp thông báo">
          {/* Header */}
          <div className="notif-panel-header">
            <div className="notif-header-title-box">
              <span className="notif-header-title">Thông báo</span>
              {unreadCount > 0 ? (
                <span className="notif-unread-pill">{unreadCount} mới</span>
              ) : (
                <span className="notif-all-read-pill">Đã cập nhật</span>
              )}
            </div>

            <button
              className="notif-mark-all-btn"
              onClick={handleMarkAllAsRead}
              disabled={unreadCount === 0 || isMarkingAll}
              title="Đánh dấu tất cả là đã đọc"
            >
              {isMarkingAll ? (
                <Loader2 size={13} className="spin-icon" />
              ) : (
                <CheckCheck size={14} />
              )}
              <span>Đã đọc tất cả</span>
            </button>
          </div>

          {/* Filter Tabs */}
          <div className="notif-filter-tabs">
            <button
              className={`notif-tab ${filter === 'all' ? 'active' : ''}`}
              onClick={() => setFilter('all')}
            >
              Tất cả
              <span className="notif-tab-count">{notifications.length}</span>
            </button>
            <button
              className={`notif-tab ${filter === 'unread' ? 'active' : ''}`}
              onClick={() => setFilter('unread')}
            >
              Chưa đọc
              {unreadCount > 0 && <span className="notif-tab-count unread">{unreadCount}</span>}
            </button>
            <button
              className={`notif-tab ${filter === 'system' ? 'active' : ''}`}
              onClick={() => setFilter('system')}
            >
              AI & Tự động
            </button>
          </div>

          {/* Body Content */}
          <div className="notif-panel-body">
            {loading && notifications.length === 0 ? (
              <div className="notif-loading-state">
                <Loader2 size={24} className="spin-icon" />
                <span>Đang tải thông báo...</span>
              </div>
            ) : filteredNotifications.length === 0 ? (
              <div className="notif-empty-state">
                <div className="notif-empty-icon">
                  <Inbox size={32} />
                </div>
                <div className="notif-empty-title">
                  {filter === 'unread'
                    ? 'Không có thông báo chưa đọc'
                    : filter === 'system'
                      ? 'Chưa có thông báo AI & Tự động'
                      : 'Hộp thông báo trống'}
                </div>
                <div className="notif-empty-desc">
                  Mọi cập nhật phân tích AI và quy tắc tự động hóa sẽ hiển thị tại đây.
                </div>
              </div>
            ) : (
              <div className="notif-list">
                {filteredNotifications.map((item) => (
                  <div
                    key={item._id}
                    className={`notif-item ${!item.isRead ? 'is-unread' : ''}`}
                    onClick={() => handleItemClick(item)}
                  >
                    {/* Icon container */}
                    <div className="notif-item-left">
                      {renderTypeIcon(item.type, item.title)}
                    </div>

                    {/* Text container */}
                    <div className="notif-item-content">
                      <div className="notif-item-top">
                        <span className="notif-item-title">{item.title}</span>
                        <div className="notif-item-meta">
                          <span className="notif-item-time" title={item.createdAt}>
                            <Clock size={11} />
                            {formatTimeAgo(item.createdAt)}
                          </span>
                          {!item.isRead && <span className="notif-unread-dot" />}
                        </div>
                      </div>

                      <p className="notif-item-message">{item.message}</p>

                      {/* Footer tags & quick actions */}
                      <div className="notif-item-footer">
                        {item.file && (
                          <button
                            type="button"
                            className="notif-file-tag"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleItemClick(item);
                            }}
                            title="Đi tới vị trí của tệp tin"
                          >
                            <ExternalLink size={11} />
                            <span>Xem tệp</span>
                          </button>
                        )}

                        {!item.isRead && (
                          <button
                            className="notif-quick-read-btn"
                            onClick={(e) => handleMarkAsRead(item._id, e)}
                            title="Đánh dấu đã đọc"
                          >
                            <Check size={12} />
                            <span>Đã đọc</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationDropdown;
