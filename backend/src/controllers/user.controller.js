const authService = require('../services/auth.service');
const userService = require('../services/user.service');
const { sendSuccess } = require('../utils/apiResponse');

/**
 * Controller lấy thông tin cá nhân của người dùng hiện tại
 */
const getProfile = async (req, res, next) => {
  try {
    const user = await userService.getProfile(req.user._id);
    return sendSuccess(res, {
      message: 'Lấy thông tin cá nhân thành công',
      data: user
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Controller cập nhật thông tin cá nhân của người dùng hiện tại
 */
const updateProfile = async (req, res, next) => {
  try {
    const updatedUser = await userService.updateProfile(req.user._id, req.body);
    return sendSuccess(res, {
      message: 'Cập nhật thông tin cá nhân thành công',
      data: updatedUser
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Controller đổi mật khẩu của người dùng hiện tại
 */
const changePassword = async (req, res, next) => {
  try {
    const result = await userService.changePassword(req.user._id, req.body);
    return sendSuccess(res, {
      message: result.message,
      data: null
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Controller đăng xuất (thu hồi refreshToken)
 */
const logout = async (req, res, next) => {
  try {
    await authService.logoutUser(req.user._id);
    return sendSuccess(res, {
      message: 'Đăng xuất thành công, refreshToken đã bị vô hiệu hóa',
      data: null
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Controller lấy danh sách tất cả người dùng (Admin/Manager)
 */
const getUsers = async (req, res, next) => {
  try {
    const { users, pagination } = await userService.getAllUsers(req.query);
    return sendSuccess(res, {
      message: 'Lấy danh sách người dùng thành công',
      data: users,
      metadata: pagination
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Controller lấy chi tiết người dùng theo ID
 */
const getUser = async (req, res, next) => {
  try {
    const user = await userService.getUserById(req.params.id);
    return sendSuccess(res, {
      message: 'Lấy chi tiết người dùng thành công',
      data: user
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Controller cập nhật người dùng theo ID (Admin hoặc chính chủ)
 */
const updateUser = async (req, res, next) => {
  try {
    const updatedUser = await userService.updateUser(req.params.id, req.body, req.user);
    return sendSuccess(res, {
      message: 'Cập nhật thông tin người dùng thành công',
      data: updatedUser
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Controller xóa người dùng (Admin)
 */
const deleteUser = async (req, res, next) => {
  try {
    const result = await userService.deleteUser(req.params.id, req.user._id);
    return sendSuccess(res, {
      message: result.message,
      data: null
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getProfile,
  updateProfile,
  changePassword,
  logout,
  getUsers,
  getUser,
  updateUser,
  deleteUser
};

