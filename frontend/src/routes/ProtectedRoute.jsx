import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ROLE_PREFIXES = [
  ['/officer', 'officer'],
  ['/driver', 'driver'],
  ['/transport', 'transport'],
  ['/hpmu', 'hpmu'],
  ['/r3', 'r3'],
];

function trainingPathFor(pathname) {
  const match = ROLE_PREFIXES.find(
    ([prefix]) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
  if (!match) return null;
  const [prefix, portal] = match;
  return `/admin/training/${portal}${pathname.slice(prefix.length)}`;
}

export default function ProtectedRoute({ roles, children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <div className="page-loading">Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;

  const inTrainingArea = location.pathname.startsWith('/admin/training');
  const inTrainingSession =
    !!localStorage.getItem('vtms_training_token') &&
    !!localStorage.getItem('vtms_training_portal');

  // A link inside a training portal points at the live portal path
  // (e.g. /driver/fuel). Send the administrator to the training copy of
  // that page instead of the role-protected live page.
  if (user.role === 'ADMIN' && inTrainingSession && !inTrainingArea) {
    const trainingPath = trainingPathFor(location.pathname);
    if (trainingPath) return <Navigate to={trainingPath} replace />;
  }

  if (roles && !roles.includes(user.role)) {
    if (user.role === 'ADMIN' && inTrainingSession) {
      return <Navigate to="/admin/training" replace />;
    }
    return <Navigate to="/unauthorized" replace />;
  }

  return children;
}
