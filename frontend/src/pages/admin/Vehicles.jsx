import { useEffect, useState } from 'react';
import { adminApi } from '../../services/resources';
import DataTable from '../../components/DataTable';
import StatusBadge from '../../components/StatusBadge';
import Loading from '../../components/Loading';
import Pagination from '../../components/Pagination';

const VEHICLE_STATUSES = ['AVAILABLE', 'ASSIGNED', 'IN_TRIP', 'MAINTENANCE', 'INACTIVE'];

export default function AdminVehicles() {
  const [data, setData] = useState(null);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadVehicles = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await adminApi.vehicles.list({
        page,
        limit: 20,
        status: statusFilter || undefined,
        search: search || undefined,
      });
      setData(response);
    } catch (err) {
      console.error('Failed to load vehicles:', err);
      setError(err.response?.data?.message || 'Failed to load vehicles.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadVehicles();
  }, [page, statusFilter, search]);

  if (loading && !data) return <Loading />;

  const rows = Array.isArray(data?.data) ? data.data : [];

  return (
    <div className="panel">
      <div className="panel-header">
        <h3>Vehicles (View Only)</h3>
      </div>

      <div className="alert alert-info">Vehicle management is handled by Transport Officers</div>

      <div className="filter-bar">
        <input
          className="input"
          placeholder="Search registration, model..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
        />
        <select className="input select-inline" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
          <option value="">All Statuses</option>
          {VEHICLE_STATUSES.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
        </select>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <DataTable
        columns={[
          { key: 'registrationNumber', header: 'Registration', render: (v) => <strong>{v.registrationNumber}</strong> },
          { key: 'model', header: 'Model', render: (v) => v.model },
          { key: 'type', header: 'Type', render: (v) => v.type || '—' },
          { key: 'fuelType', header: 'Fuel Type', render: (v) => v.fuelType || '—' },
          { key: 'fuelConsumptionKmPerLitre', header: 'KM/L', render: (v) => v.fuelConsumptionKmPerLitre },
          { key: 'currentOdometer', header: 'Odometer', render: (v) => `${v.currentOdometer?.toLocaleString()} KM` },
          { key: 'status', header: 'Status', render: (v) => <StatusBadge status={v.status} /> },
          { key: 'serviceDate', header: 'Service Date', render: (v) => v.serviceDate ? v.serviceDate.split('T')[0] : '—' },
          { key: 'insuranceExpiry', header: 'Insurance Expiry', render: (v) => v.insuranceExpiry ? v.insuranceExpiry.split('T')[0] : '—' },
        ]}
        rows={rows}
        emptyMessage="No vehicles found."
      />

      {data && (
        <Pagination
          page={data.page || page}
          limit={data.limit || 20}
          total={data.total || 0}
          onChange={setPage}
        />
      )}
    </div>
  );
}
