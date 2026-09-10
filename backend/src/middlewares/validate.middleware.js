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

  if (!password || typeof password !== 'string' || password.length < 8) {
    return next(new ApiError(400, 'Mật khẩu phải có độ dài ít nhất 8 ký tự'));
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

const validateToken = (field = 'token') => (req, res, next) => {
  if (!req.body[field] || typeof req.body[field] !== 'string') {
    return next(new ApiError(400, `Vui lòng cung cấp ${field} hợp lệ`));
  }
  next();
};

const validateVerificationCode = (req, res, next) => {
  const { email, code } = req.body;
  if (!email || typeof email !== 'string' || !/^\S+@\S+\.\S+$/.test(email)) {
    return next(new ApiError(400, 'Vui lòng cung cấp email hợp lệ'));
  }
  if (!code || typeof code !== 'string' || !/^\d{6}$/.test(code)) {
    return next(new ApiError(400, 'Mã xác thực phải gồm đúng 6 chữ số'));
  }
  next();
};

const validateForgotPassword = (req, res, next) => {
  const { email } = req.body;
  if (!email || typeof email !== 'string') {
    return next(new ApiError(400, 'Vui lòng cung cấp email hợp lệ'));
  }
  next();
};

const validateResetPassword = (req, res, next) => {
  const { token, newPassword } = req.body;
  if (!token || typeof token !== 'string' || !newPassword || typeof newPassword !== 'string' || newPassword.length < 8) {
    return next(new ApiError(400, 'Token và mật khẩu mới (ít nhất 8 ký tự) là bắt buộc'));
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
  validateToken,
  validateVerificationCode,
  validateForgotPassword,
  validateResetPassword,
  validateObjectId
};
