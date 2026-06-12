import { isAuthorized } from "../lib/auth";
import { json, unauthorized } from "../lib/http";
import type { Env } from "../types";

/**
 * GET /api/export — full dump of the link map for backup / portability.
 *
 * This is the real "links live forever" guarantee: export `code -> url` on a
 * schedule and you can move to any other host if Cloudflare ever changes terms.
 * `?format=csv` returns CSV, otherwise JSON.
 */
export async function handleExport(request: Request, env: Env): Promise<Response> {
  if (!isAuthorized(request, env)) return unauthorized();

  const { results } = await env.DB.prepare(
    "SELECT code, url, created_at, tags, metadata FROM links ORDER BY created_at ASC",
  ).all<Record<string, unknown>>();

  if (new URL(request.url).searchParams.get("format") === "csv") {
    const header = "code,url,created_at,tags,metadata";
    const rows = results.map((r) =>
      [r.code, r.url, r.created_at, r.tags ?? "", r.metadata ?? ""].map(csvCell).join(","),
    );
    return new Response([header, ...rows].join("\n"), {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": 'attachment; filename="cf-redirector-links.csv"',
      },
    });
  }

  return json({ exported_at: Date.now(), count: results.length, links: results });
}

function csvCell(value: unknown): string {
  return `"${String(value).replace(/"/g, '""')}"`;
}
