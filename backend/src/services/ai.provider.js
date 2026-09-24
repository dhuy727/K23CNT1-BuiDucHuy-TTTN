const AI_CATEGORIES = [
  'Hợp đồng',
  'Hóa đơn',
  'Báo cáo',
  'Tài liệu học tập',
  'CV',
  'Biên bản',
  'Tài liệu kỹ thuật',
  'Khác'
];

const DEFAULT_GEMINI_MODEL = 'gemini-3.6-flash';
const GEMINI_CANDIDATES = [
  'gemini-3.5-flash',
  'gemini-3.6-flash',
  'gemini-3.1-flash-lite',
  'gemini-flash-latest'
];
const DEFAULT_OPENAI_MODEL = 'gpt-4o-mini';
const DEFAULT_OPENAI_BASE_URL = 'https://api.openai.com/v1';

const getProviderName = () => (process.env.AI_PROVIDER || 'gemini').trim().toLowerCase();

const getApiKey = () => (process.env.AI_API_KEY || '').trim();

const stripCodeFence = (text) => {
  const trimmed = String(text || '').trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced ? fenced[1].trim() : trimmed;
};

const clampConfidence = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0.5;
  return Math.min(1, Math.max(0, n));
};

const normalizeCategory = (category) => {
  const raw = String(category || '').trim();
  const match = AI_CATEGORIES.find((item) => item.toLowerCase() === raw.toLowerCase());
  return match || 'Khác';
};

const normalizeTags = (tags) => {
  if (!Array.isArray(tags)) return [];
  const unique = [];
  for (const tag of tags) {
    const value = String(tag || '').trim().slice(0, 40);
    if (!value) continue;
    if (!unique.some((item) => item.toLowerCase() === value.toLowerCase())) {
      unique.push(value);
    }
    if (unique.length >= 8) break;
  }
  return unique;
};

const keepExtension = (suggestedName, originalName) => {
  const name = String(suggestedName || '').trim().replace(/[\\/:*?"<>|]/g, '').slice(0, 255);
  if (!name) return '';
  const originalExt = (originalName || '').includes('.')
    ? originalName.slice(originalName.lastIndexOf('.'))
    : '';
  if (!originalExt) return name;
  if (name.toLowerCase().endsWith(originalExt.toLowerCase())) {
    return name;
  }
  return `${name}${originalExt}`;
};

const buildPrompt = ({ fileName, mimeType, extension, extractedText }) => `
Bạn là bộ phân loại tài liệu cho hệ thống SmartDoc.
Chỉ trả về JSON hợp lệ, không markdown, với đúng các khóa:
{
  "category": một trong ${JSON.stringify(AI_CATEGORIES)},
  "confidence": số từ 0 đến 1,
  "tags": mảng tối đa 8 chuỗi ngắn,
  "summary": tóm tắt tiếng Việt 2-5 câu,
  "suggestedName": tên file gợi ý, rõ nghĩa, giữ đuôi file gốc
}

Thông tin file:
- Tên: ${fileName}
- MIME: ${mimeType || 'unknown'}
- Đuôi: ${extension || ''}

Nội dung đã trích xuất (có thể bị cắt):
"""
${extractedText || '(không có nội dung văn bản)'}
"""
`.trim();

const parseModelJson = (rawText, originalName) => {
  const parsed = JSON.parse(stripCodeFence(rawText));
  return {
    category: normalizeCategory(parsed.category),
    confidence: clampConfidence(parsed.confidence),
    tags: normalizeTags(parsed.tags),
    summary: String(parsed.summary || '').trim().slice(0, 2000),
    suggestedName: keepExtension(parsed.suggestedName, originalName)
  };
};

const callGemini = async ({ apiKey, model, prompt }) => {
  const modelsToTry = Array.from(new Set([model, ...GEMINI_CANDIDATES].filter(Boolean)));
  let lastError = null;

  for (const currentModel of modelsToTry) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(currentModel)}:generateContent?key=${encodeURIComponent(apiKey)}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.2,
            responseMimeType: 'application/json'
          }
        })
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        const message = payload?.error?.message || `Gemini (${currentModel}) trả về HTTP ${response.status}`;
        console.warn(`[Gemini Provider] Model ${currentModel} lỗi (${response.status}): ${message}. Đang thử model tiếp theo...`);
        lastError = new Error(message);
        continue;
      }

      const text = payload?.candidates?.[0]?.content?.parts
        ?.map((part) => part.text || '')
        .join('')
        .trim();

      if (!text) {
        lastError = new Error(`Gemini (${currentModel}) không trả về nội dung`);
        continue;
      }

      return text;
    } catch (err) {
      console.warn(`[Gemini Provider] Thất bại khi gọi model ${currentModel}: ${err.message}`);
      lastError = err;
    }
  }

  throw lastError || new Error('Tất cả các model Gemini đều không khả dụng lúc này');
};

const callOpenAiCompatible = async ({ apiKey, model, prompt, baseUrl }) => {
  const endpoint = `${baseUrl.replace(/\/$/, '')}/chat/completions`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: 'Bạn chỉ trả về JSON hợp lệ theo schema đã yêu cầu.' },
        { role: 'user', content: prompt }
      ]
    })
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = payload?.error?.message || `LLM trả về HTTP ${response.status}`;
    throw new Error(message);
  }

  const text = payload?.choices?.[0]?.message?.content;
  if (!text) {
    throw new Error('LLM không trả về nội dung phân loại');
  }
  return text;
};

/**
 * Gọi LLM và chuẩn hóa kết quả phân loại tài liệu.
 */
const classifyDocument = async ({ fileName, mimeType, extension, extractedText }) => {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error('Thiếu AI_API_KEY nên không gọi được mô hình ngôn ngữ');
  }

  const provider = getProviderName();
  const prompt = buildPrompt({ fileName, mimeType, extension, extractedText });
  let rawText;

  if (provider === 'openai' || provider === 'openai-compatible') {
    rawText = await callOpenAiCompatible({
      apiKey,
      model: process.env.AI_MODEL || DEFAULT_OPENAI_MODEL,
      prompt,
      baseUrl: process.env.AI_BASE_URL || DEFAULT_OPENAI_BASE_URL
    });
  } else {
    rawText = await callGemini({
      apiKey,
      model: process.env.AI_MODEL || DEFAULT_GEMINI_MODEL,
      prompt
    });
  }

  try {
    return parseModelJson(rawText, fileName);
  } catch {
    throw new Error('LLM trả về JSON không hợp lệ');
  }
};

const buildComparePrompt = ({ fileA, fileB }) => `
Bạn là chuyên gia thẩm định tài liệu cho hệ thống lưu trữ SmartDoc.
Nhiệm vụ của bạn là so sánh 2 tài liệu sau để xác định xem chúng có phải là bản trùng lặp nội dung, bản thảo, hoặc bản cập nhật gần giống nhau (near-duplicate) hay không.

Chỉ trả về định dạng JSON hợp lệ, không bọc markdown, với đúng các thuộc tính:
{
  "similarityScore": <số nguyên từ 0 đến 100>,
  "isNearDuplicate": <boolean, true nếu similarityScore >= 70>,
  "aiAnalysis": "<nhận xét 2-3 câu bằng tiếng Việt nêu rõ điểm giống và khác biệt chính>",
  "recommendedKeep": "<'fileA' hoặc 'fileB'>"
}

Tài liệu A:
- Tên: ${fileA.name}
- Loại: ${fileA.mimeType || fileA.extension}
- Trích đoạn nội dung:
"""
${String(fileA.extractedText || '').slice(0, 3000) || '(không có nội dung văn bản)'}
"""

Tài liệu B:
- Tên: ${fileB.name}
- Loại: ${fileB.mimeType || fileB.extension}
- Trích đoạn nội dung:
"""
${String(fileB.extractedText || '').slice(0, 3000) || '(không có nội dung văn bản)'}
"""
`.trim();

/**
 * Gọi LLM để so sánh độ tương đồng và phát hiện bản sao/bản sửa đổi giữa 2 tài liệu.
 */
const compareDocuments = async ({ fileA, fileB }) => {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error('Thiếu AI_API_KEY nên không gọi được mô hình ngôn ngữ');
  }

  const provider = getProviderName();
  const prompt = buildComparePrompt({ fileA, fileB });
  let rawText;

  if (provider === 'openai' || provider === 'openai-compatible') {
    rawText = await callOpenAiCompatible({
      apiKey,
      model: process.env.AI_MODEL || DEFAULT_OPENAI_MODEL,
      prompt,
      baseUrl: process.env.AI_BASE_URL || DEFAULT_OPENAI_BASE_URL
    });
  } else {
    rawText = await callGemini({
      apiKey,
      model: process.env.AI_MODEL || DEFAULT_GEMINI_MODEL,
      prompt
    });
  }

  try {
    const parsed = JSON.parse(stripCodeFence(rawText));
    const score = Math.min(100, Math.max(0, parseInt(parsed.similarityScore, 10) || 0));
    return {
      similarityScore: score,
      isNearDuplicate: Boolean(parsed.isNearDuplicate || score >= 70),
      aiAnalysis: String(parsed.aiAnalysis || '').trim().slice(0, 1000),
      recommendedKeep: parsed.recommendedKeep === 'fileB' ? 'fileB' : 'fileA'
    };
  } catch {
    throw new Error('LLM trả về kết quả so sánh không phải JSON hợp lệ');
  }
};

module.exports = {
  AI_CATEGORIES,
  classifyDocument,
  compareDocuments
};
