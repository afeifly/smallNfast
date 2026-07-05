import { useState } from 'react';
import { useProjects } from '../context/ProjectContext.jsx';
import { Boxes } from 'lucide-react';

export default function Login() {
  const { login } = useProjects();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) return;

    setLoading(true);
    setError(null);
    try {
      await login(username.trim(), password.trim());
    } catch (err) {
      setError(err.message || 'Invalid username or password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card glass-panel animate-fade-in">
        <div className="login-logo-section">
          {/* Signpost logo design resembling a milestone */}
          <div className="logo-icon-milestone">
            <div className="logo-signpost-post" />
            <div className="logo-signpost-arm right">
              <span>ProJ</span>
            </div>
            <div className="logo-signpost-arm left">
              <span>View</span>
            </div>
            <div className="logo-signpost-foundation" />
          </div>
          <h2 className="login-title">
            <span className="layout-title-proj">ProJ</span>
            <span className="layout-title-show">View</span>
          </h2>
          <p className="login-subtitle">Workspace Management Dashboard</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          {error && <div className="login-error">{error}</div>}

          <div className="login-field">
            <label htmlFor="username">Username</label>
            <input
              id="username"
              type="text"
              required
              placeholder="e.g. admin"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={loading}
            />
          </div>

          <div className="login-field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              required
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
            />
          </div>

          <button type="submit" className="login-submit-btn" disabled={loading}>
            {loading ? 'Signing In...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}
