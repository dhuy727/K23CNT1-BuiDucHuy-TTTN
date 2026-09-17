import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Cloud, Lock, Mail, User, Phone, AlertCircle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';

const RegisterPage = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const { register } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (password.length < 8) {
      setErrorMsg('Mật khẩu phải có độ dài từ 8 ký tự trở lên.');
      return;
    }

    setLoading(true);
    try {
      await register({
        name: name.trim(),
        email: email.trim(),
        password,
        phone: phone.trim()
      });
      toast.success('Đăng ký tài khoản thành công. Vui lòng xác thực email.');
      navigate(`/verify-email?email=${encodeURIComponent(email.trim())}`);
    } catch (err) {
      console.error('Đăng ký thất bại:', err);
      const msg = err.response?.data?.message || 'Đăng ký tài khoản thất bại. Vui lòng thử lại.';
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card animate-slide-in">
        <div className="auth-header">
          <div className="auth-logo">
            <Cloud size={26} />
          </div>
          <h1 className="auth-title">Đăng ký tài khoản</h1>
          <p className="auth-subtitle">Trải nghiệm lưu trữ và quản lý tài liệu đám mây</p>
        </div>

        {errorMsg && (
          <div
            style={{
              padding: '12px 14px',
              backgroundColor: '#fee2e2',
              color: '#b91c1c',
              borderRadius: 'var(--radius-md)',
              fontSize: '0.8125rem',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '20px'
            }}
          >
            <AlertCircle size={18} style={{ flexShrink: 0 }} />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label className="form-label">Họ và tên</label>
            <div className="search-input-wrapper" style={{ borderRadius: 'var(--radius-md)' }}>
              <User size={18} style={{ color: 'var(--text-muted)' }} />
              <input
                type="text"
                className="search-input"
                placeholder="Nguyễn Văn A"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoFocus
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Địa chỉ Email</label>
            <div className="search-input-wrapper" style={{ borderRadius: 'var(--radius-md)' }}>
              <Mail size={18} style={{ color: 'var(--text-muted)' }} />
              <input
                type="email"
                className="search-input"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Số điện thoại (Tùy chọn)</label>
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

          <div className="form-group">
            <label className="form-label">Mật khẩu (tối thiểu 8 ký tự)</label>
            <div className="search-input-wrapper" style={{ borderRadius: 'var(--radius-md)' }}>
              <Lock size={18} style={{ color: 'var(--text-muted)' }} />
              <input
                type="password"
                className="search-input"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
          </div>

          <button type="submit" className="btn btn-primary auth-submit-btn" disabled={loading}>
            {loading ? <span className="spinner" /> : 'Tạo tài khoản'}
          </button>
        </form>

        <div className="auth-footer">
          Đã có tài khoản?{' '}
          <Link to="/login" className="auth-link">
            Đăng nhập
          </Link>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;
