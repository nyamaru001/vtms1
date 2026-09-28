import { useEffect, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { tripsApi } from '../../services/resources';
import RouteMap from '../../components/RouteMap';
import StatusBadge from '../../components/StatusBadge';
import Loading from '../../components/Loading';
import ProgressBar from '../../components/ProgressBar';
import { useSocket } from '../../utils/useSocket';
import ConfirmDialog from '../../components/ConfirmDialog';
import Modal from '../../components/Modal';

const REJECT_REASONS = [
  'Sick',
  'Leave',
  'Vehicle problem',
  'Emergency',
  'Personal matter',
  'Other',
];

export default function DriverTripDetail() {
  const { id } = useParams();
  const [trip, setTrip] = useState(null);
  const [progress, setProgress] = useState(null);
  const [startKm, setStartKm] = useState('');
  const [endKm, setEndKm] = useState('');
  const [error, setError] = useState('');
  const [comparison, setComparison] = useState(null);
  const [successMsg, setSuccessMsg] = useState('');
  const [acceptOpen, setAcceptOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectCustomReason, setRejectCustomReason] = useState('');
  const [rejectNotes, setRejectNotes] = useState('');
  const [eventOpen, setEventOpen] = useState(false);
  const [eventType, setEventType] = useState('ROUTE_CHANGE');
  const [eventLocation, setEventLocation] = useState('');
  const [eventReason, setEventReason] = useState('');
  const [eventNotes, setEventNotes] = useState('');
  const watchId = useRef(null);
  const socket = useSocket();

  const load = () => {
    tripsApi.get(id).then(setTrip);
    tripsApi.progress(id).then(setProgress).catch(() => {});
  };
  useEffect(() => { load(); }, [id]);

  useEffect(() => {
    if (!trip || trip.status !== 'IN_PROGRESS') return;
    const interval = setInterval(() => {
      tripsApi.progress(id).then(setProgress).catch(() => {});
    }, 15000);
    return () => clearInterval(interval);
  }, [trip, id]);

  useEffect(() => {
    return () => {
      if (watchId.current != null) navigator.geolocation.clearWatch(watchId.current);
    };
  }, []);

  // Real-time trip completion updates
  useEffect(() => {
    if (!socket || !trip) return;

    const handleTripCompleted = (data) => {
      if (data?.tripId !== trip.id) return;
      setTrip((prev) =>
        prev ? { ...prev, status: data.status, endTime: data.endTime, endKm: data.endKm, totalOdometerKm: data.totalOdometerKm } : prev
      );
      if (watchId.current != null) navigator.geolocation.clearWatch(watchId.current);
    };

    const handleCompletionConfirmed = (data) => {
      if (data?.tripId !== trip.id) return;
      setTrip((prev) => (prev ? { ...prev, status: data.status } : prev));
    };

    socket.on('trip:completed', handleTripCompleted);
    socket.on('trip:completion-confirmed', handleCompletionConfirmed);

    return () => {
      socket.off('trip:completed', handleTripCompleted);
      socket.off('trip:completion-confirmed', handleCompletionConfirmed);
    };
  }, [socket, trip?.id]);

  if (!trip) return <Loading />;

  const startGpsTracking = () => {
    if (!('geolocation' in navigator)) return;
    watchId.current = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        tripsApi.updateLocation(trip.id, { latitude, longitude });
        socket?.emit('trip:location:update', { tripId: trip.id, latitude, longitude });
      },
      (err) => console.warn('GPS error', err.message),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
    );
  };

  const handleStart = async (e) => {
    e.preventDefault();
    setError('');
    if (!startKm) return setError('Please enter the starting KM.');
    const vehicleOdometer = Number(trip.vehicle?.currentOdometer || 0);
    if (vehicleOdometer && Number(startKm) < vehicleOdometer) {
      return setError(`Starting odometer cannot be less than the vehicle's latest odometer (${vehicleOdometer} KM).`);
    }
    try {
      let coords = {};
      if ('geolocation' in navigator) {
        await new Promise((resolve) => {
          navigator.geolocation.getCurrentPosition(
            (pos) => { coords = { startLat: pos.coords.latitude, startLng: pos.coords.longitude }; resolve(); },
            () => resolve(),
            { timeout: 5000 }
          );
        });
      }
      await tripsApi.start(trip.id, { startKm: Number(startKm), ...coords });
      startGpsTracking();
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to start trip.');
    }
  };

  const handleEmergencyStart = async () => {
    setError('');
    if (!startKm) return setError('Please enter the starting KM.');
    if (!rejectReason) return setError('Emergency reason is required.');
    try {
      let coords = {};
      if ('geolocation' in navigator) {
        await new Promise((resolve) => {
          navigator.geolocation.getCurrentPosition(
            (pos) => { coords = { startLat: pos.coords.latitude, startLng: pos.coords.longitude }; resolve(); },
            () => resolve(),
            { timeout: 5000 }
          );
        });
      }
      await tripsApi.emergencyStart(trip.id, {
        startKm: Number(startKm),
        emergencyReason: rejectReason === 'Other' ? rejectCustomReason : rejectReason,
        emergencyNotes: rejectNotes.trim(),
        ...coords,
      });
      startGpsTracking();
      setRejectOpen(false);
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to start emergency trip.');
    }
  };

  const handleComplete = async (e) => {
    e.preventDefault();
    setError('');
    if (!endKm) return setError('Please enter the ending KM.');
    try {
      const res = await tripsApi.complete(trip.id, { endKm: Number(endKm) });
      setComparison(res.comparison);
      if (watchId.current != null) navigator.geolocation.clearWatch(watchId.current);
      setSuccessMsg(res.message || '');
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to confirm completion.');
    }
  };

  const handleAccept = async () => {
    setError('');
    try {
      await tripsApi.accept(trip.id);
      setAcceptOpen(false);
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to accept assignment.');
    }
  };

  const handleReject = async () => {
    setError('');
    if (!rejectReason) {
      setError('Please select a rejection reason.');
      return;
    }
    if (rejectReason === 'Other' && !rejectCustomReason.trim()) {
      setError('Please provide a custom reason.');
      return;
    }
    try {
      const finalReason = rejectReason === 'Other' ? rejectCustomReason.trim() : rejectReason;
            await tripsApi.rejectAssignment(trip.id, {
        reason: finalReason,
        notes: rejectNotes.trim(),
      });
      setRejectOpen(false);
      setRejectReason('');
      setRejectCustomReason('');
      setRejectNotes('');
      setError('');
      // stay and reload so user sees TRANSPORT_REVIEW handoff message
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to reject assignment.');
    }
  };

  const handleTripEvent = async () => {
    setError('');
    if (!eventReason.trim()) {
      setError('Please provide the reason for the trip change.');
      return;
    }
    try {
      let coords = {};
      if ('geolocation' in navigator) {
        await new Promise((resolve) => {
          navigator.geolocation.getCurrentPosition(
            (pos) => { coords = { latitude: pos.coords.latitude, longitude: pos.coords.longitude }; resolve(); },
            () => resolve(),
            { timeout: 5000 }
          );
        });
      }
      await tripsApi.reportEvent(trip.id, {
        type: eventType,
        locationName: eventLocation.trim() || undefined,
        reason: eventReason.trim(),
        notes: eventNotes.trim() || undefined,
        ...coords,
      });
      setEventOpen(false);
      setEventLocation('');
      setEventReason('');
      setEventNotes('');
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to report trip change.');
    }
  };

  const renderTripInfo = () => (
    <div className="detail-grid">
      <div><span className="field-label">Request</span><p>{trip.request?.requestNumber || `REQ #${trip.requestId}`}</p></div>
      <div><span className="field-label">Vehicle</span><p>{trip.vehicle?.registrationNumber} — {trip.vehicle?.model}</p></div>
      <div><span className="field-label">Officer</span><p>{trip.officer?.fullName} ({trip.officer?.phone})</p></div>
      <div><span className="field-label">From</span><p>{trip.request?.originName}</p></div>
      <div><span className="field-label">To</span><p>{trip.request?.destinationName}</p></div>
      <div><span className="field-label">Purpose</span><p>{trip.request?.purpose}</p></div>
      <div><span className="field-label">Distance</span><p>{trip.request?.roundTripKm} KM (round-trip)</p></div>
      <div><span className="field-label">Departure</span><p>{trip.request?.departureDate} {trip.request?.departureTime}</p></div>
      <div><span className="field-label">Return</span><p>{trip.request?.returnDate || '—'} {trip.request?.returnTime || ''}</p></div>
      <div><span className="field-label">Fuel Allocated</span><p>{trip.request?.totalFuelLitres} L</p></div>
      {trip.tripType === 'EMERGENCY' && (
        <div><span className="field-label">Trip Type</span><p><span className="status-badge status-emergency">EMERGENCY</span></p></div>
      )}
      {trip.emergencyReason && (
        <div><span className="field-label">Emergency Reason</span><p>{trip.emergencyReason}</p></div>
      )}
    </div>
  );

  return (
    <div>
      <div className="panel">
        <div className="panel-header">
          <h3>Trip {trip.tripNumber}</h3>
          <StatusBadge status={trip.status} />
        </div>

        {renderTripInfo()}

        {error && <div className="form-error">{error}</div>}
        {successMsg && <div className="callout callout-success" data-testid="completion-message">{successMsg}</div>}

        {trip.status === 'IN_PROGRESS' && progress && (
          <ProgressBar
            percent={progress.percent}
            completedKm={progress.completedKm}
            remainingKm={progress.remainingKm}
            totalKm={trip.request.oneWayKm}
          />
        )}

        {['NOT_STARTED', 'DRIVER_ACCEPTED', 'DRIVER_ASSIGNED'].includes(trip.status) && (
          <form onSubmit={handleStart} className="inline-form">
            <div>
              <label className="field-label">Start KM (odometer)</label>
              <input className="input" type="number" value={startKm} onChange={(e) => setStartKm(e.target.value)} required />
            </div>
            <button className="btn btn-primary" type="submit">Start Trip</button>
          </form>
        )}

        {trip.status === 'DRIVER_ASSIGNED' && (
          <div className="row-actions">
            <button className="btn btn-success" onClick={() => setAcceptOpen(true)}>Accept Assignment</button>
            <button className="btn btn-danger" onClick={() => { setRejectOpen(true); }}>Reject Assignment</button>
          </div>
        )}

        {trip.status === 'DRIVER_ACCEPTED' && (
          <div className="row-actions" style={{ flexWrap: 'wrap', gap: 8 }}>
            <Link className="btn btn-primary" to={`/driver/fuel?tripId=${trip.id}`}>Request Fuel</Link>
            <Link className="btn btn-secondary" to={`/driver/logbook?tripId=${trip.id}&edit=1`}>Fill Pre-Trip Logbook</Link>
          </div>
        )}

        {['DRIVER_ACCEPTED', 'IN_PROGRESS'].includes(trip.status) && (
          <div className="trip-event-card">
            <div>
              <span className="eyebrow">TRIP FLEXIBILITY</span>
              <strong>Need to change route or stop?</strong>
              <p>Continue the trip when operational circumstances require it, but record the reason and current location.</p>
            </div>
            <button className="btn btn-secondary" onClick={() => setEventOpen(true)}>Report Trip Change</button>
          </div>
        )}

        {['IN_PROGRESS', 'TRIP_STARTED', 'OFFICER_COMPLETED'].includes(trip.status) && (
          <>
            <p className="field-hint">
              Location sharing is active while this trip is in progress.
              Completion requires confirmation from both the driver and the officer.
            </p>
            {trip.status === 'OFFICER_COMPLETED' && (
              <div className="callout callout-warning" data-testid="awaiting-driver-confirm">
                <strong>Officer has confirmed completion.</strong>
                <p>Please enter ending KM and confirm to complete the trip.</p>
              </div>
            )}
            <form onSubmit={handleComplete} className="inline-form">
              <div>
                <label className="field-label">End KM (odometer)</label>
                <input className="input" type="number" value={endKm} onChange={(e) => setEndKm(e.target.value)} required />
              </div>
              <button className="btn btn-primary" data-testid="confirm-completion-btn">
                {trip.status === 'OFFICER_COMPLETED' ? 'Confirm & Complete Trip' : 'End Trip (Driver)'}
              </button>
            </form>
            <Link className="btn btn-secondary" to={`/driver/fuel/additional?tripId=${trip.id}`} style={{ marginTop: 8, display: 'inline-block' }}>
              Request Additional Fuel
            </Link>
          </>
        )}

        {trip.status === 'DRIVER_COMPLETED' && (
          <div className="callout" data-testid="awaiting-officer-confirm">
            <strong>Driver completion recorded.</strong>
            <p>Waiting for the officer to confirm completion. You can update ending KM if needed.</p>
            <form onSubmit={handleComplete} className="inline-form" style={{ marginTop: 8 }}>
              <div>
                <label className="field-label">End KM (odometer)</label>
                <input className="input" type="number" value={endKm} onChange={(e) => setEndKm(e.target.value)} />
              </div>
              <button className="btn btn-secondary" type="submit">Update End KM</button>
            </form>
          </div>
        )}

        {(comparison || ['DRIVER_COMPLETED', 'OFFICER_COMPLETED', 'TRIP_COMPLETED'].includes(trip.status)) && (
          <div className="callout">
            <strong>
              {trip.status === 'TRIP_COMPLETED'
                ? 'Trip completed — both parties confirmed.'
                : trip.status === 'DRIVER_COMPLETED'
                  ? 'Waiting for officer confirmation.'
                  : trip.status === 'OFFICER_COMPLETED'
                    ? 'Waiting for driver confirmation.'
                    : 'Trip completed.'}
            </strong>
            {comparison && (
              <p>Route KM: {comparison.routeKm} · Odometer KM: {comparison.odometerKm} · Difference: {comparison.differenceKm}</p>
            )}
          </div>
        )}

        {['TRIP_COMPLETED', 'CLOSED'].includes(trip.status) && (
          <div className="row-actions">
            <Link
              className="btn btn-primary"
              to={`/driver/logbook?tripId=${trip.id}&edit=1`}
            >
              Fill Post-Trip Logbook
            </Link>
          </div>
        )}

        <Modal
          open={eventOpen}
          title="Report Trip Change / Challenge"
          onClose={() => setEventOpen(false)}
          footer={
            <>
              <button className="btn btn-ghost" onClick={() => setEventOpen(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleTripEvent}>Save Trip Update</button>
            </>
          }
        >
          <div className="form-grid">
            <div>
              <label className="field-label">Type</label>
              <select className="input" value={eventType} onChange={(e) => setEventType(e.target.value)}>
                <option value="ROUTE_CHANGE">Route change</option>
                <option value="UNPLANNED_STOP">Unplanned stop</option>
                <option value="BREAKDOWN">Vehicle breakdown</option>
                <option value="INCIDENT">Incident</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
            <div>
              <label className="field-label">Current / New Location</label>
              <input className="input" value={eventLocation} onChange={(e) => setEventLocation(e.target.value)} placeholder="e.g. Kahama" />
            </div>
            <div className="form-grid-full">
              <label className="field-label">Reason *</label>
              <textarea className="input" rows="4" value={eventReason} onChange={(e) => setEventReason(e.target.value)} placeholder="Explain why the planned route or stop changed..." />
            </div>
            <div className="form-grid-full">
              <label className="field-label">Additional Notes</label>
              <textarea className="input" rows="3" value={eventNotes} onChange={(e) => setEventNotes(e.target.value)} />
            </div>
          </div>
        </Modal>

        <ConfirmDialog
          open={acceptOpen}
          title="Accept Assignment"
          message="Are you sure you want to accept this vehicle assignment?"
          confirmLabel="Accept Assignment"
          onConfirm={handleAccept}
          onCancel={() => setAcceptOpen(false)}
        />

        <Modal
          open={rejectOpen}
          title="Reject Assignment"
          onClose={() => { setRejectOpen(false); setRejectReason(''); setRejectCustomReason(''); setRejectNotes(''); setError(''); }}
          footer={
            <>
              <button className="btn btn-ghost" onClick={() => { setRejectOpen(false); setRejectReason(''); setRejectCustomReason(''); setRejectNotes(''); }}>Cancel</button>
              <button className="btn btn-danger" onClick={handleReject}>Reject Assignment</button>
            </>
          }
        >
          <div className="form-grid">
            <div className="form-grid-full">
              <label className="field-label">Reason for Rejection *</label>
              <select className="input" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)}>
                <option value="">Select a reason...</option>
                {REJECT_REASONS.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>

            {rejectReason === 'Other' && (
              <div className="form-grid-full">
                <label className="field-label">Custom Reason *</label>
                <textarea
                  className="input"
                  rows="3"
                  value={rejectCustomReason}
                  onChange={(e) => setRejectCustomReason(e.target.value)}
                  placeholder="Please describe the reason..."
                />
              </div>
            )}

            <div className="form-grid-full">
              <label className="field-label">Additional Notes (optional)</label>
              <textarea
                className="input"
                rows="3"
                value={rejectNotes}
                onChange={(e) => setRejectNotes(e.target.value)}
                placeholder="Any additional details..."
              />
            </div>
          </div>
        </Modal>
      </div>

      <div className="panel">
        <h3>Route</h3>
        <RouteMap
          origin={{ lat: trip.request.originLat, lng: trip.request.originLng, name: trip.request.originName }}
          destination={{ lat: trip.request.destinationLat, lng: trip.request.destinationLng, name: trip.request.destinationName }}
          geometry={trip.request.routeGeometry}
        />
      </div>
    </div>
  );
}
