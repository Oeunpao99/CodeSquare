import React, { useState } from 'react';
import { FiShield, FiArrowRight } from 'react-icons/fi';
import { adminAuth, adminToken } from '../../services/adminApi';

// Standalone sign-in for /admin-portal — email + password, admin accounts only.
export default function AdminLogin({ onAuthed }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const r = await adminAuth.login(email.trim(), password);
      adminToken.set(r.data.access_token);
      onAuthed(r.data.admin);
    } catch (err) {
      const detail = err?.response?.data?.detail;
      setError(
        err?.response?.status === 403
          ? 'That account is not an admin.'
          : detail || 'Incorrect email or password.'
      );
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-cs-dark text-cs-text flex items-center justify-center px-6">
      <form
        onSubmit={submit}
        className="w-full max-w-sm rounded-2xl border border-cs-line/10 bg-cs-darker p-7"
      >
        <div className="flex items-center gap-2.5 text-cs-primary mb-1">
          <FiShield className="text-lg" />
          <span className="mono-label text-cs-primary">// admin portal</span>
        </div>
        <h1 className="font-mono text-2xl font-bold mb-1">Sign in</h1>
        <p className="text-sm text-cs-text-muted mb-6">
          Admin accounts only. Learner sign-in is at <span className="font-mono">/auth</span>.
        </p>

        <label className="block mb-3">
          <span className="block font-mono text-[11px] uppercase tracking-[0.16em] text-cs-text-muted mb-1.5">
            Email
          </span>
          <input
            type="email"
            required
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl font-mono text-[13px] bg-cs-overlay/5 border border-cs-line/10 text-cs-text outline-none focus:border-cs-primary"
            placeholder="you@example.com"
          />
        </label>

        <label className="block mb-5">
          <span className="block font-mono text-[11px] uppercase tracking-[0.16em] text-cs-text-muted mb-1.5">
            Password
          </span>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl font-mono text-[13px] bg-cs-overlay/5 border border-cs-line/10 text-cs-text outline-none focus:border-cs-primary"
            placeholder="••••••••"
          />
        </label>

        {error && (
          <p className="mb-4 font-mono text-[12px] text-cs-red border border-cs-red/25 bg-cs-red/10 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={busy}
          className="btn btn-primary w-full font-mono disabled:opacity-50"
        >
          {busy ? 'Signing in…' : <>Sign in <FiArrowRight /></>}
        </button>
      </form>
    </div>
  );
}
