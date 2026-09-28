import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { tripsApi } from '../../services/resources';
import DataTable from '../../components/DataTable';
import StatusBadge from '../../components/StatusBadge';
import Loading from '../../components/Loading';
import Pagination from '../../components/Pagination';

const STATUSES = [
  'NOT_STARTED', 'DRIVER_ASSIGNED', 'TRIP_STARTED', 'IN_PROGRESS',
  'TRIP_COMPLETED', 'CLOSED',
];

export default function AdminTrips() {
  const [data, setData] = useState(null);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadTrips = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await tripsApi.list();
      setData(response);
    } catch (err) {
      console.error('Failed to load trips:', err);
      setError(err.response?.data?.message || 'Failed to load trips.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTrips();
  }, [page]);

  if (loading && !data) return <Loading />;

  let rows = Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : [];

  if (status) {
    rows = rows.filter((t) => t.status === status);
  }

  return (
    <div className="panel">
      <div className="panel-header">
        <h3>All Trips (System-wide)</h3>
      </div>

      <div className="filter-bar">
        <select className="input select-inline" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All Statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
        </select>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <DataTable
        columns={[
          {
            key: 'tripNumber', header: 'Trip #',
            render: (t) => <Link to={`/transport/trips/${t.id}`}>{t.tripNumber}</Link>,
          },
          {
            key: 'request', header: 'Request',
            render: (t) => t.request ? <Link to={`/transport/requests/${t.request.id}`}>{t.request.requestNumber}</Link> : '—',
          },
          { key: 'vehicle', header: 'Vehicle', render: (t) => t.vehicle?.registrationNumber || '—' },
          { key: 'driver', header: 'Driver', render: (t) => t.driver?.user?.fullName || '—' },
          { key: 'officer', header: 'Officer', render: (t) => t.officer?.fullName || '—' },
          { key: 'status', header: 'Status', render: (t) => <StatusBadge status={t.status} /> },
          { key: 'startTime', header: 'Start', render: (t) => t.startTime ? new Date(t.startTime).toLocaleString() : '—' },
          { key: 'endTime', header: 'End', render: (t) => t.endTime ? new Date(t.endTime).toLocaleString() : '—' },
          { key: 'totalOdometerKm', header: 'Odometer KM', render: (t) => t.totalOdometerKm ? `${t.totalOdometerKm} KM` : '—' },
          {
            key: 'actions', header: '',
            render: (t) => <Link to={`/transport/trips/${t.id}`} className="link-btn">View</Link>,
          },
        ]}
        rows={rows}
        emptyMessage="No trips found."
      />

      <Pagination
        page={page}
        limit={20}
        total={rows.length}
        onChange={setPage}
      />
    </div>
  );
}