const path = require('path');
const fs = require('fs');
const { createWorker } = require('tesseract.js');

const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'webp', 'bmp', 'tiff', 'tif']);
const DEFAULT_LANG = 'vie+eng';
const TESSDATA_DIR = path.resolve(__dirname, '../../tessdata');

// Đảm bảo thư mục lưu cache traineddata tồn tại
try {
  if (!fs.existsSync(TESSDATA_DIR)) {
    fs.mkdirSync(TESSDATA_DIR, { recursive: true });
  }
} catch (dirErr) {
  console.warn('[OCR Service] Không thể tạo thư mục tessdata cache:', dirErr.message);
}

let workerInstance = null;
let workerInitPromise = null;
let queuePromise = Promise.resolve();

/**
 * Kiểm tra xem tệp có phải định dạng ảnh hỗ trợ OCR hay không
 */
const isImageFile = (fileOrExt) => {
  if (!fileOrExt) return false;
  let ext = '';
  if (typeof fileOrExt === 'string') {
    ext = path.extname(fileOrExt).replace('.', '').toLowerCase();
    if (!ext) ext = fileOrExt.toLowerCase().replace('.', '');
  } else {
    ext = (fileOrExt.extension || path.extname(fileOrExt.name || fileOrExt.originalName || '').replace('.', '')).toLowerCase();
  }
  return IMAGE_EXTENSIONS.has(ext);
};

/**
 * Khởi tạo worker Tesseract.js dùng chung (Singleton) với bộ nhớ đệm ngôn ngữ cục bộ
 */
const getWorker = async () => {
  if (workerInstance) {
    return workerInstance;
  }

  if (workerInitPromise) {
    return workerInitPromise;
  }

  const langs = (process.env.OCR_LANG || DEFAULT_LANG).trim();

  workerInitPromise = (async () => {
    try {
      console.log(`[OCR Service] Đang khởi tạo Tesseract Worker với ngôn ngữ "${langs}" (cache: ${TESSDATA_DIR})...`);
      const worker = await createWorker(langs, 1, {
        cachePath: TESSDATA_DIR,
        errorHandler: (err) => console.error('[OCR Worker Error]:', err)
      });
      console.log('[OCR Service] Tesseract Worker đã sẵn sàng nhận diện văn bản!');
      workerInstance = worker;
      return worker;
    } catch (err) {
      console.error('[OCR Service] Thất bại khi khởi tạo Tesseract Worker:', err.message);
      workerInitPromise = null;
      throw err;
    }
  })();

  return workerInitPromise;
};

/**
 * Xử lý nhận diện ký tự quang học (OCR) từ Image Buffer một cách an toàn và tuần tự
 */
const extractTextFromImageBuffer = async (buffer) => {
  if (!buffer || !Buffer.isBuffer(buffer)) {
    return '';
  }

  // Sử dụng Promise queue tuần tự để đảm bảo an toàn luồng cho Worker Singleton
  return new Promise((resolve, reject) => {
    queuePromise = queuePromise
      .then(async () => {
        try {
          const worker = await getWorker();
          const result = await worker.recognize(buffer);
          const rawText = result?.data?.text || '';
          resolve(rawText.trim());
        } catch (err) {
          console.error('[OCR Service] Lỗi khi nhận diện hình ảnh:', err.message);
          // Nếu worker bị lỗi nghiêm trọng, giải phóng để khởi tạo lại ở lần tiếp theo
          if (workerInstance) {
            try {
              await workerInstance.terminate();
            } catch (_) {}
            workerInstance = null;
            workerInitPromise = null;
          }
          resolve(''); // Trả về chuỗi rỗng để không ngắt luồng upload/AI
        }
      })
      .catch((queueErr) => {
        console.error('[OCR Service] Lỗi queue OCR:', queueErr.message);
        resolve('');
      });
  });
};

/**
 * Giải phóng worker khi tiến trình Node kết thúc
 */
const terminateWorker = async () => {
  if (workerInstance) {
    try {
      await workerInstance.terminate();
      workerInstance = null;
      workerInitPromise = null;
      console.log('[OCR Service] Tesseract Worker đã được giải phóng');
    } catch (err) {
      console.error('[OCR Service] Lỗi giải phóng worker:', err.message);
    }
  }
};

process.on('SIGINT', terminateWorker);
process.on('SIGTERM', terminateWorker);

module.exports = {
  IMAGE_EXTENSIONS,
  isImageFile,
  extractTextFromImageBuffer,
  getWorker,
  terminateWorker
};
