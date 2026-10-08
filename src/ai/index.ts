/**
 * JurisFlow AI layer — single import point.
 *
 * Usage:
 *   import { analyzeLegalProblem } from '../../ai';
 *   const result = await analyzeLegalProblem(problemText);
 */

/* Config ------------------------------------------------------------------ */
export {
  AI_KEY_STORAGE_KEY,
  LEGACY_AI_KEY_STORAGE_KEY,
  OPENROUTER_BASE_URL,
  OpenRouterHttpError,
  createChatCompletion,
  getApiKeySource,
  getOpenRouterHeaders,
  isOpenRouterConfigured,
  maskApiKey,
  openRouterClient,
  openRouterConfig,
  readEnvApiKey,
  readStoredApiKey,
  setOpenRouterApiKey,
} from './config/openrouter';
export type {
  ApiKeySource,
  CreateChatCompletionOptions,
  OpenRouterChatCompletion,
  OpenRouterChatPayload,
  OpenRouterConfig,
} from './config/openrouter';

/* Models ------------------------------------------------------------------ */
export {
  LEGAL_MODELS,
  MODEL_CONFIGS,
  TASK_MODEL_MAP,
  getFallbackChain,
  getModelConfig,
  isFreeModel,
  resolveModelId,
  selectModel,
} from './models/legalModel';
export type { ModelConfig } from './models/legalModel';

/* Prompts ----------------------------------------------------------------- */
export {
  DEFAULT_NEXT_STEPS,
  LEGAL_CASE_TYPES,
  LEGAL_DISCLAIMER,
  LEGAL_INTAKE_SYSTEM_PROMPT,
  NON_LEGAL_CASE_TYPE,
  SPECIALIST_BY_CASE_TYPE,
  buildLegalIntakeUserPrompt,
} from './prompts/legalIntake';
export type { LegalIntakePromptOptions } from './prompts/legalIntake';

export {
  DOCUMENT_ANALYSIS_SYSTEM_PROMPT,
  buildDocumentAnalysisUserPrompt,
} from './prompts/documentAnalysis';
export type { DocumentAnalysisPromptOptions } from './prompts/documentAnalysis';

export { EMAIL_REPLY_SYSTEM_PROMPT, buildEmailReplyUserPrompt } from './prompts/emailReply';

/* Services ---------------------------------------------------------------- */
export { aiChat, aiJsonChat, aiText, isAIConfigured } from './services/aiService';
export type { AIChatOptions, AIJsonChatOptions } from './services/aiService';

export {
  analyzeDocument,
  analyzeLegalProblem,
  clearAnalysisCache,
  clearLatencySamples,
  DEFAULT_ESTIMATED_ANALYSIS_MS,
  generateEmailReply,
  getEstimatedAnalysisMs,
  getLegalKeywords,
  getLocalFallbackAnalysis,
  inferCaseType,
  inferUrgency,
  matchArticles,
  PROGRESS_STAGE_FLOOR,
  recordAnalysisLatency,
} from './services/nlpService';
export type { AnalyzeLegalProblemOptions } from './services/nlpService';

/* Utils ------------------------------------------------------------------- */
export {
  clampConfidence,
  extractJson,
  normalizeDocumentAnalysis,
  normalizeEmailReply,
  normalizeLegalAnalysis,
  normalizeUrgency,
  parseJsonResponse,
  repairJson,
  safeParseJson,
  stripCodeFences,
  toStringArray,
} from './utils/parseResponse';

export {
  createAIError,
  fetchMockLegalAnalysis,
  getBackoffDelay,
  isAIError,
  isRateLimitError,
  isRetryableError,
  sleep,
  toAIError,
  withRetry,
} from './utils/handleError';

/* Types ------------------------------------------------------------------- */
export type {
  AIError,
  AIErrorCode,
  AIAttemptInfo,
  AIJsonChatResult,
  AIMessage,
  AIModelKey,
  AIProgress,
  AIProgressStage,
  AIProviderSource,
  AIReasoningOptions,
  AIRequest,
  AIResponse,
  AIRole,
  AITask,
  AIUsage,
  DocumentAnalysis,
  DocumentClause,
  EmailReply,
  EmailReplyContext,
  EmailTone,
  LegalAnalysis,
  LegalAnalysisResult,
  LegalUrgency,
  RetryInfo,
  RetryOptions,
} from './types';
