import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';

const PORTALS = [
  {
    key: 'officer',
    role: 'OFFICER',
    label: 'Officer Portal',
    icon: '📋',
    description: 'Create vehicle requests, follow approvals and track trips.',
  },
  {
    key: 'driver',
    role: 'DRIVER',
    label: 'Driver Portal',
    icon: '🚛',
    description: 'Assignments, route map, fuel requests and voucher confirmation.',
  },
  {
    key: 'transport',
    role: 'TRANSPORT_OFFICER',
    label: 'Transport Officer Portal',
    icon: '🚗',
    description: 'Vehicles, drivers, approvals and trip assignments.',
  },
  {
    key: 'r3',
    role: 'R3',
    label: 'R3 Portal',
    icon: '👔',
    description: 'Review and approve requests at R3 level.',
  },
  {
    key: 'hpmu',
    role: 'HPMU',
    label: 'HPMU Portal',
    icon: '⛽',
    description: 'Approve fuel, release vouchers and issue fuel.',
  },
];

const LEGACY_TRAINING_KEY = 'vtms_training_context';

function describeTrainingError(err) {
  if (!err.response) {
    return 'Cannot reach the server. Please make sure the backend is running on port 5000.';
  }

  const { status } = err.response;
  const message = err.response.data?.message;

  switch (status) {
    case 400:
      return message || 'The training request was rejected. Please try again.';
    case 401:
      return 'Your administrator session has expired. Please log in again.';
    case 403:
      return message || 'Only administrators can enter training mode.';
    case 404:
      return 'The training service was not found on the server.';
    case 422:
      return message || 'The training request could not be validated.';
    case 500:
      return 'The server hit an error while starting the training session. Please try again.';
    default:
      return message || `Training session could not be started (error ${status}).`;
  }
}

export default function TrainingPortal() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(null);
  const [error, setError] = useState('');
  const [activePortal, setActivePortal] = useState(
    () => localStorage.getItem('vtms_training_portal')
  );

  useEffect(() => {
    localStorage.removeItem(LEGACY_TRAINING_KEY);
  }, []);

  const handleEnterTraining = async (portal) => {
    setLoading(portal);
    setError('');

    try {
      const res = await api.post('/auth/training/session', { portal });

      localStorage.setItem('vtms_training_token', res.data.trainingToken);
      localStorage.setItem('vtms_training_portal', res.data.portal);
      setActivePortal(res.data.portal);

      navigate(`/admin/training/${portal}`);
    } catch (err) {
      localStorage.removeItem('vtms_training_token');
      localStorage.removeItem('vtms_training_portal');
      setActivePortal(null);
      setError(describeTrainingError(err));
    } finally {
      setLoading(null);
    }
  };

  const handleExitTraining = () => {
    localStorage.removeItem('vtms_training_token');
    localStorage.removeItem('vtms_training_portal');
    setActivePortal(null);
    setError('');
    navigate('/admin');
  };

  const handleBackToSession = () => {
    if (activePortal) navigate(`/admin/training/${activePortal.toLowerCase()}`);
  };

  return (
    <div className="dashboard-page">
      <div className="hero-strip">
        <div>
          <span className="eyebrow">ADMIN TOOLS</span>
          <h2>Portal Training Access</h2>
          <p>
            Open any portal with live database data. You stay signed in as the
            administrator - training sessions are authorized by the server and
            cannot delete or change accounts.
          </p>
        </div>
        {activePortal && (
          <div className="training-session-chip">
            <span>
              Active session: <strong>{activePortal}</strong>
            </span>
            <button className="btn btn-sm btn-secondary" onClick={handleBackToSession}>
              Resume
            </button>
            <button className="btn btn-sm btn-ghost" onClick={handleExitTraining}>
              Exit Training
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="callout callout-error" style={{ marginBottom: 20 }}>
          <strong>Could not enter training mode</strong>
          <p>{error}</p>
        </div>
      )}

      <div
        className="stat-grid"
        style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))' }}
      >
        {PORTALS.map((p) => (
          <div
            key={p.key}
            className={`stat-card training-portal-card ${loading === p.key ? 'is-loading' : ''}`}
            role="button"
            tabIndex={0}
            onClick={() => handleEnterTraining(p.role)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') handleEnterTraining(p.role);
            }}
          >
            <span className="stat-icon" style={{ fontSize: 36 }}>{p.icon}</span>
            <span className="stat-label" style={{ fontSize: 16, fontWeight: 600 }}>
              {p.label}
            </span>
            <span className="training-portal-desc">{p.description}</span>
            <span className="stat-label" style={{ fontSize: 12, marginTop: 4 }}>
              {loading === p.key ? 'Starting session...' : p.role}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
