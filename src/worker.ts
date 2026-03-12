/**
 * PicoClaw OS Dashboard — Cloudflare Worker
 * Reads reflections + CLAUDE.md snapshots from Turso, renders a live dashboard.
 * Open source: github.com/piiiico/picoclaw-os
 */

import { createClient, type Client } from "@libsql/client/web";

// ── Types ──
interface Env {
  TURSO_URL: string;
  TURSO_AUTH_TOKEN: string;
  DASHBOARD_KEY: string;
}

interface Reflection {
  id: string;
  timestamp: string;
  title: string;
  goal: string | null;
  intended_effect: string | null;
  outcome: string | null;
  surprise: string | null;
  technique: string | null;
  domain: string | null;
  body: string;
  session_id: string | null;
  created_at: string;
}

interface Snapshot {
  id: string;
  content: string;
  hash: string;
  created_at: string;
  trigger: string;
}

// ── Helpers ──
function getDb(env: Env): Client {
  return createClient({
    url: env.TURSO_URL.replace(/^libsql:\/\//, "https://"),
    authToken: env.TURSO_AUTH_TOKEN,
  });
}

function esc(s: string | null | undefined): string {
  if (!s) return "";
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function keyParam(request: Request): string {
  const url = new URL(request.url);
  return url.searchParams.get("key") || "";
}

function outcomeBadge(outcome: string | null): string {
  if (!outcome) return "";
  const colors: Record<string, string> = {
    success: "#10b981",
    partial: "#f59e0b",
    failure: "#ef4444",
  };
  const color = colors[outcome] || "#6b7280";
  return `<span style="background:${color}20;color:${color};padding:2px 8px;border-radius:4px;font-size:12px;font-weight:600">${esc(outcome)}</span>`;
}

function domainTag(domain: string | null): string {
  if (!domain) return "";
  return `<span style="background:#374151;color:#9ca3af;padding:2px 8px;border-radius:4px;font-size:11px;margin-left:6px">${esc(domain)}</span>`;
}

function triggerBadge(trigger: string): string {
  const colors: Record<string, string> = {
    consolidation: "#8b5cf6",
    manual: "#6b7280",
    session: "#3b82f6",
  };
  const color = colors[trigger] || "#6b7280";
  return `<span style="background:${color}20;color:${color};padding:2px 8px;border-radius:4px;font-size:12px;font-weight:500">${esc(trigger)}</span>`;
}

function groupByDay(reflections: Reflection[]): Map<string, Reflection[]> {
  const groups = new Map<string, Reflection[]>();
  for (const r of reflections) {
    const day = r.timestamp.slice(0, 10);
    if (!groups.has(day)) groups.set(day, []);
    groups.get(day)!.push(r);
  }
  return groups;
}

// ── Diff algorithm (LCS-based, line-level) ──
interface DiffLine {
  type: "add" | "remove" | "same";
  content: string;
  oldNum?: number;
  newNum?: number;
}

function computeDiff(oldText: string, newText: string): DiffLine[] {
  const oldLines = oldText.split("\n");
  const newLines = newText.split("\n");
  const m = oldLines.length;
  const n = newLines.length;

  // LCS table
  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    new Array(n + 1).fill(0)
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (oldLines[i - 1] === newLines[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrack to produce diff
  const result: DiffLine[] = [];
  let i = m,
    j = n;
  const stack: DiffLine[] = [];

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      stack.push({
        type: "same",
        content: oldLines[i - 1],
        oldNum: i,
        newNum: j,
      });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      stack.push({ type: "add", content: newLines[j - 1], newNum: j });
      j--;
    } else {
      stack.push({ type: "remove", content: oldLines[i - 1], oldNum: i });
      i--;
    }
  }

  // Reverse since we built it backwards
  while (stack.length) result.push(stack.pop()!);
  return result;
}

// ── Shared layout ──
function pageShell(
  title: string,
  nav: string,
  body: string,
  opts?: { noAutoRefresh?: boolean }
): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(title)} — PicoClaw OS</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: #0a0a0a; color: #e0e0e0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
    details > summary::-webkit-details-marker { display: none; }
    details > summary { list-style: none; }
    details > summary::before { content: "\\25B6"; color: #4b5563; margin-right: 8px; font-size: 10px; transition: transform 0.2s; display: inline-block; }
    details[open] > summary::before { transform: rotate(90deg); }
    a { color: #10b981; text-decoration: none; }
    a:hover { text-decoration: underline; }
    .nav-link { color: #6b7280; font-size: 13px; padding: 4px 10px; border-radius: 4px; transition: all 0.15s; }
    .nav-link:hover { color: #e0e0e0; background: #1a1a1a; text-decoration: none; }
    .nav-link.active { color: #10b981; background: #10b98115; }
    .diff-add { background: #10b98115; color: #6ee7b7; }
    .diff-remove { background: #ef444415; color: #fca5a5; }
    .diff-same { color: #6b7280; }
    .diff-gutter { color: #4b5563; user-select: none; min-width: 80px; text-align: right; padding-right: 12px; border-right: 1px solid #262626; margin-right: 12px; }
    .diff-line { display: flex; font-family: 'SF Mono', 'Fira Code', monospace; font-size: 12px; line-height: 1.6; padding: 0 8px; }
    .diff-marker { min-width: 20px; text-align: center; user-select: none; font-weight: 600; }
  </style>
</head>
<body>
  <!-- Top bar -->
  <div style="background:#111;border-bottom:1px solid #262626;padding:16px 24px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px">
    <div style="display:flex;align-items:center;gap:16px">
      <span style="font-size:18px;font-weight:700;color:#10b981">PicoClaw OS</span>
      ${nav}
    </div>
    <div style="display:flex;align-items:center;gap:12px;font-size:12px;color:#6b7280">
      <span>Updated: ${esc(new Date().toISOString().slice(0, 19) + "Z")}</span>
      <span id="refresh-dot" style="width:8px;height:8px;border-radius:50%;background:#10b981;display:inline-block"></span>
    </div>
  </div>

  <div style="max-width:1200px;margin:0 auto;padding:24px">
    ${body}
  </div>

  <div style="text-align:center;padding:40px 24px;color:#374151;font-size:12px">
    <a href="https://github.com/piiiico/picoclaw-os" target="_blank">picoclaw-os</a> &mdash; open source agent operating system
  </div>

  <script>
    ${opts?.noAutoRefresh ? "" : "setTimeout(() => location.reload(), 10000);"}
    const dot = document.getElementById('refresh-dot');
    if (dot) { setInterval(() => { dot.style.opacity = dot.style.opacity === '0.3' ? '1' : '0.3'; }, 5000); }
  </script>
</body>
</html>`;
}

function navHtml(key: string, activePage: string): string {
  const pages = [
    { path: "/", label: "Reflections" },
    { path: "/evolution", label: "Evolution" },
  ];
  return pages
    .map(
      (p) =>
        `<a class="nav-link ${activePage === p.path ? "active" : ""}" href="${p.path}?key=${esc(key)}">${p.label}</a>`
    )
    .join("");
}

// ── Auth middleware ──
function checkAuth(request: Request, env: Env): Response | null {
  const url = new URL(request.url);
  const key = url.searchParams.get("key");
  if (!key || key !== env.DASHBOARD_KEY) {
    return new Response("Unauthorized", { status: 401 });
  }
  return null;
}

// ── API handlers ──
async function handleApiReflections(
  request: Request,
  env: Env
): Promise<Response> {
  const url = new URL(request.url);
  const db = getDb(env);
  const conditions: string[] = [];
  const args: any[] = [];

  const since = url.searchParams.get("since");
  if (since) {
    conditions.push("timestamp >= ?");
    args.push(
      since === "today"
        ? new Date().toISOString().slice(0, 10) + "T00:00:00Z"
        : since
    );
  }
  const domain = url.searchParams.get("domain");
  if (domain) {
    conditions.push("domain = ?");
    args.push(domain);
  }
  const limit = parseInt(url.searchParams.get("limit") || "100");
  const where = conditions.length
    ? `WHERE ${conditions.join(" AND ")}`
    : "";

  const result = await db.execute({
    sql: `SELECT * FROM reflections ${where} ORDER BY timestamp DESC LIMIT ?`,
    args: [...args, limit],
  });

  return new Response(JSON.stringify(result.rows), {
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

async function handleApiStats(env: Env): Promise<Response> {
  const db = getDb(env);
  const [totalR, domainR, outcomeR, surpriseR] = await Promise.all([
    db.execute("SELECT COUNT(*) as c FROM reflections"),
    db.execute(
      "SELECT domain, COUNT(*) as c FROM reflections WHERE domain IS NOT NULL GROUP BY domain ORDER BY c DESC"
    ),
    db.execute(
      "SELECT outcome, COUNT(*) as c FROM reflections WHERE outcome IS NOT NULL GROUP BY outcome"
    ),
    db.execute(
      "SELECT COUNT(*) as c FROM reflections WHERE surprise IS NOT NULL AND surprise != 'none'"
    ),
  ]);

  const stats = {
    total: Number(totalR.rows[0].c),
    byDomain: Object.fromEntries(
      domainR.rows.map((r) => [r.domain, Number(r.c)])
    ),
    byOutcome: Object.fromEntries(
      outcomeR.rows.map((r) => [r.outcome, Number(r.c)])
    ),
    surpriseCount: Number(surpriseR.rows[0].c),
    domainCount: domainR.rows.length,
  };

  return new Response(JSON.stringify(stats), {
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

async function handleApiEvolution(
  request: Request,
  env: Env
): Promise<Response> {
  const db = getDb(env);
  const result = await db.execute(
    "SELECT id, hash, created_at, trigger, LENGTH(content) as content_len FROM claude_md_snapshots ORDER BY created_at DESC"
  );
  return new Response(JSON.stringify(result.rows), {
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

// ── HTML: Reflections Dashboard ──
async function handleDashboard(
  request: Request,
  env: Env
): Promise<Response> {
  const key = keyParam(request);
  const db = getDb(env);

  const [reflectionsR, totalR, domainR, outcomeR, surpriseR] =
    await Promise.all([
      db.execute({
        sql: "SELECT * FROM reflections ORDER BY timestamp DESC LIMIT 200",
        args: [],
      }),
      db.execute("SELECT COUNT(*) as c FROM reflections"),
      db.execute(
        "SELECT domain, COUNT(*) as c FROM reflections WHERE domain IS NOT NULL GROUP BY domain ORDER BY c DESC"
      ),
      db.execute(
        "SELECT outcome, COUNT(*) as c FROM reflections WHERE outcome IS NOT NULL GROUP BY outcome"
      ),
      db.execute(
        "SELECT COUNT(*) as c FROM reflections WHERE surprise IS NOT NULL AND surprise != 'none'"
      ),
    ]);

  const reflections = reflectionsR.rows as unknown as Reflection[];
  const total = Number(totalR.rows[0].c);
  const domainCount = domainR.rows.length;
  const successCount = Number(
    outcomeR.rows.find((r) => r.outcome === "success")?.c || 0
  );
  const successRate =
    total > 0 ? Math.round((successCount / total) * 100) : 0;
  const surpriseCount = Number(surpriseR.rows[0].c);

  const grouped = groupByDay(reflections);

  let timelineHtml = "";
  for (const [day, refs] of grouped) {
    timelineHtml += `<div style="margin-top:24px"><h3 style="color:#9ca3af;font-size:14px;font-weight:500;margin-bottom:12px;padding-bottom:8px;border-bottom:1px solid #262626">${esc(day)} &mdash; ${refs.length} reflection${refs.length > 1 ? "s" : ""}</h3>`;
    for (const r of refs) {
      const time = r.timestamp.slice(11, 16);
      timelineHtml += `
        <details style="margin-bottom:8px;background:#1a1a1a;border-radius:8px;border:1px solid #262626">
          <summary style="padding:12px 16px;cursor:pointer;list-style:none;display:flex;align-items:center;gap:8px;flex-wrap:wrap">
            <span style="color:#6b7280;font-family:monospace;font-size:13px;min-width:44px">${esc(time)}</span>
            <span style="color:#e0e0e0;font-weight:500;flex:1;min-width:200px">${esc(r.title)}</span>
            ${outcomeBadge(r.outcome)}${domainTag(r.domain)}
          </summary>
          <div style="padding:0 16px 16px;border-top:1px solid #262626;margin-top:0">
            <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:8px;margin-top:12px;font-size:13px">
              ${r.goal ? `<div><span style="color:#6b7280">Goal:</span> <span style="color:#d1d5db">${esc(r.goal)}</span></div>` : ""}
              ${r.intended_effect ? `<div><span style="color:#6b7280">Effect:</span> <span style="color:#d1d5db">${esc(r.intended_effect)}</span></div>` : ""}
              ${r.technique ? `<div><span style="color:#6b7280">Technique:</span> <span style="color:#d1d5db">${esc(r.technique)}</span></div>` : ""}
              ${r.surprise && r.surprise !== "none" ? `<div><span style="color:#f59e0b">Surprise:</span> <span style="color:#fbbf24">${esc(r.surprise)}</span></div>` : ""}
            </div>
            ${r.body ? `<pre style="margin-top:12px;padding:12px;background:#0a0a0a;border-radius:6px;color:#a0a0a0;font-size:12px;line-height:1.5;overflow-x:auto;white-space:pre-wrap;max-height:400px;overflow-y:auto">${esc(r.body)}</pre>` : ""}
          </div>
        </details>`;
    }
    timelineHtml += `</div>`;
  }

  let domainBreakdown = "";
  for (const row of domainR.rows) {
    domainBreakdown += `<div style="display:flex;justify-content:space-between;padding:4px 0;font-size:13px"><span style="color:#9ca3af">${esc(row.domain as string)}</span><span style="color:#e0e0e0">${row.c}</span></div>`;
  }

  const body = `
    <!-- Stats cards -->
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin-bottom:24px">
      <div style="background:#1a1a1a;border:1px solid #262626;border-radius:8px;padding:16px">
        <div style="color:#6b7280;font-size:12px;margin-bottom:4px">Total Reflections</div>
        <div style="font-size:28px;font-weight:700;color:#10b981">${total}</div>
      </div>
      <div style="background:#1a1a1a;border:1px solid #262626;border-radius:8px;padding:16px">
        <div style="color:#6b7280;font-size:12px;margin-bottom:4px">Active Domains</div>
        <div style="font-size:28px;font-weight:700;color:#e0e0e0">${domainCount}</div>
      </div>
      <div style="background:#1a1a1a;border:1px solid #262626;border-radius:8px;padding:16px">
        <div style="color:#6b7280;font-size:12px;margin-bottom:4px">Success Rate</div>
        <div style="font-size:28px;font-weight:700;color:#10b981">${successRate}%</div>
      </div>
      <div style="background:#1a1a1a;border:1px solid #262626;border-radius:8px;padding:16px">
        <div style="color:#6b7280;font-size:12px;margin-bottom:4px">Surprises</div>
        <div style="font-size:28px;font-weight:700;color:#f59e0b">${surpriseCount}</div>
      </div>
    </div>

    <!-- Layout: timeline + sidebar -->
    <div style="display:grid;grid-template-columns:1fr 280px;gap:24px">
      <div>
        <h2 style="font-size:16px;font-weight:600;margin-bottom:16px;color:#e0e0e0">Reflections Timeline</h2>
        ${timelineHtml}
      </div>
      <div>
        <div style="background:#1a1a1a;border:1px solid #262626;border-radius:8px;padding:16px;position:sticky;top:24px">
          <h3 style="font-size:14px;font-weight:600;margin-bottom:12px;color:#e0e0e0">By Domain</h3>
          ${domainBreakdown}
        </div>
      </div>
    </div>`;

  return new Response(
    pageShell("Reflections", navHtml(key, "/"), body),
    { headers: { "Content-Type": "text/html;charset=UTF-8" } }
  );
}

// ── HTML: Evolution page ──
async function handleEvolution(
  request: Request,
  env: Env
): Promise<Response> {
  const url = new URL(request.url);
  const key = keyParam(request);
  const db = getDb(env);

  const viewId = url.searchParams.get("view");
  const diffA = url.searchParams.get("a");
  const diffB = url.searchParams.get("b");

  // ─── View single snapshot ───
  if (viewId) {
    const result = await db.execute({
      sql: "SELECT * FROM claude_md_snapshots WHERE id = ?",
      args: [viewId],
    });
    if (result.rows.length === 0) {
      return new Response("Snapshot not found", { status: 404 });
    }
    const snap = result.rows[0] as unknown as Snapshot;
    const lines = snap.content.split("\n");

    const body = `
      <div style="margin-bottom:16px;display:flex;align-items:center;gap:12px;flex-wrap:wrap">
        <a href="/evolution?key=${esc(key)}" style="color:#6b7280;font-size:13px">&larr; Back to timeline</a>
        <span style="color:#4b5563">|</span>
        <span style="color:#9ca3af;font-size:13px">${esc(snap.created_at.slice(0, 19).replace("T", " "))} UTC</span>
        ${triggerBadge(snap.trigger)}
        <span style="color:#4b5563;font-size:12px;font-family:monospace">${esc(snap.hash.slice(0, 12))}</span>
      </div>
      <div style="background:#1a1a1a;border:1px solid #262626;border-radius:8px;overflow:hidden">
        <div style="padding:12px 16px;border-bottom:1px solid #262626;display:flex;justify-content:space-between;align-items:center">
          <span style="font-size:14px;font-weight:600;color:#e0e0e0">CLAUDE.md</span>
          <span style="font-size:12px;color:#6b7280">${lines.length} lines &middot; ${Math.round(snap.content.length / 1024)}KB</span>
        </div>
        <pre style="padding:16px;margin:0;font-family:'SF Mono','Fira Code',monospace;font-size:12px;line-height:1.6;color:#a0a0a0;overflow-x:auto;white-space:pre-wrap;max-height:80vh;overflow-y:auto">${esc(snap.content)}</pre>
      </div>`;

    return new Response(
      pageShell("Snapshot", navHtml(key, "/evolution"), body, {
        noAutoRefresh: true,
      }),
      { headers: { "Content-Type": "text/html;charset=UTF-8" } }
    );
  }

  // ─── Diff between two snapshots ───
  if (diffA && diffB) {
    const [aR, bR] = await Promise.all([
      db.execute({
        sql: "SELECT * FROM claude_md_snapshots WHERE id = ?",
        args: [diffA],
      }),
      db.execute({
        sql: "SELECT * FROM claude_md_snapshots WHERE id = ?",
        args: [diffB],
      }),
    ]);
    if (aR.rows.length === 0 || bR.rows.length === 0) {
      return new Response("Snapshot(s) not found", { status: 404 });
    }
    const snapA = aR.rows[0] as unknown as Snapshot;
    const snapB = bR.rows[0] as unknown as Snapshot;

    // A = older, B = newer (by created_at)
    const older =
      snapA.created_at <= snapB.created_at ? snapA : snapB;
    const newer =
      snapA.created_at <= snapB.created_at ? snapB : snapA;

    const diff = computeDiff(older.content, newer.content);

    // Stats
    const added = diff.filter((d) => d.type === "add").length;
    const removed = diff.filter((d) => d.type === "remove").length;
    const unchanged = diff.filter((d) => d.type === "same").length;

    // Render diff lines
    let diffHtml = "";
    for (const line of diff) {
      const cls =
        line.type === "add"
          ? "diff-add"
          : line.type === "remove"
            ? "diff-remove"
            : "diff-same";
      const marker =
        line.type === "add" ? "+" : line.type === "remove" ? "-" : " ";
      const oldN = line.oldNum != null ? String(line.oldNum) : "";
      const newN = line.newNum != null ? String(line.newNum) : "";
      diffHtml += `<div class="diff-line ${cls}"><span class="diff-gutter">${oldN} ${newN}</span><span class="diff-marker">${marker}</span><span style="flex:1;white-space:pre-wrap">${esc(line.content)}</span></div>`;
    }

    const body = `
      <div style="margin-bottom:16px;display:flex;align-items:center;gap:12px;flex-wrap:wrap">
        <a href="/evolution?key=${esc(key)}" style="color:#6b7280;font-size:13px">&larr; Back to timeline</a>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px">
        <div style="background:#1a1a1a;border:1px solid #262626;border-radius:8px;padding:12px">
          <div style="font-size:11px;color:#6b7280;margin-bottom:4px">OLDER</div>
          <div style="font-size:13px;color:#e0e0e0">${esc(older.created_at.slice(0, 19).replace("T", " "))} UTC</div>
          <div style="font-size:11px;color:#4b5563;font-family:monospace;margin-top:4px">${esc(older.hash.slice(0, 12))}</div>
        </div>
        <div style="background:#1a1a1a;border:1px solid #262626;border-radius:8px;padding:12px">
          <div style="font-size:11px;color:#6b7280;margin-bottom:4px">NEWER</div>
          <div style="font-size:13px;color:#e0e0e0">${esc(newer.created_at.slice(0, 19).replace("T", " "))} UTC</div>
          <div style="font-size:11px;color:#4b5563;font-family:monospace;margin-top:4px">${esc(newer.hash.slice(0, 12))}</div>
        </div>
      </div>
      <div style="display:flex;gap:16px;margin-bottom:16px;font-size:13px">
        <span style="color:#6ee7b7">+${added} added</span>
        <span style="color:#fca5a5">-${removed} removed</span>
        <span style="color:#6b7280">${unchanged} unchanged</span>
      </div>
      <div style="background:#1a1a1a;border:1px solid #262626;border-radius:8px;overflow:hidden;max-height:80vh;overflow-y:auto">
        ${diffHtml}
      </div>`;

    return new Response(
      pageShell("Diff", navHtml(key, "/evolution"), body, {
        noAutoRefresh: true,
      }),
      { headers: { "Content-Type": "text/html;charset=UTF-8" } }
    );
  }

  // ─── Snapshot timeline (default view) ───
  const snapshotsR = await db.execute(
    "SELECT id, hash, created_at, trigger, LENGTH(content) as content_len FROM claude_md_snapshots ORDER BY created_at DESC"
  );
  const snapshots = snapshotsR.rows as unknown as Array<{
    id: string;
    hash: string;
    created_at: string;
    trigger: string;
    content_len: number;
  }>;

  const totalSnapshots = snapshots.length;
  const latestDate = snapshots.length
    ? snapshots[0].created_at.slice(0, 10)
    : "—";
  const triggers = new Set(snapshots.map((s) => s.trigger));

  let timelineHtml = "";
  if (snapshots.length === 0) {
    timelineHtml =
      '<div style="text-align:center;padding:48px;color:#6b7280;font-size:14px">No snapshots yet. Run <code style="color:#10b981">snapshot-claude-md.ts</code> to capture the first one.</div>';
  }

  // Group by date
  const groupedSnaps = new Map<
    string,
    typeof snapshots
  >();
  for (const s of snapshots) {
    const day = s.created_at.slice(0, 10);
    if (!groupedSnaps.has(day)) groupedSnaps.set(day, []);
    groupedSnaps.get(day)!.push(s);
  }

  for (const [day, snaps] of groupedSnaps) {
    timelineHtml += `<div style="margin-top:24px"><h3 style="color:#9ca3af;font-size:14px;font-weight:500;margin-bottom:12px;padding-bottom:8px;border-bottom:1px solid #262626">${esc(day)} &mdash; ${snaps.length} snapshot${snaps.length > 1 ? "s" : ""}</h3>`;
    for (let i = 0; i < snaps.length; i++) {
      const s = snaps[i];
      const time = s.created_at.slice(11, 16);
      const sizeKb = Math.round(Number(s.content_len) / 1024);

      // Find previous snapshot for diff link (next in array = older)
      const prevSnap =
        i + 1 < snaps.length
          ? snaps[i + 1]
          : (() => {
              // Get first snapshot from the next day group
              const days = [...groupedSnaps.keys()];
              const dayIdx = days.indexOf(day);
              if (dayIdx + 1 < days.length) {
                const nextDaySnaps = groupedSnaps.get(
                  days[dayIdx + 1]
                )!;
                return nextDaySnaps[0];
              }
              return null;
            })();

      timelineHtml += `
        <div style="margin-bottom:8px;background:#1a1a1a;border-radius:8px;border:1px solid #262626;padding:12px 16px;display:flex;align-items:center;gap:12px;flex-wrap:wrap">
          <span style="color:#6b7280;font-family:monospace;font-size:13px;min-width:44px">${esc(time)}</span>
          ${triggerBadge(s.trigger)}
          <span style="color:#4b5563;font-size:12px;font-family:monospace">${esc(s.hash.slice(0, 12))}</span>
          <span style="color:#6b7280;font-size:12px">${sizeKb}KB</span>
          <span style="flex:1"></span>
          <a href="/evolution?key=${esc(key)}&view=${esc(s.id)}" style="font-size:12px;color:#10b981;padding:4px 10px;background:#10b98115;border-radius:4px">View</a>
          ${prevSnap ? `<a href="/evolution?key=${esc(key)}&a=${esc(prevSnap.id)}&b=${esc(s.id)}" style="font-size:12px;color:#8b5cf6;padding:4px 10px;background:#8b5cf615;border-radius:4px">Diff&darr;</a>` : ""}
        </div>`;
    }
    timelineHtml += `</div>`;
  }

  // Custom diff selector
  const selectorHtml =
    snapshots.length >= 2
      ? `
    <div style="background:#1a1a1a;border:1px solid #262626;border-radius:8px;padding:16px;margin-top:24px">
      <h3 style="font-size:14px;font-weight:600;margin-bottom:12px;color:#e0e0e0">Compare any two snapshots</h3>
      <form style="display:flex;gap:12px;align-items:end;flex-wrap:wrap" onsubmit="event.preventDefault(); const a=document.getElementById('cmp-a').value; const b=document.getElementById('cmp-b').value; if(a&&b&&a!==b) location.href='/evolution?key=${esc(key)}&a='+a+'&b='+b;">
        <div>
          <label style="font-size:12px;color:#6b7280;display:block;margin-bottom:4px">Snapshot A</label>
          <select id="cmp-a" style="background:#0a0a0a;color:#e0e0e0;border:1px solid #374151;border-radius:4px;padding:6px 8px;font-size:12px;font-family:monospace">
            ${snapshots.map((s) => `<option value="${esc(s.id)}">${esc(s.created_at.slice(0, 16).replace("T", " "))} (${esc(s.hash.slice(0, 8))})</option>`).join("")}
          </select>
        </div>
        <div>
          <label style="font-size:12px;color:#6b7280;display:block;margin-bottom:4px">Snapshot B</label>
          <select id="cmp-b" style="background:#0a0a0a;color:#e0e0e0;border:1px solid #374151;border-radius:4px;padding:6px 8px;font-size:12px;font-family:monospace">
            ${snapshots.map((s, i) => `<option value="${esc(s.id)}" ${i === 1 ? "selected" : ""}>${esc(s.created_at.slice(0, 16).replace("T", " "))} (${esc(s.hash.slice(0, 8))})</option>`).join("")}
          </select>
        </div>
        <button type="submit" style="background:#8b5cf6;color:white;border:none;border-radius:4px;padding:6px 16px;font-size:13px;cursor:pointer;font-weight:500">Compare</button>
      </form>
    </div>`
      : "";

  const body = `
    <!-- Stats cards -->
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin-bottom:24px">
      <div style="background:#1a1a1a;border:1px solid #262626;border-radius:8px;padding:16px">
        <div style="color:#6b7280;font-size:12px;margin-bottom:4px">Total Snapshots</div>
        <div style="font-size:28px;font-weight:700;color:#8b5cf6">${totalSnapshots}</div>
      </div>
      <div style="background:#1a1a1a;border:1px solid #262626;border-radius:8px;padding:16px">
        <div style="color:#6b7280;font-size:12px;margin-bottom:4px">Latest</div>
        <div style="font-size:20px;font-weight:700;color:#e0e0e0">${esc(latestDate)}</div>
      </div>
      <div style="background:#1a1a1a;border:1px solid #262626;border-radius:8px;padding:16px">
        <div style="color:#6b7280;font-size:12px;margin-bottom:4px">Trigger Types</div>
        <div style="font-size:28px;font-weight:700;color:#e0e0e0">${triggers.size}</div>
      </div>
    </div>

    <h2 style="font-size:16px;font-weight:600;margin-bottom:4px;color:#e0e0e0">CLAUDE.md Evolution</h2>
    <p style="font-size:13px;color:#6b7280;margin-bottom:16px">Track how the agent's behavioral DNA changes over time. Each snapshot captures a moment in CLAUDE.md's evolution.</p>
    ${timelineHtml}
    ${selectorHtml}`;

  return new Response(
    pageShell("Evolution", navHtml(key, "/evolution"), body, {
      noAutoRefresh: true,
    }),
    { headers: { "Content-Type": "text/html;charset=UTF-8" } }
  );
}

// ── Worker entry ──
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const authErr = checkAuth(request, env);
    if (authErr) return authErr;

    const url = new URL(request.url);
    const path = url.pathname;

    try {
      // API routes
      if (path === "/api/reflections")
        return await handleApiReflections(request, env);
      if (path === "/api/stats") return await handleApiStats(env);
      if (path === "/api/evolution")
        return await handleApiEvolution(request, env);

      // HTML routes
      if (path === "/evolution")
        return await handleEvolution(request, env);
      return await handleDashboard(request, env);
    } catch (err: any) {
      return new Response(`Error: ${err.message}`, { status: 500 });
    }
  },
};
