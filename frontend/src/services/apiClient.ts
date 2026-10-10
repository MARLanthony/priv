/* ==========================================================================
   JurisFlow — HTTP client
   --------------------------------------------------------------------------
   Every data call in the app goes through this module, which talks to the
   Flask backend under `/api`. In development the MSW worker intercepts those
   requests and answers from `src/mocks/`, so the UI runs with no backend at
   all; point `VITE_API_BASE_URL` at the Flask server (or run the Vite dev
   proxy) and the very same calls hit the real API.
   ========================================================================== */

const RAW_BASE = (import.meta.env.VITE_API_BASE_URL ?? '/api').trim();
export const API_BASE_URL = RAW_BASE.replace(/\/+$/, '') || '/api';

/** localStorage slot for the bearer token. */
export const AUTH_TOKEN_STORAGE_KEY = 'jurisflow.token';

let authToken: string | null = null;

export function setAuthToken(token: string | null): void {
  authToken = token && token.trim() ? token.trim() : null;
  try {
    if (authToken) globalThis.localStorage?.setItem(AUTH_TOKEN_STORAGE_KEY, authToken);
    else globalThis.localStorage?.removeItem(AUTH_TOKEN_STORAGE_KEY);
  } catch {
    /* storage unavailable (private mode) — the in-memory token still works */
  }
}

export function getAuthToken(): string | null {
  if (authToken) return authToken;
  try {
    const stored = globalThis.localStorage?.getItem(AUTH_TOKEN_STORAGE_KEY) ?? '';
    authToken = stored.trim() || null;
  } catch {
    authToken = null;
  }
  return authToken;
}

/** Error thrown for any non-2xx response, carrying the backend's message. */
export class ApiRequestError extends Error {
  readonly status: number;
  readonly body: string;

  constructor(status: number, message: string, body = '') {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
    this.body = body;
  }
}

export type QueryValue = string | number | boolean | null | undefined;

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  query?: Record<string, QueryValue>;
  signal?: AbortSignal;
  /** Send the body as `FormData` (file uploads) instead of JSON. */
  formData?: FormData;
}

function buildUrl(path: string, query?: Record<string, QueryValue>): string {
  const url = `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
  if (!query) return url;

  const search = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value === null || value === undefined || value === '') return;
    search.append(key, String(value));
  });

  const qs = search.toString();
  return qs ? `${url}?${qs}` : url;
}

async function readError(response: Response): Promise<ApiRequestError> {
  let body = '';
  let message = `Request failed with status ${response.status}.`;

  try {
    body = await response.text();
    if (body) {
      try {
        const parsed = JSON.parse(body) as { error?: string; message?: string };
        message = parsed.error ?? parsed.message ?? message;
      } catch {
        message = body.slice(0, 300);
      }
    }
  } catch {
    /* body already consumed or unreadable — keep the status message */
  }

  return new ApiRequestError(response.status, message, body);
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, query, signal, formData } = options;
  const headers: Record<string, string> = { Accept: 'application/json' };

  const token = getAuthToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined && !formData) headers['Content-Type'] = 'application/json';

  let response: Response;
  try {
    response = await fetch(buildUrl(path, query), {
      method,
      headers,
      ...(formData ? { body: formData } : body !== undefined ? { body: JSON.stringify(body) } : {}),
      signal,
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'network error';
    throw new ApiRequestError(0, `Cannot reach the JurisFlow API (${reason}).`);
  }

  if (!response.ok) throw await readError(response);
  if (response.status === 204) return undefined as T;

  const text = await response.text();
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}

export const apiClient = {
  request,
  get: <T>(path: string, query?: Record<string, QueryValue>, signal?: AbortSignal) =>
    request<T>(path, { method: 'GET', query, signal }),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: 'POST', body }),
  put: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PUT', body }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PATCH', body }),
  del: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
  upload: <T>(path: string, formData: FormData) => request<T>(path, { method: 'POST', formData }),
};

/** Shorthand used by the AI layer to read reference data. */
export const apiGet = <T>(path: string, query?: Record<string, QueryValue>): Promise<T> =>
  apiClient.get<T>(path, query);
