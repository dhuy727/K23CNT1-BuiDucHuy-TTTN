/**
 * Bảng giá mô hình AI (USD / 1 triệu tokens) phục vụ ước tính chi phí.
 *
 * LƯU Ý: Đây là giá THAM KHẢO mặc định. Hãy kiểm tra bảng giá hiện hành của nhà cung cấp
 * và ghi đè bằng biến môi trường AI_PRICING_JSON (không cần sửa code), ví dụ:
 *   AI_PRICING_JSON={"gemini-3.5-flash-lite":{"input":0.1,"output":0.4,"cachedInput":0.025}}
 *
 * - input:       giá token đầu vào (prompt)
 * - output:      giá token đầu ra (bao gồm cả thinking tokens nếu có)
 * - cachedInput: giá token đầu vào trúng cache (implicit/explicit caching)
 */

const DEFAULT_PRICING = {
  // Gemini - sinh văn bản
  'gemini-3.5-flash-lite': { input: 0.30, output: 2.50, cachedInput: 0.03 },
  'gemini-flash-lite-latest': { input: 0.10, output: 0.40, cachedInput: 0.025 },
  'gemini-3-flash-preview': { input: 0.50, output: 3.00, cachedInput: 0.05 },
  'gemini-4-hydrogen': { input: 0.50, output: 3.00, cachedInput: 0.05 },

  // Gemini - embedding
  'gemini-embedding-001': { input: 0.15, output: 0, cachedInput: 0.15 },

  // OpenAI
  'gpt-4o-mini': { input: 0.15, output: 0.60, cachedInput: 0.075 },
  'text-embedding-3-small': { input: 0.02, output: 0, cachedInput: 0.02 }
};

// Giá dự phòng cho model chưa khai báo (cố ý không để 0 để tránh báo cáo thấp hơn thực tế)
const FALLBACK_PRICING = { input: 0.50, output: 3.00, cachedInput: 0.05 };

let mergedPricing = null;

const loadPricing = () => {
  if (mergedPricing) return mergedPricing;

  let overrides = {};
  const raw = (process.env.AI_PRICING_JSON || '').trim();
  if (raw) {
    try {
      overrides = JSON.parse(raw);
    } catch (err) {
      console.warn('[AI Pricing] AI_PRICING_JSON không phải JSON hợp lệ, dùng bảng giá mặc định:', err.message);
    }
  }

  mergedPricing = { ...DEFAULT_PRICING };
  for (const [model, price] of Object.entries(overrides || {})) {
    mergedPricing[model] = { ...(DEFAULT_PRICING[model] || FALLBACK_PRICING), ...price };
  }
  return mergedPricing;
};

const normalizeModelName = (model) => String(model || '').trim().replace(/^models\//, '').toLowerCase();

/**
 * Lấy bảng giá của một model. Khớp chính xác trước, sau đó khớp theo tiền tố
 * (vd: "gemini-3.5-flash-lite-001" -> "gemini-3.5-flash-lite").
 * @returns {{ input:number, output:number, cachedInput:number, known:boolean }}
 */
const getModelPricing = (model) => {
  const pricing = loadPricing();
  const name = normalizeModelName(model);

  if (pricing[name]) {
    return { ...pricing[name], known: true };
  }

  const prefixMatch = Object.keys(pricing)
    .filter((key) => name.startsWith(key))
    .sort((a, b) => b.length - a.length)[0];

  if (prefixMatch) {
    return { ...pricing[prefixMatch], known: true };
  }

  return { ...FALLBACK_PRICING, known: false };
};

/**
 * Ước tính chi phí (USD) cho một lần gọi model.
 * Token trúng cache được tính theo giá cachedInput, phần còn lại theo giá input.
 */
const calculateCostUsd = ({ model, promptTokens = 0, completionTokens = 0, cachedTokens = 0 }) => {
  const price = getModelPricing(model);
  const cached = Math.max(0, Math.min(cachedTokens || 0, promptTokens || 0));
  const uncachedPrompt = Math.max(0, (promptTokens || 0) - cached);

  const cost =
    (uncachedPrompt * price.input +
      cached * price.cachedInput +
      (completionTokens || 0) * price.output) /
    1e6;

  return { costUsd: Number(cost.toFixed(8)), pricingKnown: price.known };
};

module.exports = {
  DEFAULT_PRICING,
  FALLBACK_PRICING,
  getModelPricing,
  calculateCostUsd
};
