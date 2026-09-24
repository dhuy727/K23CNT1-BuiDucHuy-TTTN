import axiosClient from '../api/axiosClient';

const fileService = {
  getFiles: async (params = {}) => {
    return await axiosClient.get('/files', { params });
  },

  getFileById: async (fileId) => {
    return await axiosClient.get(`/files/${fileId}`);
  },

  uploadFile: async (formData, onUploadProgress) => {
    return await axiosClient.post('/files/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      },
      onUploadProgress
    });
  },

  uploadMultipleFiles: async (formData, onUploadProgress) => {
    return await axiosClient.post('/files/upload-multiple', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      },
      onUploadProgress
    });
  },

  renameFile: async (fileId, name) => {
    return await axiosClient.patch(`/files/${fileId}/rename`, { name });
  },

  moveFile: async (fileId, targetFolderId) => {
    return await axiosClient.patch(`/files/${fileId}/move`, { targetFolderId });
  },

  copyFile: async (fileId, targetFolderId) => {
    return await axiosClient.post(`/files/${fileId}/copy`, { targetFolderId });
  },

  toggleStar: async (fileId) => {
    return await axiosClient.patch(`/files/${fileId}/star`);
  },

  deleteFile: async (fileId, permanent = false) => {
    return await axiosClient.delete(`/files/${fileId}`, {
      params: permanent ? { permanent: 'true' } : {}
    });
  },

  getTrashFiles: async (params = {}) => {
    return await axiosClient.get('/files/trash', { params });
  },

  restoreFile: async (fileId) => {
    return await axiosClient.patch(`/files/${fileId}/restore`);
  },

  emptyTrash: async () => {
    return await axiosClient.delete('/files/trash/empty');
  },

  // Tải xuống file dưới dạng Blob có kèm Bearer token
  downloadFileBlob: async (fileId) => {
    const response = await axiosClient.get(`/files/${fileId}/download`, {
      responseType: 'blob'
    });
    return response.data;
  },

  // Xem trước file dưới dạng Blob có kèm Bearer token
  previewFileBlob: async (fileId) => {
    const response = await axiosClient.get(`/files/${fileId}/preview`, {
      responseType: 'blob'
    });
    return response.data;
  },

  // Lấy file gần đây (tải lên gần đây, sắp xếp theo ngày)
  getRecentFiles: async (params = {}) => {
    return await axiosClient.get('/files', {
      params: {
        sortBy: 'createdAt',
        sortOrder: 'desc',
        limit: 20,
        folderId: 'root',
        ...params
      }
    });
  },

  // Lấy thống kê dung lượng thực tế của người dùng (Giới hạn 10GB)
  getStorageStats: async () => {
    return await axiosClient.get('/files/storage-stats');
  },

  // Định dạng kích thước tệp tin
  formatFileSize: (bytes) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
};

export default fileService;

