import React, { useState } from 'react';
import { Sparkles, Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import ragService from '../../services/ragService';
import { useToast } from '../../contexts/ToastContext';

const RagStatusBadge = ({ file, onStatusUpdated }) => {
  const [retrying, setRetrying] = useState(false);
  const toast = useToast();

  if (!file) return null;

  const status = file.ragStatus || 'pending';
  const chunkCount = file.ragChunkCount || 0;

  const handleRetry = async (e) => {
    e.stopPropagation();
    if (retrying || !file._id) return;

    setRetrying(true);
    try {
      const res = await ragService.reindexFile(file._id);
      toast.success('Đã đưa tệp tin vào hàng đợi lập chỉ mục RAG');
      if (typeof onStatusUpdated === 'function') {
        onStatusUpdated(res?.data || { ...file, ragStatus: 'pending' });
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Không thể yêu cầu lập chỉ mục lại');
    } finally {
      setRetrying(false);
    }
  };

  if (status === 'indexed') {
    return (
      <span
        className="rag-badge indexed"
        title={`Đã lập chỉ mục AI (${chunkCount} đoạn ngữ cảnh). Sẵn sàng hỏi đáp.`}
      >
        <Sparkles size={11} />
        <span>RAG ({chunkCount})</span>
      </span>
    );
  }

  if (status === 'indexing' || status === 'pending') {
    return (
      <span className="rag-badge indexing" title="Đang trích xuất nội dung và sinh vector embeddings...">
        <Loader2 size={11} className="animate-spin" />
        <span>Đang chỉ mục...</span>
      </span>
    );
  }

  if (status === 'failed') {
    return (
      <button
        type="button"
        className="rag-badge failed"
        onClick={handleRetry}
        disabled={retrying}
        title={`Lỗi: ${file.ragError || 'Thất bại'}. Nhấp chuột để thử lại.`}
      >
        {retrying ? <Loader2 size={11} className="animate-spin" /> : <RefreshCw size={11} />}
        <span>Thử lại RAG</span>
      </button>
    );
  }

  return null;
};

export default RagStatusBadge;
