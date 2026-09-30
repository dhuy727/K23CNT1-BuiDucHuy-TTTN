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

// Giới hạn kích thước file tải lên (Mặc định tối đa 1GB)
const MAX_FILE_SIZE = 1024 * 1024 * 1024; // 1GB

const upload = multer({
  storage,
  limits: {
    fileSize: MAX_FILE_SIZE
  }
});

/**
 * Khôi phục tên tệp tiếng Việt chuẩn UTF-8 khi bị Busboy/Multer giải mã nhầm theo latin1
 */
const fixUtf8Filename = (filename) => {
  if (!filename || typeof filename !== 'string') return '';
  try {
    // Nếu filename chứa chuỗi byte UTF-8 bị đọc nhầm theo latin1 (chứa Ã, áº, vv), chuyển đổi về UTF-8 chuẩn
    const converted = Buffer.from(filename, 'latin1').toString('utf8');
    // Kiểm tra xem chuỗi converted có hợp lệ không (không chứa ký tự thay thế lỗi \ufffd)
    if (!converted.includes('\ufffd')) {
      return converted;
    }
  } catch (err) {
    // Nếu có lỗi, giữ nguyên
  }
  return filename;
};

/**
 * Middleware bọc upload 1 file đơn lẻ (field: 'file') kèm xử lý lỗi Multer
 */
const uploadSingle = (req, res, next) => {
  const handler = upload.single('file');

  handler(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return next(new ApiError(400, 'Kích thước tệp tin vượt quá giới hạn tối đa cho phép (1GB)'));
      }
      return next(new ApiError(400, `Lỗi tải tệp: ${err.message}`));
    } else if (err) {
      return next(new ApiError(400, `Lỗi không xác định khi tải tệp: ${err.message}`));
    }
    if (req.file) {
      req.file.originalname = fixUtf8Filename(req.file.originalname);
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
        return next(new ApiError(400, 'Một trong các tệp tin vượt quá giới hạn tối đa cho phép (1GB)'));
      }
      if (err.code === 'LIMIT_UNEXPECTED_FILE') {
        return next(new ApiError(400, 'Số lượng tệp tin tải lên vượt quá giới hạn cho phép (tối đa 10 tệp)'));
      }
      return next(new ApiError(400, `Lỗi tải tệp: ${err.message}`));
    } else if (err) {
      return next(new ApiError(400, `Lỗi không xác định khi tải tệp: ${err.message}`));
    }
    if (req.files && Array.isArray(req.files)) {
      req.files.forEach((file) => {
        file.originalname = fixUtf8Filename(file.originalname);
      });
    }
    next();
  });
};

module.exports = {
  UPLOAD_DIR,
  fixUtf8Filename,
  uploadSingle,
  uploadMultiple
};
