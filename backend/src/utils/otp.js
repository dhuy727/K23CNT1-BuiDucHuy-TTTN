const crypto = require('crypto');

const generateRandomToken = (bytes = 32) => crypto.randomBytes(bytes).toString('hex');
const generateOtp = () => crypto.randomInt(100000, 1000000).toString();
const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

module.exports = { generateRandomToken, generateOtp, hashToken };
