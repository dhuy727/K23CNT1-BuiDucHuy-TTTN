const jwt = require('jsonwebtoken');

const jwtConfig = {
  secret: process.env.JWT_SECRET || 'default_secret_key',
  expiresIn: process.env.JWT_EXPIRES_IN || '15m',
  refreshSecret: process.env.JWT_REFRESH_SECRET || 'default_refresh_secret_key',
  refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d'
};

/**
 * Tạo secretToken (Access Token ngắn hạn)
 * @param {Object} payload - Dữ liệu đưa vào token (userId, email, role,...)
 * @returns {string} Token JWT
 */
const generateSecretToken = (payload) => {
  return jwt.sign({ ...payload, type: 'access' }, jwtConfig.secret, {
    expiresIn: jwtConfig.expiresIn
  });
};

/**
 * Tạo refreshToken (Token dài hạn)
 * @param {Object} payload - Dữ liệu nhận dạng (userId)
 * @returns {string} Token JWT
 */
const generateRefreshToken = (payload) => {
  return jwt.sign({ ...payload, type: 'refresh' }, jwtConfig.refreshSecret, {
    expiresIn: jwtConfig.refreshExpiresIn
  });
};

/**
 * Xác thực secretToken
 * @param {string} token 
 * @returns {Object} decoded payload
 */
const verifySecretToken = (token) => {
  return jwt.verify(token, jwtConfig.secret);
};

/**
 * Xác thực refreshToken
 * @param {string} token 
 * @returns {Object} decoded payload
 */
const verifyRefreshToken = (token) => {
  return jwt.verify(token, jwtConfig.refreshSecret);
};

module.exports = {
  jwtConfig,
  generateSecretToken,
  generateRefreshToken,
  verifySecretToken,
  verifyRefreshToken
};
