/**
 * Nhà cung cấp Vector Embeddings (Gemini text-embedding-004 & OpenAI text-embedding-3-small)
 */

const DEFAULT_GEMINI_EMBEDDING_MODEL = 'gemini-embedding-001';
const DEFAULT_OPENAI_EMBEDDING_MODEL = 'text-embedding-3-small';
const EMBEDDING_DIMENSIONS = 768; // Chiều vector chuẩn tương thích cả 2 nhà cung cấp

const {
  normalizeGeminiUsage,
  normalizeOpenAiUsage,
  estimateUsage,
  recordUsage
} = require('./aiUsage.service');

const getApiKey = () => (process.env.AI_API_KEY || '').trim();
const getProvider = () => (process.env.AI_PROVIDER || 'gemini').trim().toLowerCase();

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Gọi API Google Gemini tạo embedding cho 1 đoạn văn bản
 */
const callGeminiSingle = async (text, apiKey, model = DEFAULT_GEMINI_EMBEDDING_MODEL) => {
  const cleanModel = String(model || DEFAULT_GEMINI_EMBEDDING_MODEL).replace(/^models\//, '');
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(cleanModel)}:embedContent?key=${encodeURIComponent(apiKey)}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: `models/${cleanModel}`,
      content: {
        parts: [{ text: text.slice(0, 8000) }]
      },
      outputDimensionality: EMBEDDING_DIMENSIONS
    })
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.error?.message || `Gemini Embedding lỗi HTTP ${response.status}`);
  }

  const values = payload?.embedding?.values;
  if (!Array.isArray(values) || values.length === 0) {
    throw new Error('Gemini không trả về mảng vector embedding');
  }

  return { vectors: [values], usage: normalizeGeminiUsage(payload?.usageMetadata) };
};

/**
 * Gọi API Google Gemini tạo embeddings hàng loạt (Batch)
 */
const callGeminiBatch = async (texts, apiKey, model = DEFAULT_GEMINI_EMBEDDING_MODEL) => {
  const cleanModel = String(model || DEFAULT_GEMINI_EMBEDDING_MODEL).replace(/^models\//, '');
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(cleanModel)}:batchEmbedContents?key=${encodeURIComponent(apiKey)}`;
  
  const requests = texts.map((t) => ({
    model: `models/${cleanModel}`,
    content: {
      parts: [{ text: t.slice(0, 8000) }]
    },
    outputDimensionality: EMBEDDING_DIMENSIONS
  }));

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ requests })
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.error?.message || `Gemini Batch Embedding lỗi HTTP ${response.status}`);
  }

  const embeddings = payload?.embeddings;
  if (!Array.isArray(embeddings) || embeddings.length === 0) {
    throw new Error('Gemini không trả về danh sách vector embeddings');
  }

  return { vectors: embeddings.map((e) => e.values), usage: normalizeGeminiUsage(payload?.usageMetadata) };
};

/**
 * Gọi OpenAI hoặc endpoint OpenAI-compatible
 */
const callOpenAiBatch = async (texts, apiKey, model = DEFAULT_OPENAI_EMBEDDING_MODEL, baseUrl = 'https://api.openai.com/v1') => {
  const endpoint = `${baseUrl.replace(/\/$/, '')}/embeddings`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      input: texts.map((t) => t.slice(0, 8000)),
      dimensions: EMBEDDING_DIMENSIONS
    })
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.error?.message || `OpenAI Embedding lỗi HTTP ${response.status}`);
  }

  const data = payload?.data;
  if (!Array.isArray(data)) {
    throw new Error('OpenAI không trả về danh sách vector embeddings');
  }

  // Đảm bảo đúng thứ tự index
  data.sort((a, b) => a.index - b.index);
  return { vectors: data.map((d) => d.embedding), usage: normalizeOpenAiUsage(payload?.usage) };
};

/**
 * Cộng dồn usage của nhiều batch
 */
const addUsage = (acc, usage) => {
  if (!usage) return acc;
  return {
    promptTokens: acc.promptTokens + (usage.promptTokens || 0),
    completionTokens: acc.completionTokens + (usage.completionTokens || 0),
    cachedTokens: acc.cachedTokens + (usage.cachedTokens || 0),
    totalTokens: acc.totalTokens + (usage.totalTokens || 0)
  };
};

const resolveEmbeddingModel = (provider) =>
  process.env.AI_EMBEDDING_MODEL ||
  (provider === 'openai' || provider === 'openai-compatible'
    ? DEFAULT_OPENAI_EMBEDDING_MODEL
    : DEFAULT_GEMINI_EMBEDDING_MODEL);

/**
 * Văn bản thực tế được gửi đi (đã cắt 8000 ký tự) dùng để ước lượng token khi API không trả usage
 */
const truncatedForApi = (texts) => texts.map((t) => String(t || '').slice(0, 8000));

/**
 * Sinh vector embedding cho một câu truy vấn người dùng (Query Embedding)
 * @param {string} text
 * @param {object} [context] - { userId, feature } phục vụ ghi nhật ký sử dụng
 */
const getEmbedding = async (text, context = {}) => {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error('Thiếu AI_API_KEY trong cấu hình hệ thống');
  }

  const provider = getProvider();
  const cleanText = String(text || '').trim();
  if (!cleanText) {
    throw new Error('Chuỗi văn bản cần embedding không được rỗng');
  }

  const model = resolveEmbeddingModel(provider);
  const startedAt = Date.now();
  const logBase = {
    userId: context.userId || null,
    feature: context.feature || 'rag_embed_query',
    provider,
    model,
    itemCount: 1
  };

  try {
    const result = provider === 'openai' || provider === 'openai-compatible'
      ? await callOpenAiBatch([cleanText], apiKey, model, process.env.AI_BASE_URL || 'https://api.openai.com/v1')
      : await callGeminiSingle(cleanText, apiKey, model);

    recordUsage({
      ...logBase,
      usage: result.usage || estimateUsage(truncatedForApi([cleanText]), ''),
      estimated: !result.usage,
      latencyMs: Date.now() - startedAt
    });

    return result.vectors[0];
  } catch (err) {
    recordUsage({
      ...logBase,
      status: 'error',
      errorMessage: err.message,
      latencyMs: Date.now() - startedAt
    });
    throw err;
  }
};

/**
 * Sinh vector embeddings cho nhiều chunks văn bản với cơ chế chia batch và tự động retry
 * @param {string[]} texts
 * @param {object} [options] - { batchSize, userId, fileId, feature }
 */
const getEmbeddings = async (texts = [], options = {}) => {
  if (!Array.isArray(texts) || texts.length === 0) {
    return [];
  }

  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error('Thiếu AI_API_KEY trong cấu hình hệ thống');
  }

  const provider = getProvider();
  const model = resolveEmbeddingModel(provider);
  const batchSize = options.batchSize || 15; // Giữ batch nhỏ để tránh 429 rate limit
  const results = [];

  const startedAt = Date.now();
  let usageTotal = { promptTokens: 0, completionTokens: 0, cachedTokens: 0, totalTokens: 0 };
  let estimatedAny = false;
  let failedAttempts = 0;
  let batchCount = 0;

  const flushUsage = (status, errorMessage = '') => {
    recordUsage({
      userId: options.userId || null,
      fileId: options.fileId || null,
      feature: options.feature || 'rag_index',
      provider,
      model,
      usage: usageTotal,
      estimated: estimatedAny,
      status,
      errorMessage,
      latencyMs: Date.now() - startedAt,
      itemCount: texts.length,
      meta: { batchSize, batchCount, failedAttempts, embeddedCount: results.length }
    });
  };

  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    let attempts = 0;
    let success = false;
    let lastError = null;

    while (attempts < 5 && !success) {
      attempts++;
      try {
        let batchResult;
        if (provider === 'openai' || provider === 'openai-compatible') {
          batchResult = await callOpenAiBatch(
            batch,
            apiKey,
            model,
            process.env.AI_BASE_URL || 'https://api.openai.com/v1'
          );
        } else {
          batchResult = await callGeminiBatch(batch, apiKey, model);
        }

        results.push(...batchResult.vectors);
        batchCount++;
        if (batchResult.usage) {
          usageTotal = addUsage(usageTotal, batchResult.usage);
        } else {
          estimatedAny = true;
          usageTotal = addUsage(usageTotal, estimateUsage(truncatedForApi(batch), ''));
        }
        success = true;
      } catch (err) {
        lastError = err;
        failedAttempts++;
        console.warn(`[Embedding] Lỗi batch (${i} - ${i + batch.length}), thử lại lần ${attempts}: ${err.message}`);
        if (attempts < 5) {
          const isRateLimit = /quota|rate|429|exhausted/i.test(err.message);
          let delayMs = 1500 * Math.pow(2, attempts);
          if (isRateLimit) {
            const retryMatch = err.message.match(/retry in ([0-9.]+)s/i);
            const seconds = retryMatch ? parseFloat(retryMatch[1]) : 25;
            delayMs = Math.ceil(seconds * 1000) + 2000;
            console.log(`[Embedding] ⏳ Quota rate limit detected. Tạm nghỉ ${Math.round(delayMs / 1000)}s rồi thử lại...`);
          }
          await sleep(delayMs);
        }
      }
    }

    if (!success) {
      const finalError = lastError || new Error(`Không thể sinh embeddings cho batch ${i}`);
      flushUsage('error', finalError.message);
      throw finalError;
    }

    // Nghỉ nhẹ 500ms giữa các batch để giữ ổn định quota
    if (i + batchSize < texts.length) {
      await sleep(500);
    }
  }

  flushUsage('success');
  return results;
};

module.exports = {
  EMBEDDING_DIMENSIONS,
  DEFAULT_GEMINI_EMBEDDING_MODEL,
  DEFAULT_OPENAI_EMBEDDING_MODEL,
  getEmbedding,
  getEmbeddings
};
