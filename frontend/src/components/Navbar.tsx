import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  ChevronDown,
  Contrast,
  LogOut,
  Menu,
  Moon,
  Search,
  Settings as SettingsIcon,
  Sun,
  User as UserIcon,
  type LucideIcon,
} from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { useUIStore } from '../stores/uiStore';
import { THEME_MODES, useThemeStore, type ThemeMode } from '../stores/themeStore';
import { navItemsFor } from '../utils/navigation';
import { NAV_ICONS } from './Sidebar';
import { NotificationBell } from './NotificationBell';
import { Avatar } from './UI';
import { ROLE_LABELS } from '../types';

const THEME_ICONS: Record<ThemeMode, LucideIcon> = {
  normal: Contrast,
  dark: Moon,
  light: Sun,
};

/**
 * Top bar: mobile navigation trigger, breadcrumb title, quick jump search,
 * theme switcher, notification bell and the account menu.
 */
export const Navbar: React.FC = () => {
  const user = useAuthStore(state => state.user);
  const logout = useAuthStore(state => state.logout);
  const openMobileNav = useUIStore(state => state.openMobileNav);
  const theme = useThemeStore(state => state.theme);
  const setTheme = useThemeStore(state => state.setTheme);

  const location = useLocation();
  const navigate = useNavigate();

  const [query, setQuery] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const navItems = useMemo(() => navItemsFor(user?.role), [user?.role]);

  const current = navItems.find(
    item => location.pathname === item.path || location.pathname.startsWith(`${item.path}/`),
  );

  const results = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return [];
    return navItems.filter(item => item.label.toLowerCase().includes(term)).slice(0, 6);
  }, [navItems, query]);

  // Close the account menu on outside click / Escape.
  useEffect(() => {
    if (!menuOpen) return;

    const onPointerDown = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  if (!user) return null;

  const settingsItem = navItems.find(item => item.icon === 'settings');
  const profileItem = navItems.find(item => item.icon === 'profile');

  const cycleTheme = (): void => {
    const index = THEME_MODES.findIndex(mode => mode.value === theme);
    const next = THEME_MODES[(index + 1) % THEME_MODES.length];
    setTheme(next.value);
  };

  const go = (path: string): void => {
    setQuery('');
    setMenuOpen(false);
    navigate(path);
  };

  const handleLogout = async (): Promise<void> => {
    setMenuOpen(false);
    await logout();
    navigate('/login', { replace: true });
  };

  const handleSearchKey = (event: React.KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === 'Escape') {
      setQuery('');
      return;
    }
    if (event.key === 'Enter' && results.length > 0) go(results[0].path);
  };

  const ThemeIcon = THEME_ICONS[theme];

  return (
    <header className="glass-navbar sticky top-0 z-30 px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={openMobileNav}
          aria-label="Open navigation"
          className="p-2 rounded-lg text-text-secondary hover:text-white hover:bg-white/5 transition-colors lg:hidden"
        >
          <Menu size={20} />
        </button>

        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-white truncate">{current?.label ?? 'JurisFlow'}</h2>
          <p className="hidden sm:block text-[11px] text-text-muted truncate">{ROLE_LABELS[user.role]} workspace</p>
        </div>

        {/* Quick jump */}
        <div className="relative hidden md:block ml-4 w-72">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            value={query}
            onChange={event => setQuery(event.target.value)}
            onKeyDown={handleSearchKey}
            placeholder="Jump to a page…"
            aria-label="Jump to a page"
            className="glass-input w-full pl-9 pr-3 py-2 text-sm"
          />
          {results.length > 0 && (
            <div className="absolute left-0 right-0 mt-2 glass-strong border border-white/10 z-50 overflow-hidden animate-scale-in">
              {results.map(item => {
                const Icon = NAV_ICONS[item.icon] ?? Search;
                return (
                  <button
                    key={item.path}
                    type="button"
                    onClick={() => go(item.path)}
                    className="w-full flex items-center gap-3 px-3.5 py-2.5 text-sm text-text-secondary hover:text-white hover:bg-white/5 transition-colors text-left"
                  >
                    <Icon size={15} className="text-text-muted" />
                    {item.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1.5 sm:gap-2">
        <button
          type="button"
          onClick={cycleTheme}
          title={`Theme: ${theme} — click for the next mode`}
          aria-label="Switch theme"
          className="p-2 rounded-lg text-text-secondary hover:text-white hover:bg-white/5 transition-colors"
        >
          <ThemeIcon size={20} />
        </button>

        <NotificationBell />

        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen(value => !value)}
            aria-expanded={menuOpen}
            aria-label="Account menu"
            className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-xl hover:bg-white/5 transition-colors"
          >
            <Avatar name={user.name} size={34} />
            <span className="hidden sm:block text-left">
              <span className="block text-xs font-medium text-white leading-tight max-w-[10rem] truncate">
                {user.name}
              </span>
              <span className="block text-[10px] text-text-muted leading-tight">{ROLE_LABELS[user.role]}</span>
            </span>
            <ChevronDown size={16} className={`text-text-muted transition-transform ${menuOpen ? 'rotate-180' : ''}`} />
          </button>

          {menuOpen && (
            <div className="absolute right-0 mt-2 w-56 glass-strong border border-white/10 z-50 py-1 animate-scale-in">
              <div className="px-4 py-3 border-b border-white/10">
                <p className="text-sm font-medium text-white truncate">{user.name}</p>
                <p className="text-[11px] text-text-muted truncate">{user.email}</p>
              </div>

              {profileItem && (
                <button
                  type="button"
                  onClick={() => go(profileItem.path)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-text-secondary hover:text-white hover:bg-white/5 transition-colors"
                >
                  <UserIcon size={16} />
                  My profile
                </button>
              )}

              {settingsItem && (
                <button
                  type="button"
                  onClick={() => go(settingsItem.path)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-text-secondary hover:text-white hover:bg-white/5 transition-colors"
                >
                  <SettingsIcon size={16} />
                  Settings
                </button>
              )}

              <button
                type="button"
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-text-secondary hover:text-danger hover:bg-danger/10 transition-colors border-t border-white/10"
              >
                <LogOut size={16} />
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
