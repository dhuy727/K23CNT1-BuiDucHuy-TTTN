const express = require('express');
const router = express.Router({ mergeParams: true }); // mergeParams để nhận :id từ file.routes
const versionController = require('../controllers/version.controller');
const { verifyAuth } = require('../middlewares/auth.middleware');
const { validateObjectId } = require('../middlewares/validate.middleware');

// Yêu cầu đăng nhập cho toàn bộ các endpoint version
router.use(verifyAuth);

/**
 * @route   POST /api/files/:id/versions
 * @desc    Tạo phiên bản mới bằng cách snapshot file hiện tại
 * @body    { note?: string, changeType?: 'upload'|'update'|'rename'|'restore'|'manual' }
 * @access  Private
 */
router.post('/', validateObjectId('id'), versionController.createVersion);

/**
 * @route   GET /api/files/:id/versions
 * @desc    Lấy danh sách tất cả phiên bản (sắp xếp mới nhất trước, có phân trang)
 * @query   page, limit
 * @access  Private
 */
router.get('/', validateObjectId('id'), versionController.getVersions);

/**
 * @route   GET /api/files/:id/versions/:versionId
 * @desc    Xem chi tiết thông tin một phiên bản
 * @access  Private
 */
router.get(
  '/:versionId',
  validateObjectId('id'),
  validateObjectId('versionId'),
  versionController.getVersionById
);

/**
 * @route   GET /api/files/:id/versions/:versionId/download
 * @desc    Tải xuống file của một phiên bản cụ thể
 * @access  Private
 */
router.get(
  '/:versionId/download',
  validateObjectId('id'),
  validateObjectId('versionId'),
  versionController.downloadVersion
);

/**
 * @route   POST /api/files/:id/versions/:versionId/restore
 * @desc    Khôi phục file về trạng thái của một phiên bản cũ
 *          (Tự động lưu trạng thái hiện tại trước khi ghi đè)
 * @access  Private
 */
router.post(
  '/:versionId/restore',
  validateObjectId('id'),
  validateObjectId('versionId'),
  versionController.restoreVersion
);

/**
 * @route   DELETE /api/files/:id/versions/:versionId
 * @desc    Xóa một phiên bản cụ thể (xóa DB và file vật lý snapshot)
 * @access  Private
 */
router.delete(
  '/:versionId',
  validateObjectId('id'),
  validateObjectId('versionId'),
  versionController.deleteVersion
);

module.exports = router;
