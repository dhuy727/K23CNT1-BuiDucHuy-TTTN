import React, { useState, useEffect } from 'react';
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
  ShieldCheck,
  Edit3
} from 'lucide-react';
import QRCode from 'qrcode';
import FileIcon from '../../components/drive/FileIcon';
import DocxViewer from '../../components/drive/DocxViewer';
import RealtimeCollaborativeEditor from '../../components/drive/RealtimeCollaborativeEditor';
import { isRealtimeEditableFile, getRealtimeEditorType } from '../../services/collabService';
import shareService from '../../services/shareService';
import { useToast } from '../../contexts/ToastContext';
import { useAuth } from '../../contexts/AuthContext';

const PublicSharePage = () => {
  const { shareToken } = useParams();
  const { user: currentUser } = useAuth();
  const [data, setData] = useState(null);
  const [requiresPassword, setRequiresPassword] = useState(false);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [currentFolderId, setCurrentFolderId] = useState(null);

  // Main file view mode: 'edit' | 'preview'
  const [viewMode, setViewMode] = useState('preview');

  // Main file preview state
  const [blobUrl, setBlobUrl] = useState(null);
  const [docxBlob, setDocxBlob] = useState(null);
  const [textContent, setTextContent] = useState('');
  const [loadingPreview, setLoadingPreview] = useState(false);

  // Modal preview/edit state for files inside folder
  const [previewModalFile, setPreviewModalFile] = useState(null);
  const [modalViewMode, setModalViewMode] = useState('preview'); // 'preview' | 'edit'
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

        const isEditorRole =
          res.data?.share?.role === 'editor' || res.data?.role === 'editor';

        if (res.data?.item && res.data?.itemType === 'file') {
          if (isEditorRole && isRealtimeEditableFile(res.data.item)) {
            setViewMode('edit');
          } else {
            setViewMode('preview');
          }
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

      const blob = await shareService.getPublicFilePreview(shareToken, pwd || password || null);

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

  // Xem trước hoặc chỉnh sửa một file bên trong thư mục
  const handleOpenFilePreview = async (file, initialMode = 'preview') => {
    setPreviewModalFile(file);
    const isEditorRole = data?.share?.role === 'editor' || data?.role === 'editor';
    const fileEditable = Boolean(isEditorRole && isRealtimeEditableFile(file));
    setModalViewMode(fileEditable && initialMode === 'edit' ? 'edit' : 'preview');
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
    a.download = `DocuFlow-QR-${data?.item?.name || 'Share'}.png`;
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
  const canEdit = data?.share?.role === 'editor' || data?.role === 'editor';
  const isFile = data?.itemType === 'file';
  const isFolder = data?.itemType === 'folder';
  const canRealtimeEdit = Boolean(canEdit && isFile && isRealtimeEditableFile(item));
  const isExcel = isFile && getRealtimeEditorType(item) === 'excel';

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
          <span className="public-brand-title">DocuFlow</span>
          <span className="badge badge-blue hidden-mobile">
            <Globe size={12} style={{ marginRight: '4px' }} />
            Chia sẻ công khai
          </span>
          {canEdit && (
            <span className="badge badge-emerald hidden-mobile">
              <Edit3 size={12} style={{ marginRight: '4px' }} />
              Cho phép chỉnh sửa trực tiếp
            </span>
          )}
        </div>

        <div className="public-navbar-actions">
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
              <span>
                Tải về <span className="hidden-mobile tabular-nums">({formatSize(item?.size)})</span>
              </span>
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
                    <span className="public-meta-pill tabular-nums">
                      <strong>{formatSize(item?.size)}</strong>
                    </span>
                  )}
                  <span className="public-meta-pill">
                    Chia sẻ bởi <strong>{data?.share?.owner?.name || 'Chủ sở hữu'}</strong>
                  </span>
                  <span className="public-meta-pill">
                    <ShieldCheck size={13} style={{ color: '#10b981' }} />
                    {canEdit ? 'Quyền chỉnh sửa trực tiếp' : 'Chỉ xem'}
                  </span>
                  {data?.share?.expiresAt && (
                    <span className="public-meta-pill tabular-nums">
                      <Calendar size={13} />
                      Hết hạn: {new Date(data.share.expiresAt).toLocaleDateString('vi-VN')}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="public-hero-actions">
              {canRealtimeEdit && (
                <div className="public-mode-switcher">
                  <button
                    type="button"
                    className={`btn btn-sm ${viewMode === 'edit' ? 'btn-primary' : 'btn-ghost'}`}
                    onClick={() => setViewMode('edit')}
                  >
                    <Edit3 size={14} />
                    <span>Soạn thảo trực tiếp</span>
                  </button>
                  <button
                    type="button"
                    className={`btn btn-sm ${viewMode === 'preview' ? 'btn-primary' : 'btn-ghost'}`}
                    onClick={() => {
                      setViewMode('preview');
                      loadMainFilePreview(password || null, item);
                    }}
                  >
                    <Eye size={14} />
                    <span>Xem trước</span>
                  </button>
                </div>
              )}

              {allowDownload && isFile && (
                <button
                  type="button"
                  className="btn btn-primary public-hero-download-btn"
                  onClick={handleDownloadMain}
                >
                  <Download size={16} />
                  <span>Tải tệp xuống</span>
                </button>
              )}
            </div>
          </div>

          {/* DocuFlow AI Intelligence Card (if available) */}
          {isFile && (item?.aiCategory || (item?.aiTags && item.aiTags.length > 0) || item?.aiSummary) && (
            <div className="public-ai-card">
              <div className="public-ai-card-header">
                <div className="public-ai-card-title">
                  <Sparkles size={16} style={{ color: '#f59e0b' }} />
                  <span>Trí tuệ nhân tạo DocuFlow AI</span>
                </div>
                {item?.aiCategory && (
                  <span className="badge badge-purple" style={{ fontSize: '0.75rem' }}>
                    {item.aiCategory}
                  </span>
                )}
              </div>

              {item?.aiSummary && <div className="public-ai-summary-box">{item.aiSummary}</div>}

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

        {/* ── SECTION 1: Single File Realtime Editor or Preview ── */}
        {isFile && (
          canRealtimeEdit && viewMode === 'edit' ? (
            <section>
              <RealtimeCollaborativeEditor
                file={item}
                shareToken={shareToken}
                password={password || null}
                currentUser={currentUser}
                onSaved={(savedData) => {
                  if (savedData?.size !== undefined) {
                    setData((prev) =>
                      prev
                        ? {
                            ...prev,
                            item: {
                              ...prev.item,
                              size: savedData.size
                            }
                          }
                        : prev
                    );
                  }
                }}
              />
            </section>
          ) : isExcel ? (
            <section>
              <RealtimeCollaborativeEditor
                file={item}
                shareToken={shareToken}
                password={password || null}
                currentUser={currentUser}
                readOnly={true}
              />
            </section>
          ) : (
            <section className="public-preview-box">
              {loadingPreview ? (
                <div style={{ color: '#ffffff', textAlign: 'center', padding: '60px 20px' }}>
                  <span className="spinner" style={{ width: 36, height: 36, margin: '0 auto' }} />
                  <div style={{ marginTop: '14px', fontSize: '0.9rem', fontWeight: 600 }}>
                    Đang khởi tạo bản xem trước tài liệu...
                  </div>
                </div>
              ) : isDocx ? (
                <div className="public-docx-viewer-wrap">
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
                    <div style={{ padding: '16px', display: 'flex', justifyContent: 'center', width: '100%' }}>
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
                        maxWidth: '94%',
                        maxHeight: '540px',
                        borderRadius: '10px',
                        boxShadow: '0 8px 24px rgba(0,0,0,0.5)'
                      }}
                    />
                  )}

                  {isAudio && (
                    <div style={{ padding: '40px 20px', textAlign: 'center', width: '100%', maxWidth: '380px' }}>
                      <audio src={blobUrl} controls style={{ width: '100%' }} />
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
          )
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
                  {data.files.map((file) => {
                    const fileEditable = Boolean(canEdit && isRealtimeEditableFile(file));
                    return (
                      <div key={file._id} className="public-file-card">
                        <div
                          className="public-file-card-top"
                          onClick={() => handleOpenFilePreview(file, fileEditable ? 'edit' : 'preview')}
                          style={{ cursor: 'pointer' }}
                        >
                          <FileIcon mimeType={file.mimeType} extension={file.extension} size={36} />
                        </div>
                        <div className="public-file-card-info">
                          <div
                            className="public-file-card-title"
                            onClick={() => handleOpenFilePreview(file, fileEditable ? 'edit' : 'preview')}
                            style={{ cursor: 'pointer' }}
                            title={file.name}
                          >
                            {file.name}
                          </div>
                          <div className="public-file-card-meta">
                            <span className="tabular-nums">{file.formattedSize || formatSize(file.size)}</span>
                            <span className="badge badge-purple" style={{ textTransform: 'uppercase', fontSize: '0.65rem' }}>
                              {file.extension || 'file'}
                            </span>
                          </div>
                          <div className="public-file-card-actions">
                            {fileEditable && (
                              <button
                                type="button"
                                className="btn btn-primary btn-sm"
                                onClick={() => handleOpenFilePreview(file, 'edit')}
                              >
                                <Edit3 size={13} />
                                <span>Sửa</span>
                              </button>
                            )}
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              onClick={() => handleOpenFilePreview(file, 'preview')}
                            >
                              <Eye size={13} />
                              <span>Xem</span>
                            </button>
                            {allowDownload && (
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                onClick={() => handleDownloadFolderFile(file)}
                              >
                                <Download size={13} />
                                <span>Tải</span>
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
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

      {/* ── MODAL: Folder File Preview / Edit Popup ── */}
      {previewModalFile && (
        <div className="modal-overlay" onClick={handleCloseFilePreview}>
          <div
            className="modal-card modal-full animate-scale-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="preview-toolbar">
              <div className="preview-toolbar-title-wrap">
                <FileIcon mimeType={previewModalFile.mimeType} extension={previewModalFile.extension} size={22} />
                <h3
                  className="modal-title"
                  style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.95rem' }}
                >
                  {previewModalFile.name}
                </h3>
              </div>
              <div className="preview-toolbar-actions">
                {canEdit && isRealtimeEditableFile(previewModalFile) && (
                  <div className="preview-mode-switcher">
                    <button
                      type="button"
                      className={`btn btn-sm ${modalViewMode === 'edit' ? 'btn-primary' : 'btn-ghost'}`}
                      onClick={() => setModalViewMode('edit')}
                      style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                    >
                      <Edit3 size={13} />
                      <span>Soạn thảo</span>
                    </button>
                    <button
                      type="button"
                      className={`btn btn-sm ${modalViewMode === 'preview' ? 'btn-primary' : 'btn-ghost'}`}
                      onClick={() => handleOpenFilePreview(previewModalFile, 'preview')}
                      style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                    >
                      <Eye size={13} />
                      <span>Xem trước</span>
                    </button>
                  </div>
                )}
                {allowDownload && (
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={() => handleDownloadFolderFile(previewModalFile)}
                  >
                    <Download size={14} />
                    <span className="hidden-mobile">Tải về</span>
                  </button>
                )}
                <button type="button" className="btn-icon" onClick={handleCloseFilePreview}>
                  <X size={18} />
                </button>
              </div>
            </div>

            <div
              className="modal-body"
              style={{
                flex: 1,
                padding: 0,
                minHeight: 0,
                background: '#0b0f19',
                display: 'flex',
                alignItems: 'stretch',
                justifyContent: 'center',
                overflow: 'hidden'
              }}
            >
              {canEdit && isRealtimeEditableFile(previewModalFile) && modalViewMode === 'edit' ? (
                <div style={{ width: '100%', height: '100%', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                  <RealtimeCollaborativeEditor
                    file={previewModalFile}
                    shareToken={shareToken}
                    password={password || null}
                    currentUser={currentUser}
                  />
                </div>
              ) : getRealtimeEditorType(previewModalFile) === 'excel' ? (
                <div style={{ width: '100%', height: '100%', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                  <RealtimeCollaborativeEditor
                    file={previewModalFile}
                    shareToken={shareToken}
                    password={password || null}
                    currentUser={currentUser}
                    readOnly={true}
                  />
                </div>
              ) : modalLoadingPreview ? (
                <div style={{ color: '#ffffff', textAlign: 'center', padding: '40px', margin: 'auto' }}>
                  <span className="spinner" style={{ width: 32, height: 32, margin: '0 auto' }} />
                  <div style={{ marginTop: '12px', fontSize: '0.875rem' }}>Đang tải xem trước...</div>
                </div>
              ) : modalDocxBlob ? (
                <div style={{ width: '100%', height: '100%' }}>
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
                        style={{ maxWidth: '95%', maxHeight: '550px', objectFit: 'contain', margin: 'auto' }}
                      />
                    );
                  }
                  if (mIsVid) {
                    return <video src={modalBlobUrl} controls style={{ maxWidth: '95%', maxHeight: '500px', margin: 'auto' }} />;
                  }
                  if (mIsAud) {
                    return (
                      <div style={{ padding: '30px 20px', margin: 'auto', width: '100%', maxWidth: '360px' }}>
                        <audio src={modalBlobUrl} controls style={{ width: '100%' }} />
                      </div>
                    );
                  }
                  if (mIsPdf) {
                    return (
                      <iframe
                        src={`${modalBlobUrl}#toolbar=1`}
                        title={previewModalFile.name}
                        style={{ width: '100%', height: '100%', border: 'none' }}
                      />
                    );
                  }
                  if (modalTextContent) {
                    return (
                      <pre className="preview-text-box" style={{ width: '100%', height: '100%', margin: 0 }}>
                        <code>{modalTextContent}</code>
                      </pre>
                    );
                  }
                  return (
                    <div style={{ textAlign: 'center', color: '#cbd5e1', padding: '40px', margin: 'auto' }}>
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
                <div style={{ color: '#94a3b8', fontSize: '0.875rem', margin: 'auto' }}>
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
