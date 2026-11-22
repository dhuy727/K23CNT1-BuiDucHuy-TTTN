import axiosClient from '../api/axiosClient';

const activityService = {
  /**
   * Lấy lịch sử thao tác của người dùng hiện tại
   * @param {Object} params - { action, actionGroup, timeRange, startDate, endDate, search, page, limit }
   */
  getMyActivities: async (params = {}) => {
    return await axiosClient.get('/activities/me', { params });
  },

  /**
   * Lấy nhật ký kiểm toán toàn hệ thống (Dành cho Quản trị viên)
   * @param {Object} params - { filterUserId, action, actionGroup, timeRange, startDate, endDate, search, page, limit }
   */
  getSystemActivities: async (params = {}) => {
    return await axiosClient.get('/activities/system', { params });
  }
};

export default activityService;
