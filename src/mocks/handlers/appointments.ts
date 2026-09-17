import { http, HttpResponse } from 'msw';
import { appointments } from '../data';
import { getCurrentUser } from './auth';

let appointmentsData = [...appointments];

export const appointmentHandlers = [
  http.get('/api/appointments', () => {
    const user = getCurrentUser();
    if (!user) return HttpResponse.json({ error: 'Not authenticated' }, { status: 401 });

    let filtered = appointmentsData;
    if (user.role === 'attorney') {
      filtered = appointmentsData.filter(a => a.attorneyId === user.id);
    } else if (user.role === 'user') {
      filtered = appointmentsData.filter(a => a.clientId === user.id);
    }
    return HttpResponse.json(filtered);
  }),

  http.post('/api/appointments', async ({ request }) => {
    const user = getCurrentUser();
    if (!user) return HttpResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const body = await request.json() as Record<string, unknown>;
    const newAppt = {
      id: appointmentsData.length + 1,
      ...body,
      status: 'scheduled',
    };
    appointmentsData.push(newAppt as any);
    return HttpResponse.json(newAppt, { status: 201 });
  }),

  http.put('/api/appointments/:id', async ({ params, request }) => {
    const idx = appointmentsData.findIndex(a => a.id === Number(params.id));
    if (idx === -1) return HttpResponse.json({ error: 'Not found' }, { status: 404 });

    const body = await request.json() as Record<string, unknown>;
    appointmentsData[idx] = { ...appointmentsData[idx], ...body };
    return HttpResponse.json(appointmentsData[idx]);
  }),

  http.delete('/api/appointments/:id', ({ params }) => {
    appointmentsData = appointmentsData.filter(a => a.id !== Number(params.id));
    return HttpResponse.json({ success: true });
  }),
];
