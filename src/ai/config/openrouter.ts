import type { AIMessage, AIReasoningOptions } from '../types';

/**
 * OpenRouter client setup.
 *
 * The API key is read from, in order of precedence:
 *   1. the per-device override saved in this browser (Settings → AI engine)
 *   2. `VITE_OPENROUTER_API_KEY` in `.env`
 *
 * The device override exists because a `.env` file is easy to lose (wildcard
 * cleanups, cloud-sync reverts, a fresh clone): a key pasted in Settings keeps
 * working without a rebuild and survives the file disappearing.
 *
 * When neither is present every AI call fails fast with a `MISSING_API_KEY`
 * error and the services fall back to MSW mock data.
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

export const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';

export interface OpenRouterConfig {
  apiKey: string;
  baseUrl: string;
  httpReferer: string;
  title: string;
  /** Per-attempt timeout. Generous because the intake model is allowed to reason. */
  timeoutMs: number;
  /** Extra attempts per model (0 = single attempt; saves free-tier quota). */
  maxRetries: number;
  /**
   * Start the next model in parallel if this one takes longer (0 = off).
   * Measured no latency benefit on the free tier (the provider queue dominates)
   * while doubling quota usage, so it is off by default.
   */
  hedgeAfterMs: number;
  /** Hard budget for the whole fallback chain before giving up. */
  totalTimeoutMs: number;
}

const defaultReferer =
  typeof window !== 'undefined' && window.location?.origin
    ? window.location.origin
    : 'https://jurisflow.local';

/** Where the key in use came from. */
export type ApiKeySource = 'device' | 'env' | 'none';

/** localStorage slot for the per-device key override (Settings → AI engine). */
export const AI_KEY_STORAGE_KEY = 'jurisflow.openrouter-key';

/** Pre-rebrand slot, read once so an already-saved key survives the rename. */
export const LEGACY_AI_KEY_STORAGE_KEY = 'legalflow.openrouter-key';

/**
 * The key saved in this browser, if any. Never throws (private mode, SSR).
 * A key stored under the pre-rebrand slot is moved to the current one.
 */
export const readStoredApiKey = (): string => {
  try {
    const storage = globalThis.localStorage;
    if (!storage) return '';

    const current = (storage.getItem(AI_KEY_STORAGE_KEY) ?? '').trim();
    if (current) return current;

    const legacy = (storage.getItem(LEGACY_AI_KEY_STORAGE_KEY) ?? '').trim();
    if (!legacy) return '';

    storage.setItem?.(AI_KEY_STORAGE_KEY, legacy);
    storage.removeItem?.(LEGACY_AI_KEY_STORAGE_KEY);
    return legacy;
  } catch {
    return '';
  }
};

/** The build-time key from `.env` (`VITE_OPENROUTER_API_KEY`). */
export const readEnvApiKey = (): string => readEnv('VITE_OPENROUTER_API_KEY');

export const openRouterConfig: OpenRouterConfig = {
  // The device override wins: it is the copy that file-level changes cannot wipe.
  apiKey: readStoredApiKey() || readEnvApiKey(),
  baseUrl: readEnv('VITE_OPENROUTER_BASE_URL') || OPENROUTER_BASE_URL,
  httpReferer: readEnv('VITE_OPENROUTER_HTTP_REFERER') || defaultReferer,
  title: readEnv('VITE_OPENROUTER_TITLE') || 'JurisFlow',
  timeoutMs: readNumberEnv('VITE_OPENROUTER_TIMEOUT_MS', 60000),
  maxRetries: readNonNegativeEnv('VITE_OPENROUTER_MAX_RETRIES', 1),
  hedgeAfterMs: readNonNegativeEnv('VITE_OPENROUTER_HEDGE_AFTER_MS', 0),
  totalTimeoutMs: readNumberEnv('VITE_OPENROUTER_TOTAL_TIMEOUT_MS', 120000),
};

/** `true` when an API key is present, i.e. live AI calls are possible. */
export const isOpenRouterConfigured = (): boolean => openRouterConfig.apiKey.length > 0;

/** Which key is currently in effect (device override, `.env`, or none). */
export const getApiKeySource = (): ApiKeySource => {
  if (readStoredApiKey()) return 'device';
  if (readEnvApiKey()) return 'env';
  return 'none';
};

/**
 * Swaps the key at runtime (Settings → AI engine, and the verification suites).
 * An empty value drops the override and falls back to whatever `.env` provides.
 */
export const setOpenRouterApiKey = (key: string): string => {
  openRouterConfig.apiKey = key.trim() || readEnvApiKey();
  return openRouterConfig.apiKey;
};

/** `sk-or-v1-…991b1` — never render a full key. */
export const maskApiKey = (key: string): string => {
  const value = key.trim();
  if (!value) return '';
  return value.length <= 12 ? '•••' : `${value.slice(0, 10)}…${value.slice(-4)}`;
};

/** Default headers required/recommended by OpenRouter. */
export const getOpenRouterHeaders = (): Record<string, string> => ({
  'Content-Type': 'application/json',
  Accept: 'application/json',
  Authorization: `Bearer ${openRouterConfig.apiKey}`,
  'HTTP-Referer': openRouterConfig.httpReferer,
  'X-Title': openRouterConfig.title,
});

export interface OpenRouterChatPayload {
  model: string;
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

/** Error thrown when OpenRouter answers with a non-2xx status. */
export class OpenRouterHttpError extends Error {
  readonly status: number;
  readonly body: string;

  constructor(status: number, body: string) {
    super(`OpenRouter request failed with status ${status}${body ? `: ${body.slice(0, 300)}` : ''}`);
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
 * POST `/chat/completions` against OpenRouter.
 * Handles the request timeout and forwards an optional external abort signal.
 */
export async function createChatCompletion(
  payload: OpenRouterChatPayload,
  options: CreateChatCompletionOptions = {},
): Promise<OpenRouterChatCompletion> {
  if (!isOpenRouterConfigured()) {
    throw new Error('OpenRouter API key is missing. Set VITE_OPENROUTER_API_KEY in your .env file.');
  }

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
    const response = await fetch(`${openRouterConfig.baseUrl}/chat/completions`, {
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
