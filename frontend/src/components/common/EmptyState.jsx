import React from 'react';
import { FolderOpen } from 'lucide-react';

const EmptyState = ({
  icon: Icon = FolderOpen,
  title = 'Không có dữ liệu',
  description = 'Hiện tại chưa có tệp tin hoặc thư mục nào ở đây.',
  action = null
}) => {
  return (
    <div className="empty-state">
      <div className="empty-state-icon">
        <Icon size={36} />
      </div>
      <div className="empty-state-title">{title}</div>
      <div className="empty-state-desc">{description}</div>
      {action && <div style={{ marginTop: '12px' }}>{action}</div>}
    </div>
  );
};

export default EmptyState;
