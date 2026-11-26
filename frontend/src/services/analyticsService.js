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
  },

  /**
   * Tải về tệp CSV thống kê (trả về Blob chuẩn)
   */
  exportCsv: async (scope = 'personal') => {
    const response = await axiosClient.get(`/analytics/export/csv?scope=${scope}`, {
      responseType: 'blob'
    });
    return response.data;
  },

  /**
   * Tải về tệp báo cáo Excel (.xlsx) định dạng chuẩn
   */
  exportExcel: async (scope = 'personal') => {
    const response = await axiosClient.get(`/analytics/export/excel?scope=${scope}`, {
      responseType: 'blob'
    });
    return response.data;
  }
};

export default analyticsService;
