import { useEffect, useState } from 'react';
import { fuelApi } from '../../services/resources';
import DataTable from '../../components/DataTable';
import StatusBadge from '../../components/StatusBadge';
import Modal from '../../components/Modal';
import Loading from '../../components/Loading';

export default function R3FuelRequests() {
  const [requests, setRequests] = useState(null);
  const [status, setStatus] = useState('');
  const [item, setItem] = useState(null);
  const [comment, setComment] = useState('');
  const [error, setError] = useState('');

  const load = () =>
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
      .catch(() => {
        setRequests([]);
        setError('Failed to load fuel requests.');
      });

  useEffect(() => {
    load();
  }, [status]);

  if (!requests) return <Loading />;

  return (
    <div className="panel">
      <div className="panel-header">
        <div>
          <span className="eyebrow">R3 FUEL VISIBILITY</span>
          <h3>Fuel Requests</h3>
          <p className="field-hint">Read-only view of fuel workflow with HPMU recommendations.</p>
        </div>

        <select
          className="input select-inline"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">All</option>
          <option value="HPMU_REVIEW">HPMU Review</option>
          <option value="HPMU_APPROVED">HPMU Approved</option>
          <option value="HPMU_RELEASED">Released</option>
          <option value="DRIVER_CONFIRMED">Driver Confirmed</option>
          <option value="COMPLETED">Completed</option>
          <option value="HPMU_REJECTED">Rejected</option>
          <option value="HPMU_RETURNED">Returned</option>
        </select>
      </div>

      <div className="callout">
        Read-only visibility into the fuel workflow. HPMU reviews and releases fuel after Transport assignment.
      </div>

      {error && <div className="form-error">{error}</div>}

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
            render: (f) => f.vehicle?.registrationNumber || '—',
          },
          {
            key: 'litres',
            header: 'Fuel',
            render: (f) => `${f.litresRequested ?? '—'} L`,
          },
          {
            key: 'status',
            header: 'Status',
            render: (f) => <StatusBadge status={f.status} />,
          },
          {
            key: 'action',
            header: '',
            render: (f) => (
              <button
                type="button"
                className="link-btn"
                onClick={() => {
                  setItem(f);
                  setError('');
                }}
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
        open={!!item}
        title="Fuel Request Details"
        onClose={() => setItem(null)}
        footer={
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => setItem(null)}
          >
            Close
          </button>
        }
      >
        {item && (
          <div className="detail-grid">
            <div>
              <span className="field-label">Driver</span>
              <p>{item.driver?.user?.fullName || '—'}</p>
            </div>

            <div>
              <span className="field-label">Vehicle</span>
              <p>{item.vehicle?.registrationNumber || '—'}</p>
            </div>

            <div>
              <span className="field-label">Route</span>
              <p>
                {item.trip?.request?.originName || '—'} →{' '}
                {item.trip?.request?.destinationName || '—'}
              </p>
            </div>

            <div>
              <span className="field-label">Distance</span>
              <p>{item.routeDistanceKm ?? '—'} KM</p>
            </div>

            <div>
              <span className="field-label">Requested</span>
              <p>{item.litresRequested ?? '—'} L</p>
            </div>

            <div>
              <span className="field-label">Calculated</span>
              <p>{item.litresCalculated ?? '—'} L</p>
            </div>

            <div>
              <span className="field-label">Status</span>
              <p>
                <StatusBadge status={item.status} />
              </p>
            </div>

            <div>
              <span className="field-label">Released</span>
              <p>
                {item.litresReleased != null
                  ? `${item.litresReleased} L`
                  : '—'}
              </p>
            </div>

            <div className="form-grid-full">
              <span className="field-label">HPMU Recommendation</span>
              {item.hpmuRecommendations?.length ? (
                item.hpmuRecommendations.map((n) => (
                  <div key={n.id} className="history-item" data-testid="hpmu-recommendation">
                    <strong>{n.decision}</strong> by {n.reviewer?.fullName || 'HPMU'}
                    {n.comment ? <p>{n.comment}</p> : null}
                  </div>
                ))
              ) : (
                <p>No HPMU recommendation yet.</p>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}