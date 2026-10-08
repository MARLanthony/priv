/*
 * Session tokens: a minimal HS256 JWT signed with node's own crypto.
 *
 * Why not a library: the only consumer is this local API, and one HMAC over a
 * base64url payload is a few lines — it keeps the dependency list to `express`
 * and `mysql2`. The token is stateless, so no sessions table is needed; the
 * signature is what stops a client from claiming someone else's id.
 *
 *   AUTH_TOKEN_SECRET  signing key (defaults to a dev-only value)
 *   AUTH_TOKEN_TTL     lifetime in seconds (default 7 days)
 */
import { createHmac, timingSafeEqual } from 'node:crypto';

const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
const sign = input => createHmac('sha256', tokenSecret()).update(input).digest('base64url');

export const tokenSecret = () => process.env.AUTH_TOKEN_SECRET || 'jurisflow-dev-secret';
export const tokenTtlSeconds = () => Number(process.env.AUTH_TOKEN_TTL || 60 * 60 * 24 * 7);

export function signToken(payload) {
  const issuedAt = Math.floor(Date.now() / 1000);
  const body = { ...payload, iat: issuedAt, exp: issuedAt + tokenTtlSeconds() };
  const head = encode({ alg: 'HS256', typ: 'JWT' });
  const data = `${head}.${encode(body)}`;
  return `${data}.${sign(data)}`;
}

/** The decoded payload, or `null` when the token is missing, forged or expired. */
export function verifyToken(token) {
  if (typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [head, body, signature] = parts;
  const expected = sign(`${head}.${body}`);
  const given = Buffer.from(signature);
  const want = Buffer.from(expected);
  if (given.length !== want.length || !timingSafeEqual(given, want)) return null;

  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (typeof payload.exp === 'number' && payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

/** Reads `Authorization: Bearer <token>` and returns the payload or `null`. */
export function tokenFromRequest(request) {
  const header = request.get?.('authorization') ?? request.headers?.authorization ?? '';
  const match = /^Bearer\s+(.+)$/i.exec(String(header));
  return match ? verifyToken(match[1].trim()) : null;
}
