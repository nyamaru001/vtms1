
import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { requestsApi, vehiclesApi, statsApi } from '../../services/resources';
import DataTable from '../../components/DataTable';
import StatusBadge from '../../components/StatusBadge';
import Loading from '../../components/Loading';
import Pagination from '../../components/Pagination';
import Modal from '../../components/Modal';
import ActivityHistory, { formatActivityTime } from '../../components/ActivityHistory';

export default function MyRequests() {
  const location = useLocation();
  const portalBase = `/${location.pathname.split('/')[1] || 'officer'}`;
  const [data, setData] = useState(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [status, setStatus] = useState('');
  const [date, setDate] = useState('');
  const [vehicleId, setVehicleId] = useState('');
  const [vehicles, setVehicles] = useState([]);
  const [error, setError] = useState('');
  const [historyFor, setHistoryFor] = useState(null);
  const [dbStats, setDbStats] = useState({ total: 0, pending: 0, completed: 0 });
  const limit = 10;

  // Total / Pending / Completed come from the database (GET /api/stats),
  // never from the rows currently rendered on the page.
  useEffect(() => {
    let cancelled = false;
    const loadStats = async () => {
      try {
        const s = await statsApi.get();
        if (cancelled) return;
        setDbStats({
          total: s?.total ?? 0,
          pending: s?.pendingRequests ?? 0,
          completed: s?.completed ?? 0,
        });
      } catch (err) {
        console.error('Failed to load request statistics:', err);
      }
    };
    loadStats();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadData = async () => {
      setError('');

      try {
        const params = {
          page,
          limit,
          status: status || undefined,
          vehicleId: vehicleId || undefined,
          search: searchTerm || undefined,
          startDate: date || undefined,
          endDate: date || undefined,
        };

        const response = await requestsApi.list(params);

        if (cancelled) return;

        setData(response);
      } catch (err) {
        if (cancelled) return;

        console.error('Failed to load requests:', err);

        setError('Failed to load your requests. Please try again.');

        setData({
          data: [],
          page: 1,
          limit,
          total: 0,
        });
      }
    };

    loadData();

    return () => {
      cancelled = true;
    };
  }, [page, status, date, vehicleId, searchTerm]);

  useEffect(() => {
    let cancelled = false;

    const loadVehicles = async () => {
      try {
        const response = await vehiclesApi.list();

        if (cancelled) return;

        const vehicleData = response?.data ?? response ?? [];

        setVehicles(
          Array.isArray(vehicleData) ? vehicleData : []
        );
      } catch (err) {
        console.error('Failed to load vehicles:', err);

        if (!cancelled) {
          setVehicles([]);
        }
      }
    };

    loadVehicles();

    return () => {
      cancelled = true;
    };
  }, []);

  if (!data && !error) {
    return <Loading />;
  }

  const requests = Array.isArray(data?.data) ? data.data : [];
  const total = Number(data?.total || 0);

  const handleSearch = (e) => {
    e.preventDefault();

    setPage(1);
    setSearchTerm(search.trim());
  };

  const handleClearFilters = () => {
    setSearch('');
    setSearchTerm('');
    setStatus('');
    setDate('');
    setVehicleId('');
    setPage(1);
  };

  const statusOptions = [
    'R3_REVIEW',
    'R3_APPROVED',
    'R3_REJECTED',
    'R3_RETURNED',
    'TRANSPORT_REVIEW',
    'DRIVER_ASSIGNED',
    'DRIVER_ACCEPTED',
    'FUEL_REQUESTED',
    'HPMU_REVIEW',
    'HPMU_APPROVED',
    'HPMU_RELEASED',
    'DRIVER_CONFIRMED',
    'TRIP_STARTED',
    'TRIP_COMPLETED',
    'CLOSED',
    'CANCELLED',
  ];

  return (
    <div className="my-requests-page">

      <div className="my-requests-header">
        <div>
          <span className="page-kicker">OFFICER PORTAL</span>

          <h1>Request History</h1>

          <p>
            Track every vehicle request from submission through approval,
            assignment, trip and completion.
          </p>
        </div>

        <Link
          to={`${portalBase}/request-vehicle`}
          className="primary-action"
        >
          + New Request
        </Link>
      </div>

      <div className="request-summary">

        <div className="request-summary-card">
          <div className="summary-icon">▣</div>

          <div>
            <span>Total</span>
            <strong>{dbStats.total}</strong>
          </div>
        </div>

        <div className="request-summary-card">
          <div className="summary-icon pending">◷</div>

          <div>
            <span>Pending</span>
            <strong>{dbStats.pending}</strong>
          </div>
        </div>

        <div className="request-summary-card">
          <div className="summary-icon completed">✓</div>

          <div>
            <span>Completed</span>
            <strong>{dbStats.completed}</strong>
          </div>
        </div>

      </div>

      <div className="my-requests-card">

        <div className="my-requests-toolbar">

          <div className="toolbar-title">
            <h2>Request History</h2>

            <span>
              {total} {total === 1 ? 'request' : 'requests'}
            </span>
          </div>

          <div className="request-filters">

            <form
              onSubmit={handleSearch}
              className="filter-row"
            >
              <input
                type="text"
                className="input"
                placeholder="Search requests..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />

              <button
                type="submit"
                className="btn btn-secondary"
              >
                Search
              </button>

              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleClearFilters}
              >
                Clear
              </button>
            </form>

            <div className="filter-row">

              <select
                className="input"
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">All Statuses</option>

                {statusOptions.map((s) => (
                  <option key={s} value={s}>
                    {s.replace(/_/g, ' ')}
                  </option>
                ))}
              </select>

              <input
                className="input"
                type="date"
                value={date}
                onChange={(e) => {
                  setDate(e.target.value);
                  setPage(1);
                }}
              />

              <select
                className="input"
                value={vehicleId}
                onChange={(e) => {
                  setVehicleId(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">All Vehicles</option>

                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.registrationNumber}
                  </option>
                ))}
              </select>

            </div>

          </div>
        </div>

        {error && (
          <div className="requests-error">
            <span>!</span>
            {error}
          </div>
        )}

        <div className="requests-table-wrapper">

          <DataTable
            columns={[
              {
                key: 'requestNumber',
                header: 'Request #',
                render: (r) => (
                  <Link
                    className="request-number-link"
                    to={`${portalBase}/requests/${r.id}`}
                  >
                    {r.requestNumber || `REQ-${r.id}`}
                  </Link>
                ),
              },

              {
                key: 'createdAt',
                header: 'Submitted',
                render: (r) => (
                  <span className="request-submitted-at">
                    {formatActivityTime(r.createdAt) || '\u2014'}
                  </span>
                ),
              },

              {
                key: 'route',
                header: 'Route',
                render: (r) =>
                  `${r.originName || 'Origin'} → ${
                    r.destinationName || 'Destination'
                  }`,
              },

              {
                key: 'vehicle',
                header: 'Vehicle',
                render: (r) =>
                  r.vehicle?.registrationNumber || '—',
              },

              {
                key: 'driver',
                header: 'Driver',
                render: (r) =>
                  r.driver?.user?.fullName ||
                  r.driver?.name ||
                  '—',
              },

              {
                key: 'status',
                header: 'Status',
                render: (r) => (
                  <StatusBadge status={r.status} />
                ),
              },

              {
                key: 'cancellationReason',
                header: 'Cancel Reason',
                render: (r) =>
                  r.status === 'CANCELLED'
                    ? (r.cancellationReason || '—')
                    : '—',
              },

              {
                key: 'cancelledAt',
                header: 'Cancelled',
                render: (r) =>
                  r.cancelledAt
                    ? new Date(r.cancelledAt).toLocaleString()
                    : '—',
              },

              {
                key: 'departureDate',
                header: 'Departure',
                render: (r) =>
                  r.departureDate && r.departureTime
                    ? `${r.departureDate} ${r.departureTime}`
                    : r.departureDate || '—',
              },

              {
                key: 'action',
                header: '',
                render: (r) => (
                  <span className="request-actions">
                    <button
                      type="button"
                      className="view-request-btn"
                      onClick={() => setHistoryFor(r)}
                      data-testid={`request-history-${r.id}`}
                    >
                      History
                    </button>

                    <Link
                      className="view-request-btn"
                      to={`${portalBase}/requests/${r.id}`}
                    >
                      View
                    </Link>
                  </span>
                ),
              },
            ]}
            rows={requests}
            emptyMessage="You have not submitted any requests yet."
          />

        </div>

        {total > 0 && (
          <div className="my-requests-pagination">
            <Pagination
              page={data?.page || page}
              limit={data?.limit || limit}
              total={total}
              onChange={setPage}
            />
          </div>
        )}

      </div>

      <Modal
        open={Boolean(historyFor)}
        title="Activity History"
        onClose={() => setHistoryFor(null)}
        footer={
          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={() => setHistoryFor(null)}>
              Close
            </button>
          </div>
        }
      >
        <div className="activity-history-modal">
          {historyFor && (
            <>
              <p className="activity-history-reference">
                <strong>{historyFor.requestNumber || `REQ-${historyFor.id}`}</strong>
                <span>
                  {' '}
                  {historyFor.originName} &rarr; {historyFor.destinationName}
                </span>
              </p>

              <ActivityHistory requestId={historyFor.id} />
            </>
          )}
        </div>
      </Modal>
    </div>
  );
}
