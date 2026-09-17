import React, { useState, useEffect } from 'react';
import { Share2, Eye, Download, UserMinus, Shield } from 'lucide-react';
import FileIcon from '../../components/drive/FileIcon';
import EmptyState from '../../components/common/EmptyState';
import FilePreviewModal from '../../components/drive/FilePreviewModal';
import shareService from '../../services/shareService';
import fileService from '../../services/fileService';
import { useToast } from '../../contexts/ToastContext';

const SharedByMePage = () => {
  const [shares, setShares] = useState([]);
  const [loading, setLoading] = useState(true);
  const [previewFile, setPreviewFile] = useState(null);
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

  const handleUpdateRole = async (shareId, role) => {
    try {
      await shareService.updateCollaboratorRole(shareId, role);
      toast.success('Đã cập nhật vai trò');
      fetchSharedByMe();
    } catch (err) {
      toast.error('Cập nhật quyền thất bại');
    }
  };

  const handleRevoke = async (shareId) => {
    if (!window.confirm('Bạn có chắc chắn muốn thu hồi quyền chia sẻ của người dùng này?')) {
      return;
    }
    try {
      await shareService.removeCollaborator(shareId);
      toast.success('Đã thu hồi quyền chia sẻ');
      fetchSharedByMe();
    } catch (err) {
      toast.error('Thu hồi chia sẻ thất bại');
    }
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
    <div>
      <div className="drive-action-bar" style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.25rem', fontWeight: 800 }}>
          <Share2 size={24} style={{ color: 'var(--primary-600)' }} />
          <span>Tài liệu tôi đã chia sẻ</span>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '80px 20px', color: 'var(--text-muted)' }}>
          <span className="spinner" style={{ width: 36, height: 36, margin: '0 auto' }} />
          <div style={{ marginTop: '16px' }}>Đang tải danh sách chia sẻ...</div>
        </div>
      ) : shares.length === 0 ? (
        <EmptyState
          icon={Share2}
          title="Chưa chia sẻ tài liệu nào"
          description="Bạn chưa chia sẻ tệp hoặc thư mục nào cho người dùng khác."
        />
      ) : (
        <div className="file-table-container">
          <table className="file-table">
            <thead>
              <tr>
                <th style={{ width: '35%' }}>Tên tài liệu</th>
                <th style={{ width: '25%' }}>Chia sẻ cho</th>
                <th style={{ width: '15%' }}>Quyền hạn</th>
                <th style={{ width: '15%' }}>Ngày chia sẻ</th>
                <th style={{ width: '10%', textAlign: 'right' }}>Thu hồi</th>
              </tr>
            </thead>
            <tbody>
              {shares.map((share) => {
                const item = share.file || share.folder || {};
                const isFile = Boolean(share.file);
                const recipient = share.sharedWith || {};

                return (
                  <tr key={share._id}>
                    <td>
                      <div
                        className="table-name-cell"
                        onClick={() => isFile && setPreviewFile(item)}
                      >
                        <FileIcon
                          mimeType={item.mimeType}
                          extension={item.extension}
                          size={20}
                        />
                        <span title={item.name}>{item.name}</span>
                      </div>
                    </td>
                    <td>
                      <div style={{ fontSize: '0.875rem', fontWeight: 600 }}>
                        {recipient.name || 'Người dùng'}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {recipient.email}
                      </div>
                    </td>
                    <td>
                      <select
                        className="form-select"
                        style={{ padding: '4px 8px', fontSize: '0.8125rem' }}
                        value={share.role}
                        onChange={(e) => handleUpdateRole(share._id, e.target.value)}
                      >
                        <option value="viewer">Người xem</option>
                        <option value="editor">Chỉnh sửa</option>
                      </select>
                    </td>
                    <td>
                      {share.createdAt
                        ? new Date(share.createdAt).toLocaleDateString('vi-VN')
                        : '-'}
                    </td>
                    <td>
                      <div className="table-action-btns" style={{ justifyContent: 'flex-end' }}>
                        <button
                          className="btn-icon"
                          title="Thu hồi chia sẻ"
                          onClick={() => handleRevoke(share._id)}
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

      {/* File Preview */}
      <FilePreviewModal
        file={previewFile}
        isOpen={Boolean(previewFile)}
        onClose={() => setPreviewFile(null)}
        onDownload={handleDownloadFile}
      />
    </div>
  );
};

export default SharedByMePage;
