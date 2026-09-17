import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Lock, CheckCircle2, AlertCircle } from 'lucide-react';
import authService from '../../services/authService';
import { useToast } from '../../contexts/ToastContext';

const ResetPasswordPage = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const toast = useToast();
  const navigate = useNavigate();

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

    if (newPassword.length < 6) {
      setErrorMsg('Mật khẩu mới phải có ít nhất 6 ký tự.');
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
          <Link to="/forgot-password" className="btn btn-primary" style={{ width: '100%' }}>
            Yêu cầu liên kết mới
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-card animate-slide-in">
        <div className="auth-header">
          <div className="auth-logo">
            <Lock size={26} />
          </div>
          <h1 className="auth-title">Đặt lại mật khẩu mới</h1>
          <p className="auth-subtitle">Nhập mật khẩu mới cho tài khoản của bạn</p>
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
            <label className="form-label">Mật khẩu mới (tối thiểu 6 ký tự)</label>
            <input
              type="password"
              className="form-input"
              placeholder="••••••••"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              autoFocus
            />
          </div>

          <div className="form-group">
            <label className="form-label">Xác nhận mật khẩu mới</label>
            <input
              type="password"
              className="form-input"
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </div>

          <button type="submit" className="btn btn-primary auth-submit-btn" disabled={loading}>
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
