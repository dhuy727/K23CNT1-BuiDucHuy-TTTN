import axiosClient from '../api/axiosClient';

const versionService = {
  getVersions: async (fileId, params = {}) => {
    return await axiosClient.get(`/files/${fileId}/versions`, { params });
  },

  createVersion: async (fileId, data = {}) => {
    return await axiosClient.post(`/files/${fileId}/versions`, data);
  },

  getVersionById: async (fileId, versionId) => {
    return await axiosClient.get(`/files/${fileId}/versions/${versionId}`);
  },

  downloadVersionBlob: async (fileId, versionId) => {
    const response = await axiosClient.get(`/files/${fileId}/versions/${versionId}/download`, {
      responseType: 'blob'
    });
    return response.data;
  },

  restoreVersion: async (fileId, versionId) => {
    return await axiosClient.post(`/files/${fileId}/versions/${versionId}/restore`);
  },

  deleteVersion: async (fileId, versionId) => {
    return await axiosClient.delete(`/files/${fileId}/versions/${versionId}`);
  }
};

export default versionService;
