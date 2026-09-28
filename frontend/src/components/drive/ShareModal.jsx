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
  Calendar,
  QrCode,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Download,
  Eye,
  EyeOff,
  Link,
  Users,
  KeyRound,
  FileText,
  Folder
} from 'lucide-react';
import QRCode from 'qrcode';
import shareService from '../../services/shareService';
import { useToast } from '../../contexts/ToastContext';
import { useAuth } from '../../contexts/AuthContext';

/**
 * ShareModal - Quản lý chia sẻ tài liệu và liên kết công khai 
 * Hỗ trợ:
 * 1. Quyền truy cập chung qua liên kết (Bất kỳ ai có link / Bị hạn chế, sao chép 1-click, quét QR, mật khẩu, hạn dùng)
 * 2. Phân quyền cộng tác viên theo email
 */
const ShareModal = ({ isOpen, onClose, item, itemType = 'file' }) => {
  const { user: currentUser } = useAuth();
  const toast = useToast();

  // Email Sharing state
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('viewer');
  const [shares, setShares] = useState([]);

  // Public Link state
  const [publicShare, setPublicShare] = useState(null);
  const [isPublic, setIsPublic] = useState(false);
  const [linkRole, setLinkRole] = useState('viewer');
  const [allowDownload, setAllowDownload] = useState(true);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [expiresAt, setExpiresAt] = useState('');
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);

  // QR Code state
  const [showQrModal, setShowQrModal] = useState(false);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState('');

  // UI state
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [linkUpdating, setLinkUpdating] = useState(false);
  const [fetchingShares, setFetchingShares] = useState(true);

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

      if (data.publicLink && data.publicLink.isPublic) {
        setPublicShare(data.publicLink);
        setIsPublic(true);
        setLinkRole(data.publicLink.role || 'viewer');
        setAllowDownload(data.publicLink.allowDownload !== false);
        if (data.publicLink.expiresAt) {
          setExpiresAt(new Date(data.publicLink.expiresAt).toISOString().split('T')[0]);
        }
      } else {
        setPublicShare(null);
        setIsPublic(false);
        setLinkRole('viewer');
        setAllowDownload(true);
        setExpiresAt('');
        setPassword('');
      }
    } catch (err) {
      console.error('Lỗi khi tải dữ liệu chia sẻ:', err);
    } finally {
      setFetchingShares(false);
    }
  };

  // Tạo URL công khai hoàn chỉnh
  const getFullPublicUrl = (token) => {
    const actualToken = token || publicShare?.shareToken;
    if (!actualToken) return '';
    return `${window.location.origin}/shares/public/${actualToken}`;
  };

  // Tạo mã QR Code từ URL
  const generateQrCode = async (url) => {
    try {
      const qr = await QRCode.toDataURL(url, {
        width: 260,
        margin: 2,
        color: {
          dark: '#0f172a',
          light: '#ffffff'
        }
      });
      setQrCodeDataUrl(qr);
      setShowQrModal(true);
    } catch (err) {
      console.error('Lỗi tạo mã QR:', err);
      toast.error('Không thể tạo mã QR cho liên kết');
    }
  };

  // Bật / tắt chế độ chia sẻ công khai
  const handleToggleAccessMode = async (mode) => {
    if (mode === 'public') {
      await handleEnablePublicLink();
    } else {
      await handleDisablePublicLink();
    }
  };

  // Kích hoạt liên kết công khai
  const handleEnablePublicLink = async (overrideRole = null) => {
    setLinkUpdating(true);
    try {
      const payload = {
        itemType,
        itemId: item._id,
        isPublic: true,
        role: overrideRole || linkRole,
        allowDownload,
        password: password.trim() || undefined,
        expiresAt: expiresAt ? new Date(expiresAt).toISOString() : undefined
      };
      const res = await shareService.createOrUpdatePublicLink(payload);
      setPublicShare(res.data);
      setIsPublic(true);
      return res.data;
    } catch (err) {
      toast.error(err.response?.data?.message || 'Không thể bật liên kết công khai');
      return null;
    } finally {
      setLinkUpdating(false);
    }
  };

  // Thu hồi / tắt liên kết công khai
  const handleDisablePublicLink = async () => {
    setLinkUpdating(true);
    try {
      await shareService.revokePublicLink(itemType, item._id);
      setPublicShare(null);
      setIsPublic(false);
      setPassword('');
      setExpiresAt('');
      toast.success('Đã chuyển quyền truy cập sang Bị hạn chế');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Không thể tắt liên kết');
    } finally {
      setLinkUpdating(false);
    }
  };

  // Cập nhật cấu hình bảo mật nâng cao (Mật khẩu, Hạn dùng, Quyền tải)
  const handleSaveSecuritySettings = async () => {
    setLinkUpdating(true);
    try {
      const payload = {
        itemType,
        itemId: item._id,
        isPublic: true,
        role: linkRole,
        allowDownload,
        password: password.trim() || undefined,
        expiresAt: expiresAt ? new Date(expiresAt).toISOString() : undefined
      };
      const res = await shareService.createOrUpdatePublicLink(payload);
      setPublicShare(res.data);
      toast.success('Đã cập nhật cài đặt liên kết bảo mật');
      setShowAdvancedSettings(false);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Lỗi lưu cài đặt liên kết');
    } finally {
      setLinkUpdating(false);
    }
  };

  // Thay đổi quyền hạn của liên kết 
  const handleChangeLinkRole = async (newRole) => {
    setLinkRole(newRole);
    if (isPublic) {
      await handleEnablePublicLink(newRole);
      toast.success(`Đã đổi quyền liên kết thành: ${newRole === 'editor' ? 'Chỉnh sửa' : 'Người xem'}`);
    }
  };

  // 1-Click Sao chép liên kết: Tự động kích hoạt nếu đang tắt 
  const handleCopyLink = async () => {
    let targetToken = publicShare?.shareToken;

    if (!isPublic || !targetToken) {
      // Tự động kích hoạt liên kết công khai
      const created = await handleEnablePublicLink();
      if (created?.shareToken) {
        targetToken = created.shareToken;
        toast.info('Đã tự động kích hoạt liên kết công khai');
      } else {
        return;
      }
    }

    const publicUrl = getFullPublicUrl(targetToken);
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      toast.success('Đã sao chép đường liên kết vào bộ nhớ tạm');
      setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      toast.error('Không thể sao chép liên kết');
    }
  };

  // Xem mã QR
  const handleOpenQrCode = async () => {
    let targetToken = publicShare?.shareToken;
    if (!isPublic || !targetToken) {
      const created = await handleEnablePublicLink();
      if (created?.shareToken) {
        targetToken = created.shareToken;
      } else {
        return;
      }
    }
    const publicUrl = getFullPublicUrl(targetToken);
    generateQrCode(publicUrl);
  };

  // Tải ảnh QR Code về máy
  const handleDownloadQrCode = () => {
    if (!qrCodeDataUrl) return;
    const a = document.createElement('a');
    a.href = qrCodeDataUrl;
    a.download = `qrcode-share-${item?.name || 'document'}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast.success('Đã tải mã QR Code về máy');
  };

  // Thêm cộng tác viên qua Email
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

  // Đổi vai trò cộng tác viên
  const handleUpdateRole = async (shareId, newRole) => {
    try {
      await shareService.updateCollaboratorRole(shareId, newRole);
      toast.success('Đã cập nhật quyền thành công');
      loadShareData();
    } catch (err) {
      toast.error('Cập nhật quyền thất bại');
    }
  };

  // Xóa quyền cộng tác viên
  const handleRemoveCollaborator = async (shareId) => {
    try {
      await shareService.removeCollaborator(shareId);
      toast.success('Đã thu hồi quyền chia sẻ');
      loadShareData();
    } catch (err) {
      toast.error('Thu hồi chia sẻ thất bại');
    }
  };

  if (!isOpen || !item) return null;

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: '8px',
                background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.2), rgba(168, 85, 247, 0.2))',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--primary-400, #818cf8)'
              }}
            >
              {itemType === 'folder' ? <Folder size={18} /> : <FileText size={18} />}
            </div>
            <div>
              <div style={{ fontSize: '1rem', fontWeight: 700, lineHeight: 1.2 }}>
                Chia sẻ "{item.name}"
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                Quản lý quyền truy cập qua đường liên kết và cộng tác viên
              </div>
            </div>
          </div>
        }
        size="lg"
        footer={
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleCopyLink}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
            >
              {copied ? <Check size={16} className="text-emerald-400" /> : <Link size={16} />}
              <span>{copied ? 'Đã sao chép liên kết' : 'Sao chép đường liên kết'}</span>
            </button>

            <button type="button" className="btn btn-primary" onClick={onClose}>
              Xong
            </button>
          </div>
        }
      >
        <div className="share-modal-container">
          {/* KHỐI 1: QUYỀN TRUY CẬP CHUNG QUA ĐƯỜNG LIÊN KẾT  */}
          <div className="share-card-section">
            <div className="share-card-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Globe size={18} className="text-primary-400" />
                <span style={{ fontWeight: 700, fontSize: '0.9375rem', color: 'var(--text-primary)' }}>
                  Quyền truy cập chung
                </span>
              </div>

              {isPublic && publicShare?.shareToken && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <button
                    type="button"
                    className="btn-icon"
                    title="Mở liên kết trong tab mới"
                    onClick={() => window.open(getFullPublicUrl(), '_blank')}
                  >
                    <ExternalLink size={15} />
                  </button>
                  <button
                    type="button"
                    className="btn-icon"
                    title="Quét mã QR Code trên điện thoại"
                    onClick={handleOpenQrCode}
                  >
                    <QrCode size={16} />
                  </button>
                </div>
              )}
            </div>

            {/* Trạng thái Access: Bất kỳ ai có liên kết vs Bị hạn chế */}
            <div className="general-access-item">
              <div
                className={`access-icon-wrapper ${isPublic ? 'active' : 'restricted'}`}
              >
                {isPublic ? <Globe size={20} /> : <Lock size={20} />}
              </div>

              <div className="access-info-wrapper">
                <div className="access-controls-row">
                  <select
                    className="form-select access-mode-select"
                    value={isPublic ? 'public' : 'restricted'}
                    onChange={(e) => handleToggleAccessMode(e.target.value)}
                    disabled={linkUpdating}
                  >
                    <option value="restricted">Bị hạn chế (Chỉ người được thêm)</option>
                    <option value="public">Bất kỳ ai có đường liên kết</option>
                  </select>

                  {isPublic && (
                    <select
                      className="form-select access-role-select"
                      value={linkRole}
                      onChange={(e) => handleChangeLinkRole(e.target.value)}
                      disabled={linkUpdating}
                    >
                      <option value="viewer">Người xem</option>
                      <option value="editor">Người chỉnh sửa</option>
                    </select>
                  )}
                </div>

                <div className="access-description">
                  {isPublic ? (
                    <span>Bất kỳ ai trên Internet có đường liên kết này đều có thể xem tài liệu</span>
                  ) : (
                    <span>Chỉ những người được thêm vào danh sách dưới đây mới có thể mở tài liệu</span>
                  )}
                </div>
              </div>
            </div>

            {/* URL Input Box khi Public Link đang bật */}
            {isPublic && publicShare?.shareToken && (
              <div className="public-url-bar">
                <input
                  type="text"
                  readOnly
                  className="form-input public-url-input"
                  value={getFullPublicUrl()}
                />
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={handleCopyLink}
                  title="Sao chép liên kết"
                >
                  {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                  <span>{copied ? 'Đã chép' : 'Sao chép'}</span>
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={handleOpenQrCode}
                  title="Xem mã QR"
                >
                  <QrCode size={14} />
                  <span>Mã QR</span>
                </button>
              </div>
            )}

            {/* Tùy chọn bảo mật nâng cao */}
            {isPublic && (
              <div className="advanced-settings-wrapper">
                <button
                  type="button"
                  className="advanced-toggle-btn"
                  onClick={() => setShowAdvancedSettings(!showAdvancedSettings)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Shield size={14} className="text-primary-400" />
                    <span>Cài đặt bảo mật liên kết (Mật khẩu, Hạn dùng, Tải về)</span>
                    {(publicShare?.hasPassword || publicShare?.expiresAt || !allowDownload) && (
                      <span className="badge badge-blue" style={{ fontSize: '0.6875rem', padding: '1px 6px' }}>
                        Đã kích hoạt
                      </span>
                    )}
                  </div>
                  {showAdvancedSettings ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>

                {showAdvancedSettings && (
                  <div className="advanced-settings-body">
                    <div className="advanced-settings-grid">
                      {/* Mật khẩu truy cập */}
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <KeyRound size={13} />
                          <span>Mật khẩu bảo vệ (Tùy chọn)</span>
                        </label>
                        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                          <input
                            type={showPassword ? 'text' : 'password'}
                            className="form-input"
                            placeholder={publicShare?.hasPassword ? '•••••••• (Đã khóa mật khẩu)' : 'Để trống nếu không khóa...'}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            style={{ paddingRight: '32px' }}
                          />
                          <button
                            type="button"
                            className="btn-icon"
                            style={{ position: 'absolute', right: '6px', padding: '4px' }}
                            onClick={() => setShowPassword(!showPassword)}
                          >
                            {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                          </button>
                        </div>
                      </div>

                      {/* Ngày hết hạn */}
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Calendar size={13} />
                          <span>Hạn truy cập liên kết (Tùy chọn)</span>
                        </label>
                        <input
                          type="date"
                          className="form-input"
                          value={expiresAt}
                          onChange={(e) => setExpiresAt(e.target.value)}
                        />
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '12px', flexWrap: 'wrap', gap: '10px' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8125rem', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={allowDownload}
                          onChange={(e) => setAllowDownload(e.target.checked)}
                        />
                        <span>Cho phép người xem tải tệp xuống</span>
                      </label>

                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={handleSaveSecuritySettings}
                        disabled={linkUpdating}
                      >
                        {linkUpdating ? <span className="spinner" /> : 'Lưu cấu hình bảo mật'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* KHỐI 2: CHIA SẺ VỚI NGƯỜI & NHÓM QUA EMAIL */}
          <div className="share-card-section">
            <div className="share-card-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Users size={18} className="text-primary-400" />
                <span style={{ fontWeight: 700, fontSize: '0.9375rem', color: 'var(--text-primary)' }}>
                  Những người có quyền truy cập
                </span>
              </div>
            </div>

            {/* Form mời cộng tác viên */}
            <form onSubmit={handleAddCollaborator} className="add-collaborator-form">
              <input
                type="email"
                placeholder="Nhập email người cần chia sẻ (ví dụ: colleague@gmail.com)..."
                className="form-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                style={{ flex: 1 }}
              />
              <select
                className="form-select"
                style={{ width: '125px' }}
                value={role}
                onChange={(e) => setRole(e.target.value)}
              >
                <option value="viewer">Người xem</option>
                <option value="editor">Chỉnh sửa</option>
              </select>
              <button
                className="btn btn-primary"
                type="submit"
                disabled={loading || !email.trim()}
                style={{ padding: '0 16px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                {loading ? <span className="spinner" /> : 'Chia sẻ'}
              </button>
            </form>

            {/* Danh sách người có quyền truy cập */}
            <div className="collaborators-container">
              {/* Dòng chủ sở hữu */}
              <div className="collaborator-item">
                <div className="collaborator-user-info">
                  <div className="avatar-circle avatar-owner">
                    {(currentUser?.name || currentUser?.email || 'B')[0].toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {currentUser?.name || 'Bạn'} <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>(Bạn)</span>
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {currentUser?.email || ''}
                    </div>
                  </div>
                </div>
                <span className="badge badge-owner">Chủ sở hữu</span>
              </div>

              {/* Danh sách cộng tác viên được mời */}
              {fetchingShares ? (
                <div style={{ padding: '16px', textAlign: 'center', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                  <span className="spinner" style={{ width: 18, height: 18, display: 'inline-block', marginRight: 8 }} />
                  Đang tải danh sách cộng tác viên...
                </div>
              ) : shares.length === 0 ? (
                <div style={{ padding: '12px 16px', fontSize: '0.8125rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                  Chưa có người dùng nào được cấp quyền riêng biệt qua Email.
                </div>
              ) : (
                shares.map((share) => {
                  const userObj = share.sharedWith || share.user || {};
                  const shareId = share._id || share.shareId;
                  const displayName = userObj.name || 'Người dùng';
                  const displayEmail = userObj.email || share.sharedEmail || '';
                  const initialLetter = (displayName || displayEmail || 'U')[0].toUpperCase();

                  return (
                    <div key={shareId} className="collaborator-item">
                      <div className="collaborator-user-info">
                        <div className="avatar-circle">
                          {initialLetter}
                        </div>
                        <div>
                          <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                            {displayName}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            {displayEmail}
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <select
                          className="form-select"
                          style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                          value={share.role}
                          onChange={(e) => handleUpdateRole(shareId, e.target.value)}
                        >
                          <option value="viewer">Người xem</option>
                          <option value="editor">Chỉnh sửa</option>
                        </select>
                        <button
                          type="button"
                          className="btn-icon"
                          title="Thu hồi quyền chia sẻ"
                          onClick={() => handleRemoveCollaborator(shareId)}
                        >
                          <UserMinus size={15} style={{ color: 'var(--accent-rose, #f43f5e)' }} />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </Modal>

      {/* MODAL MÃ QR CODE */}
      {showQrModal && (
        <Modal
          isOpen={showQrModal}
          onClose={() => setShowQrModal(false)}
          title="Mã QR Code chia sẻ liên kết"
          size="sm"
          footer={
            <div style={{ display: 'flex', gap: '10px', width: '100%', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleDownloadQrCode}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <Download size={15} />
                <span>Tải ảnh QR (PNG)</span>
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => setShowQrModal(false)}>
                Đóng
              </button>
            </div>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '12px 0' }}>
            <div
              style={{
                padding: '16px',
                background: '#ffffff',
                borderRadius: '16px',
                boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
                marginBottom: '16px'
              }}
            >
              {qrCodeDataUrl ? (
                <img
                  src={qrCodeDataUrl}
                  alt="Mã QR Code liên kết"
                  style={{ width: '220px', height: '220px', display: 'block' }}
                />
              ) : (
                <span className="spinner" style={{ width: 36, height: 36 }} />
              )}
            </div>

            <div style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
              {item?.name}
            </div>
            <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', maxWidth: '320px', lineHeight: 1.5 }}>
              Quét mã QR bằng ứng dụng camera hoặc Zalo trên điện thoại để mở trực tiếp tài liệu này.
            </div>
          </div>
        </Modal>
      )}
    </>
  );
};

export default ShareModal;
