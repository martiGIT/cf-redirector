import { isAuthorized } from "../lib/auth";
import { generateCode, isValidCode, RESERVED_CODES } from "../lib/codes";
import { badRequest, created, json, notFound, unauthorized } from "../lib/http";
import type { Env } from "../types";

interface CreateBody {
  url?: string;
  code?: string;
  tags?: string;
  metadata?: unknown;
}

/** POST /api/links — create a short link (custom or auto-generated code). */
export async function handleCreate(request: Request, env: Env): Promise<Response> {
  if (!isAuthorized(request, env)) return unauthorized();

  let body: CreateBody;
  try {
    body = (await request.json()) as CreateBody;
  } catch {
    return badRequest("Invalid JSON body");
  }

  const target = (body.url ?? "").trim();
  if (!isHttpUrl(target)) return badRequest("Field 'url' must be a valid http(s) URL");

  const custom = (body.code ?? "").trim();
  if (custom && (!isValidCode(custom) || RESERVED_CODES.has(custom))) {
    return badRequest("Invalid or reserved code");
  }

  const tags = body.tags ?? null;
  const metadata = body.metadata != null ? JSON.stringify(body.metadata) : null;
  const now = Date.now();

  // Retry auto-generated codes on the (extremely unlikely) collision.
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = custom || generateCode();
    try {
      await env.DB.prepare(
        "INSERT INTO links (code, url, created_at, tags, metadata) VALUES (?, ?, ?, ?, ?)",
      )
        .bind(candidate, target, now, tags, metadata)
        .run();
      return created({ code: candidate, shortUrl: shortUrl(env, candidate), url: target });
    } catch (err) {
      if (isUniqueViolation(err)) {
        if (custom) return badRequest("Code already exists");
        continue; // regenerate and retry
      }
      throw err;
    }
  }
  return json({ error: "Could not allocate a unique code, please retry" }, 503);
}

/** GET /api/links — list links, newest first. */
export async function handleList(request: Request, env: Env): Promise<Response> {
  if (!isAuthorized(request, env)) return unauthorized();
  const params = new URL(request.url).searchParams;
  const limit = clamp(Number(params.get("limit")) || 50, 1, 500);
  const offset = Math.max(Number(params.get("offset")) || 0, 0);

  const { results } = await env.DB.prepare(
    `SELECT l.code, l.url, l.created_at, l.tags, l.metadata,
       (SELECT COUNT(*) FROM clicks c WHERE c.code = l.code) AS clicks
     FROM links l ORDER BY l.created_at DESC LIMIT ? OFFSET ?`,
  )
    .bind(limit, offset)
    .all();

  return json({ links: results, limit, offset });
}

/** GET /api/links/:code — one link plus its total click count. */
export async function handleGet(request: Request, env: Env, code: string): Promise<Response> {
  if (!isAuthorized(request, env)) return unauthorized();
  const link = await env.DB.prepare(
    "SELECT code, url, created_at, tags, metadata FROM links WHERE code = ?",
  )
    .bind(code)
    .first();
  if (!link) return notFound();
  const clicks = await env.DB.prepare("SELECT COUNT(*) AS total FROM clicks WHERE code = ?")
    .bind(code)
    .first<{ total: number }>();
  return json({ ...link, clicks: clicks?.total ?? 0 });
}

/** PATCH /api/links/:code — update a link's destination url / tags / metadata. */
export async function handleUpdate(request: Request, env: Env, code: string): Promise<Response> {
  if (!isAuthorized(request, env)) return unauthorized();

  let body: CreateBody;
  try {
    body = (await request.json()) as CreateBody;
  } catch {
    return badRequest("Invalid JSON body");
  }

  const sets: string[] = [];
  const binds: (string | null)[] = [];
  if (body.url !== undefined) {
    const target = (body.url ?? "").trim();
    if (!isHttpUrl(target)) return badRequest("Field 'url' must be a valid http(s) URL");
    sets.push("url = ?");
    binds.push(target);
  }
  if (body.tags !== undefined) {
    sets.push("tags = ?");
    binds.push(body.tags ?? null);
  }
  if (body.metadata !== undefined) {
    sets.push("metadata = ?");
    binds.push(body.metadata != null ? JSON.stringify(body.metadata) : null);
  }
  if (!sets.length) return badRequest("Nothing to update (send url, tags or metadata)");

  binds.push(code);
  const res = await env.DB.prepare(`UPDATE links SET ${sets.join(", ")} WHERE code = ?`)
    .bind(...binds)
    .run();
  if (!res.meta.changes) return notFound();
  return json({ updated: code });
}

/** DELETE /api/links/:code — remove a link and its clicks atomically. */
export async function handleDelete(request: Request, env: Env, code: string): Promise<Response> {
  if (!isAuthorized(request, env)) return unauthorized();
  const results = await env.DB.batch([
    env.DB.prepare("DELETE FROM clicks WHERE code = ?").bind(code),
    env.DB.prepare("DELETE FROM links WHERE code = ?").bind(code),
  ]);
  const linkResult = results[1];
  if (!linkResult?.meta.changes) return notFound();
  return json({ deleted: code });
}

function shortUrl(env: Env, code: string): string {
  return `${env.BASE_URL.replace(/\/$/, "")}/${code}`;
}

function isHttpUrl(value: string): boolean {
  if (!value) return false;
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

function isUniqueViolation(err: unknown): boolean {
  return String((err as Error)?.message ?? err).includes("UNIQUE");
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(Math.max(n, min), max);
}
