import { env } from "cloudflare:test";
import { beforeAll, beforeEach } from "vitest";
import schema from "../schema.sql?raw";

// Create the schema once.
beforeAll(async () => {
  // Strip line/inline comments, then run each statement on a single line.
  const cleaned = schema.replace(/--[^\n]*/g, "");
  for (const statement of cleaned.split(";")) {
    const sql = statement.replace(/\s+/g, " ").trim();
    if (sql) await env.DB.exec(sql);
  }
});

// Start every test from an empty, deterministic state.
beforeEach(async () => {
  await env.DB.exec("DELETE FROM clicks");
  await env.DB.exec("DELETE FROM links");
});
