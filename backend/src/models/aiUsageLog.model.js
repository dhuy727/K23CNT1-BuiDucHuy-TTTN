const mongoose = require('mongoose');

const AI_USAGE_FEATURES = [
  'rag_chat', // Sinh câu trả lời hỏi đáp RAG
  'rag_embed_query', // Embedding câu hỏi người dùng
  'rag_index', // Embedding chunks khi lập chỉ mục
  'classify', // Phân loại tài liệu khi upload
  'compare' // So sánh 2 tài liệu (phát hiện trùng lặp)
];

const USAGE_LOG_RETENTION_DAYS = 180;

/**
 * Nhật ký sử dụng AI: mỗi lần gọi LLM / Embedding API sinh ra một bản ghi.
 * Dùng làm số liệu nền (baseline) để đo và kiểm soát chi phí token.
 */
const aiUsageLogSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true
    },
    feature: {
      type: String,
      enum: AI_USAGE_FEATURES,
      required: true
    },
    provider: {
      type: String,
      default: '',
      trim: true
    },
    model: {
      type: String,
      default: '',
      trim: true
    },
    promptTokens: { type: Number, default: 0 },
    completionTokens: { type: Number, default: 0 }, // Bao gồm thinking tokens (nếu có)
    cachedTokens: { type: Number, default: 0 },
    totalTokens: { type: Number, default: 0 },
    // true nếu số token được ước lượng (API không trả usage), false nếu lấy từ API
    estimated: { type: Boolean, default: false },
    estimatedCostUsd: { type: Number, default: 0 },
    pricingKnown: { type: Boolean, default: true },
    latencyMs: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ['success', 'error', 'aborted'],
      default: 'success'
    },
    errorMessage: { type: String, default: '' },
    finishReason: { type: String, default: '' },
    // Số lượng mục đầu vào (vd: số chunks trong 1 lần embedding batch)
    itemCount: { type: Number, default: 1 },
    conversation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'RagConversation',
      default: null
    },
    file: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'File',
      default: null
    },
    // Thông tin bổ sung (số citations, số tin nhắn lịch sử, độ dài prompt...)
    meta: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    }
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    versionKey: false
  }
);

aiUsageLogSchema.index({ user: 1, createdAt: -1 });
aiUsageLogSchema.index({ feature: 1, createdAt: -1 });
// Tự động xóa nhật ký cũ để không phình CSDL
aiUsageLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: USAGE_LOG_RETENTION_DAYS * 24 * 60 * 60 });

const AiUsageLog = mongoose.model('AiUsageLog', aiUsageLogSchema);

module.exports = AiUsageLog;
module.exports.AI_USAGE_FEATURES = AI_USAGE_FEATURES;
module.exports.USAGE_LOG_RETENTION_DAYS = USAGE_LOG_RETENTION_DAYS;
