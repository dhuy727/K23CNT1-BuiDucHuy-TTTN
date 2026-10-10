const RagConversation = require('../models/ragConversation.model');
const RagMessage = require('../models/ragMessage.model');
const File = require('../models/file.model');
const ragService = require('../services/rag.service');
const ragIndexingService = require('../services/rag-indexing.service');
const ApiError = require('../utils/apiError');

/**
 * Endpoint Streaming Chat RAG qua Server-Sent Events (SSE)
 */
const chatStream = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { conversationId, message, scopeType, scopeTargetId } = req.body;

    // Thiết lập HTTP headers cho kết nối Server-Sent Events (SSE)
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Tắt buffering phía Nginx
    if (res.flushHeaders) {
      res.flushHeaders();
    }

    const sendEvent = (event, data) => {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    try {
      const result = await ragService.chatStream({
        userId,
        conversationId,
        message,
        scopeType,
        scopeTargetId,
        onCitations: (citations) => {
          sendEvent('citations', { citations });
        },
        onChunk: (delta) => {
          sendEvent('delta', { delta });
        }
      });

      sendEvent('done', result);
      res.end();
    } catch (streamErr) {
      console.error('[RAG Controller] Lỗi trong quá trình streaming:', streamErr);
      sendEvent('error', { message: streamErr.message || 'Lỗi xử lý phản hồi AI' });
      res.end();
    }
  } catch (error) {
    next(error);
  }
};

/**
 * Lấy danh sách các cuộc trò chuyện RAG của người dùng
 */
const getConversations = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const conversations = await RagConversation.find({ user: userId })
      .sort({ lastMessageAt: -1 })
      .limit(50)
      .lean();

    res.status(200).json({
      success: true,
      data: conversations
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Lấy danh sách tin nhắn của một cuộc trò chuyện
 */
const getConversationMessages = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { conversationId } = req.params;

    const conversation = await RagConversation.findOne({ _id: conversationId, user: userId });
    if (!conversation) {
      throw new ApiError(404, 'Không tìm thấy cuộc trò chuyện');
    }

    const messages = await RagMessage.find({ conversation: conversationId })
      .sort({ createdAt: 1 })
      .lean();

    res.status(200).json({
      success: true,
      data: {
        conversation,
        messages
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Xóa một cuộc trò chuyện
 */
const deleteConversation = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { conversationId } = req.params;

    const conversation = await RagConversation.findOneAndDelete({ _id: conversationId, user: userId });
    if (!conversation) {
      throw new ApiError(404, 'Không tìm thấy cuộc trò chuyện để xóa');
    }

    await RagMessage.deleteMany({ conversation: conversationId });

    res.status(200).json({
      success: true,
      message: 'Đã xóa cuộc trò chuyện thành công'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Yêu cầu lập chỉ mục lại thủ công cho một tệp tin
 */
const reindexFile = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { fileId } = req.params;

    const file = await ragIndexingService.reindexFile(userId, fileId);

    res.status(200).json({
      success: true,
      message: 'Đã đưa tệp tin vào hàng đợi lập chỉ mục RAG',
      data: {
        fileId: file._id,
        ragStatus: file.ragStatus
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Lấy trạng thái lập chỉ mục RAG của một tệp tin
 */
const getFileRagStatus = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { fileId } = req.params;

    const file = await File.findOne({ _id: fileId, user: userId }).select('name ragStatus ragChunkCount ragIndexedAt ragError');
    if (!file) {
      throw new ApiError(404, 'Không tìm thấy tệp tin');
    }

    res.status(200).json({
      success: true,
      data: file
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  chatStream,
  getConversations,
  getConversationMessages,
  deleteConversation,
  reindexFile,
  getFileRagStatus
};
