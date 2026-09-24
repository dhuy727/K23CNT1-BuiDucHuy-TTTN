require('dotenv').config();
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const Minio = require('minio');

const File = require('../src/models/file.model');
const Version = require('../src/models/version.model');
const { UPLOAD_DIR } = require('../src/middlewares/upload.middleware');

const BUCKET_NAME = process.env.MINIO_BUCKET || 'smartdocs-files';

const runMigration = async () => {
  console.log('====================================================');
  console.log('🚀 BẮT ĐẦU SCRIPT ĐỒNG BỘ FILE TỪ LOCAL LÊN MINIO');
  console.log('====================================================');

  if (!process.env.MINIO_ENDPOINT || !process.env.MINIO_ACCESS_KEY || !process.env.MINIO_SECRET_KEY) {
    console.error('❌ Lỗi: Chưa cấu hình đầy đủ biến môi trường MinIO trong file .env');
    console.error('Cần có: MINIO_ENDPOINT, MINIO_PORT, MINIO_USE_SSL, MINIO_ACCESS_KEY, MINIO_SECRET_KEY, MINIO_BUCKET');
    process.exit(1);
  }

  const minioClient = new Minio.Client({
    endPoint: process.env.MINIO_ENDPOINT,
    port: process.env.MINIO_PORT ? parseInt(process.env.MINIO_PORT, 10) : 9000,
    useSSL: process.env.MINIO_USE_SSL === 'true',
    accessKey: process.env.MINIO_ACCESS_KEY,
    secretKey: process.env.MINIO_SECRET_KEY
  });

  // 1. Kết nối MongoDB
  console.log('📡 Đang kết nối MongoDB...');
  await mongoose.connect(process.env.MONGO_URI);
  console.log('✅ Kết nối MongoDB thành công.');

  // 2. Kiểm tra/Tạo Bucket MinIO
  console.log(`📦 Kiểm tra bucket MinIO: "${BUCKET_NAME}"...`);
  const exists = await minioClient.bucketExists(BUCKET_NAME);
  if (!exists) {
    await minioClient.makeBucket(BUCKET_NAME, 'us-east-1');
    console.log(`✅ Đã tạo mới bucket: ${BUCKET_NAME}`);
  } else {
    console.log(`✅ Bucket "${BUCKET_NAME}" đã sẵn sàng.`);
  }

  // Hàm resolve file local
  const resolveLocalPath = (storagePath) => {
    if (!storagePath) return null;
    if (fs.existsSync(storagePath)) return storagePath;
    const filename = path.basename(storagePath);
    const candidate = path.join(UPLOAD_DIR, filename);
    if (fs.existsSync(candidate)) return candidate;
    return null;
  };

  // 3. Migrate Files
  console.log('\n📄 Đang kiểm tra các tệp tin trong database...');
  const files = await File.find({});
  console.log(`Tìm thấy tổng cộng ${files.length} tệp tin.`);

  let fileSuccess = 0;
  let fileSkipped = 0;
  let fileMissing = 0;

  for (const file of files) {
    if (file.storageType === 'minio' && file.storageKey) {
      fileSkipped++;
      continue;
    }

    const localPath = resolveLocalPath(file.storagePath);
    if (!localPath) {
      console.warn(`⚠️ [Missing] Không tìm thấy file trên đĩa local: "${file.name}" (storagePath: ${file.storagePath})`);
      fileMissing++;
      continue;
    }

    try {
      const ext = path.extname(file.name || file.originalName || localPath).toLowerCase();
      const uniqueSuffix = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
      const storageKey = `${uniqueSuffix}${ext}`;

      await minioClient.fPutObject(BUCKET_NAME, storageKey, localPath, {
        'Content-Type': file.mimeType || 'application/octet-stream'
      });

      file.storageType = 'minio';
      file.storageKey = storageKey;
      file.storagePath = `minio://${BUCKET_NAME}/${storageKey}`;
      await file.save();

      console.log(`✅ [Uploaded] Đã đẩy lên MinIO: "${file.name}" -> key: ${storageKey}`);
      fileSuccess++;
    } catch (uploadErr) {
      console.error(`❌ [Error] Lỗi khi upload "${file.name}":`, uploadErr.message);
    }
  }

  // 4. Migrate Versions
  console.log('\n🔖 Đang kiểm tra các phiên bản (Versions) trong database...');
  const versions = await Version.find({});
  console.log(`Tìm thấy tổng cộng ${versions.length} phiên bản.`);

  let verSuccess = 0;
  let verSkipped = 0;
  let verMissing = 0;

  for (const ver of versions) {
    if (ver.storageType === 'minio' && ver.storageKey) {
      verSkipped++;
      continue;
    }

    const localPath = resolveLocalPath(ver.storagePath);
    if (!localPath) {
      verMissing++;
      continue;
    }

    try {
      const ext = path.extname(localPath).toLowerCase();
      const uniqueSuffix = `ver-${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
      const storageKey = `${uniqueSuffix}${ext}`;

      await minioClient.fPutObject(BUCKET_NAME, storageKey, localPath, {
        'Content-Type': ver.mimeType || 'application/octet-stream'
      });

      ver.storageType = 'minio';
      ver.storageKey = storageKey;
      ver.storagePath = `minio://${BUCKET_NAME}/${storageKey}`;
      await ver.save();

      console.log(`✅ [Uploaded Version] v${ver.versionNumber} của "${ver.name}" -> key: ${storageKey}`);
      verSuccess++;
    } catch (err) {
      console.error(`❌ Lỗi upload version v${ver.versionNumber}:`, err.message);
    }
  }

  console.log('\n====================================================');
  console.log('🎉 TỔNG KẾT KẾT QUẢ ĐỒNG BỘ:');
  console.log(`- Files: Thành công ${fileSuccess} | Bỏ qua đã có ${fileSkipped} | Không tìm thấy file local ${fileMissing}`);
  console.log(`- Versions: Thành công ${verSuccess} | Bỏ qua ${verSkipped} | Thiếu file local ${verMissing}`);
  console.log('====================================================');

  await mongoose.disconnect();
  process.exit(0);
};

runMigration().catch((err) => {
  console.error('❌ Lỗi ngoại lệ trong quá trình migration:', err);
  process.exit(1);
});
