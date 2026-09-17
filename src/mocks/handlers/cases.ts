import { http, HttpResponse } from 'msw';
import { cases } from '../data';
import { getCurrentUser } from './auth';

let casesData = [...cases];

export const caseHandlers = [
  http.get('/api/cases', () => {
    const user = getCurrentUser();
    if (!user) return HttpResponse.json({ error: 'Not authenticated' }, { status: 401 });

    let filtered = casesData;
    switch (user.role) {
      case 'attorney':
        filtered = casesData.filter(c => c.assignedToId === user.id);
        break;
      case 'user':
        filtered = casesData.filter(c => c.clientId === user.id);
        break;
      // system_admin and legal_secretary see all
    }
    return HttpResponse.json(filtered);
  }),

  http.get('/api/cases/:id', ({ params }) => {
    const user = getCurrentUser();
    if (!user) return HttpResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const caseItem = casesData.find(c => c.id === Number(params.id));
    if (!caseItem) return HttpResponse.json({ error: 'Case not found' }, { status: 404 });

    // Role-based access check
    if (user.role === 'attorney' && caseItem.assignedToId !== user.id) {
      return HttpResponse.json({ error: 'Access denied' }, { status: 403 });
    }
    if (user.role === 'user' && caseItem.clientId !== user.id) {
      return HttpResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    return HttpResponse.json(caseItem);
  }),

  http.post('/api/cases', async ({ request }) => {
    const user = getCurrentUser();
    if (!user) return HttpResponse.json({ error: 'Not authenticated' }, { status: 401 });
    if (user.role === 'user') return HttpResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await request.json() as Record<string, unknown>;
    const newCase = {
      id: casesData.length + 1,
      ...body,
      createdAt: new Date().toISOString().split('T')[0],
      updatedAt: new Date().toISOString().split('T')[0],
    };
    casesData.push(newCase as any);
    return HttpResponse.json(newCase, { status: 201 });
  }),

  http.put('/api/cases/:id', async ({ params, request }) => {
    const user = getCurrentUser();
    if (!user) return HttpResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const idx = casesData.findIndex(c => c.id === Number(params.id));
    if (idx === -1) return HttpResponse.json({ error: 'Case not found' }, { status: 404 });

    const body = await request.json() as Record<string, unknown>;
    casesData[idx] = { ...casesData[idx], ...body, updatedAt: new Date().toISOString().split('T')[0] };
    return HttpResponse.json(casesData[idx]);
  }),

  http.delete('/api/cases/:id', ({ params }) => {
    const user = getCurrentUser();
    if (!user) return HttpResponse.json({ error: 'Not authenticated' }, { status: 401 });
    if (user.role !== 'system_admin') return HttpResponse.json({ error: 'Forbidden' }, { status: 403 });

    casesData = casesData.filter(c => c.id !== Number(params.id));
    return HttpResponse.json({ success: true });
  }),
];
