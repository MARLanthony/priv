import type { AIMessage, AIReasoningOptions } from '../types';
import { API_BASE_URL } from '../../services/apiClient';

/**
 * OpenRouter access — via the Flask backend.
 *
 * The browser never sees the OpenRouter key: it lives in `backend/.env`
 * (`OPENROUTER_API_KEY`) and Flask proxies `/api/ai/chat` for us. That keeps
 * the secret out of the bundle and lets the backend own the model chain,
 * retries and rate limits.
 *
 * Everything below therefore only decides *what* to ask for; the backend
 * decides *how* (including which model ids to try, in order).
 */

const readEnv = (key: string): string => {
  const source = (import.meta as unknown as { env?: Record<string, string | undefined> }).env;
  return (source?.[key] ?? '').trim();
};

const readNumberEnv = (key: string, fallback: number): number => {
  const parsed = Number(readEnv(key));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

/** Like `readNumberEnv` but accepts 0 (used to switch features off). */
const readNonNegativeEnv = (key: string, fallback: number): number => {
  const raw = readEnv(key);
  if (raw === '') return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
};

/** The backend proxy endpoint that fronts OpenRouter. */
export const OPENROUTER_BASE_URL = `${API_BASE_URL}/ai`;

export interface OpenRouterConfig {
  /** Always empty in the browser — the key lives in `backend/.env`. */
  apiKey: string;
  baseUrl: string;
  httpReferer: string;
  title: string;
  /** Per-attempt timeout. Generous because the intake model is allowed to reason. */
  timeoutMs: number;
  /** Extra attempts per model (0 = single attempt; saves free-tier quota). */
  maxRetries: number;
  /** Start the next model in parallel if this one takes longer (0 = off). */
  hedgeAfterMs: number;
  /** Hard budget for the whole fallback chain before giving up. */
  totalTimeoutMs: number;
}

const defaultReferer =
  typeof window !== 'undefined' && window.location?.origin
    ? window.location.origin
    : 'https://jurisflow.local';

export const openRouterConfig: OpenRouterConfig = {
  apiKey: '',
  baseUrl: readEnv('VITE_AI_BASE_URL') || OPENROUTER_BASE_URL,
  httpReferer: defaultReferer,
  title: readEnv('VITE_AI_TITLE') || 'JurisFlow',
  timeoutMs: readNumberEnv('VITE_AI_TIMEOUT_MS', 60000),
  maxRetries: readNonNegativeEnv('VITE_AI_MAX_RETRIES', 1),
  hedgeAfterMs: readNonNegativeEnv('VITE_AI_HEDGE_AFTER_MS', 0),
  totalTimeoutMs: readNumberEnv('VITE_AI_TOTAL_TIMEOUT_MS', 120000),
};

/**
 * The backend always owns a key, so the AI path is always available. When the
 * Flask server is unreachable the call fails with a network error and the
 * services fall back to their local heuristics.
 */
export const isOpenRouterConfigured = (): boolean => true;

/** Headers for the proxy call — the key is added by the backend, not here. */
export const getOpenRouterHeaders = (): Record<string, string> => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };

  try {
    const token = globalThis.localStorage?.getItem('jurisflow.token');
    if (token) headers.Authorization = `Bearer ${token}`;
  } catch {
    /* storage unavailable — the proxy route is also reachable anonymously */
  }

  return headers;
};

export interface OpenRouterChatPayload {
  model?: string;
  messages: AIMessage[];
  temperature?: number;
  max_tokens?: number;
  response_format?: { type: 'json_object' };
  /** Set `{ enabled: false }` to stop hidden reasoning from eating the budget. */
  reasoning?: AIReasoningOptions;
  stream?: false;
}

export interface OpenRouterChatCompletion {
  id?: string;
  model?: string;
  choices?: {
    message?: { role?: string; content?: string | null; reasoning?: string | null };
    finish_reason?: string;
  }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
  error?: { message?: string; code?: number | string };
}

/** Error thrown when the AI proxy answers with a non-2xx status. */
export class OpenRouterHttpError extends Error {
  readonly status: number;
  readonly body: string;

  constructor(status: number, body: string) {
    super(`AI request failed with status ${status}${body ? `: ${body.slice(0, 300)}` : ''}`);
    this.name = 'OpenRouterHttpError';
    this.status = status;
    this.body = body;
  }
}

export interface CreateChatCompletionOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
}

/**
 * POST the chat payload to the Flask AI proxy, which talks to OpenRouter.
 * Handles the request timeout and forwards an optional external abort signal.
 */
export async function createChatCompletion(
  payload: OpenRouterChatPayload,
  options: CreateChatCompletionOptions = {},
): Promise<OpenRouterChatCompletion> {
  const controller = new AbortController();
  const timeoutMs = options.timeoutMs ?? openRouterConfig.timeoutMs;
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  if (options.signal) {
    if (options.signal.aborted) {
      controller.abort();
    } else {
      options.signal.addEventListener('abort', () => controller.abort(), { once: true });
    }
  }

  try {
    const response = await fetch(`${openRouterConfig.baseUrl}/chat`, {
      method: 'POST',
      headers: getOpenRouterHeaders(),
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new OpenRouterHttpError(response.status, body);
    }

    return (await response.json()) as OpenRouterChatCompletion;
  } finally {
    clearTimeout(timer);
  }
}

/** Small client object so callers can use a single import. */
export const openRouterClient = {
  baseUrl: openRouterConfig.baseUrl,
  isConfigured: isOpenRouterConfigured,
  getHeaders: getOpenRouterHeaders,
  createChatCompletion,
};
