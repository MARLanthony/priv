/*
 * The JurisFlow auth API — the real backend behind `/api/auth/*`.
 *
 * It replaces the MSW mock in `src/mocks/handlers/auth.ts` for registration and
 * login, and answers with exactly the same shapes (`{ user, token }`, `{ error }`,
 * 201/400/401/409) so no frontend code had to change:
 *
 *   POST /api/auth/register   create a CLIENT account (role is always `user`)
 *   POST /api/auth/login      verify a password and issue a token
 *   POST /api/auth/logout     stateless: the client drops the token
 *   GET  /api/auth/me         resolve the bearer token back to an account
 *   GET  /api/health          is MySQL reachable, and how many accounts exist
 *
 * Only `user` accounts can be self-registered — staff roles are provisioned by
 * the firm, which is why `role` from the request body is ignored.
 */
import express from 'express';
import { pool, describeTarget } from './db.mjs';
import { hashPassword, passwordPolicyError, verifyPassword } from './passwords.mjs';
import { signToken, tokenFromRequest } from './tokens.mjs';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Row -> the `User` shape in src/types/index.ts (`createdAt` is `YYYY-MM-DD`). */
function publicUser(row) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    ...(row.phone ? { phone: row.phone } : {}),
    ...(row.specialization ? { specialization: row.specialization } : {}),
    ...(row.bar_number ? { barNumber: row.bar_number } : {}),
    createdAt: toIsoDate(row.created_at),
  };
}

function toIsoDate(value) {
  if (!value) return new Date().toISOString().slice(0, 10);
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toISOString().slice(0, 10);
}

const badRequest = (response, error) => response.status(400).json({ error });

export function createApp() {
  const app = express();

  app.use(express.json({ limit: '100kb' }));

  // One line per request, so a save is visible in the terminal.
  app.use((request, response, next) => {
    const started = Date.now();
    response.on('finish', () => {
      console.log(
        `[api] ${request.method} ${request.originalUrl} -> ${response.statusCode} (${Date.now() - started}ms)`,
      );
    });
    next();
  });

  app.get('/api/health', async (_request, response) => {
    const [rows] = await pool.query('SELECT COUNT(*) AS total FROM users');
    response.json({ ok: true, database: describeTarget(), users: Number(rows[0].total) });
  });

  // --- registration: the route that writes a new account to MySQL ----------
  app.post('/api/auth/register', async (request, response) => {
    const body = request.body ?? {};
    const name = String(body.name ?? '').trim();
    const email = String(body.email ?? '').trim().toLowerCase();
    const password = String(body.password ?? '');
    const phone = String(body.phone ?? '').trim();

    if (!name || !email || !password) {
      return badRequest(response, 'Name, email and password are required');
    }
    if (name.length < 2) return badRequest(response, 'Please enter your full name.');
    if (!EMAIL_PATTERN.test(email)) return badRequest(response, 'Please enter a valid email address');

    // Same policy text the sign-up form shows (server/passwords.mjs mirrors
    // src/utils/passwordPolicy.ts, and a test keeps the two in step).
    const passwordError = passwordPolicyError(password);
    if (passwordError) return badRequest(response, passwordError);

    try {
      // `role` is hard-coded: a client cannot self-provision a staff account.
      const [result] = await pool.execute(
        `INSERT INTO users (name, email, phone, password_hash, role, created_at)
         VALUES (?, ?, ?, ?, 'user', NOW())`,
        [name, email, phone || null, hashPassword(password)],
      );

      const [rows] = await pool.execute('SELECT * FROM users WHERE id = ?', [result.insertId]);
      const user = publicUser(rows[0]);
      console.log(`[api] created account #${user.id} ${user.email} (role ${user.role})`);
      return response.status(201).json({ user, token: signToken({ sub: user.id }) });
    } catch (error) {
      // The UNIQUE index is the real guard against a duplicate email.
      if (error?.code === 'ER_DUP_ENTRY') {
        return response.status(409).json({ error: 'An account with this email already exists' });
      }
      throw error;
    }
  });

  app.post('/api/auth/login', async (request, response) => {
    const body = request.body ?? {};
    const email = String(body.email ?? '').trim().toLowerCase();
    const password = String(body.password ?? '');

    const [rows] = await pool.execute('SELECT * FROM users WHERE email = ? LIMIT 1', [email]);
    const row = rows[0];
    if (!row || !verifyPassword(password, row.password_hash)) {
      return response.status(401).json({ error: 'Invalid credentials' });
    }

    const user = publicUser(row);
    return response.json({ user, token: signToken({ sub: user.id }) });
  });

  app.post('/api/auth/logout', (_request, response) => {
    response.json({ success: true });
  });

  app.get('/api/auth/me', async (request, response) => {
    const payload = tokenFromRequest(request);
    if (!payload) return response.status(401).json({ error: 'Not authenticated' });

    const [rows] = await pool.execute('SELECT * FROM users WHERE id = ? LIMIT 1', [payload.sub]);
    if (!rows[0]) return response.status(401).json({ error: 'Not authenticated' });
    return response.json(publicUser(rows[0]));
  });

  // Always answer with JSON, so the client never tries to parse an HTML page.
  app.use((error, _request, response, _next) => {
    console.error('[api] error:', error?.sqlMessage ?? error?.message ?? error);
    if (error?.type === 'entity.parse.failed') {
      return response.status(400).json({ error: 'Invalid JSON body' });
    }
    if (error?.code === 'ECONNREFUSED' || error?.code === 'PROTOCOL_CONNECTION_LOST') {
      return response.status(503).json({ error: 'Database unavailable - is MySQL running?' });
    }
    return response.status(500).json({ error: 'Database error' });
  });

  return app;
}
