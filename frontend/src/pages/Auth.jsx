import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { FiMail, FiLock, FiUser, FiEye, FiEyeOff } from 'react-icons/fi';
import { toast } from '../utils/toast';

function Auth() {
  const { t } = useTranslation();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { login, register, loginWithGoogle, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  useEffect(() => {
    const handleGoogleSignIn = async (response) => {
      try {
        setLoading(true);
        await loginWithGoogle(response.credential);
        toast.success('Welcome to CodeSphere!');
        navigate('/dashboard');
      } catch (error) {
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

      window.google.accounts.id.renderButton(
        document.getElementById('google-signin-button'),
        { theme: 'outline', size: 'large', width: '100%' }
      );
    }
  }, [loginWithGoogle, navigate]);

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
        toast.success('Account created! Welcome to CodeSphere!');
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
    <div className="min-h-screen flex items-center justify-center px-8 py-8 relative">
      <div className="fixed inset-0 overflow-hidden z-0">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: 
              'linear-gradient(rgba(143, 255, 224, 0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(143, 255, 224, 0.04) 1px, transparent 1px)',
            backgroundSize: '50px 50px',
          }}
        ></div>
        <div className="absolute w-96 h-96 bg-cs-primary bg-opacity-20 rounded-full blur-3xl animate-float top-10 left-10"></div>
        <div className="absolute w-80 h-80 bg-cs-teal bg-opacity-25 rounded-full blur-3xl animate-float bottom-10 right-10" style={{ animationDelay: '2s' }}></div>
      </div>

      <div className="relative z-10 w-full max-w-md">
        <Link to="/" className="flex items-center justify-center gap-3 mb-8">
          <img src="/logo.png" alt="CodeSphere" className="h-12 w-auto object-contain" />
          <span className="text-3xl font-bold">CodeSphere</span>
        </Link>

        <div className="glass rounded-3xl p-10 animate-slide-up">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold mb-2">{isLogin ? t('auth.welcome_back') : t('auth.create_account')}</h1>
            <p className="text-gray-400">{isLogin ? t('auth.sign_in_continue') : t('auth.start_journey')}</p>
          </div>

          <button
            className="w-full flex items-center justify-center gap-3 py-3.5 bg-white text-gray-800 rounded-xl font-medium hover:bg-gray-100 hover:-translate-y-0.5 transition-all mb-8 disabled:opacity-60"
            onClick={() => window.google?.accounts?.id?.prompt()}
            disabled={loading}
          >
            <svg viewBox="0 0 24 24" width="20" height="20">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Continue with Google
          </button>

          <div className="flex items-center gap-4 mb-8">
            <div className="flex-1 h-px bg-white bg-opacity-10"></div>
            <span className="text-sm text-gray-500">{t('auth.or')}</span>
            <div className="flex-1 h-px bg-white bg-opacity-10"></div>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <label htmlFor="email" className="text-sm font-medium text-gray-400">{t('auth.email')}</label>
              <div className="relative flex items-center">
                <FiMail className="absolute left-4 text-gray-500 text-lg" />
                <input
                  type="email"
                  id="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  className="w-full py-3.5 pl-12 pr-4 bg-cs-overlay bg-opacity-5 border border-cs-line border-opacity-15 rounded-xl text-cs-text text-base transition-all focus:border-cs-primary focus:shadow-[0_0_0_3px_rgb(var(--cs-primary)/0.15)] placeholder:text-cs-text-muted"
                />
              </div>
            </div>

            {!isLogin && (
              <div className="flex flex-col gap-2">
                <label htmlFor="username" className="text-sm font-medium text-gray-400">{t('auth.username')}</label>
                <div className="relative flex items-center">
                  <FiUser className="absolute left-4 text-gray-500 text-lg" />
                  <input
                    type="text"
                    id="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="coolcoder123"
                    className="w-full py-3.5 pl-12 pr-4 bg-cs-overlay bg-opacity-5 border border-cs-line border-opacity-15 rounded-xl text-cs-text text-base transition-all focus:border-cs-primary focus:shadow-[0_0_0_3px_rgb(var(--cs-primary)/0.15)] placeholder:text-cs-text-muted"
                  />
                </div>
              </div>
            )}

            <div className="flex flex-col gap-2">
              <label htmlFor="password" className="text-sm font-medium text-gray-400">{t('auth.password')}</label>
              <div className="relative flex items-center">
                <FiLock className="absolute left-4 text-gray-500 text-lg" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={6}
                  className="w-full py-3.5 pl-12 pr-12 bg-cs-overlay bg-opacity-5 border border-cs-line border-opacity-15 rounded-xl text-cs-text text-base transition-all focus:border-cs-primary focus:shadow-[0_0_0_3px_rgb(var(--cs-primary)/0.15)] placeholder:text-cs-text-muted"
                />
                <button
                  type="button"
                  className="absolute right-4 text-cs-text-muted hover:text-cs-text p-1"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <FiEyeOff /> : <FiEye />}
                </button>
              </div>
            </div>

            <button type="submit" className="btn btn-primary btn-lg w-full" disabled={loading}>
              {loading ? (
                <span className="w-5 h-5 border-2 border-t-transparent border-white rounded-full animate-spin"></span>
              ) : (
                isLogin ? t('auth.sign_in') : t('auth.create_account')
              )}
            </button>
          </form>

          <div className="text-center mt-6 pt-6 border-t border-white border-opacity-10">
            <p className="text-gray-400">
              {isLogin ? t('auth.no_account') : t('auth.has_account')}
              <button onClick={() => setIsLogin(!isLogin)} className="text-cs-primary font-semibold hover:text-cs-cyan">
                {isLogin ? t('auth.sign_up') : t('auth.sign_in')}
              </button>
            </p>
          </div>
        </div>

        <div className="flex justify-center gap-8 mt-8">
          {[t('auth.free_start'), t('auth.no_credit_card'), t('auth.learn_pace')].map((feature) => (
            <div key={feature} className="flex items-center gap-2 text-sm text-gray-500">
              <span className="text-cs-green font-bold">✓</span>
              {feature}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default Auth;
