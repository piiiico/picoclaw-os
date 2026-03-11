# PicoClaw OS

A live reflections dashboard for autonomous agents. Part of the [PicoClaw](https://github.com/hawkaa/picoclaw) agent runner ecosystem.

## What is this?

PicoClaw OS is the operating system layer for PicoClaw agents. It provides structured storage and real-time visibility into an agent's reflections — the atomic unit of an agent's experience.

**Architecture:**
- **Primary storage:** Markdown files in the agent's workspace (episodes, knowledge, skills)
- **Structured queries:** [Turso](https://turso.tech) (cloud SQLite) for date-range queries, domain filtering, cross-session coordination
- **Dashboard:** Cloudflare Worker that reads from Turso and renders a live timeline

The agent dual-writes: markdown first (always works), database second (enables queries + dashboard). If the database is down, nothing is lost.

## Dashboard

The dashboard shows:
- **Stats cards:** Total reflections, active domains, success rate, surprise count
- **Reflections timeline:** Grouped by day, expandable details with goal, technique, surprise
- **Domain breakdown:** Which areas the agent has been working in
- **Auto-refresh:** Updates every 10 seconds

## Schema

```sql
CREATE TABLE reflections (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  timestamp TEXT NOT NULL,           -- ISO 8601
  title TEXT NOT NULL,               -- "Built Pico OS Dashboard"
  goal TEXT,                         -- what was I trying to do
  intended_effect TEXT,              -- real-world result expected
  outcome TEXT CHECK(outcome IN ('success', 'partial', 'failure')),
  surprise TEXT,                     -- unexpected finding (most valuable signal)
  technique TEXT,                    -- approach used
  domain TEXT,                       -- AEO, SECURITY, INFRA, SOCIAL, etc.
  body TEXT NOT NULL,                -- full markdown
  session_id TEXT,                   -- for cross-session correlation
  created_at TEXT DEFAULT (datetime('now'))
);
```

See [`schema/001-reflections.sql`](schema/001-reflections.sql) for the full migration.

## Setup

### 1. Create a Turso database

```bash
turso db create picoclaw-os --group your-group
turso db tokens create picoclaw-os
```

Apply the schema:
```bash
turso db shell picoclaw-os < schema/001-reflections.sql
```

### 2. Deploy the dashboard

```bash
# Install dependencies
bun install

# Set secrets
wrangler secret put TURSO_URL
wrangler secret put TURSO_AUTH_TOKEN
wrangler secret put DASHBOARD_KEY

# Deploy
wrangler deploy
```

Or use the standalone deploy script (no wrangler needed):
```bash
bun tools/deploy.ts
```

### 3. Access

```
https://picoclaw-os-dashboard.<your-subdomain>.workers.dev/?key=<your-key>
```

## Development

```bash
# Create .dev.vars with your secrets
echo 'TURSO_URL=libsql://your-db.turso.io' >> .dev.vars
echo 'TURSO_AUTH_TOKEN=your-token' >> .dev.vars
echo 'DASHBOARD_KEY=your-key' >> .dev.vars

# Run locally
wrangler dev
```

## Future

This is phase 1 — reflections only. The pattern (dual-write markdown + database, live dashboard) can extend to:
- Tasks and scheduling
- Attention queue with TTL
- Cross-session coordination
- Outreach pipeline tracking

Each is additive: same pattern, same dashboard, just more tables.

## License

MIT
