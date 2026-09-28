
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { tripsApi } from '../../services/resources';
import DataTable from '../../components/DataTable';
import StatusBadge from '../../components/StatusBadge';
import Loading from '../../components/Loading';
import CancelConfirmDialog from '../../components/CancelConfirmDialog';
import Modal from '../../components/Modal';
import { useSocket } from '../../utils/useSocket';

const TRIP_CANCEL_BLOCKED = ['TRIP_COMPLETED', 'CLOSED', 'CANCELLED', 'DRIVER_CANCELLED'];

/*
 * Same rule as the driver "End Trip" button: the trip must have started and
 * must not be cancelled or already completed.
 */
const END_TRIP_STATUSES = ['IN_PROGRESS', 'TRIP_STARTED', 'DRIVER_COMPLETED'];

const canEndTrip = (trip) => Boolean(trip) && END_TRIP_STATUSES.includes(trip.status);

export default function MyTrips() {
  const [trips, setTrips] = useState(null);
  const [status, setStatus] = useState('');
  const [cancelTrip, setCancelTrip] = useState(null);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState('');

  const [endTrip, setEndTrip] = useState(null);
  const [endKm, setEndKm] = useState('');
  const [ending, setEnding] = useState(false);
  const [endError, setEndError] = useState('');
  const [endSuccess, setEndSuccess] = useState('');

  const socket = useSocket();

  const loadTrips = () =>
    tripsApi
      .list()
      .then((response) => Array.isArray(response) ? response : [])
      .catch((err) => {
        console.error('Failed to load trips:', err);
        return [];
      });

  useEffect(() => {
    let active = true;

    loadTrips().then((list) => {
      if (active) setTrips(list);
    });

    return () => {
      active = false;
    };
  }, []);

  // Real-time trip completion updates
  useEffect(() => {
    if (!socket) return;

    const handleTripCompleted = (data) => {
      if (!data?.tripId) return;
      setTrips((prev) => {
        if (!Array.isArray(prev)) return prev;
        return prev.map((trip) =>
          trip.id === data.tripId
            ? { ...trip, status: data.status, endTime: data.endTime, endKm: data.endKm, totalOdometerKm: data.totalOdometerKm }
            : trip
        );
      });
    };

    const handleCompletionConfirmed = (data) => {
      if (!data?.tripId) return;
      setTrips((prev) => {
        if (!Array.isArray(prev)) return prev;
        return prev.map((trip) =>
          trip.id === data.tripId
            ? { ...trip, status: data.status }
            : trip
        );
      });
    };

    socket.on('trip:completed', handleTripCompleted);
    socket.on('trip:completion-confirmed', handleCompletionConfirmed);

    return () => {
      socket.off('trip:completed', handleTripCompleted);
      socket.off('trip:completion-confirmed', handleCompletionConfirmed);
    };
  }, [socket]);

  const filteredTrips = useMemo(() => {
    if (!Array.isArray(trips)) return [];

    if (!status) {
      return trips;
    }

    return trips.filter((trip) => trip.status === status);
  }, [trips, status]);

  const totalTrips = Array.isArray(trips) ? trips.length : 0;

  const activeTrips = Array.isArray(trips)
    ? trips.filter((trip) =>
        ['IN_PROGRESS', 'TRIP_STARTED', 'DRIVER_ASSIGNED'].includes(
          trip.status
        )
      ).length
    : 0;

  const completedTrips = Array.isArray(trips)
    ? trips.filter((trip) =>
        ['COMPLETED', 'TRIP_COMPLETED', 'CLOSED'].includes(
          trip.status
        )
      ).length
    : 0;

  const statusOptions = [
    'DRIVER_ASSIGNED',
    'TRIP_STARTED',
    'IN_PROGRESS',
    'TRIP_COMPLETED',
    'COMPLETED',
    'CLOSED',
    'CANCELLED',
  ];

  /*
   * Officer-side End Trip.
   * Calls POST /trips/:id/confirm-completion — the SAME shared completion
   * service (recordCompletion) used by the driver's End Trip button, so there
   * is only one authoritative completion record/time per trip.
   */
  const handleEndTrip = async () => {
    if (!endTrip || ending) return;

    setEnding(true);
    setEndError('');

    try {
      const payload = endKm.trim() ? { endKm: Number(endKm) } : {};
      const result = await tripsApi.confirmCompletion(endTrip.id, payload);

      setEndTrip(null);
      setEndKm('');
      setEndSuccess(result?.message || 'Trip completion recorded.');
      setTrips(await loadTrips());
    } catch (err) {
      setEndError(err.response?.data?.message || 'Failed to end trip.');
    } finally {
      setEnding(false);
    }
  };

  if (!trips) {
    return <Loading />;
  }

  return (
    <div className="my-trips-page">

      {/* =====================================================
          PAGE HEADER
      ===================================================== */}
      <div className="my-trips-header">
        <div>
          <span className="page-kicker">OFFICER PORTAL</span>

          <h1>My Trips</h1>

          <p>
            View vehicles, drivers, routes and the current status
            of your trips.
          </p>
        </div>

        <div className="trip-header-badge">
          <span className="trip-header-dot"></span>
          Trip Management
        </div>
      </div>

      {/* =====================================================
          SUMMARY CARDS
      ===================================================== */}
      <div className="trip-summary-grid">

        <div className="trip-summary-card">
          <div className="trip-summary-icon">
            <span>▣</span>
          </div>

          <div>
            <span>Total Trips</span>
            <strong>{totalTrips}</strong>
          </div>
        </div>

        <div className="trip-summary-card">
          <div className="trip-summary-icon active">
            <span>◉</span>
          </div>

          <div>
            <span>Active Trips</span>
            <strong>{activeTrips}</strong>
          </div>
        </div>

        <div className="trip-summary-card">
          <div className="trip-summary-icon completed">
            <span>✓</span>
          </div>

          <div>
            <span>Completed</span>
            <strong>{completedTrips}</strong>
          </div>
        </div>

      </div>

      {/* =====================================================
          MAIN CARD
      ===================================================== */}
      <div className="my-trips-card">

        {/* TOOLBAR */}
        <div className="my-trips-toolbar">

          <div className="trips-toolbar-title">
            <h2>Trip History</h2>

            <span>
              {filteredTrips.length}{' '}
              {filteredTrips.length === 1 ? 'trip' : 'trips'}
            </span>
          </div>

          <div className="trip-filter">
            <label htmlFor="trip-status">
              Status
            </label>

            <select
              id="trip-status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="">All statuses</option>

              {statusOptions.map((item) => (
                <option key={item} value={item}>
                  {item.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* TABLE */}
        <div className="my-trips-table-wrapper">

          <DataTable
            columns={[
              {
                key: 'tripNumber',
                header: 'Trip #',
                render: (trip) => (
                  <span className="trip-number">
                    {trip.tripNumber || `TRIP-${trip.id}`}
                  </span>
                ),
              },

              {
                key: 'vehicle',
                header: 'Vehicle',
                render: (trip) => (
                  <div className="vehicle-cell">
                    <div className="vehicle-icon">
                      🚙
                    </div>

                    <div>
                      <strong>
                        {trip.vehicle?.registrationNumber || '—'}
                      </strong>

                      {trip.vehicle?.make && (
                        <small>
                          {trip.vehicle.make}
                          {trip.vehicle.model
                            ? ` ${trip.vehicle.model}`
                            : ''}
                        </small>
                      )}
                    </div>
                  </div>
                ),
              },

              {
                key: 'driver',
                header: 'Driver',
                render: (trip) => (
                  <div className="driver-cell">
                    <div className="driver-avatar">
                      {(
                        trip.driver?.user?.fullName ||
                        trip.driver?.user?.name ||
                        'D'
                      )
                        .charAt(0)
                        .toUpperCase()}
                    </div>

                    <span>
                      {trip.driver?.user?.fullName ||
                        trip.driver?.user?.name ||
                        'Not assigned'}
                    </span>
                  </div>
                ),
              },

              {
                key: 'route',
                header: 'Route',
                render: (trip) => (
                  <div className="trip-route">
                    <span className="route-location">
                      {trip.request?.originName || 'Origin'}
                    </span>

                    <span className="route-arrow">
                      →
                    </span>

                    <span className="route-location">
                      {trip.request?.destinationName ||
                        'Destination'}
                    </span>
                  </div>
                ),
              },

              {
                key: 'status',
                header: 'Status',
                render: (trip) => (
                  <StatusBadge status={trip.status} />
                ),
              },

              {
                key: 'actions',
                header: '',
                render: (trip) => {
                  const canCancel = !TRIP_CANCEL_BLOCKED.includes(trip.status);
                  return (
                    <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      {['IN_PROGRESS', 'TRIP_STARTED'].includes(trip.status) && (
                        <Link
                          className="track-trip-btn"
                          to={`/officer/trip-tracking/${trip.id}`}
                        >
                          <span>⌖</span>
                          Track
                        </Link>
                      )}
                      {canEndTrip(trip) && (
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          data-testid={`officer-end-trip-${trip.id}`}
                          onClick={() => {
                            setEndTrip(trip);
                            setEndKm('');
                            setEndError('');
                            setEndSuccess('');
                          }}
                        >
                          End Trip
                        </button>
                      )}
                      {canCancel ? (
                        <button
                          type="button"
                          className="link-btn"
                          onClick={() => setCancelTrip(trip)}
                        >
                          Cancel
                        </button>
                      ) : (
                        <span className="trip-no-action">—</span>
                      )}
                    </span>
                  );
                },
              },
            ]}
            rows={filteredTrips}
            emptyMessage={
              status
                ? 'No trips match this status.'
                : 'No trips yet.'
            }
          />
        </div>
      </div>

      <CancelConfirmDialog
        open={Boolean(cancelTrip)}
        title="Cancel Trip?"
        referenceLabel="Trip"
        referenceValue={cancelTrip?.tripNumber || (cancelTrip ? `TRIP-${cancelTrip.id}` : '')}
        actionLabel="Cancel Trip"
        keepLabel="Keep Trip"
        impactNote="This action will cancel the trip, free the vehicle and driver if assigned, and notify the relevant users. The trip history will be preserved."
        submitting={cancelling}
        onConfirm={async (reason) => {
          if (!cancelTrip) return;
          setCancelling(true);
          setError('');
          try {
            await tripsApi.cancel(cancelTrip.id, { reason });
            setCancelTrip(null);
            const response = await tripsApi.list();
            setTrips(Array.isArray(response) ? response : []);
          } catch (err) {
            setError(err.response?.data?.message || 'Failed to cancel trip.');
            setCancelTrip(null);
          } finally {
            setCancelling(false);
          }
        }}
        onCancel={() => setCancelTrip(null)}
      />

      {/* =====================================================
          END TRIP (shares the driver's completion workflow)
      ===================================================== */}
      <Modal
        open={Boolean(endTrip)}
        title="End Trip?"
        onClose={() => {
          if (!ending) setEndTrip(null);
        }}
        footer={
          <div className="modal-footer">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setEndTrip(null)}
              disabled={ending}
            >
              Keep Trip Active
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleEndTrip}
              disabled={ending}
              data-testid="officer-end-trip-confirm"
            >
              {ending ? 'Ending…' : 'End Trip'}
            </button>
          </div>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <p style={{ margin: 0 }}>
            Trip: <strong>{endTrip?.tripNumber || (endTrip ? `TRIP-${endTrip.id}` : '')}</strong>
          </p>

          <p style={{ margin: 0 }}>
            Ending this trip records the system completion time and updates the
            trip and request status. The driver will see the completed trip
            immediately, and the same completion record is used by the driver's
            own End Trip action.
          </p>

          <div>
            <label className="field-label" htmlFor="officer-end-km">
              End KM (odometer) — optional
            </label>
            <input
              id="officer-end-km"
              className="input"
              type="number"
              min="0"
              value={endKm}
              onChange={(e) => {
                setEndKm(e.target.value);
                if (endError) setEndError('');
              }}
              placeholder="e.g. 124500"
              disabled={ending}
              data-testid="officer-end-km"
            />
            <span className="field-hint">
              Leave blank if the driver will enter the ending odometer later.
            </span>
          </div>

          {endTrip?.status === 'DRIVER_COMPLETED' && (
            <div className="callout callout-warning" style={{ margin: 0 }}>
              The driver has already confirmed completion. Ending the trip now
              will complete it.
            </div>
          )}

          {endError && <div className="form-error">{endError}</div>}
        </div>
      </Modal>

      {endSuccess && (
        <div className="callout callout-success" data-testid="officer-end-trip-success" style={{ marginTop: 12 }}>
          {endSuccess}
        </div>
      )}
      {error && <div className="form-error" style={{ marginTop: 12 }}>{error}</div>}
    </div>
  );
}
