import React, { useEffect, useMemo, useState } from 'react';
import {
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Pencil,
  Plus,
  Trash2,
  XCircle,
} from 'lucide-react';
import {
  Button,
  ConfirmDialog,
  EmptyState,
  GlassCard,
  KPICard,
  PageHeader,
  PageLoader,
  SearchInput,
  Select,
  StatusBadge,
  Table,
  Tabs,
  Td,
  Tr,
} from '../../components/UI';
import { toast, useAppointmentStore, useAuthStore, useDirectoryStore } from '../../stores';
import type { Appointment, AppointmentStatus } from '../../types';
import { formatDate, formatTime, shortName } from '../../utils/format';
import { AppointmentFormModal } from './AppointmentFormModal';

/**
 * Appointments workbench.
 *
 * Powers the admin diary, the lawyer's own schedule, the front-desk queue and
 * the client portal. `scope` decides which rows are shown, `initialView`
 * decides whether the week grid or the list opens first — both stay reachable
 * through the view toggle.
 *
 * Status changes go through `useAppointmentStore.setStatus`, which calls
 * `PATCH /appointments/:id/status` so the API can notify the client.
 */

const STATUS_TABS: { id: AppointmentStatus | ''; label: string }[] = [
  { id: '', label: 'All' },
  { id: 'scheduled', label: 'Scheduled' },
  { id: 'confirmed', label: 'Confirmed' },
  { id: 'rescheduled', label: 'Rescheduled' },
  { id: 'completed', label: 'Completed' },
  { id: 'cancelled', label: 'Cancelled' },
];

const COLUMNS = [
  { key: 'when', label: 'When' },
  { key: 'client', label: 'Client' },
  { key: 'lawyer', label: 'Lawyer' },
  { key: 'status', label: 'Status' },
  { key: 'notes', label: 'Notes' },
  { key: 'actions', label: '', className: 'text-right' },
];

const RANGE_FILTERS = [
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'Next 7 days' },
  { value: 'past', label: 'Past' },
  { value: 'all', label: 'All dates' },
];

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** `YYYY-MM-DD` for a `Date`, in local time. */
function isoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

/** Monday of the week containing `date`. */
function startOfWeek(date: Date): Date {
  const day = date.getDay();
  return addDays(date, day === 0 ? -6 : 1 - day);
}

export type AppointmentScope = 'firm' | 'mine' | 'self';

export interface AppointmentsWorkbenchProps {
  title?: string;
  subtitle?: string;
  scope?: AppointmentScope;
  /** Client portal: the client comes from the session. */
  lockedClientId?: number;
  /** Staff/lawyer: pre-selects the signed-in lawyer when booking. */
  defaultLawyerId?: number;
  initialView?: 'list' | 'calendar';
  canCreate?: boolean;
}

export const AppointmentsWorkbench: React.FC<AppointmentsWorkbenchProps> = ({
  title = 'Appointments',
  subtitle = 'Every consultation the firm has booked.',
  scope = 'firm',
  lockedClientId,
  defaultLawyerId,
  initialView = 'list',
  canCreate = true,
}) => {
  const user = useAuthStore(state => state.user);
  const canWrite = useAuthStore(state => state.hasPermission('appointments.write'));

  const items = useAppointmentStore(state => state.items);
  const loading = useAppointmentStore(state => state.loading);
  const fetchAppointments = useAppointmentStore(state => state.fetchAppointments);
  const setStatus = useAppointmentStore(state => state.setStatus);
  const remove = useAppointmentStore(state => state.remove);

  const users = useDirectoryStore(state => state.users);
  const loadUsers = useDirectoryStore(state => state.loadUsers);

  const [view, setView] = useState<'list' | 'calendar'>(initialView);
  const [tab, setTab] = useState<AppointmentStatus | ''>('');
  const [range, setRange] = useState('upcoming');
  const [lawyerId, setLawyerId] = useState(scope === 'mine' ? String(user?.id ?? '') : '');
  const [query, setQuery] = useState('');
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [editing, setEditing] = useState<Appointment | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [pendingCancel, setPendingCancel] = useState<Appointment | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Appointment | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  useEffect(() => {
    void fetchAppointments(scope === 'self' ? { clientId: lockedClientId } : {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchAppointments, scope, lockedClientId]);

  const lawyers = useMemo(() => users.filter(entry => entry.role === 'lawyer'), [users]);

  const lawyerOptions = useMemo(
    () => lawyers.map(entry => ({ value: String(entry.id), label: entry.name })),
    [lawyers],
  );

  const scoped = useMemo(() => {
    if (scope === 'self' && lockedClientId !== undefined) {
      return items.filter(entry => entry.clientId === lockedClientId);
    }
    if (scope === 'mine' && user) return items.filter(entry => entry.lawyerId === user.id);
    return items;
  }, [items, scope, user, lockedClientId]);

  /* Status tabs come from the API; range, lawyer and search are local. */
  const visible = useMemo(() => {
    const today = isoDate(new Date());
    const horizon = isoDate(addDays(new Date(), 7));
    const needle = query.trim().toLowerCase();

    return scoped
      .filter(entry => (tab ? entry.status === tab : true))
      .filter(entry => (lawyerId ? String(entry.lawyerId) === lawyerId : true))
      .filter(entry => {
        if (range === 'all') return true;
        if (range === 'today') return entry.date === today;
        if (range === 'week') return entry.date >= today && entry.date <= horizon;
        if (range === 'past') return entry.date < today;
        return entry.date >= today;
      })
      .filter(entry =>
        needle
          ? [entry.clientName, entry.lawyerName, entry.notes]
              .filter(Boolean)
              .some(value => String(value).toLowerCase().includes(needle))
          : true,
      )
      .sort((a, b) =>
        a.date === b.date ? a.startTime.localeCompare(b.startTime) : a.date.localeCompare(b.date),
      );
  }, [scoped, tab, lawyerId, range, query]);

  const counts = useMemo(() => {
    const today = isoDate(new Date());
    return {
      today: scoped.filter(entry => entry.date === today).length,
      upcoming: scoped.filter(
        entry => entry.date > today && entry.status !== 'cancelled' && entry.status !== 'completed',
      ).length,
      pending: scoped.filter(
        entry => entry.status === 'scheduled' || entry.status === 'rescheduled',
      ).length,
      cancelled: scoped.filter(entry => entry.status === 'cancelled').length,
    };
  }, [scoped]);

  const tabs = useMemo(
    () =>
      STATUS_TABS.map(entry => ({
        id: entry.id,
        label: entry.label,
        count: entry.id === '' ? scoped.length : scoped.filter(row => row.status === entry.id).length,
      })),
    [scoped],
  );

  /* The week grid always shows the full week, ignoring the range filter. */
  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_value, index) => addDays(weekStart, index)),
    [weekStart],
  );

  const weekAppointments = useMemo(() => {
    const isoDays = weekDays.map(isoDate);
    return scoped
      .filter(entry => isoDays.includes(entry.date))
      .filter(entry => (lawyerId ? String(entry.lawyerId) === lawyerId : true))
      .filter(entry => (tab ? entry.status === tab : true))
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
  }, [scoped, weekDays, lawyerId, tab]);

  /* --------------------------------------------------------------- handlers */

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const openEdit = (item: Appointment) => {
    setEditing(item);
    setFormOpen(true);
  };

  const changeStatus = async (item: Appointment, next: AppointmentStatus, reason?: string) => {
    try {
      await setStatus(item.id, next, reason);
      toast.success(`Appointment with ${shortName(item.clientName) || 'the client'} is now ${next}.`);
    } catch {
      toast.error('Could not update the appointment.');
    }
  };

  const confirmCancel = async () => {
    if (!pendingCancel) return;
    setBusy(true);
    try {
      await changeStatus(pendingCancel, 'cancelled', 'Cancelled from the appointments workbench.');
      setPendingCancel(null);
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setBusy(true);
    try {
      await remove(pendingDelete.id);
      toast.success('Appointment removed.');
      setPendingDelete(null);
    } catch {
      toast.error('Could not delete the appointment.');
    } finally {
      setBusy(false);
    }
  };

  if (loading && scoped.length === 0) return <PageLoader label="Loading the diary…" />;

  return (
    <div className="space-y-6">
      <PageHeader
        title={title}
        subtitle={subtitle}
        actions={
          canCreate && canWrite ? (
            <Button icon={Plus} onClick={openCreate}>
              Book appointment
            </Button>
          ) : undefined
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          label="Today"
          value={counts.today}
          icon={CalendarClock}
          hint="Appointments on the calendar"
        />
        <KPICard label="Upcoming" value={counts.upcoming} icon={CalendarDays} tone="info" />
        <KPICard
          label="Awaiting confirmation"
          value={counts.pending}
          icon={Clock}
          tone="gold"
          hint="Scheduled or rescheduled"
        />
        <KPICard label="Cancelled" value={counts.cancelled} icon={XCircle} tone="danger" />
      </div>

      <GlassCard className="space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center gap-3">
          <SearchInput
            value={query}
            onChange={setQuery}
            placeholder="Search by client, lawyer or note…"
            className="lg:flex-1"
          />
          <Select
            value={range}
            onChange={event => setRange(event.target.value)}
            options={RANGE_FILTERS}
            aria-label="Filter by date range"
            className="lg:w-44"
          />
          {scope !== 'mine' && (
            <Select
              value={lawyerId}
              onChange={event => setLawyerId(event.target.value)}
              options={lawyerOptions}
              placeholder="Any lawyer"
              aria-label="Filter by lawyer"
              className="lg:w-52"
            />
          )}
          <div className="flex items-center gap-1.5">
            <Button
              variant={view === 'list' ? 'primary' : 'secondary'}
              icon={CalendarClock}
              onClick={() => setView('list')}
            >
              List
            </Button>
            <Button
              variant={view === 'calendar' ? 'primary' : 'secondary'}
              icon={CalendarDays}
              onClick={() => setView('calendar')}
            >
              Week
            </Button>
          </div>
        </div>

        <Tabs tabs={tabs} active={tab} onChange={id => setTab(id as AppointmentStatus | '')} />

        {view === 'calendar' ? (
          <WeekGrid
            days={weekDays}
            appointments={weekAppointments}
            onShift={offset => setWeekStart(current => addDays(current, offset * 7))}
            onSelect={openEdit}
          />
        ) : loading ? (
          <PageLoader label="Refreshing…" />
        ) : visible.length === 0 ? (
          <EmptyState
            icon={CalendarClock}
            title="No appointments here"
            description={
              canCreate && canWrite
                ? 'Book a slot, or widen the date range to see the rest of the diary.'
                : 'Nothing is scheduled in this window yet.'
            }
            action={
              canCreate && canWrite ? (
                <Button icon={Plus} onClick={openCreate}>
                  Book appointment
                </Button>
              ) : undefined
            }
          />
        ) : (
          <Table columns={COLUMNS}>
            {visible.map(item => (
              <Tr key={item.id} onClick={() => openEdit(item)}>
                <Td className="whitespace-nowrap text-white font-medium">
                  {formatDate(item.date)}
                  <span className="block text-xs text-text-muted">
                    {formatTime(item.startTime)} – {formatTime(item.endTime)}
                  </span>
                </Td>
                <Td className="whitespace-nowrap">{item.clientName ?? `Client #${item.clientId}`}</Td>
                <Td className="whitespace-nowrap">{item.lawyerName ?? 'Unassigned'}</Td>
                <Td>
                  <StatusBadge status={item.status} />
                </Td>
                <Td className="max-w-[16rem]">
                  <span className="line-clamp-1 text-text-muted">{item.notes || '—'}</span>
                </Td>
                <Td className="text-right">
                  <div
                    className="flex items-center justify-end gap-1"
                    onClick={event => event.stopPropagation()}
                  >
                    {canWrite && item.status !== 'confirmed' && item.status !== 'cancelled' && (
                      <button
                        type="button"
                        onClick={() => void changeStatus(item, 'confirmed')}
                        aria-label="Confirm appointment"
                        title="Confirm"
                        className="p-2 rounded-lg text-text-muted hover:text-success hover:bg-white/5 transition-colors"
                      >
                        <CheckCircle2 size={15} />
                      </button>
                    )}
                    {canWrite && (
                      <button
                        type="button"
                        onClick={() => openEdit(item)}
                        aria-label="Reschedule appointment"
                        title="Reschedule"
                        className="p-2 rounded-lg text-text-muted hover:text-gold hover:bg-white/5 transition-colors"
                      >
                        <Pencil size={15} />
                      </button>
                    )}
                    {canWrite && item.status !== 'cancelled' && (
                      <button
                        type="button"
                        onClick={() => setPendingCancel(item)}
                        aria-label="Cancel appointment"
                        title="Cancel"
                        className="p-2 rounded-lg text-text-muted hover:text-warning hover:bg-white/5 transition-colors"
                      >
                        <XCircle size={15} />
                      </button>
                    )}
                    {canWrite && (
                      <button
                        type="button"
                        onClick={() => setPendingDelete(item)}
                        aria-label="Delete appointment"
                        title="Delete"
                        className="p-2 rounded-lg text-text-muted hover:text-danger hover:bg-white/5 transition-colors"
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                </Td>
              </Tr>
            ))}
          </Table>
        )}
      </GlassCard>

      <ConfirmDialog
        isOpen={pendingCancel !== null}
        title="Cancel appointment"
        message={`Cancel the appointment with ${shortName(pendingCancel?.clientName) || 'this client'}? They will be notified.`}
        confirmLabel="Cancel appointment"
        busy={busy}
        onConfirm={() => void confirmCancel()}
        onCancel={() => setPendingCancel(null)}
      />

      <ConfirmDialog
        isOpen={pendingDelete !== null}
        title="Delete appointment"
        message="Delete this appointment permanently? The client's records keep the history, but the slot is freed."
        confirmLabel="Delete appointment"
        danger
        busy={busy}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setPendingDelete(null)}
      />

      <AppointmentFormModal
        isOpen={formOpen}
        onClose={() => setFormOpen(false)}
        appointment={editing}
        lockedClientId={lockedClientId}
        defaultLawyerId={defaultLawyerId ?? (scope === 'mine' ? user?.id : undefined)}
      />
    </div>
  );
};

/* --------------------------------------------------------------- sub-views */

interface WeekGridProps {
  days: Date[];
  appointments: Appointment[];
  onShift: (offset: number) => void;
  onSelect: (item: Appointment) => void;
}

/** Seven-column week board; each cell lists the day's appointments. */
const WeekGrid: React.FC<WeekGridProps> = ({ days, appointments, onShift, onSelect }) => {
  const today = isoDate(new Date());
  const label = `${formatDate(days[0])} – ${formatDate(days[days.length - 1])}`;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <Button variant="ghost" icon={ChevronLeft} onClick={() => onShift(-1)} aria-label="Previous week">
          Previous
        </Button>
        <p className="text-sm text-text-secondary">{label}</p>
        <Button variant="ghost" icon={ChevronRight} onClick={() => onShift(1)} aria-label="Next week">
          Next
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-7 gap-2">
        {days.map((day, index) => {
          const iso = isoDate(day);
          const dayItems = appointments.filter(entry => entry.date === iso);
          return (
            <div
              key={iso}
              className={`rounded-xl border p-2 min-h-[8rem] ${
                iso === today ? 'border-gold/40 bg-gold/5' : 'border-white/10 bg-white/[0.02]'
              }`}
            >
              <p className="text-[11px] uppercase tracking-wide text-text-muted">{WEEKDAYS[index]}</p>
              <p className="text-sm text-white font-medium">{formatDate(day)}</p>

              <div className="mt-2 space-y-1.5">
                {dayItems.map(item => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onSelect(item)}
                    className="w-full text-left rounded-lg bg-white/5 hover:bg-white/10 px-2 py-1.5 transition-colors"
                  >
                    <span className="block text-[11px] text-gold">{formatTime(item.startTime)}</span>
                    <span className="block text-xs text-white truncate">
                      {item.clientName ?? `Client #${item.clientId}`}
                    </span>
                    <span className="block text-[10px] text-text-muted truncate">
                      {item.lawyerName ?? 'Unassigned'}
                    </span>
                  </button>
                ))}
                {dayItems.length === 0 && <p className="text-[11px] text-text-muted">—</p>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default AppointmentsWorkbench;
