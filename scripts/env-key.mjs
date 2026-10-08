/*
 * Safely sets (or updates) VITE_OPENROUTER_API_KEY in .env.
 *
 *   npm run env:key -- sk-or-v1-xxxxxxxx   set / rotate the key
 *   npm run env:key -- --show              print the masked key on file
 *   npm run env:key -- --clear             empty the line (demo mode)
 *
 * Only that single line is touched: every other variable and comment in .env is
 * preserved, and the file is created from .env.example when it is missing.
 *
 * The key is never echoed in full.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const KEY_NAME = 'VITE_OPENROUTER_API_KEY';
const ENV_FILE = '.env';
const TEMPLATE = '.env.example';

const mask = (key) => (key ? `${key.slice(0, 10)}...${key.slice(-4)}` : '(empty)');
const linePattern = new RegExp(`^${KEY_NAME}=.*$`, 'm');

const template = existsSync(TEMPLATE) ? readFileSync(TEMPLATE, 'utf8') : `${KEY_NAME}=\n`;
const current = existsSync(ENV_FILE) ? readFileSync(ENV_FILE, 'utf8') : template;
const arg = (process.argv[2] ?? '').trim();

if (!arg || arg === '--help' || arg === '-h') {
  console.log('Usage: npm run env:key -- sk-or-v1-xxxxxxxx');
  console.log('       npm run env:key -- --show');
  console.log('       npm run env:key -- --clear');
  process.exit(arg ? 0 : 1);
}

if (arg === '--show') {
  const match = current.match(linePattern);
  console.log(`${KEY_NAME}=${mask((match?.[0] ?? '').split('=').slice(1).join('=').trim())}`);
  process.exit(0);
}

const nextKey = arg === '--clear' ? '' : arg;
const line = `${KEY_NAME}=${nextKey}`;
const updated = linePattern.test(current)
  ? current.replace(linePattern, line)
  : `${current.trimEnd()}\n${line}\n`;

writeFileSync(ENV_FILE, updated, 'utf8');
console.log(`[env] ${KEY_NAME} = ${mask(nextKey)}  ->  ${ENV_FILE}`);
console.log('[env] Restart `npm run dev` so Vite loads the new value.');
