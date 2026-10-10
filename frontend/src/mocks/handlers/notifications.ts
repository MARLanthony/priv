/* ==========================================================================
   Notification handlers — `/api/notifications`
   --------------------------------------------------------------------------
   Every row belongs to exactly one user, so the list is always scoped to the
   bearer token. Two exception to the rules: the settings endpoint reads the
   caller's own preferences, and `POST /notifications` lets staff raise an
   in-app message for somebody else.
   ========================================================================== */

import { http } from 'msw';
import { db, newId, settingsFor } from '../db';
import type { Notification, NotificationSettings, NotificationType } from '../../types';
import {
  asBoolean,
  asNumber,
  asString,
  badRequest,
  currentUser,
  forbidden,
  latency,
  notFound,
  ok,
  query,
  readJson,
  recordActivity,
  unauthorized,
} from '../utils';

const TYPES: NotificationType[] = ['consultation', 'appointment', 'case', 'document', 'system'];

export const notificationHandlers = [
  /** `GET /notifications?isRead=&limit=` — newest first, own rows only. */
  http.get('/api/notifications', async ({ request }) => {
    await latency(120);
    const actor = currentUser(request);
    if (!actor) return unauthorized();

    const isRead = query(request, 'isRead');
    const limit = asNumber(query(request, 'limit'));

    let rows = db.notifications
      .filter(item => item.userId === actor.id)
      .filter(item => (isRead === undefined ? true : item.isRead === (isRead === 'true')))
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

    if (limit && limit > 0) rows = rows.slice(0, limit);
    return ok(rows);
  }),

  /** `GET /notifications/unread-count` — drives the navbar bell badge. */
  http.get('/api/notifications/unread-count', async ({ request }) => {
    await latency(60);
    const actor = currentUser(request);
    if (!actor) return unauthorized();

    const count = db.notifications.filter(item => item.userId === actor.id && !item.isRead).length;
    return ok({ count });
  }),

  /** `POST /notifications/read-all` */
  http.post('/api/notifications/read-all', async ({ request }) => {
    await latency();
    const actor = currentUser(request);
    if (!actor) return unauthorized();

    let updated = 0;
    db.notifications.forEach(item => {
      if (item.userId === actor.id && !item.isRead) {
        item.isRead = true;
        updated += 1;
      }
    });
    return ok({ updated });
  }),

  /** `GET /notifications/settings` */
  http.get('/api/notifications/settings', async ({ request }) => {
    await latency(80);
    const actor = currentUser(request);
    if (!actor) return unauthorized();
    return ok(settingsFor(actor.id));
  }),

  /** `PUT /notifications/settings` */
  http.put('/api/notifications/settings', async ({ request }) => {
    await latency();
    const actor = currentUser(request);
    if (!actor) return unauthorized();

    const body = await readJson<Partial<NotificationSettings>>(request);
    const current = settingsFor(actor.id);

    Object.assign(current, {
      email: asBoolean(body.email) ?? current.email,
      inApp: asBoolean(body.inApp) ?? current.inApp,
      consultations: asBoolean(body.consultations) ?? current.consultations,
      appointments: asBoolean(body.appointments) ?? current.appointments,
      documents: asBoolean(body.documents) ?? current.documents,
    } satisfies NotificationSettings);

    return ok(current);
  }),

  /** `POST /notifications` — internal fan-out used by the other modules. */
  http.post('/api/notifications', async ({ request }) => {
    await latency();
    const actor = currentUser(request);
    if (!actor) return unauthorized();
    if (actor.role === 'client') return forbidden('Clients cannot raise notifications.');

    const body = await readJson<{ userId: number; type: NotificationType; message: string }>(request);
    const userId = asNumber(body.userId);
    if (!userId) return badRequest('Choose the recipient of this notification.');
    if (!db.users.some(user => user.id === userId)) return notFound(`User #${userId}`);
    if (!body.type || !TYPES.includes(body.type)) {
      return badRequest(`Type must be one of: ${TYPES.join(', ')}.`);
    }

    const message = asString(body.message).trim();
    if (!message) return badRequest('A message is required.');

    const record: Notification = {
      id: newId(),
      userId,
      type: body.type,
      message,
      isRead: false,
      createdAt: new Date().toISOString(),
    };
    db.notifications.push(record);

    recordActivity(actor, 'notification.create', `Notified ${db.users.find(user => user.id === userId)?.name}.`);
    return ok(record, 201);
  }),

  /** `PATCH /notifications/:id/read` */
  http.patch('/api/notifications/:id/read', async ({ request, params }) => {
    await latency(80);
    const actor = currentUser(request);
    if (!actor) return unauthorized();

    const id = Number(params.id);
    const record = db.notifications.find(item => item.id === id);
    if (!record) return notFound(`Notification #${id}`);
    if (record.userId !== actor.id) return forbidden('This notification belongs to another user.');

    record.isRead = true;
    return ok(record);
  }),

  /** `DELETE /notifications/:id` */
  http.delete('/api/notifications/:id', async ({ request, params }) => {
    await latency(80);
    const actor = currentUser(request);
    if (!actor) return unauthorized();

    const id = Number(params.id);
    const index = db.notifications.findIndex(item => item.id === id);
    if (index === -1) return notFound(`Notification #${id}`);
    if (db.notifications[index].userId !== actor.id) {
      return forbidden('This notification belongs to another user.');
    }

    db.notifications.splice(index, 1);
    return new Response(null, { status: 204 });
  }),
];
