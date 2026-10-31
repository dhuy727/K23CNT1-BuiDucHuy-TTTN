const express = require('express');
const router = express.Router();
const collabController = require('../controllers/collab.controller');
const { validateObjectId } = require('../middlewares/validate.middleware');
const { uploadSingle } = require('../middlewares/upload.middleware');

/**
 * @route   GET /api/collab/:fileId/session
 * @desc    Lấy dữ liệu phiên soạn thảo thời gian thực của tệp tin (hỗ trợ cả JWT và shareToken công khai)
 */
router.get('/:fileId/session', validateObjectId('fileId'), collabController.getSession);

/**
 * @route   GET /api/collab/:fileId/stream
 * @desc    Luồng Server-Sent Events (SSE) nhận thay đổi thời gian thực và danh sách cộng tác viên
 */
router.get('/:fileId/stream', validateObjectId('fileId'), collabController.streamSession);

/**
 * @route   POST /api/collab/:fileId/sync
 * @desc    Đồng bộ nội dung đang gõ theo thời gian thực tới các thành viên khác đang mở tệp
 */
router.post('/:fileId/sync', validateObjectId('fileId'), collabController.syncContent);

/**
 * @route   POST /api/collab/:fileId/save
 * @desc    Lưu nội dung đã chỉnh sửa xuống tệp vật lý (.docx / văn bản) và cập nhật AI
 */
router.post('/:fileId/save', validateObjectId('fileId'), collabController.saveDocument);

/**
 * @route   POST /api/collab/:fileId/replace-file
 * @desc    Tải lên phiên bản tệp mới thay thế (dành cho PDF, ảnh hoặc tệp nhị phân có quyền chỉnh sửa)
 */
router.post(
  '/:fileId/replace-file',
  validateObjectId('fileId'),
  uploadSingle,
  collabController.replaceFile
);

module.exports = router;

