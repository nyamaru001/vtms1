import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { requestsApi, vehiclesApi, driversApi } from '../../services/resources';
import RouteMap from '../../components/RouteMap';
import StatusBadge from '../../components/StatusBadge';
import Loading from '../../components/Loading';
import Modal from '../../components/Modal';
import RequestTimeline from '../../components/RequestTimeline';

export default function TransportRequestDetail() {
  const { id } = useParams();
  const [request, setRequest] = useState(null);
  const [availableVehicles, setAvailableVehicles] = useState([]);
  const [availableDrivers, setAvailableDrivers] = useState([]);
  const [vehicleId, setVehicleId] = useState('');
  const [driverId, setDriverId] = useState('');
  const [assignOpen, setAssignOpen] = useState(false);
  const [returnOpen, setReturnOpen] = useState(false);
  const [returnComment, setReturnComment] = useState('');
  const [error, setError] = useState('');
  const [projectedFuel, setProjectedFuel] = useState(null);

  const selectedVehicle = availableVehicles.find((v) => String(v.id) === String(vehicleId)) || null;

  const load = () => requestsApi.get(id).then(setRequest);
  useEffect(() => { load(); }, [id]);

  const openAssign = async () => {
    const [vehicles, drivers] = await Promise.all([vehiclesApi.available(), driversApi.available()]);
    setAvailableVehicles(vehicles);
    setAvailableDrivers(drivers);
    setError('');
    setAssignOpen(true);
  };

  useEffect(() => {
    if (!vehicleId || !request) { setProjectedFuel(null); return; }
    const vehicle = availableVehicles.find((v) => String(v.id) === String(vehicleId));
    if (vehicle && request.roundTripKm) {
      const base = request.roundTripKm / vehicle.fuelConsumptionKmPerLitre;
      const total = base * 1.10;
      setProjectedFuel({ base: base.toFixed(2), total: total.toFixed(2) });
    }
  }, [vehicleId, availableVehicles, request]);

  const handleAssign = async () => {
    setError('');
    try {
      await requestsApi.assign(id, { vehicleId: Number(vehicleId), driverId: Number(driverId) });
      setAssignOpen(false);
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to assign.');
    }
  };

  const handleReturn = async () => {
    await requestsApi.returnToOfficer(id, returnComment);
    setReturnOpen(false);
    setReturnComment('');
    load();
  };

  if (!request) return <Loading />;

  return (
    <div>
      <div className="panel">
        <div className="panel-header">
          <h3>{request.requestNumber}</h3>
          <StatusBadge status={request.status} />
        </div>

        <div className="detail-grid">
          <div><span className="field-label">Officer</span><p>{request.officer?.fullName} ({request.officer?.phone})</p></div>
          <div><span className="field-label">Purpose</span><p>{request.purpose}</p></div>
          <div><span className="field-label">Passengers</span><p>{request.passengers}</p></div>
          <div><span className="field-label">Departure</span><p>{request.departureDate} {request.departureTime}</p></div>
          <div><span className="field-label">One-way KM</span><p>{request.oneWayKm}</p></div>
          <div><span className="field-label">Round-trip KM</span><p>{request.roundTripKm}</p></div>
          <div><span className="field-label">Est. Duration</span><p>{request.durationMinutes ? `${Math.round(request.durationMinutes)} min` : '—'}</p></div>
          <div><span className="field-label">Vehicle</span><p>{request.vehicle ? `${request.vehicle.registrationNumber} — ${request.vehicle.model}` : 'Not assigned'}</p></div>
          <div><span className="field-label">Driver</span><p>{request.driver ? request.driver.user.fullName : 'Not assigned'}</p></div>
          <div><span className="field-label">Base Fuel</span><p>{request.baseFuelLitres ? `${request.baseFuelLitres} L` : '—'}</p></div>
          <div><span className="field-label">Fuel Buffer</span><p>{request.fuelBufferPercent ? `${(request.fuelBufferPercent * 100).toFixed(0)}%` : '—'}</p></div>
          <div><span className="field-label">Total Fuel Required</span><p>{request.totalFuelLitres ? `${request.totalFuelLitres} L` : '—'}</p></div>
        </div>

        {error && <div className="form-error">{error}</div>}

        {request.status === 'TRANSPORT_REVIEW' && (
          <div className="callout callout-warning" data-testid="reassign-needed">
            <strong>Reassignment may be needed</strong>
            <p>This request is ready for vehicle/driver assignment. If a driver previously rejected, assign a new driver below.</p>
          </div>
        )}

        {['R3_APPROVED', 'TRANSPORT_REVIEW'].includes(request.status) && (
          <div className="row-actions">
            <button className="btn btn-primary" onClick={openAssign}>Assign Vehicle &amp; Driver</button>
            <button className="btn btn-ghost" onClick={() => setReturnOpen(true)}>Return to R3</button>
          </div>
        )}
      </div>

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
            <div key={`n${n.id}`} className="history-item"><strong>HPMU — {n.decision}</strong> by {n.reviewer?.fullName}{n.comment && <p>{n.comment}</p>}</div>
          ))}
          {request.r3Approvals?.map((a) => (
            <div key={`r${a.id}`} className="history-item"><strong>R3 — {a.decision}</strong> by {a.reviewer?.fullName}{a.comment && <p>{a.comment}</p>}</div>
          ))}
        </div>
      )}

      <Modal
        open={assignOpen}
        title="Assign Vehicle & Driver"
        onClose={() => setAssignOpen(false)}
        footer={<>
          <button className="btn btn-ghost" onClick={() => setAssignOpen(false)}>Cancel</button>
          <button className="btn btn-primary" onClick={handleAssign} disabled={!vehicleId || !driverId}>Confirm Assignment</button>
        </>}
      >
        <div className="form-grid">
          <div>
            <label className="field-label">Vehicle</label>
            <select className="input" value={vehicleId} onChange={(e) => setVehicleId(e.target.value)}>
              <option value="">Select available vehicle</option>
              {availableVehicles.map((v) => <option key={v.id} value={v.id}>{v.registrationNumber} — {v.model} ({v.fuelConsumptionKmPerLitre} KM/L)</option>)}
            </select>
            {selectedVehicle && (
              <div className="callout" data-testid="vehicle-odometer-display" style={{ marginTop: 8 }}>
                Latest odometer: <strong>{selectedVehicle.currentOdometer ?? 0} KM</strong>
                <div className="field-hint">Starting odometer for this assignment defaults to this reading.</div>
              </div>
            )}
          </div>
          <div>
            <label className="field-label">Driver</label>
            <select className="input" value={driverId} onChange={(e) => setDriverId(e.target.value)}>
              <option value="">Select available driver</option>
              {availableDrivers.map((d) => <option key={d.id} value={d.id}>{d.user?.fullName}</option>)}
            </select>
          </div>
          {selectedVehicle && (
            <div>
              <label className="field-label">Starting Odometer (KM)</label>
              <input
                className="input"
                type="number"
                min="0"
                step="0.1"
                value={selectedVehicle.currentOdometer ?? 0}
                readOnly
                data-testid="starting-odometer"
              />
            </div>
          )}
          {projectedFuel && (
            <div className="callout">
              Projected fuel: {projectedFuel.base} L base × 1.10 buffer = <strong>{projectedFuel.total} L</strong>
            </div>
          )}
          {error && <div className="form-error">{error}</div>}
        </div>
      </Modal>

      <Modal
        open={returnOpen}
        title="Return Request to Officer"
        onClose={() => setReturnOpen(false)}
        footer={<>
          <button className="btn btn-ghost" onClick={() => setReturnOpen(false)}>Cancel</button>
          <button className="btn btn-primary" onClick={handleReturn}>Return Request</button>
        </>}
      >
        <label className="field-label">Comment</label>
        <textarea className="input" rows={3} value={returnComment} onChange={(e) => setReturnComment(e.target.value)} />
      </Modal>
    </div>
  );
}
