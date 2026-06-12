import { notFound } from "../lib/http";
import type { Env } from "../types";

/**
 * Resolve a short code to its destination and redirect.
 *
 * The only thing on the critical path is a single indexed lookup. The click is
 * logged via `ctx.waitUntil` AFTER the response is sent, so analytics never adds
 * latency to the redirect. Logging is best-effort: a dropped click must never
 * surface to the visitor.
 */
export async function handleResolve(
  code: string,
  request: Request,
  env: Env,
  ctx: ExecutionContext,
): Promise<Response> {
  if (!code) return notFound();

  const row = await env.DB.prepare("SELECT url FROM links WHERE code = ?")
    .bind(code)
    .first<{ url: string }>();

  if (!row) {
    if (env.DEFAULT_REDIRECT) return redirect(env.DEFAULT_REDIRECT, 302);
    return notFound("Unknown short link");
  }

  // HEAD requests (curl -I, link checkers) get the redirect headers but are not
  // counted as clicks.
  if (request.method !== "HEAD") ctx.waitUntil(logClick(env, code, request));

  const status = parseStatus(env.REDIRECT_STATUS);
  return redirect(row.url, status);
}

function redirect(location: string, status: number): Response {
  return new Response(null, {
    status,
    headers: { location, "cache-control": "no-store" },
  });
}

function parseStatus(value: string | undefined): number {
  const n = Number(value);
  return n === 301 || n === 307 ? n : 302;
}

async function logClick(env: Env, code: string, request: Request): Promise<void> {
  const country = request.cf?.country ?? null;
  try {
    await env.DB.prepare(
      "INSERT INTO clicks (code, ts, ua, referer, country) VALUES (?, ?, ?, ?, ?)",
    )
      .bind(
        code,
        Date.now(),
        request.headers.get("user-agent"),
        request.headers.get("referer"),
        country,
      )
      .run();
  } catch {
    // Best-effort analytics — swallow errors so the redirect is never affected.
  }
}
