import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  X,
  Send,
  Square,
  Clock,
  Plus,
  Globe,
  Folder,
  FileText,
  ChevronDown,
  Trash2,
  Copy,
  Check,
  RotateCcw,
  Info,
  ShieldCheck,
  ShieldAlert
} from 'lucide-react';
import ragService from '../../services/ragService';
import CitationPill from './CitationPill';
import { useToast } from '../../contexts/ToastContext';

// Hàm render Markdown cơ bản không cần thư viện bên ngoài
const SimpleMarkdown = ({ text, citations = [] }) => {
  if (!text) return null;

  // Xử lý các dòng
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
            <li key={idx} style={{ marginBottom: 4 }}>
              {formatInline(item)}
            </li>
          ))}
        </ul>
      );
      currentList = [];
    }
  };

  const formatInline = (str) => {
    // Xử lý in đậm **text**, code `text`, và footnote [^1]
    const parts = [];
    const regex = /(\*\*[^*]+\*\*|`[^`]+`|\[\^[0-9]+\])/g;
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
        parts.push(<code key={match.index}>{token.slice(1, -1)}</code>);
      } else if (token.startsWith('[^') && token.endsWith(']')) {
        const fnNum = parseInt(token.slice(2, -1), 10);
        const targetCitation = Array.isArray(citations) ? citations[fnNum - 1] : null;

        parts.push(
          <button
            key={match.index}
            type="button"
            className="rag-inline-footnote"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (targetCitation?.fileId) {
                window.dispatchEvent(
                  new CustomEvent('open-preview-file', {
                    detail: { fileId: targetCitation.fileId }
                  })
                );
              }
            }}
            title={targetCitation ? `Mở tệp: ${targetCitation.fileName}` : `Trích dẫn nguồn [^${fnNum}]`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'var(--primary-50)',
              color: 'var(--primary-700)',
              border: '1px solid var(--primary-200)',
              borderRadius: '4px',
              padding: '0 4px',
              fontSize: '10.5px',
              fontWeight: 700,
              marginLeft: '2px',
              cursor: targetCitation?.fileId ? 'pointer' : 'default',
              verticalAlign: 'baseline',
              lineHeight: 1.3,
              transition: 'all 0.15s ease'
            }}
          >
            {token}
          </button>
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
        // Kết thúc code block
        elements.push(
          <pre key={`code-${idx}`} style={{ background: '#1e1e2e', color: '#cdd6f4', padding: 12, borderRadius: 8, overflowX: 'auto', fontSize: 12 }}>
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
      elements.push(<h4 key={idx} style={{ fontSize: 14, fontWeight: 700, margin: '10px 0 4px', color: 'var(--text-primary)' }}>{formatInline(trimmed.slice(4))}</h4>);
    } else if (trimmed.startsWith('## ')) {
      elements.push(<h3 key={idx} style={{ fontSize: 15, fontWeight: 700, margin: '12px 0 6px', color: 'var(--text-primary)' }}>{formatInline(trimmed.slice(3))}</h3>);
    } else if (trimmed.startsWith('# ')) {
      elements.push(<h2 key={idx} style={{ fontSize: 16, fontWeight: 700, margin: '14px 0 8px', color: 'var(--text-primary)' }}>{formatInline(trimmed.slice(2))}</h2>);
    } else if (trimmed.startsWith('> ')) {
      elements.push(<blockquote key={idx} style={{ borderLeft: '3px solid var(--primary-500)', paddingLeft: 12, margin: '8px 0', color: 'var(--text-secondary)', fontStyle: 'italic' }}>{formatInline(trimmed.slice(2))}</blockquote>);
    } else if (trimmed.length > 0) {
      elements.push(<p key={idx} style={{ margin: '0 0 8px', lineHeight: 1.55 }}>{formatInline(line)}</p>);
    }
  });

  flushList();
  return <div className="rag-markdown">{elements}</div>;
};

const PROMPT_STARTERS = [
  'Tóm tắt các tài liệu quan trọng trong kho lưu trữ của tôi',
  'Có tài liệu nào liên quan đến báo cáo tài chính hoặc hóa đơn không?',
  'Phân tích nội dung và trích xuất các mốc thời gian / số liệu chính',
  'Tìm các hợp đồng hoặc biên bản được cập nhật gần đây'
];

const AiCopilotDrawer = ({ isOpen, onClose, initialScope }) => {
  const [conversations, setConversations] = useState([]);
  const [activeConversationId, setActiveConversationId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamDelta, setStreamDelta] = useState('');
  const [streamCitations, setStreamCitations] = useState([]);
  const [showScopeDropdown, setShowScopeDropdown] = useState(false);
  const [showThreadsPanel, setShowThreadsPanel] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState(null);
  const [rateLimitSeconds, setRateLimitSeconds] = useState(0);

  // Scope hiện tại: 'all' | 'folder' | 'file'
  const [scope, setScope] = useState({
    type: 'all',
    targetId: null,
    name: 'Toàn bộ Drive'
  });

  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);
  const abortControllerRef = useRef(null);
  const toast = useToast();

  // Đếm ngược Rate Limit làm nguội hệ thống
  useEffect(() => {
    if (rateLimitSeconds <= 0) return;
    const timer = setInterval(() => {
      setRateLimitSeconds((prev) => (prev > 1 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [rateLimitSeconds]);

  // Đồng bộ initialScope nếu được truyền vào
  useEffect(() => {
    if (initialScope) {
      setScope(initialScope);
    }
  }, [initialScope]);

  // Cuộn xuống cuối tin nhắn
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamDelta]);

  // Tải danh sách hội thoại khi mở drawer
  useEffect(() => {
    if (isOpen) {
      loadConversations();
    }
  }, [isOpen]);

  const loadConversations = async () => {
    try {
      const res = await ragService.getConversations();
      const list = res?.data || [];
      setConversations(list);
    } catch (err) {
      console.warn('[Copilot] Lỗi tải danh sách hội thoại:', err.message);
    }
  };

  // Tải tin nhắn của một cuộc trò chuyện
  const handleSelectConversation = async (convId) => {
    try {
      setActiveConversationId(convId);
      setShowThreadsPanel(false);
      const res = await ragService.getConversationMessages(convId);
      const data = res?.data || {};
      setMessages(data.messages || []);
      if (data.conversation?.scopeType) {
        setScope({
          type: data.conversation.scopeType,
          targetId: data.conversation.scopeTargetId,
          name: data.conversation.scopeName || 'Toàn bộ Drive'
        });
      }
    } catch (err) {
      toast.error('Không thể tải lịch sử trò chuyện');
    }
  };

  // Tạo cuộc trò chuyện mới
  const handleNewChat = () => {
    if (isStreaming) handleStopStream();
    setActiveConversationId(null);
    setMessages([]);
    setStreamDelta('');
    setStreamCitations([]);
    setShowThreadsPanel(false);
    if (textareaRef.current) textareaRef.current.focus();
  };

  // Xóa cuộc trò chuyện
  const handleDeleteConversation = async (e, convId) => {
    e.stopPropagation();
    try {
      await ragService.deleteConversation(convId);
      setConversations((prev) => prev.filter((c) => c._id !== convId));
      if (activeConversationId === convId) {
        handleNewChat();
      }
      toast.success('Đã xóa cuộc trò chuyện');
    } catch (err) {
      toast.error('Không thể xóa cuộc trò chuyện');
    }
  };

  // Dừng streaming
  const handleStopStream = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsStreaming(false);
  };

  // Gửi tin nhắn
  const handleSendMessage = async (textToSend = null) => {
    const question = String(textToSend || input || '').trim();
    if (!question || isStreaming) return;

    setInput('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    // Đẩy tin nhắn của user vào UI ngay lập tức
    const userMsg = { role: 'user', content: question, createdAt: new Date() };
    setMessages((prev) => [...prev, userMsg]);

    setIsStreaming(true);
    setStreamDelta('');
    setStreamCitations([]);

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    let fullAccumulated = '';
    let receivedCitations = [];

    await ragService.streamChat({
      message: question,
      conversationId: activeConversationId,
      scopeType: scope.type,
      scopeTargetId: scope.targetId,
      signal: abortController.signal,
      onCitations: (citations) => {
        receivedCitations = citations;
        setStreamCitations(citations);
      },
      onDelta: (chunk) => {
        fullAccumulated += chunk;
        setStreamDelta(fullAccumulated);
      },
      onDone: (result) => {
        setIsStreaming(false);
        setStreamDelta('');
        const finalCitations = (Array.isArray(result?.citations) && result.citations.length > 0)
          ? result.citations
          : receivedCitations;
        // Lưu tin nhắn trợ lý hoàn chỉnh vào messages array
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: fullAccumulated,
            citations: finalCitations,
            createdAt: new Date()
          }
        ]);
        if (result?.conversationId && !activeConversationId) {
          setActiveConversationId(result.conversationId);
          loadConversations();
        }
      },
      onError: (err) => {
        setIsStreaming(false);
        if (err.status === 429) {
          const waitSec = Number(err.retryAfter) || 60;
          setRateLimitSeconds(waitSec);
          toast.warning(`Hệ thống đang làm nguội để bảo vệ tài nguyên. Vui lòng thử lại sau ${waitSec} giây.`);
        } else {
          toast.error(err.message || 'Lỗi khi giao tiếp với Trợ lý AI');
        }
      }
    });
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleCopy = (text, idx) => {
    navigator.clipboard.writeText(text);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="copilot-backdrop" onClick={onClose} />
      <aside className="copilot-drawer" aria-label="DocuFlow AI Copilot">
        {/* Header */}
        <div className="copilot-header">
          <div className="copilot-brand">
            <div className="copilot-brand-icon">
              <Sparkles size={17} />
            </div>
            <div className="copilot-title-wrap">
              <span className="copilot-title">DocuFlow AI Copilot</span>
              <span className="copilot-subtitle">Hỏi đáp ngữ cảnh & Trích dẫn nguồn</span>
            </div>
          </div>
          <div className="copilot-actions">
            <button
              type="button"
              className={`copilot-btn-icon ${showThreadsPanel ? 'active' : ''}`}
              onClick={() => setShowThreadsPanel((prev) => !prev)}
              title="Lịch sử hội thoại"
            >
              <Clock size={16} />
            </button>
            <button
              type="button"
              className="copilot-btn-icon"
              onClick={handleNewChat}
              title="Tạo hội thoại mới"
            >
              <Plus size={17} />
            </button>
            <button
              type="button"
              className="copilot-btn-icon"
              onClick={onClose}
              title="Đóng bảng trợ lý (Esc)"
            >
              <X size={17} />
            </button>
          </div>
        </div>

        {/* Scope Selector Bar */}
        <div className="copilot-scope-bar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ color: 'var(--text-muted)' }}>Phạm vi:</span>
            <button
              type="button"
              className="scope-pill-btn"
              onClick={() => setShowScopeDropdown((prev) => !prev)}
            >
              {scope.type === 'all' && <Globe size={13} style={{ color: 'var(--primary-500)' }} />}
              {scope.type === 'folder' && <Folder size={13} style={{ color: 'var(--accent-amber)' }} />}
              {scope.type === 'file' && <FileText size={13} style={{ color: 'var(--accent-blue)' }} />}
              <span>{scope.name}</span>
              <ChevronDown size={12} />
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                fontSize: 10.5,
                fontWeight: 600,
                color: '#166534',
                backgroundColor: '#f0fdf4',
                border: '1px solid #bbf7d0',
                padding: '2px 8px',
                borderRadius: '12px'
              }}
              title="Cơ chế Document-Level ACL đang kích hoạt: Dữ liệu được bảo vệ đa tầng và loại trừ tệp tin rác/hết hạn"
            >
              <ShieldCheck size={11} />
              <span>ACL Bảo vệ</span>
            </span>

            {activeConversationId && (
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                Đã lưu phiên
              </span>
            )}
          </div>
        </div>

        {/* Scope Dropdown Menu */}
        {showScopeDropdown && (
          <div className="scope-dropdown">
            <div
              className={`scope-option-item ${scope.type === 'all' ? 'selected' : ''}`}
              onClick={() => {
                setScope({ type: 'all', targetId: null, name: 'Toàn bộ Drive' });
                setShowScopeDropdown(false);
              }}
            >
              <Globe size={15} style={{ color: 'var(--primary-500)' }} />
              <div>
                <div style={{ fontWeight: 600 }}>Toàn bộ Drive</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Tìm trên tất cả tệp bạn có quyền xem</div>
              </div>
            </div>
            {scope.type === 'folder' && (
              <div className="scope-option-item selected">
                <Folder size={15} style={{ color: 'var(--accent-amber)' }} />
                <div>
                  <div style={{ fontWeight: 600 }}>{scope.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Chỉ tìm trong thư mục này</div>
                </div>
              </div>
            )}
            {scope.type === 'file' && (
              <div className="scope-option-item selected">
                <FileText size={15} style={{ color: 'var(--accent-blue)' }} />
                <div>
                  <div style={{ fontWeight: 600 }}>{scope.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Chỉ hỏi đáp trên tệp tin này</div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Threads History Sub-panel */}
        {showThreadsPanel && (
          <div className="copilot-threads-panel">
            <div className="threads-header">
              <span>Lịch sử hội thoại</span>
              <button
                type="button"
                className="btn-icon"
                onClick={() => setShowThreadsPanel(false)}
              >
                <X size={14} />
              </button>
            </div>
            <div className="threads-list">
              {conversations.length === 0 ? (
                <div style={{ padding: 16, textAlign: 'center', fontSize: 12, color: 'var(--text-muted)' }}>
                  Chưa có cuộc trò chuyện nào trước đây
                </div>
              ) : (
                conversations.map((conv) => (
                  <div
                    key={conv._id}
                    className={`thread-item ${activeConversationId === conv._id ? 'active' : ''}`}
                    onClick={() => handleSelectConversation(conv._id)}
                  >
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 190 }}>
                      {conv.title}
                    </span>
                    <button
                      type="button"
                      className="btn-icon"
                      onClick={(e) => handleDeleteConversation(e, conv._id)}
                      title="Xóa"
                      style={{ opacity: 0.6 }}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Messages Body */}
        <div className="copilot-body">
          {messages.length === 0 && !isStreaming ? (
            <div className="copilot-welcome">
              <div className="copilot-welcome-icon">
                <Sparkles size={28} />
              </div>
              <div className="copilot-welcome-title">Xin chào! Tôi có thể giúp gì cho bạn?</div>
              <div className="copilot-welcome-desc">
                Hỏi đáp thông minh dựa trên nội dung các tệp PDF, DOCX và văn bản trong kho lưu trữ của bạn.
              </div>

              <div className="copilot-starters">
                {PROMPT_STARTERS.map((st, idx) => (
                  <button
                    type="button"
                    key={idx}
                    className="starter-chip"
                    onClick={() => handleSendMessage(st)}
                  >
                    <span>{st}</span>
                    <Sparkles size={12} style={{ opacity: 0.5 }} />
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {messages.map((msg, idx) => (
                <div key={idx} className={`rag-msg-row ${msg.role}`}>
                  {msg.role === 'user' ? (
                    <div className="rag-bubble-user">{msg.content}</div>
                  ) : (
                    <div className="rag-bubble-assistant">
                      <SimpleMarkdown text={msg.content} citations={msg.citations} />

                      {/* Hiển thị Trích dẫn Citations */}
                      {Array.isArray(msg.citations) && msg.citations.length > 0 && (
                        <div className="rag-citations-box">
                          <div className="rag-citations-header">
                            <Info size={11} />
                            <span>Tài liệu trích dẫn tham chiếu:</span>
                          </div>
                          <div className="rag-citations-list">
                            {msg.citations.map((c, cIdx) => (
                              <CitationPill key={cIdx} citation={c} index={cIdx} />
                            ))}
                          </div>
                        </div>
                      )}

                      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
                        <button
                          type="button"
                          className="btn-icon"
                          onClick={() => handleCopy(msg.content, idx)}
                          title="Sao chép nội dung"
                          style={{ width: 24, height: 24 }}
                        >
                          {copiedIdx === idx ? <Check size={12} style={{ color: '#10b981' }} /> : <Copy size={12} />}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {/* Streaming Assistant Bubble */}
              {isStreaming && (
                <div className="rag-msg-row assistant">
                  <div className="rag-bubble-assistant">
                    {streamDelta ? (
                      <>
                        <SimpleMarkdown text={streamDelta} citations={streamCitations} />
                        <span className="rag-cursor-pulse" />
                      </>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-secondary)' }}>
                        <Sparkles size={14} className="animate-spin" style={{ color: 'var(--primary-500)' }} />
                        <span>Đang tìm kiếm tài liệu và tổng hợp câu trả lời...</span>
                      </div>
                    )}

                    {streamCitations.length > 0 && (
                      <div className="rag-citations-box">
                        <div className="rag-citations-header">
                          <Info size={11} />
                          <span>Tài liệu trích dẫn tham chiếu:</span>
                        </div>
                        <div className="rag-citations-list">
                          {streamCitations.map((c, cIdx) => (
                            <CitationPill key={cIdx} citation={c} index={cIdx} />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Footer */}
        <div className="copilot-footer">
          {rateLimitSeconds > 0 && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 12px',
                marginBottom: 8,
                backgroundColor: '#fffbeb',
                border: '1px solid #fde68a',
                borderRadius: 8,
                fontSize: 12,
                color: '#92400e',
                animation: 'copilotFadeIn 0.2s ease'
              }}
            >
              <Clock size={14} style={{ flexShrink: 0 }} />
              <span>
                Hệ thống đang điều tiết lưu lượng (Rate Limit). Bạn có thể tiếp tục hỏi sau <strong>{rateLimitSeconds}s</strong>.
              </span>
            </div>
          )}

          <div className="copilot-input-box">
            <textarea
              ref={textareaRef}
              className="copilot-textarea"
              placeholder={
                rateLimitSeconds > 0
                  ? `Vui lòng chờ làm nguội (${rateLimitSeconds}s)...`
                  : 'Đặt câu hỏi về tài liệu của bạn...'
              }
              rows={1}
              value={input}
              disabled={rateLimitSeconds > 0}
              onChange={(e) => {
                setInput(e.target.value);
                e.target.style.height = 'auto';
                e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
              }}
              onKeyDown={handleKeyDown}
            />
            <div className="copilot-input-actions">
              <span className="copilot-input-hint">
                {rateLimitSeconds > 0 ? `Đang chờ ${rateLimitSeconds}s` : 'Nhấn Enter để gửi, Shift+Enter xuống dòng'}
              </span>
              {isStreaming ? (
                <button
                  type="button"
                  className="copilot-stop-btn"
                  onClick={handleStopStream}
                  title="Dừng sinh câu trả lời"
                >
                  <Square size={11} fill="currentColor" />
                  <span>Dừng</span>
                </button>
              ) : (
                <button
                  type="button"
                  className="copilot-send-btn"
                  onClick={() => handleSendMessage()}
                  disabled={!input.trim() || rateLimitSeconds > 0}
                  title={rateLimitSeconds > 0 ? `Vui lòng chờ ${rateLimitSeconds}s` : 'Gửi câu hỏi'}
                >
                  <Send size={14} />
                </button>
              )}
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};

export default AiCopilotDrawer;
