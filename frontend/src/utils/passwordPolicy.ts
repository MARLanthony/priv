/**
 * Password policy for client self-registration.
 *
 * One source of truth: the sign-up form, its live requirement checklist and the
 * mock API all read these rules, so the client and the server can never disagree
 * about what an acceptable password looks like.
 */

export const PASSWORD_MIN_LENGTH = 8;

/** A non-space character outside A-Za-z0-9 — e.g. ! @ # $ % ^ & * ( ) - _ */
export const HAS_SYMBOL = /[^A-Za-z0-9\s]/;

export interface PasswordRule {
  id: 'length' | 'letter' | 'number' | 'symbol';
  /** Checklist text shown under the field. */
  label: string;
  test: (value: string) => boolean;
}

export const PASSWORD_RULES: PasswordRule[] = [
  {
    id: 'length',
    label: `At least ${PASSWORD_MIN_LENGTH} characters`,
    test: value => value.length >= PASSWORD_MIN_LENGTH,
  },
  { id: 'letter', label: 'One letter (a-z)', test: value => /[A-Za-z]/.test(value) },
  { id: 'number', label: 'One number (0-9)', test: value => /\d/.test(value) },
  { id: 'symbol', label: 'One special character', test: value => HAS_SYMBOL.test(value) },
];

/** Spoken form of each rule, used to name what is missing in the error message. */
const RULE_NAMES: Record<PasswordRule['id'], string> = {
  length: `at least ${PASSWORD_MIN_LENGTH} characters`,
  letter: 'a letter',
  number: 'a number',
  symbol: 'a special character (!@#$%)',
};

/** The rules a value does not satisfy yet, in display order. */
export const failedPasswordRules = (value: string): PasswordRule[] =>
  PASSWORD_RULES.filter(rule => !rule.test(value));

/** `true` when every rule passes. */
export const isPasswordReady = (value: string): boolean => failedPasswordRules(value).length === 0;

/**
 * Error message for the first unmet rule, or `undefined` when the password is
 * acceptable. A too-short password always reports the length first; otherwise
 * every missing requirement is named, so one edit can fix them all.
 */
export const passwordPolicyError = (value: string): string | undefined => {
  const missing = failedPasswordRules(value);
  if (missing.length === 0) return undefined;
  if (missing[0].id === 'length') return `Use at least ${PASSWORD_MIN_LENGTH} characters.`;

  const names = missing.map(rule => RULE_NAMES[rule.id]);
  const list = names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}` : names[0];
  return `Include ${list}.`;
};
