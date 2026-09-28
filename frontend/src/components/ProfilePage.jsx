import { useEffect, useState } from 'react';
import api from '../services/api';
import Loading from './Loading';

export default function ProfilePage() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const res = await api.get('/auth/me');
        setProfile(res.data);
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to load profile.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) return <Loading label="Loading profile..." />;

  if (error || !profile) {
    return (
      <div className="profile-page">
        <div className="profile-empty">
          <div className="profile-empty-icon">!</div>
          <h3>Profile unavailable</h3>
          <p>{error || 'Unable to load your profile information.'}</p>
        </div>
      </div>
    );
  }

  const fullName = profile.fullName || 'Not provided';
  const username = profile.username || 'Not provided';
  const email = profile.email || 'Not provided';
  const phone = profile.phone || 'Not provided';
  const role = profile.role ? profile.role.replace(/_/g, ' ') : '—';
  const status = profile.status || 'ACTIVE';
  const createdAt = profile.createdAt
    ? new Date(profile.createdAt).toLocaleString('en-GB', {
        dateStyle: 'long',
        timeStyle: 'short',
      })
    : '—';

  const initials = fullName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n.charAt(0).toUpperCase())
    .join('');

  return (
    <div className="profile-page">
      <div className="profile-page-header">
        <div>
          <span className="profile-kicker">ACCOUNT CENTER</span>
          <h1>My Profile</h1>
          <p>View your account information and personal details.</p>
        </div>
      </div>

      <div className="profile-hero-card">
        <div className="profile-avatar">{initials || '?'}</div>
        <div className="profile-hero-info">
          <h2>{fullName}</h2>
          <div className="profile-meta">
            <span>@{username}</span>
            <span className="profile-dot">&bull;</span>
            <span className="profile-role">{role}</span>
          </div>
        </div>
        <div className="profile-status">
          <span className="profile-status-dot" />
          {status === 'ACTIVE' ? 'Active Account' : 'Inactive Account'}
        </div>
      </div>

      <div className="profile-card">
        <div className="profile-card-header">
          <div>
            <span className="profile-section-label">ACCOUNT INFORMATION</span>
            <h2>Personal Details</h2>
          </div>
        </div>
        <div className="profile-details-grid">
          <div className="profile-detail">
            <div className="profile-detail-icon">&#9673;</div>
            <div>
              <span>Full Name</span>
              <strong>{fullName}</strong>
            </div>
          </div>
          <div className="profile-detail">
            <div className="profile-detail-icon">@</div>
            <div>
              <span>Username</span>
              <strong>{username}</strong>
            </div>
          </div>
          <div className="profile-detail">
            <div className="profile-detail-icon">&#9993;</div>
            <div>
              <span>Email Address</span>
              <strong>{email}</strong>
            </div>
          </div>
          <div className="profile-detail">
            <div className="profile-detail-icon">&#9742;</div>
            <div>
              <span>Phone</span>
              <strong>{phone}</strong>
            </div>
          </div>
          <div className="profile-detail">
            <div className="profile-detail-icon">&#9670;</div>
            <div>
              <span>System Role</span>
              <strong className="profile-role-text">{role}</strong>
            </div>
          </div>
          <div className="profile-detail">
            <div className="profile-detail-icon">&#128197;</div>
            <div>
              <span>Account Created</span>
              <strong>{createdAt}</strong>
            </div>
          </div>
        </div>
      </div>

      <div className="profile-security-card">
        <div className="profile-security-icon">&#10003;</div>
        <div className="profile-security-content">
          <h3>Account Status</h3>
          <p>Your account is currently {status === 'ACTIVE' ? 'active' : 'inactive'} and can access the VTMS portal.</p>
        </div>
        <span className="profile-active-badge">{status}</span>
      </div>
    </div>
  );
}
