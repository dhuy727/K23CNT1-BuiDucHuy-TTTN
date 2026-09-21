const File = require('../models/file.model');
const Folder = require('../models/folder.model');
const { extractText, isSupportedExtractType, UnsupportedExtractError } = require('./text-extract.service');
const { classifyDocument } = require('./ai.provider');

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
    if (!isSupportedExtractType(file)) {
      await markSkipped(file._id, 'Không trích xuất được nội dung');
      return File.findById(file._id);
    }

    const extractedText = await extractText(file);
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

    return file;
  } catch (error) {
    if (error instanceof UnsupportedExtractError || error.code === 'UNSUPPORTED') {
      await markSkipped(file._id, error.message);
      return File.findById(file._id);
    }

    await markFailed(file._id, error.message);
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

module.exports = {
  processFile,
  enqueueProcess,
  matchFolderByCategory
};
