const duplicateService = require('../services/duplicate.service');
const { sendSuccess } = require('../utils/apiResponse');

/**
 * Lấy trạng thái phiên quét hoặc kết quả cache
 */
const getScanStatus = async (req, res, next) => {
  try {
    const data = await duplicateService.getScanStatus(req.user._id, req.query.folderId);
    return sendSuccess(res, {
      message: 'Lấy trạng thái quét trùng lặp thành công',
      data
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Bắt đầu phiên quét mới (Cấp 1 SHA-256 + Cấp 2 AI)
 */
const startScan = async (req, res, next) => {
  try {
    const data = await duplicateService.startScan(req.user._id, req.body.folderId);
    return sendSuccess(res, {
      message: 'Đã hoàn tất quét trùng lặp & tương đồng AI',
      data
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Lấy danh sách tệp tin dung lượng lớn (< 500MB hoặc theo ngưỡng)
 */
const getLargeFiles = async (req, res, next) => {
  try {
    const data = await duplicateService.getLargeFiles(req.user._id, {
      minBytes: req.query.minBytes,
      maxBytes: req.query.maxBytes,
      limit: req.query.limit,
      folderScope: req.query.folderId
    });
    return sendSuccess(res, {
      message: 'Lấy danh sách tệp dung lượng lớn thành công',
      data
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Xóa các tệp trùng lặp đã chọn (Soft delete vào thùng rác)
 */
const cleanFiles = async (req, res, next) => {
  try {
    const data = await duplicateService.cleanSelectedFiles(req.user._id, req.body.fileIds);
    return sendSuccess(res, {
      message: `Đã dọn dẹp thành công ${data.cleanedCount} tệp tin (${data.cleanedFormatted})`,
      data
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Đánh dấu bỏ qua không so sánh cặp tệp này trong tương lai
 */
const ignorePair = async (req, res, next) => {
  try {
    const data = await duplicateService.ignorePair(req.user._id, req.body.fileAId, req.body.fileBId);
    return sendSuccess(res, {
      message: data.message,
      data
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Lấy dữ liệu chi tiết cho Side-by-Side Compare Modal
 */
const getCompareDetail = async (req, res, next) => {
  try {
    const data = await duplicateService.getCompareDetail(
      req.user._id,
      req.query.fileAId,
      req.query.fileBId
    );
    return sendSuccess(res, {
      message: 'Lấy dữ liệu so sánh chi tiết thành công',
      data
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getScanStatus,
  startScan,
  getLargeFiles,
  cleanFiles,
  ignorePair,
  getCompareDetail
};
