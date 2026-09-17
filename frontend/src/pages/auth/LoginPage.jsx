import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Cloud, Lock, Mail, AlertCircle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';

const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const { login } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const from = location.state?.from?.pathname || '/drive';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);

    try {
      await login({ email: email.trim(), password });
      toast.success('Đăng nhập thành công');
      navigate(from, { replace: true });
    } catch (err) {
      console.error('Đăng nhập thất bại:', err);
      const msg = err.response?.data?.message || 'Đăng nhập không thành công. Vui lòng kiểm tra lại thông tin.';
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
          <h1 className="auth-title">Đăng nhập CloudDrive</h1>
          <p className="auth-subtitle">Hệ thống quản lý và chia sẻ tệp tin thông minh</p>
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
                autoFocus
              />
            </div>
          </div>

          <div className="form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label className="form-label">Mật khẩu</label>
              <Link to="/forgot-password" className="auth-link" style={{ fontSize: '0.8125rem' }}>
                Quên mật khẩu?
              </Link>
            </div>
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
            {loading ? <span className="spinner" /> : 'Đăng nhập ngay'}
          </button>
        </form>

        <div className="auth-footer">
          Chưa có tài khoản?{' '}
          <Link to="/register" className="auth-link">
            Đăng ký tài khoản mới
          </Link>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
