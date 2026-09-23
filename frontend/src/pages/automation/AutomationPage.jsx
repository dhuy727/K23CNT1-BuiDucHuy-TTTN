import React, { useState, useEffect } from 'react';
import {
  Zap,
  Plus,
  Trash2,
  Edit2,
  Folder,
  Tag,
  Star,
  Bell,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  History,
  FileText,
  Copy,
  FolderInput,
  Info,
  X
} from 'lucide-react';
import automationService from '../../services/automationService';
import folderService from '../../services/folderService';
import '../../styles/automation.css';

const AI_CATEGORIES = [
  'Hợp đồng',
  'Hóa đơn',
  'Báo cáo',
  'Tài liệu học tập',
  'CV',
  'Biên bản',
  'Tài liệu kỹ thuật',
  'Khác'
];

const TRIGGER_OPTIONS = [
  { value: 'AI_COMPLETED', label: 'AI hoàn tất phân loại', desc: 'Sau khi AI đọc & phân loại nội dung tệp tin' },
  { value: 'FILE_UPLOADED', label: 'Tệp tin được tải lên', desc: 'Ngay khi tệp được lưu vào hệ thống' },
  { value: 'FILE_UPDATED', label: 'Tệp tin được cập nhật', desc: 'Khi đổi tên hoặc cập nhật phiên bản mới' },
  { value: 'FILE_MOVED', label: 'Tệp tin được di chuyển', desc: 'Khi tệp tin được chuyển sang thư mục khác' }
];

const CONDITION_FIELDS = [
  { value: 'aiCategory', label: 'Danh mục AI (Category)' },
  { value: 'extension', label: 'Đuôi tệp tin (Extension)' },
  { value: 'name', label: 'Tên tệp tin' },
  { value: 'size', label: 'Kích thước tệp (Bytes)' },
  { value: 'aiTags', label: 'Thẻ AI (Tags)' },
  { value: 'mimeType', label: 'Loại MIME' }
];

const CONDITION_OPERATORS = [
  { value: 'equals', label: 'Bằng (=)' },
  { value: 'not_equals', label: 'Khác (!=)' },
  { value: 'contains', label: 'Chứa ký tự' },
  { value: 'gt', label: 'Lớn hơn (>)' },
  { value: 'gte', label: 'Lớn hơn hoặc bằng (>=)' },
  { value: 'lt', label: 'Nhỏ hơn (<)' },
  { value: 'lte', label: 'Nhỏ hơn hoặc bằng (<=)' }
];

const ACTION_TYPES = [
  { value: 'MOVE_FILE', label: 'Di chuyển vào thư mục' },
  { value: 'ADD_TAG', label: 'Gắn thẻ từ khóa (Tag)' },
  { value: 'STAR_FILE', label: 'Đánh dấu sao yêu thích' },
  { value: 'RENAME_FILE', label: 'Đổi tên tệp tin' },
  { value: 'NOTIFY', label: 'Gửi thông báo hệ thống' },
  { value: 'CREATE_VERSION', label: 'Tạo bản sao lưu phiên bản' }
];

const AutomationPage = () => {
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [folders, setFolders] = useState([]);

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRuleId, setEditingRuleId] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    trigger: { type: 'AI_COMPLETED' },
    conditions: [],
    actions: [{ type: 'ADD_TAG', value: '' }],
    priority: 0,
    isActive: true
  });
  const [saving, setSaving] = useState(false);
  const [runningAll, setRunningAll] = useState(false);

  const formatConditionText = (c) => {
    const fieldMap = {
      extension: 'Đuôi tệp',
      aiCategory: 'Danh mục AI',
      name: 'Tên tệp',
      size: 'Kích thước',
      aiTags: 'Thẻ AI',
      mimeType: 'Loại MIME'
    };
    const opMap = {
      equals: '=',
      not_equals: '≠',
      contains: 'chứa',
      gt: '>',
      gte: '≥',
      lt: '<',
      lte: '≤'
    };
    const fLabel = fieldMap[c.field] || c.field;
    const opLabel = opMap[c.operator] || c.operator;
    return `${fLabel} ${opLabel} "${c.value}"`;
  };

  const handleRunAllRules = async () => {
    setRunningAll(true);
    try {
      const res = await automationService.runAllRules();
      alert(res?.data?.message || res?.message || 'Đã quét và áp dụng quy tắc thành công cho tất cả tệp tin!');
      fetchRules();
    } catch (err) {
      alert(err.response?.data?.message || 'Lỗi khi quét quy tắc');
    } finally {
      setRunningAll(false);
    }
  };

  useEffect(() => {
    fetchRules();
    fetchFolders();
  }, []);

  const fetchRules = async () => {
    setLoading(true);
    try {
      const res = await automationService.getRules();
      setRules(res?.data || res || []);
    } catch (err) {
      console.error('Lỗi lấy danh sách quy tắc:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchFolders = async () => {
    try {
      const res = await folderService.getFolderTree();
      setFolders(res?.data || res || []);
    } catch (err) {
      console.error('Lỗi lấy cây thư mục:', err);
    }
  };

  // Flatten folder tree for selector
  const flattenFolders = (tree, prefix = '') => {
    let result = [];
    for (const f of tree) {
      result.push({ _id: f._id, name: `${prefix}${f.name}` });
      if (f.children && f.children.length > 0) {
        result = result.concat(flattenFolders(f.children, `${prefix}  └ `));
      }
    }
    return result;
  };
  const flatFolderList = flattenFolders(folders);

  // Stats
  const activeCount = rules.filter((r) => r.isActive).length;
  const totalRuns = rules.reduce((acc, r) => acc + (r.runCount || 0), 0);
  const lastRunRule = rules
    .filter((r) => r.lastRunAt)
    .sort((a, b) => new Date(b.lastRunAt) - new Date(a.lastRunAt))[0];

  const handleToggle = async (id, e) => {
    e.stopPropagation();
    try {
      const res = await automationService.toggleRule(id);
      const updated = res?.data || res;
      setRules((prev) => prev.map((r) => (r._id === id ? { ...r, isActive: updated.isActive } : r)));
    } catch (err) {
      alert('Không thể đổi trạng thái quy tắc');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Bạn có chắc muốn xóa quy tắc này không?')) return;
    try {
      await automationService.deleteRule(id);
      setRules((prev) => prev.filter((r) => r._id !== id));
    } catch (err) {
      alert('Lỗi khi xóa quy tắc');
    }
  };

  const handleOpenCreateModal = (preset = null) => {
    if (preset) {
      setFormData(preset);
      setEditingRuleId(null);
    } else {
      setFormData({
        name: '',
        trigger: { type: 'AI_COMPLETED' },
        conditions: [{ field: 'aiCategory', operator: 'equals', value: 'Hợp đồng' }],
        actions: [{ type: 'ADD_TAG', value: 'contract' }],
        priority: 0,
        isActive: true
      });
      setEditingRuleId(null);
    }
    setModalOpen(true);
  };

  const handleOpenEditModal = (rule) => {
    setEditingRuleId(rule._id);
    const sanitizedActions = (rule.actions || []).map((act) => ({
      ...act,
      targetFolderId: act.targetFolderId?._id || act.targetFolderId || ''
    }));

    setFormData({
      name: rule.name,
      trigger: rule.trigger || { type: 'AI_COMPLETED' },
      conditions: (rule.conditions || []).map((c) => ({ ...c })),
      actions: sanitizedActions.length > 0 ? sanitizedActions : [{ type: 'ADD_TAG', value: '' }],
      priority: rule.priority || 0,
      isActive: rule.isActive !== false
    });
    setModalOpen(true);
  };

  const handleSaveRule = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      alert('Vui lòng nhập tên quy tắc');
      return;
    }
    if (!formData.actions || formData.actions.length === 0) {
      alert('Quy tắc phải có ít nhất một hành động');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...formData,
        actions: formData.actions.map((act) => ({
          ...act,
          targetFolderId: act.targetFolderId?._id || act.targetFolderId || null
        }))
      };

      if (editingRuleId) {
        await automationService.updateRule(editingRuleId, payload);
      } else {
        await automationService.createRule(payload);
      }
      setModalOpen(false);
      fetchRules();
    } catch (err) {
      alert(err.response?.data?.message || 'Lỗi khi lưu quy tắc tự động hóa');
    } finally {
      setSaving(false);
    }
  };

  // Conditions modification
  const handleAddCondition = () => {
    setFormData((prev) => ({
      ...prev,
      conditions: [...prev.conditions, { field: 'extension', operator: 'equals', value: 'pdf' }]
    }));
  };

  const handleRemoveCondition = (index) => {
    setFormData((prev) => ({
      ...prev,
      conditions: prev.conditions.filter((_, i) => i !== index)
    }));
  };

  const handleUpdateCondition = (index, field, value) => {
    setFormData((prev) => {
      const updated = [...prev.conditions];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, conditions: updated };
    });
  };

  // Actions modification
  const handleAddAction = () => {
    setFormData((prev) => ({
      ...prev,
      actions: [...prev.actions, { type: 'ADD_TAG', value: '' }]
    }));
  };

  const handleRemoveAction = (index) => {
    setFormData((prev) => ({
      ...prev,
      actions: prev.actions.filter((_, i) => i !== index)
    }));
  };

  const handleUpdateAction = (index, field, value) => {
    setFormData((prev) => {
      const updated = [...prev.actions];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, actions: updated };
    });
  };

  // Preset quick seeds
  const applyPresetPdf = () => {
    handleOpenCreateModal({
      name: 'Tài liệu PDF → Tự động gắn thẻ PDF',
      trigger: { type: 'FILE_UPLOADED' },
      conditions: [{ field: 'extension', operator: 'equals', value: 'pdf' }],
      actions: [{ type: 'ADD_TAG', value: 'PDF' }],
      priority: 1,
      isActive: true
    });
  };

  const applyPresetContract = () => {
    // Tìm xem có thư mục tên 'Hợp đồng' không
    const contractFolder = flatFolderList.find((f) =>
      f.name.toLowerCase().includes('hợp đồng')
    );

    handleOpenCreateModal({
      name: 'Category Hợp đồng → Move + Tag + Star + Notify',
      trigger: { type: 'AI_COMPLETED' },
      conditions: [{ field: 'aiCategory', operator: 'equals', value: 'Hợp đồng' }],
      actions: [
        { type: 'MOVE_FILE', targetFolderId: contractFolder?._id || '' },
        { type: 'ADD_TAG', value: 'contract' },
        { type: 'STAR_FILE', value: '' },
        { type: 'NOTIFY', value: 'Đã tự động phân loại và chuyển hợp đồng vào thư mục lưu trữ.' }
      ],
      priority: 2,
      isActive: true
    });
  };

  const getTriggerBadge = (type) => {
    switch (type) {
      case 'AI_COMPLETED':
        return (
          <span className="badge badge-purple" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <Sparkles size={11} />
            <span>AI hoàn tất</span>
          </span>
        );
      case 'FILE_UPLOADED':
        return (
          <span className="badge badge-blue" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <FileText size={11} />
            <span>Khi tải lên</span>
          </span>
        );
      case 'FILE_UPDATED':
        return (
          <span className="badge badge-yellow" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <History size={11} />
            <span>Khi cập nhật</span>
          </span>
        );
      case 'FILE_MOVED':
        return (
          <span className="badge badge-cyan" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <FolderInput size={11} />
            <span>Khi di chuyển</span>
          </span>
        );
      default:
        return <span className="badge badge-slate">{type}</span>;
    }
  };

  return (
    <div className="automation-page-container">
      {/* Header */}
      <div className="automation-header">
        <div>
          <div className="automation-title">
            <Zap size={26} className="text-primary" />
            <span>Tự động hóa & Quy tắc AI</span>
          </div>
          <p className="automation-subtitle">
            Thiết lập các quy tắc thông minh tự động phân loại, di chuyển, gắn thẻ và thông báo theo sự kiện.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            className="btn btn-secondary"
            onClick={handleRunAllRules}
            disabled={runningAll || rules.filter((r) => r.isActive).length === 0}
            title="Quét và áp dụng toàn bộ quy tắc đang bật cho các tệp hiện có trong Drive"
          >
            <Sparkles size={16} className={runningAll ? 'spin-animation' : ''} />
            <span>{runningAll ? 'Đang áp dụng...' : 'Áp dụng cho tất cả tệp'}</span>
          </button>
          <button className="btn btn-primary" onClick={() => handleOpenCreateModal()}>
            <Plus size={16} />
            <span>Tạo quy tắc mới</span>
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="automation-stats-grid">
        <div className="automation-stat-card">
          <div className="automation-stat-icon" style={{ background: 'rgba(99, 102, 241, 0.12)', color: '#818cf8' }}>
            <Zap size={22} />
          </div>
          <div className="automation-stat-info">
            <div className="automation-stat-value">
              {activeCount} / {rules.length}
            </div>
            <div className="automation-stat-label">Quy tắc đang hoạt động</div>
          </div>
        </div>

        <div className="automation-stat-card">
          <div className="automation-stat-icon" style={{ background: 'rgba(16, 185, 129, 0.12)', color: '#10b981' }}>
            <CheckCircle2 size={22} />
          </div>
          <div className="automation-stat-info">
            <div className="automation-stat-value">{totalRuns}</div>
            <div className="automation-stat-label">Tổng số lần thực thi tự động</div>
          </div>
        </div>

        <div className="automation-stat-card">
          <div className="automation-stat-icon" style={{ background: 'rgba(234, 179, 8, 0.12)', color: '#eab308' }}>
            <History size={22} />
          </div>
          <div className="automation-stat-info">
            <div className="automation-stat-value" style={{ fontSize: '0.9375rem' }}>
              {lastRunRule ? new Date(lastRunRule.lastRunAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' }) : 'Chưa có'}
            </div>
            <div className="automation-stat-label">Lần kích hoạt gần nhất</div>
          </div>
        </div>
      </div>

      {/* Templates Seed Section */}
      <div className="automation-templates-section">
        <div className="automation-section-heading">
          <Sparkles size={16} className="text-primary" />
          <span>Mẫu quy tắc gợi ý nhanh</span>
        </div>
        <div className="automation-templates-grid">
          <div className="automation-template-card">
            <div>
              <div className="automation-template-title">
                <Tag size={16} style={{ color: '#38bdf8' }} />
                <span>Tự động gắn thẻ PDF</span>
              </div>
              <p className="automation-template-desc">
                Khi tải lên tệp có đuôi <strong>.pdf</strong>, tự động gắn thẻ <strong>#PDF</strong> để dễ dàng lọc và tìm kiếm.
              </p>
            </div>
            <button className="btn btn-secondary btn-sm" onClick={applyPresetPdf}>
              <span>Sử dụng mẫu này</span>
              <ArrowRight size={14} />
            </button>
          </div>

          <div className="automation-template-card">
            <div>
              <div className="automation-template-title">
                <FolderInput size={16} style={{ color: '#818cf8' }} />
                <span>Hợp đồng thông minh (Demo)</span>
              </div>
              <p className="automation-template-desc">
                Khi AI phân loại là <strong>Hợp đồng</strong>, tự động chuyển vào thư mục Hợp đồng, gắn thẻ <strong>contract</strong>, gắn sao và gửi thông báo.
              </p>
            </div>
            <button className="btn btn-secondary btn-sm" onClick={applyPresetContract}>
              <span>Sử dụng mẫu này</span>
              <ArrowRight size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Rules List */}
      <div className="automation-section-heading">
        <Zap size={16} />
        <span>Danh sách quy tắc của bạn ({rules.length})</span>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
          <span className="spinner" style={{ width: 28, height: 28 }} />
          <div style={{ marginTop: '12px', fontSize: '0.875rem' }}>Đang nạp danh sách quy tắc...</div>
        </div>
      ) : rules.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: '50px 20px',
            background: 'var(--bg-surface)',
            border: '1px dashed var(--border-main)',
            borderRadius: 'var(--radius-xl)'
          }}
        >
          <Zap size={40} style={{ color: 'var(--text-muted)', opacity: 0.5 }} />
          <h4 style={{ marginTop: '14px', fontSize: '1.05rem', fontWeight: 700 }}>
            Chưa có quy tắc tự động hóa nào
          </h4>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.84375rem', marginTop: '6px' }}>
            Tạo quy tắc mới hoặc áp dụng mẫu gợi ý ở trên để bắt đầu tối ưu hóa quy trình quản lý tệp tin.
          </p>
          <button
            className="btn btn-primary"
            onClick={() => handleOpenCreateModal()}
            style={{ marginTop: '18px' }}
          >
            <Plus size={16} />
            <span>Tạo quy tắc đầu tiên</span>
          </button>
        </div>
      ) : (
        <div className="automation-rules-list">
          {rules.map((rule) => (
            <div
              key={rule._id}
              className={`automation-rule-card ${!rule.isActive ? 'is-inactive' : ''}`}
            >
              <div className="rule-header">
                <div className="rule-title-wrap">
                  {/* Switch Toggle */}
                  <label className="switch-toggle" title={rule.isActive ? 'Đang bật' : 'Đang tắt'}>
                    <input
                      type="checkbox"
                      checked={rule.isActive}
                      onChange={(e) => handleToggle(rule._id, e)}
                    />
                    <span className="switch-slider" />
                  </label>

                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span className="rule-name">{rule.name}</span>
                      {rule.isActive ? (
                        <span className="badge badge-emerald" style={{ fontSize: '0.6875rem' }}>Đang bật</span>
                      ) : (
                        <span className="badge badge-slate" style={{ fontSize: '0.6875rem' }}>Đã tắt</span>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                      {getTriggerBadge(rule.trigger?.type)}
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        Độ ưu tiên: {rule.priority || 0}
                      </span>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button
                    className="btn-icon"
                    title="Chỉnh sửa quy tắc"
                    onClick={() => handleOpenEditModal(rule)}
                  >
                    <Edit2 size={16} />
                  </button>
                  <button
                    className="btn-icon text-danger"
                    title="Xóa quy tắc"
                    onClick={() => handleDelete(rule._id)}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              {/* Conditions & Actions Pipeline View */}
              <div className="rule-flow">
                {/* Điều kiện */}
                <div className="rule-flow-step">
                  <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Điều kiện:</span>
                  {rule.conditions && rule.conditions.length > 0 ? (
                    rule.conditions.map((c, i) => (
                      <span key={i} className="badge badge-slate" style={{ fontSize: '0.75rem' }}>
                        {formatConditionText(c)}
                      </span>
                    ))
                  ) : (
                    <span className="badge badge-slate" style={{ fontSize: '0.75rem' }}>
                      Áp dụng cho tất cả tệp
                    </span>
                  )}
                </div>

                <ArrowRight size={14} className="rule-flow-arrow" />

                {/* Hành động */}
                <div className="rule-flow-step" style={{ flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Hành động:</span>
                  {rule.actions?.map((act, i) => {
                    if (act.type === 'MOVE_FILE') {
                      return (
                        <span key={i} className="badge badge-blue" style={{ fontSize: '0.75rem' }}>
                          <Folder size={11} />
                          <span>Chuyển vào {act.targetFolderId?.name || 'thư mục đích'}</span>
                        </span>
                      );
                    }
                    if (act.type === 'ADD_TAG') {
                      return (
                        <span key={i} className="badge badge-cyan" style={{ fontSize: '0.75rem' }}>
                          <Tag size={11} />
                          <span>Gắn tag #{act.value}</span>
                        </span>
                      );
                    }
                    if (act.type === 'STAR_FILE') {
                      return (
                        <span key={i} className="badge badge-yellow" style={{ fontSize: '0.75rem' }}>
                          <Star size={11} />
                          <span>Gắn sao</span>
                        </span>
                      );
                    }
                    if (act.type === 'RENAME_FILE') {
                      return (
                        <span key={i} className="badge badge-purple" style={{ fontSize: '0.75rem' }}>
                          <Edit2 size={11} />
                          <span>Đổi tên: {act.newName || act.value}</span>
                        </span>
                      );
                    }
                    if (act.type === 'NOTIFY') {
                      return (
                        <span key={i} className="badge badge-slate" style={{ fontSize: '0.75rem' }}>
                          <Bell size={11} />
                          <span>Gửi thông báo</span>
                        </span>
                      );
                    }
                    if (act.type === 'CREATE_VERSION') {
                      return (
                        <span key={i} className="badge badge-slate" style={{ fontSize: '0.75rem' }}>
                          <History size={11} />
                          <span>Tạo phiên bản</span>
                        </span>
                      );
                    }
                    return null;
                  })}
                </div>
              </div>

              {/* Footer */}
              <div className="rule-footer">
                <div>
                  Đã thực thi: <strong>{rule.runCount || 0} lần</strong>
                </div>
                <div>
                  {rule.lastRunAt
                    ? `Chạy lần cuối: ${new Date(rule.lastRunAt).toLocaleString('vi-VN')}`
                    : 'Chưa từng kích hoạt'}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Tạo / Chỉnh sửa Quy tắc */}
      {modalOpen && (
        <div
          className="modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) setModalOpen(false);
          }}
        >
          <div className="modal-card modal-lg" role="dialog" aria-modal="true">
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Zap size={20} className="text-primary" />
                <h3 className="modal-title">
                  {editingRuleId ? 'Chỉnh sửa quy tắc' : 'Tạo quy tắc tự động hóa mới'}
                </h3>
              </div>
              <button className="btn-icon" onClick={() => setModalOpen(false)}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveRule} className="modal-body">
              <div className="rule-modal-form">
                {/* Tên quy tắc & Độ ưu tiên */}
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px' }}>
                  <div className="form-group">
                    <label className="form-label">Tên quy tắc *</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="vd: Tự động phân loại Hợp đồng"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Độ ưu tiên</label>
                    <input
                      type="number"
                      className="form-input"
                      value={formData.priority}
                      onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value, 10) || 0 })}
                    />
                    <span className="form-sublabel">Số lớn hơn sẽ chạy trước</span>
                  </div>
                </div>

                {/* Sự kiện kích hoạt (Trigger) */}
                <div className="form-group">
                  <label className="form-label">Khi sự kiện xảy ra (Trigger) *</label>
                  <select
                    className="form-select"
                    value={formData.trigger.type}
                    onChange={(e) => setFormData({ ...formData, trigger: { type: e.target.value } })}
                  >
                    {TRIGGER_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label} — {opt.desc}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Danh sách điều kiện (AND) */}
                <div className="rule-builder-block">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <label className="form-label" style={{ margin: 0 }}>
                      Và thỏa mãn tất cả điều kiện sau (AND):
                    </label>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={handleAddCondition}
                    >
                      <Plus size={14} />
                      <span>Thêm điều kiện</span>
                    </button>
                  </div>

                  {formData.conditions.length === 0 ? (
                    <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                      Không có điều kiện: Quy tắc sẽ luôn chạy khi sự kiện trên xảy ra.
                    </div>
                  ) : (
                    formData.conditions.map((cond, idx) => (
                      <div key={idx} className="builder-item-row">
                        <select
                          className="form-select"
                          value={cond.field}
                          onChange={(e) => handleUpdateCondition(idx, 'field', e.target.value)}
                        >
                          {CONDITION_FIELDS.map((f) => (
                            <option key={f.value} value={f.value}>
                              {f.label}
                            </option>
                          ))}
                        </select>

                        <select
                          className="form-select"
                          value={cond.operator}
                          onChange={(e) => handleUpdateCondition(idx, 'operator', e.target.value)}
                        >
                          {CONDITION_OPERATORS.map((op) => (
                            <option key={op.value} value={op.value}>
                              {op.label}
                            </option>
                          ))}
                        </select>

                        {cond.field === 'aiCategory' ? (
                          <select
                            className="form-select"
                            value={cond.value}
                            onChange={(e) => handleUpdateCondition(idx, 'value', e.target.value)}
                          >
                            {AI_CATEGORIES.map((cat) => (
                              <option key={cat} value={cat}>
                                {cat}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <input
                            type="text"
                            className="form-input"
                            placeholder="Giá trị so sánh..."
                            value={cond.value}
                            onChange={(e) => handleUpdateCondition(idx, 'value', e.target.value)}
                          />
                        )}

                        <button
                          type="button"
                          className="btn-icon text-danger"
                          onClick={() => handleRemoveCondition(idx)}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))
                  )}
                </div>

                {/* Danh sách hành động (Actions) */}
                <div className="rule-builder-block">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <label className="form-label" style={{ margin: 0 }}>
                      Thực thi các hành động sau:
                    </label>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={handleAddAction}
                    >
                      <Plus size={14} />
                      <span>Thêm hành động</span>
                    </button>
                  </div>

                  {formData.actions.map((act, idx) => (
                    <div key={idx} className="builder-item-row">
                      <select
                        className="form-select"
                        value={act.type}
                        onChange={(e) => handleUpdateAction(idx, 'type', e.target.value)}
                      >
                        {ACTION_TYPES.map((a) => (
                          <option key={a.value} value={a.value}>
                            {a.label}
                          </option>
                        ))}
                      </select>

                      {act.type === 'MOVE_FILE' && (
                        <select
                          className="form-select"
                          value={act.targetFolderId || ''}
                          onChange={(e) => handleUpdateAction(idx, 'targetFolderId', e.target.value)}
                        >
                          <option value="">-- Thư mục gốc (Drive của tôi) --</option>
                          {flatFolderList.map((f) => (
                            <option key={f._id} value={f._id}>
                              📁 {f.name}
                            </option>
                          ))}
                        </select>
                      )}

                      {act.type === 'ADD_TAG' && (
                        <input
                          type="text"
                          className="form-input"
                          placeholder="Nhập tên tag..."
                          value={act.value || ''}
                          onChange={(e) => handleUpdateAction(idx, 'value', e.target.value)}
                        />
                      )}

                      {act.type === 'RENAME_FILE' && (
                        <input
                          type="text"
                          className="form-input"
                          placeholder="Tên mới hoặc {{aiSuggestedName}}"
                          value={act.newName || act.value || ''}
                          onChange={(e) => {
                            handleUpdateAction(idx, 'newName', e.target.value);
                            handleUpdateAction(idx, 'value', e.target.value);
                          }}
                        />
                      )}

                      {act.type === 'NOTIFY' && (
                        <input
                          type="text"
                          className="form-input"
                          placeholder="Nội dung thông báo tùy chỉnh..."
                          value={act.value || ''}
                          onChange={(e) => handleUpdateAction(idx, 'value', e.target.value)}
                        />
                      )}

                      {act.type === 'STAR_FILE' && (
                        <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                          Tự động gắn sao vàng cho tệp tin
                        </div>
                      )}

                      {act.type === 'CREATE_VERSION' && (
                        <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                          Tự động tạo bản sao lưu trạng thái trước khi thay đổi
                        </div>
                      )}

                      <button
                        type="button"
                        className="btn-icon text-danger"
                        onClick={() => handleRemoveAction(idx)}
                        disabled={formData.actions.length <= 1}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="modal-footer" style={{ marginTop: '20px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setModalOpen(false)}
                >
                  Hủy bỏ
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Đang lưu...' : editingRuleId ? 'Cập nhật quy tắc' : 'Tạo quy tắc'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AutomationPage;
