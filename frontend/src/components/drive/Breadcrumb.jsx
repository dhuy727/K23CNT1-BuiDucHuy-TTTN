import React, { useState, useRef, useEffect } from 'react';
import { ChevronRight, HardDrive, Folder, FolderOpen } from 'lucide-react';
import {
  getActiveDragItem,
  clearActiveDragItem,
  isExternalFileDrag
} from '../../utils/dragDropUpload';

const SPRING_OPEN_BREADCRUMB_DELAY_MS = 1000;

const Breadcrumb = ({ breadcrumbs = [], onSelectFolder, onDirectDrop, onExternalDrop }) => {
  const [dragOverId, setDragOverId] = useState(null);
  const springTimerRef = useRef(null);

  const clearSpringTimer = () => {
    if (springTimerRef.current) {
      clearTimeout(springTimerRef.current);
      springTimerRef.current = null;
    }
  };

  useEffect(() => {
    return () => clearSpringTimer();
  }, []);

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
    e.dataTransfer.dropEffect = isExternalFileDrag(e) ? 'copy' : 'move';
    const targetKey = item._id || 'root';
    if (dragOverId !== targetKey) {
      setDragOverId(targetKey);
      clearSpringTimer();
      const isRoot = item._id === 'root' || item._id === null;
      if (onSelectFolder) {
        springTimerRef.current = setTimeout(() => {
          springTimerRef.current = null;
          setDragOverId(null);
          onSelectFolder(isRoot ? null : item._id);
        }, SPRING_OPEN_BREADCRUMB_DELAY_MS);
      }
    }
  };

  const handleDragLeave = (e, item) => {
    e.preventDefault();
    e.stopPropagation();
    if (!e.currentTarget.contains(e.relatedTarget)) {
      const targetKey = item._id || 'root';
      if (dragOverId === targetKey) {
        setDragOverId(null);
      }
      clearSpringTimer();
    }
  };

  const handleDrop = (e, item, isLast) => {
    if (isLast) return;
    e.preventDefault();
    e.stopPropagation();
    setDragOverId(null);
    clearSpringTimer();

    const isRoot = item._id === 'root' || item._id === null;
    const targetFolder = {
      _id: isRoot ? 'root' : item._id,
      name: item.name
    };

    if (isExternalFileDrag(e)) {
      if (onExternalDrop) {
        onExternalDrop(e, targetFolder);
      }
      return;
    }

    try {
      const raw = e.dataTransfer.getData('application/json');
      const sourceItem = raw ? JSON.parse(raw) : getActiveDragItem();
      clearActiveDragItem();
      if (sourceItem && onDirectDrop) {
        onDirectDrop(sourceItem, targetFolder);
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
