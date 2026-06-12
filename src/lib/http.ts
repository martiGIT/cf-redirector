export function json(data: unknown, status = 200, headers: HeadersInit = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...headers },
  });
}

export const ok = (data: unknown = { ok: true }): Response => json(data, 200);
export const created = (data: unknown): Response => json(data, 201);
export const badRequest = (message: string): Response => json({ error: message }, 400);
export const unauthorized = (): Response => json({ error: "Unauthorized" }, 401);
export const notFound = (message = "Not found"): Response => json({ error: message }, 404);
export const methodNotAllowed = (): Response => json({ error: "Method not allowed" }, 405);
