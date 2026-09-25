import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { MailCheck, RefreshCw, AlertCircle, Mail, Key, Sun, Moon } from 'lucide-react';
import authService from '../../services/authService';
import { useToast } from '../../contexts/ToastContext';

const VerifyEmailPage = () => {
  const [searchParams] = useSearchParams();
  const initialEmail = searchParams.get('email') || '';

  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
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

  const handleVerify = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    if (!code.trim()) {
      setErrorMsg('Vui lòng nhập mã xác thực');
      return;
    }

    setLoading(true);
    try {
      await authService.verifyEmail({ email: email.trim(), code: code.trim() });
      toast.success('Xác thực email thành công! Bạn có thể đăng nhập ngay.');
      navigate('/login');
    } catch (err) {
      const msg = err.response?.data?.message || 'Mã xác thực không hợp lệ hoặc đã hết hạn.';
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (!email.trim()) {
      setErrorMsg('Vui lòng nhập email để gửi lại mã.');
      return;
    }

    setResending(true);
    try {
      await authService.resendVerificationCode(email.trim());
      toast.info('Mã xác thực mới đã được gửi vào hòm thư của bạn.');
    } catch (err) {
      toast.error('Không thể gửi lại mã vào lúc này.');
    } finally {
      setResending(false);
    }
  };

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
          <div className="auth-logo-badge" style={{ background: 'linear-gradient(135deg, var(--accent-emerald), #059669)' }}>
            <MailCheck size={24} />
          </div>
          <div className="auth-brand-tag" style={{ color: '#059669', borderColor: 'rgba(5, 150, 105, 0.3)', backgroundColor: 'rgba(5, 150, 105, 0.1)' }}>
            Xác thực tài khoản
          </div>
          <h1 className="auth-title">Xác thực Email</h1>
          <p className="auth-subtitle">Nhập mã xác thực 6 chữ số đã được gửi tới email của bạn</p>
        </div>

        {errorMsg && (
          <div className="auth-alert-box auth-alert-error" role="alert">
            <AlertCircle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleVerify} className="auth-form">
          <div className="auth-field-group">
            <label className="auth-field-label" htmlFor="verify-email">
              Email tài khoản
            </label>
            <div className="auth-input-wrapper">
              <span className="auth-input-icon">
                <Mail size={18} />
              </span>
              <input
                id="verify-email"
                type="email"
                className="auth-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
              />
            </div>
          </div>

          <div className="auth-field-group">
            <label className="auth-field-label" htmlFor="verify-code">
              Mã xác thực (OTP 6 số)
            </label>
            <div className="auth-input-wrapper">
              <span className="auth-input-icon">
                <Key size={18} />
              </span>
              <input
                id="verify-code"
                type="text"
                maxLength={6}
                className="auth-input"
                placeholder="123456"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                style={{ textAlign: 'center', fontSize: '1.2rem', letterSpacing: '4px', fontWeight: 700 }}
                autoComplete="one-time-code"
                required
                autoFocus
              />
            </div>
          </div>

          <button type="submit" className="auth-submit-btn" disabled={loading}>
            {loading ? <span className="spinner" /> : 'Xác thực tài khoản'}
          </button>
        </form>

        <div style={{ marginTop: '16px', textAlign: 'center' }}>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={handleResendCode}
            disabled={resending}
            style={{ fontSize: '0.8125rem', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <RefreshCw size={14} className={resending ? 'spinner' : ''} />
            <span>Chưa nhận được mã? Gửi lại mã</span>
          </button>
        </div>

        <div className="auth-footer">
          Đã xác thực xong?{' '}
          <Link to="/login" className="auth-link">
            Quay lại Đăng nhập
          </Link>
        </div>
      </div>
    </div>
  );
};

export default VerifyEmailPage;
