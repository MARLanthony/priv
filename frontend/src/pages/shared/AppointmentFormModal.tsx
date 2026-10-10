import React, { useEffect, useMemo, useState } from 'react';
import { CalendarClock } from 'lucide-react';
import { Button, Field, Input, Modal, Select, TextArea } from '../../components/UI';
import { toast, useAppointmentStore, useDirectoryStore } from '../../stores';
import type { Appointment } from '../../types';

/** Adds minutes to a `HH:MM` clock string (wrapping at midnight). */
function addMinutes(time: string, minutes: number): string {
  const [hours, mins] = time.split(':').map(value => Number(value));
  if (Number.isNaN(hours) || Number.isNaN(mins)) return time;
  const total = (hours * 60 + mins + minutes) % (24 * 60);
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

/** Whole minutes between two `HH:MM` clock strings (never negative). */
export function minutesBetween(start: string, end: string): number {
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  if ([sh, sm, eh, em].some(Number.isNaN)) return 0;
  return Math.max(0, eh * 60 + em - (sh * 60 + sm));
}

/** Today as `YYYY-MM-DD`, the default for the date picker. */
function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export interface AppointmentFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  appointment?: Appointment | null;
  /** Client portal: the client comes from the session token. */
  lockedClientId?: number;
  defaultLawyerId?: number;
  /** Consultation being scheduled (set when staff accept an intake). */
  consultationId?: number | null;
}

/**
 * Book or move an appointment.
 *
 * The start time is picked from the lawyer's real free slots
 * (`GET /appointments/slots`); when the lawyer has published no availability
 * yet the field falls back to a manual time input so nothing is blocked.
 */
export const AppointmentFormModal: React.FC<AppointmentFormModalProps> = ({
  isOpen,
  onClose,
  appointment = null,
  lockedClientId,
  defaultLawyerId,
  consultationId = null,
}) => {
  const book = useAppointmentStore(state => state.book);
  const update = useAppointmentStore(state => state.update);
  const slots = useAppointmentStore(state => state.slots);
  const loadSlots = useAppointmentStore(state => state.loadSlots);
  const saving = useAppointmentStore(state => state.saving);

  const users = useDirectoryStore(state => state.users);
  const clients = useDirectoryStore(state => state.clients);
  const loadUsers = useDirectoryStore(state => state.loadUsers);
  const loadClients = useDirectoryStore(state => state.loadClients);

  const [clientId, setClientId] = useState('');
  const [lawyerId, setLawyerId] = useState('');
  const [date, setDate] = useState(today());
  const [startTime, setStartTime] = useState('');
  const [duration, setDuration] = useState(60);
  const [notes, setNotes] = useState('');
  const [loadingSlots, setLoadingSlots] = useState(false);

  const lawyers = useMemo(() => users.filter(user => user.role === 'lawyer'), [users]);
  const lawyerOptions = useMemo(
    () => lawyers.map(lawyer => ({ value: String(lawyer.id), label: lawyer.name })),
    [lawyers],
  );
  const clientOptions = useMemo(
    () => clients.map(client => ({ value: String(client.id), label: client.fullName })),
    [clients],
  );

  useEffect(() => {
    if (!isOpen) return;
    void loadUsers();
    if (lockedClientId === undefined) void loadClients();

    setClientId(String(appointment?.clientId ?? lockedClientId ?? ''));
    setLawyerId(String(appointment?.lawyerId ?? defaultLawyerId ?? ''));
    setDate(appointment?.date ?? today());
    setStartTime(appointment?.startTime ?? '');
    setDuration(
      appointment?.startTime && appointment?.endTime
        ? Math.max(30, minutesBetween(appointment.startTime, appointment.endTime))
        : 60,
    );
    setNotes(appointment?.notes ?? '');
  }, [isOpen, appointment, lockedClientId, defaultLawyerId, loadUsers, loadClients]);

  // Fetch the lawyer's free slots whenever the day or the lawyer changes.
  useEffect(() => {
    if (!isOpen) return;
    const numericLawyer = Number(lawyerId);
    if (!numericLawyer || !date) return;

    let active = true;
    setLoadingSlots(true);
    void loadSlots(numericLawyer, date).finally(() => {
      if (active) setLoadingSlots(false);
    });
    return () => {
      active = false;
    };
  }, [isOpen, lawyerId, date, loadSlots]);

  const freeSlots = useMemo(
    () =>
      Array.from(new Set(slots.filter(slot => slot.available).map(slot => slot.time))).sort((a, b) =>
        a.localeCompare(b),
      ),
    [slots],
  );

  const slotOptions = freeSlots.map(time => ({ value: time, label: time }));

  const durationOptions = [
    { value: '30', label: '30 minutes' },
    { value: '45', label: '45 minutes' },
    { value: '60', label: '1 hour' },
    { value: '90', label: '1 hour 30 minutes' },
    { value: '120', label: '2 hours' },
  ];

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();

    const resolvedClientId = lockedClientId ?? Number(clientId);
    const numericLawyer = Number(lawyerId);

    if (lockedClientId === undefined && !resolvedClientId) {
      toast.error('Choose the client to book for.');
      return;
    }
    if (!numericLawyer) {
      toast.error('Choose the lawyer who will take the meeting.');
      return;
    }
    if (!date || !startTime) {
      toast.error('Pick the date and the start time.');
      return;
    }

    const payload = {
      clientId: lockedClientId === undefined ? resolvedClientId : undefined,
      consultationId: appointment?.consultationId ?? consultationId ?? null,
      lawyerId: numericLawyer,
      date,
      startTime,
      endTime: addMinutes(startTime, duration),
      notes: notes.trim() || undefined,
    };

    try {
      if (appointment) {
        await update(appointment.id, payload);
        toast.success('Appointment updated.');
      } else {
        await book(payload);
        toast.success('Appointment booked.');
      }
      onClose();
    } catch {
      toast.error('The appointment could not be saved.');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={appointment ? 'Reschedule appointment' : 'Book an appointment'}
      subtitle="Free slots come from the lawyer's published weekly availability."
      maxWidth="max-w-2xl"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" form="appointment-form" icon={CalendarClock} loading={saving}>
            {appointment ? 'Save changes' : 'Confirm booking'}
          </Button>
        </>
      }
    >
      <form id="appointment-form" onSubmit={submit} className="space-y-4" noValidate>
        {lockedClientId === undefined ? (
          <Field label="Client" required>
            <Select
              value={clientId}
              onChange={event => setClientId(event.target.value)}
              options={clientOptions}
              placeholder="Select a client…"
            />
          </Field>
        ) : (
          <Field label="Client">
            <Input
              value={clients.find(client => client.id === lockedClientId)?.fullName ?? 'Your account'}
              disabled
            />
          </Field>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Lawyer" required>
            <Select
              value={lawyerId}
              onChange={event => setLawyerId(event.target.value)}
              options={lawyerOptions}
              placeholder="Select a lawyer…"
            />
          </Field>
          <Field label="Date" required>
            <Input type="date" value={date} onChange={event => setDate(event.target.value)} />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Start time"
            required
            hint={
              loadingSlots
                ? 'Loading free slots…'
                : lawyerId
                  ? freeSlots.length > 0
                    ? `${freeSlots.length} free slot(s) on ${date}`
                    : 'No published availability — enter a time manually.'
                  : 'Choose a lawyer to see their free slots.'
            }
          >
            {freeSlots.length > 0 ? (
              <Select
                value={startTime}
                onChange={event => setStartTime(event.target.value)}
                options={slotOptions}
                placeholder="Select a slot…"
              />
            ) : (
              <Input type="time" value={startTime} onChange={event => setStartTime(event.target.value)} />
            )}
          </Field>
          <Field label="Duration">
            <Select
              value={String(duration)}
              onChange={event => setDuration(Number(event.target.value))}
              options={durationOptions}
            />
          </Field>
        </div>

        {startTime && (
          <p className="text-xs text-text-muted">
            Ends at <span className="text-text-secondary tabular-nums">{addMinutes(startTime, duration)}</span>
          </p>
        )}

        <Field label="Notes" hint="Agenda, documents to bring, dial-in details.">
          <TextArea
            rows={3}
            value={notes}
            onChange={event => setNotes(event.target.value)}
            placeholder="Initial consultation — bring the signed contract."
          />
        </Field>
      </form>
    </Modal>
  );
};

export default AppointmentFormModal;


