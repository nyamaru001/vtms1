import { Link } from 'react-router-dom';

export default function Unauthorized() {
  return (
    <div className="auth-screen">
      <div className="auth-card" style={{ textAlign: 'center' }}>
        <h1>Access denied</h1>
        <p>You don't have permission to view this portal.</p>
        <Link className="btn btn-primary" to="/login">Back to login</Link>
      </div>
    </div>
  );
}
