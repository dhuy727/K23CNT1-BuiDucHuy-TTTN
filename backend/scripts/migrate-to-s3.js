require('dotenv').config();
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { S3Client, HeadBucketCommand } = require('@aws-sdk/client-s3');
const { Upload } = require('@aws-sdk/lib-storage');

const File = require('../src/models/file.model');
const Version = require('../src/models/version.model');
const { UPLOAD_DIR } = require('../src/middlewares/upload.middleware');

const BUCKET_NAME = process.env.AWS_S3_BUCKET || 'smartdocs-files';
const REGION = process.env.AWS_REGION || 'ap-southeast-1';

const runMigration = async () => {
  console.log('====================================================');
  console.log('🚀 BẮT ĐẦU SCRIPT ĐỒNG BỘ FILE TỪ LOCAL LÊN AWS S3');
  console.log('====================================================');

  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

  if (
    !accessKeyId ||
    !secretAccessKey ||
    accessKeyId.includes('your_aws') ||
    secretAccessKey.includes('your_aws')
  ) {
    console.error('❌ Lỗi: Chưa cấu hình thông tin AWS S3 hợp lệ trong file .env');
    console.error('👉 Vui lòng mở backend/.env và điền thông tin thật của bạn:');
    console.error('   AWS_REGION=ap-southeast-1');
    console.error('   AWS_ACCESS_KEY_ID=AKIA...');
    console.error('   AWS_SECRET_ACCESS_KEY=...');
    console.error('   AWS_S3_BUCKET=smartdocs-files');
    process.exit(1);
  }

  const s3Client = new S3Client({
    region: REGION,
    credentials: {
      accessKeyId,
      secretAccessKey
    }
  });

  // 1. Kết nối MongoDB
  console.log('📡 Đang kết nối MongoDB...');
  await mongoose.connect(process.env.MONGO_URI);
  console.log('✅ Kết nối MongoDB thành công.');

  // 2. Kiểm tra Bucket AWS S3
  console.log(`📦 Đang kiểm tra bucket AWS S3: "${BUCKET_NAME}" (Region: ${REGION})...`);
  try {
    await s3Client.send(new HeadBucketCommand({ Bucket: BUCKET_NAME }));
    console.log(`✅ Bucket AWS S3 "${BUCKET_NAME}" đã sẵn sàng.`);
  } catch (bucketErr) {
    console.warn(`⚠️ Cảnh báo kiểm tra bucket: ${bucketErr.message}`);
    console.log(`ℹ️ Tiếp tục quá trình tải dữ liệu...`);
  }

  // Hàm tìm đường dẫn file vật lý trên local (hỗ trợ cả tìm theo hash và size)
  const resolveLocalPath = (storagePath, doc = null) => {
    if (!storagePath && !doc) return null;
    if (storagePath && fs.existsSync(storagePath)) return storagePath;
    const filename = storagePath ? path.basename(storagePath) : (doc?.storageKey || '');
    if (filename) {
      const candidate = path.join(UPLOAD_DIR, filename);
      if (fs.existsSync(candidate)) return candidate;
    }
    if (doc?.storageKey) {
      const candidateByKey = path.join(UPLOAD_DIR, doc.storageKey);
      if (fs.existsSync(candidateByKey)) return candidateByKey;
    }
    try {
      if (fs.existsSync(UPLOAD_DIR)) {
        const dirFiles = fs.readdirSync(UPLOAD_DIR);
        if (doc?.contentHash) {
          for (const fname of dirFiles) {
            const fullP = path.join(UPLOAD_DIR, fname);
            try {
              const h = crypto.createHash('sha256').update(fs.readFileSync(fullP)).digest('hex');
              if (h === doc.contentHash) return fullP;
            } catch (e) {}
          }
        }
        if (doc?.size && (doc?.extension || doc?.name)) {
          const ext = (doc.extension || path.extname(doc.name).replace('.', '')).toLowerCase();
          for (const fname of dirFiles) {
            if (fname.toLowerCase().endsWith('.' + ext)) {
              const fullP = path.join(UPLOAD_DIR, fname);
              try {
                if (fs.statSync(fullP).size === doc.size) return fullP;
              } catch (e) {}
            }
          }
        }
      }
    } catch (e) {}
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
    if (file.storageType === 's3' && file.storageKey) {
      fileSkipped++;
      continue;
    }

    const localPath = resolveLocalPath(file.storagePath, file);
    if (!localPath) {
      console.warn(`⚠️ [Missing] Không tìm thấy file local: "${file.name}" (storagePath: ${file.storagePath})`);
      fileMissing++;
      continue;
    }

    try {
      const ext = path.extname(file.name || file.originalName || localPath).toLowerCase();
      const uniqueSuffix = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
      const storageKey = `${uniqueSuffix}${ext}`;

      const fileStream = fs.createReadStream(localPath);
      const parallelUpload = new Upload({
        client: s3Client,
        params: {
          Bucket: BUCKET_NAME,
          Key: storageKey,
          Body: fileStream,
          ContentType: file.mimeType || 'application/octet-stream'
        }
      });

      await parallelUpload.done();

      file.storageType = 's3';
      file.storageKey = storageKey;
      file.storagePath = `s3://${BUCKET_NAME}/${storageKey}`;
      await file.save();

      console.log(`✅ [Uploaded] Đã đẩy lên AWS S3: "${file.name}" -> key: ${storageKey}`);
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
    if (ver.storageType === 's3' && ver.storageKey) {
      verSkipped++;
      continue;
    }

    const localPath = resolveLocalPath(ver.storagePath, ver);
    if (!localPath) {
      verMissing++;
      continue;
    }

    try {
      const ext = path.extname(localPath).toLowerCase();
      const uniqueSuffix = `ver-${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
      const storageKey = `${uniqueSuffix}${ext}`;

      const fileStream = fs.createReadStream(localPath);
      const parallelUpload = new Upload({
        client: s3Client,
        params: {
          Bucket: BUCKET_NAME,
          Key: storageKey,
          Body: fileStream,
          ContentType: ver.mimeType || 'application/octet-stream'
        }
      });

      await parallelUpload.done();

      ver.storageType = 's3';
      ver.storageKey = storageKey;
      ver.storagePath = `s3://${BUCKET_NAME}/${storageKey}`;
      await ver.save();

      console.log(`✅ [Uploaded Version] v${ver.versionNumber} của "${ver.name}" -> key: ${storageKey}`);
      verSuccess++;
    } catch (err) {
      console.error(`❌ Lỗi upload version v${ver.versionNumber}:`, err.message);
    }
  }

  console.log('\n====================================================');
  console.log('🎉 TỔNG KẾT KẾT QUẢ ĐỒNG BỘ LÊN AWS S3:');
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
