const { verifySecretToken } = require('../config/jwt');
const User = require('../models/user.model');
const ApiError = require('../utils/apiError');

/**
 * Middleware xác thực secretToken (Access Token ngắn hạn)
 */
const verifyAuth = async (req, res, next) => {
  try {
    let token = null;

    // Lấy token từ header Authorization (Bearer <token>)
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith('Bearer ')
    ) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      throw new ApiError(401, 'Vui lòng đăng nhập để thực hiện thao tác này (Thiếu token xác thực)');
    }

    // Giải mã và kiểm tra secretToken
    let decoded;
    try {
      decoded = verifySecretToken(token);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        throw new ApiError(401, 'secretToken đã hết hạn, vui lòng dùng refreshToken để lấy token mới');
      }
      throw new ApiError(401, 'Token xác thực không hợp lệ hoặc bị giả mạo');
    }

    // Kiểm tra xem User có còn tồn tại không
    const currentUser = await User.findById(decoded.userId);
    if (!currentUser) {
      throw new ApiError(401, 'Người dùng sở hữu token này không còn tồn tại');
    }

    // Kiểm tra tài khoản có bị khóa không
    if (!currentUser.isActive) {
      throw new ApiError(403, 'Tài khoản của bạn đã bị tạm khóa');
    }

    // Gán thông tin user vào req để các controller/service phía sau sử dụng
    req.user = currentUser;
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Middleware phân quyền người dùng theo Role
 * @param  {...string} roles - Danh sách các role được phép truy cập (vd: 'admin', 'manager')
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(
        new ApiError(403, `Bạn không có quyền thực hiện hành động này. Yêu cầu quyền: [${roles.join(', ')}]`)
      );
    }
    next();
  };
};

module.exports = {
  verifyAuth,
  authorize
};
