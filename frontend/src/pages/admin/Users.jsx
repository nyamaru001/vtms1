import { useEffect, useState } from 'react';
import { adminApi } from '../../services/resources';
import DataTable from '../../components/DataTable';
import StatusBadge from '../../components/StatusBadge';
import Modal from '../../components/Modal';
import Loading from '../../components/Loading';
import Pagination from '../../components/Pagination';

const ROLES = ['ADMIN', 'OFFICER', 'DRIVER', 'TRANSPORT_OFFICER', 'R3', 'HPMU'];
const STATUSES = ['ACTIVE', 'INACTIVE'];

export default function AdminUsers() {
  const [data, setData] = useState(null);
  const [page, setPage] = useState(1);
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [form, setForm] = useState({
    fullName: '',
    username: '',
    email: '',
    phone: '',
    role: 'OFFICER',
    password: '',
    confirmPassword: '',
  });
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');
  const [saving, setSaving] = useState(false);

  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [resetUser, setResetUser] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetError, setResetError] = useState('');
  const [resetting, setResetting] = useState(false);

  const loadUsers = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await adminApi.users.list({
        page,
        limit: 20,
        role: roleFilter || undefined,
        status: statusFilter || undefined,
        search: search || undefined,
      });
      setData(response);
    } catch (err) {
      console.error('Failed to load users:', err);
      setError(err.response?.data?.message || 'Failed to load users.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, [page, roleFilter, statusFilter, search]);

  const openCreateModal = () => {
    setEditingUser(null);
    setForm({
      fullName: '',
      username: '',
      email: '',
      phone: '',
      role: 'OFFICER',
      password: '',
      confirmPassword: '',
    });
    setFormError('');
    setModalOpen(true);
  };

  const openEditModal = (user) => {
    setEditingUser(user);
    setForm({
      fullName: user.fullName || '',
      username: user.username || '',
      email: user.email || '',
      phone: user.phone || '',
      role: user.role || 'OFFICER',
      password: '',
      confirmPassword: '',
    });
    setFormError('');
    setModalOpen(true);
  };

  const closeModal = () => {
    if (saving) return;
    setModalOpen(false);
    setEditingUser(null);
    setFormError('');
    setFormSuccess('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');

    if (!form.fullName.trim() || !form.username.trim() || !form.role) {
      setFormError('Full name, username, and role are required.');
      return;
    }

    if (editingUser) {
      if (form.password && form.password !== form.confirmPassword) {
        setFormError('Passwords do not match.');
        return;
      }
      if (form.password && form.password.length < 6) {
        setFormError('Password must be at least 6 characters.');
        return;
      }
    } else {
      if (!form.password) {
        setFormError('Password is required for new users.');
        return;
      }
      if (form.password !== form.confirmPassword) {
        setFormError('Passwords do not match.');
        return;
      }
      if (form.password.length < 6) {
        setFormError('Password must be at least 6 characters.');
        return;
      }
    }

    try {
      setSaving(true);
      const payload = {
        fullName: form.fullName.trim(),
        username: form.username.trim(),
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        role: form.role,
      };
      if (form.password) {
        payload.password = form.password;
      }

      if (editingUser) {
        await adminApi.users.update(editingUser.id, payload);
      } else {
        await adminApi.users.create(payload);
      }

      setFormSuccess(editingUser ? 'User updated successfully!' : 'User created successfully!');
      await loadUsers();
      setTimeout(() => {
        closeModal();
      }, 1200);
    } catch (err) {
      const msg = err.response?.data?.message || err.response?.data?.error || 'Failed to save user.';
      setFormError(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (user, newStatus) => {
    if (!window.confirm(`Set ${user.username} to ${newStatus}?`)) return;
    try {
      await adminApi.users.setStatus(user.id, newStatus);
      await loadUsers();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update status.');
    }
  };

  const openResetModal = (user) => {
    setResetUser(user);
    setNewPassword('');
    setResetError('');
    setResetModalOpen(true);
  };

  const closeResetModal = () => {
    if (resetting) return;
    setResetModalOpen(false);
    setResetUser(null);
    setNewPassword('');
    setConfirmPassword('');
    setResetError('');
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setResetError('');

    if (!newPassword || newPassword.length < 6) {
      setResetError('Password must be at least 6 characters.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setResetError('Passwords do not match.');
      return;
    }

    try {
      setResetting(true);
      await adminApi.users.resetPassword(resetUser.id, newPassword);
      closeResetModal();
    } catch (err) {
      setResetError(err.response?.data?.message || 'Failed to reset password.');
    } finally {
      setResetting(false);
    }
  };

  const handleDelete = async (user) => {
    if (!window.confirm(`Delete user ${user.username}? This cannot be undone.`)) return;
    try {
      await adminApi.users.remove(user.id);
      await loadUsers();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete user.');
    }
  };

  if (loading && !data) return <Loading />;

  const rows = Array.isArray(data?.data) ? data.data : [];

  return (
    <div className="panel">
      <div className="panel-header">
        <h3>User Management</h3>
        <button className="btn btn-primary" onClick={openCreateModal}>
          + Add User
        </button>
      </div>

      <div className="filter-bar">
        <input
          className="input"
          placeholder="Search name, username, email..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
        />
        <select className="input select-inline" value={roleFilter} onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}>
          <option value="">All Roles</option>
          {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        <select className="input select-inline" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
          <option value="">All Statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <DataTable
        columns={[
          { key: 'username', header: 'Username', render: (u) => <strong>{u.username}</strong> },
          { key: 'fullName', header: 'Full Name', render: (u) => u.fullName },
          { key: 'email', header: 'Email', render: (u) => u.email || '—' },
          { key: 'phone', header: 'Phone', render: (u) => u.phone || '—' },
          { key: 'role', header: 'Role', render: (u) => <StatusBadge status={u.role} /> },
          { key: 'status', header: 'Status', render: (u) => <StatusBadge status={u.status} /> },
          {
            key: 'actions', header: 'Actions', render: (u) => (
              <div className="row-actions">
                <button className="link-btn" onClick={() => openEditModal(u)}>Edit</button>
                <button className="link-btn" onClick={() => openResetModal(u)}>Reset Password</button>
                <button
                  className="link-btn"
                  onClick={() => handleStatusChange(u, u.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE')}
                >
                  {u.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                </button>
                {u.role !== 'ADMIN' && (
                  <button className="link-btn danger" onClick={() => handleDelete(u)}>Delete</button>
                )}
              </div>
            ),
          },
        ]}
        rows={rows}
        emptyMessage="No users found."
      />

      {data && (
        <Pagination
          page={data.page || page}
          limit={data.limit || 20}
          total={data.total || 0}
          onChange={setPage}
        />
      )}

      <Modal open={modalOpen} title={editingUser ? 'Edit User' : 'Create User'} onClose={closeModal}
        footer={
          <>
            <button className="btn btn-ghost" type="button" onClick={closeModal} disabled={saving}>Cancel</button>
            <button className="btn btn-primary" type="button" onClick={handleSubmit} disabled={saving}>
              {saving ? 'Saving...' : editingUser ? 'Update' : 'Create User'}
            </button>
          </>
        }
      >
        <form onSubmit={handleSubmit}>
          {formError && <div className="alert alert-error">{formError}</div>}
          {formSuccess && <div className="alert alert-success">{formSuccess}</div>}
          <div className="form-grid">
            <div>
              <label className="field-label">Full Name *</label>
              <input className="input" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} required />
            </div>
            <div>
              <label className="field-label">Username *</label>
              <input className="input" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} required disabled={!!editingUser} />
            </div>
            <div>
              <label className="field-label">Email</label>
              <input className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div>
              <label className="field-label">Phone</label>
              <input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div>
              <label className="field-label">Role *</label>
              <select className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label className="field-label">{editingUser ? 'New Password (leave blank to keep current)' : 'Password *'} </label>
              <input className="input" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required={!editingUser} />
            </div>
            <div>
              <label className="field-label">Confirm Password *</label>
              <input className="input" type="password" value={form.confirmPassword} onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })} required={!editingUser} />
            </div>
          </div>
        </form>
      </Modal>

      <Modal open={resetModalOpen} title={`Reset Password: ${resetUser?.username}`} onClose={closeResetModal}
        footer={
          <>
            <button className="btn btn-ghost" type="button" onClick={closeResetModal} disabled={resetting}>Cancel</button>
            <button className="btn btn-danger" type="button" onClick={handleResetPassword} disabled={resetting}>
              {resetting ? 'Resetting...' : 'Reset Password'}
            </button>
          </>
        }
      >
        <form onSubmit={handleResetPassword}>
          {resetError && <div className="alert alert-error">{resetError}</div>}
          <div>
            <label className="field-label">New Password *</label>
            <input className="input" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required minLength={6} autoFocus />
          </div>
          <div>
            <label className="field-label">Confirm Password *</label>
            <input className="input" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required minLength={6} />
          </div>
        </form>
      </Modal>
    </div>
  );
}