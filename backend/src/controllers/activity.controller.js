const activityService = require('../services/activity.service');
const ApiError = require('../utils/apiError');

/**
 * Lấy lịch sử thao tác của người dùng hiện tại
 * GET /api/activities/me
 */
const getMyActivities = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { action, actionGroup, timeRange, startDate, endDate, search, page, limit } = req.query;

    const result = await activityService.getActivities({
      userId,
      isAdmin: false,
      isSystem: false,
      action,
      actionGroup,
      timeRange,
      startDate,
      endDate,
      search,
      page,
      limit
    });

    return res.status(200).json({
      success: true,
      message: 'Lấy lịch sử thao tác thành công',
      data: result.items,
      metadata: result.pagination
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Lấy lịch sử thao tác toàn hệ thống (Dành cho Quản trị viên)
 * GET /api/activities/system
 */
const getSystemActivities = async (req, res, next) => {
  try {
    if (req.user.role !== 'admin') {
      throw new ApiError(403, 'Chỉ Quản trị viên mới có quyền xem nhật ký toàn hệ thống');
    }

    const {
      filterUserId,
      action,
      actionGroup,
      timeRange,
      startDate,
      endDate,
      search,
      page,
      limit
    } = req.query;

    const result = await activityService.getActivities({
      userId: req.user._id,
      isAdmin: true,
      isSystem: true,
      filterUserId,
      action,
      actionGroup,
      timeRange,
      startDate,
      endDate,
      search,
      page,
      limit
    });

    return res.status(200).json({
      success: true,
      message: 'Lấy nhật ký kiểm toán hệ thống thành công',
      data: result.items,
      metadata: result.pagination
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getMyActivities,
  getSystemActivities
};
