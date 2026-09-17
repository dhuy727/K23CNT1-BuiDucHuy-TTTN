import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { MailCheck, RefreshCw, AlertCircle } from 'lucide-react';
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

  const toast = useToast();
  const navigate = useNavigate();

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
      <div className="auth-card animate-slide-in">
        <div className="auth-header">
          <div className="auth-logo" style={{ background: 'linear-gradient(135deg, var(--accent-emerald), #059669)' }}>
            <MailCheck size={26} />
          </div>
          <h1 className="auth-title">Xác thực Email</h1>
          <p className="auth-subtitle">Nhập mã xác thực 6 chữ số đã được gửi tới email của bạn</p>
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

        <form onSubmit={handleVerify} className="auth-form">
          <div className="form-group">
            <label className="form-label">Email tài khoản</label>
            <input
              type="email"
              className="form-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Mã xác thực (OTP 6 số)</label>
            <input
              type="text"
              maxLength="6"
              className="form-input"
              placeholder="123456"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              style={{ textAlign: 'center', fontSize: '1.25rem', letterSpacing: '4px', fontWeight: 700 }}
              required
              autoFocus
            />
          </div>

          <button type="submit" className="btn btn-primary auth-submit-btn" disabled={loading}>
            {loading ? <span className="spinner" /> : 'Xác thực tài khoản'}
          </button>
        </form>

        <div style={{ marginTop: '20px', textAlign: 'center' }}>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={handleResendCode}
            disabled={resending}
            style={{ fontSize: '0.8125rem' }}
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
