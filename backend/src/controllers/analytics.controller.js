const analyticsService = require('../services/analytics.service');
const { sendSuccess } = require('../utils/apiResponse');
const ApiError = require('../utils/apiError');

/**
 * Lấy báo cáo thống kê cá nhân của người dùng hiện tại
 * GET /api/analytics/me
 */
const getMyAnalytics = async (req, res, next) => {
  try {
    const data = await analyticsService.getUserAnalytics(req.user._id);
    return sendSuccess(res, {
      message: 'Lấy dữ liệu thống kê cá nhân thành công',
      data
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Lấy báo cáo thống kê toàn hệ thống (Admin only)
 * GET /api/analytics/system
 */
const getSystemAnalytics = async (req, res, next) => {
  try {
    if (req.user.role !== 'admin') {
      throw new ApiError(403, 'Chỉ Quản trị viên mới có quyền xem thống kê toàn hệ thống');
    }

    const data = await analyticsService.getSystemAnalytics();
    return sendSuccess(res, {
      message: 'Lấy dữ liệu thống kê hệ thống thành công',
      data
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Xuất dữ liệu thống kê danh sách tệp tin dưới dạng tệp CSV
 * GET /api/analytics/export/csv?scope=personal|system
 */
const exportCsv = async (req, res, next) => {
  try {
    const scope = req.query.scope === 'system' && req.user.role === 'admin' ? 'system' : 'personal';
    const { csvContent, filename } = await analyticsService.exportFilesCsv(
      req.user._id,
      req.user.role,
      scope
    );

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.status(200).send(csvContent);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getMyAnalytics,
  getSystemAnalytics,
  exportCsv
};
