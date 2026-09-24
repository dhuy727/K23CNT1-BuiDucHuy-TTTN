const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const Version = require('../models/version.model');
const File = require('../models/file.model');
const ApiError = require('../utils/apiError');
const { UPLOAD_DIR } = require('../middlewares/upload.middleware');
const { formatFileSize } = require('./file.service');
const storageService = require('./storage.service');

/**
 * Lấy số thứ tự phiên bản tiếp theo cho một file
 */
const getNextVersionNumber = async (fileId) => {
  const latest = await Version.findOne({ file: fileId })
    .sort({ versionNumber: -1 })
    .lean();
  return latest ? latest.versionNumber + 1 : 1;
};

/**
 * Định dạng một version document để trả về API
 */
const formatVersion = (v) => ({
  ...v,
  formattedSize: formatFileSize(v.size)
});

// ─────────────────────────────────────────────────────────────
// 1. Tạo phiên bản mới (Create Version)
//    Snapshot file vật lý hiện tại và lưu metadata vào DB.
// ─────────────────────────────────────────────────────────────
const createVersion = async (userId, fileId, body = {}) => {
  if (!mongoose.Types.ObjectId.isValid(fileId)) {
    throw new ApiError(400, 'ID tệp tin không hợp lệ');
  }

  // Lấy file gốc (chỉ file không ở thùng rác)
  const file = await File.findOne({ _id: fileId, user: userId, isTrash: false });
  if (!file) {
    throw new ApiError(404, 'Không tìm thấy tệp tin hoặc tệp tin đã bị xóa');
  }

  // Tạo bản sao lưu trữ (snapshot)
  const copyStorage = await storageService.copyFile(file, `ver-${file.originalName}`);

  const versionNumber = await getNextVersionNumber(fileId);

  const version = new Version({
    file: fileId,
    user: userId,
    versionNumber,
    name: file.name,
    originalName: file.originalName,
    size: file.size,
    mimeType: file.mimeType,
    extension: file.extension,
    storagePath: copyStorage.storagePath,
    storageType: copyStorage.storageType,
    storageKey: copyStorage.storageKey,
    note: body.note ? body.note.trim() : '',
    changeType: body.changeType || 'manual'
  });

  await version.save();

  return formatVersion(version.toObject());
};

// ─────────────────────────────────────────────────────────────
// 2. Lấy danh sách phiên bản (List Versions)
// ─────────────────────────────────────────────────────────────
const getVersions = async (userId, fileId, query = {}) => {
  if (!mongoose.Types.ObjectId.isValid(fileId)) {
    throw new ApiError(400, 'ID tệp tin không hợp lệ');
  }

  // Kiểm tra quyền truy cập file
  const file = await File.findOne({ _id: fileId, user: userId }).lean();
  if (!file) {
    throw new ApiError(404, 'Không tìm thấy tệp tin');
  }

  const page = parseInt(query.page, 10) || 1;
  const limit = parseInt(query.limit, 10) || 20;
  const skip = (page - 1) * limit;

  const [versions, total] = await Promise.all([
    Version.find({ file: fileId, user: userId })
      .sort({ versionNumber: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Version.countDocuments({ file: fileId, user: userId })
  ]);

  return {
    fileId,
    fileName: file.name,
    versions: versions.map(formatVersion),
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    }
  };
};

// ─────────────────────────────────────────────────────────────
// 3. Xem chi tiết một phiên bản (Get Version Detail)
// ─────────────────────────────────────────────────────────────
const getVersionById = async (userId, fileId, versionId) => {
  if (!mongoose.Types.ObjectId.isValid(fileId)) {
    throw new ApiError(400, 'ID tệp tin không hợp lệ');
  }
  if (!mongoose.Types.ObjectId.isValid(versionId)) {
    throw new ApiError(400, 'ID phiên bản không hợp lệ');
  }

  // Kiểm tra quyền truy cập file
  const file = await File.findOne({ _id: fileId, user: userId }).lean();
  if (!file) {
    throw new ApiError(404, 'Không tìm thấy tệp tin');
  }

  const version = await Version.findOne({
    _id: versionId,
    file: fileId,
    user: userId
  }).lean();

  if (!version) {
    throw new ApiError(404, 'Không tìm thấy phiên bản');
  }

  return formatVersion(version);
};

// ─────────────────────────────────────────────────────────────
// 4. Chuẩn bị dữ liệu tải xuống phiên bản (Download Version)
// ─────────────────────────────────────────────────────────────
const getVersionForDownload = async (userId, fileId, versionId) => {
  if (!mongoose.Types.ObjectId.isValid(fileId)) {
    throw new ApiError(400, 'ID tệp tin không hợp lệ');
  }
  if (!mongoose.Types.ObjectId.isValid(versionId)) {
    throw new ApiError(400, 'ID phiên bản không hợp lệ');
  }

  // Kiểm tra quyền truy cập file
  const file = await File.findOne({ _id: fileId, user: userId }).lean();
  if (!file) {
    throw new ApiError(404, 'Không tìm thấy tệp tin');
  }

  const version = await Version.findOne({
    _id: versionId,
    file: fileId,
    user: userId
  }).lean();

  if (!version) {
    throw new ApiError(404, 'Không tìm thấy phiên bản');
  }

  const fileStream = await storageService.getFileStream(version);
  const ext = version.extension ? `.${version.extension}` : '';
  const downloadName = `${version.name} (v${version.versionNumber})${ext}`;

  return {
    version,
    fileStream,
    downloadName,
    mimeType: version.mimeType || 'application/octet-stream'
  };
};

// ─────────────────────────────────────────────────────────────
// 5. Khôi phục file về phiên bản cũ (Restore Version)
//    Ghi đè file vật lý hiện tại và cập nhật metadata trong DB.
//    Trước khi restore, tự động tạo version của trạng thái hiện tại.
// ─────────────────────────────────────────────────────────────
const restoreVersion = async (userId, fileId, versionId) => {
  if (!mongoose.Types.ObjectId.isValid(fileId)) {
    throw new ApiError(400, 'ID tệp tin không hợp lệ');
  }
  if (!mongoose.Types.ObjectId.isValid(versionId)) {
    throw new ApiError(400, 'ID phiên bản không hợp lệ');
  }

  // Lấy file gốc đang hoạt động
  const file = await File.findOne({ _id: fileId, user: userId, isTrash: false });
  if (!file) {
    throw new ApiError(404, 'Không tìm thấy tệp tin hoặc tệp tin đã bị xóa');
  }

  // Lấy version muốn khôi phục
  const targetVersion = await Version.findOne({
    _id: versionId,
    file: fileId,
    user: userId
  });
  if (!targetVersion) {
    throw new ApiError(404, 'Không tìm thấy phiên bản');
  }

  // Tự động snapshot trạng thái HIỆN TẠI trước khi ghi đè
  try {
    const currentSnapshot = await storageService.copyFile(file, `ver-${file.originalName}`);
    const currentVersionNumber = await getNextVersionNumber(fileId);
    const currentVersion = new Version({
      file: fileId,
      user: userId,
      versionNumber: currentVersionNumber,
      name: file.name,
      originalName: file.originalName,
      size: file.size,
      mimeType: file.mimeType,
      extension: file.extension,
      storagePath: currentSnapshot.storagePath,
      storageType: currentSnapshot.storageType,
      storageKey: currentSnapshot.storageKey,
      note: `Tự động lưu trước khi khôi phục về phiên bản v${targetVersion.versionNumber}`,
      changeType: 'restore'
    });
    await currentVersion.save();
  } catch (snapErr) {
    console.warn('[VersionService] Lỗi tạo snapshot hiện tại trước khi restore:', snapErr.message);
  }

  // Khôi phục bản sao từ targetVersion sang file hiện tại
  const restoredStorage = await storageService.copyFile(targetVersion, file.originalName);
  file.storagePath = restoredStorage.storagePath;
  file.storageType = restoredStorage.storageType;
  file.storageKey = restoredStorage.storageKey;

  // Cập nhật metadata file gốc theo version cũ
  file.size = targetVersion.size;
  file.mimeType = targetVersion.mimeType;
  file.originalName = targetVersion.originalName;
  // Không đổi tên hiển thị (name) của file gốc
  await file.save();
  await file.populate('folder', '_id name path color');

  return {
    message: `Đã khôi phục tệp tin về phiên bản v${targetVersion.versionNumber} thành công`,
    restoredVersion: targetVersion.versionNumber,
    file: {
      ...file.toObject(),
      formattedSize: formatFileSize(file.size)
    }
  };
};

// ─────────────────────────────────────────────────────────────
// 6. Xóa một phiên bản (Delete Version)
//    Xóa bản ghi DB và file vật lý snapshot trên đĩa.
// ─────────────────────────────────────────────────────────────
const deleteVersion = async (userId, fileId, versionId) => {
  if (!mongoose.Types.ObjectId.isValid(fileId)) {
    throw new ApiError(400, 'ID tệp tin không hợp lệ');
  }
  if (!mongoose.Types.ObjectId.isValid(versionId)) {
    throw new ApiError(400, 'ID phiên bản không hợp lệ');
  }

  // Kiểm tra quyền truy cập file
  const file = await File.findOne({ _id: fileId, user: userId }).lean();
  if (!file) {
    throw new ApiError(404, 'Không tìm thấy tệp tin');
  }

  const version = await Version.findOne({
    _id: versionId,
    file: fileId,
    user: userId
  });
  if (!version) {
    throw new ApiError(404, 'Không tìm thấy phiên bản');
  }

  await storageService.deleteFile(version);

  await Version.deleteOne({ _id: versionId });

  return {
    message: `Đã xóa phiên bản v${version.versionNumber} thành công`,
    versionId
  };
};

module.exports = {
  createVersion,
  getVersions,
  getVersionById,
  getVersionForDownload,
  restoreVersion,
  deleteVersion
};
