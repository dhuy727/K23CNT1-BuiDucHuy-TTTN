import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, Send, Square, FileText, Check, Copy } from 'lucide-react';
import ragService from '../../services/ragService';
import { useToast } from '../../contexts/ToastContext';

const DOC_PROMPT_CHIPS = [
  'Tóm tắt các ý chính trong tệp này',
  'Trích xuất các mốc thời gian hoặc số liệu quan trọng',
  'Có điều khoản hay rủi ro nào cần chú ý không?'
];

const DocChatTab = ({ file }) => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamDelta, setStreamDelta] = useState('');
  const [copiedIdx, setCopiedIdx] = useState(null);

  const messagesEndRef = useRef(null);
  const abortControllerRef = useRef(null);
  const toast = useToast();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamDelta]);

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
    const userMsg = { role: 'user', content: question };
    setMessages((prev) => [...prev, userMsg]);

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
          { role: 'assistant', content: fullAccumulated }
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
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 400 }}>
      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 4px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {messages.length === 0 && !isStreaming ? (
          <div style={{ textAlign: 'center', padding: '30px 10px', color: 'var(--text-secondary)' }}>
            <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--primary-50)', color: 'var(--primary-600)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
              <FileText size={22} />
            </div>
            <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)', marginBottom: 6 }}>
              Hỏi đáp trực tiếp trên tệp "{file?.name}"
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 20 }}>
              Đặt câu hỏi để trích xuất thông tin, tóm tắt hoặc kiểm tra nội dung chính xác.
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
                  <Sparkles size={11} style={{ opacity: 0.5 }} />
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {messages.map((m, idx) => (
              <div key={idx} className={`rag-msg-row ${m.role}`}>
                {m.role === 'user' ? (
                  <div className="rag-bubble-user" style={{ fontSize: 12.5, padding: '8px 12px' }}>
                    {m.content}
                  </div>
                ) : (
                  <div className="rag-bubble-assistant" style={{ fontSize: 12.5, padding: '10px 14px' }}>
                    <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{m.content}</div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 6 }}>
                      <button
                        type="button"
                        className="btn-icon"
                        onClick={() => handleCopy(m.content, idx)}
                        style={{ width: 20, height: 20 }}
                      >
                        {copiedIdx === idx ? <Check size={11} style={{ color: '#10b981' }} /> : <Copy size={11} />}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {isStreaming && (
              <div className="rag-msg-row assistant">
                <div className="rag-bubble-assistant" style={{ fontSize: 12.5, padding: '10px 14px' }}>
                  {streamDelta ? (
                    <>
                      <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{streamDelta}</div>
                      <span className="rag-cursor-pulse" />
                    </>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-muted)' }}>
                      <Sparkles size={12} className="animate-spin" />
                      <span>Đang phân tích và tổng hợp câu trả lời...</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div style={{ paddingTop: 10, borderTop: '1px solid var(--border-subtle)' }}>
        <div className="copilot-input-box" style={{ padding: '8px 12px', borderRadius: 12 }}>
          <textarea
            className="copilot-textarea"
            placeholder="Hỏi về tệp tin này..."
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            style={{ fontSize: 12.5 }}
          />
          <div className="copilot-input-actions">
            <span style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>Enter để gửi</span>
            {isStreaming ? (
              <button type="button" className="copilot-stop-btn" onClick={handleStop} style={{ padding: '2px 8px', fontSize: 11 }}>
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
