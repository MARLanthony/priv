import React from 'react';
import { LucideIcon } from 'lucide-react';

// GlassCard
interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
  onClick?: () => void;
}

export const GlassCard: React.FC<GlassCardProps> = ({ children, className = '', hover = false, onClick }) => (
  <div
    className={`glass p-6 ${hover ? 'cursor-pointer hover:bg-white/12 hover:border-white/20 transition-all duration-300 hover:-translate-y-0.5' : ''} ${className}`}
    onClick={onClick}
  >
    {children}
  </div>
);

// KPI Card
interface KPICardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: string;
  trendUp?: boolean;
  color?: string;
}

export const KPICard: React.FC<KPICardProps> = ({ title, value, icon: Icon, trend, trendUp, color = 'gold' }) => {
  const colorMap: Record<string, string> = {
    gold: 'from-gold/20 to-gold/5 text-gold border-gold/20',
    blue: 'from-info/20 to-info/5 text-info border-info/20',
    green: 'from-success/20 to-success/5 text-success border-success/20',
    red: 'from-danger/20 to-danger/5 text-danger border-danger/20',
  };

  return (
    <div className={`glass p-5 bg-gradient-to-br ${colorMap[color] || colorMap.gold}`}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-text-secondary text-sm font-medium">{title}</span>
        <Icon size={20} className="opacity-70" />
      </div>
      <p className="text-3xl font-bold text-white">{value}</p>
      {trend && (
        <p className={`text-xs mt-2 ${trendUp ? 'text-success' : 'text-danger'}`}>
          {trendUp ? '↑' : '↓'} {trend}
        </p>
      )}
    </div>
  );
};

// Status Badge
interface StatusBadgeProps {
  status: string;
  size?: 'sm' | 'md';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = 'md' }) => {
  const styles: Record<string, string> = {
    active: 'bg-success/15 text-success border-success/30',
    pending: 'bg-warning/15 text-warning border-warning/30',
    discovery: 'bg-info/15 text-info border-info/30',
    closed: 'bg-white/8 text-text-muted border-white/15',
    archived: 'bg-white/5 text-text-muted border-white/10',
    scheduled: 'bg-info/15 text-info border-info/30',
    completed: 'bg-success/15 text-success border-success/30',
    cancelled: 'bg-danger/15 text-danger border-danger/30',
    published: 'bg-success/15 text-success border-success/30',
    draft: 'bg-warning/15 text-warning border-warning/30',
    high: 'bg-danger/15 text-danger border-danger/30',
    medium: 'bg-warning/15 text-warning border-warning/30',
    low: 'bg-white/8 text-text-muted border-white/15',
  };

  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-3 py-1 text-xs';

  return (
    <span className={`inline-flex items-center rounded-full border font-medium capitalize ${sizeClasses} ${styles[status] || styles.active}`}>
      {status}
    </span>
  );
};

// Modal
interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, size = 'md' }) => {
  if (!isOpen) return null;

  const sizeClasses = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className={`glass-strong p-6 w-full mx-4 animate-scale-in ${sizeClasses[size]}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-white">{title}</h2>
          <button onClick={onClose} className="text-text-muted hover:text-white transition-colors text-xl leading-none">×</button>
        </div>
        {children}
      </div>
    </div>
  );
};

// Loading Spinner
export const LoadingSpinner: React.FC<{ size?: 'sm' | 'md' | 'lg' }> = ({ size = 'md' }) => {
  const sizes = { sm: 'w-5 h-5', md: 'w-8 h-8', lg: 'w-12 h-12' };
  return (
    <div className="flex items-center justify-center py-12">
      <div className={`${sizes[size]} border-2 border-white/10 border-t-gold rounded-full animate-spin`} />
    </div>
  );
};

// Empty State
interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ icon: Icon, title, description, action }) => (
  <div className="flex flex-col items-center justify-center py-16 text-center">
    <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mb-4">
      <Icon size={28} className="text-text-muted" />
    </div>
    <h3 className="text-lg font-medium text-white mb-1">{title}</h3>
    <p className="text-sm text-text-muted max-w-sm">{description}</p>
    {action && <div className="mt-4">{action}</div>}
  </div>
);

// Page Header
interface PageHeaderProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}

export const PageHeader: React.FC<PageHeaderProps> = ({ title, subtitle, action }) => (
  <div className="flex items-center justify-between mb-6">
    <div>
      <h1 className="text-2xl font-bold text-white">{title}</h1>
      {subtitle && <p className="text-sm text-text-secondary mt-1">{subtitle}</p>}
    </div>
    {action}
  </div>
);

// Tab component
interface TabsProps {
  tabs: { label: string; value: string }[];
  activeTab: string;
  onChange: (value: string) => void;
}

export const Tabs: React.FC<TabsProps> = ({ tabs, activeTab, onChange }) => (
  <div className="flex gap-1 p-1 glass-light rounded-xl mb-6">
    {tabs.map((tab) => (
      <button
        key={tab.value}
        onClick={() => onChange(tab.value)}
        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
          activeTab === tab.value
            ? 'bg-gold/20 text-gold'
            : 'text-text-secondary hover:text-white hover:bg-white/5'
        }`}
      >
        {tab.label}
      </button>
    ))}
  </div>
);
