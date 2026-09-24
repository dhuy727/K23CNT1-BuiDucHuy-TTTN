const automationService = require('../services/automation.service');
const { sendSuccess, sendCreated } = require('../utils/apiResponse');

/**
 * Lấy danh sách quy tắc tự động hóa của người dùng
 */
const getRules = async (req, res, next) => {
  try {
    const rules = await automationService.getRules(req.user._id);
    return sendSuccess(res, {
      message: 'Lấy danh sách quy tắc tự động hóa thành công',
      data: rules
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Lấy chi tiết một quy tắc
 */
const getRuleById = async (req, res, next) => {
  try {
    const rule = await automationService.getRuleById(req.user._id, req.params.id);
    return sendSuccess(res, {
      message: 'Lấy chi tiết quy tắc thành công',
      data: rule
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Tạo quy tắc tự động hóa mới
 */
const createRule = async (req, res, next) => {
  try {
    const rule = await automationService.createRule(req.user._id, req.body);
    return sendCreated(res, {
      message: 'Tạo quy tắc tự động hóa thành công',
      data: rule
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Cập nhật quy tắc tự động hóa
 */
const updateRule = async (req, res, next) => {
  try {
    const rule = await automationService.updateRule(req.user._id, req.params.id, req.body);
    return sendSuccess(res, {
      message: 'Cập nhật quy tắc tự động hóa thành công',
      data: rule
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Xóa quy tắc tự động hóa
 */
const deleteRule = async (req, res, next) => {
  try {
    const result = await automationService.deleteRule(req.user._id, req.params.id);
    return sendSuccess(res, {
      message: result.message,
      data: null
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Bật/tắt kích hoạt quy tắc
 */
const toggleRule = async (req, res, next) => {
  try {
    const rule = await automationService.toggleRuleActive(req.user._id, req.params.id);
    return sendSuccess(res, {
      message: rule.isActive ? 'Đã kích hoạt quy tắc' : 'Đã tạm ngưng quy tắc',
      data: rule
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Áp dụng tất cả quy tắc đang kích hoạt lên toàn bộ tệp tin hiện tại
 */
const runAllRules = async (req, res, next) => {
  try {
    const result = await automationService.applyRulesToAllFiles(req.user._id);
    return sendSuccess(res, {
      message: result.message,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getRules,
  getRuleById,
  createRule,
  updateRule,
  deleteRule,
  toggleRule,
  runAllRules
};
