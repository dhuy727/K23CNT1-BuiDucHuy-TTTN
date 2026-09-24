import axiosClient from '../api/axiosClient';

const automationService = {
  /**
   * Lấy danh sách các quy tắc tự động hóa của user
   */
  getRules: async () => {
    return await axiosClient.get('/automations');
  },

  /**
   * Lấy chi tiết 1 quy tắc
   */
  getRuleById: async (id) => {
    return await axiosClient.get(`/automations/${id}`);
  },

  /**
   * Tạo mới một quy tắc
   */
  createRule: async (data) => {
    return await axiosClient.post('/automations', data);
  },

  /**
   * Cập nhật quy tắc
   */
  updateRule: async (id, data) => {
    return await axiosClient.patch(`/automations/${id}`, data);
  },

  /**
   * Xóa một quy tắc
   */
  deleteRule: async (id) => {
    return await axiosClient.delete(`/automations/${id}`);
  },

  /**
   * Bật / tắt kích hoạt quy tắc
   */
  toggleRule: async (id) => {
    return await axiosClient.patch(`/automations/${id}/toggle`);
  },

  /**
   * Áp dụng toàn bộ quy tắc đang kích hoạt lên tất cả các tệp hiện tại
   */
  runAllRules: async () => {
    return await axiosClient.post('/automations/run-all');
  }
};

export default automationService;
