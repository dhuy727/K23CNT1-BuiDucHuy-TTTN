import axiosClient from '../api/axiosClient';

const analyticsService = {
  /**
   * Lấy dữ liệu thống kê cá nhân của người dùng hiện tại
   */
  getMyAnalytics: async () => {
    return await axiosClient.get('/analytics/me');
  },

  /**
   * Lấy dữ liệu thống kê toàn hệ thống (Admin only)
   */
  getSystemAnalytics: async () => {
    return await axiosClient.get('/analytics/system');
  }
};

export default analyticsService;
