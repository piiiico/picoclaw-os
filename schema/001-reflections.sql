-- PicoClaw OS Schema v1: Reflections
-- Applied via Turso HTTP API or turso CLI

CREATE TABLE IF NOT EXISTS reflections (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  timestamp TEXT NOT NULL,           -- ISO 8601
  title TEXT NOT NULL,               -- "Built Pico OS Dashboard"
  goal TEXT,                         -- what was I trying to do
  intended_effect TEXT,              -- real-world result expected
  outcome TEXT CHECK(outcome IN ('success', 'partial', 'failure')),
  surprise TEXT,                     -- unexpected finding (most valuable signal)
  technique TEXT,                    -- approach used
  domain TEXT,                       -- AEO, SECURITY, INFRA, SOCIAL, etc.
  body TEXT NOT NULL,                -- full markdown (including decisions, intake)
  session_id TEXT,                   -- for cross-session correlation
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_reflections_timestamp ON reflections(timestamp);
CREATE INDEX IF NOT EXISTS idx_reflections_domain ON reflections(domain);
CREATE INDEX IF NOT EXISTS idx_reflections_outcome ON reflections(outcome);

-- Schema version tracking
CREATE TABLE IF NOT EXISTS schema_version (
  version INTEGER PRIMARY KEY,
  applied_at TEXT DEFAULT (datetime('now')),
  description TEXT
);

INSERT OR IGNORE INTO schema_version (version, description)
VALUES (1, 'Initial: reflections table');
