import React, { useState, useEffect } from 'react';
import Modal from '../common/Modal';
import {
  Share2,
  Globe,
  Lock,
  Copy,
  Check,
  UserMinus,
  Shield,
  Calendar
} from 'lucide-react';
import shareService from '../../services/shareService';
import { useToast } from '../../contexts/ToastContext';

const ShareModal = ({ isOpen, onClose, item, itemType = 'file' }) => {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('viewer');
  const [shares, setShares] = useState([]);
  const [publicShare, setPublicShare] = useState(null);
  const [isPublic, setIsPublic] = useState(false);
  const [allowDownload, setAllowDownload] = useState(true);
  const [password, setPassword] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fetchingShares, setFetchingShares] = useState(true);
  const toast = useToast();

  useEffect(() => {
    if (isOpen && item) {
      loadShareData();
    }
  }, [isOpen, item]);

  const loadShareData = async () => {
    setFetchingShares(true);
    try {
      const res = await shareService.getItemShares(itemType, item._id);
      const data = res.data || {};
      setShares(data.collaborators || data.shares || []);

      if (data.publicLink) {
        setPublicShare(data.publicLink);
        setIsPublic(Boolean(data.publicLink.isPublic));
        setAllowDownload(data.publicLink.allowDownload !== false);
        if (data.publicLink.expiresAt) {
          setExpiresAt(new Date(data.publicLink.expiresAt).toISOString().split('T')[0]);
        }
      } else {
        setPublicShare(null);
        setIsPublic(false);
      }
    } catch (err) {
      console.error('Lỗi khi tải dữ liệu chia sẻ:', err);
    } finally {
      setFetchingShares(false);
    }
  };

  const handleAddCollaborator = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;

    setLoading(true);
    try {
      await shareService.shareWithUser({
        itemType,
        itemId: item._id,
        email: email.trim(),
        role
      });
      toast.success(`Đã chia sẻ thành công cho ${email}`);
      setEmail('');
      loadShareData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Không thể chia sẻ tài liệu');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateRole = async (shareId, newRole) => {
    try {
      await shareService.updateCollaboratorRole(shareId, newRole);
      toast.success('Đã cập nhật quyền thành công');
      loadShareData();
    } catch (err) {
      toast.error('Cập nhật quyền thất bại');
    }
  };

  const handleRemoveCollaborator = async (shareId) => {
    try {
      await shareService.removeCollaborator(shareId);
      toast.success('Đã thu hồi quyền chia sẻ');
      loadShareData();
    } catch (err) {
      toast.error('Thu hồi chia sẻ thất bại');
    }
  };

  const handleSavePublicLink = async () => {
    setLoading(true);
    try {
      if (!isPublic && publicShare) {
        await shareService.revokePublicLink(itemType, item._id);
        setPublicShare(null);
        toast.success('Đã tắt liên kết công khai');
      } else if (isPublic) {
        const payload = {
          itemType,
          itemId: item._id,
          isPublic: true,
          allowDownload,
          password: password.trim() || undefined,
          expiresAt: expiresAt ? new Date(expiresAt).toISOString() : undefined
        };
        const res = await shareService.createOrUpdatePublicLink(payload);
        setPublicShare(res.data);
        toast.success('Cập nhật liên kết chia sẻ công khai thành công');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Thao tác liên kết công khai thất bại');
    } finally {
      setLoading(false);
    }
  };

  const copyPublicLink = () => {
    const shareToken = publicShare?.shareToken;
    if (!shareToken) return;

    const publicUrl = `${window.location.origin}/shares/public/${shareToken}`;
    navigator.clipboard.writeText(publicUrl);
    setCopied(true);
    toast.success('Đã sao chép liên kết vào bộ nhớ tạm');
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isOpen || !item) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Chia sẻ "${item.name}"`}
      size="md"
      footer={
        <button className="btn btn-secondary" onClick={onClose}>
          Đóng
        </button>
      }
    >
      {/* Chia sẻ qua Email */}
      <div className="share-section">
        <div className="share-section-heading">
          <span>Thêm người hoặc nhóm</span>
        </div>

        <form onSubmit={handleAddCollaborator} style={{ display: 'flex', gap: '8px' }}>
          <input
            type="email"
            placeholder="Nhập địa chỉ email người nhận..."
            className="form-input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{ flex: 1 }}
          />
          <select
            className="form-select"
            style={{ width: '130px' }}
            value={role}
            onChange={(e) => setRole(e.target.value)}
          >
            <option value="viewer">Người xem</option>
            <option value="editor">Chỉnh sửa</option>
          </select>
          <button className="btn btn-primary" type="submit" disabled={loading || !email.trim()}>
            {loading ? <span className="spinner" /> : 'Gửi'}
          </button>
        </form>

        {/* Danh sách cộng tác viên */}
        <div className="collaborators-list">
          {fetchingShares ? (
            <div style={{ padding: '10px', textAlign: 'center', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
              Đang tải danh sách người được chia sẻ...
            </div>
          ) : shares.length === 0 ? (
            <div style={{ padding: '10px 0', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
              Chưa có người nào được chia sẻ riêng biệt.
            </div>
          ) : (
            shares.map((share) => (
              <div key={share._id} className="collaborator-item">
                <div className="collaborator-user-info">
                  <div className="avatar-circle" style={{ width: 28, height: 28, fontSize: '0.75rem' }}>
                    {(share.sharedWith?.name || share.sharedWith?.email || 'U')[0].toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontSize: '0.875rem', fontWeight: 600 }}>
                      {share.sharedWith?.name || 'Người dùng'}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {share.sharedWith?.email}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <select
                    className="form-select"
                    style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                    value={share.role}
                    onChange={(e) => handleUpdateRole(share._id, e.target.value)}
                  >
                    <option value="viewer">Người xem</option>
                    <option value="editor">Chỉnh sửa</option>
                  </select>
                  <button
                    className="btn-icon"
                    title="Xóa quyền chia sẻ"
                    onClick={() => handleRemoveCollaborator(share._id)}
                  >
                    <UserMinus size={16} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <hr style={{ border: 'none', borderTop: '1px solid var(--border-subtle)', margin: '20px 0' }} />

      {/* Liên kết chia sẻ công khai (Public Link) */}
      <div className="share-section" style={{ marginBottom: 0 }}>
        <div className="share-section-heading">
          <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Globe size={18} style={{ color: 'var(--primary-600)' }} />
            <span>Liên kết chia sẻ công khai</span>
          </span>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.8125rem' }}>
            <input
              type="checkbox"
              checked={isPublic}
              onChange={(e) => setIsPublic(e.target.checked)}
            />
            <span>Bật liên kết công khai</span>
          </label>
        </div>

        {isPublic && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '12px' }}>
            {publicShare?.shareToken && (
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  readOnly
                  className="form-input"
                  value={`${window.location.origin}/shares/public/${publicShare.shareToken}`}
                  style={{ fontSize: '0.8125rem', backgroundColor: 'var(--bg-surface-hover)' }}
                />
                <button className="btn btn-secondary" onClick={copyPublicLink} title="Sao chép">
                  {copied ? <Check size={16} style={{ color: 'var(--accent-emerald)' }} /> : <Copy size={16} />}
                </button>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Lock size={12} />
                  <span>Mật khẩu bảo vệ (Tùy chọn)</span>
                </label>
                <input
                  type="password"
                  className="form-input"
                  placeholder="Để trống nếu không khóa..."
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Calendar size={12} />
                  <span>Ngày hết hạn (Tùy chọn)</span>
                </label>
                <input
                  type="date"
                  className="form-input"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                />
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8125rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={allowDownload}
                  onChange={(e) => setAllowDownload(e.target.checked)}
                />
                <span>Cho phép người xem tải tệp xuống</span>
              </label>

              <button className="btn btn-primary" onClick={handleSavePublicLink} disabled={loading} style={{ padding: '6px 14px' }}>
                {loading ? <span className="spinner" /> : 'Cập nhật liên kết'}
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};

export default ShareModal;
