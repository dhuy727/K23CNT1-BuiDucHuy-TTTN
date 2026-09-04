const folderService = require('../services/folder.service');
const { sendSuccess, sendCreated } = require('../utils/apiResponse');

/**
 * Tạo thư mục mới
 */
const createFolder = async (req, res, next) => {
  try {
    const folder = await folderService.createFolder(req.user._id, req.body);
    return sendCreated(res, {
      message: 'Tạo thư mục thành công',
      data: folder
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Lấy danh sách thư mục (có lọc theo parentId và phân trang)
 */
const getFolders = async (req, res, next) => {
  try {
    const { folders, pagination } = await folderService.getFolders(req.user._id, req.query);
    return sendSuccess(res, {
      message: 'Lấy danh sách thư mục thành công',
      data: folders,
      metadata: pagination
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Lấy cây thư mục (Folder Tree)
 */
const getFolderTree = async (req, res, next) => {
  try {
    const tree = await folderService.getFolderTree(req.user._id, req.query.rootId);
    return sendSuccess(res, {
      message: 'Lấy cây thư mục thành công',
      data: tree
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Xem chi tiết thư mục (kèm Breadcrumb và Thống kê)
 */
const getFolderById = async (req, res, next) => {
  try {
    const result = await folderService.getFolderById(req.user._id, req.params.id);
    return sendSuccess(res, {
      message: 'Lấy thông tin chi tiết thư mục thành công',
      data: result.folder,
      metadata: {
        breadcrumb: result.breadcrumb,
        statistics: result.statistics
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Đổi tên thư mục
 */
const renameFolder = async (req, res, next) => {
  try {
    const folder = await folderService.renameFolder(req.user._id, req.params.id, req.body.name);
    return sendSuccess(res, {
      message: 'Đổi tên thư mục thành công',
      data: folder
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Di chuyển thư mục
 */
const moveFolder = async (req, res, next) => {
  try {
    const folder = await folderService.moveFolder(req.user._id, req.params.id, req.body.targetParentId);
    return sendSuccess(res, {
      message: 'Di chuyển thư mục thành công',
      data: folder
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Xóa thư mục
 */
const deleteFolder = async (req, res, next) => {
  try {
    const permanent = req.query.permanent === 'true';
    const result = await folderService.deleteFolder(req.user._id, req.params.id, permanent);
    return sendSuccess(res, {
      message: result.message,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Lấy danh sách file con trong thư mục
 */
const getFolderFiles = async (req, res, next) => {
  try {
    const result = await folderService.getFolderFiles(req.user._id, req.params.id, req.query);
    return sendSuccess(res, {
      message: 'Lấy danh sách tệp tin con thành công',
      data: result.files,
      metadata: {
        folder: result.folder,
        pagination: result.pagination
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createFolder,
  getFolders,
  getFolderTree,
  getFolderById,
  renameFolder,
  moveFolder,
  deleteFolder,
  getFolderFiles
};
