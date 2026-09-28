import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { requestsApi, tripsApi } from '../../services/resources';
import { useAuth } from '../../context/AuthContext';
import RouteMap from '../../components/RouteMap';
import StatusBadge from '../../components/StatusBadge';
import Loading from '../../components/Loading';
import CancelConfirmDialog from '../../components/CancelConfirmDialog';
import RequestTimeline from '../../components/RequestTimeline';
import { useSocket } from '../../utils/useSocket';

const CANCELLED_TERMINAL = ['TRIP_COMPLETED', 'CLOSED', 'CANCELLED', 'R3_REJECTED'];

/* Same rule as the driver End Trip: started, not cancelled, not completed. */
const END_TRIP_STATUSES = ['IN_PROGRESS', 'TRIP_STARTED', 'DRIVER_COMPLETED'];

export default function OfficerRequestDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const [request, setRequest] = useState(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState('');
  const [endKm, setEndKm] = useState('');
  const [ending, setEnding] = useState(false);
  const [endError, setEndError] = useState('');
  const [endSuccess, setEndSuccess] = useState('');

  const socket = useSocket();

  const load = () => requestsApi.get(id).then(setRequest);
  useEffect(() => {
    load().catch((err) => setError(err.response?.data?.message || 'Failed to load request.'));
  }, [id]);

  // Real-time trip completion updates
  useEffect(() => {
    if (!socket || !request?.trip) return;

    const handleTripCompleted = (data) => {
      if (data?.tripId !== request.trip.id) return;
      setRequest((prev) =>
        prev?.trip ? { ...prev, trip: { ...prev.trip, status: data.status, endTime: data.endTime, endKm: data.endKm, totalOdometerKm: data.totalOdometerKm } } : prev
      );
    };

    const handleCompletionConfirmed = (data) => {
      if (data?.tripId !== request.trip.id) return;
      setRequest((prev) =>
        prev?.trip ? { ...prev, trip: { ...prev.trip, status: data.status } } : prev
      );
    };

    socket.on('trip:completed', handleTripCompleted);
    socket.on('trip:completion-confirmed', handleCompletionConfirmed);

    return () => {
      socket.off('trip:completed', handleTripCompleted);
      socket.off('trip:completion-confirmed', handleCompletionConfirmed);
    };
  }, [socket, request?.trip?.id]);

  if (!request) return error ? <div className="form-error">{error}</div> : <Loading />;

  const cancellable = !CANCELLED_TERMINAL.includes(request.status);

  const trip = request.trip || null;
  const officerSide = user?.role === 'OFFICER' || user?.role === 'TRANSPORT_OFFICER';
  const canEndTrip = officerSide && Boolean(trip) && END_TRIP_STATUSES.includes(trip.status);

  const handleCancel = async (reason) => {
    setCancelling(true);
    setError('');
    try {
      await requestsApi.cancel(id, reason);
      setConfirmCancel(false);
      await load();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to cancel.');
      setConfirmCancel(false);
    } finally {
      setCancelling(false);
    }
  };

  /*
   * Officer End Trip on the request page — same shared backend completion
   * workflow (POST /trips/:id/confirm-completion → recordCompletion).
   */
  const handleEndTrip = async (e) => {
    e.preventDefault();
    if (ending) return;
    setEnding(true);
    setEndError('');
    setEndSuccess('');
    try {
      const result = await tripsApi.confirmCompletion(
        trip.id,
        endKm.trim() ? { endKm: Number(endKm) } : {}
      );
      setEndSuccess(result?.message || 'Trip completion recorded.');
      setEndKm('');
      await load();
    } catch (err) {
      setEndError(err.response?.data?.message || 'Failed to end trip.');
    } finally {
      setEnding(false);
    }
  };

  return (
    <div>
      <div className="panel">
        <div className="panel-header">
          <h3>{request.requestNumber}</h3>
          <StatusBadge status={request.status} />
        </div>
        {error && <div className="form-error">{error}</div>}

        <div className="detail-grid">
          <div><span className="field-label">Purpose</span><p>{request.purpose}</p></div>
          <div><span className="field-label">Passengers</span><p>{request.passengers}</p></div>
          <div><span className="field-label">Departure</span><p>{request.departureDate} {request.departureTime}</p></div>
          <div><span className="field-label">Return</span><p>{request.returnDate || '—'} {request.returnTime || ''}</p></div>
          <div><span className="field-label">One-way KM</span><p>{request.oneWayKm ?? '—'}</p></div>
          <div><span className="field-label">Round-trip KM</span><p>{request.roundTripKm ?? '—'}</p></div>
          <div><span className="field-label">Est. Duration</span><p>{request.durationMinutes ? `${Math.round(request.durationMinutes)} min` : '—'}</p></div>
          <div><span className="field-label">Total Fuel</span><p>{request.totalFuelLitres ? `${request.totalFuelLitres} L` : '—'}</p></div>
          <div><span className="field-label">Vehicle</span><p>{request.vehicle ? `${request.vehicle.registrationNumber} — ${request.vehicle.model}` : 'Not yet assigned'}</p></div>
          <div><span className="field-label">Driver</span><p>{request.driver ? request.driver.user.fullName : 'Not yet assigned'}</p></div>
          {request.originName && (
            <div><span className="field-label">Route</span><p>{request.originName} → {request.destinationName}</p></div>
          )}
          <div><span className="field-label">Date</span><p>{request.departureDate || '—'}</p></div>
        </div>

        {request.status === 'CANCELLED' && (
          <div className="panel" style={{ marginTop: 12, background: 'var(--surface-alt, #f9fafb)' }}>
            <span className="field-label">Cancellation Reason</span>
            <p data-testid="cancellation-reason">{request.cancellationReason || '—'}</p>
            <span className="field-label">Cancelled</span>
            <p>
              {request.cancelledAt
                ? new Date(request.cancelledAt).toLocaleString()
                : '—'}
              {request.cancelledByUser?.fullName ? ` by ${request.cancelledByUser.fullName}` : ''}
            </p>
          </div>
        )}

        {cancellable && (
          <button
            type="button"
            className="btn btn-danger"
            style={{ marginTop: 12 }}
            onClick={() => setConfirmCancel(true)}
          >
            Cancel Request
          </button>
        )}
      </div>

      {canEndTrip && (
        <div className="panel" data-testid="officer-end-trip-panel">
          <div className="panel-header">
            <h3>Trip Completion</h3>
            <StatusBadge status={trip.status} />
          </div>

          <p className="field-hint">
            Trip {trip.tripNumber} is active. Ending it records the system
            completion time, updates the trip and request status and is visible
            to the driver immediately — the same completion record is used by
            the driver&apos;s own End Trip action.
          </p>

          {trip.status === 'DRIVER_COMPLETED' && (
            <div className="callout callout-warning">
              The driver has already confirmed completion. Confirm now to
              complete the trip.
            </div>
          )}

          <form onSubmit={handleEndTrip} className="inline-form">
            <div>
              <label className="field-label" htmlFor="request-end-km">
                End KM (odometer)
              </label>
              <input
                id="request-end-km"
                className="input"
                type="number"
                min="0"
                value={endKm}
                onChange={(e) => setEndKm(e.target.value)}
                placeholder="Optional — driver may enter it later"
                disabled={ending}
                data-testid="officer-end-km"
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              disabled={ending}
              data-testid="officer-end-trip-request"
            >
              {ending ? 'Ending…' : 'End Trip'}
            </button>
          </form>

          {endSuccess && (
            <div className="callout callout-success" data-testid="officer-end-trip-success">
              {endSuccess}
            </div>
          )}
          {endError && <div className="form-error">{endError}</div>}
        </div>
      )}

      <div className="panel">
        <h3>Route</h3>
        <RouteMap
          origin={{ lat: request.originLat, lng: request.originLng, name: request.originName }}
          destination={{ lat: request.destinationLat, lng: request.destinationLng, name: request.destinationName }}
          geometry={request.routeGeometry}
        />
      </div>

      <RequestTimeline requestId={request.id} status={request.status} />

      {(request.hpmuRecommendations?.length > 0 || request.r3Approvals?.length > 0) && (
        <div className="panel">
          <h3>Review History</h3>
          {request.hpmuRecommendations?.map((n) => (
            <div key={`n${n.id}`} className="history-item">
              <strong>HPMU — {n.decision}</strong> by {n.reviewer?.fullName}
              {n.comment && <p>{n.comment}</p>}
            </div>
          ))}
          {request.r3Approvals?.map((a) => (
            <div key={`r${a.id}`} className="history-item">
              <strong>R3 — {a.decision}</strong> by {a.reviewer?.fullName}
              {a.comment && <p>{a.comment}</p>}
            </div>
          ))}
        </div>
      )}

      <CancelConfirmDialog
        open={confirmCancel}
        title="Cancel Request?"
        referenceLabel="Request"
        referenceValue={request.requestNumber}
        actionLabel="Cancel Request"
        keepLabel="Keep Request"
        impactNote="This action will cancel the request and notify the relevant users."
        submitting={cancelling}
        onConfirm={handleCancel}
        onCancel={() => setConfirmCancel(false)}
      />
    </div>
  );
}
