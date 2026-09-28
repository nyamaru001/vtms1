import { useEffect, useState } from 'react';
import { requestsApi, vehiclesApi } from '../../services/resources';
import RouteMap from '../../components/RouteMap';
import Loading from '../../components/Loading';

export default function RouteCalculator() {
  const [requests, setRequests] = useState(null);
  const [vehicles, setVehicles] = useState(null);
  const [requestId, setRequestId] = useState('');
  const [vehicleId, setVehicleId] = useState('');
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    requestsApi.list({ limit: 100 }).then((r) => setRequests(r.data));
    vehiclesApi.list({ limit: 100 }).then((r) => setVehicles(r.data));
  }, []);

  useEffect(() => {
    if (!requestId) { setPreview(null); return; }
    setLoading(true);
    requestsApi.fuelPreview(requestId, vehicleId || undefined)
      .then(setPreview)
      .finally(() => setLoading(false));
  }, [requestId, vehicleId]);

  if (!requests || !vehicles) return <Loading />;

  return (
    <div>
      <div className="panel">
        <div className="panel-header">
          <h3>Route &amp; Fuel Calculator</h3>
        </div>
        <p className="field-hint">
          Pick a vehicle request and a vehicle to see the real route distance, estimated
          duration, and automatically calculated fuel requirement — before assigning anything.
        </p>

        <div className="form-row two-col">
          <div>
            <label className="field-label">Vehicle Request</label>
            <select className="input" value={requestId} onChange={(e) => setRequestId(e.target.value)}>
              <option value="">Select a request</option>
              {requests.map((r) => (
                <option key={r.id} value={r.id}>{r.requestNumber} — {r.originName} → {r.destinationName}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="field-label">Vehicle</label>
            <select className="input" value={vehicleId} onChange={(e) => setVehicleId(e.target.value)} disabled={!requestId}>
              <option value="">Select a vehicle</option>
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>{v.registrationNumber} — {v.model} ({v.fuelConsumptionKmPerLitre} KM/L)</option>
              ))}
            </select>
          </div>
        </div>

        {loading && <Loading label="Calculating..." />}

        {preview && !loading && (
          <div className="detail-grid" style={{ marginTop: 14 }}>
            <div><span className="field-label">One-Way Distance</span><p><strong>{preview.oneWayKm} KM</strong></p></div>
            <div><span className="field-label">Round-Trip Distance</span><p><strong>{preview.roundTripKm} KM</strong></p></div>
            <div><span className="field-label">Estimated Duration</span><p>{preview.durationMinutes ? `${Math.round(preview.durationMinutes)} min` : '—'}</p></div>
            {preview.vehicle && (
              <>
                <div><span className="field-label">Vehicle Consumption</span><p>{preview.vehicle.fuelConsumptionKmPerLitre} KM/L</p></div>
                <div><span className="field-label">Base Fuel</span><p>{preview.fuel?.baseFuelLitres} L</p></div>
                <div><span className="field-label">Fuel Buffer</span><p>{preview.fuel ? `${(preview.fuel.fuelBufferPercent * 100).toFixed(0)}%` : '—'}</p></div>
                <div><span className="field-label">Total Fuel Required</span><p><strong>{preview.fuel?.totalFuelLitres} L</strong></p></div>
              </>
            )}
            {!preview.vehicle && (
              <div style={{ gridColumn: '1 / -1' }} className="field-hint">Select a vehicle above to see the automatic fuel calculation.</div>
            )}
          </div>
        )}
      </div>

      {preview && (
        <div className="panel">
          <h3>Route Map</h3>
          <RouteMap origin={preview.origin} destination={preview.destination} geometry={preview.routeGeometry} height={420} />
        </div>
      )}
    </div>
  );
}
