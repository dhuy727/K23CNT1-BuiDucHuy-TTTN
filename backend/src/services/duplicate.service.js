const mongoose = require('mongoose');
const File = require('../models/file.model');
const Folder = require('../models/folder.model');
const DuplicateScan = require('../models/duplicateScan.model');
const fileService = require('./file.service');
const { calculateFileHash } = require('../utils/fileHash');
const { compareDocuments } = require('./ai.provider');
const storageService = require('./storage.service');
const ApiError = require('../utils/apiError');

/**
 * Tính toán độ tương đồng Jaccard giữa 2 chuỗi văn bản (dựa trên tập từ n-gram/tokens)
 * Dùng làm bộ lọc thô (pruning) siêu nhanh trước khi gọi LLM tốn token.
 */
const computeTextSimilarity = (textA, textB) => {
  if (!textA || !textB) return 0;

  const tokenize = (text) => {
    return new Set(
      String(text)
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s]/gu, ' ')
        .split(/\s+/)
        .filter((w) => w.length >= 3)
    );
  };

  const setA = tokenize(textA);
  const setB = tokenize(textB);

  if (setA.size === 0 || setB.size === 0) return 0;

  let intersectionCount = 0;
  for (const word of setA) {
    if (setB.has(word)) {
      intersectionCount++;
    }
  }

  const unionCount = setA.size + setB.size - intersectionCount;
  return unionCount === 0 ? 0 : intersectionCount / unionCount;
};

/**
 * Thuật toán heuristics xác định tệp tin nên giữ lại (Original/Primary file)
 */
const selectRecommendedOriginal = (files) => {
  if (!files || files.length === 0) return null;
  if (files.length === 1) return files[0];

  const scoredFiles = files.map((file) => {
    let score = 0;
    const name = (file.name || '').toLowerCase();

    // 1. Phạt điểm các file có tên dạng bản sao: "copy", "(1)", "(2)", "- copy"
    if (/\(\d+\)/.test(name)) score -= 30;
    if (/copy/i.test(name)) score -= 40;
    if (/bản sao/i.test(name)) score -= 40;
    if (/draft/i.test(name)) score -= 15;

    // 2. Thưởng điểm nếu file có từ khóa hoàn thiện: "final", "signed", "chính thức"
    if (/final/i.test(name)) score += 20;
    if (/signed|đã ký/i.test(name)) score += 30;

    // 3. Thưởng điểm nếu file nằm trong thư mục cụ thể thay vì nằm ở Root (null)
    if (file.folder) score += 15;

    // 4. Ưu tiên file được gắn sao (isStarred)
    if (file.isStarred) score += 25;

    // 5. Thưởng điểm nhỏ theo thời gian cập nhật mới hơn
    const updatedTime = new Date(file.updatedAt || file.createdAt || 0).getTime();
    score += (updatedTime / 1e12); // Tỉ lệ cộng nhỏ

    return { file, score };
  });

  scoredFiles.sort((a, b) => b.score - a.score);
  return scoredFiles[0].file;
};

/**
 * Tự động tính hash cho các tệp cũ chưa có contentHash
 */
const backfillContentHashes = async (userId) => {
  const filesWithoutHash = await File.find({
    user: userId,
    isTrash: false,
    $or: [{ contentHash: '' }, { contentHash: null }, { contentHash: { $exists: false } }]
  }).select('_id storagePath name');

  for (const file of filesWithoutHash) {
    if (file.storagePath) {
      try {
        const localPath = storageService.resolveLocalPath(file.storagePath);
        if (localPath) {
          const hash = await calculateFileHash(localPath);
          if (hash) {
            await File.findByIdAndUpdate(file._id, { contentHash: hash });
          }
        }
      } catch (err) {
        console.warn(`[DuplicateService] Không thể tính hash cho file ${file.name}:`, err.message);
      }
    }
  }
};

/**
 * Lấy trạng thái phiên quét hoặc kết quả đã lưu trong database
 */
const getScanStatus = async (userId, folderScope = null) => {
  const query = { user: userId };
  if (folderScope && mongoose.Types.ObjectId.isValid(folderScope)) {
    query.folderScope = folderScope;
  }

  const scan = await DuplicateScan.findOne(query)
    .populate('clusters.originalFile', '_id name size mimeType extension folder createdAt updatedAt isStarred aiCategory aiSummary')
    .populate('clusters.duplicateFiles.file', '_id name size mimeType extension folder createdAt updatedAt isStarred aiCategory aiSummary')
    .populate('folderScope', '_id name')
    .lean();

  if (!scan) {
    return {
      status: 'idle',
      lastScannedAt: null,
      stats: {
        totalFilesScanned: 0,
        wastedBytes: 0,
        wastedFormatted: '0 Bytes',
        exactDuplicateCount: 0,
        similarDuplicateCount: 0
      },
      clusters: []
    };
  }

  // Lọc bỏ các cluster mà các file đã bị xóa vĩnh viễn hoặc chuyển vào thùng rác
  const validClusters = (scan.clusters || []).map((cluster) => {
    const original = cluster.originalFile;
    const validDuplicates = (cluster.duplicateFiles || []).filter((item) => item.file && !item.file.isTrash);
    if (!original || original.isTrash || validDuplicates.length === 0) {
      return null;
    }
    return {
      ...cluster,
      duplicateFiles: validDuplicates
    };
  }).filter(Boolean);

  let wastedBytes = 0;
  validClusters.forEach((c) => {
    c.duplicateFiles.forEach((d) => {
      if (d.isRecommendedDelete && d.file?.size) {
        wastedBytes += d.file.size;
      }
    });
  });

  return {
    ...scan,
    stats: {
      ...scan.stats,
      wastedBytes,
      wastedFormatted: fileService.formatFileSize(wastedBytes)
    },
    clusters: validClusters
  };
};

/**
 * Kích hoạt phiên quét toàn diện: Cấp 1 (SHA-256) + Cấp 2 (AI Semantic)
 */
const startScan = async (userId, folderScope = null) => {
  let scopeId = null;
  if (folderScope && folderScope !== 'root' && folderScope !== 'null') {
    if (mongoose.Types.ObjectId.isValid(folderScope)) {
      scopeId = folderScope;
    }
  }

  // Khởi tạo hoặc cập nhật bản ghi DuplicateScan
  let scanDoc = await DuplicateScan.findOne({ user: userId, folderScope: scopeId });
  if (!scanDoc) {
    scanDoc = new DuplicateScan({
      user: userId,
      folderScope: scopeId,
      status: 'scanning',
      progress: { stage: 'hash_scan', percent: 10, message: 'Đang chuẩn bị và tính toán mã băm tệp...' }
    });
  } else {
    scanDoc.status = 'scanning';
    scanDoc.progress = { stage: 'hash_scan', percent: 10, message: 'Đang chuẩn bị và tính toán mã băm tệp...' };
    scanDoc.clusters = [];
  }
  await scanDoc.save();

  try {
    // Bước 1: Tính toán hash cho các tệp chưa có
    await backfillContentHashes(userId);

    const baseFilter = {
      user: userId,
      isTrash: false
    };
    if (scopeId) {
      baseFilter.folder = scopeId;
    }

    const allFiles = await File.find(baseFilter)
      .select('+extractedText')
      .populate('folder', '_id name color')
      .lean();

    scanDoc.stats.totalFilesScanned = allFiles.length;
    scanDoc.progress = { stage: 'hash_scan', percent: 35, message: 'Đang phát hiện tệp tin trùng khớp 100%...' };
    await scanDoc.save();

    const clusters = [];
    const processedExactFileIds = new Set();

    // Bước 2: Cấp độ 1 - Quét trùng khớp 100% bằng SHA-256
    const hashMap = new Map();
    for (const f of allFiles) {
      if (!f.contentHash) continue;
      if (!hashMap.has(f.contentHash)) {
        hashMap.set(f.contentHash, []);
      }
      hashMap.get(f.contentHash).push(f);
    }

    let exactDupCount = 0;
    let clusterIndex = 1;

    for (const [hash, group] of hashMap.entries()) {
      if (group.length > 1) {
        const original = selectRecommendedOriginal(group);
        const duplicates = group.filter((item) => String(item._id) !== String(original._id));

        duplicates.forEach((d) => processedExactFileIds.add(String(d._id)));
        processedExactFileIds.add(String(original._id));
        exactDupCount += duplicates.length;

        clusters.push({
          clusterId: `exact-${clusterIndex++}`,
          type: 'exact',
          similarityScore: 100,
          aiAnalysis: `Phát hiện ${group.length} tệp tin có cùng nội dung nhị phân (mã băm SHA-256 trùng khớp 100%). Bạn có thể giữ lại bản chính và xóa các bản sao để tiết kiệm dung lượng.`,
          originalFile: original._id,
          duplicateFiles: duplicates.map((d) => ({
            file: d._id,
            isRecommendedDelete: true
          }))
        });
      }
    }

    // Bước 3: Cấp độ 2 - Quét tương đồng ngữ nghĩa AI (cho văn bản PDF, DOCX, TXT, MD)
    scanDoc.progress = { stage: 'ai_compare', percent: 65, message: 'AI đang phân tích ngữ nghĩa và so sánh nội dung tài liệu...' };
    await scanDoc.save();

    // Lọc các tệp tài liệu có trích xuất văn bản và chưa nằm trong nhóm trùng 100%
    const candidateFiles = allFiles.filter((f) => {
      if (processedExactFileIds.has(String(f._id))) return false;
      const ext = (f.extension || '').toLowerCase();
      const isDoc = ['pdf', 'docx', 'txt', 'md'].includes(ext);
      const hasText = f.extractedText && f.extractedText.trim().length >= 40;
      return isDoc && hasText;
    });

    // Tạo danh sách cặp ứng viên tiềm năng để so sánh AI
    const candidatePairs = [];
    const ignoredSet = new Set(
      (scanDoc.ignoredPairs || []).map((p) => `${p.fileA}_${p.fileB}`)
    );

    for (let i = 0; i < candidateFiles.length; i++) {
      for (let j = i + 1; j < candidateFiles.length; j++) {
        const fileA = candidateFiles[i];
        const fileB = candidateFiles[j];

        const pairKey1 = `${fileA._id}_${fileB._id}`;
        const pairKey2 = `${fileB._id}_${fileA._id}`;
        if (ignoredSet.has(pairKey1) || ignoredSet.has(pairKey2)) {
          continue;
        }

        // Kiểm tra bộ lọc sơ bộ (Pruning):
        // 1. Tương đồng Jaccard > 0.35 HOẶC
        // 2. Cùng danh mục AI và tỷ lệ kích thước không quá chênh lệch
        const jaccard = computeTextSimilarity(fileA.extractedText, fileB.extractedText);
        const sizeRatio = Math.min(fileA.size, fileB.size) / Math.max(fileA.size || 1, fileB.size || 1);
        const sameCategory = fileA.aiCategory && fileB.aiCategory && fileA.aiCategory === fileB.aiCategory && fileA.aiCategory !== 'Khác';

        if (jaccard >= 0.35 || (sameCategory && sizeRatio >= 0.4 && jaccard >= 0.2)) {
          candidatePairs.push({ fileA, fileB, jaccard });
        }
      }
    }

    // Giới hạn tối đa 15 cặp so sánh AI mỗi phiên quét để tối ưu token và thời gian
    const pairsToCompare = candidatePairs.slice(0, 15);
    let similarDupCount = 0;

    for (const pair of pairsToCompare) {
      try {
        const aiResult = await compareDocuments({ fileA: pair.fileA, fileB: pair.fileB });
        if (aiResult.isNearDuplicate && aiResult.similarityScore >= 70) {
          const original = aiResult.recommendedKeep === 'fileB' ? pair.fileB : pair.fileA;
          const duplicate = aiResult.recommendedKeep === 'fileB' ? pair.fileA : pair.fileB;

          similarDupCount++;
          clusters.push({
            clusterId: `semantic-${clusterIndex++}`,
            type: 'semantic',
            similarityScore: aiResult.similarityScore,
            aiAnalysis: aiResult.aiAnalysis || `AI xác định 2 tài liệu này có độ tương đồng nội dung ${aiResult.similarityScore}%.`,
            originalFile: original._id,
            duplicateFiles: [
              {
                file: duplicate._id,
                isRecommendedDelete: true
              }
            ]
          });
        }
      } catch (aiErr) {
        console.warn(`[DuplicateService] AI so sánh thất bại giữa ${pair.fileA.name} và ${pair.fileB.name}:`, aiErr.message);
      }
    }

    // Bước 4: Hoàn tất & Tính toán tổng dung lượng lãng phí
    scanDoc.progress = { stage: 'finalizing', percent: 95, message: 'Đang hoàn tất và tổng hợp kết quả...' };
    await scanDoc.save();

    let wastedBytes = 0;
    clusters.forEach((c) => {
      c.duplicateFiles.forEach((d) => {
        const f = allFiles.find((item) => String(item._id) === String(d.file));
        if (f && d.isRecommendedDelete) {
          wastedBytes += f.size || 0;
        }
      });
    });

    scanDoc.status = 'completed';
    scanDoc.progress = { stage: 'finalizing', percent: 100, message: 'Quét hoàn tất!' };
    scanDoc.stats.wastedBytes = wastedBytes;
    scanDoc.stats.exactDuplicateCount = exactDupCount;
    scanDoc.stats.similarDuplicateCount = similarDupCount;
    scanDoc.clusters = clusters;
    scanDoc.lastScannedAt = new Date();
    await scanDoc.save();

    return getScanStatus(userId, scopeId);
  } catch (error) {
    console.error('[DuplicateService] Lỗi trong quá trình quét trùng lặp:', error);
    scanDoc.status = 'failed';
    scanDoc.progress = { stage: 'finalizing', percent: 0, message: `Lỗi quét: ${error.message}` };
    await scanDoc.save();
    throw error;
  }
};

/**
 * Lấy danh sách tệp tin có dung lượng lớn (< 500MB hoặc theo ngưỡng)
 */
const getLargeFiles = async (userId, options = {}) => {
  const minBytes = Number(options.minBytes) || (10 * 1024 * 1024); // Mặc định > 10MB
  const maxBytes = Number(options.maxBytes) || (500 * 1024 * 1024); // Mặc định < 500MB
  const limit = Math.min(100, Math.max(1, Number(options.limit) || 30));

  const filter = {
    user: userId,
    isTrash: false,
    size: { $gte: minBytes, $lte: maxBytes }
  };

  if (options.folderScope && mongoose.Types.ObjectId.isValid(options.folderScope)) {
    filter.folder = options.folderScope;
  }

  const files = await File.find(filter)
    .populate('folder', '_id name color')
    .sort({ size: -1 })
    .limit(limit)
    .lean();

  const totalSize = files.reduce((sum, f) => sum + (f.size || 0), 0);

  return {
    files: files.map((f) => ({
      ...f,
      formattedSize: fileService.formatFileSize(f.size)
    })),
    totalCount: files.length,
    totalSizeBytes: totalSize,
    totalSizeFormatted: fileService.formatFileSize(totalSize),
    thresholds: {
      minBytes,
      maxBytes,
      minFormatted: fileService.formatFileSize(minBytes),
      maxFormatted: fileService.formatFileSize(maxBytes)
    }
  };
};

/**
 * Dọn dẹp danh sách các tệp đã chọn (Soft delete vào Thùng rác)
 */
const cleanSelectedFiles = async (userId, fileIds = []) => {
  if (!Array.isArray(fileIds) || fileIds.length === 0) {
    throw new ApiError(400, 'Vui lòng chọn ít nhất một tệp tin để dọn dẹp');
  }

  const results = [];
  let cleanedBytes = 0;

  for (const fileId of fileIds) {
    try {
      const file = await File.findOne({ _id: fileId, user: userId, isTrash: false });
      if (file) {
        cleanedBytes += file.size || 0;
        await fileService.deleteFile(userId, fileId);
        results.push({ fileId, success: true, name: file.name });
      }
    } catch (err) {
      results.push({ fileId, success: false, error: err.message });
    }
  }

  // Cập nhật lại các cluster trong DuplicateScan của user
  await DuplicateScan.updateMany(
    { user: userId },
    {
      $pull: {
        'clusters.$[].duplicateFiles': { file: { $in: fileIds } }
      }
    }
  );

  return {
    cleanedCount: results.filter((r) => r.success).length,
    cleanedBytes,
    cleanedFormatted: fileService.formatFileSize(cleanedBytes),
    details: results
  };
};

/**
 * Bỏ qua cặp tệp tin không coi là trùng lặp trong tương lai
 */
const ignorePair = async (userId, fileAId, fileBId) => {
  if (!mongoose.Types.ObjectId.isValid(fileAId) || !mongoose.Types.ObjectId.isValid(fileBId)) {
    throw new ApiError(400, 'ID tệp tin không hợp lệ');
  }

  await DuplicateScan.updateMany(
    { user: userId },
    {
      $addToSet: {
        ignoredPairs: { fileA: fileAId, fileB: fileBId }
      },
      $pull: {
        clusters: {
          $or: [
            { originalFile: fileAId, 'duplicateFiles.file': fileBId },
            { originalFile: fileBId, 'duplicateFiles.file': fileAId }
          ]
        }
      }
    }
  );

  return { success: true, message: 'Đã lưu thiết lập bỏ qua cặp tệp tin này' };
};

/**
 * Lấy dữ liệu so sánh chi tiết giữa 2 tệp (phục vụ Side-by-Side Modal)
 */
const getCompareDetail = async (userId, fileAId, fileBId) => {
  if (!mongoose.Types.ObjectId.isValid(fileAId) || !mongoose.Types.ObjectId.isValid(fileBId)) {
    throw new ApiError(400, 'ID tệp tin không hợp lệ');
  }

  const [fileA, fileB] = await Promise.all([
    File.findOne({ _id: fileAId, user: userId, isTrash: false })
      .select('+extractedText')
      .populate('folder', '_id name color')
      .lean(),
    File.findOne({ _id: fileBId, user: userId, isTrash: false })
      .select('+extractedText')
      .populate('folder', '_id name color')
      .lean()
  ]);

  if (!fileA || !fileB) {
    throw new ApiError(404, 'Một trong hai tệp tin không tồn tại hoặc đã bị xóa');
  }

  let aiAnalysis = '';
  let similarityScore = 0;

  // Nếu là tệp cùng mã hash
  if (fileA.contentHash && fileB.contentHash && fileA.contentHash === fileB.contentHash) {
    similarityScore = 100;
    aiAnalysis = 'Hai tệp tin trùng khớp 100% dữ liệu nhị phân (cùng mã băm SHA-256).';
  } else if (fileA.extractedText && fileB.extractedText) {
    try {
      const compareRes = await compareDocuments({ fileA, fileB });
      similarityScore = compareRes.similarityScore;
      aiAnalysis = compareRes.aiAnalysis;
    } catch (err) {
      similarityScore = Math.round(computeTextSimilarity(fileA.extractedText, fileB.extractedText) * 100);
      aiAnalysis = `Độ tương đồng từ vựng xấp xỉ ${similarityScore}%.`;
    }
  }

  return {
    fileA: {
      ...fileA,
      formattedSize: fileService.formatFileSize(fileA.size)
    },
    fileB: {
      ...fileB,
      formattedSize: fileService.formatFileSize(fileB.size)
    },
    similarityScore,
    aiAnalysis,
    recommendedKeep: selectRecommendedOriginal([fileA, fileB])?._id
  };
};

module.exports = {
  getScanStatus,
  startScan,
  getLargeFiles,
  cleanSelectedFiles,
  ignorePair,
  getCompareDetail,
  backfillContentHashes
};
