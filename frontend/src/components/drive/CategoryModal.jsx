import React, { useState, useEffect } from 'react';
import Modal from '../common/Modal';
import { Tag, Plus, Edit2, Trash2, Check, Sparkles, Folder } from 'lucide-react';
import categoryService from '../../services/categoryService';
import { useToast } from '../../contexts/ToastContext';

const PRESET_COLORS = [
  '#3B82F6', // Blue
  '#10B981', // Emerald
  '#F59E0B', // Amber
  '#8B5CF6', // Purple
  '#EC4899', // Pink
  '#06B6D4', // Cyan
  '#EF4444', // Rose/Red
  '#64748B'  // Slate
];

const CategoryModal = ({ isOpen, onClose, onCategoryChanged }) => {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form mode: 'list' | 'add' | 'edit'
  const [mode, setMode] = useState('list');
  const [editingId, setEditingId] = useState(null);

  // Form fields
  const [name, setName] = useState('');
  const [color, setColor] = useState('#3B82F6');
  const [description, setDescription] = useState('');

  const toast = useToast();

  const loadCategories = async () => {
    setLoading(true);
    try {
      const res = await categoryService.getCategories();
      setCategories(res.data || []);
    } catch (err) {
      console.error('Lỗi khi tải danh mục:', err);
      toast.error('Không thể tải danh sách danh mục');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadCategories();
      setMode('list');
      resetForm();
    }
  }, [isOpen]);

  const resetForm = () => {
    setName('');
    setColor('#3B82F6');
    setDescription('');
    setEditingId(null);
  };

  const handleStartAdd = () => {
    resetForm();
    setMode('add');
  };

  const handleStartEdit = (cat) => {
    setEditingId(cat._id);
    setName(cat.name);
    setColor(cat.color || '#3B82F6');
    setDescription(cat.description || '');
    setMode('edit');
  };

  const handleCancelForm = () => {
    resetForm();
    setMode('list');
  };

  const handleSubmitForm = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Vui lòng nhập tên danh mục');
      return;
    }

    setSaving(true);
    try {
      if (mode === 'add') {
        await categoryService.createCategory({
          name: name.trim(),
          color,
          description: description.trim()
        });
        toast.success(`Đã tạo danh mục "${name.trim()}"`);
      } else if (mode === 'edit') {
        await categoryService.updateCategory(editingId, {
          name: name.trim(),
          color,
          description: description.trim()
        });
        toast.success(`Đã cập nhật danh mục "${name.trim()}"`);
      }

      resetForm();
      setMode('list');
      await loadCategories();
      onCategoryChanged && onCategoryChanged();
      window.dispatchEvent(new CustomEvent('drive:refresh'));
    } catch (err) {
      console.error('Lỗi lưu danh mục:', err);
      toast.error(err.response?.data?.message || 'Lưu danh mục thất bại');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteCategory = async (cat) => {
    if (!window.confirm(`Bạn có chắc muốn xóa danh mục "${cat.name}"? Các tài liệu thuộc danh mục này sẽ chuyển về "Chưa phân loại".`)) {
      return;
    }

    try {
      await categoryService.deleteCategory(cat._id);
      toast.success(`Đã xóa danh mục "${cat.name}"`);
      await loadCategories();
      onCategoryChanged && onCategoryChanged();
      window.dispatchEvent(new CustomEvent('drive:refresh'));
    } catch (err) {
      console.error('Lỗi xóa danh mục:', err);
      toast.error(err.response?.data?.message || 'Xóa danh mục thất bại');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        mode === 'add'
          ? 'Tạo danh mục tài liệu mới'
          : mode === 'edit'
          ? 'Chỉnh sửa danh mục'
          : 'Quản lý danh mục tài liệu'
      }
      size="md"
      footer={
        mode !== 'list' ? (
          <>
            <button className="btn btn-secondary" onClick={handleCancelForm} disabled={saving}>
              Quay lại danh sách
            </button>
            <button className="btn btn-primary" onClick={handleSubmitForm} disabled={saving}>
              {saving ? <span className="spinner" /> : mode === 'add' ? 'Tạo danh mục' : 'Lưu thay đổi'}
            </button>
          </>
        ) : (
          <>
            <button className="btn btn-secondary" onClick={onClose}>
              Đóng
            </button>
            <button className="btn btn-primary" onClick={handleStartAdd}>
              <Plus size={16} />
              <span>Thêm danh mục mới</span>
            </button>
          </>
        )
      }
    >
      {mode === 'list' ? (
        <div>
          <div style={{ fontSize: '0.825rem', color: 'var(--text-muted)', marginBottom: '14px' }}>
            Phân loại tài liệu giúp bạn lọc nhanh và tìm kiếm thông minh theo từng nhóm công việc.
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '30px 10px', color: 'var(--text-muted)' }}>
              <span className="spinner" style={{ width: 28, height: 28, margin: '0 auto' }} />
              <div style={{ marginTop: '8px', fontSize: '0.825rem' }}>Đang tải danh mục...</div>
            </div>
          ) : categories.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '30px 10px', color: 'var(--text-muted)' }}>
              Chưa có danh mục nào. Nhấn nút "Thêm danh mục mới" bên dưới để bắt đầu.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '380px', overflowY: 'auto' }}>
              {categories.map((cat) => (
                <div
                  key={cat._id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 14px',
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--bg-surface-hover)',
                    border: '1px solid var(--border-subtle)',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                    <span
                      style={{
                        width: '14px',
                        height: '14px',
                        borderRadius: '50%',
                        backgroundColor: cat.color || '#3B82F6',
                        flexShrink: 0
                      }}
                    />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span>{cat.name}</span>
                        <span className="badge badge-purple" style={{ fontSize: '0.7rem' }}>
                          {cat.fileCount || 0} tệp
                        </span>
                      </div>
                      {cat.description && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {cat.description}
                        </div>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                    <button
                      className="btn-icon"
                      title="Chỉnh sửa"
                      onClick={() => handleStartEdit(cat)}
                    >
                      <Edit2 size={15} />
                    </button>
                    <button
                      className="btn-icon"
                      title="Xóa danh mục"
                      onClick={() => handleDeleteCategory(cat)}
                      style={{ color: 'var(--accent-rose)' }}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* Form Thêm / Sửa Danh mục */
        <form onSubmit={handleSubmitForm}>
          <div className="form-group">
            <label className="form-label">Tên danh mục (*)</label>
            <input
              type="text"
              className="form-input"
              placeholder="VD: Hợp đồng 2026, Đề tài tốt nghiệp..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Màu sắc nhận diện</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginTop: '6px' }}>
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    backgroundColor: c,
                    border: color === c ? '3px solid var(--text-primary)' : '2px solid transparent',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#ffffff',
                    transition: 'transform 0.15s ease'
                  }}
                >
                  {color === c && <Check size={16} />}
                </button>
              ))}
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Mô tả ngắn</label>
            <textarea
              className="form-input"
              rows={3}
              placeholder="Ghi chú về nhóm tài liệu này..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        </form>
      )}
    </Modal>
  );
};

export default CategoryModal;
