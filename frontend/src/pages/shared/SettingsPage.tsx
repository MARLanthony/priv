import React, { useEffect, useState } from 'react';
import { Bell, KeyRound, Palette, Save, ShieldCheck, UserRound } from 'lucide-react';
import {
  Button,
  Field,
  GlassCard,
  Input,
  PageHeader,
  PageLoader,
  Tabs,
  TextArea,
} from '../../components/UI';
import { changePassword, updateProfile } from '../../services';
import { toast, useAuthStore, useNotificationStore, useThemeStore } from '../../stores';
import { THEME_MODES } from '../../stores/themeStore';
import { ROLE_LABELS, type NotificationSettings } from '../../types';
import { formatDate } from '../../utils/format';
import { PASSWORD_RULES, passwordPolicyError } from '../../utils/passwordPolicy';
import { PermissionsPanel } from './PermissionsPanel';

/**
 * Settings.
 *
 * One page for every signed-in role: the profile card, the password form, the
 * notification preferences and the theme picker. Admins additionally get the
 * role → permission matrix (`PermissionsPanel`), the browser's copy of the
 * rules the Flask API enforces.
 */

const TABS = [
  { id: 'profile', label: 'Profile' },
  { id: 'security', label: 'Security' },
  { id: 'notifications', label: 'Notifications' },
  { id: 'appearance', label: 'Appearance' },
  { id: 'permissions', label: 'Roles & permissions' },
];

const NOTIFICATION_ROWS: { key: keyof NotificationSettings; label: string; hint: string }[] = [
  { key: 'email', label: 'Email', hint: 'Send a copy of every notification by e-mail.' },
  { key: 'inApp', label: 'In-app', hint: 'Show notifications in the navbar bell.' },
  { key: 'consultations', label: 'Consultations', hint: 'Intake requests and review decisions.' },
  { key: 'appointments', label: 'Appointments', hint: 'Bookings, moves and cancellations.' },
  { key: 'documents', label: 'Documents', hint: 'Uploads and review status changes.' },
];

export interface SettingsPageProps {
  title?: string;
  subtitle?: string;
  /** Shows the admin-only role matrix tab. */
  showPermissions?: boolean;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({
  title = 'Settings',
  subtitle = 'Your profile, security and preferences.',
  showPermissions = false,
}) => {
  const user = useAuthStore(state => state.user);
  const setUser = useAuthStore(state => state.setUser);
  const isAdmin = useAuthStore(state => state.hasRole('admin'));

  const theme = useThemeStore(state => state.theme);
  const setTheme = useThemeStore(state => state.setTheme);

  const notifications = useNotificationStore(state => state.settings);
  const fetchSettings = useNotificationStore(state => state.fetchSettings);
  const saveSettings = useNotificationStore(state => state.saveSettings);

  const [tab, setTab] = useState('profile');
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [savingNotifications, setSavingNotifications] = useState(false);

  const [name, setName] = useState(user?.name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [address, setAddress] = useState(user?.address ?? '');
  const [specialization, setSpecialization] = useState(user?.specialization ?? '');
  const [barNumber, setBarNumber] = useState(user?.barNumber ?? '');

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [prefs, setPrefs] = useState<NotificationSettings | null>(notifications);

  useEffect(() => {
    if (!user) return;
    setName(user.name);
    setEmail(user.email);
    setPhone(user.phone ?? '');
    setAddress(user.address ?? '');
    setSpecialization(user.specialization ?? '');
    setBarNumber(user.barNumber ?? '');
  }, [user]);

  useEffect(() => {
    void fetchSettings();
  }, [fetchSettings]);

  useEffect(() => {
    setPrefs(notifications);
  }, [notifications]);

  const saveProfile = async () => {
    if (!user) return;
    if (!name.trim() || !email.trim()) {
      toast.error('Name and email are required.');
      return;
    }

    setSavingProfile(true);
    try {
      const updated = await updateProfile({
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim() || undefined,
        address: address.trim() || undefined,
        specialization: specialization.trim() || undefined,
        barNumber: barNumber.trim() || undefined,
      });
      setUser(updated);
      toast.success('Profile saved.');
    } catch {
      toast.error('Could not save your profile.');
    } finally {
      setSavingProfile(false);
    }
  };

  const savePassword = async () => {
    const policyError = passwordPolicyError(newPassword);
    if (policyError) {
      toast.error(policyError);
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('The two passwords do not match.');
      return;
    }

    setSavingPassword(true);
    try {
      await changePassword({ currentPassword, newPassword });
      toast.success('Password updated.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch {
      toast.error('Could not change your password. Check the current one and try again.');
    } finally {
      setSavingPassword(false);
    }
  };

  const togglePreference = (key: keyof NotificationSettings) => {
    setPrefs(current => {
      const base: NotificationSettings = current ?? {
        email: true,
        inApp: true,
        consultations: true,
        appointments: true,
        documents: true,
      };
      return { ...base, [key]: !base[key] };
    });
  };

  const persistPreferences = async () => {
    if (!prefs) return;
    setSavingNotifications(true);
    try {
      await saveSettings(prefs);
      toast.success('Notification preferences saved.');
    } catch {
      toast.error('Could not save the notification preferences.');
    } finally {
      setSavingNotifications(false);
    }
  };

  if (!user) return <PageLoader label="Loading your settings…" />;

  const tabs = showPermissions && isAdmin ? TABS : TABS.filter(entry => entry.id !== 'permissions');

  return (
    <div className="space-y-6">
      <PageHeader title={title} subtitle={subtitle} />

      <Tabs tabs={tabs} active={tab} onChange={setTab} />

      {tab === 'profile' ? (
        <GlassCard className="space-y-5 max-w-3xl">
          <div className="flex items-center gap-3">
            <span className="w-11 h-11 rounded-xl bg-gold/10 text-gold flex items-center justify-center">
              <UserRound size={20} />
            </span>
            <div>
              <p className="text-white font-semibold">{user.name}</p>
              <p className="text-xs text-text-muted">
                {ROLE_LABELS[user.role]} · joined {formatDate(user.createdAt)}
              </p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Full name" required>
              <Input value={name} onChange={event => setName(event.target.value)} />
            </Field>
            <Field label="Email" required>
              <Input type="email" value={email} onChange={event => setEmail(event.target.value)} />
            </Field>
            <Field label="Phone">
              <Input value={phone} onChange={event => setPhone(event.target.value)} />
            </Field>
            {user.role === 'lawyer' ? (
              <Field label="Specialisation">
                <Input
                  value={specialization}
                  onChange={event => setSpecialization(event.target.value)}
                  placeholder="e.g. Family Law"
                />
              </Field>
            ) : null}
            {user.role === 'lawyer' ? (
              <Field label="Bar number">
                <Input
                  value={barNumber}
                  onChange={event => setBarNumber(event.target.value)}
                />
              </Field>
            ) : null}
          </div>

          <Field label="Address">
            <TextArea rows={2} value={address} onChange={event => setAddress(event.target.value)} />
          </Field>

          <div className="flex justify-end">
            <Button onClick={() => void saveProfile()} loading={savingProfile}>
              <Save size={16} />
              Save changes
            </Button>
          </div>
        </GlassCard>
      ) : null}

      {tab === 'security' ? (
        <GlassCard className="space-y-5 max-w-2xl">
          <div className="flex items-center gap-3">
            <span className="w-11 h-11 rounded-xl bg-gold/10 text-gold flex items-center justify-center">
              <KeyRound size={20} />
            </span>
            <p className="text-sm text-text-secondary">
              Passwords are hashed server-side and never leave the API in clear text.
            </p>
          </div>

          <Field label="Current password" required>
            <Input
              type="password"
              value={currentPassword}
              onChange={event => setCurrentPassword(event.target.value)}
              autoComplete="current-password"
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="New password" required>
              <Input
                type="password"
                value={newPassword}
                onChange={event => setNewPassword(event.target.value)}
                autoComplete="new-password"
              />
            </Field>
            <Field label="Confirm new password" required>
              <Input
                type="password"
                value={confirmPassword}
                onChange={event => setConfirmPassword(event.target.value)}
                autoComplete="new-password"
              />
            </Field>
          </div>

          <ul className="space-y-1.5">
            {PASSWORD_RULES.map(rule => {
              const passed = rule.test(newPassword);
              return (
                <li
                  key={rule.id}
                  className={`text-xs ${passed ? 'text-success' : 'text-text-muted'}`}
                >
                  {passed ? '✓' : '•'} {rule.label}
                </li>
              );
            })}
          </ul>

          <div className="flex justify-end">
            <Button
              onClick={() => void savePassword()}
              loading={savingPassword}
              disabled={!currentPassword || !newPassword}
            >
              Update password
            </Button>
          </div>
        </GlassCard>
      ) : null}

      {tab === 'notifications' ? (
        <GlassCard className="space-y-5 max-w-2xl">
          <div className="flex items-center gap-3">
            <span className="w-11 h-11 rounded-xl bg-gold/10 text-gold flex items-center justify-center">
              <Bell size={20} />
            </span>
            <p className="text-sm text-text-secondary">
              Choose what the firm tells you about. Critical security mail is always delivered.
            </p>
          </div>

          <div className="space-y-2.5">
            {NOTIFICATION_ROWS.map(row => {
              const checked = prefs ? prefs[row.key] : true;
              return (
                <label
                  key={String(row.key)}
                  className="flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-white/5 px-3.5 py-3 cursor-pointer"
                >
                  <span className="min-w-0">
                    <span className="block text-sm text-white">{row.label}</span>
                    <span className="block text-[11px] text-text-muted">{row.hint}</span>
                  </span>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => togglePreference(row.key)}
                    className="w-4 h-4 accent-gold flex-shrink-0"
                  />
                </label>
              );
            })}
          </div>

          <div className="flex justify-end">
            <Button onClick={() => void persistPreferences()} loading={savingNotifications}>
              <Save size={16} />
              Save preferences
            </Button>
          </div>
        </GlassCard>
      ) : null}

      {tab === 'appearance' ? (
        <div className="grid gap-4 md:grid-cols-3">
          {THEME_MODES.map(mode => (
            <GlassCard
              key={mode.value}
              hover
              onClick={() => setTheme(mode.value)}
              className={`space-y-2 cursor-pointer border ${
                theme === mode.value ? 'border-gold/40' : 'border-white/10'
              }`}
            >
              <span className="inline-flex items-center gap-2 text-white font-medium">
                <Palette size={16} className="text-gold" />
                {mode.label}
                {theme === mode.value ? <span className="text-[11px] text-gold">Active</span> : null}
              </span>
              <p className="text-xs text-text-secondary">{mode.description}</p>
            </GlassCard>
          ))}
        </div>
      ) : null}

      {tab === 'permissions' && showPermissions && isAdmin ? (
        <GlassCard className="space-y-5">
          <div className="flex items-center gap-3">
            <span className="w-11 h-11 rounded-xl bg-gold/10 text-gold flex items-center justify-center">
              <ShieldCheck size={20} />
            </span>
            <p className="text-sm text-text-secondary">
              The same matrix the Flask API enforces. Changes apply to new requests immediately.
            </p>
          </div>
          <PermissionsPanel />
        </GlassCard>
      ) : null}
    </div>
  );
};

export default SettingsPage;
