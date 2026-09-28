import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { driversApi } from '../../services/resources';
import Loading from '../../components/Loading';

export default function DriverProfile() {
  const { user } = useAuth();
  const [driverProfile, setDriverProfile] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadProfile = async () => {
      if (user?.role !== 'DRIVER') {
        setLoading(false);
        return;
      }
      try {
        setError('');
        const data = await driversApi.profile();
        setDriverProfile(data);
      } catch (err) {
        const message = err.response?.data?.message || 'Failed to load driver profile.';
        setError(message);
      } finally {
        setLoading(false);
      }
    };
    loadProfile();
  }, [user]);

  const fullName =
    driverProfile?.user?.fullName ||
    user?.fullName ||
    user?.name ||
    'Not provided';

  const username =
    driverProfile?.user?.username ||
    user?.username ||
    'Not provided';

  const email =
    driverProfile?.user?.email ||
    user?.email ||
    'Not provided';

  const role =
    user?.role
      ? user.role.replace(/_/g, ' ')
      : 'DRIVER';

  const licenseNumber = driverProfile?.licenseNumber || 'Not provided';
  const licenseExpiry = driverProfile?.licenseExpiry || 'Not provided';
  const driverStatus = driverProfile?.status || 'Not provided';

  const initials = fullName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((name) => name.charAt(0).toUpperCase())
    .join('');

  if (loading) return <Loading />;

  return (
    <div className="officer-profile-page">

      {/* =====================================================
          PROFILE HEADER
      ===================================================== */}
      <section className="officer-profile-header">
        <div className="officer-profile-avatar">
          {initials || 'O'}
        </div>

        <div className="officer-profile-heading">
          <span className="officer-profile-eyebrow">
            ACCOUNT PROFILE
          </span>

          <h1>{fullName}</h1>

          <p>
            Manage and view your officer account information.
          </p>
        </div>

        <div className="officer-profile-role">
          <span className="officer-status-dot" />
          {role}
        </div>
      </section>

      {/* =====================================================
          INFORMATION
      ===================================================== */}
      <section className="officer-profile-card">

        <div className="officer-profile-card-header">
          <div>
            <h2>Personal Information</h2>
            <p>
              Your account details currently registered in VTMS.
            </p>
          </div>
        </div>

        <div className="officer-profile-details">

          <div className="officer-profile-field">
            <span className="officer-field-icon">
              ◉
            </span>

            <div>
              <span className="officer-field-label">
                Full Name
              </span>

              <strong>
                {fullName}
              </strong>
            </div>
          </div>

          <div className="officer-profile-field">
            <span className="officer-field-icon">
              @
            </span>

            <div>
              <span className="officer-field-label">
                Username
              </span>

              <strong>
                {username}
              </strong>
            </div>
          </div>

          <div className="officer-profile-field">
            <span className="officer-field-icon">
              ✉
            </span>

            <div>
              <span className="officer-field-label">
                Email Address
              </span>

              <strong>
                {email}
              </strong>
            </div>
          </div>

          <div className="officer-profile-field">
            <span className="officer-field-icon">
              ◆
            </span>

            <div>
              <span className="officer-field-label">
                Account Role
              </span>

              <strong className="officer-role-text">
                {role}
              </strong>
            </div>
          </div>

          <div className="officer-profile-field">
            <span className="officer-field-icon">
              🪪
            </span>

            <div>
              <span className="officer-field-label">
                License Number
              </span>

              <strong>
                {licenseNumber}
              </strong>
            </div>
          </div>

          <div className="officer-profile-field">
            <span className="officer-field-icon">
              📅
            </span>

            <div>
              <span className="officer-field-label">
                License Expiry
              </span>

              <strong>
                {licenseExpiry}
              </strong>
            </div>
          </div>

          <div className="officer-profile-field">
            <span className="officer-field-icon">
              📍
            </span>

            <div>
              <span className="officer-field-label">
                Driver Status
              </span>

              <strong>
                {driverStatus}
              </strong>
            </div>
          </div>

        </div>
      </section>

      {/* =====================================================
          DRIVER STATUS
      ===================================================== */}
      <section className="officer-account-status">

        <div className="officer-account-status-icon">
          ✓
        </div>

        <div>
          <strong>Account Active</strong>

          <p>
            Your driver account is currently active and
            available for trip assignments.
          </p>
        </div>

      </section>

    </div>
  );
}