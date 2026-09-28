import { useEffect, useState } from 'react';
import { driversApi } from '../../services/resources';
import DataTable from '../../components/DataTable';
import Pagination from '../../components/Pagination';
import Modal from '../../components/Modal';
import StatusBadge from '../../components/StatusBadge';
import Loading from '../../components/Loading';

const STATUSES = ['AVAILABLE', 'ASSIGNED', 'ON_TRIP', 'INACTIVE'];

export default function Drivers() {
  const [data, setData] = useState(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ licenseNumber: '', licenseExpiry: '', status: 'AVAILABLE' });

  const load = () => driversApi.list({ page, limit: 10, search, status: statusFilter || undefined }).then(setData);
  useEffect(() => { load(); }, [page, search, statusFilter]);

  const openEdit = (d) => {
    setEditing(d);
    setForm({ licenseNumber: d.licenseNumber, licenseExpiry: d.licenseExpiry || '', status: d.status });
  };

  const handleSave = async () => {
    await driversApi.update(editing.id, form);
    setEditing(null);
    load();
  };

  if (!data) return <Loading />;

  return (
    <div className="panel">
      <div className="panel-header">
        <div>
          <h3>Driver Management</h3>
          <p className="field-hint">Filter by Available to see drivers ready for assignment.</p>
        </div>
      </div>

      <div className="filters-row">
        <input className="input" placeholder="Search by name..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        <select className="input select-inline" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
          <option value="">All statuses</option>
          <option value="AVAILABLE">Available only</option>
          <option value="ASSIGNED">Assigned</option>
          <option value="ON_TRIP">On trip</option>
          <option value="INACTIVE">Inactive</option>
        </select>
      </div>

      <DataTable
        columns={[
          { key: 'name', header: 'Name', render: (d) => d.user?.fullName },
          { key: 'phone', header: 'Phone', render: (d) => d.user?.phone || '—' },
          { key: 'licenseNumber', header: 'License #' },
          { key: 'licenseExpiry', header: 'License Expiry' },
          { key: 'vehicle', header: 'Assigned Vehicle', render: (d) => d.assignedVehicle?.registrationNumber || '—' },
          { key: 'status', header: 'Status', render: (d) => <StatusBadge status={d.status} /> },
          { key: 'actions', header: '', render: (d) => <button className="link-btn" onClick={() => openEdit(d)}>Edit</button> },
        ]}
        rows={data.data}
      />
      <Pagination page={data.page} limit={data.limit} total={data.total} onChange={setPage} />

      <Modal
        open={!!editing}
        title={`Edit Driver — ${editing?.user?.fullName || ''}`}
        onClose={() => setEditing(null)}
        footer={<>
          <button className="btn btn-ghost" onClick={() => setEditing(null)}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave}>Save</button>
        </>}
      >
        <div className="form-grid">
          <div><label className="field-label">License Number</label><input className="input" value={form.licenseNumber} onChange={(e) => setForm({ ...form, licenseNumber: e.target.value })} /></div>
          <div><label className="field-label">License Expiry</label><input className="input" type="date" value={form.licenseExpiry} onChange={(e) => setForm({ ...form, licenseExpiry: e.target.value })} /></div>
          <div>
            <label className="field-label">Status</label>
            <select className="input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
      </Modal>
    </div>
  );
}
