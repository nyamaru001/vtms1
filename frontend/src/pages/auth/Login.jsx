import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const ROLE_HOME = {
  ADMIN: '/admin',
  OFFICER: '/officer',
  DRIVER: '/driver',
  TRANSPORT_OFFICER: '/transport',
  R3: '/r3',
  HPMU: '/hpmu',
};

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!username.trim() || !password) {
      setError('Please enter your username and password.');
      return;
    }

    setLoading(true);

    try {
      const user = await login(username.trim(), password);
      navigate(ROLE_HOME[user.role] || '/');
    } catch (err) {
      const status = err.response?.status;

      if (status === 401) {
        setError('Incorrect username or password.');
      } else if (status === 403) {
        setError(
          err.response?.data?.message ||
            'Your account is not active.'
        );
      } else {
        setError(
          err.response?.data?.message ||
            'Unable to sign in right now. Please try again.'
        );
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">

      {/* LEFT - BRAND / VISUAL SIDE */}
      <section className="login-visual">
        <div className="visual-overlay" />

        {/* Animated bubbles */}
        <div className="bubble bubble-1" />
        <div className="bubble bubble-2" />
        <div className="bubble bubble-3" />
        <div className="bubble bubble-4" />
        <div className="bubble bubble-5" />

        <div className="visual-content">

          {/* BRAND - logo only; the system name appears once, below */}
          <div className="visual-brand">
            <span className="visual-logo">VT</span>
          </div>

          {/* MAIN HERO - the one and only system name */}
          <div className="visual-main">

            <h1>
              Vehicle Transport and Management System
            </h1>

            <p>
              A connected platform for managing vehicle requests,
              drivers, trips, fuel approvals and transport operations
              from one secure system.
            </p>

            <div className="visual-vehicle">
              <img
                src="/land-cruiser-cutout.png"
                alt="Toyota Land Cruiser"
                className="visual-vehicle-img"
              />
            </div>
          </div>

          {/* FEATURES */}
          <div className="visual-features">

            <div className="visual-feature">
              <div className="feature-icon">&#x1F697;</div>

              <div>
                <strong>Vehicle Management</strong>
                <span>
                  Track and manage transport requests.
                </span>
              </div>
            </div>

            <div className="visual-feature">
              <div className="feature-icon">&#x1F5FA;</div>

              <div>
                <strong>Trip Monitoring</strong>
                <span>
                  Manage routes and journeys efficiently.
                </span>
              </div>
            </div>

            <div className="visual-feature">
              <div className="feature-icon">&#x26FD;</div>

              <div>
                <strong>Fuel Workflow</strong>
                <span>
                  Streamline fuel requests and approvals.
                </span>
              </div>
            </div>

          </div>

          {/* FOOTER */}
          <div className="visual-footer">
            <span>Secure Transport Operations</span>
          </div>

        </div>
      </section>

      {/* RIGHT - LOGIN */}
      <section className="login-panel">

        <div className="login-container">

          {/* MOBILE LOGO */}
          <div className="mobile-logo">
            <span>VT</span>
          </div>

          {/* LOGIN HEADING */}
          <div className="login-heading">

            <span className="login-eyebrow">
              WELCOME BACK
            </span>

            <h2>
              Sign in to your account
            </h2>

            <p>
              Enter your credentials to continue.
            </p>

          </div>

          {/* LOGIN FORM */}
          <form
            onSubmit={handleSubmit}
            className="login-form"
          >

            {/* USERNAME */}
            <div className="login-field">

              <label htmlFor="username">
                Username
              </label>

              <div className="input-wrapper">

                <span className="input-icon">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    aria-hidden="true"
                  >
                    <path d="M20 21a8 8 0 0 0-16 0" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                </span>

                <input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoFocus
                  required
                  autoComplete="username"
                  placeholder="Enter your username"
                />

              </div>
            </div>

            {/* PASSWORD */}
            <div className="login-field">

              <label htmlFor="password">
                Password
              </label>

              <div className="input-wrapper">

                <span className="input-icon">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    aria-hidden="true"
                  >
                    <rect
                      x="4"
                      y="10"
                      width="16"
                      height="11"
                      rx="2"
                    />

                    <path d="M8 10V7a4 4 0 0 1 8 0v3" />
                  </svg>
                </span>

                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  placeholder="Enter your password"
                />

                <button
                  type="button"
                  className="password-toggle"
                  onClick={() =>
                    setShowPassword((current) => !current)
                  }
                  aria-label={
                    showPassword
                      ? 'Hide password'
                      : 'Show password'
                  }
                >
                  {showPassword ? (
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      aria-hidden="true"
                    >
                      <path d="M3 3l18 18" />
                      <path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" />
                      <path d="M9.9 4.2A10.8 10.8 0 0 1 12 4c5 0 9 4 10 8-0.4 1.5-1.3 2.8-2.4 3.9" />
                      <path d="M6.6 6.6C4.8 7.8 3.5 9.7 2 12c1 4 5 8 10 8 1 0 2-.2 2.9-.5" />
                    </svg>
                  ) : (
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      aria-hidden="true"
                    >
                      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>

              </div>
            </div>

            {/* REMEMBER ME */}
            <div className="login-options">

              <label className="remember-me">

                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) =>
                    setRememberMe(e.target.checked)
                  }
                />

                <span className="custom-checkbox">
                  <svg
                    viewBox="0 0 12 12"
                    fill="none"
                    aria-hidden="true"
                  >
                    <path
                      d="M2.2 6.2 4.8 8.7 9.8 3.4"
                      stroke="currentColor"
                      strokeWidth="1.7"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>

                <span>Remember me</span>

              </label>

            </div>

            {/* ERROR */}
            {error && (
              <div
                className="login-error"
                role="alert"
              >
                <span className="error-icon">!</span>
                <span>{error}</span>
              </div>
            )}

            {/* SUBMIT */}
            <button
              type="submit"
              className="login-submit"
              disabled={loading}
            >
              {loading ? (
                <>
                  <span className="login-spinner" />
                  Signing in...
                </>
              ) : (
                <>
                  Sign in

                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    aria-hidden="true"
                  >
                    <path d="M5 12h14" />
                    <path d="m13 6 6 6-6 6" />
                  </svg>
                </>
              )}
            </button>

          </form>

          {/* SECURITY */}
          <div className="login-security">

            <span className="security-icon">
              &#x1F512;
            </span>

            <span>
              Your account and session are securely protected.
            </span>

          </div>

          {/* BOTTOM */}
          <div className="login-bottom">

            <span>&copy; 2026</span>

          </div>

        </div>

      </section>

    </div>
  );
}