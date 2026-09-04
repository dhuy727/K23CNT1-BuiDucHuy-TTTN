const searchService = require('../services/search.service');
const { sendSuccess } = require('../utils/apiResponse');

/**
 * Tìm kiếm và Lọc tổng hợp đa tiêu chí cho Files & Folders
 */
const search = async (req, res, next) => {
  try {
    const result = await searchService.searchItems(req.user._id, req.query);
    return sendSuccess(res, {
      message: 'Tìm kiếm và lọc dữ liệu thành công',
      data: {
        items: result.items,
        folders: result.folders,
        files: result.files
      },
      metadata: {
        statistics: result.statistics,
        pagination: result.pagination
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Gợi ý tìm kiếm nhanh (Autocomplete Suggestions)
 */
const getSuggestions = async (req, res, next) => {
  try {
    const keyword = req.query.q || req.query.keyword || '';
    const suggestions = await searchService.getSearchSuggestions(req.user._id, keyword);
    return sendSuccess(res, {
      message: 'Lấy danh sách gợi ý tìm kiếm thành công',
      data: suggestions
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Lấy metadata hỗ trợ bộ lọc trên giao diện (Categories, Tags, File Types, Presets)
 */
const getFiltersMetadata = async (req, res, next) => {
  try {
    const metadata = await searchService.getFiltersMetadata(req.user._id);
    return sendSuccess(res, {
      message: 'Lấy metadata bộ lọc thành công',
      data: metadata
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  search,
  getSuggestions,
  getFiltersMetadata
};
