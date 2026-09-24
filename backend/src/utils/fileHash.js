const fs = require('fs');
const crypto = require('crypto');

/**
 * Tính toán mã băm SHA-256 của tệp tin trên ổ đĩa bằng phương pháp stream (luồng dữ liệu).
 * Đảm bảo an toàn bộ nhớ (RAM-safe) cho các tệp dung lượng lớn (lên tới 500MB hoặc hơn).
 * 
 * @param {string} filePath - Đường dẫn tuyệt đối hoặc tương đối tới tệp tin
 * @returns {Promise<string>} Mã băm SHA-256 dạng hex string
 */
const calculateFileHash = (filePath) => {
  return new Promise((resolve, reject) => {
    if (!filePath || !fs.existsSync(filePath)) {
      return resolve('');
    }

    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);

    stream.on('data', (chunk) => {
      hash.update(chunk);
    });

    stream.on('end', () => {
      resolve(hash.digest('hex'));
    });

    stream.on('error', (err) => {
      console.warn(`[FileHash] Lỗi khi đọc tệp tin tính hash ${filePath}:`, err.message);
      resolve('');
    });
  });
};

module.exports = {
  calculateFileHash
};
