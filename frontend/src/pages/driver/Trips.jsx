import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { tripsApi } from '../../services/resources';
import DataTable from '../../components/DataTable';
import StatusBadge from '../../components/StatusBadge';
import Loading from '../../components/Loading';

export default function DriverTrips() {
  const [trips, setTrips] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    tripsApi.list()
      .then(setTrips)
      .catch((err) => {
        const message = err.response?.data?.message || 'Failed to load trips.';
        setError(message);
      });
  }, []);

  if (!trips && !error) return <Loading />;

  return (
    <div className="panel">
      <h3>My Trips</h3>
      {error && (
        <div className="callout callout-error" style={{ marginBottom: 16 }}>
          {error}
        </div>
      )}
      {!error && (
        <DataTable
          columns={[
            { key: 'tripNumber', header: 'Trip #', render: (t) => <Link to={`/driver/trips/${t.id}`}>{t.tripNumber}</Link> },
            { key: 'route', header: 'Route', render: (t) => `${t.request?.originName} → ${t.request?.destinationName}` },
            { key: 'officer', header: 'Officer', render: (t) => t.officer?.fullName },
            { key: 'status', header: 'Status', render: (t) => <StatusBadge status={t.status} /> },
          ]}
          rows={trips}
          emptyMessage="No trips yet."
        />
      )}
    </div>
  );
}
