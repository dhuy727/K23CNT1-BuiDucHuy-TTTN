import React from 'react';
import { ChevronRight, HardDrive, Folder } from 'lucide-react';

const Breadcrumb = ({ breadcrumbs = [], onSelectFolder }) => {
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

  return (
    <nav className="breadcrumb-container" aria-label="Breadcrumb">
      {breadcrumbs.map((item, index) => {
        const isLast = index === breadcrumbs.length - 1;
        const isRoot = item._id === 'root' || item._id === null;

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
                className="breadcrumb-item"
                onClick={() => onSelectFolder && onSelectFolder(isRoot ? null : item._id)}
                style={{ background: 'none', border: 'none' }}
              >
                {isRoot ? <HardDrive size={18} /> : <Folder size={18} />}
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
