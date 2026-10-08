import type { NLPAnalysis } from '../../types';

/**
 * AI-specific types for the JurisFlow AI layer.
 * The shapes here mirror the frontend types in `src/types/index.ts` so the
 * rest of the app never has to know where the data came from.
 */

/** Where a result came from. `openrouter` = live AI, `msw` = MSW mock, `fallback` = local heuristic. */
export type AIProviderSource = 'openrouter' | 'msw' | 'fallback';

/** Logical model slots defined in `src/ai/models/legalModel.ts`. */
export type AIModelKey = 'PRIMARY' | 'FALLBACK' | 'FAST';

/** High level task ids used for model selection and prompt wiring. */
export type AITask = 'legal-intake' | 'document-analysis' | 'email-reply' | 'generic';

export type AIRole = 'system' | 'user' | 'assistant';

export interface AIMessage {
  role: AIRole;
  content: string;
}

export interface AIUsage {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
}

/**
 * OpenRouter `reasoning` control.
 * Disabling it stops hidden chain-of-thought tokens from consuming the output
 * budget, which measurably turns 20-35s (or truncated) answers into ~1s ones.
 */
export interface AIReasoningOptions {
  enabled?: boolean;
  effort?: 'low' | 'medium' | 'high';
  max_tokens?: number;
}

/** Generic AI request accepted by `aiService`. */
export interface AIRequest {
  messages: AIMessage[];
  task?: AITask;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  json?: boolean;
  retries?: number;
  timeoutMs?: number;
  /** Explicit reasoning control. Defaults to the model config's `disableReasoning`. */
  reasoning?: AIReasoningOptions;
  /** Force reasoning on/off regardless of the model config. */
  disableReasoning?: boolean;
  /** Start the next model in parallel if this one is slower than N ms (0 = off). */
  hedgeAfterMs?: number;
  /** Hard budget for the whole call; exceeding it rejects with a TIMEOUT error. */
  totalTimeoutMs?: number;
}

/** Generic AI response returned by `aiService`. */
export interface AIResponse {
  content: string;
  model: string;
  source: AIProviderSource;
  usage?: AIUsage;
  /** Present for reasoning models such as DeepSeek R1. */
  reasoning?: string;
  /** Wall-clock duration of the successful attempt. */
  latencyMs?: number;
  /** `true` when the answer came from a hedged (parallel) model. */
  hedged?: boolean;
  raw?: unknown;
}

export type AIErrorCode =
  | 'MISSING_API_KEY'
  | 'RATE_LIMIT'
  | 'TIMEOUT'
  | 'NETWORK'
  | 'API_ERROR'
  | 'MODEL_UNAVAILABLE'
  | 'INVALID_RESPONSE'
  | 'PARSE_ERROR'
  | 'UNKNOWN';

export interface AIError extends Error {
  code: AIErrorCode;
  status?: number;
  retryable: boolean;
  model?: string;
}

export interface RetryInfo {
  attempt: number;
  maxAttempts: number;
  delayMs: number;
  error: AIError;
}

/** Which model attempt is running (emitted for every candidate, including hedges). */
export interface AIAttemptInfo {
  /** 1-based attempt counter across the whole call. */
  attempt: number;
  /** OpenRouter model id being tried. */
  model: string;
  /** Model slot (PRIMARY / FALLBACK / FAST). */
  key: AIModelKey;
  /** True when this attempt is a parallel hedge. */
  hedged: boolean;
}

/**
 * Real progress stages emitted by `analyzeLegalProblem`.
 * These mirror what the code is actually doing, so the UI can show genuine progress.
 */
export type AIProgressStage =
  | 'preparing'
  | 'requesting'
  | 'retrying'
  | 'received'
  | 'parsing'
  | 'enriching'
  | 'fallback'
  | 'done';

export interface AIProgress {
  stage: AIProgressStage;
  /** Completion floor for the stage (0-100). */
  percent: number;
  /** Milliseconds elapsed since the analysis started. */
  elapsedMs: number;
  /** Estimated total duration in ms, derived from measured history. */
  estimatedMs: number;
  /** Model currently in use, once known. */
  model?: string;
  /** 1-based attempt/model index. */
  attempt?: number;
  /** Human readable status for the modal. */
  message: string;
}

export interface RetryOptions {
  /** Number of *additional* attempts (default 2). */
  retries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  onRetry?: (info: RetryInfo) => void;
}

export type LegalUrgency = 'High' | 'Medium' | 'Low';

/** Structured output of the legal intake prompt (`prompts/legalIntake.ts`). */
export interface LegalAnalysis {
  caseType: string;
  confidence: number;
  urgency: LegalUrgency;
  /** Legal topic keywords used to match the firm's knowledge base. */
  articles: string[];
  services: string[];
  nextSteps: string[];
  /** Short facts quoted from the client's description that justify the caseType. */
  keyFacts: string[];
  summary?: string;
}

/** Legal analysis enriched with knowledge-base matches — matches the frontend `NLPAnalysis`. */
export interface LegalAnalysisResult extends NLPAnalysis {
  urgency: LegalUrgency;
  source: AIProviderSource;
  model?: string;
  /** How long the AI call took, in milliseconds. */
  latencyMs?: number;
  /** Evidence the model based its assessment on (accuracy transparency). */
  keyFacts?: string[];
}

export interface DocumentClause {
  title: string;
  text: string;
  risk?: LegalUrgency;
}

/** Structured output of the document analysis prompt. */
export interface DocumentAnalysis {
  documentType?: string;
  parties: string[];
  dates: string[];
  clauses: DocumentClause[];
  summary: string;
  risks: string[];
}

export type EmailTone = 'professional' | 'friendly' | 'formal';

/** Structured output of the email reply prompt. */
export interface EmailReply {
  subject: string;
  body: string;
  tone: EmailTone;
}

export interface EmailReplyContext {
  clientName?: string;
  attorneyName?: string;
  firmName?: string;
  caseType?: string;
  caseSummary?: string;
  caseNumber?: string;
  tone?: EmailTone;
}

/** Result of `aiJsonChat` — `data` is `null` when the model output could not be parsed. */
export interface AIJsonChatResult<T> {
  data: T | null;
  response: AIResponse;
}
