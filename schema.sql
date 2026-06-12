-- cf-redirector D1 schema
-- Source of truth for the link map AND the permanent click history.
-- Apply with:  npm run db:schema        (remote)
--              npm run db:schema:local   (local dev)

-- The link map. Lives forever; this is what you back up for portability.
CREATE TABLE IF NOT EXISTS links (
  code        TEXT PRIMARY KEY,        -- short code (path segment)
  url         TEXT NOT NULL,           -- destination URL
  created_at  INTEGER NOT NULL,        -- epoch milliseconds
  tags        TEXT,                    -- optional free-form tags
  metadata    TEXT                     -- optional JSON blob (campaign, lang, ...)
);

CREATE INDEX IF NOT EXISTS idx_links_created_at ON links(created_at);

-- Append-only click event log. One row per click => no read-modify-write,
-- therefore no race conditions. Counts are derived with COUNT(*) at read time.
-- Bots are NOT filtered on write: raw events are stored and filtered in queries.
CREATE TABLE IF NOT EXISTS clicks (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  code        TEXT NOT NULL,
  ts          INTEGER NOT NULL,        -- epoch milliseconds
  ua          TEXT,                    -- user-agent (used for query-time bot filtering)
  referer     TEXT,
  country     TEXT                     -- request.cf.country
);

CREATE INDEX IF NOT EXISTS idx_clicks_code ON clicks(code);
CREATE INDEX IF NOT EXISTS idx_clicks_ts ON clicks(ts);
