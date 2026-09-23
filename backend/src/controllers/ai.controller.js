const aiService = require('../services/ai.service');
const { sendSuccess } = require('../utils/apiResponse');

/**
 * Chạy lại tiến trình phân loại và phân tích AI cho file
 */
const processFile = async (req, res, next) => {
  try {
    const file = await aiService.retryProcess(req.user._id, req.params.id);
    return sendSuccess(res, {
      message: 'Đã đưa tệp tin vào hàng đợi xử lý lại bằng AI',
      data: file
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Chấp nhận đổi tên tệp tin theo tên gợi ý từ AI
 */
const acceptName = async (req, res, next) => {
  try {
    const file = await aiService.acceptSuggestedName(req.user._id, req.params.id);
    return sendSuccess(res, {
      message: 'Đã đổi tên tệp tin theo gợi ý của AI',
      data: file
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Chấp nhận di chuyển tệp tin vào thư mục đề xuất từ AI
 */
const acceptFolder = async (req, res, next) => {
  try {
    const file = await aiService.acceptSuggestedFolder(req.user._id, req.params.id);
    return sendSuccess(res, {
      message: 'Đã di chuyển tệp tin vào thư mục đề xuất',
      data: file
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Bỏ qua / xóa các đề xuất của AI
 */
const dismissSuggestions = async (req, res, next) => {
  try {
    const file = await aiService.dismissSuggestions(req.user._id, req.params.id);
    return sendSuccess(res, {
      message: 'Đã bỏ qua các đề xuất của AI',
      data: file
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  processFile,
  acceptName,
  acceptFolder,
  dismissSuggestions
};
