/*
 * Types for server/passwords.mjs, so TypeScript consumers (the MySQL auth test)
 * can import the server policy directly and compare it with the client one.
 * Runtime never loads this file — only `passwords.mjs` is executed.
 */

export declare const PASSWORD_MIN_LENGTH: number;

/** The rule ids a value does not satisfy yet, in display order. */
export declare function failedPasswordRules(value: string): Array<'length' | 'letter' | 'number' | 'symbol'>;

/** Error message for the first unmet rule, or `undefined` when acceptable. */
export declare function passwordPolicyError(value: string): string | undefined;

/** `scrypt$<salt-hex>$<hash-hex>` */
export declare function hashPassword(password: string): string;

export declare function verifyPassword(password: string, stored: string | null | undefined): boolean;
