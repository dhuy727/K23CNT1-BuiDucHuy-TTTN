const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const ApiError = require('../utils/apiError');

// Thư mục lưu trữ file tải lên
const UPLOAD_DIR = path.resolve(__dirname, '../../uploads');

// Tự động khởi tạo thư mục lưu trữ nếu chưa tồn tại
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// Cấu hình lưu trữ file trên đĩa (Disk Storage)
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Đảm bảo thư mục luôn tồn tại
    if (!fs.existsSync(UPLOAD_DIR)) {
      fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    }
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    // Tạo tên file ngẫu nhiên duy nhất tránh trùng lặp: timestamp-randomHex.ext
    const ext = path.extname(file.originalname).toLowerCase();
    const uniqueSuffix = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
    cb(null, `${uniqueSuffix}${ext}`);
  }
});

// Giới hạn kích thước file tải lên (Mặc định tối đa 50MB)
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

const upload = multer({
  storage,
  limits: {
    fileSize: MAX_FILE_SIZE
  }
});

/**
 * Middleware bọc upload 1 file đơn lẻ (field: 'file') kèm xử lý lỗi Multer
 */
const uploadSingle = (req, res, next) => {
  const handler = upload.single('file');

  handler(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return next(new ApiError(400, 'Kích thước tệp tin vượt quá giới hạn tối đa cho phép (50MB)'));
      }
      return next(new ApiError(400, `Lỗi tải tệp: ${err.message}`));
    } else if (err) {
      return next(new ApiError(400, `Lỗi không xác định khi tải tệp: ${err.message}`));
    }
    next();
  });
};

/**
 * Middleware bọc upload nhiều file cùng lúc (field: 'files', tối đa 10 file/lần)
 */
const uploadMultiple = (req, res, next) => {
  const handler = upload.array('files', 10);

  handler(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return next(new ApiError(400, 'Một trong các tệp tin vượt quá giới hạn tối đa 50MB'));
      }
      if (err.code === 'LIMIT_UNEXPECTED_FILE') {
        return next(new ApiError(400, 'Số lượng tệp tin tải lên vượt quá giới hạn cho phép (tối đa 10 tệp)'));
      }
      return next(new ApiError(400, `Lỗi tải tệp: ${err.message}`));
    } else if (err) {
      return next(new ApiError(400, `Lỗi không xác định khi tải tệp: ${err.message}`));
    }
    next();
  });
};

module.exports = {
  UPLOAD_DIR,
  uploadSingle,
  uploadMultiple
};
