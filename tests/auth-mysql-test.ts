/*
 * MySQL-backed registration test — the real API in `server/`.
 *
 *   node node_modules/esbuild/bin/esbuild tests/auth-mysql-test.ts --bundle --format=esm --platform=node --external:mysql2 --outfile=.smoke/auth-mysql.mjs
 *   node .smoke/auth-mysql.mjs
 *
 * It proves the thing that was asked for: registering in the app writes a row to
 * the local MySQL server. The checks run against a throwaway `jurisflow_test`
 * database that is created and dropped by this test, so the real `jurisflow`
 * accounts are never touched.
 *
 * Skips cleanly (exit 0) when MySQL is not reachable, so `npm test` still passes
 * on a machine without a database running.
 */
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { createConnection } from 'mysql2/promise';
import { passwordPolicyError as clientPolicy } from '../src/utils/passwordPolicy';
import { passwordPolicyError as serverPolicy } from '../server/passwords.mjs';
import { Socket } from 'node:net';

declare const process: {
  env: Record<string, string | undefined>;
  argv: string[];
  execPath: string;
  exitCode?: number;
  exit(code?: number): void;
};

let failures = 0;

function check(name: string, condition: boolean, extra?: unknown): void {
  if (condition) {
    console.log(`PASS - ${name}`);
  } else {
    failures += 1;
    console.error(`FAIL - ${name}`, extra ?? '');
  }
}

/* --- configuration: the same .env the API and Vite read ------------------- */
const envText = existsSync('.env') ? readFileSync('.env', 'utf8') : '';
const envValue = (name: string, fallback: string): string =>
  (envText.match(new RegExp(`^${name}=(.*)$`, 'm'))?.[1] ?? '').trim() || fallback;

const DB_HOST = envValue('DB_HOST', '127.0.0.1');
const DB_PORT = Number(envValue('DB_PORT', '3306'));
const DB_USER = envValue('DB_USER', 'root');
const DB_PASSWORD = envText.match(/^DB_PASSWORD=(.*)$/m)?.[1]?.trim() ?? '';
const TEST_DB = 'jurisflow_test';
const PORT = 4399;
const base = `http://127.0.0.1:${PORT}`;

// Deliberately no `database`: this connection is created BEFORE the throwaway
// database exists, so queries below qualify the table name instead.
const dbOptions = {
  host: DB_HOST,
  port: DB_PORT,
  user: DB_USER,
  password: DB_PASSWORD,
};

/** Fast "is MySQL up?" probe — 500ms, no dependency on mysql2. */
function reachable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const socket = new Socket();
    const finish = (value: boolean) => {
      socket.destroy();
      resolve(value);
    };
    socket.setTimeout(500);
    socket.once('connect', () => finish(true));
    socket.once('timeout', () => finish(false));
    socket.once('error', () => finish(false));
    socket.connect(port, DB_HOST);
  });
}

/** POST helper that returns the status and the parsed JSON body. */
async function post(path: string, body: unknown, token?: string) {
  const response = await fetch(`${base}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  return { status: response.status, body: (await response.json()) as Record<string, any> };
}

async function get(path: string, token?: string) {
  const response = await fetch(`${base}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  return { status: response.status, body: (await response.json()) as Record<string, any> };
}

/** Polls /api/health until the API answers, so the test never races startup. */
async function waitForApi(timeoutMs = 20000): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${base}/api/health`);
      if (response.ok) return true;
    } catch {
      /* not listening yet */
    }
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  return false;
}

if (!(await reachable(DB_PORT))) {
  console.log(`SKIP - MySQL is not reachable at ${DB_HOST}:${DB_PORT}`);
  console.log('      start it (XAMPP Control Panel -> MySQL) and re-run: npm run test:auth:mysql');
  process.exit(0);
}

console.log(`[test] MySQL reachable at ${DB_HOST}:${DB_PORT} - using throwaway database ${TEST_DB}`);

/* --- a fresh database: schema + the single seeded admin account ------------ */
const setup = spawnSync(
  process.execPath,
  ['--env-file-if-exists=.env', 'server/setup.mjs', '--reset'],
  { env: { ...process.env, DB_NAME: TEST_DB }, encoding: 'utf8' },
);
check('db:setup creates the schema in a fresh database', setup.status === 0, setup.stderr?.trim());
check('db:setup provisions the administrator account', (setup.stdout ?? '').includes('provisioned 1 account'));
if (setup.status !== 0) {
  console.error('[test] db:setup output:');
  console.error(`${setup.stdout ?? ''}${setup.stderr ?? ''}`);
}

/* --- the API under test --------------------------------------------------- */
const api = spawn(
  process.execPath,
  ['--env-file-if-exists=.env', 'server/index.mjs'],
  { env: { ...process.env, DB_NAME: TEST_DB, API_PORT: String(PORT) }, stdio: ['ignore', 'pipe', 'pipe'] },
);

let apiLog = '';
api.stdout.on('data', chunk => { apiLog += chunk.toString(); });
api.stderr.on('data', chunk => { apiLog += chunk.toString(); });

const db = await createConnection(dbOptions);

try {
  const ready = await waitForApi();
  check('the API starts and answers /api/health', ready, apiLog.trim());

  if (ready) {
    const health0 = await get('/api/health');
    check('health reports MySQL as ok', health0.status === 200 && health0.body.ok === true, health0.body);
    check('health counts the seeded accounts', health0.body.users === 6, health0.body.users);

    /* --- registration -> the row that lands in MySQL ---------------------- */
    const email = `test.client.${Date.now()}@email.com`;
    const password = 'Str0ng!Pass';
    const created = await post('/api/auth/register', {
      name: 'Test Client',
      email,
      phone: '(555) 700-1234',
      password,
    });

    check('register returns 201', created.status === 201, created.status);
    check('register returns the new account', created.body.user?.email === email, created.body);
    check('register assigns the client role', created.body.user?.role === 'user', created.body.user?.role);
    check('register never returns a password', !('password' in (created.body.user ?? {})), Object.keys(created.body.user ?? {}));
    check('register keeps the phone', created.body.user?.phone === '(555) 700-1234', created.body.user?.phone);
    check(
      'register issues a signed 3-part token',
      typeof created.body.token === 'string' && created.body.token.split('.').length === 3,
      created.body.token,
    );

    const health1 = await get('/api/health');
    check('MySQL now counts one more account', health1.body.users === 7, health1.body.users);

    // The core assertion: the account really is a row in the database.
    const [rows] = await db.query(
      `SELECT id, name, email, phone, role, password_hash, created_at
         FROM \`${TEST_DB}\`.users WHERE email = ?`,
      [email],
    );
    const row = (rows as any[])[0];
    check('the account row exists in MySQL', !!row, email);
    check('MySQL stores the client role', row?.role === 'user', row?.role);
    check('MySQL stores the phone', row?.phone === '(555) 700-1234', row?.phone);
    check('MySQL stores a real created_at', row?.created_at instanceof Date, row?.created_at);
    check(
      'the password is stored hashed, never in clear text',
      typeof row?.password_hash === 'string' &&
        row.password_hash.startsWith('scrypt$') &&
        !row.password_hash.includes(password),
      String(row?.password_hash).slice(0, 18),
    );

    /* --- rejections: nothing extra may reach the table -------------------- */
    const duplicate = await post('/api/auth/register', { name: 'Someone Else', email, password });
    check('a duplicate email is rejected with 409', duplicate.status === 409, duplicate.status);
    check(
      'the duplicate message is the friendly one',
      duplicate.body.error === 'An account with this email already exists',
      duplicate.body.error,
    );
    check('a rejected registration adds no row', (await get('/api/health')).body.users === 2);

    const noSymbol = await post('/api/auth/register', {
      name: 'No Symbol',
      email: `nosymbol.${Date.now()}@email.com`,
      password: 'password123',
    });
    check('a password without a symbol is rejected with 400', noSymbol.status === 400, noSymbol.status);
    check(
      'the rejection names the missing special character',
      noSymbol.body.error === 'Include a special character (!@#$%).',
      noSymbol.body.error,
    );

    const shortPw = await post('/api/auth/register', {
      name: 'Too Short',
      email: `short.${Date.now()}@email.com`,
      password: 'Ab1!',
    });
    check('a short password is rejected with 400', shortPw.status === 400, shortPw.status);
    check('the short-password message names the length rule', shortPw.body.error === 'Use at least 8 characters.', shortPw.body.error);

    const noName = await post('/api/auth/register', {
      email: `noname.${Date.now()}@email.com`,
      password: 'Str0ng!Pass',
    });
    check('a missing name is rejected with 400', noName.status === 400, noName.status);

    const badEmail = await post('/api/auth/register', {
      name: 'Bad Email',
      email: 'not-an-email',
      password: 'Str0ng!Pass',
    });
    check('an invalid email is rejected with 400', badEmail.status === 400, badEmail.status);

    const escalated = await post('/api/auth/register', {
      name: 'Sneaky Admin',
      email: `escalate.${Date.now()}@email.com`,
      password: 'Str0ng!Pass',
      role: 'system_admin',
    });
    check(
      'a client cannot self-provision a staff role',
      escalated.body.user?.role === 'user',
      escalated.body.user?.role,
    );

    /* --- login ------------------------------------------------------------ */
    const login = await post('/api/auth/login', { email, password });
    check('login accepts the account just created', login.status === 200 && login.body.user?.email === email, login.status);

    const wrong = await post('/api/auth/login', { email, password: 'Wr0ng!Pass' });
    check('a wrong password is rejected with 401', wrong.status === 401, wrong.status);
    check('the 401 message matches the mock', wrong.body.error === 'Invalid credentials', wrong.body.error);

    const cased = await post('/api/auth/login', { email: email.toUpperCase(), password });
    check('login tolerates email casing', cased.status === 200, cased.status);

    const demo = await post('/api/auth/login', { email: 'admin@firm.com', password: 'password123' });
    check(
      'the seeded demo login still works from MySQL',
      demo.status === 200 && demo.body.user?.role === 'system_admin',
      demo.status,
    );

    /* --- tokens ----------------------------------------------------------- */
    const me = await get('/api/auth/me', created.body.token);
    check('/api/auth/me resolves the bearer token', me.status === 200 && me.body.email === email, me.status);
    check('/api/auth/me without a token is 401', (await get('/api/auth/me')).status === 401);
    const forged = await get('/api/auth/me', `${String(created.body.token).split('.').slice(0, 2).join('.')}.forged`);
    check('a forged token signature is rejected', forged.status === 401, forged.status);
    const logout = await post('/api/auth/logout', {});
    check('logout succeeds', logout.status === 200 && logout.body.success === true, logout.status);

    /* --- the client policy and the server policy must agree --------------- */
    const samples = ['short', 'password123', 'Password1!', 'abcdefgh', '12345678!', 'Str0ng!Pass', 'Aa1!aaaa'];
    const mismatches = samples.filter(value => clientPolicy(value) !== serverPolicy(value));
    check('client and server password policy agree', mismatches.length === 0, mismatches.join(' | '));
    check('a strong password passes both policies', clientPolicy('Str0ng!Pass') === undefined && serverPolicy('Str0ng!Pass') === undefined);
  }
} finally {
  // Stop the API before dropping the database it is pooled into, so the test is
  // repeatable and leaves nothing behind.
  api.kill();
  await new Promise(resolve => setTimeout(resolve, 300));
  await db.query(`DROP DATABASE IF EXISTS \`${TEST_DB}\``).catch(() => {});
  await db.end().catch(() => {});
}

console.log('');
console.log(failures === 0 ? 'ALL MYSQL AUTH CHECKS PASSED' : `${failures} CHECK(S) FAILED`);
console.log(`[test] ${TEST_DB} was created and dropped - the real jurisflow accounts were not touched`);
if (failures > 0) process.exitCode = 1;
