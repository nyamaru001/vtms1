import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="not-found-page">
      <div className="not-found-card">
        <div className="not-found-code">404</div>
        <h2>Page Not Found</h2>
        <p>The page you are looking for does not exist or has been moved.</p>
        <Link to="/login" className="btn btn-primary" style={{ marginTop: 16 }}>
          Back to Login
        </Link>
      </div>
    </div>
  );
}
