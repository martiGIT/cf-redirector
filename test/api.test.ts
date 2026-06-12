import { env, SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";

const AUTH = { authorization: "Bearer test-key", "content-type": "application/json" };
const BASE = "https://r.example.com";

async function createLink(payload: Record<string, unknown>): Promise<Response> {
  return SELF.fetch(`${BASE}/api/links`, {
    method: "POST",
    headers: AUTH,
    body: JSON.stringify(payload),
  });
}

describe("api: create", () => {
  it("rejects unauthorized requests", async () => {
    const res = await SELF.fetch(`${BASE}/api/links`, {
      method: "POST",
      body: JSON.stringify({ url: "https://example.com" }),
    });
    expect(res.status).toBe(401);
  });

  it("creates a link with a custom code", async () => {
    const res = await createLink({ url: "https://example.com/page", code: "abc" });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { code: string; shortUrl: string; url: string };
    expect(body.code).toBe("abc");
    expect(body.shortUrl).toBe("https://example.com/abc");
  });

  it("rejects a non-http url", async () => {
    const res = await createLink({ url: "ftp://nope" });
    expect(res.status).toBe(400);
  });

  it("rejects a reserved code", async () => {
    const res = await createLink({ url: "https://example.com", code: "api" });
    expect(res.status).toBe(400);
  });

  it("rejects a duplicate custom code", async () => {
    await createLink({ url: "https://example.com/a", code: "dup" });
    const res = await createLink({ url: "https://example.com/b", code: "dup" });
    expect(res.status).toBe(400);
  });
});

describe("resolve", () => {
  it("redirects a known code with 302 and no-store", async () => {
    await createLink({ url: "https://example.com/dest", code: "go" });
    const res = await SELF.fetch(`${BASE}/go`, { redirect: "manual" });
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("https://example.com/dest");
    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  it("returns 404 for an unknown code", async () => {
    const res = await SELF.fetch(`${BASE}/missing`, { redirect: "manual" });
    expect(res.status).toBe(404);
  });
});

describe("stats: query-time bot filtering", () => {
  it("counts all clicks, and excludes preview crawlers on demand", async () => {
    await createLink({ url: "https://example.com", code: "trk" });
    const insert = env.DB.prepare(
      "INSERT INTO clicks (code, ts, ua, referer, country) VALUES (?, ?, ?, ?, ?)",
    );
    await insert.bind("trk", Date.now(), "Mozilla/5.0", null, "PL").run();
    await insert.bind("trk", Date.now(), "WhatsApp/2.24", null, "PL").run();

    const all = (await (await SELF.fetch(`${BASE}/api/stats/trk`, { headers: AUTH })).json()) as {
      total: number;
    };
    expect(all.total).toBe(2);

    const human = (await (
      await SELF.fetch(`${BASE}/api/stats/trk?bots=exclude`, { headers: AUTH })
    ).json()) as { total: number };
    expect(human.total).toBe(1);
  });
});

describe("export", () => {
  it("dumps the link map as JSON", async () => {
    await createLink({ url: "https://example.com/1", code: "one" });
    await createLink({ url: "https://example.com/2", code: "two" });
    const res = await SELF.fetch(`${BASE}/api/export`, { headers: AUTH });
    const body = (await res.json()) as { count: number; links: unknown[] };
    expect(body.count).toBe(2);
    expect(body.links).toHaveLength(2);
  });
});

describe("links list", () => {
  it("includes a click count per link", async () => {
    await createLink({ url: "https://example.com", code: "cnt" });
    const insert = env.DB.prepare(
      "INSERT INTO clicks (code, ts, ua, referer, country) VALUES (?, ?, ?, ?, ?)",
    );
    await insert.bind("cnt", Date.now(), "Mozilla/5.0", null, "PL").run();
    const body = (await (await SELF.fetch(`${BASE}/api/links`, { headers: AUTH })).json()) as {
      links: Array<{ code: string; clicks: number }>;
    };
    expect(body.links[0]?.code).toBe("cnt");
    expect(body.links[0]?.clicks).toBe(1);
  });
});

describe("admin panel", () => {
  it("serves HTML without auth (page carries no secret)", async () => {
    const res = await SELF.fetch(`${BASE}/admin`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
    expect(await res.text()).toContain("cf-redirector");
  });
});
