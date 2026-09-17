import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const Pagination = ({ pagination, onPageChange }) => {
  if (!pagination || pagination.totalPages <= 1) return null;

  const { page, totalPages, total } = pagination;

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '16px', padding: '12px 0' }}>
      <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
        Tổng cộng <strong style={{ color: 'var(--text-primary)' }}>{total}</strong> mục
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <button
          className="btn btn-secondary"
          style={{ padding: '6px 12px' }}
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronLeft size={16} />
          <span>Trước</span>
        </button>
        <span style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--text-secondary)' }}>
          Trang {page} / {totalPages}
        </span>
        <button
          className="btn btn-secondary"
          style={{ padding: '6px 12px' }}
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          <span>Sau</span>
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
};

export default Pagination;
