/* ==========================================================================
   Case handlers — `/api/cases`
   --------------------------------------------------------------------------
   Row-level scoping mirrors Postgres row-level security in production:
     • client  → only the cases of their own client file
     • lawyer  → only the cases assigned to them
     • staff / admin → every case in the firm
   ========================================================================== */

import { http } from 'msw';
import { db, newId } from '../db';
import type { Case, CasePriority, CaseStatus } from '../../types';
import {
  asNumber,
  asString,
  badRequest,
  clientRecordFor,
  currentUser,
  forbidden,
  latency,
  matches,
  nextCaseNumber,
  notFound,
  notify,
  ok,
  query,
  readJson,
  recordActivity,
  unauthorized,
} from '../utils';

interface CaseBody {
  clientId: number;
  caseNumber?: string;
  title: string;
  type: string;
  status?: CaseStatus;
  priority?: CasePriority;
  assignedLawyerId?: number | null;
  description?: string;
}

const CASE_STATUSES: CaseStatus[] = ['open', 'pending', 'active', 'discovery', 'closed', 'archived'];
const PRIORITIES: CasePriority[] = ['high', 'medium', 'low'];

/** The user id behind a client file, so a case change can notify the client. */
function userIdOfClient(clientId: number): number | undefined {
  return db.clients.find(client => client.id === clientId)?.userId;
}

/** Applies the caller's row-level scope to the case table. */
function scopeCases(actor: NonNullable<ReturnType<typeof currentUser>>, rows: Case[]): Case[] {
  if (actor.role === 'client') {
    const own = clientRecordFor(actor);
    return own ? rows.filter(item => item.clientId === own.id) : [];
  }
  if (actor.role === 'lawyer') {
    // Lawyers see their own matters plus the unassigned pool they may claim.
    return rows.filter(item => item.assignedLawyerId === actor.id || item.assignedLawyerId === null);
  }
  return rows;
}

export const caseHandlers = [
  /** `GET /cases?status=&priority=&clientId=&lawyerId=&q=` */
  http.get('/api/cases', async ({ request }) => {
    await latency();
    const actor = currentUser(request);
    if (!actor) return unauthorized();

    const status = query(request, 'status');
    const priority = query(request, 'priority');
    const clientId = asNumber(query(request, 'clientId'));
    const lawyerId = asNumber(query(request, 'lawyerId'));
    const term = query(request, 'q');

    const rows = scopeCases(actor, db.cases)
      .filter(item => (status ? item.status === status : true))
      .filter(item => (priority ? item.priority === priority : true))
      .filter(item => (clientId ? item.clientId === clientId : true))
      .filter(item => (lawyerId ? item.assignedLawyerId === lawyerId : true))
      .filter(item => matches(term, item.title, item.caseNumber, item.clientName, item.type))
      .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));

    return ok(rows);
  }),

  /** `GET /cases/:id` */
  http.get('/api/cases/:id', async ({ request, params }) => {
    await latency(120);
    const actor = currentUser(request);
    if (!actor) return unauthorized();

    const id = Number(params.id);
    const record = db.cases.find(item => item.id === id);
    if (!record) return notFound(`Case #${id}`);

    if (actor.role === 'client') {
      const own = clientRecordFor(actor);
      if (!own || record.clientId !== own.id) return forbidden('This case belongs to another client.');
    }
    return ok(record);
  }),

  /** `POST /cases` — staff, lawyers and the admin open new matters. */
  http.post('/api/cases', async ({ request }) => {
    await latency();
    const actor = currentUser(request);
    if (!actor) return unauthorized();
    if (actor.role === 'client') return forbidden('Clients raise a consultation; staff open the case file.');

    const body = await readJson<CaseBody>(request);
    const clientId = asNumber(body.clientId);
    const title = asString(body.title).trim();
    const type = asString(body.type).trim() || 'General';

    if (!clientId || !title) return badRequest('A client and a case title are required.');
    if (!db.clients.some(client => client.id === clientId)) return notFound(`Client #${clientId}`);

    const stamp = new Date().toISOString();
    const lawyerId = asNumber(body.assignedLawyerId) ?? null;
    const record: Case = {
      id: newId(),
      clientId,
      clientName: db.clients.find(client => client.id === clientId)?.fullName,
      caseNumber: body.caseNumber || nextCaseNumber(),
      title,
      type,
      status: body.status && CASE_STATUSES.includes(body.status) ? body.status : 'open',
      priority: body.priority && PRIORITIES.includes(body.priority) ? body.priority : 'medium',
      assignedLawyerId: lawyerId,
      assignedLawyerName: lawyerId ? db.users.find(user => user.id === lawyerId)?.name : undefined,
      description: body.description,
      createdAt: stamp,
      updatedAt: stamp,
    };
    db.cases.push(record);

    const clientUserId = userIdOfClient(clientId);
    if (clientUserId) notify(clientUserId, 'case', `Case ${record.caseNumber} was opened for you.`);
    if (lawyerId) notify(lawyerId, 'case', `Case ${record.caseNumber} was assigned to you.`);

    recordActivity(actor, 'case.create', `Opened case ${record.caseNumber} (${record.title}).`);
    return ok(record, 201);
  }),

  /** `PUT /cases/:id` */
  http.put('/api/cases/:id', async ({ request, params }) => {
    await latency();
    const actor = currentUser(request);
    if (!actor) return unauthorized();
    if (actor.role === 'client') return forbidden('Clients cannot edit case files.');

    const id = Number(params.id);
    const record = db.cases.find(item => item.id === id);
    if (!record) return notFound(`Case #${id}`);
    if (actor.role === 'lawyer' && record.assignedLawyerId !== actor.id) {
      return forbidden('You may only edit cases assigned to you.');
    }

    const body = await readJson<CaseBody>(request);
    const clientId = asNumber(body.clientId) ?? record.clientId;
    const lawyerId = asNumber(body.assignedLawyerId);

    Object.assign(record, {
      clientId,
      clientName: db.clients.find(client => client.id === clientId)?.fullName ?? record.clientName,
      title: asString(body.title, record.title),
      type: asString(body.type, record.type),
      status: body.status && CASE_STATUSES.includes(body.status) ? body.status : record.status,
      priority: body.priority && PRIORITIES.includes(body.priority) ? body.priority : record.priority,
      assignedLawyerId: body.assignedLawyerId === undefined ? record.assignedLawyerId : (lawyerId ?? null),
      assignedLawyerName:
        body.assignedLawyerId === undefined
          ? record.assignedLawyerName
          : db.users.find(user => user.id === lawyerId)?.name,
      description: body.description ?? record.description,
      updatedAt: new Date().toISOString(),
    } satisfies Partial<Case>);

    recordActivity(actor, 'case.update', `Updated case ${record.caseNumber}.`);
    return ok(record);
  }),

  /** `PATCH /cases/:id/status` */
  http.patch('/api/cases/:id/status', async ({ request, params }) => {
    await latency();
    const actor = currentUser(request);
    if (!actor) return unauthorized();
    if (actor.role === 'client') return forbidden('Clients cannot move a case through the board.');

    const id = Number(params.id);
    const record = db.cases.find(item => item.id === id);
    if (!record) return notFound(`Case #${id}`);

    const body = await readJson<{ status: CaseStatus }>(request);
    if (!body.status || !CASE_STATUSES.includes(body.status)) {
      return badRequest(`Status must be one of: ${CASE_STATUSES.join(', ')}.`);
    }

    record.status = body.status;
    record.updatedAt = new Date().toISOString();

    const clientUserId = userIdOfClient(record.clientId);
    if (clientUserId) {
      notify(clientUserId, 'case', `Case ${record.caseNumber} moved to ${record.status}.`);
    }

    recordActivity(actor, 'case.status', `Moved ${record.caseNumber} to ${record.status}.`);
    return ok(record);
  }),

  /** `PATCH /cases/:id/assign` — admin and lawyers (re)assign a matter. */
  http.patch('/api/cases/:id/assign', async ({ request, params }) => {
    await latency();
    const actor = currentUser(request);
    if (!actor) return unauthorized();
    if (actor.role === 'staff' || actor.role === 'client') {
      return forbidden('Ask a lawyer or the administrator to assign a case.');
    }

    const id = Number(params.id);
    const record = db.cases.find(item => item.id === id);
    if (!record) return notFound(`Case #${id}`);

    const body = await readJson<{ assignedLawyerId: number | null }>(request);
    const lawyerId = asNumber(body.assignedLawyerId) ?? null;

    if (lawyerId !== null) {
      const lawyer = db.users.find(user => user.id === lawyerId);
      if (!lawyer) return notFound(`User #${lawyerId}`);
      if (lawyer.role !== 'lawyer') return badRequest('Cases may only be assigned to lawyers.');
    }

    record.assignedLawyerId = lawyerId;
    record.assignedLawyerName = lawyerId ? db.users.find(user => user.id === lawyerId)?.name : undefined;
    record.updatedAt = new Date().toISOString();

    if (lawyerId) {
      notify(lawyerId, 'case', `Case ${record.caseNumber} was assigned to you.`);
    }

    recordActivity(
      actor,
      'case.assign',
      lawyerId
        ? `Assigned ${record.caseNumber} to ${record.assignedLawyerName}.`
        : `Removed the lawyer from ${record.caseNumber}.`,
    );
    return ok(record);
  }),

  /** `DELETE /cases/:id` — admin only. */
  http.delete('/api/cases/:id', async ({ request, params }) => {
    await latency();
    const actor = currentUser(request);
    if (!actor) return unauthorized();
    if (actor.role !== 'admin') return forbidden('Only the administrator may delete a case.');

    const id = Number(params.id);
    const index = db.cases.findIndex(item => item.id === id);
    if (index === -1) return notFound(`Case #${id}`);

    const [removed] = db.cases.splice(index, 1);
    db.documents = db.documents.filter(document => document.caseId !== id);

    recordActivity(actor, 'case.delete', `Deleted case ${removed.caseNumber}.`);
    return new Response(null, { status: 204 });
  }),
];

