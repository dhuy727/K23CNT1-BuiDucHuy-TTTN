const express = require('express');
const router = express.Router();
const duplicateController = require('../controllers/duplicate.controller');
const { verifyAuth } = require('../middlewares/auth.middleware');

// Toàn bộ các thao tác quét và dọn dẹp đều yêu cầu đăng nhập
router.use(verifyAuth);

/**
 * @route   GET /api/duplicates/scan-status
 * @desc    Lấy trạng thái phiên quét hoặc kết quả đã cache
 * @access  Private
 */
router.get('/scan-status', duplicateController.getScanStatus);

/**
 * @route   POST /api/duplicates/start-scan
 * @desc    Bắt đầu quét trùng lặp 100% (SHA-256) và tương đồng AI
 * @access  Private
 */
router.post('/start-scan', duplicateController.startScan);

/**
 * @route   GET /api/duplicates/large-files
 * @desc    Lấy danh sách các tệp tin dung lượng lớn (< 500MB hoặc theo ngưỡng)
 * @access  Private
 */
router.get('/large-files', duplicateController.getLargeFiles);

/**
 * @route   POST /api/duplicates/clean
 * @desc    Dọn dẹp (chuyển vào thùng rác) các tệp tin đã chọn
 * @access  Private
 */
router.post('/clean', duplicateController.cleanFiles);

/**
 * @route   POST /api/duplicates/ignore-pair
 * @desc    Đánh dấu bỏ qua không coi là trùng lặp giữa 2 tệp
 * @access  Private
 */
router.post('/ignore-pair', duplicateController.ignorePair);

/**
 * @route   GET /api/duplicates/compare-detail
 * @desc    Lấy dữ liệu so sánh chi tiết giữa 2 tệp tin
 * @access  Private
 */
router.get('/compare-detail', duplicateController.getCompareDetail);

module.exports = router;
