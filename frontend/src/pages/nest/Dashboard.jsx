import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { statsApi } from '../../services/resources';
import Loading from '../../components/Loading';

export default function NESTDashboard() {
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
          total: response?.total ?? 0,
        });
      } catch (err) {
        console.error('NEST dashboard failed:', err);
        setError(err?.response?.data?.message || 'Failed to load dashboard statistics.');
        setData({ pending: 0, approved: 0, rejected: 0, total: 0 });
      }
    };

    load();
  }, []);

  if (!data) return <Loading />;

  return (
    <div className="dashboard-page">
      <div className="hero-strip">
        <div>
          <span className="eyebrow">NEST PORTAL</span>
          <h2>Fuel Request Review</h2>
          <p>
            Follow fuel requests from submission to voucher release. NEST has
            read-only visibility over the fuel workflow.
          </p>
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
        <div className="stat-card">
          <span className="stat-icon">🛢️</span>
          <span className="stat-value">{data.total}</span>
          <span className="stat-label">Total Requests</span>
        </div>
      </div>

      <div className="queue-list">
        <Link to="/admin/training/nest/fuel" className="queue-item">
          <span>Open Fuel Request Queue</span>
          <strong>{data.pending} &rarr;</strong>
        </Link>
        <Link to="/admin/training/nest/fuel" className="queue-item">
          <span>All Fuel Requests</span>
          <strong>{data.total} &rarr;</strong>
        </Link>
      </div>

      <div className="callout" style={{ marginTop: 16 }}>
        <strong>Read-only portal</strong>
        <p>
          NEST observes the fuel workflow. Approvals, releases and confirmations
          are performed by HPMU and the driver.
        </p>
      </div>
    </div>
  );
}
