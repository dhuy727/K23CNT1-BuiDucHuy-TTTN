const mongoose = require('mongoose');
const File = require('../models/file.model');
const Folder = require('../models/folder.model');
const User = require('../models/user.model');
const { formatFileSize } = require('./file.service');
const { buildFormattedReportXlsx } = require('../utils/xlsxBuilder');

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

/**
 * Xuất dữ liệu thống kê danh sách tệp tin dưới dạng CSV chuẩn UTF-8 (BOM)
 */
const exportFilesCsv = async (userId, role = 'user', scope = 'personal') => {
  const isSystem = role === 'admin' && scope === 'system';
  const filter = isSystem ? {} : { user: userId };

  const query = File.find(filter)
    .populate('folder', 'name')
    .sort({ createdAt: -1 });

  if (isSystem) {
    query.populate('user', 'name email');
  }

  const files = await query.lean();

  const escapeCsv = (val) => {
    if (val === null || val === undefined) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  const formatDate = (date) => {
    if (!date) return '';
    const d = new Date(date);
    return d.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
  };

  // Tiêu đề các cột
  const headers = [
    'STT',
    'Tên tệp tin',
    'Định dạng',
    'Kích thước',
    'Dung lượng (Bytes)',
    'Thư mục',
    'Phân loại AI',
    'Thẻ nhãn AI',
    'Trạng thái AI',
    'Trạng thái RAG',
    'Đánh dấu sao',
    'Trong thùng rác',
    'Ngày tạo',
    'Cập nhật lần cuối'
  ];

  if (isSystem) {
    headers.push('Chủ sở hữu (Email)', 'Họ tên chủ sở hữu');
  }

  const rows = files.map((file, idx) => {
    const row = [
      idx + 1,
      escapeCsv(file.name),
      escapeCsv(file.extension || ''),
      escapeCsv(formatFileSize(file.size)),
      file.size || 0,
      escapeCsv(file.folder?.name || 'Thư mục gốc'),
      escapeCsv(file.aiCategory || 'Chưa phân loại'),
      escapeCsv(Array.isArray(file.aiTags) ? file.aiTags.join(', ') : ''),
      escapeCsv(file.aiStatus || 'chưa xử lý'),
      escapeCsv(file.ragStatus || 'chưa lập chỉ mục'),
      file.isStarred ? 'Có' : 'Không',
      file.isTrash ? 'Có' : 'Không',
      escapeCsv(formatDate(file.createdAt)),
      escapeCsv(formatDate(file.updatedAt))
    ];

    if (isSystem) {
      row.push(escapeCsv(file.user?.email || ''), escapeCsv(file.user?.name || ''));
    }

    return row.join(',');
  });

  // Ký tự BOM (\uFEFF) và CRLF (\r\n) giúp Excel nhận diện chuẩn UTF-8 tiếng Việt và tách cột chính xác
  const headerLine = headers.map(escapeCsv).join(',');
  const csvContent = '\uFEFF' + [headerLine, ...rows].join('\r\n');
  const filename = isSystem
    ? `Bao_Cao_He_Thong_${Date.now()}.csv`
    : `Bao_Cao_Tai_Lieu_${Date.now()}.csv`;

  return {
    csvContent,
    filename,
    totalCount: files.length
  };
};

const AI_STATUS_LABELS = {
  completed: 'Hoàn tất',
  processing: 'Đang xử lý',
  pending: 'Chờ xử lý',
  failed: 'Thất bại',
  skipped: 'Bỏ qua'
};

const RAG_STATUS_LABELS = {
  indexed: 'Đã lập chỉ mục',
  indexing: 'Đang lập chỉ mục',
  pending: 'Chờ lập chỉ mục',
  failed: 'Thất bại',
  unsupported: 'Không hỗ trợ'
};

/**
 * Xuất báo cáo thống kê dưới dạng tệp Excel (.xlsx) chuẩn,
 * chia cột gọn gàng, có tiêu đề, độ rộng cột tự động, màu nền và 2 sheet (Danh sách tệp tin & Tổng quan)
 */
const exportFilesExcel = async (userId, role = 'user', scope = 'personal') => {
  const isSystem = role === 'admin' && scope === 'system';
  const filter = isSystem ? {} : { user: userId };

  const query = File.find(filter)
    .populate('folder', 'name')
    .sort({ createdAt: -1 });

  if (isSystem) {
    query.populate('user', 'name email');
  }

  const files = await query.lean();

  const formatDate = (date) => {
    if (!date) return '';
    const d = new Date(date);
    return d.toLocaleString('vi-VN', {
      timeZone: 'Asia/Ho_Chi_Minh',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const totalBytes = files.reduce((sum, f) => sum + (Number(f.size) || 0), 0);
  const activeCount = files.filter((f) => !f.isTrash).length;
  const trashCount = files.filter((f) => f.isTrash).length;
  const starredCount = files.filter((f) => f.isStarred && !f.isTrash).length;

  const columns = [
    { header: 'STT', width: 7, align: 'center', type: 'number' },
    { header: 'Tên tệp tin', width: 38, align: 'left' },
    { header: 'Định dạng', width: 11, align: 'center' },
    { header: 'Kích thước', width: 13, align: 'right' },
    { header: 'Dung lượng (Bytes)', width: 18, align: 'right', type: 'number' },
    { header: 'Thư mục', width: 18, align: 'left' },
    { header: 'Phân loại AI', width: 18, align: 'left' },
    { header: 'Thẻ nhãn AI', width: 38, align: 'left' },
    { header: 'Trạng thái AI', width: 15, align: 'center' },
    { header: 'Trạng thái RAG', width: 17, align: 'center' },
    { header: 'Gắn sao', width: 10, align: 'center' },
    { header: 'Thùng rác', width: 11, align: 'center' },
    { header: 'Ngày tạo', width: 19, align: 'center' },
    { header: 'Cập nhật lần cuối', width: 19, align: 'center' }
  ];

  if (isSystem) {
    columns.push(
      { header: 'Email chủ sở hữu', width: 26, align: 'left' },
      { header: 'Họ tên chủ sở hữu', width: 22, align: 'left' }
    );
  }

  const rows = files.map((file, idx) => {
    const row = [
      idx + 1,
      file.name || '',
      (file.extension || '').toUpperCase(),
      formatFileSize(file.size || 0),
      Number(file.size) || 0,
      file.folder?.name || 'Thư mục gốc',
      file.aiCategory || 'Chưa phân loại',
      Array.isArray(file.aiTags) ? file.aiTags.join(', ') : '',
      AI_STATUS_LABELS[file.aiStatus] || 'Chưa xử lý',
      RAG_STATUS_LABELS[file.ragStatus] || 'Chưa lập chỉ mục',
      file.isStarred ? 'Có' : 'Không',
      file.isTrash ? 'Có' : 'Không',
      formatDate(file.createdAt),
      formatDate(file.updatedAt)
    ];

    if (isSystem) {
      row.push(file.user?.email || '', file.user?.name || '');
    }

    return row;
  });

  const summaryRow = [
    '',
    `Tổng cộng: ${files.length} tệp tin`,
    '',
    formatFileSize(totalBytes),
    totalBytes,
    '',
    '',
    '',
    '',
    '',
    `${starredCount} sao`,
    `${trashCount} rác`,
    '',
    ''
  ];
  if (isSystem) {
    summaryRow.push('', '');
  }

  // Tổng hợp theo phân loại AI cho Sheet 2 (Tổng quan)
  const categoryMap = new Map();
  for (const f of files) {
    if (f.isTrash) continue;
    const cat = f.aiCategory || 'Chưa phân loại';
    const cur = categoryMap.get(cat) || { count: 0, size: 0 };
    cur.count += 1;
    cur.size += Number(f.size) || 0;
    categoryMap.set(cat, cur);
  }
  const categoryRows = Array.from(categoryMap.entries())
    .sort((a, b) => b[1].count - a[1].count)
    .map(([name, stat], idx) => [
      idx + 1,
      name,
      stat.count,
      formatFileSize(stat.size),
      activeCount > 0 ? `${Math.round((stat.count / activeCount) * 100)}%` : '0%'
    ]);

  const exportedAt = formatDate(new Date());
  const reportTitle = isSystem
    ? 'BÁO CÁO THỐNG KÊ TÀI LIỆU TOÀN HỆ THỐNG - DOCUFLOW'
    : 'BÁO CÁO THỐNG KÊ TÀI LIỆU CÁ NHÂN - DOCUFLOW';
  const reportSubtitle = `Ngày xuất: ${exportedAt}  |  Tổng số tệp: ${files.length} (${activeCount} hoạt động, ${trashCount} thùng rác)  |  Tổng dung lượng: ${formatFileSize(totalBytes)}`;

  const xlsxBuffer = buildFormattedReportXlsx([
    {
      name: 'Danh sách tệp tin',
      title: reportTitle,
      subtitle: reportSubtitle,
      columns,
      rows,
      summaryRow
    },
    {
      name: 'Tổng quan danh mục',
      title: 'TỔNG HỢP PHÂN BỔ THEO DANH MỤC AI',
      subtitle: reportSubtitle,
      columns: [
        { header: 'STT', width: 8, align: 'center', type: 'number' },
        { header: 'Danh mục AI', width: 30, align: 'left' },
        { header: 'Số lượng tệp', width: 16, align: 'right', type: 'number' },
        { header: 'Tổng dung lượng', width: 18, align: 'right' },
        { header: 'Tỷ lệ', width: 12, align: 'center' }
      ],
      rows: categoryRows,
      summaryRow: ['', 'Tổng tài liệu đang hoạt động', activeCount, formatFileSize(totalBytes), '100%']
    }
  ]);

  const filename = isSystem
    ? `Bao_Cao_He_Thong_${Date.now()}.xlsx`
    : `Bao_Cao_Tai_Lieu_${Date.now()}.xlsx`;

  return {
    xlsxBuffer,
    filename,
    totalCount: files.length
  };
};

module.exports = {
  getUserAnalytics,
  getSystemAnalytics,
  exportFilesCsv,
  exportFilesExcel
};
