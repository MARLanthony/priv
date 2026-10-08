/*
 * OpenRouter key resilience test.
 *
 *   node node_modules/esbuild/bin/esbuild tests/ai-key-test.tsx --bundle --format=cjs --platform=node --jsx=automatic --outfile=.smoke/ai-key.cjs
 *   node .smoke/ai-key.cjs
 *
 * A `.env` file is easy to lose — a wildcard cleanup, a cloud-sync revert, a
 * fresh clone — and when it goes the app silently drops back to bundled demo
 * data. These checks cover both recovery paths: the CLI helper that rewrites the
 * key line safely, and the device copy in Settings -> AI engine that keeps
 * working with no `.env` at all. The scripts run in a temp directory, so the
 * real `.env` is never touched.
 */
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { copyFileSync, existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import {
  AI_KEY_STORAGE_KEY,
  LEGACY_AI_KEY_STORAGE_KEY,
  getApiKeySource,
  isOpenRouterConfigured,
  maskApiKey,
  openRouterConfig,
  readEnvApiKey,
  readStoredApiKey,
  setOpenRouterApiKey,
} from '../src/ai';
import { useAiKeyStore } from '../src/stores/aiKeyStore';
import { SettingsPage, AiKeyPanel, type AiKeyPanelProps } from '../src/pages/shared/SettingsPage';

declare const process: { exitCode?: number; execPath: string; argv: string[] };

let failed = 0;
const check = (name: string, ok: boolean, extra = ''): void => {
  console.log(`${ok ? 'PASS' : 'FAIL'} - ${name}${extra ? ` :: ${extra}` : ''}`);
  if (!ok) failed += 1;
};

const decode = (html: string): string =>
  html.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'");

/* --- localStorage shim so the device copy works outside the browser -------- */
const store = new Map<string, string>();
(globalThis as { localStorage?: unknown }).localStorage = {
  getItem: (key: string) => store.get(key) ?? null,
  setItem: (key: string, value: string) => void store.set(key, String(value)),
  removeItem: (key: string) => void store.delete(key),
  clear: () => store.clear(),
};

const ENV_KEY = readEnvApiKey();

/* --- precedence: device copy > .env > none -------------------------------- */
store.clear();
setOpenRouterApiKey('');
check('no key anywhere leaves the client unconfigured', isOpenRouterConfigured() === false);
check('source is "none" without a key', getApiKeySource() === 'none', getApiKeySource());

useAiKeyStore.getState().saveKey('  sk-or-v1-devicekey000000  ');
check('saving trims whitespace', readStoredApiKey() === 'sk-or-v1-devicekey000000', readStoredApiKey());
check('saving configures the client', isOpenRouterConfigured() === true);
check('the device copy uses a stable namespaced slot', store.get(AI_KEY_STORAGE_KEY) === 'sk-or-v1-devicekey000000');
check('source reports the device override', getApiKeySource() === 'device');
check(
  'store state mirrors the client',
  useAiKeyStore.getState().apiKey === 'sk-or-v1-devicekey000000' &&
    useAiKeyStore.getState().isConfigured === true,
);
check('the device copy works with no .env key', readStoredApiKey() !== '');

useAiKeyStore.getState().clearKey();
check('forgetting clears storage', store.has(AI_KEY_STORAGE_KEY) === false);
check('forgetting falls back to .env', openRouterConfig.apiKey === ENV_KEY, ENV_KEY ? '(env key)' : '(empty)');
check('source falls back to env/none', getApiKeySource() === (ENV_KEY ? 'env' : 'none'));

/* --- rebrand migration: a key saved before the rename is adopted ---------- */
store.clear();
store.set(LEGACY_AI_KEY_STORAGE_KEY, 'sk-or-v1-rebrandkey000000');
check('a key in the pre-rebrand slot is picked up', readStoredApiKey() === 'sk-or-v1-rebrandkey000000');
check('it is moved to the current slot', store.get(AI_KEY_STORAGE_KEY) === 'sk-or-v1-rebrandkey000000');
check('the stale slot is cleared', store.has(LEGACY_AI_KEY_STORAGE_KEY) === false);
store.set(LEGACY_AI_KEY_STORAGE_KEY, 'sk-or-v1-stalekey00000000');
check('the current slot wins when both exist', readStoredApiKey() === 'sk-or-v1-rebrandkey000000');
store.clear();
setOpenRouterApiKey('');
check('migration leaves the client on the .env fallback', getApiKeySource() === (ENV_KEY ? 'env' : 'none'));

/* --- masking: a key must never be rendered in full ------------------------ */
check(
  'long keys keep a prefix + suffix only',
  maskApiKey('sk-or-v1-abcdef1234567890') === 'sk-or-v1-a…7890',
  maskApiKey('sk-or-v1-abcdef1234567890'),
);
check('short values are fully hidden', maskApiKey('abc123') === '•••');
check('an empty key masks to nothing', maskApiKey('') === '');

/* --- Settings -> AI engine ----------------------------------------------- */
const renderSettings = (): string => decode(renderToStaticMarkup(React.createElement(SettingsPage, {})));

// The page renders the panel from the store. zustand's *server* snapshot is the
// state captured when the store was created, so the mounted page always renders
// the boot state; the live branch is therefore exercised on the panel directly,
// where every field is an explicit prop.
const booted = renderSettings();
check('settings has an AI engine section', booted.includes('AI engine'));
check('settings exposes the key field', booted.includes('id="settings-ai-key"'));
check('settings offers saving the key', booted.includes('Save key'));
check('settings explains the device-scoped storage', booted.includes('stored in this browser'));
check('settings points at where a free key comes from', booted.includes('openrouter.ai/keys'));

const noop = (): void => undefined;
const renderPanel = (props: Partial<AiKeyPanelProps>): string =>
  decode(
    renderToStaticMarkup(
      React.createElement(AiKeyPanel, {
        storedKey: '',
        apiKey: '',
        source: 'none',
        isConfigured: false,
        onSave: noop,
        onClear: noop,
        ...props,
      } as AiKeyPanelProps),
    ),
  );

const demoPanel = renderPanel({});
check('panel reports demo data when no key is set', demoPanel.includes('Demo data'));
check('demo panel nudges towards openrouter.ai/keys', demoPanel.includes('openrouter.ai/keys'));
check('demo panel hides the key line and Forget', !demoPanel.includes('Active key') && !demoPanel.includes('Forget'));

const livePanel = renderPanel({
  storedKey: 'sk-or-v1-abcdef1234567890',
  apiKey: 'sk-or-v1-abcdef1234567890',
  source: 'device',
  isConfigured: true,
});
check('panel reports live AI once a key is set', livePanel.includes('Live AI'));
check('panel says the key is saved on this device', livePanel.includes('saved on this device'));
check(
  'panel shows only the masked key',
  livePanel.includes('sk-or-v1-a…7890') && !livePanel.includes('sk-or-v1-abcdef1234567890'),
);
check('panel offers forgetting the key', livePanel.includes('Forget'));

const envPanel = renderPanel({ apiKey: 'sk-or-v1-abcdef1234567890', source: 'env', isConfigured: true });
check(
  'panel attributes a .env key to .env',
  envPanel.includes('loaded from .env') && !envPanel.includes('saved on this device'),
);

/* --- the CLI helpers (temp dir, the real .env is untouched) -------------- */
const scriptPath = resolve('scripts/env-key.mjs');
const checkPath = resolve('scripts/check-env.mjs');
const tmp = mkdtempSync(join(tmpdir(), 'jurisflow-env-'));
copyFileSync('.env.example', join(tmp, '.env.example'));

const run = (script: string, args: string[]): string =>
  execFileSync(process.execPath, [script, ...args], { cwd: tmp, encoding: 'utf8' });
const tmpEnv = (): string => readFileSync(join(tmp, '.env'), 'utf8');

const first = run(scriptPath, ['sk-or-v1-abcdefghijklmnop']);
check('env:key creates .env from the template', existsSync(join(tmp, '.env')));
check('env:key writes the key line', tmpEnv().includes('VITE_OPENROUTER_API_KEY=sk-or-v1-abcdefghijklmnop'));
// Read the expected value from the template instead of pinning a literal, so
// tuning the budget does not break this preservation check.
const templateTotal = readFileSync('.env.example', 'utf8').match(/^VITE_OPENROUTER_TOTAL_TIMEOUT_MS=(.+)$/m)?.[1]?.trim() ?? '';
check(
  'env:key preserves the other variables',
  templateTotal !== '' && tmpEnv().includes(`VITE_OPENROUTER_TOTAL_TIMEOUT_MS=${templateTotal}`),
);
check('env:key keeps the template comments', tmpEnv().includes('OpenRouter key at https://openrouter.ai/keys'));
check(
  'env:key masks the key in its own output',
  !first.includes('sk-or-v1-abcdefghijklmnop') && first.includes('...'),
  first.trim().split('\n')[0],
);

run(scriptPath, ['sk-or-v1-zzzzzzzzzzzzzzzz']);
check('env:key rotates an existing key', tmpEnv().includes('VITE_OPENROUTER_API_KEY=sk-or-v1-zzzzzzzzzzzzzzzz'));
check('env:key replaces instead of appending', (tmpEnv().match(/^VITE_OPENROUTER_API_KEY=/gm) ?? []).length === 1);

const shown = run(scriptPath, ['--show']);
check('env:key --show masks the value', shown.includes('sk-or-v1-z') && !shown.includes('sk-or-v1-zzzzzzzzzzzzzzzz'), shown.trim());

const confirmed = run(checkPath, []);
check('env:check confirms a loaded key', confirmed.includes('live AI calls enabled'), confirmed.trim().split('\n')[0]);
check('env:check never prints the full key', !confirmed.includes('sk-or-v1-zzzzzzzzzzzzzzzz'));

run(scriptPath, ['--clear']);
check('env:key --clear empties the line', /^VITE_OPENROUTER_API_KEY=$/m.test(tmpEnv()));

const warned = run(checkPath, []);
check('env:check warns instead of failing when unconfigured', warned.includes('No OpenRouter API key') && warned.includes('env:key'));
check('env:check points at the in-app fallback', warned.includes('Settings -> AI engine'));
check(
  'env:check --strict is opt-in',
  (() => {
    try {
      execFileSync(process.execPath, [checkPath, '--strict'], { cwd: tmp, encoding: 'utf8' });
      return false;
    } catch {
      return true;
    }
  })(),
);

rmSync(tmp, { recursive: true, force: true });

/* --- wiring + docs -------------------------------------------------------- */
const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as { scripts: Record<string, string> };
check('npm run env:key exists', !!pkg.scripts['env:key']);
check('npm run env:check exists', !!pkg.scripts['env:check']);
check('dev warns before starting', (pkg.scripts.predev ?? '').includes('check-env'));
check('build warns before bundling', (pkg.scripts.prebuild ?? '').includes('check-env'));
check('this suite is wired into npm test', (pkg.scripts.test ?? '').includes('test:ai-key'));

const gitignore = readFileSync('.gitignore', 'utf8');
check('.env stays git-ignored (a key never reaches the repo)', /^\.env$/m.test(gitignore));

const envExample = readFileSync('.env.example', 'utf8');
check(
  '.env.example documents both ways to set the key',
  envExample.includes('Settings') && envExample.includes('env:key'),
);

console.log(failed === 0 ? 'ALL AI KEY CHECKS PASSED' : `${failed} AI KEY CHECK(S) FAILED`);
if (failed > 0) process.exitCode = 1;
