import React, { useMemo } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  BookOpen,
  Briefcase,
  Calendar,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  FileText,
  LayoutDashboard,
  LogOut,
  Mail,
  MessageSquare,
  Scale,
  Settings,
  Sparkles,
  User,
  UserCog,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { useUIStore } from '../stores/uiStore';
import { navItemsFor } from '../utils/navigation';
import { ROLE_LABELS, type SidebarItem } from '../types';
import { Avatar } from './UI';

/**
 * Icon map for `NAV_ITEMS`.
 *
 * `utils/navigation` stores an icon *key* so it can stay React-free; this is the
 * only place where those keys become components.
 */
export const NAV_ICONS: Record<string, LucideIcon> = {
  dashboard: LayoutDashboard,
  cases: Briefcase,
  clients: Users,
  consultations: MessageSquare,
  appointments: Calendar,
  calendar: CalendarDays,
  documents: FileText,
  team: UserCog,
  knowledge: BookOpen,
  services: Scale,
  settings: Settings,
  availability: Clock,
  suggestions: Sparkles,
  inbox: Mail,
  profile: User,
};

/**
 * Groups the nav entries by their `section` label, keeping the order declared
 * in `utils/navigation` and collapsing runs of items without a section into a
 * single "Menu" group.
 */
export function groupNavItems(items: SidebarItem[]): { title: string; items: SidebarItem[] }[] {
  const groups: { title: string; items: SidebarItem[] }[] = [];

  items.forEach(item => {
    const title = item.section ?? 'Menu';
    const last = groups[groups.length - 1];

    if (last && last.title === title) last.items.push(item);
    else groups.push({ title, items: [item] });
  });

  return groups;
}

const isItemActive = (pathname: string, item: SidebarItem): boolean =>
  pathname === item.path || pathname.startsWith(`${item.path}/`);

interface SidebarLinkProps {
  item: SidebarItem;
  expanded: boolean;
  active: boolean;
  onNavigate?: () => void;
}

const SidebarLink: React.FC<SidebarLinkProps> = ({ item, expanded, active, onNavigate }) => {
  const Icon = NAV_ICONS[item.icon] ?? LayoutDashboard;

  return (
    <NavLink
      to={item.path}
      onClick={onNavigate}
      title={expanded ? undefined : item.label}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium border transition-colors duration-200 group ${
        active
          ? 'bg-gold/15 text-gold border-gold/20'
          : 'text-text-secondary border-transparent hover:bg-white/5 hover:text-white'
      }`}
    >
      <Icon size={18} className={`flex-shrink-0 ${active ? 'text-gold' : 'text-text-muted group-hover:text-white'}`} />
      {expanded && <span className="truncate">{item.label}</span>}
    </NavLink>
  );
};

export interface SidebarProps {
  /** `mobile` renders the slide-in drawer, `desktop` the fixed rail. */
  variant?: 'desktop' | 'mobile';
}

/**
 * Primary navigation.
 *
 * Entries come from `NAV_ITEMS[role]` so adding a page means editing one map.
 * The desktop rail collapses to icons (`uiStore.sidebarOpen`); the mobile drawer
 * is driven by `uiStore.mobileNavOpen`.
 */
export const Sidebar: React.FC<SidebarProps> = ({ variant = 'desktop' }) => {
  const user = useAuthStore(state => state.user);
  const logout = useAuthStore(state => state.logout);
  const sidebarOpen = useUIStore(state => state.sidebarOpen);
  const toggleSidebar = useUIStore(state => state.toggleSidebar);
  const mobileNavOpen = useUIStore(state => state.mobileNavOpen);
  const closeMobileNav = useUIStore(state => state.closeMobileNav);
  const location = useLocation();

  const isMobile = variant === 'mobile';
  const expanded = isMobile ? true : sidebarOpen;

  const groups = useMemo(() => groupNavItems(navItemsFor(user?.role)), [user?.role]);

  if (!user) return null;
  if (isMobile && !mobileNavOpen) return null;

  const handleLogout = async (): Promise<void> => {
    closeMobileNav();
    await logout();
  };

  return (
    <>
      {isMobile && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          onClick={closeMobileNav}
          aria-hidden="true"
        />
      )}

      <aside
        className={`glass-sidebar fixed left-0 top-0 h-screen flex flex-col transition-all duration-300 ${
          isMobile ? 'w-64 z-50 lg:hidden' : 'hidden lg:flex z-40'
        } ${expanded ? 'w-64' : 'w-20'}`}
      >
        {/* Logo */}
        <div className={`flex items-center gap-3 py-5 border-b border-white/10 ${expanded ? 'px-5' : 'px-4'}`}>
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-gold to-gold-dark flex items-center justify-center flex-shrink-0">
            <Scale size={22} className="text-navy" />
          </div>
          {expanded && (
            <div className="min-w-0 animate-fade-in">
              <h1 className="text-lg font-bold text-white tracking-tight leading-tight">JurisFlow</h1>
              <p className="text-[10px] text-text-muted uppercase tracking-widest">Legal Platform</p>
            </div>
          )}
          {isMobile && (
            <button
              type="button"
              onClick={closeMobileNav}
              aria-label="Close navigation"
              className="ml-auto p-1.5 rounded-lg text-text-muted hover:text-white hover:bg-white/5 transition-colors"
            >
              <X size={18} />
            </button>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-4">
          {groups.map(group => (
            <div key={group.title} className="space-y-1">
              {expanded && (
                <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-widest text-text-muted">
                  {group.title}
                </p>
              )}
              {group.items.map(item => (
                <SidebarLink
                  key={item.path}
                  item={item}
                  expanded={expanded}
                  active={isItemActive(location.pathname, item)}
                  onNavigate={isMobile ? closeMobileNav : undefined}
                />
              ))}
            </div>
          ))}
        </nav>

        {/* User + collapse */}
        <div className="p-3 border-t border-white/10 space-y-2">
          <div className={`flex items-center gap-3 px-2 py-2 rounded-xl bg-white/5 ${expanded ? '' : 'justify-center'}`}>
            <Avatar name={user.name} size={32} />
            {expanded && (
              <div className="min-w-0">
                <p className="text-sm font-medium text-white truncate">{user.name}</p>
                <p className="text-[11px] text-text-muted truncate">{ROLE_LABELS[user.role]}</p>
              </div>
            )}
          </div>

          {isMobile ? (
            <button
              type="button"
              onClick={handleLogout}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-text-muted hover:text-danger hover:bg-danger/10 transition-colors text-sm"
            >
              <LogOut size={18} />
              <span>Sign out</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={toggleSidebar}
              aria-label={sidebarOpen ? 'Collapse navigation' : 'Expand navigation'}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-text-muted hover:text-white hover:bg-white/5 transition-colors text-sm"
            >
              {sidebarOpen ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
              {sidebarOpen && <span>Collapse</span>}
            </button>
          )}
        </div>
      </aside>
    </>
  );
};
