import React, { useEffect, useRef, useState } from 'react';
import { renderAsync } from 'docx-preview';
import {
  FileText,
  Sparkles,
  Copy,
  Check,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Search,
  AlertCircle,
  Download,
  BookOpen,
  Info
} from 'lucide-react';

/**
 * Loại bỏ các chuỗi thuộc tính thẻ <img src="data:image/..."> bị rò rỉ thành văn bản thuần
 */
const cleanLeakedImageText = (raw = '') => {
  if (!raw) return '';
  return String(raw)
    .replace(/<?\s*img\b[^>]*?src\s*=\s*(?:"data:image\/[^"]*"|'data:image\/[^']*')[^>]*?\/?>?/gi, '')
    .replace(/\bimg\s+(?:alt\s*=\s*"[^"]*"\s*)?src\s*=\s*"data:image\/[\s\S]*?"\s*\/?>?/gi, '')
    .replace(/\bsrc\s*=\s*"data:image\/[\s\S]*?"\s*\/?>?/gi, '')
    .replace(/data:image\/[a-zA-Z0-9+.-]+;base64,[A-Za-z0-9+/=\s]+/gi, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};

/**
 * DocxViewer - Trải nghiệm xem trước tài liệu Microsoft Word (.docx) chuyên nghiệp
 * Hỗ trợ 2 chế độ:
 * 1. "preview" - Tái tạo định dạng Word chuẩn (trang A4, bảng biểu, phông chữ) qua docx-preview
 * 2. "text" - Xem toàn bộ văn bản trích xuất bởi AI (hỗ trợ tìm kiếm từ khóa và sao chép nhanh)
 */
const DocxViewer = ({
  blob,
  file,
  onDownload,
  initialTab = 'preview'
}) => {
  const [activeTab, setActiveTab] = useState(initialTab);
  const [renderLoading, setRenderLoading] = useState(false);
  const [renderError, setRenderError] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [copied, setCopied] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const containerRef = useRef(null);
  const styleContainerRef = useRef(null);

  const extractedText = React.useMemo(
    () => cleanLeakedImageText(file?.extractedText || ''),
    [file?.extractedText]
  );
  const hasExtractedText = Boolean(extractedText && extractedText.trim().length > 0);

  // Render file Word bằng docx-preview khi có blob
  useEffect(() => {
    let isCancelled = false;

    const renderWordDocument = async () => {
      if (!blob || !containerRef.current) return;

      setRenderLoading(true);
      setRenderError(null);

      try {
        // Dọn sạch container trước khi render mới
        containerRef.current.innerHTML = '';
        if (styleContainerRef.current) {
          styleContainerRef.current.innerHTML = '';
        }

        const arrayBuffer = await blob.arrayBuffer();
        if (isCancelled) return;

        await renderAsync(
          arrayBuffer,
          containerRef.current,
          styleContainerRef.current || null,
          {
            className: 'docx-preview',
            inWrapper: true,
            ignoreWidth: false,
            ignoreHeight: false,
            ignoreFonts: false,
            breakPages: true,
            ignoreLastRenderedPageBreak: true,
            experimental: true,
            trimXmlDeclaration: true,
            debug: false
          }
        );

        // Hậu xử lý DOM: nếu tệp cũ từng bị lưu nhầm chuỗi img src="data:image/..." thành text trong <p>,
        // tự động chuyển lại thành thẻ <img> hiển thị ảnh thật hoặc ẩn chuỗi base64 rác
        if (containerRef.current && !isCancelled) {
          const paragraphs = containerRef.current.querySelectorAll('p, span');
          paragraphs.forEach((el) => {
            const txt = el.textContent || '';
            if (txt.includes('data:image/') && txt.includes('base64,')) {
              const srcMatch = /src\s*=\s*["'](data:image\/[^"']+)["']/i.exec(txt);
              const altMatch = /alt\s*=\s*["']([^"']*)["']/i.exec(txt);
              if (srcMatch && srcMatch[1]) {
                const img = document.createElement('img');
                img.src = srcMatch[1].replace(/\s+/g, '');
                img.alt = altMatch ? altMatch[1] : 'Hình ảnh tài liệu';
                img.style.maxWidth = '100%';
                img.style.height = 'auto';
                img.style.display = 'block';
                img.style.margin = '8px auto';
                el.innerHTML = '';
                el.appendChild(img);
              } else {
                el.textContent = cleanLeakedImageText(txt);
              }
            }
          });
        }

        if (!isCancelled) {
          setRenderLoading(false);
        }
      } catch (err) {
        console.error('[DocxViewer] Lỗi render docx:', err);
        if (!isCancelled) {
          setRenderError(
            'Không thể dựng đầy đủ định dạng đồ họa của tệp Word này. Bạn có thể chuyển sang tab "Văn bản trích xuất AI" để đọc toàn bộ nội dung.'
          );
          setRenderLoading(false);
          if (hasExtractedText) {
            setActiveTab('text');
          }
        }
      }
    };

    if (blob) {
      renderWordDocument();
    } else if (hasExtractedText) {
      setActiveTab('text');
    }

    return () => {
      isCancelled = true;
    };
  }, [blob, hasExtractedText]);

  // Sao chép văn bản trích xuất
  const handleCopyText = async () => {
    if (!extractedText) return;
    try {
      await navigator.clipboard.writeText(extractedText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error('Lỗi copy:', e);
    }
  };

  // Tính số lượng từ và ký tự
  const wordCount = extractedText ? extractedText.trim().split(/\s+/).filter(Boolean).length : 0;
  const charCount = extractedText ? extractedText.length : 0;

  // Lọc tìm kiếm văn bản trong tab Text
  const filteredTextParagraphs = React.useMemo(() => {
    if (!extractedText) return [];
    const paragraphs = extractedText.split('\n\n').filter((p) => p.trim().length > 0);
    if (!searchQuery.trim()) return paragraphs;
    const query = searchQuery.toLowerCase();
    return paragraphs.filter((p) => p.toLowerCase().includes(query));
  }, [extractedText, searchQuery]);

  return (
    <div className="docx-viewer-root">
      {/* Ẩn style container dùng cho docx-preview */}
      <div ref={styleContainerRef} style={{ display: 'none' }} />

      {/* Sub-toolbar: Tab switcher + Zoom + Actions */}
      <div className="docx-sub-toolbar">
        <div className="docx-tab-group">
          {blob && (
            <button
              type="button"
              className={`docx-tab-btn ${activeTab === 'preview' ? 'active' : ''}`}
              onClick={() => setActiveTab('preview')}
            >
              <FileText size={16} />
              <span>Trang tài liệu Word</span>
            </button>
          )}

          <button
            type="button"
            className={`docx-tab-btn ${activeTab === 'text' ? 'active' : ''}`}
            onClick={() => setActiveTab('text')}
          >
            <Sparkles size={16} />
            <span>Văn bản trích xuất AI</span>
            {hasExtractedText && (
              <span className="docx-tab-pill tabular-nums">{wordCount.toLocaleString()} từ</span>
            )}
          </button>
        </div>

        {/* Thanh công cụ phụ */}
        <div className="docx-actions-group">
          {activeTab === 'preview' && (
            <div className="docx-zoom-controls">
              <button
                type="button"
                className="btn-icon"
                title="Thu nhỏ"
                onClick={() => setZoom((prev) => Math.max(0.5, Math.round((prev - 0.1) * 10) / 10))}
              >
                <ZoomOut size={16} />
              </button>
              <span className="docx-zoom-indicator tabular-nums">{Math.round(zoom * 100)}%</span>
              <button
                type="button"
                className="btn-icon"
                title="Phóng to"
                onClick={() => setZoom((prev) => Math.min(1.8, Math.round((prev + 0.1) * 10) / 10))}
              >
                <ZoomIn size={16} />
              </button>
              {zoom !== 1 && (
                <button
                  type="button"
                  className="btn-icon"
                  title="Đặt lại 100%"
                  onClick={() => setZoom(1)}
                >
                  <RotateCcw size={15} />
                </button>
              )}
            </div>
          )}

          {activeTab === 'text' && (
            <div className="docx-text-actions">
              <div className="docx-search-box">
                <Search size={14} className="docx-search-icon" />
                <input
                  type="text"
                  placeholder="Tìm kiếm trong văn bản..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="docx-search-input"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="docx-search-clear"
                  >
                    ×
                  </button>
                )}
              </div>

              {hasExtractedText && (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={handleCopyText}
                  title="Sao chép toàn bộ văn bản vào clipboard"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                  <span>{copied ? 'Đã sao chép' : 'Sao chép'}</span>
                </button>
              )}
            </div>
          )}

          {onDownload && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => onDownload(file)}
              title="Tải tệp Word về máy"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <Download size={14} />
              <span>Tải file</span>
            </button>
          )}
        </div>
      </div>

      {/* Thông báo nếu file là tệp cục bộ cũ chưa chuyển S3 */}
      {!blob && hasExtractedText && (
        <div className="docx-ephemeral-banner">
          <Info size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
          <div>
            <strong>Thông báo lưu trữ:</strong> Tệp tin này được tải lên trước khi hệ thống kích hoạt kho lưu trữ đám mây AWS S3.
            DocuFlow đang hiển thị toàn bộ <strong className="tabular-nums">{charCount.toLocaleString()} ký tự</strong> nội dung văn bản đã được AI trích xuất và phân tích đầy đủ.
          </div>
        </div>
      )}

      {/* Vùng hiển thị tài liệu Word (docx-preview) */}
      <div
        className={`docx-preview-scroll-area ${activeTab === 'preview' ? 'active' : 'hidden'}`}
      >
        {renderLoading && (
          <div className="docx-loading-state">
            <span className="spinner" style={{ width: 36, height: 36 }} />
            <div style={{ fontSize: '0.9375rem', fontWeight: 600 }}>Đang dựng giao diện trang Microsoft Word...</div>
            <div style={{ fontSize: '0.8125rem', color: '#94a3b8' }}>Vui lòng đợi giây lát, tệp có dung lượng {file?.formattedSize || 'lớn'}</div>
          </div>
        )}

        {renderError && (
          <div className="docx-error-state">
            <AlertCircle size={28} style={{ color: '#f87171' }} />
            <div style={{ fontWeight: 600, color: '#f87171' }}>{renderError}</div>
            {hasExtractedText && (
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => setActiveTab('text')}
                style={{ marginTop: '8px' }}
              >
                <Sparkles size={14} />
                <span>Xem văn bản trích xuất AI</span>
              </button>
            )}
          </div>
        )}

        {/* Khung chứa các trang Word rendered bởi docx-preview */}
        <div
          ref={containerRef}
          className="docx-render-container"
          style={{
            transform: zoom !== 1 ? `scale(${zoom})` : 'none',
            transformOrigin: 'top center',
            transition: 'transform 0.15s ease-out'
          }}
        />
      </div>

      {/* Vùng hiển thị Văn bản trích xuất (AI Extracted Text) */}
      <div
        className={`docx-text-scroll-area ${activeTab === 'text' ? 'active' : 'hidden'}`}
      >
        <div className="docx-text-card">
          <div className="docx-text-card-header">
            <div className="docx-text-meta tabular-nums">
              <BookOpen size={16} className="text-primary-400" />
              <span>Nội dung văn bản trích xuất</span>
              <span className="docx-dot">•</span>
              <span>{wordCount.toLocaleString()} từ</span>
              <span className="docx-dot">•</span>
              <span>{charCount.toLocaleString()} ký tự</span>
            </div>
            {searchQuery && (
              <div className="docx-search-result-count tabular-nums">
                Khớp {filteredTextParagraphs.length} đoạn
              </div>
            )}
          </div>

          <div className="docx-text-content">
            {hasExtractedText ? (
              filteredTextParagraphs.length > 0 ? (
                filteredTextParagraphs.map((para, idx) => (
                  <p key={idx} className="docx-text-paragraph">
                    {para}
                  </p>
                ))
              ) : (
                <div className="docx-no-search-results">
                  Không tìm thấy đoạn văn bản nào khớp với từ khóa "{searchQuery}".
                </div>
              )
            ) : (
              <div className="docx-empty-text-state">
                <AlertCircle size={24} style={{ color: '#94a3b8' }} />
                <div>Chưa có nội dung văn bản trích xuất cho tệp tin này.</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DocxViewer;
