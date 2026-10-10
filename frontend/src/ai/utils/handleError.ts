import { OpenRouterHttpError } from '../config/openrouter';
import { API_BASE_URL, getAuthToken } from '../../services/apiClient';
import type { AIError, AIErrorCode, RetryInfo, RetryOptions } from '../types';
import type { NLPAnalysis } from '../../types';

/**
 * Error handling, retry logic and the MSW mock fallback for the AI layer.
 */

function defaultRetryable(code: AIErrorCode): boolean {
  return code === 'RATE_LIMIT' || code === 'TIMEOUT' || code === 'NETWORK';
}

/** Builds an `AIError` with a code, optional HTTP status and retry flag. */
export function createAIError(
  message: string,
  code: AIErrorCode = 'UNKNOWN',
  options: { status?: number; retryable?: boolean; model?: string; cause?: unknown } = {},
): AIError {
  const error = new Error(message) as AIError;
  error.name = 'AIError';
  error.code = code;
  error.status = options.status;
  error.retryable = options.retryable ?? defaultRetryable(code);
  error.model = options.model;

  if (options.cause !== undefined) {
    (error as AIError & { cause?: unknown }).cause = options.cause;
  }

  return error;
}

export function isAIError(value: unknown): value is AIError {
  return (
    typeof value === 'object' &&
    value !== null &&
    'code' in value &&
    typeof (value as AIError).retryable === 'boolean'
  );
}

/** Normalises anything thrown by fetch/OpenRouter into an `AIError`. */
export function toAIError(error: unknown, model?: string): AIError {
  if (isAIError(error)) {
    if (!error.model && model) error.model = model;
    return error;
  }

  if (error instanceof OpenRouterHttpError) {
    if (error.status === 429) {
      return createAIError('OpenRouter rate limit reached (429). Retrying shortly.', 'RATE_LIMIT', {
        status: error.status,
        retryable: true,
        model,
        cause: error,
      });
    }

    if (error.status === 404) {
      return createAIError('Requested model is unavailable on OpenRouter.', 'MODEL_UNAVAILABLE', {
        status: error.status,
        retryable: false,
        model,
        cause: error,
      });
    }

    return createAIError(
      error.message || `OpenRouter error (${error.status}).`,
      'API_ERROR',
      {
        status: error.status,
        retryable: error.status >= 500,
        model,
        cause: error,
      },
    );
  }

  const name = (error as { name?: string } | null)?.name;
  if (name === 'TimeoutError' || name === 'AbortError') {
    return createAIError('OpenRouter request timed out.', 'TIMEOUT', {
      retryable: true,
      model,
      cause: error,
    });
  }

  if (error instanceof TypeError) {
    return createAIError('Network error while contacting OpenRouter.', 'NETWORK', {
      retryable: true,
      model,
      cause: error,
    });
  }

  const message = error instanceof Error ? error.message : 'Unknown AI failure.';
  const isMissingKey = /api key is missing/i.test(message);

  return createAIError(message, isMissingKey ? 'MISSING_API_KEY' : 'UNKNOWN', {
    retryable: false,
    model,
    cause: error,
  });
}

export function isRateLimitError(error: unknown): boolean {
  return toAIError(error).code === 'RATE_LIMIT';
}

export function isRetryableError(error: unknown): boolean {
  return toAIError(error).retryable;
}

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/** Exponential backoff (1s, 2s, 4s ...) capped at `maxDelayMs`, plus jitter. */
export function getBackoffDelay(attempt: number, baseDelayMs = 1000, maxDelayMs = 8000): number {
  const exponential = Math.min(maxDelayMs, baseDelayMs * 2 ** Math.max(0, attempt - 1));
  const jitter = Math.floor(Math.random() * 250);
  return exponential + jitter;
}

/**
 * Runs `operation` and retries it with exponential backoff while the failure is
 * retryable (rate limits, timeouts, network errors, 5xx).
 */
export async function withRetry<T>(
  operation: (attempt: number) => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const retries = options.retries ?? 2;
  const maxAttempts = Math.max(1, retries + 1);
  let lastError: AIError = createAIError('AI operation failed.');

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation(attempt);
    } catch (error) {
      lastError = toAIError(error);

      if (!lastError.retryable || attempt === maxAttempts) throw lastError;

      const delayMs = getBackoffDelay(attempt, options.baseDelayMs, options.maxDelayMs);
      const info: RetryInfo = { attempt, maxAttempts, delayMs, error: lastError };
      options.onRetry?.(info);
      await sleep(delayMs);
    }
  }

  throw lastError;
}

/**
 * MSW fallback: replays the analysis through the mock `/api/nlp/analyze`
 * endpoint so the app keeps working offline or without an API key.
 */
export async function fetchMockLegalAnalysis(query: string): Promise<NLPAnalysis> {
  /**
   * The mock endpoint is bearer-protected like every other route, so the
   * session token is attached here too — without it MSW answers 401 and the
   * fallback would always fall through to the local heuristic.
   */
  const token = getAuthToken();

  const response = await fetch(`${API_BASE_URL}/nlp/analyze`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ query }),
  });

  if (!response.ok) {
    throw createAIError(`Mock NLP fallback failed (${response.status}).`, 'API_ERROR', {
      status: response.status,
      retryable: false,
    });
  }

  const data = (await response.json()) as NLPAnalysis;
  if (!data || typeof data !== 'object' || !Array.isArray(data.matchedArticles)) {
    throw createAIError('Mock NLP fallback returned an unexpected payload.', 'INVALID_RESPONSE', {
      retryable: false,
    });
  }

  return data;
}
