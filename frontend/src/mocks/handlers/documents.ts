/* ==========================================================================
   Document handlers — `/api/documents`
   --------------------------------------------------------------------------
   Uploads arrive as `multipart/form-data`. The mock keeps the metadata (name,
   size, type, owner) in `db.documents` and answers the download route with a
   plain-text placeholder, which is exactly what the Flask + Supabase Storage
   pair replaces in production.
   ========================================================================== */

import { http } from 'msw';
import { db, newId } from '../db';
import type { Document, DocumentStatus, NLPResult } from '../../types';
import {
  asBoolean,
  asNumber,
  asString,
  badRequest,
  clientRecordFor,
  currentUser,
  forbidden,
  latency,
  matches,
  notFound,
  notify,
  ok,
  query,
  readJson,
  recordActivity,
  unauthorized,
} from '../utils';

const STATUSES: DocumentStatus[] = ['received', 'reviewing', 'processed', 'rejected'];

/** Cheap keyword classifier — the server-side stand-in for the AI pipeline. */
export function classifyDocument(name: string): string {
  const haystack = name.toLowerCase();
  if (/(title|deed|land|tenancy|lease)/.test(haystack)) return 'Property & Land';
  if (/(contract|agreement|mou|nda)/.test(haystack)) return 'Contract Review';
  if (/(divorce|custody|marriage|affidavit|petition|maintenance)/.test(haystack)) return 'Family Law';
  if (/(will|probate|estate|inheritance)/.test(haystack)) return 'Probate & Estates';
  if (/(invoice|receipt|statement|billing)/.test(haystack)) return 'Billing';
  if (/(motion|brief|summons|court|judgment)/.test(haystack)) return 'Litigation';
  return 'General Legal Document';
}

/** Builds (and stores) the stored analysis row for a document. */
function analyse(record: Document): NLPResult {
  const keywords = record.name
    .replace(/\.[a-z0-9]+$/i, '')
    .split(/[^a-z0-9]+/i)
    .filter(word => word.length > 3)
    .map(word => word.toLowerCase());

  const result: NLPResult = {
    id: newId(),
    documentId: record.id,
    documentName: record.name,
    classification: classifyDocument(record.name),
    extractedInfo: {
      fileName: record.name,
      client: record.clientName,
      case: record.caseName ?? null,
      keywords,
      detectedAt: new Date().toISOString(),
    },
    summary: `${record.name} was classified as “${classifyDocument(record.name)}” and filed against ${
      record.caseName ?? 'the client file'
    }.`,
    createdAt: new Date().toISOString(),
  };
  db.nlpResults.push(result);
  return result;
}

function assertDocumentAccess(request: Request, record: Document) {
  const actor = currentUser(request);
  if (!actor) return unauthorized();
  if (actor.role === 'client') {
    const own = clientRecordFor(actor);
    if (!own || record.clientId !== own.id) return forbidden('This document is not yours.');
  }
  return null;
}

export const documentHandlers = [
  /** `GET /documents?clientId=&caseId=&status=&q=` */
  http.get('/api/documents', async ({ request }) => {
    await latency();
    const actor = currentUser(request);
    if (!actor) return unauthorized();

    const clientId = asNumber(query(request, 'clientId'));
    const caseId = asNumber(query(request, 'caseId'));
    const status = query(request, 'status');
    const term = query(request, 'q');

    let rows = db.documents;
    if (actor.role === 'client') {
      const own = clientRecordFor(actor);
      rows = own ? rows.filter(item => item.clientId === own.id) : [];
    }

    const result = rows
      .filter(item => (clientId ? item.clientId === clientId : true))
      .filter(item => (caseId ? item.caseId === caseId : true))
      .filter(item => (status ? item.status === status : true))
      .filter(item => matches(term, item.name, item.clientName, item.caseName))
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

    return ok(result);
  }),

  /** `GET /documents/:id` */
  http.get('/api/documents/:id', async ({ request, params }) => {
    await latency(120);
    const id = Number(params.id);
    const record = db.documents.find(item => item.id === id);
    if (!record) return notFound(`Document #${id}`);

    const denied = assertDocumentAccess(request, record);
    if (denied) return denied;

    // The first read is what triggers analysis, as the Flask job does.
    if (!db.nlpResults.some(result => result.documentId === record.id)) analyse(record);
    return ok(record);
  }),

  /** `GET /documents/:id/download` — the browser cannot send an Authorization header. */
  http.get('/api/documents/:id/download', async ({ request, params }) => {
    await latency(80);
    const id = Number(params.id);
    const record = db.documents.find(item => item.id === id);
    if (!record) return notFound(`Document #${id}`);

    const denied = assertDocumentAccess(request, record);
    if (denied) return denied;

    return new Response(
      `JurisFlow local stand-in for ${record.name}\n\nUploaded by ${
        record.uploadedByName ?? 'unknown'
      } on ${record.createdAt}.\nIn production this route redirects to the Supabase Storage object.`,
      { status: 200, headers: { 'Content-Type': 'text/plain; charset=utf-8' } },
    );
  }),

  /** `GET /documents/:id/analysis` — stored NLP output for a document. */
  http.get('/api/documents/:id/analysis', async ({ request, params }) => {
    await latency(120);
    const id = Number(params.id);
    const record = db.documents.find(item => item.id === id);
    if (!record) return notFound(`Document #${id}`);

    const denied = assertDocumentAccess(request, record);
    if (denied) return denied;

    const existing = db.nlpResults.find(result => result.documentId === id);
    return ok(existing ?? analyse(record));
  }),

  /** `POST /documents` — multipart upload. */
  http.post('/api/documents', async ({ request }) => {
    await latency();
    const actor = currentUser(request);
    if (!actor) return unauthorized();

    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return badRequest('Send the upload as multipart/form-data.');
    }

    const file = form.get('file');
    if (!(file instanceof File)) return badRequest('Attach the file to upload.');
    if (file.size === 0) return badRequest('That file is empty.');

    // A client uploads to their own file only; staff and lawyers name the client.
    let clientId: number | undefined;
    if (actor.role === 'client') {
      clientId = clientRecordFor(actor)?.id;
      if (!clientId) return forbidden('Your account has no client file yet.');
    } else {
      clientId = asNumber(form.get('clientId'));
      if (!clientId) return badRequest('Choose the client this document belongs to.');
    }

    const client = db.clients.find(item => item.id === clientId);
    if (!client) return notFound(`Client #${clientId}`);

    const caseId = asNumber(form.get('caseId')) ?? null;
    if (caseId !== null) {
      const linkedCase = db.cases.find(item => item.id === caseId);
      if (!linkedCase) return notFound(`Case #${caseId}`);
    }

    const safeName = file.name.replace(/[^\w.\- ]+/g, '_');
    const record: Document = {
      id: newId(),
      clientId,
      clientName: client.fullName,
      caseId,
      caseName: caseId ? db.cases.find(item => item.id === caseId)?.title : undefined,
      name: safeName,
      fileUrl: `/uploads/${newId()}-${safeName}`,
      uploadedBy: actor.id,
      uploadedByName: actor.name,
      status: 'received',
      createdAt: new Date().toISOString(),
    };
    db.documents.push(record);

    const clientUserId = client.userId;
    if (clientUserId) {
      notify(clientUserId, 'document', `${record.name} was uploaded to your file.`);
    }

    recordActivity(actor, 'document.upload', `Uploaded ${record.name} for ${client.fullName}.`);
    return ok(record, 201);
  }),

  /** `PATCH /documents/:id/status` — staff/lawyers move a file through review. */
  http.patch('/api/documents/:id/status', async ({ request, params }) => {
    await latency();
    const actor = currentUser(request);
    if (!actor) return unauthorized();
    if (actor.role === 'client') return forbidden('A client cannot change the review status.');

    const id = Number(params.id);
    const record = db.documents.find(item => item.id === id);
    if (!record) return notFound(`Document #${id}`);

    const body = await readJson<{ status: DocumentStatus }>(request);
    if (!body.status || !STATUSES.includes(body.status)) {
      return badRequest(`Status must be one of: ${STATUSES.join(', ')}.`);
    }

    record.status = body.status;
    const clientUserId = db.clients.find(client => client.id === record.clientId)?.userId;
    if (clientUserId) {
      notify(clientUserId, 'document', `${record.name} is now marked as ${body.status}.`);
    }

    recordActivity(actor, 'document.status', `Moved ${record.name} to ${body.status}.`);
    return ok(record);
  }),

  /** `DELETE /documents/:id` — admin and lawyers only. */
  http.delete('/api/documents/:id', async ({ request, params }) => {
    await latency();
    const actor = currentUser(request);
    if (!actor) return unauthorized();
    if (actor.role !== 'admin' && actor.role !== 'lawyer') {
      return forbidden('Only the administrator or a lawyer may delete a document.');
    }

    const id = Number(params.id);
    const index = db.documents.findIndex(item => item.id === id);
    if (index === -1) return notFound(`Document #${id}`);

    const [removed] = db.documents.splice(index, 1);
    db.nlpResults = db.nlpResults.filter(result => result.documentId !== id);

    recordActivity(actor, 'document.delete', `Deleted ${removed.name}.`);
    return new Response(null, { status: 204 });
  }),
];
