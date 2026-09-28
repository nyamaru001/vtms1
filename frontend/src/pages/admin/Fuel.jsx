import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fuelApi } from '../../services/resources';
import DataTable from '../../components/DataTable';
import StatusBadge from '../../components/StatusBadge';
import Loading from '../../components/Loading';
import Pagination from '../../components/Pagination';

const STATUSES = [
  'PENDING', 'R3_REVIEW', 'HPMU_REVIEW', 'R3_FINAL_REVIEW',
  'APPROVED', 'REJECTED', 'RETURNED', 'RELEASED', 'COMPLETED',
];

export default function AdminFuel() {
  const [data, setData] = useState(null);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadFuel = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await fuelApi.list({
        page,
        limit: 20,
        status: status || undefined,
      });
      setData(response);
    } catch (err) {
      console.error('Failed to load fuel requests:', err);
      setError(err.response?.data?.message || 'Failed to load fuel requests.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFuel();
  }, [page, status]);

  if (loading && !data) return <Loading />;

  const rows = Array.isArray(data?.data) ? data.data : [];

  return (
    <div className="panel">
      <div className="panel-header">
        <h3>All Fuel Requests (System-wide)</h3>
      </div>

      <div className="filter-bar">
        <select className="input select-inline" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          <option value="">All Statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
        </select>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <DataTable
        columns={[
          { key: 'id', header: 'ID', render: (f) => f.id },
          {
            key: 'trip', header: 'Trip',
            render: (f) => f.trip ? <Link to={`/transport/trips/${f.trip.id}`}>{f.trip.tripNumber}</Link> : '—',
          },
          { key: 'driver', header: 'Driver', render: (f) => f.driver?.user?.fullName || '—' },
          { key: 'vehicle', header: 'Vehicle', render: (f) => f.vehicle?.registrationNumber || '—' },
          { key: 'routeDistanceKm', header: 'Route KM', render: (f) => f.routeDistanceKm ? `${f.routeDistanceKm} KM` : '—' },
          { key: 'litresRequested', header: 'Requested', render: (f) => f.litresRequested ? `${f.litresRequested} L` : '—' },
          { key: 'litresCalculated', header: 'Calculated', render: (f) => f.litresCalculated ? `${f.litresCalculated} L` : '—' },
          { key: 'status', header: 'Status', render: (f) => <StatusBadge status={f.status} /> },
          {
            key: 'actions', header: '',
            render: (f) => f.trip ? <Link to={`/transport/fuel/${f.id}`} className="link-btn">View</Link> : '—',
          },
        ]}
        rows={rows}
        emptyMessage="No fuel requests found."
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