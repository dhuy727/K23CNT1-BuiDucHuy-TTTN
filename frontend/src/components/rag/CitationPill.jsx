import React, { useState } from 'react';
import { FileText, ExternalLink } from 'lucide-react';

const CitationPill = ({ citation, index, onSelectCitation }) => {
  const [showTooltip, setShowTooltip] = useState(false);

  if (!citation) return null;

  const handleClick = (e) => {
    e.preventDefault();
    if (typeof onSelectCitation === 'function') {
      onSelectCitation(citation);
    }
    // Phát event mở FilePreviewModal toàn cục nếu có fileId
    if (citation.fileId) {
      window.dispatchEvent(
        new CustomEvent('open-preview-file', {
          detail: { fileId: citation.fileId }
        })
      );
    }
  };

  const displayName = citation.fileName || 'Tài liệu trích dẫn';
  const pageText = citation.pageNumber ? `tr. ${citation.pageNumber}` : '';
  const scorePercent = citation.similarityScore
    ? Math.round(citation.similarityScore * 100)
    : null;

  return (
    <div
      style={{ position: 'relative', display: 'inline-block' }}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <button
        type="button"
        className="citation-pill"
        onClick={handleClick}
        title={displayName}
      >
        <span className="citation-num">{index !== undefined ? index + 1 : '•'}</span>
        <FileText size={12} />
        <span style={{ maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {displayName}
        </span>
        {pageText && (
          <span style={{ opacity: 0.75, fontSize: 10 }}>({pageText})</span>
        )}
      </button>

      {/* Popover Tooltip khi di chuột */}
      {showTooltip && (
        <div
          style={{
            position: 'absolute',
            bottom: '100%',
            left: '50%',
            transform: 'translateX(-50%)',
            marginBottom: 6,
            width: 260,
            background: 'var(--text-primary)',
            color: 'var(--text-inverse)',
            padding: '8px 10px',
            borderRadius: 8,
            fontSize: 11.5,
            lineHeight: 1.4,
            boxShadow: 'var(--shadow-lg)',
            zIndex: 100,
            pointerEvents: 'none',
            animation: 'copilotFadeIn 0.15s ease'
          }}
        >
          <div style={{ fontWeight: 600, display: 'flex', justifyContent: 'space-between', marginBottom: 4, borderBottom: '1px solid rgba(255,255,255,0.2)', paddingBottom: 3 }}>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 180 }}>
              {displayName}
            </span>
            {scorePercent !== null && (
              <span style={{ color: '#34d399', fontSize: 10 }}>{scorePercent}% khớp</span>
            )}
          </div>
          {citation.snippet && (
            <div style={{ opacity: 0.85, fontStyle: 'italic', display: '-webkit-box', WebKitLineClamp: 3, WebKitBoxOrient: 'vertical', overflow: 'hidden' }}>
              "{citation.snippet}..."
            </div>
          )}
          <div style={{ marginTop: 4, opacity: 0.6, fontSize: 10, textAlign: 'right', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 3 }}>
            <span>Nhấp để mở tệp</span>
            <ExternalLink size={9} />
          </div>
        </div>
      )}
    </div>
  );
};

export default CitationPill;
