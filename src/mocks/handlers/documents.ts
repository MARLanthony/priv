import { http, HttpResponse } from 'msw';
import { documents, cases } from '../data';
import { getCurrentUser } from './auth';

let docsData = [...documents];

export const documentHandlers = [
  http.get('/api/documents', () => {
    const user = getCurrentUser();
    if (!user) return HttpResponse.json({ error: 'Not authenticated' }, { status: 401 });

    let filtered = docsData;
    if (user.role === 'attorney') {
      const myCaseIds = cases.filter(c => c.assignedToId === user.id).map(c => c.id);
      filtered = docsData.filter(d => myCaseIds.includes(d.caseId));
    } else if (user.role === 'user') {
      const myCaseIds = cases.filter(c => c.clientId === user.id).map(c => c.id);
      filtered = docsData.filter(d => myCaseIds.includes(d.caseId));
    }
    return HttpResponse.json(filtered);
  }),

  http.get('/api/documents/:id', ({ params }) => {
    const doc = docsData.find(d => d.id === Number(params.id));
    if (!doc) return HttpResponse.json({ error: 'Document not found' }, { status: 404 });
    return HttpResponse.json(doc);
  }),

  http.post('/api/documents/upload', async ({ request }) => {
    const user = getCurrentUser();
    if (!user) return HttpResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const body = await request.json() as Record<string, unknown>;
    const newDoc = {
      id: docsData.length + 1,
      ...body,
      uploadedBy: user.id,
      uploadedByName: user.name,
      uploadedAt: new Date().toISOString().split('T')[0],
    };
    docsData.push(newDoc as any);
    return HttpResponse.json(newDoc, { status: 201 });
  }),

  http.delete('/api/documents/:id', ({ params }) => {
    const user = getCurrentUser();
    if (!user) return HttpResponse.json({ error: 'Not authenticated' }, { status: 401 });
    if (user.role !== 'system_admin') return HttpResponse.json({ error: 'Forbidden' }, { status: 403 });

    docsData = docsData.filter(d => d.id !== Number(params.id));
    return HttpResponse.json({ success: true });
  }),
];
