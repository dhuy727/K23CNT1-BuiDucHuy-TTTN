import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  Globe,
  Lock,
  Download,
  AlertCircle,
  Eye,
  Cloud,
  FileCheck
} from 'lucide-react';
import FileIcon from '../../components/drive/FileIcon';
import shareService from '../../services/shareService';
import { useToast } from '../../contexts/ToastContext';

const PublicSharePage = () => {
  const { shareToken } = useParams();
  const [data, setData] = useState(null);
  const [requiresPassword, setRequiresPassword] = useState(false);
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  // Preview state
  const [blobUrl, setBlobUrl] = useState(null);
  const [textContent, setTextContent] = useState('');
  const [loadingPreview, setLoadingPreview] = useState(false);

  const toast = useToast();

  const fetchPublicItem = async (pwd = null) => {
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await shareService.getPublicItem(shareToken, pwd);
      if (res.data?.requiresPassword) {
        setRequiresPassword(true);
      } else {
        setRequiresPassword(false);
        setData(res.data);
        // Tự động tải preview nếu là tệp
        if (res.data?.item && res.data?.itemType === 'file') {
          loadPreview(pwd);
        }
      }
    } catch (err) {
      console.error('Lỗi truy cập link công khai:', err);
      setErrorMsg(err.response?.data?.message || 'Liên kết không hợp lệ hoặc đã hết hạn.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPublicItem();

    return () => {
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
      }
    };
  }, [shareToken]);

  const loadPreview = async (pwd = null) => {
    setLoadingPreview(true);
    try {
      const blob = await shareService.getPublicFilePreview(shareToken, pwd);
      const mime = (blob.type || '').toLowerCase();

      if (
        mime.startsWith('text/') ||
        mime.includes('json') ||
        mime.includes('javascript')
      ) {
        const text = await blob.text();
        setTextContent(text);
      }

      const url = URL.createObjectURL(blob);
      setBlobUrl(url);
    } catch (e) {
      console.warn('Không thể tạo bản xem trước:', e);
    } finally {
      setLoadingPreview(false);
    }
  };

  const handlePasswordSubmit = (e) => {
    e.preventDefault();
    if (!password.trim()) return;
    fetchPublicItem(password.trim());
  };

  const handleDownload = async () => {
    try {
      toast.info('Đang bắt đầu tải xuống...');
      const blob = await shareService.getPublicFileDownload(shareToken, password || null);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = data?.item?.name || 'download';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('Đã tải xuống thành công');
    } catch (err) {
      toast.error('Tải tệp tin thất bại');
    }
  };

  const formatSize = (bytes) => {
    if (!bytes && bytes !== 0) return '-';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  if (loading) {
    return (
      <div className="auth-page">
        <div className="auth-card" style={{ textAlign: 'center', padding: '50px' }}>
          <span className="spinner" style={{ width: 36, height: 36, margin: '0 auto' }} />
          <div style={{ marginTop: '16px', color: 'var(--text-secondary)' }}>
            Đang tải dữ liệu liên kết chia sẻ...
          </div>
        </div>
      </div>
    );
  }

  if (errorMsg) {
    return (
      <div className="auth-page">
        <div className="auth-card animate-slide-in" style={{ textAlign: 'center' }}>
          <div style={{ color: 'var(--accent-rose)', marginBottom: '16px' }}>
            <AlertCircle size={48} style={{ margin: '0 auto' }} />
          </div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '8px' }}>
            Không thể truy cập tài liệu
          </h2>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>{errorMsg}</p>
        </div>
      </div>
    );
  }

  if (requiresPassword) {
    return (
      <div className="auth-page">
        <div className="auth-card animate-slide-in">
          <div className="auth-header">
            <div className="auth-logo" style={{ background: 'linear-gradient(135deg, var(--accent-amber), #d97706)' }}>
              <Lock size={26} />
            </div>
            <h1 className="auth-title">Liên kết được bảo vệ</h1>
            <p className="auth-subtitle">Người chia sẻ đã đặt mật khẩu cho tài liệu này</p>
          </div>

          <form onSubmit={handlePasswordSubmit} className="auth-form">
            <div className="form-group">
              <label className="form-label">Mật khẩu truy cập</label>
              <input
                type="password"
                className="form-input"
                placeholder="Nhập mật khẩu..."
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoFocus
              />
            </div>

            <button type="submit" className="btn btn-primary auth-submit-btn">
              Mở khóa tài liệu
            </button>
          </form>
        </div>
      </div>
    );
  }

  const item = data?.item;
  const allowDownload = data?.share?.allowDownload !== false;
  const isFile = data?.itemType === 'file';
  const mime = (item?.mimeType || '').toLowerCase();
  const ext = (item?.extension || '').toLowerCase();

  const isImage = mime.startsWith('image/') || ['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext);
  const isVideo = mime.startsWith('video/') || ['mp4', 'webm', 'mov'].includes(ext);
  const isAudio = mime.startsWith('audio/') || ['mp3', 'wav', 'ogg'].includes(ext);
  const isPdf = mime.includes('pdf') || ext === 'pdf';
  const isText = Boolean(textContent);

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg-app)', display: 'flex', flexDirection: 'column' }}>
      {/* Top Navbar */}
      <header
        style={{
          height: '64px',
          backgroundColor: 'var(--bg-surface)',
          borderBottom: '1px solid var(--border-main)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 24px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div className="brand-icon" style={{ width: 32, height: 32 }}>
            <Cloud size={18} />
          </div>
          <span style={{ fontWeight: 800, fontSize: '1.125rem', color: 'var(--primary-600)' }}>
            CloudDrive
          </span>
          <span className="badge badge-blue">Chia sẻ công khai</span>
        </div>

        {allowDownload && isFile && (
          <button className="btn btn-primary" onClick={handleDownload}>
            <Download size={16} />
            <span>Tải về ({formatSize(item?.size)})</span>
          </button>
        )}
      </header>

      {/* Main View */}
      <div style={{ flex: 1, padding: '32px 24px', maxWidth: '1000px', margin: '0 auto', width: '100%' }}>
        {/* Item Info Card */}
        <div
          style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-main)',
            borderRadius: 'var(--radius-xl)',
            padding: '24px',
            boxShadow: 'var(--shadow-sm)',
            marginBottom: '24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <FileIcon mimeType={item?.mimeType} extension={item?.extension} size={40} />
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                {item?.name}
              </h2>
              <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                {formatSize(item?.size)} • Chia sẻ bởi <strong>{data?.share?.owner?.name || 'Chủ sở hữu'}</strong>
              </div>
            </div>
          </div>
        </div>

        {/* Media Preview Box */}
        {isFile && (
          <div
            style={{
              backgroundColor: '#0b0f19',
              borderRadius: 'var(--radius-xl)',
              overflow: 'hidden',
              minHeight: '450px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: 'var(--shadow-lg)'
            }}
          >
            {loadingPreview ? (
              <div style={{ color: '#ffffff', textAlign: 'center' }}>
                <span className="spinner" style={{ width: 32, height: 32, margin: '0 auto' }} />
                <div style={{ marginTop: '12px', fontSize: '0.875rem' }}>Đang tải bản xem trước...</div>
              </div>
            ) : blobUrl ? (
              <>
                {isImage && (
                  <img
                    src={blobUrl}
                    alt={item?.name}
                    style={{ maxWidth: '100%', maxHeight: '600px', objectFit: 'contain' }}
                  />
                )}

                {isVideo && (
                  <video src={blobUrl} controls style={{ maxWidth: '90%', maxHeight: '500px', borderRadius: '8px' }} />
                )}

                {isAudio && (
                  <div style={{ padding: '40px' }}>
                    <audio src={blobUrl} controls style={{ width: 340 }} />
                  </div>
                )}

                {isPdf && (
                  <iframe src={`${blobUrl}#toolbar=1`} title={item?.name} style={{ width: '100%', height: '650px', border: 'none' }} />
                )}

                {isText && (
                  <pre className="preview-text-box" style={{ height: '500px' }}>
                    <code>{textContent}</code>
                  </pre>
                )}

                {!isImage && !isVideo && !isAudio && !isPdf && !isText && (
                  <div style={{ textAlign: 'center', color: '#cbd5e1', padding: '40px' }}>
                    <FileCheck size={48} style={{ margin: '0 auto 12px', color: 'var(--primary-400)' }} />
                    <div style={{ fontSize: '1rem', fontWeight: 600 }}>Tệp tin đã sẵn sàng</div>
                    <div style={{ fontSize: '0.8125rem', color: '#94a3b8', marginTop: '4px' }}>
                      Định dạng này không hỗ trợ xem trực tuyến. Vui lòng tải về máy để xem.
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div style={{ color: '#94a3b8', fontSize: '0.875rem' }}>
                Không thể tải bản xem trước trực tiếp.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default PublicSharePage;
