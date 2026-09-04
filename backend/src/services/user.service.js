const User = require('../models/user.model');
const ApiError = require('../utils/apiError');

/**
 * Lấy danh sách người dùng có hỗ trợ phân trang và tìm kiếm
 */
const getAllUsers = async (query = {}) => {
  const page = parseInt(query.page, 10) || 1;
  const limit = parseInt(query.limit, 10) || 10;
  const skip = (page - 1) * limit;

  const filter = {};

  // Tìm kiếm theo từ khóa tên hoặc email
  if (query.search) {
    filter.$or = [
      { name: { $regex: query.search, $options: 'i' } },
      { email: { $regex: query.search, $options: 'i' } }
    ];
  }

  // Lọc theo role
  if (query.role) {
    filter.role = query.role;
  }

  // Lọc theo trạng thái active
  if (query.isActive !== undefined) {
    filter.isActive = query.isActive === 'true' || query.isActive === true;
  }

  const [users, total] = await Promise.all([
    User.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    User.countDocuments(filter)
  ]);

  const totalPages = Math.ceil(total / limit);

  return {
    users,
    pagination: {
      total,
      page,
      limit,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1
    }
  };
};

/**
 * Lấy chi tiết thông tin người dùng theo ID
 */
const getUserById = async (id) => {
  const user = await User.findById(id);
  if (!user) {
    throw new ApiError(404, `Không tìm thấy người dùng với ID: ${id}`);
  }
  return user;
};

/**
 * Cập nhật thông tin người dùng
 */
const updateUser = async (id, updateData, currentUser) => {
  // Kiểm tra quyền: chỉ Admin hoặc chính chủ tài khoản mới được cập nhật
  if (currentUser.role !== 'admin' && currentUser._id.toString() !== id) {
    throw new ApiError(403, 'Bạn không có quyền chỉnh sửa thông tin người dùng khác');
  }

  const user = await User.findById(id);
  if (!user) {
    throw new ApiError(404, `Không tìm thấy người dùng với ID: ${id}`);
  }

  // Không cho phép đổi password qua hàm này (dùng changeUserPassword)
  delete updateData.password;
  delete updateData.refreshToken;

  // Nếu không phải admin, không được tự nâng role của mình
  if (currentUser.role !== 'admin') {
    delete updateData.role;
    delete updateData.isActive;
  }

  // Nếu cập nhật email, kiểm tra xem email mới đã bị trùng chưa
  if (updateData.email && updateData.email.toLowerCase() !== user.email) {
    const emailExists = await User.findOne({
      email: updateData.email.toLowerCase(),
      _id: { $ne: id }
    });
    if (emailExists) {
      throw new ApiError(409, 'Email này đã được sử dụng bởi tài khoản khác');
    }
    updateData.email = updateData.email.toLowerCase();
  }

  Object.assign(user, updateData);
  await user.save();

  return user;
};

/**
 * Xóa người dùng (Chỉ dành cho Admin)
 */
const deleteUser = async (id, currentUserId) => {
  if (id === currentUserId.toString()) {
    throw new ApiError(400, 'Bạn không thể tự xóa tài khoản của chính mình thông qua API quản trị này');
  }

  const user = await User.findByIdAndDelete(id);
  if (!user) {
    throw new ApiError(404, `Không tìm thấy người dùng với ID: ${id}`);
  }

  return { message: 'Đã xóa người dùng thành công' };
};

/**
 * Đổi mật khẩu
 */
const changePassword = async (userId, { currentPassword, newPassword }) => {
  if (!currentPassword || !newPassword) {
    throw new ApiError(400, 'Vui lòng cung cấp đầy đủ mật khẩu hiện tại và mật khẩu mới');
  }

  if (newPassword.length < 6) {
    throw new ApiError(400, 'Mật khẩu mới phải có ít nhất 6 ký tự');
  }

  const user = await User.findById(userId).select('+password');
  if (!user) {
    throw new ApiError(404, 'Không tìm thấy người dùng');
  }

  const isMatch = await user.comparePassword(currentPassword);
  if (!isMatch) {
    throw new ApiError(400, 'Mật khẩu hiện tại không chính xác');
  }

  user.password = newPassword;
  // Xóa refreshToken cũ để buộc các phiên đăng nhập khác phải đăng nhập lại
  user.refreshToken = null;
  await user.save();

  return { message: 'Đổi mật khẩu thành công. Vui lòng đăng nhập lại trên các thiết bị.' };
};

/**
 * Lấy thông tin cá nhân của người dùng hiện tại
 */
const getProfile = async (userId) => {
  const user = await User.findById(userId);
  if (!user) {
    throw new ApiError(404, 'Không tìm thấy người dùng');
  }
  return user;
};

/**
 * Cập nhật thông tin cá nhân của người dùng hiện tại
 */
const updateProfile = async (userId, updateData) => {
  const user = await User.findById(userId);
  if (!user) {
    throw new ApiError(404, 'Không tìm thấy người dùng');
  }

  // Không cho phép tự ý sửa role, active, password, token qua API profile
  delete updateData.password;
  delete updateData.role;
  delete updateData.isActive;
  delete updateData.refreshToken;

  // Kiểm tra email nếu người dùng thay đổi email
  if (updateData.email && updateData.email.toLowerCase() !== user.email) {
    const emailExists = await User.findOne({
      email: updateData.email.toLowerCase(),
      _id: { $ne: userId }
    });
    if (emailExists) {
      throw new ApiError(409, 'Email này đã được sử dụng bởi tài khoản khác');
    }
    user.email = updateData.email.toLowerCase();
  }

  if (updateData.name !== undefined) user.name = updateData.name.trim();
  if (updateData.phone !== undefined) user.phone = updateData.phone.trim();

  await user.save();
  return user;
};

module.exports = {
  getAllUsers,
  getUserById,
  getProfile,
  updateProfile,
  updateUser,
  deleteUser,
  changePassword
};

