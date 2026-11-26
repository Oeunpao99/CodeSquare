import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { FiEye, FiEyeOff } from 'react-icons/fi';
import { FaTelegramPlane } from 'react-icons/fa';
import api from '../services/api';
import { toast } from '../utils/toast';

const TG_SCRIPT = 'https://telegram.org/js/telegram-widget.js?22';

// Load Telegram's login script once, on demand.
function loadTelegram() {
  if (window.Telegram?.Login) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = TG_SCRIPT;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Telegram script failed to load'));
    document.head.appendChild(s);
  });
}

const GoogleLogo = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden>
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
  </svg>
);

const INPUT = 'w-full h-11 px-3.5 rounded-lg border border-cs-line/15 bg-transparent text-cs-text text-[0.9375rem] outline-none transition-colors focus:border-cs-primary placeholder:text-cs-text-muted';

function Auth() {
  const { t } = useTranslation();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [tgBusy, setTgBusy] = useState(false);
  const { login, register, loginWithGoogle, loginWithTelegram, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) navigate('/dashboard');
  }, [user, navigate]);

  useEffect(() => {
    const handleGoogleSignIn = async (response) => {
      try {
        setLoading(true);
        await loginWithGoogle(response.credential);
        toast.success('Welcome to CodeSquare!');
        navigate('/dashboard');
      } catch {
        toast.error('Google sign-in failed. Please try again.');
      } finally {
        setLoading(false);
      }
    };
    if (window.google?.accounts?.id) {
      window.google.accounts.id.initialize({
        client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID || 'your-google-client-id.apps.googleusercontent.com',
        callback: handleGoogleSignIn,
      });
    }
  }, [loginWithGoogle, navigate]);

  const continueWithTelegram = async () => {
    if (tgBusy) return;
    setTgBusy(true);
    try {
      const { data: cfg } = await api.get('/auth/telegram/config');
      if (!cfg.enabled) {
        toast.error('Telegram sign-in isn’t set up yet.');
        setTgBusy(false);
        return;
      }
      await loadTelegram();
      // Opens Telegram's own login popup; calls back with the signed user data (or false if closed).
      window.Telegram.Login.auth({ bot_id: cfg.bot_id, request_access: 'write' }, async (tgUser) => {
        if (!tgUser) { setTgBusy(false); return; }
        try {
          await loginWithTelegram(tgUser);
          toast.success('Welcome to CodeSquare!');
          navigate('/dashboard');
        } catch (err) {
          toast.error(err.response?.data?.detail || 'Telegram sign-in failed. Please try again.');
        } finally {
          setTgBusy(false);
        }
      });
    } catch {
      toast.error('Could not open Telegram. Check your connection and try again.');
      setTgBusy(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isLogin) {
        await login(email, password);
        toast.success('Welcome back!');
      } else {
        if (!username.trim()) {
          toast.error('Please enter a username');
          setLoading(false);
          return;
        }
        await register(email, username, password);
        toast.success('Account created! Welcome to CodeSquare!');
      }
      navigate('/dashboard');
    } catch (error) {
      const message = error.response?.data?.detail || 'Something went wrong';
      toast.error(typeof message === 'string' ? message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-5 bg-cs-darkest">
      <Link to="/" className="flex items-center gap-2 mb-5">
        <img src="/logo.png" alt="" className="h-8 w-auto object-contain" />
        <span className="text-xl font-bold">CodeSquare</span>
      </Link>

      <div className="w-full max-w-[26rem] rounded-2xl border border-cs-line/10 bg-cs-dark overflow-hidden shadow-sm">
        <div className="px-7 pt-6 pb-6">
          <h1 className="text-2xl font-bold">{isLogin ? 'Log in' : 'Create your account'}</h1>
          <p className="text-cs-text-dim text-sm mt-1">
            {isLogin ? 'Sign in to continue learning.' : 'Start learning in under a minute.'}
          </p>

          <div className="mt-5 space-y-2.5">
            <button
              type="button"
              onClick={() => window.google?.accounts?.id?.prompt()}
              disabled={loading}
              className="w-full h-11 rounded-lg border border-cs-line/15 bg-cs-overlay/[0.04] hover:bg-cs-overlay/[0.08] inline-flex items-center justify-center gap-2.5 text-[0.9375rem] font-medium transition-colors disabled:opacity-60"
            >
              <GoogleLogo /> Continue with Google
            </button>
            <button
              type="button"
              onClick={continueWithTelegram}
              disabled={tgBusy}
              className="w-full h-11 rounded-lg bg-[#2AABEE] hover:bg-[#229ED9] text-white inline-flex items-center justify-center gap-2.5 text-[0.9375rem] font-medium transition-colors disabled:opacity-70"
            >
              {tgBusy
                ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                : <FaTelegramPlane className="text-lg" />}
              Continue with Telegram
            </button>
          </div>

          <div className="flex items-center gap-3 my-4">
            <span className="flex-1 h-px bg-cs-line/10" />
            <span className="text-xs text-cs-text-muted">or with email</span>
            <span className="flex-1 h-px bg-cs-line/10" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label htmlFor="email" className="block text-sm font-medium mb-1">{t('auth.email')}</label>
              <input type="email" id="email" value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com" required className={INPUT} />
            </div>

            {!isLogin && (
              <div>
                <label htmlFor="username" className="block text-sm font-medium mb-1">{t('auth.username')}</label>
                <input type="text" id="username" value={username} onChange={(e) => setUsername(e.target.value)}
                  placeholder="coolcoder123" className={INPUT} />
              </div>
            )}

            <div>
              <label htmlFor="password" className="block text-sm font-medium mb-1">{t('auth.password')}</label>
              <div className="relative">
                <input type={showPassword ? 'text' : 'password'} id="password" value={password}
                  onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required minLength={6}
                  className={`${INPUT} pr-11`} />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-cs-text-muted hover:text-cs-text p-1">
                  {showPassword ? <FiEyeOff /> : <FiEye />}
                </button>
              </div>
            </div>

            <button type="submit" className="btn btn-primary w-full h-11" disabled={loading}>
              {loading
                ? <span className="w-5 h-5 border-2 border-t-transparent border-white rounded-full animate-spin" />
                : isLogin ? 'Log in' : 'Create account'}
            </button>
          </form>
        </div>

        <div className="px-7 py-3.5 border-t border-cs-line/10 bg-cs-overlay/[0.03] text-sm text-cs-text-dim">
          {isLogin ? 'Need an account? ' : 'Already have an account? '}
          <button onClick={() => setIsLogin(!isLogin)} className="text-cs-text font-medium underline underline-offset-4 hover:text-cs-primary">
            {isLogin ? 'Sign up' : 'Log in'}
          </button>
        </div>
      </div>

      <p className="text-xs text-cs-text-muted mt-4 max-w-[26rem] text-center leading-relaxed">
        By continuing with Google, Telegram or email, you agree to our{' '}
        <Link to="/terms" className="text-cs-text-dim underline underline-offset-2 hover:text-cs-primary">Terms of Service</Link> and{' '}
        <Link to="/privacy" className="text-cs-text-dim underline underline-offset-2 hover:text-cs-primary">Privacy Policy</Link>.
        {' '}Telegram shares your name, username and profile photo with us.
      </p>
    </div>
  );
}

export default Auth;
