import React, { useEffect, useMemo, useState } from 'react';
import { CalendarDays, Clock, Save } from 'lucide-react';
import {
  Button,
  Field,
  GlassCard,
  KPICard,
  PageHeader,
  PageLoader,
  Select,
} from '../../components/UI';
import { listAvailability, saveAvailability } from '../../services';
import { toast, useAuthStore, useDirectoryStore } from '../../stores';
import type { Availability } from '../../types';

/**
 * Weekly availability editor.
 *
 * A lawyer publishes the hours they can be booked for; the booking modal and
 * the AI recommender both read this grid. Saving replaces the whole week in one
 * call (`PUT /availability`), so the local state is the single source of truth
 * between loads.
 */

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

interface DayRow {
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  isAvailable: boolean;
}

const defaultRow = (dayOfWeek: string): DayRow => ({
  dayOfWeek,
  startTime: '09:00',
  endTime: '17:00',
  isAvailable: !['Saturday', 'Sunday'].includes(dayOfWeek),
});

export interface AvailabilityEditorProps {
  /** Admin editing someone else's grid; defaults to the signed-in lawyer. */
  lawyerId?: number;
  title?: string;
  subtitle?: string;
}

export const AvailabilityEditor: React.FC<AvailabilityEditorProps> = ({
  lawyerId,
  title = 'My availability',
  subtitle = 'The hours clients can book you for.',
}) => {
  const user = useAuthStore(state => state.user);
  const isAdmin = useAuthStore(state => state.hasRole('admin'));

  const users = useDirectoryStore(state => state.users);
  const loadUsers = useDirectoryStore(state => state.loadUsers);

  const [targetId, setTargetId] = useState<string>(String(lawyerId ?? user?.id ?? ''));
  const [rows, setRows] = useState<DayRow[]>(() => WEEKDAYS.map(defaultRow));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const lawyers = useMemo(() => users.filter(entry => entry.role === 'lawyer'), [users]);

  const lawyerOptions = useMemo(
    () => lawyers.map(entry => ({ value: String(entry.id), label: entry.name })),
    [lawyers],
  );

  useEffect(() => {
    if (isAdmin) void loadUsers();
  }, [isAdmin, loadUsers]);

  useEffect(() => {
    setTargetId(String(lawyerId ?? user?.id ?? ''));
  }, [lawyerId, user?.id]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const entries = await listAvailability(targetId ? Number(targetId) : undefined);
        if (cancelled) return;
        setRows(
          WEEKDAYS.map(day => {
            const match = entries.find(entry => entry.dayOfWeek === day);
            return match
              ? {
                  dayOfWeek: day,
                  startTime: match.startTime,
                  endTime: match.endTime,
                  isAvailable: match.isAvailable,
                }
              : defaultRow(day);
          }),
        );
      } catch {
        if (!cancelled) toast.error('Could not load the availability grid.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [targetId, lawyerId, isAdmin]);

  const update = (dayOfWeek: string, patch: Partial<DayRow>) => {
    setRows(current =>
      current.map(row => (row.dayOfWeek === dayOfWeek ? { ...row, ...patch } : row)),
    );
  };

  const save = async () => {
    const target = Number(targetId);
    if (!target) {
      toast.error('Choose the lawyer whose grid you are editing.');
      return;
    }

    const invalid = rows.find(row => row.isAvailable && row.startTime >= row.endTime);
    if (invalid) {
      toast.error(`${invalid.dayOfWeek}: the end time must be after the start time.`);
      return;
    }

    const targetLawyer = lawyers.find(entry => entry.id === target);
    const entries: Availability[] = rows.map(row => ({
      id: 0,
      lawyerId: target,
      lawyerName: targetLawyer?.name ?? user?.name ?? '',
      dayOfWeek: row.dayOfWeek,
      startTime: row.startTime,
      endTime: row.endTime,
      isAvailable: row.isAvailable,
    }));

    setSaving(true);
    try {
      await saveAvailability(entries);
      toast.success('Availability saved.');
    } catch {
      toast.error('Could not save the availability grid.');
    } finally {
      setSaving(false);
    }
  };

  const openDays = rows.filter(row => row.isAvailable).length;
  const weeklyHours = rows
    .filter(row => row.isAvailable)
    .reduce((total, row) => {
      const [sh, sm] = row.startTime.split(':').map(Number);
      const [eh, em] = row.endTime.split(':').map(Number);
      return total + Math.max(0, eh * 60 + em - (sh * 60 + sm)) / 60;
    }, 0);

  if (loading && rows.length === 0) return <PageLoader label="Loading your week…" />;

  return (
    <div className="space-y-6">
      <PageHeader
        title={title}
        subtitle={subtitle}
        actions={
          <Button onClick={() => void save()} loading={saving}>
            <Save size={16} />
            Save week
          </Button>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <KPICard label="Open days" value={openDays} icon={CalendarDays} />
        <KPICard
          label="Weekly hours"
          value={`${Math.round(weeklyHours)}h`}
          icon={Clock}
          tone="info"
        />
        <KPICard label="Closed days" value={7 - openDays} icon={CalendarDays} tone="danger" />
      </div>

      <GlassCard className="space-y-4">
        {isAdmin ? (
          <Field label="Lawyer" hint="Administrators can prepare a grid for any lawyer.">
            <Select
              options={lawyerOptions}
              placeholder="Choose a lawyer…"
              value={targetId}
              onChange={event => setTargetId(event.target.value)}
            />
          </Field>
        ) : null}

        <div className="space-y-2.5">
          {rows.map(row => (
            <div
              key={row.dayOfWeek}
              className={`grid gap-3 sm:grid-cols-[130px_1fr_1fr_150px] items-center rounded-xl border px-3.5 py-3 transition-colors ${
                row.isAvailable ? 'border-gold/20 bg-gold/5' : 'border-white/10 bg-white/5'
              }`}
            >
              <span className="text-sm font-medium text-white">{row.dayOfWeek}</span>
              <input
                type="time"
                value={row.startTime}
                disabled={!row.isAvailable}
                onChange={event => update(row.dayOfWeek, { startTime: event.target.value })}
                className="glass-input w-full px-3 py-2 text-sm disabled:opacity-40"
                aria-label={`${row.dayOfWeek} start time`}
              />
              <input
                type="time"
                value={row.endTime}
                disabled={!row.isAvailable}
                onChange={event => update(row.dayOfWeek, { endTime: event.target.value })}
                className="glass-input w-full px-3 py-2 text-sm disabled:opacity-40"
                aria-label={`${row.dayOfWeek} end time`}
              />
              <Button
                variant={row.isAvailable ? 'secondary' : 'ghost'}
                onClick={() => update(row.dayOfWeek, { isAvailable: !row.isAvailable })}
              >
                {row.isAvailable ? 'Available' : 'Closed'}
              </Button>
            </div>
          ))}
        </div>

        <p className="text-xs text-text-muted">
          Slots are generated from this grid in 30-minute steps; an appointment request outside
          these hours is refused by the API.
        </p>
      </GlassCard>
    </div>
  );
};

export default AvailabilityEditor;
