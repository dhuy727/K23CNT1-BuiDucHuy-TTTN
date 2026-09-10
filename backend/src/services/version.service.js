const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const Version = require('../models/version.model');
const File = require('../models/file.model');
const ApiError = require('../utils/apiError');
const { UPLOAD_DIR } = require('../middlewares/upload.middleware');
const { formatFileSize } = require('./file.service');

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

  // Kiểm tra file vật lý có tồn tại không
  if (!file.storagePath || !fs.existsSync(file.storagePath)) {
    throw new ApiError(404, 'Tệp tin vật lý không tồn tại trên hệ thống lưu trữ');
  }

  // Tạo bản sao vật lý (snapshot) với tên ngẫu nhiên để tránh ghi đè
  const extWithDot = file.extension ? `.${file.extension}` : '';
  const snapshotFilename = `ver-${Date.now()}-${crypto.randomBytes(8).toString('hex')}${extWithDot}`;
  const snapshotPath = path.join(UPLOAD_DIR, snapshotFilename);

  await fs.promises.copyFile(file.storagePath, snapshotPath);

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
    storagePath: snapshotPath,
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

  // Kiểm tra file snapshot vật lý
  if (!version.storagePath || !fs.existsSync(version.storagePath)) {
    throw new ApiError(404, 'Tệp tin vật lý của phiên bản không còn tồn tại trên hệ thống lưu trữ');
  }

  const ext = version.extension ? `.${version.extension}` : '';
  const downloadName = `${version.name} (v${version.versionNumber})${ext}`;

  return {
    version,
    filePath: version.storagePath,
    downloadName,
    mimeType: version.mimeType
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

  // Kiểm tra file snapshot có tồn tại không
  if (!targetVersion.storagePath || !fs.existsSync(targetVersion.storagePath)) {
    throw new ApiError(404, 'File vật lý của phiên bản này không còn tồn tại');
  }

  // Tự động snapshot trạng thái HIỆN TẠI trước khi ghi đè
  if (file.storagePath && fs.existsSync(file.storagePath)) {
    const extNow = file.extension ? `.${file.extension}` : '';
    const snapshotFilename = `ver-${Date.now()}-${crypto.randomBytes(8).toString('hex')}${extNow}`;
    const snapshotPath = path.join(UPLOAD_DIR, snapshotFilename);
    await fs.promises.copyFile(file.storagePath, snapshotPath);

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
      storagePath: snapshotPath,
      note: `Tự động lưu trước khi khôi phục về phiên bản v${targetVersion.versionNumber}`,
      changeType: 'restore'
    });
    await currentVersion.save();
  }

  // Ghi đè file vật lý hiện tại bằng snapshot của version được chọn
  await fs.promises.copyFile(targetVersion.storagePath, file.storagePath);

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

  // Xóa file vật lý snapshot trên đĩa
  if (version.storagePath && fs.existsSync(version.storagePath)) {
    try {
      await fs.promises.unlink(version.storagePath);
    } catch (err) {
      console.error('Lỗi khi xóa file snapshot vật lý:', err);
    }
  }

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
