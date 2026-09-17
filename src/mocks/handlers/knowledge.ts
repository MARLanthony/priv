import { http, HttpResponse } from 'msw';
import { articles } from '../data';
import { getCurrentUser } from './auth';

let articlesData = [...articles];

export const knowledgeHandlers = [
  http.get('/api/knowledge/articles', () => {
    return HttpResponse.json(articlesData);
  }),

  http.get('/api/knowledge/articles/:id', ({ params }) => {
    const article = articlesData.find(a => a.id === Number(params.id));
    if (!article) return HttpResponse.json({ error: 'Article not found' }, { status: 404 });
    return HttpResponse.json(article);
  }),

  http.post('/api/knowledge/articles', async ({ request }) => {
    const user = getCurrentUser();
    if (!user || user.role !== 'system_admin') {
      return HttpResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json() as Record<string, unknown>;
    const newArticle = {
      id: articlesData.length + 1,
      ...body,
      matchCount: 0,
      createdAt: new Date().toISOString().split('T')[0],
      updatedAt: new Date().toISOString().split('T')[0],
    };
    articlesData.push(newArticle as any);
    return HttpResponse.json(newArticle, { status: 201 });
  }),

  http.put('/api/knowledge/articles/:id', async ({ params, request }) => {
    const user = getCurrentUser();
    if (!user || user.role !== 'system_admin') {
      return HttpResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const idx = articlesData.findIndex(a => a.id === Number(params.id));
    if (idx === -1) return HttpResponse.json({ error: 'Article not found' }, { status: 404 });

    const body = await request.json() as Record<string, unknown>;
    articlesData[idx] = { ...articlesData[idx], ...body, updatedAt: new Date().toISOString().split('T')[0] };
    return HttpResponse.json(articlesData[idx]);
  }),

  http.delete('/api/knowledge/articles/:id', ({ params }) => {
    const user = getCurrentUser();
    if (!user || user.role !== 'system_admin') {
      return HttpResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    articlesData = articlesData.filter(a => a.id !== Number(params.id));
    return HttpResponse.json({ success: true });
  }),
];
