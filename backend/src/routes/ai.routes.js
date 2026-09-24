const express = require('express');
const router = express.Router({ mergeParams: true });
const aiController = require('../controllers/ai.controller');

/**
 * @route   POST /api/files/:id/ai/process
 * @desc    Chạy lại phân tích AI cho file (dành cho chủ sở hữu)
 * @access  Private
 */
router.post('/process', aiController.processFile);

/**
 * @route   POST /api/files/:id/ai/accept-name
 * @desc    Chấp nhận tên đề xuất từ AI
 * @access  Private
 */
router.post('/accept-name', aiController.acceptName);

/**
 * @route   POST /api/files/:id/ai/accept-folder
 * @desc    Chấp nhận di chuyển vào thư mục đề xuất từ AI
 * @access  Private
 */
router.post('/accept-folder', aiController.acceptFolder);

/**
 * @route   POST /api/files/:id/ai/dismiss-suggestions
 * @desc    Bỏ qua / xóa các gợi ý từ AI
 * @access  Private
 */
router.post('/dismiss-suggestions', aiController.dismissSuggestions);

module.exports = router;
