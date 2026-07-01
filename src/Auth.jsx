import { useState } from 'react';
import { supabase } from './supabaseClient';
import { Loader2 } from 'lucide-react';

function PulseWave({ active = false, width = 56, height = 20 }) {
  return (
    <svg
      className={`pulse-wave${active ? ' active' : ''}`}
      width={width}
      height={height}
      viewBox="0 0 64 22"
      fill="none"
      aria-hidden="true"
    >
      <path
        pathLength="1"
        d="M0,11 L16,11 L20,3 L24,19 L28,5 L32,11 L48,11 L52,6 L56,16 L60,11 L64,11"
      />
    </svg>
  );
}

export default function Auth() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSignUp = async () => {
    setError(null);
    if (!email.trim() || !password.trim()) {
      setError('Email and password are required.');
      return;
    }
    setLoading(true);
    const { error: authError } = await supabase.auth.signUp({ email, password });
    setLoading(false);
    if (authError) {
      setError(authError.message);
    }
  };

  const handleLogIn = async () => {
    setError(null);
    if (!email.trim() || !password.trim()) {
      setError('Email and password are required.');
      return;
    }
    setLoading(true);
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (authError) {
      setError(authError.message);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleLogIn();
  };

  return (
    <div className="pulse-root" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <div className="auth-box">
        <div className="auth-brand">
          <PulseWave active width={48} height={18} />
          <span className="auth-wordmark">Pulse</span>
        </div>

        <div className="auth-field">
          <label htmlFor="auth-email">Email</label>
          <input
            id="auth-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            onKeyDown={handleKeyDown}
            autoFocus
          />
        </div>

        <div className="auth-field">
          <label htmlFor="auth-password">Password</label>
          <input
            id="auth-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Min. 6 characters"
            onKeyDown={handleKeyDown}
          />
        </div>

        <div className="auth-actions">
          <button className="btn-login" onClick={handleLogIn} disabled={loading}>
            {loading ? <Loader2 size={14} className="spin" style={{ verticalAlign: 'middle' }} /> : 'Log in'}
          </button>
          <button className="btn-signup" onClick={handleSignUp} disabled={loading}>
            Sign up
          </button>
        </div>

        {error ? <div className="auth-error">{error}</div> : null}
        <div className="auth-hint">Sign up or log in to access your board</div>
      </div>
    </div>
  );
}