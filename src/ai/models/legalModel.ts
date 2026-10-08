import type { AIModelKey, AITask } from '../types';

/**
 * Model definitions and selection for JurisFlow.
 *
 * PRIMARY  – Poolside Laguna S 2.1: the ACCURACY path, and the only model that
 *            has measured 8/8 on the `npm run test:accuracy` scenarios. Full
 *            reasoning enabled, generous token budget (hidden reasoning + the
 *            JSON must both fit) and a low temperature for consistent field
 *            extraction.
 * FALLBACK – NVIDIA Nemotron 3 Super 120B: a different vendor than Laguna, so it
 *            fails independently, and the only other free model that answered
 *            (200 + valid JSON) while the rest of the pool returned 429. It is
 *            also the one slot that advertises `response_format` support.
 * FAST     – Poolside Laguna XS 2.1, the small sibling of the primary, without
 *            hidden reasoning (email replies, generic chat).
 *
 * IMPORTANT: every id below was re-verified against OpenRouter's live catalogue.
 * Free model availability changes often, so `npm run test:accuracy` is the
 * source of truth before trusting an id. Two failure modes this profile removes:
 *   - a dead id: `nex-agi/nex-n2.5-pro:free` (the previous PRIMARY) is no longer
 *     offered at all, so every request 404'd and fell through the whole chain;
 *   - the `openrouter/free` auto-router (the previous FALLBACK) is free to route
 *     to *any* free model — including `nvidia/nemotron-3.5-content-safety:free`,
 *     a safety classifier that cannot produce legal JSON (a 0/8 scenario).
 *
 * Free endpoints share capacity, so an upstream 429 ("Provider returned error")
 * is normal and temporary — the chain exists to hop to the next slot. Measured
 * with the project key: `laguna-s-2.1` and `nemotron-3-super` answered 200 with
 * valid JSON while `qwen/qwen3.8-27b:free` and `google/gemma-4-31b-it:free`
 * returned 429, which is why nemotron holds the FALLBACK slot.
 */
export const LEGAL_MODELS = {
  PRIMARY: 'poolside/laguna-s-2.1:free',
  FALLBACK: 'nvidia/nemotron-3-super-120b-a12b:free',
  FAST: 'poolside/laguna-xs-2.1:free',
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
    label: 'Poolside Laguna S 2.1 (free)',
    description: 'Accuracy path: full reasoning, 4096-token budget, temperature 0.1 for intake analysis.',
    temperature: 0.1,
    maxTokens: 4096,
    jsonMode: true,
    disableReasoning: false,
  },
  FALLBACK: {
    key: 'FALLBACK',
    id: LEGAL_MODELS.FALLBACK,
    label: 'NVIDIA Nemotron 3 Super 120B (free)',
    description: 'Different vendor than the primary and the only other free slot advertising response_format; verified answering while the rest of the pool returned 429.',
    temperature: 0.2,
    maxTokens: 2048,
    jsonMode: true,
    disableReasoning: true,
  },
  FAST: {
    key: 'FAST',
    id: LEGAL_MODELS.FAST,
    label: 'Poolside Laguna XS 2.1 (free)',
    description: 'Small sibling of the primary, no hidden reasoning; used for email replies and generic chat.',
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
 * `openrouter/free` (the retired auto-router) no longer needs special-casing, and
 * a temporarily zero-priced preview such as `stealth/space-bunny-alpha` correctly
 * reads as NOT guaranteed free, because its price can change without notice.
 */
export function isFreeModel(modelId: string): boolean {
  return modelId.endsWith(':free');
}
