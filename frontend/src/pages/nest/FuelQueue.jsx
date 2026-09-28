import { useEffect, useState } from 'react';
import { fuelApi } from '../../services/resources';
import DataTable from '../../components/DataTable';
import StatusBadge from '../../components/StatusBadge';
import Modal from '../../components/Modal';
import Loading from '../../components/Loading';

export default function NESTFuelQueue() {
  const [requests, setRequests] = useState(null);
  const [item, setItem] = useState(null);
  const [error, setError] = useState('');

  const load = () =>
    fuelApi
      .list()
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
  }, []);

  if (!requests) return <Loading />;

  return (
    <div className="panel">
      <div className="panel-header">
        <div>
          <span className="eyebrow">NEST FUEL VISIBILITY</span>
          <h3>Fuel Request Queue</h3>
          <p className="field-hint">
            Live queue of every fuel request with its release and confirmation state.
          </p>
        </div>
      </div>

      <div className="callout">
        Read-only queue. HPMU releases the voucher and the driver confirms receipt.
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
            header: 'Requested',
            render: (f) => `${f.litresRequested ?? '—'} L`,
          },
          {
            key: 'released',
            header: 'Released',
            render: (f) => (f.litresReleased != null ? `${f.litresReleased} L` : '—'),
          },
          {
            key: 'voucher',
            header: 'Voucher',
            render: (f) => f.voucherNumber || '—',
          },
          {
            key: 'issuedBy',
            header: 'Issued By',
            render: (f) => f.releasedByUser?.fullName || '—',
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
              <span className="field-label">Requested</span>
              <p>{item.litresRequested ?? '—'} L</p>
            </div>

            <div>
              <span className="field-label">Released</span>
              <p>{item.litresReleased != null ? `${item.litresReleased} L` : '—'}</p>
            </div>

            <div>
              <span className="field-label">Voucher</span>
              <p>{item.voucherNumber || '—'}</p>
            </div>

            <div>
              <span className="field-label">Issued By</span>
              <p>{item.releasedByUser?.fullName || '—'}</p>
            </div>

            <div>
              <span className="field-label">Released At</span>
              <p>{item.releasedAt ? new Date(item.releasedAt).toLocaleString() : '—'}</p>
            </div>

            <div>
              <span className="field-label">Status</span>
              <p>
                <StatusBadge status={item.status} />
              </p>
            </div>

            <div className="form-grid-full">
              <span className="field-label">Purpose</span>
              <p>{item.reason || item.notes || '—'}</p>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
