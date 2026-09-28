import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { tripsApi, fuelApi } from '../../services/resources';
import Loading from '../../components/Loading';

const ACTIVE_STATUSES = [
  'DRIVER_ASSIGNED',
  'DRIVER_ACCEPTED',
  'TRIP_STARTED',
  'IN_PROGRESS',
  'DRIVER_COMPLETED',
  'OFFICER_COMPLETED',
  'TRIP_COMPLETED',
  'CLOSED',
];

export default function RequestFuel() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [trips, setTrips] = useState([]);
  const [tripId, setTripId] = useState('');

  const [currentKm, setCurrentKm] = useState('');
  const [litresRequested, setLitresRequested] = useState('');
  const [fuelReason, setFuelReason] = useState('');
  const [fuelNotes, setFuelNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [requestType, setRequestType] = useState('NORMAL');
  const [emergencyReason, setEmergencyReason] = useState('');

  // Estimated fuel from map calculation (read-only reference)
  const [estimatedFuel, setEstimatedFuel] = useState(null);
  const [isRoundTrip, setIsRoundTrip] = useState(false);
  const [tripDistanceKm, setTripDistanceKm] = useState(null);
  const [fetchingEstimate, setFetchingEstimate] = useState(false);

  const selectedTrip = useMemo(
    () => trips.find((t) => String(t.id) === String(tripId)) || null,
    [trips, tripId]
  );
  const vehicle = selectedTrip?.vehicle || {};
  const vehicleOdometer = Number(vehicle.currentOdometer || 0);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const response = await tripsApi.list();
      const all = Array.isArray(response)
        ? response
        : response?.data || response?.trips || [];
      const active = all.filter((trip) =>
        ACTIVE_STATUSES.includes(String(trip.status || '').toUpperCase())
      );
      setTrips(active);
      setTripId(String((active[0] || {}).id || ''));
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load your trips.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch estimated fuel when trip changes
  const fetchEstimatedFuel = useCallback(async (tripId) => {
    if (!tripId) return;
    setFetchingEstimate(true);
    try {
      const response = await fuelApi.calc(tripId);
      setEstimatedFuel(response?.maxPlannedFuelLitres ?? response?.expectedFuelLitres ?? null);
      setIsRoundTrip(response?.isRoundTrip ?? false);
      setTripDistanceKm(response?.tripDistanceKm ?? null);
    } catch (err) {
      console.warn('Failed to fetch fuel estimate:', err);
      setEstimatedFuel(null);
      setIsRoundTrip(false);
      setTripDistanceKm(null);
    } finally {
      setFetchingEstimate(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (selectedTrip?.id) {
      fetchEstimatedFuel(selectedTrip.id);
    }
  }, [selectedTrip?.id, fetchEstimatedFuel]);

  const handleSubmitFuel = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!selectedTrip) {
      setError('No active trip. Accept an assignment first.');
      return;
    }
    if (!currentKm || Number(currentKm) < 0) {
      setError('Enter a valid current odometer reading.');
      return;
    }
    if (vehicleOdometer && Number(currentKm) < vehicleOdometer) {
      setError(`Current odometer cannot be less than vehicle odometer (${vehicleOdometer} KM).`);
      return;
    }
    if (!litresRequested || Number(litresRequested) <= 0) {
      setError('Enter the fuel amount in litres.');
      return;
    }
    if (requestType === 'EMERGENCY' && !emergencyReason.trim()) {
      setError('Emergency reason is required for emergency fuel requests.');
      return;
    }
    if (requestType === 'NORMAL' && !fuelReason.trim()) {
      setError('Please provide a reason for this fuel request.');
      return;
    }
    try {
      setSubmitting(true);
      await fuelApi.create({
        tripId: Number(selectedTrip.id),
        currentKm: Number(currentKm),
        litresRequested: Number(litresRequested),
        reason: requestType === 'EMERGENCY' ? emergencyReason.trim() : fuelReason.trim(),
        notes: fuelNotes.trim(),
        requestType,
        emergencyReason: requestType === 'EMERGENCY' ? emergencyReason.trim() : undefined,
      });
      setSuccess(`${requestType === 'EMERGENCY' ? 'Emergency ' : ''}Fuel request submitted for HPMU review.`);
      setFuelReason('');
      setFuelNotes('');
      setEmergencyReason('');
      setCurrentKm('');
      setLitresRequested('');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to submit fuel request.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <Loading label="Loading Request Fuel..." />;

  return (
    <div className="request-fuel-page" data-testid="request-fuel-page">
      <header className="page-header">
        <div className="header-content">
          <span className="eyebrow">DRIVER PORTAL</span>
          <h1>Request Fuel</h1>
          <p className="header-subtitle">Request fuel for your active trip</p>
        </div>
      </header>

      {success && <div className="alert alert-success">{success}</div>}
      {error && <div className="alert alert-error">{error}</div>}

      {trips.length === 0 && (
        <div className="empty-state">
          <div className="empty-icon">⛽</div>
          <h3>No active trip</h3>
          <p>Accept an assignment from My Assignments to request fuel.</p>
        </div>
      )}

      {trips.length > 0 && (
        <>
          <section className="section-card" data-testid="assigned-vehicle-section">
            <header className="section-header">
              <div className="section-header-left">
                <div>
                  <h2>Assigned Vehicle</h2>
                  <p className="section-subtitle">Vehicle assigned to this trip</p>
                </div>
              </div>
            </header>
            <div className="trip-info-grid">
              <div className="info-item">
                <span className="info-label">Vehicle</span>
                <span className="info-value">
                  {vehicle.registrationNumber
                    ? `${vehicle.registrationNumber}${vehicle.model ? ` — ${vehicle.model}` : ''}`
                    : '—'}
                </span>
              </div>
              <div className="info-item">
                <span className="info-label">Fuel Type</span>
                <span className="info-value">{vehicle.fuelType || '—'}</span>
              </div>
            </div>
          </section>

          {/* Trip Type & Estimated Fuel Reference */}
          {selectedTrip && (
            <section className="section-card" data-testid="trip-fuel-estimate-section">
              <header className="section-header">
                <div className="section-header-left">
                  <div>
                    <h2>Trip Fuel Estimate (Reference)</h2>
                    <p className="section-subtitle">System-calculated estimate based on trip type and vehicle consumption</p>
                  </div>
                </div>
              </header>
              <div className="trip-info-grid">
                <div className="info-item">
                  <span className="info-label">Trip Type</span>
                  <span className="info-value">
                    {isRoundTrip ? 'Round Trip' : 'One Way'}
                  </span>
                </div>
                <div className="info-item">
                  <span className="info-label">Trip Distance</span>
                  <span className="info-value">
                    {tripDistanceKm ? `${tripDistanceKm} km` : '—'}
                  </span>
                </div>
                <div className="info-item">
                  <span className="info-label">Vehicle Consumption</span>
                  <span className="info-value">
                    {vehicle.fuelConsumptionKmPerLitre ? `${vehicle.fuelConsumptionKmPerLitre} km/L` : '—'}
                  </span>
                </div>
                <div className="info-item">
                  <span className="info-label">Estimated Fuel Requirement</span>
                  <span className="info-value estimated-fuel">
                    {fetchingEstimate ? (
                      <span className="loading-text">Calculating...</span>
                    ) : estimatedFuel ? (
                      `${estimatedFuel} L`
                    ) : (
                      '—'
                    )}
                  </span>
                </div>
              </div>
              <p className="form-hint" style={{ marginTop: 8 }}>
                This estimate is for reference only. Enter your actual fuel request below.
              </p>
            </section>
          )}

          <section className="section-card" data-testid="fuel-request-section">
            <header className="section-header">
              <div className="section-header-left">
                <div>
                  <h2>New Fuel Request</h2>
                  <p className="section-subtitle">Submit a new fuel request to HPMU</p>
                </div>
              </div>
            </header>
            <form onSubmit={handleSubmitFuel} className="fuel-request-form">
              <div className="form-group">
                <label className="form-label">Request Type <span className="required">*</span></label>
                <div className="radio-group" role="radiogroup" aria-label="Request type">
                  <label className="radio-option">
                    <input
                      type="radio"
                      value="NORMAL"
                      checked={requestType === 'NORMAL'}
                      onChange={(e) => setRequestType(e.target.value)}
                      required
                    />
                    <span className="radio-custom"></span>
                    <span className="radio-text">Normal Fuel Request</span>
                  </label>
                  <label className="radio-option">
                    <input
                      type="radio"
                      value="EMERGENCY"
                      checked={requestType === 'EMERGENCY'}
                      onChange={(e) => setRequestType(e.target.value)}
                      required
                    />
                    <span className="radio-custom"></span>
                    <span className="radio-text">Emergency Fuel Request</span>
                  </label>
                </div>
                <p className="form-hint">Normal: Standard trip fuel request. Emergency: Unexpected fuel need during active trip.</p>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Current Odometer (KM) <span className="required">*</span></label>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={currentKm}
                    onChange={(e) => setCurrentKm(e.target.value)}
                    placeholder="Current odometer"
                    required
                    className="input"
                    data-testid="fuel-current-km"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Fuel Requested (Litres) <span className="required">*</span></label>
                  <input
                    type="number"
                    min="0.1"
                    step="0.1"
                    value={litresRequested}
                    onChange={(e) => setLitresRequested(e.target.value)}
                    placeholder="Litres needed"
                    required
                    className="input"
                    data-testid="fuel-litres"
                  />
                  {estimatedFuel && (
                    <p className="form-hint" style={{ marginTop: 4, color: '#64748b' }}>
                      Reference: Estimated fuel requirement is {estimatedFuel} L
                    </p>
                  )}
                </div>
              </div>

              {requestType === 'EMERGENCY' ? (
                <div className="form-group emergency-reason-group">
                  <label className="form-label">Emergency Reason <span className="required">*</span></label>
                  <textarea
                    rows="3"
                    value={emergencyReason}
                    onChange={(e) => setEmergencyReason(e.target.value)}
                    placeholder="Describe the emergency situation requiring additional fuel (e.g., unexpected long route, fuel shortage during trip, detour, traffic/diversion, emergency assignment)"
                    required
                    className="input"
                    data-testid="emergency-reason"
                  />
                  <p className="form-hint error-hint">Required for emergency fuel requests. This will be reviewed by HPMU.</p>
                </div>
              ) : (
                <div className="form-group">
                  <label className="form-label">Reason <span className="required">*</span></label>
                  <textarea
                    rows="2"
                    value={fuelReason}
                    onChange={(e) => setFuelReason(e.target.value)}
                    placeholder="Why do you need this fuel?"
                    required
                    className="input"
                  />
                </div>
              )}

              <div className="form-group">
                <label className="form-label">Additional Notes</label>
                <textarea
                  rows="2"
                  value={fuelNotes}
                  onChange={(e) => setFuelNotes(e.target.value)}
                  placeholder="Optional notes..."
                  className="input"
                />
              </div>

              <div className="form-actions">
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={submitting || !selectedTrip}
                  data-testid="submit-fuel-request"
                >
                  {submitting ? 'Submitting...' : `Submit ${requestType === 'EMERGENCY' ? 'Emergency ' : ''}Fuel Request`}
                </button>
                <Link
                  to="/driver/my-requests"
                  className="btn btn-secondary"
                  data-testid="view-my-requests"
                >
                  My Requests
                </Link>
              </div>
            </form>
          </section>
        </>
      )}
    </div>
  );
}
