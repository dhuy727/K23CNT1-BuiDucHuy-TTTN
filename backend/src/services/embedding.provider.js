/**
 * Nhà cung cấp Vector Embeddings (Gemini text-embedding-004 & OpenAI text-embedding-3-small)
 */

const DEFAULT_GEMINI_EMBEDDING_MODEL = 'gemini-embedding-001';
const DEFAULT_OPENAI_EMBEDDING_MODEL = 'text-embedding-3-small';
const EMBEDDING_DIMENSIONS = 768; // Chiều vector chuẩn tương thích cả 2 nhà cung cấp

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

  return values;
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

  return embeddings.map((e) => e.values);
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
  return data.map((d) => d.embedding);
};

/**
 * Sinh vector embedding cho một câu truy vấn người dùng (Query Embedding)
 */
const getEmbedding = async (text) => {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error('Thiếu AI_API_KEY trong cấu hình hệ thống');
  }

  const provider = getProvider();
  const cleanText = String(text || '').trim();
  if (!cleanText) {
    throw new Error('Chuỗi văn bản cần embedding không được rỗng');
  }

  if (provider === 'openai' || provider === 'openai-compatible') {
    const vectors = await callOpenAiBatch([cleanText], apiKey, process.env.AI_EMBEDDING_MODEL || DEFAULT_OPENAI_EMBEDDING_MODEL, process.env.AI_BASE_URL || 'https://api.openai.com/v1');
    return vectors[0];
  }

  return await callGeminiSingle(cleanText, apiKey, process.env.AI_EMBEDDING_MODEL || DEFAULT_GEMINI_EMBEDDING_MODEL);
};

/**
 * Sinh vector embeddings cho nhiều chunks văn bản với cơ chế chia batch và tự động retry
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
  const batchSize = options.batchSize || 15; // Giữ batch nhỏ để tránh 429 rate limit
  const results = [];

  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    let attempts = 0;
    let success = false;
    let lastError = null;

    while (attempts < 5 && !success) {
      attempts++;
      try {
        let batchVectors = [];
        if (provider === 'openai' || provider === 'openai-compatible') {
          batchVectors = await callOpenAiBatch(
            batch,
            apiKey,
            process.env.AI_EMBEDDING_MODEL || DEFAULT_OPENAI_EMBEDDING_MODEL,
            process.env.AI_BASE_URL || 'https://api.openai.com/v1'
          );
        } else {
          batchVectors = await callGeminiBatch(
            batch,
            apiKey,
            process.env.AI_EMBEDDING_MODEL || DEFAULT_GEMINI_EMBEDDING_MODEL
          );
        }

        results.push(...batchVectors);
        success = true;
      } catch (err) {
        lastError = err;
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
      throw lastError || new Error(`Không thể sinh embeddings cho batch ${i}`);
    }

    // Nghỉ nhẹ 500ms giữa các batch để giữ ổn định quota
    if (i + batchSize < texts.length) {
      await sleep(500);
    }
  }

  return results;
};

module.exports = {
  EMBEDDING_DIMENSIONS,
  DEFAULT_GEMINI_EMBEDDING_MODEL,
  DEFAULT_OPENAI_EMBEDDING_MODEL,
  getEmbedding,
  getEmbeddings
};
