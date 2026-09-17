import React, { useState } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { PageHeader, GlassCard } from '../../components/UI';
import { User, Lock, Bell, Shield, Save } from 'lucide-react';

interface SettingsPageProps {
  isAdmin?: boolean;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({ isAdmin = false }) => {
  const { user } = useAuthStore();
  const [profile, setProfile] = useState({ name: user?.name || '', email: user?.email || '', phone: user?.phone || '' });
  const [passwords, setPasswords] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [saved, setSaved] = useState(false);

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
