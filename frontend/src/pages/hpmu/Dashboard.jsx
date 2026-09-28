
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { statsApi } from '../../services/resources';
import Loading from '../../components/Loading';

export default function HPMUDashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadDashboardData = async () => {
      try {
        setError('');
        const response = await statsApi.get();
        setData({
          pending: response?.pending ?? 0,
          approved: response?.approved ?? 0,
          released: response?.releasedHistorical ?? response?.released ?? 0,
          rejected: response?.rejected ?? 0,
          driverConfirmed: response?.driverConfirmed ?? 0,
          completed: response?.completed ?? 0,
          total: response?.total ?? 0,
        });
      } catch (err) {
        console.error('Failed to load HPMU dashboard:', err);

        const message =
          err?.response?.data?.message ||
          err?.response?.data?.error ||
          err?.message ||
          'Failed to load HPMU fuel data.';

        setError(message);

        setData({
          pending: 0,
          approved: 0,
          released: 0,
          rejected: 0,
          driverConfirmed: 0,
          completed: 0,
          total: 0,
        });
      }
    };

    loadDashboardData();
  }, []);

  if (!data) {
    return <Loading />;
  }

  return (
    <div className="dashboard-page">

      {/* Backend error */}
      {error && (
        <div
          style={{
            marginBottom: '20px',
            padding: '14px 18px',
            borderRadius: '8px',
            background: '#fee2e2',
            color: '#991b1b',
            border: '1px solid #fecaca',
          }}
        >
          <strong>Backend Error:</strong> {error}
        </div>
      )}

      {/* Header */}
      <div className="hero-strip">
        <div>
          <span className="eyebrow">HPMU PORTAL</span>

          <h2>Fuel Management</h2>

          <p>
            Review, approve, release, and monitor fuel requests.
          </p>
        </div>
      </div>

      {/* Statistics */}
      <div className="stat-grid stats-4" data-testid="dashboard-stats">

        {/* Pending */}
        <div className="stat-card accent">
          <span className="stat-icon">⏳</span>

          <span className="stat-value">
            {data.pending}
          </span>

          <span className="stat-label">
            Pending Review
          </span>
        </div>

        {/* Released */}
        <div className="stat-card">
          <span className="stat-icon">⛽</span>

          <span className="stat-value">
            {data.released}
          </span>

          <span className="stat-label">
            Fuel Released
          </span>
        </div>

        {/* Driver Confirmed */}
        <div className="stat-card">
          <span className="stat-icon">✓</span>

          <span className="stat-value">
            {data.driverConfirmed}
          </span>

          <span className="stat-label">
            Driver Confirmed
          </span>
        </div>

        {/* Rejected */}
        <div className="stat-card">
          <span className="stat-icon">❌</span>

          <span className="stat-value">
            {data.rejected}
          </span>

          <span className="stat-label">
            Rejected
          </span>
        </div>

      </div>

      {/* HPMU Quick Links */}
      <div className="queue-list">

        <Link
          to="/hpmu/fuel"
          className="queue-item"
        >
          <span>Review Fuel Requests</span>

          <strong>
            {data.pending} →
          </strong>
        </Link>

        {/* Fuel Issue Logbook */}
        <Link
          to="/hpmu/fuel-logbook"
          className="queue-item"
        >
          <span>Fuel Issue Logbook</span>

          <strong>
            →
          </strong>
        </Link>

        {/* Reports */}
        <Link
          to="/hpmu/reports"
          className="queue-item"
        >
          <span>View Reports</span>

          <strong>
            →
          </strong>
        </Link>

        {/* Notifications */}
        <Link
          to="/hpmu/notifications"
          className="queue-item"
        >
          <span>Notifications</span>

          <strong>
            →
          </strong>
        </Link>

      </div>
    </div>
  );
}
