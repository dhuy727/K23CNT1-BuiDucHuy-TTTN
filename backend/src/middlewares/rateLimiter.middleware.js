const { rateLimit, ipKeyGenerator } = require('express-rate-limit');

/**
 * Middleware giới hạn tần suất gọi API RAG Chat Streaming
 * Quy tắc: Tối đa 15 yêu cầu / 1 phút cho mỗi người dùng đã đăng nhập (hoặc theo IP)
 */
const ragChatLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 phút
  max: 15, // Tối đa 15 requests mỗi phút
  standardHeaders: true, // Trả về headers RateLimit-* chuẩn
  legacyHeaders: false, // Tắt header X-RateLimit-* cũ
  keyGenerator: (req) => {
    // Ưu tiên định danh theo User ID sau khi qua middleware verifyAuth
    if (req.user?._id) {
      return req.user._id.toString();
    }
    return ipKeyGenerator(req);
  },
  handler: (req, res) => {
    const resetTime = req.rateLimit?.resetTime;
    const retryAfter = Math.ceil((resetTime ? resetTime.getTime() - Date.now() : 60000) / 1000);
    res.status(429).json({
      success: false,
      message: `Bạn đã gửi quá nhiều yêu cầu hỏi đáp RAG trong thời gian ngắn. Vui lòng thử lại sau ${retryAfter > 0 ? retryAfter : 60} giây.`,
      retryAfter: retryAfter > 0 ? retryAfter : 60
    });
  }
});

module.exports = {
  ragChatLimiter
};
