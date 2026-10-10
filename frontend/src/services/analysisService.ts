/* ==========================================================================
   Analysis / knowledge APIs (Flask `/api/nlp`, `/api/knowledge`, `/api/ai`)
   --------------------------------------------------------------------------
   The AI pipeline itself lives in `src/ai/` and talks to `/api/ai/chat`.
   This module only exposes the *firm* endpoints: the stored knowledge base,
   the server-side intake endpoint used by the mocks/offline path, and e-mail
   reply drafting.
   ========================================================================== */

import { apiClient } from './apiClient';
import type { Article, NLPResult } from '../types';
import type { EmailReply, EmailReplyContext } from '../ai/types';

export interface AnalyzePayload {
  query: string;
  clientId?: number;
}

export interface ArticleQuery {
  status?: 'published' | 'draft';
  category?: string;
  q?: string;
}

/**
 * `POST /nlp/analyze` — server-side legal intake.
 *
 * The interactive path in the UI runs the analysis in the browser via
 * `src/ai/services/nlpService.ts` (streamed progress, local heuristic
 * fallback). This endpoint is the server equivalent, used when the firm wants
 * the result stored against a client and returned as a `NLPResult`.
 */
export function analyzeText(payload: AnalyzePayload): Promise<NLPResult> {
  return apiClient.post<NLPResult>('/nlp/analyze', payload);
}

/** `GET /nlp/results` — previously computed analyses. */
export function listAnalysisResults(clientId?: number): Promise<NLPResult[]> {
  return apiClient.get<NLPResult[]>('/nlp/results', { clientId });
}

/** `POST /nlp/email-reply` — drafts a reply (backed by the same AI proxy). */
export function draftEmailReply(payload: {
  context: EmailReplyContext;
  tone?: string;
}): Promise<EmailReply> {
  return apiClient.post<EmailReply>('/nlp/email-reply', payload);
}

/** `GET /knowledge/articles` — the knowledge base that grounds the AI answers. */
export function listArticles(query: ArticleQuery = {}): Promise<Article[]> {
  return apiClient.get<Article[]>('/knowledge/articles', {
    status: query.status || undefined,
    category: query.category || undefined,
    q: query.q || undefined,
  });
}

/** `GET /knowledge/articles/:id` */
export function getArticle(id: number): Promise<Article> {
  return apiClient.get<Article>(`/knowledge/articles/${id}`);
}

/** `POST /knowledge/articles` — admin/lawyer curates the knowledge base. */
export function createArticle(payload: Partial<Article>): Promise<Article> {
  return apiClient.post<Article>('/knowledge/articles', payload);
}

/** `PUT /knowledge/articles/:id` */
export function updateArticle(id: number, payload: Partial<Article>): Promise<Article> {
  return apiClient.put<Article>(`/knowledge/articles/${id}`, payload);
}

/** `DELETE /knowledge/articles/:id` */
export function deleteArticle(id: number): Promise<void> {
  return apiClient.del<void>(`/knowledge/articles/${id}`);
}

export const analysisService = {
  analyzeText,
  listAnalysisResults,
  draftEmailReply,
  listArticles,
  getArticle,
  createArticle,
  updateArticle,
  deleteArticle,
};
