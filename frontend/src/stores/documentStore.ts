import { create } from 'zustand';
import * as documentApi from '../services/documentService';
import type { DocumentUpload, DocumentQuery } from '../services/documentService';
import type { Document, DocumentStatus, NLPResult } from '../types';

/** Document state: the vault a client uploads into and staff review from. */

export interface DocumentState {
  items: Document[];
  selected: Document | null;
  analysis: NLPResult | null;
  uploading: boolean;
  loading: boolean;
  error: string | null;
  /** 0-100 while an upload is in flight (used by the progress bar). */
  progress: number;

  fetchDocuments: (query?: DocumentQuery) => Promise<Document[]>;
  fetchDocument: (id: number) => Promise<Document | null>;
  upload: (payload: DocumentUpload) => Promise<Document>;
  setStatus: (id: number, status: DocumentStatus) => Promise<Document>;
  remove: (id: number) => Promise<void>;
  loadAnalysis: (id: number) => Promise<NLPResult | null>;
  select: (item: Document | null) => void;
  reset: () => void;
}

const message = (error: unknown, fallback: string): string =>
  error instanceof Error ? error.message : fallback;

const upsert = (items: Document[], item: Document): Document[] =>
  items.some(entry => entry.id === item.id)
    ? items.map(entry => (entry.id === item.id ? item : entry))
    : [item, ...items];

export const useDocumentStore = create<DocumentState>((set) => ({
  items: [],
  selected: null,
  analysis: null,
  uploading: false,
  loading: false,
  error: null,
  progress: 0,

  fetchDocuments: async (query = {}) => {
    set({ loading: true, error: null });
    try {
      const items = await documentApi.listDocuments(query);
      set({ items, loading: false });
      return items;
    } catch (error) {
      set({ loading: false, error: message(error, 'Could not load documents.') });
      return [];
    }
  },

  fetchDocument: async (id) => {
    set({ loading: true, error: null, analysis: null });
    try {
      const item = await documentApi.getDocument(id);
      set(state => ({ loading: false, selected: item, items: upsert(state.items, item) }));
      return item;
    } catch (error) {
      set({ loading: false, error: message(error, 'Could not load this document.') });
      return null;
    }
  },

  upload: async (payload) => {
    set({ uploading: true, error: null, progress: 5 });
    try {
      const created = await documentApi.uploadDocument(payload);
      set(state => ({ uploading: false, progress: 100, items: [created, ...state.items] }));
      return created;
    } catch (error) {
      set({ uploading: false, progress: 0, error: message(error, 'Upload failed.') });
      throw error;
    }
  },

  setStatus: async (id, status) => {
    try {
      const updated = await documentApi.updateDocumentStatus(id, status);
      set(state => ({
        items: upsert(state.items, updated),
        selected: state.selected?.id === id ? updated : state.selected,
      }));
      return updated;
    } catch (error) {
      set({ error: message(error, 'Could not update the document.') });
      throw error;
    }
  },

  remove: async (id) => {
    await documentApi.deleteDocument(id);
    set(state => ({
      items: state.items.filter(entry => entry.id !== id),
      selected: state.selected?.id === id ? null : state.selected,
    }));
  },

  loadAnalysis: async (id) => {
    try {
      const analysis = await documentApi.getDocumentAnalysis(id);
      set({ analysis });
      return analysis;
    } catch {
      // A document that has not been analysed yet simply has no result.
      set({ analysis: null });
      return null;
    }
  },

  select: (item) => set({ selected: item, analysis: null }),

  reset: () => set({ items: [], selected: null, analysis: null, error: null, progress: 0 }),
}));
