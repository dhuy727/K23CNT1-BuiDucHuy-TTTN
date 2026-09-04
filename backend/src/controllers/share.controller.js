const shareService = require('../services/share.service');
const { sendSuccess, sendCreated } = require('../utils/apiResponse');

/**
 * Chia sẻ tài liệu/thư mục cho người dùng khác qua Email
 */
const shareWithUser = async (req, res, next) => {
  try {
    const result = await shareService.shareWithUser(req.user._id, req.body);
    return sendCreated(res, {
      message: result.message,
      data: result.share
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Cập nhật vai trò (role) của cộng tác viên
 */
const updateCollaboratorRole = async (req, res, next) => {
  try {
    const share = await shareService.updateCollaboratorRole(req.user._id, req.params.shareId, req.body.role);
    return sendSuccess(res, {
      message: 'Cập nhật quyền truy cập thành công',
      data: share
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Thu hồi quyền chia sẻ của một cộng tác viên
 */
const removeCollaborator = async (req, res, next) => {
  try {
    const result = await shareService.removeCollaborator(req.user._id, req.params.shareId);
    return sendSuccess(res, {
      message: result.message,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Tạo hoặc cập nhật liên kết chia sẻ công khai (Public Link)
 */
const createOrUpdatePublicLink = async (req, res, next) => {
  try {
    const result = await shareService.createOrUpdatePublicLink(req.user._id, req.body);
    return sendSuccess(res, {
      message: 'Tạo liên kết chia sẻ công khai thành công',
      data: result
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Tắt / hủy liên kết chia sẻ công khai
 */
const revokePublicLink = async (req, res, next) => {
  try {
    const result = await shareService.revokePublicLink(req.user._id, req.params.itemType, req.params.itemId);
    return sendSuccess(res, {
      message: result.message,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Lấy danh sách chia sẻ của một tệp hoặc thư mục
 */
const getItemShares = async (req, res, next) => {
  try {
    const result = await shareService.getItemShares(req.user._id, req.params.itemType, req.params.itemId);
    return sendSuccess(res, {
      message: 'Lấy thông tin chia sẻ thành công',
      data: result
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Truy cập xem tệp hoặc thư mục qua liên kết công khai (Không cần đăng nhập)
 */
const getPublicItem = async (req, res, next) => {
  try {
    const password = req.headers['x-share-password'] || req.query.password || null;
    const result = await shareService.getPublicItem(req.params.shareToken, password);

    if (result.requiresPassword) {
      return res.status(200).json({
        success: true,
        statusCode: 200,
        message: result.message,
        data: {
          requiresPassword: true,
          itemType: result.itemType,
          owner: result.owner
        }
      });
    }

    return sendSuccess(res, {
      message: 'Truy cập liên kết chia sẻ thành công',
      data: result
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Tải tệp tin qua liên kết công khai
 */
const getPublicFileDownload = async (req, res, next) => {
  try {
    const password = req.headers['x-share-password'] || req.query.password || null;
    const { filePath, downloadName } = await shareService.getPublicFileDownload(req.params.shareToken, password);

    return res.download(filePath, downloadName, (err) => {
      if (err && !res.headersSent) {
        next(err);
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Xem trước trực tiếp tệp tin qua liên kết công khai
 */
const getPublicFilePreview = async (req, res, next) => {
  try {
    const password = req.headers['x-share-password'] || req.query.password || null;
    const { filePath, mimeType, file } = await shareService.getPublicFilePreview(req.params.shareToken, password);

    const encodedFilename = encodeURIComponent(file.name);
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${encodedFilename}"; filename*=UTF-8''${encodedFilename}`);

    return res.sendFile(filePath, (err) => {
      if (err && !res.headersSent) {
        next(err);
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Lấy danh sách tài liệu & thư mục được chia sẻ với tôi
 */
const getSharedWithMe = async (req, res, next) => {
  try {
    const { shares, pagination } = await shareService.getSharedWithMe(req.user._id, req.query);
    return sendSuccess(res, {
      message: 'Lấy danh sách được chia sẻ với tôi thành công',
      data: shares,
      metadata: pagination
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Lấy danh sách tài liệu & thư mục do tôi chia sẻ
 */
const getSharedByMe = async (req, res, next) => {
  try {
    const { shares, pagination } = await shareService.getSharedByMe(req.user._id, req.query);
    return sendSuccess(res, {
      message: 'Lấy danh sách do tôi chia sẻ thành công',
      data: shares,
      metadata: pagination
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  shareWithUser,
  updateCollaboratorRole,
  removeCollaborator,
  createOrUpdatePublicLink,
  revokePublicLink,
  getItemShares,
  getPublicItem,
  getPublicFileDownload,
  getPublicFilePreview,
  getSharedWithMe,
  getSharedByMe
};
