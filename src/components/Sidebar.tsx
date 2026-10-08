import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { useUIStore } from '../stores/appStores';
import {
  LayoutDashboard, FolderOpen, FileText, Mail, Users, BookOpen,
  Calendar, Clock, Settings, MessageSquare, Sparkles, User,
  Scale, ChevronLeft, ChevronRight,
} from 'lucide-react';

const iconMap: Record<string, React.ReactNode> = {
  dashboard: <LayoutDashboard size={20} />,
  cases: <FolderOpen size={20} />,
  documents: <FileText size={20} />,
  inbox: <Mail size={20} />,
  team: <Users size={20} />,
  knowledge: <BookOpen size={20} />,
  appointments: <Calendar size={20} />,
  availability: <Clock size={20} />,
  settings: <Settings size={20} />,
  messages: <MessageSquare size={20} />,
  suggestions: <Sparkles size={20} />,
  profile: <User size={20} />,
  articles: <BookOpen size={20} />,
  calendar: <Calendar size={20} />,
};

interface NavItem {
  label: string;
  path: string;
  icon: string;
}

const getNavItems = (role: string): NavItem[] => {
  switch (role) {
    case 'system_admin':
      return [
        { label: 'Dashboard', path: '/admin/dashboard', icon: 'dashboard' },
        { label: 'All Cases', path: '/admin/cases', icon: 'cases' },
        { label: 'All Documents', path: '/admin/documents', icon: 'documents' },
        { label: 'All Inbox', path: '/admin/inbox', icon: 'inbox' },
        { label: 'Team Management', path: '/admin/team', icon: 'team' },
        { label: 'Knowledge Base', path: '/admin/knowledge-base', icon: 'knowledge' },
        { label: 'All Appointments', path: '/admin/appointments', icon: 'appointments' },
        { label: 'All Availability', path: '/admin/availability', icon: 'availability' },
        { label: 'System Settings', path: '/admin/settings', icon: 'settings' },
      ];
    case 'attorney':
      return [
        { label: 'Dashboard', path: '/attorney/dashboard', icon: 'dashboard' },
        { label: 'My Cases', path: '/attorney/cases', icon: 'cases' },
        { label: 'My Documents', path: '/attorney/documents', icon: 'documents' },
        { label: 'My Inbox', path: '/attorney/inbox', icon: 'inbox' },
        { label: 'My Appointments', path: '/attorney/appointments', icon: 'appointments' },
        { label: 'My Availability', path: '/attorney/availability', icon: 'availability' },
        { label: 'My Settings', path: '/attorney/settings', icon: 'settings' },
      ];
    case 'legal_secretary':
      return [
        { label: 'Dashboard', path: '/secretary/dashboard', icon: 'dashboard' },
        { label: 'All Cases', path: '/secretary/cases', icon: 'cases' },
        { label: 'Documents', path: '/secretary/documents', icon: 'documents' },
        { label: 'Inbox', path: '/secretary/inbox', icon: 'inbox' },
        { label: 'Appointments', path: '/secretary/appointments', icon: 'appointments' },
        { label: 'Calendar', path: '/secretary/calendar', icon: 'calendar' },
        { label: 'Settings', path: '/secretary/settings', icon: 'settings' },
      ];
    case 'user':
      return [
        { label: 'Dashboard', path: '/user/dashboard', icon: 'dashboard' },
        { label: 'Get Suggestions', path: '/user/get-suggestions', icon: 'suggestions' },
        { label: 'My Cases', path: '/user/my-cases', icon: 'cases' },
        { label: 'Articles', path: '/user/articles', icon: 'articles' },
        { label: 'Messages', path: '/user/messages', icon: 'messages' },
        { label: 'My Appointments', path: '/user/appointments', icon: 'appointments' },
        { label: 'Profile', path: '/user/profile', icon: 'profile' },
      ];
    default:
      return [];
  }
};

export const Sidebar: React.FC = () => {
  const { user } = useAuthStore();
  const { sidebarOpen, toggleSidebar } = useUIStore();
  const location = useLocation();

  if (!user) return null;

  const navItems = getNavItems(user.role);

  return (
    <aside
      className={`glass-sidebar fixed left-0 top-0 h-screen z-40 transition-all duration-300 flex flex-col ${
        sidebarOpen ? 'w-64' : 'w-20'
      }`}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-6 border-b border-white/8">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-gold to-gold-dark flex items-center justify-center flex-shrink-0">
          <Scale size={22} className="text-navy" />
        </div>
        {sidebarOpen && (
          <div className="animate-fade-in">
            <h1 className="text-lg font-bold text-white tracking-tight">JurisFlow</h1>
            <p className="text-[10px] text-text-muted uppercase tracking-widest">Legal Platform</p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path || location.pathname.startsWith(item.path + '/');
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group ${
                isActive
                  ? 'bg-gold/15 text-gold border border-gold/20'
                  : 'text-text-secondary hover:bg-white/5 hover:text-white border border-transparent'
              }`}
              title={!sidebarOpen ? item.label : undefined}
            >
              <span className={`flex-shrink-0 transition-colors ${isActive ? 'text-gold' : 'text-text-muted group-hover:text-white'}`}>
                {iconMap[item.icon]}
              </span>
              {sidebarOpen && <span className="truncate">{item.label}</span>}
            </NavLink>
          );
        })}
      </nav>

      {/* Collapse Button */}
      <div className="p-3 border-t border-white/8">
        <button
          onClick={toggleSidebar}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-text-muted hover:text-white hover:bg-white/5 transition-all text-sm"
        >
          {sidebarOpen ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
          {sidebarOpen && <span>Collapse</span>}
        </button>
      </div>
    </aside>
  );
};
