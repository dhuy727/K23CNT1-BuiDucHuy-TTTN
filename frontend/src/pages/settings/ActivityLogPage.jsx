import React, { useState, useEffect, useCallback } from 'react';
import {
  Clock,
  RefreshCw,
  Upload,
  Download,
  Eye,
  Edit3,
  FolderPlus,
  Trash2,
  RotateCcw,
  Star,
  LogIn,
  Shield,
  FileText,
  Folder,
  Layers,
  Search
} from 'lucide-react';
import activityService from '../../services/activityService';
import Pagination from '../../components/common/Pagination';
import EmptyState from '../../components/common/EmptyState';
import { useToast } from '../../contexts/ToastContext';

const getActionDetails = (action) => {
  switch (action) {
    case 'file_upload':
      return { icon: <Upload size={18} />, colorClass: 'upload', label: 'Tải lên tệp' };
    case 'file_download':
      return { icon: <Download size={18} />, colorClass: 'download', label: 'Tải xuống tệp' };
    case 'file_preview':
      return { icon: <Eye size={18} />, colorClass: 'preview', label: 'Xem trước tệp' };
    case 'file_rename':
      return { icon: <Edit3 size={18} />, colorClass: 'edit', label: 'Đổi tên tệp' };
    case 'file_move':
    case 'file_copy':
      return { icon: <Layers size={18} />, colorClass: 'edit', label: 'Di chuyển / Sao chép' };
    case 'file_trash':
    case 'file_delete_permanent':
    case 'folder_trash':
    case 'folder_delete_permanent':
      return { icon: <Trash2 size={18} />, colorClass: 'delete', label: 'Xóa tệp/thư mục' };
    case 'file_restore':
    case 'folder_restore':
      return { icon: <RotateCcw size={18} />, colorClass: 'upload', label: 'Khôi phục' };
    case 'file_star':
      return { icon: <Star size={18} />, colorClass: 'star', label: 'Gắn dấu sao' };
    case 'folder_create':
    case 'folder_rename':
    case 'folder_move':
      return { icon: <FolderPlus size={18} />, colorClass: 'edit', label: 'Thao tác thư mục' };
    case 'auth_login':
    case 'auth_logout':
    case 'auth_password_change':
      return { icon: <LogIn size={18} />, colorClass: 'auth', label: 'Tài khoản & Bảo mật' };
    case 'admin_user_update':
    case 'admin_user_delete':
      return { icon: <Shield size={18} />, colorClass: 'admin', label: 'Quản trị' };
    default:
      return { icon: <FileText size={18} />, colorClass: 'preview', label: 'Khác' };
  }
};

const formatActivityTime = (dateString) => {
  if (!dateString) return '';
  const d = new Date(dateString);
  return d.toLocaleString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
};

const ActivityLogPage = () => {
  const [activities, setActivities] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionGroup, setActionGroup] = useState('');
  const [timeRange, setTimeRange] = useState('');
  const [page, setPage] = useState(1);

  const toast = useToast();

  const fetchActivities = useCallback(async () => {
    setLoading(true);
    try {
      const res = await activityService.getMyActivities({
        page,
        limit: 15,
        actionGroup: actionGroup || undefined,
        timeRange: timeRange || undefined
      });
      setActivities(res.data || []);
      setPagination(res.metadata || null);
    } catch (err) {
      console.error('Lỗi khi tải lịch sử thao tác:', err);
      toast.error('Không thể tải lịch sử thao tác');
    } finally {
      setLoading(false);
    }
  }, [page, actionGroup, timeRange]);

  useEffect(() => {
    fetchActivities();
  }, [fetchActivities]);

  return (
    <main className="page-body">
      <div className="activity-page">
        {/* Header */}
        <div className="activity-header">
          <div className="activity-title-group">
            <div className="activity-title-icon">
              <Clock size={22} />
            </div>
            <div className="activity-title-text">
              <h1>Lịch sử thao tác của bạn</h1>
              <p>Theo dõi mọi nhật ký truy cập, tải lên, xem trước, chỉnh sửa và xóa tài liệu</p>
            </div>
          </div>

          <button
            className="btn btn-secondary"
            onClick={fetchActivities}
            disabled={loading}
            title="Làm mới"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <RefreshCw size={15} className={loading ? 'spinner' : ''} />
            <span>Làm mới</span>
          </button>
        </div>

        {/* Filter Bar */}
        <div className="activity-filter-bar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-muted)' }}>Thời gian:</span>
            <select
              className="form-select"
              style={{ width: '150px', padding: '6px 10px', fontSize: '0.825rem' }}
              value={timeRange}
              onChange={(e) => {
                setTimeRange(e.target.value);
                setPage(1);
              }}
            >
              <option value="">Tất cả thời gian</option>
              <option value="today">Hôm nay</option>
              <option value="yesterday">Hôm qua</option>
              <option value="7days">7 ngày gần nhất</option>
              <option value="30days">30 ngày gần nhất</option>
              <option value="thismonth">Tháng này</option>
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-muted)' }}>Loại thao tác:</span>
            <select
              className="form-select"
              style={{ width: '180px', padding: '6px 10px', fontSize: '0.825rem' }}
              value={actionGroup}
              onChange={(e) => {
                setActionGroup(e.target.value);
                setPage(1);
              }}
            >
              <option value="">Tất cả thao tác</option>
              <option value="files">Thao tác tài liệu (Tệp tin)</option>
              <option value="folders">Thao tác thư mục</option>
              <option value="auth">Đăng nhập & Tài khoản</option>
            </select>
          </div>
        </div>

        {/* Content list */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '80px 20px', color: 'var(--text-muted)' }}>
            <span className="spinner" style={{ width: 36, height: 36, margin: '0 auto' }} />
            <div style={{ marginTop: '16px' }}>Đang nạp nhật ký thao tác...</div>
          </div>
        ) : activities.length === 0 ? (
          <EmptyState
            icon={Clock}
            title="Chưa có nhật ký thao tác nào"
            description="Mọi hành động tải lên, xem trước, tải về hoặc xóa tệp tin sẽ được ghi nhận và hiển thị tại đây."
          />
        ) : (
          <>
            <div className="activity-timeline">
              {activities.map((item) => {
                const { icon, colorClass, label } = getActionDetails(item.action);
                return (
                  <div key={item._id} className="activity-card">
                    <div className="activity-left">
                      <div className={`activity-icon-badge ${colorClass}`} title={label}>
                        {icon}
                      </div>
                      <div className="activity-content">
                        <div className="activity-desc">
                          <span>{item.description}</span>
                        </div>
                        <div className="activity-meta">
                          <span className="badge badge-slate" style={{ fontSize: '0.72rem' }}>
                            {label}
                          </span>
                          {item.targetName && (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              {item.targetType === 'folder' ? <Folder size={12} /> : <FileText size={12} />}
                              <strong>{item.targetName}</strong>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="activity-right">
                      <span className="activity-time">{formatActivityTime(item.createdAt)}</span>
                      {item.ip && <span className="activity-ip-tag">IP: {item.ip}</span>}
                    </div>
                  </div>
                );
              })}
            </div>

            <Pagination pagination={pagination} onPageChange={(p) => setPage(p)} />
          </>
        )}
      </div>
    </main>
  );
};

export default ActivityLogPage;
