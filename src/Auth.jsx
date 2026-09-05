import { useState } from 'react';
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
} from 'firebase/auth';
import { auth } from './firebaseClient';
import { Loader2 } from 'lucide-react';

const googleProvider = new GoogleAuthProvider();

function friendlyAuthError(err) {
  switch (err?.code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Invalid email or password.';
    case 'auth/email-already-in-use':
      return 'An account with this email already exists. Try logging in instead.';
    case 'auth/weak-password':
      return 'Password should be at least 6 characters.';
    case 'auth/invalid-email':
      return 'Please enter a valid email address.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Please try again in a moment.';
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return 'Google sign-in was cancelled.';
    case 'auth/popup-blocked':
      return 'Your browser blocked the sign-in popup. Allow popups and try again.';
    case 'auth/unauthorized-domain':
      return 'This domain is not authorized in Firebase Authentication settings.';
    case 'auth/operation-not-allowed':
      return 'This sign-in method is not enabled yet in the Firebase console (Authentication → Sign-in method).';
    case 'auth/network-request-failed':
      return 'Network error — check your connection and try again.';
    default:
      return err?.message || 'Something went wrong. Please try again.';
  }
}

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
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      setError(friendlyAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async () => {
    setError(null);
    if (!email.trim() || !password.trim()) {
      setError('Email and password are required.');
      return;
    }
    setLoading(true);
    try {
      await createUserWithEmailAndPassword(auth, email.trim(), password);
    } catch (err) {
      setError(friendlyAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleLogIn = async () => {
    setError(null);
    if (!email.trim() || !password.trim()) {
      setError('Email and password are required.');
      return;
    }
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch (err) {
      setError(friendlyAuthError(err));
    } finally {
      setLoading(false);
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