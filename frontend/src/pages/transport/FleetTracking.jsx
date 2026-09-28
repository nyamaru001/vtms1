import { useEffect, useState } from 'react';
import { tripsApi } from '../../services/resources';
import RouteMap from '../../components/RouteMap';
import StatusBadge from '../../components/StatusBadge';
import ProgressBar from '../../components/ProgressBar';
import Loading from '../../components/Loading';
import { Link } from 'react-router-dom';

export default function FleetTracking() {
  const [trips, setTrips] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [progressById, setProgressById] = useState({});

  const load = async () => {
    const all = await tripsApi.list();
    const active = all.filter((t) => t.status === 'IN_PROGRESS');
    setTrips(active);
    if (!selectedId && active.length > 0) setSelectedId(active[0].id);

    const progressEntries = await Promise.all(
      active.map((t) => tripsApi.progress(t.id).then((p) => [t.id, p]).catch(() => [t.id, null]))
    );
    setProgressById(Object.fromEntries(progressEntries));
  };

  useEffect(() => { load(); }, []);
  useEffect(() => {
    const interval = setInterval(load, 20000);
    return () => clearInterval(interval);
  }, []);

  if (!trips) return <Loading />;

  const selected = trips.find((t) => t.id === selectedId);
  const selectedProgress = selected ? progressById[selected.id] : null;

  return (
    <div>
      <div className="panel">
        <div className="panel-header">
          <h3>Fleet Tracking — Active Trips ({trips.length})</h3>
        </div>

        {trips.length === 0 ? (
          <div className="empty-state">No trips are currently in progress.</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr><th>Trip #</th><th>Vehicle</th><th>Driver</th><th>Route</th><th>Progress</th><th>Status</th><th></th></tr>
            </thead>
            <tbody>
              {trips.map((t) => {
                const p = progressById[t.id];
                return (
                  <tr key={t.id} className={t.id === selectedId ? 'active' : ''}>
                    <td>{t.tripNumber}</td>
                    <td>{t.vehicle?.registrationNumber}</td>
                    <td>{t.driver?.user?.fullName}</td>
                    <td>{t.request?.originName} → {t.request?.destinationName}</td>
                    <td>{p ? `${p.percent}% (${p.completedKm}/${t.request?.oneWayKm} KM)` : '—'}</td>
                    <td><StatusBadge status={t.status} /></td>
                    <td><button className="link-btn" onClick={() => setSelectedId(t.id)}>View on map</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {selected && (
        <div className="panel">
          <div className="panel-header">
            <h3>{selected.tripNumber} — {selected.vehicle?.registrationNumber}</h3>
            <Link className="link-btn" to={`/transport/trips/${selected.id}`}>Full trip detail</Link>
          </div>
          {selectedProgress && (
            <ProgressBar
              percent={selectedProgress.percent}
              completedKm={selectedProgress.completedKm}
              remainingKm={selectedProgress.remainingKm}
              totalKm={selected.request?.oneWayKm}
            />
          )}
          <div style={{ marginTop: 16 }}>
            <RouteMap
              origin={{ lat: selected.request.originLat, lng: selected.request.originLng, name: selected.request.originName }}
              destination={{ lat: selected.request.destinationLat, lng: selected.request.destinationLng, name: selected.request.destinationName }}
              geometry={selected.request.routeGeometry}
              vehiclePosition={selectedProgress?.lastLocation}
              height={420}
            />
          </div>
        </div>
      )}
    </div>
  );
}
