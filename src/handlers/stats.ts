import { isAuthorized } from "../lib/auth";
import { BOT_UA_PATTERNS } from "../lib/bots";
import { json, notFound, unauthorized } from "../lib/http";
import type { Env } from "../types";

/**
 * GET /api/stats/:code — click analytics for a single link.
 *
 * Pass `?bots=exclude` to filter known preview/crawler user-agents at read time.
 * Raw clicks are always stored, so this filter is a tunable view, not a gate.
 */
export async function handleStats(request: Request, env: Env, code: string): Promise<Response> {
  if (!isAuthorized(request, env)) return unauthorized();

  const link = await env.DB.prepare("SELECT code FROM links WHERE code = ?").bind(code).first();
  if (!link) return notFound();

  const excludeBots = new URL(request.url).searchParams.get("bots") === "exclude";
  const where = excludeBots
    ? `WHERE code = ? AND ${BOT_UA_PATTERNS.map(() => "(ua IS NULL OR ua NOT LIKE ?)").join(" AND ")}`
    : "WHERE code = ?";
  const binds = excludeBots ? [code, ...BOT_UA_PATTERNS.map((p) => `%${p}%`)] : [code];

  const total = await env.DB.prepare(`SELECT COUNT(*) AS total FROM clicks ${where}`)
    .bind(...binds)
    .first<{ total: number }>();

  const byDay = await env.DB.prepare(
    `SELECT date(ts / 1000, 'unixepoch') AS day, COUNT(*) AS clicks
     FROM clicks ${where} GROUP BY day ORDER BY day DESC LIMIT 90`,
  )
    .bind(...binds)
    .all();

  const byCountry = await env.DB.prepare(
    `SELECT COALESCE(country, 'unknown') AS country, COUNT(*) AS clicks
     FROM clicks ${where} GROUP BY country ORDER BY clicks DESC LIMIT 50`,
  )
    .bind(...binds)
    .all();

  return json({
    code,
    total: total?.total ?? 0,
    excludeBots,
    byDay: byDay.results,
    byCountry: byCountry.results,
  });
}
