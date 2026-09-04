const express = require('express');
const router = express.Router();
const userController = require('../controllers/user.controller');
const { verifyAuth, authorize } = require('../middlewares/auth.middleware');
const { validateObjectId } = require('../middlewares/validate.middleware');

// Áp dụng middleware xác thực token (secretToken) cho toàn bộ user routes
router.use(verifyAuth);

// ==========================================
// 1. CÁC API DÀNH CHO NGƯỜI DÙNG HIỆN TẠI
// (Định nghĩa trước /:id để tránh trùng khớp route)
// ==========================================

/**
 * @route   GET /api/users/profile (hoặc /api/users/me)
 * @desc    Lấy thông tin cá nhân của người dùng hiện tại
 * @access  Private
 */
router.get('/profile', userController.getProfile);
router.get('/me', userController.getProfile);

/**
 * @route   PUT /api/users/profile (hoặc PATCH /api/users/profile)
 * @desc    Sửa thông tin cá nhân người dùng hiện tại (tên, số điện thoại, email)
 * @access  Private
 */
router.put('/profile', userController.updateProfile);
router.patch('/profile', userController.updateProfile);

/**
 * @route   PATCH /api/users/change-password (hoặc PUT /api/users/change-password)
 * @desc    Đổi mật khẩu người dùng hiện tại
 * @access  Private
 */
router.patch('/change-password', userController.changePassword);
router.put('/change-password', userController.changePassword);

/**
 * @route   POST /api/users/logout
 * @desc    Đăng xuất (thu hồi refreshToken)
 * @access  Private
 */
router.post('/logout', userController.logout);

// ==========================================
// 2. CÁC API QUẢN TRỊ & THAO TÁC THEO ID
// ==========================================

/**
 * @route   GET /api/users
 * @desc    Lấy danh sách người dùng (hỗ trợ phân trang, tìm kiếm)
 * @access  Private (Chỉ dành cho Admin & Manager)
 */
router.get('/', authorize('admin', 'manager'), userController.getUsers);

/**
 * @route   GET /api/users/:id
 * @desc    Lấy chi tiết thông tin người dùng theo ID
 * @access  Private
 */
router.get('/:id', validateObjectId('id'), userController.getUser);

/**
 * @route   PUT /api/users/:id
 * @desc    Cập nhật thông tin người dùng theo ID
 * @access  Private (Chính chủ hoặc Admin)
 */
router.put('/:id', validateObjectId('id'), userController.updateUser);

/**
 * @route   DELETE /api/users/:id
 * @desc    Xóa người dùng khỏi hệ thống
 * @access  Private (Chỉ dành cho Admin)
 */
router.delete('/:id', authorize('admin'), validateObjectId('id'), userController.deleteUser);

module.exports = router;

