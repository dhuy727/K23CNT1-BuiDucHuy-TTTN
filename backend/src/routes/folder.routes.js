const express = require('express');
const router = express.Router();
const folderController = require('../controllers/folder.controller');
const { verifyAuth } = require('../middlewares/auth.middleware');
const { validateObjectId } = require('../middlewares/validate.middleware');

// Toàn bộ các thao tác với thư mục đều yêu cầu đăng nhập
router.use(verifyAuth);

/**
 * @route   POST /api/folders
 * @desc    Tạo thư mục mới (ở root hoặc trong thư mục cha)
 * @access  Private
 */
router.post('/', folderController.createFolder);

/**
 * @route   GET /api/folders
 * @desc    Lấy danh sách thư mục (hỗ trợ lọc theo parentId, tìm kiếm, phân trang)
 * @access  Private
 */
router.get('/', folderController.getFolders);

/**
 * @route   GET /api/folders/tree
 * @desc    Lấy toàn bộ cây thư mục dạng phân cấp lồng nhau (Tree View)
 * @access  Private
 */
router.get('/tree', folderController.getFolderTree);

/**
 * @route   GET /api/folders/root/files
 * @desc    Lấy danh sách file ở thư mục gốc (Root)
 * @access  Private
 */
router.get('/root/files', (req, res, next) => {
  req.params.id = 'root';
  folderController.getFolderFiles(req, res, next);
});

/**
 * @route   GET /api/folders/:id
 * @desc    Xem chi tiết thông tin thư mục (kèm Breadcrumb và Thống kê)
 * @access  Private
 */
router.get('/:id', validateObjectId('id'), folderController.getFolderById);

/**
 * @route   PATCH /api/folders/:id/rename (hoặc PUT /api/folders/:id/rename)
 * @desc    Đổi tên thư mục
 * @access  Private
 */
router.patch('/:id/rename', validateObjectId('id'), folderController.renameFolder);
router.put('/:id/rename', validateObjectId('id'), folderController.renameFolder);

/**
 * @route   PATCH /api/folders/:id/move (hoặc PUT /api/folders/:id/move)
 * @desc    Di chuyển thư mục (kèm thuật toán chống đệ quy lặp vòng)
 * @access  Private
 */
router.patch('/:id/move', validateObjectId('id'), folderController.moveFolder);
router.put('/:id/move', validateObjectId('id'), folderController.moveFolder);

/**
 * @route   DELETE /api/folders/:id
 * @desc    Xóa thư mục (soft delete hoặc permanent qua query ?permanent=true)
 * @access  Private
 */
router.delete('/:id', validateObjectId('id'), folderController.deleteFolder);

/**
 * @route   GET /api/folders/:id/files
 * @desc    Lấy danh sách các tệp tin con nằm bên trong thư mục
 * @access  Private
 */
router.get('/:id/files', validateObjectId('id'), folderController.getFolderFiles);

module.exports = router;
