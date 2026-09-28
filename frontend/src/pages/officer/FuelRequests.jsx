import { useEffect, useState } from 'react';
import { fuelApi } from '../../services/resources';
import DataTable from '../../components/DataTable';
import StatusBadge from '../../components/StatusBadge';
import Modal from '../../components/Modal';
import Loading from '../../components/Loading';

export default function OfficerFuelRequests() {
  const [requests, setRequests] = useState([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [reviewing, setReviewing] = useState(null);
  const [comment, setComment] = useState('');
  const [error, setError] = useState('');

  const load = async () => {
    try {
      setError('');

      const data = await fuelApi.list({
        status: statusFilter || undefined,
      });

      setRequests(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load fuel requests:', err);

      setRequests([]);

      setError(
        err.response?.data?.message ||
          'Failed to load fuel requests.'
      );
    }
  };

  useEffect(() => {
    load();
  }, [statusFilter]);

  const openReview = (request) => {
    setReviewing(request);
    setComment('');
    setError('');
  };

  const closeReview = () => {
    setReviewing(null);
    setComment('');
    setError('');
  };

  if (!requests) {
    return <Loading />;
  }

  return (
    <div className="panel">
      <div className="panel-header">
        <div>
          <span className="eyebrow">FUEL REQUESTS</span>
          <h3>Fuel Requests</h3>
        </div>

        <select
          className="input select-inline"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="HPMU_REVIEW">HPMU Review</option>
          <option value="HPMU_APPROVED">Approved</option>
          <option value="HPMU_RELEASED">Released</option>
          <option value="DRIVER_CONFIRMED">Driver Confirmed</option>
          <option value="COMPLETED">Completed</option>
          <option value="">All</option>
        </select>
      </div>

      {error && !reviewing && (
        <div className="form-error">
          {error}
        </div>
      )}

      <DataTable
        columns={[
          {
            key: 'trip',
            header: 'Trip',
            render: (f) =>
              f.trip?.tripNumber ||
              f.trip?.id ||
              '—',
          },

          {
            key: 'driver',
            header: 'Driver',
            render: (f) =>
              f.driver?.user?.fullName ||
              f.driver?.name ||
              '—',
          },

          {
            key: 'vehicle',
            header: 'Vehicle',
            render: (f) =>
              f.vehicle?.registrationNumber ||
              f.vehicle?.plateNumber ||
              '—',
          },

          {
            key: 'distance',
            header: 'Distance',
            render: (f) =>
              f.routeDistanceKm != null
                ? `${f.routeDistanceKm} KM`
                : '—',
          },

          {
            key: 'litresRequested',
            header: 'Fuel Requested',
            render: (f) => (
              <span
                style={{
                  fontWeight: 600,
                  color: '#1e293b',
                }}
              >
                {f.litresRequested ?? 0} L
              </span>
            ),
          },

          {
            key: 'litresCalculated',
            header: 'Estimated Fuel',
            render: (f) =>
              f.litresCalculated != null
                ? (
                  <span>
                    {f.litresCalculated} L
                    {f.exceedsEstimate && (
                      <span style={{ color: '#dc2626', marginLeft: '6px', fontSize: '12px', fontWeight: 500 }}>
                        (exceeds estimate)
                      </span>
                    )}
                  </span>
                )
                : '—',
          },

          {
            key: 'status',
            header: 'Status',
            render: (f) => (
              <StatusBadge status={f.status} />
            ),
          },

          {
            key: 'actions',
            header: 'Action',
            render: (f) => (
              <button
                type="button"
                className="link-btn"
                onClick={() => openReview(f)}
              >
                View
              </button>
            ),
          },
        ]}
        rows={requests}
        emptyMessage="No fuel requests found."
      />

      <Modal
        open={Boolean(reviewing)}
        title="Fuel Request Details"
        onClose={closeReview}
        footer={
          <button
            type="button"
            className="btn btn-ghost"
            onClick={closeReview}
          >
            Close
          </button>
        }
      >
        {reviewing && (
          <div className="detail-grid">
            <div>
              <span className="field-label">
                Driver
              </span>
              <p>
                {reviewing.driver?.user?.fullName ||
                  reviewing.driver?.name ||
                  '—'}
              </p>
            </div>

            <div>
              <span className="field-label">
                Vehicle
              </span>
              <p>
                {reviewing.vehicle?.registrationNumber ||
                  reviewing.vehicle?.plateNumber ||
                  '—'}
              </p>
            </div>

            <div>
              <span className="field-label">
                Trip
              </span>
              <p>
                {reviewing.trip?.tripNumber ||
                  reviewing.trip?.id ||
                  '—'}
              </p>
            </div>

            <div>
              <span className="field-label">
                Route Distance
              </span>
              <p>
                {reviewing.routeDistanceKm != null
                  ? `${reviewing.routeDistanceKm} KM`
                  : '—'}
              </p>
            </div>

            <div>
              <span className="field-label">
                Estimated Fuel
              </span>
              <p>
                {reviewing.litresCalculated != null
                  ? `${reviewing.litresCalculated} L`
                  : '—'}
              </p>
            </div>

            <div>
              <span className="field-label">
                Requested Fuel
              </span>
              <p>
                {reviewing.litresRequested ?? 0} L

                {reviewing.exceedsEstimate && (
                  <span
                    style={{
                      color: '#dc2626',
                      marginLeft: '6px',
                    }}
                  >
                    (exceeds estimate)
                  </span>
                )}
              </p>
            </div>

            <div>
              <span className="field-label">
                Reason
              </span>
              <p>
                {reviewing.reason || '—'}
              </p>
            </div>
          </div>
        )}

        <div style={{ marginTop: '20px' }}>
          <label className="field-label">
            Comment
          </label>

          <textarea
            className="input"
            rows={3}
            value={comment}
            onChange={(e) =>
              setComment(e.target.value)
            }
            placeholder="Enter your comment..."
          />
        </div>

        {error && (
          <div className="form-error">
            {error}
          </div>
        )}
      </Modal>
    </div>
  );
}