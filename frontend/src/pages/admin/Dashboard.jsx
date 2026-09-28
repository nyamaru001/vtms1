import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { adminApi } from '../../services/resources';
import Loading from '../../components/Loading';

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const data = await adminApi.stats();
        setStats({
          users: data?.totalUsers ?? 0,
          vehicles: data?.totalVehicles ?? 0,
          drivers: data?.drivers ?? 0,
          requests: data?.pendingVehicleRequests ?? 0,
          trips: data?.totalTrips ?? 0,
          activeTrips: data?.activeTrips ?? 0,
          availableVehicles: data?.availableVehicles ?? 0,
          pendingFuelRequests: data?.pendingFuelRequests ?? 0,
        });
      } catch {
        setStats({ users: 0, vehicles: 0, drivers: 0, requests: 0, trips: 0 });
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) return <Loading />;

  return (
    <div className="dashboard-page">
      <div className="hero-strip">
        <div>
          <span className="eyebrow">ADMIN PORTAL</span>
          <h2>System Administration</h2>
          <p>Manage users, monitor system health, and access training portals.</p>
        </div>
      </div>

      <div className="stat-grid">
        <div className="stat-card accent">
          <span className="stat-icon">👥</span>
          <span className="stat-value">{stats?.users ?? 0}</span>
          <span className="stat-label">Total Users</span>
        </div>
        <div className="stat-card">
          <span className="stat-icon">📋</span>
          <span className="stat-value">{stats?.requests ?? 0}</span>
          <span className="stat-label">Vehicle Requests</span>
        </div>
        <div className="stat-card">
          <span className="stat-icon">🧭</span>
          <span className="stat-value">{stats?.trips ?? 0}</span>
          <span className="stat-label">Total Trips</span>
        </div>
        <div className="stat-card">
          <span className="stat-icon">🚗</span>
          <span className="stat-value">{stats?.vehicles ?? 0}</span>
          <span className="stat-label">Vehicles</span>
        </div>
      </div>

      <div className="queue-list">
        <Link to="/admin/users" className="queue-item">
          <span>Manage Users</span>
          <strong>&rarr;</strong>
        </Link>
        <Link to="/admin/audit" className="queue-item">
          <span>Audit Logs</span>
          <strong>&rarr;</strong>
        </Link>
        <Link to="/admin/monitoring" className="queue-item">
          <span>System Monitoring</span>
          <strong>&rarr;</strong>
        </Link>
        <Link to="/admin/training" className="queue-item">
          <span>Portal Training</span>
          <strong>&rarr;</strong>
        </Link>
        <Link to="/admin/profile" className="queue-item">
          <span>My Profile</span>
          <strong>&rarr;</strong>
        </Link>
        <Link to="/admin/settings" className="queue-item">
          <span>Settings</span>
          <strong>&rarr;</strong>
        </Link>
      </div>
    </div>
  );
}
