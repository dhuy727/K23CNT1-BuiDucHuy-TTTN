import React, { useState } from 'react';
import { ChevronRight, ChevronDown, Folder, HardDrive } from 'lucide-react';

const TreeNode = ({ node, activeFolderId, onSelectFolder, level = 0 }) => {
  const [isOpen, setIsOpen] = useState(false);
  const hasChildren = node.children && node.children.length > 0;
  const isActive = activeFolderId === node._id;

  const handleToggle = (e) => {
    e.stopPropagation();
    setIsOpen(!isOpen);
  };

  const handleSelect = () => {
    if (onSelectFolder) {
      onSelectFolder(node._id);
    }
  };

  return (
    <div className="tree-node">
      <div
        className={`tree-item ${isActive ? 'active' : ''}`}
        onClick={handleSelect}
        style={{ paddingLeft: `${level * 16 + 8}px` }}
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
      </div>

      {hasChildren && isOpen && (
        <div className="tree-children">
          {node.children.map((child) => (
            <TreeNode
              key={child._id}
              node={child}
              activeFolderId={activeFolderId}
              onSelectFolder={onSelectFolder}
              level={level + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const FolderTree = ({ tree = [], activeFolderId = null, onSelectFolder, includeRoot = false }) => {
  return (
    <div className="folder-tree-root">
      {includeRoot && (
        <div
          className={`tree-item ${activeFolderId === null || activeFolderId === 'root' ? 'active' : ''}`}
          onClick={() => onSelectFolder && onSelectFolder(null)}
          style={{ paddingLeft: '8px' }}
        >
          <span style={{ width: 14 }} />
          <HardDrive size={16} style={{ color: 'var(--primary-600)' }} />
          <span style={{ fontSize: '0.8125rem', fontWeight: 600 }}>Drive của tôi (Gốc)</span>
        </div>
      )}
      {tree.map((node) => (
        <TreeNode
          key={node._id}
          node={node}
          activeFolderId={activeFolderId}
          onSelectFolder={onSelectFolder}
          level={0}
        />
      ))}
    </div>
  );
};

export default FolderTree;
