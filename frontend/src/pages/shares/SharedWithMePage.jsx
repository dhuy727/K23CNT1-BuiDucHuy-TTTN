import React, { useState, useEffect } from 'react';
import { Users, Eye, Download, Folder as FolderIcon, Edit3 } from 'lucide-react';
import FileIcon from '../../components/drive/FileIcon';
import EmptyState from '../../components/common/EmptyState';
import FilePreviewModal from '../../components/drive/FilePreviewModal';
import shareService from '../../services/shareService';
import fileService from '../../services/fileService';
import { useToast } from '../../contexts/ToastContext';

const SharedWithMePage = () => {
  const [shares, setShares] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeShareModal, setActiveShareModal] = useState(null); // { file, canEdit, initialMode }
  const toast = useToast();

  const fetchSharedWithMe = async () => {
    setLoading(true);
    try {
      const res = await shareService.getSharedWithMe();
      setShares(res.data || []);
    } catch (err) {
      console.error('Lỗi lấy tài liệu chia sẻ với tôi:', err);
      toast.error('Không thể tải danh sách tài liệu được chia sẻ');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSharedWithMe();
  }, []);

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
      <div className="drive-action-bar" style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.25rem', fontWeight: 800 }}>
          <Users size={24} style={{ color: 'var(--primary-600)' }} />
          <span>Được chia sẻ với tôi</span>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '80px 20px', color: 'var(--text-muted)' }}>
          <span className="spinner" style={{ width: 36, height: 36, margin: '0 auto' }} />
          <div style={{ marginTop: '16px' }}>Đang tải danh sách được chia sẻ...</div>
        </div>
      ) : shares.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Chưa có tài liệu được chia sẻ"
          description="Các tệp và thư mục do người khác chia sẻ với email của bạn sẽ xuất hiện ở đây."
        />
      ) : (
        <div className="file-table-container">
          <table className="file-table">
            <thead>
              <tr>
                <th style={{ width: '35%' }}>Tên tài liệu</th>
                <th style={{ width: '20%' }}>Người chia sẻ</th>
                <th style={{ width: '15%' }}>Quyền hạn</th>
                <th style={{ width: '15%' }}>Ngày chia sẻ</th>
                <th style={{ width: '15%', textAlign: 'right' }}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {shares.map((share) => {
                const item = share.file || share.folder || share.item || {};
                const isFile = share.itemType === 'file' || Boolean(share.file);
                const owner = share.sharedBy || share.owner || {};
                const shareId = share._id || share.shareId;
                const canEdit = share.role === 'editor';

                return (
                  <tr
                    key={shareId}
                    onClick={() =>
                      isFile &&
                      setActiveShareModal({
                        file: item,
                        canEdit,
                        initialMode: canEdit ? 'edit' : 'preview'
                      })
                    }
                  >
                    <td>
                      <div
                        className="table-name-cell"
                        style={{ cursor: isFile ? 'pointer' : 'default' }}
                      >
                        {isFile ? (
                          <FileIcon
                            mimeType={item.mimeType}
                            extension={item.extension}
                            size={20}
                          />
                        ) : (
                          <FolderIcon size={20} style={{ color: item.color || '#3b82f6' }} />
                        )}
                        <span title={item.name}>{item.name || 'Không có tên'}</span>
                      </div>
                    </td>
                    <td>
                      <div style={{ fontSize: '0.875rem', fontWeight: 600 }}>
                        {owner.name || 'Người dùng'}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {owner.email || ''}
                      </div>
                    </td>
                    <td>
                      <span
                        className={`badge ${
                          canEdit ? 'badge-emerald' : 'badge-blue'
                        }`}
                      >
                        {canEdit ? 'Chỉnh sửa trực tiếp' : 'Chỉ xem'}
                      </span>
                    </td>
                    <td className="tabular-nums">
                      {share.createdAt
                        ? new Date(share.createdAt).toLocaleDateString('vi-VN')
                        : '-'}
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <div className="table-action-btns" style={{ display: 'flex', justifyContent: 'flex-end', gap: '4px' }}>
                        {isFile ? (
                          <>
                            {canEdit && (
                              <button
                                type="button"
                                className="btn-icon"
                                title="Chỉnh sửa thời gian thực"
                                onClick={() =>
                                  setActiveShareModal({
                                    file: item,
                                    canEdit: true,
                                    initialMode: 'edit'
                                  })
                                }
                              >
                                <Edit3 size={16} style={{ color: 'var(--primary-500)' }} />
                              </button>
                            )}
                            <button
                              type="button"
                              className="btn-icon"
                              title="Xem trước"
                              onClick={() =>
                                setActiveShareModal({
                                  file: item,
                                  canEdit,
                                  initialMode: 'preview'
                                })
                              }
                            >
                              <Eye size={16} />
                            </button>
                            <button
                              type="button"
                              className="btn-icon"
                              title="Tải xuống"
                              onClick={() => handleDownloadFile(item)}
                            >
                              <Download size={16} />
                            </button>
                          </>
                        ) : (
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Thư mục</span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* File Preview & Realtime Edit Modal */}
      <FilePreviewModal
        file={activeShareModal?.file}
        isOpen={Boolean(activeShareModal?.file)}
        canEdit={Boolean(activeShareModal?.canEdit)}
        initialMode={activeShareModal?.initialMode || 'preview'}
        onClose={() => setActiveShareModal(null)}
        onDownload={handleDownloadFile}
        onFileUpdated={() => fetchSharedWithMe()}
      />
    </main>
  );
};

export default SharedWithMePage;
