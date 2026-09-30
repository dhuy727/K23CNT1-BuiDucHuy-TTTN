import React, { useState } from 'react';
import { ChevronRight, ChevronDown, Folder, HardDrive } from 'lucide-react';

const TreeNode = ({ node, activeFolderId, onSelectFolder, disabledFolderId = null, isParentDisabled = false, level = 0 }) => {
  const [isOpen, setIsOpen] = useState(false);
  const hasChildren = node.children && node.children.length > 0;
  const isActive = activeFolderId === node._id;
  const isDisabled = isParentDisabled || Boolean(disabledFolderId && String(node._id) === String(disabledFolderId));

  const handleToggle = (e) => {
    e.stopPropagation();
    setIsOpen(!isOpen);
  };

  const handleSelect = () => {
    if (isDisabled) return;
    if (onSelectFolder) {
      onSelectFolder(node._id);
    }
  };

  return (
    <div className="tree-node">
      <div
        className={`tree-item ${isActive ? 'active' : ''}`}
        onClick={handleSelect}
        style={{
          paddingLeft: `${level * 16 + 8}px`,
          opacity: isDisabled ? 0.45 : 1,
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

        <Folder
          size={16}
          style={{
            color: node.color || '#3b82f6',
            fill: node.color ? `${node.color}33` : '#3b82f633'
          }}
        />
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
        {isDisabled && (
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
  includeRoot = false,
  disabledFolderId = null
}) => {
  const list = (tree && tree.length > 0) ? tree : (folders || []);

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
          className={`tree-item ${activeFolderId === null || activeFolderId === 'root' ? 'active' : ''}`}
          onClick={() => onSelectFolder && onSelectFolder(null)}
          style={{ paddingLeft: '8px', cursor: 'pointer' }}
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
          disabledFolderId={disabledFolderId}
          level={0}
        />
      ))}
    </div>
  );
};

export default FolderTree;

