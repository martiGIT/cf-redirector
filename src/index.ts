import { handleAdmin } from "./handlers/admin";
import { handleExport } from "./handlers/export";
import { handleCreate, handleDelete, handleGet, handleList } from "./handlers/links";
import { handleResolve } from "./handlers/resolve";
import { handleStats } from "./handlers/stats";
import { json, methodNotAllowed, notFound } from "./lib/http";
import type { Env } from "./types";

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const { pathname } = new URL(request.url);
    const method = request.method;

    if (pathname === "/health") return json({ ok: true, service: "cf-redirector" });

    if (pathname.startsWith("/api/")) return routeApi(pathname, method, request, env);

    if (pathname === "/") {
      if (env.DEFAULT_REDIRECT) {
        return new Response(null, { status: 302, headers: { location: env.DEFAULT_REDIRECT } });
      }
      return json({ service: "cf-redirector", status: "ok" });
    }

    if (pathname === "/admin" && method === "GET") return handleAdmin();

    // Anything else is a short code: GET /:code
    if (method !== "GET") return methodNotAllowed();
    const code = pathname.slice(1).replace(/\/+$/, "");
    return handleResolve(code, request, env, ctx);
  },
} satisfies ExportedHandler<Env>;

function routeApi(
  pathname: string,
  method: string,
  request: Request,
  env: Env,
): Promise<Response> | Response {
  if (pathname === "/api/links") {
    if (method === "POST") return handleCreate(request, env);
    if (method === "GET") return handleList(request, env);
    return methodNotAllowed();
  }

  if (pathname === "/api/export" && method === "GET") return handleExport(request, env);

  const linkMatch = pathname.match(/^\/api\/links\/([^/]+)$/);
  if (linkMatch) {
    const code = decodeURIComponent(linkMatch[1] ?? "");
    if (method === "GET") return handleGet(request, env, code);
    if (method === "DELETE") return handleDelete(request, env, code);
    return methodNotAllowed();
  }

  const statsMatch = pathname.match(/^\/api\/stats\/([^/]+)$/);
  if (statsMatch && method === "GET") {
    return handleStats(request, env, decodeURIComponent(statsMatch[1] ?? ""));
  }

  return notFound();
}
