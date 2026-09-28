import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { statsApi } from '../../services/resources';
import Loading from '../../components/Loading';

export default function TransportDashboard() {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        setError('');
        const data = await statsApi.get();
        setStats({
          pendingReview: data?.pendingReview ?? 0,
          driverAssigned: data?.driverAssigned ?? 0,
          activeTrips: data?.activeTrips ?? 0,
          completed: data?.completed ?? 0,
        });
      } catch (err) {
        console.error('Failed to load transport dashboard:', err);
        setError(err?.response?.data?.message || 'Failed to load dashboard statistics.');
        setStats({ pendingReview: 0, driverAssigned: 0, activeTrips: 0, completed: 0 });
      }
    };
    load();
  }, []);

  if (!stats) return <Loading />;

  return (
    <div className="dashboard-page">
      <div className="hero-strip">
        <div>
          <span className="eyebrow">TRANSPORT OFFICER PORTAL</span>
          <h2>Transport Management</h2>
          <p>Assign drivers to approved requests and monitor fleet operations.</p>
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
          <span className="stat-value">{stats.pendingReview}</span>
          <span className="stat-label">Needs Driver</span>
        </div>
        <div className="stat-card">
          <span className="stat-icon">🚛</span>
          <span className="stat-value">{stats.driverAssigned}</span>
          <span className="stat-label">Driver Assigned</span>
        </div>
        <div className="stat-card">
          <span className="stat-icon">🗺</span>
          <span className="stat-value">{stats.activeTrips}</span>
          <span className="stat-label">Active Trips</span>
        </div>
      </div>

      <div className="queue-list">
        <Link to="/transport/requests" className="queue-item">
          <span>Review & Assign Drivers</span>
          <strong>{stats.pendingReview} &rarr;</strong>
        </Link>
        <Link to="/transport/vehicles" className="queue-item">
          <span>Manage Vehicles</span>
          <strong>&rarr;</strong>
        </Link>
        <Link to="/transport/drivers" className="queue-item">
          <span>View Drivers</span>
          <strong>&rarr;</strong>
        </Link>
        <Link to="/transport/reports" className="queue-item">
          <span>View Reports</span>
          <strong>&rarr;</strong>
        </Link>
        <Link to="/transport/notifications" className="queue-item">
          <span>Notifications</span>
          <strong>&rarr;</strong>
        </Link>
      </div>
    </div>
  );
}
