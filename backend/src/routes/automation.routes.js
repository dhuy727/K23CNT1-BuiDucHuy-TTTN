const express = require('express');
const router = express.Router();
const automationController = require('../controllers/automation.controller');
const { verifyAuth } = require('../middlewares/auth.middleware');
const { validateObjectId } = require('../middlewares/validate.middleware');

// Toàn bộ các route tự động hóa đều yêu cầu đăng nhập
router.use(verifyAuth);

/**
 * @route   GET /api/automations
 * @desc    Lấy danh sách quy tắc tự động hóa của người dùng
 * @access  Private
 */
router.get('/', automationController.getRules);

/**
 * @route   POST /api/automations
 * @desc    Tạo quy tắc tự động hóa mới
 * @access  Private
 */
router.post('/', automationController.createRule);

/**
 * @route   POST /api/automations/run-all
 * @desc    Áp dụng tất cả quy tắc đang hoạt động lên các tệp hiện tại
 * @access  Private
 */
router.post('/run-all', automationController.runAllRules);

/**
 * @route   GET /api/automations/:id
 * @desc    Lấy chi tiết một quy tắc tự động hóa
 * @access  Private
 */
router.get('/:id', validateObjectId('id'), automationController.getRuleById);

/**
 * @route   PATCH /api/automations/:id/toggle
 * @desc    Bật / tắt kích hoạt quy tắc
 * @access  Private
 */
router.patch('/:id/toggle', validateObjectId('id'), automationController.toggleRule);

/**
 * @route   PATCH /api/automations/:id
 * @desc    Cập nhật quy tắc tự động hóa
 * @access  Private
 */
router.patch('/:id', validateObjectId('id'), automationController.updateRule);

/**
 * @route   DELETE /api/automations/:id
 * @desc    Xóa một quy tắc tự động hóa
 * @access  Private
 */
router.delete('/:id', validateObjectId('id'), automationController.deleteRule);

module.exports = router;
