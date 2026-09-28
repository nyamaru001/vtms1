import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { tripsApi, fuelApi } from '../../services/resources';
import Loading from '../../components/Loading';

export default function AdditionalFuelRequestForm() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const tripIdFromQuery = params.get('tripId');

  const [trips, setTrips] = useState([]);
  const [tripId, setTripId] = useState(tripIdFromQuery || '');

  const [currentLocationName, setCurrentLocationName] = useState('');
  const [routeIfChanged, setRouteIfChanged] = useState('');
  const [currentKm, setCurrentKm] = useState('');
  const [fuelRemaining, setFuelRemaining] = useState('');
  const [requestedLitres, setRequestedLitres] = useState('');
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');

  const [loadingTrips, setLoadingTrips] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let mounted = true;

    const loadTrips = async () => {
      try {
        setLoadingTrips(true);
        setError('');

        const response = await tripsApi.list();
        const data = Array.isArray(response)
          ? response
          : response?.data || response?.trips || [];

        const activeTrips = data.filter((trip) =>
          ['TRIP_STARTED', 'IN_PROGRESS'].includes(String(trip.status || '').toUpperCase())
        );

        if (mounted) {
          setTrips(activeTrips);

          if (tripIdFromQuery && activeTrips.some((t) => String(t.id) === String(tripIdFromQuery))) {
            setTripId(String(tripIdFromQuery));
          } else if (!tripIdFromQuery && activeTrips.length === 1) {
            setTripId(String(activeTrips[0].id));
          }
        }
      } catch (err) {
        if (mounted) {
          setError(err.response?.data?.message || 'Failed to load your active trips.');
        }
      } finally {
        if (mounted) setLoadingTrips(false);
      }
    };

    loadTrips();
    return () => { mounted = false; };
  }, [tripIdFromQuery]);

  const selectedTrip = useMemo(
    () => trips.find((t) => String(t.id) === String(tripId)),
    [trips, tripId]
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!selectedTrip) {
      setError('Please select one of your active trips.');
      return;
    }
    if (!currentLocationName.trim()) {
      setError('Please enter your current location.');
      return;
    }
    if (!currentKm || Number(currentKm) < 0) {
      setError('Enter a valid current odometer reading.');
      return;
    }
    if (!fuelRemaining || Number(fuelRemaining) < 0) {
      setError('Enter the fuel remaining in litres.');
      return;
    }
    if (!requestedLitres || Number(requestedLitres) <= 0) {
      setError('Enter the emergency fuel amount in litres.');
      return;
    }
    if (!reason.trim()) {
      setError('Please provide a reason for this emergency fuel request.');
      return;
    }

    setSubmitting(true);

    try {
      await fuelApi.createAdditional({
        tripId: Number(selectedTrip.id),
        requestedLitres: Number(requestedLitres),
        reason: reason.trim(),
        currentLocationName: currentLocationName.trim(),
      });
      navigate('/driver/fuel');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to submit emergency fuel request.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingTrips) return <Loading label="Loading your active trips..." />;

  return (
    <div className="driver-fuel-page">
      <div className="driver-fuel-header">
        <div>
          <span className="driver-fuel-eyebrow">DRIVER PORTAL</span>
          <h1>Emergency Fuel Request</h1>
          <p>Request additional fuel for unexpected situations during an active trip.</p>
        </div>
        <button type="button" className="driver-fuel-back" onClick={() => navigate('/driver/fuel')}>
          ← Fuel Requests
        </button>
      </div>

      {error && (
        <div className="driver-fuel-error">
          <strong>Unable to continue</strong>
          <span>{error}</span>
        </div>
      )}

      {!selectedTrip && !loadingTrips && (
        <div className="driver-fuel-empty">
          <div className="driver-fuel-empty-icon">⛽</div>
          <h3>No active trip available</h3>
          <p>You can request emergency fuel only when a trip has been started and is in progress.</p>
          <button type="button" className="driver-fuel-primary-btn" onClick={() => navigate('/driver')}>
            Back to Dashboard
          </button>
        </div>
      )}

      {selectedTrip && (
        <>
          <section className="driver-fuel-card driver-fuel-trip-card">
            <div className="driver-fuel-card-header">
              <div>
                <span className="driver-fuel-section-label">ACTIVE TRIP</span>
                <h2>{selectedTrip.tripNumber || `Trip #${selectedTrip.id}`}</h2>
              </div>
              <span className={`driver-fuel-status status-${String(selectedTrip.status || '').toLowerCase()}`}>
                {String(selectedTrip.status || '').replaceAll('_', ' ')}
              </span>
            </div>

            <div className="driver-fuel-route-summary">
              <div className="driver-fuel-location">
                <span className="driver-fuel-dot origin-dot" />
                <div>
                  <small>ORIGIN</small>
                  <strong>{selectedTrip.request?.originName || selectedTrip.originName || '—'}</strong>
                </div>
              </div>
              <div className="driver-fuel-route-line" />
              <div className="driver-fuel-location">
                <span className="driver-fuel-dot destination-dot" />
                <div>
                  <small>DESTINATION</small>
                  <strong>{selectedTrip.request?.destinationName || selectedTrip.destinationName || '—'}</strong>
                </div>
              </div>
            </div>

            <div className="driver-fuel-trip-meta">
              <div>
                <span>Vehicle</span>
                <strong>{selectedTrip.vehicle?.registrationNumber || selectedTrip.vehicle?.plateNumber || '—'}</strong>
              </div>
              <div>
                <span>Status</span>
                <strong>{String(selectedTrip.status || '').replaceAll('_', ' ')}</strong>
              </div>
            </div>
          </section>

          <section className="driver-fuel-card">
            <div className="driver-fuel-card-header">
              <div>
                <span className="driver-fuel-section-label">EMERGENCY FUEL</span>
                <h2>Request Additional Fuel</h2>
              </div>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="driver-fuel-form-grid">
                <div className="driver-fuel-field full">
                  <label>Current Location *</label>
                  <input
                    type="text"
                    value={currentLocationName}
                    onChange={(e) => setCurrentLocationName(e.target.value)}
                    placeholder="e.g. Highway A7, km 120"
                    required
                  />
                </div>

                <div className="driver-fuel-field full">
                  <label>Route / Destination (if changed)</label>
                  <input
                    type="text"
                    value={routeIfChanged}
                    onChange={(e) => setRouteIfChanged(e.target.value)}
                    placeholder="If destination has changed, enter new route"
                  />
                </div>

                <div className="driver-fuel-field">
                  <label>Current Odometer (KM) *</label>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={currentKm}
                    onChange={(e) => setCurrentKm(e.target.value)}
                    placeholder="Enter current odometer reading"
                    required
                  />
                </div>

                <div className="driver-fuel-field">
                  <label>Fuel Remaining (Litres) *</label>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={fuelRemaining}
                    onChange={(e) => setFuelRemaining(e.target.value)}
                    placeholder="How much fuel is left"
                    required
                  />
                </div>

                <div className="driver-fuel-field">
                  <label>Emergency Fuel Requested (Litres) *</label>
                  <input
                    type="number"
                    min="0.1"
                    step="0.1"
                    value={requestedLitres}
                    onChange={(e) => setRequestedLitres(e.target.value)}
                    placeholder="How much fuel do you need"
                    required
                  />
                </div>

                <div className="driver-fuel-field full">
                  <label>Reason for Emergency *</label>
                  <textarea
                    rows="3"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Why do you need emergency fuel? (required)"
                    required
                  />
                </div>

                <div className="driver-fuel-field full">
                  <label>Additional Notes</label>
                  <textarea
                    rows="2"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Any additional information..."
                  />
                </div>
              </div>

              <div className="driver-fuel-warning">
                <strong>Emergency Fuel Request</strong>
                <span>
                  This request is for additional/emergency fuel during an active trip.
                  It will be sent for approval and release. A valid reason is required.
                </span>
              </div>

              <div className="driver-fuel-actions">
                <button
                  type="button"
                  className="driver-fuel-secondary-btn"
                  onClick={() => navigate('/driver/fuel')}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="driver-fuel-primary-btn"
                  disabled={submitting}
                >
                  {submitting ? 'Submitting...' : 'Submit Emergency Request'}
                </button>
              </div>
            </form>
          </section>
        </>
      )}
    </div>
  );
}
