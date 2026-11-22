/**
 * Bộ kiểm tra xung đột giữa các quy tắc tự động hóa (Automation Rule Conflict Detector)
 * 
 * Kiểm tra các trường hợp:
 * 1. Xung đột di chuyển (Conflicting Move Targets): Cùng sự kiện + điều kiện bao hàm nhau nhưng chuyển tệp vào các thư mục khác nhau.
 * 2. Xung đột đổi tên (Conflicting Rename Targets): Cùng sự kiện + điều kiện bao hàm nhau nhưng đổi tên với mẫu khác nhau.
 * 3. Trùng lặp quy tắc (Exact Duplicate Rule): Giống hệt sự kiện, điều kiện và hành động.
 * 4. Nguy cơ vòng lặp luẩn quẩn (Ping-Pong / Loop): Di chuyển tệp qua lại giữa các thư mục tạo chu trình vô hạn.
 */

const normalizeValue = (val) => String(val || '').toLowerCase().trim();

/**
 * Kiểm tra xem 2 tập điều kiện có khả năng cùng thỏa mãn trên một tệp tin hay không
 */
export const areConditionsCompatible = (condsA = [], condsB = []) => {
  // Nếu một trong 2 quy tắc không có điều kiện nào, nó áp dụng cho TẤT CẢ tệp -> luôn có khả năng chồng lấn
  if (!condsA || condsA.length === 0 || !condsB || condsB.length === 0) {
    return true;
  }

  // Nhóm điều kiện theo trường (field)
  const mapA = {};
  for (const c of condsA) {
    if (!mapA[c.field]) mapA[c.field] = [];
    mapA[c.field].push(c);
  }

  const mapB = {};
  for (const c of condsB) {
    if (!mapB[c.field]) mapB[c.field] = [];
    mapB[c.field].push(c);
  }

  // Các trường dạng giá trị đơn lẻ loại trừ nhau khi cùng dùng toán tử 'equals'
  const singleValueFields = ['extension', 'aiCategory', 'mimeType'];

  for (const field of singleValueFields) {
    const listA = mapA[field] || [];
    const listB = mapB[field] || [];

    const eqA = listA.find((c) => c.operator === 'equals');
    const eqB = listB.find((c) => c.operator === 'equals');

    if (eqA && eqB) {
      const valA = normalizeValue(eqA.value).replace(/^\./, '');
      const valB = normalizeValue(eqB.value).replace(/^\./, '');
      // Nếu cả 2 đều bắt buộc 'equals' nhưng giá trị khác nhau -> Không thể có tệp nào thỏa mãn cả 2
      if (valA !== valB) {
        return false;
      }
    }
  }

  return true;
};

/**
 * Lấy tên thư mục hiển thị từ targetFolderId
 */
const getFolderName = (targetFolderId, folderList = []) => {
  if (!targetFolderId) return 'Thư mục gốc (Drive của tôi)';
  const idStr = String(targetFolderId?._id || targetFolderId);
  const found = folderList.find((f) => String(f._id) === idStr);
  return found ? found.name : 'Thư mục đã chọn';
};

/**
 * Hàm chính phát hiện xung đột
 * @param {Object} candidateRule - Quy tắc đang được soạn thảo
 * @param {Array} existingRules - Danh sách tất cả quy tắc hiện có
 * @param {string|null} editingRuleId - ID của quy tắc đang sửa (để bỏ qua chính nó)
 * @param {Array} folderList - Danh sách phẳng thư mục để ánh xạ tên
 * @returns {Array} Danh sách các xung đột phát hiện được
 */
export const detectRuleConflicts = (
  candidateRule,
  existingRules = [],
  editingRuleId = null,
  folderList = []
) => {
  if (!candidateRule || !candidateRule.trigger || !candidateRule.trigger.type) {
    return [];
  }

  const conflicts = [];
  const activeExistingRules = (existingRules || []).filter(
    (r) => r._id !== editingRuleId && r.isActive !== false
  );

  const candTrigger = candidateRule.trigger.type;
  const candConditions = candidateRule.conditions || [];
  const candActions = candidateRule.actions || [];

  const candMoveAction = candActions.find((a) => a.type === 'MOVE_FILE');
  const candRenameAction = candActions.find((a) => a.type === 'RENAME_FILE');

  for (const rule of activeExistingRules) {
    const ruleTrigger = rule.trigger?.type;
    const ruleConditions = rule.conditions || [];
    const ruleActions = rule.actions || [];

    const isSameTrigger = candTrigger === ruleTrigger;
    const conditionsOverlap = areConditionsCompatible(candConditions, ruleConditions);

    // 1. Kiểm tra Trùng lặp hoàn toàn (Exact Duplicate)
    if (isSameTrigger && conditionsOverlap) {
      const condCountMatch = candConditions.length === ruleConditions.length;
      const actionsCountMatch = candActions.length === ruleActions.length;

      if (condCountMatch && actionsCountMatch) {
        const isDuplicate =
          JSON.stringify(candConditions) === JSON.stringify(ruleConditions) &&
          candActions.every((ca) =>
            ruleActions.some(
              (ra) =>
                ra.type === ca.type &&
                normalizeValue(ra.value || ra.targetFolderId) ===
                  normalizeValue(ca.value || ca.targetFolderId)
            )
          );

        if (isDuplicate) {
          conflicts.push({
            id: `duplicate-${rule._id}`,
            ruleId: rule._id,
            ruleName: rule.name,
            severity: 'warning',
            type: 'DUPLICATE',
            title: 'Trùng lặp hoàn toàn với quy tắc khác',
            description: `Quy tắc này có sự kiện kích hoạt, điều kiện và hành động trùng khớp hoàn toàn với quy tắc "${rule.name}".`,
            suggestion: 'Bạn nên kiểm tra lại xem có cần thiết tạo thêm quy tắc này không để tránh thực thi dư thừa.'
          });
          continue; // Đã là duplicate thì không cần báo thêm xung đột hành động lẻ
        }
      }
    }

    // 2. Xung đột hành động di chuyển (Conflicting MOVE_FILE)
    const ruleMoveAction = ruleActions.find((a) => a.type === 'MOVE_FILE');
    if (isSameTrigger && conditionsOverlap && candMoveAction && ruleMoveAction) {
      const candTarget = String(candMoveAction.targetFolderId?._id || candMoveAction.targetFolderId || '');
      const ruleTarget = String(ruleMoveAction.targetFolderId?._id || ruleMoveAction.targetFolderId || '');

      if (candTarget !== ruleTarget) {
        const candFolderName = getFolderName(candTarget, folderList);
        const ruleFolderName = getFolderName(ruleTarget, folderList);

        conflicts.push({
          id: `conflict-move-${rule._id}`,
          ruleId: rule._id,
          ruleName: rule.name,
          severity: 'danger',
          type: 'CONFLICT_MOVE',
          title: 'Xung đột thư mục đích (Di chuyển tệp)',
          description: `Quy tắc "${rule.name}" cũng tự động di chuyển tệp cùng thời điểm nhưng vào "${ruleFolderName}", trong khi quy tắc này chuyển vào "${candFolderName}". Một tệp tin không thể nằm ở 2 thư mục cùng lúc.`,
          suggestion: 'Bạn có thể thêm điều kiện lọc chi tiết hơn để 2 quy tắc không áp dụng chung tệp, hoặc điều chỉnh Độ ưu tiên (Priority).'
        });
      }
    }

    // 3. Xung đột đổi tên (Conflicting RENAME_FILE)
    const ruleRenameAction = ruleActions.find((a) => a.type === 'RENAME_FILE');
    if (isSameTrigger && conditionsOverlap && candRenameAction && ruleRenameAction) {
      const candNameVal = normalizeValue(candRenameAction.newName || candRenameAction.value);
      const ruleNameVal = normalizeValue(ruleRenameAction.newName || ruleRenameAction.value);

      if (candNameVal && ruleNameVal && candNameVal !== ruleNameVal) {
        conflicts.push({
          id: `conflict-rename-${rule._id}`,
          ruleId: rule._id,
          ruleName: rule.name,
          severity: 'warning',
          type: 'CONFLICT_RENAME',
          title: 'Xung đột định dạng đổi tên',
          description: `Cả hai quy tắc đều yêu cầu đổi tên tệp tin nhưng theo 2 định dạng khác nhau ("${ruleNameVal}" và "${candNameVal}").`,
          suggestion: 'Hệ thống sẽ chỉ áp dụng tên của quy tắc có độ ưu tiên cao hơn.'
        });
      }
    }

    // 4. Nguy cơ vòng lặp di chuyển (Ping-Pong Loop)
    if (candMoveAction && ruleMoveAction) {
      const candTarget = String(candMoveAction.targetFolderId?._id || candMoveAction.targetFolderId || '');
      const ruleTarget = String(ruleMoveAction.targetFolderId?._id || ruleMoveAction.targetFolderId || '');

      // Nếu rule kia kích hoạt khi FILE_MOVED, và candidate chuyển vào thư mục của rule kia,
      // hoặc ngược lại
      if (
        (candTrigger === 'FILE_MOVED' && candTarget === ruleTarget) ||
        (ruleTrigger === 'FILE_MOVED' && candTarget && ruleTarget && candTarget !== ruleTarget)
      ) {
        const isLoop =
          ruleConditions.some((c) => c.field === 'folder' && normalizeValue(c.value) === candTarget) ||
          candConditions.some((c) => c.field === 'folder' && normalizeValue(c.value) === ruleTarget);

        if (isLoop) {
          conflicts.push({
            id: `conflict-loop-${rule._id}`,
            ruleId: rule._id,
            ruleName: rule.name,
            severity: 'danger',
            type: 'LOOP_DANGER',
            title: 'Nguy cơ vòng lặp di chuyển vô hạn (Ping-pong)',
            description: `Quy tắc này và quy tắc "${rule.name}" có thể tạo vòng lặp di chuyển qua lại liên tục giữa các thư mục khi phát hiện sự kiện di chuyển tệp.`,
            suggestion: 'Vui lòng kiểm tra lại điều kiện thư mục nguồn và đích của cả 2 quy tắc để tránh tệp bị di chuyển vô tận.'
          });
        }
      }
    }
  }

  return conflicts;
};
