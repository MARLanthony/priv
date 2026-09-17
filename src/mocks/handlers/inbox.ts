import { http, HttpResponse } from 'msw';
import { inboxMessages } from '../data';
import { getCurrentUser } from './auth';

let messagesData = [...inboxMessages];

export const inboxHandlers = [
  http.get('/api/inbox', () => {
    const user = getCurrentUser();
    if (!user) return HttpResponse.json({ error: 'Not authenticated' }, { status: 401 });

    let filtered = messagesData;
    if (user.role !== 'system_admin') {
      filtered = messagesData.filter(m => m.userId === user.id);
    }
    return HttpResponse.json(filtered);
  }),

  http.get('/api/inbox/:id', ({ params }) => {
    const msg = messagesData.find(m => m.id === Number(params.id));
    if (!msg) return HttpResponse.json({ error: 'Message not found' }, { status: 404 });
    msg.read = true;
    return HttpResponse.json(msg);
  }),

  http.post('/api/inbox', async ({ request }) => {
    const user = getCurrentUser();
    if (!user) return HttpResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const body = await request.json() as Record<string, unknown>;
    const newMsg = {
      id: messagesData.length + 1,
      ...body,
      date: new Date().toISOString().split('T')[0],
      read: false,
      starred: false,
      userId: user.id,
    };
    messagesData.push(newMsg as any);
    return HttpResponse.json(newMsg, { status: 201 });
  }),

  http.get('/api/inbox/:id/reply', ({ params }) => {
    const msg = messagesData.find(m => m.id === Number(params.id));
    if (!msg) return HttpResponse.json({ error: 'Message not found' }, { status: 404 });
    return HttpResponse.json(msg.replies || []);
  }),
];
