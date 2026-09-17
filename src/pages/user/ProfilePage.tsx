import React, { useState } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { PageHeader, GlassCard } from '../../components/UI';
import { User, Mail, Phone, Save, Camera } from 'lucide-react';

export const ProfilePage: React.FC = () => {
  const { user } = useAuthStore();
  const [profile, setProfile] = useState({
    name: user?.name || '',
    email: user?.email || '',
    phone: user?.phone || '',
  });
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    await fetch('/api/users/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(profile),
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="animate-fade-in">
      <PageHeader title="My Profile" subtitle="Manage your personal information" />

      {saved && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-success/10 border border-success/20 text-success text-sm animate-fade-in">
          ✓ Profile saved successfully
        </div>
      )}

      <div className="max-w-2xl">
        <GlassCard className="mb-6">
          {/* Avatar Section */}
          <div className="flex items-center gap-5 mb-8 pb-6 border-b border-white/8">
            <div className="relative">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-royal to-royal-light flex items-center justify-center text-3xl font-bold text-gold border-2 border-gold/30">
                {profile.name.charAt(0)}
              </div>
              <button className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-gold flex items-center justify-center hover:bg-gold-light transition-colors">
                <Camera size={12} className="text-navy" />
              </button>
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">{profile.name}</h2>
              <p className="text-sm text-text-muted">Client Account</p>
              <p className="text-xs text-text-muted mt-1">Member since {user?.createdAt}</p>
            </div>
          </div>

          {/* Profile Form */}
          <div className="space-y-5">
            <div>
              <label className="text-sm text-text-secondary block mb-2 flex items-center gap-2">
                <User size={14} /> Full Name
              </label>
              <input
                value={profile.name}
                onChange={e => setProfile({ ...profile, name: e.target.value })}
                className="glass-input w-full px-4 py-3 text-sm"
              />
            </div>

            <div>
              <label className="text-sm text-text-secondary block mb-2 flex items-center gap-2">
                <Mail size={14} /> Email Address
              </label>
              <input
                value={profile.email}
                onChange={e => setProfile({ ...profile, email: e.target.value })}
                className="glass-input w-full px-4 py-3 text-sm"
              />
            </div>

            <div>
              <label className="text-sm text-text-secondary block mb-2 flex items-center gap-2">
                <Phone size={14} /> Phone Number
              </label>
              <input
                value={profile.phone}
                onChange={e => setProfile({ ...profile, phone: e.target.value })}
                className="glass-input w-full px-4 py-3 text-sm"
                placeholder="(555) 000-0000"
              />
            </div>

            <button onClick={handleSave} className="btn-primary flex items-center gap-2">
              <Save size={14} /> Save Profile
            </button>
          </div>
        </GlassCard>
      </div>
    </div>
  );
};
