/**
 * Dịch vụ lập chỉ mục RAG (Ingestion, Chunking & Embedding)
 */

const File = require('../models/file.model');
const DocumentChunk = require('../models/chunk.model');
const { extractDocumentForRag, isSupportedExtractType } = require('./text-extract.service');
const { createChunksFromDocument } = require('./chunking.service');
const embeddingProvider = require('./embedding.provider');
const ApiError = require('../utils/apiError');

/**
 * Xóa toàn bộ chunks của một tệp tin
 */
const deleteFileChunks = async (fileId) => {
  if (!fileId) return;
  await DocumentChunk.deleteMany({ file: fileId });
};

/**
 * Thực hiện toàn bộ quy trình lập chỉ mục RAG cho một file
 */
const indexFileForRag = async (fileId) => {
  if (!fileId) return null;

  const file = await File.findById(fileId);
  if (!file || file.isTrash) {
    return null;
  }

  // Kiểm tra định dạng có được hỗ trợ trích xuất văn bản hay không
  if (!isSupportedExtractType(file)) {
    file.ragStatus = 'unsupported';
    file.ragError = 'Định dạng tệp tin chưa được hỗ trợ lập chỉ mục hỏi đáp RAG';
    await file.save();
    return file;
  }

  file.ragStatus = 'indexing';
  file.ragError = '';
  await file.save();

  try {
    console.log(`[RAG Indexer] Đang trích xuất nội dung toàn văn cho: "${file.name}" (${file._id})...`);
    const extractedDoc = await extractDocumentForRag(file);

    if (!extractedDoc.fullText || extractedDoc.fullText.trim().length < 40) {
      file.ragStatus = 'unsupported';
      file.ragError = 'Tệp tin không có nội dung văn bản đủ dài để lập chỉ mục';
      file.ragChunkCount = 0;
      await file.save();
      await deleteFileChunks(file._id);
      return file;
    }

    console.log(`[RAG Indexer] Đang chia nhỏ đoạn (Chunking) cho: "${file.name}" (${extractedDoc.totalPages} trang)...`);
    const chunks = createChunksFromDocument(extractedDoc, {
      chunkSize: 1100,
      overlap: 180
    });

    if (chunks.length === 0) {
      file.ragStatus = 'unsupported';
      file.ragError = 'Không thể chia nhỏ đoạn văn bản';
      await file.save();
      return file;
    }

    console.log(`[RAG Indexer] Đang sinh Vector Embeddings cho ${chunks.length} chunks của "${file.name}"...`);
    const chunkTexts = chunks.map((c) => c.content);
    const embeddings = await embeddingProvider.getEmbeddings(chunkTexts, { batchSize: 15 });

    if (embeddings.length !== chunks.length) {
      throw new Error(`Số lượng embeddings (${embeddings.length}) không khớp với số chunks (${chunks.length})`);
    }

    // Xóa các chunk cũ của file này nếu có
    await deleteFileChunks(file._id);

    // Chuẩn bị danh sách DocumentChunk để lưu CSDL
    const chunkDocuments = chunks.map((c, idx) => ({
      file: file._id,
      user: file.user,
      folder: file.folder || null,
      chunkIndex: c.chunkIndex,
      content: c.content,
      pageNumber: c.pageNumber || 1,
      sectionTitle: c.sectionTitle || '',
      tokenCount: c.tokenCount || 0,
      embedding: embeddings[idx],
      embeddingModel: process.env.AI_EMBEDDING_MODEL || embeddingProvider.DEFAULT_GEMINI_EMBEDDING_MODEL
    }));

    await DocumentChunk.insertMany(chunkDocuments);

    file.ragStatus = 'indexed';
    file.ragChunkCount = chunkDocuments.length;
    file.ragIndexedAt = new Date();
    file.ragError = '';
    await file.save();

    console.log(`[RAG Indexer] Hoàn tất lập chỉ mục RAG thành công cho "${file.name}" (${chunkDocuments.length} chunks)`);
    return file;
  } catch (err) {
    console.error(`[RAG Indexer] Thất bại khi lập chỉ mục cho "${file.name}":`, err.message);
    file.ragStatus = 'failed';
    file.ragError = String(err.message || 'Lỗi không xác định khi lập chỉ mục RAG').slice(0, 500);
    await file.save();
    return file;
  }
};

/**
 * Đưa vào hàng đợi xử lý bất đồng bộ
 */
const enqueueRagIndexing = (fileId) => {
  if (!fileId) return;
  setImmediate(() => {
    indexFileForRag(fileId).catch((err) => {
      console.error(`[RAG Queue] Lỗi ngầm khi lập chỉ mục file ${fileId}:`, err.message);
    });
  });
};

/**
 * Người dùng yêu cầu lập chỉ mục lại thủ công cho một tệp tin
 */
const reindexFile = async (userId, fileId) => {
  const file = await File.findOne({ _id: fileId, user: userId, isTrash: false });
  if (!file) {
    throw new ApiError(404, 'Không tìm thấy tệp tin hoặc bạn không có quyền');
  }

  enqueueRagIndexing(file._id);
  file.ragStatus = 'pending';
  file.ragError = '';
  await file.save();

  return file;
};

module.exports = {
  indexFileForRag,
  enqueueRagIndexing,
  reindexFile,
  deleteFileChunks
};
