// Worker bindings. Mirrors wrangler.toml (the shape `wrangler types` would
// generate). `cloudflare:test` and the runtime both read `Cloudflare.Env`.
declare namespace Cloudflare {
  interface Env {
    /** D1 database binding (link map + click log). */
    DB: D1Database;
    /** Bearer token guarding every /api/* endpoint. Set as a secret. */
    API_KEY: string;
    /** Short domain base, used only to build `shortUrl` in API responses. */
    BASE_URL: string;
    /** Redirect status: "301" | "302" | "307". Defaults to 302. */
    REDIRECT_STATUS?: string;
    /** Fallback URL for unknown codes. Empty/undefined => 404. */
    DEFAULT_REDIRECT?: string;
  }
}
