import { useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './firebaseClient';
import Auth from './Auth';
import PulseApp from './pulse';

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Firebase delivers the current auth state on subscribe (covers page
    // reloads and token refreshes) and pushes changes on login/logout/OAuth.
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="pulse-root">
        <style>{`
          .pulse-root {
            --bg: #0F141A;
            --surface: #1A212C;
            --surface-2: #222B38;
            --ink: #E9EEF4;
            --muted: #7C8A9C;
            --hairline: rgba(124, 138, 156, 0.16);
            --live: #41D6E0;
            --risk: #EF4A52;
            font-family: 'Inter', -apple-system, sans-serif;
            background: var(--bg);
            color: var(--ink);
            min-height: 100vh;
            width: 100%;
          }
          .loading-screen {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            min-height: 60vh;
            gap: 14px;
            color: var(--muted);
            font-size: 13px;
          }
        `}</style>
        <div className="loading-screen">
          <svg width="72" height="24" viewBox="0 0 64 22" fill="none" aria-hidden="true">
            <path d="M0,11 L16,11 L20,3 L24,19 L28,5 L32,11 L48,11 L52,6 L56,16 L60,11 L64,11" stroke="#41D6E0" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Loading…
        </div>
      </div>
    );
  }

  const Branding = (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500;600&display=swap');
        html, body, #root {
          margin: 0;
          padding: 0;
          width: 100%;
          min-height: 100vh;
          background: #0F141A;
        }
        .pulse-root {
          --bg: #0F141A;
          --surface: #1A212C;
          --surface-2: #222B38;
          --ink: #E9EEF4;
          --muted: #7C8A9C;
          --hairline: rgba(124, 138, 156, 0.16);
          --live: #41D6E0;
          --live-dim: rgba(65, 214, 224, 0.14);
          --risk: #EF4A52;
          --risk-dim: rgba(239, 74, 82, 0.12);
          --radius-sm: 6px;
          --radius-md: 10px;
          --radius-lg: 14px;
          font-family: 'Inter', -apple-system, sans-serif;
          background:
            radial-gradient(ellipse at 50% 0%, rgba(65, 214, 224, 0.07) 0%, transparent 55%),
            var(--bg);
          color: var(--ink);
          min-height: 100vh;
          width: 100%;
          box-sizing: border-box;
          padding-bottom: 8px;
          margin: 0;
        }
        .pulse-root *, .pulse-root *::before, .pulse-root *::after { box-sizing: border-box; }
        .pulse-root .mono { font-family: 'JetBrains Mono', monospace; }
        .pulse-root .display { font-family: 'Space Grotesk', sans-serif; }
        .pulse-root button { font-family: inherit; cursor: pointer; }
        .pulse-root input, .pulse-root select, .pulse-root textarea { font-family: inherit; }
        .pulse-root :focus-visible { outline: 2px solid var(--live); outline-offset: 2px; }

        .auth-box {
          background: var(--surface);
          border: 1px solid rgba(65, 214, 224, 0.15);
          border-radius: var(--radius-lg);
          padding: 36px 32px 28px;
          width: 100%;
          max-width: 380px;
          box-shadow: 0 12px 40px rgba(0, 0, 0, 0.5);
        }
        .auth-brand {
          display: grid;
          grid-template-columns: 1fr auto 1fr;
          align-items: center;
          width: 100%;
          margin-bottom: 24px;
        }
        .auth-brand svg {
          grid-column: 1;
          justify-self: end;
          margin-right: 12px;
        }
        .auth-wordmark {
          grid-column: 2;
          font-family: 'Space Grotesk', sans-serif;
          font-size: 24px;
          font-weight: 700;
          letter-spacing: -0.01em;
          color: var(--ink);
          line-height: 1;
        }
        .auth-oauth {
          margin-bottom: 20px;
        }
        .btn-google {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 10px 16px;
          background: #ffffff;
          color: #1f2937;
          border: 1px solid #e5e7eb;
          border-radius: var(--radius-md);
          font-size: 13.5px;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.15s ease, transform 0.15s ease;
        }
        .btn-google:hover:not(:disabled) {
          background: #f9fafb;
          transform: translateY(-1px);
        }
        .btn-google:disabled {
          opacity: 0.6;
          cursor: progress;
        }
        .auth-divider {
          display: flex;
          align-items: center;
          text-align: center;
          margin-bottom: 20px;
          color: var(--muted);
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .auth-divider::before,
        .auth-divider::after {
          content: '';
          flex: 1;
          border-bottom: 1px solid var(--hairline);
        }
        .auth-divider span {
          padding: 0 10px;
        }
        .auth-field { margin-bottom: 16px; }
        .auth-field label {
          display: block;
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: var(--muted);
          margin-bottom: 6px;
        }
        .auth-field input {
          width: 100%;
          background-color: var(--surface-2);
          color: var(--ink);
          border: 1px solid var(--hairline);
          padding: 10px 12px;
          border-radius: var(--radius-sm);
          font-size: 14px;
          outline: none;
          transition: all 0.2s ease;
        }
        .auth-field input:focus {
          border-color: var(--live);
          box-shadow: 0 0 0 3px rgba(65, 214, 224, 0.15);
        }
        .auth-field input:-webkit-autofill,
        .auth-field input:-webkit-autofill:hover,
        .auth-field input:-webkit-autofill:focus,
        .auth-field input:-webkit-autofill:active {
          -webkit-box-shadow: 0 0 0 30px var(--surface-2) inset !important;
          -webkit-text-fill-color: var(--ink) !important;
          caret-color: var(--ink);
          transition: background-color 5000s ease-in-out 0s;
        }
        .auth-field input::placeholder { color: var(--muted); }
        .auth-actions {
          display: flex;
          gap: 10px;
          margin-top: 20px;
        }
        .auth-actions button {
          flex: 1;
          padding: 10px 0;
          border-radius: var(--radius-md);
          font-size: 13.5px;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.15s ease, opacity 0.15s ease;
        }
        .btn-login {
          background: var(--live);
          color: #06181A;
          border: none;
        }
        .btn-login:hover:not(:disabled) { opacity: 1; transform: translateY(-1px); }
        .btn-signup {
          background: transparent;
          color: var(--muted);
          border: 1px solid var(--hairline);
        }
        .btn-signup:hover:not(:disabled) { color: var(--ink); border-color: var(--muted); }
        .auth-actions button:disabled { opacity: 0.6; cursor: progress; }
        .auth-error {
          font-size: 13px;
          color: var(--risk);
          padding: 10px 12px;
          background: var(--risk-dim);
          border-radius: var(--radius-md);
          border: 1px solid rgba(239, 74, 82, 0.2);
          line-height: 1.5;
          margin-top: 16px;
        }
        .auth-hint {
          text-align: center;
          font-size: 12px;
          color: var(--muted);
          margin-top: 18px;
        }
      `}</style>
    </>
  );

  if (!user) {
    return (
      <div className="pulse-root" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        {Branding}
        <Auth />
      </div>
    );
  }

  return (
    <div className="pulse-root">
      {Branding}
      <PulseApp userId={user.uid} userEmail={user.email} />
    </div>
  );
}