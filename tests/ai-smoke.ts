/* AI smoke test for src/ai — run: node node_modules/esbuild/bin/esbuild tests/ai-smoke.ts --bundle --format=esm --platform=node --outfile=.smoke/ai-smoke.mjs; node .smoke/ai-smoke.mjs */
import {
  LEGAL_INTAKE_SYSTEM_PROMPT,
  LEGAL_MODELS,
  MODEL_CONFIGS,
  OpenRouterHttpError,
  analyzeLegalProblem,
  buildLegalIntakeUserPrompt,
  clampConfidence, getEstimatedAnalysisMs, recordAnalysisLatency, NON_LEGAL_CASE_TYPE,
  clearAnalysisCache, clearLatencySamples, DEFAULT_ESTIMATED_ANALYSIS_MS,
  createAIError,
  extractJson,
  getFallbackChain,
  getLocalFallbackAnalysis,
  getModelConfig,
  isOpenRouterConfigured,
  isRateLimitError,
  normalizeDocumentAnalysis,
  normalizeEmailReply,
  normalizeLegalAnalysis,
  normalizeUrgency,
  parseJsonResponse,
  selectModel,
  toAIError,
  toStringArray,
  withRetry,
} from '../src/ai';
let failures = 0;

function check(name: string, condition: boolean, extra?: unknown): void {
  if (condition) {
    console.log(`PASS - ${name}`);
  } else {
    failures += 1;
    console.error(`FAIL - ${name}`, extra ?? '');
  }
}

async function main(): Promise<void> {
  // --- models -----------------------------------------------------------
  check('PRIMARY model id', LEGAL_MODELS.PRIMARY === 'poolside/laguna-s-2.1:free');
  check('FALLBACK model id', LEGAL_MODELS.FALLBACK === 'nvidia/nemotron-3-super-120b-a12b:free');
  check('FAST model id', LEGAL_MODELS.FAST === 'poolside/laguna-xs-2.1:free');
  check('selectModel(legal-intake) = PRIMARY', selectModel('legal-intake').key === 'PRIMARY');
  check('selectModel(email-reply) = FAST', selectModel('email-reply').key === 'FAST');
  check(
    'accuracy profile: low temperature + reasoning token budget',
    getModelConfig('PRIMARY').temperature <= 0.1 && getModelConfig('PRIMARY').maxTokens >= 3000,
  );
  const chain = getFallbackChain('legal-intake');
  check('fallback chain has 3 models, PRIMARY first', chain.length === 3 && chain[0].key === 'PRIMARY');
  check('all model configs exposed', Object.keys(MODEL_CONFIGS).length === 3);
  check('every model id is free', chain.every(model => model.id.endsWith(':free') && model.jsonMode));
  // `LEGAL_MODELS` is `as const`, so its values are literal types. Comparing one
  // directly against a string that is not in the union is a TS2367 error — widen
  // to `string` first (this is also how a stale expectation used to fail here).
  const modelIds: readonly string[] = Object.values(LEGAL_MODELS);
  check('no slot uses the openrouter/free auto-router', modelIds.every(id => id !== 'openrouter/free'));
  check(
    'no slot is a classifier or non-chat model',
    modelIds.every(id => !/content-safety|guard|moderation|embedding|lyria/i.test(id)),
  );
  check('chain ids are distinct', new Set(chain.map(model => model.id)).size === chain.length);
  check('PRIMARY keeps reasoning ON for accuracy', getModelConfig('PRIMARY').disableReasoning === false);
  check('non-primary slots skip reasoning (speed/quota)', getModelConfig('FALLBACK').disableReasoning === true && getModelConfig('FAST').disableReasoning === true);

  // --- parseResponse ----------------------------------------------------
  const fenced =
    '```json\n{"caseType":"Criminal Defense","confidence":"87","urgency":"high","articles":["assault","battery"],"services":["Legal Consultation"],"nextSteps":["Schedule a consultation",], }\n```';
  const parsed = parseJsonResponse<Record<string, unknown>>(fenced);
  check('parses fenced JSON with trailing comma', parsed !== null && parsed.caseType === 'Criminal Defense');

  const analysis = normalizeLegalAnalysis(parsed);
  check('normalizeLegalAnalysis confidence', analysis?.confidence === 87);
  check('normalizeLegalAnalysis urgency = High', analysis?.urgency === 'High');
  check('normalizeLegalAnalysis articles', analysis?.articles.length === 2);
  check('normalizeLegalAnalysis services', analysis?.services[0] === 'Legal Consultation');
  check('normalizeLegalAnalysis rejects non-object', normalizeLegalAnalysis('nope') === null);
  check('parse falls back on broken JSON', parseJsonResponse('not json', { ok: true })?.ok === true);
  check('extractJson strict object', extractJson('{"a":1}') === '{"a":1}');
  check('toStringArray splits strings', toStringArray('a, b;c').length === 3);
  check('clampConfidence caps at 100', clampConfidence(150) === 100);
  check('clampConfidence rescales 0-1 fractions', clampConfidence(0.85) === 85 && clampConfidence(0.95) === 95);
  check('clampConfidence keeps explicit 1 as 1%', clampConfidence(1) === 1);
  check('normalizeUrgency default Medium', normalizeUrgency('whatever') === 'Medium');
  check(
    'fraction confidence normalized end-to-end',
    normalizeLegalAnalysis({ caseType: 'Probate & Estate', confidence: 0.85, urgency: 'Low' })?.confidence === 85,
  );

  const doc = normalizeDocumentAnalysis({
    parties: ['Acme Corp', 'Jane Doe'],
    dates: ['2026-03-15 - signature date'],
    clauses: [{ title: 'Indemnity', text: '...', risk: 'high' }],
    summary: 'A contract.',
  });
  check('normalizeDocumentAnalysis parties', doc?.parties.length === 2);
  check('normalizeDocumentAnalysis clause risk', doc?.clauses[0].risk === 'High');
  check('normalizeEmailReply body required', normalizeEmailReply({ subject: 'x' }) === null);
  check('normalizeEmailReply tone default', normalizeEmailReply({ body: 'hello' })?.tone === 'professional');

  // --- handleError ------------------------------------------------------
  const rateLimit = toAIError(new OpenRouterHttpError(429, 'rate limited'));
  check('429 -> RATE_LIMIT retryable', rateLimit.code === 'RATE_LIMIT' && rateLimit.retryable);
  check('isRateLimitError helper', isRateLimitError(new OpenRouterHttpError(429, '')));
  const unavailable = toAIError(new OpenRouterHttpError(404, 'model'));
  check('404 -> MODEL_UNAVAILABLE not retryable', unavailable.code === 'MODEL_UNAVAILABLE' && !unavailable.retryable);
  const serverError = toAIError(new OpenRouterHttpError(500, 'boom'));
  check('500 -> API_ERROR retryable', serverError.code === 'API_ERROR' && serverError.retryable);
  check('missing key not retryable', createAIError('x', 'MISSING_API_KEY').retryable === false);

  let attempts = 0;
  const retried = await withRetry(
    async () => {
      attempts += 1;
      if (attempts < 3) throw new OpenRouterHttpError(429, 'again');
      return 'ok';
    },
    { retries: 3, baseDelayMs: 1, maxDelayMs: 2 },
  );
  check('withRetry retries then succeeds', retried === 'ok' && attempts === 3, attempts);

  let noRetryAttempts = 0;
  try {
    await withRetry(
      async () => {
        noRetryAttempts += 1;
        throw createAIError('permanent', 'INVALID_RESPONSE', { retryable: false });
      },
      { retries: 3, baseDelayMs: 1, maxDelayMs: 2 },
    );
  } catch {
    /* expected */
  }
  check('withRetry does not retry non-retryable', noRetryAttempts === 1, noRetryAttempts);

  // --- fallback chain ---------------------------------------------------
  // Simulate MSW's /api/* handlers so the real enrichment + cache paths run in Node
  // (otherwise fetch fails on relative URLs and only the uncached heuristic runs).
  const realFetch = globalThis.fetch;
  const jsonResponse = (body: unknown) =>
    new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
  const MOCK_ANALYSIS = {
    extractedKeywords: ['assault'],
    suggestedCaseType: 'Criminal Law',
    confidence: 60,
    matchedArticles: [],
    recommendedAttorney: {
      name: 'James Rodriguez, Esq.',
      specialization: 'Criminal Law',
      availableSlots: [{ date: '2026-09-21', time: '09:00', available: true }],
    },
    requiredServices: ['Legal Consultation'],
    nextSteps: ['Schedule a consultation', 'Gather evidence', 'Review the matched articles'],
  };

  globalThis.fetch = ((input: unknown, init?: { body?: unknown }) => {
    const url = typeof input === 'string' ? input : String((input as { url?: string })?.url ?? input);
    if (url.startsWith('/api/knowledge/articles')) return Promise.resolve(jsonResponse([]));
    if (url.startsWith('/api/availability')) return Promise.resolve(jsonResponse([]));
    if (url.startsWith('/api/nlp/analyze')) {
      const body = JSON.parse(String(init?.body ?? '{}')) as { query?: string };
      return Promise.resolve(jsonResponse({ ...MOCK_ANALYSIS, query: body.query ?? '' }));
    }
    return realFetch(input as RequestInfo, init as RequestInit);
  }) as unknown as typeof fetch;

  check('isOpenRouterConfigured returns boolean', typeof isOpenRouterConfigured() === 'boolean');

  // forceMock keeps this on the mock path, so no live API call is made here.
  const result = await analyzeLegalProblem('I was assaulted at a bar last night and need legal help', {
    forceMock: true,
  });
  check('result source is msw or fallback', result.source === 'msw' || result.source === 'fallback', result.source);
  check(
    'result matches NLPAnalysis shape',
    typeof result.query === 'string' &&
      typeof result.suggestedCaseType === 'string' &&
      typeof result.confidence === 'number' &&
      Array.isArray(result.extractedKeywords) &&
      Array.isArray(result.matchedArticles) &&
      Array.isArray(result.requiredServices) &&
      Array.isArray(result.nextSteps) &&
      typeof result.recommendedAttorney.name === 'string',
  );
  check('result exposes urgency + source', ['High', 'Medium', 'Low'].includes(result.urgency) && !!result.source);
  check('availableSlots generated', result.recommendedAttorney.availableSlots.length > 0);
  check('nextSteps populated', result.nextSteps.length >= 3);
  check('recommendedAttorney specialization', result.recommendedAttorney.specialization.length > 0);

  const heuristic = getLocalFallbackAnalysis('I was arrested and need a criminal defense lawyer');
  check('local heuristic detects Criminal Defense', heuristic.suggestedCaseType === 'Criminal Defense', heuristic.suggestedCaseType);
  check('local heuristic urgency High', heuristic.urgency === 'High');
  check('empty input does not throw', (await analyzeLegalProblem('   ')).confidence >= 0);

  // --- caching ----------------------------------------------------------
  const CACHE_QUERY = 'I was assaulted at a bar last night and need legal help';
  clearAnalysisCache();
  const cachedFirst = await analyzeLegalProblem(CACHE_QUERY, { forceMock: true });
  const cachedSecond = await analyzeLegalProblem(CACHE_QUERY, { forceMock: true });
  check('repeat analysis served from cache', cachedFirst === cachedSecond);
  clearAnalysisCache();
  const cachedThird = await analyzeLegalProblem(CACHE_QUERY, { forceMock: true });
  check('clearAnalysisCache resets the cache', cachedThird !== cachedFirst);

  // --- real progress reporting -----------------------------------------
  const stages: string[] = [];
  const percents: number[] = [];
  const progressEvents: { elapsedMs: number; estimatedMs: number; message: string }[] = [];
  clearAnalysisCache();
  const progressResult = await analyzeLegalProblem('Someone hit my parked car and drove off last night', {
    forceMock: true,
    onProgress: event => {
      stages.push(event.stage);
      percents.push(event.percent);
      progressEvents.push({ elapsedMs: event.elapsedMs, estimatedMs: event.estimatedMs, message: event.message });
    },
  });

  check('progress starts with preparing', stages[0] === 'preparing', stages.join('>'));
  check('progress ends with done', stages[stages.length - 1] === 'done', stages.join('>'));
  check('progress reports the fallback stage', stages.includes('fallback'), stages.join('>'));
  check('progress percent reaches 100', percents[percents.length - 1] === 100, percents.join(','));
  check(
    'progress carries real timing + estimate',
    progressEvents.every(event => typeof event.elapsedMs === 'number' && event.estimatedMs > 0),
  );
  check(
    'progress messages are human readable',
    progressEvents.every(event => typeof event.message === 'string' && event.message.length > 5),
  );
  check('progress elapsed time is monotonic', progressEvents.every((event, i) => i === 0 || event.elapsedMs >= progressEvents[i - 1].elapsedMs));
  check('progress result still valid', progressResult.source === 'msw' && progressResult.nextSteps.length > 0);

  clearLatencySamples();
  check('default estimate used before any measurement', getEstimatedAnalysisMs() === DEFAULT_ESTIMATED_ANALYSIS_MS);
  recordAnalysisLatency(3000);
  recordAnalysisLatency(5000);
  check('estimate averages measured latencies', getEstimatedAnalysisMs() === 4000, String(getEstimatedAnalysisMs()));
  recordAnalysisLatency(-1);
  check('estimate ignores invalid samples', getEstimatedAnalysisMs() === 4000, String(getEstimatedAnalysisMs()));
  clearLatencySamples();
  check('estimate clamps to a sane minimum', (() => { recordAnalysisLatency(100); return getEstimatedAnalysisMs() === 1500; })());
  clearLatencySamples();

  // --- prompts ----------------------------------------------------------
  check('prompt restricts the scope to legal matters', LEGAL_INTAKE_SYSTEM_PROMPT.includes('only work on legal matters'));
  check(
    'prompt defines the refusal contract',
    LEGAL_INTAKE_SYSTEM_PROMPT.includes(NON_LEGAL_CASE_TYPE) && LEGAL_INTAKE_SYSTEM_PROMPT.includes('confidence 0'),
  );
  check(
    'prompt lists the allowed case types',
    LEGAL_INTAKE_SYSTEM_PROMPT.includes('ALLOWED caseType VALUES') &&
      LEGAL_INTAKE_SYSTEM_PROMPT.includes('Criminal Defense') &&
      LEGAL_INTAKE_SYSTEM_PROMPT.includes('Landlord/Tenant'),
  );
  check(
    'prompt includes the urgency rubric with hard triggers',
    LEGAL_INTAKE_SYSTEM_PROMPT.includes('URGENCY RUBRIC') &&
      LEGAL_INTAKE_SYSTEM_PROMPT.includes('do NOT answer "High"'),
  );
  check(
    'prompt includes confidence calibration anchors',
    LEGAL_INTAKE_SYSTEM_PROMPT.includes('CONFIDENCE ANCHORS') && LEGAL_INTAKE_SYSTEM_PROMPT.includes('cap confidence at 70'),
  );
  check(
    'prompt requires grounding facts',
    LEGAL_INTAKE_SYSTEM_PROMPT.includes('keyFacts') && LEGAL_INTAKE_SYSTEM_PROMPT.includes('Never add facts of your own'),
  );
  check(
    'prompt follows a step-by-step procedure',
    LEGAL_INTAKE_SYSTEM_PROMPT.includes('Step 1') && LEGAL_INTAKE_SYSTEM_PROMPT.includes('Step 8'),
  );
  check(
    'prompt ships few-shot examples',
    (LEGAL_INTAKE_SYSTEM_PROMPT.match(/Example \d/g) ?? []).length >= 5,
    String((LEGAL_INTAKE_SYSTEM_PROMPT.match(/Example \d/g) ?? []).length),
  );
  check(
    'prompt forbids invented facts and outcomes',
    LEGAL_INTAKE_SYSTEM_PROMPT.includes('Never invent statutes') && LEGAL_INTAKE_SYSTEM_PROMPT.includes('Never predict'),
  );
  check(
    'prompt enforces the JSON-only output contract',
    LEGAL_INTAKE_SYSTEM_PROMPT.includes('Return ONLY one valid JSON object') && LEGAL_INTAKE_SYSTEM_PROMPT.includes('No markdown'),
  );
  check(
    'prompt protects sensitive identifiers',
    LEGAL_INTAKE_SYSTEM_PROMPT.includes('Never repeat sensitive identifiers'),
  );
  check('user prompt wraps description', buildLegalIntakeUserPrompt('car accident').includes('car accident'));

  console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
  if (failures > 0) process.exitCode = 1;
}

void main();

/**
 * Minimal Node global used by this test script at runtime (`process.exitCode`).
 * Ambient declarations are hoisted, and the project intentionally has no
 * `@types/node`, so only what is needed is declared here.
 */
declare const process: { exitCode?: number };
