const mongoose = require('mongoose');
const File = require('../models/file.model');
const Folder = require('../models/folder.model');
const { extractText, isSupportedExtractType, UnsupportedExtractError } = require('./text-extract.service');
const { classifyDocument } = require('./ai.provider');
const ApiError = require('../utils/apiError');

const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Tìm thư mục cùng tên category (không tự tạo thư mục).
 */
const matchFolderByCategory = async (userId, category) => {
  const name = String(category || '').trim();
  if (!name || name === 'Khác' || name === 'Chưa phân loại') {
    return null;
  }

  const folder = await Folder.findOne({
    user: userId,
    isTrash: false,
    name: new RegExp(`^${escapeRegex(name)}$`, 'i')
  })
    .sort({ updatedAt: -1 })
    .select('_id')
    .lean();

  return folder?._id || null;
};

const markFailed = async (fileId, message) => {
  await File.findByIdAndUpdate(fileId, {
    aiStatus: 'failed',
    aiError: String(message || 'Xử lý AI thất bại').slice(0, 500),
    aiProcessedAt: new Date()
  });
};

const markSkipped = async (fileId, message) => {
  await File.findByIdAndUpdate(fileId, {
    aiStatus: 'skipped',
    aiError: String(message || 'Không trích xuất được nội dung').slice(0, 500),
    extractedText: '',
    aiProcessedAt: new Date()
  });
};

/**
 * Job in-process: extract + LLM. Lỗi chỉ set aiStatus, không ảnh hưởng file đã upload.
 */
/**
 * Job in-process: extract + LLM. Luôn hoàn tất AI_COMPLETED dù tệp không có văn bản (phân loại qua tên/đuôi file).
 */
const processFile = async (fileId) => {
  if (!fileId) return null;

  const file = await File.findById(fileId).select('+extractedText');
  if (!file || file.isTrash) {
    return null;
  }

  file.aiStatus = 'processing';
  file.aiError = '';
  await file.save();

  try {
    let extractedText = '';
    if (isSupportedExtractType(file)) {
      try {
        extractedText = await extractText(file);
      } catch (extractErr) {
        console.warn(`[AI] Không thể trích xuất văn bản từ ${file.name}: ${extractErr.message}. Chuyển sang phân loại theo metadata.`);
      }
    }

    const classification = await classifyDocument({
      fileName: file.name || file.originalName,
      mimeType: file.mimeType,
      extension: file.extension,
      extractedText
    });

    const suggestedFolder = await matchFolderByCategory(file.user, classification.category);

    file.extractedText = extractedText;
    file.aiCategory = classification.category;
    file.aiTags = classification.tags;
    file.aiSummary = classification.summary;
    file.aiConfidence = classification.confidence;
    file.aiSuggestedName = classification.suggestedName;
    file.aiSuggestedFolder = suggestedFolder;
    file.aiStatus = 'completed';
    file.aiError = '';
    file.aiProcessedAt = new Date();
    await file.save();

    // Thông báo cho người dùng khi AI phân tích xong
    try {
      const notificationService = require('./notification.service');
      const tagCount = (file.aiTags && file.aiTags.length) || 0;
      await notificationService.createNotification({
        user: file.user,
        file: file._id,
        title: 'AI đã phân tích xong',
        message: `Tệp "${file.name}" đã được phân tích xong: Danh mục "${classification.category || 'Tài liệu'}", tạo ${tagCount} thẻ gợi ý.`,
        type: 'ai'
      });
    } catch (notifErr) {
      console.error('[AI] Lỗi khi tạo thông báo AI hoàn tất:', notifErr.message);
    }

    // Hook kích hoạt engine tự động hóa khi AI hoàn tất
    try {
      const automationService = require('./automation.service');
      await automationService.run(file.user, 'AI_COMPLETED', file);
    } catch (automationErr) {
      console.error('[AI] Lỗi khi kích hoạt automation hook sau AI_COMPLETED:', automationErr.message);
    }

    return file;
  } catch (error) {
    console.error(`[AI] Lỗi khi xử lý file ${file.name} (${file._id}):`, error.message);
    await markFailed(file._id, error.message);

    try {
      const notificationService = require('./notification.service');
      await notificationService.createNotification({
        user: file.user,
        file: file._id,
        title: 'Lỗi phân tích AI',
        message: `Không thể hoàn tất phân tích tệp "${file.name}": ${error.message}`,
        type: 'warning'
      });
    } catch (notifErr) {
      // Bỏ qua lỗi thông báo
    }

    return File.findById(file._id);
  }
};

/**
 * Không chặn response 201: chạy sau event loop hiện tại.
 */
const enqueueProcess = (fileId) => {
  if (!fileId) return;
  setImmediate(() => {
    processFile(fileId).catch((error) => {
      console.error(`[AI] Lỗi job xử lý file ${fileId}:`, error.message);
    });
  });
};

/**
 * Tự động quét và tiếp tục xử lý các tệp còn đang pending hoặc processing khi khởi động server
 */
const resumePendingJobs = async () => {
  try {
    const pendingFiles = await File.find({
      isTrash: false,
      aiStatus: { $in: ['pending', 'processing'] }
    }).select('_id name aiStatus');

    if (pendingFiles.length > 0) {
      console.log(`[AI Startup] Tìm thấy ${pendingFiles.length} tệp tin cần xử lý phân loại AI...`);
      for (const f of pendingFiles) {
        enqueueProcess(f._id);
      }
    }
  } catch (err) {
    console.error('[AI Startup] Lỗi khi quét tệp pending:', err.message);
  }
};

/**
 * Chạy lại phân tích AI cho toàn bộ tệp tin của người dùng
 */
const reprocessAllFiles = async (userId, forceAll = false) => {
  const query = {
    user: userId,
    isTrash: false
  };
  if (!forceAll) {
    query.aiStatus = { $in: ['failed', 'pending', 'skipped'] };
  }

  const files = await File.find(query).select('_id name');
  for (const f of files) {
    await File.findByIdAndUpdate(f._id, { aiStatus: 'pending', aiError: '' });
    enqueueProcess(f._id);
  }

  return { message: `Đã đưa ${files.length} tệp tin vào hàng đợi phân tích AI`, count: files.length };
};

/**
 * Chạy lại phân tích AI cho 1 file (dành cho chủ sở hữu)
 */
const retryProcess = async (userId, fileId) => {
  if (!mongoose.Types.ObjectId.isValid(fileId)) {
    throw new ApiError(400, 'ID tệp tin không hợp lệ');
  }

  const file = await File.findOne({ _id: fileId, user: userId, isTrash: false });
  if (!file) {
    throw new ApiError(404, 'Không tìm thấy tệp tin hoặc bạn không có quyền');
  }

  file.aiStatus = 'pending';
  file.aiError = '';
  await file.save();

  enqueueProcess(file._id);
  return file;
};

/**
 * Chấp nhận tên đề xuất từ AI
 */
const acceptSuggestedName = async (userId, fileId) => {
  if (!mongoose.Types.ObjectId.isValid(fileId)) {
    throw new ApiError(400, 'ID tệp tin không hợp lệ');
  }

  const file = await File.findOne({ _id: fileId, user: userId, isTrash: false });
  if (!file) {
    throw new ApiError(404, 'Không tìm thấy tệp tin');
  }

  if (!file.aiSuggestedName) {
    throw new ApiError(400, 'Tệp tin không có tên đề xuất từ AI');
  }

  const fileService = require('./file.service');
  const updatedFile = await fileService.renameFile(userId, fileId, file.aiSuggestedName);

  // Xóa tên đề xuất sau khi áp dụng
  await File.findByIdAndUpdate(fileId, { aiSuggestedName: '' });

  return updatedFile;
};

/**
 * Chấp nhận di chuyển tệp tin vào thư mục đề xuất từ AI
 */
const acceptSuggestedFolder = async (userId, fileId) => {
  if (!mongoose.Types.ObjectId.isValid(fileId)) {
    throw new ApiError(400, 'ID tệp tin không hợp lệ');
  }

  const file = await File.findOne({ _id: fileId, user: userId, isTrash: false });
  if (!file) {
    throw new ApiError(404, 'Không tìm thấy tệp tin');
  }

  if (!file.aiSuggestedFolder) {
    throw new ApiError(400, 'Tệp tin không có thư mục đề xuất từ AI');
  }

  const fileService = require('./file.service');
  const updatedFile = await fileService.moveFile(userId, fileId, file.aiSuggestedFolder);

  // Xóa thư mục đề xuất sau khi áp dụng
  await File.findByIdAndUpdate(fileId, { aiSuggestedFolder: null });

  return updatedFile;
};

/**
 * Bỏ qua / xóa các đề xuất của AI cho tệp tin này
 */
const dismissSuggestions = async (userId, fileId) => {
  if (!mongoose.Types.ObjectId.isValid(fileId)) {
    throw new ApiError(400, 'ID tệp tin không hợp lệ');
  }

  const file = await File.findOneAndUpdate(
    { _id: fileId, user: userId, isTrash: false },
    {
      aiSuggestedName: '',
      aiSuggestedFolder: null
    },
    { new: true }
  );

  if (!file) {
    throw new ApiError(404, 'Không tìm thấy tệp tin');
  }

  return file;
};

module.exports = {
  processFile,
  enqueueProcess,
  resumePendingJobs,
  reprocessAllFiles,
  matchFolderByCategory,
  retryProcess,
  acceptSuggestedName,
  acceptSuggestedFolder,
  dismissSuggestions
};
