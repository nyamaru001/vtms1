import { useEffect, useState } from 'react';
import { adminApi } from '../../services/resources';
import DataTable from '../../components/DataTable';
import StatusBadge from '../../components/StatusBadge';
import Modal from '../../components/Modal';
import Loading from '../../components/Loading';
import Pagination from '../../components/Pagination';

const DRIVER_STATUSES = ['AVAILABLE', 'ASSIGNED', 'ON_TRIP', 'INACTIVE'];

export default function AdminDrivers() {
  const [data, setData] = useState(null);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editingDriver, setEditingDriver] = useState(null);
  const [form, setForm] = useState({
    licenseNumber: '',
    licenseExpiry: '',
    status: 'AVAILABLE',
  });
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const loadDrivers = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await adminApi.drivers.list({
        page,
        limit: 20,
        status: statusFilter || undefined,
        search: search || undefined,
      });
      setData(response);
    } catch (err) {
      console.error('Failed to load drivers:', err);
      setError(err.response?.data?.message || 'Failed to load drivers.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDrivers();
  }, [page, statusFilter, search]);

  const openEditModal = (driver) => {
    setEditingDriver(driver);
    setForm({
      licenseNumber: driver.licenseNumber || '',
      licenseExpiry: driver.licenseExpiry ? driver.licenseExpiry.split('T')[0] : '',
      status: driver.status || 'AVAILABLE',
    });
    setFormError('');
    setModalOpen(true);
  };

  const closeModal = () => {
    if (saving) return;
    setModalOpen(false);
    setEditingDriver(null);
    setFormError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!form.licenseNumber.trim()) {
      setFormError('License number is required.');
      return;
    }

    try {
      setSaving(true);
      await adminApi.drivers.update(editingDriver.id, {
        licenseNumber: form.licenseNumber.trim(),
        licenseExpiry: form.licenseExpiry || null,
        status: form.status,
      });
      closeModal();
      await loadDrivers();
    } catch (err) {
      setFormError(err.response?.data?.message || 'Failed to update driver.');
    } finally {
      setSaving(false);
    }
  };

  if (loading && !data) return <Loading />;

  const rows = Array.isArray(data?.data) ? data.data : [];

  return (
    <div className="panel">
      <div className="panel-header">
        <h3>Driver Management</h3>
      </div>

      <div className="filter-bar">
        <input
          className="input"
          placeholder="Search driver name, license..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
        />
        <select className="input select-inline" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
          <option value="">All Statuses</option>
          {DRIVER_STATUSES.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
        </select>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <DataTable
        columns={[
          { key: 'id', header: 'ID', render: (d) => d.id },
          { key: 'user', header: 'Driver', render: (d) => d.user?.fullName || '—' },
          { key: 'username', header: 'Username', render: (d) => d.user?.username || '—' },
          { key: 'phone', header: 'Phone', render: (d) => d.user?.phone || '—' },
          { key: 'licenseNumber', header: 'License #', render: (d) => d.licenseNumber },
          { key: 'licenseExpiry', header: 'License Expiry', render: (d) => d.licenseExpiry ? d.licenseExpiry.split('T')[0] : '—' },
          { key: 'status', header: 'Status', render: (d) => <StatusBadge status={d.status} /> },
          { key: 'assignedVehicle', header: 'Assigned Vehicle', render: (d) => d.assignedVehicle?.registrationNumber || '—' },
          {
            key: 'actions', header: 'Actions', render: (d) => (
              <button className="link-btn" onClick={() => openEditModal(d)}>Edit</button>
            ),
          },
        ]}
        rows={rows}
        emptyMessage="No drivers found."
      />

      {data && (
        <Pagination
          page={data.page || page}
          limit={data.limit || 20}
          total={data.total || 0}
          onChange={setPage}
        />
      )}

      <Modal open={modalOpen} title="Edit Driver" onClose={closeModal}
        footer={
          <>
            <button className="btn btn-ghost" onClick={closeModal} disabled={saving}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSubmit} disabled={saving}>
              {saving ? 'Saving...' : 'Update Driver'}
            </button>
          </>
        }
      >
        <form onSubmit={handleSubmit}>
          {formError && <div className="form-error">{formError}</div>}
          <div className="form-grid">
            <div>
              <label className="field-label">License Number *</label>
              <input className="input" value={form.licenseNumber} onChange={(e) => setForm({ ...form, licenseNumber: e.target.value })} required />
            </div>
            <div>
              <label className="field-label">License Expiry</label>
              <input className="input" type="date" value={form.licenseExpiry} onChange={(e) => setForm({ ...form, licenseExpiry: e.target.value })} />
            </div>
            <div>
              <label className="field-label">Status</label>
              <select className="input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                {DRIVER_STATUSES.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
              </select>
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
}
