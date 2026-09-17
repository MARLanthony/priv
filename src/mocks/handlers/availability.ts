import { http, HttpResponse } from 'msw';
import { availability } from '../data';
import { getCurrentUser } from './auth';

let availabilityData = [...availability];

export const availabilityHandlers = [
  http.get('/api/availability', () => {
    const user = getCurrentUser();
    if (!user) return HttpResponse.json({ error: 'Not authenticated' }, { status: 401 });

    let filtered = availabilityData;
    if (user.role === 'attorney') {
      filtered = availabilityData.filter(a => a.attorneyId === user.id);
    }
    return HttpResponse.json(filtered);
  }),

  http.post('/api/availability', async ({ request }) => {
    const user = getCurrentUser();
    if (!user) return HttpResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const body = await request.json() as Record<string, unknown>;
    const newSlot = {
      id: availabilityData.length + 1,
      ...body,
    };
    availabilityData.push(newSlot as any);
    return HttpResponse.json(newSlot, { status: 201 });
  }),

  http.put('/api/availability/:id', async ({ params, request }) => {
    const idx = availabilityData.findIndex(a => a.id === Number(params.id));
    if (idx === -1) return HttpResponse.json({ error: 'Not found' }, { status: 404 });

    const body = await request.json() as Record<string, unknown>;
    availabilityData[idx] = { ...availabilityData[idx], ...body };
    return HttpResponse.json(availabilityData[idx]);
  }),

  http.delete('/api/availability/:id', ({ params }) => {
    availabilityData = availabilityData.filter(a => a.id !== Number(params.id));
    return HttpResponse.json({ success: true });
  }),
];
