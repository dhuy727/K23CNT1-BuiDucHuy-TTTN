const ApiError = require('../utils/apiError');

/**
 * Middleware xử lý route không tìm thấy (404 Not Found)
 */
const notFound = (req, res, next) => {
  next(new ApiError(404, `Tài nguyên không tồn tại: [${req.method}] ${req.originalUrl}`));
};

/**
 * Middleware xử lý lỗi toàn cục (Global Error Handler)
 */
const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;
  error.statusCode = err.statusCode || 500;

  // Lỗi Mongoose CastError (vd: sai định dạng ObjectId)
  if (err.name === 'CastError') {
    const message = `Không tìm thấy tài nguyên với trường ${err.path}: ${err.value}`;
    error = new ApiError(400, message);
  }

  // Lỗi Mongoose trùng lặp khóa duy nhất (Duplicate key - 11000)
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    const value = err.keyValue[field];
    const message = `Giá trị '${value}' của trường '${field}' đã tồn tại trong hệ thống`;
    error = new ApiError(409, message);
  }

  // Lỗi Mongoose Validation
  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors)
      .map((val) => val.message)
      .join(', ');
    error = new ApiError(400, message);
  }

  // Lỗi JSON Web Token
  if (err.name === 'JsonWebTokenError') {
    error = new ApiError(401, 'Token xác thực không hợp lệ');
  }

  if (err.name === 'TokenExpiredError') {
    error = new ApiError(401, 'Token đã hết hạn, vui lòng làm mới hoặc đăng nhập lại');
  }

  const response = {
    success: false,
    statusCode: error.statusCode || 500,
    message: error.message || 'Lỗi hệ thống máy chủ nội bộ'
  };

  // Trả về stack trace nếu đang ở môi trường development để hỗ trợ debug
  if (process.env.NODE_ENV === 'development') {
    response.stack = err.stack;
  }

  return res.status(error.statusCode || 500).json(response);
};

module.exports = {
  notFound,
  errorHandler
};
