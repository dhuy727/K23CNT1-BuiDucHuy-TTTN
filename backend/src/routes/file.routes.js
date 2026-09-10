const express = require('express');
const router = express.Router();
const fileController = require('../controllers/file.controller');
const versionRoutes = require('./version.routes');
const { verifyAuth } = require('../middlewares/auth.middleware');
const { validateObjectId } = require('../middlewares/validate.middleware');
const { uploadSingle, uploadMultiple } = require('../middlewares/upload.middleware');

// Toàn bộ các thao tác với tệp tin đều yêu cầu đăng nhập
router.use(verifyAuth);

/**
 * @route   POST /api/files/upload
 * @desc    Tải lên 1 tệp tin đơn lẻ (Multipart form: field 'file')
 * @access  Private
 */
router.post('/upload', uploadSingle, fileController.uploadFile);

/**
 * @route   POST /api/files/upload-multiple
 * @desc    Tải lên nhiều tệp tin cùng lúc (Multipart form: field 'files', tối đa 10)
 * @access  Private
 */
router.post('/upload-multiple', uploadMultiple, fileController.uploadMultipleFiles);

/**
 * @route   GET /api/files/trash
 * @desc    Lấy danh sách các tệp tin trong thùng rác
 * @access  Private
 */
router.get('/trash', fileController.getTrashFiles);

/**
 * @route   DELETE /api/files/trash/empty
 * @desc    Dọn sạch toàn bộ thùng rác (xóa vĩnh viễn DB và xóa file vật lý)
 * @access  Private
 */
router.delete('/trash/empty', fileController.emptyTrash);

/**
 * @route   GET /api/files
 * @desc    Lấy danh sách tệp tin (hỗ trợ lọc theo folderId, tìm kiếm, lọc loại file, phân loại AI, phân trang)
 * @access  Private
 */
router.get('/', fileController.getFiles);

/**
 * @route   GET /api/files/:id/download
 * @desc    Tải xuống tệp tin
 * @access  Private
 */
router.get('/:id/download', validateObjectId('id'), fileController.downloadFile);

/**
 * @route   GET /api/files/:id/preview
 * @desc    Xem trước tệp tin inline trên trình duyệt (PDF, ảnh, audio, video, text)
 * @access  Private
 */
router.get('/:id/preview', validateObjectId('id'), fileController.previewFile);

/**
 * @route   PATCH /api/files/:id/rename (hoặc PUT)
 * @desc    Đổi tên tệp tin
 * @access  Private
 */
router.patch('/:id/rename', validateObjectId('id'), fileController.renameFile);
router.put('/:id/rename', validateObjectId('id'), fileController.renameFile);

/**
 * @route   PATCH /api/files/:id/move (hoặc PUT)
 * @desc    Di chuyển tệp tin sang thư mục khác
 * @access  Private
 */
router.patch('/:id/move', validateObjectId('id'), fileController.moveFile);
router.put('/:id/move', validateObjectId('id'), fileController.moveFile);

/**
 * @route   POST /api/files/:id/copy
 * @desc    Sao chép tệp tin sang cùng thư mục hoặc thư mục đích
 * @access  Private
 */
router.post('/:id/copy', validateObjectId('id'), fileController.copyFile);

/**
 * @route   PATCH /api/files/:id/restore (hoặc POST)
 * @desc    Khôi phục tệp tin từ thùng rác
 * @access  Private
 */
router.patch('/:id/restore', validateObjectId('id'), fileController.restoreFile);
router.post('/:id/restore', validateObjectId('id'), fileController.restoreFile);

/**
 * @route   PATCH /api/files/:id/star (hoặc POST)
 * @desc    Đánh dấu sao yêu thích / bỏ đánh dấu sao
 * @access  Private
 */
router.patch('/:id/star', validateObjectId('id'), fileController.toggleStar);
router.post('/:id/star', validateObjectId('id'), fileController.toggleStar);

/**
 * @route   DELETE /api/files/:id/permanent
 * @desc    Xóa vĩnh viễn tệp tin (xóa DB và xóa file vật lý trên đĩa)
 * @access  Private
 */
router.delete('/:id/permanent', validateObjectId('id'), (req, res, next) => {
  req.query.permanent = 'true';
  fileController.deleteFile(req, res, next);
});

/**
 * @route   DELETE /api/files/:id
 * @desc    Xóa tệp tin (mặc định chuyển vào thùng rác, hoặc ?permanent=true để xóa vĩnh viễn)
 * @access  Private
 */
router.delete('/:id', validateObjectId('id'), fileController.deleteFile);

/**
 * @route   GET /api/files/:id
 * @desc    Xem chi tiết thông tin tệp tin
 * @access  Private
 */
router.get('/:id', validateObjectId('id'), fileController.getFileById);

/**
 * Mount nested version routes: /api/files/:id/versions/...
 */
router.use('/:id/versions', versionRoutes);

module.exports = router;
