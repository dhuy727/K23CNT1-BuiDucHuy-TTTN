import React, { useState, useEffect, useCallback } from 'react';
import {
  ShieldCheck,
  RefreshCw,
  Search,
  Clock,
  Filter,
  User,
  FileText,
  Folder,
  Layers,
  Upload,
  Download,
  Eye,
  Edit3,
  Trash2,
  RotateCcw,
  Star,
  LogIn,
  Shield
} from 'lucide-react';
import activityService from '../../services/activityService';
import Pagination from '../../components/common/Pagination';
import EmptyState from '../../components/common/EmptyState';
import { useToast } from '../../contexts/ToastContext';

const getActionDetails = (action) => {
  switch (action) {
    case 'file_upload':
      return { icon: <Upload size={15} />, colorClass: 'upload', badgeClass: 'badge-emerald', label: 'Tải lên' };
    case 'file_download':
      return { icon: <Download size={15} />, colorClass: 'download', badgeClass: 'badge-blue', label: 'Tải xuống' };
    case 'file_preview':
      return { icon: <Eye size={15} />, colorClass: 'preview', badgeClass: 'badge-purple', label: 'Xem trước' };
    case 'file_rename':
      return { icon: <Edit3 size={15} />, colorClass: 'edit', badgeClass: 'badge-amber', label: 'Đổi tên' };
    case 'file_move':
    case 'file_copy':
      return { icon: <Layers size={15} />, colorClass: 'edit', badgeClass: 'badge-amber', label: 'Di chuyển/Sao chép' };
    case 'file_trash':
    case 'file_delete_permanent':
    case 'folder_trash':
    case 'folder_delete_permanent':
      return { icon: <Trash2 size={15} />, colorClass: 'delete', badgeClass: 'badge-rose', label: 'Xóa' };
    case 'file_restore':
    case 'folder_restore':
      return { icon: <RotateCcw size={15} />, colorClass: 'upload', badgeClass: 'badge-emerald', label: 'Khôi phục' };
    case 'file_star':
      return { icon: <Star size={15} />, colorClass: 'star', badgeClass: 'badge-amber', label: 'Dấu sao' };
    case 'folder_create':
    case 'folder_rename':
    case 'folder_move':
      return { icon: <Folder size={15} />, colorClass: 'edit', badgeClass: 'badge-blue', label: 'Thư mục' };
    case 'auth_login':
    case 'auth_logout':
    case 'auth_password_change':
      return { icon: <LogIn size={15} />, colorClass: 'auth', badgeClass: 'badge-slate', label: 'Xác thực' };
    case 'admin_user_update':
    case 'admin_user_delete':
      return { icon: <Shield size={15} />, colorClass: 'admin', badgeClass: 'badge-rose', label: 'Quản trị' };
    default:
      return { icon: <FileText size={15} />, colorClass: 'preview', badgeClass: 'badge-slate', label: 'Khác' };
  }
};

const formatAuditTime = (dateString) => {
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

const AuditLogsPage = () => {
  const [logs, setLogs] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  // Filters
  const [actionGroup, setActionGroup] = useState('');
  const [timeRange, setTimeRange] = useState('');
  const [search, setSearch] = useState('');

  const toast = useToast();

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await activityService.getSystemActivities({
        page,
        limit: 20,
        actionGroup: actionGroup || undefined,
        timeRange: timeRange || undefined,
        search: search.trim() || undefined
      });
      setLogs(res.data || []);
      setPagination(res.metadata || null);
    } catch (err) {
      console.error('Lỗi khi tải nhật ký kiểm toán hệ thống:', err);
      toast.error('Không thể tải nhật ký kiểm toán hệ thống');
    } finally {
      setLoading(false);
    }
  }, [page, actionGroup, timeRange, search]);

  useEffect(() => {
    fetchLogs();
  }, [page, actionGroup, timeRange]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    fetchLogs();
  };

  return (
    <main className="page-body">
      <div className="activity-page">
        {/* Header */}
        <div className="activity-header">
          <div className="activity-title-group">
            <div className="activity-title-icon" style={{ background: 'rgba(236, 72, 153, 0.15)', color: 'var(--accent-rose)' }}>
              <ShieldCheck size={22} />
            </div>
            <div className="activity-title-text">
              <h1>Nhật ký kiểm toán hệ thống (Audit Logs)</h1>
              <p>Giám sát toàn bộ hoạt động truy cập, tải lên, xóa và phân quyền của tất cả người dùng</p>
            </div>
          </div>

          <button
            className="btn btn-secondary"
            onClick={fetchLogs}
            disabled={loading}
            title="Làm mới dữ liệu"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <RefreshCw size={15} className={loading ? 'spinner' : ''} />
            <span>Làm mới</span>
          </button>
        </div>

        {/* Filter Bar */}
        <div className="activity-filter-bar" style={{ justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-muted)' }}>Thời gian:</span>
              <select
                className="form-select"
                style={{ width: '145px', padding: '6px 10px', fontSize: '0.825rem' }}
                value={timeRange}
                onChange={(e) => {
                  setTimeRange(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">Tất cả thời gian</option>
                <option value="today">Hôm nay</option>
                <option value="yesterday">Hôm qua</option>
                <option value="7days">7 ngày qua</option>
                <option value="30days">30 ngày qua</option>
                <option value="thismonth">Tháng này</option>
              </select>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-muted)' }}>Phân nhóm:</span>
              <select
                className="form-select"
                style={{ width: '160px', padding: '6px 10px', fontSize: '0.825rem' }}
                value={actionGroup}
                onChange={(e) => {
                  setActionGroup(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">Tất cả hành động</option>
                <option value="files">Tài liệu (Tệp tin)</option>
                <option value="folders">Thư mục</option>
                <option value="auth">Đăng nhập / Thoát</option>
                <option value="admin">Thay đổi phân quyền</option>
              </select>
            </div>
          </div>

          <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '8px' }}>
            <div className="search-input-wrapper" style={{ width: '260px', borderRadius: 'var(--radius-md)' }}>
              <Search size={15} style={{ color: 'var(--text-muted)' }} />
              <input
                type="text"
                placeholder="Tìm tên tệp, IP, người dùng..."
                className="search-input"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <button className="btn btn-secondary" type="submit">
              Tìm
            </button>
          </form>
        </div>

        {/* Audit Table */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '80px 20px', color: 'var(--text-muted)' }}>
            <span className="spinner" style={{ width: 36, height: 36, margin: '0 auto' }} />
            <div style={{ marginTop: '16px' }}>Đang nạp nhật ký kiểm toán hệ thống...</div>
          </div>
        ) : logs.length === 0 ? (
          <EmptyState
            icon={ShieldCheck}
            title="Không tìm thấy nhật ký kiểm toán phù hợp"
            description="Chưa có hành động nào khớp với các tiêu chí tìm kiếm hoặc bộ lọc được chọn."
          />
        ) : (
          <>
            <div className="file-table-container">
              <table className="file-table">
                <thead>
                  <tr>
                    <th style={{ width: '18%' }}>Thời gian</th>
                    <th style={{ width: '22%' }}>Người thực hiện</th>
                    <th style={{ width: '15%' }}>Hành động</th>
                    <th style={{ width: '30%' }}>Chi tiết thao tác</th>
                    <th style={{ width: '15%', textAlign: 'right' }}>Địa chỉ IP</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => {
                    const { badgeClass, label, icon } = getActionDetails(log.action);
                    const userName = log.user?.name || log.user?.email || 'Hệ thống';
                    const userInitial = userName[0].toUpperCase();
                    return (
                      <tr key={log._id}>
                        <td style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                          {formatAuditTime(log.createdAt)}
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div className="avatar-circle" style={{ width: 26, height: 26, fontSize: '0.75rem' }}>
                              {userInitial}
                            </div>
                            <div>
                              <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.84rem' }}>
                                {log.user?.name || 'Ẩn danh'}
                              </div>
                              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                {log.user?.email || ''}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span
                            className={`badge ${badgeClass}`}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                          >
                            {icon}
                            <span>{label}</span>
                          </span>
                        </td>
                        <td>
                          <div style={{ fontSize: '0.84rem', color: 'var(--text-primary)', fontWeight: 500 }}>
                            {log.description}
                          </div>
                          {log.targetName && (
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              {log.targetType === 'folder' ? <Folder size={11} /> : <FileText size={11} />}
                              <span>{log.targetName}</span>
                            </div>
                          )}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <span className="activity-ip-tag">{log.ip || '-'}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <Pagination pagination={pagination} onPageChange={(p) => setPage(p)} />
          </>
        )}
      </div>
    </main>
  );
};

export default AuditLogsPage;
