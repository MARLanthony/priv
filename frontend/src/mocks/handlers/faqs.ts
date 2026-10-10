/* ==========================================================================
   FAQ + legal-services handlers — `/api/faqs`, `/api/services`
   --------------------------------------------------------------------------
   FAQs are readable by every role (the client portal shows them) but only
   `faqs.write` roles may edit them. The practice-area catalogue is firm-wide
   reference data, so it is admin-only.
   ========================================================================== */

import { http } from 'msw';
import { db, newId } from '../db';
import type { FAQ, LegalService } from '../../types';
import {
  asBoolean,
  asNumber,
  asString,
  badRequest,
  currentUser,
  forbidden,
  latency,
  matches,
  notFound,
  ok,
  query,
  readJson,
  recordActivity,
  unauthorized,
} from '../utils';
import { roleHasPermission } from '../../utils/rbac';

interface FaqBody {
  question: string;
  answer: string;
  category: string;
}

function assertFaqWriter(request: Request) {
  const actor = currentUser(request);
  if (!actor) return { actor: null, response: unauthorized() };
  if (!roleHasPermission(actor.role, 'faqs.write')) {
    return { actor, response: forbidden('Your role cannot manage the FAQ list.') };
  }
  return { actor, response: null };
}

export const faqHandlers = [
  /** `GET /faqs?category=&q=` */
  http.get('/api/faqs', async ({ request }) => {
    await latency(120);
    if (!currentUser(request)) return unauthorized();

    const category = query(request, 'category');
    const term = query(request, 'q');

    const rows = db.faqs
      .filter(item => (category ? item.category === category : true))
      .filter(item => matches(term, item.question, item.answer, item.category))
      .sort((a, b) => a.question.localeCompare(b.question));

    return ok(rows);
  }),

  /** `POST /faqs` */
  http.post('/api/faqs', async ({ request }) => {
    await latency();
    const { actor, response } = assertFaqWriter(request);
    if (response) return response;

    const body = await readJson<FaqBody>(request);
    const question = asString(body.question).trim();
    const answer = asString(body.answer).trim();
    if (question.length < 5) return badRequest('Write a question of at least 5 characters.');
    if (answer.length < 10) return badRequest('Write an answer of at least 10 characters.');

    const stamp = new Date().toISOString();
    const record: FAQ = {
      id: newId(),
      question,
      answer,
      category: asString(body.category, 'General'),
      createdBy: actor!.id,
      createdByName: actor!.name,
      createdAt: stamp,
      updatedAt: stamp,
    };
    db.faqs.unshift(record);

    recordActivity(actor!, 'faq.create', `Added the FAQ “${record.question}”.`);
    return ok(record, 201);
  }),

  /** `PUT /faqs/:id` */
  http.put('/api/faqs/:id', async ({ request, params }) => {
    await latency();
    const { actor, response } = assertFaqWriter(request);
    if (response) return response;

    const id = Number(params.id);
    const record = db.faqs.find(item => item.id === id);
    if (!record) return notFound(`FAQ #${id}`);

    const body = await readJson<FaqBody>(request);
    Object.assign(record, {
      question: asString(body.question, record.question),
      answer: asString(body.answer, record.answer),
      category: asString(body.category, record.category),
      updatedAt: new Date().toISOString(),
    } satisfies Partial<FAQ>);

    recordActivity(actor!, 'faq.update', `Edited the FAQ “${record.question}”.`);
    return ok(record);
  }),

  /** `DELETE /faqs/:id` */
  http.delete('/api/faqs/:id', async ({ request, params }) => {
    await latency();
    const { actor, response } = assertFaqWriter(request);
    if (response) return response;

    const id = Number(params.id);
    const index = db.faqs.findIndex(item => item.id === id);
    if (index === -1) return notFound(`FAQ #${id}`);

    const [removed] = db.faqs.splice(index, 1);
    recordActivity(actor!, 'faq.delete', `Removed the FAQ “${removed.question}”.`);
    return new Response(null, { status: 204 });
  }),
];

/* ------------------------------------------------------- practice areas */

interface ServiceBody {
  name: string;
  description: string;
  isActive?: boolean;
}

export const serviceHandlers = [
  /** `GET /services?isActive=` — the firm's practice areas. */
  http.get('/api/services', async ({ request }) => {
    await latency(120);
    if (!currentUser(request)) return unauthorized();

    const isActive = asBoolean(query(request, 'isActive'));
    const rows = db.legalServices
      .filter(item => (isActive === undefined ? true : item.isActive === isActive))
      .sort((a, b) => a.name.localeCompare(b.name));

    return ok(rows);
  }),

  /** `POST /services` — admin only. */
  http.post('/api/services', async ({ request }) => {
    await latency();
    const actor = currentUser(request);
    if (!actor) return unauthorized();
    if (actor.role !== 'admin') return forbidden('Only the administrator may add a practice area.');

    const body = await readJson<ServiceBody>(request);
    const name = asString(body.name).trim();
    if (!name) return badRequest('A name is required.');

    const record: LegalService = {
      id: newId(),
      name,
      description: asString(body.description),
      isActive: body.isActive !== false,
      createdAt: new Date().toISOString(),
    };
    db.legalServices.push(record);

    recordActivity(actor, 'service.create', `Added the practice area ${name}.`);
    return ok(record, 201);
  }),

  /** `PUT /services/:id` — admin only. */
  http.put('/api/services/:id', async ({ request, params }) => {
    await latency();
    const actor = currentUser(request);
    if (!actor) return unauthorized();
    if (actor.role !== 'admin') return forbidden('Only the administrator may edit a practice area.');

    const id = Number(params.id);
    const record = db.legalServices.find(item => item.id === id);
    if (!record) return notFound(`Service #${id}`);

    const body = await readJson<ServiceBody>(request);
    Object.assign(record, {
      name: asString(body.name, record.name),
      description: asString(body.description, record.description),
      isActive: asBoolean(body.isActive) ?? record.isActive,
    } satisfies Partial<LegalService>);

    recordActivity(actor, 'service.update', `Edited the practice area ${record.name}.`);
    return ok(record);
  }),

  /** `DELETE /services/:id` — admin only; refused while it is still referenced. */
  http.delete('/api/services/:id', async ({ request, params }) => {
    await latency();
    const actor = currentUser(request);
    if (!actor) return unauthorized();
    if (actor.role !== 'admin') return forbidden('Only the administrator may delete a practice area.');

    const id = Number(params.id);
    const index = db.legalServices.findIndex(item => item.id === id);
    if (index === -1) return notFound(`Service #${id}`);

    const [removed] = db.legalServices.splice(index, 1);
    db.consultations.forEach(consultation => {
      if (consultation.serviceId === id) {
        consultation.serviceId = null;
        consultation.serviceName = undefined;
      }
    });

    recordActivity(actor, 'service.delete', `Deleted the practice area ${removed.name}.`);
    return new Response(null, { status: 204 });
  }),
];
