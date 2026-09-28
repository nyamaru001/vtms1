import { useAuth } from '../../context/AuthContext';

export default function OfficerProfile() {
  const { user } = useAuth();

  if (!user) {
    return (
      <div className="officer-profile-page">
        <div className="profile-empty">
          <div className="profile-empty-icon">!</div>
          <h3>Profile unavailable</h3>
          <p>Unable to load your profile information.</p>
        </div>
      </div>
    );
  }

  const fullName =
    user.fullName ||
    user.name ||
    `${user.firstName || ''} ${user.lastName || ''}`.trim() ||
    'Officer';

  const username = user.username || '—';
  const email = user.email || '—';
  const role = user.role
    ? user.role.replace(/_/g, ' ')
    : 'OFFICER';

  const initials = fullName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((name) => name.charAt(0).toUpperCase())
    .join('');

  return (
    <div className="officer-profile-page">

      {/* PAGE HEADER */}
      <div className="profile-page-header">
        <div>
          <span className="profile-kicker">ACCOUNT CENTER</span>
          <h1>My Profile</h1>
          <p>
            View your account information and officer details.
          </p>
        </div>
      </div>

      {/* PROFILE HERO */}
      <div className="profile-hero-card">

        <div className="profile-avatar">
          {initials || 'O'}
        </div>

        <div className="profile-hero-info">
          <h2>{fullName}</h2>

          <div className="profile-meta">
            <span>@{username}</span>
            <span className="profile-dot">•</span>
            <span className="profile-role">
              {role}
            </span>
          </div>
        </div>

        <div className="profile-status">
          <span className="profile-status-dot" />
          Active Account
        </div>
      </div>

      {/* ACCOUNT INFORMATION */}
      <div className="profile-card">

        <div className="profile-card-header">
          <div>
            <span className="profile-section-label">
              ACCOUNT INFORMATION
            </span>
            <h2>Personal Details</h2>
          </div>
        </div>

        <div className="profile-details-grid">

          <div className="profile-detail">
            <div className="profile-detail-icon">
              ◉
            </div>

            <div>
              <span>Full Name</span>
              <strong>{fullName}</strong>
            </div>
          </div>

          <div className="profile-detail">
            <div className="profile-detail-icon">
              @
            </div>

            <div>
              <span>Username</span>
              <strong>{username}</strong>
            </div>
          </div>

          <div className="profile-detail">
            <div className="profile-detail-icon">
              ✉
            </div>

            <div>
              <span>Email Address</span>
              <strong>{email}</strong>
            </div>
          </div>

          <div className="profile-detail">
            <div className="profile-detail-icon">
              ◆
            </div>

            <div>
              <span>System Role</span>
              <strong className="profile-role-text">
                {role}
              </strong>
            </div>
          </div>

        </div>
      </div>

      {/* ACCOUNT STATUS */}
      <div className="profile-security-card">

        <div className="profile-security-icon">
          ✓
        </div>

        <div className="profile-security-content">
          <h3>Account Status</h3>
          <p>
            Your officer account is currently active and can access
            the VTMS officer portal.
          </p>
        </div>

        <span className="profile-active-badge">
          ACTIVE
        </span>

      </div>

    </div>
  );
}