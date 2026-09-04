const express = require('express');
const router = express.Router();
const searchController = require('../controllers/search.controller');
const { verifyAuth } = require('../middlewares/auth.middleware');

// Toàn bộ các thao tác tìm kiếm & lọc đều yêu cầu đăng nhập
router.use(verifyAuth);

/**
 * @route   GET /api/search/suggestions
 * @desc    Gợi ý tìm kiếm nhanh (Autocomplete cho thanh Search Bar)
 * @access  Private
 */
router.get('/suggestions', searchController.getSuggestions);

/**
 * @route   GET /api/search/filters-metadata
 * @desc    Lấy metadata hỗ trợ bộ lọc giao diện (Danh mục AI, Thẻ Tags, Định dạng, Khoảng kích thước & thời gian)
 * @access  Private
 */
router.get('/filters-metadata', searchController.getFiltersMetadata);

/**
 * @route   GET /api/search
 * @desc    Tìm kiếm và lọc đa tiêu chí tổng hợp cho Files & Folders
 * @access  Private
 */
router.get('/', searchController.search);

module.exports = router;
