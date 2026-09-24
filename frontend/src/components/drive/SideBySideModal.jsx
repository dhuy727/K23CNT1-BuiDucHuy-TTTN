import React, { useState } from 'react';
import {
  X,
  Sparkles,
  CheckCircle,
  Trash2,
  EyeOff,
  FileText,
  Calendar,
  HardDrive,
  Folder as FolderIcon,
  ArrowRightLeft
} from 'lucide-react';
import FileIcon from './FileIcon';

const SideBySideModal = ({
  isOpen,
  onClose,
  compareData,
  onCleanFile,
  onIgnorePair
}) => {
  if (!isOpen || !compareData) return null;

  const { fileA, fileB, similarityScore, aiAnalysis } = compareData;
  const [selectedKeepId, setSelectedKeepId] = useState(
    compareData.recommendedKeep || fileA?._id
  );
  const [isDeleting, setIsDeleting] = useState(false);

  const fileToKeep = selectedKeepId === fileA?._id ? fileA : fileB;
  const fileToDelete = selectedKeepId === fileA?._id ? fileB : fileA;

  const handleConfirmDelete = async () => {
    if (!fileToDelete) return;
    setIsDeleting(true);
    try {
      await onCleanFile([fileToDelete._id]);
      onClose();
    } catch (err) {
      console.error('Lỗi khi xóa file từ modal so sánh:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleIgnore = async () => {
    if (!fileA || !fileB) return;
    try {
      await onIgnorePair(fileA._id, fileB._id);
      onClose();
    } catch (err) {
      console.error('Lỗi khi bỏ qua cặp file:', err);
    }
  };

  const renderFileCard = (file, isKeep) => {
    if (!file) return null;
    return (
      <div className={`compare-column ${isKeep ? 'is-winner' : ''}`}>
        <div className="compare-column-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileIcon mimeType={file.mimeType} extension={file.extension} size={22} />
            <span style={{ fontWeight: 600, fontSize: '0.92rem' }}>
              {isKeep ? 'Tệp giữ lại' : 'Tệp đề xuất xóa'}
            </span>
          </div>
          {isKeep ? (
            <span className="badge-keep" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <CheckCircle size={13} />
              Bản chính
            </span>
          ) : (
            <button
              type="button"
              className="btn-item-action"
              onClick={() => setSelectedKeepId(file._id)}
              title="Đổi tệp này thành bản cần giữ lại"
            >
              <ArrowRightLeft size={13} />
              Giữ tệp này thay thế
            </button>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)', wordBreak: 'break-all' }}>
            {file.name}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <HardDrive size={14} style={{ color: 'var(--text-muted)' }} />
              <span>Dung lượng: <strong>{file.formattedSize || `${file.size} Bytes`}</strong></span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <FolderIcon size={14} style={{ color: 'var(--text-muted)' }} />
              <span>Thư mục: <strong>{file.folder?.name || 'Drive của tôi (Root)'}</strong></span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Calendar size={14} style={{ color: 'var(--text-muted)' }} />
              <span>Cập nhật: {new Date(file.updatedAt || file.createdAt).toLocaleString('vi-VN')}</span>
            </div>
          </div>
        </div>

        {file.extractedText && (
          <div>
            <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
              Nội dung trích xuất:
            </div>
            <div className="compare-snippet-preview">
              {file.extractedText.slice(0, 1200)}
              {file.extractedText.length > 1200 && '... [đã cắt bớt đoạn sau]'}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="compare-modal-backdrop" onClick={onClose}>
      <div className="compare-modal-window" onClick={(e) => e.stopPropagation()}>
        <div className="compare-modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sparkles size={18} style={{ color: 'var(--primary-600)' }} />
            <h3>So sánh Trực quan & Đánh giá AI</h3>
          </div>
          <button type="button" className="compare-close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="compare-modal-body">
          {/* AI Banner */}
          <div className="compare-ai-banner">
            <div className="compare-ai-score">
              {similarityScore}%
              <span>Tương đồng</span>
            </div>
            <div className="compare-ai-text">
              <strong style={{ display: 'block', color: 'var(--text-primary)', marginBottom: '3px' }}>
                Phân tích đối sánh từ AI:
              </strong>
              {aiAnalysis || 'Nội dung và cấu trúc giữa 2 tệp tin có mức độ tương đồng cao.'}
            </div>
          </div>

          {/* 2 Cột so sánh */}
          <div className="compare-columns-grid">
            {renderFileCard(fileToKeep, true)}
            {renderFileCard(fileToDelete, false)}
          </div>
        </div>

        <div className="compare-modal-footer">
          <button
            type="button"
            className="btn-item-action"
            onClick={handleIgnore}
            title="Đánh dấu 2 file này không phải trùng lặp để AI không hỏi lại"
          >
            <EyeOff size={14} />
            Đánh dấu không trùng lặp
          </button>
          <button
            type="button"
            className="btn-item-action"
            onClick={onClose}
          >
            Đóng
          </button>
          <button
            type="button"
            className="btn-clean-batch"
            onClick={handleConfirmDelete}
            disabled={isDeleting || !fileToDelete}
          >
            <Trash2 size={14} />
            {isDeleting ? 'Đang chuyển...' : `Chuyển bản sao vào Thùng rác`}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SideBySideModal;
