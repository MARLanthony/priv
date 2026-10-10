/* ==========================================================================
   Appointment + availability handlers — `/api/appointments`, `/api/availability`
   --------------------------------------------------------------------------
   Booking is open to every role: a client books against an approved
   consultation, the front desk books on their behalf, and a lawyer publishes
   the weekly grid the free slots are cut from.
   ========================================================================== */

import { http } from 'msw';
import { db, newId } from '../db';
import type { Appointment, AppointmentSlot, AppointmentStatus, Availability } from '../../types';
import {
  asNumber,
  asString,
  badRequest,
  clientRecordFor,
  currentUser,
  forbidden,
  latency,
  notFound,
  notify,
  ok,
  query,
  readJson,
  recordActivity,
  unauthorized,
} from '../utils';

interface AppointmentBody {
  clientId?: number;
  consultationId?: number | null;
  lawyerId: number | null;
  date: string;
  startTime: string;
  endTime: string;
  status?: AppointmentStatus;
  notes?: string;
}

const STATUSES: AppointmentStatus[] = [
  'scheduled',
  'confirmed',
  'rescheduled',
  'completed',
  'cancelled',
];

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const toMinutes = (time: string): number => {
  const [hours, minutes] = time.split(':').map(Number);
  return (hours || 0) * 60 + (minutes || 0);
};

const toTime = (minutes: number): string =>
  `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;

const weekdayOf = (date: string): string => DAY_NAMES[new Date(`${date}T00:00:00`).getDay()];

function userIdOfClient(clientId: number): number | undefined {
  return db.clients.find(client => client.id === clientId)?.userId;
}

/** Keeps the client, their own file and the front desk in the loop. */
function announce(appointment: Appointment, message: string): void {
  const clientUserId = userIdOfClient(appointment.clientId);
  if (clientUserId) notify(clientUserId, 'appointment', message);
  if (appointment.lawyerId) notify(appointment.lawyerId, 'appointment', message);
}

export const appointmentHandlers = [
  /** `GET /appointments?status=&clientId=&lawyerId=&from=&to=` */
  http.get('/api/appointments', async ({ request }) => {
    await latency();
    const actor = currentUser(request);
    if (!actor) return unauthorized();

    const status = query(request, 'status');
    const clientId = asNumber(query(request, 'clientId'));
    const lawyerId = asNumber(query(request, 'lawyerId'));
    const from = query(request, 'from');
    const to = query(request, 'to');

    let rows = db.appointments;
    if (actor.role === 'client') {
      const own = clientRecordFor(actor);
      rows = own ? rows.filter(item => item.clientId === own.id) : [];
    } else if (actor.role === 'lawyer') {
      rows = rows.filter(item => item.lawyerId === actor.id);
    }

    const result = rows
      .filter(item => (status ? item.status === status : true))
      .filter(item => (clientId ? item.clientId === clientId : true))
      .filter(item => (lawyerId ? item.lawyerId === lawyerId : true))
      .filter(item => (from ? item.date >= from : true))
      .filter(item => (to ? item.date <= to : true))
      .sort((a, b) => `${a.date} ${a.startTime}`.localeCompare(`${b.date} ${b.startTime}`));

    return ok(result);
  }),

  /**
   * `GET /appointments/slots?lawyerId=&date=`
   * One-hour slots cut from the lawyer's weekly grid, minus what is booked.
   */
  http.get('/api/appointments/slots', async ({ request }) => {
    await latency(120);
    if (!currentUser(request)) return unauthorized();

    const lawyerId = asNumber(query(request, 'lawyerId'));
    const date = query(request, 'date');
    if (!date) return badRequest('A date is required to list slots.');

    const day = weekdayOf(date);
    const windows = db.availability.filter(
      entry =>
        entry.dayOfWeek === day &&
        entry.isAvailable &&
        (lawyerId ? entry.lawyerId === lawyerId : true),
    );

    const taken = db.appointments
      .filter(item => item.date === date && item.status !== 'cancelled')
      .filter(item => (lawyerId ? item.lawyerId === lawyerId : true))
      .map(item => `${item.lawyerId}:${item.startTime}`);

    const slots: AppointmentSlot[] = [];
    windows.forEach(window => {
      for (let minute = toMinutes(window.startTime); minute < toMinutes(window.endTime); minute += 60) {
        const time = toTime(minute);
        slots.push({
          date,
          time,
          available: !taken.includes(`${window.lawyerId}:${time}`),
        });
      }
    });

    // Same time offered by two lawyers is bookable as long as one is free.
    const merged = new Map<string, AppointmentSlot>();
    slots.forEach(slot => {
      const existing = merged.get(slot.time);
      if (!existing || (!existing.available && slot.available)) merged.set(slot.time, slot);
    });

    return ok(
      Array.from(merged.values()).sort((a, b) => a.time.localeCompare(b.time)),
    );
  }),

  /** `GET /appointments/:id` */
  http.get('/api/appointments/:id', async ({ request, params }) => {
    await latency(120);
    const actor = currentUser(request);
    if (!actor) return unauthorized();

    const id = Number(params.id);
    const record = db.appointments.find(item => item.id === id);
    if (!record) return notFound(`Appointment #${id}`);

    if (actor.role === 'client') {
      const own = clientRecordFor(actor);
      if (!own || record.clientId !== own.id) return forbidden('This appointment is not yours.');
    }
    return ok(record);
  }),

  /** `POST /appointments` — book a slot (client) or schedule one (staff/lawyer). */
  http.post('/api/appointments', async ({ request }) => {
    await latency();
    const actor = currentUser(request);
    if (!actor) return unauthorized();

    const body = await readJson<AppointmentBody>(request);
    const lawyerId = asNumber(body.lawyerId) ?? null;
    const date = asString(body.date);
    const startTime = asString(body.startTime);
    const endTime = asString(body.endTime) || toTime(toMinutes(startTime) + 60);

    // A client books for themselves; everyone else names the client.
    let clientId: number | undefined;
    if (actor.role === 'client') {
      clientId = clientRecordFor(actor)?.id;
      if (!clientId) return forbidden('Your account has no client file yet.');
    } else {
      clientId = asNumber(body.clientId);
      if (!clientId) return badRequest('Choose the client this appointment is for.');
    }

    if (!date || !startTime) return badRequest('A date and a start time are required.');
    if (!lawyerId) return badRequest('Choose the lawyer for this appointment.');

    const lawyer = db.users.find(user => user.id === lawyerId);
    if (!lawyer) return notFound(`User #${lawyerId}`);
    if (lawyer.role !== 'lawyer') return badRequest('Appointments are booked with a lawyer.');

    // Only one matter may hold a slot.
    const clash = db.appointments.find(
      item =>
        item.lawyerId === lawyerId &&
        item.date === date &&
        item.status !== 'cancelled' &&
        toMinutes(item.startTime) < toMinutes(endTime) &&
        toMinutes(item.endTime) > toMinutes(startTime),
    );
    if (clash) return badRequest('That slot is already booked. Choose another time.');

    const consultationId = asNumber(body.consultationId) ?? null;
    const stamp = new Date().toISOString();
    const record: Appointment = {
      id: newId(),
      clientId,
      clientName: db.clients.find(client => client.id === clientId)?.fullName,
      consultationId,
      lawyerId,
      lawyerName: lawyer.name,
      date,
      startTime,
      endTime,
      status: body.status && STATUSES.includes(body.status) ? body.status : 'scheduled',
      notes: body.notes,
      createdAt: stamp,
      updatedAt: stamp,
    };
    db.appointments.push(record);

    // Booking an approved consultation closes the loop on the intake side.
    if (consultationId) {
      const consultation = db.consultations.find(item => item.id === consultationId);
      if (consultation && consultation.status === 'approved') consultation.status = 'completed';
    }

    announce(record, `Appointment booked for ${date} at ${startTime} with ${lawyer.name}.`);
    recordActivity(actor, 'appointment.create', `Booked ${date} ${startTime} with ${lawyer.name}.`);
    return ok(record, 201);
  }),

  /** `PUT /appointments/:id` — edit or reschedule. */
  http.put('/api/appointments/:id', async ({ request, params }) => {
    await latency();
    const actor = currentUser(request);
    if (!actor) return unauthorized();

    const id = Number(params.id);
    const record = db.appointments.find(item => item.id === id);
    if (!record) return notFound(`Appointment #${id}`);

    if (actor.role === 'client') {
      const own = clientRecordFor(actor);
      if (!own || record.clientId !== own.id) return forbidden('This appointment is not yours.');
    }

    const body = await readJson<AppointmentBody>(request);
    const lawyerId = asNumber(body.lawyerId) ?? record.lawyerId;
    const date = asString(body.date, record.date);
    const startTime = asString(body.startTime, record.startTime);
    const endTime = asString(body.endTime, record.endTime);

    const clash = db.appointments.find(
      item =>
        item.id !== record.id &&
        item.lawyerId === lawyerId &&
        item.date === date &&
        item.status !== 'cancelled' &&
        toMinutes(item.startTime) < toMinutes(endTime) &&
        toMinutes(item.endTime) > toMinutes(startTime),
    );
    if (clash) return badRequest('That slot is already booked. Choose another time.');

    const moved = date !== record.date || startTime !== record.startTime;

    Object.assign(record, {
      consultationId:
        body.consultationId === undefined ? record.consultationId : (asNumber(body.consultationId) ?? null),
      lawyerId,
      lawyerName: db.users.find(user => user.id === lawyerId)?.name ?? record.lawyerName,
      date,
      startTime,
      endTime,
      status: moved && !body.status ? 'rescheduled' : (body.status ?? record.status),
      notes: body.notes ?? record.notes,
      updatedAt: new Date().toISOString(),
    } satisfies Partial<Appointment>);

    announce(
      record,
      moved
        ? `Your appointment was moved to ${date} at ${startTime}.`
        : `Your appointment on ${date} at ${startTime} was updated.`,
    );
    recordActivity(actor, 'appointment.update', `Updated appointment #${record.id}.`);
    return ok(record);
  }),

  /** `PATCH /appointments/:id/status` — confirm, complete or cancel. */
  http.patch('/api/appointments/:id/status', async ({ request, params }) => {
    await latency();
    const actor = currentUser(request);
    if (!actor) return unauthorized();

    const id = Number(params.id);
    const record = db.appointments.find(item => item.id === id);
    if (!record) return notFound(`Appointment #${id}`);

    if (actor.role === 'client') {
      const own = clientRecordFor(actor);
      if (!own || record.clientId !== own.id) return forbidden('This appointment is not yours.');
    }

    const body = await readJson<{ status: AppointmentStatus }>(request);
    if (!body.status || !STATUSES.includes(body.status)) {
      return badRequest(`Status must be one of: ${STATUSES.join(', ')}.`);
    }
    if (actor.role === 'client' && body.status !== 'cancelled') {
      return forbidden('A client may only cancel an appointment.');
    }

    record.status = body.status;
    record.updatedAt = new Date().toISOString();

    announce(record, `Your appointment on ${record.date} at ${record.startTime} is now ${body.status}.`);
    recordActivity(actor, 'appointment.status', `Marked appointment #${record.id} as ${body.status}.`);
    return ok(record);
  }),

  /** `DELETE /appointments/:id` */
  http.delete('/api/appointments/:id', async ({ request, params }) => {
    await latency();
    const actor = currentUser(request);
    if (!actor) return unauthorized();

    const id = Number(params.id);
    const index = db.appointments.findIndex(item => item.id === id);
    if (index === -1) return notFound(`Appointment #${id}`);

    const record = db.appointments[index];
    const own = actor.role === 'client' ? clientRecordFor(actor) : undefined;
    if (actor.role === 'client' && (!own || record.clientId !== own.id)) {
      return forbidden('This appointment is not yours.');
    }
    if (actor.role === 'staff') return forbidden('Only the administrator may delete an appointment.');

    db.appointments.splice(index, 1);
    recordActivity(actor, 'appointment.delete', `Deleted appointment #${id}.`);
    return new Response(null, { status: 204 });
  }),

  /** `GET /availability?lawyerId=` — the weekly grid. */
  http.get('/api/availability', async ({ request }) => {
    await latency(120);
    if (!currentUser(request)) return unauthorized();

    const lawyerId = asNumber(query(request, 'lawyerId'));
    const rows = db.availability
      .filter(entry => (lawyerId ? entry.lawyerId === lawyerId : true))
      .sort((a, b) => DAY_NAMES.indexOf(a.dayOfWeek) - DAY_NAMES.indexOf(b.dayOfWeek));

    return ok(rows);
  }),

  /** `PUT /availability` — replace a lawyer's whole weekly grid in one call. */
  http.put('/api/availability', async ({ request }) => {
    await latency();
    const actor = currentUser(request);
    if (!actor) return unauthorized();
    if (actor.role !== 'lawyer' && actor.role !== 'admin') {
      return forbidden('Only a lawyer or the administrator maintains availability.');
    }

    const body = await readJson<{ lawyerId?: number; entries?: Availability[] }>(request);
    const lawyerId = asNumber(body.lawyerId) ?? actor.id;
    if (actor.role === 'lawyer' && lawyerId !== actor.id) {
      return forbidden('You may only change your own availability.');
    }

    const lawyer = db.users.find(user => user.id === lawyerId);
    if (!lawyer) return notFound(`User #${lawyerId}`);
    if (lawyer.role !== 'lawyer') return badRequest('Availability belongs to a lawyer.');
    if (!Array.isArray(body.entries)) return badRequest('Provide the weekly slots to save.');

    const kept = db.availability.filter(entry => entry.lawyerId !== lawyerId);
    const saved: Availability[] = body.entries.map(slot => ({
      id: newId(),
      lawyerId,
      lawyerName: lawyer.name,
      dayOfWeek: slot.dayOfWeek,
      startTime: slot.startTime,
      endTime: slot.endTime,
      isAvailable: slot.isAvailable !== false,
    }));

    db.availability = [...kept, ...saved];
    recordActivity(actor, 'availability.update', `Saved the weekly grid for ${lawyer.name}.`);
    return ok(saved);
  }),
];


