import React, { useState, useRef, useEffect } from 'react';
import { ChevronRight, ChevronDown, Folder, FolderOpen, HardDrive } from 'lucide-react';
import {
  setActiveDragItem,
  getActiveDragItem,
  clearActiveDragItem,
  isExternalFileDrag
} from '../../utils/dragDropUpload';

const AUTO_EXPAND_DELAY_MS = 600;

const TreeNode = ({
  node,
  activeFolderId,
  onSelectFolder,
  onDirectDrop,
  onExternalDrop,
  disabledFolderId = null,
  isParentDisabled = false,
  level = 0
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isDropTarget, setIsDropTarget] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const expandTimerRef = useRef(null);
  const nodeRef = useRef(null);

  const hasChildren = node.children && node.children.length > 0;
  const isActive = activeFolderId === node._id;

  const activeDrag = getActiveDragItem();
  const isSelfBeingDragged =
    isDragging ||
    Boolean(activeDrag && activeDrag.type === 'folder' && String(activeDrag.id) === String(node._id));

  const isDisabled =
    isParentDisabled ||
    isSelfBeingDragged ||
    Boolean(disabledFolderId && String(node._id) === String(disabledFolderId));

  const clearExpandTimer = () => {
    if (expandTimerRef.current) {
      clearTimeout(expandTimerRef.current);
      expandTimerRef.current = null;
    }
  };

  useEffect(() => {
    return () => clearExpandTimer();
  }, []);

  const handleToggle = (e) => {
    e.stopPropagation();
    setIsOpen((prev) => !prev);
  };

  const handleSelect = () => {
    if (isDisabled) return;
    if (onSelectFolder) {
      onSelectFolder(node._id);
    }
  };

  const handleDragStart = (e) => {
    if (isDisabled) {
      e.preventDefault();
      return;
    }
    e.stopPropagation();
    setIsDragging(true);
    const payload = {
      type: 'folder',
      id: node._id,
      name: node.name,
      path: node.path,
      parentId: node.parentId || 'root'
    };
    setActiveDragItem(payload);
    e.dataTransfer.setData('application/json', JSON.stringify(payload));
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragEnd = () => {
    setIsDragging(false);
    clearExpandTimer();
    clearActiveDragItem();
  };

  const handleDragOver = (e) => {
    if (isDisabled) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = isExternalFileDrag(e) ? 'copy' : 'move';

    if (!isDropTarget) {
      setIsDropTarget(true);
    }

    // Tự động mở rộng thư mục có thư mục con khi giữ chuột kéo qua (~600ms) và cuộn nhẹ để hiển thị nhánh con
    if (hasChildren && !isOpen && !expandTimerRef.current) {
      expandTimerRef.current = setTimeout(() => {
        setIsOpen(true);
        expandTimerRef.current = null;
        setTimeout(() => {
          nodeRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }, 60);
      }, AUTO_EXPAND_DELAY_MS);
    }
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setIsDropTarget(false);
      clearExpandTimer();
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDropTarget(false);
    clearExpandTimer();
    if (isDisabled) return;

    // 1. Trường hợp kéo thả tệp/thư mục từ máy tính (OS) vào thẳng nút cây thư mục
    if (isExternalFileDrag(e)) {
      if (onExternalDrop) {
        onExternalDrop(e, node);
      }
      return;
    }

    // 2. Trường hợp kéo thả mục nội bộ trên Drive
    try {
      const raw = e.dataTransfer.getData('application/json');
      const sourceItem = raw ? JSON.parse(raw) : getActiveDragItem();
      clearActiveDragItem();
      if (sourceItem && String(sourceItem.id) !== String(node._id) && onDirectDrop) {
        onDirectDrop(sourceItem, node);
      }
    } catch (err) {
      console.error('Lỗi drop vào Tree Node:', err);
    }
  };

  return (
    <div className="tree-node" ref={nodeRef}>
      <div
        className={`tree-item ${isActive ? 'active' : ''} ${isDropTarget ? 'drop-target-active' : ''} ${isDragging ? 'is-dragging' : ''}`}
        onClick={handleSelect}
        draggable={!isDisabled}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        style={{
          paddingLeft: `${level * 16 + 8}px`,
          opacity: isDisabled ? 0.45 : isDragging ? 0.4 : 1,
          cursor: isDisabled ? 'not-allowed' : 'pointer'
        }}
        title={isDisabled ? 'Không thể di chuyển vào chính thư mục này hoặc thư mục con của nó' : node.name}
      >
        {hasChildren ? (
          <button
            type="button"
            className="tree-expand-btn"
            onClick={handleToggle}
            aria-label={isOpen ? 'Thu gọn' : 'Mở rộng'}
          >
            {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
        ) : (
          <span style={{ width: 14 }} />
        )}

        {isDropTarget ? (
          <FolderOpen
            size={16}
            style={{
              color: 'var(--primary-500)',
              fill: 'rgba(99, 102, 241, 0.25)'
            }}
          />
        ) : (
          <Folder
            size={16}
            style={{
              color: node.color || '#3b82f6',
              fill: node.color ? `${node.color}33` : '#3b82f633'
            }}
          />
        )}

        <span
          style={{
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            fontSize: '0.8125rem'
          }}
        >
          {node.name}
        </span>
        {isDisabled && !isDragging && (
          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginLeft: 'auto', fontStyle: 'italic' }}>
            (Không thể chọn)
          </span>
        )}
      </div>

      {hasChildren && isOpen && (
        <div className="tree-children">
          {node.children.map((child) => (
            <TreeNode
              key={child._id}
              node={child}
              activeFolderId={activeFolderId}
              onSelectFolder={onSelectFolder}
              onDirectDrop={onDirectDrop}
              onExternalDrop={onExternalDrop}
              disabledFolderId={disabledFolderId}
              isParentDisabled={isDisabled}
              level={level + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const FolderTree = ({
  tree,
  folders,
  activeFolderId = null,
  onSelectFolder,
  onDirectDrop,
  onExternalDrop,
  includeRoot = false,
  disabledFolderId = null
}) => {
  const [isRootDropTarget, setIsRootDropTarget] = useState(false);
  const list = tree && tree.length > 0 ? tree : folders || [];

  const handleRootDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = isExternalFileDrag(e) ? 'copy' : 'move';
    if (!isRootDropTarget) {
      setIsRootDropTarget(true);
    }
  };

  const handleRootDragLeave = (e) => {
    e.preventDefault();
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setIsRootDropTarget(false);
    }
  };

  const handleRootDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsRootDropTarget(false);

    const rootTarget = { _id: 'root', name: 'Drive của tôi' };

    if (isExternalFileDrag(e)) {
      if (onExternalDrop) {
        onExternalDrop(e, rootTarget);
      }
      return;
    }

    try {
      const raw = e.dataTransfer.getData('application/json');
      const sourceItem = raw ? JSON.parse(raw) : getActiveDragItem();
      clearActiveDragItem();
      if (sourceItem && onDirectDrop) {
        onDirectDrop(sourceItem, rootTarget);
      }
    } catch (err) {
      console.error('Lỗi drop vào Gốc FolderTree:', err);
    }
  };

  if (list.length === 0 && !includeRoot) {
    return (
      <div style={{ padding: '8px 12px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
        Chưa có thư mục
      </div>
    );
  }

  return (
    <div className="folder-tree-root">
      {includeRoot && (
        <div
          className={`tree-item ${activeFolderId === null || activeFolderId === 'root' ? 'active' : ''} ${
            isRootDropTarget ? 'drop-target-active' : ''
          }`}
          onClick={() => onSelectFolder && onSelectFolder(null)}
          onDragOver={handleRootDragOver}
          onDragLeave={handleRootDragLeave}
          onDrop={handleRootDrop}
          style={{ paddingLeft: '8px', cursor: 'pointer' }}
          title="Drive của tôi (Gốc) - Kéo thả tệp hoặc thư mục vào đây để đưa ra ngoài cùng"
        >
          <span style={{ width: 14 }} />
          <HardDrive size={16} style={{ color: 'var(--primary-400)' }} />
          <span style={{ fontSize: '0.8125rem', fontWeight: 600 }}>Drive của tôi (Gốc)</span>
        </div>
      )}
      {list.map((node) => (
        <TreeNode
          key={node._id}
          node={node}
          activeFolderId={activeFolderId}
          onSelectFolder={onSelectFolder}
          onDirectDrop={onDirectDrop}
          onExternalDrop={onExternalDrop}
          disabledFolderId={disabledFolderId}
          level={0}
        />
      ))}
    </div>
  );
};

export default FolderTree;
