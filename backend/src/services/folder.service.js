const mongoose = require('mongoose');
const Folder = require('../models/folder.model');
const File = require('../models/file.model');
const ApiError = require('../utils/apiError');

/**
 * 1. Tạo thư mục mới
 */
const createFolder = async (userId, { name, parentId = null, color, description }) => {
  if (!name || typeof name !== 'string' || name.trim() === '') {
    throw new ApiError(400, 'Tên thư mục không được để trống');
  }

  const trimmedName = name.trim();
  let parentFolder = null;
  let targetParentId = null;

  // Nếu có truyền parentId (khác null, rỗng hoặc 'root')
  if (parentId && parentId !== 'root') {
    if (!mongoose.Types.ObjectId.isValid(parentId)) {
      throw new ApiError(400, 'ID thư mục cha không hợp lệ');
    }
    parentFolder = await Folder.findOne({ _id: parentId, user: userId, isTrash: false });
    if (!parentFolder) {
      throw new ApiError(404, 'Thư mục cha không tồn tại hoặc đã bị chuyển vào thùng rác');
    }
    targetParentId = parentFolder._id;
  }

  // Kiểm tra trùng tên trong cùng thư mục cha
  const existing = await Folder.findOne({
    user: userId,
    parent: targetParentId,
    name: trimmedName,
    isTrash: false
  });

  if (existing) {
    throw new ApiError(409, `Thư mục có tên '${trimmedName}' đã tồn tại trong vị trí này`);
  }

  // Khởi tạo thư mục mới
  const newFolder = new Folder({
    name: trimmedName,
    user: userId,
    parent: targetParentId,
    color: color || '#3B82F6',
    description: description || ''
  });

  // Tạo đường dẫn phân cấp: / hoặc /parentPath/id/
  newFolder.path = parentFolder ? `${parentFolder.path}${newFolder._id}/` : `/${newFolder._id}/`;
  await newFolder.save();

  return newFolder;
};

/**
 * 2. Lấy danh sách thư mục (hỗ trợ lọc theo parentId, tìm kiếm và phân trang)
 */
const getFolders = async (userId, query = {}) => {
  const filter = {
    user: userId,
    isTrash: false
  };

  // Lọc theo thư mục cha
  if (query.parentId !== undefined) {
    if (query.parentId === 'root' || query.parentId === 'null' || query.parentId === '') {
      filter.parent = null;
    } else {
      if (!mongoose.Types.ObjectId.isValid(query.parentId)) {
        throw new ApiError(400, 'ID thư mục cha không hợp lệ');
      }
      filter.parent = query.parentId;
    }
  }

  // Tìm kiếm theo tên thư mục
  if (query.search) {
    filter.name = { $regex: query.search, $options: 'i' };
  }

  const page = parseInt(query.page, 10) || 1;
  const limit = parseInt(query.limit, 10) || 50;
  const skip = (page - 1) * limit;

  const [folders, total] = await Promise.all([
    Folder.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Folder.countDocuments(filter)
  ]);

  return {
    folders,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    }
  };
};

/**
 * 3. Chi tiết thư mục (kèm Breadcrumb đường dẫn cha-con và Thống kê)
 */
const getFolderById = async (userId, folderId) => {
  if (!mongoose.Types.ObjectId.isValid(folderId)) {
    throw new ApiError(400, 'ID thư mục không hợp lệ');
  }

  const folder = await Folder.findOne({ _id: folderId, user: userId, isTrash: false });
  if (!folder) {
    throw new ApiError(404, 'Không tìm thấy thư mục');
  }

  // Tạo Breadcrumb dựa vào chuỗi path
  const pathIds = (folder.path || '')
    .split('/')
    .filter((id) => id && mongoose.Types.ObjectId.isValid(id));

  const ancestorFolders = await Folder.find({
    _id: { $in: pathIds },
    user: userId
  })
    .select('_id name parent')
    .lean();

  const folderMap = new Map(ancestorFolders.map((f) => [f._id.toString(), f]));
  const breadcrumb = [
    { _id: 'root', name: 'Thư mục gốc' },
    ...pathIds.map((id) => folderMap.get(id)).filter(Boolean)
  ];

  // Thống kê số lượng thư mục con, số lượng file và tổng dung lượng
  const [subfoldersCount, filesCount, sizeStats] = await Promise.all([
    Folder.countDocuments({ user: userId, parent: folderId, isTrash: false }),
    File.countDocuments({ user: userId, folder: folderId, isTrash: false }),
    File.aggregate([
      { $match: { user: new mongoose.Types.ObjectId(userId), folder: new mongoose.Types.ObjectId(folderId), isTrash: false } },
      { $group: { _id: null, totalSize: { $sum: '$size' } } }
    ])
  ]);

  const totalSize = sizeStats.length > 0 ? sizeStats[0].totalSize : 0;

  return {
    folder,
    breadcrumb,
    statistics: {
      subfoldersCount,
      filesCount,
      totalSize
    }
  };
};

/**
 * 4. Đổi tên thư mục
 */
const renameFolder = async (userId, folderId, newName) => {
  if (!mongoose.Types.ObjectId.isValid(folderId)) {
    throw new ApiError(400, 'ID thư mục không hợp lệ');
  }

  if (!newName || typeof newName !== 'string' || newName.trim() === '') {
    throw new ApiError(400, 'Tên thư mục mới không được để trống');
  }

  const trimmedName = newName.trim();
  const folder = await Folder.findOne({ _id: folderId, user: userId, isTrash: false });
  if (!folder) {
    throw new ApiError(404, 'Không tìm thấy thư mục');
  }

  if (folder.name === trimmedName) {
    return folder;
  }

  // Kiểm tra trùng tên trong cùng thư mục cha
  const duplicate = await Folder.findOne({
    user: userId,
    parent: folder.parent,
    name: trimmedName,
    _id: { $ne: folderId },
    isTrash: false
  });

  if (duplicate) {
    throw new ApiError(409, `Đã tồn tại thư mục có tên '${trimmedName}' trong cùng vị trí`);
  }

  folder.name = trimmedName;
  await folder.save();

  return folder;
};

/**
 * 5. Di chuyển thư mục (kèm thuật toán chống đệ quy lặp vòng Cycle Prevention)
 */
const moveFolder = async (userId, folderId, targetParentId) => {
  if (!mongoose.Types.ObjectId.isValid(folderId)) {
    throw new ApiError(400, 'ID thư mục cần di chuyển không hợp lệ');
  }

  const folder = await Folder.findOne({ _id: folderId, user: userId, isTrash: false });
  if (!folder) {
    throw new ApiError(404, 'Không tìm thấy thư mục cần di chuyển');
  }

  let newParent = null;
  let normalizedParentId = null;

  if (targetParentId && targetParentId !== 'root') {
    if (!mongoose.Types.ObjectId.isValid(targetParentId)) {
      throw new ApiError(400, 'ID thư mục đích không hợp lệ');
    }

    // 1. Không thể di chuyển thư mục vào chính nó
    if (targetParentId.toString() === folderId.toString()) {
      throw new ApiError(400, 'Không thể di chuyển thư mục vào chính nó');
    }

    newParent = await Folder.findOne({ _id: targetParentId, user: userId, isTrash: false });
    if (!newParent) {
      throw new ApiError(404, 'Thư mục đích không tồn tại');
    }

    // 2. Chống đệ quy chu trình: Không cho phép di chuyển thư mục vào bất kỳ thư mục con cháu nào của nó
    if (newParent.path.startsWith(folder.path)) {
      throw new ApiError(400, 'Không thể di chuyển một thư mục vào trong thư mục con của chính nó');
    }

    normalizedParentId = newParent._id;
  }

  // Không cần làm gì nếu vị trí cha không thay đổi
  const isSameParent = (folder.parent === null && normalizedParentId === null) ||
    (folder.parent && normalizedParentId && folder.parent.toString() === normalizedParentId.toString());

  if (isSameParent) {
    return folder;
  }

  // Kiểm tra trùng tên tại thư mục đích
  const duplicate = await Folder.findOne({
    user: userId,
    parent: normalizedParentId,
    name: folder.name,
    _id: { $ne: folderId },
    isTrash: false
  });

  if (duplicate) {
    throw new ApiError(409, `Thư mục đích đã có thư mục cùng tên '${folder.name}'`);
  }

  const oldPath = folder.path;
  const newPath = newParent ? `${newParent.path}${folder._id}/` : `/${folder._id}/`;

  // Cập nhật đường dẫn cho toàn bộ các thư mục con cháu đệ quy
  const descendants = await Folder.find({
    user: userId,
    path: { $regex: `^${oldPath}` },
    _id: { $ne: folder._id }
  });

  for (const child of descendants) {
    child.path = child.path.replace(oldPath, newPath);
    await child.save();
  }

  // Cập nhật thư mục chính
  folder.parent = normalizedParentId;
  folder.path = newPath;
  await folder.save();

  return folder;
};

/**
 * 6. Xóa thư mục (Xóa đệ quy toàn bộ thư mục con và các file liên quan)
 */
const deleteFolder = async (userId, folderId, permanent = false) => {
  if (!mongoose.Types.ObjectId.isValid(folderId)) {
    throw new ApiError(400, 'ID thư mục không hợp lệ');
  }

  const folder = await Folder.findOne({ _id: folderId, user: userId });
  if (!folder) {
    throw new ApiError(404, 'Không tìm thấy thư mục');
  }

  // Tìm tất cả các thư mục con cháu có đường dẫn bắt đầu bằng path của thư mục này
  const descendants = await Folder.find({
    user: userId,
    path: { $regex: `^${folder.path}` }
  }).select('_id');

  const allFolderIds = descendants.map((f) => f._id);
  if (!allFolderIds.some((id) => id.toString() === folder._id.toString())) {
    allFolderIds.push(folder._id);
  }

  if (permanent) {
    // Xóa vĩnh viễn khỏi Database
    await Promise.all([
      File.deleteMany({ user: userId, folder: { $in: allFolderIds } }),
      Folder.deleteMany({ user: userId, _id: { $in: allFolderIds } })
    ]);

    return {
      message: 'Đã xóa vĩnh viễn thư mục và toàn bộ dữ liệu bên trong',
      deletedFoldersCount: allFolderIds.length
    };
  } else {
    // Chuyển vào thùng rác (Soft delete)
    await Promise.all([
      File.updateMany({ user: userId, folder: { $in: allFolderIds } }, { isTrash: true }),
      Folder.updateMany({ user: userId, _id: { $in: allFolderIds } }, { isTrash: true })
    ]);

    return {
      message: 'Đã chuyển thư mục và tất cả nội dung con vào thùng rác',
      trashedFoldersCount: allFolderIds.length
    };
  }
};

/**
 * 7. Lấy cây thư mục (Folder Tree) dạng phân cấp lồng nhau
 */
const getFolderTree = async (userId, rootParentId = null) => {
  const folders = await Folder.find({
    user: userId,
    isTrash: false
  })
    .sort({ name: 1 })
    .lean();

  const folderMap = new Map();
  const tree = [];

  // Tạo map chứa các node
  folders.forEach((folder) => {
    folderMap.set(folder._id.toString(), {
      ...folder,
      children: []
    });
  });

  // Ráp các nhánh con vào cha
  folders.forEach((folder) => {
    const node = folderMap.get(folder._id.toString());
    if (folder.parent) {
      const parentNode = folderMap.get(folder.parent.toString());
      if (parentNode) {
        parentNode.children.push(node);
      } else {
        // Trường hợp parent không nằm trong danh sách (vd root filter)
        tree.push(node);
      }
    } else {
      tree.push(node);
    }
  });

  return tree;
};

/**
 * 8. Lấy danh sách file con nằm trong thư mục
 */
const getFolderFiles = async (userId, folderId, query = {}) => {
  let targetFolderId = null;
  let folderInfo = null;

  if (folderId && folderId !== 'root') {
    if (!mongoose.Types.ObjectId.isValid(folderId)) {
      throw new ApiError(400, 'ID thư mục không hợp lệ');
    }
    folderInfo = await Folder.findOne({ _id: folderId, user: userId, isTrash: false });
    if (!folderInfo) {
      throw new ApiError(404, 'Không tìm thấy thư mục');
    }
    targetFolderId = folderInfo._id;
  }

  const filter = {
    user: userId,
    folder: targetFolderId,
    isTrash: false
  };

  if (query.search) {
    filter.name = { $regex: query.search, $options: 'i' };
  }

  if (query.aiCategory) {
    filter.aiCategory = query.aiCategory;
  }

  const page = parseInt(query.page, 10) || 1;
  const limit = parseInt(query.limit, 10) || 50;
  const skip = (page - 1) * limit;

  const [files, total] = await Promise.all([
    File.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    File.countDocuments(filter)
  ]);

  return {
    folder: folderInfo || { _id: 'root', name: 'Thư mục gốc', path: '/' },
    files,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    }
  };
};

module.exports = {
  createFolder,
  getFolders,
  getFolderById,
  renameFolder,
  moveFolder,
  deleteFolder,
  getFolderTree,
  getFolderFiles
};
