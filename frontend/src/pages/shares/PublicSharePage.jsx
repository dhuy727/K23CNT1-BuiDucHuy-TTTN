import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import {
  Globe,
  Lock,
  Unlock,
  Download,
  AlertCircle,
  Eye,
  EyeOff,
  Layers,
  FileCheck,
  Sparkles,
  QrCode,
  X,
  Copy,
  Check,
  ChevronRight,
  Folder,
  FileText,
  Calendar,
  ExternalLink,
  ShieldCheck,
  Share2
} from 'lucide-react';
import QRCode from 'qrcode';
import FileIcon from '../../components/drive/FileIcon';
import DocxViewer from '../../components/drive/DocxViewer';
import shareService from '../../services/shareService';
import { useToast } from '../../contexts/ToastContext';

const PublicSharePage = () => {
  const { shareToken } = useParams();
  const [data, setData] = useState(null);
  const [requiresPassword, setRequiresPassword] = useState(false);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [currentFolderId, setCurrentFolderId] = useState(null);

  // Main file preview state
  const [blobUrl, setBlobUrl] = useState(null);
  const [docxBlob, setDocxBlob] = useState(null);
  const [textContent, setTextContent] = useState('');
  const [loadingPreview, setLoadingPreview] = useState(false);

  // Modal preview state for files inside folder
  const [previewModalFile, setPreviewModalFile] = useState(null);
  const [modalBlobUrl, setModalBlobUrl] = useState(null);
  const [modalDocxBlob, setModalDocxBlob] = useState(null);
  const [modalTextContent, setModalTextContent] = useState('');
  const [modalLoadingPreview, setModalLoadingPreview] = useState(false);

  // QR Code Modal State
  const [showQrModal, setShowQrModal] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);

  const toast = useToast();

  const fetchPublicItem = async (pwd = null, folderId = null) => {
    setLoading(true);
    setErrorMsg('');
    try {
      const params = folderId ? { folderId } : {};
      const res = await shareService.getPublicItem(shareToken, pwd, params);
      
      if (res.data?.requiresPassword) {
        setRequiresPassword(true);
      } else {
        setRequiresPassword(false);
        setData(res.data);
        // Tự động tải preview nếu đối tượng là tệp tin đơn lẻ
        if (res.data?.item && res.data?.itemType === 'file') {
          loadMainFilePreview(pwd, res.data.item);
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
    fetchPublicItem(null, null);

    return () => {
      if (blobUrl) URL.revokeObjectURL(blobUrl);
      if (modalBlobUrl) URL.revokeObjectURL(modalBlobUrl);
    };
  }, [shareToken]);

  // Load preview cho tệp tin chính
  const loadMainFilePreview = async (pwd = null, fileItem = null) => {
    setLoadingPreview(true);
    try {
      const item = fileItem || data?.item;
      const ext = (item?.extension || '').toLowerCase();
      const mime = (item?.mimeType || '').toLowerCase();
      const isDocx = ext === 'docx' || mime.includes('wordprocessingml');

      const blob = await shareService.getPublicFilePreview(shareToken, pwd);
      
      if (isDocx) {
        setDocxBlob(blob);
      } else if (
        mime.startsWith('text/') ||
        mime.includes('json') ||
        mime.includes('javascript') ||
        ['txt', 'md', 'json', 'js', 'html', 'css', 'py', 'java', 'sql', 'xml'].includes(ext)
      ) {
        const text = await blob.text();
        setTextContent(text);
        setBlobUrl(URL.createObjectURL(blob));
      } else {
        const url = URL.createObjectURL(blob);
        setBlobUrl(url);
      }
    } catch (e) {
      console.warn('Không thể tạo bản xem trước trực tiếp:', e);
    } finally {
      setLoadingPreview(false);
    }
  };

  const handlePasswordSubmit = (e) => {
    e.preventDefault();
    if (!password.trim()) return;
    fetchPublicItem(password.trim(), currentFolderId);
  };

  // Tải về file chính
  const handleDownloadMain = async () => {
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

  // Tải về một file trong thư mục
  const handleDownloadFolderFile = async (file) => {
    try {
      toast.info(`Đang tải xuống ${file.name}...`);
      const blob = await shareService.getPublicFileDownload(shareToken, password || null, file._id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('Đã tải xuống thành công');
    } catch (err) {
      toast.error('Tải tệp tin thất bại');
    }
  };

  // Xem trước một file bên trong thư mục
  const handleOpenFilePreview = async (file) => {
    setPreviewModalFile(file);
    setModalLoadingPreview(true);
    setModalBlobUrl(null);
    setModalDocxBlob(null);
    setModalTextContent('');

    try {
      const ext = (file?.extension || '').toLowerCase();
      const mime = (file?.mimeType || '').toLowerCase();
      const isDocx = ext === 'docx' || mime.includes('wordprocessingml');

      const blob = await shareService.getPublicFilePreview(shareToken, password || null, file._id);

      if (isDocx) {
        setModalDocxBlob(blob);
      } else if (
        mime.startsWith('text/') ||
        mime.includes('json') ||
        mime.includes('javascript') ||
        ['txt', 'md', 'json', 'js', 'html', 'css', 'py', 'java', 'sql', 'xml'].includes(ext)
      ) {
        const text = await blob.text();
        setModalTextContent(text);
        setModalBlobUrl(URL.createObjectURL(blob));
      } else {
        const url = URL.createObjectURL(blob);
        setModalBlobUrl(url);
      }
    } catch (err) {
      console.warn('Lỗi xem trước file trong thư mục:', err);
    } finally {
      setModalLoadingPreview(false);
    }
  };

  const handleCloseFilePreview = () => {
    if (modalBlobUrl) {
      URL.revokeObjectURL(modalBlobUrl);
    }
    setPreviewModalFile(null);
    setModalBlobUrl(null);
    setModalDocxBlob(null);
    setModalTextContent('');
  };

  // Điều hướng thư mục con
  const handleNavigateFolder = (folderId) => {
    setCurrentFolderId(folderId);
    fetchPublicItem(password || null, folderId);
  };

  // Mở QR Code
  const handleOpenQrModal = async () => {
    try {
      const currentUrl = window.location.href;
      const qrUrl = await QRCode.toDataURL(currentUrl, {
        width: 280,
        margin: 2,
        color: { dark: '#0f172a', light: '#ffffff' }
      });
      setQrDataUrl(qrUrl);
      setShowQrModal(true);
    } catch (e) {
      toast.error('Không thể tạo mã QR');
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopiedLink(true);
      toast.success('Đã sao chép liên kết vào clipboard');
      setTimeout(() => setCopiedLink(false), 2000);
    } catch (e) {
      toast.error('Sao chép thất bại');
    }
  };

  const handleDownloadQrImage = () => {
    if (!qrDataUrl) return;
    const a = document.createElement('a');
    a.href = qrDataUrl;
    a.download = `SmartDocs-QR-${data?.item?.name || 'Share'}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const formatSize = (bytes) => {
    if (!bytes && bytes !== 0) return '-';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  // 1. Loading state
  if (loading && !data) {
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

  // 2. Error state
  if (errorMsg) {
    return (
      <div className="auth-page">
        <div className="auth-card animate-slide-in" style={{ textAlign: 'center' }}>
          <div style={{ color: 'var(--accent-rose, #f43f5e)', marginBottom: '16px' }}>
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

  // 3. Password Prompt state
  if (requiresPassword) {
    return (
      <div className="auth-page">
        <div className="auth-card animate-slide-in">
          <div className="auth-header">
            <div className="auth-logo" style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}>
              <Lock size={26} />
            </div>
            <h1 className="auth-title">Liên kết được bảo vệ</h1>
            <p className="auth-subtitle">Chủ sở hữu đã đặt mật khẩu bảo vệ cho tài liệu này</p>
          </div>

          <form onSubmit={handlePasswordSubmit} className="auth-form">
            <div className="form-group">
              <label className="form-label">Mật khẩu truy cập</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="form-input"
                  placeholder="Nhập mật khẩu..."
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoFocus
                  style={{ paddingRight: '40px' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute',
                    right: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer'
                  }}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button type="submit" className="btn btn-primary auth-submit-btn">
              <Unlock size={16} />
              <span>Mở khóa tài liệu</span>
            </button>
          </form>
        </div>
      </div>
    );
  }

  const item = data?.item;
  const allowDownload = data?.share?.allowDownload !== false;
  const isFile = data?.itemType === 'file';
  const isFolder = data?.itemType === 'folder';

  const mime = (item?.mimeType || '').toLowerCase();
  const ext = (item?.extension || '').toLowerCase();

  const isDocx = ext === 'docx' || mime.includes('wordprocessingml');
  const isImage = mime.startsWith('image/') || ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext);
  const isVideo = mime.startsWith('video/') || ['mp4', 'webm', 'mov'].includes(ext);
  const isAudio = mime.startsWith('audio/') || ['mp3', 'wav', 'ogg'].includes(ext);
  const isPdf = mime.includes('pdf') || ext === 'pdf';
  const isText = Boolean(textContent);

  return (
    <div className="public-share-root">
      {/* ── Top Navbar ── */}
      <header className="public-navbar">
        <div className="public-navbar-brand">
          <div className="public-brand-logo">
            <Layers size={18} />
          </div>
          <span className="public-brand-title">SmartDocs</span>
          <span className="badge badge-blue">
            <Globe size={12} style={{ marginRight: '4px' }} />
            Chia sẻ công khai
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={handleOpenQrModal}
            title="Quét mã QR trên điện thoại"
          >
            <QrCode size={15} />
            <span className="hidden-mobile">Mã QR</span>
          </button>

          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={handleCopyLink}
            title="Sao chép đường liên kết"
          >
            {copiedLink ? <Check size={15} className="text-emerald-400" /> : <Copy size={15} />}
            <span className="hidden-mobile">{copiedLink ? 'Đã chép' : 'Sao chép link'}</span>
          </button>

          {allowDownload && isFile && (
            <button type="button" className="btn btn-primary btn-sm" onClick={handleDownloadMain}>
              <Download size={15} />
              <span>Tải về ({formatSize(item?.size)})</span>
            </button>
          )}
        </div>
      </header>

      {/* ── Main View Container ── */}
      <main className="public-main-content">
        {/* ── Item Hero Banner ── */}
        <section className="public-hero-card animate-slide-in">
          <div className="public-hero-header">
            <div className="public-item-primary">
              <div className="public-item-icon-wrap">
                {isFolder ? (
                  <Folder size={32} style={{ color: '#38bdf8' }} />
                ) : (
                  <FileIcon mimeType={item?.mimeType} extension={item?.extension} size={34} />
                )}
              </div>
              <div className="public-item-details">
                <h1 className="public-item-title">{item?.name}</h1>
                <div className="public-item-meta">
                  {isFile && (
                    <span className="public-meta-pill">
                      <strong>{formatSize(item?.size)}</strong>
                    </span>
                  )}
                  <span className="public-meta-pill">
                    Chia sẻ bởi <strong>{data?.share?.owner?.name || 'Chủ sở hữu'}</strong>
                  </span>
                  <span className="public-meta-pill">
                    <ShieldCheck size={13} style={{ color: '#10b981' }} />
                    {data?.share?.role === 'editor' ? 'Quyền chỉnh sửa' : 'Chỉ xem'}
                  </span>
                  {data?.share?.expiresAt && (
                    <span className="public-meta-pill">
                      <Calendar size={13} />
                      Hết hạn: {new Date(data.share.expiresAt).toLocaleDateString('vi-VN')}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {allowDownload && isFile && (
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleDownloadMain}
                style={{ padding: '8px 18px', gap: '8px' }}
              >
                <Download size={16} />
                <span>Tải tệp xuống</span>
              </button>
            )}
          </div>

          {/* SmartDocs AI Intelligence Card (if available) */}
          {isFile && (item?.aiCategory || (item?.aiTags && item.aiTags.length > 0) || item?.aiSummary) && (
            <div className="public-ai-card">
              <div className="public-ai-card-header">
                <div className="public-ai-card-title">
                  <Sparkles size={16} style={{ color: '#f59e0b' }} />
                  <span>Trí tuệ nhân tạo SmartDocs AI</span>
                </div>
                {item?.aiCategory && (
                  <span className="badge badge-purple" style={{ fontSize: '0.75rem' }}>
                    {item.aiCategory}
                  </span>
                )}
              </div>

              {item?.aiSummary && (
                <div className="public-ai-summary-box">
                  {item.aiSummary}
                </div>
              )}

              {item?.aiTags && item.aiTags.length > 0 && (
                <div className="public-ai-tags-wrap">
                  {item.aiTags.map((tag, idx) => (
                    <span key={idx} className="public-ai-tag-chip">
                      #{tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>

        {/* ── SECTION 1: Single File Preview ── */}
        {isFile && (
          <section className="public-preview-box">
            {loadingPreview ? (
              <div style={{ color: '#ffffff', textAlign: 'center', padding: '60px' }}>
                <span className="spinner" style={{ width: 36, height: 36, margin: '0 auto' }} />
                <div style={{ marginTop: '14px', fontSize: '0.9rem', fontWeight: 600 }}>
                  Đang khởi tạo bản xem trước tài liệu...
                </div>
              </div>
            ) : isDocx ? (
              <div style={{ width: '100%', height: '700px' }}>
                <DocxViewer
                  blob={docxBlob}
                  file={item}
                  onDownload={allowDownload ? handleDownloadMain : null}
                  initialTab="preview"
                />
              </div>
            ) : blobUrl ? (
              <>
                {isImage && (
                  <div style={{ padding: '20px', display: 'flex', justifyContent: 'center' }}>
                    <img
                      src={blobUrl}
                      alt={item?.name}
                      style={{
                        maxWidth: '100%',
                        maxHeight: '620px',
                        objectFit: 'contain',
                        borderRadius: '8px',
                        boxShadow: '0 8px 24px rgba(0,0,0,0.4)'
                      }}
                    />
                  </div>
                )}

                {isVideo && (
                  <video
                    src={blobUrl}
                    controls
                    style={{
                      maxWidth: '92%',
                      maxHeight: '540px',
                      borderRadius: '10px',
                      boxShadow: '0 8px 24px rgba(0,0,0,0.5)'
                    }}
                  />
                )}

                {isAudio && (
                  <div style={{ padding: '60px 40px', textAlign: 'center' }}>
                    <audio src={blobUrl} controls style={{ width: 360 }} />
                  </div>
                )}

                {isPdf && (
                  <iframe
                    src={`${blobUrl}#toolbar=1`}
                    title={item?.name}
                    style={{ width: '100%', height: '700px', border: 'none' }}
                  />
                )}

                {isText && (
                  <pre className="preview-text-box" style={{ height: '540px', width: '100%', margin: 0 }}>
                    <code>{textContent}</code>
                  </pre>
                )}

                {!isImage && !isVideo && !isAudio && !isPdf && !isText && (
                  <div style={{ textAlign: 'center', color: '#cbd5e1', padding: '50px 24px' }}>
                    <FileCheck size={52} style={{ margin: '0 auto 16px', color: 'var(--primary-400)' }} />
                    <div style={{ fontSize: '1.05rem', fontWeight: 700 }}>Tệp tin sẵn sàng</div>
                    <div style={{ fontSize: '0.85rem', color: '#94a3b8', marginTop: '6px' }}>
                      Định dạng này không hỗ trợ hiển thị trực tuyến. Vui lòng tải về để xem trên thiết bị của bạn.
                    </div>
                    {allowDownload && (
                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={handleDownloadMain}
                        style={{ marginTop: '16px' }}
                      >
                        <Download size={16} />
                        <span>Tải tệp về máy</span>
                      </button>
                    )}
                  </div>
                )}
              </>
            ) : (
              <div style={{ textAlign: 'center', color: '#94a3b8', padding: '50px 20px' }}>
                <FileCheck size={48} style={{ margin: '0 auto 12px', color: 'var(--primary-400)' }} />
                <div style={{ fontSize: '0.95rem', fontWeight: 600 }}>Tệp tin sẵn sàng tải xuống</div>
                {allowDownload && (
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={handleDownloadMain}
                    style={{ marginTop: '14px' }}
                  >
                    <Download size={15} />
                    <span>Tải về ngay</span>
                  </button>
                )}
              </div>
            )}
          </section>
        )}

        {/* ── SECTION 2: Folder Explorer ── */}
        {isFolder && (
          <section className="public-folder-explorer">
            {/* Breadcrumb Ribbon */}
            <div className="public-breadcrumbs-bar">
              {data?.breadcrumbs?.map((crumb, idx) => {
                const isLast = idx === data.breadcrumbs.length - 1;
                return (
                  <React.Fragment key={crumb._id || idx}>
                    {idx > 0 && <ChevronRight size={14} style={{ color: '#64748b' }} />}
                    {isLast ? (
                      <span className="public-crumb-current">
                        <Folder size={15} style={{ color: '#38bdf8' }} />
                        <span>{crumb.name}</span>
                      </span>
                    ) : (
                      <button
                        type="button"
                        className="public-crumb-btn"
                        onClick={() => handleNavigateFolder(crumb._id === data.rootFolder?._id ? null : crumb._id)}
                      >
                        <Folder size={15} />
                        <span>{crumb.name}</span>
                      </button>
                    )}
                  </React.Fragment>
                );
              })}
            </div>

            {/* Subfolders Grid */}
            {data?.subfolders && data.subfolders.length > 0 && (
              <div>
                <h3 className="public-section-title">
                  <Folder size={16} style={{ color: '#38bdf8' }} />
                  <span>Thư mục ({data.subfolders.length})</span>
                </h3>
                <div className="public-folders-grid">
                  {data.subfolders.map((folder) => (
                    <div
                      key={folder._id}
                      className="public-folder-card"
                      onClick={() => handleNavigateFolder(folder._id)}
                      title={`Mở thư mục ${folder.name}`}
                    >
                      <Folder size={20} style={{ color: '#38bdf8', flexShrink: 0 }} />
                      <span className="public-folder-card-name">{folder.name}</span>
                      <ChevronRight size={15} style={{ color: '#64748b', flexShrink: 0 }} />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Files Grid */}
            {data?.files && data.files.length > 0 && (
              <div>
                <h3 className="public-section-title">
                  <FileText size={16} style={{ color: '#818cf8' }} />
                  <span>Tệp tin ({data.files.length})</span>
                </h3>
                <div className="public-files-grid">
                  {data.files.map((file) => (
                    <div key={file._id} className="public-file-card">
                      <div className="public-file-card-top" onClick={() => handleOpenFilePreview(file)} style={{ cursor: 'pointer' }}>
                        <FileIcon mimeType={file.mimeType} extension={file.extension} size={36} />
                      </div>
                      <div className="public-file-card-info">
                        <div
                          className="public-file-card-title"
                          onClick={() => handleOpenFilePreview(file)}
                          style={{ cursor: 'pointer' }}
                          title={file.name}
                        >
                          {file.name}
                        </div>
                        <div className="public-file-card-meta">
                          <span>{file.formattedSize || formatSize(file.size)}</span>
                          <span className="badge badge-purple" style={{ textTransform: 'uppercase', fontSize: '0.65rem' }}>
                            {file.extension || 'file'}
                          </span>
                        </div>
                        <div className="public-file-card-actions">
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleOpenFilePreview(file)}
                          >
                            <Eye size={13} />
                            <span>Xem</span>
                          </button>
                          {allowDownload && (
                            <button
                              type="button"
                              className="btn btn-primary btn-sm"
                              onClick={() => handleDownloadFolderFile(file)}
                            >
                              <Download size={13} />
                              <span>Tải</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Empty Folder State */}
            {(!data?.subfolders || data.subfolders.length === 0) &&
              (!data?.files || data.files.length === 0) && (
                <div className="public-empty-box">
                  <Folder size={44} style={{ margin: '0 auto 12px', color: '#64748b' }} />
                  <div style={{ fontSize: '0.95rem', fontWeight: 600 }}>Thư mục này trống</div>
                  <div style={{ fontSize: '0.8125rem', color: '#94a3b8', marginTop: '4px' }}>
                    Chưa có tệp tin hoặc thư mục con nào được chia sẻ trong thư mục này.
                  </div>
                </div>
              )}
          </section>
        )}
      </main>

      {/* ── MODAL: Folder File Preview Popup ── */}
      {previewModalFile && (
        <div className="modal-overlay" onClick={handleCloseFilePreview}>
          <div
            className="modal-card animate-scale-up"
            style={{ maxWidth: '960px', width: '92vw', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                <FileIcon mimeType={previewModalFile.mimeType} extension={previewModalFile.extension} size={22} />
                <h3 className="modal-title" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {previewModalFile.name}
                </h3>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {allowDownload && (
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={() => handleDownloadFolderFile(previewModalFile)}
                  >
                    <Download size={14} />
                    <span>Tải về</span>
                  </button>
                )}
                <button type="button" className="btn-icon" onClick={handleCloseFilePreview}>
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="modal-body" style={{ flex: 1, padding: 0, minHeight: '450px', background: '#0b0f19', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
              {modalLoadingPreview ? (
                <div style={{ color: '#ffffff', textAlign: 'center', padding: '40px' }}>
                  <span className="spinner" style={{ width: 32, height: 32, margin: '0 auto' }} />
                  <div style={{ marginTop: '12px', fontSize: '0.875rem' }}>Đang tải xem trước...</div>
                </div>
              ) : modalDocxBlob ? (
                <div style={{ width: '100%', height: '600px' }}>
                  <DocxViewer
                    blob={modalDocxBlob}
                    file={previewModalFile}
                    onDownload={allowDownload ? () => handleDownloadFolderFile(previewModalFile) : null}
                    initialTab="preview"
                  />
                </div>
              ) : modalBlobUrl ? (
                (() => {
                  const mExt = (previewModalFile.extension || '').toLowerCase();
                  const mMime = (previewModalFile.mimeType || '').toLowerCase();
                  const mIsImg = mMime.startsWith('image/') || ['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(mExt);
                  const mIsVid = mMime.startsWith('video/') || ['mp4', 'webm', 'mov'].includes(mExt);
                  const mIsAud = mMime.startsWith('audio/') || ['mp3', 'wav', 'ogg'].includes(mExt);
                  const mIsPdf = mMime.includes('pdf') || mExt === 'pdf';

                  if (mIsImg) {
                    return (
                      <img
                        src={modalBlobUrl}
                        alt={previewModalFile.name}
                        style={{ maxWidth: '95%', maxHeight: '550px', objectFit: 'contain' }}
                      />
                    );
                  }
                  if (mIsVid) {
                    return <video src={modalBlobUrl} controls style={{ maxWidth: '95%', maxHeight: '500px' }} />;
                  }
                  if (mIsAud) {
                    return (
                      <div style={{ padding: '50px' }}>
                        <audio src={modalBlobUrl} controls style={{ width: 340 }} />
                      </div>
                    );
                  }
                  if (mIsPdf) {
                    return (
                      <iframe
                        src={`${modalBlobUrl}#toolbar=1`}
                        title={previewModalFile.name}
                        style={{ width: '100%', height: '600px', border: 'none' }}
                      />
                    );
                  }
                  if (modalTextContent) {
                    return (
                      <pre className="preview-text-box" style={{ width: '100%', height: '550px', margin: 0 }}>
                        <code>{modalTextContent}</code>
                      </pre>
                    );
                  }
                  return (
                    <div style={{ textAlign: 'center', color: '#cbd5e1', padding: '40px' }}>
                      <FileCheck size={48} style={{ margin: '0 auto 12px', color: 'var(--primary-400)' }} />
                      <div style={{ fontWeight: 600 }}>Tệp không hỗ trợ xem trực tuyến</div>
                      {allowDownload && (
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          onClick={() => handleDownloadFolderFile(previewModalFile)}
                          style={{ marginTop: '12px' }}
                        >
                          <Download size={14} />
                          <span>Tải xuống tệp</span>
                        </button>
                      )}
                    </div>
                  );
                })()
              ) : (
                <div style={{ color: '#94a3b8', fontSize: '0.875rem' }}>
                  Không thể hiển thị xem trước trực tiếp.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: QR Code Scanner ── */}
      {showQrModal && (
        <div className="modal-overlay" onClick={() => setShowQrModal(false)}>
          <div
            className="modal-card animate-scale-up"
            style={{ maxWidth: '380px', width: '90vw', textAlign: 'center' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h3 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <QrCode size={18} className="text-primary-400" />
                <span>Mã QR liên kết</span>
              </h3>
              <button type="button" className="btn-icon" onClick={() => setShowQrModal(false)}>
                <X size={18} />
              </button>
            </div>

            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', padding: '24px' }}>
              <div
                style={{
                  background: '#ffffff',
                  padding: '12px',
                  borderRadius: '12px',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
                  display: 'inline-block'
                }}
              >
                {qrDataUrl ? (
                  <img src={qrDataUrl} alt="QR Code" style={{ width: '220px', height: '220px', display: 'block' }} />
                ) : (
                  <span className="spinner" style={{ width: 40, height: 40 }} />
                )}
              </div>

              <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                Dùng camera điện thoại hoặc ứng dụng quét mã để truy cập tài liệu tức thì.
              </div>

              <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={handleCopyLink}
                  style={{ flex: 1, justifyContent: 'center' }}
                >
                  {copiedLink ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                  <span>{copiedLink ? 'Đã sao chép' : 'Chép link'}</span>
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleDownloadQrImage}
                  style={{ flex: 1, justifyContent: 'center' }}
                >
                  <Download size={14} />
                  <span>Tải ảnh QR</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PublicSharePage;
