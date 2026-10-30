import fileService from '../services/fileService';
import folderService from '../services/folderService';

// Lưu trạng thái mục nội bộ đang được kéo để có thể kiểm tra trong sự kiện dragover
let activeInternalDragItem = null;

export const setActiveDragItem = (item) => {
  activeInternalDragItem = item;
};

export const getActiveDragItem = () => activeInternalDragItem;

export const clearActiveDragItem = () => {
  activeInternalDragItem = null;
};

/* ══════════════════════════════════════════════════════════════════════════
   TỰ ĐỘNG CUỘN MƯỢT (60FPS) KHI GIỮ KÉO TỆP Ở GẦN MÉP TRÊN/DƯỚI SIDEBAR & TRANG
   ══════════════════════════════════════════════════════════════════════════ */
let autoScrollRafId = null;
let lastDragClientX = 0;
let lastDragClientY = 0;
let lastDragOverTimestamp = 0;

const EDGE_ZONE_PX = 90;
const MIN_SPEED_PX = 2.5;
const MAX_SPEED_PX = 11;

const computeEdgeDelta = (clientY, rectTop, rectBottom, allowOutOfBounds = false) => {
  if (!allowOutOfBounds && (clientY < rectTop || clientY > rectBottom)) {
    return 0;
  }

  const topZoneLimit = rectTop + EDGE_ZONE_PX;
  const bottomZoneLimit = rectBottom - EDGE_ZONE_PX;

  if (clientY < topZoneLimit) {
    const ratio = Math.min(1, Math.max(0.15, (topZoneLimit - clientY) / EDGE_ZONE_PX));
    return -(MIN_SPEED_PX + ratio * (MAX_SPEED_PX - MIN_SPEED_PX));
  }

  if (clientY > bottomZoneLimit) {
    const ratio = Math.min(1, Math.max(0.15, (clientY - bottomZoneLimit) / EDGE_ZONE_PX));
    return MIN_SPEED_PX + ratio * (MAX_SPEED_PX - MIN_SPEED_PX);
  }

  return 0;
};

const stepAutoScroll = () => {
  // Tự ngắt an toàn nếu đã kết thúc kéo thả (quá 250ms không còn sự kiện dragover)
  if (Date.now() - lastDragOverTimestamp > 250) {
    stopDragAutoScroll();
    return;
  }

  const sidebarEl = document.querySelector('.app-sidebar');
  const sidebarNav = document.querySelector('.sidebar-nav');

  if (sidebarEl && sidebarNav) {
    const sidebarRect = sidebarEl.getBoundingClientRect();
    const isInsideSidebarX =
      lastDragClientX >= sidebarRect.left && lastDragClientX <= sidebarRect.right;
    const isInsideSidebarY =
      lastDragClientY >= sidebarRect.top && lastDragClientY <= sidebarRect.bottom;

    if (isInsideSidebarX && isInsideSidebarY) {
      // Nếu còn container con (.sidebar-tree-container) có thanh cuộn riêng thì ưu tiên cuộn cả hai
      const treeContainer = document.querySelector('.sidebar-tree-container');
      if (treeContainer && treeContainer.scrollHeight > treeContainer.clientHeight) {
        const treeRect = treeContainer.getBoundingClientRect();
        if (lastDragClientY >= treeRect.top && lastDragClientY <= treeRect.bottom) {
          const treeDelta = computeEdgeDelta(lastDragClientY, treeRect.top, treeRect.bottom, false);
          if (treeDelta !== 0) {
            treeContainer.scrollTop += treeDelta;
          }
        }
      }

      const navRect = sidebarNav.getBoundingClientRect();
      // Cho phép giữ chuột ở cả vùng nút Tạo mới (phía trên nav) hoặc vùng Dung lượng (phía dưới nav) để cuộn tiếp
      const navDelta = computeEdgeDelta(lastDragClientY, navRect.top, navRect.bottom, true);
      if (navDelta !== 0) {
        sidebarNav.scrollTop += navDelta;
      }

      autoScrollRafId = window.requestAnimationFrame(stepAutoScroll);
      return;
    }
  }

  // Tự động cuộn vùng làm việc chính (.page-body) khi kéo tệp gần mép trên/dưới
  const pageBody = document.querySelector('.page-body');
  if (pageBody && pageBody.scrollHeight > pageBody.clientHeight) {
    const bodyRect = pageBody.getBoundingClientRect();
    if (
      lastDragClientX >= bodyRect.left &&
      lastDragClientX <= bodyRect.right &&
      lastDragClientY >= bodyRect.top &&
      lastDragClientY <= bodyRect.bottom
    ) {
      const bodyDelta = computeEdgeDelta(lastDragClientY, bodyRect.top, bodyRect.bottom, false);
      if (bodyDelta !== 0) {
        pageBody.scrollTop += bodyDelta;
      }
    }
  }

  autoScrollRafId = window.requestAnimationFrame(stepAutoScroll);
};

export const stopDragAutoScroll = () => {
  if (autoScrollRafId !== null) {
    window.cancelAnimationFrame(autoScrollRafId);
    autoScrollRafId = null;
  }
};

if (typeof window !== 'undefined') {
  window.addEventListener(
    'dragover',
    (e) => {
      lastDragClientX = e.clientX;
      lastDragClientY = e.clientY;
      lastDragOverTimestamp = Date.now();
      if (autoScrollRafId === null) {
        autoScrollRafId = window.requestAnimationFrame(stepAutoScroll);
      }
    },
    { capture: true }
  );

  window.addEventListener('dragend', stopDragAutoScroll, { capture: true });
  window.addEventListener('drop', stopDragAutoScroll, { capture: true });
}

/**
 * Kiểm tra xem sự kiện kéo có phải là kéo tệp/thư mục từ máy tính (OS) vào trình duyệt hay không
 */
export const isExternalFileDrag = (e) => {
  if (!e?.dataTransfer?.types) return false;
  const types = Array.from(e.dataTransfer.types);
  // Nếu có 'application/json' hoặc đang kéo mục nội bộ thì không phải kéo tệp từ ngoài
  if (types.includes('application/json') || activeInternalDragItem) {
    return false;
  }
  return types.includes('Files');
};

/**
 * Quét đệ quy FileSystemEntry (hỗ trợ kéo thả cả thư mục nhiều cấp từ máy tính)
 */
const scanEntry = async (entry, path = '') => {
  if (!entry) return [];

  if (entry.isFile) {
    return new Promise((resolve) => {
      entry.file(
        (file) => {
          file.customRelativePath = path ? `${path}/${file.name}` : '';
          resolve([file]);
        },
        () => resolve([])
      );
    });
  }

  if (entry.isDirectory) {
    const dirReader = entry.createReader();
    const readAllEntries = async () => {
      const entries = [];
      let batch;
      do {
        batch = await new Promise((resolve) =>
          dirReader.readEntries(resolve, () => resolve([]))
        );
        if (batch && batch.length > 0) {
          entries.push(...batch);
        }
      } while (batch && batch.length > 0);
      return entries;
    };

    const entries = await readAllEntries();
    const nextPath = path ? `${path}/${entry.name}` : entry.name;
    const nested = await Promise.all(
      entries.map((child) => scanEntry(child, nextPath))
    );
    return nested.flat();
  }

  return [];
};

/**
 * Trích xuất danh sách File từ sự kiện drop.
 * Lưu ý: Cần lấy webkitGetAsEntry() đồng bộ ngay trong tick đầu tiên của sự kiện drop
 * trước khi gọi bất kỳ lệnh await nào để tránh DataTransferItemList bị trình duyệt xóa.
 */
export const extractDroppedFiles = async (dataTransfer) => {
  if (!dataTransfer) return [];

  const fallbackFiles = dataTransfer.files ? Array.from(dataTransfer.files) : [];
  const items = dataTransfer.items ? Array.from(dataTransfer.items) : [];

  const entries = items
    .filter((item) => item.kind === 'file' && typeof item.webkitGetAsEntry === 'function')
    .map((item) => item.webkitGetAsEntry())
    .filter(Boolean);

  if (entries.length > 0) {
    const scannedGroups = await Promise.all(entries.map((entry) => scanEntry(entry, '')));
    const scannedFiles = scannedGroups.flat();
    if (scannedFiles.length > 0) {
      return scannedFiles;
    }
  }

  return fallbackFiles;
};

const getFileRelativePath = (file) => {
  return file.customRelativePath || file.webkitRelativePath || '';
};

const getDirectoryPath = (file) => {
  const rel = getFileRelativePath(file);
  if (!rel) return '';
  const lastSlash = rel.lastIndexOf('/');
  return lastSlash !== -1 ? rel.substring(0, lastSlash) : '';
};

/**
 * Tải lên ngay lập tức các tệp/thư mục được kéo thả từ máy tính vào một thư mục đích
 */
export const uploadDroppedFilesFromEvent = async (
  e,
  targetFolderId,
  targetFolderName,
  toast,
  onSuccess
) => {
  const files = await extractDroppedFiles(e?.dataTransfer);
  if (!files || files.length === 0) return false;

  const normalizedFolderId =
    !targetFolderId || targetFolderId === 'root' ? null : targetFolderId;
  const folderLabel =
    targetFolderName || (!normalizedFolderId ? 'Drive của tôi' : 'thư mục');

  const hasFolderStructure = files.some((f) => Boolean(getFileRelativePath(f)));

  toast?.info(
    hasFolderStructure
      ? `Đang tải cấu trúc thư mục (${files.length} tệp) lên "${folderLabel}"...`
      : `Đang tải ${files.length} tệp lên "${folderLabel}"...`
  );

  try {
    if (!hasFolderStructure) {
      if (files.length === 1) {
        const formData = new FormData();
        formData.append('file', files[0]);
        formData.append('fileName', files[0].name);
        if (normalizedFolderId) {
          formData.append('folderId', normalizedFolderId);
        }
        await fileService.uploadFile(formData);
      } else {
        const formData = new FormData();
        files.forEach((file) => {
          formData.append('files', file);
        });
        formData.append('fileNames', JSON.stringify(files.map((f) => f.name)));
        if (normalizedFolderId) {
          formData.append('folderId', normalizedFolderId);
        }
        await fileService.uploadMultipleFiles(formData);
      }
    } else {
      const folderCache = new Map();
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const dirPath = getDirectoryPath(file);
        let destFolderId = normalizedFolderId;

        if (dirPath) {
          if (folderCache.has(dirPath)) {
            destFolderId = folderCache.get(dirPath);
          } else {
            const res = await folderService.ensureFolderPath(normalizedFolderId, dirPath);
            destFolderId = res.data?.folderId || res.data;
            folderCache.set(dirPath, destFolderId);
          }
        }

        const formData = new FormData();
        formData.append('file', file);
        formData.append('fileName', file.name);
        if (destFolderId) {
          formData.append('folderId', destFolderId);
        }
        await fileService.uploadFile(formData);
      }
    }

    toast?.success(
      hasFolderStructure
        ? `Đã tải thành công thư mục (${files.length} tệp) vào "${folderLabel}"!`
        : `Đã tải lên thành công ${files.length} tệp vào "${folderLabel}"!`
    );

    window.dispatchEvent(new CustomEvent('drive:refresh-notifications'));
    window.dispatchEvent(new Event('folder:updated'));
    window.dispatchEvent(new Event('file:updated'));
    window.dispatchEvent(new Event('drive:refresh'));

    if (onSuccess) {
      onSuccess();
    }
    return true;
  } catch (err) {
    console.error('Lỗi khi tải tệp kéo thả:', err);
    toast?.error(
      err.response?.data?.message || 'Có lỗi xảy ra khi tải tệp lên.'
    );
    return false;
  }
};
