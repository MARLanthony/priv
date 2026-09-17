import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { useUIStore } from '../stores/appStores';
import { Bell, LogOut, Menu, Search } from 'lucide-react';

const roleLabels: Record<string, string> = {
  system_admin: 'System Administrator',
  attorney: 'Attorney',
  legal_secretary: 'Legal Secretary',
  user: 'Client',
};

export const Navbar: React.FC = () => {
  const { user, logout } = useAuthStore();
  const { sidebarOpen, toggleSidebar } = useUIStore();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  if (!user) return null;

  return (
    <header className="glass-navbar sticky top-0 z-30 px-6 py-3 flex items-center justify-between">
      <div className="flex items-center gap-4">
        <button
          onClick={toggleSidebar}
          className="p-2 rounded-lg hover:bg-white/5 text-text-secondary hover:text-white transition-colors lg:hidden"
        >
          <Menu size={20} />
        </button>
        <div className="hidden md:flex items-center gap-2 glass-input px-4 py-2 w-80">
          <Search size={16} className="text-text-muted" />
          <input
            type="text"
            placeholder="Search anything..."
            className="bg-transparent border-none outline-none text-sm text-white w-full placeholder-text-muted"
          />
        </div>
      </div>

      <div className="flex items-center gap-4">
        {/* Notifications */}
        <button className="relative p-2 rounded-lg hover:bg-white/5 text-text-secondary hover:text-white transition-colors">
          <Bell size={20} />
          <span className="absolute top-1 right-1 w-2 h-2 bg-gold rounded-full"></span>
        </button>

        {/* User Info */}
        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-medium text-white">{user.name}</p>
            <p className="text-xs text-text-muted">{roleLabels[user.role]}</p>
          </div>
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-royal to-royal-light flex items-center justify-center text-sm font-semibold text-gold border border-gold/30">
            {user.name.charAt(0)}
          </div>
          <button
            onClick={handleLogout}
            className="p-2 rounded-lg hover:bg-red-500/10 text-text-muted hover:text-red-400 transition-colors"
            title="Logout"
          >
            <LogOut size={18} />
          </button>
        </div>
      </div>
    </header>
  );
};
