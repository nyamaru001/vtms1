
import { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

import { tripsApi, fuelApi } from '../../services/resources';
import TripTracker from '../../components/TripTracker';
import StatusBadge from '../../components/StatusBadge';
import ProgressBar from '../../components/ProgressBar';
import Loading from '../../components/Loading';
import ConfirmDialog from '../../components/ConfirmDialog';
import CancelConfirmDialog from '../../components/CancelConfirmDialog';

const TRIP_CANCEL_BLOCKED = ['TRIP_COMPLETED', 'CLOSED', 'CANCELLED', 'DRIVER_CANCELLED'];

export default function TripTracking() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [trip, setTrip] = useState(null);
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);
  const [extraFuelOpen, setExtraFuelOpen] = useState(false);
  const [extraFuelLitres, setExtraFuelLitres] = useState('');
  const [extraFuelReason, setExtraFuelReason] = useState('');
  const [extraFuelLocation, setExtraFuelLocation] = useState('');
  const [extraFuelSubmitting, setExtraFuelSubmitting] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [endKm, setEndKm] = useState('');
  const [confirmMsg, setConfirmMsg] = useState('');
  const [confirming, setConfirming] = useState(false);

  /* =========================================================
     LOAD TRIP
  ========================================================= */
  const loadTrip = useCallback(async (tripId) => {
    try {
      const response = await tripsApi.get(tripId);
      const result = response?.data ?? response;

      if (!result) {
        throw new Error('Trip was not found.');
      }

      setTrip(result);
      setLastUpdated(new Date());
      setError('');
    } catch (err) {
      console.error('Failed to load trip:', err);

      setError(
        err?.response?.data?.message ||
          err?.message ||
          'Failed to load trip information.'
      );
    }
  }, []);

  /* =========================================================
     LOAD PROGRESS
  ========================================================= */
  const loadProgress = useCallback(async (tripId) => {
    try {
      const response = await tripsApi.progress(tripId);
      const result = response?.data ?? response;

      if (result) {
        setProgress(result);
      }
    } catch (err) {
      console.error('Failed to load trip progress:', err);
    }
  }, []);

  /* =========================================================
     INITIAL LOAD
  ========================================================= */
  useEffect(() => {
    let mounted = true;

    const initialize = async () => {
      try {
        setError('');

        /* -----------------------------------------------
           Trip ID exists
        ------------------------------------------------ */
        if (id) {
          await Promise.all([
            loadTrip(id),
            loadProgress(id),
          ]);

          return;
        }

        /* -----------------------------------------------
           No ID - find active trip
        ------------------------------------------------ */
        const response = await tripsApi.list();

        const trips = Array.isArray(response)
          ? response
          : response?.data || [];

        const activeTrip = trips.find((item) =>
          [
            'IN_PROGRESS',
            'TRIP_STARTED',
            'DRIVER_ASSIGNED',
          ].includes(item.status)
        );

        if (!mounted) return;

        if (activeTrip?.id) {
          navigate(
            `/officer/trip-tracking/${activeTrip.id}`,
            { replace: true }
          );
        } else {
          setTrip(false);
        }
      } catch (err) {
        console.error(
          'Failed to initialize trip tracking:',
          err
        );

        if (mounted) {
          setError(
            err?.response?.data?.message ||
              'Unable to load trip tracking.'
          );

          setTrip(false);
        }
      }
    };

    initialize();

    return () => {
      mounted = false;
    };
  }, [id, navigate, loadTrip, loadProgress]);

/* =========================================================
      AUTO REFRESH
   ========================================================= */
  useEffect(() => {
    if (!id || !trip || trip === false) {
      return undefined;
    }

    const interval = setInterval(() => {
      loadTrip(id);
      loadProgress(id);
    }, 15000);

    return () => clearInterval(interval);
  }, [id, trip?.status, loadTrip, loadProgress]);

  /* =========================================================
      EXTRA FUEL REQUEST
   ========================================================= */
  const handleExtraFuel = async () => {
    setError('');
    if (!extraFuelLitres || Number(extraFuelLitres) <= 0) {
      setError('Enter valid litres.');
      return;
    }
    if (!extraFuelReason.trim()) {
      setError('Reason is required.');
      return;
    }
    setExtraFuelSubmitting(true);
    try {
      await fuelApi.createExtra({
        tripId: trip.id,
        requestedLitres: Number(extraFuelLitres),
        reason: extraFuelReason.trim(),
        currentLocationName: extraFuelLocation.trim() || null,
      });
      setExtraFuelOpen(false);
      setExtraFuelLitres('');
      setExtraFuelReason('');
      setExtraFuelLocation('');
      await loadTrip(id);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to request extra fuel.');
    } finally {
      setExtraFuelSubmitting(false);
    }
  };

  /* =========================================================
     LOADING
  ========================================================= */
  if (trip === null) {
    return <Loading />;
  }

  /* =========================================================
     NO ACTIVE TRIP
  ========================================================= */
  if (trip === false) {
    return (
      <div className="trip-tracking-page">
        <div className="tracking-empty-card">
          <div className="tracking-empty-icon">
            ⌖
          </div>

          <h2>No Active Trip</h2>

          <p>
            You currently have no active trip being tracked.
          </p>

          <button
            type="button"
            className="tracking-button"
            onClick={() => navigate('/officer/trips')}
          >
            ← Back to My Trips
          </button>
        </div>
      </div>
    );
  }

  /* =========================================================
     DATA HELPERS
  ========================================================= */
  const tripNumber =
    trip.tripNumber || `TRIP-${trip.id}`;

  const origin =
    trip.request?.originName ||
    trip.originName ||
    'Origin';

  const destination =
    trip.request?.destinationName ||
    trip.destinationName ||
    'Destination';

  const vehicle =
    trip.vehicle?.registrationNumber ||
    trip.vehicle?.plateNumber ||
    'Not assigned';

  const driver =
    trip.driver?.user?.fullName ||
    trip.driver?.user?.name ||
    trip.driver?.name ||
    'Not assigned';

  const totalKm = Number(
    progress?.totalKm ??
      trip.request?.oneWayKm ??
      trip.totalKm ??
      0
  );

  const completedKm = Number(
    progress?.completedKm ?? 0
  );

  const remainingKm = Number(
    progress?.remainingKm ??
      Math.max(totalKm - completedKm, 0)
  );

  const percent = Math.min(
    100,
    Math.max(
      0,
      Number(progress?.percent ?? 0)
    )
  );

  const isLive = [
    'IN_PROGRESS',
    'TRIP_STARTED',
  ].includes(trip.status);

  return (
    <div className="trip-tracking-page">

      {/* =====================================================
          HEADER
      ===================================================== */}
      <div className="tracking-header">

        <div>
          <span className="tracking-kicker">
            OFFICER PORTAL
          </span>

          <div className="tracking-title">
            <h1>{tripNumber}</h1>

            <StatusBadge status={trip.status} />
          </div>

          <p>
            Monitor the vehicle location and trip progress.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {!TRIP_CANCEL_BLOCKED.includes(trip.status) && (
            <button
              type="button"
              className="btn btn-danger"
              onClick={() => setCancelOpen(true)}
            >
              Cancel Trip
            </button>
          )}
          <button
            type="button"
            className="tracking-button secondary"
            onClick={() => navigate('/officer/trips')}
          >
            ← My Trips
          </button>
        </div>
      </div>

      {/* =====================================================
          LIVE BAR
      ===================================================== */}
      <div className="tracking-live-bar">

        <div className="tracking-live-info">
          <span
            className={`tracking-live-dot ${
              isLive ? 'active' : 'inactive'
            }`}
          />

          <div>
            <strong>
              {isLive
                ? 'Live Trip Tracking'
                : 'Trip Tracking'}
            </strong>

            <span>
              {isLive
                ? 'Vehicle location is being monitored'
                : 'Live movement is not currently active'}
            </span>
          </div>
        </div>

        <div className="tracking-last-update">
          <span>Last updated</span>

          <strong>
            {lastUpdated
              ? lastUpdated.toLocaleTimeString()
              : '—'}
          </strong>
        </div>
      </div>

      {/* =====================================================
          TRIP INFORMATION
      ===================================================== */}
      <div className="tracking-info-grid">

        <div className="tracking-info-card">
          <span>VEHICLE</span>
          <strong>{vehicle}</strong>
        </div>

        <div className="tracking-info-card">
          <span>DRIVER</span>
          <strong>{driver}</strong>
        </div>

        <div className="tracking-info-card route-card">
          <span>ROUTE</span>

          <div className="tracking-route">
            <strong>{origin}</strong>

            <b>→</b>

            <strong>{destination}</strong>
          </div>
        </div>
      </div>

      {/* =====================================================
          PROGRESS
      ===================================================== */}
      {progress && (
        <div className="tracking-progress-card">

          <div className="tracking-progress-header">

            <div>
              <span>JOURNEY PROGRESS</span>
              <h2>Trip Progress</h2>
            </div>

            <strong>
              {Math.round(percent)}%
            </strong>
          </div>

          <ProgressBar
            percent={percent}
            completedKm={completedKm}
            remainingKm={remainingKm}
            totalKm={totalKm}
          />

          <div className="tracking-distance-grid">

            <div>
              <span>Completed</span>
              <strong>
                {completedKm.toFixed(1)} km
              </strong>
            </div>

            <div>
              <span>Remaining</span>
              <strong>
                {remainingKm.toFixed(1)} km
              </strong>
            </div>

            <div>
              <span>Total</span>
              <strong>
                {totalKm.toFixed(1)} km
              </strong>
            </div>

          </div>
        </div>
      )}

      {/* =====================================================
          MAP / LIVE TRACKING
      ===================================================== */}
      <div className="tracking-map-card">

        <div className="tracking-map-header">

          <div>
            <span>LIVE LOCATION</span>
            <h2>Vehicle Tracking</h2>
          </div>

          {isLive && (
            <div className="map-live-badge">
              <span />
              LIVE
            </div>
          )}

          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setExtraFuelOpen(true)}
            style={{ marginLeft: 12 }}
          >
            ⛽ Extra Fuel
          </button>
        </div>

        <div className="tracking-map">
          <TripTracker trip={trip} />
        </div>

        <div className="tracking-map-footer">
          <span>
            <i />
            Vehicle location
          </span>

          <span>
            Automatic updates
          </span>
        </div>
      </div>

      {/* Dual trip completion confirmation (Officer) */}
      {['IN_PROGRESS', 'TRIP_STARTED', 'DRIVER_COMPLETED'].includes(trip.status) && (
        <div className="tracking-info-card" data-testid="officer-confirm-panel" style={{ marginBottom: 16 }}>
          <span>TRIP COMPLETION</span>
          <strong>
            {trip.status === 'DRIVER_COMPLETED'
              ? 'Driver has confirmed completion. Officer confirmation required.'
              : 'Confirm completion after the driver confirms (or confirm first).'}
          </strong>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!endKm && trip.status !== 'DRIVER_COMPLETED') {
                setError('Please enter ending KM.');
                return;
              }
              setConfirming(true);
              setError('');
              setConfirmMsg('');
              try {
                const res = await tripsApi.confirmCompletion(trip.id, {
                  endKm: endKm ? Number(endKm) : undefined,
                  notes: undefined,
                });
                setConfirmMsg(res?.message || '');
                setEndKm('');
                await loadTrip(id);
              } catch (err) {
                setError(err.response?.data?.message || 'Failed to confirm completion.');
              } finally {
                setConfirming(false);
              }
            }}
            style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}
          >
            <label className="field-label" style={{ margin: 0 }}>
              End KM (odometer)
              <input
                className="input"
                type="number"
                value={endKm}
                onChange={(e) => setEndKm(e.target.value)}
                style={{ display: 'block', marginTop: 4 }}
                required={trip.status !== 'DRIVER_COMPLETED'}
              />
            </label>
            <button className="btn btn-primary" type="submit" disabled={confirming} data-testid="officer-confirm-btn">
              {confirming ? 'Confirming…' : trip.status === 'DRIVER_COMPLETED' ? 'Confirm & Complete Trip' : 'End Trip (Officer)'}
            </button>
          </form>
          {confirmMsg && (
            <div className="callout callout-success" data-testid="officer-confirm-msg" style={{ marginTop: 8 }}>{confirmMsg}</div>
          )}
        </div>
      )}

      {['DRIVER_COMPLETED', 'OFFICER_COMPLETED'].includes(trip.status) && (
        <div className="callout" data-testid="dual-confirm-status" style={{ marginBottom: 16 }}>
          <strong>Dual confirmation in progress</strong>
          <p>
            {trip.status === 'DRIVER_COMPLETED'
              ? 'Waiting for officer confirmation.'
              : 'Waiting for driver confirmation.'}
          </p>
        </div>
      )}

      {/* =====================================================
          EXTRA FUEL REQUEST
      ===================================================== */}
      {isLive && (
        <ConfirmDialog
          open={extraFuelOpen}
          title="Request Extra Fuel"
          message="Request additional fuel for this active trip. HPMU will review and release."
          confirmLabel="Submit Request"
          onConfirm={handleExtraFuel}
          onCancel={() => setExtraFuelOpen(false)}
          customContent={
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label className="field-label">Requested Litres *</label>
                <input
                  className="input"
                  type="number"
                  min="0.1"
                  step="0.1"
                  value={extraFuelLitres}
                  onChange={(e) => setExtraFuelLitres(e.target.value)}
                  placeholder="e.g. 20"
                />
              </div>
              <div>
                <label className="field-label">Reason *</label>
                <input
                  className="input"
                  type="text"
                  value={extraFuelReason}
                  onChange={(e) => setExtraFuelReason(e.target.value)}
                  placeholder="Why is additional fuel required?"
                />
              </div>
              <div>
                <label className="field-label">Current Location (optional)</label>
                <input
                  className="input"
                  type="text"
                  value={extraFuelLocation}
                  onChange={(e) => setExtraFuelLocation(e.target.value)}
                  placeholder="Current location or landmark"
                />
              </div>
            </div>
          }
        />
      )}

      <CancelConfirmDialog
        open={cancelOpen}
        title="Cancel Trip?"
        referenceLabel="Trip"
        referenceValue={tripNumber}
        actionLabel="Cancel Trip"
        keepLabel="Keep Trip"
        impactNote="This action will cancel the trip (including emergency termination if already started), free the vehicle and driver, and notify the relevant users. Trip history will be preserved."
        submitting={cancelling}
        onConfirm={async (reason) => {
          setCancelling(true);
          setError('');
          try {
            await tripsApi.cancel(trip.id, { reason });
            setCancelOpen(false);
            await loadTrip(id);
            await loadProgress(id);
          } catch (err) {
            setError(err.response?.data?.message || 'Failed to cancel trip.');
            setCancelOpen(false);
          } finally {
            setCancelling(false);
          }
        }}
        onCancel={() => setCancelOpen(false)}
      />

      {/* =====================================================
          ERROR
      ===================================================== */}
      {error && (
        <div className="tracking-error">
          <span>!</span>
          {error}
        </div>
      )}
    </div>
  );
}
