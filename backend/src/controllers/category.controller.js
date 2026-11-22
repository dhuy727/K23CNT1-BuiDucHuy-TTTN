const categoryService = require('../services/category.service');
const { sendSuccess, sendCreated } = require('../utils/apiResponse');

/**
 * Lấy danh sách danh mục của người dùng
 * GET /api/categories
 */
const getCategories = async (req, res, next) => {
  try {
    const categories = await categoryService.getCategories(req.user._id);
    return sendSuccess(res, {
      message: 'Lấy danh sách danh mục thành công',
      data: categories
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Tạo danh mục mới
 * POST /api/categories
 */
const createCategory = async (req, res, next) => {
  try {
    const category = await categoryService.createCategory(req.user._id, req.body);
    return sendCreated(res, {
      message: 'Tạo danh mục mới thành công',
      data: category
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Cập nhật danh mục
 * PUT /api/categories/:id
 */
const updateCategory = async (req, res, next) => {
  try {
    const category = await categoryService.updateCategory(req.user._id, req.params.id, req.body);
    return sendSuccess(res, {
      message: 'Cập nhật danh mục thành công',
      data: category
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Xóa danh mục
 * DELETE /api/categories/:id
 */
const deleteCategory = async (req, res, next) => {
  try {
    const result = await categoryService.deleteCategory(req.user._id, req.params.id);
    return sendSuccess(res, {
      message: result.message,
      data: null
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Gán danh mục cho tệp tin
 * PATCH /api/categories/assign/:fileId
 */
const assignFileCategory = async (req, res, next) => {
  try {
    const file = await categoryService.assignFileCategory(
      req.user._id,
      req.params.fileId,
      req.body.categoryName,
      { ip: req.ip, userAgent: req.headers['user-agent'] }
    );
    return sendSuccess(res, {
      message: `Đã chuyển danh mục sang "${file.aiCategory}"`,
      data: file
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  assignFileCategory
};
