const express = require('express');
const router = express.Router();
const shareController = require('../controllers/share.controller');
const { verifyAuth } = require('../middlewares/auth.middleware');
const { validateObjectId } = require('../middlewares/validate.middleware');

// =======================================================
// 🌐 CÁC ROUTE CÔNG KHAI (PUBLIC ACCESS - Không cần token)
// =======================================================

/**
 * @route   GET /api/shares/public/:shareToken
 * @desc    Truy cập xem thông tin tệp/thư mục qua liên kết công khai
 * @access  Public
 */
router.get('/public/:shareToken', shareController.getPublicItem);

/**
 * @route   GET /api/shares/public/:shareToken/download
 * @desc    Tải tệp tin qua liên kết công khai
 * @access  Public
 */
router.get('/public/:shareToken/download', shareController.getPublicFileDownload);

/**
 * @route   GET /api/shares/public/:shareToken/preview
 * @desc    Xem trước tệp tin trực tiếp qua liên kết công khai
 * @access  Public
 */
router.get('/public/:shareToken/preview', shareController.getPublicFilePreview);

// =======================================================
// 🔒 CÁC ROUTE NỘI BỘ (Yêu cầu đăng nhập xác thực JWT)
// =======================================================
router.use(verifyAuth);

/**
 * @route   GET /api/shares/shared-with-me
 * @desc    Lấy danh sách các tài liệu & thư mục được chia sẻ với tôi
 * @access  Private
 */
router.get('/shared-with-me', shareController.getSharedWithMe);

/**
 * @route   GET /api/shares/shared-by-me
 * @desc    Lấy danh sách các tài liệu & thư mục do tôi chia sẻ
 * @access  Private
 */
router.get('/shared-by-me', shareController.getSharedByMe);

/**
 * @route   POST /api/shares
 * @desc    Chia sẻ tài liệu hoặc thư mục cho người dùng khác qua Email
 * @access  Private
 */
router.post('/', shareController.shareWithUser);

/**
 * @route   PATCH /api/shares/:shareId/role
 * @desc    Cập nhật quyền của cộng tác viên (viewer ↔ editor)
 * @access  Private
 */
router.patch('/:shareId/role', validateObjectId('shareId'), shareController.updateCollaboratorRole);

/**
 * @route   DELETE /api/shares/:shareId
 * @desc    Thu hồi quyền chia sẻ của một cộng tác viên
 * @access  Private
 */
router.delete('/:shareId', validateObjectId('shareId'), shareController.removeCollaborator);

/**
 * @route   POST /api/shares/public-link
 * @desc    Tạo hoặc cập nhật liên kết chia sẻ công khai cho tệp/thư mục
 * @access  Private
 */
router.post('/public-link', shareController.createOrUpdatePublicLink);

/**
 * @route   DELETE /api/shares/public-link/:itemType/:itemId
 * @desc    Tắt / hủy liên kết chia sẻ công khai
 * @access  Private
 */
router.delete('/public-link/:itemType/:itemId', validateObjectId('itemId'), shareController.revokePublicLink);

/**
 * @route   GET /api/shares/item/:itemType/:itemId
 * @desc    Lấy danh sách chia sẻ và cấu hình public link của một tệp hoặc thư mục
 * @access  Private
 */
router.get('/item/:itemType/:itemId', validateObjectId('itemId'), shareController.getItemShares);

module.exports = router;
