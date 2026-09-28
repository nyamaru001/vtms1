import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { requestsApi } from '../../services/resources';
import DataTable from '../../components/DataTable';
import StatusBadge from '../../components/StatusBadge';
import Loading from '../../components/Loading';
import Pagination from '../../components/Pagination';

const STATUSES = [
  'PENDING', 'TRANSPORT_REVIEW', 'HPMU_REVIEW', 'R3_REVIEW',
  'APPROVED', 'REJECTED', 'RETURNED', 'CANCELLED', 'DRIVER_ASSIGNED',
  'TRIP_STARTED', 'TRIP_COMPLETED', 'CLOSED',
];

export default function AdminRequests() {
  const [data, setData] = useState(null);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadRequests = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await requestsApi.list({
        page,
        limit: 20,
        status: status || undefined,
        search: search || undefined,
      });
      setData(response);
    } catch (err) {
      console.error('Failed to load requests:', err);
      setError(err.response?.data?.message || 'Failed to load requests.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRequests();
  }, [page, status, search]);

  if (loading && !data) return <Loading />;

  const rows = Array.isArray(data?.data) ? data.data : [];

  return (
    <div className="panel">
      <div className="panel-header">
        <h3>All Vehicle Requests (System-wide)</h3>
      </div>

      <div className="filter-bar">
        <input
          className="input"
          placeholder="Search request #, officer, route..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
        />
        <select className="input select-inline" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          <option value="">All Statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
        </select>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <DataTable
        columns={[
          {
            key: 'requestNumber', header: 'Request #',
            render: (r) => <Link to={`/transport/requests/${r.id}`}>{r.requestNumber}</Link>,
          },
          {
            key: 'officer', header: 'Officer',
            render: (r) => r.officer ? `${r.officer.fullName} (${r.officer.username})` : '—',
          },
          {
            key: 'route', header: 'Route',
            render: (r) => `${r.originName || '—'} → ${r.destinationName || '—'}`,
          },
          { key: 'departureDate', header: 'Departure', render: (r) => r.departureDate || '—' },
          { key: 'vehicle', header: 'Vehicle', render: (r) => r.vehicle?.registrationNumber || 'Not assigned' },
          { key: 'driver', header: 'Driver', render: (r) => r.driver?.user?.fullName || 'Not assigned' },
          { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
          {
            key: 'actions', header: '',
            render: (r) => <Link to={`/transport/requests/${r.id}`} className="link-btn">View</Link>,
          },
        ]}
        rows={rows}
        emptyMessage="No requests found."
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