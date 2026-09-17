import React, { useState, useEffect } from 'react';
import { Shield, Search, Edit2, Trash2, CheckCircle, XCircle } from 'lucide-react';
import userService from '../../services/userService';
import Modal from '../../components/common/Modal';
import Pagination from '../../components/common/Pagination';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import { useToast } from '../../contexts/ToastContext';
import { useAuth } from '../../contexts/AuthContext';

const UsersPage = () => {
  const [users, setUsers] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  // Edit Modal State
  const [editUser, setEditUser] = useState(null);
  const [editRole, setEditRole] = useState('user');
  const [editActive, setEditActive] = useState(true);
  const [saving, setSaving] = useState(false);

  // Delete Confirm State
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const toast = useToast();
  const { user: currentUser } = useAuth();

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await userService.getUsers({
        page,
        limit: 10,
        search: search.trim() || undefined
      });
      setUsers(res.data || []);
      setPagination(res.metadata || null);
    } catch (err) {
      console.error('Lỗi khi tải danh sách người dùng:', err);
      toast.error('Không thể tải danh sách người dùng');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [page]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    fetchUsers();
  };

  const openEditModal = (user) => {
    setEditUser(user);
    setEditRole(user.role || 'user');
    setEditActive(user.isActive !== false);
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editUser) return;

    setSaving(true);
    try {
      await userService.updateUser(editUser._id, {
        role: editRole,
        isActive: editActive
      });
      toast.success('Cập nhật người dùng thành công');
      setEditUser(null);
      fetchUsers();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Cập nhật thất bại');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;

    setDeleting(true);
    try {
      await userService.deleteUser(deleteTarget._id);
      toast.success(`Đã xóa người dùng "${deleteTarget.name}"`);
      setDeleteTarget(null);
      fetchUsers();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Xóa người dùng thất bại');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div>
      <div className="drive-action-bar" style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.25rem', fontWeight: 800 }}>
          <Shield size={24} style={{ color: 'var(--primary-600)' }} />
          <span>Quản trị người dùng</span>
        </div>

        <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '8px' }}>
          <div className="search-input-wrapper" style={{ width: '280px', borderRadius: 'var(--radius-md)' }}>
            <Search size={16} style={{ color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Tìm theo tên hoặc email..."
              className="search-input"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button className="btn btn-secondary" type="submit">
            Tìm
          </button>
        </form>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '80px 20px', color: 'var(--text-muted)' }}>
          <span className="spinner" style={{ width: 36, height: 36, margin: '0 auto' }} />
          <div style={{ marginTop: '16px' }}>Đang tải người dùng...</div>
        </div>
      ) : (
        <>
          <div className="file-table-container">
            <table className="file-table">
              <thead>
                <tr>
                  <th style={{ width: '30%' }}>Người dùng</th>
                  <th style={{ width: '20%' }}>Số điện thoại</th>
                  <th style={{ width: '15%' }}>Vai trò</th>
                  <th style={{ width: '15%' }}>Trạng thái</th>
                  <th style={{ width: '10%' }}>Email xác thực</th>
                  <th style={{ width: '10%', textAlign: 'right' }}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u._id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div className="avatar-circle" style={{ width: 32, height: 32, fontSize: '0.8125rem' }}>
                          {(u.name || u.email || 'U')[0].toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{u.name}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td>{u.phone || '-'}</td>
                    <td>
                      <span
                        className={`badge ${
                          u.role === 'admin'
                            ? 'badge-rose'
                            : u.role === 'manager'
                            ? 'badge-amber'
                            : 'badge-blue'
                        }`}
                      >
                        {u.role ? u.role.toUpperCase() : 'USER'}
                      </span>
                    </td>
                    <td>
                      {u.isActive !== false ? (
                        <span className="badge badge-emerald">Hoạt động</span>
                      ) : (
                        <span className="badge badge-slate">Bị khóa</span>
                      )}
                    </td>
                    <td>
                      {u.isEmailVerified ? (
                        <span style={{ color: 'var(--accent-emerald)', display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.8125rem' }}>
                          <CheckCircle size={15} /> Đã xác thực
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.8125rem' }}>
                          <XCircle size={15} /> Chưa
                        </span>
                      )}
                    </td>
                    <td>
                      <div className="table-action-btns" style={{ justifyContent: 'flex-end' }}>
                        <button
                          className="btn-icon"
                          title="Sửa quyền / trạng thái"
                          onClick={() => openEditModal(u)}
                        >
                          <Edit2 size={16} />
                        </button>
                        {currentUser?._id !== u._id && (
                          <button
                            className="btn-icon"
                            title="Xóa người dùng"
                            onClick={() => setDeleteTarget(u)}
                          >
                            <Trash2 size={16} style={{ color: 'var(--accent-rose)' }} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Pagination pagination={pagination} onPageChange={(newPage) => setPage(newPage)} />
        </>
      )}

      {/* Edit User Modal */}
      <Modal
        isOpen={Boolean(editUser)}
        onClose={() => setEditUser(null)}
        title={`Chỉnh sửa: ${editUser?.name}`}
        size="sm"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setEditUser(null)} disabled={saving}>
              Hủy
            </button>
            <button className="btn btn-primary" onClick={handleSaveEdit} disabled={saving}>
              {saving ? <span className="spinner" /> : 'Lưu thay đổi'}
            </button>
          </>
        }
      >
        <form onSubmit={handleSaveEdit}>
          <div className="form-group">
            <label className="form-label">Vai trò (Role)</label>
            <select
              className="form-select"
              value={editRole}
              onChange={(e) => setEditRole(e.target.value)}
            >
              <option value="user">User (Người dùng thông thường)</option>
              <option value="manager">Manager (Quản lý)</option>
              <option value="admin">Admin (Quản trị viên tối cao)</option>
            </select>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Trạng thái tài khoản</label>
            <select
              className="form-select"
              value={editActive ? 'active' : 'inactive'}
              onChange={(e) => setEditActive(e.target.value === 'active')}
            >
              <option value="active">Kích hoạt (Cho phép đăng nhập)</option>
              <option value="inactive">Vô hiệu hóa (Khóa tài khoản)</option>
            </select>
          </div>
        </form>
      </Modal>

      {/* Delete User Confirm */}
      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        title="Xóa tài khoản người dùng?"
        message={`Bạn có chắc chắn muốn xóa vĩnh viễn tài khoản "${deleteTarget?.name}" (${deleteTarget?.email})? Mọi dữ liệu liên quan sẽ bị loại bỏ.`}
        confirmText="Xóa tài khoản"
        isDanger={true}
        loading={deleting}
      />
    </div>
  );
};

export default UsersPage;
