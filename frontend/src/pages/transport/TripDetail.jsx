import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { tripsApi, logbooksApi, fuelApi } from '../../services/resources';
import RouteMap from '../../components/RouteMap';
import StatusBadge from '../../components/StatusBadge';
import ProgressBar from '../../components/ProgressBar';
import Loading from '../../components/Loading';
import Modal from '../../components/Modal';

export default function TransportTripDetail() {
  const { id } = useParams();
  const [trip, setTrip] = useState(null);
  const [progress, setProgress] = useState(null);
  const [logbook, setLogbook] = useState(null);
  const [fuelHistory, setFuelHistory] = useState([]);
  const [error, setError] = useState('');

  const load = async () => {
    const t = await tripsApi.get(id);
    setTrip(t);
    tripsApi.progress(id).then(setProgress).catch(() => {});
    fuelApi.list({ status: undefined }).then((all) => setFuelHistory(all.filter((f) => f.tripId === Number(id))));

    const logbooks = await logbooksApi.list({ tripId: id });
    setLogbook(logbooks.data[0] || null);
  };

  useEffect(() => { load(); }, [id]);
  if (!trip) return <Loading />;

  const handleConfirm = async () => {
    setError('');
    try {
      await tripsApi.confirmCompletion(trip.id, {});
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to confirm completion.');
    }
  };

  const handleClose = async () => {
    setError('');
    try {
      await tripsApi.close(trip.id);
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to close trip.');
    }
  };

  return (
    <div>
      <div className="panel">
        <div className="panel-header">
          <h3>{trip.tripNumber}</h3>
          <StatusBadge status={trip.status} />
        </div>
        <div className="detail-grid">
          <div><span className="field-label">Vehicle</span><p>{trip.vehicle?.registrationNumber} — {trip.vehicle?.model}</p></div>
          <div><span className="field-label">Driver</span><p>{trip.driver?.user?.fullName}</p></div>
          <div><span className="field-label">Officer</span><p>{trip.officer?.fullName}</p></div>
          <div><span className="field-label">Route</span><p>{trip.request?.originName} → {trip.request?.destinationName}</p></div>
          <div><span className="field-label">Start KM / End KM</span><p>{trip.startKm ?? '—'} / {trip.endKm ?? '—'}</p></div>
          <div><span className="field-label">Total Odometer KM</span><p>{trip.totalOdometerKm ?? '—'}</p></div>
        </div>

        {error && <div className="form-error">{error}</div>}

        {progress && trip.status === 'IN_PROGRESS' && (
          <ProgressBar percent={progress.percent} completedKm={progress.completedKm} remainingKm={progress.remainingKm} totalKm={trip.request?.oneWayKm} />
        )}

        {['IN_PROGRESS', 'TRIP_STARTED', 'OFFICER_COMPLETED', 'DRIVER_COMPLETED'].includes(trip.status) && (
          <div className="row-actions" data-testid="transport-dual-confirm">
            <button
              className="btn btn-primary"
              data-testid="officer-end-trip"
              onClick={handleConfirm}
            >
              {trip.status === 'DRIVER_COMPLETED' ? 'Confirm & Complete (Officer side)' : 'End Trip (Officer)'}
            </button>
            <span className="field-hint">Completion requires both driver and officer confirmation.</span>
          </div>
        )}

        {['DRIVER_COMPLETED', 'OFFICER_COMPLETED'].includes(trip.status) && (
          <div className="callout" data-testid="awaiting-other-party">
            <strong>Waiting for the other party to confirm completion.</strong>
            <p>
              {trip.status === 'DRIVER_COMPLETED' ? 'Officer confirmation pending.' : 'Driver confirmation pending.'}
            </p>
          </div>
        )}

        {['TRIP_COMPLETED', 'CLOSED'].includes(trip.status) && (
          <div className="row-actions">
            <button className="btn btn-primary" onClick={handleClose} disabled={!logbook || logbook.status !== 'VERIFIED'}>
              Close Trip
            </button>
            {(!logbook || logbook.status !== 'VERIFIED') && (
              <span className="field-hint">Trip can be closed once the driver's logbook is submitted and verified.</span>
            )}
          </div>
        )}
      </div>

      <div className="panel">
        <h3>Route</h3>
        <RouteMap
          origin={{ lat: trip.request.originLat, lng: trip.request.originLng, name: trip.request.originName }}
          destination={{ lat: trip.request.destinationLat, lng: trip.request.destinationLng, name: trip.request.destinationName }}
          geometry={trip.request.routeGeometry}
          vehiclePosition={progress?.lastLocation}
        />
      </div>

      <div className="panel">
        <div className="panel-header">
          <h3>Driver Logbook</h3>
          {logbook && <StatusBadge status={logbook.status} />}
        </div>
        {!logbook ? (
          <div className="empty-state">The driver hasn't started their logbook for this trip yet.</div>
        ) : (
          <div className="detail-grid">
            <div><span className="field-label">Start KM</span><p>{logbook.startKm}</p></div>
            <div><span className="field-label">End KM</span><p>{logbook.endKm}</p></div>
            <div><span className="field-label">Total KM</span><p>{logbook.totalKm}</p></div>
            <div><span className="field-label">Fuel Used</span><p>{logbook.fuelUsedLitres ?? '—'} L</p></div>
            <div><span className="field-label">Remarks</span><p>{logbook.remarks || '—'}</p></div>
            <div><span className="field-label">Approvals</span><p>{logbook.verifiedAt ? `Verified ${new Date(logbook.verifiedAt).toLocaleString()}` : 'Awaiting officer approval'}</p></div>
          </div>
        )}
      </div>

      {fuelHistory.length > 0 && (
        <div className="panel">
          <h3>Fuel Requests for this Trip</h3>
          <table className="data-table">
            <thead><tr><th>Requested (L)</th><th>Calculated (L)</th><th>Status</th></tr></thead>
            <tbody>
              {fuelHistory.map((f) => (
                <tr key={f.id}><td>{f.litresRequested}</td><td>{f.litresCalculated}</td><td><StatusBadge status={f.status} /></td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
