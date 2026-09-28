import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import NotificationBell from '../components/NotificationBell';
import { initTheme, toggleTheme } from '../utils/theme';

const titles = {
  officer: 'Officer Portal',
  driver: 'Driver Portal',
  transport: 'Transport Officer Portal',
  r3: 'R3 Portal',
  hpmu: 'HPMU Portal',
};

export default function PortalLayout({ title, menu, trainingBanner }) {
  const { user, logout } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [theme, setTheme] = useState('light');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();

  const isTrainingMode = location.pathname.startsWith('/admin/training/');
  const trainingContext = isTrainingMode
    ? (location.pathname.split('/admin/training/')[1] || '').split('/')[0]
    : null;
  const trainingPortalTitle = trainingContext ? titles[trainingContext] || 'Portal' : null;

  useEffect(() => { setTheme(initTheme()); }, []);

  useEffect(() => {
    const handleClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const roleHome = user?.role ? {
    OFFICER: '/officer',
    DRIVER: '/driver',
    TRANSPORT_OFFICER: '/transport',
    R3: '/r3',
    HPMU: '/hpmu',
    ADMIN: '/admin',
  }[user.role] : '/login';

  const handleBackToTraining = () => {
    // Leaving the training frame ends the training context client-side.
    localStorage.removeItem('vtms_training_token');
    localStorage.removeItem('vtms_training_portal');
    navigate('/admin/training');
  };

  return (
    <div className={`portal-shell ${collapsed ? 'collapsed' : ''}`}>
      {isTrainingMode && (
        <div className="training-banner training-banner-bar">
          <span className="training-banner-icon">&#128270;</span>
          <strong>TRAINING MODE</strong>
          <span className="training-banner-sep">/</span>
          <span>Administrator Training Session</span>
          <span className="training-banner-sep">/</span>
          <span>Current Portal: <strong>{trainingPortalTitle || 'Portal'}</strong></span>
          <button className="btn btn-sm btn-ghost training-banner-back" onClick={handleBackToTraining}>
            &#8592; Back to Admin Training
          </button>
        </div>
      )}

      {!isTrainingMode && trainingBanner && (
        <div className="training-banner">
          <span>&#128270;</span>
          <strong>ADMIN TRAINING MODE</strong>
          <span>&mdash; {trainingBanner}</span>
        </div>
      )}

      <aside className="sidebar">
        <div className="sidebar-brand">
          <span className="brand-mark">VT</span>
          {!collapsed && <span>VTMS</span>}
        </div>
        <nav className="sidebar-nav">
          {menu.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
              <span className="sidebar-icon">{item.icon}</span>
              {!collapsed && <span>{item.label}</span>}
            </NavLink>
          ))}
          {isTrainingMode && (
            <button
              type="button"
              className="sidebar-link sidebar-back-training"
              onClick={handleBackToTraining}
              title="Return to Admin Training Portal"
            >
              <span className="sidebar-icon">&#8592;</span>
              {!collapsed && <span>Back to Training</span>}
            </button>
          )}
        </nav>
      </aside>

      <div className="portal-main">
        <header className="topbar">
          <button className="icon-btn" onClick={() => setCollapsed((c) => !c)} aria-label="Toggle sidebar">&#9776;</button>
          <h1 className="topbar-title">{title}</h1>
          <div className="topbar-actions">
            <button
              className="icon-btn theme-toggle-btn"
              onClick={() => setTheme(toggleTheme())}
              aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
              title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
            >
              {theme === 'light' ? '☀️' : '🌙'}
            </button>
            <NotificationBell />
            <div className="user-dropdown-container" ref={dropdownRef}>
              <button className="user-chip" onClick={() => setDropdownOpen(!dropdownOpen)}>
                <div className="avatar">{user?.fullName?.[0] || '?'}</div>
                <div className="user-meta">
                  <strong>{user?.fullName}</strong>
                  <span>{user?.role?.replace('_', ' ')}{isTrainingMode ? ' · Training' : ''}</span>
                </div>
                <span className="dropdown-arrow">&#9662;</span>
              </button>
              {dropdownOpen && (
                <div className="user-dropdown">
                  <div className="dropdown-header">
                    <div className="avatar avatar-lg">{user?.fullName?.[0] || '?'}</div>
                    <div>
                      <strong>{user?.fullName}</strong>
                      <span>@{user?.username}</span>
                    </div>
                  </div>
                  <div className="dropdown-divider" />
                  <button className="dropdown-item" onClick={() => { setDropdownOpen(false); navigate(`${roleHome}/profile`); }}>
                    <span>&#128100;</span> Profile
                  </button>
                  <button className="dropdown-item" onClick={() => { setDropdownOpen(false); navigate(`${roleHome}/settings`); }}>
                    <span>&#9881;&#65039;</span> Settings
                  </button>
                  <div className="dropdown-divider" />
                  <button className="dropdown-item dropdown-item-danger" onClick={() => { setDropdownOpen(false); handleLogout(); }}>
                    <span>&#128682;</span> Log out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>
        <main className="portal-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}