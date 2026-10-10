import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  ArrowUpRight,
  Briefcase,
  CalendarClock,
  FileText,
  MessageSquare,
  Scale,
  Sparkles,
  Users,
} from 'lucide-react';
import { GlassCard, KPICard, PageHeader, PageLoader } from '../../components/UI';
import { NAV_ICONS } from '../../components/Sidebar';
import { getDashboardOverview, getDashboardStats, listActivity } from '../../services';
import type { DashboardOverview as OverviewSeries } from '../../services';
import { toast, useAuthStore, useNotificationStore } from '../../stores';
import { ROLE_LABELS, type ActivityLog, type DashboardStats, type UserRole } from '../../types';
import { humanize, relativeTime } from '../../utils/format';
import { navItemsFor, roleHome } from '../../utils/navigation';

/**
 * Role dashboards.
 *
 * One component, four perspectives. The API already scopes every counter to the
 * caller (`GET /dashboard/stats`), so the only role-specific work here is
 * choosing which cards matter and which shortcuts to show.
 */

const KPI_ORDER: { key: keyof DashboardStats; label: string; icon: typeof Users }[] = [
  { key: 'users', label: 'Team members', icon: Users },
  { key: 'clients', label: 'Clients', icon: Users },
  { key: 'cases', label: 'Cases', icon: Briefcase },
  { key: 'consultations', label: 'Consultations', icon: MessageSquare },
  { key: 'appointments', label: 'Appointments', icon: CalendarClock },
  { key: 'documents', label: 'Documents', icon: FileText },
  { key: 'unreadNotifications', label: 'Unread alerts', icon: Sparkles },
];

const KPI_KEYS: Record<UserRole, (keyof DashboardStats)[]> = {
  admin: ['users', 'clients', 'cases', 'consultations', 'appointments', 'documents'],
  lawyer: ['cases', 'consultations', 'appointments', 'documents'],
  staff: ['clients', 'cases', 'consultations', 'appointments', 'documents'],
  client: ['cases', 'appointments', 'documents', 'unreadNotifications'],
};

interface BarSeries {
  title: string;
  data: { label: string; value: number }[];
}

export interface DashboardOverviewProps {
  role: UserRole;
  title?: string;
  subtitle?: string;
}

export const DashboardOverview: React.FC<DashboardOverviewProps> = ({ role, title, subtitle }) => {
  const user = useAuthStore(state => state.user);
  const unread = useNotificationStore(state => state.unreadCount);

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [series, setSeries] = useState<OverviewSeries | null>(null);
  const [activity, setActivity] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const [statsResult, overviewResult, activityResult] = await Promise.all([
          getDashboardStats(),
          getDashboardOverview(),
          listActivity(8),
        ]);
        if (cancelled) return;
        setStats(statsResult);
        setSeries(overviewResult);
        setActivity(activityResult);
      } catch {
        if (!cancelled) toast.error('Could not load your dashboard.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const shortcuts = useMemo(
    () => navItemsFor(role).filter(item => item.path !== roleHome(role)),
    [role],
  );

  const charts = useMemo<BarSeries[]>(() => {
    if (!series) return [];
    const all: BarSeries[] = [
      { title: 'Cases by status', data: series.casesByStatus },
      { title: 'Consultations by status', data: series.consultationsByStatus },
      { title: 'Appointments — last 6 months', data: series.appointmentsByMonth },
    ];
    if (role === 'client') return all.slice(2);
    if (role === 'staff') return all.slice(0, 2);
    return all;
  }, [series, role]);

  if (loading && !stats) return <PageLoader label="Preparing your dashboard…" />;

  const cards = KPI_ORDER.filter(entry => KPI_KEYS[role].includes(entry.key)).map(entry => ({
    ...entry,
    value:
      entry.key === 'unreadNotifications'
        ? unread
        : (stats?.[entry.key] as number | undefined) ?? 0,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title={title ?? `Welcome back, ${user?.name?.split(' ')[0] ?? 'there'}`}
        subtitle={
          subtitle ?? `${ROLE_LABELS[role]} workspace — everything below is scoped to you.`
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {cards.map(card => (
          <KPICard key={String(card.key)} label={card.label} value={card.value} icon={card.icon} />
        ))}
      </div>

      {charts.length > 0 ? (
        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {charts.map(chart => {
            const max = Math.max(1, ...chart.data.map(point => point.value));
            return (
              <GlassCard key={chart.title} className="space-y-3">
                <p className="text-sm text-white font-medium">{chart.title}</p>
                <div className="space-y-2">
                  {chart.data.map(point => (
                    <div key={point.label} className="space-y-1">
                      <div className="flex items-center justify-between text-[11px] text-text-muted">
                        <span>{humanize(point.label)}</span>
                        <span className="tabular-nums">{point.value}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-gold to-gold-light"
                          style={{ width: `${(point.value / max) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </GlassCard>
            );
          })}
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <GlassCard className="space-y-3 lg:col-span-2">
          <p className="text-sm text-white font-medium inline-flex items-center gap-2">
            <Activity size={16} className="text-gold" />
            Recent activity
          </p>
          {activity.length === 0 ? (
            <p className="text-sm text-text-secondary">Nothing recorded yet.</p>
          ) : (
            <ul className="space-y-2.5">
              {activity.map(entry => (
                <li
                  key={entry.id}
                  className="flex items-start justify-between gap-3 border-b border-white/5 pb-2.5 last:border-0 last:pb-0"
                >
                  <span className="min-w-0">
                    <span className="block text-sm text-white truncate">{entry.details}</span>
                    <span className="block text-[11px] text-text-muted">
                      {humanize(entry.action)}
                      {entry.userName ? ` · ${entry.userName}` : ''}
                    </span>
                  </span>
                  <span className="text-[11px] text-text-muted flex-shrink-0">
                    {relativeTime(entry.createdAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </GlassCard>

        <GlassCard className="space-y-3">
          <p className="text-sm text-white font-medium inline-flex items-center gap-2">
            <Scale size={16} className="text-gold" />
            Shortcuts
          </p>
          <div className="space-y-2">
            {shortcuts.map(item => {
              const Icon = NAV_ICONS[item.icon] ?? Scale;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 px-3.5 py-2.5 text-sm text-text-secondary hover:text-white hover:border-gold/25 transition-colors"
                >
                  <span className="inline-flex items-center gap-2">
                    <Icon size={16} className="text-gold" />
                    {item.label}
                  </span>
                  <ArrowUpRight size={15} />
                </Link>
              );
            })}
          </div>
        </GlassCard>
      </div>
    </div>
  );
};

export default DashboardOverview;
