/**
 * Dịch vụ ghi nhận mức sử dụng AI (token & chi phí ước tính).
 *
 * Nguyên tắc:
 * - KHÔNG BAO GIỜ làm hỏng luồng nghiệp vụ: mọi lỗi khi ghi log đều bị nuốt và chỉ cảnh báo.
 * - Ưu tiên số token thật từ API (usageMetadata / usage). Chỉ ước lượng khi API không trả về.
 * - Có thể tắt bằng AI_USAGE_LOGGING=false.
 */

const AiUsageLog = require('../models/aiUsageLog.model');
const { calculateCostUsd } = require('../config/aiPricing');
const { estimateTokens } = require('./chunking.service');

const isLoggingEnabled = () => String(process.env.AI_USAGE_LOGGING || 'true').toLowerCase() !== 'false';

const toInt = (value) => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
};

const emptyUsage = () => ({
  promptTokens: 0,
  completionTokens: 0,
  cachedTokens: 0,
  totalTokens: 0
});

/**
 * Chuẩn hóa usageMetadata của Gemini.
 * thoughtsTokenCount (thinking) được tính phí như output nên cộng vào completionTokens.
 */
const normalizeGeminiUsage = (usageMetadata) => {
  if (!usageMetadata || typeof usageMetadata !== 'object') return null;

  const promptTokens = toInt(usageMetadata.promptTokenCount);
  const completionTokens = toInt(usageMetadata.candidatesTokenCount) + toInt(usageMetadata.thoughtsTokenCount);
  const cachedTokens = toInt(usageMetadata.cachedContentTokenCount);
  const totalTokens = toInt(usageMetadata.totalTokenCount) || promptTokens + completionTokens;

  if (!promptTokens && !completionTokens && !totalTokens) return null;
  return { promptTokens, completionTokens, cachedTokens, totalTokens };
};

/**
 * Chuẩn hóa usage của OpenAI / OpenAI-compatible.
 */
const normalizeOpenAiUsage = (usage) => {
  if (!usage || typeof usage !== 'object') return null;

  const promptTokens = toInt(usage.prompt_tokens);
  const completionTokens = toInt(usage.completion_tokens);
  const cachedTokens = toInt(usage.prompt_tokens_details?.cached_tokens);
  const totalTokens = toInt(usage.total_tokens) || promptTokens + completionTokens;

  if (!promptTokens && !completionTokens && !totalTokens) return null;
  return { promptTokens, completionTokens, cachedTokens, totalTokens };
};

/**
 * Ước lượng usage khi API không trả số liệu (stream bị hủy, endpoint không hỗ trợ...).
 * @param {string|string[]} promptText - toàn bộ văn bản đầu vào
 * @param {string} completionText - văn bản đầu ra
 */
const estimateUsage = (promptText = '', completionText = '') => {
  const promptJoined = Array.isArray(promptText) ? promptText.join('\n') : String(promptText || '');
  const promptTokens = estimateTokens(promptJoined);
  const completionTokens = estimateTokens(String(completionText || ''));
  return {
    promptTokens,
    completionTokens,
    cachedTokens: 0,
    totalTokens: promptTokens + completionTokens
  };
};

/**
 * Ghi một bản ghi sử dụng AI. Không throw, không cần await (fire-and-forget).
 *
 * @param {object} entry
 * @param {string} entry.feature - 'rag_chat' | 'rag_embed_query' | 'rag_index' | 'classify' | 'compare'
 * @param {object} [entry.usage] - { promptTokens, completionTokens, cachedTokens, totalTokens }
 * @param {boolean} [entry.estimated]
 * @returns {Promise<object|null>}
 */
const recordUsage = async (entry = {}) => {
  if (!isLoggingEnabled()) return null;

  try {
    const usage = { ...emptyUsage(), ...(entry.usage || {}) };
    const totalTokens = usage.totalTokens || usage.promptTokens + usage.completionTokens;
    const { costUsd, pricingKnown } = calculateCostUsd({
      model: entry.model,
      promptTokens: usage.promptTokens,
      completionTokens: usage.completionTokens,
      cachedTokens: usage.cachedTokens
    });

    if (!pricingKnown && entry.model) {
      console.warn(`[AI Usage] Chưa có bảng giá cho model "${entry.model}", đang dùng giá dự phòng. Hãy bổ sung AI_PRICING_JSON.`);
    }

    return await AiUsageLog.create({
      user: entry.userId || null,
      feature: entry.feature,
      provider: entry.provider || '',
      model: entry.model || '',
      promptTokens: usage.promptTokens,
      completionTokens: usage.completionTokens,
      cachedTokens: usage.cachedTokens,
      totalTokens,
      estimated: Boolean(entry.estimated),
      estimatedCostUsd: costUsd,
      pricingKnown,
      latencyMs: toInt(entry.latencyMs),
      status: entry.status || 'success',
      errorMessage: String(entry.errorMessage || '').slice(0, 500),
      finishReason: String(entry.finishReason || '').slice(0, 50),
      itemCount: toInt(entry.itemCount) || 1,
      conversation: entry.conversationId || null,
      file: entry.fileId || null,
      meta: entry.meta || {}
    });
  } catch (err) {
    console.warn('[AI Usage] Không thể ghi nhật ký sử dụng AI:', err.message);
    return null;
  }
};

module.exports = {
  isLoggingEnabled,
  emptyUsage,
  normalizeGeminiUsage,
  normalizeOpenAiUsage,
  estimateUsage,
  recordUsage
};
