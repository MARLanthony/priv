import { http, HttpResponse } from 'msw';
import { teamMembers } from '../data';
import { getCurrentUser } from './auth';

let teamData = [...teamMembers];

export const teamHandlers = [
  http.get('/api/team', () => {
    const user = getCurrentUser();
    if (!user) return HttpResponse.json({ error: 'Not authenticated' }, { status: 401 });
    if (user.role !== 'system_admin') return HttpResponse.json({ error: 'Forbidden' }, { status: 403 });
    return HttpResponse.json(teamData);
  }),

  http.post('/api/team', async ({ request }) => {
    const user = getCurrentUser();
    if (!user || user.role !== 'system_admin') return HttpResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await request.json() as Record<string, unknown>;
    const newMember = {
      id: teamData.length + 1,
      ...body,
      joinDate: new Date().toISOString().split('T')[0],
      status: 'active',
    };
    teamData.push(newMember as any);
    return HttpResponse.json(newMember, { status: 201 });
  }),

  http.put('/api/team/:id', async ({ params, request }) => {
    const user = getCurrentUser();
    if (!user || user.role !== 'system_admin') return HttpResponse.json({ error: 'Forbidden' }, { status: 403 });

    const idx = teamData.findIndex(m => m.id === Number(params.id));
    if (idx === -1) return HttpResponse.json({ error: 'Not found' }, { status: 404 });

    const body = await request.json() as Record<string, unknown>;
    teamData[idx] = { ...teamData[idx], ...body };
    return HttpResponse.json(teamData[idx]);
  }),

  http.delete('/api/team/:id', ({ params }) => {
    const user = getCurrentUser();
    if (!user || user.role !== 'system_admin') return HttpResponse.json({ error: 'Forbidden' }, { status: 403 });

    teamData = teamData.filter(m => m.id !== Number(params.id));
    return HttpResponse.json({ success: true });
  }),
];
