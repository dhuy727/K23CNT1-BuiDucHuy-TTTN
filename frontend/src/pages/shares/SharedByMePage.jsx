import React, { useState, useEffect, useMemo } from 'react';
import {
  Share2,
  Eye,
  UserMinus,
  Folder as FolderIcon,
  Globe,
  Users,
  Link as LinkIcon,
  Copy,
  Check,
  ExternalLink,
  Settings2,
  Lock,
  Calendar,
  AlertCircle
} from 'lucide-react';
import FileIcon from '../../components/drive/FileIcon';
import EmptyState from '../../components/common/EmptyState';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import FilePreviewModal from '../../components/drive/FilePreviewModal';
import ShareModal from '../../components/drive/ShareModal';
import shareService from '../../services/shareService';
import fileService from '../../services/fileService';
import { useToast } from '../../contexts/ToastContext';

const SharedByMePage = () => {
  const [shares, setShares] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('all'); // 'all' | 'public' | 'user'
  const [copiedId, setCopiedId] = useState(null);
  const [previewFile, setPreviewFile] = useState(null);
  const [editingShareTarget, setEditingShareTarget] = useState(null); // { item, itemType }
  const [revokeTarget, setRevokeTarget] = useState(null);
  const [revoking, setRevoking] = useState(false);
  const toast = useToast();

  const fetchSharedByMe = async () => {
    setLoading(true);
    try {
      const res = await shareService.getSharedByMe();
      setShares(res.data || []);
    } catch (err) {
      console.error('Lỗi lấy tài liệu do tôi chia sẻ:', err);
      toast.error('Không thể tải danh sách chia sẻ');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSharedByMe();
  }, []);

  const filteredShares = useMemo(() => {
    if (filterType === 'all') return shares;
    return shares.filter((s) => s.shareType === filterType);
  }, [shares, filterType]);

  const getFullShareUrl = (token) => {
    if (!token) return '';
    return `${window.location.origin}/shares/public/${token}`;
  };

  /**
   * Đảm bảo có shareToken cho tài liệu (tự kích hoạt public link nếu bản ghi là chia sẻ email chưa có link)
   */
  const ensurePublicToken = async (share) => {
    if (share.shareToken) {
      return share.shareToken;
    }
    const item = share.file || share.folder || share.item || {};
    const itemType = share.itemType === 'folder' || Boolean(share.folder) ? 'folder' : 'file';
    if (!item._id) return null;

    try {
      const res = await shareService.createOrUpdatePublicLink({
        itemType,
        itemId: item._id,
        isPublic: true,
        role: share.role || 'viewer'
      });
      const newToken = res.data?.shareToken;
      if (newToken) {
        fetchSharedByMe();
      }
      return newToken;
    } catch (err) {
      toast.error(err.response?.data?.message || 'Không thể khởi tạo liên kết chia sẻ');
      return null;
    }
  };

  /**
   * Mở liên kết chia sẻ mà người dùng đã tạo
   */
  const handleOpenShareLink = async (share) => {
    const token = await ensurePublicToken(share);
    if (!token) return;
    const url = getFullShareUrl(token);
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  /**
   * Sao chép liên kết chia sẻ vào bộ nhớ tạm
   */
  const handleCopyShareLink = async (share, e) => {
    if (e) e.stopPropagation();
    const shareId = share._id || share.shareId;
    const token = await ensurePublicToken(share);
    if (!token) return;

    const url = getFullShareUrl(token);
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(shareId);
      toast.success('Đã sao chép liên kết chia sẻ');
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      toast.error('Không thể sao chép liên kết');
    }
  };

  /**
   * Cập nhật quyền hạn chia sẻ (Người xem <-> Chỉnh sửa)
   */
  const handleUpdateRole = async (shareId, role) => {
    try {
      await shareService.updateCollaboratorRole(shareId, role);
      toast.success(`Đã cập nhật quyền thành: ${role === 'editor' ? 'Chỉnh sửa' : 'Người xem'}`);
      setShares((prev) =>
        prev.map((s) => ((s._id || s.shareId) === shareId ? { ...s, role } : s))
      );
    } catch (err) {
      toast.error(err.response?.data?.message || 'Cập nhật quyền thất bại');
    }
  };

  /**
   * Thu hồi liên kết hoặc quyền chia sẻ
   */
  const handleRevoke = (share) => {
    setRevokeTarget(share);
  };

  const handleConfirmRevoke = async () => {
    if (!revokeTarget) return;
    const shareId = revokeTarget._id || revokeTarget.shareId;
    const isPublicLink = revokeTarget.shareType === 'public';
    const item = revokeTarget.file || revokeTarget.folder || revokeTarget.item || {};
    const recipient = revokeTarget.sharedWith || revokeTarget.user || {};

    setRevoking(true);
    try {
      await shareService.removeCollaborator(shareId);
      toast.success(
        isPublicLink
          ? `Đã thu hồi liên kết công khai của "${item.name || 'tài liệu'}"`
          : `Đã thu hồi quyền chia sẻ của ${recipient.name || recipient.email || revokeTarget.sharedEmail || 'người dùng'}`
      );
      setRevokeTarget(null);
      fetchSharedByMe();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Thu hồi chia sẻ thất bại');
    } finally {
      setRevoking(false);
    }
  };

  /**
   * Mở hộp thoại cài đặt chia sẻ chi tiết (ShareModal)
   */
  const handleOpenShareSettings = (share, e) => {
    if (e) e.stopPropagation();
    const item = share.file || share.folder || share.item || {};
    const itemType = share.itemType === 'folder' || Boolean(share.folder) ? 'folder' : 'file';
    setEditingShareTarget({ item, itemType });
  };

  const handleDownloadFile = async (file) => {
    try {
      toast.info(`Đang tải về "${file.name}"...`);
      const blob = await fileService.downloadFileBlob(file._id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error('Tải tệp tin thất bại');
    }
  };

  return (
    <main className="page-body">
      <div
        className="drive-action-bar"
        style={{
          marginBottom: '16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1.25rem', fontWeight: 800 }}>
          <Share2 size={24} style={{ color: 'var(--primary-600)' }} />
          <span>Tài liệu tôi đã chia sẻ</span>
          {!loading && shares.length > 0 && (
            <span className="drive-section-count tabular-nums">{filteredShares.length}</span>
          )}
        </div>

        {/* Bộ lọc nhanh theo loại chia sẻ */}
        {shares.length > 0 && (
          <div className="share-filter-group tabular-nums">
            <button
              type="button"
              className={`btn btn-sm ${filterType === 'all' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setFilterType('all')}
              style={{ padding: '6px 12px', fontSize: '0.8rem', flexShrink: 0 }}
            >
              <span>Tất cả ({shares.length})</span>
            </button>
            <button
              type="button"
              className={`btn btn-sm ${filterType === 'public' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setFilterType('public')}
              style={{ padding: '6px 12px', fontSize: '0.8rem', flexShrink: 0 }}
            >
              <Globe size={13} />
              <span>Liên kết công khai ({shares.filter((s) => s.shareType === 'public').length})</span>
            </button>
            <button
              type="button"
              className={`btn btn-sm ${filterType === 'user' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setFilterType('user')}
              style={{ padding: '6px 12px', fontSize: '0.8rem', flexShrink: 0 }}
            >
              <Users size={13} />
              <span>Qua Email ({shares.filter((s) => s.shareType === 'user').length})</span>
            </button>
          </div>
        )}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '80px 20px', color: 'var(--text-muted)' }}>
          <span className="spinner" style={{ width: 36, height: 36, margin: '0 auto' }} />
          <div style={{ marginTop: '16px' }}>Đang tải danh sách chia sẻ...</div>
        </div>
      ) : filteredShares.length === 0 ? (
        <EmptyState
          icon={Share2}
          title="Chưa có liên kết hoặc tài liệu chia sẻ nào"
          description="Khi bạn tạo liên kết chia sẻ hoặc mời cộng tác viên cho tệp và thư mục, chúng sẽ hiển thị tại đây để bạn mở liên kết, chỉnh sửa quyền hoặc thu hồi."
        />
      ) : (
        <div className="file-table-container share-table-scroll">
          <table className="file-table share-management-table">
            <thead>
              <tr>
                <th style={{ width: '28%' }}>Tên tài liệu</th>
                <th style={{ width: '32%' }}>Liên kết chia sẻ & Đối tượng</th>
                <th style={{ width: '14%' }}>Quyền hạn</th>
                <th style={{ width: '13%' }}>Ngày tạo / Hạn dùng</th>
                <th style={{ width: '13%', textAlign: 'right' }}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {filteredShares.map((share) => {
                const item = share.file || share.folder || share.item || {};
                const isFile = share.itemType === 'file' || Boolean(share.file);
                const recipient = share.sharedWith || share.user || {};
                const shareId = share._id || share.shareId;
                const isPublicLink = share.shareType === 'public';
                const fullUrl = share.shareToken ? getFullShareUrl(share.shareToken) : '';
                const isExpired = Boolean(
                  share.isExpired || (share.expiresAt && new Date() > new Date(share.expiresAt))
                );

                return (
                  <tr
                    key={shareId}
                    onClick={() => handleOpenShareLink(share)}
                    title="Bấm để mở trang liên kết chia sẻ"
                  >
                    {/* Cột 1: Tên tài liệu (bấm vào mở liên kết chia sẻ) */}
                    <td>
                      <div className="table-name-cell" style={{ cursor: 'pointer' }}>
                        {isFile ? (
                          <FileIcon
                            mimeType={item.mimeType}
                            extension={item.extension}
                            size={20}
                          />
                        ) : (
                          <FolderIcon size={20} style={{ color: item.color || '#3b82f6', flexShrink: 0 }} />
                        )}
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              color: 'var(--text-primary)',
                              fontWeight: 600
                            }}
                          >
                            <span
                              title={item.name}
                              style={{
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap'
                              }}
                            >
                              {item.name || 'Không có tên'}
                            </span>
                            <ExternalLink
                              size={13}
                              style={{ color: 'var(--primary-500)', flexShrink: 0, opacity: 0.85 }}
                            />
                          </div>
                          <div className="tabular-nums" style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                            {isFile ? item.formattedSize || 'Tệp tài liệu' : 'Thư mục chia sẻ'}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Cột 2: Liên kết chia sẻ đã tạo & Người nhận */}
                    <td onClick={(e) => e.stopPropagation()}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', minWidth: 0 }}>
                        {isPublicLink ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                            <span className="badge badge-blue" style={{ fontSize: '0.7rem' }}>
                              <Globe size={11} />
                              <span>Liên kết công khai</span>
                            </span>
                            {share.hasPassword && (
                              <span className="badge badge-amber" style={{ fontSize: '0.68rem' }} title="Có mật khẩu bảo vệ">
                                <Lock size={10} />
                                <span>Có mật khẩu</span>
                              </span>
                            )}
                            {isExpired && (
                              <span className="badge badge-rose" style={{ fontSize: '0.68rem' }}>
                                <AlertCircle size={10} />
                                <span>Đã hết hạn</span>
                              </span>
                            )}
                          </div>
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                            <span className="badge badge-purple" style={{ fontSize: '0.7rem' }}>
                              <Users size={11} />
                              <span>{recipient.name || 'Cộng tác viên'}</span>
                            </span>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                              {recipient.email || share.sharedEmail || ''}
                            </span>
                          </div>
                        )}

                        {/* Đường dẫn liên kết chia sẻ bấm được */}
                        <div
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            maxWidth: '100%'
                          }}
                        >
                          <a
                            href={fullUrl || '#'}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => {
                              e.preventDefault();
                              handleOpenShareLink(share);
                            }}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '5px',
                              fontSize: '0.76rem',
                              fontFamily: 'var(--font-mono)',
                              color: 'var(--primary-500)',
                              backgroundColor: 'var(--bg-surface-hover)',
                              border: '1px solid var(--border-main)',
                              padding: '3px 8px',
                              borderRadius: 'var(--radius-sm)',
                              maxWidth: '240px',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap'
                            }}
                            title={fullUrl || 'Bấm để mở liên kết chia sẻ'}
                          >
                            <LinkIcon size={12} style={{ flexShrink: 0 }} />
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {fullUrl ? `/shares/public/${share.shareToken}` : 'Mở liên kết chia sẻ'}
                            </span>
                          </a>

                          <button
                            type="button"
                            className="btn-icon"
                            style={{ padding: '4px', flexShrink: 0 }}
                            title="Sao chép liên kết chia sẻ"
                            onClick={(e) => handleCopyShareLink(share, e)}
                          >
                            {copiedId === shareId ? (
                              <Check size={14} style={{ color: 'var(--accent-emerald)' }} />
                            ) : (
                              <Copy size={14} />
                            )}
                          </button>
                        </div>
                      </div>
                    </td>

                    {/* Cột 3: Chỉnh sửa quyền hạn trực tiếp */}
                    <td onClick={(e) => e.stopPropagation()}>
                      <select
                        className="form-select"
                        style={{ padding: '5px 10px', fontSize: '0.8125rem', maxWidth: '135px' }}
                        value={share.role || 'viewer'}
                        onChange={(e) => handleUpdateRole(shareId, e.target.value)}
                        aria-label="Quyền hạn chia sẻ"
                      >
                        <option value="viewer">Người xem</option>
                        <option value="editor">Chỉnh sửa</option>
                      </select>
                    </td>

                    {/* Cột 4: Ngày chia sẻ & Hạn dùng */}
                    <td className="tabular-nums" onClick={(e) => e.stopPropagation()}>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-primary)' }}>
                        {share.createdAt
                          ? new Date(share.createdAt).toLocaleDateString('vi-VN')
                          : '-'}
                      </div>
                      {share.expiresAt ? (
                        <div
                          style={{
                            fontSize: '0.72rem',
                            color: isExpired ? 'var(--accent-rose)' : 'var(--text-muted)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            marginTop: '2px',
                            fontWeight: isExpired ? 600 : 400
                          }}
                        >
                          <Calendar size={11} />
                          <span>
                            {isExpired ? 'Quá hạn: ' : 'Hạn: '}
                            {new Date(share.expiresAt).toLocaleDateString('vi-VN')}
                          </span>
                        </div>
                      ) : (
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                          Không giới hạn
                        </div>
                      )}
                    </td>

                    {/* Cột 5: Thao tác (Mở link, Chỉnh sửa cài đặt chia sẻ, Thu hồi) */}
                    <td onClick={(e) => e.stopPropagation()}>
                      <div className="table-action-btns" style={{ display: 'flex', justifyContent: 'flex-end', gap: '4px' }}>
                        <button
                          type="button"
                          className="btn-icon"
                          title="Mở trang liên kết chia sẻ"
                          onClick={() => handleOpenShareLink(share)}
                        >
                          <ExternalLink size={16} style={{ color: 'var(--primary-500)' }} />
                        </button>

                        <button
                          type="button"
                          className="btn-icon"
                          title="Chỉnh sửa quyền hạn & cài đặt liên kết"
                          onClick={(e) => handleOpenShareSettings(share, e)}
                        >
                          <Settings2 size={16} />
                        </button>

                        {isFile && (
                          <button
                            type="button"
                            className="btn-icon"
                            title="Xem trước tệp"
                            onClick={() => setPreviewFile(item)}
                          >
                            <Eye size={16} />
                          </button>
                        )}

                        <button
                          type="button"
                          className="btn-icon"
                          title="Thu hồi chia sẻ"
                          onClick={() => handleRevoke(share)}
                        >
                          <UserMinus size={16} style={{ color: 'var(--accent-rose)' }} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal Chỉnh sửa cài đặt chia sẻ & liên kết */}
      <ShareModal
        isOpen={Boolean(editingShareTarget)}
        onClose={() => setEditingShareTarget(null)}
        item={editingShareTarget?.item}
        itemType={editingShareTarget?.itemType || 'file'}
        onUpdated={fetchSharedByMe}
      />

      {/* File Preview */}
      <FilePreviewModal
        file={previewFile}
        isOpen={Boolean(previewFile)}
        onClose={() => setPreviewFile(null)}
        onDownload={handleDownloadFile}
      />

      {/* Modal xác nhận thu hồi chia sẻ */}
      <ConfirmDialog
        isOpen={Boolean(revokeTarget)}
        onClose={() => !revoking && setRevokeTarget(null)}
        onConfirm={handleConfirmRevoke}
        title={
          revokeTarget?.shareType === 'public'
            ? 'Thu hồi liên kết chia sẻ?'
            : 'Thu hồi quyền chia sẻ?'
        }
        message={
          revokeTarget?.shareType === 'public'
            ? `Bạn có chắc chắn muốn thu hồi và vô hiệu hóa liên kết chia sẻ của "${(revokeTarget?.file || revokeTarget?.folder || revokeTarget?.item)?.name || 'tài liệu này'}"? Bất kỳ ai có liên kết sẽ không thể truy cập được nữa.`
            : `Bạn có chắc chắn muốn thu hồi quyền truy cập của "${(revokeTarget?.sharedWith || revokeTarget?.user)?.name || (revokeTarget?.sharedWith || revokeTarget?.user)?.email || revokeTarget?.sharedEmail || 'người dùng này'}"?`
        }
        confirmText="Xác nhận thu hồi"
        isDanger={true}
        loading={revoking}
      />
    </main>
  );
};

export default SharedByMePage;
