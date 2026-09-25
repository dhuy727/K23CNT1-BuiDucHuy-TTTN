import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Lock, AlertCircle, Eye, EyeOff, Layers, Sun, Moon } from 'lucide-react';
import authService from '../../services/authService';
import { useToast } from '../../contexts/ToastContext';

const ResetPasswordPage = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light');

  const toast = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  useEffect(() => {
    const verifyToken = async () => {
      if (!token) {
        setChecking(false);
        setTokenValid(false);
        return;
      }

      try {
        const res = await authService.verifyForgotPassword(token);
        setTokenValid(Boolean(res.data?.valid));
      } catch (err) {
        setTokenValid(false);
      } finally {
        setChecking(false);
      }
    };

    verifyToken();
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (newPassword.length < 8) {
      setErrorMsg('Mật khẩu mới phải có ít nhất 8 ký tự.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMsg('Mật khẩu xác nhận không khớp.');
      return;
    }

    setLoading(true);
    try {
      await authService.resetPassword({ token, newPassword });
      toast.success('Đặt lại mật khẩu thành công. Vui lòng đăng nhập bằng mật khẩu mới.');
      navigate('/login');
    } catch (err) {
      const msg = err.response?.data?.message || 'Không thể đặt lại mật khẩu hoặc liên kết đã hết hạn.';
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <div className="auth-page">
        <div className="auth-card" style={{ textAlign: 'center', padding: '40px' }}>
          <span className="spinner" style={{ width: 32, height: 32, margin: '0 auto' }} />
          <div style={{ marginTop: '16px', color: 'var(--text-secondary)' }}>
            Đang kiểm tra liên kết đặt lại mật khẩu...
          </div>
        </div>
      </div>
    );
  }

  if (!tokenValid) {
    return (
      <div className="auth-page">
        <div className="auth-card animate-slide-in" style={{ textAlign: 'center' }}>
          <div style={{ color: 'var(--accent-rose)', marginBottom: '16px' }}>
            <AlertCircle size={48} style={{ margin: '0 auto' }} />
          </div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '8px' }}>
            Liên kết không hợp lệ hoặc đã hết hạn
          </h2>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '24px' }}>
            Liên kết đặt lại mật khẩu này đã hết hạn hoặc không tồn tại. Vui lòng gửi lại yêu cầu mới.
          </p>
          <Link to="/forgot-password" className="auth-submit-btn" style={{ textDecoration: 'none' }}>
            Yêu cầu liên kết mới
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-top-bar">
        <button
          type="button"
          className="auth-theme-toggle"
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Chuyển sang giao diện Sáng' : 'Chuyển sang giao diện Tối'}
          aria-label="Đổi giao diện"
        >
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>
      </div>

      <div className="auth-card animate-slide-in">
        <div className="auth-header">
          <div className="auth-logo-badge">
            <Layers size={24} />
          </div>
          <div className="auth-brand-tag">Bảo mật tài khoản</div>
          <h1 className="auth-title">Đặt lại mật khẩu mới</h1>
          <p className="auth-subtitle">Nhập mật khẩu mới an toàn cho tài khoản SmartDocs của bạn</p>
        </div>

        {errorMsg && (
          <div className="auth-alert-box auth-alert-error" role="alert">
            <AlertCircle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="auth-field-group">
            <label className="auth-field-label" htmlFor="reset-new-password">
              Mật khẩu mới (tối thiểu 8 ký tự)
            </label>
            <div className="auth-input-wrapper">
              <span className="auth-input-icon">
                <Lock size={18} />
              </span>
              <input
                id="reset-new-password"
                type={showPassword ? 'text' : 'password'}
                className="auth-input"
                placeholder="••••••••"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
                required
                autoFocus
              />
              <button
                type="button"
                className="auth-toggle-pass-btn"
                onClick={() => setShowPassword((prev) => !prev)}
                title={showPassword ? 'Ẩn mật khẩu' : 'Hiển thị mật khẩu'}
                aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiển thị mật khẩu'}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <div className="auth-field-group">
            <label className="auth-field-label" htmlFor="reset-confirm-password">
              Xác nhận mật khẩu mới
            </label>
            <div className="auth-input-wrapper">
              <span className="auth-input-icon">
                <Lock size={18} />
              </span>
              <input
                id="reset-confirm-password"
                type={showConfirmPassword ? 'text' : 'password'}
                className="auth-input"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                required
              />
              <button
                type="button"
                className="auth-toggle-pass-btn"
                onClick={() => setShowConfirmPassword((prev) => !prev)}
                title={showConfirmPassword ? 'Ẩn mật khẩu' : 'Hiển thị mật khẩu'}
                aria-label={showConfirmPassword ? 'Ẩn mật khẩu' : 'Hiển thị mật khẩu'}
              >
                {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button type="submit" className="auth-submit-btn" disabled={loading}>
            {loading ? <span className="spinner" /> : 'Xác nhận đổi mật khẩu'}
          </button>
        </form>

        <div className="auth-footer">
          <Link to="/login" className="auth-link">
            Quay lại Đăng nhập
          </Link>
        </div>
      </div>
    </div>
  );
};

export default ResetPasswordPage;
