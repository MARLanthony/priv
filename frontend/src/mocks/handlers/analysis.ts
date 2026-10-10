/* ==========================================================================
   Analysis + knowledge handlers — `/api/nlp`, `/api/knowledge`
   --------------------------------------------------------------------------
   The interactive AI path runs in the browser against `/api/ai/chat`; these
   routes are the *firm's* record of an analysis (stored against a client) and
   the knowledge base that grounds those answers.
   ========================================================================== */

import { http } from 'msw';
import { db, newId } from '../db';
import type { AppointmentSlot, Article, NLPAnalysis, NLPResult } from '../../types';
import type { EmailReply, EmailReplyContext, EmailTone } from '../../ai/types';
import { DEFAULT_NEXT_STEPS, SPECIALIST_BY_CASE_TYPE } from '../../ai/prompts/legalIntake';
import {
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

interface AnalyzeBody {
  query: string;
  clientId?: number;
}

/** Keyword → practice area, mirroring `src/ai/prompts/legalIntake.ts`. */
const TOPICS: { pattern: RegExp; caseType: string; services: string[] }[] = [
  { pattern: /(divorce|marriage|custody|maintenance|spouse)/i, caseType: 'Family Law', services: ['Divorce & Separation', 'Child Custody'] },
  { pattern: /(land|title|deed|property|tenant|lease)/i, caseType: 'Property & Land', services: ['Land Title Registration', 'Tenancy Disputes'] },
  { pattern: /(employ|dismiss|salary|redundancy|workplace)/i, caseType: 'Employment Law', services: ['Wrongful Dismissal Claims'] },
  { pattern: /(company|shareholder|partnership|contract|agreement)/i, caseType: 'Corporate & Commercial', services: ['Contract Drafting & Review'] },
  { pattern: /(will|estate|probate|inherit)/i, caseType: 'Probate & Estates', services: ['Will Drafting', 'Probate Administration'] },
  { pattern: /(arrest|police|charge|criminal|bail)/i, caseType: 'Criminal Defence', services: ['Criminal Defence'] },
  { pattern: /(immigrat|visa|permit|residency)/i, caseType: 'Immigration', services: ['Residency Applications'] },
];

const STOP_WORDS = new Set([
  'the', 'and', 'for', 'with', 'that', 'this', 'have', 'from', 'about', 'into', 'your', 'their',
  'been', 'they', 'will', 'what', 'when', 'want', 'need', 'help', 'please', 'over', 'case',
]);

function keywordsOf(text: string): string[] {
  return Array.from(
    new Set(
      text
        .toLowerCase()
        .split(/[^a-z]+/)
        .filter(word => word.length > 3 && !STOP_WORDS.has(word)),
    ),
  ).slice(0, 8);
}

/** Knowledge-base articles whose title/keywords/body overlap the enquiry. */
function matchArticles(keywords: string[], limit = 4): Article[] {
  return db.articles
    .filter(article => article.status === 'published')
    .map(article => {
      const headline = `${article.title} ${article.category} ${article.keywords.join(' ')}`.toLowerCase();
      const body = `${article.summary} ${article.content}`.toLowerCase();
      const score = keywords.reduce(
        (total, keyword) => total + (headline.includes(keyword) ? 2 : 0) + (body.includes(keyword) ? 1 : 0),
        0,
      );
      return { article, score };
    })
    .filter(entry => entry.score > 0)
    .sort((a, b) => b.score - a.score || b.article.matchCount - a.article.matchCount)
    .slice(0, limit)
    .map(entry => entry.article);
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** Bookable slots built from the attorney's published office hours. */
function slotsFor(attorneyName: string, max = 6): AppointmentSlot[] {
  const open = db.availability.filter(window => window.isAvailable);
  const forAttorney = open.filter(window => window.lawyerName === attorneyName);
  const source = forAttorney.length > 0 ? forAttorney : open;

  const slots: AppointmentSlot[] = [];
  for (let offset = 1; offset <= 10 && slots.length < max; offset++) {
    const date = new Date();
    date.setDate(date.getDate() + offset);

    const window = source.find(entry => entry.dayOfWeek === DAY_NAMES[date.getDay()]);
    if (!window) continue;

    slots.push({ date: date.toISOString().split('T')[0], time: window.startTime, available: true });
  }

  return slots;
}

export const analysisHandlers = [
  /**
   * `POST /nlp/analyze` — server-side legal intake.
   *
   * The response carries two shapes in one payload:
   *   · the stored `NLPResult` record (`id`, `classification`, `extractedInfo`,
   *     `createdAt`) that the firm's analysis screen and `/nlp/results` read; and
   *   · the `NLPAnalysis` fields (`suggestedCaseType`, `matchedArticles`,
   *     `recommendedAttorney`, …) that `nlpService` needs when OpenRouter is
   *     unavailable, so the offline fallback resolves as `source: 'msw'`
   *     instead of dropping straight to the local heuristic.
   *
   * `summary` belongs to the analysis (the plain-language assessment shown by
   * `LegalAnalysisPanel`); the stored copy keeps its own audit sentence.
   */
  http.post('/api/nlp/analyze', async ({ request }) => {
    await latency();
    const actor = currentUser(request);
    if (!actor) return unauthorized();

    const body = await readJson<AnalyzeBody>(request);
    const text = asString(body.query).trim();
    if (text.length < 15) return badRequest('Describe the situation in at least 15 characters.');

    const clientId = asNumber(body.clientId) ?? null;
    const topic = TOPICS.find(entry => entry.pattern.test(text));
    const keywords = keywordsOf(text);

    const matched = matchArticles(keywords);
    const suggestedCaseType = topic?.caseType ?? 'General Legal Consultation';
    const specialist = matched.find(article => Boolean(article.attorneySpecialist));
    const attorneyName =
      specialist?.attorneySpecialist ?? SPECIALIST_BY_CASE_TYPE[suggestedCaseType] ?? 'Intake Team';

    const result: NLPResult = {
      id: newId(),
      documentId: 0,
      documentName: 'Intake conversation',
      classification: topic?.caseType ?? 'General Enquiry',
      extractedInfo: {
        clientId,
        keywords,
        suggestedCaseType,
        services: topic?.services ?? [],
        urgency: /(urgent|deadline|court|arrest|immediately)/i.test(text) ? 'High' : 'Medium',
      },
      summary: `${actor.name} ran an intake analysis${
        clientId ? ` for client #${clientId}` : ''
      }: ${keywords.slice(0, 4).join(', ') || 'no keywords'}.`,
      createdAt: new Date().toISOString(),
    };
    db.nlpResults.push(result);

    const analysis: NLPAnalysis = {
      query: text,
      extractedKeywords: keywords,
      suggestedCaseType,
      confidence: Math.min(95, 40 + matched.length * 20),
      matchedArticles: matched,
      recommendedAttorney: {
        name: attorneyName,
        specialization: specialist?.category ?? suggestedCaseType,
        availableSlots: slotsFor(attorneyName),
      },
      requiredServices: topic?.services.length ? topic.services : ['Legal Consultation'],
      nextSteps: DEFAULT_NEXT_STEPS,
      summary: `Offline keyword assessment: this reads as ${suggestedCaseType}${
        matched.length > 0
          ? `, supported by ${matched.length} matching article${matched.length === 1 ? '' : 's'} from the knowledge base`
          : '; no knowledge-base article matched closely, so the firm should review it manually'
      }. Key terms: ${keywords.slice(0, 6).join(', ') || 'none detected'}.`,
    };

    recordActivity(actor, 'nlp.analyze', `Analysed an intake enquiry (${result.classification}).`);
    return ok({ ...result, ...analysis }, 201);
  }),

  /** `GET /nlp/results?clientId=` — previously computed analyses. */
  http.get('/api/nlp/results', async ({ request }) => {
    await latency(120);
    const actor = currentUser(request);
    if (!actor) return unauthorized();

    const clientId = asNumber(query(request, 'clientId'));
    let rows = db.nlpResults;

    if (actor.role === 'client') {
      const own = db.clients.find(client => client.userId === actor.id);
      const ownDocumentIds = db.documents
        .filter(document => document.clientId === own?.id)
        .map(document => document.id);
      rows = rows.filter(result => result.documentId === 0 || ownDocumentIds.includes(result.documentId));
    } else if (clientId) {
      const documentIds = db.documents
        .filter(document => document.clientId === clientId)
        .map(document => document.id);
      rows = rows.filter(result => result.documentId === 0 || documentIds.includes(result.documentId));
    }

    return ok([...rows].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)));
  }),

  /** `POST /nlp/email-reply` — drafts the firm's reply (same shape as the AI layer). */
  http.post('/api/nlp/email-reply', async ({ request }) => {
    await latency();
    const actor = currentUser(request);
    if (!actor) return unauthorized();
    if (actor.role === 'client') return forbidden('Only the firm drafts replies.');

    const body = await readJson<{ context: EmailReplyContext; tone?: string }>(request);
    const context = body.context ?? {};
    const tone = (asString(body.tone, context.tone ?? 'professional') as EmailTone) ?? 'professional';

    const clientName = context.clientName ?? 'there';
    const firmName = context.firmName ?? 'JurisFlow Legal';
    const reference = context.caseNumber ? ` (${context.caseNumber})` : '';

    const reply: EmailReply = {
      tone,
      subject: `Re: ${context.caseType ?? 'Your enquiry'}${reference}`,
      body: [
        `Dear ${clientName},`,
        '',
        `Thank you for reaching out to ${firmName}. We have received your enquiry regarding ${
          context.caseType ?? 'your matter'
        }${reference} and it has been assigned to ${context.attorneyName ?? 'a member of our team'}.`,
        '',
        context.caseSummary
          ? `Our understanding of the position: ${context.caseSummary}`
          : 'We will review the information you have shared and come back to you with the next steps.',
        '',
        'Please send any supporting documents at your earliest convenience so we can move this forward.',
        '',
        'Kind regards,',
        context.attorneyName ?? 'The Client Care Team',
        firmName,
      ].join('\n'),
    };

    return ok(reply);
  }),

  /** `GET /knowledge/articles?status=&category=&q=` — grounds the AI answers. */
  http.get('/api/knowledge/articles', async ({ request }) => {
    await latency(120);
    const actor = currentUser(request);
    if (!actor) return unauthorized();

    const status = query(request, 'status');
    const category = query(request, 'category');
    const term = query(request, 'q');

    // Clients only ever see what the firm has published.
    const visible = actor.role === 'client' ? 'published' : status;

    const rows = db.articles
      .filter(item => (visible ? item.status === visible : true))
      .filter(item => (category ? item.category === category : true))
      .filter(item => matches(term, item.title, item.summary, item.category, item.keywords.join(' ')))
      .sort((a, b) => b.matchCount - a.matchCount || a.title.localeCompare(b.title));

    return ok(rows.map(article => ({ ...article })));
  }),

  /** `GET /knowledge/articles/:id` */
  http.get('/api/knowledge/articles/:id', async ({ request, params }) => {
    await latency(120);
    const actor = currentUser(request);
    if (!actor) return unauthorized();

    const id = Number(params.id);
    const record = db.articles.find(item => item.id === id);
    if (!record) return notFound(`Article #${id}`);
    if (actor.role === 'client' && record.status !== 'published') {
      return notFound(`Article #${id}`);
    }

    record.matchCount += 1;
    return ok({ ...record });
  }),

  /** `POST /knowledge/articles` — admin and lawyers curate the knowledge base. */
  http.post('/api/knowledge/articles', async ({ request }) => {
    await latency();
    const actor = currentUser(request);
    if (!actor) return unauthorized();
    if (actor.role === 'staff' || actor.role === 'client') {
      return forbidden('Your role cannot curate the knowledge base.');
    }

    const body = await readJson<Partial<Article>>(request);
    const title = asString(body.title).trim();
    if (title.length < 5) return badRequest('Give the article a title of at least 5 characters.');

    const stamp = new Date().toISOString();
    const record: Article = {
      id: newId(),
      title,
      category: asString(body.category, 'General'),
      keywords: (body.keywords ?? []).map(keyword => asString(keyword)).filter(Boolean),
      summary: asString(body.summary),
      content: asString(body.content),
      attorneySpecialist: asString(body.attorneySpecialist, 'General Practice'),
      servicesNeeded: (body.servicesNeeded ?? []).map(service => asString(service)).filter(Boolean),
      status: body.status === 'draft' ? 'draft' : 'published',
      matchCount: 0,
      createdAt: stamp,
      updatedAt: stamp,
    };
    db.articles.unshift(record);

    recordActivity(actor, 'article.create', `Added the article “${record.title}”.`);
    return ok(record, 201);
  }),

  /** `PUT /knowledge/articles/:id` */
  http.put('/api/knowledge/articles/:id', async ({ request, params }) => {
    await latency();
    const actor = currentUser(request);
    if (!actor) return unauthorized();
    if (actor.role === 'staff' || actor.role === 'client') {
      return forbidden('Your role cannot curate the knowledge base.');
    }

    const id = Number(params.id);
    const record = db.articles.find(item => item.id === id);
    if (!record) return notFound(`Article #${id}`);

    const body = await readJson<Partial<Article>>(request);
    Object.assign(record, {
      title: asString(body.title, record.title),
      category: asString(body.category, record.category),
      keywords: body.keywords ?? record.keywords,
      summary: asString(body.summary, record.summary),
      content: asString(body.content, record.content),
      attorneySpecialist: asString(body.attorneySpecialist, record.attorneySpecialist),
      servicesNeeded: body.servicesNeeded ?? record.servicesNeeded,
      status: body.status === 'draft' || body.status === 'published' ? body.status : record.status,
      updatedAt: new Date().toISOString(),
    } satisfies Partial<Article>);

    recordActivity(actor, 'article.update', `Edited the article “${record.title}”.`);
    return ok(record);
  }),

  /** `DELETE /knowledge/articles/:id` — admin only. */
  http.delete('/api/knowledge/articles/:id', async ({ request, params }) => {
    await latency();
    const actor = currentUser(request);
    if (!actor) return unauthorized();
    if (actor.role !== 'admin') return forbidden('Only the administrator may delete an article.');

    const id = Number(params.id);
    const index = db.articles.findIndex(item => item.id === id);
    if (index === -1) return notFound(`Article #${id}`);

    const [removed] = db.articles.splice(index, 1);
    recordActivity(actor, 'article.delete', `Deleted the article “${removed.title}”.`);
    return new Response(null, { status: 204 });
  }),
];
