const mongoose = require('mongoose');
const Activity = require('../models/activity.model');

/**
 * Ghi nhật ký thao tác một cách an toàn (không làm gián đoạn luồng chính nếu lỗi)
 */
const logActivity = async ({
  userId,
  action,
  targetType = 'file',
  targetId = null,
  targetName = '',
  description = '',
  metadata = {},
  ip = '',
  userAgent = ''
}) => {
  try {
    if (!userId || !action) {
      return null;
    }

    const activity = await Activity.create({
      user: userId,
      action,
      targetType,
      targetId: targetId && mongoose.Types.ObjectId.isValid(targetId) ? targetId : null,
      targetName: (targetName || '').trim(),
      description: description || `Thực hiện thao tác ${action}`,
      metadata: metadata || {},
      ip: ip || '',
      userAgent: userAgent || ''
    });

    return activity;
  } catch (error) {
    console.error('[ActivityLog Error] Không thể ghi log:', error.message);
    return null;
  }
};

/**
 * Xử lý khoảng thời gian lọc
 */
const resolveTimeFilter = (timeRange, startDate, endDate) => {
  const filter = {};
  const now = new Date();

  if (timeRange) {
    switch (timeRange) {
      case 'today': {
        const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        filter.$gte = start;
        break;
      }
      case 'yesterday': {
        const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
        const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 23, 59, 59, 999);
        filter.$gte = start;
        filter.$lte = end;
        break;
      }
      case '7days': {
        const start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        filter.$gte = start;
        break;
      }
      case '30days': {
        const start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        filter.$gte = start;
        break;
      }
      case 'thismonth': {
        const start = new Date(now.getFullYear(), now.getMonth(), 1);
        filter.$gte = start;
        break;
      }
      default:
        break;
    }
  } else {
    if (startDate) {
      const s = new Date(startDate);
      if (!isNaN(s.getTime())) filter.$gte = s;
    }
    if (endDate) {
      const e = new Date(endDate);
      if (!isNaN(e.getTime())) filter.$lte = e;
    }
  }

  return Object.keys(filter).length > 0 ? filter : null;
};

/**
 * Nhóm hành động
 */
const ACTION_GROUPS = {
  files: [
    'file_upload',
    'file_download',
    'file_preview',
    'file_rename',
    'file_move',
    'file_copy',
    'file_trash',
    'file_restore',
    'file_delete_permanent',
    'file_star',
    'file_share'
  ],
  folders: [
    'folder_create',
    'folder_rename',
    'folder_move',
    'folder_trash',
    'folder_restore',
    'folder_delete_permanent'
  ],
  auth: ['auth_login', 'auth_logout', 'auth_password_change'],
  admin: ['admin_user_update', 'admin_user_delete']
};

/**
 * Lấy danh sách lịch sử thao tác có phân trang và bộ lọc
 */
const getActivities = async ({
  userId,
  isAdmin = false,
  isSystem = false,
  filterUserId = null,
  action = '',
  actionGroup = '',
  timeRange = '',
  startDate = null,
  endDate = null,
  search = '',
  page = 1,
  limit = 20
}) => {
  const query = {};

  // Phân quyền: Nếu là tra cứu toàn hệ thống và người gọi là Admin
  if (isSystem && isAdmin) {
    if (filterUserId && mongoose.Types.ObjectId.isValid(filterUserId)) {
      query.user = new mongoose.Types.ObjectId(filterUserId);
    }
  } else {
    // Ngược lại, người dùng chỉ xem được lịch sử của chính họ
    query.user = new mongoose.Types.ObjectId(userId);
  }

  // Lọc theo nhóm hành động hoặc hành động cụ thể
  if (action) {
    query.action = action;
  } else if (actionGroup && ACTION_GROUPS[actionGroup]) {
    query.action = { $in: ACTION_GROUPS[actionGroup] };
  }

  // Lọc theo thời gian
  const timeFilter = resolveTimeFilter(timeRange, startDate, endDate);
  if (timeFilter) {
    query.createdAt = timeFilter;
  }

  // Lọc theo từ khóa tìm kiếm (tên đối tượng hoặc mô tả)
  if (search && search.trim()) {
    const sRegex = new RegExp(search.trim(), 'i');
    query.$or = [{ targetName: sRegex }, { description: sRegex }, { ip: sRegex }];
  }

  const p = Math.max(1, parseInt(page, 10) || 1);
  const l = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const skip = (p - 1) * l;

  const [items, total] = await Promise.all([
    Activity.find(query)
      .populate('user', '_id name email role')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(l)
      .lean(),
    Activity.countDocuments(query)
  ]);

  return {
    items,
    pagination: {
      page: p,
      limit: l,
      total,
      totalPages: Math.ceil(total / l) || 1
    }
  };
};

module.exports = {
  logActivity,
  getActivities,
  ACTION_GROUPS
};
