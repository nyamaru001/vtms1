import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { tripsApi } from '../../services/resources';
import DataTable from '../../components/DataTable';
import StatusBadge from '../../components/StatusBadge';
import Loading from '../../components/Loading';

export default function TransportTrips() {
  const [trips, setTrips] = useState(null);
  useEffect(() => { tripsApi.list().then(setTrips); }, []);
  if (!trips) return <Loading />;

  return (
    <div className="panel">
      <h3>Trips</h3>
      <DataTable
        columns={[
          { key: 'tripNumber', header: 'Trip #', render: (t) => <Link to={`/transport/trips/${t.id}`}>{t.tripNumber}</Link> },
          { key: 'vehicle', header: 'Vehicle', render: (t) => t.vehicle?.registrationNumber },
          { key: 'driver', header: 'Driver', render: (t) => t.driver?.user?.fullName },
          { key: 'officer', header: 'Officer', render: (t) => t.officer?.fullName },
          { key: 'route', header: 'Route', render: (t) => `${t.request?.originName} → ${t.request?.destinationName}` },
          { key: 'status', header: 'Status', render: (t) => <StatusBadge status={t.status} /> },
        ]}
        rows={trips}
        emptyMessage="No trips yet."
      />
    </div>
  );
}
