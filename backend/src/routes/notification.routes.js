const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notification.controller');
const { verifyAuth } = require('../middlewares/auth.middleware');
const { validateObjectId } = require('../middlewares/validate.middleware');

// Toàn bộ các route thông báo đều yêu cầu đăng nhập
router.use(verifyAuth);

/**
 * @route   GET /api/notifications
 * @desc    Lấy danh sách thông báo của người dùng
 * @access  Private
 */
router.get('/', notificationController.getNotifications);

/**
 * @route   PATCH /api/notifications/read-all
 * @desc    Đánh dấu toàn bộ thông báo là đã đọc
 * @access  Private
 */
router.patch('/read-all', notificationController.markAllAsRead);

/**
 * @route   PATCH /api/notifications/:id/read
 * @desc    Đánh dấu một thông báo là đã đọc
 * @access  Private
 */
router.patch('/:id/read', validateObjectId('id'), notificationController.markAsRead);

module.exports = router;
