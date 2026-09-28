import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { statsApi } from '../../services/resources';
import Loading from '../../components/Loading';

export default function OfficerDashboard() {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        setError('');
        const data = await statsApi.get();
        setStats({
          total: data?.total ?? 0,
          pending: data?.pending ?? 0,
          approved: data?.inProgress ?? 0,
          active: data?.activeTrips ?? 0,
          cancelled: data?.cancelled ?? 0,
          rejected: data?.rejected ?? 0,
          completed: data?.completed ?? 0,
          completedTrips: data?.completedTrips ?? 0,
        });
      } catch (err) {
        console.error('Failed to load officer dashboard:', err);
        setError(err?.response?.data?.message || 'Failed to load dashboard statistics.');
        setStats({ total: 0, pending: 0, approved: 0, active: 0, cancelled: 0, rejected: 0, completed: 0, completedTrips: 0 });
      }
    };
    load();
  }, []);

  if (!stats) return <Loading />;

  return (
    <div className="dashboard-page officer-dashboard">
      <section className="officer-hero">
        <div className="officer-hero-content">
          <div className="eyebrow hero-eyebrow">OFFICER PORTAL</div>
          <h1>Transport Management</h1>
          <p>Request vehicles, monitor approval progress, and track your assigned trips.</p>
          <div className="hero-actions">
            <Link to="/officer/request-vehicle" className="btn btn-primary btn-large">+ New Vehicle Request</Link>
            <Link to="/officer/requests" className="btn btn-light-outline btn-large">View My Requests</Link>
          </div>
        </div>
      </section>

      {error && (
        <div className="callout callout-error" style={{ marginBottom: 16 }}>
          {error}
        </div>
      )}

      <section className="officer-stat-grid" data-testid="dashboard-stats">
        <div className="officer-stat-card blue">
          <div className="stat-card-top">
            <span className="stat-card-label">MY REQUESTS</span>
          </div>
          <div className="stat-value">{stats.total}</div>
          <div className="stat-description">Total vehicle requests</div>
        </div>
        <div className="officer-stat-card orange">
          <div className="stat-card-top">
            <span className="stat-card-label">PENDING</span>
          </div>
          <div className="stat-value">{stats.pending}</div>
          <div className="stat-description">Awaiting R3 review</div>
        </div>
        <div className="officer-stat-card green">
          <div className="stat-card-top">
            <span className="stat-card-label">ACTIVE TRIPS</span>
          </div>
          <div className="stat-value">{stats.active}</div>
          <div className="stat-description">Trips in progress</div>
        </div>
      </section>

      <section className="officer-quick-actions">
        <div className="quick-action-card request">
          <div className="quick-action-content">
            <h3>New Vehicle Request</h3>
            <p>Create a new transport request.</p>
            <Link to="/officer/request-vehicle" className="btn btn-primary">Start Request</Link>
          </div>
        </div>
        <div className="quick-action-card requests">
          <div className="quick-action-content">
            <h3>My Requests</h3>
            <p>Track your request approval progress.</p>
            <Link to="/officer/requests" className="btn btn-secondary">View Requests</Link>
          </div>
        </div>
      </section>
    </div>
  );
}
