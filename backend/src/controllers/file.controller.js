const fileService = require('../services/file.service');
const { sendSuccess, sendCreated } = require('../utils/apiResponse');

/**
 * Tải lên một tệp tin đơn lẻ
 */
const uploadFile = async (req, res, next) => {
  try {
    const file = await fileService.uploadFile(req.user._id, req.file, req.body);
    return sendCreated(res, {
      message: 'Tải lên tệp tin thành công',
      data: file
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Tải lên nhiều tệp tin cùng lúc
 */
const uploadMultipleFiles = async (req, res, next) => {
  try {
    const result = await fileService.uploadMultipleFiles(req.user._id, req.files, req.body);
    return sendCreated(res, {
      message: `Tải lên thành công ${result.count} tệp tin`,
      data: result.files,
      metadata: {
        count: result.count
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Lấy danh sách tệp tin (Lọc thư mục, tìm kiếm, phân loại, phân trang)
 */
const getFiles = async (req, res, next) => {
  try {
    const { files, pagination } = await fileService.getFiles(req.user._id, req.query);
    return sendSuccess(res, {
      message: 'Lấy danh sách tệp tin thành công',
      data: files,
      metadata: pagination
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Xem chi tiết thông tin tệp tin
 */
const getFileById = async (req, res, next) => {
  try {
    const file = await fileService.getFileById(req.user._id, req.params.id);
    return sendSuccess(res, {
      message: 'Lấy thông tin chi tiết tệp tin thành công',
      data: file
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Tải xuống tệp tin về máy (Download)
 */
const downloadFile = async (req, res, next) => {
  try {
    const { filePath, downloadName } = await fileService.getFileForDownload(req.user._id, req.params.id);
    return res.download(filePath, downloadName, (err) => {
      if (err && !res.headersSent) {
        next(err);
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Xem trước nội dung tệp tin inline trên trình duyệt (Preview)
 */
const previewFile = async (req, res, next) => {
  try {
    const { filePath, mimeType, file } = await fileService.getFileForPreview(req.user._id, req.params.id);

    // Gửi header inline để trình duyệt mở xem trực tiếp thay vì tải về
    const encodedFilename = encodeURIComponent(file.name);
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${encodedFilename}"; filename*=UTF-8''${encodedFilename}`);

    return res.sendFile(filePath, (err) => {
      if (err && !res.headersSent) {
        next(err);
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Đổi tên tệp tin
 */
const renameFile = async (req, res, next) => {
  try {
    const file = await fileService.renameFile(req.user._id, req.params.id, req.body.name);
    return sendSuccess(res, {
      message: 'Đổi tên tệp tin thành công',
      data: file
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Di chuyển tệp tin sang thư mục khác
 */
const moveFile = async (req, res, next) => {
  try {
    const file = await fileService.moveFile(req.user._id, req.params.id, req.body.targetFolderId);
    return sendSuccess(res, {
      message: 'Di chuyển tệp tin thành công',
      data: file
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Sao chép tệp tin
 */
const copyFile = async (req, res, next) => {
  try {
    const file = await fileService.copyFile(req.user._id, req.params.id, req.body.targetFolderId);
    return sendCreated(res, {
      message: 'Sao chép tệp tin thành công',
      data: file
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Xóa tệp tin (Mặc định chuyển vào thùng rác, hoặc xóa vĩnh viễn khi permanent=true)
 */
const deleteFile = async (req, res, next) => {
  try {
    const permanent = req.query.permanent === 'true' || req.path.endsWith('/permanent');
    const result = await fileService.deleteFile(req.user._id, req.params.id, permanent);
    return sendSuccess(res, {
      message: result.message,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Lấy danh sách tệp tin trong thùng rác
 */
const getTrashFiles = async (req, res, next) => {
  try {
    const { files, pagination } = await fileService.getTrashFiles(req.user._id, req.query);
    return sendSuccess(res, {
      message: 'Lấy danh sách tệp tin trong thùng rác thành công',
      data: files,
      metadata: pagination
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Khôi phục tệp tin từ thùng rác
 */
const restoreFile = async (req, res, next) => {
  try {
    const result = await fileService.restoreFile(req.user._id, req.params.id);
    return sendSuccess(res, {
      message: result.message,
      data: result.file
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Dọn sạch toàn bộ thùng rác
 */
const emptyTrash = async (req, res, next) => {
  try {
    const result = await fileService.emptyTrash(req.user._id);
    return sendSuccess(res, {
      message: result.message,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Đánh dấu sao yêu thích / bỏ yêu thích tệp tin
 */
const toggleStar = async (req, res, next) => {
  try {
    const file = await fileService.toggleStar(req.user._id, req.params.id);
    const msg = file.isStarred ? 'Đã thêm vào danh sách yêu thích' : 'Đã bỏ khỏi danh sách yêu thích';
    return sendSuccess(res, {
      message: msg,
      data: file
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  uploadFile,
  uploadMultipleFiles,
  getFiles,
  getFileById,
  downloadFile,
  previewFile,
  renameFile,
  moveFile,
  copyFile,
  deleteFile,
  getTrashFiles,
  restoreFile,
  emptyTrash,
  toggleStar
};
