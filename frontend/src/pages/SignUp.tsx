import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertCircle, ArrowLeft, Check, Lock, Mail, MapPin, Phone, User as UserIcon, X } from 'lucide-react';
import { AuthLayout, startAuthPageTransition } from '../components/AuthLayout';
import { Button, Field, Input } from '../components/UI';
import { useAuthStore } from '../stores/authStore';
import { roleHome } from '../utils/navigation';
import { PASSWORD_RULES, isPasswordReady, passwordPolicyError } from '../utils/passwordPolicy';

/**
 * Client self-service registration.
 *
 * Only clients may create their own account — every other role is provisioned
 * from Team Management by the admin (`POST /users`). The password rules come
 * from `utils/passwordPolicy.ts`, the same module the API validates against, so
 * the checklist under the field can never disagree with the server.
 */
export const SignUp: React.FC = () => {
  const navigate = useNavigate();
  const register = useAuthStore(state => state.register);
  const status = useAuthStore(state => state.status);
  const error = useAuthStore(state => state.error);
  const clearError = useAuthStore(state => state.clearError);

  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    password: '',
    confirm: '',
  });
  const [touched, setTouched] = useState(false);

  const busy = status === 'loading';
  const set = (key: keyof typeof form) => (value: string) =>
    setForm(current => ({ ...current, [key]: value }));

  const passwordError = useMemo(() => passwordPolicyError(form.password), [form.password]);
  const mismatch = form.confirm.length > 0 && form.confirm !== form.password;
  const canSubmit =
    form.name.trim().length > 1 &&
    form.email.trim().length > 3 &&
    isPasswordReady(form.password) &&
    form.confirm === form.password;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setTouched(true);
    clearError();
    if (!canSubmit) return;

    try {
      const user = await register({
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
        phone: form.phone.trim() || undefined,
        address: form.address.trim() || undefined,
      });
      navigate(roleHome(user.role), { replace: true });
    } catch {
      /* the store holds the message; the form renders it below */
    }
  };

  return (
    <AuthLayout
      badge="Client portal"
      title="Create your account"
      subtitle="Register once, then track your matter, files and appointments in one place."
      direction="right"
      brandSide="left"
      footer={
        <p className="text-xs text-text-muted">
          Already registered?{' '}
          <Link
            to="/login"
            state={{ authPageTransition: true }}
            onClick={() => startAuthPageTransition('backward')}
            className="inline-flex items-center gap-1 text-gold font-medium hover:text-gold-light transition-colors"
          >
            <ArrowLeft size={12} className="auth-link-arrow" />
            Sign in instead
          </Link>
        </p>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <Field label="Full name" required>
          <div className="relative">
            <UserIcon size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <Input
              required
              autoComplete="name"
              value={form.name}
              onChange={event => set('name')(event.target.value)}
              placeholder="Chidi Eze"
              className="pl-9"
            />
          </div>
        </Field>

        <Field label="Email address" required>
          <div className="relative">
            <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <Input
              type="email"
              required
              autoComplete="email"
              value={form.email}
              onChange={event => set('email')(event.target.value)}
              placeholder="you@example.com"
              className="pl-9"
            />
          </div>
        </Field>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Phone">
            <div className="relative">
              <Phone size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
              <Input
                type="tel"
                autoComplete="tel"
                value={form.phone}
                onChange={event => set('phone')(event.target.value)}
                placeholder="+233 20 000 0000"
                className="pl-9"
              />
            </div>
          </Field>

          <Field label="Address">
            <div className="relative">
              <MapPin size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
              <Input
                autoComplete="street-address"
                value={form.address}
                onChange={event => set('address')(event.target.value)}
                placeholder="12 Ring Road, Accra"
                className="pl-9"
              />
            </div>
          </Field>
        </div>

        <Field label="Password" required>
          <div className="relative">
            <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <Input
              type="password"
              required
              autoComplete="new-password"
              value={form.password}
              onChange={event => set('password')(event.target.value)}
              placeholder="••••••••"
              className="pl-9"
            />
          </div>
        </Field>

        <ul className="grid grid-cols-2 gap-1.5" aria-label="Password requirements">
          {PASSWORD_RULES.map(rule => {
            const passed = rule.test(form.password);
            return (
              <li
                key={rule.id}
                className={`flex items-center gap-1.5 text-[11px] ${
                  passed ? 'text-success' : 'text-text-muted'
                }`}
              >
                {passed ? <Check size={12} /> : <X size={12} />}
                {rule.label}
              </li>
            );
          })}
        </ul>

        <Field
          label="Confirm password"
          required
          hint={mismatch ? 'The two passwords do not match.' : undefined}
        >
          <div className="relative">
            <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <Input
              type="password"
              required
              autoComplete="new-password"
              value={form.confirm}
              onChange={event => set('confirm')(event.target.value)}
              placeholder="••••••••"
              className="pl-9"
            />
          </div>
        </Field>

        {(error || (touched && passwordError)) && (
          <p className="flex items-start gap-2 text-xs text-danger bg-danger/10 border border-danger/25 rounded-lg px-3 py-2">
            <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
            {error ?? passwordError}
          </p>
        )}

        <Button type="submit" fullWidth loading={busy}>
          {busy ? 'Creating your account…' : 'Create account'}
        </Button>

        <p className="text-[11px] text-text-muted leading-relaxed">
          By registering you agree that the firm may store your details to process your request. Your
          information is only visible to the legal team handling your matter.
        </p>
      </form>
    </AuthLayout>
  );
};

export default SignUp;

