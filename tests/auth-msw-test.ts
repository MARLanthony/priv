/*
 * End-to-end test of the real MSW auth handlers (no browser needed) using msw/node.
 *
 *   node node_modules/esbuild/bin/esbuild tests/auth-msw-test.ts --bundle --format=esm --platform=node --outfile=.smoke/auth-msw.mjs
 *   node .smoke/auth-msw.mjs
 */
import { setupServer } from 'msw/node';
import { authHandlers, setCurrentUser } from '../src/mocks/handlers/auth';
import { caseHandlers } from '../src/mocks/handlers/cases';
import { settingsHandlers } from '../src/mocks/handlers/settings';
import { users } from '../src/mocks/data';

const ORIGIN = 'http://localhost';

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

/*
 * The app registers handlers with relative paths ("/api/..."), which MSW resolves
 * against the browser origin. In Node there is no origin, so rebase each handler
 * onto the test origin — the resolvers (and therefore the real validation logic)
 * are untouched.
 */
const handlers = (authHandlers as unknown as { info: { path: string } }[]).map(handler => {
  if (handler.info.path.startsWith('/')) {
    handler.info.path = `${ORIGIN}${handler.info.path}`;
  }
  return handler;
});

const server = setupServer(...(handlers as unknown as typeof authHandlers));
server.listen({ onUnhandledRequest: 'error' });

const post = (path: string, body: unknown) =>
  fetch(`${ORIGIN}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

const userCountBefore = users.length;

// 1. Happy path
const created = await post('/api/auth/register', {
  name: 'Test Client',
  email: 'NewClient@Email.com',
  password: 'Secure123!',
  phone: '(555) 000-1234',
});
const createdBody = (await created.json()) as { user?: Record<string, unknown>; token?: string; error?: string };

check('register returns 201', created.status === 201, String(created.status));
check('register returns a user + token', !!createdBody.user && !!createdBody.token, JSON.stringify(createdBody).slice(0, 120));
check('register lowercases the email', createdBody.user?.email === 'newclient@email.com', String(createdBody.user?.email));
check('register assigns the client role', createdBody.user?.role === 'user', String(createdBody.user?.role));
check('register stores the trimmed phone', createdBody.user?.phone === '(555) 000-1234', String(createdBody.user?.phone));
check('register never returns the password', !('password' in (createdBody.user ?? {})), Object.keys(createdBody.user ?? {}).join(','));
check('register adds the user to the mock store', users.length === userCountBefore + 1, `${userCountBefore} -> ${users.length}`);

// 2. The new account can immediately sign in
const login = await post('/api/auth/login', { email: 'newclient@email.com', password: 'Secure123!' });
const loginBody = (await login.json()) as { user?: { email?: string }; token?: string; error?: string };
check('new client can sign in', login.status === 200 && loginBody.user?.email === 'newclient@email.com', String(login.status));

// 3. Login is now case-insensitive
const mixedCase = await post('/api/auth/login', { email: 'NEWCLIENT@EMAIL.COM', password: 'Secure123!' });
check('login tolerates email casing', mixedCase.status === 200, String(mixedCase.status));

// 4. Validation + conflict rules
const duplicate = await post('/api/auth/register', { name: 'Other', email: 'newclient@email.com', password: 'Secure123!' });
const duplicateBody = (await duplicate.json()) as { error?: string };
check('duplicate email rejected with 409', duplicate.status === 409, String(duplicate.status));
check('duplicate email message is friendly', duplicateBody.error === 'An account with this email already exists', String(duplicateBody.error));

const shortPassword = await post('/api/auth/register', { name: 'Short', email: 'short@email.com', password: 'abc' });
check('short password rejected with 400', shortPassword.status === 400, String(shortPassword.status));

// The policy needs a number AND a special character, not just 8 characters.
const noSymbol = await post('/api/auth/register', { name: 'NoSymbol', email: 'nosymbol@email.com', password: 'Secure123' });
const noSymbolBody = (await noSymbol.json()) as { error?: string };
check('password with no special character rejected with 400', noSymbol.status === 400, String(noSymbol.status));
check('the rejection names the missing special character', (noSymbolBody.error ?? '').includes('special character'), String(noSymbolBody.error));

const noNumber = await post('/api/auth/register', { name: 'NoNumber', email: 'nonumber@email.com', password: 'Secured!!' });
check('password with no number rejected with 400', noNumber.status === 400, String(noNumber.status));

const badEmail = await post('/api/auth/register', { name: 'Bad', email: 'not-an-email', password: 'Secure123!' });
check('invalid email rejected with 400', badEmail.status === 400, String(badEmail.status));

const missingName = await post('/api/auth/register', { email: 'noname@email.com', password: 'Secure123!' });
check('missing name rejected with 400', missingName.status === 400, String(missingName.status));

const badLogin = await post('/api/auth/login', { email: 'newclient@email.com', password: 'nope' });
check('wrong password still 401', badLogin.status === 401, String(badLogin.status));

// 5. Nothing invalid leaked into the store
check('rejected registrations add no users', users.length === userCountBefore + 1, `${users.length}`);

server.close();

/* ---------------------------------------------------------------------------
 * VITE_AUTH_BACKEND=mysql: the mock auth handlers are NOT registered, so the
 * module-level session is never assigned. Every filtered route must still know
 * who is asking, which is why getCurrentUser() falls back to the session the app
 * persisted (the same source checkAuth() uses on reload).
 * ------------------------------------------------------------------------- */
const storage = new Map<string, string>();
(globalThis as { localStorage?: unknown }).localStorage = {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => void storage.set(key, String(value)),
  removeItem: (key: string) => void storage.delete(key),
  clear: () => storage.clear(),
};

const dataHandlers = [...caseHandlers, ...settingsHandlers] as unknown as { info: { path: string } }[];
dataHandlers.forEach(handler => {
  if (handler.info.path.startsWith('/')) handler.info.path = `${ORIGIN}${handler.info.path}`;
});
const dataServer = setupServer(...(dataHandlers as unknown as typeof caseHandlers));
dataServer.listen({ onUnhandledRequest: 'error' });

// The mock login/register handlers above did sign a user in, which sets the
// module-level session. Clear it so these checks exercise the fallback only.
setCurrentUser(null);

const jsonAt = async (path: string) => fetch(`${ORIGIN}${path}`).then(response => response.json());
const put = (path: string, body: unknown) =>
  fetch(`${ORIGIN}${path}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

storage.clear();
check('no session at all -> 401', (await fetch(`${ORIGIN}/api/cases`)).status === 401);

/*
 * The dataset ships EMPTY except for the administrator (src/mocks/data.ts), so
 * every check below first creates what it needs — through the real POST handler,
 * exactly as the admin would after signing in.
 */
storage.set('user', JSON.stringify({ id: 1, name: 'Admin User', role: 'system_admin' }));
check('a fresh install has no cases yet', ((await jsonAt('/api/cases')) as unknown[]).length === 0);

const opened = await post('/api/cases', {
  title: 'Fresh Intake',
  caseNumber: '2026-CV-00001',
  type: 'Contract Dispute',
  status: 'pending',
  priority: 'medium',
  assignedToId: 2,
  assignedToName: 'Attorney Two',
  clientId: 5,
  clientName: 'Client Five',
});
const openedCase = (await opened.json()) as { caseNumber?: string };
check(
  'the admin can open the first case',
  opened.status === 201 && openedCase.caseNumber === '2026-CV-00001',
  String(opened.status),
);

storage.set('user', JSON.stringify({ id: 2, name: 'Attorney Two', role: 'attorney' }));
const attorneyCases = (await jsonAt('/api/cases')) as { assignedToId: number }[];
check('an attorney session from localStorage is honoured', attorneyCases.length === 1, String(attorneyCases.length));
check(
  'attorney sees only their own cases',
  attorneyCases.every(item => item.assignedToId === 2),
  JSON.stringify(attorneyCases.map(item => item.assignedToId)),
);

storage.set('user', JSON.stringify({ id: 5, name: 'Client Five', role: 'user' }));
const clientCases = (await jsonAt('/api/cases')) as { clientId: number }[];
check(
  'client sees only their own cases',
  clientCases.length === 1 && clientCases.every(item => item.clientId === 5),
  JSON.stringify(clientCases.map(item => item.clientId)),
);

storage.set('user', JSON.stringify({ id: 6, name: 'Brand New Client', role: 'user' }));
check('another client sees nothing', ((await jsonAt('/api/cases')) as unknown[]).length === 0);

storage.set('user', JSON.stringify({ id: 3, name: 'Some Other Attorney', role: 'attorney' }));
check('another attorney sees nothing', ((await jsonAt('/api/cases')) as unknown[]).length === 0);

storage.set('user', JSON.stringify({ id: 1, name: 'Admin User', role: 'system_admin' }));
const adminCases = (await jsonAt('/api/cases')) as unknown[];
check('admin still sees every case', adminCases.length === 1, String(adminCases.length));

/*
 * Password change. A persisted session carries no password (it is the shape
 * authStore writes), so the mock cannot verify one and says where it lives.
 * A session set through the mock login handler (setCurrentUser, with the
 * password) is verified for real.
 */
storage.set('user', JSON.stringify({ id: 1, name: 'Admin User', role: 'system_admin' }));
const noPasswordSession = await put('/api/users/password', {
  currentPassword: 'whatever',
  newPassword: 'Str0ng!Pass',
});
const noPasswordBody = (await noPasswordSession.json()) as { error?: string };
check(
  'a session without a password points at the account server',
  noPasswordSession.status === 400 && String(noPasswordBody.error).includes('account server'),
  `${noPasswordSession.status} ${String(noPasswordBody.error)}`,
);

storage.set('user', JSON.stringify({ id: 2, name: 'Attorney Two', role: 'attorney' }));
setCurrentUser({ id: 2, name: 'Attorney Two', role: 'attorney', password: 'password123' });

const wrongCurrent = await put('/api/users/password', {
  currentPassword: 'not-the-password',
  newPassword: 'Str0ng!Pass',
});
check('mock session: a wrong current password is rejected', wrongCurrent.status === 400, String(wrongCurrent.status));

const changed = await put('/api/users/password', {
  currentPassword: 'password123',
  newPassword: 'Str0ng!Pass',
});
check('mock session: the password can be changed', changed.status === 200, String(changed.status));

setCurrentUser(null);

storage.set('user', 'not-json-at-all');
check('a corrupt persisted session is ignored', (await fetch(`${ORIGIN}/api/cases`)).status === 401);

dataServer.close();

console.log(failed === 0 ? 'ALL MSW AUTH CHECKS PASSED' : `${failed} MSW AUTH CHECK(S) FAILED`);
if (failed > 0) process.exitCode = 1;