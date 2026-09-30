import React, { useState, useEffect } from 'react';
import Modal from '../common/Modal';
import { Tag, Check, Sparkles } from 'lucide-react';
import categoryService from '../../services/categoryService';
import { useToast } from '../../contexts/ToastContext';

const AssignCategoryModal = ({ file, isOpen, onClose, onSuccess }) => {
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const toast = useToast();

  useEffect(() => {
    if (isOpen && file) {
      setSelectedCategory(file.aiCategory || 'Chưa phân loại');
      loadCategories();
    }
  }, [isOpen, file]);

  const loadCategories = async () => {
    setLoading(true);
    try {
      const res = await categoryService.getCategories();
      setCategories(res.data || []);
    } catch (err) {
      console.error('Lỗi tải danh mục:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!file?._id || !selectedCategory) return;

    setSaving(true);
    try {
      await categoryService.assignFileCategory(file._id, selectedCategory);
      toast.success(`Đã phân loại "${file.name}" vào "${selectedCategory}"`);
      onSuccess && onSuccess();
      onClose();
      window.dispatchEvent(new CustomEvent('drive:refresh'));
      window.dispatchEvent(new CustomEvent('file:updated'));
    } catch (err) {
      console.error('Lỗi khi gán danh mục:', err);
      toast.error('Không thể cập nhật danh mục tệp tin');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Phân loại danh mục tài liệu"
      size="sm"
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose} disabled={saving}>
            Hủy
          </button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving || !selectedCategory}>
            {saving ? <span className="spinner" /> : 'Xác nhận gán'}
          </button>
        </>
      }
    >
      <div style={{ marginBottom: '14px' }}>
        <div style={{ fontSize: '0.825rem', color: 'var(--text-muted)' }}>
          Chọn danh mục phù hợp cho tệp tin:
        </div>
        <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)', marginTop: '4px' }}>
          {file?.name}
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)' }}>
          <span className="spinner" style={{ width: 24, height: 24, margin: '0 auto' }} />
          <div style={{ marginTop: '6px', fontSize: '0.8rem' }}>Đang nạp danh mục...</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '260px', overflowY: 'auto' }}>
          {categories.map((cat) => {
            const isSelected = selectedCategory === cat.name;
            return (
              <div
                key={cat._id}
                onClick={() => setSelectedCategory(cat.name)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-md)',
                  background: isSelected ? 'rgba(99, 102, 241, 0.12)' : 'var(--bg-surface-hover)',
                  border: isSelected ? '1px solid var(--primary-600)' : '1px solid var(--border-subtle)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span
                    style={{
                      width: '12px',
                      height: '12px',
                      borderRadius: '50%',
                      backgroundColor: cat.color || '#3B82F6'
                    }}
                  />
                  <span style={{ fontWeight: isSelected ? 700 : 500, fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                    {cat.name}
                  </span>
                </div>

                {isSelected && <Check size={16} style={{ color: 'var(--primary-600)' }} />}
              </div>
            );
          })}
        </div>
      )}
    </Modal>
  );
};

export default AssignCategoryModal;
