import React, { useState, useEffect } from 'react';
import Modal from '../common/Modal';
import { History, Download, RotateCcw, Trash2, Plus, Sparkles } from 'lucide-react';
import versionService from '../../services/versionService';
import { useToast } from '../../contexts/ToastContext';

const FileVersionsModal = ({ isOpen, onClose, file, onRestoreSuccess }) => {
  const [versions, setVersions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [note, setNote] = useState('');
  const toast = useToast();

  useEffect(() => {
    if (isOpen && file) {
      loadVersions();
    }
  }, [isOpen, file]);

  const loadVersions = async () => {
    setLoading(true);
    try {
      const res = await versionService.getVersions(file._id);
      setVersions(res.data || []);
    } catch (err) {
      console.error('Lỗi khi lấy lịch sử phiên bản:', err);
      toast.error('Không thể lấy lịch sử phiên bản');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSnapshot = async (e) => {
    e.preventDefault();
    setCreating(true);
    try {
      await versionService.createVersion(file._id, {
        note: note.trim() || 'Tạo snapshot thủ công',
        changeType: 'manual'
      });
      toast.success('Đã lưu bản sao lưu snapshot mới');
      setNote('');
      loadVersions();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Tạo bản sao lưu thất bại');
    } finally {
      setCreating(false);
    }
  };

  const handleDownloadVersion = async (version) => {
    try {
      const blob = await versionService.downloadVersionBlob(file._id, version._id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `v${version.versionNumber}_${file.name}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error('Tải phiên bản thất bại');
    }
  };

  const handleRestoreVersion = async (version) => {
    if (!window.confirm(`Bạn có chắc chắn muốn khôi phục về Phiên bản ${version.versionNumber}?`)) {
      return;
    }
    try {
      await versionService.restoreVersion(file._id, version._id);
      toast.success(`Đã khôi phục file về phiên bản ${version.versionNumber}`);
      onRestoreSuccess && onRestoreSuccess();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Khôi phục phiên bản thất bại');
    }
  };

  const handleDeleteVersion = async (versionId) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa bản sao lưu phiên bản này?')) {
      return;
    }
    try {
      await versionService.deleteVersion(file._id, versionId);
      toast.success('Đã xóa phiên bản');
      loadVersions();
    } catch (err) {
      toast.error('Xóa phiên bản thất bại');
    }
  };

  const formatSize = (bytes) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  if (!isOpen || !file) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Lịch sử phiên bản "${file.name}"`}
      size="md"
      footer={
        <button className="btn btn-secondary" onClick={onClose}>
          Đóng
        </button>
      }
    >
      {/* Form tạo Snapshot thủ công */}
      <form onSubmit={handleCreateSnapshot} style={{ marginBottom: '20px', display: 'flex', gap: '8px' }}>
        <input
          type="text"
          className="form-input"
          placeholder="Ghi chú phiên bản (vd: Trước khi sửa lớn)..."
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <button className="btn btn-primary" type="submit" disabled={creating} style={{ flexShrink: 0 }}>
          <Plus size={16} />
          <span>{creating ? 'Đang lưu...' : 'Lưu Snapshot'}</span>
        </button>
      </form>

      {/* Dòng thời gian phiên bản */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
          <span className="spinner" />
          <div style={{ marginTop: '8px' }}>Đang tải lịch sử phiên bản...</div>
        </div>
      ) : versions.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
          Chưa có phiên bản lịch sử nào được ghi lại cho tệp này.
        </div>
      ) : (
        <div className="version-timeline">
          {versions.map((ver) => (
            <div key={ver._id} className="version-item">
              <div className="version-dot" />
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <strong style={{ fontSize: '0.9375rem', color: 'var(--text-primary)' }}>
                    Phiên bản {ver.versionNumber}
                  </strong>
                  <span className="badge badge-blue">{ver.changeType || 'manual'}</span>
                </div>
                <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                  {ver.note || 'Không có ghi chú'}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                  {formatSize(ver.size)} • {new Date(ver.createdAt).toLocaleString('vi-VN')}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <button
                  className="btn-icon"
                  title="Tải xuống phiên bản này"
                  onClick={() => handleDownloadVersion(ver)}
                >
                  <Download size={16} />
                </button>
                <button
                  className="btn-icon"
                  title="Khôi phục về phiên bản này"
                  onClick={() => handleRestoreVersion(ver)}
                >
                  <RotateCcw size={16} style={{ color: 'var(--primary-600)' }} />
                </button>
                <button
                  className="btn-icon"
                  title="Xóa phiên bản"
                  onClick={() => handleDeleteVersion(ver._id)}
                >
                  <Trash2 size={16} style={{ color: 'var(--accent-rose)' }} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
};

export default FileVersionsModal;
