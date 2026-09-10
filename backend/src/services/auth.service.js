const bcrypt = require('bcryptjs');
const User = require('../models/user.model');
const ApiError = require('../utils/apiError');
const { generateSecretToken, generateRefreshToken, verifyRefreshToken } = require('../config/jwt');
const { generateRandomToken, generateOtp, hashToken } = require('../utils/otp');
const { sendVerificationEmail, sendPasswordResetEmail } = require('./email.service');

const EMAIL_TOKEN_MINUTES = Number(process.env.EMAIL_VERIFY_EXPIRES_MINUTES || 15);
const RESET_TOKEN_MINUTES = Number(process.env.PASSWORD_RESET_EXPIRES_MINUTES || 15);
const MAX_EMAIL_VERIFY_ATTEMPTS = 5;
const publicUser = (user) => user.toJSON();

const issueTokenPair = async (user) => {
  const secretToken = generateSecretToken({ userId: user._id.toString(), email: user.email, role: user.role });
  // Một mã phiên ngẫu nhiên đảm bảo token mới khác token cũ, kể cả khi refresh xảy ra cùng giây.
  const refreshToken = generateRefreshToken({ userId: user._id.toString(), tokenId: generateRandomToken(16) });
  // bcrypt truncates inputs at 72 bytes; JWTs are longer, so hash a fixed-size digest first.
  user.refreshTokenHash = await bcrypt.hash(hashToken(refreshToken), 12);
  user.lastLoginAt = new Date();
  await user.save();
  return { secretToken, refreshToken };
};

const registerUser = async ({ name, email, password, phone }) => {
  const normalizedEmail = email.toLowerCase().trim();
  if (await User.exists({ email: normalizedEmail })) {
    throw new ApiError(409, 'Email này đã được đăng ký tài khoản');
  }

  const verificationCode = generateOtp();
  const user = new User({
    name: name.trim(), email: normalizedEmail, password, phone: phone ? phone.trim() : '',
    // Tài khoản tự đăng ký không được tự cấp quyền quản trị.
    role: 'user',
    emailVerifyToken: hashToken(verificationCode),
    emailVerifyExpires: new Date(Date.now() + EMAIL_TOKEN_MINUTES * 60 * 1000),
    emailVerifyAttempts: 0
  });
  await sendVerificationEmail(user.email, user.name, verificationCode);
  await user.save();
  return publicUser(user);
};

const verifyEmail = async ({ email, code }) => {
  const user = await User.findOne({ email: email.toLowerCase().trim() })
    .select('+emailVerifyToken +emailVerifyExpires +emailVerifyAttempts');
  if (!user || !user.emailVerifyToken || !user.emailVerifyExpires || user.emailVerifyExpires <= new Date()) {
    throw new ApiError(400, 'Mã xác thực không hợp lệ hoặc đã hết hạn');
  }
  if (user.emailVerifyAttempts >= MAX_EMAIL_VERIFY_ATTEMPTS) {
    user.emailVerifyToken = undefined;
    user.emailVerifyExpires = undefined;
    await user.save();
    throw new ApiError(429, 'Bạn đã nhập sai mã quá nhiều lần. Vui lòng yêu cầu gửi lại mã mới.');
  }
  if (hashToken(code) !== user.emailVerifyToken) {
    user.emailVerifyAttempts += 1;
    if (user.emailVerifyAttempts >= MAX_EMAIL_VERIFY_ATTEMPTS) {
      user.emailVerifyToken = undefined;
      user.emailVerifyExpires = undefined;
    }
    await user.save();
    throw new ApiError(400, 'Mã xác thực không chính xác');
  }
  user.isEmailVerified = true;
  user.emailVerifyToken = undefined;
  user.emailVerifyExpires = undefined;
  user.emailVerifyAttempts = 0;
  await user.save();
};

const resendVerificationCode = async (email) => {
  const user = await User.findOne({ email: email.toLowerCase().trim() })
    .select('+emailVerifyToken +emailVerifyExpires +emailVerifyAttempts');
  // Giữ phản hồi chung để không làm lộ email đã đăng ký.
  if (!user || user.isEmailVerified) return;
  const verificationCode = generateOtp();
  user.emailVerifyToken = hashToken(verificationCode);
  user.emailVerifyExpires = new Date(Date.now() + EMAIL_TOKEN_MINUTES * 60 * 1000);
  user.emailVerifyAttempts = 0;
  await sendVerificationEmail(user.email, user.name, verificationCode);
  await user.save();
};

const loginUser = async ({ email, password }) => {
  const user = await User.findOne({ email: email.toLowerCase().trim() }).select('+password +refreshTokenHash');
  if (!user || !(await user.comparePassword(password))) {
    throw new ApiError(401, 'Email hoặc mật khẩu không chính xác');
  }
  if (!user.isActive) throw new ApiError(403, 'Tài khoản của bạn hiện đang bị vô hiệu hóa');
  // Các bản ghi cũ (trước khi bổ sung xác thực email) không bị khóa sau khi cập nhật.
  if (user.isEmailVerified === false) throw new ApiError(403, 'Vui lòng xác thực email trước khi đăng nhập');
  return { user: publicUser(user), tokens: await issueTokenPair(user) };
};

const refreshUserToken = async (incomingRefreshToken) => {
  let decoded;
  try {
    decoded = verifyRefreshToken(incomingRefreshToken);
  } catch {
    throw new ApiError(401, 'Refresh token không hợp lệ hoặc đã hết hạn. Vui lòng đăng nhập lại.');
  }
  if (decoded.type !== 'refresh') throw new ApiError(401, 'Token dùng để làm mới phiên không hợp lệ');
  const user = await User.findById(decoded.userId).select('+refreshTokenHash');
  if (!user || !user.refreshTokenHash || !(await bcrypt.compare(hashToken(incomingRefreshToken), user.refreshTokenHash))) {
    throw new ApiError(401, 'Refresh token đã bị thu hồi hoặc không hợp lệ');
  }
  if (!user.isActive) throw new ApiError(403, 'Tài khoản đã bị tạm khóa');
  return issueTokenPair(user);
};

const logoutUser = async (userId) => {
  const user = await User.findById(userId).select('+refreshTokenHash');
  if (!user) throw new ApiError(404, 'Không tìm thấy người dùng');
  user.refreshTokenHash = null;
  await user.save();
};

const forgotPassword = async (email) => {
  const user = await User.findOne({ email: email.toLowerCase().trim() })
    .select('+passwordResetTokenHash +passwordResetExpires');
  // Không tiết lộ email có tồn tại hay không.
  if (!user) return;
  const resetToken = generateRandomToken();
  user.passwordResetTokenHash = hashToken(resetToken);
  user.passwordResetExpires = new Date(Date.now() + RESET_TOKEN_MINUTES * 60 * 1000);
  await sendPasswordResetEmail(user.email, user.name, resetToken);
  await user.save();
};

const verifyForgotPassword = async (token) => Boolean(await User.exists({
  passwordResetTokenHash: hashToken(token), passwordResetExpires: { $gt: new Date() }
}));

const resetPassword = async (token, newPassword) => {
  const user = await User.findOne({
    passwordResetTokenHash: hashToken(token), passwordResetExpires: { $gt: new Date() }
  }).select('+passwordResetTokenHash +passwordResetExpires +refreshTokenHash');
  if (!user) throw new ApiError(400, 'Token đặt lại mật khẩu không hợp lệ hoặc đã hết hạn');
  user.password = newPassword;
  user.passwordResetTokenHash = undefined;
  user.passwordResetExpires = undefined;
  user.refreshTokenHash = null;
  await user.save();
};

module.exports = {
  registerUser, verifyEmail, resendVerificationCode, loginUser, refreshUserToken, logoutUser,
  forgotPassword, verifyForgotPassword, resetPassword
};
