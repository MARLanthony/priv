import React, { useEffect } from 'react';
import { AlertTriangle, CheckCircle2, Info, Loader2, X, type LucideIcon } from 'lucide-react';
import { useUIStore, type Toast } from '../stores/uiStore';
import type {
  AppointmentStatus,
  CasePriority,
  CaseStatus,
  ConsultationStatus,
  DocumentStatus,
} from '../types';

/* ==========================================================================
   Shared UI kit
   --------------------------------------------------------------------------
   Every screen is built from these primitives so the glass look, spacing and
   dark/light behaviour stay identical across the admin, lawyer, staff and
   client surfaces. Colours come from the Tailwind theme (see tailwind.config.js)
   which reads the CSS variables set by the active theme.
   ========================================================================== */

/* ------------------------------------------------------------------ Layout */

export interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  /** Adds the lift-on-hover treatment (use for clickable cards). */
  hover?: boolean;
  onClick?: () => void;
}

export const GlassCard: React.FC<GlassCardProps> = ({ children, className = '', hover = false, onClick }) => (
  <div
    onClick={onClick}
    className={`glass-premium p-5 ${hover ? 'glass-premium-hover cursor-pointer' : ''} ${className}`}
  >
    {children}
  </div>
);

export interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export const PageHeader: React.FC<PageHeaderProps> = ({ title, subtitle, actions }) => (
  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
    <div>
      <h1 className="text-2xl font-bold text-white">{title}</h1>
      {subtitle && <p className="text-sm text-text-muted mt-1">{subtitle}</p>}
    </div>
    {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
  </div>
);

export interface KPICardProps {
  label: string;
  value: number | string;
  icon: LucideIcon;
  hint?: string;
  tone?: 'gold' | 'success' | 'danger' | 'info';
}

const KPI_TONES: Record<string, string> = {
  gold: 'text-gold bg-gold/10',
  success: 'text-success bg-success/10',
  danger: 'text-danger bg-danger/10',
  info: 'text-info bg-info/10',
};

export const KPICard: React.FC<KPICardProps> = ({ label, value, icon: Icon, hint, tone = 'gold' }) => (
  <GlassCard hover className="flex items-start gap-4">
    <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${KPI_TONES[tone]}`}>
      <Icon size={20} />
    </div>
    <div className="min-w-0">
      <p className="text-2xl font-bold text-white tabular-nums leading-tight">{value}</p>
      <p className="text-xs text-text-secondary truncate">{label}</p>
      {hint && <p className="text-[11px] text-text-muted mt-0.5 truncate">{hint}</p>}
    </div>
  </GlassCard>
);

/* ------------------------------------------------------------------ Badges */

const STATUS_TONES: Record<string, string> = {
  /* cases */
  open: 'bg-info/15 text-info border-info/30',
  pending: 'bg-warning/15 text-warning border-warning/30',
  active: 'bg-gold/15 text-gold border-gold/30',
  discovery: 'bg-royal/20 text-royal-light border-royal-light/30',
  closed: 'bg-success/15 text-success border-success/30',
  archived: 'bg-white/5 text-text-muted border-white/10',
  /* consultations */
  approved: 'bg-success/15 text-success border-success/30',
  declined: 'bg-danger/15 text-danger border-danger/30',
  completed: 'bg-info/15 text-info border-info/30',
  /* appointments */
  scheduled: 'bg-info/15 text-info border-info/30',
  confirmed: 'bg-success/15 text-success border-success/30',
  rescheduled: 'bg-warning/15 text-warning border-warning/30',
  cancelled: 'bg-danger/15 text-danger border-danger/30',
  /* documents */
  received: 'bg-info/15 text-info border-info/30',
  reviewing: 'bg-warning/15 text-warning border-warning/30',
  processed: 'bg-success/15 text-success border-success/30',
  rejected: 'bg-danger/15 text-danger border-danger/30',
  /* priorities */
  high: 'bg-danger/15 text-danger border-danger/30',
  medium: 'bg-warning/15 text-warning border-warning/30',
  low: 'bg-white/5 text-text-secondary border-white/10',
};

export interface StatusBadgeProps {
  status: CaseStatus | ConsultationStatus | AppointmentStatus | DocumentStatus | CasePriority | string;
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, className = '' }) => (
  <span
    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium border capitalize ${
      STATUS_TONES[status] ?? 'bg-white/5 text-text-secondary border-white/10'
    } ${className}`}
  >
    {status}
  </span>
);

/* ----------------------------------------------------------------- Loading */

export const LoadingSpinner: React.FC<{ size?: number; className?: string }> = ({
  size = 20,
  className = '',
}) => <Loader2 size={size} className={`animate-spin text-gold ${className}`} />;

export const PageLoader: React.FC<{ label?: string }> = ({ label = 'Loading…' }) => (
  <div className="flex flex-col items-center justify-center py-16 gap-3">
    <LoadingSpinner size={26} />
    <p className="text-sm text-text-muted">{label}</p>
  </div>
);

export interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ icon: Icon, title, description, action }) => (
  <div className="flex flex-col items-center justify-center text-center py-14 px-6">
    <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center mb-4">
      <Icon size={24} className="text-text-muted" />
    </div>
    <h3 className="text-base font-semibold text-white">{title}</h3>
    {description && <p className="text-sm text-text-muted mt-1 max-w-sm">{description}</p>}
    {action && <div className="mt-5">{action}</div>}
  </div>
);

/* ----------------------------------------------------------------- Buttons */

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  icon?: LucideIcon;
  loading?: boolean;
  fullWidth?: boolean;
}

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary: 'btn-primary',
  secondary: 'btn-secondary',
  danger: 'btn-danger',
  ghost: 'bg-transparent text-text-secondary hover:text-white hover:bg-white/5 border border-transparent',
};

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  icon: Icon,
  loading = false,
  fullWidth = false,
  className = '',
  children,
  disabled,
  ...rest
}) => (
  <button
    {...rest}
    disabled={disabled || loading}
    className={`inline-flex items-center justify-center gap-2 ${VARIANT_CLASS[variant]} ${
      fullWidth ? 'w-full' : ''
    } disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
  >
    {loading ? <LoadingSpinner size={16} /> : Icon ? <Icon size={16} /> : null}
    {children}
  </button>
);

/* ------------------------------------------------------------------- Forms */

export interface FieldProps {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}

export const Field: React.FC<FieldProps> = ({ label, hint, required, children }) => (
  <label className="block">
    <span className="block text-xs font-medium text-text-secondary mb-1.5">
      {label}
      {required && <span className="text-danger ml-0.5">*</span>}
    </span>
    {children}
    {hint && <span className="block text-[11px] text-text-muted mt-1">{hint}</span>}
  </label>
);

export const Input: React.FC<React.InputHTMLAttributes<HTMLInputElement>> = ({ className = '', ...rest }) => (
  <input {...rest} className={`glass-input w-full px-3.5 py-2.5 text-sm ${className}`} />
);

export const TextArea: React.FC<React.TextareaHTMLAttributes<HTMLTextAreaElement>> = ({
  className = '',
  ...rest
}) => <textarea {...rest} className={`glass-input w-full px-3.5 py-2.5 text-sm resize-none ${className}`} />;

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  options: SelectOption[];
  placeholder?: string;
}

export const Select: React.FC<SelectProps> = ({ options, placeholder, className = '', ...rest }) => (
  <select {...rest} className={`glass-input w-full px-3.5 py-2.5 text-sm ${className}`}>
    {placeholder && <option value="">{placeholder}</option>}
    {options.map(option => (
      <option key={option.value} value={option.value} className="bg-navy text-white">
        {option.label}
      </option>
    ))}
  </select>
);

export interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export const SearchInput: React.FC<SearchInputProps> = ({
  value,
  onChange,
  placeholder = 'Search…',
  className = '',
}) => (
  <div className={`relative ${className}`}>
    <svg
      viewBox="0 0 24 24"
      className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
    <input
      value={value}
      onChange={event => onChange(event.target.value)}
      placeholder={placeholder}
      className="glass-input w-full pl-9 pr-3.5 py-2.5 text-sm"
      aria-label={placeholder}
    />
  </div>
);

/* -------------------------------------------------------------------- Tabs */

export interface TabItem {
  id: string;
  label: string;
  count?: number;
}

export interface TabsProps {
  tabs: TabItem[];
  active: string;
  onChange: (id: string) => void;
  className?: string;
}

export const Tabs: React.FC<TabsProps> = ({ tabs, active, onChange, className = '' }) => (
  <div className={`flex items-center gap-1.5 overflow-x-auto ${className}`} role="tablist">
    {tabs.map(tab => {
      const isActive = tab.id === active;
      return (
        <button
          key={tab.id}
          role="tab"
          aria-selected={isActive}
          onClick={() => onChange(tab.id)}
          className={`px-3.5 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
            isActive
              ? 'bg-gold/15 text-gold border border-gold/30'
              : 'text-text-secondary hover:text-white hover:bg-white/5 border border-transparent'
          }`}
        >
          {tab.label}
          {typeof tab.count === 'number' && (
            <span className={`ml-1.5 tabular-nums ${isActive ? 'text-gold' : 'text-text-muted'}`}>
              {tab.count}
            </span>
          )}
        </button>
      );
    })}
  </div>
);

/* -------------------------------------------------------------- Progress/UI */

export const ProgressBar: React.FC<{ value: number; className?: string }> = ({ value, className = '' }) => (
  <div className={`h-2 bg-white/5 rounded-full overflow-hidden ${className}`}>
    <div
      className="h-full bg-gradient-to-r from-gold to-gold-light rounded-full transition-all duration-300 ease-out"
      style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
    />
  </div>
);

export const Avatar: React.FC<{ name: string; size?: number; className?: string }> = ({
  name,
  size = 36,
  className = '',
}) => {
  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase() ?? '')
    .join('');

  return (
    <span
      className={`inline-flex items-center justify-center rounded-full bg-gold/15 text-gold font-semibold flex-shrink-0 ${className}`}
      style={{ width: size, height: size, fontSize: size * 0.36 }}
      aria-hidden="true"
    >
      {initials || '?'}
    </span>
  );
};

/* ------------------------------------------------------------------- Table */

export interface TableColumn {
  key: string;
  label: string;
  className?: string;
}

export interface TableProps {
  columns: TableColumn[];
  children: React.ReactNode;
  className?: string;
}

/** Glass table shell. Rows are plain `<Tr>`/`<Td>` elements from this module. */
export const Table: React.FC<TableProps> = ({ columns, children, className = '' }) => (
  <div className={`overflow-x-auto ${className}`}>
    <table className="w-full text-sm border-collapse">
      <thead>
        <tr>
          {columns.map(column => (
            <th
              key={column.key}
              className={`text-left font-medium text-[11px] uppercase tracking-wide text-text-muted pb-2.5 px-3 ${
                column.className ?? ''
              }`}
            >
              {column.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>{children}</tbody>
    </table>
  </div>
);

export const Tr: React.FC<{ children: React.ReactNode; onClick?: () => void }> = ({ children, onClick }) => (
  <tr
    onClick={onClick}
    className={`border-t border-white/5 transition-colors ${
      onClick ? 'hover:bg-white/5 cursor-pointer' : ''
    }`}
  >
    {children}
  </tr>
);

export const Td: React.FC<{ children?: React.ReactNode; className?: string }> = ({
  children,
  className = '',
}) => <td className={`py-3 px-3 text-text-secondary align-middle ${className}`}>{children}</td>;

/* ------------------------------------------------------------------- Modal */

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  /** Tailwind max-width class for the panel. */
  maxWidth?: string;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  footer,
  maxWidth = 'max-w-lg',
}) => {
  const setModalOpen = useUIStore(state => state.setModalOpen);

  useEffect(() => {
    setModalOpen(isOpen);
    return () => setModalOpen(false);
  }, [isOpen, setModalOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-label={title}>
      <div className={`glass-strong w-full ${maxWidth} mx-4 p-6 animate-scale-in`}>
        <div className="flex items-start justify-between gap-4 mb-5">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-white">{title}</h2>
            {subtitle && <p className="text-xs text-text-muted mt-1">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="p-1.5 rounded-lg text-text-muted hover:text-white hover:bg-white/5 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="max-h-[65vh] overflow-y-auto pr-1">{children}</div>

        {footer && <div className="flex items-center justify-end gap-2 mt-6 pt-4 border-t border-white/10">{footer}</div>}
      </div>
    </div>
  );
};

export interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  danger = false,
  busy = false,
  onConfirm,
  onCancel,
}) => (
  <Modal
    isOpen={isOpen}
    onClose={onCancel}
    title={title}
    maxWidth="max-w-md"
    footer={
      <>
        <Button variant="secondary" onClick={onCancel} disabled={busy}>
          {cancelLabel}
        </Button>
        <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm} loading={busy}>
          {confirmLabel}
        </Button>
      </>
    }
  >
    <p className="text-sm text-text-secondary">{message}</p>
  </Modal>
);

/* ------------------------------------------------------------------ Toasts */

const TOAST_TONES: Record<Toast['tone'], { className: string; icon: LucideIcon }> = {
  success: { className: 'border-success/30 text-success', icon: CheckCircle2 },
  error: { className: 'border-danger/30 text-danger', icon: AlertTriangle },
  info: { className: 'border-info/30 text-info', icon: Info },
};

/** Renders the toast queue built by `toast.success()/error()/info()`. */
export const Toaster: React.FC = () => {
  const toasts = useUIStore(state => state.toasts);
  const dismiss = useUIStore(state => state.dismissToast);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[60] flex flex-col gap-2 max-w-sm" aria-live="polite">
      {toasts.map(item => {
        const tone = TOAST_TONES[item.tone];
        const Icon = tone.icon;
        return (
          <div
            key={item.id}
            className={`glass-strong flex items-start gap-2.5 px-4 py-3 border animate-scale-in ${tone.className}`}
          >
            <Icon size={16} className="mt-0.5 flex-shrink-0" />
            <p className="text-sm text-white flex-1">{item.message}</p>
            <button
              type="button"
              onClick={() => dismiss(item.id)}
              aria-label="Dismiss notification"
              className="text-text-muted hover:text-white transition-colors"
            >
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
};

