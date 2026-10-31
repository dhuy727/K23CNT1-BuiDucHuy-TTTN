const { verifySecretToken } = require('../config/jwt');
const User = require('../models/user.model');
const collabService = require('../services/collab.service');
const { sendSuccess } = require('../utils/apiResponse');

/**
 * Trích xuất thông tin xác thực tùy chọn (hỗ trợ cả người dùng đăng nhập JWT và khách qua link công khai)
 */
const extractAuthContext = async (req) => {
  let user = req.user || null;

  if (!user) {
    let token = null;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    } else if (req.query.accessToken) {
      token = req.query.accessToken;
    }

    if (token) {
      try {
        const decoded = verifySecretToken(token);
        if (decoded && decoded.type === 'access' && decoded.userId) {
          const foundUser = await User.findById(decoded.userId).select('_id name email isActive').lean();
          if (foundUser && foundUser.isActive !== false) {
            user = foundUser;
          }
        }
      } catch (e) {
        // Không bắt buộc lỗi nếu token hết hạn khi đang truy cập bằng shareToken công khai
      }
    }
  }

  const shareToken =
    req.headers['x-share-token'] ||
    req.query.shareToken ||
    req.body?.shareToken ||
    null;

  const sharePassword =
    req.headers['x-share-password'] ||
    req.query.password ||
    req.body?.password ||
    null;

  return {
    user,
    shareToken,
    sharePassword
  };
};

/**
 * GET /api/collab/:fileId/session
 * Lấy trạng thái phiên cộng tác thời gian thực
 */
const getSession = async (req, res, next) => {
  try {
    const authContext = await extractAuthContext(req);
    const sessionData = await collabService.getCollabSession(req.params.fileId, authContext, {
      sessionId: req.query.sessionId || req.headers['x-collab-session'],
      displayName: req.query.displayName
    });

    return sendSuccess(res, {
      message: 'Lấy phiên chỉnh sửa thời gian thực thành công',
      data: sessionData
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/collab/:fileId/stream
 * Luồng Server-Sent Events (SSE) đồng bộ thời gian thực
 */
const streamSession = async (req, res, next) => {
  try {
    const authContext = await extractAuthContext(req);

    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    if (res.flushHeaders) {
      res.flushHeaders();
    }

    const cleanup = await collabService.subscribeCollabStream(
      req.params.fileId,
      authContext,
      {
        sessionId: req.query.sessionId,
        displayName: req.query.displayName
      },
      res
    );

    req.on('close', () => {
      cleanup();
    });
  } catch (error) {
    if (!res.headersSent) {
      next(error);
    } else {
      res.end();
    }
  }
};

/**
 * POST /api/collab/:fileId/sync
 * Đồng bộ nội dung đang gõ theo thời gian thực tới các thành viên khác
 */
const syncContent = async (req, res, next) => {
  try {
    const authContext = await extractAuthContext(req);
    const result = await collabService.syncLiveContent(req.params.fileId, authContext, req.body);

    return sendSuccess(res, {
      message: 'Đã đồng bộ nội dung trực tiếp',
      data: result
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/collab/:fileId/save
 * Lưu nội dung đã chỉnh sửa vào tệp vật lý (.docx / văn bản)
 */
const saveDocument = async (req, res, next) => {
  try {
    const authContext = await extractAuthContext(req);
    const result = await collabService.saveCollabDocument(req.params.fileId, authContext, req.body);

    return sendSuccess(res, {
      message: 'Đã lưu tài liệu thành công',
      data: result
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/collab/:fileId/replace-file
 * Thay thế tệp vật lý bằng phiên bản tệp mới (dành cho PDF, ảnh hoặc tệp bất kỳ có quyền chỉnh sửa)
 */
const replaceFile = async (req, res, next) => {
  try {
    const authContext = await extractAuthContext(req);
    const result = await collabService.replaceCollabBinaryFile(
      req.params.fileId,
      authContext,
      req.file,
      req.body
    );

    return sendSuccess(res, {
      message: 'Đã cập nhật phiên bản tệp tin mới thành công',
      data: result
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getSession,
  streamSession,
  syncContent,
  saveDocument,
  replaceFile
};

