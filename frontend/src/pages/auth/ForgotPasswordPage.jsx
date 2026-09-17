import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { KeyRound, Mail, ArrowLeft, CheckCircle2 } from 'lucide-react';
import authService from '../../services/authService';
import { useToast } from '../../contexts/ToastContext';

const ForgotPasswordPage = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const toast = useToast();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;

    setLoading(true);
    try {
      await authService.forgotPassword(email.trim());
      setSubmitted(true);
      toast.success('Đã gửi yêu cầu đặt lại mật khẩu.');
    } catch (err) {
      toast.error('Có lỗi xảy ra, vui lòng thử lại sau.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card animate-slide-in">
        <div className="auth-header">
          <div className="auth-logo" style={{ background: 'linear-gradient(135deg, var(--accent-amber), #d97706)' }}>
            <KeyRound size={26} />
          </div>
          <h1 className="auth-title">Quên mật khẩu?</h1>
          <p className="auth-subtitle">
            Nhập email tài khoản của bạn để nhận liên kết đặt lại mật khẩu mới
          </p>
        </div>

        {submitted ? (
          <div style={{ textAlign: 'center', padding: '16px 0' }}>
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: '50%',
                backgroundColor: '#d1fae5',
                color: '#059669',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px'
              }}
            >
              <CheckCircle2 size={28} />
            </div>
            <h3 style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px' }}>
              Kiểm tra hộp thư của bạn
            </h3>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              Nếu email <strong>{email}</strong> tồn tại trong hệ thống, hướng dẫn đặt lại mật khẩu đã được gửi đến bạn.
            </p>
            <div style={{ marginTop: '24px' }}>
              <Link to="/login" className="btn btn-secondary" style={{ width: '100%' }}>
                Quay lại Đăng nhập
              </Link>
            </div>
          </div>
        ) : (
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

            <button type="submit" className="btn btn-primary auth-submit-btn" disabled={loading}>
              {loading ? <span className="spinner" /> : 'Gửi liên kết đặt lại'}
            </button>
          </form>
        )}

        <div className="auth-footer">
          <Link to="/login" className="auth-link" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <ArrowLeft size={16} />
            <span>Quay lại trang Đăng nhập</span>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default ForgotPasswordPage;
