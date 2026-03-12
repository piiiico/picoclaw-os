-- PicoClaw OS Schema v2: CLAUDE.md Snapshots
-- Tracks the evolution of CLAUDE.md over time

CREATE TABLE IF NOT EXISTS claude_md_snapshots (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  content TEXT NOT NULL,               -- full CLAUDE.md content
  hash TEXT NOT NULL,                  -- sha256 of content (dedup)
  created_at TEXT NOT NULL,            -- ISO 8601
  trigger TEXT NOT NULL                -- consolidation, manual, session
);

CREATE INDEX IF NOT EXISTS idx_snapshots_created_at ON claude_md_snapshots(created_at);
CREATE INDEX IF NOT EXISTS idx_snapshots_hash ON claude_md_snapshots(hash);

INSERT OR IGNORE INTO schema_version (version, description)
VALUES (2, 'CLAUDE.md snapshots table');
