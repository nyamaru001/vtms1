import { useAuth } from '../../context/AuthContext';

export default function TransportSettings() {
  const { user } = useAuth();
  return (
    <div className="panel">
      <h3>Transport Officer Settings</h3>
      <div className="detail-grid">
        <div><span className="field-label">Signed in as</span><p>{user.fullName} ({user.role.replace('_', ' ')})</p></div>
        <div><span className="field-label">Default fuel buffer</span><p>Configured via FUEL_BUFFER_PERCENT in the backend .env (default 10%).</p></div>
        <div><span className="field-label">Routing engine</span><p>Configured via OSRM_BASE_URL in the backend .env. Falls back to a distance estimate if unset.</p></div>
      </div>
    </div>
  );
}