const express = require('express');
const router = express.Router();
const categoryController = require('../controllers/category.controller');
const { verifyAuth } = require('../middlewares/auth.middleware');
const { validateObjectId } = require('../middlewares/validate.middleware');

// Toàn bộ các API danh mục yêu cầu đăng nhập
router.use(verifyAuth);

/**
 * @route   GET /api/categories
 * @desc    Lấy danh sách danh mục
 * @access  Private
 */
router.get('/', categoryController.getCategories);

/**
 * @route   POST /api/categories
 * @desc    Tạo danh mục mới
 * @access  Private
 */
router.post('/', categoryController.createCategory);

/**
 * @route   PUT /api/categories/:id
 * @desc    Cập nhật danh mục
 * @access  Private
 */
router.put('/:id', validateObjectId('id'), categoryController.updateCategory);

/**
 * @route   DELETE /api/categories/:id
 * @desc    Xóa danh mục
 * @access  Private
 */
router.delete('/:id', validateObjectId('id'), categoryController.deleteCategory);

/**
 * @route   PATCH /api/categories/assign/:fileId
 * @desc    Gán danh mục cho tệp tin
 * @access  Private
 */
router.patch('/assign/:fileId', validateObjectId('fileId'), categoryController.assignFileCategory);

module.exports = router;
