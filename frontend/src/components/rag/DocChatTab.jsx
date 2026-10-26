import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Sparkles, Send, Square, FileText, Check, Copy, ArrowDown } from 'lucide-react';
import ragService from '../../services/ragService';
import { useToast } from '../../contexts/ToastContext';

const DOC_PROMPT_CHIPS = [
  'Tóm tắt các ý chính trong tệp này',
  'Trích xuất các mốc thời gian hoặc số liệu quan trọng',
  'Có điều khoản hay rủi ro nào cần chú ý không?'
];

// Component render Markdown gọn gàng, typography chuẩn mực cho DocChatTab
const SimpleMarkdown = ({ text }) => {
  if (!text) return null;

  const lines = text.split('\n');
  const elements = [];
  let currentList = [];
  let inCodeBlock = false;
  let codeBuffer = [];

  const flushList = () => {
    if (currentList.length > 0) {
      elements.push(
        <ul key={`ul-${elements.length}`} style={{ margin: '6px 0 10px 18px', padding: 0 }}>
          {currentList.map((item, idx) => (
            <li key={idx} style={{ marginBottom: 4, lineHeight: 1.55 }}>
              {formatInline(item)}
            </li>
          ))}
        </ul>
      );
      currentList = [];
    }
  };

  const formatInline = (str) => {
    const parts = [];
    const regex = /(\*\*[^*]+\*\*|`[^`]+`)/g;
    let lastIdx = 0;
    let match;

    while ((match = regex.exec(str)) !== null) {
      if (match.index > lastIdx) {
        parts.push(str.slice(lastIdx, match.index));
      }
      const token = match[0];
      if (token.startsWith('**') && token.endsWith('**')) {
        parts.push(<strong key={match.index}>{token.slice(2, -2)}</strong>);
      } else if (token.startsWith('`') && token.endsWith('`')) {
        parts.push(
          <code
            key={match.index}
            style={{
              background: 'var(--bg-app, rgba(0,0,0,0.06))',
              padding: '1px 5px',
              borderRadius: 4,
              fontSize: '0.9em',
              fontFamily: 'monospace'
            }}
          >
            {token.slice(1, -1)}
          </code>
        );
      }
      lastIdx = regex.lastIndex;
    }
    if (lastIdx < str.length) {
      parts.push(str.slice(lastIdx));
    }
    return parts.length > 0 ? parts : str;
  };

  lines.forEach((line, idx) => {
    const trimmed = line.trim();

    if (trimmed.startsWith('```')) {
      if (inCodeBlock) {
        elements.push(
          <pre
            key={`code-${idx}`}
            style={{
              background: '#1e1e2e',
              color: '#cdd6f4',
              padding: '10px 12px',
              borderRadius: 8,
              overflowX: 'auto',
              fontSize: 12,
              margin: '8px 0'
            }}
          >
            <code>{codeBuffer.join('\n')}</code>
          </pre>
        );
        codeBuffer = [];
        inCodeBlock = false;
      } else {
        flushList();
        inCodeBlock = true;
      }
      return;
    }

    if (inCodeBlock) {
      codeBuffer.push(line);
      return;
    }

    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      currentList.push(trimmed.slice(2));
      return;
    }

    flushList();

    if (trimmed.startsWith('### ')) {
      elements.push(
        <h4 key={idx} style={{ fontSize: 13.5, fontWeight: 700, margin: '10px 0 4px', color: 'var(--text-primary)' }}>
          {formatInline(trimmed.slice(4))}
        </h4>
      );
    } else if (trimmed.startsWith('## ')) {
      elements.push(
        <h3 key={idx} style={{ fontSize: 14.5, fontWeight: 700, margin: '12px 0 6px', color: 'var(--text-primary)' }}>
          {formatInline(trimmed.slice(3))}
        </h3>
      );
    } else if (trimmed.startsWith('# ')) {
      elements.push(
        <h2 key={idx} style={{ fontSize: 15.5, fontWeight: 700, margin: '14px 0 8px', color: 'var(--text-primary)' }}>
          {formatInline(trimmed.slice(2))}
        </h2>
      );
    } else if (trimmed.startsWith('> ')) {
      elements.push(
        <blockquote
          key={idx}
          style={{
            borderLeft: '3px solid var(--primary-500)',
            paddingLeft: 10,
            margin: '6px 0',
            color: 'var(--text-secondary)',
            fontStyle: 'italic'
          }}
        >
          {formatInline(trimmed.slice(2))}
        </blockquote>
      );
    } else if (trimmed.length > 0) {
      elements.push(
        <p key={idx} style={{ margin: '0 0 6px', lineHeight: 1.55 }}>
          {formatInline(line)}
        </p>
      );
    }
  });

  flushList();
  return <div style={{ fontSize: 12.5, wordBreak: 'break-word', overflowWrap: 'anywhere' }}>{elements}</div>;
};

const DocChatTab = ({ file }) => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamDelta, setStreamDelta] = useState('');
  const [copiedIdx, setCopiedIdx] = useState(null);
  const [showScrollBottom, setShowScrollBottom] = useState(false);

  const scrollContainerRef = useRef(null);
  const messagesEndRef = useRef(null);
  const abortControllerRef = useRef(null);
  const textareaRef = useRef(null);
  const isUserScrolledUpRef = useRef(false);
  const toast = useToast();

  // Kiểm tra vị trí cuộn để bật/tắt nút 'Xuống tin mới' và quản lý Smart Auto-Scroll
  const handleScroll = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const distanceToBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const isUp = distanceToBottom > 60;
    isUserScrolledUpRef.current = isUp;
    setShowScrollBottom(isUp);
  }, []);

  const scrollToBottom = useCallback((smooth = true) => {
    if (!scrollContainerRef.current) return;
    scrollContainerRef.current.scrollTo({
      top: scrollContainerRef.current.scrollHeight,
      behavior: smooth ? 'smooth' : 'auto'
    });
    isUserScrolledUpRef.current = false;
    setShowScrollBottom(false);
  }, []);

  // Tự động cuộn theo luồng stream chỉ khi người dùng đang ở cuối trang
  useEffect(() => {
    if (!isUserScrolledUpRef.current) {
      scrollToBottom(false);
    }
  }, [messages, streamDelta, scrollToBottom]);

  // Tự động điều chỉnh chiều cao textarea theo nội dung nhập
  const handleInputChange = (e) => {
    setInput(e.target.value);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  };

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsStreaming(false);
  };

  const handleSend = async (customText = null) => {
    const question = String(customText || input || '').trim();
    if (!question || isStreaming || !file?._id) return;

    setInput('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    const userMsg = { role: 'user', content: question, createdAt: new Date() };
    setMessages((prev) => [...prev, userMsg]);

    // Khi người dùng bấm gửi, chủ động cuộn ngay xuống đáy
    isUserScrolledUpRef.current = false;
    setShowScrollBottom(false);
    setTimeout(() => scrollToBottom(true), 50);

    setIsStreaming(true);
    setStreamDelta('');

    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    let fullAccumulated = '';

    await ragService.streamChat({
      message: question,
      scopeType: 'file',
      scopeTargetId: file._id,
      signal: abortController.signal,
      onDelta: (chunk) => {
        fullAccumulated += chunk;
        setStreamDelta(fullAccumulated);
      },
      onDone: () => {
        setIsStreaming(false);
        setStreamDelta('');
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: fullAccumulated, createdAt: new Date() }
        ]);
      },
      onError: (err) => {
        setIsStreaming(false);
        toast.error(err.message || 'Lỗi khi hỏi đáp tài liệu');
      }
    });
  };

  const handleCopy = (text, idx) => {
    navigator.clipboard.writeText(text);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: 0,
        overflow: 'hidden',
        position: 'relative'
      }}
    >
      {/* Vùng danh sách tin nhắn cuộn độc lập */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="doc-chat-scroll"
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          padding: '12px 4px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
          overscrollBehavior: 'contain'
        }}
      >
        {messages.length === 0 && !isStreaming ? (
          <div style={{ textAlign: 'center', padding: '30px 10px', color: 'var(--text-secondary)' }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: '50%',
                background: 'var(--primary-50)',
                color: 'var(--primary-600)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 12
              }}
            >
              <FileText size={22} />
            </div>
            <div
              style={{
                fontWeight: 600,
                fontSize: 13.5,
                color: 'var(--text-primary)',
                marginBottom: 6,
                padding: '0 8px',
                wordBreak: 'break-word'
              }}
            >
              Hỏi đáp trên "{file?.name}"
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 20 }}>
              Trợ lý AI sẽ đọc và trích dẫn nội dung trực tiếp từ tệp tin này.
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 360, margin: '0 auto' }}>
              {DOC_PROMPT_CHIPS.map((chip, idx) => (
                <button
                  type="button"
                  key={idx}
                  className="starter-chip"
                  onClick={() => handleSend(chip)}
                  style={{ textAlign: 'left', padding: '8px 12px', fontSize: 12 }}
                >
                  <span>{chip}</span>
                  <Sparkles size={11} style={{ opacity: 0.5, flexShrink: 0 }} />
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {messages.map((m, idx) => (
              <div key={idx} className={`rag-msg-row ${m.role}`}>
                {m.role === 'user' ? (
                  <div
                    className="rag-bubble-user"
                    style={{
                      fontSize: 12.5,
                      padding: '8px 12px',
                      wordBreak: 'break-word',
                      overflowWrap: 'anywhere'
                    }}
                  >
                    {m.content}
                  </div>
                ) : (
                  <div
                    className="rag-bubble-assistant"
                    style={{
                      fontSize: 12.5,
                      padding: '12px 14px',
                      wordBreak: 'break-word',
                      overflowWrap: 'anywhere'
                    }}
                  >
                    <SimpleMarkdown text={m.content} />
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
                      <button
                        type="button"
                        className="btn-icon"
                        onClick={() => handleCopy(m.content, idx)}
                        style={{ width: 22, height: 22 }}
                        title="Sao chép nội dung"
                      >
                        {copiedIdx === idx ? <Check size={12} style={{ color: '#10b981' }} /> : <Copy size={12} />}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {isStreaming && (
              <div className="rag-msg-row assistant">
                <div
                  className="rag-bubble-assistant"
                  style={{
                    fontSize: 12.5,
                    padding: '12px 14px',
                    wordBreak: 'break-word',
                    overflowWrap: 'anywhere'
                  }}
                >
                  {streamDelta ? (
                    <>
                      <SimpleMarkdown text={streamDelta} />
                      <span className="rag-cursor-pulse" />
                    </>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-muted)' }}>
                      <Sparkles size={13} className="animate-spin text-primary" />
                      <span>Đang trích xuất và tổng hợp câu trả lời...</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
        <div ref={messagesEndRef} style={{ height: 1 }} />
      </div>

      {/* Nút nổi 'Xuống tin mới' khi người dùng cuộn lên trên */}
      {showScrollBottom && (
        <button
          type="button"
          onClick={() => scrollToBottom(true)}
          style={{
            position: 'absolute',
            bottom: 74,
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'var(--bg-surface)',
            color: 'var(--primary-600)',
            border: '1px solid var(--border-main)',
            boxShadow: 'var(--shadow-md)',
            borderRadius: 999,
            padding: '5px 12px',
            fontSize: 11.5,
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            cursor: 'pointer',
            zIndex: 10,
            animation: 'copilotFadeIn 0.2s ease',
            transition: 'all 0.15s ease'
          }}
        >
          <ArrowDown size={13} />
          <span>Tin mới</span>
        </button>
      )}

      {/* Khung nhập liệu cố định ở đáy */}
      <div
        style={{
          flexShrink: 0,
          paddingTop: 8,
          borderTop: '1px solid var(--border-subtle)',
          background: 'var(--bg-surface)'
        }}
      >
        <div className="copilot-input-box" style={{ padding: '8px 10px', borderRadius: 12 }}>
          <textarea
            ref={textareaRef}
            className="copilot-textarea"
            placeholder="Hỏi về tệp tin này (Shift+Enter để xuống dòng)..."
            rows={1}
            value={input}
            onChange={handleInputChange}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            style={{
              fontSize: 12.5,
              maxHeight: 120,
              minHeight: 24,
              overflowY: 'auto',
              resize: 'none'
            }}
          />
          <div className="copilot-input-actions">
            <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Enter để gửi</span>
            {isStreaming ? (
              <button
                type="button"
                className="copilot-stop-btn"
                onClick={handleStop}
                style={{ padding: '3px 8px', fontSize: 11 }}
              >
                <Square size={10} fill="currentColor" />
                <span>Dừng</span>
              </button>
            ) : (
              <button
                type="button"
                className="copilot-send-btn"
                onClick={() => handleSend()}
                disabled={!input.trim()}
                style={{ width: 28, height: 28 }}
                title="Gửi câu hỏi"
              >
                <Send size={12} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DocChatTab;
