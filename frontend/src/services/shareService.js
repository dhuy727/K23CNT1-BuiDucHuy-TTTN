import axiosClient from '../api/axiosClient';

const shareService = {
  getSharedWithMe: async (params = {}) => {
    return await axiosClient.get('/shares/shared-with-me', { params });
  },

  getSharedByMe: async (params = {}) => {
    return await axiosClient.get('/shares/shared-by-me', { params });
  },

  shareWithUser: async (data) => {
    return await axiosClient.post('/shares', data);
  },

  updateCollaboratorRole: async (shareId, role) => {
    return await axiosClient.patch(`/shares/${shareId}/role`, { role });
  },

  removeCollaborator: async (shareId) => {
    return await axiosClient.delete(`/shares/${shareId}`);
  },

  createOrUpdatePublicLink: async (data) => {
    return await axiosClient.post('/shares/public-link', data);
  },

  revokePublicLink: async (itemType, itemId) => {
    return await axiosClient.delete(`/shares/public-link/${itemType}/${itemId}`);
  },

  getItemShares: async (itemType, itemId) => {
    return await axiosClient.get(`/shares/item/${itemType}/${itemId}`);
  },

  // Public APIs (không bắt buộc đăng nhập)
  getPublicItem: async (shareToken, password = null, params = {}) => {
    const headers = {};
    if (password) {
      headers['x-share-password'] = password;
    }
    return await axiosClient.get(`/shares/public/${shareToken}`, { headers, params });
  },

  getPublicFileDownload: async (shareToken, password = null, fileId = null) => {
    const headers = {};
    if (password) {
      headers['x-share-password'] = password;
    }
    const params = fileId ? { fileId } : {};
    const response = await axiosClient.get(`/shares/public/${shareToken}/download`, {
      headers,
      params,
      responseType: 'blob'
    });
    return response.data;
  },

  getPublicFilePreview: async (shareToken, password = null, fileId = null) => {
    const headers = {};
    if (password) {
      headers['x-share-password'] = password;
    }
    const params = fileId ? { fileId } : {};
    const response = await axiosClient.get(`/shares/public/${shareToken}/preview`, {
      headers,
      params,
      responseType: 'blob'
    });
    return response.data;
  }
};

export default shareService;
