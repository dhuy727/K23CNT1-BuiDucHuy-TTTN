import React, { useState, useEffect, useMemo } from 'react';
import {
  Sparkles,
  RefreshCw,
  Trash2,
  HardDrive,
  Copy,
  Layers,
  FileCheck,
  CheckSquare,
  Square,
  AlertCircle,
  FileText,
  Filter,
  CheckCircle2,
  Folder as FolderIcon,
  Broom
} from 'lucide-react';
import duplicateService from '../../services/duplicateService';
import folderService from '../../services/folderService';
import fileService from '../../services/fileService';
import { formatFileSize } from '../../utils/formatters';
import DuplicateClusterCard from '../../components/drive/DuplicateClusterCard';
import SideBySideModal from '../../components/drive/SideBySideModal';
import FileIcon from '../../components/drive/FileIcon';
import '../../styles/cleanup.css';

const CleanupPage = () => {
  const [scanData, setScanData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isScanning, setIsScanning] = useState(false);
  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'exact' | 'semantic' | 'large_files'
  const [scopeFolderId, setScopeFolderId] = useState('');
  const [folders, setFolders] = useState([]);
  const [selectedFileIds, setSelectedFileIds] = useState(new Set());
  const [isCleaning, setIsCleaning] = useState(false);
  const [toast, setToast] = useState(null);

  // Dữ liệu cho tab Tệp Dung Lượng Lớn
  const [largeFilesData, setLargeFilesData] = useState(null);
  const [largeFilesLoading, setLargeFilesLoading] = useState(false);
  const [largeFilesMinMB, setLargeFilesMinMB] = useState(10); // 10, 50, 100

  // Modal So sánh song song
  const [compareModalData, setCompareModalData] = useState(null);
  const [isCompareOpen, setIsCompareOpen] = useState(false);

  useEffect(() => {
    loadFolders();
    loadScanStatus();
  }, [scopeFolderId]);

  useEffect(() => {
    if (activeTab === 'large_files') {
      loadLargeFiles();
    }
  }, [activeTab, largeFilesMinMB, scopeFolderId]);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const loadFolders = async () => {
    try {
      const res = await folderService.getFolders();
      setFolders(res.data?.folders || []);
    } catch (err) {
      console.error('Không thể lấy danh sách thư mục:', err);
    }
  };

  const loadScanStatus = async () => {
    try {
      setLoading(true);
      const res = await duplicateService.getScanStatus(scopeFolderId || null);
      setScanData(res.data);
      // Tự động chọn sẵn các bản sao khi vừa load dữ liệu
      autoSelectDuplicates(res.data?.clusters || []);
    } catch (err) {
      console.error('Lỗi khi tải trạng thái quét:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadLargeFiles = async () => {
    try {
      setLargeFilesLoading(true);
      const res = await duplicateService.getLargeFiles({
        minBytes: largeFilesMinMB * 1024 * 1024,
        maxBytes: 500 * 1024 * 1024, // Giới hạn dưới 500MB
        folderId: scopeFolderId || undefined
      });
      setLargeFilesData(res.data);
    } catch (err) {
      console.error('Lỗi khi tải tệp dung lượng lớn:', err);
    } finally {
      setLargeFilesLoading(false);
    }
  };

  const autoSelectDuplicates = (clusters) => {
    const newSelected = new Set();
    clusters.forEach((cluster) => {
      (cluster.duplicateFiles || []).forEach((item) => {
        if (item.isRecommendedDelete && item.file?._id) {
          newSelected.add(item.file._id);
        }
      });
    });
    setSelectedFileIds(newSelected);
  };

  const handleStartScan = async () => {
    try {
      setIsScanning(true);
      const res = await duplicateService.startScan(scopeFolderId || null);
      setScanData(res.data);
      autoSelectDuplicates(res.data?.clusters || []);
      showToast('Đã hoàn tất quét trùng lặp & tương đồng AI!');
      window.dispatchEvent(new CustomEvent('drive:refresh'));
    } catch (err) {
      console.error('Lỗi trong phiên quét:', err);
      showToast(err.response?.data?.message || 'Quét thất bại', 'error');
    } finally {
      setIsScanning(false);
    }
  };

  const handleToggleSelectFile = (fileId) => {
    const next = new Set(selectedFileIds);
    if (next.has(fileId)) {
      next.delete(fileId);
    } else {
      next.add(fileId);
    }
    setSelectedFileIds(next);
  };

  const handleSmartSelectAll = () => {
    if (activeTab === 'large_files') {
      const allLarge = new Set((largeFilesData?.files || []).map((f) => f._id));
      setSelectedFileIds(allLarge);
    } else {
      autoSelectDuplicates(scanData?.clusters || []);
    }
  };

  const handleClearSelection = () => {
    setSelectedFileIds(new Set());
  };

  const handleBatchClean = async () => {
    const ids = Array.from(selectedFileIds);
    if (ids.length === 0) return;

    if (!window.confirm(`Bạn có chắc chắn muốn chuyển ${ids.length} tệp tin đã chọn vào Thùng rác không?`)) {
      return;
    }

    try {
      setIsCleaning(true);
      const res = await duplicateService.cleanFiles(ids);
      showToast(`Đã chuyển thành công ${res.data?.cleanedCount || ids.length} tệp vào Thùng rác (${res.data?.cleanedFormatted || ''})`);

      // Cập nhật lại UI
      setSelectedFileIds(new Set());
      loadScanStatus();
      if (activeTab === 'large_files') {
        loadLargeFiles();
      }
      window.dispatchEvent(new CustomEvent('file:updated'));
      window.dispatchEvent(new CustomEvent('drive:refresh'));
    } catch (err) {
      console.error('Lỗi khi dọn dẹp hàng loạt:', err);
      showToast(err.response?.data?.message || 'Dọn dẹp thất bại', 'error');
    } finally {
      setIsCleaning(false);
    }
  };

  const handleDeleteSingle = async (fileId) => {
    if (!window.confirm('Chuyển tệp tin này vào Thùng rác?')) return;
    try {
      await duplicateService.cleanFiles([fileId]);
      showToast('Đã chuyển tệp tin vào Thùng rác');
      setSelectedFileIds((prev) => {
        const next = new Set(prev);
        next.delete(fileId);
        return next;
      });
      loadScanStatus();
      if (activeTab === 'large_files') {
        loadLargeFiles();
      }
      window.dispatchEvent(new CustomEvent('file:updated'));
      window.dispatchEvent(new CustomEvent('drive:refresh'));
    } catch (err) {
      showToast('Không thể xóa tệp tin', 'error');
    }
  };

  const handleOpenCompare = async (original, duplicate, cluster) => {
    try {
      const res = await duplicateService.getCompareDetail(original._id, duplicate._id);
      setCompareModalData({
        ...res.data,
        similarityScore: res.data.similarityScore || cluster.similarityScore,
        aiAnalysis: res.data.aiAnalysis || cluster.aiAnalysis
      });
      setIsCompareOpen(true);
    } catch (err) {
      console.error('Lỗi khi lấy chi tiết so sánh:', err);
      // Fallback
      setCompareModalData({
        fileA: original,
        fileB: duplicate,
        similarityScore: cluster.similarityScore,
        aiAnalysis: cluster.aiAnalysis,
        recommendedKeep: original._id
      });
      setIsCompareOpen(true);
    }
  };

  const handleIgnorePair = async (fileAId, fileBId) => {
    try {
      await duplicateService.ignorePair(fileAId, fileBId);
      showToast('Đã lưu thiết lập bỏ qua cặp tệp tin này');
      loadScanStatus();
    } catch (err) {
      showToast('Không thể lưu thiết lập bỏ qua', 'error');
    }
  };

  // Lọc cụm theo tab
  const filteredClusters = useMemo(() => {
    const list = scanData?.clusters || [];
    if (activeTab === 'exact') {
      return list.filter((c) => c.type === 'exact');
    }
    if (activeTab === 'semantic') {
      return list.filter((c) => c.type === 'semantic');
    }
    return list;
  }, [scanData, activeTab]);

  // Tính tổng dung lượng các tệp đang được tích chọn
  const selectedSizeFormatted = useMemo(() => {
    let bytes = 0;
    if (activeTab === 'large_files') {
      (largeFilesData?.files || []).forEach((f) => {
        if (selectedFileIds.has(f._id)) bytes += f.size || 0;
      });
    } else {
      (scanData?.clusters || []).forEach((c) => {
        (c.duplicateFiles || []).forEach((d) => {
          if (selectedFileIds.has(d.file?._id)) {
            bytes += d.file?.size || 0;
          }
        });
      });
    }
    return formatFileSize(bytes);
  }, [selectedFileIds, activeTab, scanData, largeFilesData]);

  return (
    <div className="cleanup-page-wrapper">
      <div className="cleanup-page">
        {/* Toast Feedback */}
        {toast && (
          <div
            style={{
              position: 'fixed',
              top: 24,
              right: 24,
              background: toast.type === 'error' ? 'var(--accent-rose)' : 'var(--primary-600)',
              color: '#fff',
              padding: '12px 20px',
              borderRadius: 'var(--radius-md)',
              boxShadow: 'var(--shadow-lg)',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              zIndex: 9999,
              fontWeight: 500,
              fontSize: '0.875rem'
            }}
          >
            {toast.type === 'error' ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
            <span>{toast.message}</span>
          </div>
        )}

        {/* Header */}
        <div className="cleanup-header">
          <div className="cleanup-title-group">
            <div className="cleanup-title-icon">
              <Broom size={22} />
            </div>
            <div className="cleanup-title-text">
              <h1>Dọn dẹp & Quét trùng lặp AI</h1>
              <p>Phát hiện tệp tin trùng khớp 100% (SHA-256) và các bản thảo tương đồng bằng trí tuệ nhân tạo</p>
            </div>
          </div>

          <div className="cleanup-controls">
            <select
              className="cleanup-select-scope"
              value={scopeFolderId}
              onChange={(e) => setScopeFolderId(e.target.value)}
              disabled={isScanning}
            >
              <option value="">Phạm vi: Toàn bộ Drive</option>
              {folders.map((f) => (
                <option key={f._id} value={f._id}>
                  Thư mục: {f.name}
                </option>
              ))}
            </select>

            <button
              type="button"
              className="btn-scan-trigger"
              onClick={handleStartScan}
              disabled={isScanning}
            >
              <RefreshCw size={15} className={isScanning ? 'is-spinning' : ''} />
              {isScanning ? 'Đang quét AI...' : 'Bắt đầu quét AI'}
            </button>
          </div>
        </div>

        {/* Banner Tiến trình Quét khi đang chạy */}
        {isScanning && (
          <div className="scan-progress-banner">
            <div className="radar-pulse-box">
              <div className="radar-circle" />
              <div className="radar-icon-center">
                <Sparkles size={20} />
              </div>
            </div>
            <div className="scan-progress-info">
              <div className="scan-progress-title">
                <span>Hệ thống AI đang quét và so sánh các tệp tin trong Drive...</span>
                <span className="tabular-nums" style={{ color: 'var(--primary-600)' }}>
                  Đang xử lý
                </span>
              </div>
              <div className="scan-progress-track">
                <div className="scan-progress-fill" style={{ width: '75%' }} />
              </div>
              <div className="scan-stage-pills">
                <div className="stage-pill is-active">
                  <FileCheck size={13} />
                  1. Quét mã băm SHA-256
                </div>
                <div className="stage-pill is-active">
                  <Sparkles size={13} />
                  2. So sánh ngữ nghĩa AI (Gemini)
                </div>
                <div className="stage-pill">
                  <Layers size={13} />
                  3. Tổng hợp cụm tệp trùng
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Stats Summary Cards Grid */}
        <div className="cleanup-stats-grid">
          <div className="cleanup-stat-card">
            <div className="stat-icon-wrapper savings">
              <HardDrive size={22} />
            </div>
            <div className="stat-content">
              <span className="stat-label">Dung lượng lãng phí</span>
              <span className="stat-value">{scanData?.stats?.wastedFormatted || '0 B'}</span>
              <span className="stat-subtext">Có thể giải phóng ngay</span>
            </div>
          </div>

          <div className="cleanup-stat-card">
            <div className="stat-icon-wrapper exact">
              <Copy size={22} />
            </div>
            <div className="stat-content">
              <span className="stat-label">Trùng lặp 100%</span>
              <span className="stat-value">{scanData?.stats?.exactDuplicateCount || 0} tệp</span>
              <span className="stat-subtext">Mã băm SHA-256 trùng khớp</span>
            </div>
          </div>

          <div className="cleanup-stat-card">
            <div className="stat-icon-wrapper semantic">
              <Sparkles size={22} />
            </div>
            <div className="stat-content">
              <span className="stat-label">Bản thảo tương đồng AI</span>
              <span className="stat-value">{scanData?.stats?.similarDuplicateCount || 0} tệp</span>
              <span className="stat-subtext">Độ tương đồng từ 70% - 99%</span>
            </div>
          </div>

          <div className="cleanup-stat-card">
            <div className="stat-icon-wrapper large-files">
              <Layers size={22} />
            </div>
            <div className="stat-content">
              <span className="stat-label">Tệp dung lượng lớn</span>
              <span className="stat-value">&lt; 500 MB</span>
              <span className="stat-subtext">Lọc & dọn dẹp tệp nặng</span>
            </div>
          </div>
        </div>

        {/* Toolbar & Filter Tabs */}
        <div className="cleanup-toolbar">
          <div className="cleanup-tabs">
            <button
              type="button"
              className={`cleanup-tab-btn ${activeTab === 'all' ? 'is-active' : ''}`}
              onClick={() => setActiveTab('all')}
            >
              <span>Tất cả trùng lặp</span>
              <span className="cleanup-tab-count">{(scanData?.clusters || []).length}</span>
            </button>
            <button
              type="button"
              className={`cleanup-tab-btn ${activeTab === 'exact' ? 'is-active' : ''}`}
              onClick={() => setActiveTab('exact')}
            >
              <span>Trùng tuyệt đối 100%</span>
              <span className="cleanup-tab-count">
                {(scanData?.clusters || []).filter((c) => c.type === 'exact').length}
              </span>
            </button>
            <button
              type="button"
              className={`cleanup-tab-btn ${activeTab === 'semantic' ? 'is-active' : ''}`}
              onClick={() => setActiveTab('semantic')}
            >
              <span>Gần giống nhau (AI)</span>
              <span className="cleanup-tab-count">
                {(scanData?.clusters || []).filter((c) => c.type === 'semantic').length}
              </span>
            </button>
            <button
              type="button"
              className={`cleanup-tab-btn ${activeTab === 'large_files' ? 'is-active' : ''}`}
              onClick={() => setActiveTab('large_files')}
            >
              <span>Tệp lớn </span>
              {largeFilesData && <span className="cleanup-tab-count">{largeFilesData.totalCount}</span>}
            </button>
          </div>

          <div className="cleanup-actions-group">
            <button
              type="button"
              className="btn-smart-select"
              onClick={handleSmartSelectAll}
              title="Tự động chọn các bản sao dư thừa để dọn dẹp"
            >
              <CheckSquare size={14} />
              Chọn thông minh
            </button>
            {selectedFileIds.size > 0 && (
              <button
                type="button"
                className="btn-smart-select"
                onClick={handleClearSelection}
              >
                <Square size={14} />
                Bỏ chọn
              </button>
            )}

            <button
              type="button"
              className="btn-clean-batch"
              onClick={handleBatchClean}
              disabled={selectedFileIds.size === 0 || isCleaning}
            >
              <Trash2 size={14} />
              {isCleaning
                ? 'Đang chuyển...'
                : `Dọn dẹp (${selectedFileIds.size}) • ${selectedSizeFormatted}`}
            </button>
          </div>
        </div>

        {/* Main Content Area */}
        {activeTab === 'large_files' ? (
          /* Tab Tệp Dung Lượng Lớn */
          <div className="large-files-container">
            <div className="large-files-filters">
              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                Ngưỡng kích thước:
              </span>
              <button
                type="button"
                className={`filter-pill ${largeFilesMinMB === 10 ? 'is-active' : ''}`}
                onClick={() => setLargeFilesMinMB(10)}
              >
                Lớn hơn 10 MB
              </button>
              <button
                type="button"
                className={`filter-pill ${largeFilesMinMB === 50 ? 'is-active' : ''}`}
                onClick={() => setLargeFilesMinMB(50)}
              >
                Lớn hơn 50 MB
              </button>
              <button
                type="button"
                className={`filter-pill ${largeFilesMinMB === 100 ? 'is-active' : ''}`}
                onClick={() => setLargeFilesMinMB(100)}
              >
                Lớn hơn 100 MB
              </button>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>
                (Tối đa 500 MB mỗi tệp)
              </span>
            </div>

            {largeFilesLoading ? (
              <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                Đang tải danh sách tệp lớn...
              </div>
            ) : (largeFilesData?.files || []).length === 0 ? (
              <div className="cleanup-empty-state">
                <div className="empty-state-icon">
                  <CheckCircle2 size={36} />
                </div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 600, margin: '0 0 6px 0' }}>
                  Không tìm thấy tệp nào vượt quá {largeFilesMinMB} MB
                </h3>
                <p style={{ margin: 0, fontSize: '0.875rem' }}>
                  Kho lưu trữ của bạn được tối ưu rất gọn gàng.
                </p>
              </div>
            ) : (
              <div className="clusters-list">
                {(largeFilesData?.files || []).map((file) => {
                  const isSelected = selectedFileIds.has(file._id);
                  return (
                    <div
                      key={file._id}
                      className={`cluster-file-item ${isSelected ? 'is-selected-delete' : ''}`}
                    >
                      <div className="file-item-left">
                        <input
                          type="checkbox"
                          className="file-checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelectFile(file._id)}
                        />
                        <FileIcon mimeType={file.mimeType} extension={file.extension} size={22} />
                        <div className="file-info-col">
                          <span className="file-primary-name" title={file.name}>
                            {file.name}
                          </span>
                          <div className="file-meta-row">
                            <strong style={{ color: 'var(--accent-blue)' }}>{file.formattedSize}</strong>
                            <span>•</span>
                            <span>Thư mục: {file.folder?.name || 'Drive của tôi'}</span>
                            <span>•</span>
                            <span>Cập nhật: {new Date(file.updatedAt || file.createdAt).toLocaleDateString('vi-VN')}</span>
                          </div>
                        </div>
                      </div>

                      <div className="file-item-actions">
                        <button
                          type="button"
                          className="btn-item-action"
                          style={{ color: 'var(--accent-rose)' }}
                          onClick={() => handleDeleteSingle(file._id)}
                          title="Chuyển vào thùng rác"
                        >
                          <Trash2 size={13} />
                          Xóa
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          /* Tabs Cụm Trùng Lặp (Exact / Semantic / All) */
          <div className="clusters-list">
            {filteredClusters.length === 0 ? (
              <div className="cleanup-empty-state">
                <div className="empty-state-icon">
                  <CheckCircle2 size={36} />
                </div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 600, margin: '0 0 6px 0', color: 'var(--text-primary)' }}>
                  Không phát hiện tệp tin trùng lặp nào
                </h3>
                <p style={{ margin: '0 0 16px 0', fontSize: '0.875rem' }}>
                  {scanData?.lastScannedAt
                    ? `Lần quét gần nhất lúc ${new Date(scanData.lastScannedAt).toLocaleString('vi-VN')}. Tất cả tài liệu đều là phiên bản duy nhất.`
                    : 'Hãy bấm "Bắt đầu quét AI" để rà soát toàn bộ tệp tin trong Drive của bạn.'}
                </p>
                <button
                  type="button"
                  className="btn-scan-trigger"
                  onClick={handleStartScan}
                  disabled={isScanning}
                >
                  <Sparkles size={15} />
                  Quét ngay bây giờ
                </button>
              </div>
            ) : (
              filteredClusters.map((cluster) => (
                <DuplicateClusterCard
                  key={cluster.clusterId}
                  cluster={cluster}
                  selectedFileIds={selectedFileIds}
                  onToggleSelectFile={handleToggleSelectFile}
                  onOpenCompare={handleOpenCompare}
                  onDeleteSingle={handleDeleteSingle}
                  onIgnorePair={handleIgnorePair}
                />
              ))
            )}
          </div>
        )}

        {/* Side-by-Side Compare Modal */}
        <SideBySideModal
          isOpen={isCompareOpen}
          onClose={() => setIsCompareOpen(false)}
          compareData={compareModalData}
          onCleanFile={async (fileIds) => {
            await duplicateService.cleanFiles(fileIds);
            showToast('Đã chuyển tệp bản sao vào Thùng rác');
            loadScanStatus();
            window.dispatchEvent(new CustomEvent('file:updated'));
            window.dispatchEvent(new CustomEvent('drive:refresh'));
          }}
          onIgnorePair={handleIgnorePair}
        />
      </div>
    </div>
  );
};

export default CleanupPage;
