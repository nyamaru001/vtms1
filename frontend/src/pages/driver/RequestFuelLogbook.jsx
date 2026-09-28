import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  tripsApi,
  fuelApi,
  logbooksApi,
  driverFuelApi,
} from '../../services/resources';
import Loading from '../../components/Loading';
import LogbookPrint from '../../components/LogbookPrint';
import SignaturePad from '../../components/SignaturePad';

const ACTIVE_STATUSES = [
  'DRIVER_ASSIGNED',
  'DRIVER_ACCEPTED',
  'TRIP_STARTED',
  'IN_PROGRESS',
  'DRIVER_COMPLETED',
  'OFFICER_COMPLETED',
];

export default function RequestFuelLogbook() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const tripIdParam = searchParams.get('tripId');

  const [loading, setLoading] = useState(true);
  const [savingLogbook, setSavingLogbook] = useState(false);
  const [submittingFuel, setSubmittingFuel] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showPrint, setShowPrint] = useState(false);

  const [trips, setTrips] = useState([]);
  const [tripId, setTripId] = useState(tripIdParam || '');
  const [logbook, setLogbook] = useState(null);
  const [fuelRequests, setFuelRequests] = useState([]);
  const [fuelEntries, setFuelEntries] = useState([]);
  const [receiptFile, setReceiptFile] = useState(null);
  const [uploadingReceipt, setUploadingReceipt] = useState(false);
  const [autoInfo, setAutoInfo] = useState(null);
  const [calc, setCalc] = useState(null);

  const [departureTime, setDepartureTime] = useState('');
  const [returnTime, setReturnTime] = useState('');
  const [startKm, setStartKm] = useState('');
  const [endKm, setEndKm] = useState('');
  const [fuelType, setFuelType] = useState('Diesel');
  const [fuelAvailable, setFuelAvailable] = useState('');
  const [fuelRequested, setFuelRequested] = useState('');
  const [fuelReceived, setFuelReceived] = useState('');
  const [fuelRemaining, setFuelRemaining] = useState('');
  const [notes, setNotes] = useState('');
  const [signature, setSignature] = useState(null);
  const [remarks, setRemarks] = useState('');

  const [currentKm, setCurrentKm] = useState('');
  const [litresRequested, setLitresRequested] = useState('');
  const [fuelReason, setFuelReason] = useState('');
  const [fuelNotes, setFuelNotes] = useState('');

  const selectedTrip = useMemo(
    () => trips.find((t) => String(t.id) === String(tripId)) || null,
    [trips, tripId]
  );

  const applyTripAutoFill = (trip) => {
    if (!trip) return;
    const req = trip.request || {};
    const vehicleOdometer = Number(trip.vehicle?.currentOdometer || 0);
    setAutoInfo({
      routeId: trip.tripNumber || req.requestNumber || '',
      tripNumber: trip.tripNumber || '',
      requestNumber: req.requestNumber || '',
      driverName: trip.driver?.user?.fullName || '',
      officerName: trip.officer?.fullName || '',
      requesterName: req.officer?.fullName || trip.officer?.fullName || '',
      passengers: req.passengers ?? '',
      origin: req.originName || '',
      destination: req.destinationName || '',
      purpose: req.purpose || '',
      date: req.departureDate || new Date().toISOString().slice(0, 10),
      departureDate: req.departureDate || '',
      vehicleRegistration: trip.vehicle?.registrationNumber || '',
      carType: trip.vehicle?.model || '',
      vehicleType: trip.vehicle?.type || '',
      fuelType: trip.vehicle?.fuelType || 'Diesel',
      fuelVoucherLitres: req.totalFuelLitres ?? '',
      vehicleOdometer,
      tripStatus: trip.status || '',
    });
    if (trip.vehicle?.registrationNumber) {
      /* keep read-only display via autoInfo */
    }
    if (trip.vehicle?.fuelType) setFuelType(trip.vehicle.fuelType);
    if (req.totalFuelLitres != null && fuelRequested === '') {
      setFuelRequested(String(req.totalFuelLitres));
      setLitresRequested(String(req.totalFuelLitres));
    }
    if (trip.startKm != null && startKm === '') setStartKm(String(trip.startKm));
    if (trip.startKm != null && currentKm === '') setCurrentKm(String(trip.startKm));
    if (vehicleOdometer && currentKm === '') setCurrentKm(String(vehicleOdometer));
    if (!departureTime && req.departureTime) setDepartureTime(req.departureTime);
    setTripId(String(trip.id));
    if (!fuelReason && req.purpose) setFuelReason(`Fuel required for: ${req.purpose}`);
  };

  const loadTripContext = async (tid) => {
    if (!tid) return;
    try {
      const trip = await tripsApi.get(tid);
      applyTripAutoFill(trip);
      try {
        const entries = await driverFuelApi.list({ tripId: tid });
        setFuelEntries(Array.isArray(entries) ? entries : entries?.data || []);
      } catch {
        setFuelEntries([]);
      }
      try {
        const list = await fuelApi.list({ tripId: tid });
        const rows = Array.isArray(list) ? list : list?.data || [];
        setFuelRequests(rows);
      } catch {
        setFuelRequests([]);
      }
      try {
        const c = await fuelApi.calc(tid);
        setCalc(c?.data || c);
      } catch {
        setCalc(null);
      }
      try {
        const lbs = await logbooksApi.list({ tripId: tid });
        const rows = Array.isArray(lbs?.data) ? lbs.data : Array.isArray(lbs) ? lbs : [];
        const existing = rows.find((lb) => String(lb.tripId) === String(tid));
        if (existing) {
          const full = await logbooksApi.get(existing.id);
          setLogbook(full);
          setStartKm(full.startKm ?? '');
          setEndKm(full.endKm ?? '');
          setFuelType(full.fuelType || 'Diesel');
          setFuelAvailable(full.fuelAvailableBeforeTrip ?? '');
          setFuelRequested(full.fuelRequested ?? '');
          setFuelReceived(full.fuelReceivedFromHPMU ?? '');
          setFuelRemaining(full.fuelRemaining ?? '');
          setNotes(full.postTripNotes || full.remarks || '');
          setRemarks(full.remarks || '');
          setSignature(full.signature || null);
        }
      } catch {
        /* no logbook yet */
      }
    } catch (err) {
      console.warn('Failed to load trip context', err);
    }
  };

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        setLoading(true);
        setError('');
        const response = await tripsApi.list();
        const data = Array.isArray(response)
          ? response
          : response?.data || response?.trips || [];
        const activeTrips = data.filter((trip) =>
          ACTIVE_STATUSES.includes(String(trip.status || '').toUpperCase())
        );
        if (!mounted) return;
        setTrips(activeTrips);
        if (tripIdParam && activeTrips.some((t) => String(t.id) === String(tripIdParam))) {
          setTripId(String(tripIdParam));
        } else if (!tripIdParam && activeTrips.length === 1) {
          setTripId(String(activeTrips[0].id));
        } else if (id && id !== 'new') {
          const lb = await logbooksApi.get(id);
          if (!mounted) return;
          setLogbook(lb);
          if (lb?.tripId) setTripId(String(lb.tripId));
          setStartKm(lb.startKm ?? '');
          setEndKm(lb.endKm ?? '');
          setFuelType(lb.fuelType || 'Diesel');
          setFuelAvailable(lb.fuelAvailableBeforeTrip ?? '');
          setFuelRequested(lb.fuelRequested ?? '');
          setFuelReceived(lb.fuelReceivedFromHPMU ?? '');
          setFuelRemaining(lb.fuelRemaining ?? '');
          setNotes(lb.postTripNotes || lb.remarks || '');
          setRemarks(lb.remarks || '');
          setSignature(lb.signature || null);
          if (lb.tripId) await loadTripContext(lb.tripId);
        }
      } catch (err) {
        if (mounted) {
          setError(err.response?.data?.message || 'Failed to load assigned trips.');
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => {
      mounted = false;
    };
  }, [id, tripIdParam]);

  useEffect(() => {
    if (!tripId) return;
    loadTripContext(tripId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripId]);

  const editable =
    !logbook ||
    ['DRAFT', 'RETURNED', 'SUBMITTED'].includes(String(logbook?.status || '').toUpperCase());

  const actualDistance =
    Number(endKm) && Number(startKm) ? Number(endKm) - Number(startKm) : null;

  const buildLogbookPayload = () => ({
    carType: autoInfo?.carType || '',
    vehicleRegistration: autoInfo?.vehicleRegistration || '',
    tripId: tripId ? Number(tripId) : null,
    startKm: startKm === '' ? null : Number(startKm),
    fuelType,
    fuelAvailableBeforeTrip: fuelAvailable === '' ? null : Number(fuelAvailable),
    fuelRequested: fuelRequested === '' ? null : Number(fuelRequested),
    fuelReceivedFromHPMU: fuelReceived === '' ? null : Number(fuelReceived),
    fuelRemaining: fuelRemaining === '' ? null : Number(fuelRemaining),
    endKm: endKm === '' ? null : Number(endKm),
    totalKm: actualDistance,
    startTime: departureTime ? departureTime : undefined,
    endTime: returnTime ? returnTime : undefined,
    postTripNotes: notes.trim(),
    remarks: remarks.trim(),
    signature: signature || null,
    origin: autoInfo?.origin || undefined,
    destination: autoInfo?.destination || undefined,
    purpose: autoInfo?.purpose || undefined,
    tripName: autoInfo?.tripNumber || undefined,
    fuelIssuedLitres:
      autoInfo?.fuelVoucherLitres !== '' && autoInfo?.fuelVoucherLitres != null
        ? Number(autoInfo.fuelVoucherLitres)
        : undefined,
  });

  const uploadReceipt = async (logbookId) => {
    if (!receiptFile) return;
    setUploadingReceipt(true);
    try {
      const fd = new FormData();
      if (tripId) fd.append('tripId', tripId);
      if (logbookId) fd.append('logbookId', logbookId);
      fd.append('litres', fuelRequested || litresRequested || '0');
      fd.append('description', 'Fuel receipt for Request Fuel page');
      fd.append('receipt', receiptFile);
      await driverFuelApi.create(fd);
      setReceiptFile(null);
      if (tripId) {
        const entries = await driverFuelApi.list({ tripId });
        setFuelEntries(Array.isArray(entries) ? entries : entries?.data || []);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to upload receipt.');
      throw err;
    } finally {
      setUploadingReceipt(false);
    }
  };

  const handleSaveDraft = async () => {
    setError('');
    setSuccess('');
    if (!tripId) {
      setError('No active trip selected. Accept an assignment first.');
      return;
    }
    if (startKm !== '' && endKm !== '' && Number(endKm) < Number(startKm)) {
      setError('Ending odometer cannot be less than starting odometer.');
      return;
    }
    const vehicleOdometer = Number(autoInfo?.vehicleOdometer || 0);
    if (startKm !== '' && vehicleOdometer && Number(startKm) < vehicleOdometer) {
      setError(`Starting odometer cannot be less than vehicle odometer (${vehicleOdometer} KM).`);
      return;
    }
    try {
      setSavingLogbook(true);
      let savedId = logbook?.id;
      if (savedId) {
        await logbooksApi.update(savedId, buildLogbookPayload());
        const refreshed = await logbooksApi.get(savedId);
        setLogbook(refreshed);
      } else {
        const created = await logbooksApi.create(buildLogbookPayload());
        setLogbook(created);
        savedId = created.id;
        navigate(`/driver/logbook/${created.id}`, { replace: true });
      }
      if (receiptFile && savedId) await uploadReceipt(savedId);
      setSuccess('Logbook draft saved.');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save logbook draft.');
    } finally {
      setSavingLogbook(false);
    }
  };

  const handleSubmitLogbook = async () => {
    setError('');
    setSuccess('');
    if (!endKm) {
      setError('Enter the ending odometer before submitting the logbook.');
      return;
    }
    if (Number(endKm) < Number(startKm || 0)) {
      setError('Ending odometer cannot be less than starting odometer.');
      return;
    }
    try {
      setSavingLogbook(true);
      let savedId = logbook?.id;
      if (savedId) {
        await logbooksApi.update(savedId, buildLogbookPayload());
      } else {
        const created = await logbooksApi.create(buildLogbookPayload());
        setLogbook(created);
        savedId = created.id;
        navigate(`/driver/logbook/${created.id}`, { replace: true });
      }
      if (receiptFile) await uploadReceipt(savedId);
      await logbooksApi.submit(savedId);
      const updated = await logbooksApi.get(savedId);
      setLogbook(updated);
      setSuccess('Logbook submitted for review.');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to submit logbook.');
    } finally {
      setSavingLogbook(false);
    }
  };

  const handleSubmitFuel = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!selectedTrip) {
      setError('Select an active trip.');
      return;
    }
    if (!currentKm || Number(currentKm) < 0) {
      setError('Enter a valid current odometer reading.');
      return;
    }
    const vehicleOdometer = Number(autoInfo?.vehicleOdometer || 0);
    if (vehicleOdometer && Number(currentKm) < vehicleOdometer) {
      setError(`Current odometer cannot be less than vehicle odometer (${vehicleOdometer} KM).`);
      return;
    }
    if (!litresRequested || Number(litresRequested) <= 0) {
      setError('Enter the fuel amount in litres.');
      return;
    }
    if (!fuelReason.trim()) {
      setError('Please provide a reason for this fuel request.');
      return;
    }
    try {
      setSubmittingFuel(true);
      await fuelApi.create({
        tripId: Number(selectedTrip.id),
        currentKm: Number(currentKm),
        litresRequested: Number(litresRequested),
        reason: fuelReason.trim(),
        notes: fuelNotes.trim(),
      });
      if (receiptFile) {
        try {
          await uploadReceipt(logbook?.id);
        } catch {
          /* receipt already reported */
        }
      }
      const list = await fuelApi.list({ tripId: selectedTrip.id });
      setFuelRequests(Array.isArray(list) ? list : list?.data || []);
      setSuccess('Fuel request submitted for HPMU review.');
      setFuelReason('');
      setFuelNotes('');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to submit fuel request.');
    } finally {
      setSubmittingFuel(false);
    }
  };

  const handlePrint = () => {
    setShowPrint(true);
    setTimeout(() => window.print(), 100);
  };

  if (loading) return <Loading label="Loading Request Fuel..." />;

  const voucherRequest = [...fuelRequests]
    .reverse()
    .find(
      (fr) =>
        fr.voucherNumber &&
        ['HPMU_APPROVED', 'HPMU_RELEASED', 'DRIVER_CONFIRMED', 'COMPLETED'].includes(fr.status)
    );
  const voucherNumber = voucherRequest?.voucherNumber || '';
  const latestFuel = [...fuelRequests].reverse()[0] || null;

  const printRecord = {
    ...(logbook || {}),
    carType: autoInfo?.carType,
    vehicleRegistration: autoInfo?.vehicleRegistration,
    tripId: tripId || autoInfo?.tripNumber,
    tripName: logbook?.tripName || autoInfo?.tripNumber,
    origin: autoInfo?.origin || logbook?.origin,
    destination: autoInfo?.destination || logbook?.destination,
    purpose: autoInfo?.purpose || logbook?.purpose,
    entryDate: logbook?.entryDate || autoInfo?.date,
    startKm: startKm !== '' ? Number(startKm) : logbook?.startKm,
    endKm: endKm !== '' ? Number(endKm) : logbook?.endKm,
    totalKm: actualDistance,
    fuelType,
    fuelAvailableBeforeTrip:
      fuelAvailable !== '' ? Number(fuelAvailable) : logbook?.fuelAvailableBeforeTrip,
    fuelRequested: fuelRequested !== '' ? Number(fuelRequested) : logbook?.fuelRequested,
    fuelReceivedFromHPMU:
      fuelReceived !== '' ? Number(fuelReceived) : logbook?.fuelReceivedFromHPMU,
    fuelRemaining: fuelRemaining !== '' ? Number(fuelRemaining) : logbook?.fuelRemaining,
    fuelIssuedLitres:
      autoInfo?.fuelVoucherLitres !== '' && autoInfo?.fuelVoucherLitres != null
        ? Number(autoInfo.fuelVoucherLitres)
        : logbook?.fuelIssuedLitres,
    postTripNotes: notes,
    remarks,
    signature,
    driver:
      logbook?.driver ||
      (autoInfo?.driverName ? { user: { fullName: autoInfo.driverName } } : null),
    officer:
      logbook?.officer ||
      (autoInfo?.officerName ? { user: { fullName: autoInfo.officerName } } : null),
    status: logbook?.status || 'DRAFT',
    trip: logbook?.trip || (autoInfo?.tripNumber ? { tripNumber: autoInfo.tripNumber } : null),
    fuelEntries,
    voucherNumber,
  };

  return (
    <>
      <div className="logbook-form-page" data-testid="request-fuel-page">
        <div className="logbook-form-header">
          <div>
            <span className="eyebrow">DRIVER PORTAL</span>
            <h2>Request Fuel</h2>
            <p className="field-hint">
              One page for trip logbook details and fuel requests. Route ID, vehicle, and driver load
              automatically from your active assignment.
            </p>
          </div>
          {logbook && (
            <span
              className={`driver-logbook-status-label driver-logbook-status-${String(
                logbook.status || ''
              ).toLowerCase()}`}
            >
              {logbook.status}
            </span>
          )}
        </div>

        {latestFuel && (
          <div className="callout" data-testid="fuel-request-status">
            <strong>Latest fuel request:</strong> {latestFuel.status}
            {voucherNumber ? (
              <>
                {' · '}
                <strong data-testid="fuel-voucher-number">Voucher: {voucherNumber}</strong>
              </>
            ) : null}
          </div>
        )}

        {logbook?.status === 'RETURNED' && logbook.reviewComment && (
          <div className="callout callout-warning">
            <strong>Returned for correction:</strong>
            <p>{logbook.reviewComment}</p>
          </div>
        )}

        {success && <div className="callout callout-success">{success}</div>}
        {error && <div className="form-error">{error}</div>}

        {!selectedTrip && !trips.length && (
          <div className="empty-state">
            No active trip. Accept an assignment from My Assignments to request fuel.
          </div>
        )}

        {trips.length > 1 && (
          <div className="logbook-card" style={{ marginBottom: 16 }}>
            <div className="logbook-card-body">
              <div className="form-field">
                <label>Active Trip</label>
                <select className="input" value={tripId} onChange={(e) => setTripId(e.target.value)}>
                  <option value="">Select trip</option>
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

        <div className="logbook-grid">
          {/* TRIP INFORMATION — auto */}
          <div className="logbook-card" data-testid="trip-info-section">
            <div className="logbook-card-header">
              <h3>TRIP INFORMATION</h3>
              <span className="eyebrow">Auto-loaded from database</span>
            </div>
            <div className="logbook-card-body">
              <div className="detail-grid">
                <div>
                  <span className="field-label">Route ID</span>
                  <p data-testid="route-id">{autoInfo?.routeId || '—'}</p>
                </div>
                <div>
                  <span className="field-label">Trip Number</span>
                  <p>{autoInfo?.tripNumber || '—'}</p>
                </div>
                <div>
                  <span className="field-label">Request Number</span>
                  <p>{autoInfo?.requestNumber || '—'}</p>
                </div>
                <div>
                  <span className="field-label">Vehicle</span>
                  <p data-testid="auto-vehicle">
                    {autoInfo?.vehicleRegistration
                      ? `${autoInfo.vehicleRegistration}${autoInfo.carType ? ` — ${autoInfo.carType}` : ''}`
                      : '—'}
                  </p>
                </div>
                <div>
                  <span className="field-label">Driver</span>
                  <p data-testid="auto-driver">{autoInfo?.driverName || '—'}</p>
                </div>
                <div>
                  <span className="field-label">Passenger / Vehicle User</span>
                  <p data-testid="auto-requester">
                    {autoInfo?.requesterName || autoInfo?.officerName || '—'}
                    {autoInfo?.passengers ? ` (${autoInfo.passengers} pax)` : ''}
                  </p>
                </div>
                <div>
                  <span className="field-label">From</span>
                  <p>{autoInfo?.origin || '—'}</p>
                </div>
                <div>
                  <span className="field-label">To</span>
                  <p>{autoInfo?.destination || '—'}</p>
                </div>
                <div>
                  <span className="field-label">Date</span>
                  <p>{autoInfo?.date || '—'}</p>
                </div>
                <div>
                  <span className="field-label">Vehicle Odometer</span>
                  <p data-testid="vehicle-odometer">{autoInfo?.vehicleOdometer ?? '—'} KM</p>
                </div>
              </div>
            </div>
          </div>

          {/* LOGBOOK DETAILS */}
          <div className="logbook-card" data-testid="logbook-details-section">
            <div className="logbook-card-header">
              <h3>LOGBOOK DETAILS</h3>
              <span className="eyebrow">Departure, return, odometer</span>
            </div>
            <div className="logbook-card-body">
              <div className="form-grid">
                <div className={`form-field ${!editable ? 'readonly' : ''}`}>
                  <label>Departure Time</label>
                  <input
                    type="time"
                    value={departureTime}
                    onChange={(e) => setDepartureTime(e.target.value)}
                    disabled={!editable}
                  />
                </div>
                <div className={`form-field ${!editable ? 'readonly' : ''}`}>
                  <label>Return Time</label>
                  <input
                    type="time"
                    value={returnTime}
                    onChange={(e) => setReturnTime(e.target.value)}
                    disabled={!editable}
                  />
                </div>
                <div className={`form-field ${!editable ? 'readonly' : ''}`}>
                  <label>Starting Odometer (KM)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={startKm}
                    onChange={(e) => setStartKm(e.target.value)}
                    disabled={!editable}
                    placeholder="e.g. 12540"
                    data-testid="start-odometer"
                  />
                </div>
                <div className={`form-field ${!editable ? 'readonly' : ''}`}>
                  <label>Ending Odometer (KM)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={endKm}
                    onChange={(e) => setEndKm(e.target.value)}
                    disabled={!editable}
                    placeholder="e.g. 12685"
                    data-testid="end-odometer"
                  />
                </div>
                <div className="form-field">
                  <label>Distance Travelled (KM)</label>
                  <input
                    type="text"
                    value={actualDistance != null ? `${actualDistance} km` : '—'}
                    disabled
                    className="input-calculated"
                    data-testid="distance-calculated"
                  />
                  <small>Ending − Starting odometer</small>
                </div>
                <div className={`form-field ${!editable ? 'readonly' : ''}`}>
                  <label>Fuel Type</label>
                  <select
                    value={fuelType}
                    onChange={(e) => setFuelType(e.target.value)}
                    disabled={!editable}
                  >
                    <option value="Diesel">Diesel</option>
                    <option value="Petrol">Petrol</option>
                  </select>
                </div>
                <div className={`form-field ${!editable ? 'readonly' : ''}`}>
                  <label>Fuel Available Before Trip (L)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={fuelAvailable}
                    onChange={(e) => setFuelAvailable(e.target.value)}
                    disabled={!editable}
                  />
                </div>
                <div className={`form-field ${!editable ? 'readonly' : ''}`}>
                  <label>Fuel Remaining After Trip (L)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={fuelRemaining}
                    onChange={(e) => setFuelRemaining(e.target.value)}
                    disabled={!editable}
                  />
                </div>
                <div className={`form-field ${!editable ? 'readonly' : ''}`}>
                  <label>Fuel Received from HPMU (L)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={fuelReceived}
                    onChange={(e) => setFuelReceived(e.target.value)}
                    disabled={!editable}
                    data-testid="fuel-received"
                  />
                </div>
                <div className="form-field">
                  <label>Fuel Voucher (auto)</label>
                  <input
                    type="text"
                    value={voucherNumber || (autoInfo?.fuelVoucherLitres ? `${autoInfo.fuelVoucherLitres} L` : '—')}
                    disabled
                    data-testid="fuel-voucher"
                  />
                  <small>Generated by HPMU when fuel is released</small>
                </div>
              </div>
            </div>
          </div>

          {/* FUEL REQUEST */}
          <div className="logbook-card" data-testid="fuel-request-section">
            <div className="logbook-card-header">
              <h3>FUEL REQUEST</h3>
              <span className="eyebrow">Submitted to HPMU</span>
            </div>
            <div className="logbook-card-body">
              <form onSubmit={handleSubmitFuel}>
                <div className="form-grid">
                  <div className="form-field">
                    <label>Current Odometer (KM) *</label>
                    <input
                      type="number"
                      min="0"
                      step="0.1"
                      value={currentKm}
                      onChange={(e) => setCurrentKm(e.target.value)}
                      placeholder="Current odometer"
                      required
                      data-testid="fuel-current-km"
                    />
                  </div>
                  <div className="form-field">
                    <label>Fuel Requested (Litres) *</label>
                    <input
                      type="number"
                      min="0.1"
                      step="0.1"
                      value={litresRequested}
                      onChange={(e) => setLitresRequested(e.target.value)}
                      placeholder="Litres needed"
                      required
                      data-testid="fuel-litres"
                    />
                  </div>
                  <div className="form-field form-field-full">
                    <label>Reason *</label>
                    <textarea
                      rows="2"
                      value={fuelReason}
                      onChange={(e) => setFuelReason(e.target.value)}
                      placeholder="Why do you need this fuel?"
                      required
                    />
                  </div>
                  <div className="form-field form-field-full">
                    <label>Additional Notes</label>
                    <textarea
                      rows="2"
                      value={fuelNotes}
                      onChange={(e) => setFuelNotes(e.target.value)}
                      placeholder="Optional notes..."
                    />
                  </div>
                  <div className="form-field form-field-full">
                    <label>Receipt (PDF/Image)</label>
                    <input
                      type="file"
                      accept=".pdf,image/*"
                      onChange={(e) => setReceiptFile(e.target.files?.[0] || null)}
                      data-testid="receipt-upload"
                    />
                    {receiptFile && <small>Selected: {receiptFile.name}</small>}
                  </div>
                  {calc && (
                    <div className="form-field form-field-full">
                      <label>Trip Fuel Estimate</label>
                      <input
                        type="text"
                        disabled
                        value={`${calc.routeDistanceKm ?? '—'} KM route · ${
                          calc.expectedFuelLitres ?? '—'
                        } L estimated`}
                        className="input-calculated"
                      />
                    </div>
                  )}
                </div>
                <div className="row-actions" style={{ marginTop: 12 }}>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={submittingFuel || !selectedTrip}
                    data-testid="submit-fuel-request"
                  >
                    {submittingFuel ? 'Submitting...' : 'Submit Fuel Request'}
                  </button>
                </div>
              </form>

              {fuelRequests.length > 0 && (
                <div style={{ marginTop: 16 }}>
                  <span className="field-label">Fuel request history</span>
                  <ul data-testid="fuel-history">
                    {fuelRequests.map((fr) => (
                      <li key={fr.id}>
                        {fr.litresRequested} L · {fr.status}
                        {fr.voucherNumber ? ` · ${fr.voucherNumber}` : ''}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {fuelEntries.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  <span className="field-label">Uploaded receipts</span>
                  <ul data-testid="fuel-receipt-list">
                    {fuelEntries.map((f) => (
                      <li key={f.id}>
                        {f.entryDate ? String(f.entryDate).slice(0, 10) : '—'} · {f.litres ?? '—'} L
                        {f.receiptPath ? (
                          <>
                            {' · '}
                            <a
                              href={
                                f.receiptPath.startsWith('/')
                                  ? f.receiptPath
                                  : `/uploads/fuel/${f.receiptPath}`
                              }
                              target="_blank"
                              rel="noreferrer"
                            >
                              View receipt
                            </a>
                          </>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>

          {/* REMARKS */}
          <div className="logbook-card" data-testid="remarks-section">
            <div className="logbook-card-header">
              <h3>REMARKS</h3>
            </div>
            <div className="logbook-card-body">
              <div className="form-field form-field-full">
                <label>Post-trip notes</label>
                <textarea
                  rows="3"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  disabled={!editable}
                  placeholder="Optional remarks for this trip..."
                />
              </div>
              <div className="form-field form-field-full">
                <label>Signature</label>
                <SignaturePad value={signature} onChange={setSignature} disabled={!editable} />
              </div>
            </div>
          </div>
        </div>

        {/* ACTIONS */}
        <div className="logbook-actions" data-testid="request-fuel-actions">
          <button className="btn btn-ghost" onClick={() => navigate('/driver')}>
            Cancel
          </button>
          <button className="btn btn-ghost" onClick={handlePrint} data-testid="print-logbook">
            Print Logbook
          </button>
          <button
            className="btn btn-secondary"
            onClick={handleSaveDraft}
            disabled={savingLogbook || uploadingReceipt}
            data-testid="save-draft"
          >
            {savingLogbook ? 'Saving...' : 'Save Draft'}
          </button>
          <button
            className="btn btn-primary"
            onClick={handleSubmitLogbook}
            disabled={savingLogbook || uploadingReceipt || !endKm}
            data-testid="submit-logbook"
          >
            {savingLogbook ? 'Submitting...' : 'Submit Logbook'}
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
          <div className="row-actions" style={{ margin: '12px 0' }}>
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
