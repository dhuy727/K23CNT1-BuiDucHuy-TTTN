const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { verifyAuth } = require('../middlewares/auth.middleware');
const {
  validateRegister,
  validateLogin,
  validateRefreshToken
} = require('../middlewares/validate.middleware');

/**
 * @route   POST /api/auth/register
 * @desc    Đăng ký tài khoản người dùng mới
 * @access  Public
 */
router.post('/register', validateRegister, authController.register);

/**
 * @route   POST /api/auth/login
 * @desc    Đăng nhập lấy secretToken (ngắn hạn) & refreshToken (dài hạn)
 * @access  Public
 */
router.post('/login', validateLogin, authController.login);

/**
 * @route   POST /api/auth/refresh-token
 * @desc    Làm mới secretToken bằng refreshToken
 * @access  Public
 */
router.post('/refresh-token', validateRefreshToken, authController.refreshToken);

/**
 * @route   POST /api/auth/logout
 * @desc    Đăng xuất, thu hồi refreshToken trong database
 * @access  Private (Yêu cầu secretToken)
 */
router.post('/logout', verifyAuth, authController.logout);

/**
 * @route   GET /api/auth/me (hoặc /api/auth/profile)
 * @desc    Lấy thông tin tài khoản hiện tại
 * @access  Private (Yêu cầu secretToken)
 */
router.get('/me', verifyAuth, authController.getMe);
router.get('/profile', verifyAuth, authController.getMe);

/**
 * @route   PUT /api/auth/profile (hoặc PATCH)
 * @desc    Cập nhật thông tin cá nhân của người dùng hiện tại
 * @access  Private (Yêu cầu secretToken)
 */
router.put('/profile', verifyAuth, authController.updateProfile);
router.patch('/profile', verifyAuth, authController.updateProfile);

/**
 * @route   PATCH /api/auth/change-password (hoặc PUT)
 * @desc    Đổi mật khẩu người dùng hiện tại
 * @access  Private (Yêu cầu secretToken)
 */
router.patch('/change-password', verifyAuth, authController.changePassword);
router.put('/change-password', verifyAuth, authController.changePassword);

module.exports = router;

