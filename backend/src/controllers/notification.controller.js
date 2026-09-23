const notificationService = require('../services/notification.service');
const { sendSuccess } = require('../utils/apiResponse');

/**
 * Lấy danh sách thông báo của người dùng hiện tại
 */
const getNotifications = async (req, res, next) => {
  try {
    const { notifications, unreadCount, pagination } = await notificationService.getNotifications(
      req.user._id,
      req.query
    );

    return sendSuccess(res, {
      message: 'Lấy danh sách thông báo thành công',
      data: {
        notifications,
        unreadCount
      },
      metadata: pagination
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Đánh dấu một thông báo là đã đọc
 */
const markAsRead = async (req, res, next) => {
  try {
    const result = await notificationService.markAsRead(req.user._id, req.params.id);
    return sendSuccess(res, {
      message: 'Đã đánh dấu thông báo là đã đọc',
      data: result
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Đánh dấu tất cả thông báo là đã đọc
 */
const markAllAsRead = async (req, res, next) => {
  try {
    const result = await notificationService.markAllAsRead(req.user._id);
    return sendSuccess(res, {
      message: 'Đã đánh dấu tất cả thông báo là đã đọc',
      data: result
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getNotifications,
  markAsRead,
  markAllAsRead
};
