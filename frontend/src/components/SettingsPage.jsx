import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

export default function SettingsPage() {
  const { user } = useAuth();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordMsg, setPasswordMsg] = useState('');
  const [passwordErr, setPasswordErr] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPasswordMsg('');
    setPasswordErr('');
    if (!currentPassword) {
      setPasswordErr('Current password is required.');
      return;
    }
    if (!newPassword) {
      setPasswordErr('New password is required.');
      return;
    }
    if (newPassword.length < 6) {
      setPasswordErr('New password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordErr('Passwords do not match.');
      return;
    }
    try {
      setSavingPassword(true);
      const res = await api.put('/auth/change-password', {
        currentPassword,
        newPassword,
      });
      setPasswordMsg(res.data.message);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setPasswordErr(err.response?.data?.message || 'Failed to change password.');
    } finally {
      setSavingPassword(false);
    }
  };

  const role = user?.role ? user.role.replace(/_/g, ' ') : '—';

  return (
    <div className="settings-page">
      <div className="profile-page-header">
        <div>
          <span className="profile-kicker">ACCOUNT SETTINGS</span>
          <h1>Settings</h1>
          <p>Manage your password and security settings.</p>
        </div>
      </div>

      <div className="settings-grid">
        <div className="settings-card">
          <div className="settings-card-header">
            <span className="settings-icon">&#128100;</span>
            <div>
              <span className="profile-section-label">ACCOUNT</span>
              <h2>Account Information</h2>
            </div>
          </div>
          <div className="settings-info-grid">
            <div className="settings-info-item">
              <span>Username</span>
              <strong>{user?.username || '—'}</strong>
            </div>
            <div className="settings-info-item">
              <span>Role</span>
              <strong>{role}</strong>
            </div>
            <div className="settings-info-item">
              <span>Account Status</span>
              <strong className="profile-role-text">{user?.status || 'ACTIVE'}</strong>
            </div>
          </div>
        </div>

        <div className="settings-card">
          <div className="settings-card-header">
            <span className="settings-icon">&#128274;</span>
            <div>
              <span className="profile-section-label">SECURITY</span>
              <h2>Change Password</h2>
            </div>
          </div>
          <form onSubmit={handleChangePassword} className="settings-form">
            {passwordMsg && <div className="callout callout-success">{passwordMsg}</div>}
            {passwordErr && <div className="callout callout-error">{passwordErr}</div>}
            <div className="form-field">
              <label>Current Password</label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter current password"
              />
            </div>
            <div className="form-field">
              <label>New Password</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password (min 6 characters)"
              />
            </div>
            <div className="form-field">
              <label>Confirm New Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
              />
            </div>
            <button type="submit" className="btn btn-primary" disabled={savingPassword}>
              {savingPassword ? 'Changing...' : 'Change Password'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
