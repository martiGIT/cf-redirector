import type { Env } from "../types";

/**
 * Verify the `Authorization: Bearer <API_KEY>` header.
 * Creation and stats are gated; resolving short links is always public.
 */
export function isAuthorized(request: Request, env: Env): boolean {
  if (!env.API_KEY) return false;
  const header = request.headers.get("authorization") ?? "";
  const token = header.replace(/^Bearer\s+/i, "").trim();
  if (!token) return false;
  return timingSafeEqual(token, env.API_KEY);
}

/** Constant-time string comparison to avoid leaking the key via timing. */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
