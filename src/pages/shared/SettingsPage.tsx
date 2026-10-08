import React, { useState } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { THEME_MODES, useThemeStore } from '../../stores/themeStore';
import { useAiKeyStore } from '../../stores/aiKeyStore';
import { maskApiKey, type ApiKeySource } from '../../ai';
import { PageHeader, GlassCard } from '../../components/UI';
import { User, Lock, Bell, Shield, Save, Palette, Check, Sparkles, Eye, EyeOff, Trash2 } from 'lucide-react';

/** Fixed preview colours so each swatch reads correctly regardless of the active theme. */
const PREVIEW_BAR: Record<string, string> = {
  normal: 'rgba(255,255,255,0.28)',
  dark: 'rgba(255,255,255,0.22)',
  light: 'rgba(15,26,46,0.22)',
};

/**
 * Settings → AI engine panel.
 *
 * Presentational on purpose: the store wiring stays in the page below, which
 * also lets the verification suite render both states (live key / demo data)
 * directly — during server rendering zustand hands out the *initial* state, so
 * an SSR test can never observe a state change.
 */
export interface AiKeyPanelProps {
  /** The device copy exactly as saved ('' when there is none). */
  storedKey: string;
  /** The key used for requests (device copy, else `.env`). */
  apiKey: string;
  /** Where `apiKey` came from. */
  source: ApiKeySource;
  isConfigured: boolean;
  onSave: (key: string) => void;
  onClear: () => void;
}

export const AiKeyPanel: React.FC<AiKeyPanelProps> = ({
  storedKey,
  apiKey,
  source,
  isConfigured,
  onSave,
  onClear,
}) => {
  const [draft, setDraft] = useState('');
  const [reveal, setReveal] = useState(false);

  const saveDraft = () => {
    if (!draft.trim()) return;
    onSave(draft);
    setDraft('');
  };

  return (
    <>
      <div className="flex items-center gap-3 mb-1">
        <Sparkles size={20} className="text-gold" />
        <h3 className="text-lg font-semibold text-white">AI engine</h3>
        <span
          className={`ml-auto text-[11px] font-semibold px-2.5 py-1 rounded-full border ${
            isConfigured
              ? 'text-success bg-success/10 border-success/20'
              : 'text-warning bg-warning/10 border-warning/20'
          }`}
        >
          {isConfigured ? 'Live AI' : 'Demo data'}
        </span>
      </div>
      <p className="text-xs text-text-muted mb-5">
        OpenRouter powers intake analysis, document review and client replies. Paste your key once —
        it is stored in this browser, so it keeps working if <code>.env</code> is removed, reverted
        or the project is re-cloned.
      </p>

      {isConfigured && (
        <p className="text-xs text-text-secondary mb-3">
          Active key <span className="font-mono text-gold">{maskApiKey(apiKey)}</span>{' '}
          <span className="text-text-muted">
            {source === 'device' ? '· saved on this device' : '· loaded from .env'}
          </span>
        </p>
      )}

      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <input
            id="settings-ai-key"
            type={reveal ? 'text' : 'password'}
            value={draft}
            onChange={e => setDraft(e.target.value)}
            placeholder="sk-or-v1-..."
            autoComplete="off"
            spellCheck={false}
            aria-label="OpenRouter API key"
            className="glass-input w-full px-4 py-2.5 pr-10 text-sm font-mono"
          />
          <button
            type="button"
            onClick={() => setReveal(v => !v)}
            aria-label={reveal ? 'Hide API key' : 'Show API key'}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded text-text-muted hover:text-white transition-colors"
          >
            {reveal ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
        </div>

        <button
          type="button"
          onClick={saveDraft}
          disabled={!draft.trim()}
          className="btn-primary flex items-center justify-center gap-2 disabled:opacity-50"
        >
          <Save size={14} /> Save key
        </button>

        {storedKey && (
          <button
            type="button"
            onClick={onClear}
            className="btn-secondary flex items-center justify-center gap-2"
          >
            <Trash2 size={14} /> Forget
          </button>
        )}
      </div>

      <p className="text-xs text-text-muted mt-3">
        {isConfigured
          ? 'Nothing else to do — the AI features call the live models now.'
          : 'Without a key the AI features answer from bundled sample data. Get a free key at openrouter.ai/keys.'}
      </p>
    </>
  );
};

interface SettingsPageProps {
  isAdmin?: boolean;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({ isAdmin = false }) => {
  const { user } = useAuthStore();
  const { theme, setTheme } = useThemeStore();
  const [profile, setProfile] = useState({ name: user?.name || '', email: user?.email || '', phone: user?.phone || '' });
  const [passwords, setPasswords] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [saved, setSaved] = useState(false);
  const { storedKey, apiKey, source, isConfigured, saveKey, clearKey } = useAiKeyStore();

  /** Stores the pasted key on this device and applies it without a rebuild. */
  const handleSaveKey = (key: string) => {
    saveKey(key);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const handleSaveProfile = async () => {
    await fetch('/api/users/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(profile),
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const handleChangePassword = async () => {
    if (passwords.newPassword !== passwords.confirmPassword) return;
    await fetch('/api/users/password', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword: passwords.currentPassword, newPassword: passwords.newPassword }),
    });
    setPasswords({ currentPassword: '', newPassword: '', confirmPassword: '' });
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="animate-fade-in">
      <PageHeader title={isAdmin ? 'System Settings' : 'Settings'} subtitle="Manage your account and preferences" />

      {saved && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-success/10 border border-success/20 text-success text-sm animate-fade-in">
          ✓ Changes saved successfully
        </div>
      )}

      {/* AI engine — the key is kept on this device so a lost .env can't break it */}
      <GlassCard className="mb-6">
        <AiKeyPanel
          storedKey={storedKey}
          apiKey={apiKey}
          source={source}
          isConfigured={isConfigured}
          onSave={handleSaveKey}
          onClear={clearKey}
        />
      </GlassCard>

      {/* Appearance — the only place the theme can be changed */}
      <GlassCard className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <Palette size={20} className="text-gold" />
          <h3 className="text-lg font-semibold text-white">Appearance</h3>
        </div>
        <p className="text-xs text-text-muted mb-5">
          Choose how JurisFlow looks on this device. Your selection is saved and applied instantly.
        </p>

        <div className="grid sm:grid-cols-3 gap-3">
          {THEME_MODES.map(mode => {
            const active = theme === mode.value;

            return (
              <button
                key={mode.value}
                type="button"
                onClick={() => setTheme(mode.value)}
                aria-pressed={active}
                aria-label={`${mode.label} theme`}
                className={`text-left p-3 rounded-xl border transition-all ${
                  active
                    ? 'border-gold/60 bg-gold/10 shadow-[0_0_0_1px_rgba(201,168,76,0.35)]'
                    : 'border-white/10 bg-white/3 hover:bg-white/8 hover:border-white/20'
                }`}
              >
                <div className={`theme-preview theme-preview-${mode.value} mb-3 relative`}>
                  <span
                    className="absolute left-2.5 top-2.5 w-9 h-2 rounded-full"
                    style={{ background: PREVIEW_BAR[mode.value] }}
                  />
                  <span
                    className="absolute left-2.5 top-6 w-16 h-1.5 rounded-full"
                    style={{ background: PREVIEW_BAR[mode.value] }}
                  />
                  <span className="absolute right-2.5 top-6 w-7 h-7 rounded-md bg-gold/70 border border-gold/50" />
                </div>

                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-white">{mode.label}</span>
                  {active && (
                    <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-gold">
                      <Check size={13} />
                      Active
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-text-muted mt-1 leading-relaxed">{mode.description}</p>
              </button>
            );
          })}
        </div>
      </GlassCard>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Profile */}
        <GlassCard>
          <div className="flex items-center gap-3 mb-6">
            <User size={20} className="text-gold" />
            <h3 className="text-lg font-semibold text-white">Profile Information</h3>
          </div>
          <div className="space-y-4">
            <div>
              <label className="text-sm text-text-secondary block mb-1">Full Name</label>
              <input value={profile.name} onChange={e => setProfile({...profile, name: e.target.value})} className="glass-input w-full px-4 py-2.5 text-sm" />
            </div>
            <div>
              <label className="text-sm text-text-secondary block mb-1">Email Address</label>
              <input value={profile.email} onChange={e => setProfile({...profile, email: e.target.value})} className="glass-input w-full px-4 py-2.5 text-sm" />
            </div>
            <div>
              <label className="text-sm text-text-secondary block mb-1">Phone Number</label>
              <input value={profile.phone} onChange={e => setProfile({...profile, phone: e.target.value})} className="glass-input w-full px-4 py-2.5 text-sm" />
            </div>
            <button onClick={handleSaveProfile} className="btn-primary flex items-center gap-2">
              <Save size={14} /> Save Changes
            </button>
          </div>
        </GlassCard>

        {/* Password */}
        <GlassCard>
          <div className="flex items-center gap-3 mb-6">
            <Lock size={20} className="text-gold" />
            <h3 className="text-lg font-semibold text-white">Change Password</h3>
          </div>
          <div className="space-y-4">
            <div>
              <label className="text-sm text-text-secondary block mb-1">Current Password</label>
              <input type="password" value={passwords.currentPassword} onChange={e => setPasswords({...passwords, currentPassword: e.target.value})} className="glass-input w-full px-4 py-2.5 text-sm" />
            </div>
            <div>
              <label className="text-sm text-text-secondary block mb-1">New Password</label>
              <input type="password" value={passwords.newPassword} onChange={e => setPasswords({...passwords, newPassword: e.target.value})} className="glass-input w-full px-4 py-2.5 text-sm" />
            </div>
            <div>
              <label className="text-sm text-text-secondary block mb-1">Confirm New Password</label>
              <input type="password" value={passwords.confirmPassword} onChange={e => setPasswords({...passwords, confirmPassword: e.target.value})} className="glass-input w-full px-4 py-2.5 text-sm" />
            </div>
            <button onClick={handleChangePassword} className="btn-primary flex items-center gap-2">
              <Lock size={14} /> Update Password
            </button>
          </div>
        </GlassCard>

        {isAdmin && (
          <>
            {/* Notifications */}
            <GlassCard>
              <div className="flex items-center gap-3 mb-6">
                <Bell size={20} className="text-gold" />
                <h3 className="text-lg font-semibold text-white">Notification Preferences</h3>
              </div>
              <div className="space-y-4">
                {['Email notifications', 'Case updates', 'New appointments', 'System alerts'].map(pref => (
                  <div key={pref} className="flex items-center justify-between">
                    <span className="text-sm text-text-secondary">{pref}</span>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" defaultChecked className="sr-only peer" />
                      <div className="w-10 h-5 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-gold/50" />
                    </label>
                  </div>
                ))}
              </div>
            </GlassCard>

            {/* Security */}
            <GlassCard>
              <div className="flex items-center gap-3 mb-6">
                <Shield size={20} className="text-gold" />
                <h3 className="text-lg font-semibold text-white">Security Settings</h3>
              </div>
              <div className="space-y-4">
                {['Two-factor authentication', 'Session timeout (30 min)', 'Login notifications', 'IP whitelist'].map(setting => (
                  <div key={setting} className="flex items-center justify-between">
                    <span className="text-sm text-text-secondary">{setting}</span>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" defaultChecked={setting.includes('Two-factor')} className="sr-only peer" />
                      <div className="w-10 h-5 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-gold/50" />
                    </label>
                  </div>
                ))}
              </div>
            </GlassCard>
          </>
        )}
      </div>
    </div>
  );
};
