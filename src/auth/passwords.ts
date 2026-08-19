/**
 * Password hashing.
 *
 * scrypt from node:crypto, so there is no native build step and nothing to
 * install. Every password function lives in this file and sessions.ts, which
 * is the whole point: swapping to a managed auth provider later touches two
 * files, not the codebase.
 *
 * Parameters follow OWASP's scrypt guidance: N=2^17, r=8, p=1.
 */

import { randomBytes, scrypt as _scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(_scrypt) as (
  pw: string | Buffer, salt: string | Buffer, len: number, opts: object,
) => Promise<Buffer>;

const N = 2 ** 17;
const PARAMS = { N, r: 8, p: 1, maxmem: 256 * 1024 * 1024 };
const KEYLEN = 64;

export async function hashPassword(plain: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(plain.normalize('NFKC'), salt, KEYLEN, PARAMS);
  return `scrypt$${N}$8$1$${salt.toString('base64')}$${key.toString('base64')}`;
}

/**
 * Always does the same work whether or not the hash is valid. Returning early
 * on a malformed hash would leak, through timing, which emails have accounts.
 */
export async function verifyPassword(plain: string, stored: string | null): Promise<boolean> {
  const parts = (stored ?? '').split('$');
  const ok = parts.length === 6 && parts[0] === 'scrypt';

  const salt = ok ? Buffer.from(parts[4]!, 'base64') : randomBytes(16);
  const expected = ok ? Buffer.from(parts[5]!, 'base64') : randomBytes(KEYLEN);
  const params = ok
    ? { N: Number(parts[1]), r: Number(parts[2]), p: Number(parts[3]), maxmem: PARAMS.maxmem }
    : PARAMS;

  let actual: Buffer;
  try {
    actual = await scrypt(plain.normalize('NFKC'), salt, expected.length, params);
  } catch {
    return false;
  }

  const match = actual.length === expected.length && timingSafeEqual(actual, expected);
  return ok && match;
}

/** Minimum viable policy: length beats complexity rules. */
export function passwordProblem(plain: string): string | null {
  if (plain.length < 10) return 'Use at least 10 characters.';
  if (plain.length > 200) return 'That is too long.';
  if (/^\s|\s$/.test(plain)) return 'Remove the leading or trailing space.';
  return null;
}
