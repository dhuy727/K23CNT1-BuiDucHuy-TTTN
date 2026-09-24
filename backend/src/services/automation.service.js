const mongoose = require('mongoose');
const AutomationRule = require('../models/automation.model');
const Folder = require('../models/folder.model');
const File = require('../models/file.model');
const notificationService = require('./notification.service');
const ApiError = require('../utils/apiError');

const MAX_RECURSION_DEPTH = 3;

/**
 * Kiểm tra xem một giá trị snapshot có thỏa mãn điều kiện hay không
 */
const evaluateCondition = (file, condition) => {
  const { field, operator, value } = condition;
  let fileValue = file[field];

  if (field === 'extension') {
    const ext = file.extension || (file.name && file.name.includes('.') ? file.name.split('.').pop() : '');
    fileValue = String(ext || '').toLowerCase().replace(/^\./, '').trim();
    const target = String(value || '').toLowerCase().replace(/^\./, '').trim();
    if (operator === 'equals') return fileValue === target;
    if (operator === 'not_equals') return fileValue !== target;
    return false;
  }

  if (field === 'size') {
    const numFile = Number(fileValue) || 0;
    const numTarget = Number(value) || 0;
    if (operator === 'equals') return numFile === numTarget;
    if (operator === 'not_equals') return numFile !== numTarget;
    if (operator === 'gt') return numFile > numTarget;
    if (operator === 'gte') return numFile >= numTarget;
    if (operator === 'lt') return numFile < numTarget;
    if (operator === 'lte') return numFile <= numTarget;
    return false;
  }

  if (field === 'aiTags') {
    const tags = Array.isArray(fileValue) ? fileValue : [];
    const target = String(value || '').toLowerCase().trim();
    const hasTag = tags.some((t) => String(t).toLowerCase().trim() === target);
    if (operator === 'contains' || operator === 'equals') return hasTag;
    if (operator === 'not_equals') return !hasTag;
    return false;
  }

  if (field === 'folder') {
    const folderId = file.folder ? String(file.folder._id || file.folder) : null;
    const target = value ? String(value) : null;
    if (operator === 'equals') return folderId === target;
    if (operator === 'not_equals') return folderId !== target;
    return false;
  }

  // Các trường dạng chuỗi: name, mimeType, aiCategory, aiStatus
  const strFile = String(fileValue || '').toLowerCase().trim();
  const strTarget = String(value || '').toLowerCase().trim();

  switch (operator) {
    case 'equals':
      return strFile === strTarget;
    case 'not_equals':
      return strFile !== strTarget;
    case 'contains':
      return strFile.includes(strTarget);
    case 'gt':
      return strFile > strTarget;
    case 'gte':
      return strFile >= strTarget;
    case 'lt':
      return strFile < strTarget;
    case 'lte':
      return strFile <= strTarget;
    default:
      return false;
  }
};

/**
 * Đánh giá tất cả điều kiện của Rule (phép toán AND)
 */
const evaluateRule = (file, rule) => {
  if (!rule.conditions || rule.conditions.length === 0) {
    return true; // Không có điều kiện đồng nghĩa với luôn thỏa mãn
  }
  return rule.conditions.every((cond) => evaluateCondition(file, cond));
};

/**
 * Động cơ thực thi Automation
 * @param {string|ObjectId} userId
 * @param {string} triggerType
 * @param {Object} fileSnapshot
 * @param {Object} options
 */
const run = async (userId, triggerType, fileSnapshot, options = { depth: 0, isAutomated: false }) => {
  if (!userId || !triggerType || !fileSnapshot) return;

  const currentDepth = options.depth || 0;
  if (currentDepth >= MAX_RECURSION_DEPTH) {
    console.warn(`[Automation] Đạt giới hạn đệ quy tối đa (depth=${currentDepth}). Dừng cascade.`);
    return;
  }

  try {
    const rules = await AutomationRule.find({
      user: userId,
      isActive: true,
      'trigger.type': triggerType
    })
      .sort({ priority: -1, createdAt: 1 })
      .lean();

    if (!rules || rules.length === 0) {
      return;
    }

    // Nạp lại dữ liệu mới nhất của file từ DB
    const fileId = fileSnapshot._id || fileSnapshot.id;
    let currentFile = await File.findById(fileId);
    if (!currentFile || currentFile.isTrash) {
      return;
    }

    const fileService = require('./file.service');
    const versionService = require('./version.service');

    for (const rule of rules) {
      // Đánh giá rule trên snapshot tệp tin hiện tại
      if (!evaluateRule(currentFile.toObject(), rule)) {
        continue;
      }

      let hasExecutedAction = false;

      for (const action of rule.actions) {
        try {
          if (action.type === 'MOVE_FILE') {
            const targetFolderId = action.targetFolderId || action.value || null;
            let folderName = 'thư mục gốc';
            if (targetFolderId) {
              try {
                const Folder = require('../models/folder.model');
                const targetFolder = await Folder.findById(targetFolderId).select('name');
                if (targetFolder) folderName = `thư mục "${targetFolder.name}"`;
              } catch (fErr) {
                // bỏ qua lỗi đọc tên thư mục
              }
            }

            const updated = await fileService.moveFile(userId, currentFile._id, targetFolderId);
            currentFile = await File.findById(currentFile._id);
            hasExecutedAction = true;

            await notificationService.createNotification({
              user: userId,
              file: currentFile._id,
              title: 'Tệp đã chuyển vào thư mục',
              message: `Tệp "${currentFile.name}" đã được tự động chuyển vào ${folderName} theo quy tắc "${rule.name}".`,
              type: 'automation'
            });

            if (currentDepth + 1 < MAX_RECURSION_DEPTH) {
              await run(userId, 'FILE_MOVED', currentFile, {
                depth: currentDepth + 1,
                isAutomated: true
              });
            }
          } else if (action.type === 'RENAME_FILE') {
            let targetName = action.newName || action.value || '';
            if (targetName === '{{aiSuggestedName}}') {
              targetName = currentFile.aiSuggestedName || '';
            }

            if (targetName && targetName.trim() && targetName !== currentFile.name) {
              await fileService.renameFile(userId, currentFile._id, targetName.trim());
              currentFile = await File.findById(currentFile._id);
              hasExecutedAction = true;

              if (currentDepth + 1 < MAX_RECURSION_DEPTH) {
                await run(userId, 'FILE_UPDATED', currentFile, {
                  depth: currentDepth + 1,
                  isAutomated: true
                });
              }
            }
          } else if (action.type === 'ADD_TAG') {
            const tag = String(action.value || '').trim();
            if (tag) {
              const existingTags = currentFile.aiTags || [];
              if (!existingTags.some((t) => t.toLowerCase() === tag.toLowerCase())) {
                currentFile.aiTags = [...existingTags, tag];
                await currentFile.save();
                hasExecutedAction = true;
              }
            }
          } else if (action.type === 'STAR_FILE') {
            if (!currentFile.isStarred) {
              currentFile.isStarred = true;
              await currentFile.save();
              hasExecutedAction = true;
            }
          } else if (action.type === 'NOTIFY') {
            const msg = action.value || `Đã áp dụng quy tắc tự động hóa "${rule.name}" cho tệp tin ${currentFile.name}`;
            await notificationService.createNotification({
              user: userId,
              file: currentFile._id,
              title: `Tự động hóa: ${rule.name}`,
              message: msg,
              type: 'automation'
            });
            hasExecutedAction = true;
          } else if (action.type === 'CREATE_VERSION') {
            await versionService.createVersion(userId, currentFile._id, {
              changeType: 'upload',
              changeSummary: `Tự động tạo phiên bản từ quy tắc: ${rule.name}`
            });
            hasExecutedAction = true;

            if (currentDepth + 1 < MAX_RECURSION_DEPTH) {
              await run(userId, 'FILE_UPDATED', currentFile, {
                depth: currentDepth + 1,
                isAutomated: true
              });
            }
          }
        } catch (actionError) {
          console.error(`[Automation] Lỗi khi thực thi action ${action.type} (Rule: ${rule.name}):`, actionError.message);
          await notificationService.createNotification({
            user: userId,
            file: currentFile._id,
            title: `Lỗi quy tắc: ${rule.name}`,
            message: `Hành động ${action.type} không thể hoàn tất: ${actionError.message}`,
            type: 'warning'
          });
        }
      }

      if (hasExecutedAction) {
        await AutomationRule.findByIdAndUpdate(rule._id, {
          $set: { lastRunAt: new Date() },
          $inc: { runCount: 1 }
        });
      }
    }
  } catch (error) {
    console.error('[Automation] Lỗi trong tiến trình run engine:', error.message);
  }
};

/**
 * Kiểm tra folder đích có hợp lệ và thuộc về người dùng hay không
 */
const validateTargetFolder = async (userId, folderId) => {
  if (!folderId) return; // Root folder (null) hợp lệ
  if (!mongoose.Types.ObjectId.isValid(folderId)) {
    throw new ApiError(400, 'ID thư mục đích không hợp lệ');
  }
  const folder = await Folder.findOne({ _id: folderId, user: userId, isTrash: false });
  if (!folder) {
    throw new ApiError(404, 'Thư mục đích không tồn tại hoặc bạn không có quyền');
  }
};

/**
 * Lấy danh sách rules của người dùng
 */
const getRules = async (userId) => {
  const rules = await AutomationRule.find({ user: userId })
    .populate('actions.targetFolderId', '_id name path')
    .sort({ priority: -1, createdAt: -1 })
    .lean();

  return rules;
};

/**
 * Lấy chi tiết rule
 */
const getRuleById = async (userId, ruleId) => {
  if (!mongoose.Types.ObjectId.isValid(ruleId)) {
    throw new ApiError(400, 'ID quy tắc không hợp lệ');
  }
  const rule = await AutomationRule.findOne({ _id: ruleId, user: userId })
    .populate('actions.targetFolderId', '_id name path')
    .lean();

  if (!rule) {
    throw new ApiError(404, 'Không tìm thấy quy tắc tự động hóa');
  }
  return rule;
};

/**
 * Chuẩn hóa các action trước khi lưu / validate (xử lý object targetFolderId từ populated data)
 */
const sanitizeActions = (actions) => {
  if (!Array.isArray(actions)) return [];
  return actions.map((act) => {
    const item = { ...act };
    if (item.targetFolderId && typeof item.targetFolderId === 'object') {
      item.targetFolderId = item.targetFolderId._id || null;
    }
    if (!item.targetFolderId || !String(item.targetFolderId).trim()) {
      item.targetFolderId = null;
    }
    return item;
  });
};

/**
 * Tạo mới một rule
 */
const createRule = async (userId, data) => {
  if (!data.name || !String(data.name).trim()) {
    throw new ApiError(400, 'Tên quy tắc không được để trống');
  }
  if (!data.trigger || !data.trigger.type) {
    throw new ApiError(400, 'Vui lòng chọn loại sự kiện kích hoạt (trigger)');
  }
  if (!Array.isArray(data.actions) || data.actions.length === 0) {
    throw new ApiError(400, 'Quy tắc phải có ít nhất một hành động');
  }

  const sanitizedActions = sanitizeActions(data.actions);

  // Validate các action MOVE_FILE
  for (const act of sanitizedActions) {
    if (act.type === 'MOVE_FILE' && act.targetFolderId) {
      await validateTargetFolder(userId, act.targetFolderId);
    }
  }

  const rule = new AutomationRule({
    user: userId,
    name: String(data.name).trim(),
    isActive: data.isActive !== false,
    trigger: { type: data.trigger.type },
    conditions: data.conditions || [],
    actions: sanitizedActions,
    priority: Number(data.priority) || 0
  });

  await rule.save();
  return rule.populate('actions.targetFolderId', '_id name path');
};

/**
 * Cập nhật rule
 */
const updateRule = async (userId, ruleId, data) => {
  if (!mongoose.Types.ObjectId.isValid(ruleId)) {
    throw new ApiError(400, 'ID quy tắc không hợp lệ');
  }

  const rule = await AutomationRule.findOne({ _id: ruleId, user: userId });
  if (!rule) {
    throw new ApiError(404, 'Không tìm thấy quy tắc');
  }

  if (data.actions && Array.isArray(data.actions)) {
    const sanitizedActions = sanitizeActions(data.actions);
    for (const act of sanitizedActions) {
      if (act.type === 'MOVE_FILE' && act.targetFolderId) {
        await validateTargetFolder(userId, act.targetFolderId);
      }
    }
    rule.actions = sanitizedActions;
    rule.markModified('actions');
  }

  if (data.name !== undefined) rule.name = String(data.name).trim();
  if (data.trigger !== undefined) {
    rule.trigger = { type: data.trigger.type };
    rule.markModified('trigger');
  }
  if (data.conditions !== undefined) {
    rule.conditions = data.conditions;
    rule.markModified('conditions');
  }
  if (data.priority !== undefined) rule.priority = Number(data.priority) || 0;
  if (data.isActive !== undefined) rule.isActive = Boolean(data.isActive);

  await rule.save();
  return rule.populate('actions.targetFolderId', '_id name path');
};

/**
 * Xóa rule
 */
const deleteRule = async (userId, ruleId) => {
  if (!mongoose.Types.ObjectId.isValid(ruleId)) {
    throw new ApiError(400, 'ID quy tắc không hợp lệ');
  }

  const rule = await AutomationRule.findOneAndDelete({ _id: ruleId, user: userId });
  if (!rule) {
    throw new ApiError(404, 'Không tìm thấy quy tắc');
  }

  return { message: 'Đã xóa quy tắc tự động hóa thành công' };
};

/**
 * Bật / tắt kích hoạt rule
 */
const toggleRuleActive = async (userId, ruleId) => {
  if (!mongoose.Types.ObjectId.isValid(ruleId)) {
    throw new ApiError(400, 'ID quy tắc không hợp lệ');
  }

  const rule = await AutomationRule.findOne({ _id: ruleId, user: userId });
  if (!rule) {
    throw new ApiError(404, 'Không tìm thấy quy tắc');
  }

  rule.isActive = !rule.isActive;
  await rule.save();

  return rule;
};

/**
 * Áp dụng tất cả các quy tắc đang hoạt động lên các tệp tin hiện có của người dùng
 */
const applyRulesToAllFiles = async (userId) => {
  const rules = await AutomationRule.find({
    user: userId,
    isActive: true
  }).sort({ priority: -1 });

  if (rules.length === 0) {
    return { message: 'Không có quy tắc nào đang được bật', executedCount: 0 };
  }

  const files = await File.find({
    user: userId,
    isTrash: false
  });

  let totalApplied = 0;
  for (const file of files) {
    if (file.aiStatus === 'completed') {
      await run(userId, 'AI_COMPLETED', file);
      totalApplied++;
    }
    await run(userId, 'FILE_UPLOADED', file);
  }

  return {
    message: `Đã quét và áp dụng quy tắc cho ${files.length} tệp tin`,
    fileCount: files.length,
    activeRulesCount: rules.length
  };
};

module.exports = {
  run,
  getRules,
  getRuleById,
  createRule,
  updateRule,
  deleteRule,
  toggleRuleActive,
  applyRulesToAllFiles
};
