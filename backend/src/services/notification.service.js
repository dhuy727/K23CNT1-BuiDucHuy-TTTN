const mongoose = require('mongoose');
const Notification = require('../models/notification.model');
const File = require('../models/file.model');
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
 * Khởi tạo thông báo mẫu nếu người dùng chưa có thông báo nào
 */
const seedSampleNotificationsIfEmpty = async (userId) => {
  const count = await Notification.countDocuments({ user: userId });
  if (count > 0) return false;

  const now = Date.now();
  const sampleData = [
    {
      user: userId,
      title: 'AI đã phân tích xong',
      message: 'Tệp "Bao_cao_tai_chinh_Q3.pdf" đã hoàn tất phân tích nội dung, trích xuất danh mục "Tài chính" với độ tin cậy 96%.',
      type: 'ai',
      isRead: false,
      createdAt: new Date(now - 3 * 60 * 1000) // 3 phút trước
    },
    {
      user: userId,
      title: 'Auto đã chạy quy tắc tự động hóa',
      message: 'Đã thực thi quy tắc "Tự động phân loại tài liệu mới" thành công cho các tệp tải lên.',
      type: 'automation',
      isRead: false,
      createdAt: new Date(now - 5 * 60 * 1000) // 5 phút trước
    },
    {
      user: userId,
      title: 'Tệp đã chuyển vào thư mục',
      message: 'Tệp "Hop_dong_dich_vu_2024.docx" đã được tự động chuyển vào thư mục "Hợp đồng & Pháp lý".',
      type: 'automation',
      isRead: false,
      createdAt: new Date(now - 12 * 60 * 1000) // 12 phút trước
    }
  ];

  try {
    await Notification.insertMany(sampleData);
    return true;
  } catch (err) {
    console.warn('[Notification] Không thể tạo thông báo mẫu:', err.message);
    return false;
  }
};

/**
 * Lấy danh sách thông báo của người dùng (mặc định 10 thông báo mới nhất)
 */
const getNotifications = async (userId, query = {}) => {
  // Tự động kiểm tra và tạo dữ liệu mẫu nếu người dùng chưa có thông báo
  await seedSampleNotificationsIfEmpty(userId);

  const limit = Math.min(50, Math.max(1, parseInt(query.limit, 10) || 10));
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const skip = (page - 1) * limit;

  const filter = { user: userId };
  if (query.unreadOnly === 'true') {
    filter.isRead = false;
  }

  const [notifications, total, unreadCount] = await Promise.all([
    Notification.find(filter)
      .populate('file', '_id name extension mimeType folder')
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
  ).populate('file', '_id name extension mimeType folder');

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
