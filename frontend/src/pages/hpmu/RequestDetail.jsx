import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { requestsApi, hpmuApi } from '../../services/resources';
import RouteMap from '../../components/RouteMap';
import StatusBadge from '../../components/StatusBadge';
import Loading from '../../components/Loading';
import Modal from '../../components/Modal';

export default function HPMURequestDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [request, setRequest] = useState(null);
  const [decisionOpen, setDecisionOpen] = useState(null); // 'APPROVE' | 'REJECT' | 'RETURN'
  const [releaseOpen, setReleaseOpen] = useState(false);
  const [litresReleased, setLitresReleased] = useState('');
  const [comment, setComment] = useState('');
  const [error, setError] = useState('');

  useEffect(() => { requestsApi.get(id).then(setRequest); }, [id]);
  if (!request) return <Loading />;

  const handleDecision = async () => {
    setError('');
    if (decisionOpen !== 'APPROVE' && !comment) {
      setError('A comment is required for this decision.');
      return;
    }
    try {
      await hpmuApi.decide(id, decisionOpen, comment);
      navigate('/hpmu/requests');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to submit decision.');
    }
  };

  const handleRelease = async () => {
    setError('');
    const litres = parseFloat(litresReleased);
    if (!litres || litres <= 0) {
      setError('Please enter a valid litres amount.');
      return;
    }
    try {
      await hpmuApi.release(id, litres, comment);
      setReleaseOpen(false);
      setLitresReleased('');
      setComment('');
      const updated = await requestsApi.get(id);
      setRequest(updated);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to release fuel.');
    }
  };

  return (
    <div>
      <div className="panel">
        <div className="panel-header">
          <h3>{request.requestNumber}</h3>
          <StatusBadge status={request.status} />
        </div>
        <div className="detail-grid">
          <div><span className="field-label">Officer</span><p>{request.officer?.fullName}</p></div>
          <div><span className="field-label">Purpose</span><p>{request.purpose}</p></div>
          <div><span className="field-label">Passengers</span><p>{request.passengers}</p></div>
          <div><span className="field-label">Vehicle</span><p>{request.vehicle?.registrationNumber} — {request.vehicle?.model}</p></div>
          <div><span className="field-label">Driver</span><p>{request.driver?.user?.fullName}</p></div>
          <div><span className="field-label">Round-trip KM</span><p>{request.roundTripKm}</p></div>
          <div><span className="field-label">Duration</span><p>{request.durationMinutes ? `${Math.round(request.durationMinutes)} min` : '—'}</p></div>
          <div><span className="field-label">Total Fuel</span><p>{request.totalFuelLitres} L</p></div>
        </div>

        {request.status === 'HPMU_REVIEW' && (
          <div className="row-actions">
            <button className="btn btn-primary" onClick={() => setDecisionOpen('APPROVE')}>Approve</button>
            <button className="btn btn-danger" onClick={() => setDecisionOpen('REJECT')}>Reject</button>
            <button className="btn btn-ghost" onClick={() => setDecisionOpen('RETURN')}>Return</button>
          </div>
        )}

        {request.status === 'HPMU_APPROVED' && (
          <div className="row-actions">
            <button className="btn btn-primary" onClick={() => { setReleaseOpen(true); setLitresReleased(request.totalFuelLitres || ''); setComment(''); setError(''); }}>Release Fuel</button>
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

      <Modal
        open={!!decisionOpen}
        title={`Confirm: ${decisionOpen?.replace('_', ' ')}`}
        onClose={() => setDecisionOpen(null)}
        footer={<>
          <button className="btn btn-ghost" onClick={() => setDecisionOpen(null)}>Cancel</button>
          <button className="btn btn-primary" onClick={handleDecision}>Submit</button>
        </>}
      >
        <label className="field-label">Comment {decisionOpen !== 'APPROVE' && '(required)'}</label>
        <textarea className="input" rows={3} value={comment} onChange={(e) => setComment(e.target.value)} />
        {error && <div className="form-error">{error}</div>}
      </Modal>

      <Modal
        open={releaseOpen}
        title="Release Fuel"
        onClose={() => { setReleaseOpen(false); setLitresReleased(''); setComment(''); setError(''); }}
        footer={<>
          <button className="btn btn-ghost" onClick={() => { setReleaseOpen(false); setLitresReleased(''); setComment(''); setError(''); }}>Cancel</button>
          <button className="btn btn-primary" onClick={handleRelease}>Release</button>
        </>}
      >
        <label className="field-label">Litres to Release</label>
        <input className="input" type="number" step="0.1" min="0" value={litresReleased} onChange={(e) => setLitresReleased(e.target.value)} placeholder="Enter litres" />
        <label className="field-label">Comment (optional)</label>
        <textarea className="input" rows={3} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Optional comment" />
        {error && <div className="form-error">{error}</div>}
      </Modal>
    </div>
  );
}