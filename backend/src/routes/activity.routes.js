const express = require('express');
const router = express.Router();
const activityController = require('../controllers/activity.controller');
const { verifyAuth, authorize } = require('../middlewares/auth.middleware');

// Toàn bộ API lịch sử đều yêu cầu đăng nhập
router.use(verifyAuth);

/**
 * @route   GET /api/activities/me
 * @desc    Lấy lịch sử thao tác của người dùng hiện tại
 * @access  Private
 */
router.get('/me', activityController.getMyActivities);

/**
 * @route   GET /api/activities/system
 * @desc    Lấy nhật ký kiểm toán toàn hệ thống (Admin only)
 * @access  Private/Admin
 */
router.get('/system', authorize('admin'), activityController.getSystemActivities);

module.exports = router;
