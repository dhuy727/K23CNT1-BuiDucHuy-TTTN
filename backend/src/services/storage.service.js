const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const Minio = require('minio');
const ApiError = require('../utils/apiError');
const { UPLOAD_DIR } = require('../middlewares/upload.middleware');

/**
 * Kiểm tra xem cấu hình MinIO có đầy đủ không
 */
const isMinioConfigured = () => {
  const driver = (process.env.STORAGE_DRIVER || '').toLowerCase();
  const endpoint = process.env.MINIO_ENDPOINT;
  const accessKey = process.env.MINIO_ACCESS_KEY;
  const secretKey = process.env.MINIO_SECRET_KEY;

  if (driver === 'local') return false;
  return Boolean(endpoint && accessKey && secretKey);
};

const BUCKET_NAME = process.env.MINIO_BUCKET || 'smartdocs-files';

let minioClient = null;
let bucketChecked = false;

if (isMinioConfigured()) {
  try {
    minioClient = new Minio.Client({
      endPoint: process.env.MINIO_ENDPOINT,
      port: process.env.MINIO_PORT ? parseInt(process.env.MINIO_PORT, 10) : 9000,
      useSSL: process.env.MINIO_USE_SSL === 'true',
      accessKey: process.env.MINIO_ACCESS_KEY,
      secretKey: process.env.MINIO_SECRET_KEY
    });
  } catch (err) {
    console.error('[StorageService] Lỗi khởi tạo MinIO client:', err.message);
    minioClient = null;
  }
}

/**
 * Đảm bảo bucket MinIO tồn tại, tự động tạo nếu chưa có
 */
const ensureBucketExists = async () => {
  if (!minioClient || bucketChecked) return;

  try {
    const exists = await minioClient.bucketExists(BUCKET_NAME);
    if (!exists) {
      await minioClient.makeBucket(BUCKET_NAME, 'us-east-1');
      console.log(`[StorageService] Đã tạo mới MinIO bucket: ${BUCKET_NAME}`);
    }
    bucketChecked = true;
  } catch (err) {
    console.error(`[StorageService] Lỗi kiểm tra/tạo bucket ${BUCKET_NAME}:`, err.message);
  }
};

/**
 * Giải quyết đường dẫn file cục bộ (Dynamic Local Path Resolution)
 * Khắc phục lỗi khi MongoDB lưu đường dẫn tuyệt đối Windows (C:\Users\...) nhưng chạy trên Linux/Server
 */
const resolveLocalPath = (storagePath) => {
  if (!storagePath) return null;

  // 1. Nếu đường dẫn tuyệt đối nguyên bản tồn tại trên ổ đĩa hiện tại
  if (fs.existsSync(storagePath)) {
    return storagePath;
  }

  // 2. Tìm trong UPLOAD_DIR hiện tại của server theo tên file gốc
  const filename = path.basename(storagePath);
  const candidateInUploadDir = path.join(UPLOAD_DIR, filename);
  if (fs.existsSync(candidateInUploadDir)) {
    return candidateInUploadDir;
  }

  return null;
};

/**
 * Chuyển đổi một Node.js Readable Stream thành Buffer
 */
const streamToBuffer = (stream) => {
  return new Promise((resolve, reject) => {
    const chunks = [];
    stream.on('data', (chunk) => chunks.push(chunk));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', (err) => reject(err));
  });
};

const storageService = {
  isMinioConfigured,
  getBucketName: () => BUCKET_NAME,
  ensureBucketExists,
  resolveLocalPath,

  /**
   * Lưu tệp tin sau khi Multer nhận file
   * @param {Object} multerFile - Đối tượng file từ Multer ({ path, originalname, mimetype, size, filename })
   * @returns {Promise<{ storageType: string, storageKey: string, storagePath: string }>}
   */
  uploadFile: async (multerFile) => {
    if (!multerFile) {
      throw new ApiError(400, 'Không tìm thấy file để lưu trữ');
    }

    // Nếu cấu hình MinIO
    if (minioClient) {
      await ensureBucketExists();

      const ext = path.extname(multerFile.originalname).toLowerCase();
      const uniqueSuffix = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
      const storageKey = `${uniqueSuffix}${ext}`;

      // Upload file lên MinIO từ đường dẫn tạm của Multer
      await minioClient.fPutObject(BUCKET_NAME, storageKey, multerFile.path, {
        'Content-Type': multerFile.mimetype || 'application/octet-stream'
      });

      // Tùy chọn xóa file local sau khi đẩy lên MinIO thành công
      try {
        if (fs.existsSync(multerFile.path)) {
          await fs.promises.unlink(multerFile.path);
        }
      } catch (cleanErr) {
        console.warn('[StorageService] Không thể xóa file tạm sau khi upload MinIO:', cleanErr.message);
      }

      return {
        storageType: 'minio',
        storageKey,
        storagePath: `minio://${BUCKET_NAME}/${storageKey}`
      };
    }

    // Mặc định lưu cục bộ (Local Disk)
    return {
      storageType: 'local',
      storageKey: multerFile.filename || path.basename(multerFile.path),
      storagePath: multerFile.path
    };
  },

  /**
   * Lấy Readable Stream của tệp tin để xem trước (Preview) hoặc tải về (Download)
   * Tự động tương thích cả MinIO, Local, và các file cũ có đường dẫn lệch máy
   */
  getFileStream: async (fileDoc) => {
    if (!fileDoc) {
      throw new ApiError(404, 'Tệp tin không tồn tại');
    }

    // 1. Nếu file được đánh dấu lưu trên MinIO
    if (fileDoc.storageType === 'minio' && minioClient && fileDoc.storageKey) {
      try {
        return await minioClient.getObject(BUCKET_NAME, fileDoc.storageKey);
      } catch (minioErr) {
        console.error(`[StorageService] Lỗi lấy file từ MinIO (${fileDoc.storageKey}):`, minioErr.message);
        throw new ApiError(404, 'Tệp tin không tồn tại trên hệ thống lưu trữ MinIO');
      }
    }

    // 2. Thử tìm file trên Local Disk bằng dynamic path resolution
    const localPath = resolveLocalPath(fileDoc.storagePath);
    if (localPath) {
      return fs.createReadStream(localPath);
    }

    // 3. Fallback: Nếu MinIO đang bật, kiểm tra xem file đã được sync lên MinIO theo tên file gốc chưa
    if (minioClient && fileDoc.storagePath) {
      const candidateKey = path.basename(fileDoc.storagePath);
      try {
        return await minioClient.getObject(BUCKET_NAME, candidateKey);
      } catch (fallbackErr) {
        // Bỏ qua nếu không có trên MinIO
      }
    }

    throw new ApiError(404, 'Tệp tin vật lý không tồn tại trên hệ thống lưu trữ');
  },

  /**
   * Đọc toàn bộ nội dung tệp tin thành Buffer (dùng cho AI trích xuất văn bản, hash...)
   */
  getFileBuffer: async (fileDoc) => {
    if (!fileDoc) {
      throw new ApiError(404, 'Tệp tin không tồn tại');
    }

    // 1. MinIO
    if (fileDoc.storageType === 'minio' && minioClient && fileDoc.storageKey) {
      const stream = await minioClient.getObject(BUCKET_NAME, fileDoc.storageKey);
      return await streamToBuffer(stream);
    }

    // 2. Local Disk
    const localPath = resolveLocalPath(fileDoc.storagePath);
    if (localPath) {
      return await fs.promises.readFile(localPath);
    }

    // 3. Fallback MinIO
    if (minioClient && fileDoc.storagePath) {
      const candidateKey = path.basename(fileDoc.storagePath);
      try {
        const stream = await minioClient.getObject(BUCKET_NAME, candidateKey);
        return await streamToBuffer(stream);
      } catch (e) {
        // Không tìm thấy
      }
    }

    throw new ApiError(404, 'Tệp tin vật lý không tồn tại để đọc dữ liệu');
  },

  /**
   * Xóa tệp tin vật lý
   */
  deleteFile: async (fileDoc) => {
    if (!fileDoc) return;

    if (fileDoc.storageType === 'minio' && minioClient && fileDoc.storageKey) {
      try {
        await minioClient.removeObject(BUCKET_NAME, fileDoc.storageKey);
      } catch (err) {
        console.error(`[StorageService] Lỗi xóa file MinIO (${fileDoc.storageKey}):`, err.message);
      }
      return;
    }

    const localPath = resolveLocalPath(fileDoc.storagePath);
    if (localPath) {
      try {
        await fs.promises.unlink(localPath);
      } catch (err) {
        console.error(`[StorageService] Lỗi xóa file local (${localPath}):`, err.message);
      }
    }
  },

  /**
   * Sao chép tệp tin (Copy File)
   */
  copyFile: async (sourceFileDoc, targetOriginalName) => {
    const ext = path.extname(targetOriginalName || sourceFileDoc.name).toLowerCase();
    const uniqueSuffix = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
    const newFilename = `${uniqueSuffix}${ext}`;

    if (sourceFileDoc.storageType === 'minio' && minioClient && sourceFileDoc.storageKey) {
      const conds = new Minio.CopyConditions();
      await minioClient.copyObject(
        BUCKET_NAME,
        newFilename,
        `/${BUCKET_NAME}/${sourceFileDoc.storageKey}`,
        conds
      );

      return {
        storageType: 'minio',
        storageKey: newFilename,
        storagePath: `minio://${BUCKET_NAME}/${newFilename}`
      };
    }

    // Local Disk
    const sourceLocalPath = resolveLocalPath(sourceFileDoc.storagePath);
    if (!sourceLocalPath) {
      throw new ApiError(404, 'Không tìm thấy tệp tin gốc để sao chép');
    }

    const targetLocalPath = path.join(UPLOAD_DIR, newFilename);
    await fs.promises.copyFile(sourceLocalPath, targetLocalPath);

    return {
      storageType: 'local',
      storageKey: newFilename,
      storagePath: targetLocalPath
    };
  }
};

module.exports = storageService;
