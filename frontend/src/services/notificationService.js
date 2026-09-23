import axiosClient from '../api/axiosClient';

const notificationService = {
  /**
   * Lấy danh sách thông báo của người dùng
   */
  getNotifications: async (params = {}) => {
    return await axiosClient.get('/notifications', { params });
  },

  /**
   * Đánh dấu 1 thông báo là đã đọc
   */
  markAsRead: async (id) => {
    return await axiosClient.patch(`/notifications/${id}/read`);
  },

  /**
   * Đánh dấu toàn bộ thông báo là đã đọc
   */
  markAllAsRead: async () => {
    return await axiosClient.patch('/notifications/read-all');
  }
};

export default notificationService;
