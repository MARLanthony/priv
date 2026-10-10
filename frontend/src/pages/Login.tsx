import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AlertCircle, ArrowRight, KeyRound, Mail } from 'lucide-react';
import { AuthLayout, startAuthPageTransition } from '../components/AuthLayout';
import { Button, Field, Input } from '../components/UI';
import { useAuthStore } from '../stores/authStore';
import { roleHome } from '../utils/navigation';
import { DEMO_PASSWORD, demoAccountsFor } from '../utils/demo';

interface LocationState {
  from?: { pathname?: string };
}

/** Sign-in screen. Demo accounts are one click away (see `utils/demo`). */
export const Login: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const login = useAuthStore(state => state.login);
  const status = useAuthStore(state => state.status);
  const error = useAuthStore(state => state.error);
  const clearError = useAuthStore(state => state.clearError);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const busy = status === 'loading';
  const redirectTo = (location.state as LocationState | null)?.from?.pathname;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    clearError();
    try {
      const user = await login({ email: email.trim(), password });
      navigate(redirectTo ?? roleHome(user.role), { replace: true });
    } catch {
      /* the store holds the message; the form renders it below */
    }
  };

  const fillDemo = (demoEmail: string) => {
    clearError();
    setEmail(demoEmail);
    setPassword(DEMO_PASSWORD);
  };

  return (
    <AuthLayout
      badge="Welcome back"
      title="Sign in to JurisFlow"
      subtitle="One workspace for the firm, one portal for your clients."
      direction="left"
      brandSide="right"
      footer={
        <p className="text-xs text-text-muted">
          New client?{' '}
          <Link
            to="/signup"
            state={{ authPageTransition: true }}
            onClick={() => startAuthPageTransition('forward')}
            className="inline-flex items-center gap-1 text-gold font-medium hover:text-gold-light transition-colors"
          >
            Create an account
            <ArrowRight size={12} className="auth-link-arrow" />
          </Link>
        </p>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <Field label="Email address" required>
          <div className="relative">
            <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <Input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={event => setEmail(event.target.value)}
              placeholder="you@firm.com"
              className="pl-9"
            />
          </div>
        </Field>

        <Field label="Password" required>
          <div className="relative">
            <KeyRound size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <Input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={event => setPassword(event.target.value)}
              placeholder="••••••••"
              className="pl-9"
            />
          </div>
        </Field>

        {error && (
          <p className="flex items-start gap-2 text-xs text-danger bg-danger/10 border border-danger/25 rounded-lg px-3 py-2">
            <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
            {error}
          </p>
        )}

        <Button type="submit" fullWidth loading={busy} icon={ArrowRight}>
          {busy ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>

      <div className="auth-form-section mt-6">
        <p className="text-[11px] uppercase tracking-wide text-text-muted mb-3">
          Demo accounts · password {DEMO_PASSWORD}
        </p>
        <div className="grid grid-cols-2 gap-2">
          {demoAccountsFor().map(account => (
            <button
              key={account.email}
              type="button"
              onClick={() => fillDemo(account.email)}
              className="text-left rounded-xl border border-white/10 bg-white/[0.02] hover:border-gold/40 hover:bg-gold/5 transition-colors px-3 py-2"
            >
              <span className="block text-[11px] font-medium text-white">{account.label}</span>
              <span className="block text-[10px] text-text-muted truncate">{account.email}</span>
            </button>
          ))}
        </div>
      </div>
    </AuthLayout>
  );
};

export default Login;
