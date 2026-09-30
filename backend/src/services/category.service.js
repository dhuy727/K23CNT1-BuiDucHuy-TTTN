const mongoose = require('mongoose');
const Category = require('../models/category.model');
const File = require('../models/file.model');
const ApiError = require('../utils/apiError');
const activityService = require('./activity.service');

const DEFAULT_CATEGORIES = [
  { name: 'Báo cáo & Đồ án', color: '#3B82F6', description: 'Tài liệu báo cáo thực tập, đồ án môn học, khóa luận' },
  { name: 'Hợp đồng & Pháp lý', color: '#10B981', description: 'Hợp đồng kinh tế, biên bản làm việc, giấy tờ pháp lý' },
  { name: 'Hóa đơn & Chứng từ', color: '#F59E0B', description: 'Hóa đơn VAT, phiếu thu chi, biên lai giao dịch' },
  { name: 'Tài liệu học tập', color: '#8B5CF6', description: 'Giáo trình, bài tập, slide bài giảng môn học' },
  { name: 'Cá nhân', color: '#EC4899', description: 'Hồ sơ cá nhân, CV, chứng chỉ, văn bằng tốt nghiệp' }
];

/**
 * Lấy danh sách danh mục của người dùng (tự động nạp mẫu nếu chưa có)
 */
const getCategories = async (userId) => {
  const userObjectId = new mongoose.Types.ObjectId(userId);

  let categories = await Category.find({ user: userObjectId }).sort({ createdAt: 1 }).lean();

  // Nếu người dùng chưa có danh mục nào, tự động khởi tạo 5 danh mục mẫu
  if (categories.length === 0) {
    const seedDocs = DEFAULT_CATEGORIES.map((cat) => ({
      ...cat,
      user: userObjectId,
      isDefault: true
    }));
    await Category.insertMany(seedDocs);
    categories = await Category.find({ user: userObjectId }).sort({ createdAt: 1 }).lean();
  }

  // Đếm số lượng tài liệu đang thuộc về từng danh mục
  const fileCounts = await File.aggregate([
    { $match: { user: userObjectId, isTrash: false } },
    { $group: { _id: '$aiCategory', count: { $sum: 1 } } }
  ]);

  const countMap = {};
  fileCounts.forEach((fc) => {
    if (fc._id) countMap[fc._id] = fc.count;
  });

  return categories.map((cat) => ({
    ...cat,
    fileCount: countMap[cat.name] || 0
  }));
};

/**
 * Tạo danh mục mới
 */
const createCategory = async (userId, data) => {
  const { name, color, description } = data;
  if (!name || !name.trim()) {
    throw new ApiError(400, 'Tên danh mục không được để trống');
  }

  const existing = await Category.findOne({
    user: userId,
    name: name.trim()
  });

  if (existing) {
    throw new ApiError(400, `Danh mục "${name.trim()}" đã tồn tại`);
  }

  const category = await Category.create({
    user: userId,
    name: name.trim(),
    color: color || '#3B82F6',
    description: (description || '').trim(),
    isDefault: false
  });

  return category;
};

/**
 * Cập nhật danh mục
 */
const updateCategory = async (userId, categoryId, data) => {
  const category = await Category.findOne({ _id: categoryId, user: userId });
  if (!category) {
    throw new ApiError(404, 'Không tìm thấy danh mục');
  }

  const oldName = category.name;
  const newName = (data.name || '').trim();

  if (newName && newName !== oldName) {
    const existing = await Category.findOne({
      user: userId,
      name: newName,
      _id: { $ne: categoryId }
    });
    if (existing) {
      throw new ApiError(400, `Danh mục "${newName}" đã tồn tại`);
    }

    category.name = newName;

    // Cập nhật đồng bộ các tệp tin có aiCategory cũ sang tên mới
    await File.updateMany(
      { user: userId, aiCategory: oldName },
      { $set: { aiCategory: newName } }
    );
  }

  if (data.color) category.color = data.color.trim();
  if (data.description !== undefined) category.description = (data.description || '').trim();

  await category.save();
  return category;
};

/**
 * Xóa danh mục
 */
const deleteCategory = async (userId, categoryId) => {
  const category = await Category.findOne({ _id: categoryId, user: userId });
  if (!category) {
    throw new ApiError(404, 'Không tìm thấy danh mục');
  }

  const deletedName = category.name;
  await Category.deleteOne({ _id: categoryId });

  // Reset các file thuộc danh mục này về 'Chưa phân loại'
  await File.updateMany(
    { user: userId, aiCategory: deletedName },
    { $set: { aiCategory: 'Chưa phân loại' } }
  );

  return { message: `Đã xóa danh mục "${deletedName}"` };
};

/**
 * Gán danh mục cho một tệp tin
 */
const assignFileCategory = async (userId, fileId, categoryName, reqInfo = {}) => {
  const file = await File.findOne({ _id: fileId, user: userId });
  if (!file) {
    throw new ApiError(404, 'Không tìm thấy tệp tin');
  }

  const prevCategory = file.aiCategory;
  file.aiCategory = (categoryName || 'Chưa phân loại').trim();
  await file.save();

  // Ghi nhật ký thao tác
  activityService.logActivity({
    userId,
    action: 'file_rename',
    targetType: 'file',
    targetId: file._id,
    targetName: file.name,
    description: `Đã đổi danh mục tệp "${file.name}" từ "${prevCategory}" sang "${file.aiCategory}"`,
    metadata: { prevCategory, newCategory: file.aiCategory },
    ip: reqInfo.ip,
    userAgent: reqInfo.userAgent
  });

  return file;
};

module.exports = {
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  assignFileCategory
};
