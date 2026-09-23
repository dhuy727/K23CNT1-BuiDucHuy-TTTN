const mongoose = require('mongoose');
const Notification = require('../models/notification.model');
const ApiError = require('../utils/apiError');

/**
 * Tạo mới một thông báo
 */
const createNotification = async ({ user, file = null, title, message, type = 'info' }) => {
  if (!user || !title || !message) {
    return null;
  }

  try {
    const notification = new Notification({
      user,
      file,
      title: String(title).trim(),
      message: String(message).trim(),
      type
    });
    return await notification.save();
  } catch (err) {
    console.error('[Notification] Lỗi khi tạo thông báo:', err.message);
    return null;
  }
};

/**
 * Lấy danh sách thông báo của người dùng (mặc định 10 thông báo mới nhất)
 */
const getNotifications = async (userId, query = {}) => {
  const limit = Math.min(50, Math.max(1, parseInt(query.limit, 10) || 10));
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const skip = (page - 1) * limit;

  const filter = { user: userId };
  if (query.unreadOnly === 'true') {
    filter.isRead = false;
  }

  const [notifications, total, unreadCount] = await Promise.all([
    Notification.find(filter)
      .populate('file', '_id name extension mimeType')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Notification.countDocuments(filter),
    Notification.countDocuments({ user: userId, isRead: false })
  ]);

  return {
    notifications,
    unreadCount,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    }
  };
};

/**
 * Đánh dấu một thông báo là đã đọc
 */
const markAsRead = async (userId, notificationId) => {
  if (!mongoose.Types.ObjectId.isValid(notificationId)) {
    throw new ApiError(400, 'ID thông báo không hợp lệ');
  }

  const notification = await Notification.findOneAndUpdate(
    { _id: notificationId, user: userId },
    { isRead: true },
    { new: true }
  ).populate('file', '_id name extension mimeType');

  if (!notification) {
    throw new ApiError(404, 'Không tìm thấy thông báo');
  }

  const unreadCount = await Notification.countDocuments({ user: userId, isRead: false });

  return {
    notification,
    unreadCount
  };
};

/**
 * Đánh dấu toàn bộ thông báo của người dùng là đã đọc
 */
const markAllAsRead = async (userId) => {
  const result = await Notification.updateMany(
    { user: userId, isRead: false },
    { isRead: true }
  );

  return {
    modifiedCount: result.modifiedCount,
    unreadCount: 0
  };
};

module.exports = {
  createNotification,
  getNotifications,
  markAsRead,
  markAllAsRead
};
