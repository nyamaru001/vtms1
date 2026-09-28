import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { tripsApi, logbooksApi, fuelApi, driverFuelApi } from '../../services/resources';
import Loading from '../../components/Loading';
import LogbookPrint from '../../components/LogbookPrint';
import StatusBadge from '../../components/StatusBadge';

const SKIPPED_TRIP_STATUSES = ['DRIVER_CANCELLED', 'CANCELLED', 'REJECTED'];
const ACTIVE_STATUSES = [
  'DRIVER_ASSIGNED',
  'DRIVER_ACCEPTED',
  'TRIP_STARTED',
  'IN_PROGRESS',
  'DRIVER_COMPLETED',
  'OFFICER_COMPLETED',
];
const FINISHED_STATUSES = ['TRIP_COMPLETED', 'CLOSED'];

const fmtDateTime = (v) => (v ? new Date(v).toLocaleString() : '—');
const fmtDate = (v) => (v ? String(v).slice(0, 10) : '—');
const num = (v) => (v === '' || v == null || Number.isNaN(Number(v)) ? null : Number(v));

export default function DriverLogbook() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploadingReceipt, setUploadingReceipt] = useState(false);

  const [trips, setTrips] = useState([]);
  const [tripId, setTripId] = useState(searchParams.get('tripId') || '');
  const [logbook, setLogbook] = useState(null);
  const [fuelRequests, setFuelRequests] = useState([]);
  const [receiptFile, setReceiptFile] = useState(null);

  const [editing, setEditing] = useState(false);
  const [showPrint, setShowPrint] = useState(false);

  const [startKm, setStartKm] = useState('');
  const [endKm, setEndKm] = useState('');
  const [fuelAvailable, setFuelAvailable] = useState('');
  const [fuelUsed, setFuelUsed] = useState('');
  const [fuelReceived, setFuelReceived] = useState('');

  const selectedTrip = useMemo(
    () => trips.find((t) => String(t.id) === String(tripId)) || null,
    [trips, tripId]
  );

  const vehicle = selectedTrip?.vehicle || {};
  const request = selectedTrip?.request || {};
  const vehicleOdometer = Number(vehicle.currentOdometer || 0);

  const distanceKm =
    startKm !== '' && endKm !== '' && Number(endKm) >= Number(startKm)
      ? Number(endKm) - Number(startKm)
      : null;

  const fuelRemaining =
    (num(fuelAvailable) || 0) + (num(fuelReceived) || 0) - (num(fuelUsed) || 0);

  const hydrateForm = useCallback((lb) => {
    setStartKm(lb?.startKm ?? '');
    setEndKm(lb?.endKm ?? '');
    setFuelAvailable(lb?.fuelAvailableBeforeTrip ?? '');
    setFuelUsed(lb?.fuelUsedLitres ?? '');
    setFuelReceived(lb?.fuelReceivedFromHPMU ?? '');
  }, []);

  const loadTripData = useCallback(async (tid) => {
    if (!tid) return;
    try {
      const lbs = await logbooksApi.list({ tripId: tid, limit: 50 });
      const rows = Array.isArray(lbs?.data) ? lbs.data : Array.isArray(lbs) ? lbs : [];
      const existing = rows.find((lb) => String(lb.tripId) === String(tid)) || rows[0] || null;
      if (existing) {
        const full = await logbooksApi.get(existing.id);
        setLogbook(full);
        hydrateForm(full);
      } else {
        setLogbook(null);
        hydrateForm(null);
      }
    } catch {
      setLogbook(null);
      hydrateForm(null);
    }

    try {
      const list = await fuelApi.list({ tripId: tid });
      setFuelRequests(Array.isArray(list) ? list : list?.data || []);
    } catch {
      setFuelRequests([]);
    }
  }, [hydrateForm]);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const response = await tripsApi.list();
      const all = Array.isArray(response)
        ? response
        : response?.data || response?.trips || [];
      const usable = all.filter(
        (t) => !SKIPPED_TRIP_STATUSES.includes(String(t.status || '').toUpperCase())
      );
      setTrips(usable);

      let nextTripId = '';
      const requested = searchParams.get('tripId') || '';
      const explicitLogbook =
        id && id !== 'new' ? await logbooksApi.get(id).catch(() => null) : null;

      if (explicitLogbook?.tripId) {
        nextTripId = String(explicitLogbook.tripId);
      } else if (requested && usable.some((t) => String(t.id) === String(requested))) {
        nextTripId = String(requested);
      } else {
        const active = usable.find((t) =>
          ACTIVE_STATUSES.includes(String(t.status || '').toUpperCase())
        );
        const finished = usable.find((t) =>
          FINISHED_STATUSES.includes(String(t.status || '').toUpperCase())
        );
        nextTripId = String((active || finished || usable[0] || {}).id || '');
      }

      if (nextTripId) {
        setTripId(nextTripId);
        await loadTripData(nextTripId);
      }

      if (explicitLogbook) {
        setLogbook(explicitLogbook);
        hydrateForm(explicitLogbook);
      } else if (searchParams.get('edit') === '1') {
        setEditing(true);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load your logbook.');
    } finally {
      setLoading(false);
    }
  }, [id, searchParams, loadTripData, hydrateForm]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const changeTrip = async (value) => {
    setTripId(value);
    setSuccess('');
    setError('');
    await loadTripData(value);
  };

  const validate = () => {
    if (!tripId) return 'No trip available for this logbook.';
    if (startKm !== '' && vehicleOdometer && Number(startKm) < vehicleOdometer) {
      return `Starting odometer cannot be less than vehicle odometer (${vehicleOdometer} KM).`;
    }
    if (startKm !== '' && endKm !== '' && Number(endKm) < Number(startKm)) {
      return 'Ending odometer cannot be less than starting odometer.';
    }
    if (fuelRemaining < 0) {
      return 'Fuel remaining cannot be negative. Check the fuel values entered.';
    }
    return '';
  };

  // Compute fuel display values for the false branch (display mode)
  const linkedFuelRequest = useMemo(
    () => [...fuelRequests].reverse().find((fr) => fr.litresRequested > 0),
    [fuelRequests]
  );
  const displayFuelRequested = linkedFuelRequest?.litresRequested ?? logbook?.fuelRequested ?? '—';
  const displayFuelIssued = linkedFuelRequest?.litresReleased ?? logbook?.fuelReceivedFromHPMU ?? logbook?.fuelIssuedLitres ?? '—';
  const displayFuelReceived = linkedFuelRequest?.litresReleased ?? logbook?.fuelReceivedFromHPMU ?? '—';
  const latestVoucher = useMemo(
    () => [...fuelRequests].reverse().find((fr) => fr.voucherNumber),
    [fuelRequests]
  );

  // Render fuel section for display mode (when not editing)
const shouldShowFuelSection = !editing && linkedFuelRequest;

  const fuelSection = shouldShowFuelSection ? (
    <>
      <div className="logbook-card" data-testid="fuel-section">
        <div className="logbook-card-header">
          <h3>FUEL</h3>
          <span className="eyebrow">Fuel type loaded from vehicle</span>
        </div>
        <div className="logbook-card-body">
          <div className="detail-grid">
            <div>
              <span className="field-label">Fuel Type</span>
              <p>{vehicle.fuelType || logbook?.fuelType || '—'}</p>
            </div>
            <div>
              <span className="field-label">Linked Fuel Request</span>
              <p>
                <span className="font-bold">#{linkedFuelRequest.id}</span> — {linkedFuelRequest.litresRequested} L requested
                {linkedFuelRequest.requestType === 'EMERGENCY' && (
                  <span className="status-badge status-emergency" style={{ marginLeft: 8, fontSize: 11, textTransform: 'uppercase' }}>
                    Emergency
                  </span>
                )}
              </p>
            </div>
            <div>
              <span className="field-label">Fuel Available Before Trip (L)</span>
              <p>{logbook?.fuelAvailableBeforeTrip ?? '—'}</p>
            </div>
            <div>
              <span className="field-label">Fuel Requested (L)</span>
              <p>{(displayFuelRequested !== '—' ? ' L' : '')}</p>
            </div>
            <div>
              <span className="field-label">Fuel Received from HPMU (L)</span>
              <p data-testid="fuel-received">{displayFuelReceived !== '—' ? ' L' : ''}</p>
            </div>
            <div>
              <span className="field-label">Fuel Consumed (L)</span>
              <p>{logbook?.fuelUsedLitres ?? '—'}</p>
            </div>
            <div>
              <span className="field-label">Fuel Remaining (L)</span>
              <p>{logbook?.fuelRemaining ?? '—'}</p>
            </div>
            <div>
              <span className="field-label">Fuel Voucher</span>
              <p data-testid="fuel-voucher">
                {latestVoucher?.voucherNumber || '—'}
                {displayFuelIssued !== '—' ? ' · ' + displayFuelIssued + ' L' : ''}
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
      ) : null;

  const buildPayload = () => ({
    tripId: tripId ? Number(tripId) : null,
    vehicleId: vehicle?.id ? Number(vehicle.id) : null,
    carType: vehicle.model || '',
    vehicleRegistration: vehicle.registrationNumber || '',
    fuelType: vehicle.fuelType || 'Diesel',
    origin: request.originName || undefined,
    destination: request.destinationName || undefined,
    purpose: request.purpose || undefined,
    tripName: selectedTrip?.tripNumber || undefined,
    entryDate: request.departureDate || undefined,
    startKm: num(startKm),
    endKm: num(endKm),
    totalKm: distanceKm,
    startTime: selectedTrip?.startTime || undefined,
    endTime: selectedTrip?.endTime || undefined,
    fuelAvailableBeforeTrip: num(fuelAvailable),
    fuelUsedLitres: num(fuelUsed),
    fuelReceivedFromHPMU: num(fuelReceived),
    fuelRemaining: num(fuelRemaining),
    fuelIssuedLitres: request.totalFuelLitres ?? undefined,
  });

  const uploadReceipt = async (logbookId) => {
    if (!receiptFile || !logbookId) return;
    setUploadingReceipt(true);
    try {
      const fd = new FormData();
      fd.append('tripId', tripId);
      fd.append('logbookId', logbookId);
      fd.append('litres', String(num(fuelReceived) ?? num(fuelUsed) ?? 0));
      fd.append('description', 'Fuel receipt for logbook');
      fd.append('receipt', receiptFile);
      await driverFuelApi.create(fd);
      setReceiptFile(null);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to upload receipt.');
      throw err;
    } finally {
      setUploadingReceipt(false);
    }
  };

  const handleSave = async (submitAfter) => {
    setError('');
    setSuccess('');
    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }
    if (submitAfter && endKm === '') {
      setError('Enter the ending odometer before submitting the logbook.');
      return;
    }
    try {
      setSaving(true);
      let savedId = logbook?.id;
      if (savedId) {
        await logbooksApi.update(savedId, buildPayload());
      } else {
        const created = await logbooksApi.create(buildPayload());
        savedId = created.id;
        setLogbook(created);
        navigate('/driver/logbook', { replace: true });
      }
      if (receiptFile && savedId) await uploadReceipt(savedId);
      if (submitAfter) await logbooksApi.submit(savedId);
      const refreshed = await logbooksApi.get(savedId);
      setLogbook(refreshed);
      hydrateForm(refreshed);
      setSuccess(submitAfter ? 'Logbook submitted for officer approval.' : 'Logbook saved.');
      setEditing(false);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save the logbook.');
    } finally {
      setSaving(false);
    }
  };

  const handlePrint = () => {
    setShowPrint(true);
    setTimeout(() => window.print(), 150);
  };

  if (loading) return <Loading label="Loading logbook..." />;

  const status = logbook?.status || 'NOT STARTED';
  const isEditable =
    !logbook || ['DRAFT', 'RETURNED'].includes(String(logbook.status || '').toUpperCase());

  const printRecord = {
    ...(logbook || {}),
    id: logbook?.id,
    carType: vehicle.model || logbook?.carType,
    vehicleRegistration: vehicle.registrationNumber || logbook?.vehicleRegistration,
    tripName: selectedTrip?.tripNumber || logbook?.tripName,
    origin: request.originName || logbook?.origin,
    destination: request.destinationName || logbook?.destination,
    purpose: request.purpose || logbook?.purpose,
    entryDate: logbook?.entryDate || request.departureDate || undefined,
    startTime: selectedTrip?.startTime || logbook?.startTime,
    endTime: selectedTrip?.endTime || logbook?.endTime,
    startKm: startKm !== '' ? Number(startKm) : logbook?.startKm,
    endKm: endKm !== '' ? Number(endKm) : logbook?.endKm,
    totalKm: distanceKm ?? logbook?.totalKm,
    fuelType: vehicle.fuelType || logbook?.fuelType,
    fuelAvailableBeforeTrip: fuelAvailable !== '' ? Number(fuelAvailable) : logbook?.fuelAvailableBeforeTrip,
    fuelUsedLitres: fuelUsed !== '' ? Number(fuelUsed) : logbook?.fuelUsedLitres,
    fuelReceivedFromHPMU: fuelReceived !== '' ? Number(fuelReceived) : logbook?.fuelReceivedFromHPMU,
    fuelRemaining: Number(fuelRemaining) || logbook?.fuelRemaining,
    fuelIssuedLitres: request.totalFuelLitres ?? logbook?.fuelIssuedLitres,
    voucherNumber: latestVoucher?.voucherNumber || null,
    requestType: latestVoucher?.requestType || 'NORMAL',
    emergencyReason: latestVoucher?.emergencyReason || null,
    status,
    driver: logbook?.driver || { user: { fullName: selectedTrip?.driver?.user?.fullName || '—' } },
    officer: logbook?.officer || selectedTrip?.officer || null,
    verifiedByUser: logbook?.verifiedByUser || null,
    verifiedAt: logbook?.verifiedAt || null,
    vehicle: logbook?.vehicle || selectedTrip?.vehicle || null,
    trip: logbook?.trip || selectedTrip || null,
    routeDistanceKm: logbook?.routeDistanceKm ?? request.roundTripKm ?? request.oneWayKm ?? null,
    postTripNotes: logbook?.postTripNotes || '',
  };

  const approvalBlock = () => {
    if (!logbook) return <p>Status: Not started yet.</p>;
    if (logbook.status === 'VERIFIED') {
      return (
        <>
          <p>
            <span className="font-bold">Approved by Officer</span>
          </p>
          <p>
            {logbook.verifiedByUser?.fullName || logbook.officer?.fullName || '—'}
            {' · '}
            {fmtDateTime(logbook.verifiedAt)}
          </p>
          {logbook.reviewComment ? <p>Comment: {logbook.reviewComment}</p> : null}
        </>
      );
    }
    if (logbook.status === 'RETURNED') {
      return (
        <>
          <p>
            <span className="font-bold">Returned for correction</span>
          </p>
          <p>{logbook.reviewComment || '—'}</p>
        </>
      );
    }
    if (logbook.status === 'SUBMITTED') {
      return <p>Submitted — awaiting officer approval.</p>;
    }
    return <p>Draft — not yet submitted for approval.</p>;
  };

  return (
    <>
      <div className="logbook-form-page" data-testid="driver-logbook-page">
        <div className="logbook-form-header">
          <div>
            <span className="eyebrow">DRIVER PORTAL</span>
            <h2>Trip Logbook</h2>
            <p className="field-hint">
              Vehicle, route, driver and trip times load automatically. Only odometer and fuel
              readings are entered by you.
            </p>
          </div>
          <span
            className={`driver-logbook-status-label driver-logbook-status-${String(status).toLowerCase().replace(/\s+/g, '-')}`}
          >
            {status}
          </span>
        </div>

        {success && <div className="callout callout-success">{success}</div>}
        {error && <div className="form-error">{error}</div>}

        {!trips.length ? (
          <div className="empty-state">
            No trip available. Accept an assignment from My Assignments to start a logbook.
          </div>
        ) : null}

        {trips.length > 1 && (
          <div className="logbook-card" style={{ marginBottom: 16 }}>
            <div className="logbook-card-body">
              <div className="form-field">
                <label>Trip</label>
                <select className="input" value={tripId} onChange={(e) => changeTrip(e.target.value)}>
                  {trips.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.tripNumber || t.id} — {t.request?.originName || ''} →{' '}
                      {t.request?.destinationName || ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}

        {!editing ? (
          <div className="logbook-grid">
            {/* 1. TRIP / LOGBOOK */}
            <div className="logbook-card" data-testid="logbook-summary">
              <div className="logbook-card-header">
                <h3>TRIP / LOGBOOK</h3>
                <span className="eyebrow">Auto-populated</span>
              </div>
              <div className="logbook-card-body">
                <div className="detail-grid">
                  <div>
                    <span className="field-label">Logbook Reference</span>
                    <p>{logbook ? `#${logbook.id}` : 'Not created yet'}</p>
                  </div>
                  <div>
                    <span className="field-label">Status</span>
                    <p>{status}</p>
                  </div>
                  <div>
                    <span className="field-label">Entry Date</span>
                    <p>{fmtDate(logbook?.entryDate || request.departureDate)}</p>
                  </div>
                  <div>
                    <span className="field-label">Purpose</span>
                    <p>{request.purpose || logbook?.purpose || '—'}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* 2. TRIP INFORMATION */}
            <div className="logbook-card" data-testid="trip-info-section">
              <div className="logbook-card-header">
                <h3>TRIP INFORMATION</h3>
                <span className="eyebrow">From the database</span>
              </div>
              <div className="logbook-card-body">
                <div className="detail-grid">
                  <div>
                    <span className="field-label">Route ID</span>
                    <p data-testid="route-id">
                      {selectedTrip?.tripNumber || request.requestNumber || '—'}
                    </p>
                  </div>
                  <div>
                    <span className="field-label">Request Number</span>
                    <p>{request.requestNumber || '—'}</p>
                  </div>
                  <div>
                    <span className="field-label">Vehicle</span>
                    <p data-testid="auto-vehicle">
                      {vehicle.registrationNumber
                        ? `${vehicle.registrationNumber}${vehicle.model ? ` — ${vehicle.model}` : ''}`
                        : '—'}
                    </p>
                  </div>
                  <div>
                    <span className="field-label">Vehicle Type</span>
                    <p>{vehicle.type || vehicle.model || '—'}</p>
                  </div>
                  <div>
                    <span className="field-label">Driver</span>
                    <p data-testid="auto-driver">
                      {selectedTrip?.driver?.user?.fullName || logbook?.driver?.user?.fullName || '—'}
                    </p>
                  </div>
                  <div>
                    <span className="field-label">Officer</span>
                    <p>{selectedTrip?.officer?.fullName || logbook?.officer?.fullName || '—'}</p>
                  </div>
                  <div>
                    <span className="field-label">From</span>
                    <p>{request.originName || logbook?.origin || '—'}</p>
                  </div>
                  <div>
                    <span className="field-label">To</span>
                    <p>{request.destinationName || logbook?.destination || '—'}</p>
                  </div>
                  <div>
                    <span className="field-label">Date</span>
                    <p>{request.departureDate || '—'}</p>
                  </div>
                  <div>
                    <span className="field-label">Vehicle Odometer</span>
                    <p data-testid="vehicle-odometer">{vehicleOdometer || '—'} KM</p>
                  </div>
                </div>
              </div>
            </div>

            {/* 3. TRIP TIME */}
            <div className="logbook-card" data-testid="trip-time-section">
              <div className="logbook-card-header">
                <h3>TRIP TIME</h3>
                <span className="eyebrow">Start / end of trip</span>
              </div>
              <div className="logbook-card-body">
                <div className="detail-grid">
                  <div>
                    <span className="field-label">Start Time</span>
                    <p data-testid="trip-start-time">
                      {fmtDateTime(selectedTrip?.startTime || logbook?.startTime)}
                    </p>
                  </div>
                  <div>
                    <span className="field-label">End Time</span>
                    <p data-testid="trip-end-time">
                      {fmtDateTime(selectedTrip?.endTime || logbook?.endTime)}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* 4. ODOMETER */}
            <div className="logbook-card" data-testid="odometer-section">
              <div className="logbook-card-header">
                <h3>ODOMETER</h3>
                <span className="eyebrow">Distance calculated automatically</span>
              </div>
              <div className="logbook-card-body">
                <div className="detail-grid">
                  <div>
                    <span className="field-label">Starting Odometer (KM)</span>
                    <p data-testid="start-odometer">{logbook?.startKm ?? '—'}</p>
                  </div>
                  <div>
                    <span className="field-label">Ending Odometer (KM)</span>
                    <p data-testid="end-odometer">{logbook?.endKm ?? '—'}</p>
                  </div>
                  <div>
                    <span className="field-label">Distance Travelled (KM)</span>
                    <p data-testid="distance-calculated">{logbook?.totalKm ?? '—'}</p>
</div>
</div>
        </div>
      </div>

{/* 5. FUEL */}
            {fuelSection}

            {/* 6. APPROVAL */}
            <div className="logbook-card" data-testid="approval-section">
              <div className="logbook-card-header">
                <h3>APPROVAL</h3>
                <span className="eyebrow">Officer review</span>
              </div>
              <div className="logbook-card-body" data-testid="logbook-approval">
                {approvalBlock()}
                {logbook?.submittedAt ? <p>Submitted: {fmtDateTime(logbook.submittedAt)}</p> : null}
              </div>
            </div>
          </div>
        ) : (
          <div className="logbook-card" data-testid="logbook-entry-form">
            <div className="logbook-card-header">
              <h3>ENTER LOGBOOK</h3>
              <span className="eyebrow">Odometer and fuel readings</span>
            </div>
            <div className="logbook-card-body">
              {(() => {
                const linkedFuelRequest = [...fuelRequests].reverse().find(fr => fr.litresRequested > 0);
                if (linkedFuelRequest) {
                  return (
                    <div className="form-field form-field-full" style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: 12 }}>
                      <label>Linked Fuel Request (Auto-populated)</label>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
                        <div>
                          <small>Fuel Request ID</small>
                          <span className="font-bold">#{linkedFuelRequest.id}</span>
                        </div>
                        <div>
                          <small>Requested Litres</small>
                          <span className="font-bold">{linkedFuelRequest.litresRequested} L</span>
                        </div>
                        <div>
                          <small>Request Type</small>
                          <span className="font-bold">
                            {linkedFuelRequest.requestType === 'EMERGENCY' ? (
                              <span className="status-badge status-emergency" style={{ fontSize: 11, textTransform: 'uppercase' }}>Emergency</span>
                            ) : (
                              'Normal'
                            )}
                          </span>
                        </div>
                        {linkedFuelRequest.requestType === 'EMERGENCY' && linkedFuelRequest.emergencyReason && (
                          <div>
                            <small>Emergency Reason</small>
                            <p style={{ margin: '4px 0 0', fontSize: 13, color: '#dc2626' }}>{linkedFuelRequest.emergencyReason}</p>
                          </div>
                        )}
                        <div>
                          <small>Status</small>
                          <span className="font-bold">
                            <StatusBadge status={linkedFuelRequest.status} />
                          </span>
                        </div>
                        {linkedFuelRequest.voucherNumber && (
                          <div>
                            <small>Voucher Number</small>
                            <span className="font-bold">{linkedFuelRequest.voucherNumber}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                }
                return null;
              })()}
              <div className="form-grid">
                <div className="form-field">
                  <label>Starting Odometer (KM) *</label>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={startKm}
                    onChange={(e) => setStartKm(e.target.value)}
                    placeholder={`e.g. ${vehicleOdometer || 12540}`}
                    data-testid="start-odometer-input"
                  />
                  <small>Cannot be less than the vehicle odometer ({vehicleOdometer || 0} KM)</small>
                </div>
                <div className="form-field">
                  <label>Ending Odometer (KM) *</label>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={endKm}
                    onChange={(e) => setEndKm(e.target.value)}
                    placeholder="e.g. 12685"
                    data-testid="end-odometer-input"
                  />
                </div>
                <div className="form-field">
                  <label>Distance Travelled (KM)</label>
                  <input
                    type="text"
                    className="input-calculated"
                    value={distanceKm != null ? `${distanceKm} km` : '—'}
                    disabled
                    data-testid="distance-calculated-input"
                  />
                  <small>Ending − Starting odometer (automatic)</small>
                </div>
                <div className="form-field">
                  <label>Fuel Type</label>
                  <input
                    type="text"
                    value={vehicle.fuelType || logbook?.fuelType || 'Diesel'}
                    disabled
                    data-testid="fuel-type-readonly"
                  />
                  <small>Loaded from the vehicle record</small>
                </div>
                <div className="form-field">
                  <label>Fuel Available Before Trip (L)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={fuelAvailable}
                    onChange={(e) => setFuelAvailable(e.target.value)}
                    data-testid="fuel-available-input"
                  />
                </div>
                <div className="form-field">
                  <label>Fuel Received from HPMU (L)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={fuelReceived}
                    onChange={(e) => setFuelReceived(e.target.value)}
                    data-testid="fuel-received-input"
                  />
                </div>
                <div className="form-field">
                  <label>Fuel Consumed (L)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={fuelUsed}
                    onChange={(e) => setFuelUsed(e.target.value)}
                    data-testid="fuel-used-input"
                  />
                </div>
                <div className="form-field">
                  <label>Fuel Remaining (L)</label>
                  <input
                    type="text"
                    className="input-calculated"
                    value={fuelRemaining >= 0 ? `${fuelRemaining} L` : '—'}
                    disabled
                    data-testid="fuel-remaining-calculated"
                  />
                  <small>Available + Received − Consumed (automatic)</small>
                </div>
                <div className="form-field form-field-full">
                  <label>Fuel Receipt (PDF/Image)</label>
                  <input
                    type="file"
                    accept=".pdf,image/*"
                    onChange={(e) => setReceiptFile(e.target.files?.[0] || null)}
                    data-testid="receipt-upload"
                  />
                  {receiptFile && <small>Selected: {receiptFile.name}</small>}
                </div>
              </div>

              {logbook?.status === 'RETURNED' && logbook.reviewComment && (
                <div className="callout callout-warning">
                  <span className="font-bold">Returned for correction:</span>
                  <p>{logbook.reviewComment}</p>
                </div>
              )}

              <div className="logbook-actions" data-testid="logbook-form-actions">
                <button
                  className="btn btn-ghost"
                  onClick={() => {
                    setEditing(false);
                    setError('');
                    if (logbook) hydrateForm(logbook);
                  }}
                >
                  Cancel
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={() => handleSave(false)}
                  disabled={saving || uploadingReceipt}
                  data-testid="save-logbook"
                >
                  {saving ? 'Saving...' : 'Save Logbook'}
                </button>
                <button
                  className="btn btn-primary"
                  onClick={() => handleSave(true)}
                  disabled={saving || uploadingReceipt || endKm === ''}
                  data-testid="submit-logbook"
                >
                  {saving ? 'Submitting...' : 'Submit Logbook'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 7. ACTIONS */}
        <div className="logbook-actions" data-testid="logbook-actions">
          <button className="btn btn-ghost" onClick={() => navigate('/driver')}>
            Back to Dashboard
          </button>
          <button
            className="btn btn-primary"
            onClick={() => {
              setError('');
              setSuccess('');
              if (!logbook) hydrateForm(null);
              setEditing(true);
            }}
            disabled={!isEditable || !trips.length}
            data-testid="enter-logbook"
          >
            Enter Logbook
          </button>
          <button className="btn btn-secondary" onClick={handlePrint} data-testid="print-logbook">
            Print Logbook
          </button>
        </div>
      </div>

      {showPrint && (
        <div id="logbook-print-root">
          <LogbookPrint
            logbook={printRecord}
            title="Driver Trip Logbook"
            preparedByLabel="Driver Signature"
          />
          <div className="row-actions no-print" style={{ margin: '12px 0' }}>
            <button className="btn btn-primary" onClick={() => window.print()}>
              Print Now
            </button>
            <button className="btn btn-ghost" onClick={() => setShowPrint(false)}>
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}
