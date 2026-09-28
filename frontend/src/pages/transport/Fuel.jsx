
import { useEffect, useState } from 'react';
import { fuelApi } from '../../services/resources';
import DataTable from '../../components/DataTable';
import StatusBadge from '../../components/StatusBadge';
import Modal from '../../components/Modal';
import Loading from '../../components/Loading';

export default function TransportFuel() {
  const [requests, setRequests] = useState(null);
  const [status, setStatus] = useState('');
  const [review, setReview] = useState(null);
  const [error, setError] = useState('');

  const load = () => {
    fuelApi
      .list({ status: status || undefined })
      .then((response) => {
        if (Array.isArray(response)) {
          setRequests(response);
        } else if (Array.isArray(response?.data)) {
          setRequests(response.data);
        } else {
          setRequests([]);
        }
      })
      .catch((err) => {
        setError(
          err.response?.data?.message || 'Failed to load fuel requests.'
        );
        setRequests([]);
      });
  };

  useEffect(() => {
    load();
  }, [status]);

  const openReview = (request) => {
    setReview(request);
    setError('');
  };

  const closeReview = () => {
    setReview(null);
    setError('');
  };

  if (!requests) {
    return <Loading />;
  }

  return (
    <div className="panel">
      {/* HEADER */}
      <div className="panel-header">
        <div>
          <span className="eyebrow">FUEL CONTROL</span>
          <h3>Fuel Requests</h3>
          <p className="field-hint">Monitor driver fuel requests and HPMU release status for your fleet.</p>
        </div>

        <select
          className="input select-inline"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="HPMU_REVIEW">HPMU Review</option>
          <option value="HPMU_APPROVED">Approved — ready to release</option>
          <option value="HPMU_RELEASED">Released</option>
          <option value="DRIVER_CONFIRMED">Driver Confirmed</option>
          <option value="COMPLETED">Completed</option>
          <option value="">All</option>
        </select>
      </div>

      {/* WORKFLOW INFORMATION */}
      <div className="callout">
        Approval flow:{' '}
        <strong>
          Driver requests → HPMU review → HPMU release → Driver confirms
        </strong>
      </div>

      {/* FUEL REQUEST TABLE */}
      <DataTable
        columns={[
          {
            key: 'trip',
            header: 'Trip',
            render: (f) => f.trip?.tripNumber || '—',
          },

          {
            key: 'driver',
            header: 'Driver',
            render: (f) => f.driver?.user?.fullName || '—',
          },

          {
            key: 'vehicle',
            header: 'Vehicle',
            render: (f) =>
              f.vehicle?.registrationNumber || '—',
          },

          {
            key: 'route',
            header: 'Route KM',
            render: (f) =>
              f.routeDistanceKm
                ? `${f.routeDistanceKm} KM`
                : '—',
          },

          {
            key: 'requested',
            header: 'Requested',
            render: (f) =>
              f.litresRequested != null
                ? `${f.litresRequested} L`
                : '—',
          },

          {
            key: 'status',
            header: 'Status',
            render: (f) => <StatusBadge status={f.status} />,
          },

          {
            key: 'actions',
            header: '',
            render: (f) => (
              <div className="row-actions">
                <button
                  type="button"
                  className="link-btn"
                  onClick={() => openReview(f)}
                >
                  View
                </button>
              </div>
            ),
          },
        ]}
        rows={requests}
        emptyMessage="No fuel requests in this queue."
      />

      {/* DETAILS MODAL */}
      <Modal
        open={!!review}
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
        {review && (
          <>
            <div className="detail-grid">
              <div>
                <span className="field-label">Driver</span>
                <p>
                  {review.driver?.user?.fullName || '—'}
                </p>
              </div>

              <div>
                <span className="field-label">Vehicle</span>
                <p>
                  {review.vehicle?.registrationNumber || '—'}
                </p>
              </div>

              <div>
                <span className="field-label">Current KM</span>
                <p>{review.currentKm ?? '—'}</p>
              </div>

              <div>
                <span className="field-label">Requested</span>
                <p>
                  {review.litresRequested != null
                    ? `${review.litresRequested} L`
                    : '—'}
                </p>
              </div>

              <div>
                <span className="field-label">
                  Calculated remaining
                </span>
                <p>
                  {review.litresCalculated != null
                    ? `${review.litresCalculated} L`
                    : '—'}
                </p>
              </div>

              <div>
                <span className="field-label">Status</span>
                <p>
                  <StatusBadge status={review.status} />
                </p>
              </div>

              <div>
                <span className="field-label">Route</span>
                <p>
                  {review.trip?.request?.originName || '—'}
                  {' → '}
                  {review.trip?.request?.destinationName || '—'}
                </p>
              </div>
            </div>

            {review.reason && (
              <div style={{ marginTop: 12 }}>
                <span className="field-label">Reason</span>
                <p>{review.reason}</p>
              </div>
            )}

            {error && (
              <div className="form-error">{error}</div>
            )}
          </>
        )}
      </Modal>
    </div>
  );
}
