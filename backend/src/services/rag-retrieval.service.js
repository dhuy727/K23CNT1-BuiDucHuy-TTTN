/**
 * Dịch vụ Truy xuất Lai (Hybrid Retrieval: Vector Search + Keyword Search + RRF)
 */

const mongoose = require('mongoose');
const DocumentChunk = require('../models/chunk.model');
const File = require('../models/file.model');
const Folder = require('../models/folder.model');
const Share = require('../models/share.model');
const embeddingProvider = require('./embedding.provider');

/**
 * Tính toán độ tương đồng Cosine giữa 2 vectors
 */
const cosineSimilarity = (vecA, vecB) => {
  if (!vecA || !vecB || vecA.length !== vecB.length) return 0;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
};

/**
 * Xác định danh sách File ID mà người dùng có quyền truy cập theo Scope
 */
const resolveAccessibleFileIds = async (userId, scope = { type: 'all', targetId: null }) => {
  const userObjectId = new mongoose.Types.ObjectId(userId);

  // 1. Nếu phạm vi là 1 tệp tin cụ thể (Single File QA)
  if (scope.type === 'file' && scope.targetId) {
    if (!mongoose.Types.ObjectId.isValid(scope.targetId)) return [];

    const file = await File.findOne({
      _id: scope.targetId,
      isTrash: false,
      $or: [
        { user: userObjectId },
        {
          _id: {
            $in: await Share.find({ sharedWith: userObjectId, itemType: 'file' }).distinct('file')
          }
        }
      ]
    }).select('_id');

    return file ? [file._id] : [];
  }

  // 2. Nếu phạm vi là 1 thư mục cụ thể (Folder-scoped QA)
  if (scope.type === 'folder' && scope.targetId) {
    if (!mongoose.Types.ObjectId.isValid(scope.targetId)) return [];

    const parentFolder = await Folder.findOne({ _id: scope.targetId, isTrash: false });
    if (!parentFolder) return [];

    // Tìm tất cả thư mục con cháu
    const descendants = await Folder.find({
      path: { $regex: `^${parentFolder.path}` },
      isTrash: false
    }).select('_id');

    const folderIds = [parentFolder._id, ...descendants.map((d) => d._id)];

    const files = await File.find({
      folder: { $in: folderIds },
      isTrash: false,
      user: userObjectId
    }).select('_id');

    return files.map((f) => f._id);
  }

  // 3. Phạm vi mặc định: Toàn bộ Drive (Global Multi-document QA)
  const [ownedFiles, directSharedFiles, sharedFolders] = await Promise.all([
    // File do chính người dùng sở hữu
    File.find({ user: userObjectId, isTrash: false }).select('_id'),

    // File được người khác chia sẻ trực tiếp
    Share.find({ sharedWith: userObjectId, itemType: 'file' }).distinct('file'),

    // Thư mục được chia sẻ cho người dùng
    Share.find({ sharedWith: userObjectId, itemType: 'folder' }).distinct('folder')
  ]);

  let folderSharedFiles = [];
  if (sharedFolders && sharedFolders.length > 0) {
    const parentFolders = await Folder.find({ _id: { $in: sharedFolders }, isTrash: false });
    const paths = parentFolders.map((f) => new RegExp(`^${f.path}`));
    const allDescendantFolders = await Folder.find({ path: { $in: paths }, isTrash: false }).distinct('_id');
    const allFolderIds = [...sharedFolders, ...allDescendantFolders];

    folderSharedFiles = await File.find({ folder: { $in: allFolderIds }, isTrash: false }).distinct('_id');
  }

  const allFileIds = new Set([
    ...ownedFiles.map((f) => f._id.toString()),
    ...directSharedFiles.map((id) => id.toString()),
    ...folderSharedFiles.map((id) => id.toString())
  ]);

  return Array.from(allFileIds).map((id) => new mongoose.Types.ObjectId(id));
};

/**
 * Tìm kiếm Dense Vector (Atlas Vector Search hoặc Local Cosine Fallback)
 */
const searchDenseVectors = async (queryEmbedding, accessibleFileIds, topK = 20) => {
  if (accessibleFileIds.length === 0) return [];

  try {
    // Thử truy vấn MongoDB Atlas Vector Search ($vectorSearch)
    const pipeline = [
      {
        $vectorSearch: {
          index: 'vector_index',
          path: 'embedding',
          queryVector: queryEmbedding,
          numCandidates: Math.max(topK * 3, 50),
          limit: topK,
          filter: {
            file: { $in: accessibleFileIds }
          }
        }
      },
      {
        $project: {
          _id: 1,
          file: 1,
          chunkIndex: 1,
          content: 1,
          pageNumber: 1,
          sectionTitle: 1,
          score: { $meta: 'vectorSearchScore' }
        }
      }
    ];

    const results = await DocumentChunk.aggregate(pipeline);
    if (Array.isArray(results) && results.length > 0) {
      return results;
    }
  } catch (atlasErr) {
    console.warn(`[RAG Retrieval] Atlas $vectorSearch không khả dụng hoặc chưa tạo index (${atlasErr.message}). Chuyển sang Local Cosine Fallback...`);
  }

  // Local Cosine Fallback (Tính trực tiếp trên bộ nhớ ứng dụng)
  const candidateChunks = await DocumentChunk.find({
    file: { $in: accessibleFileIds }
  })
    .select('_id file chunkIndex content pageNumber sectionTitle embedding')
    .limit(300)
    .lean();

  const scored = candidateChunks.map((chunk) => {
    const sim = cosineSimilarity(queryEmbedding, chunk.embedding);
    return {
      _id: chunk._id,
      file: chunk.file,
      chunkIndex: chunk.chunkIndex,
      content: chunk.content,
      pageNumber: chunk.pageNumber,
      sectionTitle: chunk.sectionTitle,
      score: sim
    };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topK);
};

/**
 * Tìm kiếm Sparse Keyword trên nội dung chunk
 */
const searchSparseKeywords = async (queryText, accessibleFileIds, topK = 20) => {
  if (accessibleFileIds.length === 0 || !queryText.trim()) return [];

  try {
    // Thử dùng Full-Text Search nếu có text index
    const results = await DocumentChunk.find({
      file: { $in: accessibleFileIds },
      $text: { $search: queryText }
    })
      .select('_id file chunkIndex content pageNumber sectionTitle')
      .limit(topK)
      .lean();

    if (results.length > 0) {
      return results.map((r, idx) => ({ ...r, rank: idx + 1 }));
    }
  } catch (textErr) {
    // Nếu text index chưa có hoặc lỗi, fallback sang Regex search
  }

  const words = queryText
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length >= 2);

  if (words.length === 0) return [];

  const regex = new RegExp(words.slice(0, 3).join('|'), 'i');
  const fallbackResults = await DocumentChunk.find({
    file: { $in: accessibleFileIds },
    content: regex
  })
    .select('_id file chunkIndex content pageNumber sectionTitle')
    .limit(topK)
    .lean();

  return fallbackResults.map((r, idx) => ({ ...r, rank: idx + 1 }));
};

/**
 * Dung hợp kết quả bằng thuật toán Reciprocal Rank Fusion (RRF)
 */
const hybridRetrieve = async (userId, queryText, scope = { type: 'all', targetId: null }, limit = 6) => {
  const accessibleFileIds = await resolveAccessibleFileIds(userId, scope);
  if (accessibleFileIds.length === 0) {
    return [];
  }

  // 1. Sinh vector query và thực hiện Dense Search
  const queryEmbedding = await embeddingProvider.getEmbedding(queryText);
  const denseResults = await searchDenseVectors(queryEmbedding, accessibleFileIds, 20);

  // 2. Thực hiện Sparse Keyword Search
  const sparseResults = await searchSparseKeywords(queryText, accessibleFileIds, 20);

  // 3. Tính điểm RRF kết hợp
  const rrfK = 60;
  const chunkScores = new Map();

  denseResults.forEach((item, index) => {
    const id = item._id.toString();
    const denseRrf = 1 / (rrfK + (index + 1));
    chunkScores.set(id, {
      chunk: item,
      rrfScore: denseRrf,
      rawSimilarity: item.score || 0
    });
  });

  sparseResults.forEach((item, index) => {
    const id = item._id.toString();
    const sparseRrf = 1 / (rrfK + (index + 1));
    if (chunkScores.has(id)) {
      const existing = chunkScores.get(id);
      existing.rrfScore += sparseRrf;
    } else {
      chunkScores.set(id, {
        chunk: item,
        rrfScore: sparseRrf,
        rawSimilarity: 0.5
      });
    }
  });

  // 4. Sắp xếp và lấy Top Chunks
  const sortedChunks = Array.from(chunkScores.values())
    .sort((a, b) => b.rrfScore - a.rrfScore)
    .slice(0, limit);

  if (sortedChunks.length === 0) {
    return [];
  }

  // 5. Populate thông tin File cho từng chunk
  const fileIds = [...new Set(sortedChunks.map((c) => c.chunk.file.toString()))];
  const files = await File.find({ _id: { $in: fileIds } })
    .select('_id name extension size aiCategory mimeType')
    .lean();

  const fileMap = new Map(files.map((f) => [f._id.toString(), f]));

  return sortedChunks.map(({ chunk, rrfScore, rawSimilarity }) => {
    const fileData = fileMap.get(chunk.file.toString()) || null;
    return {
      chunkId: chunk._id,
      fileId: chunk.file,
      fileName: fileData?.name || 'Tài liệu',
      fileExtension: fileData?.extension || '',
      fileCategory: fileData?.aiCategory || '',
      pageNumber: chunk.pageNumber || 1,
      sectionTitle: chunk.sectionTitle || '',
      content: chunk.content,
      rrfScore: parseFloat(rrfScore.toFixed(4)),
      similarityScore: parseFloat(rawSimilarity.toFixed(4))
    };
  });
};

module.exports = {
  resolveAccessibleFileIds,
  cosineSimilarity,
  searchDenseVectors,
  searchSparseKeywords,
  hybridRetrieve
};
