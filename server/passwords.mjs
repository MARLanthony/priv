/*
 * Password hashing and the registration policy — the server half of
 * `src/utils/passwordPolicy.ts`.
 *
 * Hashing uses node's built-in scrypt (memory-hard, no dependency to audit):
 * the stored value is `scrypt$<salt-hex>$<hash-hex>`, so the format is
 * self-describing and can be migrated later without guessing.
 *
 * The rule text below MUST stay identical to the TypeScript version: the sign-up
 * form, its live checklist and this API all report the same message, and
 * `tests/auth-mysql-test.ts` asserts the two implementations agree.
 */
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

export const PASSWORD_MIN_LENGTH = 8;

/** A non-space character outside A-Za-z0-9 — e.g. ! @ # $ % ^ & * ( ) - _ */
const HAS_SYMBOL = /[^A-Za-z0-9\s]/;

const RULE_NAMES = {
  length: `at least ${PASSWORD_MIN_LENGTH} characters`,
  letter: 'a letter',
  number: 'a number',
  symbol: 'a special character (!@#$%)',
};

/** The rules a value does not satisfy yet, in display order. */
export function failedPasswordRules(value) {
  const missing = [];
  if (value.length < PASSWORD_MIN_LENGTH) missing.push('length');
  if (!/[A-Za-z]/.test(value)) missing.push('letter');
  if (!/\d/.test(value)) missing.push('number');
  if (!HAS_SYMBOL.test(value)) missing.push('symbol');
  return missing;
}

/**
 * Error message for the first unmet rule, or `undefined` when the password is
 * acceptable — identical wording to the client policy.
 */
export function passwordPolicyError(value) {
  const missing = failedPasswordRules(value);
  if (missing.length === 0) return undefined;
  if (missing[0] === 'length') return `Use at least ${PASSWORD_MIN_LENGTH} characters.`;

  const names = missing.map(id => RULE_NAMES[id]);
  const list = names.length > 1
    ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
    : names[0];
  return `Include ${list}.`;
}

export function hashPassword(password) {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 64);
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`;
}

/** Constant-time comparison; a malformed stored value never throws. */
export function verifyPassword(password, stored) {
  const [scheme, saltHex, hashHex] = String(stored ?? '').split('$');
  if (scheme !== 'scrypt' || !saltHex || !hashHex) return false;

  const expected = Buffer.from(hashHex, 'hex');
  if (expected.length === 0) return false;

  const actual = scryptSync(password, Buffer.from(saltHex, 'hex'), expected.length);
  return timingSafeEqual(expected, actual);
}
