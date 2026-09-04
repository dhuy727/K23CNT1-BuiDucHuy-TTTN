const mongoose = require('mongoose');
const File = require('../models/file.model');
const Folder = require('../models/folder.model');
const ApiError = require('../utils/apiError');
const { formatFileSize } = require('./file.service');

/**
 * Xử lý bộ lọc thời gian từ startDate/endDate hoặc datePreset
 */
const resolveDateFilter = (query) => {
  const dateFilter = {};
  const now = new Date();

  if (query.datePreset) {
    switch (query.datePreset.toLowerCase()) {
      case 'today': {
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        dateFilter.$gte = startOfDay;
        break;
      }
      case 'yesterday': {
        const startOfYesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
        const endOfYesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 23, 59, 59, 999);
        dateFilter.$gte = startOfYesterday;
        dateFilter.$lte = endOfYesterday;
        break;
      }
      case 'last7days': {
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        dateFilter.$gte = sevenDaysAgo;
        break;
      }
      case 'last30days': {
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        dateFilter.$gte = thirtyDaysAgo;
        break;
      }
      case 'thisyear': {
        const startOfYear = new Date(now.getFullYear(), 0, 1);
        dateFilter.$gte = startOfYear;
        break;
      }
      default:
        break;
    }
  } else {
    if (query.startDate) {
      const start = new Date(query.startDate);
      if (!isNaN(start.getTime())) {
        dateFilter.$gte = start;
      }
    }
    if (query.endDate) {
      const end = new Date(query.endDate);
      if (!isNaN(end.getTime())) {
        dateFilter.$lte = end;
      }
    }
  }

  return Object.keys(dateFilter).length > 0 ? dateFilter : null;
};

/**
 * Xử lý bộ lọc kích thước tệp tin
 */
const resolveSizeFilter = (query) => {
  const sizeFilter = {};

  if (query.sizePreset) {
    switch (query.sizePreset.toLowerCase()) {
      case 'tiny': // < 1MB
        sizeFilter.$lt = 1024 * 1024;
        break;
      case 'small': // 1MB - 10MB
        sizeFilter.$gte = 1024 * 1024;
        sizeFilter.$lte = 10 * 1024 * 1024;
        break;
      case 'medium': // 10MB - 100MB
        sizeFilter.$gte = 10 * 1024 * 1024;
        sizeFilter.$lte = 100 * 1024 * 1024;
        break;
      case 'large': // > 100MB
        sizeFilter.$gt = 100 * 1024 * 1024;
        break;
      default:
        break;
    }
  } else {
    if (query.minSize !== undefined && !isNaN(Number(query.minSize))) {
      sizeFilter.$gte = Number(query.minSize);
    }
    if (query.maxSize !== undefined && !isNaN(Number(query.maxSize))) {
      sizeFilter.$lte = Number(query.maxSize);
    }
  }

  return Object.keys(sizeFilter).length > 0 ? sizeFilter : null;
};

/**
 * Xử lý nhóm định dạng tệp tin
 */
const resolveTypeFilter = (type) => {
  if (!type) return null;

  switch (type.toLowerCase()) {
    case 'image':
      return {
        $or: [
          { mimeType: { $regex: '^image/', $options: 'i' } },
          { extension: { $in: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico'] } }
        ]
      };
    case 'video':
      return {
        $or: [
          { mimeType: { $regex: '^video/', $options: 'i' } },
          { extension: { $in: ['mp4', 'mkv', 'avi', 'mov', 'wmv', 'flv', 'webm'] } }
        ]
      };
    case 'audio':
      return {
        $or: [
          { mimeType: { $regex: '^audio/', $options: 'i' } },
          { extension: { $in: ['mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a'] } }
        ]
      };
    case 'pdf':
      return {
        $or: [
          { mimeType: { $regex: 'pdf', $options: 'i' } },
          { extension: 'pdf' }
        ]
      };
    case 'document':
      return {
        $or: [
          { mimeType: { $regex: 'pdf|word|excel|sheet|powerpoint|presentation|text|csv|msword', $options: 'i' } },
          { extension: { $in: ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'csv', 'md', 'rtf'] } }
        ]
      };
    case 'archive':
      return {
        $or: [
          { mimeType: { $regex: 'zip|compressed|tar|archive', $options: 'i' } },
          { extension: { $in: ['zip', 'rar', '7z', 'tar', 'gz', 'bz2'] } }
        ]
      };
    case 'code':
      return {
        extension: { $in: ['js', 'jsx', 'ts', 'tsx', 'html', 'css', 'json', 'py', 'java', 'c', 'cpp', 'php', 'sql', 'sh'] }
      };
    default:
      return null;
  }
};

/**
 * 1. Tìm kiếm và Lọc tổng hợp (Global Search & Filter)
 */
const searchItems = async (userId, query = {}) => {
  const keyword = (query.q || query.search || '').trim();
  const target = (query.target || 'all').toLowerCase(); // 'all', 'files', 'folders'
  const isRecursive = query.recursive !== 'false' && query.recursive !== false;

  const fileFilter = { user: userId, isTrash: false };
  const folderFilter = { user: userId, isTrash: false };

  // 1. Lọc theo từ khóa tìm kiếm (Full-text hoặc Regex)
  if (keyword) {
    const searchRegex = new RegExp(keyword, 'i');

    fileFilter.$or = [
      { name: searchRegex },
      { originalName: searchRegex },
      { aiSummary: searchRegex },
      { aiTags: { $in: [searchRegex] } },
      { aiCategory: searchRegex }
    ];

    folderFilter.$or = [
      { name: searchRegex },
      { description: searchRegex }
    ];
  }

  // 2. Lọc theo vị trí / Thư mục cha (kèm tính năng đệ quy con cháu)
  let folderScopeIds = null;
  if (query.folderId !== undefined && query.folderId !== '' && query.folderId !== 'all') {
    if (query.folderId === 'root' || query.folderId === 'null') {
      if (!isRecursive) {
        fileFilter.folder = null;
        folderFilter.parent = null;
      }
      // Nếu folderId=root và isRecursive=true -> Tìm trong toàn bộ kho lưu trữ
    } else {
      if (!mongoose.Types.ObjectId.isValid(query.folderId)) {
        throw new ApiError(400, 'ID thư mục không hợp lệ');
      }

      const parentFolder = await Folder.findOne({ _id: query.folderId, user: userId, isTrash: false });
      if (!parentFolder) {
        throw new ApiError(404, 'Thư mục không tồn tại');
      }

      if (isRecursive) {
        // Tìm tất cả các thư mục con cháu có path bắt đầu bằng path của folder này
        const descendants = await Folder.find({
          user: userId,
          path: { $regex: `^${parentFolder.path}` },
          isTrash: false
        }).select('_id');

        folderScopeIds = [parentFolder._id, ...descendants.map((d) => d._id)];
        fileFilter.folder = { $in: folderScopeIds };
        folderFilter._id = { $in: descendants.map((d) => d._id) };
      } else {
        fileFilter.folder = parentFolder._id;
        folderFilter.parent = parentFolder._id;
      }
    }
  }

  // 3. Lọc theo khoảng thời gian
  const dateFilter = resolveDateFilter(query);
  if (dateFilter) {
    const dateField = query.dateField || 'createdAt';
    fileFilter[dateField] = dateFilter;
    folderFilter[dateField] = dateFilter;
  }

  // 4. Lọc theo trạng thái yêu thích (Starred)
  if (query.isStarred !== undefined) {
    const isStarredBool = query.isStarred === 'true' || query.isStarred === true;
    fileFilter.isStarred = isStarredBool;
    folderFilter.isStarred = isStarredBool;
  }

  // 5. Các bộ lọc chuyên biệt cho tệp tin (File-specific filters)
  let hasFileOnlyFilter = false;

  // Kích thước
  const sizeFilter = resolveSizeFilter(query);
  if (sizeFilter) {
    fileFilter.size = sizeFilter;
    hasFileOnlyFilter = true;
  }

  // Nhóm loại file
  const typeFilter = resolveTypeFilter(query.type);
  if (typeFilter) {
    Object.assign(fileFilter, typeFilter);
    hasFileOnlyFilter = true;
  }

  // Đuôi mở rộng cụ thể
  if (query.extension) {
    fileFilter.extension = query.extension.toLowerCase().replace('.', '');
    hasFileOnlyFilter = true;
  }

  // Phân loại AI (Category)
  if (query.aiCategory) {
    fileFilter.aiCategory = query.aiCategory;
    hasFileOnlyFilter = true;
  }

  // Thẻ tags AI
  if (query.aiTags) {
    const tagsArray = Array.isArray(query.aiTags)
      ? query.aiTags
      : query.aiTags.split(',').map((t) => t.trim()).filter(Boolean);
    if (tagsArray.length > 0) {
      fileFilter.aiTags = { $in: tagsArray.map((t) => new RegExp(t, 'i')) };
      hasFileOnlyFilter = true;
    }
  }

  // Trạng thái AI
  if (query.aiStatus) {
    fileFilter.aiStatus = query.aiStatus;
    hasFileOnlyFilter = true;
  }

  // Sắp xếp
  const sortBy = query.sortBy || 'createdAt';
  const sortOrder = query.sortOrder === 'asc' ? 1 : -1;
  const sortOption = { [sortBy]: sortOrder };

  // Phân trang
  const page = parseInt(query.page, 10) || 1;
  const limit = parseInt(query.limit, 10) || 20;
  const skip = (page - 1) * limit;

  // Xác định xem có cần query Folders không:
  // Nếu target='files' hoặc có áp dụng bộ lọc chỉ dành cho file (size, type, aiCategory...) thì bỏ qua Folders
  const shouldQueryFolders = target !== 'files' && !hasFileOnlyFilter;
  const shouldQueryFiles = target !== 'folders';

  const [folders, totalFolders, files, totalFiles] = await Promise.all([
    shouldQueryFolders
      ? Folder.find(folderFilter).sort(sortOption).lean()
      : Promise.resolve([]),
    shouldQueryFolders
      ? Folder.countDocuments(folderFilter)
      : Promise.resolve(0),
    shouldQueryFiles
      ? File.find(fileFilter).populate('folder', '_id name path color').sort(sortOption).lean()
      : Promise.resolve([]),
    shouldQueryFiles
      ? File.countDocuments(fileFilter)
      : Promise.resolve(0)
  ]);

  // Gắn itemType và định dạng dữ liệu
  const formattedFolders = folders.map((f) => ({
    ...f,
    itemType: 'folder'
  }));

  const formattedFiles = files.map((f) => ({
    ...f,
    itemType: 'file',
    formattedSize: formatFileSize(f.size)
  }));

  // Tạo danh sách tổng hợp hợp nhất đã sắp xếp
  const combinedList = [...formattedFolders, ...formattedFiles].sort((a, b) => {
    let valA = a[sortBy];
    let valB = b[sortBy];

    if (valA instanceof Date) valA = valA.getTime();
    if (valB instanceof Date) valB = valB.getTime();

    if (valA < valB) return sortOrder === 1 ? -1 : 1;
    if (valA > valB) return sortOrder === 1 ? 1 : -1;
    return 0;
  });

  const totalResults = totalFolders + totalFiles;
  const paginatedItems = combinedList.slice(skip, skip + limit);

  return {
    items: paginatedItems,
    folders: target === 'folders' || target === 'all' ? formattedFolders.slice(skip, skip + limit) : [],
    files: target === 'files' || target === 'all' ? formattedFiles.slice(skip, skip + limit) : [],
    statistics: {
      totalFolders,
      totalFiles,
      totalResults
    },
    pagination: {
      total: totalResults,
      page,
      limit,
      totalPages: Math.ceil(totalResults / limit) || 1
    }
  };
};

/**
 * 2. Gợi ý tìm kiếm nhanh (Search Suggestions / Autocomplete)
 */
const getSearchSuggestions = async (userId, keyword = '') => {
  const trimmed = (keyword || '').trim();
  if (!trimmed) {
    return [];
  }

  const regex = new RegExp(trimmed, 'i');

  const [matchedFiles, matchedFolders, matchedCategories, matchedTags] = await Promise.all([
    File.find({ user: userId, name: regex, isTrash: false })
      .select('_id name mimeType extension size')
      .limit(5)
      .lean(),
    Folder.find({ user: userId, name: regex, isTrash: false })
      .select('_id name color')
      .limit(5)
      .lean(),
    File.distinct('aiCategory', { user: userId, aiCategory: regex, isTrash: false }),
    File.aggregate([
      { $match: { user: new mongoose.Types.ObjectId(userId), isTrash: false } },
      { $unwind: '$aiTags' },
      { $match: { aiTags: regex } },
      { $group: { _id: '$aiTags' } },
      { $limit: 5 }
    ])
  ]);

  const suggestions = [];

  // Gợi ý thư mục
  matchedFolders.forEach((f) => {
    suggestions.push({
      type: 'folder',
      id: f._id,
      text: f.name,
      color: f.color
    });
  });

  // Gợi ý tệp tin
  matchedFiles.forEach((f) => {
    suggestions.push({
      type: 'file',
      id: f._id,
      text: f.name,
      extension: f.extension,
      size: formatFileSize(f.size)
    });
  });

  // Gợi ý danh mục AI
  matchedCategories.forEach((cat) => {
    if (cat && cat !== 'Chưa phân loại') {
      suggestions.push({
        type: 'category',
        text: cat
      });
    }
  });

  // Gợi ý thẻ tags
  matchedTags.forEach((t) => {
    suggestions.push({
      type: 'tag',
      text: t._id
    });
  });

  return suggestions.slice(0, 10);
};

/**
 * 3. Thống kê Metadata phục vụ bộ lọc trên giao diện người dùng
 */
const getFiltersMetadata = async (userId) => {
  const userObjectId = new mongoose.Types.ObjectId(userId);

  const [categoriesStats, tagsStats, typesStats, counts] = await Promise.all([
    // Thống kê theo danh mục AI
    File.aggregate([
      { $match: { user: userObjectId, isTrash: false } },
      { $group: { _id: '$aiCategory', count: { $sum: 1 }, totalSize: { $sum: '$size' } } },
      { $sort: { count: -1 } }
    ]),
    // Thống kê các tags phổ biến
    File.aggregate([
      { $match: { user: userObjectId, isTrash: false } },
      { $unwind: '$aiTags' },
      { $group: { _id: '$aiTags', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 20 }
    ]),
    // Thống kê các loại tệp tin
    File.aggregate([
      { $match: { user: userObjectId, isTrash: false } },
      {
        $project: {
          extension: 1,
          size: 1,
          typeGroup: {
            $switch: {
              branches: [
                {
                  case: { $in: ['$extension', ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp']] },
                  then: 'image'
                },
                {
                  case: { $in: ['$extension', ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'csv', 'md']] },
                  then: 'document'
                },
                {
                  case: { $in: ['$extension', ['mp4', 'mkv', 'avi', 'mov', 'wmv']] },
                  then: 'video'
                },
                {
                  case: { $in: ['$extension', ['mp3', 'wav', 'flac', 'aac']] },
                  then: 'audio'
                },
                {
                  case: { $in: ['$extension', ['zip', 'rar', '7z', 'tar', 'gz']] },
                  then: 'archive'
                }
              ],
              default: 'other'
            }
          }
        }
      },
      {
        $group: {
          _id: '$typeGroup',
          count: { $sum: 1 },
          totalSize: { $sum: '$size' }
        }
      }
    ]),
    // Đếm tổng quan
    Promise.all([
      Folder.countDocuments({ user: userId, isTrash: false }),
      File.countDocuments({ user: userId, isTrash: false }),
      File.countDocuments({ user: userId, isTrash: false, isStarred: true })
    ])
  ]);

  const [totalFolders, totalFiles, totalStarredFiles] = counts;

  return {
    overview: {
      totalFolders,
      totalFiles,
      totalStarredFiles
    },
    categories: categoriesStats.map((c) => ({
      name: c._id || 'Chưa phân loại',
      count: c.count,
      totalSize: formatFileSize(c.totalSize)
    })),
    tags: tagsStats.map((t) => ({
      tag: t._id,
      count: t.count
    })),
    fileTypes: typesStats.map((t) => ({
      type: t._id,
      count: t.count,
      totalSize: formatFileSize(t.totalSize)
    })),
    sizePresets: [
      { id: 'tiny', label: 'Rất nhỏ (< 1 MB)' },
      { id: 'small', label: 'Nhỏ (1 MB - 10 MB)' },
      { id: 'medium', label: 'Trung bình (10 MB - 100 MB)' },
      { id: 'large', label: 'Lớn (> 100 MB)' }
    ],
    datePresets: [
      { id: 'today', label: 'Hôm nay' },
      { id: 'yesterday', label: 'Hôm qua' },
      { id: 'last7days', label: '7 ngày qua' },
      { id: 'last30days', label: '30 ngày qua' },
      { id: 'thisYear', label: 'Năm nay' }
    ]
  };
};

module.exports = {
  searchItems,
  getSearchSuggestions,
  getFiltersMetadata
};
