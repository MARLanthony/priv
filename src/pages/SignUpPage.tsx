import React, { useMemo, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { AuthLayout, startAuthPageTransition } from '../components/AuthLayout';
import { AlertCircle, ArrowRight, Check, Eye, EyeOff, UserPlus, X } from 'lucide-react';
import { HAS_SYMBOL, PASSWORD_RULES, passwordPolicyError } from '../utils/passwordPolicy';

/** Client-side validation shared by the fields and the submit handler. */
export interface SignUpForm {
  name: string;
  email: string;
  phone: string;
  password: string;
  confirm: string;
  accepted: boolean;
}

export type SignUpErrors = Partial<Record<keyof SignUpForm, string>>;

export function validateSignUpForm(form: SignUpForm): SignUpErrors {
  const errors: SignUpErrors = {};

  if (form.name.trim().length < 2) errors.name = 'Please enter your full name.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) errors.email = 'Enter a valid email address.';
  if (form.phone.trim() && !/^[\d\s()+-]{7,}$/.test(form.phone.trim())) errors.phone = 'Enter a valid phone number.';
  // Self-registration policy: 8+ characters with a letter, a number and a
  // special character (shared with the mock API — see utils/passwordPolicy).
  const passwordError = passwordPolicyError(form.password);
  if (passwordError) errors.password = passwordError;
  if (form.confirm !== form.password) errors.confirm = 'Passwords do not match.';
  if (!form.accepted) errors.accepted = 'Please accept the terms to continue.';

  return errors;
}

/** 0-4 strength score plus a readable label, used by the meter. */
export function passwordStrength(password: string): { score: number; label: string; bar: string; text: string } {
  // Below the 8-character minimum the label is unambiguous.
  if (password.length === 0) {
    return { score: 0, label: 'Too short', bar: 'bg-white/20', text: 'text-text-muted' };
  }
  if (password.length < 8) {
    return { score: 1, label: 'Too short', bar: 'bg-danger', text: 'text-danger' };
  }

  let score = 1;
  if (password.length >= 12) score += 1;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score += 1;
  if (/\d/.test(password) && HAS_SYMBOL.test(password)) score += 1;

  const levels = [
    { label: 'Weak', bar: 'bg-danger', text: 'text-danger' },
    { label: 'Weak', bar: 'bg-danger', text: 'text-danger' },
    { label: 'Fair', bar: 'bg-warning', text: 'text-warning' },
    { label: 'Good', bar: 'bg-info', text: 'text-info' },
    { label: 'Strong', bar: 'bg-success', text: 'text-success' },
  ];

  return { score, ...levels[Math.min(4, score)] };
}

export const SignUpPage: React.FC = () => {
  const [form, setForm] = useState<SignUpForm>({
    name: '',
    email: '',
    phone: '',
    password: '',
    confirm: '',
    accepted: false,
  });
  const [touched, setTouched] = useState<Partial<Record<keyof SignUpForm, boolean>>>({});
  const [showPassword, setShowPassword] = useState(false);
  const { register, isLoading, error, clearError } = useAuthStore();
  const navigate = useNavigate();

  const errors = useMemo(() => validateSignUpForm(form), [form]);
  const strength = passwordStrength(form.password);

  const update = <K extends keyof SignUpForm>(key: K, value: SignUpForm[K]) =>
    setForm(prev => ({ ...prev, [key]: value }));

  const fieldError = (key: keyof SignUpForm): string | undefined => (touched[key] ? errors[key] : undefined);
  const markTouched = (key: keyof SignUpForm) => setTouched(prev => ({ ...prev, [key]: true }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();

    if (Object.keys(errors).length > 0) {
      setTouched(Object.fromEntries(Object.keys(errors).map(key => [key, true])));
      return;
    }

    await register({
      name: form.name.trim(),
      email: form.email.trim().toLowerCase(),
      password: form.password,
      phone: form.phone.trim() || undefined,
    });

    if (useAuthStore.getState().user) {
      navigate('/user/dashboard');
    }
  };

  return (
    <AuthLayout
      direction="right"
      brandSide="right"
      badge="Create your client account"
      title="Join JurisFlow"
      subtitle="Set up a secure account to describe your matter and reach the right attorney."
      footer={
        <>
          Already have an account?{' '}
          <Link
            to="/login"
            state={{ authPageTransition: true }}
            viewTransition
            onClick={() => startAuthPageTransition('backward')}
            className="group inline-flex items-center gap-1 font-semibold text-gold hover:text-gold-light transition-colors"
          >
            Sign in
            <ArrowRight size={14} className="auth-link-arrow" />
          </Link>
          {/* Staff note lives outside the card so the dialog stays short */}
          <p className="mt-2 text-[11px] text-text-muted leading-relaxed">
            Attorney, secretary or administrator? Those accounts are provisioned by your firm
            administrator.
          </p>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {error && (
          <div className="flex items-start gap-2 px-3.5 py-2.5 rounded-lg bg-danger/10 border border-danger/20 text-danger text-sm animate-fade-in">
            <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div>
          <label htmlFor="signup-name" className="auth-label mb-1.5">
            Full name
          </label>
          <input
            id="signup-name"
            type="text"
            autoComplete="name"
            value={form.name}
            onChange={e => update('name', e.target.value)}
            onBlur={() => markTouched('name')}
            placeholder="Jane Cooper"
            className={`glass-input w-full px-3.5 py-2.5 text-sm ${fieldError('name') ? 'border-danger/60' : ''}`}
          />
          {fieldError('name') && <p className="text-[11px] text-danger mt-1.5">{fieldError('name')}</p>}
        </div>

        {/* Two-up field row, mirroring the reference's compact form grid */}
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label htmlFor="signup-email" className="auth-label mb-1.5">
              Email address
            </label>
            <input
              id="signup-email"
              type="email"
              autoComplete="email"
              value={form.email}
              onChange={e => update('email', e.target.value)}
              onBlur={() => markTouched('email')}
              placeholder="you@email.com"
              className={`glass-input w-full px-3.5 py-2.5 text-sm ${fieldError('email') ? 'border-danger/60' : ''}`}
            />
            {fieldError('email') && <p className="text-[11px] text-danger mt-1.5">{fieldError('email')}</p>}
          </div>

          <div>
            <label htmlFor="signup-phone" className="auth-label mb-1.5">
              Phone <span className="text-text-muted font-normal">(optional)</span>
            </label>
            <input
              id="signup-phone"
              type="tel"
              autoComplete="tel"
              value={form.phone}
              onChange={e => update('phone', e.target.value)}
              onBlur={() => markTouched('phone')}
              placeholder="(555) 000-0000"
              className={`glass-input w-full px-3.5 py-2.5 text-sm ${fieldError('phone') ? 'border-danger/60' : ''}`}
            />
            {fieldError('phone') && <p className="text-[11px] text-danger mt-1.5">{fieldError('phone')}</p>}
          </div>
        </div>

        <div>
          <label htmlFor="signup-password" className="auth-label mb-1.5">
            Password
          </label>
          <div className="relative">
            <input
              id="signup-password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              value={form.password}
              onChange={e => update('password', e.target.value)}
              onBlur={() => markTouched('password')}
              placeholder="At least 8 characters"
              aria-describedby="signup-password-rules"
              className={`glass-input w-full px-3.5 py-2.5 pr-11 text-sm ${fieldError('password') ? 'border-danger/60' : ''}`}
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

          {/* Strength meter */}
          <div className="flex items-center gap-2 mt-2">
            <div className="flex-1 flex gap-1">
              {[1, 2, 3, 4].map(step => (
                <span
                  key={step}
                  className={`h-1 flex-1 rounded-full transition-colors duration-300 ${
                    step <= strength.score ? strength.bar : 'bg-white/10'
                  }`}
                />
              ))}
            </div>
            <span className={`text-[10px] font-medium ${strength.text}`}>{strength.label}</span>
          </div>

          {/* Live requirement checklist — driven by PASSWORD_RULES, so the hint
              can never drift from what validateSignUpForm enforces */}
          <ul id="signup-password-rules" className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1">
            {PASSWORD_RULES.map(rule => {
              const met = rule.test(form.password);
              return (
                <li
                  key={rule.id}
                  className={`flex items-center gap-1.5 text-[10px] leading-tight ${
                    met ? 'text-success' : 'text-text-muted'
                  }`}
                >
                  {met ? (
                    <Check size={11} className="flex-shrink-0" />
                  ) : (
                    <X size={11} className="flex-shrink-0 opacity-60" />
                  )}
                  {rule.label}
                </li>
              );
            })}
          </ul>
          {fieldError('password') && <p className="text-[11px] text-danger mt-1.5">{fieldError('password')}</p>}
        </div>

        <div>
          <label htmlFor="signup-confirm" className="auth-label mb-1.5">
            Confirm password
          </label>
          <input
            id="signup-confirm"
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            value={form.confirm}
            onChange={e => update('confirm', e.target.value)}
            onBlur={() => markTouched('confirm')}
            placeholder="Re-enter your password"
            className={`glass-input w-full px-3.5 py-2.5 text-sm ${fieldError('confirm') ? 'border-danger/60' : ''}`}
          />
          {fieldError('confirm') && <p className="text-[11px] text-danger mt-1.5">{fieldError('confirm')}</p>}
        </div>

        <div>
          <label className="flex items-start gap-2.5 text-xs text-text-secondary cursor-pointer select-none">
            <input
              type="checkbox"
              checked={form.accepted}
              onChange={e => update('accepted', e.target.checked)}
              onBlur={() => markTouched('accepted')}
              className="mt-0.5 w-4 h-4 rounded border-white/20 bg-white/5 accent-gold cursor-pointer"
            />
            <span>
              I agree to the terms of service and privacy policy, and consent to JurisFlow storing my
              matter details securely.
            </span>
          </label>
          {fieldError('accepted') && <p className="text-[11px] text-danger mt-1.5">{fieldError('accepted')}</p>}
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="btn-primary w-full py-2.5 sm:py-3 flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {isLoading ? (
            <>
              <div className="w-5 h-5 border-2 border-navy/30 border-t-navy rounded-full animate-spin" />
              Creating your account…
            </>
          ) : (
            <>
              <UserPlus size={18} />
              Create Account
            </>
          )}
        </button>
      </form>
    </AuthLayout>
  );
};