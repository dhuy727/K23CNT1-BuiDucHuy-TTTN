const mongoose = require('mongoose');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const Share = require('../models/share.model');
const File = require('../models/file.model');
const Folder = require('../models/folder.model');
const User = require('../models/user.model');
const ApiError = require('../utils/apiError');
const { formatFileSize } = require('./file.service');

/**
 * Kiểm tra quyền sở hữu đối với file hoặc folder
 */
const checkItemOwnership = async (userId, itemType, itemId) => {
  if (!mongoose.Types.ObjectId.isValid(itemId)) {
    throw new ApiError(400, `ID ${itemType} không hợp lệ`);
  }

  if (itemType === 'file') {
    const file = await File.findOne({ _id: itemId, user: userId, isTrash: false });
    if (!file) {
      throw new ApiError(404, 'Không tìm thấy tệp tin hoặc bạn không phải là chủ sở hữu');
    }
    return file;
  } else if (itemType === 'folder') {
    const folder = await Folder.findOne({ _id: itemId, user: userId, isTrash: false });
    if (!folder) {
      throw new ApiError(404, 'Không tìm thấy thư mục hoặc bạn không phải là chủ sở hữu');
    }
    return folder;
  } else {
    throw new ApiError(400, "Loại đối tượng chia sẻ không hợp lệ (phải là 'file' hoặc 'folder')");
  }
};

/**
 * 1. Chia sẻ tài liệu/thư mục cho người dùng khác qua Email
 */
const shareWithUser = async (ownerId, { itemType, itemId, email, role = 'viewer' }) => {
  if (!itemType || !itemId || !email) {
    throw new ApiError(400, 'Vui lòng cung cấp đầy đủ loại đối tượng, ID đối tượng và email người nhận');
  }

  const normalizedRole = role.toLowerCase() === 'editor' ? 'editor' : 'viewer';
  const trimmedEmail = email.toLowerCase().trim();

  // Xác thực quyền sở hữu
  const item = await checkItemOwnership(ownerId, itemType, itemId);

  // Tìm người nhận
  const targetUser = await User.findOne({ email: trimmedEmail }).select('_id name email');
  if (!targetUser) {
    throw new ApiError(404, `Không tìm thấy tài khoản người dùng với email '${trimmedEmail}'`);
  }

  // Không cho phép tự chia sẻ cho chính mình
  if (targetUser._id.toString() === ownerId.toString()) {
    throw new ApiError(400, 'Bạn không thể chia sẻ tài liệu cho chính tài khoản của mình');
  }

  // Tìm kiếm bản ghi chia sẻ trước đó nếu có
  const filter = {
    owner: ownerId,
    itemType,
    [itemType]: itemId,
    sharedWith: targetUser._id,
    shareType: 'user'
  };

  let share = await Share.findOne(filter);

  if (share) {
    // Cập nhật vai trò nếu đã từng chia sẻ
    share.role = normalizedRole;
    await share.save();
  } else {
    // Tạo mới bản ghi chia sẻ
    share = new Share({
      owner: ownerId,
      itemType,
      [itemType]: itemId,
      role: normalizedRole,
      shareType: 'user',
      sharedWith: targetUser._id,
      sharedEmail: targetUser.email
    });
    await share.save();
  }

  await share.populate('sharedWith', '_id name email');
  await share.populate(itemType);

  return {
    share,
    message: `Đã chia sẻ ${itemType === 'file' ? 'tệp tin' : 'thư mục'} cho ${targetUser.email} với quyền ${normalizedRole}`
  };
};

/**
 * 2. Cập nhật quyền của cộng tác viên (viewer ↔ editor)
 */
const updateCollaboratorRole = async (ownerId, shareId, newRole) => {
  if (!mongoose.Types.ObjectId.isValid(shareId)) {
    throw new ApiError(400, 'ID chia sẻ không hợp lệ');
  }

  if (!newRole || !['viewer', 'editor'].includes(newRole.toLowerCase())) {
    throw new ApiError(400, "Quyền phân chia không hợp lệ (phải là 'viewer' hoặc 'editor')");
  }

  const share = await Share.findOne({
    _id: shareId,
    owner: ownerId,
    shareType: 'user'
  });

  if (!share) {
    throw new ApiError(404, 'Không tìm thấy thông tin chia sẻ hoặc bạn không có quyền sửa đổi');
  }

  share.role = newRole.toLowerCase();
  await share.save();
  await share.populate('sharedWith', '_id name email');

  return share;
};

/**
 * 3. Thu hồi quyền chia sẻ của một cộng tác viên
 */
const removeCollaborator = async (ownerId, shareId) => {
  if (!mongoose.Types.ObjectId.isValid(shareId)) {
    throw new ApiError(400, 'ID chia sẻ không hợp lệ');
  }

  const share = await Share.findOne({
    _id: shareId,
    owner: ownerId,
    shareType: 'user'
  });

  if (!share) {
    throw new ApiError(404, 'Không tìm thấy thông tin chia sẻ hoặc bạn không có quyền thu hồi');
  }

  await Share.deleteOne({ _id: shareId });

  return {
    message: 'Đã thu hồi quyền chia sẻ thành công',
    shareId
  };
};

/**
 * 4. Tạo hoặc cập nhật liên kết chia sẻ công khai (Public Link)
 */
const createOrUpdatePublicLink = async (
  ownerId,
  { itemType, itemId, role = 'viewer', password = null, expiresAt = null, allowDownload = true }
) => {
  if (!itemType || !itemId) {
    throw new ApiError(400, 'Vui lòng cung cấp loại đối tượng và ID đối tượng');
  }

  await checkItemOwnership(ownerId, itemType, itemId);

  const normalizedRole = role.toLowerCase() === 'editor' ? 'editor' : 'viewer';
  const filter = {
    owner: ownerId,
    itemType,
    [itemType]: itemId,
    shareType: 'public'
  };

  let publicShare = await Share.findOne(filter);

  // Xử lý mật khẩu nếu có
  let hashedPassword = null;
  let hasPassword = false;
  if (password && typeof password === 'string' && password.trim() !== '') {
    hashedPassword = await bcrypt.hash(password.trim(), 10);
    hasPassword = true;
  } else if (publicShare && publicShare.hasPassword && password === undefined) {
    // Giữ nguyên mật khẩu cũ nếu không truyền password mới
    hashedPassword = publicShare.password;
    hasPassword = true;
  }

  // Xử lý ngày hết hạn
  let validExpiresAt = null;
  if (expiresAt) {
    const d = new Date(expiresAt);
    if (!isNaN(d.getTime())) {
      validExpiresAt = d;
    }
  }

  if (publicShare) {
    publicShare.role = normalizedRole;
    publicShare.hasPassword = hasPassword;
    publicShare.password = hashedPassword;
    publicShare.expiresAt = validExpiresAt;
    publicShare.allowDownload = allowDownload !== false;
    publicShare.isPublic = true;
    await publicShare.save();
  } else {
    // Sinh token ngẫu nhiên duy nhất
    const shareToken = crypto.randomBytes(16).toString('hex');
    publicShare = new Share({
      owner: ownerId,
      itemType,
      [itemType]: itemId,
      role: normalizedRole,
      shareType: 'public',
      shareToken,
      hasPassword,
      password: hashedPassword,
      expiresAt: validExpiresAt,
      allowDownload: allowDownload !== false,
      isPublic: true
    });
    await publicShare.save();
  }

  return {
    shareToken: publicShare.shareToken,
    shareUrl: `/api/shares/public/${publicShare.shareToken}`,
    role: publicShare.role,
    hasPassword: publicShare.hasPassword,
    expiresAt: publicShare.expiresAt,
    allowDownload: publicShare.allowDownload,
    isPublic: publicShare.isPublic
  };
};

/**
 * 5. Tắt / hủy liên kết chia sẻ công khai
 */
const revokePublicLink = async (ownerId, itemType, itemId) => {
  await checkItemOwnership(ownerId, itemType, itemId);

  const result = await Share.deleteOne({
    owner: ownerId,
    itemType,
    [itemType]: itemId,
    shareType: 'public'
  });

  return {
    message: 'Đã tắt và hủy liên kết chia sẻ công khai thành công',
    deleted: result.deletedCount > 0
  };
};

/**
 * 6. Lấy danh sách chia sẻ của một tệp hoặc thư mục cụ thể (cho chủ sở hữu quản lý)
 */
const getItemShares = async (ownerId, itemType, itemId) => {
  await checkItemOwnership(ownerId, itemType, itemId);

  const [collaborators, publicLink] = await Promise.all([
    Share.find({
      owner: ownerId,
      itemType,
      [itemType]: itemId,
      shareType: 'user'
    })
      .populate('sharedWith', '_id name email')
      .lean(),
    Share.findOne({
      owner: ownerId,
      itemType,
      [itemType]: itemId,
      shareType: 'public',
      isPublic: true
    }).lean()
  ]);

  return {
    collaborators: collaborators.map((c) => ({
      shareId: c._id,
      user: c.sharedWith,
      role: c.role,
      createdAt: c.createdAt
    })),
    publicLink: publicLink
      ? {
          shareToken: publicLink.shareToken,
          shareUrl: `/api/shares/public/${publicLink.shareToken}`,
          role: publicLink.role,
          hasPassword: publicLink.hasPassword,
          expiresAt: publicLink.expiresAt,
          allowDownload: publicLink.allowDownload
        }
      : null
  };
};

/**
 * 7. Truy cập tệp hoặc thư mục qua liên kết công khai (Public Access)
 */
const getPublicItem = async (shareToken, providedPassword = null) => {
  if (!shareToken) {
    throw new ApiError(400, 'Mã token chia sẻ không hợp lệ');
  }

  const share = await Share.findOne({
    shareToken,
    shareType: 'public',
    isPublic: true
  }).populate('owner', '_id name email');

  if (!share) {
    throw new ApiError(404, 'Liên kết chia sẻ không tồn tại hoặc đã bị vô hiệu hóa');
  }

  // Kiểm tra thời hạn hết hạn
  if (share.expiresAt && new Date() > new Date(share.expiresAt)) {
    throw new ApiError(410, 'Liên kết chia sẻ này đã hết hạn truy cập');
  }

  // Kiểm tra mật khẩu bảo vệ nếu có
  if (share.hasPassword) {
    if (!providedPassword) {
      return {
        requiresPassword: true,
        itemType: share.itemType,
        owner: share.owner ? share.owner.name : 'Người dùng',
        message: 'Liên kết này được bảo vệ bằng mật khẩu. Vui lòng nhập mật khẩu để truy cập.'
      };
    }

    const isMatch = await bcrypt.compare(providedPassword, share.password);
    if (!isMatch) {
      throw new ApiError(401, 'Mật khẩu truy cập liên kết không chính xác');
    }
  }

  // Trả về dữ liệu chi tiết
  if (share.itemType === 'file') {
    const file = await File.findOne({ _id: share.file, isTrash: false }).populate('user', '_id name email').lean();
    if (!file) {
      throw new ApiError(404, 'Tệp tin được chia sẻ không còn tồn tại hoặc đã bị xóa');
    }

    return {
      requiresPassword: false,
      itemType: 'file',
      role: share.role,
      allowDownload: share.allowDownload,
      item: {
        ...file,
        formattedSize: formatFileSize(file.size)
      }
    };
  } else {
    const folder = await Folder.findOne({ _id: share.folder, isTrash: false }).populate('user', '_id name email').lean();
    if (!folder) {
      throw new ApiError(404, 'Thư mục được chia sẻ không còn tồn tại hoặc đã bị xóa');
    }

    // Lấy danh sách tệp tin và thư mục con cấp 1 trực thuộc
    const [subfolders, files] = await Promise.all([
      Folder.find({ parent: folder._id, isTrash: false }).lean(),
      File.find({ folder: folder._id, isTrash: false }).lean()
    ]);

    return {
      requiresPassword: false,
      itemType: 'folder',
      role: share.role,
      allowDownload: share.allowDownload,
      item: folder,
      subfolders,
      files: files.map((f) => ({
        ...f,
        formattedSize: formatFileSize(f.size)
      }))
    };
  }
};

/**
 * 8. Tải tệp tin qua liên kết công khai (Public Download)
 */
const getPublicFileDownload = async (shareToken, providedPassword = null) => {
  const result = await getPublicItem(shareToken, providedPassword);

  if (result.requiresPassword) {
    throw new ApiError(401, 'Vui lòng cung cấp mật khẩu truy cập để tải tệp tin');
  }

  if (result.allowDownload === false) {
    throw new ApiError(403, 'Chủ sở hữu đã khóa tính năng tải xuống đối với liên kết này');
  }

  if (result.itemType !== 'file') {
    throw new ApiError(400, 'Liên kết này chia sẻ thư mục, không thể tải trực tiếp như một tệp tin đơn lẻ');
  }

  const file = result.item;
  if (!file.storagePath || !fs.existsSync(file.storagePath)) {
    throw new ApiError(404, 'Tệp tin vật lý không tồn tại trên hệ thống lưu trữ');
  }

  return {
    filePath: file.storagePath,
    downloadName: file.name || file.originalName,
    mimeType: file.mimeType
  };
};

/**
 * 9. Xem trước tệp tin inline qua liên kết công khai (Public Preview)
 */
const getPublicFilePreview = async (shareToken, providedPassword = null) => {
  const result = await getPublicItem(shareToken, providedPassword);

  if (result.requiresPassword) {
    throw new ApiError(401, 'Vui lòng cung cấp mật khẩu truy cập để xem trước tệp tin');
  }

  if (result.itemType !== 'file') {
    throw new ApiError(400, 'Liên kết này chia sẻ thư mục, không thể xem trước trực tiếp như một tệp tin');
  }

  const file = result.item;
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
 * 10. Danh sách tài liệu & thư mục được chia sẻ với tôi (Shared With Me)
 */
const getSharedWithMe = async (userId, query = {}) => {
  const filter = {
    sharedWith: userId,
    shareType: 'user'
  };

  if (query.itemType && ['file', 'folder'].includes(query.itemType.toLowerCase())) {
    filter.itemType = query.itemType.toLowerCase();
  }

  const page = parseInt(query.page, 10) || 1;
  const limit = parseInt(query.limit, 10) || 20;
  const skip = (page - 1) * limit;

  const [shares, total] = await Promise.all([
    Share.find(filter)
      .populate('owner', '_id name email')
      .populate({
        path: 'file',
        match: { isTrash: false },
        populate: { path: 'folder', select: '_id name' }
      })
      .populate({
        path: 'folder',
        match: { isTrash: false }
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Share.countDocuments(filter)
  ]);

  // Lọc bỏ những share mà file hoặc folder gốc đã bị xóa vào thùng rác
  const activeShares = shares.filter((s) => (s.itemType === 'file' ? s.file : s.folder));

  const formattedShares = activeShares.map((s) => ({
    shareId: s._id,
    itemType: s.itemType,
    role: s.role,
    owner: s.owner,
    createdAt: s.createdAt,
    item: s.itemType === 'file' ? {
      ...s.file,
      formattedSize: formatFileSize(s.file.size)
    } : s.folder
  }));

  return {
    shares: formattedShares,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1
    }
  };
};

/**
 * 11. Danh sách tài liệu & thư mục do tôi chia sẻ (Shared By Me)
 */
const getSharedByMe = async (userId, query = {}) => {
  const filter = {
    owner: userId
  };

  if (query.shareType && ['user', 'public'].includes(query.shareType.toLowerCase())) {
    filter.shareType = query.shareType.toLowerCase();
  }

  const page = parseInt(query.page, 10) || 1;
  const limit = parseInt(query.limit, 10) || 20;
  const skip = (page - 1) * limit;

  const [shares, total] = await Promise.all([
    Share.find(filter)
      .populate('sharedWith', '_id name email')
      .populate({
        path: 'file',
        match: { isTrash: false }
      })
      .populate({
        path: 'folder',
        match: { isTrash: false }
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Share.countDocuments(filter)
  ]);

  const activeShares = shares.filter((s) => (s.itemType === 'file' ? s.file : s.folder));

  const formattedShares = activeShares.map((s) => ({
    shareId: s._id,
    itemType: s.itemType,
    shareType: s.shareType,
    role: s.role,
    sharedWith: s.sharedWith,
    shareToken: s.shareToken,
    shareUrl: s.shareToken ? `/api/shares/public/${s.shareToken}` : null,
    hasPassword: s.hasPassword,
    expiresAt: s.expiresAt,
    allowDownload: s.allowDownload,
    createdAt: s.createdAt,
    item: s.itemType === 'file' ? {
      ...s.file,
      formattedSize: formatFileSize(s.file.size)
    } : s.folder
  }));

  return {
    shares: formattedShares,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1
    }
  };
};

module.exports = {
  checkItemOwnership,
  shareWithUser,
  updateCollaboratorRole,
  removeCollaborator,
  createOrUpdatePublicLink,
  revokePublicLink,
  getItemShares,
  getPublicItem,
  getPublicFileDownload,
  getPublicFilePreview,
  getSharedWithMe,
  getSharedByMe
};
