import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { logbooksApi, tripsApi, driverFuelApi } from '../../services/resources';
import Loading from '../../components/Loading';
import SignaturePad from '../../components/SignaturePad';
import LogbookPrint from '../../components/LogbookPrint';

export default function LogbookForm() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const isNew = id === 'new' || !id;
  const tripIdParam = searchParams.get('tripId');

  const [logbook, setLogbook] = useState(null);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showPrint, setShowPrint] = useState(false);

  const [carType, setCarType] = useState('');
  const [vehicleRegistration, setVehicleRegistration] = useState('');
  const [tripId, setTripId] = useState(tripIdParam || '');
  const [startKm, setStartKm] = useState('');
  const [fuelType, setFuelType] = useState('Diesel');
  const [fuelAvailable, setFuelAvailable] = useState('');
  const [fuelRequested, setFuelRequested] = useState('');
  const [fuelReceived, setFuelReceived] = useState('');
  const [fuelRemaining, setFuelRemaining] = useState('');
  const [endKm, setEndKm] = useState('');
  const [notes, setNotes] = useState('');
  const [signature, setSignature] = useState(null);
  const [receiptFile, setReceiptFile] = useState(null);
  const [fuelEntries, setFuelEntries] = useState([]);
  const [autoInfo, setAutoInfo] = useState(null);
  const [uploadingReceipt, setUploadingReceipt] = useState(false);

  const applyTripAutoFill = (trip) => {
    if (!trip) return;
    const req = trip.request || {};
    setAutoInfo({
      tripNumber: trip.tripNumber || '',
      requestNumber: req.requestNumber || '',
      driverName: trip.driver?.user?.fullName || '',
      officerName: trip.officer?.fullName || '',
      origin: req.originName || '',
      destination: req.destinationName || '',
      purpose: req.purpose || '',
      date: req.departureDate || new Date().toISOString().slice(0, 10),
      vehicleRegistration: trip.vehicle?.registrationNumber || '',
      carType: trip.vehicle?.model || '',
      fuelType: trip.vehicle?.fuelType || 'Diesel',
      fuelVoucher: req.totalFuelLitres ?? '',
    });
    if (trip.vehicle?.registrationNumber) setVehicleRegistration(trip.vehicle.registrationNumber);
    if (trip.vehicle?.model) setCarType(trip.vehicle.model);
    if (trip.vehicle?.fuelType) setFuelType(trip.vehicle.fuelType);
    if (req.totalFuelLitres != null && fuelRequested === '') setFuelRequested(String(req.totalFuelLitres));
    if (trip.startKm != null && startKm === '') setStartKm(String(trip.startKm));
    setTripId(String(trip.id));
  };

  const loadTripContext = async (tid) => {
    if (!tid) return;
    try {
      const trip = await tripsApi.get(tid);
      applyTripAutoFill(trip);
      try {
        const entries = await driverFuelApi.list({ tripId: tid });
        setFuelEntries(Array.isArray(entries) ? entries : entries?.data || []);
      } catch { setFuelEntries([]); }
    } catch (err) {
      console.warn('Failed to load trip context', err);
    }
  };

  useEffect(() => {
    if (isNew) {
      setLoading(false);
      if (tripIdParam) loadTripContext(tripIdParam);
      return;
    }
    const load = async () => {
      try {
        setLoading(true);
        const data = await logbooksApi.get(id);
        setLogbook(data);
        setCarType(data?.carType || '');
        setVehicleRegistration(data?.vehicleRegistration || '');
        setTripId(data?.tripId || tripIdParam || '');
        setStartKm(data?.startKm ?? '');
        setFuelType(data?.fuelType || 'Diesel');
        setFuelAvailable(data?.fuelAvailableBeforeTrip ?? '');
        setFuelRequested(data?.fuelRequested ?? '');
        setFuelReceived(data?.fuelReceivedFromHPMU ?? '');
        setFuelRemaining(data?.fuelRemaining ?? '');
        setEndKm(data?.endKm ?? '');
        setNotes(data?.postTripNotes || data?.remarks || '');
        setSignature(data?.signature || null);
        if (data?.tripId) {
          await loadTripContext(data.tripId);
        } else if (tripIdParam) {
          await loadTripContext(tripIdParam);
        }
        try {
          const params = data?.tripId ? { tripId: data.tripId } : {};
          if (Object.keys(params).length) {
            const entries = await driverFuelApi.list(params);
            setFuelEntries(Array.isArray(entries) ? entries : entries?.data || []);
          }
        } catch { /* optional */ }
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to load logbook.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id, isNew]);

  const editable = !logbook || ['DRAFT', 'RETURNED'].includes(String(logbook?.status || '').toUpperCase());
  const actualDistance = (Number(endKm) && Number(startKm)) ? Number(endKm) - Number(startKm) : null;

  const buildPayload = () => ({
    carType: carType.trim(),
    vehicleRegistration: vehicleRegistration.trim(),
    tripId: tripId || null,
    startKm: startKm === '' ? null : Number(startKm),
    fuelType,
    fuelAvailableBeforeTrip: fuelAvailable === '' ? null : Number(fuelAvailable),
    fuelRequested: fuelRequested === '' ? null : Number(fuelRequested),
    fuelReceivedFromHPMU: fuelReceived === '' ? null : Number(fuelReceived),
    fuelRemaining: fuelRemaining === '' ? null : Number(fuelRemaining),
    endKm: endKm === '' ? null : Number(endKm),
    postTripNotes: notes.trim(),
    signature: signature || null,
    origin: autoInfo?.origin || undefined,
    destination: autoInfo?.destination || undefined,
    purpose: autoInfo?.purpose || undefined,
    tripName: autoInfo?.tripNumber || undefined,
    fuelIssuedLitres: autoInfo?.fuelVoucher != null && autoInfo.fuelVoucher !== '' ? Number(autoInfo.fuelVoucher) : undefined,
  });

  const uploadReceipt = async (logbookId) => {
    if (!receiptFile) return;
    setUploadingReceipt(true);
    try {
      const fd = new FormData();
      if (tripId) fd.append('tripId', tripId);
      fd.append('logbookId', logbookId);
      fd.append('litres', fuelRequested || '0');
      fd.append('description', 'Fuel receipt for logbook');
      fd.append('receipt', receiptFile);
      await driverFuelApi.create(fd);
      setReceiptFile(null);
      setSuccess('Receipt uploaded.');
      if (tripId) {
        const entries = await driverFuelApi.list({ tripId });
        setFuelEntries(Array.isArray(entries) ? entries : entries?.data || []);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to upload receipt.');
    } finally {
      setUploadingReceipt(false);
    }
  };

  const handleSave = async () => {
    setError('');
    setSuccess('');
    try {
      setSaving(true);
      let savedId = id;
      if (isNew) {
        const result = await logbooksApi.create(buildPayload());
        savedId = result.id;
        navigate(`/driver/logbook/${result.id}`, { replace: true });
        setLogbook(result);
        setSuccess('Logbook created. You can continue editing later.');
      } else {
        await logbooksApi.update(id, buildPayload());
        await logbooksApi.get(id).then((d) => setLogbook(d));
        setSuccess('Logbook saved.');
      }
      if (receiptFile && savedId) {
        await uploadReceipt(savedId);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save.');
    } finally {
      setSaving(false);
    }
  };

  const handleComplete = async () => {
    setError('');
    setSuccess('');
    if (!endKm) { setError('Please enter the ending odometer to complete the logbook.'); return; }
    try {
      setCompleting(true);
      const targetId = id || logbook.id;
      await logbooksApi.update(targetId, buildPayload());
      if (receiptFile) await uploadReceipt(targetId);
      await logbooksApi.submit(targetId);
      const updated = await logbooksApi.get(targetId);
      setLogbook(updated);
      setSuccess('Logbook completed and submitted for review.');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to complete logbook.');
    } finally {
      setCompleting(false);
    }
  };

  const handlePrint = () => { setShowPrint(true); setTimeout(() => window.print(), 100); };

  if (loading) return <Loading label="Loading logbook..." />;

  const printRecord = {
    ...(logbook || {}),
    carType: carType || autoInfo?.carType,
    vehicleRegistration: vehicleRegistration || autoInfo?.vehicleRegistration,
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
    fuelAvailableBeforeTrip: fuelAvailable !== '' ? Number(fuelAvailable) : logbook?.fuelAvailableBeforeTrip,
    fuelRequested: fuelRequested !== '' ? Number(fuelRequested) : logbook?.fuelRequested,
    fuelReceivedFromHPMU: fuelReceived !== '' ? Number(fuelReceived) : logbook?.fuelReceivedFromHPMU,
    fuelRemaining: fuelRemaining !== '' ? Number(fuelRemaining) : logbook?.fuelRemaining,
    fuelIssuedLitres: autoInfo?.fuelVoucher !== '' && autoInfo?.fuelVoucher != null ? Number(autoInfo.fuelVoucher) : logbook?.fuelIssuedLitres,
    postTripNotes: notes,
    signature,
    driver: logbook?.driver || (autoInfo?.driverName ? { user: { fullName: autoInfo.driverName } } : null),
    officer: logbook?.officer || (autoInfo?.officerName ? { fullName: autoInfo.officerName } : null),
    status: logbook?.status || 'DRAFT',
    trip: logbook?.trip || (autoInfo?.tripNumber ? { tripNumber: autoInfo.tripNumber } : null),
    fuelEntries,
  };

  return (
    <>
    <div className="logbook-form-page">
      <div className="logbook-form-header">
        <div>
          <button type="button" className="btn-link" onClick={() => navigate('/driver/logbook')}>&larr; My Logbook</button>
          <span className="eyebrow">DRIVER LOGBOOK</span>
          <h2>{isNew ? 'New Logbook Entry' : (logbook?.tripName || autoInfo?.tripNumber || `Logbook #${logbook?.id || id}`)}</h2>
          {autoInfo && (
            <p className="field-hint" data-testid="logbook-autofill">
              Auto-filled from trip {autoInfo.tripNumber}{autoInfo.requestNumber ? ` · Request ${autoInfo.requestNumber}` : ''}
              {autoInfo.officerName ? ` · Officer: ${autoInfo.officerName}` : ''}
            </p>
          )}
        </div>
        {logbook && (
          <span className={`driver-logbook-status-label driver-logbook-status-${String(logbook.status || '').toLowerCase()}`}>
            {logbook.status}
          </span>
        )}
      </div>

      {logbook?.status === 'RETURNED' && logbook.reviewComment && (
        <div className="callout callout-warning">
          <strong>Returned for correction:</strong>
          <p>{logbook.reviewComment}</p>
        </div>
      )}

      {success && <div className="callout callout-success">{success}</div>}
      {error && <div className="form-error">{error}</div>}

      <div className="logbook-grid">
        {/* AUTO-FILLED TRIP CONTEXT */}
        {autoInfo && (
          <div className="logbook-card" data-testid="logbook-auto-fields">
            <div className="logbook-card-header">
              <h3>TRIP DETAILS (AUTO-FILLED)</h3>
              <span className="eyebrow">From assigned trip</span>
            </div>
            <div className="logbook-card-body">
              <div className="detail-grid">
                <div><span className="field-label">Trip Number</span><p>{autoInfo.tripNumber || '—'}</p></div>
                <div><span className="field-label">Request Number</span><p>{autoInfo.requestNumber || '—'}</p></div>
                <div><span className="field-label">Driver</span><p>{autoInfo.driverName || '—'}</p></div>
                <div><span className="field-label">Officer</span><p>{autoInfo.officerName || '—'}</p></div>
                <div><span className="field-label">From</span><p>{autoInfo.origin || '—'}</p></div>
                <div><span className="field-label">To</span><p>{autoInfo.destination || '—'}</p></div>
                <div><span className="field-label">Date</span><p>{autoInfo.date || '—'}</p></div>
                <div><span className="field-label">Fuel Voucher (L)</span><p data-testid="fuel-voucher">{autoInfo.fuelVoucher !== '' && autoInfo.fuelVoucher != null ? autoInfo.fuelVoucher : '—'}</p></div>
              </div>
            </div>
          </div>
        )}

        {/* VEHICLE INFORMATION */}
        <div className="logbook-card">
          <div className="logbook-card-header"><h3>VEHICLE INFORMATION</h3></div>
          <div className="logbook-card-body">
            <div className="form-grid">
              <div className={`form-field ${!editable ? 'readonly' : ''}`}>
                <label>Car Type</label>
                <input type="text" value={carType} onChange={(e) => setCarType(e.target.value)} disabled={!editable} placeholder="Vehicle model" />
              </div>
              <div className={`form-field ${!editable ? 'readonly' : ''}`}>
                <label>Vehicle Registration</label>
                <input type="text" value={vehicleRegistration} onChange={(e) => setVehicleRegistration(e.target.value)} disabled={!editable} placeholder="e.g. T 123 ABC" />
              </div>
              <div className={`form-field ${!editable ? 'readonly' : ''}`}>
                <label>Trip ID (Optional)</label>
                <input type="number" value={tripId} onChange={(e) => setTripId(e.target.value)} disabled={!editable} placeholder="Enter trip ID if linked" />
              </div>
            </div>
          </div>
        </div>

        {/* BEFORE TRIP */}
        <div className="logbook-card">
          <div className="logbook-card-header">
            <h3>BEFORE TRIP</h3>
            <span className="eyebrow">Fill before departing</span>
          </div>
          <div className="logbook-card-body">
            <div className="form-grid">
              <div className={`form-field ${!editable ? 'readonly' : ''}`}>
                <label>Starting Odometer (KM)</label>
                <input type="number" min="0" step="0.1" value={startKm} onChange={(e) => setStartKm(e.target.value)} disabled={!editable} placeholder="e.g. 12540" />
              </div>
              <div className={`form-field ${!editable ? 'readonly' : ''}`}>
                <label>Fuel Type</label>
                <select value={fuelType} onChange={(e) => setFuelType(e.target.value)} disabled={!editable}>
                  <option value="Diesel">Diesel</option>
                  <option value="Petrol">Petrol</option>
                </select>
              </div>
              <div className={`form-field ${!editable ? 'readonly' : ''}`}>
                <label>Fuel Available Before Trip (L)</label>
                <input type="number" min="0" step="0.1" value={fuelAvailable} onChange={(e) => setFuelAvailable(e.target.value)} disabled={!editable} placeholder="Litres" />
              </div>
              <div className={`form-field ${!editable ? 'readonly' : ''}`}>
                <label>Requested Fuel (L)</label>
                <input type="number" min="0" step="0.1" value={fuelRequested} onChange={(e) => setFuelRequested(e.target.value)} disabled={!editable} placeholder="Litres" />
              </div>
              <div className={`form-field ${!editable ? 'readonly' : ''}`}>
                <label>Fuel Received from HPMU (L)</label>
                <input type="number" min="0" step="0.1" value={fuelReceived} onChange={(e) => setFuelReceived(e.target.value)} disabled={!editable} placeholder="Litres" />
              </div>
            </div>
          </div>
        </div>

        {/* AFTER TRIP */}
        <div className="logbook-card">
          <div className="logbook-card-header">
            <h3>AFTER TRIP</h3>
            <span className="eyebrow">Fill after completing trip</span>
          </div>
          <div className="logbook-card-body">
            <div className="form-grid">
              <div className={`form-field ${!editable ? 'readonly' : ''}`}>
                <label>Ending Odometer (KM)</label>
                <input type="number" min="0" step="0.1" value={endKm} onChange={(e) => setEndKm(e.target.value)} disabled={!editable} placeholder="e.g. 12685" />
              </div>
              <div className="form-field">
                <label>Actual Distance Travelled (KM)</label>
                <input type="text" value={actualDistance != null ? `${actualDistance} km` : '—'} disabled className="input-calculated" />
                <small>Ending Odometer − Starting Odometer</small>
              </div>
              <div className={`form-field ${!editable ? 'readonly' : ''}`}>
                <label>Fuel Remaining After Trip (L)</label>
                <input type="number" min="0" step="0.1" value={fuelRemaining} onChange={(e) => setFuelRemaining(e.target.value)} disabled={!editable} placeholder="Litres" />
              </div>
              <div className={`form-field form-field-full ${!editable ? 'readonly' : ''}`}>
                <label>Notes</label>
                <textarea rows="3" value={notes} onChange={(e) => setNotes(e.target.value)} disabled={!editable} placeholder="Optional notes..." />
              </div>
            </div>
          </div>
        </div>

        {/* FUEL RECEIPT */}
        <div className="logbook-card">
          <div className="logbook-card-header">
            <h3>FUEL RECEIPT</h3>
            <span className="eyebrow">Upload fuel voucher receipt</span>
          </div>
          <div className="logbook-card-body">
            <div className="form-grid">
              <div className="form-field form-field-full">
                <label>Receipt (PDF/Image)</label>
                <input type="file" accept=".pdf,image/*" disabled={!editable} onChange={(e) => setReceiptFile(e.target.files?.[0] || null)} data-testid="receipt-upload" />
                {receiptFile && <small>Selected: {receiptFile.name}</small>}
              </div>
            </div>
            {fuelEntries.length > 0 && (
              <div style={{ marginTop: 12 }}>
                <span className="field-label">Uploaded receipts for this trip</span>
                <ul data-testid="fuel-receipt-list">
                  {fuelEntries.map((f) => (
                    <li key={f.id}>
                      {f.entryDate ? String(f.entryDate).slice(0, 10) : '—'} · {f.litres ?? '—'} L
                      {f.receiptPath ? <> · <a href={f.receiptPath.startsWith('/') ? f.receiptPath : `/uploads/fuel/${f.receiptPath}`} target="_blank" rel="noreferrer">View receipt</a></> : null}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>

        {/* SIGNATURE */}
        <div className="logbook-card">
          <div className="logbook-card-header">
            <h3>DRIVER SIGNATURE</h3>
          </div>
          <div className="logbook-card-body">
            <SignaturePad value={signature} onChange={setSignature} disabled={!editable} />
          </div>
        </div>
      </div>

      {editable ? (
        <div className="logbook-actions">
          <button className="btn btn-ghost" onClick={() => navigate('/driver/logbook')}>Cancel</button>
          <button className="btn btn-ghost" onClick={handlePrint}>Print</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving || uploadingReceipt} data-testid="save-logbook">
            {saving ? 'Saving...' : 'Save Logbook'}
          </button>
          {logbook && logbook.id && endKm && (
            <button className="btn btn-success" onClick={handleComplete} disabled={completing} data-testid="complete-logbook">
              {completing ? 'Completing...' : 'Complete Logbook'}
            </button>
          )}
        </div>
      ) : (
        <div className="logbook-actions">
          <button className="btn btn-ghost" onClick={() => navigate('/driver/logbook')}>Back to Logbook</button>
          <button className="btn btn-ghost" onClick={handlePrint}>Print</button>
        </div>
      )}
    </div>

    {showPrint && (
      <div id="logbook-print-root">
        <LogbookPrint logbook={printRecord} title="Driver Trip Logbook" preparedByLabel="Driver Signature" />
        <div className="row-actions" style={{ margin: '12px 0' }}>
          <button className="btn btn-primary" onClick={() => window.print()}>Print Now</button>
          <button className="btn btn-ghost" onClick={() => setShowPrint(false)}>Close</button>
        </div>
      </div>
    )}
    </>
  );
}
