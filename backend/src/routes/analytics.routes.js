const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/analytics.controller');
const { verifyAuth, authorize } = require('../middlewares/auth.middleware');

// Toàn bộ API thống kê đều yêu cầu đăng nhập
router.use(verifyAuth);

/**
 * @route   GET /api/analytics/me
 * @desc    Lấy thống kê dung lượng & tài liệu của người dùng hiện tại
 * @access  Private
 */
router.get('/me', analyticsController.getMyAnalytics);

/**
 * @route   GET /api/analytics/system
 * @desc    Lấy thống kê toàn cảnh hệ thống (Admin only)
 * @access  Private/Admin
 */
router.get('/system', authorize('admin'), analyticsController.getSystemAnalytics);

module.exports = router;
