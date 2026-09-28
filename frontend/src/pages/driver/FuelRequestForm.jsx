import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { tripsApi, fuelApi } from '../../services/resources';
import Loading from '../../components/Loading';

export default function FuelRequestForm() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const tripIdFromQuery = params.get('tripId');

  const [trips, setTrips] = useState([]);
  const [tripId, setTripId] = useState(tripIdFromQuery || '');
  const [calc, setCalc] = useState(null);

  const [currentKm, setCurrentKm] = useState('');
  const [litresRequested, setLitresRequested] = useState('');
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');

  const [loadingTrips, setLoadingTrips] = useState(true);
  const [loadingCalc, setLoadingCalc] = useState(false);
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
          ['DRIVER_ASSIGNED', 'DRIVER_ACCEPTED', 'TRIP_STARTED', 'IN_PROGRESS']
            .includes(String(trip.status || '').toUpperCase())
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
          setError(err.response?.data?.message || 'Failed to load your assigned trips.');
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

  useEffect(() => {
    if (!tripId) { setCalc(null); return; }

    let mounted = true;

    const loadCalculation = async () => {
      try {
        setLoadingCalc(true);
        setError('');
        const response = await fuelApi.calc(tripId);
        if (mounted) setCalc(response?.data || response);
      } catch (err) {
        if (mounted) {
          setCalc(null);
          setError(err.response?.data?.message || 'Unable to calculate fuel info for this trip.');
        }
      } finally {
        if (mounted) setLoadingCalc(false);
      }
    };

    loadCalculation();
    return () => { mounted = false; };
  }, [tripId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!selectedTrip) {
      setError('Please select one of your assigned trips.');
      return;
    }
    if (!currentKm || Number(currentKm) < 0) {
      setError('Enter a valid current odometer reading.');
      return;
    }
    if (!litresRequested || Number(litresRequested) <= 0) {
      setError('Enter the fuel amount in litres.');
      return;
    }
    if (!reason.trim()) {
      setError('Please provide a reason for this fuel request.');
      return;
    }

    setSubmitting(true);

    try {
      await fuelApi.create({
        tripId: Number(selectedTrip.id),
        currentKm: Number(currentKm),
        litresRequested: Number(litresRequested),
        reason: reason.trim(),
        notes: notes.trim(),
      });
      navigate('/driver/fuel');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to submit fuel request.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingTrips) return <Loading label="Loading your assigned trips..." />;

  return (
    <div className="driver-fuel-page">
      <div className="driver-fuel-header">
        <div>
          <span className="driver-fuel-eyebrow">DRIVER PORTAL</span>
          <h1>Request Fuel</h1>
          <p>Request fuel for your assigned trip. Enter the amount you believe is appropriate based on your current situation.</p>
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
          <p>You can request fuel after a vehicle has been assigned to you and you have accepted the assignment.</p>
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
                <span className="driver-fuel-section-label">ASSIGNED TRIP</span>
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
                <span>Trip Date</span>
                <strong>{selectedTrip.tripDate || selectedTrip.scheduledDate || '—'}</strong>
              </div>
            </div>
          </section>

          {calc && !loadingCalc && (
            <section className="driver-fuel-card">
              <div className="driver-fuel-card-header">
                <div>
                  <span className="driver-fuel-section-label">TRIP INFO</span>
                  <h2>Reference Details</h2>
                </div>
              </div>
              <div className="driver-fuel-stats">
                <div className="driver-fuel-stat">
                  <span>Estimated Distance</span>
                  <strong>{calc.routeDistanceKm ?? '—'} KM</strong>
                </div>
                <div className="driver-fuel-stat">
                  <span>Vehicle Consumption</span>
                  <strong>{calc.vehicleConsumptionKmPerLitre ?? '—'} KM/L</strong>
                </div>
                <div className="driver-fuel-stat">
                  <span>Estimated Fuel for Trip</span>
                  <strong>{calc.expectedFuelLitres ?? '—'} L</strong>
                </div>
              </div>
            </section>
          )}

          <section className="driver-fuel-card">
            <div className="driver-fuel-card-header">
              <div>
                <span className="driver-fuel-section-label">FUEL REQUEST</span>
                <h2>Enter Fuel Details</h2>
              </div>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="driver-fuel-form-grid">
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
                  <label>Fuel Requested (Litres) *</label>
                  <input
                    type="number"
                    min="0.1"
                    step="0.1"
                    value={litresRequested}
                    onChange={(e) => setLitresRequested(e.target.value)}
                    placeholder="Enter fuel amount you need"
                    required
                  />
                </div>

                <div className="driver-fuel-field full">
                  <label>Reason *</label>
                  <textarea
                    rows="2"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Why do you need this fuel?"
                    required
                  />
                </div>

                <div className="driver-fuel-field full">
                  <label>Additional Notes</label>
                  <textarea
                    rows="3"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Any additional information..."
                  />
                </div>
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
                  {submitting ? 'Submitting...' : 'Submit Request'}
                </button>
              </div>
            </form>
          </section>
        </>
      )}
    </div>
  );
}
