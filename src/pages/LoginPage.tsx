import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuthStore, getRoleBasePath } from '../stores/authStore';
import { AuthLayout, startAuthPageTransition } from '../components/AuthLayout';
import { Eye, EyeOff, LogIn, AlertCircle, ArrowRight, Info, KeyRound } from 'lucide-react';

/**
 * One-click demo sign-in.
 *
 * Only the administrator is seeded (see src/mocks/data.ts): the firm opens on an
 * empty system, and the admin is the one who creates the attorney / secretary
 * accounts in Team Management. Clients create their own account from sign-up.
 */
const DEMO_ACCOUNTS = [
  { label: 'Administrator', email: 'admin@firm.com', accent: 'text-danger' },
];

export const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const { login, isLoading, error, clearError } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();

  /** Sends the user back to the page they were blocked from, when available. */
  const redirectAfterAuth = () => {
    const user = useAuthStore.getState().user;
    if (!user) return;

    const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname;
    navigate(from ?? `${getRoleBasePath(user.role)}/dashboard`);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setNotice(null);
    clearError();
    await login(email, password);
    redirectAfterAuth();
  };

  const quickLogin = async (demoEmail: string) => {
    setNotice(null);
    clearError();
    setEmail(demoEmail);
    setPassword('password123');
    await login(demoEmail, 'password123');
    redirectAfterAuth();
  };

  return (
    <AuthLayout
      direction="left"
      brandSide="left"
      badge="Secure client & firm access"
      title="Sign in to JurisFlow"
      subtitle="Access your cases, documents and AI-assisted consultations."
      footer={
        <>
          New to JurisFlow?{' '}
          <Link
            to="/signup"
            state={{ authPageTransition: true }}
            viewTransition
            onClick={() => startAuthPageTransition('forward')}
            className="group inline-flex items-center gap-1 font-semibold text-gold hover:text-gold-light transition-colors"
          >
            Create an account
            <ArrowRight size={14} className="auth-link-arrow" />
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="flex items-start gap-2 px-3.5 py-2.5 rounded-lg bg-danger/10 border border-danger/20 text-danger text-sm animate-fade-in">
            <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {notice && (
          <div className="flex items-start gap-2 px-3.5 py-2.5 rounded-lg bg-info/10 border border-info/20 text-info text-sm animate-fade-in">
            <Info size={16} className="mt-0.5 flex-shrink-0" />
            <span>{notice}</span>
          </div>
        )}

        <div>
          <label htmlFor="login-email" className="auth-label mb-1.5">
            Email address
          </label>
          <input
            id="login-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="you@firm.com"
            className="glass-input w-full px-3.5 py-2.5 text-sm"
            required
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label htmlFor="login-password" className="auth-label">
              Password
            </label>
            <button
              type="button"
              onClick={() =>
                setNotice('Password resets are handled by your firm administrator or IT support.')
              }
              className="flex items-center gap-1 text-xs text-text-muted hover:text-gold transition-colors"
            >
              <KeyRound size={12} />
              Forgot password?
            </button>
          </div>
          <div className="relative">
            <input
              id="login-password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Enter your password"
              className="glass-input w-full px-3.5 py-2.5 pr-11 text-sm"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(v => !v)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded text-text-muted hover:text-white transition-colors"
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        <label className="flex items-center gap-2.5 text-sm text-text-secondary cursor-pointer select-none">
          <input
            type="checkbox"
            checked={remember}
            onChange={e => setRemember(e.target.checked)}
            className="w-4 h-4 rounded border-white/20 bg-white/5 accent-gold cursor-pointer"
          />
          Keep me signed in on this device
        </label>

        <button
          type="submit"
          disabled={isLoading}
          className="btn-primary w-full py-2.5 sm:py-3 flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {isLoading ? (
            <>
              <div className="w-5 h-5 border-2 border-navy/30 border-t-navy rounded-full animate-spin" />
              Signing in…
            </>
          ) : (
            <>
              <LogIn size={18} />
              Sign In
            </>
          )}
        </button>
      </form>

      {/* Demo accounts */}
      <div className="auth-form-section">
        <div className="flex items-baseline justify-between gap-3 mb-2.5">
          <p className="text-[11px] text-text-muted uppercase tracking-widest font-semibold">
            Demo accounts
          </p>
          <p className="text-[10px] text-text-muted">One click signs you in</p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {DEMO_ACCOUNTS.map(account => (
            <button
              key={account.email}
              type="button"
              onClick={() => quickLogin(account.email)}
              disabled={isLoading}
              className="text-left px-2.5 py-1.5 rounded-lg glass-light border border-transparent hover:bg-white/10 hover:border-white/20 transition-all disabled:opacity-50"
            >
              <p className={`text-xs font-semibold ${account.accent}`}>{account.label}</p>
              <p className="text-[10px] text-text-muted truncate">{account.email}</p>
            </button>
          ))}
        </div>
      </div>
    </AuthLayout>
  );
};
