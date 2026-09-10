const versionService = require('../services/version.service');
const { sendSuccess, sendCreated } = require('../utils/apiResponse');

/**
 * POST /api/files/:id/versions
 * Tạo phiên bản mới (snapshot file hiện tại)
 */
const createVersion = async (req, res, next) => {
  try {
    const version = await versionService.createVersion(
      req.user._id,
      req.params.id,
      req.body
    );
    return sendCreated(res, {
      message: `Đã tạo phiên bản v${version.versionNumber} thành công`,
      data: version
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/files/:id/versions
 * Lấy danh sách tất cả phiên bản của một file (phân trang, mới nhất trước)
 */
const getVersions = async (req, res, next) => {
  try {
    const result = await versionService.getVersions(
      req.user._id,
      req.params.id,
      req.query
    );
    return sendSuccess(res, {
      message: 'Lấy danh sách phiên bản thành công',
      data: result.versions,
      metadata: {
        fileId: result.fileId,
        fileName: result.fileName,
        ...result.pagination
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/files/:id/versions/:versionId
 * Xem chi tiết thông tin một phiên bản
 */
const getVersionById = async (req, res, next) => {
  try {
    const version = await versionService.getVersionById(
      req.user._id,
      req.params.id,
      req.params.versionId
    );
    return sendSuccess(res, {
      message: 'Lấy thông tin phiên bản thành công',
      data: version
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/files/:id/versions/:versionId/download
 * Tải xuống file của một phiên bản cụ thể
 */
const downloadVersion = async (req, res, next) => {
  try {
    const { filePath, downloadName, mimeType } = await versionService.getVersionForDownload(
      req.user._id,
      req.params.id,
      req.params.versionId
    );

    res.setHeader('Content-Type', mimeType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(downloadName)}"`
    );

    const fileStream = require('fs').createReadStream(filePath);
    fileStream.pipe(res);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/files/:id/versions/:versionId/restore
 * Khôi phục file về một phiên bản cũ (ghi đè file vật lý hiện tại)
 */
const restoreVersion = async (req, res, next) => {
  try {
    const result = await versionService.restoreVersion(
      req.user._id,
      req.params.id,
      req.params.versionId
    );
    return sendSuccess(res, {
      message: result.message,
      data: {
        restoredVersion: result.restoredVersion,
        file: result.file
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/files/:id/versions/:versionId
 * Xóa một phiên bản cụ thể (xóa bản ghi DB và file vật lý snapshot)
 */
const deleteVersion = async (req, res, next) => {
  try {
    const result = await versionService.deleteVersion(
      req.user._id,
      req.params.id,
      req.params.versionId
    );
    return sendSuccess(res, {
      message: result.message,
      data: { versionId: result.versionId }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createVersion,
  getVersions,
  getVersionById,
  downloadVersion,
  restoreVersion,
  deleteVersion
};
