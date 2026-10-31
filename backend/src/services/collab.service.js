const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const File = require('../models/file.model');
const Share = require('../models/share.model');
const ApiError = require('../utils/apiError');
const storageService = require('./storage.service');
const { formatFileSize } = require('./file.service');
const {
  buildDocxBufferFromHtml,
  extractHtmlFromDocxBuffer,
  htmlToPlainText,
  repairLeakedHtmlContent,
  stripLeakedBase64Text
} = require('../utils/docxBuilder');
const {
  extractSpreadsheetFromBuffer,
  buildSpreadsheetBufferFromContent,
  spreadsheetToPlainText
} = require('../utils/xlsxBuilder');

// Bảng màu đại diện cho các cộng tác viên trực tuyến
const COLLAB_COLORS = [
  '#8b5cf6',
  '#10b981',
  '#3b82f6',
  '#f59e0b',
  '#ec4899',
  '#06b6d4',
  '#ef4444',
  '#14b8a6'
];

// Lưu trạng thái phòng soạn thảo thời gian thực theo fileId
const collabRooms = new Map();

const pickColorForSession = (sessionId = '') => {
  let hash = 0;
  for (let i = 0; i < sessionId.length; i++) {
    hash = (hash * 31 + sessionId.charCodeAt(i)) >>> 0;
  }
  return COLLAB_COLORS[hash % COLLAB_COLORS.length];
};

/**
 * Xác định chế độ chỉnh sửa theo thời gian thực.
 * Chỉ hỗ trợ 4 nhóm định dạng văn bản phổ biến:
 * - 'docx': Word (.docx, .doc)
 * - 'txt' : Văn bản thuần (.txt)
 * - 'md'  : Markdown (.md, .markdown)
 * - 'excel': Bảng tính Excel (.xlsx, .xls, .csv)
 * Các định dạng khác trả về null (chỉ xem trước / tải xuống).
 */
const getEditorMode = (file) => {
  const ext = (file?.extension || '')
    .toLowerCase()
    .replace(/^\./, '');
  const nameExt = (file?.name || '')
    .split('.')
    .pop()
    .toLowerCase();
  const effectiveExt = ext || nameExt;
  const mime = (file?.mimeType || '').toLowerCase();

  if (
    effectiveExt === 'docx' ||
    effectiveExt === 'doc' ||
    mime.includes('wordprocessingml') ||
    mime.includes('msword')
  ) {
    return 'docx';
  }

  if (
    effectiveExt === 'xlsx' ||
    effectiveExt === 'xls' ||
    effectiveExt === 'csv' ||
    mime.includes('spreadsheetml') ||
    mime.includes('ms-excel') ||
    mime === 'text/csv'
  ) {
    return 'excel';
  }

  if (
    effectiveExt === 'md' ||
    effectiveExt === 'markdown' ||
    mime === 'text/markdown'
  ) {
    return 'md';
  }

  if (effectiveExt === 'txt' || mime === 'text/plain') {
    return 'txt';
  }

  return null;
};

/**
 * Kiểm tra quyền xem và chỉnh sửa tệp tin (hỗ trợ cả JWT User và Public Share Token)
 */
const resolveCollabAccess = async (fileId, { user = null, shareToken = null, sharePassword = null } = {}) => {
  if (!mongoose.Types.ObjectId.isValid(fileId)) {
    throw new ApiError(400, 'ID tệp tin không hợp lệ');
  }

  const file = await File.findOne({ _id: fileId, isTrash: false })
    .select('+extractedText')
    .populate('user', '_id name email');

  if (!file) {
    throw new ApiError(404, 'Tệp tin không tồn tại hoặc đã bị xóa');
  }

  let canView = false;
  let canEdit = false;
  let accessRole = 'viewer';

  const ownerIdStr = (file.user?._id || file.user).toString();

  // 1. Kiểm tra theo tài khoản đăng nhập (Owner hoặc Collaborator qua email)
  if (user && user._id) {
    const userIdStr = user._id.toString();
    if (userIdStr === ownerIdStr) {
      canView = true;
      canEdit = true;
      accessRole = 'owner';
    } else {
      const shareFilter = {
        shareType: 'user',
        sharedWith: user._id,
        $or: [
          { itemType: 'file', file: file._id },
          ...(file.folder ? [{ itemType: 'folder', folder: file.folder }] : [])
        ]
      };
      const userShare = await Share.findOne(shareFilter).lean();
      if (userShare) {
        canView = true;
        if (userShare.role === 'editor') {
          canEdit = true;
          accessRole = 'editor';
        }
      }
    }
  }

  // 2. Kiểm tra theo liên kết chia sẻ công khai (shareToken)
  if (shareToken) {
    const publicShare = await Share.findOne({
      shareToken,
      shareType: 'public',
      isPublic: true
    }).lean();

    if (!publicShare) {
      if (!canView) {
        throw new ApiError(404, 'Liên kết chia sẻ không tồn tại hoặc đã bị thu hồi');
      }
    } else {
      if (publicShare.expiresAt && new Date() > new Date(publicShare.expiresAt)) {
        if (!canView) {
          throw new ApiError(410, 'Liên kết chia sẻ này đã hết hạn truy cập');
        }
      } else {
        if (publicShare.hasPassword) {
          if (!sharePassword) {
            if (!canView) {
              throw new ApiError(401, 'Liên kết này yêu cầu mật khẩu truy cập');
            }
          } else {
            const matched = await bcrypt.compare(sharePassword, publicShare.password);
            if (!matched && !canView) {
              throw new ApiError(401, 'Mật khẩu truy cập liên kết không chính xác');
            }
          }
        }

        const isDirectFileMatch =
          publicShare.itemType === 'file' &&
          publicShare.file &&
          publicShare.file.toString() === file._id.toString();

        const isFolderOwnerMatch =
          publicShare.itemType === 'folder' &&
          publicShare.owner &&
          publicShare.owner.toString() === ownerIdStr;

        if (isDirectFileMatch || isFolderOwnerMatch) {
          canView = true;
          if (publicShare.role === 'editor') {
            canEdit = true;
            if (accessRole !== 'owner') {
              accessRole = 'editor';
            }
          }
        }
      }
    }
  }

  if (!canView) {
    throw new ApiError(403, 'Bạn không có quyền truy cập tệp tin này');
  }

  return {
    file,
    canView,
    canEdit,
    accessRole
  };
};

/**
 * Khởi tạo hoặc lấy phòng cộng tác trong bộ nhớ cho một fileId
 */
const getOrInitRoom = async (file) => {
  const mode = getEditorMode(file);
  if (!mode) {
    throw new ApiError(
      400,
      'Định dạng tệp này không hỗ trợ chỉnh sửa trực tiếp. Chỉ hỗ trợ: Word (.docx), Văn bản (.txt), Markdown (.md) và Excel (.xlsx, .xls, .csv).'
    );
  }

  const key = file._id.toString();
  let room = collabRooms.get(key);
  if (room && room.mode === mode) {
    if (room.mode === 'docx' && room.content) {
      room.content = repairLeakedHtmlContent(room.content);
      room.plainText = htmlToPlainText(room.content);
    }
    return room;
  }

  let initialContent = '';
  let initialPlainText = stripLeakedBase64Text(file.extractedText || '');

  let buffer = null;
  try {
    buffer = await storageService.getFileBuffer(file);
  } catch (e) {
    buffer = null;
  }

  if (mode === 'docx') {
    const extracted = await extractHtmlFromDocxBuffer(buffer, initialPlainText);
    initialContent = extracted.html;
    initialPlainText = extracted.plainText;
  } else if (mode === 'excel') {
    const ext = (file.extension || '').toLowerCase().replace(/^\./, '') || 'xlsx';
    const extracted = extractSpreadsheetFromBuffer(buffer, ext, initialPlainText);
    initialContent = extracted.content;
    initialPlainText = extracted.plainText;
  } else if (mode === 'txt' || mode === 'md') {
    if (buffer && buffer.length > 0) {
      initialContent = buffer.toString('utf8');
      initialPlainText = initialContent;
    } else {
      initialContent = initialPlainText;
    }
  }

  room = {
    fileId: key,
    mode,
    content: initialContent,
    plainText: initialPlainText,
    revision: 1,
    dirty: false,
    lastSavedAt: file.updatedAt ? new Date(file.updatedAt).toISOString() : new Date().toISOString(),
    lastUpdatedBy: null,
    participants: new Map(),
    clients: new Set()
  };

  collabRooms.set(key, room);
  return room;
};

/**
 * Gửi sự kiện SSE tới tất cả các kết nối trong phòng
 */
const broadcastToRoom = (room, eventName, payload) => {
  const dataString = `event: ${eventName}\ndata: ${JSON.stringify(payload)}\n\n`;
  for (const client of room.clients) {
    try {
      client.res.write(dataString);
    } catch (err) {
      room.clients.delete(client);
    }
  }
};

const serializeParticipants = (room) => {
  const now = Date.now();
  const list = [];
  for (const [sid, p] of room.participants.entries()) {
    const hasActiveStream = Array.from(room.clients).some((c) => c.sessionId === sid);
    if (!hasActiveStream && now - p.lastSeenAt > 120000) {
      room.participants.delete(sid);
      continue;
    }
    list.push({
      sessionId: p.sessionId,
      displayName: p.displayName,
      email: p.email || '',
      color: p.color,
      role: p.role,
      isAnonymous: p.isAnonymous,
      isTyping: Boolean(p.isTyping && now - p.lastTypingAt < 4000)
    });
  }
  return list;
};

const registerOrUpdateParticipant = (room, { sessionId, displayName, email, role, isAnonymous, isTyping = false }) => {
  if (!sessionId) return null;
  const existing = room.participants.get(sessionId);
  const participant = {
    sessionId,
    displayName: (displayName || existing?.displayName || 'Khách').trim().slice(0, 50),
    email: email || existing?.email || '',
    color: existing?.color || pickColorForSession(sessionId),
    role: role || existing?.role || 'viewer',
    isAnonymous: isAnonymous !== undefined ? isAnonymous : Boolean(existing?.isAnonymous),
    isTyping: Boolean(isTyping),
    lastTypingAt: isTyping ? Date.now() : existing?.lastTypingAt || 0,
    lastSeenAt: Date.now()
  };
  room.participants.set(sessionId, participant);
  return participant;
};

/**
 * 1. Lấy thông tin phiên soạn thảo thời gian thực của tệp
 */
const getCollabSession = async (fileId, authContext, participantMeta = {}) => {
  const { file, canEdit, accessRole } = await resolveCollabAccess(fileId, authContext);
  const room = await getOrInitRoom(file);

  if (participantMeta.sessionId) {
    registerOrUpdateParticipant(room, {
      sessionId: participantMeta.sessionId,
      displayName:
        participantMeta.displayName ||
        authContext.user?.name ||
        authContext.user?.email ||
        'Khách',
      email: authContext.user?.email || '',
      role: accessRole,
      isAnonymous: !authContext.user
    });
    broadcastToRoom(room, 'presence_updated', {
      participants: serializeParticipants(room)
    });
  }

  return {
    fileId: file._id,
    fileName: file.name,
    mimeType: file.mimeType,
    extension: file.extension,
    size: file.size,
    formattedSize: formatFileSize(file.size),
    mode: room.mode,
    canEdit,
    accessRole,
    content: room.content,
    plainText: room.plainText,
    revision: room.revision,
    dirty: room.dirty,
    lastSavedAt: room.lastSavedAt,
    lastUpdatedBy: room.lastUpdatedBy,
    participants: serializeParticipants(room)
  };
};

/**
 * 2. Đăng ký kết nối SSE để nhận cập nhật thời gian thực
 */
const subscribeCollabStream = async (fileId, authContext, participantMeta, res) => {
  const { file, accessRole } = await resolveCollabAccess(fileId, authContext);
  const room = await getOrInitRoom(file);

  const sessionId = participantMeta.sessionId || `sess_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const participant = registerOrUpdateParticipant(room, {
    sessionId,
    displayName:
      participantMeta.displayName ||
      authContext.user?.name ||
      authContext.user?.email ||
      'Khách',
    email: authContext.user?.email || '',
    role: accessRole,
    isAnonymous: !authContext.user
  });

  const clientEntry = { sessionId, res };
  room.clients.add(clientEntry);

  res.write(
    `event: connected\ndata: ${JSON.stringify({
      sessionId,
      revision: room.revision,
      content: room.content,
      lastSavedAt: room.lastSavedAt,
      participants: serializeParticipants(room)
    })}\n\n`
  );

  broadcastToRoom(room, 'presence_updated', {
    participants: serializeParticipants(room)
  });

  const heartbeat = setInterval(() => {
    try {
      res.write(': heartbeat\n\n');
    } catch (e) {
      clearInterval(heartbeat);
    }
  }, 20000);

  return () => {
    clearInterval(heartbeat);
    room.clients.delete(clientEntry);
    const hasOtherConn = Array.from(room.clients).some((c) => c.sessionId === sessionId);
    if (!hasOtherConn) {
      room.participants.delete(sessionId);
    }
    broadcastToRoom(room, 'presence_updated', {
      participants: serializeParticipants(room),
      leftParticipant: participant
    });
  };
};

/**
 * 3. Đồng bộ nội dung đang gõ theo thời gian thực (Live Sync)
 */
const syncLiveContent = async (fileId, authContext, body = {}) => {
  const { file, canEdit, accessRole } = await resolveCollabAccess(fileId, authContext);
  if (!canEdit) {
    throw new ApiError(403, 'Bạn chỉ có quyền Xem, không thể chỉnh sửa tài liệu này');
  }

  const room = await getOrInitRoom(file);
  const sessionId = body.sessionId || 'anonymous';
  const participant = registerOrUpdateParticipant(room, {
    sessionId,
    displayName:
      body.displayName ||
      authContext.user?.name ||
      authContext.user?.email ||
      'Khách',
    email: authContext.user?.email || '',
    role: accessRole,
    isAnonymous: !authContext.user,
    isTyping: Boolean(body.isTyping !== false)
  });

  if (typeof body.content === 'string') {
    const normalizedContent =
      room.mode === 'docx' ? repairLeakedHtmlContent(body.content) : body.content;

    if (normalizedContent !== room.content) {
      room.content = normalizedContent;
      if (room.mode === 'docx') {
        room.plainText = htmlToPlainText(normalizedContent);
      } else if (room.mode === 'excel') {
        room.plainText = spreadsheetToPlainText(normalizedContent);
      } else {
        room.plainText = normalizedContent;
      }
      room.revision += 1;
      room.dirty = true;
      room.lastUpdatedBy = {
        sessionId,
        displayName: participant.displayName,
        color: participant.color,
        updatedAt: new Date().toISOString()
      };

      broadcastToRoom(room, 'content_updated', {
        content: room.content,
        revision: room.revision,
        senderSessionId: sessionId,
        updatedBy: room.lastUpdatedBy,
        participants: serializeParticipants(room)
      });
    } else {
      broadcastToRoom(room, 'presence_updated', {
        participants: serializeParticipants(room)
      });
    }
  } else {
    broadcastToRoom(room, 'presence_updated', {
      participants: serializeParticipants(room)
    });
  }

  return {
    revision: room.revision,
    dirty: room.dirty,
    lastUpdatedBy: room.lastUpdatedBy,
    participants: serializeParticipants(room)
  };
};

/**
 * 4. Lưu nội dung đang soạn thảo xuống tệp vật lý (.docx, .xlsx/.csv, .txt, .md)
 */
const saveCollabDocument = async (fileId, authContext, body = {}) => {
  const { file, canEdit, accessRole } = await resolveCollabAccess(fileId, authContext);
  if (!canEdit) {
    throw new ApiError(403, 'Bạn không có quyền lưu chỉnh sửa trên tài liệu này');
  }

  const room = await getOrInitRoom(file);
  const sessionId = body.sessionId || 'anonymous';
  const participant = registerOrUpdateParticipant(room, {
    sessionId,
    displayName:
      body.displayName ||
      authContext.user?.name ||
      authContext.user?.email ||
      'Khách',
    email: authContext.user?.email || '',
    role: accessRole,
    isAnonymous: !authContext.user,
    isTyping: false
  });

  if (typeof body.content === 'string') {
    const normalizedContent =
      room.mode === 'docx' ? repairLeakedHtmlContent(body.content) : body.content;
    room.content = normalizedContent;
    if (room.mode === 'docx') {
      room.plainText = htmlToPlainText(normalizedContent);
    } else if (room.mode === 'excel') {
      room.plainText = spreadsheetToPlainText(normalizedContent);
    } else {
      room.plainText = normalizedContent;
    }
    room.revision += 1;
  }

  let bufferToSave;
  let targetMime = file.mimeType;
  const ext = (file.extension || '').toLowerCase().replace(/^\./, '');

  if (room.mode === 'docx') {
    bufferToSave = buildDocxBufferFromHtml(room.content);
    targetMime = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  } else if (room.mode === 'excel') {
    bufferToSave = buildSpreadsheetBufferFromContent(room.content, ext || 'xlsx');
    targetMime =
      ext === 'csv'
        ? 'text/csv; charset=utf-8'
        : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  } else if (room.mode === 'md') {
    bufferToSave = Buffer.from(String(room.content || ''), 'utf8');
    targetMime = 'text/markdown; charset=utf-8';
  } else if (room.mode === 'txt') {
    bufferToSave = Buffer.from(String(room.content || ''), 'utf8');
    targetMime = 'text/plain; charset=utf-8';
  } else {
    throw new ApiError(400, 'Định dạng tệp này không hỗ trợ lưu trực tiếp.');
  }

  const savedStorage = await storageService.saveBufferToFile(file, bufferToSave, targetMime);

  file.size = savedStorage.size;
  file.storageType = savedStorage.storageType;
  file.storageKey = savedStorage.storageKey;
  file.storagePath = savedStorage.storagePath;
  file.contentHash = savedStorage.contentHash;
  file.extractedText = (room.plainText || '').slice(0, 15000);
  await file.save();

  room.dirty = false;
  room.lastSavedAt = new Date().toISOString();
  room.lastUpdatedBy = {
    sessionId,
    displayName: participant.displayName,
    color: participant.color,
    updatedAt: room.lastSavedAt
  };

  const savedEventPayload = {
    revision: room.revision,
    content: room.content,
    senderSessionId: sessionId,
    lastSavedAt: room.lastSavedAt,
    savedBy: room.lastUpdatedBy,
    size: file.size,
    formattedSize: formatFileSize(file.size),
    participants: serializeParticipants(room)
  };

  broadcastToRoom(room, 'document_saved', savedEventPayload);

  return savedEventPayload;
};

module.exports = {
  getEditorMode,
  resolveCollabAccess,
  getCollabSession,
  subscribeCollabStream,
  syncLiveContent,
  saveCollabDocument
};
