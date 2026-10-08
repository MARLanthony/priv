import {
  OpenRouterHttpError,
  createChatCompletion,
  isOpenRouterConfigured,
  openRouterConfig,
} from '../config/openrouter';
import { getFallbackChain } from '../models/legalModel';
import type { ModelConfig } from '../models/legalModel';
import { createAIError, toAIError, withRetry } from '../utils/handleError';
import { parseJsonResponse } from '../utils/parseResponse';
import type {
  AIAttemptInfo,
  AIError,
  AIJsonChatResult,
  AIMessage,
  AIReasoningOptions,
  AIRequest,
  AIResponse,
  AITask,
  RetryInfo,
} from '../types';

/**
 * Generic AI service wrapper around OpenRouter.
 * Handles model fallback, retries with exponential backoff, rate limits and
 * response normalisation so feature services (like `nlpService`) stay small.
 */

export interface AIChatOptions {
  task?: AITask;
  /** Force a specific OpenRouter model id (tried before the fallback chain). */
  model?: string;
  temperature?: number;
  maxTokens?: number;
  /** Ask the model for a JSON object response. */
  json?: boolean;
  /** Extra attempts per model (defaults to VITE_OPENROUTER_MAX_RETRIES). */
  retries?: number;
  /** Per-attempt timeout (defaults to VITE_OPENROUTER_TIMEOUT_MS). */
  timeoutMs?: number;
  /** Explicit reasoning control, e.g. `{ enabled: false }`. */
  reasoning?: AIReasoningOptions;
  /** Override the model config's `disableReasoning` flag. */
  disableReasoning?: boolean;
  /** Hedge: start the next model in parallel after N ms (0 = off). */
  hedgeAfterMs?: number;
  /** Hard budget for the whole call (defaults to VITE_OPENROUTER_TOTAL_TIMEOUT_MS). */
  totalTimeoutMs?: number;
  onRetry?: (info: RetryInfo) => void;
  /** Called for every model attempt (including hedges) so callers can report real progress. */
  onAttempt?: (info: AIAttemptInfo) => void;
}

export function isAIConfigured(): boolean {
  return isOpenRouterConfigured();
}

function toMessages(prompt: string | AIMessage[]): AIMessage[] {
  return typeof prompt === 'string' ? [{ role: 'user', content: prompt }] : prompt;
}

/** Reasoning control for a call: explicit option wins, else the model config. */
function buildReasoning(options: AIChatOptions, config: ModelConfig): AIReasoningOptions | undefined {
  if (options.reasoning) return options.reasoning;

  const disabled = options.disableReasoning ?? config.disableReasoning;
  return disabled ? { enabled: false } : undefined;
}

/** Single HTTP attempt against one model. */
async function requestOnce(
  config: ModelConfig,
  messages: AIMessage[],
  options: AIChatOptions,
): Promise<AIResponse> {
  const reasoning = buildReasoning(options, config);

  const completion = await createChatCompletion(
    {
      model: config.id,
      messages,
      temperature: options.temperature ?? config.temperature,
      max_tokens: options.maxTokens ?? config.maxTokens,
      ...(options.json && config.jsonMode ? { response_format: { type: 'json_object' as const } } : {}),
      ...(reasoning ? { reasoning } : {}),
      stream: false,
    },
    { timeoutMs: options.timeoutMs ?? openRouterConfig.timeoutMs },
  );

  const choice = completion.choices?.[0];
  const content = (choice?.message?.content ?? '').trim();

  if (!content) {
    throw createAIError(`Model ${config.id} returned an empty response.`, 'INVALID_RESPONSE', {
      model: config.id,
      retryable: false,
    });
  }

  return {
    content,
    model: completion.model ?? config.id,
    source: 'openrouter',
    reasoning: choice?.message?.reasoning ?? undefined,
    usage: completion.usage
      ? {
          promptTokens: completion.usage.prompt_tokens,
          completionTokens: completion.usage.completion_tokens,
          totalTokens: completion.usage.total_tokens,
        }
      : undefined,
    raw: completion,
  };
}

/**
 * Runs a chat completion against OpenRouter.
 *
 * Latency strategy (all measured against the live free tier):
 * - `reasoning: { enabled: false }` — free reasoning models otherwise burn the
 *   whole output budget on hidden chain-of-thought (20-35s, or truncated JSON).
 * - Hedging — if the current model is slower than `hedgeAfterMs`, the next model
 *   in the chain starts in parallel and the first valid answer wins.
 * - Hard deadline — `totalTimeoutMs` bounds the whole call so the caller can fall
 *   back to instant local/mock data instead of leaving the UI spinning.
 */
export async function aiChat(
  prompt: string | AIMessage[],
  options: AIChatOptions = {},
): Promise<AIResponse> {
  if (!isOpenRouterConfigured()) {
    throw createAIError(
      'OpenRouter API key is missing. Add VITE_OPENROUTER_API_KEY to your .env file.',
      'MISSING_API_KEY',
      { retryable: false },
    );
  }

  const messages = toMessages(prompt);
  const chain = getFallbackChain(options.task ?? 'generic', options.model);
  const retries = options.retries ?? openRouterConfig.maxRetries;
  const hedgeAfterMs = options.hedgeAfterMs ?? openRouterConfig.hedgeAfterMs;
  const totalTimeoutMs = options.totalTimeoutMs ?? openRouterConfig.totalTimeoutMs;
  const startedAt = Date.now();

  return new Promise<AIResponse>((resolve, reject) => {
    let settled = false;
    let launched = 0;
    let finished = 0;
    let lastError: AIError = createAIError('No OpenRouter model was able to answer.', 'MODEL_UNAVAILABLE');
    let hedgeTimer: ReturnType<typeof setTimeout> | undefined;

    const stop = () => {
      if (hedgeTimer) clearTimeout(hedgeTimer);
      clearTimeout(totalTimer);
    };

    const succeed = (response: AIResponse, hedged: boolean) => {
      if (settled) return;
      settled = true;
      stop();
      resolve({ ...response, latencyMs: Date.now() - startedAt, hedged });
    };

    const abort = (error: AIError) => {
      if (settled) return;
      settled = true;
      stop();
      reject(error);
    };

    const launchNext = () => {
      if (settled || launched >= chain.length) return;

      const config = chain[launched];
      const hedged = launched > 0;
      launched += 1;

      options.onAttempt?.({ attempt: launched, model: config.id, key: config.key, hedged });

      withRetry(() => requestOnce(config, messages, options), { retries, onRetry: options.onRetry })
        .then(response => succeed(response, hedged))
        .catch(error => {
          lastError = toAIError(error, config.id);
          finished += 1;

          // A missing/invalid key fails for every model, so stop immediately.
          if (lastError.code === 'MISSING_API_KEY') {
            abort(lastError);
            return;
          }

          if (finished >= chain.length) {
            abort(lastError);
            return;
          }

          // Fail fast: advance to the next model without waiting for the hedge timer.
          launchNext();
        });
    };

    const scheduleHedge = () => {
      if (settled || hedgeAfterMs <= 0 || launched >= chain.length) return;

      hedgeTimer = setTimeout(() => {
        if (settled) return;
        launchNext();
        scheduleHedge();
      }, hedgeAfterMs);
    };

    const totalTimer = setTimeout(() => {
      abort(
        createAIError(`AI call exceeded the ${totalTimeoutMs}ms budget.`, 'TIMEOUT', {
          retryable: false,
        }),
      );
    }, totalTimeoutMs);

    launchNext();
    scheduleHedge();
  });
}

/** Convenience helper returning just the text content. */
export async function aiText(prompt: string | AIMessage[], options: AIChatOptions = {}): Promise<string> {
  const response = await aiChat(prompt, options);
  return response.content;
}

export interface AIJsonChatOptions<T> extends AIChatOptions {
  /** Returned by `data` when the model output cannot be parsed. */
  fallback?: T | null;
}

/**
 * Runs a chat completion and parses the answer as JSON.
 * Transport errors are thrown as `AIError`; a parse failure yields `data: null`
 * so callers can decide whether to fall back to mock data.
 */
export async function aiJsonChat<T = unknown>(
  prompt: string | AIMessage[],
  options: AIJsonChatOptions<T> = {},
): Promise<AIJsonChatResult<T>> {
  const response = await aiChat(prompt, { ...options, json: true });
  const data = parseJsonResponse<T>(response.content, options.fallback ?? null);
  return { data, response };
}

export { OpenRouterHttpError };
export type { AIRequest };
