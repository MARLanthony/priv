import type { AIModelKey, AITask } from '../types';

/**
 * Model definitions and selection for JurisFlow.
 *
 * The authoritative chain lives in the backend (`backend/.env`:
 * `OPENROUTER_MODEL`, `OPENROUTER_FALLBACK_MODEL`), because that is where the
 * key and the usage accounting live. The ids below are what the frontend asks
 * for by default; each slot ends in `:free` so nothing can ever bill a card.
 *
 * PRIMARY  – DeepSeek R1 (free): the reasoning model used for legal intake.
 *            It is allowed to think before answering, which is what makes the
 *            case-type/urgency extraction reliable, so it needs a large
 *            `maxTokens` budget for the hidden reasoning *and* the JSON.
 * FALLBACK – DeepSeek R1 distilled into Llama 70B (free): same family (so the
 *            prompt and the JSON contract are understood identically) but a
 *            different upstream provider, so it fails independently when R1's
 *            provider is rate limited.
 * FAST     – DeepSeek Chat (free), no hidden reasoning: email replies and
 *            generic chat, where latency matters more than depth.
 *
 * The backend replaces an id it does not know with its configured default, so
 * an id that disappears from the free pool degrades gracefully.
 */
export const LEGAL_MODELS = {
  PRIMARY: 'deepseek/deepseek-r1:free',
  FALLBACK: 'deepseek/deepseek-r1-distill-llama-70b:free',
  FAST: 'deepseek/deepseek-chat:free',
} as const;

export interface ModelConfig {
  key: AIModelKey;
  id: string;
  label: string;
  description: string;
  temperature: number;
  maxTokens: number;
  /** Whether the model supports `response_format: { type: 'json_object' }`. */
  jsonMode: boolean;
  /**
   * Send `reasoning: { enabled: false }`.
   *
   * `false` = let the model think before answering (more accurate, slower, and it
   * needs a large `maxTokens` so reasoning + JSON both fit).
   * `true`  = skip hidden reasoning (faster and cheaper; used where the task is
   * mechanical, e.g. email replies).
   */
  disableReasoning: boolean;
}

export const MODEL_CONFIGS: Record<AIModelKey, ModelConfig> = {
  PRIMARY: {
    key: 'PRIMARY',
    id: LEGAL_MODELS.PRIMARY,
    label: 'DeepSeek R1 (free)',
    description: 'Accuracy path: full reasoning, 4096-token budget, temperature 0.1 for intake analysis.',
    temperature: 0.1,
    maxTokens: 4096,
    jsonMode: true,
    disableReasoning: false,
  },
  FALLBACK: {
    key: 'FALLBACK',
    id: LEGAL_MODELS.FALLBACK,
    label: 'DeepSeek R1 Distill Llama 70B (free)',
    description: 'Same prompt contract as the primary but a different upstream provider, so it survives a rate limit on the primary.',
    temperature: 0.2,
    maxTokens: 2048,
    jsonMode: true,
    disableReasoning: true,
  },
  FAST: {
    key: 'FAST',
    id: LEGAL_MODELS.FAST,
    label: 'DeepSeek Chat (free)',
    description: 'No hidden reasoning; used for email replies and generic chat.',
    temperature: 0.4,
    maxTokens: 1200,
    jsonMode: true,
    disableReasoning: true,
  },
};

/** Which model slot each AI task should start with. */
export const TASK_MODEL_MAP: Record<AITask, AIModelKey> = {
  'legal-intake': 'PRIMARY',
  'document-analysis': 'PRIMARY',
  'email-reply': 'FAST',
  generic: 'FAST',
};

export function getModelConfig(key: AIModelKey = 'PRIMARY'): ModelConfig {
  return MODEL_CONFIGS[key] ?? MODEL_CONFIGS.PRIMARY;
}

/** Model used first for the given task. */
export function selectModel(task: AITask = 'generic'): ModelConfig {
  return getModelConfig(TASK_MODEL_MAP[task] ?? 'PRIMARY');
}

/**
 * Ordered list of models to try: the task's preferred model first, then the
 * remaining slots, and finally an explicit override model when provided.
 */
export function getFallbackChain(task: AITask = 'generic', overrideModel?: string): ModelConfig[] {
  const preferred = selectModel(task);
  const chain: ModelConfig[] = [
    preferred,
    ...Object.values(MODEL_CONFIGS).filter(model => model.key !== preferred.key),
  ];

  if (!overrideModel) return chain;

  const override = Object.values(MODEL_CONFIGS).find(model => model.id === overrideModel);
  const head: ModelConfig = override ?? { ...preferred, id: overrideModel, label: overrideModel };
  return [head, ...chain.filter(model => model.id !== head.id)];
}

/** Accepts either a model slot key (`PRIMARY`) or a raw OpenRouter model id. */
export function resolveModelId(keyOrId: string): string {
  return keyOrId in MODEL_CONFIGS ? MODEL_CONFIGS[keyOrId as AIModelKey].id : keyOrId;
}

/**
 * True for ids served from OpenRouter's free pool.
 *
 * Every slot in the chain ends with `:free`, so the suffix is the whole test —
 * a temporarily zero-priced preview (e.g. `stealth/space-bunny-alpha`)
 * correctly reads as NOT guaranteed free, because its price can change without
 * notice.
 */
export function isFreeModel(modelId: string): boolean {
  return modelId.endsWith(':free');
}
