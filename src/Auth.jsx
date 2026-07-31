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

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" style={{ marginRight: '8px', verticalAlign: 'middle' }}>
      <path
        fill="#EA4335"
        d="M12 5c1.6 0 3 .6 4.1 1.6l3.1-3.1C17.3 1.7 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.3 9 5 12 5z"
      />
      <path
        fill="#4285F4"
        d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.8z"
      />
      <path
        fill="#FBBC05"
        d="M5.6 14.8c-.3-.8-.4-1.8-.4-2.8s.1-2 .4-2.8L1.9 6.3C.7 8.7 0 10.3 0 12s.7 3.3 1.9 5.7l3.7-2.9z"
      />
      <path
        fill="#34A853"
        d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2.3-6.4-5.2L1.9 16C3.7 19.7 7.5 23 12 23z"
      />
    </svg>
  );
}

export default function Auth() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleGoogleLogIn = async () => {
    setError(null);
    setLoading(true);
    const { error: authError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
      },
    });
    setLoading(false);
    if (authError) {
      setError(authError.message);
    }
  };

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

        {/* Google OAuth Button */}
        <div className="auth-oauth">
          <button className="btn-google" onClick={handleGoogleLogIn} disabled={loading}>
            {loading ? <Loader2 size={16} className="spin" style={{ verticalAlign: 'middle' }} /> : <><GoogleIcon /> Continue with Google</>}
          </button>
        </div>

        <div className="auth-divider">
          <span>or continue with email</span>
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