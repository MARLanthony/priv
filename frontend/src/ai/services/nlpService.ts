import { isOpenRouterConfigured } from '../config/openrouter';
import {
  DEFAULT_NEXT_STEPS,
  LEGAL_INTAKE_SYSTEM_PROMPT,
  NON_LEGAL_CASE_TYPE,
  SPECIALIST_BY_CASE_TYPE,
  buildLegalIntakeUserPrompt,
} from '../prompts/legalIntake';
import {
  DOCUMENT_ANALYSIS_SYSTEM_PROMPT,
  buildDocumentAnalysisUserPrompt,
} from '../prompts/documentAnalysis';
import { EMAIL_REPLY_SYSTEM_PROMPT, buildEmailReplyUserPrompt } from '../prompts/emailReply';
import { fetchMockLegalAnalysis, toAIError } from '../utils/handleError';
import {
  normalizeDocumentAnalysis,
  normalizeEmailReply,
  normalizeLegalAnalysis,
} from '../utils/parseResponse';
import { aiJsonChat } from './aiService';
import type {
  AIError,
  AIProgress,
  AIProgressStage,
  AIProviderSource,
  DocumentAnalysis,
  EmailReply,
  EmailReplyContext,
  LegalAnalysis,
  LegalAnalysisResult,
  LegalUrgency,
  RetryInfo,
} from '../types';
import type { AppointmentSlot, Article, Availability } from '../../types';
import { apiGet } from '../../services/apiClient';

/**
 * Main NLP analysis service.
 *
 * `analyzeLegalProblem` tries OpenRouter first (legal intake prompt), then
 * falls back to the MSW mock endpoint, and finally to a local heuristic so the
 * UI always receives a result in the `NLPAnalysis` shape.
 */

export interface AnalyzeLegalProblemOptions {
  /** Skip OpenRouter entirely and use the MSW mock (offline/demo mode). */
  forceMock?: boolean;
  /** Receives real pipeline progress (stages, elapsed time, estimate). */
  onProgress?: (progress: AIProgress) => void;
  onRetry?: (info: RetryInfo) => void;
  onError?: (error: AIError) => void;
}

/* ------------------------------------------------------------------ */
/* Latency estimation (measured, not guessed)                          */
/* ------------------------------------------------------------------ */

const LATENCY_STORAGE_KEY = 'jurisflow.ai.intake.samples';
const LATENCY_SAMPLE_LIMIT = 8;
/**
 * Fallback estimate used until the first real measurement is recorded.
 * The intake call runs with reasoning enabled, which typically takes longer
 * than a no-reasoning call.
 */
export const DEFAULT_ESTIMATED_ANALYSIS_MS = 15000;

function loadLatencySamples(): number[] {
  try {
    const raw = globalThis.localStorage?.getItem(LATENCY_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((value): value is number => typeof value === 'number' && value > 0).slice(-LATENCY_SAMPLE_LIMIT);
  } catch {
    return [];
  }
}

let latencySamples: number[] = loadLatencySamples();

function persistLatencySamples(): void {
  try {
    globalThis.localStorage?.setItem(LATENCY_STORAGE_KEY, JSON.stringify(latencySamples));
  } catch {
    /* storage unavailable (private mode / SSR) — keep the in-memory samples */
  }
}

/** Records a real end-to-end AI duration so future estimates stay accurate. */
export function recordAnalysisLatency(ms: number): void {
  if (!Number.isFinite(ms) || ms <= 0) return;

  latencySamples = [...latencySamples, Math.round(ms)].slice(-LATENCY_SAMPLE_LIMIT);
  persistLatencySamples();
}

/**
 * Average duration of recent successful AI analyses, clamped to a sane range.
 * Used to show the user an honest "~N seconds remaining" countdown.
 */
export function getEstimatedAnalysisMs(): number {
  if (latencySamples.length === 0) return DEFAULT_ESTIMATED_ANALYSIS_MS;

  const average = latencySamples.reduce((total, value) => total + value, 0) / latencySamples.length;
  // Reasoning-enabled runs are allowed to take longer, so the ceiling matches
  // the per-attempt timeout (see VITE_OPENROUTER_TIMEOUT_MS).
  return Math.round(Math.min(45000, Math.max(1500, average)));
}

/** Test seam: clears the measured latency history. */
export function clearLatencySamples(): void {
  latencySamples = [];
  try {
    globalThis.localStorage?.removeItem(LATENCY_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/* ------------------------------------------------------------------ */
/* Progress reporting                                                  */
/* ------------------------------------------------------------------ */

/** Completion floor per stage, mirrored by the modal for smooth interpolation. */
export const PROGRESS_STAGE_FLOOR: Record<AIProgressStage, number> = {
  preparing: 8,
  requesting: 15,
  retrying: 22,
  received: 82,
  parsing: 88,
  enriching: 92,
  fallback: 55,
  done: 100,
};

const PROGRESS_STAGE_MESSAGE: Record<AIProgressStage, string> = {
  preparing: 'Reading your description…',
  requesting: 'Consulting the AI legal model…',
  retrying: 'Trying another available model…',
  received: 'Response received — validating it…',
  parsing: 'Structuring the case analysis…',
  enriching: 'Matching our knowledge base and attorney…',
  fallback: 'AI is busy — preparing recommendations locally…',
  done: 'Analysis complete',
};

function createProgressReporter(
  options: AnalyzeLegalProblemOptions,
  startedAt: number,
  estimatedMs: number,
): (stage: AIProgressStage, extra?: { model?: string; attempt?: number; message?: string }) => void {
  return (stage, extra) => {
    if (!options.onProgress) return;

    options.onProgress({
      stage,
      percent: PROGRESS_STAGE_FLOOR[stage],
      elapsedMs: Date.now() - startedAt,
      estimatedMs,
      model: extra?.model,
      attempt: extra?.attempt,
      message: extra?.message ?? PROGRESS_STAGE_MESSAGE[stage],
    });
  };
}

const STOP_WORDS = new Set([
  'the', 'and', 'for', 'are', 'but', 'not', 'you', 'your', 'with', 'was', 'were', 'have', 'has',
  'had', 'this', 'that', 'from', 'they', 'them', 'their', 'been', 'being', 'will', 'would',
  'could', 'should', 'about', 'into', 'over', 'after', 'before', 'when', 'what', 'who', 'whom',
  'how', 'why', 'can', 'may', 'might', 'must', 'very', 'just', 'also', 'need', 'needs', 'want',
  'like', 'get', 'got', 'help', 'please', 'someone', 'something', 'there', 'here', 'then', 'than',
  'because', 'while', 'during', 'other', 'some', 'any', 'all', 'more', 'most', 'only', 'own',
  'same', 'too', 'such', 'off', 'out', 'down', 'into', 'in', 'of', 'to', 'a', 'an', 'is', 'it',
  'as', 'at', 'by', 'be', 'do', 'does', 'did', 'i', 'my', 'me', 'we', 'us', 'he', 'she', 'him',
  'so', 'last', 'night', 'need', 'really', 'know', 'tell',
]);

const HIGH_URGENCY_TERMS = [
  'arrest', 'arrested', 'assault', 'assaulted', 'attack', 'attacked', 'emergency', 'danger',
  'court date', 'hearing', 'deadline', 'eviction', 'deportation', 'restraining order',
  'statute of limitations', 'injured', 'injury', 'hospital', 'police', 'custody', 'seized',
];

const LOW_URGENCY_TERMS = [
  'question', 'information', 'planning', 'curious', 'general', 'advice', 'wondering',
  'will', 'estate planning', 'review a contract', 'someday',
];

/** Keyword heuristics used for the offline fallback and urgency detection. */
const CASE_TYPE_KEYWORDS: { caseType: string; keywords: string[] }[] = [
  { caseType: 'Criminal Defense', keywords: ['arrest', 'arrested', 'assault', 'assaulted', 'criminal', 'battery', 'felony', 'misdemeanor', 'defense', 'charge', 'police', 'probation'] },
  { caseType: 'Intellectual Property', keywords: ['patent', 'trademark', 'copyright', 'infringement', 'invention', 'intellectual property'] },
  { caseType: 'Personal Injury', keywords: ['injury', 'injured', 'accident', 'negligence', 'compensation', 'medical bills', 'slip', 'fall', 'whiplash'] },
  { caseType: 'Probate & Estate', keywords: ['estate', 'probate', 'will', 'inheritance', 'deceased', 'passed away', 'beneficiary', 'executor'] },
  { caseType: 'Family Law', keywords: ['divorce', 'custody', 'child support', 'alimony', 'marriage', 'visitation'] },
  { caseType: 'Employment Law', keywords: ['employer', 'wrongful termination', 'discrimination', 'harassment', 'workplace', 'fired', 'wages'] },
  { caseType: 'Landlord/Tenant', keywords: ['landlord', 'tenant', 'eviction', 'lease', 'rent', 'security deposit'] },
  { caseType: 'Immigration', keywords: ['visa', 'immigration', 'green card', 'deportation', 'asylum', 'citizenship'] },
  { caseType: 'Contract Dispute', keywords: ['contract', 'breach', 'agreement', 'invoice', 'payment terms', 'vendor'] },
  { caseType: 'Real Estate', keywords: ['property', 'deed', 'closing', 'title', 'mortgage', 'real estate'] },
  { caseType: 'Bankruptcy', keywords: ['bankruptcy', 'debt', 'creditors', 'insolvent', 'chapter 7', 'chapter 13'] },
];

/** Extracts simple lowercase keywords from free text. */
export function getLegalKeywords(text: string, limit = 12): string[] {
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 3 && !STOP_WORDS.has(word));

  return [...new Set(words)].slice(0, limit);
}

export function inferUrgency(text: string): LegalUrgency {
  const normalized = text.toLowerCase();
  if (HIGH_URGENCY_TERMS.some(term => normalized.includes(term))) return 'High';
  if (LOW_URGENCY_TERMS.some(term => normalized.includes(term))) return 'Low';
  return 'Medium';
}

/** Best-guess case type from keywords — used by the offline fallback. */
export function inferCaseType(text: string): string {
  const normalized = text.toLowerCase();
  let best: { caseType: string; score: number } = { caseType: 'General Legal Consultation', score: 0 };

  CASE_TYPE_KEYWORDS.forEach(entry => {
    const score = entry.keywords.filter(keyword => normalized.includes(keyword)).length;
    if (score > best.score) best = { caseType: entry.caseType, score };
  });

  return best.caseType;
}

function uniqueTerms(values: string[], limit = 16): string[] {
  return [...new Set(values.map(value => value.trim().toLowerCase()).filter(value => value.length > 2))].slice(0, limit);
}

/* ------------------------------------------------------------------ */
/* Knowledge base + appointment enrichment                             */
/* ------------------------------------------------------------------ */

let knowledgeBaseCache: Article[] | null = null;

async function loadKnowledgeBase(): Promise<Article[]> {
  if (knowledgeBaseCache) return knowledgeBaseCache;

  try {
    const data = await apiGet<Article[]>('/knowledge/articles', { status: 'published' });
    if (!Array.isArray(data)) return [];

    knowledgeBaseCache = data;
    return data;
  } catch {
    return [];
  }
}

function scoreArticle(article: Article, terms: string[]): number {
  const haystack = [article.title, article.category, article.summary, ...(article.keywords ?? [])]
    .join(' ')
    .toLowerCase();

  return terms.reduce((score, term) => (haystack.includes(term) ? score + 1 : score), 0);
}

/** Matches knowledge-base articles against the analysis keywords. */
export async function matchArticles(terms: string[], limit = 5): Promise<Article[]> {
  const articles = await loadKnowledgeBase();
  if (articles.length === 0 || terms.length === 0) return [];

  return articles
    .map(article => ({ article, score: scoreArticle(article, terms) }))
    .filter(entry => entry.score > 0)
    .sort((a, b) => b.score - a.score || (b.article.matchCount ?? 0) - (a.article.matchCount ?? 0))
    .slice(0, limit)
    .map(entry => entry.article);
}

function pickAttorney(articles: Article[], caseType: string): { name: string; specialization: string } {
  const fromArticle = articles.find(article => Boolean(article.attorneySpecialist));
  if (fromArticle) {
    return { name: fromArticle.attorneySpecialist, specialization: fromArticle.category || caseType };
  }

  const normalized = caseType.toLowerCase();
  const specialist = Object.entries(SPECIALIST_BY_CASE_TYPE).find(([key]) =>
    normalized.includes(key.toLowerCase()),
  );

  return {
    name: specialist ? specialist[1] : 'Intake Team',
    specialization: caseType || 'General Legal Consultation',
  };
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function generateDefaultSlots(max = 6): AppointmentSlot[] {
  const slots: AppointmentSlot[] = [];
  const today = new Date();

  for (let offset = 1; offset <= 10 && slots.length < max; offset++) {
    const date = new Date(today);
    date.setDate(date.getDate() + offset);

    const day = date.getDay();
    if (day === 0 || day === 6) continue;

    const iso = date.toISOString().split('T')[0];
    slots.push({ date: iso, time: '10:00', available: true });
    if (slots.length < max) slots.push({ date: iso, time: '14:00', available: true });
  }

  return slots.slice(0, max);
}

function slotsFromAvailability(windows: Availability[], max = 6): AppointmentSlot[] {
  const slots: AppointmentSlot[] = [];
  const today = new Date();

  for (let offset = 1; offset <= 10 && slots.length < max; offset++) {
    const date = new Date(today);
    date.setDate(date.getDate() + offset);

    const dayWindows = windows.filter(
      window => window.isAvailable && window.dayOfWeek === DAY_NAMES[date.getDay()],
    );
    if (dayWindows.length === 0) continue;

    const iso = date.toISOString().split('T')[0];
    dayWindows.forEach(window => {
      if (slots.length < max) slots.push({ date: iso, time: window.startTime, available: true });
    });
  }

  return slots;
}

async function buildAvailableSlots(attorneyName: string): Promise<AppointmentSlot[]> {
  const fallback = generateDefaultSlots();

  try {
    let data = await apiGet<Availability[]>('/availability');
    if (!Array.isArray(data) || data.length === 0) return fallback;

    const forAttorney = data.filter(window => window.lawyerName === attorneyName);
    const slots = slotsFromAvailability(forAttorney.length > 0 ? forAttorney : data);
    return slots.length > 0 ? slots : fallback;
  } catch {
    return fallback;
  }
}

/* ------------------------------------------------------------------ */
/* Result mapping                                                      */
/* ------------------------------------------------------------------ */

/**
 * Rejects degenerate model output (for example an echoed JSON template) so the
 * caller can fall back to mock data instead of showing empty results.
 */
function isUsableAnalysis(analysis: LegalAnalysis): boolean {
  const hasContent =
    analysis.articles.length > 0 || analysis.services.length > 0 || analysis.nextSteps.length > 0;

  return analysis.confidence > 0 && hasContent;
}

/**
 * Result for a non-legal request. The AI refused to answer, so we must not
 * recommend an attorney, match articles or invent next steps for it.
 */
function buildRefusalResult(
  query: string,
  caseType: string,
  model?: string,
  latencyMs?: number,
): LegalAnalysisResult {
  return {
    query,
    extractedKeywords: getLegalKeywords(query),
    suggestedCaseType: caseType,
    confidence: 0,
    matchedArticles: [],
    recommendedAttorney: {
      name: 'Intake Team',
      specialization: 'General Legal Consultation',
      availableSlots: [],
    },
    requiredServices: ['Legal Consultation'],
    nextSteps: ['Explain your legal matter in the description box to receive tailored recommendations.'],
    urgency: 'Low',
    source: 'openrouter',
    model,
    latencyMs,
    keyFacts: [],
  };
}

/** Maps a validated `LegalAnalysis` onto the frontend `NLPAnalysis` shape. */
async function enrichAnalysis(
  query: string,
  analysis: LegalAnalysis,
  source: AIProviderSource,
  model?: string,
  latencyMs?: number,
): Promise<LegalAnalysisResult> {
  const terms = uniqueTerms([
    ...analysis.articles,
    ...getLegalKeywords(query),
    ...getLegalKeywords(analysis.caseType),
  ]);

  const matchedArticles = await matchArticles(terms);
  const recommendedAttorney = pickAttorney(matchedArticles, analysis.caseType);
  const availableSlots = await buildAvailableSlots(recommendedAttorney.name);

  return {
    query,
    extractedKeywords: uniqueTerms([...analysis.articles, ...terms], 12),
    suggestedCaseType: analysis.caseType || 'General Legal Consultation',
    confidence: analysis.confidence,
    matchedArticles,
    recommendedAttorney: {
      name: recommendedAttorney.name,
      specialization: recommendedAttorney.specialization,
      availableSlots,
    },
    requiredServices: analysis.services.length > 0 ? analysis.services : ['Legal Consultation'],
    nextSteps: analysis.nextSteps.length > 0 ? analysis.nextSteps : DEFAULT_NEXT_STEPS,
    urgency: analysis.urgency,
    source,
    model,
    latencyMs,
    keyFacts: analysis.keyFacts ?? [],
    summary: analysis.summary,
  };
}

/** Last-resort heuristic result when OpenRouter *and* MSW are unavailable. */
export function getLocalFallbackAnalysis(query: string): LegalAnalysisResult {
  const caseType = inferCaseType(query);
  const specialist = pickAttorney([], caseType);

  return {
    query,
    extractedKeywords: getLegalKeywords(query),
    suggestedCaseType: caseType,
    confidence: caseType === 'General Legal Consultation' ? 30 : 45,
    matchedArticles: [],
    recommendedAttorney: {
      name: specialist.name,
      specialization: specialist.specialization,
      availableSlots: generateDefaultSlots(),
    },
    requiredServices: ['Legal Consultation'],
    nextSteps: DEFAULT_NEXT_STEPS,
    urgency: inferUrgency(query),
    source: 'fallback',
  };
}

/* ------------------------------------------------------------------ */
/* Public API                                                          */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/* Result cache                                                        */
/* ------------------------------------------------------------------ */

const RESULT_CACHE_LIMIT = 25;
const resultCache = new Map<string, LegalAnalysisResult>();

function cacheKey(query: string, forceMock: boolean): string {
  return `${forceMock ? 'mock' : 'live'}:${query.trim().toLowerCase().replace(/\s+/g, ' ')}`;
}

/** Keeps repeat analyses of the same description instant. */
function rememberResult(key: string, result: LegalAnalysisResult): LegalAnalysisResult {
  if (resultCache.size >= RESULT_CACHE_LIMIT && !resultCache.has(key)) {
    const oldest = resultCache.keys().next().value;
    if (oldest !== undefined) resultCache.delete(oldest);
  }

  resultCache.set(key, result);
  return result;
}

/** Empties the analysis cache (used by tests / a "clear" action). */
export function clearAnalysisCache(): void {
  resultCache.clear();
}

/**
 * Analyses a client's legal problem description.
 *
 * 1. Cached result for an identical description (instant).
 * 2. The Flask AI proxy (`/api/ai/chat`) → OpenRouter, with the legal intake prompt.
 * 3. The MSW mock endpoint when the AI is unreachable (demo/offline mode).
 * 4. Local heuristic as the final safety net.
 *
 * The resolved value always matches the frontend `NLPAnalysis` shape, plus
 * `urgency`, `source`, `model` and `latencyMs` metadata.
 */
export async function analyzeLegalProblem(
  problemText: string,
  options: AnalyzeLegalProblemOptions = {},
): Promise<LegalAnalysisResult> {
  const query = problemText.trim();
  if (!query) return getLocalFallbackAnalysis('');

  const startedAt = Date.now();
  const estimatedMs = getEstimatedAnalysisMs();
  const report = createProgressReporter(options, startedAt, estimatedMs);

  const key = cacheKey(query, options.forceMock === true);
  const cached = resultCache.get(key);
  if (cached) {
    report('done', { message: 'Loaded from this session’s cache' });
    return cached;
  }

  report('preparing');

  if (!options.forceMock && isOpenRouterConfigured()) {
    try {
      const { data, response } = await aiJsonChat<LegalAnalysis>(
        [
          { role: 'system', content: LEGAL_INTAKE_SYSTEM_PROMPT },
          { role: 'user', content: buildLegalIntakeUserPrompt(query) },
        ],
        {
          task: 'legal-intake',
          json: true,
          fallback: null,
          onRetry: options.onRetry,
          onAttempt: info =>
            report(info.attempt > 1 ? 'retrying' : 'requesting', {
              model: info.model,
              attempt: info.attempt,
            }),
        },
      );

      report('received', { model: response.model });
      report('parsing', { model: response.model });

      const analysis = data ? normalizeLegalAnalysis(data) : null;

      // A refusal for non-legal input is returned as-is (no enrichment).
      if (analysis && analysis.caseType === NON_LEGAL_CASE_TYPE) {
        recordAnalysisLatency(response.latencyMs ?? Date.now() - startedAt);
        report('done', { model: response.model });
        return rememberResult(
          key,
          buildRefusalResult(query, analysis.caseType, response.model, response.latencyMs),
        );
      }

      if (analysis && isUsableAnalysis(analysis)) {
        report('enriching', { model: response.model });
        const enriched = await enrichAnalysis(query, analysis, 'openrouter', response.model, response.latencyMs);
        recordAnalysisLatency(response.latencyMs ?? Date.now() - startedAt);
        report('done', { model: response.model });
        return rememberResult(key, enriched);
      }
    } catch (error) {
      options.onError?.(toAIError(error));
    }
  }

  // MSW fallback keeps the demo/offline experience working (and is instant).
  report('fallback');

  try {
    const mock = await fetchMockLegalAnalysis(query);
    const result = rememberResult(key, { ...mock, urgency: inferUrgency(query), source: 'msw' });
    report('done');
    return result;
  } catch (error) {
    options.onError?.(toAIError(error));
  }

  // Not cached: allows a later request to succeed once the API is reachable again.
  report('done', { message: 'Prepared recommendations locally' });
  return getLocalFallbackAnalysis(query);
}

/**
 * Analyses a legal document (contract, filing, motion...).
 * Requires OpenRouter — throws an `AIError` when AI is unavailable or the
 * model output cannot be parsed.
 */
export async function analyzeDocument(
  documentText: string,
  options: { fileName?: string; caseContext?: string; documentType?: string } = {},
): Promise<DocumentAnalysis> {
  const { data, response } = await aiJsonChat<DocumentAnalysis>(
    [
      { role: 'system', content: DOCUMENT_ANALYSIS_SYSTEM_PROMPT },
      { role: 'user', content: buildDocumentAnalysisUserPrompt(documentText, options) },
    ],
    { task: 'document-analysis', json: true, fallback: null },
  );

  const analysis = data ? normalizeDocumentAnalysis(data) : null;
  if (!analysis) {
    throw toAIError(
      new Error(`Document analysis failed to return valid JSON (model: ${response.model}).`),
    );
  }

  return analysis;
}

/**
 * Drafts a case-aware legal email reply.
 * Requires OpenRouter — throws an `AIError` when AI is unavailable or the
 * model output cannot be parsed.
 */
export async function generateEmailReply(
  message: string,
  context: EmailReplyContext = {},
): Promise<EmailReply> {
  const { data, response } = await aiJsonChat<EmailReply>(
    [
      { role: 'system', content: EMAIL_REPLY_SYSTEM_PROMPT },
      { role: 'user', content: buildEmailReplyUserPrompt(message, context) },
    ],
    { task: 'email-reply', json: true, fallback: null },
  );

  const reply = data ? normalizeEmailReply(data) : null;
  if (!reply) {
    throw toAIError(new Error(`Email reply failed to return valid JSON (model: ${response.model}).`));
  }

  return reply;
}
