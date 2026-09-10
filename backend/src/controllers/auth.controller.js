const authService = require('../services/auth.service');
const userService = require('../services/user.service');
const { sendSuccess, sendCreated } = require('../utils/apiResponse');

/**
 * Controller đăng ký tài khoản
 */
const register = async (req, res, next) => {
  try {
    const result = await authService.registerUser(req.body);
    return sendCreated(res, {
      message: 'Đăng ký tài khoản thành công',
      data: result
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Controller đăng nhập
 */
const login = async (req, res, next) => {
  try {
    const result = await authService.loginUser(req.body);
    return sendSuccess(res, {
      message: 'Đăng nhập thành công',
      data: result
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Controller cấp lại secretToken bằng refreshToken
 */
const refreshToken = async (req, res, next) => {
  try {
    const result = await authService.refreshUserToken(req.body.refreshToken);
    return sendSuccess(res, {
      message: 'Cấp mới secretToken thành công',
      data: result
    });
  } catch (error) {
    next(error);
  }
};

const verifyEmail = async (req, res, next) => {
  try {
    await authService.verifyEmail(req.body);
    return sendSuccess(res, { message: 'Xác thực email thành công. Bạn có thể đăng nhập.', data: null });
  } catch (error) {
    next(error);
  }
};

const resendVerificationCode = async (req, res, next) => {
  try {
    await authService.resendVerificationCode(req.body.email);
    return sendSuccess(res, {
      message: 'Nếu tài khoản chưa xác thực, hệ thống đã gửi mã xác thực mới.', data: null
    });
  } catch (error) {
    next(error);
  }
};

const forgotPassword = async (req, res, next) => {
  try {
    await authService.forgotPassword(req.body.email);
    return sendSuccess(res, {
      message: 'Nếu email tồn tại, hệ thống đã gửi hướng dẫn đặt lại mật khẩu.', data: null
    });
  } catch (error) {
    next(error);
  }
};

const verifyForgotPassword = async (req, res, next) => {
  try {
    const valid = await authService.verifyForgotPassword(req.body.token);
    return sendSuccess(res, { message: 'Đã kiểm tra token đặt lại mật khẩu', data: { valid } });
  } catch (error) {
    next(error);
  }
};

const resetPassword = async (req, res, next) => {
  try {
    await authService.resetPassword(req.body.token, req.body.newPassword);
    return sendSuccess(res, {
      message: 'Đặt lại mật khẩu thành công. Vui lòng đăng nhập lại.', data: null
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Controller đăng xuất
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
 * Controller lấy thông tin tài khoản đang đăng nhập
 */
const getMe = async (req, res, next) => {
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
 * Controller cập nhật thông tin cá nhân
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
 * Controller đổi mật khẩu
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

module.exports = {
  register,
  login,
  refreshToken,
  verifyEmail,
  resendVerificationCode,
  forgotPassword,
  verifyForgotPassword,
  resetPassword,
  logout,
  getMe,
  updateProfile,
  changePassword
};
