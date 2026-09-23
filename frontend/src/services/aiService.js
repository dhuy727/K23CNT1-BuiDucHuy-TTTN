import axiosClient from '../api/axiosClient';

const aiService = {
  /**
   * Chạy lại tiến trình phân tích AI cho file
   */
  processFile: async (fileId) => {
    return await axiosClient.post(`/files/${fileId}/ai/process`);
  },

  /**
   * Chấp nhận tên file đề xuất từ AI
   */
  acceptName: async (fileId) => {
    return await axiosClient.post(`/files/${fileId}/ai/accept-name`);
  },

  /**
   * Chấp nhận di chuyển file vào thư mục đề xuất từ AI
   */
  acceptFolder: async (fileId) => {
    return await axiosClient.post(`/files/${fileId}/ai/accept-folder`);
  },

  /**
   * Bỏ qua / xóa các gợi ý đề xuất từ AI
   */
  dismissSuggestions: async (fileId) => {
    return await axiosClient.post(`/files/${fileId}/ai/dismiss-suggestions`);
  }
};

export default aiService;
