/*
 * Live ACCURACY evaluation for the legal intake analysis.
 *
 * Scores the real production path (src/ai prompt + aiChat) against labeled client
 * scenarios and compares the reasoning-enabled accuracy profile with the previous
 * no-reasoning profile.
 *
 *   npm run test:accuracy
 *   node node_modules/esbuild/bin/esbuild tests/ai-accuracy.ts --bundle --format=esm --platform=node --outfile=.smoke/ai-accuracy.mjs
 *   node .smoke/ai-accuracy.mjs
 *
 * Uses free-tier requests (8 scenarios x 2 profiles = 16).
 */
import { readFileSync } from 'node:fs';
import {
  LEGAL_INTAKE_SYSTEM_PROMPT,
  MODEL_CONFIGS,
  aiChat,
  buildLegalIntakeUserPrompt,
  normalizeLegalAnalysis,
  openRouterConfig,
  parseJsonResponse,
} from '../src/ai';

declare const process: { exitCode?: number; exit(code?: number): never };

const envText = readFileSync('.env', 'utf8');
openRouterConfig.apiKey = (envText.match(/^VITE_OPENROUTER_API_KEY=(.*)$/m)?.[1] ?? '').trim();
if (!openRouterConfig.apiKey) {
  console.log('SKIP - no VITE_OPENROUTER_API_KEY in .env');
  process.exit(0);
}

interface Scenario {
  name: string;
  text: string;
  caseType: string[];
  urgency: string[];
  keywords: string[];
  services: string[];
  /** Expect a calibrated (low) confidence because the description is vague. */
  expectLowConfidence?: boolean;
  /** Expect a refusal: all arrays empty and confidence 0. */
  expectRefusal?: boolean;
}

const CASES: Scenario[] = [
  {
    name: 'criminal / arrest before hearing',
    text: 'Police arrested my brother at a protest last night. They say he punched an officer. His hearing is in 3 days and we have no lawyer.',
    caseType: ['Criminal Defense'],
    urgency: ['High'],
    keywords: ['assault', 'arrest', 'police', 'criminal', 'hearing'],
    services: ['Court Representation', 'Criminal Case Filing', 'Legal Consultation'],
  },
  {
    name: 'patent infringement',
    text: 'A competitor sells a product that copies the design I patented two years ago. I want to know what my options are.',
    caseType: ['Intellectual Property'],
    urgency: ['Medium'],
    keywords: ['patent', 'infringement', 'intellectual property'],
    services: ['Patent Analysis', 'Legal Consultation'],
  },
  {
    name: 'landlord lockout (ongoing harm)',
    text: 'My landlord changed the locks yesterday and put my belongings on the street. I have nowhere to go and my lease runs to December.',
    caseType: ['Landlord/Tenant'],
    urgency: ['High'],
    keywords: ['landlord', 'tenant', 'lease', 'lockout', 'eviction'],
    services: ['Legal Consultation', 'Court Representation'],
  },
  {
    name: 'probate / contested will',
    text: 'My mother passed away six months ago. Her will leaves the house to me but my brother is refusing to sign the probate paperwork.',
    caseType: ['Probate & Estate'],
    urgency: ['Medium'],
    keywords: ['probate', 'estate', 'will', 'inheritance'],
    services: ['Legal Consultation'],
  },
  {
    name: 'employment retaliation',
    text: 'I was fired two weeks after I reported unsafe conditions at my workplace. HR says it was performance related.',
    caseType: ['Employment Law'],
    urgency: ['Medium'],
    keywords: ['employment', 'termination', 'retaliation', 'workplace', 'fired'],
    services: ['Legal Consultation'],
  },
  {
    name: 'personal injury / insurer low offer',
    text: 'I was hit by a car two months ago. I am still doing physiotherapy and the driver insurance company has made a low offer. I want to know if I should settle.',
    caseType: ['Personal Injury'],
    // Ongoing treatment counts as an ongoing-harm High trigger, so either is defensible.
    urgency: ['Medium', 'High'],
    keywords: ['injury', 'accident', 'car', 'insurer', 'compensation'],
    services: ['Legal Consultation', 'Compensation Claim', 'Negotiation'],
  },
  {
    name: 'vague description (calibration)',
    text: 'Something happened with my landlord and I need advice.',
    caseType: ['Landlord/Tenant'],
    urgency: ['Medium', 'Low'],
    keywords: ['landlord', 'tenant', 'lease'],
    services: ['Legal Consultation'],
    expectLowConfidence: true,
  },
  {
    name: 'non-legal request (refusal)',
    text: 'Write me a Python script that sorts a list of numbers.',
    caseType: ['Not a Legal Matter'],
    urgency: ['Low'],
    keywords: [],
    services: [],
    expectRefusal: true,
  },
];

interface Profile {
  label: string;
  temperature: number;
  maxTokens: number;
  disableReasoning: boolean;
}

/**
 * The production accuracy profile — read straight from the shipped model config so
 * this evaluation can never drift from what the app actually uses.
 * (The reasoning-off control profile measured earlier on the retired DeepSeek id
 * is intentionally not repeated here.)
 */
const PROFILE: Profile = {
  label: 'reasoning ON (production accuracy profile)',
  temperature: MODEL_CONFIGS.PRIMARY.temperature,
  maxTokens: MODEL_CONFIGS.PRIMARY.maxTokens,
  disableReasoning: MODEL_CONFIGS.PRIMARY.disableReasoning,
};

interface Score {
  valid: boolean;
  caseType: boolean;
  urgency: boolean;
  articles: boolean;
  services: boolean;
  steps: boolean;
  keyFacts: boolean;
  calibration: boolean;
}

const overlap = (actual: string[], expected: string[]): boolean =>
  expected.length === 0 ||
  actual.some(value =>
    expected.some(term => value.toLowerCase().includes(term.toLowerCase()) || term.toLowerCase().includes(value.toLowerCase())),
  );

async function runScenario(scenario: Scenario, profile: Profile) {
  const started = Date.now();
  const response = await aiChat(
    [
      { role: 'system', content: LEGAL_INTAKE_SYSTEM_PROMPT },
      { role: 'user', content: buildLegalIntakeUserPrompt(scenario.text) },
    ],
    {
      model: MODEL_CONFIGS.PRIMARY.id,
      retries: 0,
      json: true,
      temperature: profile.temperature,
      maxTokens: profile.maxTokens,
      disableReasoning: profile.disableReasoning,
      totalTimeoutMs: 90000,
      timeoutMs: 60000,
    },
  );

  const elapsed = Date.now() - started;
  const parsed = parseJsonResponse<unknown>(response.content, null);
  const analysis = parsed ? normalizeLegalAnalysis(parsed) : null;

  const refusal = scenario.expectRefusal === true;
  const expectedConfidenceFloor = scenario.expectLowConfidence ? 0 : 60;

  const score: Score = {
    valid: analysis !== null,
    caseType: analysis !== null && scenario.caseType.includes(analysis.caseType),
    urgency: analysis !== null && scenario.urgency.includes(analysis.urgency),
    articles:
      analysis !== null && (refusal ? analysis.articles.length === 0 : overlap(analysis.articles, scenario.keywords)),
    services:
      analysis !== null && (refusal ? analysis.services.length === 0 : overlap(analysis.services, scenario.services)),
    steps:
      analysis !== null &&
      (refusal
        ? analysis.nextSteps.length === 0
        : analysis.nextSteps.length >= 3 && analysis.nextSteps.length <= 6),
    keyFacts:
      analysis !== null &&
      analysis.keyFacts.length <= 4 &&
      (refusal ? analysis.keyFacts.length === 0 : analysis.keyFacts.length >= 1),
    calibration:
      analysis !== null &&
      (refusal
        ? analysis.confidence === 0
        : scenario.expectLowConfidence
          ? analysis.confidence <= 60
          : analysis.confidence >= expectedConfidenceFloor),
  };

  return { score, analysis, elapsed, model: response.model, reasoningChars: (response.reasoning ?? '').length };
}

async function main(): Promise<void> {
  console.log(`model: ${MODEL_CONFIGS.PRIMARY.id}`);
  console.log(`profile: temp ${PROFILE.temperature}, maxTokens ${PROFILE.maxTokens}, reasoning ${PROFILE.disableReasoning ? 'off' : 'on'}`);
  console.log(`cases: ${CASES.length}\n`);

  let passed = 0;
  let total = 0;
  let ms = 0;
  const dimensionHits = new Map<string, number>();

  for (const scenario of CASES) {
    try {
      const { score, analysis, elapsed, model, reasoningChars } = await runScenario(scenario, PROFILE);
      const results = Object.entries(score);
      const ok = results.filter(([, value]) => value).length;
      passed += ok;
      total += results.length;
      ms += elapsed;

      results.forEach(([key, value]) => {
        if (value) dimensionHits.set(key, (dimensionHits.get(key) ?? 0) + 1);
      });

      const servedBy = model === MODEL_CONFIGS.PRIMARY.id ? '' : `  [served by ${model}]`;
      console.log(
        `  ${ok}/${results.length}  ${scenario.name.padEnd(38)} ${String(elapsed).padStart(6)}ms  confidence=${String(analysis?.confidence ?? '-').padStart(3)}  type="${analysis?.caseType ?? '-'}"  urgency=${analysis?.urgency ?? '-'}  facts=${analysis?.keyFacts.length ?? 0}  reasoning=${reasoningChars}c${servedBy}`,
      );

      const failed = results.filter(([, value]) => !value).map(([key]) => key);
      if (failed.length > 0) {
        console.log(`         failed: ${failed.join(', ')}`);
        if (analysis) {
          console.log(`         got: type="${analysis.caseType}" urgency=${analysis.urgency} conf=${analysis.confidence} articles=${JSON.stringify(analysis.articles)} services=${JSON.stringify(analysis.services)} steps=${analysis.nextSteps.length} facts=${analysis.keyFacts.length}`);
        }
      }
    } catch (error) {
      total += 8;
      console.log(`  ERROR ${scenario.name}: ${String(error).slice(0, 160)}`);
    }
  }

  console.log('\n=== DIMENSION BREAKDOWN ===');
  for (const dimension of ['valid', 'caseType', 'urgency', 'articles', 'services', 'steps', 'keyFacts', 'calibration']) {
    console.log(`  ${dimension.padEnd(12)} ${dimensionHits.get(dimension) ?? 0}/${CASES.length}`);
  }

  const percent = total === 0 ? 0 : Math.round((passed / total) * 100);
  console.log(`\nTOTAL: ${passed}/${total} checks (${percent}%), avg ${Math.round(ms / CASES.length)}ms per analysis`);
  console.log(percent >= 90 ? `ACCURACY GATE PASSED (${percent}% >= 90%)` : `ACCURACY GATE FAILED (${percent}% < 90%)`);
  if (percent < 90) process.exitCode = 1;
}

void main();