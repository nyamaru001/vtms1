import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { statsApi } from '../../services/resources';
import Loading from '../../components/Loading';

export default function DriverDashboard() {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        setError('');
        const data = await statsApi.get();
        setStats({
          totalTrips: data?.totalTrips ?? 0,
          completed: data?.completed ?? 0,
          active: data?.active ?? 0,
          waiting: data?.waiting ?? 0,
          fuelTotal: data?.fuelTotal ?? 0,
          fuelPending: data?.fuelPending ?? 0,
          fuelApproved: data?.fuelApproved ?? 0,
          fuelReleased: data?.fuelReleased ?? 0,
          fuelConfirmed: data?.fuelConfirmed ?? 0,
        });
      } catch (err) {
        console.error('Failed to load driver dashboard:', err);
        setError(err?.response?.data?.message || 'Failed to load dashboard data.');
        setStats({
          totalTrips: 0,
          completed: 0,
          active: 0,
          waiting: 0,
          fuelTotal: 0,
          fuelPending: 0,
          fuelApproved: 0,
          fuelReleased: 0,
          fuelConfirmed: 0,
        });
      }
    };
    load();
  }, []);

  if (!stats) return <Loading />;

  return (
    <div className="dashboard-page">
      <div className="hero-strip">
        <div>
          <span className="eyebrow">DRIVER PORTAL</span>
          <h2>Driver Dashboard</h2>
          <p>View your assigned trips and track fuel requests.</p>
        </div>
      </div>

      {error && (
        <div className="callout callout-error" style={{ marginBottom: 16 }}>
          {error}
        </div>
      )}

      <div className="stat-grid" data-testid="dashboard-stats">
        <div className="stat-card accent">
          <span className="stat-icon">📋</span>
          <span className="stat-value">{stats.totalTrips}</span>
          <span className="stat-label">Total Trips</span>
        </div>
        <div className="stat-card">
          <span className="stat-icon">🏁</span>
          <span className="stat-value">{stats.active}</span>
          <span className="stat-label">Active Trips</span>
        </div>
        <div className="stat-card">
          <span className="stat-icon">⛽</span>
          <span className="stat-value">{stats.fuelTotal}</span>
          <span className="stat-label">Fuel Requests</span>
        </div>
      </div>

      <div className="queue-list">
        <Link to="/driver/trips" className="queue-item">
          <span>View Assigned Trips</span>
          <strong>{stats.waiting + stats.active} &rarr;</strong>
        </Link>
        <Link to="/driver/fuel" className="queue-item">
          <span>Request Fuel</span>
          <strong>&rarr;</strong>
        </Link>
      </div>
    </div>
  );
}
