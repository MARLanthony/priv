/* ==========================================================================
   Dashboard + activity handlers — `/api/dashboard`, `/api/activity`
   --------------------------------------------------------------------------
   Counters are computed from what the caller may see, so the client portal
   shows their own file and an admin sees the whole firm.
   ========================================================================== */

import { http } from 'msw';
import { db } from '../db';
import type { CaseStatus, ConsultationStatus, DashboardStats } from '../../types';
import { asNumber, currentUser, latency, ok, query, unauthorized } from '../utils';

const CASE_STATUSES: CaseStatus[] = ['open', 'pending', 'active', 'discovery', 'closed', 'archived'];
const CONSULTATION_STATUSES: ConsultationStatus[] = ['pending', 'approved', 'declined', 'completed'];

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const dashboardHandlers = [
  /** `GET /dashboard/stats` — the counters the caller is allowed to see. */
  http.get('/api/dashboard/stats', async ({ request }) => {
    await latency(120);
    const actor = currentUser(request);
    if (!actor) return unauthorized();

    const unreadNotifications = db.notifications.filter(
      item => item.userId === actor.id && !item.isRead,
    ).length;

    const ownClient = db.clients.find(client => client.userId === actor.id);

    const scopedCases =
      actor.role === 'client'
        ? db.cases.filter(item => item.clientId === ownClient?.id)
        : actor.role === 'lawyer'
          ? db.cases.filter(item => item.assignedLawyerId === actor.id)
          : db.cases;

    const scopedConsultations =
      actor.role === 'client'
        ? db.consultations.filter(item => item.clientId === ownClient?.id)
        : db.consultations;

    const scopedAppointments =
      actor.role === 'client'
        ? db.appointments.filter(item => item.clientId === ownClient?.id)
        : actor.role === 'lawyer'
          ? db.appointments.filter(item => item.lawyerId === actor.id)
          : db.appointments;

    const scopedDocuments =
      actor.role === 'client'
        ? db.documents.filter(item => item.clientId === ownClient?.id)
        : actor.role === 'lawyer'
          ? db.documents.filter(document =>
              db.cases.some(item => item.id === document.caseId && item.assignedLawyerId === actor.id),
            )
          : db.documents;

    const stats: DashboardStats = {
      users: actor.role === 'admin' ? db.users.length : undefined,
      clients: actor.role === 'client' ? (ownClient ? 1 : 0) : db.clients.length,
      cases: scopedCases.length,
      consultations: scopedConsultations.length,
      appointments: scopedAppointments.length,
      documents: scopedDocuments.length,
      unreadNotifications,
    };

    return ok(stats);
  }),

  /** `GET /dashboard/overview` — the series behind the admin/firm charts. */
  http.get('/api/dashboard/overview', async ({ request }) => {
    await latency(150);
    const actor = currentUser(request);
    if (!actor) return unauthorized();

    const ownClient = db.clients.find(client => client.userId === actor.id);

    const cases =
      actor.role === 'client'
        ? db.cases.filter(item => item.clientId === ownClient?.id)
        : actor.role === 'lawyer'
          ? db.cases.filter(item => item.assignedLawyerId === actor.id)
          : db.cases;

    const consultations =
      actor.role === 'client'
        ? db.consultations.filter(item => item.clientId === ownClient?.id)
        : db.consultations;

    // Last six months of appointments, oldest first.
    const today = new Date();
    const months: { label: string; value: number }[] = [];
    for (let offset = 5; offset >= 0; offset -= 1) {
      const cursor = new Date(today.getFullYear(), today.getMonth() - offset, 1);
      const label = MONTHS[cursor.getMonth()];
      const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`;
      months.push({
        label,
        value: db.appointments.filter(item => item.date.startsWith(key)).length,
      });
    }

    const topLawyers = db.users
      .filter(user => user.role === 'lawyer' && user.isActive)
      .map(user => ({
        id: user.id,
        name: user.name,
        cases: db.cases.filter(item => item.assignedLawyerId === user.id).length,
      }))
      .sort((a, b) => b.cases - a.cases)
      .slice(0, 5);

    return ok({
      casesByStatus: CASE_STATUSES.map(status => ({
        label: status,
        value: cases.filter(item => item.status === status).length,
      })),
      consultationsByStatus: CONSULTATION_STATUSES.map(status => ({
        label: status,
        value: consultations.filter(item => item.status === status).length,
      })),
      appointmentsByMonth: months,
      topLawyers,
    });
  }),

  /** `GET /activity?limit=` — audit trail; staff and up see the firm's own trail. */
  http.get('/api/activity', async ({ request }) => {
    await latency(120);
    const actor = currentUser(request);
    if (!actor) return unauthorized();

    const limit = asNumber(query(request, 'limit')) ?? 25;

    const rows =
      actor.role === 'admin'
        ? db.activityLogs
        : db.activityLogs.filter(item => item.userId === actor.id);

    return ok(rows.slice(0, limit));
  }),
];
