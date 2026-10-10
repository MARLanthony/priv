/* ==========================================================================
   Consultation handlers — `/api/consultations`
   --------------------------------------------------------------------------
   The intake flow: a client raises a concern, staff/lawyers read it, and a
   reviewer moves it to `approved` (which unblocks booking) or `declined`.
   ========================================================================== */

import { http } from 'msw';
import { db, newId } from '../db';
import type { Consultation, ConsultationStatus } from '../../types';
import {
  asNumber,
  asString,
  badRequest,
  clientRecordFor,
  currentUser,
  forbidden,
  latency,
  matches,
  notFound,
  notify,
  ok,
  query,
  readJson,
  recordActivity,
  unauthorized,
} from '../utils';

interface ConsultationBody {
  clientId?: number;
  serviceId?: number | null;
  concern: string;
}

const STATUSES: ConsultationStatus[] = ['pending', 'approved', 'declined', 'completed'];

function userIdOfClient(clientId: number): number | undefined {
  return db.clients.find(client => client.id === clientId)?.userId;
}

export const consultationHandlers = [
  /** `GET /consultations?status=&clientId=&q=` */
  http.get('/api/consultations', async ({ request }) => {
    await latency();
    const actor = currentUser(request);
    if (!actor) return unauthorized();

    const status = query(request, 'status');
    const clientId = asNumber(query(request, 'clientId'));
    const term = query(request, 'q');

    let rows = db.consultations;
    if (actor.role === 'client') {
      const own = clientRecordFor(actor);
      rows = own ? rows.filter(item => item.clientId === own.id) : [];
    }

    const result = rows
      .filter(item => (status ? item.status === status : true))
      .filter(item => (clientId ? item.clientId === clientId : true))
      .filter(item => matches(term, item.concern, item.clientName, item.serviceName))
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

    return ok(result);
  }),

  /** `GET /consultations/:id` */
  http.get('/api/consultations/:id', async ({ request, params }) => {
    await latency(120);
    const actor = currentUser(request);
    if (!actor) return unauthorized();

    const id = Number(params.id);
    const record = db.consultations.find(item => item.id === id);
    if (!record) return notFound(`Consultation #${id}`);

    if (actor.role === 'client') {
      const own = clientRecordFor(actor);
      if (!own || record.clientId !== own.id) return forbidden('This consultation is not yours.');
    }
    return ok(record);
  }),

  /** `POST /consultations` — the client's own concern, or a logged phone call. */
  http.post('/api/consultations', async ({ request }) => {
    await latency();
    const actor = currentUser(request);
    if (!actor) return unauthorized();

    const body = await readJson<ConsultationBody>(request);
    const concern = asString(body.concern).trim();
    if (concern.length < 10) {
      return badRequest('Describe your concern in at least 10 characters so we can route it.');
    }

    // A client always writes against their own file; staff may pick one.
    let clientId: number | undefined;
    if (actor.role === 'client') {
      clientId = clientRecordFor(actor)?.id;
      if (!clientId) return forbidden('Your account has no client file yet.');
    } else {
      clientId = asNumber(body.clientId);
      if (!clientId) return badRequest('Choose the client this consultation belongs to.');
    }

    const serviceId = asNumber(body.serviceId) ?? null;
    const stamp = new Date().toISOString();
    const record: Consultation = {
      id: newId(),
      clientId,
      clientName: db.clients.find(client => client.id === clientId)?.fullName,
      serviceId,
      serviceName: serviceId
        ? db.legalServices.find(service => service.id === serviceId)?.name
        : undefined,
      concern,
      status: 'pending',
      reviewedBy: null,
      createdAt: stamp,
      updatedAt: stamp,
    };
    db.consultations.push(record);

    // Everyone who reviews intake is told straight away.
    db.users
      .filter(
        user =>
          user.isActive &&
          (user.role === 'admin' || user.role === 'lawyer' || user.role === 'staff'),
      )
      .forEach(user => notify(user.id, 'consultation', `New consultation from ${record.clientName}.`));

    recordActivity(actor, 'consultation.create', `Raised a consultation for ${record.clientName}.`);
    return ok(record, 201);
  }),

  /** `PUT /consultations/:id` — correct the concern before it is reviewed. */
  http.put('/api/consultations/:id', async ({ request, params }) => {
    await latency();
    const actor = currentUser(request);
    if (!actor) return unauthorized();

    const id = Number(params.id);
    const record = db.consultations.find(item => item.id === id);
    if (!record) return notFound(`Consultation #${id}`);

    if (actor.role === 'client') {
      const own = clientRecordFor(actor);
      if (!own || record.clientId !== own.id) return forbidden('This consultation is not yours.');
      if (record.status !== 'pending') {
        return forbidden('A reviewed consultation can no longer be edited.');
      }
    }

    const body = await readJson<ConsultationBody>(request);
    const serviceId =
      body.serviceId === undefined ? record.serviceId : (asNumber(body.serviceId) ?? null);

    Object.assign(record, {
      serviceId,
      serviceName: serviceId
        ? db.legalServices.find(service => service.id === serviceId)?.name
        : undefined,
      concern: asString(body.concern, record.concern),
      updatedAt: new Date().toISOString(),
    } satisfies Partial<Consultation>);

    recordActivity(actor, 'consultation.update', `Edited consultation #${record.id}.`);
    return ok(record);
  }),

  /** `PATCH /consultations/:id/status` — approve, decline or complete. */
  http.patch('/api/consultations/:id/status', async ({ request, params }) => {
    await latency();
    const actor = currentUser(request);
    if (!actor) return unauthorized();
    if (actor.role !== 'admin' && actor.role !== 'lawyer') {
      return forbidden('Only a lawyer or the administrator may review a consultation.');
    }

    const id = Number(params.id);
    const record = db.consultations.find(item => item.id === id);
    if (!record) return notFound(`Consultation #${id}`);

    const body = await readJson<{ status: ConsultationStatus }>(request);
    if (!body.status || !STATUSES.includes(body.status)) {
      return badRequest(`Status must be one of: ${STATUSES.join(', ')}.`);
    }

    record.status = body.status;
    record.reviewedBy = actor.id;
    record.reviewedByName = actor.name;
    record.updatedAt = new Date().toISOString();

    const clientUserId = userIdOfClient(record.clientId);
    if (clientUserId) {
      const message =
        body.status === 'approved'
          ? 'Your consultation was approved — you can now book an appointment.'
          : `Your consultation was ${body.status}.`;
      notify(clientUserId, 'consultation', message);
    }

    recordActivity(actor, 'consultation.review', `Marked consultation #${record.id} as ${body.status}.`);
    return ok(record);
  }),

  /** `DELETE /consultations/:id` */
  http.delete('/api/consultations/:id', async ({ request, params }) => {
    await latency();
    const actor = currentUser(request);
    if (!actor) return unauthorized();

    const id = Number(params.id);
    const index = db.consultations.findIndex(item => item.id === id);
    if (index === -1) return notFound(`Consultation #${id}`);

    const record = db.consultations[index];
    if (actor.role === 'client') {
      const own = clientRecordFor(actor);
      if (!own || record.clientId !== own.id) return forbidden('This consultation is not yours.');
      if (record.status !== 'pending') return forbidden('A reviewed consultation cannot be withdrawn.');
    }

    db.consultations.splice(index, 1);
    recordActivity(actor, 'consultation.delete', `Deleted consultation #${id}.`);
    return new Response(null, { status: 204 });
  }),
];


