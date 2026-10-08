/*
 * Reports which OpenRouter key the app will use — the key itself is masked — and
 * where accounts will be stored (the mock, or your local MySQL).
 *
 * Wired to `npm run dev` / `npm run build` (via the predev/prebuild hooks) so a
 * missing key, a stopped MySQL server or a leftover `VITE_AUTH_BACKEND=mock` is
 * noticed immediately instead of silently falling back to bundled demo data.
 *
 *   node scripts/check-env.mjs            warn only (default)
 *   node scripts/check-env.mjs --strict   exit 1 when no key is configured
 */
import { existsSync, readFileSync } from 'node:fs';
import { Socket } from 'node:net';

const KEY_NAME = 'VITE_OPENROUTER_API_KEY';
const ENV_FILE = '.env';
const SOURCE = 'src/ai/config/openrouter.ts';

const mask = (key) => (key ? `${key.slice(0, 10)}...${key.slice(-4)}` : '(empty)');

const fileKey = (() => {
  if (!existsSync(ENV_FILE)) return '';
  const match = readFileSync(ENV_FILE, 'utf8').match(new RegExp(`^${KEY_NAME}=(.*)$`, 'm'));
  return (match?.[1] ?? '').trim();
})();

if (fileKey) {
  console.log(`[env] ${KEY_NAME} = ${mask(fileKey)}  (live AI calls enabled)`);
} else {
  console.log('');
  console.log('  ! No OpenRouter API key found - AI features will use the demo data.');
  console.log(`    .env is ${existsSync(ENV_FILE) ? 'present but the key line is empty' : 'missing'}.`);
  console.log('    Fix it one of two ways:');
  console.log('      1. file:     npm run env:key -- sk-or-v1-xxxxxxxx');
  console.log('      2. in app:   Settings -> AI engine  (stored on this device, survives a lost .env)');
  console.log('    Free key: https://openrouter.ai/keys');
  console.log('');
  if (process.argv.includes('--strict')) process.exitCode = 1;
}

// The device override in Settings can supply a key even when .env cannot.
if (!fileKey && existsSync(SOURCE) && !readFileSync(SOURCE, 'utf8').includes('readStoredApiKey')) {
  console.log('  ! The device override is missing from the AI config - the app would ignore a key pasted in Settings.');
}

/* -------------------------------------------------------------------------- *
 * Where accounts live (VITE_AUTH_BACKEND).
 *
 * Reported because a mismatch is silent: the app looks fine either way, but with
 * the mock backend a registration is never written to your database.
 * -------------------------------------------------------------------------- */
const envValue = name =>
  (existsSync(ENV_FILE) ? readFileSync(ENV_FILE, 'utf8').match(new RegExp(`^${name}=(.*)$`, 'm'))?.[1] : '')?.trim() ?? '';

const tcpReachable = (host, port, timeout = 500) =>
  new Promise(resolve => {
    const socket = new Socket();
    const finish = value => {
      socket.destroy();
      resolve(value);
    };
    socket.setTimeout(timeout);
    socket.once('connect', () => finish(true));
    socket.once('timeout', () => finish(false));
    socket.once('error', () => finish(false));
    socket.connect(port, host);
  });

const backend = envValue('VITE_AUTH_BACKEND') || 'mock';

if (backend === 'mysql') {
  const host = envValue('DB_HOST') || '127.0.0.1';
  const port = Number(envValue('DB_PORT') || 3306);
  const database = envValue('DB_NAME') || 'jurisflow';
  const apiPort = envValue('API_PORT') || '4001';
  const up = await tcpReachable(host, port);
  console.log(
    `[auth] backend=mysql -> API on :${apiPort} -> MySQL ${host}:${port}/${database} ${up ? '[reachable]' : '[NOT reachable]'}`,
  );
  if (!up) {
    console.log('  ! MySQL is not running - start it (XAMPP Control Panel) and run: npm run db:setup');
  }
} else {
  console.log('[auth] backend=mock - registrations use the bundled demo data and are not persisted');
  console.log('  to save accounts in MySQL: set VITE_AUTH_BACKEND=mysql, then npm run db:setup + npm run api');
}
