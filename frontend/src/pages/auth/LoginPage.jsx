import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Layers, Lock, Mail, AlertCircle, Eye, EyeOff, Sun, Moon } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';

const LoginPage = () => {
  const [email, setEmail] = useState(() => {
    return localStorage.getItem('smartdocs_remember_email') || '';
  });
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(() => {
    return localStorage.getItem('smartdocs_remember_me') === 'true';
  });
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light');

  const { login } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const from = location.state?.from?.pathname || '/drive';

  // Đồng bộ theme
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);

    try {
      await login({ email: email.trim(), password });

      // Xử lý ghi nhớ mật khẩu / tài khoản
      if (rememberMe) {
        localStorage.setItem('smartdocs_remember_email', email.trim());
        localStorage.setItem('smartdocs_remember_me', 'true');
      } else {
        localStorage.removeItem('smartdocs_remember_email');
        localStorage.removeItem('smartdocs_remember_me');
      }

      toast.success('Đăng nhập SmartDocs thành công');
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
      {/* Nút chuyển đổi Light/Dark Theme nhanh ở góc */}
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
        {/* Brand Header */}
        <div className="auth-header">
          <div className="auth-logo-badge">
            <Layers size={24} />
          </div>
          <div className="auth-brand-tag">SmartDocs Workspace</div>
          <h1 className="auth-title">Đăng nhập SmartDocs</h1>
          <p className="auth-subtitle">Hệ thống quản lý và chia sẻ tài liệu thông minh</p>
        </div>

        {/* Thông báo lỗi nếu có */}
        {errorMsg && (
          <div className="auth-alert-box auth-alert-error" role="alert">
            <AlertCircle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Form đăng nhập */}
        <form onSubmit={handleSubmit} className="auth-form">
          <div className="auth-field-group">
            <label className="auth-field-label" htmlFor="login-email">
              Địa chỉ Email
            </label>
            <div className="auth-input-wrapper">
              <span className="auth-input-icon">
                <Mail size={18} />
              </span>
              <input
                id="login-email"
                name="email"
                type="email"
                className="auth-input"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="username email"
                required
                autoFocus={!email}
              />
            </div>
          </div>

          <div className="auth-field-group">
            <label className="auth-field-label" htmlFor="login-password">
              Mật khẩu
            </label>
            <div className="auth-input-wrapper">
              <span className="auth-input-icon">
                <Lock size={18} />
              </span>
              <input
                id="login-password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                className="auth-input"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
                autoFocus={Boolean(email)}
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

          {/* Hàng tùy chọn: Ghi nhớ mật khẩu & Quên mật khẩu */}
          <div className="auth-options-row">
            <label className="auth-remember-label" htmlFor="remember-me-checkbox">
              <input
                id="remember-me-checkbox"
                name="rememberMe"
                type="checkbox"
                className="auth-checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
              />
              <span>Ghi nhớ mật khẩu</span>
            </label>

            <Link to="/forgot-password" className="auth-link-forgot">
              Quên mật khẩu?
            </Link>
          </div>

          <button
            type="submit"
            className="auth-submit-btn"
            disabled={loading}
          >
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
