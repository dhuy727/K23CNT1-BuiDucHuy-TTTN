import axiosClient from '../api/axiosClient';

const BASE_URL = import.meta.env.VITE_API_URL || '/api';

const ragService = {
  /**
   * Lấy danh sách cuộc trò chuyện RAG của người dùng
   */
  getConversations: async () => {
    return await axiosClient.get('/rag/conversations');
  },

  /**
   * Lấy danh sách tin nhắn của một cuộc trò chuyện
   */
  getConversationMessages: async (conversationId) => {
    return await axiosClient.get(`/rag/conversations/${conversationId}/messages`);
  },

  /**
   * Xóa một cuộc trò chuyện
   */
  deleteConversation: async (conversationId) => {
    return await axiosClient.delete(`/rag/conversations/${conversationId}`);
  },

  /**
   * Yêu cầu lập chỉ mục lại thủ công cho file
   */
  reindexFile: async (fileId) => {
    return await axiosClient.post(`/rag/files/${fileId}/reindex`);
  },

  /**
   * Lấy trạng thái lập chỉ mục RAG của file
   */
  getFileRagStatus: async (fileId) => {
    return await axiosClient.get(`/rag/files/${fileId}/status`);
  },

  /**
   * Truyền phát (Stream) câu trả lời RAG qua Server-Sent Events (SSE)
   */
  streamChat: async ({
    message,
    conversationId = null,
    scopeType = 'all',
    scopeTargetId = null,
    signal,
    onCitations,
    onDelta,
    onDone,
    onError
  }) => {
    const token = localStorage.getItem('secretToken');
    const endpoint = `${BASE_URL.replace(/\/$/, '')}/rag/chat/stream`;

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          message,
          conversationId,
          scopeType,
          scopeTargetId
        }),
        signal
      });

      if (!response.ok) {
        let errMessage = `Lỗi máy chủ (${response.status})`;
        let retryAfter = null;
        try {
          const errJson = await response.json();
          errMessage = errJson.message || errMessage;
          retryAfter = errJson.retryAfter || null;
        } catch (_) {}
        const error = new Error(errMessage);
        error.status = response.status;
        error.retryAfter = retryAfter;
        throw error;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split('\n\n');
        buffer = events.pop() || '';

        for (const evtBlock of events) {
          if (!evtBlock.trim()) continue;
          const lines = evtBlock.split('\n');
          let eventType = 'message';
          let eventDataStr = '';

          for (const line of lines) {
            if (line.startsWith('event:')) {
              eventType = line.slice(6).trim();
            } else if (line.startsWith('data:')) {
              eventDataStr += line.slice(5).trim();
            }
          }

          if (!eventDataStr) continue;

          try {
            const data = JSON.parse(eventDataStr);

            if (eventType === 'citations' && typeof onCitations === 'function') {
              onCitations(data.citations || []);
            } else if (eventType === 'delta' && typeof onDelta === 'function') {
              onDelta(data.delta || '');
            } else if (eventType === 'done' && typeof onDone === 'function') {
              onDone(data);
            } else if (eventType === 'error') {
              if (typeof onError === 'function') {
                onError(new Error(data.message || 'Lỗi xử lý phản hồi AI'));
              }
              return;
            }
          } catch (jsonErr) {
            console.debug('[RAG SSE] Lỗi parse event json:', jsonErr);
          }
        }
      }
    } catch (err) {
      if (err.name === 'AbortError') {
        console.log('[RAG SSE] Người dùng đã hủy phản hồi');
        return;
      }
      if (typeof onError === 'function') {
        onError(err);
      } else {
        console.error('[RAG SSE Error]:', err);
      }
    }
  }
};

export default ragService;
