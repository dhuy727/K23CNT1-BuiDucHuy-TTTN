const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const {
  S3Client,
  GetObjectCommand,
  DeleteObjectCommand,
  CopyObjectCommand
} = require('@aws-sdk/client-s3');
const { Upload } = require('@aws-sdk/lib-storage');
const ApiError = require('../utils/apiError');
const { UPLOAD_DIR } = require('../middlewares/upload.middleware');

/**
 * Kiểm tra xem thông tin kết nối AWS S3 có đầy đủ không
 */
const isS3Configured = () => {
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
  if (
    !accessKeyId ||
    !secretAccessKey ||
    accessKeyId.includes('your_aws') ||
    secretAccessKey.includes('your_aws')
  ) {
    return false;
  }
  return true;
};

/**
 * Kiểm tra xem driver mặc định cho file mới có phải AWS S3 không
 */
const shouldUseS3ForUpload = () => {
  const driver = (process.env.STORAGE_DRIVER || 's3').toLowerCase();
  return (driver === 's3' || driver === 'aws') && isS3Configured();
};

const BUCKET_NAME = process.env.AWS_S3_BUCKET || 'smartdocs-files';
const REGION = process.env.AWS_REGION || 'ap-southeast-1';

let s3Client = null;

const getS3Client = () => {
  if (s3Client) return s3Client;
  if (isS3Configured()) {
    try {
      s3Client = new S3Client({
        region: REGION,
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
        }
      });
      return s3Client;
    } catch (err) {
      console.error('[StorageService] Lỗi khởi tạo AWS S3 client:', err.message);
      return null;
    }
  }
  return null;
};

// Khởi tạo S3 client sớm nếu có đủ biến môi trường
getS3Client();

/**
 * Giải quyết đường dẫn file cục bộ (Dynamic Local Path Resolution)
 * Khắc phục lỗi khi MongoDB lưu đường dẫn tuyệt đối Windows (C:\Users\...) nhưng chạy trên Linux/Server
 */
const resolveLocalPath = (storagePath, fileDoc = null) => {
  if (!storagePath && !fileDoc) return null;

  // 1. Nếu đường dẫn tuyệt đối nguyên bản tồn tại trên ổ đĩa hiện tại
  if (storagePath && fs.existsSync(storagePath)) {
    return storagePath;
  }

  // 2. Tìm trong UPLOAD_DIR theo tên file hoặc storageKey
  const filename = storagePath ? path.basename(storagePath) : (fileDoc?.storageKey || '');
  if (filename) {
    const candidateInUploadDir = path.join(UPLOAD_DIR, filename);
    if (fs.existsSync(candidateInUploadDir)) {
      return candidateInUploadDir;
    }
  }

  if (fileDoc?.storageKey) {
    const candidateByKey = path.join(UPLOAD_DIR, fileDoc.storageKey);
    if (fs.existsSync(candidateByKey)) {
      return candidateByKey;
    }
  }

  // 3. Fallback thông minh: Quét UPLOAD_DIR khớp theo contentHash hoặc size + extension
  try {
    if (fs.existsSync(UPLOAD_DIR)) {
      const dirFiles = fs.readdirSync(UPLOAD_DIR);
      if (fileDoc?.contentHash) {
        for (const fname of dirFiles) {
          const fullP = path.join(UPLOAD_DIR, fname);
          try {
            const h = crypto.createHash('sha256').update(fs.readFileSync(fullP)).digest('hex');
            if (h === fileDoc.contentHash) {
              return fullP;
            }
          } catch (e) {}
        }
      }

      if (fileDoc?.size && fileDoc?.extension) {
        for (const fname of dirFiles) {
          if (fname.toLowerCase().endsWith('.' + fileDoc.extension.toLowerCase())) {
            const fullP = path.join(UPLOAD_DIR, fname);
            try {
              if (fs.statSync(fullP).size === fileDoc.size) {
                return fullP;
              }
            } catch (e) {}
          }
        }
      }
    }
  } catch (scanErr) {
    // Bỏ qua lỗi quét
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
  isS3Configured,
  getBucketName: () => BUCKET_NAME,
  getRegion: () => REGION,
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

    const client = getS3Client();
    // Nếu cấu hình lưu trữ lên AWS S3
    if (shouldUseS3ForUpload() && client) {
      const ext = path.extname(multerFile.originalname).toLowerCase();
      const uniqueSuffix = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
      const storageKey = `${uniqueSuffix}${ext}`;

      const fileStream = fs.createReadStream(multerFile.path);

      const parallelUpload = new Upload({
        client,
        params: {
          Bucket: BUCKET_NAME,
          Key: storageKey,
          Body: fileStream,
          ContentType: multerFile.mimetype || 'application/octet-stream'
        }
      });

      await parallelUpload.done();

      // Tùy chọn xóa file local sau khi đẩy lên S3 thành công
      try {
        if (fs.existsSync(multerFile.path)) {
          await fs.promises.unlink(multerFile.path);
        }
      } catch (cleanErr) {
        console.warn('[StorageService] Không thể xóa file tạm sau khi upload S3:', cleanErr.message);
      }

      return {
        storageType: 's3',
        storageKey,
        storagePath: `s3://${BUCKET_NAME}/${storageKey}`
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
   * Tự động tương thích cả AWS S3, Local, và các file cũ
   */
  getFileStream: async (fileDoc) => {
    if (!fileDoc) {
      throw new ApiError(404, 'Tệp tin không tồn tại');
    }

    const client = getS3Client();

    // 1. Nếu file được đánh dấu lưu trên S3 (hoặc minio trước đó)
    if ((fileDoc.storageType === 's3' || fileDoc.storageType === 'minio') && client && fileDoc.storageKey) {
      try {
        const command = new GetObjectCommand({
          Bucket: BUCKET_NAME,
          Key: fileDoc.storageKey
        });
        const response = await client.send(command);
        return response.Body;
      } catch (s3Err) {
        console.error(`[StorageService] Lỗi lấy file từ AWS S3 (${fileDoc.storageKey}):`, s3Err.message);
      }
    }

    // 2. Thử tìm file trên Local Disk bằng dynamic path resolution
    const localPath = resolveLocalPath(fileDoc.storagePath, fileDoc);
    if (localPath) {
      return fs.createReadStream(localPath);
    }

    // 3. Fallback: Nếu S3 đang bật, kiểm tra xem file đã có trên S3 theo tên file gốc chưa
    if (client && fileDoc.storagePath) {
      const candidateKey = path.basename(fileDoc.storagePath);
      try {
        const command = new GetObjectCommand({
          Bucket: BUCKET_NAME,
          Key: candidateKey
        });
        const response = await client.send(command);
        return response.Body;
      } catch (fallbackErr) {
        // Bỏ qua nếu không có trên S3
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

    const client = getS3Client();

    // 1. AWS S3
    if ((fileDoc.storageType === 's3' || fileDoc.storageType === 'minio') && client && fileDoc.storageKey) {
      try {
        const command = new GetObjectCommand({
          Bucket: BUCKET_NAME,
          Key: fileDoc.storageKey
        });
        const response = await client.send(command);
        if (response.Body.transformToByteArray) {
          const byteArray = await response.Body.transformToByteArray();
          return Buffer.from(byteArray);
        }
        return await streamToBuffer(response.Body);
      } catch (s3Err) {
        console.warn(`[StorageService] Lỗi đọc Buffer từ AWS S3 (${fileDoc.storageKey}):`, s3Err.message);
      }
    }

    // 2. Local Disk
    const localPath = resolveLocalPath(fileDoc.storagePath, fileDoc);
    if (localPath) {
      return await fs.promises.readFile(localPath);
    }

    // 3. Fallback AWS S3
    if (client && fileDoc.storagePath) {
      const candidateKey = path.basename(fileDoc.storagePath);
      try {
        const command = new GetObjectCommand({
          Bucket: BUCKET_NAME,
          Key: candidateKey
        });
        const response = await client.send(command);
        if (response.Body.transformToByteArray) {
          const byteArray = await response.Body.transformToByteArray();
          return Buffer.from(byteArray);
        }
        return await streamToBuffer(response.Body);
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

    const client = getS3Client();
    if ((fileDoc.storageType === 's3' || fileDoc.storageType === 'minio') && client && fileDoc.storageKey) {
      try {
        const command = new DeleteObjectCommand({
          Bucket: BUCKET_NAME,
          Key: fileDoc.storageKey
        });
        await client.send(command);
      } catch (err) {
        console.error(`[StorageService] Lỗi xóa file AWS S3 (${fileDoc.storageKey}):`, err.message);
      }
      return;
    }

    const localPath = resolveLocalPath(fileDoc.storagePath, fileDoc);
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
    const client = getS3Client();

    if ((sourceFileDoc.storageType === 's3' || sourceFileDoc.storageType === 'minio') && client && sourceFileDoc.storageKey) {
      try {
        const command = new CopyObjectCommand({
          Bucket: BUCKET_NAME,
          Key: newFilename,
          CopySource: `${BUCKET_NAME}/${sourceFileDoc.storageKey}`
        });
        await client.send(command);

        return {
          storageType: 's3',
          storageKey: newFilename,
          storagePath: `s3://${BUCKET_NAME}/${newFilename}`
        };
      } catch (err) {
        console.error(`[StorageService] Lỗi sao chép file trên AWS S3:`, err.message);
        throw new ApiError(500, 'Lỗi khi sao chép tệp tin trên AWS S3');
      }
    }

    // Local Disk
    const sourceLocalPath = resolveLocalPath(sourceFileDoc.storagePath, sourceFileDoc);
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
