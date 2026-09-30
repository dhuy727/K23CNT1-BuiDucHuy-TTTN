import React, { useState, useEffect, useCallback } from 'react';
import {
  BarChart3,
  HardDrive,
  FileText,
  Folder,
  Trash2,
  Star,
  Users,
  Sparkles,
  TrendingUp,
  RefreshCw,
  PieChart,
  Shield,
  Layers,
  ChevronRight
} from 'lucide-react';
import analyticsService from '../../services/analyticsService';
import DonutChart from '../../components/analytics/DonutChart';
import TrendChart from '../../components/analytics/TrendChart';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { useNavigate } from 'react-router-dom';

const AnalyticsPage = () => {
  const { isAdmin } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('personal'); // 'personal' | 'system'
  const [personalData, setPersonalData] = useState(null);
  const [systemData, setSystemData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    try {
      if (activeTab === 'personal') {
        const res = await analyticsService.getMyAnalytics();
        setPersonalData(res.data);
      } else if (activeTab === 'system' && isAdmin) {
        const res = await analyticsService.getSystemAnalytics();
        setSystemData(res.data);
      }
    } catch (err) {
      console.error('Lỗi khi tải dữ liệu thống kê:', err);
      toast.error('Không thể tải dữ liệu thống kê báo cáo');
    } finally {
      setLoading(false);
    }
  }, [activeTab, isAdmin]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  const overview = personalData?.overview || {};

  return (
    <main className="page-body">
      <div className="analytics-page">
        {/* Header */}
        <div className="analytics-header">
          <div className="analytics-title-group">
            <div className="analytics-title-icon">
              <BarChart3 size={24} />
            </div>
            <div className="analytics-title-text">
              <h1>Thống kê & Báo cáo lưu trữ</h1>
              <p>Báo cáo trực quan về số lượng, dung lượng và phân bổ tài liệu</p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {isAdmin && (
              <div className="analytics-tab-group">
                <button
                  className={`analytics-tab-btn ${activeTab === 'personal' ? 'active' : ''}`}
                  onClick={() => setActiveTab('personal')}
                >
                  <HardDrive size={15} />
                  <span>Của tôi</span>
                </button>
                <button
                  className={`analytics-tab-btn ${activeTab === 'system' ? 'active' : ''}`}
                  onClick={() => setActiveTab('system')}
                >
                  <Shield size={15} />
                  <span>Toàn hệ thống</span>
                </button>
              </div>
            )}

            <button
              className="btn btn-secondary"
              onClick={fetchAnalytics}
              disabled={loading}
              title="Làm mới số liệu"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <RefreshCw size={15} className={loading ? 'spinner' : ''} />
              <span>Làm mới</span>
            </button>
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '100px 20px', color: 'var(--text-muted)' }}>
            <span className="spinner" style={{ width: 36, height: 36, margin: '0 auto' }} />
            <div style={{ marginTop: '16px', fontSize: '0.875rem' }}>Đang tổng hợp báo cáo dữ liệu...</div>
          </div>
        ) : activeTab === 'personal' ? (
          <>
            {/* Storage Quota Gauge Banner */}
            <div className="analytics-quota-banner">
              <div className="analytics-quota-header">
                <div className="analytics-quota-title">
                  <HardDrive size={18} style={{ color: 'var(--primary-600)' }} />
                  <span>Dung lượng tài khoản</span>
                </div>
                <div className="analytics-quota-value">
                  <span style={{ color: 'var(--primary-600)' }}>{overview.usedFormatted || '0 B'}</span> / 10 GB
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginLeft: '8px' }}>
                    ({overview.percentage || 0}%)
                  </span>
                </div>
              </div>

              <div className="storage-progress-bar" style={{ height: '10px' }}>
                <div
                  className={`storage-progress-fill ${
                    overview.percentage > 90 ? 'is-danger' : overview.percentage > 75 ? 'is-warning' : ''
                  }`}
                  style={{
                    width: `${Math.min(100, Math.max(1, overview.percentage || 0))}%`
                  }}
                />
              </div>

              <div className="analytics-gauge-meter">
                <span>0 GB</span>
                <span>2.5 GB</span>
                <span>5 GB</span>
                <span>7.5 GB</span>
                <span>10 GB (Giới hạn)</span>
              </div>
            </div>

            {/* KPI Cards Grid */}
            <div className="analytics-kpi-grid">
              <div className="analytics-kpi-card">
                <div className="analytics-kpi-info">
                  <span className="analytics-kpi-label">Tổng tệp tài liệu</span>
                  <span className="analytics-kpi-value">{overview.totalFiles || 0}</span>
                  <span className="analytics-kpi-sub">{overview.activeFiles || 0} tệp đang hoạt động</span>
                </div>
                <div className="analytics-kpi-icon" style={{ background: 'rgba(59, 130, 246, 0.12)', color: '#3B82F6' }}>
                  <FileText size={22} />
                </div>
              </div>

              <div className="analytics-kpi-card">
                <div className="analytics-kpi-info">
                  <span className="analytics-kpi-label">Thư mục làm việc</span>
                  <span className="analytics-kpi-value">{overview.totalFolders || 0}</span>
                  <span className="analytics-kpi-sub">Cây phân cấp dữ liệu</span>
                </div>
                <div className="analytics-kpi-icon" style={{ background: 'rgba(16, 185, 129, 0.12)', color: '#10B981' }}>
                  <Folder size={22} />
                </div>
              </div>

              <div className="analytics-kpi-card">
                <div className="analytics-kpi-info">
                  <span className="analytics-kpi-label">Thùng rác có thể dọn</span>
                  <span className="analytics-kpi-value">{overview.trashFormatted || '0 B'}</span>
                  <span className="analytics-kpi-sub">{overview.trashFiles || 0} tệp đang lưu tạm</span>
                </div>
                <div className="analytics-kpi-icon" style={{ background: 'rgba(239, 68, 68, 0.12)', color: '#EF4444' }}>
                  <Trash2 size={22} />
                </div>
              </div>

              <div className="analytics-kpi-card">
                <div className="analytics-kpi-info">
                  <span className="analytics-kpi-label">Tài liệu gắn sao</span>
                  <span className="analytics-kpi-value">{overview.totalStarred || 0}</span>
                  <span className="analytics-kpi-sub">Mục đánh dấu ưu tiên</span>
                </div>
                <div className="analytics-kpi-icon" style={{ background: 'rgba(245, 158, 11, 0.12)', color: '#F59E0B' }}>
                  <Star size={22} />
                </div>
              </div>
            </div>

            {/* Charts Section: Donut + Bar Trend */}
            <div className="analytics-charts-grid">
              {/* Phân bổ theo loại tệp (Donut) */}
              <div className="analytics-chart-panel">
                <div className="analytics-chart-header">
                  <div className="analytics-chart-title">
                    <PieChart size={17} style={{ color: 'var(--primary-600)' }} />
                    <span>Phân bổ dung lượng theo loại tệp</span>
                  </div>
                </div>

                <DonutChart
                  items={personalData?.fileTypeBreakdown || []}
                  totalFormatted={overview.activeFormatted || '0 B'}
                  totalLabel="Đang dùng"
                />
              </div>

              {/* Xu hướng tải lên 7 ngày qua (Bar Trend) */}
              <div className="analytics-chart-panel">
                <div className="analytics-chart-header">
                  <div className="analytics-chart-title">
                    <TrendingUp size={17} style={{ color: 'var(--accent-blue)' }} />
                    <span>Lượng tài liệu tải lên (7 ngày qua)</span>
                  </div>
                </div>

                <TrendChart data={personalData?.timelineTrend || []} />
              </div>
            </div>

            {/* Phân bổ theo Danh mục AI */}
            {personalData?.categoryBreakdown && personalData.categoryBreakdown.length > 0 && (
              <div className="analytics-chart-panel" style={{ marginBottom: '24px' }}>
                <div className="analytics-chart-header">
                  <div className="analytics-chart-title">
                    <Sparkles size={17} style={{ color: 'var(--accent-purple)' }} />
                    <span>Phân bổ theo Danh mục thông minh (AI)</span>
                  </div>
                </div>

                <div className="category-progress-list">
                  {personalData.categoryBreakdown.map((cat, idx) => (
                    <div key={idx} className="category-row">
                      <div className="category-row-header">
                        <span className="category-row-name">
                          <span>{cat.name}</span>
                          <span className="badge badge-purple" style={{ fontSize: '0.7rem' }}>
                            {cat.count} tệp
                          </span>
                        </span>
                        <span className="category-row-stats">
                          {cat.formattedSize} ({cat.percent}%)
                        </span>
                      </div>
                      <div className="category-bar-bg">
                        <div
                          className="category-bar-fill"
                          style={{
                            width: `${Math.max(2, cat.percent)}%`,
                            background:
                              idx === 0
                                ? 'var(--primary-600)'
                                : idx === 1
                                ? 'var(--accent-blue)'
                                : idx === 2
                                ? 'var(--accent-purple)'
                                : 'var(--text-muted)'
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Top 5 tệp có dung lượng lớn nhất */}
            {personalData?.largestFiles && personalData.largestFiles.length > 0 && (
              <div className="analytics-chart-panel">
                <div className="analytics-chart-header">
                  <div className="analytics-chart-title">
                    <Layers size={17} style={{ color: 'var(--accent-amber)' }} />
                    <span>Tệp tin chiếm nhiều dung lượng nhất</span>
                  </div>
                  <button
                    className="btn btn-secondary"
                    style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                    onClick={() => navigate('/drive/cleanup')}
                  >
                    <span>Dọn dẹp tệp lớn</span>
                    <ChevronRight size={13} />
                  </button>
                </div>

                <div className="file-table-container">
                  <table className="file-table">
                    <thead>
                      <tr>
                        <th>Tên tệp tin</th>
                        <th>Định dạng</th>
                        <th>Dung lượng</th>
                        <th style={{ textAlign: 'right' }}>Ngày tạo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {personalData.largestFiles.map((f) => (
                        <tr key={f._id}>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <FileText size={16} style={{ color: 'var(--primary-600)' }} />
                              <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{f.name}</span>
                            </div>
                          </td>
                          <td>
                            <span className="badge badge-slate">
                              {(f.extension || 'FILE').toUpperCase()}
                            </span>
                          </td>
                          <td style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                            {f.formattedSize}
                          </td>
                          <td style={{ textAlign: 'right', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                            {new Date(f.createdAt).toLocaleDateString('vi-VN')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        ) : (
          /* SYSTEM OVERVIEW TAB (ADMIN ONLY) */
          <>
            <div className="analytics-kpi-grid">
              <div className="analytics-kpi-card">
                <div className="analytics-kpi-info">
                  <span className="analytics-kpi-label">Tổng người dùng</span>
                  <span className="analytics-kpi-value">{systemData?.overview?.totalUsers || 0}</span>
                  <span className="analytics-kpi-sub">
                    {systemData?.overview?.activeUsers || 0} tài khoản đang hoạt động
                  </span>
                </div>
                <div className="analytics-kpi-icon" style={{ background: 'rgba(99, 102, 241, 0.12)', color: '#6366F1' }}>
                  <Users size={22} />
                </div>
              </div>

              <div className="analytics-kpi-card">
                <div className="analytics-kpi-info">
                  <span className="analytics-kpi-label">Dung lượng toàn Server</span>
                  <span className="analytics-kpi-value">{systemData?.overview?.totalFormatted || '0 B'}</span>
                  <span className="analytics-kpi-sub">Tổng dung lượng mọi người dùng</span>
                </div>
                <div className="analytics-kpi-icon" style={{ background: 'rgba(59, 130, 246, 0.12)', color: '#3B82F6' }}>
                  <HardDrive size={22} />
                </div>
              </div>

              <div className="analytics-kpi-card">
                <div className="analytics-kpi-info">
                  <span className="analytics-kpi-label">Tổng tệp toàn hệ thống</span>
                  <span className="analytics-kpi-value">{systemData?.overview?.totalFiles || 0}</span>
                  <span className="analytics-kpi-sub">Tất cả tệp đã tải lên</span>
                </div>
                <div className="analytics-kpi-icon" style={{ background: 'rgba(16, 185, 129, 0.12)', color: '#10B981' }}>
                  <FileText size={22} />
                </div>
              </div>

              <div className="analytics-kpi-card">
                <div className="analytics-kpi-info">
                  <span className="analytics-kpi-label">Tổng thư mục</span>
                  <span className="analytics-kpi-value">{systemData?.overview?.totalFolders || 0}</span>
                  <span className="analytics-kpi-sub">Cấu trúc thư mục</span>
                </div>
                <div className="analytics-kpi-icon" style={{ background: 'rgba(245, 158, 11, 0.12)', color: '#F59E0B' }}>
                  <Folder size={22} />
                </div>
              </div>
            </div>

            {/* Bảng xếp hạng Top người dùng sử dụng nhiều dung lượng nhất */}
            <div className="analytics-chart-panel">
              <div className="analytics-chart-header">
                <div className="analytics-chart-title">
                  <Users size={17} style={{ color: 'var(--primary-600)' }} />
                  <span>Xếp hạng người dùng sử dụng nhiều dung lượng nhất</span>
                </div>
              </div>

              <div className="file-table-container">
                <table className="file-table">
                  <thead>
                    <tr>
                      <th style={{ width: '35%' }}>Người dùng</th>
                      <th style={{ width: '15%' }}>Vai trò</th>
                      <th style={{ width: '15%' }}>Số lượng tệp</th>
                      <th style={{ width: '20%' }}>Dung lượng sử dụng</th>
                      <th style={{ width: '15%', textAlign: 'right' }}>Tỷ lệ toàn server</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(systemData?.topUsers || []).map((u) => (
                      <tr key={u._id}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div className="avatar-circle" style={{ width: 28, height: 28, fontSize: '0.75rem' }}>
                              {(u.name || u.email || 'U')[0].toUpperCase()}
                            </div>
                            <div>
                              <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{u.name}</div>
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{u.email}</div>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span className={`badge ${u.role === 'admin' ? 'badge-rose' : 'badge-blue'}`}>
                            {(u.role || 'USER').toUpperCase()}
                          </span>
                        </td>
                        <td style={{ fontWeight: 600 }}>{u.totalFiles} tệp</td>
                        <td style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                          {u.formattedSize}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <span className="badge badge-purple">{u.percentOfServer}%</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </main>
  );
};

export default AnalyticsPage;
