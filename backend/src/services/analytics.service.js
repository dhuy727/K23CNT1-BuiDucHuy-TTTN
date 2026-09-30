const mongoose = require('mongoose');
const File = require('../models/file.model');
const Folder = require('../models/folder.model');
const User = require('../models/user.model');
const { formatFileSize } = require('./file.service');

const LIMIT_BYTES = 10 * 1024 * 1024 * 1024; // 10 GB

/**
 * Thống kê chi tiết tài nguyên của người dùng cá nhân
 */
const getUserAnalytics = async (userId) => {
  const userObjectId = new mongoose.Types.ObjectId(userId);

  // 1. Thống kê tổng quan (Dung lượng, số file, thùng rác, dấu sao, thư mục)
  const [fileStats, totalFolders, totalStarred] = await Promise.all([
    File.aggregate([
      { $match: { user: userObjectId } },
      {
        $group: {
          _id: null,
          totalSize: { $sum: '$size' },
          totalFiles: { $sum: 1 },
          trashSize: {
            $sum: { $cond: [{ $eq: ['$isTrash', true] }, '$size', 0] }
          },
          trashFiles: {
            $sum: { $cond: [{ $eq: ['$isTrash', true] }, 1, 0] }
          },
          activeSize: {
            $sum: { $cond: [{ $eq: ['$isTrash', false] }, '$size', 0] }
          },
          activeFiles: {
            $sum: { $cond: [{ $eq: ['$isTrash', false] }, 1, 0] }
          }
        }
      }
    ]),
    Folder.countDocuments({ user: userObjectId, isTrash: false }),
    File.countDocuments({ user: userObjectId, isTrash: false, isStarred: true })
  ]);

  const fStats = fileStats[0] || {
    totalSize: 0,
    totalFiles: 0,
    trashSize: 0,
    trashFiles: 0,
    activeSize: 0,
    activeFiles: 0
  };

  const usedBytes = fStats.totalSize;
  const percentage = Math.min(100, Math.round((usedBytes / LIMIT_BYTES) * 10000) / 100);

  // 2. Phân bổ theo loại tệp tin (File Type Breakdown)
  const typeAgg = await File.aggregate([
    { $match: { user: userObjectId, isTrash: false } },
    {
      $project: {
        size: 1,
        extension: 1,
        mimeType: 1,
        typeGroup: {
          $switch: {
            branches: [
              {
                case: {
                  $or: [
                    { $regexMatch: { input: '$mimeType', regex: '^image/', options: 'i' } },
                    { $in: ['$extension', ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp']] }
                  ]
                },
                then: 'image'
              },
              {
                case: {
                  $or: [
                    { $regexMatch: { input: '$mimeType', regex: 'pdf|word|excel|sheet|presentation|text', options: 'i' } },
                    { $in: ['$extension', ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'csv', 'md']] }
                  ]
                },
                then: 'document'
              },
              {
                case: {
                  $or: [
                    { $regexMatch: { input: '$mimeType', regex: '^video/', options: 'i' } },
                    { $in: ['$extension', ['mp4', 'mkv', 'avi', 'mov', 'wmv']] }
                  ]
                },
                then: 'video'
              },
              {
                case: {
                  $or: [
                    { $regexMatch: { input: '$mimeType', regex: '^audio/', options: 'i' } },
                    { $in: ['$extension', ['mp3', 'wav', 'flac', 'aac']] }
                  ]
                },
                then: 'audio'
              },
              {
                case: {
                  $in: ['$extension', ['zip', 'rar', '7z', 'tar', 'gz']]
                },
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
  ]);

  const TYPE_NAMES = {
    document: { label: 'Tài liệu (Docs, PDF, Sheets)', color: '#3B82F6' },
    image: { label: 'Hình ảnh (Images)', color: '#10B981' },
    video: { label: 'Video', color: '#8B5CF6' },
    audio: { label: 'Âm thanh (Audio)', color: '#F59E0B' },
    archive: { label: 'Tệp nén (Archive)', color: '#EC4899' },
    other: { label: 'Khác', color: '#6B7280' }
  };

  const fileTypeBreakdown = Object.keys(TYPE_NAMES).map((typeKey) => {
    const found = typeAgg.find((item) => item._id === typeKey);
    const size = found ? found.totalSize : 0;
    const count = found ? found.count : 0;
    return {
      type: typeKey,
      label: TYPE_NAMES[typeKey].label,
      color: TYPE_NAMES[typeKey].color,
      count,
      size,
      formattedSize: formatFileSize(size),
      percent: fStats.activeSize > 0 ? Math.round((size / fStats.activeSize) * 100) : 0
    };
  }).filter((item) => item.count > 0 || item.size > 0);

  // 3. Phân bổ theo Danh mục AI (Category Breakdown)
  const categoryAgg = await File.aggregate([
    { $match: { user: userObjectId, isTrash: false } },
    {
      $group: {
        _id: '$aiCategory',
        count: { $sum: 1 },
        totalSize: { $sum: '$size' }
      }
    },
    { $sort: { count: -1 } },
    { $limit: 8 }
  ]);

  const categoryBreakdown = categoryAgg.map((cat, idx) => ({
    name: cat._id || 'Chưa phân loại',
    count: cat.count,
    size: cat.totalSize,
    formattedSize: formatFileSize(cat.totalSize),
    percent: fStats.activeFiles > 0 ? Math.round((cat.count / fStats.activeFiles) * 100) : 0
  }));

  // 4. Xu hướng tải lên theo thời gian (7 ngày qua)
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
  sevenDaysAgo.setHours(0, 0, 0, 0);

  const trendAgg = await File.aggregate([
    {
      $match: {
        user: userObjectId,
        createdAt: { $gte: sevenDaysAgo }
      }
    },
    {
      $group: {
        _id: {
          $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
        },
        count: { $sum: 1 },
        size: { $sum: '$size' }
      }
    },
    { $sort: { _id: 1 } }
  ]);

  // Tạo mảng đủ 7 ngày liên tục kể cả ngày có 0 file
  const timelineTrend = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    const dayLabel = `${d.getDate()}/${d.getMonth() + 1}`;
    const found = trendAgg.find((t) => t._id === dateStr);

    timelineTrend.push({
      date: dateStr,
      label: dayLabel,
      count: found ? found.count : 0,
      size: found ? found.size : 0,
      formattedSize: formatFileSize(found ? found.size : 0)
    });
  }

  // 5. Top 5 tệp có dung lượng lớn nhất
  const largestFiles = await File.find({ user: userObjectId, isTrash: false })
    .sort({ size: -1 })
    .limit(5)
    .select('_id name size mimeType extension createdAt')
    .lean();

  return {
    overview: {
      usedBytes,
      usedFormatted: formatFileSize(usedBytes),
      limitBytes: LIMIT_BYTES,
      limitFormatted: '10 GB',
      percentage,
      totalFiles: fStats.totalFiles,
      activeFiles: fStats.activeFiles,
      activeSize: fStats.activeSize,
      activeFormatted: formatFileSize(fStats.activeSize),
      trashFiles: fStats.trashFiles,
      trashSize: fStats.trashSize,
      trashFormatted: formatFileSize(fStats.trashSize),
      totalFolders,
      totalStarred
    },
    fileTypeBreakdown,
    categoryBreakdown,
    timelineTrend,
    largestFiles: largestFiles.map((f) => ({
      ...f,
      formattedSize: formatFileSize(f.size)
    }))
  };
};

/**
 * Thống kê toàn cảnh hệ thống (Dành riêng cho Quản trị viên)
 */
const getSystemAnalytics = async () => {
  const [totalUsers, activeUsers, systemFiles, totalFolders] = await Promise.all([
    User.countDocuments(),
    User.countDocuments({ isActive: true }),
    File.aggregate([
      {
        $group: {
          _id: null,
          totalSize: { $sum: '$size' },
          totalFiles: { $sum: 1 }
        }
      }
    ]),
    Folder.countDocuments({ isTrash: false })
  ]);

  const sysFiles = systemFiles[0] || { totalSize: 0, totalFiles: 0 };

  // Xếp hạng Top người dùng sử dụng nhiều dung lượng nhất
  const topUsersAgg = await File.aggregate([
    {
      $group: {
        _id: '$user',
        totalSize: { $sum: '$size' },
        totalFiles: { $sum: 1 }
      }
    },
    { $sort: { totalSize: -1 } },
    { $limit: 10 },
    {
      $lookup: {
        from: 'users',
        localField: '_id',
        foreignField: '_id',
        as: 'userInfo'
      }
    },
    { $unwind: '$userInfo' },
    {
      $project: {
        _id: 1,
        totalSize: 1,
        totalFiles: 1,
        name: '$userInfo.name',
        email: '$userInfo.email',
        role: '$userInfo.role'
      }
    }
  ]);

  const topUsers = topUsersAgg.map((u) => ({
    _id: u._id,
    name: u.name,
    email: u.email,
    role: u.role,
    totalFiles: u.totalFiles,
    totalSize: u.totalSize,
    formattedSize: formatFileSize(u.totalSize),
    percentOfServer: sysFiles.totalSize > 0 ? Math.round((u.totalSize / sysFiles.totalSize) * 100) : 0
  }));

  return {
    overview: {
      totalUsers,
      activeUsers,
      totalFiles: sysFiles.totalFiles,
      totalSize: sysFiles.totalSize,
      totalFormatted: formatFileSize(sysFiles.totalSize),
      totalFolders
    },
    topUsers
  };
};

module.exports = {
  getUserAnalytics,
  getSystemAnalytics
};
