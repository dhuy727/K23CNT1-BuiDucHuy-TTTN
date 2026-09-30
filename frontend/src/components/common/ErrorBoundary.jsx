import React from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Lỗi giao diện không mong muốn (ErrorBoundary):', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = '/home';
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'var(--bg-main, #f8fafc)',
            padding: '24px',
            color: 'var(--text-primary, #1e293b)',
            fontFamily: 'inherit'
          }}
        >
          <div
            style={{
              maxWidth: '520px',
              width: '100%',
              backgroundColor: 'var(--bg-card, #ffffff)',
              borderRadius: '16px',
              padding: '32px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
              border: '1px solid var(--border-color, #e2e8f0)',
              textAlign: 'center'
            }}
          >
            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                color: '#ef4444',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 20px auto'
              }}
            >
              <AlertTriangle size={32} />
            </div>

            <h2
              style={{
                fontSize: '1.35rem',
                fontWeight: 700,
                marginBottom: '8px',
                color: 'var(--text-primary, #0f172a)'
              }}
            >
              Đã xảy ra sự cố hiển thị
            </h2>

            <p
              style={{
                fontSize: '0.9rem',
                color: 'var(--text-muted, #64748b)',
                marginBottom: '24px',
                lineHeight: 1.5
              }}
            >
              Hệ thống vừa gặp phải lỗi giao diện ngoài dự kiến. Bạn có thể tải lại trang hoặc quay về trang chủ để tiếp tục làm việc.
            </p>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '12px',
                marginBottom: '20px'
              }}
            >
              <button
                type="button"
                onClick={this.handleReload}
                className="btn btn-primary"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '9px 18px',
                  borderRadius: '8px',
                  fontWeight: 600,
                  fontSize: '0.875rem'
                }}
              >
                <RefreshCw size={16} />
                Tải lại trang
              </button>

              <button
                type="button"
                onClick={this.handleGoHome}
                className="btn btn-secondary"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '9px 18px',
                  borderRadius: '8px',
                  fontWeight: 600,
                  fontSize: '0.875rem'
                }}
              >
                <Home size={16} />
                Về trang chủ
              </button>
            </div>

            {this.state.error && (
              <details
                style={{
                  textAlign: 'left',
                  marginTop: '16px',
                  backgroundColor: 'var(--bg-hover, #f1f5f9)',
                  padding: '12px',
                  borderRadius: '8px',
                  fontSize: '0.78rem',
                  color: 'var(--text-muted, #475569)',
                  wordBreak: 'break-all'
                }}
              >
                <summary style={{ cursor: 'pointer', fontWeight: 600 }}>Chi tiết lỗi kỹ thuật</summary>
                <div style={{ marginTop: '8px', fontFamily: 'monospace', color: '#dc2626' }}>
                  {this.state.error.toString()}
                </div>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
