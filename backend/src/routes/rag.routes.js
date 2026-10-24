const express = require('express');
const router = express.Router();
const ragController = require('../controllers/rag.controller');
const { verifyAuth } = require('../middlewares/auth.middleware');

const { ragChatLimiter } = require('../middlewares/rateLimiter.middleware');

// Toàn bộ các API RAG đều yêu cầu xác thực người dùng
router.use(verifyAuth);

/**
 * @route   POST /api/rag/chat/stream
 * @desc    Streaming hỏi đáp RAG qua Server-Sent Events (SSE) (Có áp dụng rate limit 15 req/phút)
 * @access  Private
 */
router.post('/chat/stream', ragChatLimiter, ragController.chatStream);

/**
 * @route   GET /api/rag/conversations
 * @desc    Lấy danh sách các cuộc trò chuyện
 * @access  Private
 */
router.get('/conversations', ragController.getConversations);

/**
 * @route   GET /api/rag/conversations/:conversationId/messages
 * @desc    Lấy danh sách tin nhắn của một cuộc trò chuyện
 * @access  Private
 */
router.get('/conversations/:conversationId/messages', ragController.getConversationMessages);

/**
 * @route   DELETE /api/rag/conversations/:conversationId
 * @desc    Xóa một cuộc trò chuyện
 * @access  Private
 */
router.delete('/conversations/:conversationId', ragController.deleteConversation);

/**
 * @route   POST /api/rag/files/:fileId/reindex
 * @desc    Yêu cầu lập chỉ mục lại thủ công cho một tệp tin
 * @access  Private
 */
router.post('/files/:fileId/reindex', ragController.reindexFile);

/**
 * @route   GET /api/rag/files/:fileId/status
 * @desc    Lấy trạng thái lập chỉ mục RAG của tệp tin
 * @access  Private
 */
router.get('/files/:fileId/status', ragController.getFileRagStatus);

module.exports = router;
