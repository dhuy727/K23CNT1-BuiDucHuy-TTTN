import axiosClient from '../api/axiosClient';

const BASE_URL = import.meta.env.VITE_API_URL || '/api';

const SESSION_KEY = 'docuflow_collab_session_id';
const GUEST_NAME_KEY = 'docuflow_guest_display_name';

const getSessionId = () => {
  let sid = sessionStorage.getItem(SESSION_KEY);
  if (!sid) {
    sid = `collab_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    sessionStorage.setItem(SESSION_KEY, sid);
  }
  return sid;
};

const getGuestDisplayName = () => {
  let name = localStorage.getItem(GUEST_NAME_KEY);
  if (!name) {
    const randomNum = Math.floor(100 + Math.random() * 900);
    name = `Khách #${randomNum}`;
    localStorage.setItem(GUEST_NAME_KEY, name);
  }
  return name;
};

const setGuestDisplayName = (newName) => {
  const trimmed = (newName || '').trim().slice(0, 40);
  if (trimmed) {
    localStorage.setItem(GUEST_NAME_KEY, trimmed);
  }
  return trimmed || getGuestDisplayName();
};

const buildHeaders = ({ shareToken, password } = {}) => {
  const headers = {};
  if (shareToken) {
    headers['x-share-token'] = shareToken;
  }
  if (password) {
    headers['x-share-password'] = password;
  }
  return headers;
};

const collabService = {
  getSessionId,
  getGuestDisplayName,
  setGuestDisplayName,

  /**
   * Lấy thông tin phiên cộng tác thời gian thực
   */
  getSession: async (fileId, { shareToken = null, password = null, sessionId = null, displayName = null } = {}) => {
    const sid = sessionId || getSessionId();
    const headers = buildHeaders({ shareToken, password });
    const params = {
      sessionId: sid,
      ...(displayName ? { displayName } : {}),
      ...(shareToken ? { shareToken } : {})
    };
    return await axiosClient.get(`/collab/${fileId}/session`, { headers, params });
  },

  /**
   * Kết nối luồng Server-Sent Events (SSE) để nhận cập nhật trực tiếp
   */
  connectStream: (
    fileId,
    { shareToken = null, password = null, sessionId = null, displayName = null } = {},
    handlers = {}
  ) => {
    const sid = sessionId || getSessionId();
    const secretToken = localStorage.getItem('secretToken');

    const query = new URLSearchParams();
    query.set('sessionId', sid);
    if (displayName) query.set('displayName', displayName);
    if (shareToken) query.set('shareToken', shareToken);
    if (password) query.set('password', password);
    if (secretToken) query.set('accessToken', secretToken);

    const streamUrl = `${BASE_URL}/collab/${fileId}/stream?${query.toString()}`;
    const eventSource = new EventSource(streamUrl);

    if (handlers.onConnected) {
      eventSource.addEventListener('connected', (e) => {
        try {
          handlers.onConnected(JSON.parse(e.data));
        } catch (err) {
          console.error('[Collab SSE] Lỗi parse connected:', err);
        }
      });
    }

    if (handlers.onPresenceUpdated) {
      eventSource.addEventListener('presence_updated', (e) => {
        try {
          handlers.onPresenceUpdated(JSON.parse(e.data));
        } catch (err) {
          console.error('[Collab SSE] Lỗi parse presence_updated:', err);
        }
      });
    }

    if (handlers.onContentUpdated) {
      eventSource.addEventListener('content_updated', (e) => {
        try {
          handlers.onContentUpdated(JSON.parse(e.data));
        } catch (err) {
          console.error('[Collab SSE] Lỗi parse content_updated:', err);
        }
      });
    }

    if (handlers.onDocumentSaved) {
      eventSource.addEventListener('document_saved', (e) => {
        try {
          handlers.onDocumentSaved(JSON.parse(e.data));
        } catch (err) {
          console.error('[Collab SSE] Lỗi parse document_saved:', err);
        }
      });
    }

    if (handlers.onFileReplaced) {
      eventSource.addEventListener('file_replaced', (e) => {
        try {
          handlers.onFileReplaced(JSON.parse(e.data));
        } catch (err) {
          console.error('[Collab SSE] Lỗi parse file_replaced:', err);
        }
      });
    }

    if (handlers.onError) {
      eventSource.onerror = (err) => {
        handlers.onError(err);
      };
    }

    return () => {
      eventSource.close();
    };
  },

  /**
   * Phát nội dung đang gõ theo thời gian thực tới các thành viên khác
   */
  syncLiveContent: async (
    fileId,
    { content, sessionId = null, displayName = null, isTyping = true, shareToken = null, password = null } = {}
  ) => {
    const sid = sessionId || getSessionId();
    const headers = buildHeaders({ shareToken, password });
    return await axiosClient.post(
      `/collab/${fileId}/sync`,
      {
        content,
        sessionId: sid,
        displayName,
        isTyping,
        shareToken,
        password
      },
      { headers }
    );
  },

  /**
   * Lưu nội dung xuống tệp vật lý (.docx / văn bản)
   */
  saveDocument: async (
    fileId,
    { content, sessionId = null, displayName = null, shareToken = null, password = null } = {}
  ) => {
    const sid = sessionId || getSessionId();
    const headers = buildHeaders({ shareToken, password });
    return await axiosClient.post(
      `/collab/${fileId}/save`,
      {
        content,
        sessionId: sid,
        displayName,
        shareToken,
        password
      },
      { headers }
    );
  },

  /**
   * Tải tệp mới thay thế cho tệp hiện tại (PDF, hình ảnh, hoặc bản cập nhật mới)
   */
  replaceBinaryFile: async (
    fileId,
    newFile,
    { sessionId = null, displayName = null, shareToken = null, password = null } = {}
  ) => {
    const sid = sessionId || getSessionId();
    const headers = {
      ...buildHeaders({ shareToken, password }),
      'Content-Type': 'multipart/form-data'
    };
    const formData = new FormData();
    formData.append('file', newFile);
    formData.append('sessionId', sid);
    if (displayName) formData.append('displayName', displayName);
    if (shareToken) formData.append('shareToken', shareToken);
    if (password) formData.append('password', password);

    return await axiosClient.post(`/collab/${fileId}/replace-file`, formData, { headers });
  }
};

export default collabService;

