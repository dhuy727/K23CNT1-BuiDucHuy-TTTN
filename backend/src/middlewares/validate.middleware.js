const mongoose = require('mongoose');
const ApiError = require('../utils/apiError');

/**
 * Kiểm tra dữ liệu đăng ký
 */
const validateRegister = (req, res, next) => {
  const { name, email, password } = req.body;

  if (!name || typeof name !== 'string' || name.trim() === '') {
    return next(new ApiError(400, 'Họ và tên không được để trống'));
  }

  if (!email || typeof email !== 'string' || email.trim() === '') {
    return next(new ApiError(400, 'Email không được để trống'));
  }

  const emailRegex = /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/;
  if (!emailRegex.test(email)) {
    return next(new ApiError(400, 'Định dạng email không hợp lệ'));
  }

  if (!password || typeof password !== 'string' || password.length < 6) {
    return next(new ApiError(400, 'Mật khẩu phải có độ dài ít nhất 6 ký tự'));
  }

  next();
};

/**
 * Kiểm tra dữ liệu đăng nhập
 */
const validateLogin = (req, res, next) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return next(new ApiError(400, 'Vui lòng cung cấp đầy đủ email và mật khẩu'));
  }

  next();
};

/**
 * Kiểm tra refreshToken gửi lên
 */
const validateRefreshToken = (req, res, next) => {
  const { refreshToken } = req.body;

  if (!refreshToken || typeof refreshToken !== 'string') {
    return next(new ApiError(400, 'Vui lòng cung cấp refreshToken hợp lệ trong request body'));
  }

  next();
};

/**
 * Kiểm tra định dạng Mongo ObjectId trong route params
 */
const validateObjectId = (paramName = 'id') => {
  return (req, res, next) => {
    const id = req.params[paramName];
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(new ApiError(400, `ID '${id}' không đúng định dạng ObjectId hợp lệ của MongoDB`));
    }
    next();
  };
};

module.exports = {
  validateRegister,
  validateLogin,
  validateRefreshToken,
  validateObjectId
};
