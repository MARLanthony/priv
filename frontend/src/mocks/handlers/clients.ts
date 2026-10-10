/* ==========================================================================
   Client handlers — `/api/clients`
   --------------------------------------------------------------------------
   Staff, lawyers and the admin maintain the client book; a client account is
   scoped to its own record (the API resolves it from the token, never from the
   URL).
   ========================================================================== */

import { http } from 'msw';
import { db, newId } from '../db';
import type { Client } from '../../types';
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
  ok,
  query,
  readJson,
  recordActivity,
  unauthorized,
} from '../utils';

interface ClientBody {
  fullName: string;
  email?: string;
  contact: string;
  address: string;
  userId?: number;
  password?: string;
}

export const clientHandlers = [
  /** `GET /clients/me` — the profile of the signed-in client. */
  http.get('/api/clients/me', async ({ request }) => {
    await latency(120);
    const user = currentUser(request);
    if (!user) return unauthorized();

    const record = clientRecordFor(user);
    if (!record) return notFound('Your client profile');
    return ok(record);
  }),

  /** `GET /clients?q=` */
  http.get('/api/clients', async ({ request }) => {
    await latency();
    const user = currentUser(request);
    if (!user) return unauthorized();

    const term = query(request, 'q');

    // A client only ever sees themselves.
    if (user.role === 'client') {
      const record = clientRecordFor(user);
      return ok(record ? [record] : []);
    }

    const rows = db.clients
      .filter(client => matches(term, client.fullName, client.email, client.contact))
      .sort((a, b) => a.fullName.localeCompare(b.fullName));

    return ok(rows);
  }),

  /** `GET /clients/:id` */
  http.get('/api/clients/:id', async ({ request, params }) => {
    await latency(120);
    const user = currentUser(request);
    if (!user) return unauthorized();

    const id = Number(params.id);
    const record = db.clients.find(client => client.id === id);
    if (!record) return notFound(`Client #${id}`);

    if (user.role === 'client' && record.userId !== user.id) {
      return forbidden('You may only open your own client record.');
    }
    return ok(record);
  }),

  /** `POST /clients` — the front desk opens a file, optionally with a login. */
  http.post('/api/clients', async ({ request }) => {
    await latency();
    const actor = currentUser(request);
    if (!actor) return unauthorized();
    if (actor.role === 'client') return forbidden('Clients cannot create client records.');

    const body = await readJson<ClientBody>(request);
    const fullName = asString(body.fullName).trim();
    if (!fullName) return badRequest('The client name is required.');

    const stamp = new Date().toISOString();
    const record: Client = {
      id: db.clients.length + 1,
      userId: asNumber(body.userId) ?? 0,
      fullName,
      email: body.email,
      contact: asString(body.contact),
      address: asString(body.address),
      createdAt: stamp,
    };
    db.clients.push(record);

    recordActivity(actor, 'client.create', `Opened a client file for ${fullName}.`);
    return ok(record, 201);
  }),

  /** `PUT /clients/:id` */
  http.put('/api/clients/:id', async ({ request, params }) => {
    await latency();
    const actor = currentUser(request);
    if (!actor) return unauthorized();

    const id = Number(params.id);
    const record = db.clients.find(client => client.id === id);
    if (!record) return notFound(`Client #${id}`);

    // A client may correct their own details, nobody else's.
    if (actor.role === 'client' && record.userId !== actor.id) {
      return forbidden('You may only edit your own client record.');
    }

    const body = await readJson<ClientBody>(request);
    Object.assign(record, {
      fullName: asString(body.fullName, record.fullName),
      email: body.email ?? record.email,
      contact: body.contact ?? record.contact,
      address: body.address ?? record.address,
    });

    // Keep the login in step with the file.
    if (record.userId) {
      const owner = db.users.find(entry => entry.id === record.userId);
      if (owner) {
        owner.name = record.fullName;
        owner.phone = record.contact;
        owner.address = record.address;
        owner.updatedAt = new Date().toISOString();
      }
    }

    recordActivity(actor, 'client.update', `Updated the client file of ${record.fullName}.`);
    return ok(record);
  }),

  /** `DELETE /clients/:id` — admin only; cases and files go with the client. */
  http.delete('/api/clients/:id', async ({ request, params }) => {
    await latency();
    const actor = currentUser(request);
    if (!actor) return unauthorized();
    if (actor.role !== 'admin') return forbidden('Only the administrator may delete a client file.');

    const id = Number(params.id);
    const index = db.clients.findIndex(client => client.id === id);
    if (index === -1) return notFound(`Client #${id}`);

    const [removed] = db.clients.splice(index, 1);
    db.cases = db.cases.filter(item => item.clientId !== id);
    db.documents = db.documents.filter(item => item.clientId !== id);
    db.consultations = db.consultations.filter(item => item.clientId !== id);
    db.appointments = db.appointments.filter(item => item.clientId !== id);

    recordActivity(actor, 'client.delete', `Deleted the client file of ${removed.fullName}.`);
    return new Response(null, { status: 204 });
  }),
];
