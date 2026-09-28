import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { statsApi } from '../../services/resources';
import Loading from '../../components/Loading';

export default function R3Dashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        setError('');
        const response = await statsApi.get();
        setData({
          pending: response?.pending ?? 0,
          approved: response?.approved ?? 0,
          rejected: response?.rejected ?? 0,
          returned: response?.returned ?? 0,
          total: response?.total ?? 0,
        });
      } catch (err) {
        console.error('R3 dashboard failed:', err);
        setError(err?.response?.data?.message || 'Failed to load dashboard statistics.');
        setData({ pending: 0, approved: 0, rejected: 0, returned: 0, total: 0 });
      }
    };

    load();
  }, []);

  if (!data) return <Loading />;

  return (
    <div className="dashboard-page">
      <div className="hero-strip">
        <div>
          <span className="eyebrow">R3 PORTAL</span>
          <h2>Request Approval</h2>
          <p>Review and approve officer vehicle/trip requests before transport assignment.</p>
        </div>
      </div>

      {error && (
        <div className="callout callout-error" style={{ marginBottom: 16 }}>
          {error}
        </div>
      )}

      <div className="stat-grid" data-testid="dashboard-stats">
        <div className="stat-card accent">
          <span className="stat-icon">⏳</span>
          <span className="stat-value">{data.pending}</span>
          <span className="stat-label">Pending Review</span>
        </div>
        <div className="stat-card">
          <span className="stat-icon">✅</span>
          <span className="stat-value">{data.approved}</span>
          <span className="stat-label">Approved</span>
        </div>
        <div className="stat-card">
          <span className="stat-icon">❌</span>
          <span className="stat-value">{data.rejected}</span>
          <span className="stat-label">Rejected</span>
        </div>
      </div>

      <div className="queue-list">
        <Link to="/r3/requests" className="queue-item">
          <span>Review Pending Requests</span>
          <strong>{data.pending} &rarr;</strong>
        </Link>
        <Link to="/r3/requests" className="queue-item">
          <span>View All Requests</span>
          <strong>&rarr;</strong>
        </Link>
        <Link to="/r3/reports" className="queue-item">
          <span>View Reports</span>
          <strong>&rarr;</strong>
        </Link>
        <Link to="/r3/notifications" className="queue-item">
          <span>Notifications</span>
          <strong>&rarr;</strong>
        </Link>
      </div>
    </div>
  );
}
