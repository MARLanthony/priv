/* ==========================================================================
   Documents API (Flask `/api/documents`)
   --------------------------------------------------------------------------
   Uploads are `multipart/form-data` so the browser streams the file straight
   to Flask, which stores it (Supabase Storage in production, `backend/uploads`
   locally) and returns the record with its `fileUrl`.
   ========================================================================== */

import { apiClient, API_BASE_URL, getAuthToken } from './apiClient';
import type { Document, DocumentStatus, NLPResult } from '../types';

export interface DocumentQuery {
  clientId?: number;
  caseId?: number;
  status?: DocumentStatus | '';
  q?: string;
}

export interface DocumentUpload {
  file: File;
  clientId?: number;
  caseId?: number | null;
}

/** `GET /documents` */
export function listDocuments(query: DocumentQuery = {}): Promise<Document[]> {
  return apiClient.get<Document[]>('/documents', {
    clientId: query.clientId,
    caseId: query.caseId,
    status: query.status || undefined,
    q: query.q || undefined,
  });
}

/** `GET /documents/:id` */
export function getDocument(id: number): Promise<Document> {
  return apiClient.get<Document>(`/documents/${id}`);
}

/** `POST /documents` (multipart) */
export function uploadDocument({ file, clientId, caseId }: DocumentUpload): Promise<Document> {
  const form = new FormData();
  form.append('file', file);
  if (clientId !== undefined) form.append('clientId', String(clientId));
  if (caseId !== undefined && caseId !== null) form.append('caseId', String(caseId));
  return apiClient.upload<Document>('/documents', form);
}

/** `PATCH /documents/:id/status` — staff marks a file as reviewed/processed. */
export function updateDocumentStatus(id: number, status: DocumentStatus): Promise<Document> {
  return apiClient.patch<Document>(`/documents/${id}/status`, { status });
}

/** `DELETE /documents/:id` */
export function deleteDocument(id: number): Promise<void> {
  return apiClient.del<void>(`/documents/${id}`);
}

/**
 * Absolute URL of the stored file.
 * The API is bearer-protected, so the download link carries the token as a
 * query parameter (the browser cannot add an Authorization header there).
 */
export function getDownloadUrl(id: number, fileUrl?: string): string {
  const token = getAuthToken();
  const query = token ? `?token=${encodeURIComponent(token)}` : '';

  if (fileUrl && /^https?:\/\//i.test(fileUrl)) return fileUrl;
  if (fileUrl) return `${API_BASE_URL}${fileUrl.startsWith('/') ? fileUrl : `/${fileUrl}`}${query}`;
  return `${API_BASE_URL}/documents/${id}/download${query}`;
}

/** `GET /documents/:id/analysis` — stored NLP output for a document. */
export function getDocumentAnalysis(id: number): Promise<NLPResult> {
  return apiClient.get<NLPResult>(`/documents/${id}/analysis`);
}

export const documentService = {
  listDocuments,
  getDocument,
  uploadDocument,
  updateDocumentStatus,
  deleteDocument,
  getDownloadUrl,
  getDocumentAnalysis,
};
