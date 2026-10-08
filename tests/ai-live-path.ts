/*
 * Deterministic integration test of the real OpenRouter code path (no network).
 * The provider and /api/* calls are stubbed; the API key is set on the exported
 * config object at runtime so no build-time env injection is needed.
 *
 *   node node_modules/esbuild/bin/esbuild tests/ai-live-path.ts --bundle --format=esm --platform=node --outfile=.smoke/ai-live-path.mjs
 *   node .smoke/ai-live-path.mjs
 */
import {
  DEFAULT_ESTIMATED_ANALYSIS_MS,
  LEGAL_MODELS,
  analyzeLegalProblem,
  clearAnalysisCache,
  clearLatencySamples,
  getEstimatedAnalysisMs,
  isOpenRouterConfigured,
  openRouterConfig,
} from '../src/ai';

/**
 * Minimal Node global used by this test script.
 * The project intentionally has no `@types/node`, so only what is needed is declared.
 */
declare const process: { exitCode?: number };

// Inject a key (the client reads it from VITE_OPENROUTER_API_KEY at load time).
openRouterConfig.apiKey = 'test-key';

let failed = 0;
const check = (name: string, ok: boolean, extra = ''): void => {
  console.log(`${ok ? 'PASS' : 'FAIL'} - ${name}${extra ? ` :: ${extra}` : ''}`);
  if (!ok) failed += 1;
};

const ARTICLE = {
  id: 1,
  title: 'Patent Infringement Basics',
  category: 'Intellectual Property',
  keywords: ['patent', 'infringement', 'invention'],
  summary: 'How patent infringement claims work.',
  content: '',
  attorneySpecialist: 'John Smith, Esq.',
  servicesNeeded: ['Patent Analysis'],
  status: 'published',
  matchCount: 20,
  createdAt: '2025-06-01',
  updatedAt: '2026-03-15',
};

const PROVIDER_LATENCY_MS = 2500;
const QUERY = 'Someone is using my patented design without permission.';

const json = (body: unknown): Response =>
  new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });

const openRouterCalls: { model: string; reasoningDisabled: boolean; hasJsonFormat: boolean; maxTokens: number }[] = [];

const realFetch = globalThis.fetch;
globalThis.fetch = (async (input: unknown, init?: { body?: unknown }) => {
  const url = typeof input === 'string' ? input : String((input as { url?: string })?.url ?? input);

  if (url.includes('/chat/completions')) {
    const payload = JSON.parse(String(init?.body ?? '{}'));
    openRouterCalls.push({
      model: payload.model,
      reasoningDisabled: payload.reasoning?.enabled === false,
      hasJsonFormat: payload.response_format?.type === 'json_object',
      maxTokens: payload.max_tokens ?? 0,
    });
    await new Promise(resolve => setTimeout(resolve, PROVIDER_LATENCY_MS));
    return json({
      model: payload.model,
      choices: [
        {
          message: {
            content: JSON.stringify({
              caseType: 'Intellectual Property',
              confidence: 0.88,
              urgency: 'High',
              articles: ['patent', 'infringement'],
              services: ['Patent Analysis', 'Court Representation'],
              nextSteps: ['Collect the patent documents', 'Send a cease and desist letter', 'Schedule a consultation'],
              keyFacts: ['competitor sells a product copying my patented design', 'patent granted two years ago'],
              summary: 'Potential patent infringement by a third party.',
            }),
          },
        },
      ],
      usage: { prompt_tokens: 900, completion_tokens: 200, total_tokens: 1100 },
    });
  }

  if (url.startsWith('/api/knowledge/articles')) return json([ARTICLE]);
  if (url.startsWith('/api/availability')) return json([]);
  return realFetch(input as RequestInfo, init as RequestInit);
}) as unknown as typeof fetch;

async function main(): Promise<void> {
  check('api key injected', isOpenRouterConfigured() === true);

  clearAnalysisCache();
  clearLatencySamples();
  check('estimate defaults before measurement', getEstimatedAnalysisMs() === DEFAULT_ESTIMATED_ANALYSIS_MS);

  const stages: string[] = [];
  const modelsSeen: string[] = [];
  const start = Date.now();

  const result = await analyzeLegalProblem(QUERY, {
    onProgress: event => {
      stages.push(event.stage);
      if (event.model) modelsSeen.push(event.model);
    },
  });

  const elapsed = Date.now() - start;

  check('stage order is the real pipeline', stages.join('>') === 'preparing>requesting>received>parsing>enriching>done', stages.join('>'));
  check('requesting stage names the model', modelsSeen.includes(LEGAL_MODELS.PRIMARY), modelsSeen.join(','));
  check('only the primary model was called', openRouterCalls.length === 1 && openRouterCalls[0].model === LEGAL_MODELS.PRIMARY, String(openRouterCalls.length));
  check('reasoning stays ON for the primary model (accuracy)', openRouterCalls.every(call => call.reasoningDisabled === false));
  check('accuracy token budget sent', openRouterCalls.every(call => call.maxTokens >= 3000));
  check('json_object format requested', openRouterCalls.every(call => call.hasJsonFormat));

  check('result source is openrouter', result.source === 'openrouter', result.source);
  check('fraction confidence normalized (0.88 -> 88)', result.confidence === 88, String(result.confidence));
  check('case type mapped', result.suggestedCaseType === 'Intellectual Property', result.suggestedCaseType);
  check('urgency mapped', result.urgency === 'High', result.urgency);
  check('services preserved', result.requiredServices.length === 2, String(result.requiredServices.length));
  check('nextSteps preserved', result.nextSteps.length === 3, String(result.nextSteps.length));
  check('articles matched from knowledge base', result.matchedArticles.length === 1, String(result.matchedArticles.length));
  check('grounding facts carried through', (result.keyFacts ?? []).length === 2, JSON.stringify(result.keyFacts));
  check('attorney picked from matched article', result.recommendedAttorney.name === 'John Smith, Esq.', result.recommendedAttorney.name);
  check('latency measured', typeof result.latencyMs === 'number' && result.latencyMs >= PROVIDER_LATENCY_MS, String(result.latencyMs));
  check('wall clock consistent with provider latency', elapsed >= PROVIDER_LATENCY_MS, `${elapsed}ms`);

  const estimateAfter = getEstimatedAnalysisMs();
  check('estimate adapts to the measured duration', estimateAfter >= 2000 && estimateAfter <= 3500, String(estimateAfter));

  // A repeat of the same description must be instant and hit the cache.
  const cachedStages: string[] = [];
  const cachedStart = Date.now();
  const cached = await analyzeLegalProblem(QUERY, { onProgress: event => cachedStages.push(event.stage) });

  check('cache hit is instant', Date.now() - cachedStart < 50, `${Date.now() - cachedStart}ms`);
  check('cache hit emits done immediately', cachedStages.join('>') === 'done', cachedStages.join('>'));
  check('cache hit returns identical payload', cached === result);
  check('no extra provider calls for cached query', openRouterCalls.length === 1, String(openRouterCalls.length));

  console.log(failed === 0 ? 'ALL LIVE-PATH CHECKS PASSED' : `${failed} LIVE-PATH CHECK(S) FAILED`);
  if (failed > 0) process.exitCode = 1;
}

void main();