const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { verifyAuth } = require('../middlewares/auth.middleware');
const {
  validateRegister,
  validateLogin,
  validateRefreshToken,
  validateToken,
  validateVerificationCode,
  validateForgotPassword,
  validateResetPassword
} = require('../middlewares/validate.middleware');

/**
 * @swagger
 * /auth/register:
 *   post:
 *     summary: Đăng ký tài khoản mới
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email, password]
 *             properties:
 *               name:
 *                 type: string
 *                 example: Bùi Đức Huy
 *               email:
 *                 type: string
 *                 format: email
 *                 example: huy@example.com
 *               password:
 *                 type: string
 *                 minLength: 6
 *                 example: password123
 *               role:
 *                 type: string
 *                 enum: [user, admin]
 *                 example: user
 *               phone:
 *                 type: string
 *                 example: "0988888888"
 *     responses:
 *       201:
 *         description: Đăng ký thành công, trả về tokens
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/AuthTokens'
 *       400:
 *         description: Dữ liệu đầu vào không hợp lệ
 *       409:
 *         description: Email đã được sử dụng
 */
router.post('/register', validateRegister, authController.register);
router.post('/verify-email', validateVerificationCode, authController.verifyEmail);
router.post('/resend-verification-code', validateForgotPassword, authController.resendVerificationCode);

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Đăng nhập lấy JWT tokens (secretToken + refreshToken)
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: huy@example.com
 *               password:
 *                 type: string
 *                 example: password123
 *     responses:
 *       200:
 *         description: Đăng nhập thành công
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/AuthTokens'
 *       401:
 *         description: Sai email hoặc mật khẩu
 */
router.post('/login', validateLogin, authController.login);

/**
 * @swagger
 * /auth/refresh-token:
 *   post:
 *     summary: Làm mới secretToken bằng refreshToken
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [refreshToken]
 *             properties:
 *               refreshToken:
 *                 type: string
 *                 example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *     responses:
 *       200:
 *         description: Cấp lại secretToken mới thành công
 *       401:
 *         description: refreshToken không hợp lệ hoặc đã hết hạn
 */
router.post('/refresh-token', validateRefreshToken, authController.refreshToken);
router.post('/forgot-password', validateForgotPassword, authController.forgotPassword);
router.post('/verify-forgot-password', validateToken(), authController.verifyForgotPassword);
router.post('/reset-password', validateResetPassword, authController.resetPassword);

/**
 * @swagger
 * /auth/logout:
 *   post:
 *     summary: Đăng xuất, vô hiệu hóa refreshToken
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [refreshToken]
 *             properties:
 *               refreshToken:
 *                 type: string
 *     responses:
 *       200:
 *         description: Đăng xuất thành công
 *       401:
 *         description: Token không hợp lệ
 */
router.post('/logout', verifyAuth, authController.logout);
router.post('/signout', verifyAuth, authController.logout);

/**
 * @swagger
 * /auth/me:
 *   get:
 *     summary: Lấy thông tin người dùng đang đăng nhập
 *     tags: [Auth]
 *     responses:
 *       200:
 *         description: Thông tin tài khoản hiện tại
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/User'
 *       401:
 *         description: Chưa đăng nhập
 */
router.get('/me', verifyAuth, authController.getMe);
router.get('/profile', verifyAuth, authController.getMe);

/**
 * @swagger
 * /auth/profile:
 *   patch:
 *     summary: Cập nhật thông tin cá nhân (name, phone, email)
 *     tags: [Auth]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               phone:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *     responses:
 *       200:
 *         description: Cập nhật thành công
 */
router.put('/profile', verifyAuth, authController.updateProfile);
router.patch('/profile', verifyAuth, authController.updateProfile);

/**
 * @swagger
 * /auth/change-password:
 *   patch:
 *     summary: Đổi mật khẩu tài khoản hiện tại
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [currentPassword, newPassword]
 *             properties:
 *               currentPassword:
 *                 type: string
 *                 example: password123
 *               newPassword:
 *                 type: string
 *                 minLength: 6
 *                 example: newpassword456
 *     responses:
 *       200:
 *         description: Đổi mật khẩu thành công
 *       400:
 *         description: Mật khẩu hiện tại không đúng
 */
router.patch('/change-password', verifyAuth, authController.changePassword);
router.put('/change-password', verifyAuth, authController.changePassword);

module.exports = router;
