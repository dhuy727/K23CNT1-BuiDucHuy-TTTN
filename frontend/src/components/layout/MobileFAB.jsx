import React from 'react';
import { Plus } from 'lucide-react';

const MobileFAB = ({ onOpenUpload }) => {
  return (
    <button
      type="button"
      className="mobile-fab"
      onClick={onOpenUpload}
      title="Tải lên hoặc thêm mới tài liệu"
      aria-label="Tải lên tài liệu"
    >
      <Plus size={26} strokeWidth={2.4} />
    </button>
  );
};

export default MobileFAB;
