import React, { useState } from 'react';
import { ChevronRight, HardDrive, Folder, FolderOpen } from 'lucide-react';

const Breadcrumb = ({ breadcrumbs = [], onSelectFolder, onDirectDrop }) => {
  const [dragOverId, setDragOverId] = useState(null);

  if (!breadcrumbs || breadcrumbs.length === 0) {
    return (
      <div className="breadcrumb-container">
        <span className="breadcrumb-item current">
          <HardDrive size={18} />
          <span>Drive của tôi</span>
        </span>
      </div>
    );
  }

  const handleDragOver = (e, item, isLast) => {
    if (isLast) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    const targetKey = item._id || 'root';
    if (dragOverId !== targetKey) {
      setDragOverId(targetKey);
    }
  };

  const handleDragLeave = (e, item) => {
    e.preventDefault();
    e.stopPropagation();
    const targetKey = item._id || 'root';
    if (dragOverId === targetKey) {
      setDragOverId(null);
    }
  };

  const handleDrop = (e, item, isLast) => {
    if (isLast) return;
    e.preventDefault();
    e.stopPropagation();
    setDragOverId(null);
    try {
      const raw = e.dataTransfer.getData('application/json');
      if (!raw) return;
      const sourceItem = JSON.parse(raw);
      if (sourceItem && onDirectDrop) {
        const isRoot = item._id === 'root' || item._id === null;
        onDirectDrop(sourceItem, {
          _id: isRoot ? 'root' : item._id,
          name: item.name
        });
      }
    } catch (err) {
      console.error('Lỗi drop vào Breadcrumb:', err);
    }
  };

  return (
    <nav className="breadcrumb-container" aria-label="Breadcrumb">
      {breadcrumbs.map((item, index) => {
        const isLast = index === breadcrumbs.length - 1;
        const isRoot = item._id === 'root' || item._id === null;
        const targetKey = item._id || 'root';
        const isDragOver = dragOverId === targetKey && !isLast;

        return (
          <React.Fragment key={item._id || index}>
            {index > 0 && <ChevronRight size={16} className="breadcrumb-separator" />}
            {isLast ? (
              <span className="breadcrumb-item current">
                {isRoot ? <HardDrive size={18} /> : <Folder size={18} />}
                <span>{item.name}</span>
              </span>
            ) : (
              <button
                type="button"
                className={`breadcrumb-item ${isDragOver ? 'drop-target-active' : ''}`}
                onClick={() => onSelectFolder && onSelectFolder(isRoot ? null : item._id)}
                onDragOver={(e) => handleDragOver(e, item, isLast)}
                onDragLeave={(e) => handleDragLeave(e, item)}
                onDrop={(e) => handleDrop(e, item, isLast)}
                title={`Nhấn để mở hoặc kéo thả tệp/thư mục vào "${item.name}"`}
                style={{ background: 'none', border: 'none' }}
              >
                {isRoot ? (
                  <HardDrive size={18} />
                ) : isDragOver ? (
                  <FolderOpen size={18} style={{ color: 'var(--primary-500)' }} />
                ) : (
                  <Folder size={18} />
                )}
                <span>{item.name}</span>
              </button>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
};

export default Breadcrumb;
