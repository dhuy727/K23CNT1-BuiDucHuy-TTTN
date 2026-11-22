import axiosClient from '../api/axiosClient';

const folderService = {
  getFolderTree: async () => {
    return await axiosClient.get('/folders/tree');
  },

  getFolders: async (params = {}) => {
    return await axiosClient.get('/folders', { params });
  },

  getFolderById: async (folderId) => {
    return await axiosClient.get(`/folders/${folderId}`);
  },

  createFolder: async (data) => {
    return await axiosClient.post('/folders', data);
  },

  renameFolder: async (folderId, name) => {
    return await axiosClient.patch(`/folders/${folderId}/rename`, { name });
  },

  moveFolder: async (folderId, targetParentId) => {
    return await axiosClient.patch(`/folders/${folderId}/move`, { targetParentId });
  },

  deleteFolder: async (folderId, permanent = false) => {
    return await axiosClient.delete(`/folders/${folderId}`, {
      params: permanent ? { permanent: 'true' } : {}
    });
  },

  getFolderFiles: async (folderId, params = {}) => {
    return await axiosClient.get(`/folders/${folderId}/files`, { params });
  },

  getTrashFolders: async () => {
    return await axiosClient.get('/folders/trash');
  },

  restoreFolder: async (folderId) => {
    return await axiosClient.patch(`/folders/${folderId}/restore`);
  },

  ensureFolderPath: async (baseFolderId, relativeDirPath) => {
    return await axiosClient.post('/folders/ensure-path', { baseFolderId, relativeDirPath });
  },

  togglePinFolder: async (folderId) => {
    return await axiosClient.patch(`/folders/${folderId}/pin`);
  }
};

export default folderService;
