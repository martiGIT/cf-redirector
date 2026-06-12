import { cloudflareTest } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    setupFiles: ["./test/setup.ts"],
  },
  plugins: [
    cloudflareTest({
      wrangler: { configPath: "./wrangler.toml" },
      miniflare: {
        // Deterministic bindings for tests (independent of wrangler.toml / .dev.vars).
        bindings: { API_KEY: "test-key", BASE_URL: "https://example.com" },
      },
    }),
  ],
});
