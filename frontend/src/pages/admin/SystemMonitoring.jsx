import { useEffect, useState } from 'react';
import { adminApi } from '../../services/resources';
import Loading from '../../components/Loading';

export default function SystemMonitoring() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/admin/monitoring`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('vtms_token')}` },
      }).then((r) => r.json());
      setData(res);
    } catch (err) {
      setError(err.message || 'Failed to load monitoring data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  if (loading) return <Loading label="Loading system monitoring..." />;

  return (
    <div className="dashboard-page">
      <div className="hero-strip">
        <div>
          <span className="eyebrow">SYSTEM HEALTH</span>
          <h2>System Monitoring</h2>
          <p>Monitor database status, API health, and recent system errors.</p>
        </div>
        <button className="btn btn-ghost" onClick={load}>Refresh</button>
      </div>

      {error && <div className="callout callout-error">{error}</div>}

      {data && (
        <>
          <div className="stat-grid">
            <div className={`stat-card ${data.database?.status === 'OK' ? 'accent' : 'danger'}`}>
              <span className="stat-icon">{data.database?.status === 'OK' ? '✅' : '❌'}</span>
              <span className="stat-value">{data.database?.status || '—'}</span>
              <span className="stat-label">Database Status</span>
            </div>
            <div className="stat-card">
              <span className="stat-icon">👥</span>
              <span className="stat-value">{data.counts?.users ?? '—'}</span>
              <span className="stat-label">Total Users</span>
            </div>
            <div className="stat-card">
              <span className="stat-icon">🚗</span>
              <span className="stat-value">{data.counts?.vehicles ?? '—'}</span>
              <span className="stat-label">Vehicles</span>
            </div>
            <div className="stat-card">
              <span className="stat-icon">📋</span>
              <span className="stat-value">{data.counts?.requests ?? '—'}</span>
              <span className="stat-label">Requests</span>
            </div>
            <div className="stat-card">
              <span className="stat-icon">🧭</span>
              <span className="stat-value">{data.counts?.trips ?? '—'}</span>
              <span className="stat-label">Trips</span>
            </div>
            <div className="stat-card">
              <span className="stat-icon">⛽</span>
              <span className="stat-value">{data.counts?.fuelRequests ?? '—'}</span>
              <span className="stat-label">Fuel Requests</span>
            </div>
            <div className="stat-card">
              <span className="stat-icon">📒</span>
              <span className="stat-value">{data.counts?.logbooks ?? '—'}</span>
              <span className="stat-label">Logbooks</span>
            </div>
            <div className="stat-card">
              <span className="stat-icon">🔔</span>
              <span className="stat-value">{data.counts?.notifications ?? '—'}</span>
              <span className="stat-label">Notifications</span>
            </div>
          </div>

          <div className="settings-grid" style={{ marginTop: 24 }}>
            <div className="settings-card">
              <div className="settings-card-header">
                <span className="settings-icon">&#128737;</span>
                <div>
                  <span className="profile-section-label">AUDIT TRAIL</span>
                  <h2>Recent Activity</h2>
                </div>
              </div>
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Time</th>
                      <th>User</th>
                      <th>Action</th>
                      <th>Entity</th>
                      <th>Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data.recentAudits || []).map((log) => (
                      <tr key={log.id}>
                        <td>{log.createdAt ? new Date(log.createdAt).toLocaleString() : '—'}</td>
                        <td>{log.user?.fullName || 'System'}</td>
                        <td><span className="status-badge">{log.action}</span></td>
                        <td>{log.entity || '—'}</td>
                        <td>{log.description || '—'}</td>
                      </tr>
                    ))}
                    {(!data.recentAudits || data.recentAudits.length === 0) && (
                      <tr><td colSpan={5} className="empty-cell">No recent activity.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
