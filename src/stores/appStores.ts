import { create } from 'zustand';
import { analyzeLegalProblem, type AIProgress, type LegalAnalysisResult } from '../ai';
import { Document, InboxMessage, Article, Appointment, Availability, TeamMember } from '../types';

interface DocumentState {
  documents: Document[];
  isLoading: boolean;
  fetchDocuments: () => Promise<void>;
  uploadDocument: (data: Partial<Document>) => Promise<void>;
  deleteDocument: (id: number) => Promise<void>;
}

export const useDocumentStore = create<DocumentState>((set) => ({
  documents: [],
  isLoading: false,
  fetchDocuments: async () => {
    set({ isLoading: true });
    const res = await fetch('/api/documents');
    const data = await res.json();
    set({ documents: data, isLoading: false });
  },
  uploadDocument: async (data) => {
    await fetch('/api/documents/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    useDocumentStore.getState().fetchDocuments();
  },
  deleteDocument: async (id) => {
    await fetch(`/api/documents/${id}`, { method: 'DELETE' });
    useDocumentStore.getState().fetchDocuments();
  },
}));

interface InboxState {
  messages: InboxMessage[];
  currentMessage: InboxMessage | null;
  isLoading: boolean;
  fetchMessages: () => Promise<void>;
  fetchMessage: (id: number) => Promise<void>;
  sendMessage: (data: Partial<InboxMessage>) => Promise<void>;
}

export const useInboxStore = create<InboxState>((set) => ({
  messages: [],
  currentMessage: null,
  isLoading: false,
  fetchMessages: async () => {
    set({ isLoading: true });
    const res = await fetch('/api/inbox');
    const data = await res.json();
    set({ messages: data, isLoading: false });
  },
  fetchMessage: async (id) => {
    const res = await fetch(`/api/inbox/${id}`);
    const data = await res.json();
    set({ currentMessage: data });
  },
  sendMessage: async (data) => {
    await fetch('/api/inbox', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    useInboxStore.getState().fetchMessages();
  },
}));

interface KnowledgeState {
  articles: Article[];
  currentArticle: Article | null;
  isLoading: boolean;
  fetchArticles: () => Promise<void>;
  fetchArticle: (id: number) => Promise<void>;
  createArticle: (data: Partial<Article>) => Promise<void>;
  updateArticle: (id: number, data: Partial<Article>) => Promise<void>;
  deleteArticle: (id: number) => Promise<void>;
}

export const useKnowledgeStore = create<KnowledgeState>((set) => ({
  articles: [],
  currentArticle: null,
  isLoading: false,
  fetchArticles: async () => {
    set({ isLoading: true });
    const res = await fetch('/api/knowledge/articles');
    const data = await res.json();
    set({ articles: data, isLoading: false });
  },
  fetchArticle: async (id) => {
    const res = await fetch(`/api/knowledge/articles/${id}`);
    const data = await res.json();
    set({ currentArticle: data });
  },
  createArticle: async (data) => {
    await fetch('/api/knowledge/articles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    useKnowledgeStore.getState().fetchArticles();
  },
  updateArticle: async (id, data) => {
    await fetch(`/api/knowledge/articles/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    useKnowledgeStore.getState().fetchArticles();
  },
  deleteArticle: async (id) => {
    await fetch(`/api/knowledge/articles/${id}`, { method: 'DELETE' });
    useKnowledgeStore.getState().fetchArticles();
  },
}));

interface AppointmentState {
  appointments: Appointment[];
  isLoading: boolean;
  fetchAppointments: () => Promise<void>;
  createAppointment: (data: Partial<Appointment>) => Promise<void>;
  updateAppointment: (id: number, data: Partial<Appointment>) => Promise<void>;
  deleteAppointment: (id: number) => Promise<void>;
}

export const useAppointmentStore = create<AppointmentState>((set) => ({
  appointments: [],
  isLoading: false,
  fetchAppointments: async () => {
    set({ isLoading: true });
    const res = await fetch('/api/appointments');
    const data = await res.json();
    set({ appointments: data, isLoading: false });
  },
  createAppointment: async (data) => {
    await fetch('/api/appointments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    useAppointmentStore.getState().fetchAppointments();
  },
  updateAppointment: async (id, data) => {
    await fetch(`/api/appointments/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    useAppointmentStore.getState().fetchAppointments();
  },
  deleteAppointment: async (id) => {
    await fetch(`/api/appointments/${id}`, { method: 'DELETE' });
    useAppointmentStore.getState().fetchAppointments();
  },
}));

interface AvailabilityState {
  slots: Availability[];
  isLoading: boolean;
  fetchAvailability: () => Promise<void>;
  createSlot: (data: Partial<Availability>) => Promise<void>;
  updateSlot: (id: number, data: Partial<Availability>) => Promise<void>;
  deleteSlot: (id: number) => Promise<void>;
}

export const useAvailabilityStore = create<AvailabilityState>((set) => ({
  slots: [],
  isLoading: false,
  fetchAvailability: async () => {
    set({ isLoading: true });
    const res = await fetch('/api/availability');
    const data = await res.json();
    set({ slots: data, isLoading: false });
  },
  createSlot: async (data) => {
    await fetch('/api/availability', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    useAvailabilityStore.getState().fetchAvailability();
  },
  updateSlot: async (id, data) => {
    await fetch(`/api/availability/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    useAvailabilityStore.getState().fetchAvailability();
  },
  deleteSlot: async (id) => {
    await fetch(`/api/availability/${id}`, { method: 'DELETE' });
    useAvailabilityStore.getState().fetchAvailability();
  },
}));

interface TeamState {
  members: TeamMember[];
  isLoading: boolean;
  fetchTeam: () => Promise<void>;
  addMember: (data: Partial<TeamMember>) => Promise<void>;
  updateMember: (id: number, data: Partial<TeamMember>) => Promise<void>;
  removeMember: (id: number) => Promise<void>;
}

export const useTeamStore = create<TeamState>((set) => ({
  members: [],
  isLoading: false,
  fetchTeam: async () => {
    set({ isLoading: true });
    const res = await fetch('/api/team');
    const data = await res.json();
    set({ members: data, isLoading: false });
  },
  addMember: async (data) => {
    await fetch('/api/team', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    useTeamStore.getState().fetchTeam();
  },
  updateMember: async (id, data) => {
    await fetch(`/api/team/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    useTeamStore.getState().fetchTeam();
  },
  removeMember: async (id) => {
    await fetch(`/api/team/${id}`, { method: 'DELETE' });
    useTeamStore.getState().fetchTeam();
  },
}));

interface NLPState {
  result: LegalAnalysisResult | null;
  isLoading: boolean;
  error: string | null;
  /** Real AI pipeline progress while an analysis is running. */
  progress: AIProgress | null;
  analyze: (query: string) => Promise<void>;
  setResult: (result: LegalAnalysisResult | null) => void;
  setLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
  setProgress: (progress: AIProgress | null) => void;
  clearResult: () => void;
}

export const useNLPStore = create<NLPState>((set) => ({
  result: null,
  isLoading: false,
  error: null,
  progress: null,
  analyze: async (query) => {
    set({ isLoading: true, error: null, progress: null });
    try {
      // OpenRouter first, then MSW mock data, then a local heuristic fallback.
      const result = await analyzeLegalProblem(query, {
        onProgress: progress => set({ progress }),
      });
      set({ result, isLoading: false, progress: null });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Analysis failed',
        isLoading: false,
        progress: null,
      });
    }
  },
  setResult: (result) => set({ result, isLoading: false, error: null, progress: null }),
  setLoading: (isLoading) => set({ isLoading, progress: null }),
  setError: (error) => set({ error, isLoading: false, progress: null }),
  setProgress: (progress) => set({ progress }),
  clearResult: () => set({ result: null, error: null, progress: null }),
}));

interface UIState {
  sidebarOpen: boolean;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
}

export const useUIStore = create<UIState>((set) => ({
  sidebarOpen: true,
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
}));
