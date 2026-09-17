import React, { useState, useEffect } from 'react';
import { User, Mail, Phone, Save, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import authService from '../../services/authService';
import { useToast } from '../../contexts/ToastContext';

const ProfilePage = () => {
  const { user, updateUser } = useAuth();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setPhone(user.phone || '');
    }
  }, [user]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await authService.updateProfile({
        name: name.trim(),
        phone: phone.trim()
      });
      updateUser(res.data);
      toast.success('Cập nhật thông tin cá nhân thành công');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Cập nhật thông tin thất bại');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', width: '100%' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)' }}>
          Hồ sơ cá nhân
        </h1>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
          Quản lý thông tin tài khoản và số điện thoại của bạn
        </p>
      </div>

      <div
        style={{
          backgroundColor: 'var(--bg-card)',
          borderRadius: 'var(--radius-xl)',
          border: '1px solid var(--border-main)',
          padding: '28px',
          boxShadow: 'var(--shadow-sm)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
          <div className="avatar-circle" style={{ width: 64, height: 64, fontSize: '1.5rem' }}>
            {(user?.name || user?.email || 'U')[0].toUpperCase()}
          </div>
          <div>
            <div style={{ fontSize: '1.125rem', fontWeight: 700 }}>{user?.name}</div>
            <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{user?.email}</div>
            <div style={{ marginTop: '4px' }}>
              <span className="badge badge-purple">{user?.role?.toUpperCase()}</span>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Họ và tên</label>
            <div className="search-input-wrapper" style={{ borderRadius: 'var(--radius-md)' }}>
              <User size={18} style={{ color: 'var(--text-muted)' }} />
              <input
                type="text"
                className="search-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Địa chỉ Email</label>
            <div className="search-input-wrapper" style={{ borderRadius: 'var(--radius-md)', opacity: 0.8 }}>
              <Mail size={18} style={{ color: 'var(--text-muted)' }} />
              <input
                type="email"
                className="search-input"
                value={user?.email || ''}
                readOnly
                disabled
              />
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Email định danh không thể thay đổi trực tiếp.
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Số điện thoại</label>
            <div className="search-input-wrapper" style={{ borderRadius: 'var(--radius-md)' }}>
              <Phone size={18} style={{ color: 'var(--text-muted)' }} />
              <input
                type="tel"
                className="search-input"
                placeholder="0988888888"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
          </div>

          <div style={{ marginTop: '24px' }}>
            <button type="submit" className="btn btn-primary" disabled={loading} style={{ width: '100%' }}>
              {loading ? (
                <span className="spinner" />
              ) : (
                <>
                  <Save size={16} />
                  <span>Lưu thay đổi</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ProfilePage;
