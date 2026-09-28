import { useEffect, useState } from 'react';
import { usersApi } from '../../services/resources';
import DataTable from '../../components/DataTable';
import Pagination from '../../components/Pagination';
import Modal from '../../components/Modal';
import ConfirmDialog from '../../components/ConfirmDialog';
import Loading from '../../components/Loading';

const ROLES = ['OFFICER', 'DRIVER', 'TRANSPORT_OFFICER', 'R3', 'HPMU'];
const EMPTY_FORM = { fullName: '', username: '', email: '', phone: '', role: 'OFFICER', password: '', licenseNumber: '', licenseExpiry: '' };

export default function Users() {
  const [data, setData] = useState(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [resetTarget, setResetTarget] = useState(null);
  const [newPassword, setNewPassword] = useState('');

  const load = () => usersApi.list({ page, limit: 10, search, role: roleFilter || undefined }).then(setData);
  useEffect(() => { load(); }, [page, search, roleFilter]);

  const openCreate = () => { setEditingUser(null); setForm(EMPTY_FORM); setError(''); setModalOpen(true); };
  const openEdit = (u) => { setEditingUser(u); setForm({ ...EMPTY_FORM, ...u }); setError(''); setModalOpen(true); };

  const handleSave = async () => {
    setError('');
    try {
      if (editingUser) {
        await usersApi.update(editingUser.id, form);
      } else {
        await usersApi.create(form);
      }
      setModalOpen(false);
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save user.');
    }
  };

  const toggleStatus = async (u) => {
    await usersApi.setStatus(u.id, u.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE');
    load();
  };

  const handleDelete = async () => {
    await usersApi.remove(confirmDelete.id);
    setConfirmDelete(null);
    load();
  };

  const handleResetPassword = async () => {
    await usersApi.resetPassword(resetTarget.id, newPassword);
    setResetTarget(null);
    setNewPassword('');
  };

  if (!data) return <Loading />;

  return (
    <div className="panel">
      <div className="panel-header">
        <h3>User Management</h3>
        <button className="btn btn-primary" onClick={openCreate}>Add User</button>
      </div>

      <div className="filters-row">
        <input className="input" placeholder="Search by name, username, email..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        <select className="input select-inline" value={roleFilter} onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}>
          <option value="">All roles</option>
          {ROLES.map((r) => <option key={r} value={r}>{r.replace('_', ' ')}</option>)}
        </select>
      </div>

      <DataTable
        columns={[
          { key: 'fullName', header: 'Name' },
          { key: 'username', header: 'Username' },
          { key: 'role', header: 'Role', render: (u) => u.role.replace('_', ' ') },
          { key: 'status', header: 'Status' },
          { key: 'actions', header: '', render: (u) => (
            <div className="row-actions">
              <button className="link-btn" onClick={() => openEdit(u)}>Edit</button>
              <button className="link-btn" onClick={() => toggleStatus(u)}>{u.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}</button>
              <button className="link-btn" onClick={() => setResetTarget(u)}>Reset Password</button>
              <button className="link-btn danger" onClick={() => setConfirmDelete(u)}>Delete</button>
            </div>
          ) },
        ]}
        rows={data.data}
      />
      <Pagination page={data.page} limit={data.limit} total={data.total} onChange={setPage} />

      <Modal
        open={modalOpen}
        title={editingUser ? 'Edit User' : 'Add User'}
        onClose={() => setModalOpen(false)}
        footer={<>
          <button className="btn btn-ghost" onClick={() => setModalOpen(false)}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave}>Save</button>
        </>}
      >
        <div className="form-grid">
          <div className="form-row two-col">
            <div><label className="field-label">Full Name</label><input className="input" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} /></div>
            <div><label className="field-label">Username</label><input className="input" value={form.username} disabled={!!editingUser} onChange={(e) => setForm({ ...form, username: e.target.value })} /></div>
          </div>
          <div className="form-row two-col">
            <div><label className="field-label">Email</label><input className="input" value={form.email || ''} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            <div><label className="field-label">Phone</label><input className="input" value={form.phone || ''} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
          </div>
          <div className="form-row two-col">
            <div>
              <label className="field-label">Role</label>
              <select className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                {ROLES.map((r) => <option key={r} value={r}>{r.replace('_', ' ')}</option>)}
              </select>
            </div>
            {!editingUser && (
              <div><label className="field-label">Password</label><input className="input" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></div>
            )}
          </div>
          {!editingUser && form.role === 'DRIVER' && (
            <div className="form-row two-col">
              <div><label className="field-label">License Number</label><input className="input" value={form.licenseNumber} onChange={(e) => setForm({ ...form, licenseNumber: e.target.value })} /></div>
              <div><label className="field-label">License Expiry</label><input className="input" type="date" value={form.licenseExpiry} onChange={(e) => setForm({ ...form, licenseExpiry: e.target.value })} /></div>
            </div>
          )}
          {error && <div className="form-error">{error}</div>}
        </div>
      </Modal>

      <ConfirmDialog
        open={!!confirmDelete}
        title="Delete user"
        message={`Delete ${confirmDelete?.fullName}? This cannot be undone.`}
        danger
        confirmLabel="Delete"
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(null)}
      />

      <Modal
        open={!!resetTarget}
        title={`Reset password for ${resetTarget?.fullName || ''}`}
        onClose={() => setResetTarget(null)}
        footer={<>
          <button className="btn btn-ghost" onClick={() => setResetTarget(null)}>Cancel</button>
          <button className="btn btn-primary" onClick={handleResetPassword}>Reset</button>
        </>}
      >
        <label className="field-label">New Password</label>
        <input className="input" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
      </Modal>
    </div>
  );
}
