const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const File = require('../models/file.model');
const Folder = require('../models/folder.model');
const Share = require('../models/share.model');
const ApiError = require('../utils/apiError');
const { UPLOAD_DIR } = require('../middlewares/upload.middleware');

/**
 * Định dạng kích thước tệp tin sang dạng đọc thân thiện (Bytes, KB, MB, GB)
 */
const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

/**
 * Chuẩn hóa ID thư mục và xác thực sự tồn tại
 */
const normalizeAndValidateFolder = async (userId, folderId) => {
  if (!folderId || folderId === 'root' || folderId === 'null' || folderId === '') {
    return null;
  }

  if (!mongoose.Types.ObjectId.isValid(folderId)) {
    throw new ApiError(400, 'ID thư mục không hợp lệ');
  }

  const folder = await Folder.findOne({ _id: folderId, user: userId, isTrash: false });
  if (!folder) {
    throw new ApiError(404, 'Thư mục không tồn tại hoặc đã bị chuyển vào thùng rác');
  }

  return folder._id;
};

/**
 * 1. Tải lên 1 tệp tin đơn lẻ (Single File Upload)
 */
const uploadFile = async (userId, file, body = {}) => {
  if (!file) {
    throw new ApiError(400, 'Vui lòng chọn tệp tin cần tải lên');
  }

  // Xác thực thư mục đích
  const targetFolderId = await normalizeAndValidateFolder(userId, body.folderId);

  // Tên hiển thị của file (mặc định lấy theo tên gốc nếu không chỉ định)
  const ext = path.extname(file.originalname).toLowerCase();
  let displayName = (body.name && typeof body.name === 'string' && body.name.trim() !== '')
    ? body.name.trim()
    : file.originalname;

  // Nếu tên không chứa extension thì thêm extension gốc vào
  if (ext && !displayName.toLowerCase().endsWith(ext)) {
    displayName = `${displayName}${ext}`;
  }

  // Tự động thêm hậu tố (1), (2)... nếu tên file đã tồn tại trong cùng thư mục
  let uniqueName = displayName;
  let counter = 1;
  const nameWithoutExt = ext ? displayName.slice(0, -ext.length) : displayName;

  while (await File.findOne({ user: userId, folder: targetFolderId, name: uniqueName, isTrash: false })) {
    uniqueName = `${nameWithoutExt} (${counter})${ext}`;
    counter++;
  }

  // Xử lý danh mục AI và thẻ tag nếu có
  let tags = [];
  if (body.aiTags) {
    if (Array.isArray(body.aiTags)) {
      tags = body.aiTags;
    } else if (typeof body.aiTags === 'string') {
      try {
        tags = JSON.parse(body.aiTags);
      } catch {
        tags = body.aiTags.split(',').map((t) => t.trim()).filter(Boolean);
      }
    }
  }

  const newFile = new File({
    name: uniqueName,
    originalName: file.originalname,
    user: userId,
    folder: targetFolderId,
    size: file.size,
    mimeType: file.mimetype || 'application/octet-stream',
    extension: ext.replace('.', ''),
    storagePath: file.path,
    aiCategory: body.aiCategory || 'Chưa phân loại',
    aiTags: tags,
    aiSummary: body.aiSummary || '',
    aiStatus: 'pending',
    isTrash: false
  });

  await newFile.save();
  require('./ai.service').enqueueProcess(newFile._id);
  await newFile.populate('folder', '_id name path color');

  return {
    ...newFile.toObject(),
    formattedSize: formatFileSize(newFile.size)
  };
};

/**
 * 2. Tải lên nhiều tệp tin cùng lúc (Multiple Files Upload)
 */
const uploadMultipleFiles = async (userId, files, body = {}) => {
  if (!files || !Array.isArray(files) || files.length === 0) {
    throw new ApiError(400, 'Vui lòng chọn ít nhất một tệp tin');
  }

  const targetFolderId = await normalizeAndValidateFolder(userId, body.folderId);
  const uploadedFiles = [];

  for (const file of files) {
    const ext = path.extname(file.originalname).toLowerCase();
    let displayName = file.originalname;

    let uniqueName = displayName;
    let counter = 1;
    const nameWithoutExt = ext ? displayName.slice(0, -ext.length) : displayName;

    while (await File.findOne({ user: userId, folder: targetFolderId, name: uniqueName, isTrash: false })) {
      uniqueName = `${nameWithoutExt} (${counter})${ext}`;
      counter++;
    }

    const newFile = new File({
      name: uniqueName,
      originalName: file.originalname,
      user: userId,
      folder: targetFolderId,
      size: file.size,
      mimeType: file.mimetype || 'application/octet-stream',
      extension: ext.replace('.', ''),
      storagePath: file.path,
      aiCategory: body.aiCategory || 'Chưa phân loại',
      aiStatus: 'pending',
      isTrash: false
    });

    await newFile.save();
    require('./ai.service').enqueueProcess(newFile._id);
    uploadedFiles.push({
      ...newFile.toObject(),
      formattedSize: formatFileSize(newFile.size)
    });
  }

  return {
    count: uploadedFiles.length,
    files: uploadedFiles
  };
};

/**
 * 3. Lấy danh sách tệp tin (Lọc theo folder, tìm kiếm, lọc loại file, AI category, phân trang)
 */
const getFiles = async (userId, query = {}) => {
  const filter = {
    user: userId,
    isTrash: false
  };

  // Lọc theo thư mục
  if (query.folderId !== undefined) {
    if (query.folderId === 'root' || query.folderId === 'null' || query.folderId === '') {
      filter.folder = null;
    } else if (query.folderId !== 'all') {
      if (!mongoose.Types.ObjectId.isValid(query.folderId)) {
        throw new ApiError(400, 'ID thư mục không hợp lệ');
      }
      filter.folder = query.folderId;
    }
  }

  // Tìm kiếm theo từ khóa (tên tệp tin, AI summary, AI tags)
  if (query.search && query.search.trim() !== '') {
    const searchRegex = new RegExp(query.search.trim(), 'i');
    filter.$or = [
      { name: searchRegex },
      { originalName: searchRegex },
      { aiSummary: searchRegex },
      { aiTags: { $in: [searchRegex] } }
    ];
  }

  // Lọc theo phân loại AI (Category)
  if (query.aiCategory) {
    filter.aiCategory = query.aiCategory;
  }

  // Lọc theo trạng thái yêu thích
  if (query.isStarred !== undefined) {
    filter.isStarred = query.isStarred === 'true' || query.isStarred === true;
  }

  // Lọc theo nhóm định dạng tệp tin (image, document, video, audio, archive)
  if (query.type) {
    switch (query.type.toLowerCase()) {
      case 'image':
        filter.mimeType = { $regex: '^image/', $options: 'i' };
        break;
      case 'video':
        filter.mimeType = { $regex: '^video/', $options: 'i' };
        break;
      case 'audio':
        filter.mimeType = { $regex: '^audio/', $options: 'i' };
        break;
      case 'pdf':
        filter.mimeType = { $regex: 'pdf', $options: 'i' };
        break;
      case 'document':
        filter.$or = [
          { mimeType: { $regex: 'pdf|word|excel|sheet|powerpoint|text|presentation|msword', $options: 'i' } },
          { extension: { $in: ['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'pdf', 'csv', 'md'] } }
        ];
        break;
      case 'archive':
        filter.extension = { $in: ['zip', 'rar', '7z', 'tar', 'gz'] };
        break;
      default:
        break;
    }
  }

  // Sắp xếp
  const sortOptions = {};
  const sortBy = query.sortBy || 'createdAt';
  const sortOrder = query.sortOrder === 'asc' ? 1 : -1;
  sortOptions[sortBy] = sortOrder;

  // Phân trang
  const page = parseInt(query.page, 10) || 1;
  const limit = parseInt(query.limit, 10) || 20;
  const skip = (page - 1) * limit;

  const [files, total] = await Promise.all([
    File.find(filter)
      .populate('folder', '_id name path color')
      .sort(sortOptions)
      .skip(skip)
      .limit(limit)
      .lean(),
    File.countDocuments(filter)
  ]);

  const formattedFiles = files.map((f) => ({
    ...f,
    formattedSize: formatFileSize(f.size)
  }));

  return {
    files: formattedFiles,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    }
  };
};

/**
 * Kiểm tra quyền truy cập file (Chủ sở hữu hoặc Người dùng được chia sẻ)
 */
const checkFileAccess = async (userId, fileId) => {
  if (!mongoose.Types.ObjectId.isValid(fileId)) {
    return null;
  }

  const file = await File.findOne({ _id: fileId, isTrash: false });
  if (!file) return null;

  // 1. Là chủ sở hữu
  if (file.user.toString() === userId.toString()) {
    return { file, role: 'owner' };
  }

  // 2. Được chia sẻ trực tiếp với userId
  const directShare = await Share.findOne({
    file: fileId,
    itemType: 'file',
    shareType: 'user',
    sharedWith: userId
  });
  if (directShare) {
    return { file, role: directShare.role, share: directShare };
  }

  // 3. Nằm trong thư mục được chia sẻ với userId
  if (file.folder) {
    const parentFolder = await Folder.findOne({ _id: file.folder, isTrash: false });
    if (parentFolder) {
      const pathIds = (parentFolder.path || '')
        .split('/')
        .filter((id) => id && mongoose.Types.ObjectId.isValid(id));
      pathIds.push(parentFolder._id.toString());

      const folderShare = await Share.findOne({
        folder: { $in: pathIds },
        itemType: 'folder',
        shareType: 'user',
        sharedWith: userId
      });
      if (folderShare) {
        return { file, role: folderShare.role, share: folderShare };
      }
    }
  }

  return null;
};

/**
 * 4. Xem chi tiết thông tin tệp tin
 */
const getFileById = async (userId, fileId, query = {}) => {
  if (!mongoose.Types.ObjectId.isValid(fileId)) {
    throw new ApiError(400, 'ID tệp tin không hợp lệ');
  }

  const access = await checkFileAccess(userId, fileId);
  if (!access) {
    throw new ApiError(404, 'Không tìm thấy tệp tin hoặc bạn không có quyền truy cập');
  }

  let fileQuery = File.findById(fileId)
    .populate('folder', '_id name path color')
    .populate('user', '_id name email');

  if (query.includeText === 'true' || query.includeText === true) {
    fileQuery = fileQuery.select('+extractedText');
  }

  const file = await fileQuery.lean();

  return {
    ...file,
    formattedSize: formatFileSize(file.size),
    accessRole: access.role
  };
};

/**
 * 5. Chuẩn bị file để tải xuống (Download)
 */
const getFileForDownload = async (userId, fileId) => {
  if (!mongoose.Types.ObjectId.isValid(fileId)) {
    throw new ApiError(400, 'ID tệp tin không hợp lệ');
  }

  const access = await checkFileAccess(userId, fileId);
  if (!access) {
    throw new ApiError(404, 'Không tìm thấy tệp tin hoặc bạn không có quyền truy cập');
  }

  const file = access.file;

  // Kiểm tra file vật lý trên đĩa
  if (!file.storagePath || !fs.existsSync(file.storagePath)) {
    throw new ApiError(404, 'Tệp tin vật lý không tồn tại trên hệ thống lưu trữ');
  }

  return {
    file,
    filePath: file.storagePath,
    downloadName: file.name || file.originalName,
    mimeType: file.mimeType
  };
};

/**
 * 6. Chuẩn bị file để xem trước trực tiếp inline (Preview)
 */
const getFileForPreview = async (userId, fileId) => {
  if (!mongoose.Types.ObjectId.isValid(fileId)) {
    throw new ApiError(400, 'ID tệp tin không hợp lệ');
  }

  const access = await checkFileAccess(userId, fileId);
  if (!access) {
    throw new ApiError(404, 'Không tìm thấy tệp tin hoặc bạn không có quyền truy cập');
  }

  const file = access.file;

  if (!file.storagePath || !fs.existsSync(file.storagePath)) {
    throw new ApiError(404, 'Tệp tin vật lý không tồn tại trên hệ thống lưu trữ');
  }

  return {
    file,
    filePath: file.storagePath,
    mimeType: file.mimeType || 'application/octet-stream'
  };
};

/**
 * 7. Đổi tên tệp tin (Rename)
 */
const renameFile = async (userId, fileId, newName) => {
  if (!mongoose.Types.ObjectId.isValid(fileId)) {
    throw new ApiError(400, 'ID tệp tin không hợp lệ');
  }

  if (!newName || typeof newName !== 'string' || newName.trim() === '') {
    throw new ApiError(400, 'Tên tệp tin mới không được để trống');
  }

  const file = await File.findOne({ _id: fileId, user: userId, isTrash: false });
  if (!file) {
    throw new ApiError(404, 'Không tìm thấy tệp tin');
  }

  let trimmedName = newName.trim();
  // Giữ lại phần mở rộng nếu người dùng không điền extension
  if (file.extension && !trimmedName.toLowerCase().endsWith(`.${file.extension.toLowerCase()}`)) {
    trimmedName = `${trimmedName}.${file.extension}`;
  }

  if (file.name === trimmedName) {
    return file;
  }

  // Kiểm tra trùng tên trong cùng thư mục
  const duplicate = await File.findOne({
    user: userId,
    folder: file.folder,
    name: trimmedName,
    _id: { $ne: fileId },
    isTrash: false
  });

  if (duplicate) {
    throw new ApiError(409, `Đã tồn tại tệp tin có tên '${trimmedName}' trong cùng thư mục`);
  }

  file.name = trimmedName;
  await file.save();

  return {
    ...file.toObject(),
    formattedSize: formatFileSize(file.size)
  };
};

/**
 * 8. Di chuyển tệp tin sang thư mục khác (Move)
 */
const moveFile = async (userId, fileId, targetFolderId) => {
  if (!mongoose.Types.ObjectId.isValid(fileId)) {
    throw new ApiError(400, 'ID tệp tin không hợp lệ');
  }

  const file = await File.findOne({ _id: fileId, user: userId, isTrash: false });
  if (!file) {
    throw new ApiError(404, 'Không tìm thấy tệp tin');
  }

  const normalizedTargetId = await normalizeAndValidateFolder(userId, targetFolderId);

  // Nếu vị trí đích giống vị trí hiện tại
  const isSameFolder = (file.folder === null && normalizedTargetId === null) ||
    (file.folder && normalizedTargetId && file.folder.toString() === normalizedTargetId.toString());

  if (isSameFolder) {
    return file;
  }

  // Kiểm tra trùng tên tại thư mục đích
  const duplicate = await File.findOne({
    user: userId,
    folder: normalizedTargetId,
    name: file.name,
    _id: { $ne: fileId },
    isTrash: false
  });

  if (duplicate) {
    throw new ApiError(409, `Thư mục đích đã tồn tại tệp tin có tên '${file.name}'`);
  }

  file.folder = normalizedTargetId;
  await file.save();
  await file.populate('folder', '_id name path color');

  return {
    ...file.toObject(),
    formattedSize: formatFileSize(file.size)
  };
};

/**
 * 9. Sao chép tệp tin (Copy)
 */
const copyFile = async (userId, fileId, targetFolderId = undefined) => {
  if (!mongoose.Types.ObjectId.isValid(fileId)) {
    throw new ApiError(400, 'ID tệp tin không hợp lệ');
  }

  const originalFile = await File.findOne({ _id: fileId, user: userId, isTrash: false });
  if (!originalFile) {
    throw new ApiError(404, 'Không tìm thấy tệp tin cần sao chép');
  }

  // Nếu không truyền targetFolderId thì sao chép vào cùng thư mục với file gốc
  const destinationFolderId = targetFolderId !== undefined
    ? await normalizeAndValidateFolder(userId, targetFolderId)
    : originalFile.folder;

  // Kiểm tra file vật lý
  if (!originalFile.storagePath || !fs.existsSync(originalFile.storagePath)) {
    throw new ApiError(404, 'Tệp tin vật lý gốc không tồn tại trên hệ thống lưu trữ');
  }

  // Tạo file vật lý mới trên ổ đĩa
  const extWithDot = originalFile.extension ? `.${originalFile.extension}` : '';
  const newFilename = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${extWithDot}`;
  const newStoragePath = path.join(UPLOAD_DIR, newFilename);

  await fs.promises.copyFile(originalFile.storagePath, newStoragePath);

  // Tạo tên hiển thị cho bản sao (ví dụ: Bản sao của abc.pdf hoặc abc (Copy).pdf)
  const ext = originalFile.extension ? `.${originalFile.extension}` : '';
  const baseName = ext ? originalFile.name.slice(0, -ext.length) : originalFile.name;
  let copyName = `${baseName} - Copy${ext}`;
  let counter = 1;

  while (await File.findOne({ user: userId, folder: destinationFolderId, name: copyName, isTrash: false })) {
    copyName = `${baseName} - Copy (${counter})${ext}`;
    counter++;
  }

  const clonedFile = new File({
    name: copyName,
    originalName: originalFile.originalName,
    user: userId,
    folder: destinationFolderId,
    size: originalFile.size,
    mimeType: originalFile.mimeType,
    extension: originalFile.extension,
    storagePath: newStoragePath,
    aiCategory: originalFile.aiCategory,
    aiTags: originalFile.aiTags,
    aiSummary: originalFile.aiSummary,
    aiStatus: originalFile.aiStatus,
    isStarred: false,
    isTrash: false
  });

  await clonedFile.save();
  await clonedFile.populate('folder', '_id name path color');

  return {
    ...clonedFile.toObject(),
    formattedSize: formatFileSize(clonedFile.size)
  };
};

/**
 * 10. Xóa tệp tin (Chuyển vào thùng rác hoặc Xóa vĩnh viễn)
 */
const deleteFile = async (userId, fileId, permanent = false) => {
  if (!mongoose.Types.ObjectId.isValid(fileId)) {
    throw new ApiError(400, 'ID tệp tin không hợp lệ');
  }

  const file = await File.findOne({ _id: fileId, user: userId });
  if (!file) {
    throw new ApiError(404, 'Không tìm thấy tệp tin');
  }

  if (permanent) {
    // Xóa file vật lý trên đĩa
    if (file.storagePath && fs.existsSync(file.storagePath)) {
      try {
        await fs.promises.unlink(file.storagePath);
      } catch (err) {
        console.error('Lỗi khi xóa file vật lý:', err);
      }
    }

    await File.deleteOne({ _id: fileId, user: userId });

    return {
      message: 'Đã xóa vĩnh viễn tệp tin khỏi hệ thống',
      fileId
    };
  } else {
    // Soft delete: Chuyển vào thùng rác
    file.isTrash = true;
    await file.save();

    return {
      message: 'Đã chuyển tệp tin vào thùng rác',
      fileId
    };
  }
};

/**
 * 11. Lấy danh sách tệp tin trong thùng rác (Trash List)
 */
const getTrashFiles = async (userId, query = {}) => {
  const filter = {
    user: userId,
    isTrash: true
  };

  if (query.search) {
    filter.name = { $regex: query.search, $options: 'i' };
  }

  const page = parseInt(query.page, 10) || 1;
  const limit = parseInt(query.limit, 10) || 20;
  const skip = (page - 1) * limit;

  const [files, total] = await Promise.all([
    File.find(filter)
      .populate('folder', '_id name path color')
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    File.countDocuments(filter)
  ]);

  const formattedFiles = files.map((f) => ({
    ...f,
    formattedSize: formatFileSize(f.size)
  }));

  return {
    files: formattedFiles,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    }
  };
};

/**
 * 12. Khôi phục tệp tin từ thùng rác (Restore)
 */
const restoreFile = async (userId, fileId) => {
  if (!mongoose.Types.ObjectId.isValid(fileId)) {
    throw new ApiError(400, 'ID tệp tin không hợp lệ');
  }

  const file = await File.findOne({ _id: fileId, user: userId, isTrash: true });
  if (!file) {
    throw new ApiError(404, 'Không tìm thấy tệp tin trong thùng rác');
  }

  let note = null;

  // Kiểm tra xem thư mục cha của file có còn tồn tại và không nằm trong trash không
  if (file.folder) {
    const parentFolder = await Folder.findOne({ _id: file.folder, user: userId, isTrash: false });
    if (!parentFolder) {
      // Thư mục cha đã bị xóa hoặc đang ở trong thùng rác -> Tự động đưa về thư mục gốc (Root)
      file.folder = null;
      note = 'Thư mục cha của tệp tin này đã bị xóa hoặc đang ở trong thùng rác. Tệp tin đã được khôi phục về Thư mục gốc.';
    }
  }

  file.isTrash = false;
  await file.save();
  await file.populate('folder', '_id name path color');

  return {
    file: {
      ...file.toObject(),
      formattedSize: formatFileSize(file.size)
    },
    message: note || 'Khôi phục tệp tin thành công'
  };
};

/**
 * 13. Dọn sạch toàn bộ thùng rác (Empty Trash)
 */
const emptyTrash = async (userId) => {
  const trashFiles = await File.find({ user: userId, isTrash: true });

  // Xóa các file vật lý trên đĩa
  for (const file of trashFiles) {
    if (file.storagePath && fs.existsSync(file.storagePath)) {
      try {
        await fs.promises.unlink(file.storagePath);
      } catch (err) {
        console.error(`Lỗi khi xóa file vật lý ${file.storagePath}:`, err);
      }
    }
  }

  const deleteResult = await File.deleteMany({ user: userId, isTrash: true });

  return {
    message: `Đã dọn sạch thùng rác (${deleteResult.deletedCount} tệp tin đã bị xóa vĩnh viễn)`,
    deletedCount: deleteResult.deletedCount
  };
};

/**
 * 14. Đánh dấu sao yêu thích / bỏ yêu thích (Toggle Star)
 */
const toggleStar = async (userId, fileId) => {
  if (!mongoose.Types.ObjectId.isValid(fileId)) {
    throw new ApiError(400, 'ID tệp tin không hợp lệ');
  }

  const file = await File.findOne({ _id: fileId, user: userId, isTrash: false });
  if (!file) {
    throw new ApiError(404, 'Không tìm thấy tệp tin');
  }

  file.isStarred = !file.isStarred;
  await file.save();

  return {
    ...file.toObject(),
    formattedSize: formatFileSize(file.size)
  };
};

/**
 * 15. Lấy thống kê dung lượng lưu trữ của người dùng (Giới hạn 10GB)
 */
const getStorageStats = async (userId) => {
  const stats = await File.aggregate([
    { $match: { user: new mongoose.Types.ObjectId(userId) } },
    {
      $group: {
        _id: null,
        totalSize: { $sum: '$size' },
        totalFiles: { $sum: 1 },
        trashSize: {
          $sum: {
            $cond: [{ $eq: ['$isTrash', true] }, '$size', 0]
          }
        },
        trashFiles: {
          $sum: {
            $cond: [{ $eq: ['$isTrash', true] }, 1, 0]
          }
        }
      }
    }
  ]);

  const usedBytes = stats.length > 0 ? stats[0].totalSize : 0;
  const totalFiles = stats.length > 0 ? stats[0].totalFiles : 0;
  const trashBytes = stats.length > 0 ? stats[0].trashSize : 0;
  const trashFiles = stats.length > 0 ? stats[0].trashFiles : 0;
  const limitBytes = 10 * 1024 * 1024 * 1024; // Giới hạn 10 GB

  const percentage = limitBytes > 0 ? Math.min(100, Math.round((usedBytes / limitBytes) * 10000) / 100) : 0;

  return {
    usedBytes,
    limitBytes,
    usedFormatted: formatFileSize(usedBytes),
    limitFormatted: '10 GB',
    percentage,
    totalFiles,
    trashBytes,
    trashFiles,
    trashFormatted: formatFileSize(trashBytes),
    activeBytes: usedBytes - trashBytes,
    activeFiles: totalFiles - trashFiles,
    activeFormatted: formatFileSize(usedBytes - trashBytes)
  };
};

module.exports = {
  formatFileSize,
  checkFileAccess,
  uploadFile,
  uploadMultipleFiles,
  getFiles,
  getFileById,
  getFileForDownload,
  getFileForPreview,
  renameFile,
  moveFile,
  copyFile,
  deleteFile,
  getTrashFiles,
  restoreFile,
  emptyTrash,
  toggleStar,
  getStorageStats
};

