/*
 * Auth flow test: SSR-renders the sign in / sign up pages and exercises the real
 * register + login store logic against a stubbed MSW-style API.
 *
 *   node node_modules/esbuild/bin/esbuild tests/auth-test.tsx --bundle --format=cjs --platform=node --jsx=automatic --outfile=.smoke/auth.cjs
 *   node .smoke/auth.cjs
 */
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { LoginPage } from '../src/pages/LoginPage';
import { SignUpPage, passwordStrength, validateSignUpForm } from '../src/pages/SignUpPage';
import { PASSWORD_RULES, isPasswordReady } from '../src/utils/passwordPolicy';
import { useAuthStore } from '../src/stores/authStore';

/**
 * Minimal Node globals used by this test script.
 * The project intentionally has no `@types/node`, so only what is needed is declared.
 */
declare const process: { exitCode?: number };

let failed = 0;
const check = (name: string, ok: boolean, extra = ''): void => {
  console.log(`${ok ? 'PASS' : 'FAIL'} - ${name}${extra ? ` :: ${extra}` : ''}`);
  if (!ok) failed += 1;
};

/** React escapes entities in static markup; decode before text assertions. */
const decode = (html: string): string =>
  html
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');

const renderAt = (path: string, element: React.ReactElement): string =>
  decode(
    renderToStaticMarkup(
      React.createElement(MemoryRouter, { initialEntries: [path] }, element),
    ),
  );

// --- localStorage shim so the store works outside the browser ----------------
const store = new Map<string, string>();
(globalThis as { localStorage?: unknown }).localStorage = {
  getItem: (key: string) => store.get(key) ?? null,
  setItem: (key: string, value: string) => void store.set(key, String(value)),
  removeItem: (key: string) => void store.delete(key),
  clear: () => store.clear(),
};

const loginHtml = renderAt('/login', React.createElement(LoginPage));
const signupHtml = renderAt('/signup', React.createElement(SignUpPage));

// --- Sign in page ------------------------------------------------------------
check('login: has email + password fields', loginHtml.includes('id="login-email"') && loginHtml.includes('id="login-password"'));
check('login: professional heading', loginHtml.includes('Sign in to JurisFlow'));
check('login: badge rendered', loginHtml.includes('Secure client & firm access'));
check('login: subtitle rendered', loginHtml.includes('Access your cases, documents and AI-assisted consultations.'));
check('login: submit button', loginHtml.includes('Sign In'));
check('login: forgot password present', loginHtml.includes('Forgot password?'));
check('login: keep me signed in', loginHtml.includes('Keep me signed in on this device'));
check('login: links to /signup', loginHtml.includes('href="/signup"'), loginHtml.match(/href="\/[a-z]*"/g)?.join(',') ?? 'none');
check('login: signup CTA copy', loginHtml.includes('Create an account'));
check(
  'login: the administrator is the only demo account',
  (loginHtml.match(/Demo accounts/) ? 1 : 0) === 1 &&
    loginHtml.includes('admin@firm.com') &&
    !loginHtml.includes('clientB@email.com') &&
    !loginHtml.includes('john@firm.com'),
);
check('login: split card with a brand half', loginHtml.includes('auth-card') && loginHtml.includes('auth-brand') && loginHtml.includes('auth-form'));
check('login: brand half occupies the left column', loginHtml.includes('auth-brand p-7 sm:p-9 lg:p-10 lg:order-1'));
check('login: form half takes the right column', loginHtml.includes('auth-form lg:order-2'));
check('login: floating chrome (back button + theme switch)', loginHtml.includes('auth-chrome-btn') && loginHtml.includes('auth-theme-switch'));
check('login: theme switch offers all three themes', ['Normal theme', 'Dark theme', 'Light theme'].every(label => loginHtml.includes(`aria-label="${label}"`)));
check('login: brand half carries the trust signals', loginHtml.includes('Trusted by 200+ firms') && loginHtml.includes('Encrypted · Bar-compliant') && loginHtml.includes('AI-assisted intake'));
check('login: retired the floating compact dialog', !loginHtml.includes('auth-modal') && !loginHtml.includes('max-w-[26.5rem]'));
check('login: entrance animation (left)', loginHtml.includes('animate-auth-in-left'));
check('login: no right-animation class', !loginHtml.includes('animate-auth-in-right'));
check('login: the whole screen slides in from the left', loginHtml.includes('auth-page animate-auth-page-left'));
check('login: no right page-animation class', !loginHtml.includes('animate-auth-page-right'));

// --- Sign up page ------------------------------------------------------------
check('signup: all fields present', ['signup-name', 'signup-email', 'signup-phone', 'signup-password', 'signup-confirm'].every(id => signupHtml.includes(`id="${id}"`)));
check('signup: heading + badge', signupHtml.includes('Join JurisFlow') && signupHtml.includes('Create your client account'));
check('signup: terms checkbox', signupHtml.includes('terms of service'));
check('signup: strength meter initialised', signupHtml.includes('Too short'));
check('signup: create account button', signupHtml.includes('Create Account'));
check('signup: links to /login', signupHtml.includes('href="/login"'));
check('signup: staff provisioning note', signupHtml.includes('provisioned by your firm'));
check('signup: entrance animation (right)', signupHtml.includes('animate-auth-in-right'));
check('signup: no left-animation class', !signupHtml.includes('animate-auth-in-left'));
check('signup: the whole screen slides in from the right', signupHtml.includes('auth-page animate-auth-page-right'));
check('signup: no left page-animation class', !signupHtml.includes('animate-auth-page-left'));
check('signup: phone marked optional', signupHtml.includes('(optional)'));
check('signup: password policy = 8 chars, letter, number, symbol', PASSWORD_RULES.map(rule => rule.id).join(',') === 'length,letter,number,symbol');
check('signup: requirement checklist is rendered', ['At least 8 characters', 'One letter (a-z)', 'One number (0-9)', 'One special character'].every(label => signupHtml.includes(label)));
check('signup: password field is linked to the checklist for a11y', signupHtml.includes('id="signup-password-rules"') && signupHtml.includes('aria-describedby="signup-password-rules"'));
check('signup: unmet requirements start as unmet', !isPasswordReady('') && !isPasswordReady('Secure123') && isPasswordReady('Secure123!'));
check('signup: a space does not satisfy the special-character rule', isPasswordReady('Secure123 ') === false);
check('signup: split card with a brand half', signupHtml.includes('auth-card') && signupHtml.includes('auth-brand') && signupHtml.includes('auth-form'));
check('signup: brand half mirrors to the right column', signupHtml.includes('auth-brand p-7 sm:p-9 lg:p-10 lg:order-2'));
check('signup: form half takes the left column', signupHtml.includes('auth-form lg:order-1'));
check('signup: retired the floating compact dialog', !signupHtml.includes('auth-modal') && !signupHtml.includes('max-w-[26.5rem]'));
check('signup: email + phone share one field row', signupHtml.includes('grid sm:grid-cols-2 gap-3'));
check('signup: compact field rhythm', signupHtml.includes('space-y-4') && !signupHtml.includes('space-y-5') && !signupHtml.includes('px-4 py-3'));
check('signup: staff note moved below the card', (() => {
  const formClose = signupHtml.indexOf('</form>');
  const note = signupHtml.indexOf('provisioned by your firm');
  return formClose > 0 && note > formClose;
})());

// --- Pure validation + strength helpers -------------------------------------
const validForm = { name: 'Jane Cooper', email: 'jane@email.com', phone: '', password: 'Secure123!', confirm: 'Secure123!', accepted: true };
check('form validation accepts a good form', Object.keys(validateSignUpForm(validForm)).length === 0, JSON.stringify(validateSignUpForm(validForm)));
check('form validation requires a name', !!validateSignUpForm({ ...validForm, name: 'J' }).name);
check('form validation rejects bad email', !!validateSignUpForm({ ...validForm, email: 'nope' }).email);
check('form validation rejects short password', !!validateSignUpForm({ ...validForm, password: 'abc1', confirm: 'abc1' }).password);
check('form validation rejects letters-only password', !!validateSignUpForm({ ...validForm, password: 'abcdefghij', confirm: 'abcdefghij' }).password);
check('form validation rejects a password with letters + symbols but no number', !!validateSignUpForm({ ...validForm, password: 'Secured!abc', confirm: 'Secured!abc' }).password);
check('form validation rejects a password with letters + numbers but no symbol', !!validateSignUpForm({ ...validForm, password: 'Secure123', confirm: 'Secure123' }).password);
check('form validation accepts 8 chars + letter + number + symbol', Object.keys(validateSignUpForm(validForm)).length === 0, JSON.stringify(validateSignUpForm(validForm)));
check('form validation sends the specific reason to the UI', (() => {
  const message = validateSignUpForm({ ...validForm, password: 'Secure123', confirm: 'Secure123' }).password ?? '';
  return message.includes('special character');
})(), String(validateSignUpForm({ ...validForm, password: 'Secure123', confirm: 'Secure123' }).password));
check('form validation rejects mismatched confirm', !!validateSignUpForm({ ...validForm, confirm: 'Other123' }).confirm);
check('form validation requires terms', !!validateSignUpForm({ ...validForm, accepted: false }).accepted);
check('strength: weak for short', passwordStrength('abc').label === 'Too short');
check('strength: empty is neutral', passwordStrength('').label === 'Too short' && passwordStrength('').score === 0);
check('strength: 8 chars but simple is weak', passwordStrength('abcdefgh').label === 'Weak', passwordStrength('abcdefgh').label);
check('strength: strong for complex', passwordStrength('Str0ng!Passw0rd').label === 'Strong', passwordStrength('Str0ng!Passw0rd').label);
check('strength: score capped at 4', passwordStrength('Str0ng!Passw0rd').score === 4);
check('strength: bar colours never empty', [passwordStrength(''), passwordStrength('abc'), passwordStrength('abcdefgh'), passwordStrength('Str0ng!Passw0rd')].every(s => s.bar.length > 0 && s.text.length > 0));

// --- Store flows (register + login) against a stubbed API --------------------
const fetchCalls: { url: string; body: Record<string, string> }[] = [];
const realFetch = globalThis.fetch;

globalThis.fetch = (async (input: unknown, init?: { body?: unknown }) => {
  const url = typeof input === 'string' ? input : String((input as { url?: string })?.url ?? input);
  const body = init?.body ? (JSON.parse(String(init.body)) as Record<string, string>) : {};
  fetchCalls.push({ url, body });

  const json = (payload: unknown, status = 200) =>
    new Response(JSON.stringify(payload), { status, headers: { 'Content-Type': 'application/json' } });

  // What Vite's dev proxy returns when the API in `server/` is not running: a
  // 500 with an EMPTY body (no JSON at all).
  const emptyProxy = () => new Response('', { status: 500 });

  if (url === '/api/auth/register') {
    if (body.email === 'taken@email.com') {
      return json({ error: 'An account with this email already exists' }, 409);
    }
    // A refused connection: `fetch` itself rejects, nothing is ever received.
    if (body.email === 'offline@email.com') throw new TypeError('Failed to fetch');
    if (body.email === 'down@email.com') return emptyProxy();
    return json(
      {
        user: { id: 99, name: body.name, email: body.email, phone: body.phone, role: 'user', createdAt: '2026-01-01' },
        token: 'mock-jwt-token-99',
      },
      201,
    );
  }

  if (url === '/api/auth/login') {
    if (body.password === 'wrong') return json({ error: 'Invalid credentials' }, 401);
    if (body.email === 'down@firm.com') return emptyProxy();
    // 200 with no session in the payload.
    if (body.email === 'nosession@firm.com') return json({}, 200);
    return json({
      user: { id: 2, name: 'John Smith', email: body.email, role: 'attorney', createdAt: '2024-02-01' },
      token: 'mock-jwt-token-2',
    });
  }

  if (url === '/api/auth/logout') return json({ success: true });
  return realFetch(input as RequestInfo, init as RequestInit);
}) as unknown as typeof fetch;

async function testStoreFlows(): Promise<void> {
  // Successful registration
  await useAuthStore.getState().register({
    name: 'Jane Cooper',
    email: 'jane@email.com',
    password: 'Secure123',
    phone: '5551234567',
  });

  const afterRegister = useAuthStore.getState();
  const registerCall = fetchCalls.find(call => call.url === '/api/auth/register');

  check('register: posts to /api/auth/register', !!registerCall && registerCall.body.email === 'jane@email.com');
  check('register: sends name + phone', registerCall?.body.name === 'Jane Cooper' && registerCall?.body.phone === '5551234567');
  check('register: signs the new client in', afterRegister.isAuthenticated && afterRegister.user?.role === 'user', JSON.stringify(afterRegister.user));
  check('register: persists session', globalThis.localStorage.getItem('token') === 'mock-jwt-token-99' && (globalThis.localStorage.getItem('user') ?? '').includes('jane@email.com'));
  check('register: clears loading + error', afterRegister.isLoading === false && afterRegister.error === null);

  // Duplicate email is surfaced to the UI
  useAuthStore.getState().clearError();
  await useAuthStore.getState().register({ name: 'Jane Again', email: 'taken@email.com', password: 'Secure123' });
  const afterConflict = useAuthStore.getState();
  check('register: shows duplicate-email error', afterConflict.error === 'An account with this email already exists', String(afterConflict.error));

  // --- the API in server/ is not running --------------------------------------
  // Vite's proxy answers 500 with an empty body, which used to surface as
  // "Failed to execute 'json' on 'Response': Unexpected end of JSON input" — a
  // parser error that named neither the cause nor the fix.
  await useAuthStore.getState().logout();

  useAuthStore.getState().clearError();
  await useAuthStore.getState().register({ name: 'Down', email: 'down@email.com', password: 'Secure123!' });
  const downError = String(useAuthStore.getState().error);
  check('register: an unreachable API names the fix', downError.includes('npm run api'), downError);
  check('register: the empty-body parse error never reaches the UI', !downError.includes('JSON'), downError);
  check('register: a failed call signs nobody in', !useAuthStore.getState().isAuthenticated);

  useAuthStore.getState().clearError();
  await useAuthStore.getState().login('down@firm.com', 'Secure123!');
  check(
    'login: an unreachable API names the fix',
    String(useAuthStore.getState().error).includes('npm run api'),
    String(useAuthStore.getState().error),
  );

  useAuthStore.getState().clearError();
  await useAuthStore.getState().register({ name: 'Offline', email: 'offline@email.com', password: 'Secure123!' });
  check(
    'register: a refused connection is reported as unreachable',
    String(useAuthStore.getState().error).includes('account server'),
    String(useAuthStore.getState().error),
  );

  useAuthStore.getState().clearError();
  await useAuthStore.getState().login('nosession@firm.com', 'Secure123!');
  check(
    'login: a session-less 200 is rejected',
    String(useAuthStore.getState().error).includes('unexpected response'),
    String(useAuthStore.getState().error),
  );
  check('login: no half-signed-in state', !useAuthStore.getState().isAuthenticated);

  // Wrong credentials on sign in
  useAuthStore.getState().clearError();
  await useAuthStore.getState().login('john@firm.com', 'wrong');
  check('login: shows invalid-credential error', useAuthStore.getState().error === 'Invalid credentials', String(useAuthStore.getState().error));

  // Successful sign in routes by role
  useAuthStore.getState().clearError();
  await useAuthStore.getState().login('john@firm.com', 'password123');
  const afterLogin = useAuthStore.getState();
  check('login: authenticates the attorney', afterLogin.isAuthenticated && afterLogin.user?.role === 'attorney', JSON.stringify(afterLogin.user));
  check('login: persists the new token', globalThis.localStorage.getItem('token') === 'mock-jwt-token-2');

  // Signing out must work even when the API is unreachable (the fetch rejects).
  const savedFetch = globalThis.fetch;
  globalThis.fetch = (async () => {
    throw new TypeError('Failed to fetch');
  }) as unknown as typeof fetch;
  await useAuthStore.getState().logout();
  globalThis.fetch = savedFetch;
  check(
    'logout: clears the session even when the API is unreachable',
    !useAuthStore.getState().isAuthenticated && globalThis.localStorage.getItem('token') === null,
  );

  await useAuthStore.getState().logout();
  check('logout: clears the session', !useAuthStore.getState().isAuthenticated && globalThis.localStorage.getItem('token') === null);
}

testStoreFlows().then(() => {
  console.log(failed === 0 ? 'ALL AUTH CHECKS PASSED' : `${failed} AUTH CHECK(S) FAILED`);
  if (failed > 0) process.exitCode = 1;
});