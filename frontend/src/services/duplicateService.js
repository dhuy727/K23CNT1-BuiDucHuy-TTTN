import axiosClient from '../api/axiosClient';

const duplicateService = {
  getScanStatus: async (folderId = null) => {
    return await axiosClient.get('/duplicates/scan-status', {
      params: folderId ? { folderId } : {}
    });
  },

  startScan: async (folderId = null) => {
    return await axiosClient.post('/duplicates/start-scan', { folderId });
  },

  getLargeFiles: async (params = {}) => {
    return await axiosClient.get('/duplicates/large-files', { params });
  },

  cleanFiles: async (fileIds = []) => {
    return await axiosClient.post('/duplicates/clean', { fileIds });
  },

  ignorePair: async (fileAId, fileBId) => {
    return await axiosClient.post('/duplicates/ignore-pair', { fileAId, fileBId });
  },

  getCompareDetail: async (fileAId, fileBId) => {
    return await axiosClient.get('/duplicates/compare-detail', {
      params: { fileAId, fileBId }
    });
  }
};

export default duplicateService;
