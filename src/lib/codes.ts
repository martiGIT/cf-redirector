const ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";

// Largest multiple of the alphabet size that fits in a byte; bytes at or above
// it are rejected so `b % ALPHABET.length` stays uniform.
const UNBIASED_LIMIT = 256 - (256 % ALPHABET.length);

/** Generate a random base62 short code using a CSPRNG (rejection sampling, no modulo bias). */
export function generateCode(length = 7): string {
  let out = "";
  while (out.length < length) {
    for (const b of crypto.getRandomValues(new Uint8Array(length))) {
      if (b < UNBIASED_LIMIT && out.length < length) out += ALPHABET.charAt(b % ALPHABET.length);
    }
  }
  return out;
}

const VALID_CODE = /^[0-9A-Za-z_-]{1,64}$/;

/** Codes are URL-safe: alphanumerics, hyphen and underscore, 1-64 chars. */
export function isValidCode(code: string): boolean {
  return VALID_CODE.test(code);
}

/** Path prefixes that must never be usable as short codes. */
export const RESERVED_CODES = new Set(["api", "admin", "health", "favicon.ico", "robots.txt"]);
