import { useEffect, useState } from 'react';
import { vehiclesApi } from '../../services/resources';
import DataTable from '../../components/DataTable';
import Pagination from '../../components/Pagination';
import Modal from '../../components/Modal';
import ConfirmDialog from '../../components/ConfirmDialog';
import StatusBadge from '../../components/StatusBadge';
import Loading from '../../components/Loading';

const STATUSES = ['AVAILABLE', 'ASSIGNED', 'IN_TRIP', 'MAINTENANCE', 'INACTIVE'];
const VEHICLE_TYPES = ['Sedan', 'SUV', 'Pickup', 'Van', 'Bus', 'Truck', 'Other'];
const FUEL_TYPES = ['Diesel', 'Petrol', 'Electric', 'Hybrid'];

const EMPTY_FORM = {
  registrationNumber: '',
  model: '',
  type: '',
  fuelType: 'Diesel',
  fuelConsumptionKmPerLitre: '',
  currentOdometer: '',
  serviceDate: '',
  insuranceExpiry: '',
  notes: '',
};

export default function Vehicles() {
  const [data, setData] = useState(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [apiError, setApiError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = () => vehiclesApi.list({ page, limit: 10, search, status: statusFilter || undefined }).then(setData);
  useEffect(() => { load(); }, [page, search, statusFilter]);

  const validate = () => {
    const e = {};
    if (!form.registrationNumber.trim()) e.registrationNumber = 'Registration number is required';
    if (!form.model.trim()) e.model = 'Model is required';
    if (!form.type) e.type = 'Vehicle type is required';
    if (!form.fuelType) e.fuelType = 'Fuel type is required';
    if (!form.fuelConsumptionKmPerLitre || Number(form.fuelConsumptionKmPerLitre) <= 0) e.fuelConsumptionKmPerLitre = 'Enter valid KM/L';
    if (form.currentOdometer === '' || Number(form.currentOdometer) < 0) e.currentOdometer = 'Enter valid odometer';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setErrors({});
    setApiError('');
    setModalOpen(true);
  };

  const openEdit = (v) => {
    setEditing(v);
    setForm({
      registrationNumber: v.registrationNumber || '',
      model: v.model || '',
      type: v.type || '',
      fuelType: v.fuelType || 'Diesel',
      fuelConsumptionKmPerLitre: v.fuelConsumptionKmPerLitre || '',
      currentOdometer: v.currentOdometer || '',
      serviceDate: v.serviceDate || '',
      insuranceExpiry: v.insuranceExpiry || '',
      notes: v.notes || '',
    });
    setErrors({});
    setApiError('');
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    setApiError('');
    try {
      const payload = {
        ...form,
        fuelConsumptionKmPerLitre: Number(form.fuelConsumptionKmPerLitre),
        currentOdometer: Number(form.currentOdometer),
      };
      if (editing) {
        await vehiclesApi.update(editing.id, payload);
      } else {
        await vehiclesApi.create(payload);
      }
      setModalOpen(false);
      load();
    } catch (err) {
      setApiError(err.response?.data?.message || 'Failed to save vehicle.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      await vehiclesApi.remove(confirmDelete.id);
      setConfirmDelete(null);
      load();
    } catch (err) {
      setApiError(err.response?.data?.message || 'Failed to delete vehicle.');
    }
  };

  if (!data) return <Loading />;

  const vehicles = data?.data || data?.rows || (Array.isArray(data) ? data : []);
  const total = data?.total || data?.count || vehicles.length;

  return (
    <div>
      <div className="hero-strip">
        <div>
          <span className="eyebrow">TRANSPORT OFFICER</span>
          <h2>Vehicle Management</h2>
          <p>Add, edit, and manage the organization's vehicle fleet.</p>
        </div>
        <button className="btn btn-primary" onClick={openCreate}>+ Add Vehicle</button>
      </div>

      <div className="panel">
        <div className="filters-row">
          <input
            className="input"
            placeholder="Search by registration or model..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
          <select className="input select-inline" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
            <option value="">All Statuses</option>
            {STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
          </select>
        </div>

        {apiError && <div className="callout callout-error">{apiError}</div>}

        <DataTable
          columns={[
            { key: 'registrationNumber', header: 'Registration' },
            { key: 'model', header: 'Model' },
            { key: 'type', header: 'Type' },
            { key: 'fuelType', header: 'Fuel' },
            { key: 'fuelConsumptionKmPerLitre', header: 'KM/L' },
            { key: 'currentOdometer', header: 'Odometer' },
            { key: 'status', header: 'Status', render: (v) => <StatusBadge status={v.status} /> },
            { key: 'actions', header: '', render: (v) => (
              <div className="row-actions">
                <button className="link-btn" onClick={() => openEdit(v)}>Edit</button>
                <select className="input select-compact" value={v.status} onChange={async (e) => { await vehiclesApi.setStatus(v.id, e.target.value); load(); }}>
                  {STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
                </select>
                <button className="link-btn danger" onClick={() => setConfirmDelete(v)}>Delete</button>
              </div>
            ) },
          ]}
          rows={vehicles}
          emptyMessage="No vehicles found. Click 'Add Vehicle' to register one."
        />
        {total > 10 && <Pagination page={data.page || page} limit={data.limit || 10} total={total} onChange={setPage} />}
      </div>

      <Modal
        open={modalOpen}
        title={editing ? 'Edit Vehicle' : 'Add Vehicle'}
        onClose={() => setModalOpen(false)}
        footer={<>
          <button className="btn btn-ghost" onClick={() => setModalOpen(false)} disabled={saving}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : (editing ? 'Update' : 'Add Vehicle')}
          </button>
        </>}
      >
        <div className="form-grid">
          <div className="form-row two-col">
            <div>
              <label className="field-label">Registration Number *</label>
              <input className="input" value={form.registrationNumber} onChange={(e) => setForm({ ...form, registrationNumber: e.target.value })} placeholder="e.g. UN-001" />
              {errors.registrationNumber && <div className="form-error">{errors.registrationNumber}</div>}
            </div>
            <div>
              <label className="field-label">Model *</label>
              <input className="input" value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} placeholder="e.g. Toyota Land Cruiser" />
              {errors.model && <div className="form-error">{errors.model}</div>}
            </div>
          </div>
          <div className="form-row two-col">
            <div>
              <label className="field-label">Vehicle Type *</label>
              <select className="input" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                <option value="">Select type</option>
                {VEHICLE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              {errors.type && <div className="form-error">{errors.type}</div>}
            </div>
            <div>
              <label className="field-label">Fuel Type *</label>
              <select className="input" value={form.fuelType} onChange={(e) => setForm({ ...form, fuelType: e.target.value })}>
                {FUEL_TYPES.map((ft) => <option key={ft} value={ft}>{ft}</option>)}
              </select>
            </div>
          </div>
          <div className="form-row two-col">
            <div>
              <label className="field-label">Fuel Consumption (KM/L) *</label>
              <input className="input" type="number" step="0.1" min="0" value={form.fuelConsumptionKmPerLitre} onChange={(e) => setForm({ ...form, fuelConsumptionKmPerLitre: e.target.value })} placeholder="e.g. 12.5" />
              {errors.fuelConsumptionKmPerLitre && <div className="form-error">{errors.fuelConsumptionKmPerLitre}</div>}
            </div>
            <div>
              <label className="field-label">Current Odometer (KM) *</label>
              <input className="input" type="number" min="0" value={form.currentOdometer} onChange={(e) => setForm({ ...form, currentOdometer: e.target.value })} placeholder="e.g. 45000" />
              {errors.currentOdometer && <div className="form-error">{errors.currentOdometer}</div>}
            </div>
          </div>
          <div className="form-row two-col">
            <div>
              <label className="field-label">Last Service Date</label>
              <input className="input" type="date" value={form.serviceDate || ''} onChange={(e) => setForm({ ...form, serviceDate: e.target.value })} />
            </div>
            <div>
              <label className="field-label">Insurance Expiry</label>
              <input className="input" type="date" value={form.insuranceExpiry || ''} onChange={(e) => setForm({ ...form, insuranceExpiry: e.target.value })} />
            </div>
          </div>
          <div className="form-row">
            <label className="field-label">Notes</label>
            <textarea className="input" rows={2} value={form.notes || ''} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Optional notes about the vehicle" />
          </div>
          {apiError && <div className="form-error">{apiError}</div>}
        </div>
      </Modal>

      <ConfirmDialog
        open={!!confirmDelete}
        title="Delete Vehicle"
        message={`Are you sure you want to delete ${confirmDelete?.registrationNumber} (${confirmDelete?.model})? This cannot be undone.`}
        danger
        confirmLabel="Delete"
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
}
