/*
 * Render test for AIProcessingModal (verifies the real timing math).
 *
 *   node node_modules/esbuild/bin/esbuild tests/modal-test.tsx --bundle --format=cjs --platform=node --jsx=automatic --outfile=.smoke/modal.cjs
 *   node .smoke/modal.cjs
 *
 * CJS output is required because react-dom/server is CommonJS.
 */
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AIProcessingModal } from '../src/components/AIProcessingModal';
import type { AIProgress } from '../src/ai';

/**
 * Minimal Node global used by this test script.
 * The project intentionally has no `@types/node`, so only what is needed is declared.
 */
declare const process: { exitCode?: number };

let failed = 0;
const check = (name: string, ok: boolean, extra = ''): void => {
  console.log(`${ok ? 'PASS' : 'FAIL'} - ${name}${extra ? ` :: ${extra}` : ''}`);
  if (!ok) failed += 1;
};

const render = (progress: Parameters<typeof AIProcessingModal>[0]['progress'], isOpen = true): string =>
  renderToStaticMarkup(React.createElement(AIProcessingModal, { isOpen, progress }));

/** React escapes `&` in static markup; decode before text assertions. */
const decode = (html: string): string =>
  html.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'");

const match = (html: string, pattern: RegExp): string => html.match(pattern)?.[0] ?? 'none';

// 1. In flight: 3s elapsed against a 7s estimate
const inFlight = render({
  stage: 'requesting',
  percent: 15,
  elapsedMs: 3000,
  estimatedMs: 7000,
  model: 'deepseek/deepseek-v4-flash-0731:free',
  attempt: 1,
  message: 'Consulting the AI legal model…',
});

check('renders title', inFlight.includes('Analyzing your concern'));
check('renders stage message', inFlight.includes('Consulting the AI legal model…'));
check('renders elapsed seconds', inFlight.includes('3.0s elapsed'), match(inFlight, /[\d.]+s elapsed/));
check('renders estimated remaining seconds', inFlight.includes('~4s remaining'), match(inFlight, /~\d+s remaining/));
check('renders interpolated percent', inFlight.includes('41%'), match(inFlight, /\d+%/));
check('renders progress bar width', /width:4[01]\./.test(inFlight), match(inFlight, /width:[\d.]+%/));
check('renders model chip', inFlight.includes('deepseek-v4-flash-0731:free'));
check('renders estimate footer', inFlight.includes('Est. total 7s'));
check(
  'renders all 4 pipeline steps',
  ['Reading your description', 'Consulting the AI legal model', 'Matching knowledge base & attorney', 'Preparing recommendations'].every(
    label => decode(inFlight).includes(label),
  ),
);
check('has a spinner for the current step', inFlight.includes('animate-spin'));
check('is an accessible blocking dialog', inFlight.includes('aria-modal="true"') && inFlight.includes('aria-busy="true"'));
check('has no close button (blocking)', !inFlight.includes('×'));

// 2. Overtime: slower than the estimate
const overtime = render({
  stage: 'requesting',
  percent: 15,
  elapsedMs: 9000,
  estimatedMs: 7000,
  message: 'Consulting the AI legal model…',
});
check('overtime shows "Finishing up…"', overtime.includes('Finishing up…'));
check('overtime percent capped at 95%', overtime.includes('95%'), match(overtime, /\d+%/));
check('overtime never shows negative seconds', !/~-/.test(overtime));

// 3. Completed
const doneProgress: AIProgress = {
  stage: 'done',
  percent: 100,
  elapsedMs: 6900,
  estimatedMs: 7000,
  model: 'deepseek/deepseek-v4-flash-0731:free',
  message: 'Analysis complete',
};
const done = render(doneProgress);
check('done shows completion title', done.includes('Analysis complete'));
check('done shows 100%', done.includes('100%'));
check('done hides the countdown', !done.includes('remaining'));
check('done stops every spinner', !done.includes('animate-spin'));

// 4. Closed or missing progress renders nothing
check('closed modal renders nothing', render(null) === '' && render(doneProgress, false) === '');

// 5. Earliest stage still respects its floor
const early = render({
  stage: 'preparing',
  percent: 8,
  elapsedMs: 100,
  estimatedMs: 7000,
  message: 'Reading your description…',
});
check('early stage names step 1', early.includes('Reading your description'));
check('early percent respects the stage floor', Number(match(early, /\d+%/).replace('%', '')) >= 8, match(early, /\d+%/));

console.log(failed === 0 ? 'ALL MODAL CHECKS PASSED' : `${failed} MODAL CHECK(S) FAILED`);
if (failed > 0) process.exitCode = 1;