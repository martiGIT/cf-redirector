const ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";

/** Generate a random base62 short code using a CSPRNG. */
export function generateCode(length = 7): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  let out = "";
  for (const b of bytes) {
    out += ALPHABET.charAt(b % ALPHABET.length);
  }
  return out;
}

const VALID_CODE = /^[0-9A-Za-z_-]{1,64}$/;

/** Codes are URL-safe: alphanumerics, hyphen and underscore, 1-64 chars. */
export function isValidCode(code: string): boolean {
  return VALID_CODE.test(code);
}

/** Path prefixes that must never be usable as short codes. */
export const RESERVED_CODES = new Set(["api", "health", "favicon.ico", "robots.txt"]);
