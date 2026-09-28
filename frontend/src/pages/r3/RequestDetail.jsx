import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { requestsApi, r3Api } from '../../services/resources';
import RouteMap from '../../components/RouteMap';
import StatusBadge from '../../components/StatusBadge';
import Loading from '../../components/Loading';
import Modal from '../../components/Modal';

export default function R3RequestDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [request, setRequest] = useState(null);
  const [decisionOpen, setDecisionOpen] = useState(null);
  const [comment, setComment] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { requestsApi.get(id).then(setRequest).catch(() => navigate('/r3/requests')); }, [id]);
  if (!request) return <Loading />;

  const handleDecision = async () => {
    setError('');
    if (decisionOpen !== 'APPROVE' && !comment.trim()) {
      setError('A comment is required for this decision.');
      return;
    }
    setSaving(true);
    try {
      await r3Api.decide(id, decisionOpen, comment.trim());
      navigate('/r3/requests');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to submit decision.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="panel">
        <div className="panel-header">
          <div>
            <span className="eyebrow">R3 REVIEW</span>
            <h3>{request.requestNumber || `REQ-${request.id}`}</h3>
          </div>
          <StatusBadge status={request.status} />
        </div>

        <div className="detail-grid">
          <div>
            <span className="field-label">Officer</span>
            <p>{request.officer?.fullName || '—'}</p>
          </div>
          <div>
            <span className="field-label">Purpose</span>
            <p>{request.purpose || '—'}</p>
          </div>
          <div>
            <span className="field-label">Origin</span>
            <p>{request.originName || '—'}</p>
          </div>
          <div>
            <span className="field-label">Destination</span>
            <p>{request.destinationName || '—'}</p>
          </div>
          <div>
            <span className="field-label">Departure Date</span>
            <p>{request.departureDate || '—'}</p>
          </div>
          <div>
            <span className="field-label">Passengers</span>
            <p>{request.numberOfPassengers || '—'}</p>
          </div>
          <div>
            <span className="field-label">One-Way Distance</span>
            <p>{request.oneWayKm ? `${request.oneWayKm} KM` : '—'}</p>
          </div>
          <div>
            <span className="field-label">Round-Trip Distance</span>
            <p>{request.roundTripKm ? `${request.roundTripKm} KM` : '—'}</p>
          </div>
          <div>
            <span className="field-label">Requested Fuel</span>
            <p>{request.totalFuelLitres ? `${request.totalFuelLitres} L` : '—'}</p>
          </div>
          <div>
            <span className="field-label">Submitted</span>
            <p>{request.createdAt ? new Date(request.createdAt).toLocaleDateString() : '—'}</p>
          </div>
        </div>

        {request.notes && (
          <div style={{ marginTop: '16px' }}>
            <span className="field-label">Notes</span>
            <p>{request.notes}</p>
          </div>
        )}

        {request.r3Approvals?.length > 0 && (
          <div style={{ marginTop: '16px' }}>
            <span className="field-label">Previous R3 Decisions</span>
            {request.r3Approvals.map((a) => (
              <div key={a.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                <strong>{a.decision}</strong> by {a.reviewer?.fullName || '—'}
                {a.comment && <span> — {a.comment}</span>}
                <span style={{ color: 'var(--text-muted)', fontSize: '12px', marginLeft: '8px' }}>
                  {a.createdAt ? new Date(a.createdAt).toLocaleString() : ''}
                </span>
              </div>
            ))}
          </div>
        )}

        {request.status === 'R3_REVIEW' && (
          <div className="row-actions" style={{ marginTop: '16px' }}>
            <button className="btn btn-success" onClick={() => setDecisionOpen('APPROVE')}>Approve Request</button>
            <button className="btn btn-danger" onClick={() => setDecisionOpen('REJECT')}>Reject Request</button>
            <button className="btn btn-warning" onClick={() => setDecisionOpen('RETURN')}>Return to Officer</button>
          </div>
        )}
      </div>

      {(request.originLat || request.originLng) && (
        <div className="panel">
          <h3>Route Map</h3>
          <RouteMap
            origin={{ lat: request.originLat, lng: request.originLng, name: request.originName }}
            destination={{ lat: request.destinationLat, lng: request.destinationLng, name: request.destinationName }}
            geometry={request.routeGeometry}
          />
        </div>
      )}

      <Modal
        open={!!decisionOpen}
        title={`Confirm: ${decisionOpen} Request`}
        onClose={() => !saving && setDecisionOpen(null)}
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setDecisionOpen(null)} disabled={saving}>Cancel</button>
            <button
              className={`btn ${decisionOpen === 'APPROVE' ? 'btn-success' : decisionOpen === 'REJECT' ? 'btn-danger' : 'btn-warning'}`}
              onClick={handleDecision}
              disabled={saving}
            >
              {saving ? 'Submitting...' : `Confirm ${decisionOpen}`}
            </button>
          </>
        }
      >
        <label className="field-label">
          Comment {decisionOpen !== 'APPROVE' && '(required)'}
        </label>
        <textarea
          className="input"
          rows={3}
          value={comment}
          onChange={(e) => { setComment(e.target.value); setError(''); }}
          placeholder={decisionOpen === 'APPROVE' ? 'Optional approval comment...' : 'Enter reason...'}
          disabled={saving}
        />
        {error && <div className="form-error">{error}</div>}
      </Modal>
    </div>
  );
}
