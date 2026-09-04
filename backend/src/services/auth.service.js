const User = require('../models/user.model');
const ApiError = require('../utils/apiError');
const {
  generateSecretToken,
  generateRefreshToken,
  verifyRefreshToken
} = require('../config/jwt');

/**
 * Đăng ký người dùng mới
 */
const registerUser = async (userData) => {
  const { name, email, password, role, phone } = userData;

  // Kiểm tra email đã được sử dụng chưa
  const existingUser = await User.findOne({ email: email.toLowerCase() });
  if (existingUser) {
    throw new ApiError(409, 'Email này đã được đăng ký tài khoản');
  }

  // Tạo người dùng mới trong database
  const user = new User({
    name,
    email,
    password,
    role: role || 'user',
    phone: phone || ''
  });

  // Tạo cặp token: secretToken (ngắn hạn) & refreshToken (dài hạn)
  const secretToken = generateSecretToken({
    userId: user._id,
    email: user.email,
    role: user.role
  });

  const refreshToken = generateRefreshToken({
    userId: user._id
  });

  // Lưu refreshToken vào database để quản lý phiên dài hạn
  user.refreshToken = refreshToken;
  await user.save();

  return {
    user: user.toJSON(),
    tokens: {
      secretToken,
      refreshToken
    }
  };
};

/**
 * Đăng nhập người dùng
 */
const loginUser = async ({ email, password }) => {
  // Tìm user theo email (lấy kèm trường password và refreshToken)
  const user = await User.findOne({ email: email.toLowerCase() }).select('+password +refreshToken');

  if (!user) {
    throw new ApiError(401, 'Email hoặc mật khẩu không chính xác');
  }

  // Kiểm tra mật khẩu
  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    throw new ApiError(401, 'Email hoặc mật khẩu không chính xác');
  }

  // Kiểm tra trạng thái hoạt động
  if (!user.isActive) {
    throw new ApiError(403, 'Tài khoản của bạn hiện đang bị vô hiệu hóa');
  }

  // Tạo cặp token mới
  const secretToken = generateSecretToken({
    userId: user._id,
    email: user.email,
    role: user.role
  });

  const refreshToken = generateRefreshToken({
    userId: user._id
  });

  // Lưu refreshToken mới vào MongoDB
  user.refreshToken = refreshToken;
  await user.save();

  return {
    user: user.toJSON(),
    tokens: {
      secretToken,
      refreshToken
    }
  };
};

/**
 * Cấp mới secretToken thông qua refreshToken hợp lệ
 */
const refreshUserToken = async (incomingRefreshToken) => {
  let decoded;
  try {
    decoded = verifyRefreshToken(incomingRefreshToken);
  } catch (error) {
    throw new ApiError(401, 'refreshToken không hợp lệ hoặc đã hết hạn. Vui lòng đăng nhập lại.');
  }

  // Tìm user theo ID và lấy trường refreshToken để so sánh
  const user = await User.findById(decoded.userId).select('+refreshToken');
  if (!user) {
    throw new ApiError(401, 'Không tìm thấy người dùng sở hữu token này');
  }

  if (!user.isActive) {
    throw new ApiError(403, 'Tài khoản đã bị tạm khóa');
  }

  // So sánh refreshToken gửi lên với refreshToken đã lưu trong database
  if (user.refreshToken !== incomingRefreshToken) {
    throw new ApiError(401, 'refreshToken đã bị thu hồi hoặc không trùng khớp với phiên đăng nhập hiện tại');
  }

  // Tạo secretToken mới
  const newSecretToken = generateSecretToken({
    userId: user._id,
    email: user.email,
    role: user.role
  });

  // Tùy chọn gia hạn/tái sử dụng refreshToken
  return {
    secretToken: newSecretToken,
    refreshToken: incomingRefreshToken
  };
};

/**
 * Đăng xuất và thu hồi refreshToken
 */
const logoutUser = async (userId) => {
  const user = await User.findById(userId);
  if (!user) {
    throw new ApiError(404, 'Không tìm thấy người dùng');
  }

  // Xóa refreshToken trong DB
  user.refreshToken = null;
  await user.save();

  return true;
};

module.exports = {
  registerUser,
  loginUser,
  refreshUserToken,
  logoutUser
};
