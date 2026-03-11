/**
 * PicoClaw OS Dashboard — Cloudflare Worker
 * Reads reflections from Turso, renders a live dashboard.
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

function groupByDay(reflections: Reflection[]): Map<string, Reflection[]> {
  const groups = new Map<string, Reflection[]>();
  for (const r of reflections) {
    const day = r.timestamp.slice(0, 10);
    if (!groups.has(day)) groups.set(day, []);
    groups.get(day)!.push(r);
  }
  return groups;
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
    args.push(since === "today" ? new Date().toISOString().slice(0, 10) + "T00:00:00Z" : since);
  }
  const domain = url.searchParams.get("domain");
  if (domain) {
    conditions.push("domain = ?");
    args.push(domain);
  }
  const limit = parseInt(url.searchParams.get("limit") || "100");
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const result = await db.execute({
    sql: `SELECT * FROM reflections ${where} ORDER BY timestamp DESC LIMIT ?`,
    args: [...args, limit],
  });

  return new Response(JSON.stringify(result.rows), {
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
  });
}

async function handleApiStats(env: Env): Promise<Response> {
  const db = getDb(env);
  const [totalR, domainR, outcomeR, surpriseR] = await Promise.all([
    db.execute("SELECT COUNT(*) as c FROM reflections"),
    db.execute("SELECT domain, COUNT(*) as c FROM reflections WHERE domain IS NOT NULL GROUP BY domain ORDER BY c DESC"),
    db.execute("SELECT outcome, COUNT(*) as c FROM reflections WHERE outcome IS NOT NULL GROUP BY outcome"),
    db.execute("SELECT COUNT(*) as c FROM reflections WHERE surprise IS NOT NULL AND surprise != 'none'"),
  ]);

  const stats = {
    total: Number(totalR.rows[0].c),
    byDomain: Object.fromEntries(domainR.rows.map((r) => [r.domain, Number(r.c)])),
    byOutcome: Object.fromEntries(outcomeR.rows.map((r) => [r.outcome, Number(r.c)])),
    surpriseCount: Number(surpriseR.rows[0].c),
    domainCount: domainR.rows.length,
  };

  return new Response(JSON.stringify(stats), {
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
  });
}

// ── HTML Dashboard ──
async function handleDashboard(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const key = url.searchParams.get("key");
  const db = getDb(env);

  // Fetch data
  const [reflectionsR, totalR, domainR, outcomeR, surpriseR] = await Promise.all([
    db.execute({ sql: "SELECT * FROM reflections ORDER BY timestamp DESC LIMIT 200", args: [] }),
    db.execute("SELECT COUNT(*) as c FROM reflections"),
    db.execute("SELECT domain, COUNT(*) as c FROM reflections WHERE domain IS NOT NULL GROUP BY domain ORDER BY c DESC"),
    db.execute("SELECT outcome, COUNT(*) as c FROM reflections WHERE outcome IS NOT NULL GROUP BY outcome"),
    db.execute("SELECT COUNT(*) as c FROM reflections WHERE surprise IS NOT NULL AND surprise != 'none'"),
  ]);

  const reflections = reflectionsR.rows as unknown as Reflection[];
  const total = Number(totalR.rows[0].c);
  const domainCount = domainR.rows.length;
  const successCount = Number(outcomeR.rows.find((r) => r.outcome === "success")?.c || 0);
  const successRate = total > 0 ? Math.round((successCount / total) * 100) : 0;
  const surpriseCount = Number(surpriseR.rows[0].c);

  const grouped = groupByDay(reflections);
  const now = new Date().toISOString().slice(0, 19) + "Z";

  // Render timeline
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

  // Domain breakdown for stats
  let domainBreakdown = "";
  for (const row of domainR.rows) {
    domainBreakdown += `<div style="display:flex;justify-content:space-between;padding:4px 0;font-size:13px"><span style="color:#9ca3af">${esc(row.domain as string)}</span><span style="color:#e0e0e0">${row.c}</span></div>`;
  }

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>PicoClaw OS</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: #0a0a0a; color: #e0e0e0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
    details > summary::-webkit-details-marker { display: none; }
    details > summary { list-style: none; }
    details > summary::before { content: "\\25B6"; color: #4b5563; margin-right: 8px; font-size: 10px; transition: transform 0.2s; display: inline-block; }
    details[open] > summary::before { transform: rotate(90deg); }
    a { color: #10b981; text-decoration: none; }
    a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <!-- Top bar -->
  <div style="background:#111;border-bottom:1px solid #262626;padding:16px 24px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px">
    <div style="display:flex;align-items:center;gap:12px">
      <span style="font-size:18px;font-weight:700;color:#10b981">PicoClaw OS</span>
      <span style="color:#4b5563;font-size:12px">Reflections Dashboard</span>
    </div>
    <div style="display:flex;align-items:center;gap:12px;font-size:12px;color:#6b7280">
      <span>Updated: ${esc(now)}</span>
      <span id="refresh-dot" style="width:8px;height:8px;border-radius:50%;background:#10b981;display:inline-block"></span>
    </div>
  </div>

  <div style="max-width:1200px;margin:0 auto;padding:24px">
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
      <!-- Timeline -->
      <div>
        <h2 style="font-size:16px;font-weight:600;margin-bottom:16px;color:#e0e0e0">Reflections Timeline</h2>
        ${timelineHtml}
      </div>

      <!-- Sidebar -->
      <div>
        <div style="background:#1a1a1a;border:1px solid #262626;border-radius:8px;padding:16px;position:sticky;top:24px">
          <h3 style="font-size:14px;font-weight:600;margin-bottom:12px;color:#e0e0e0">By Domain</h3>
          ${domainBreakdown}
        </div>
      </div>
    </div>
  </div>

  <div style="text-align:center;padding:40px 24px;color:#374151;font-size:12px">
    <a href="https://github.com/piiiico/picoclaw-os" target="_blank">picoclaw-os</a> &mdash; open source agent operating system
  </div>

  <script>
    // Auto-refresh every 10 seconds
    setTimeout(() => location.reload(), 10000);
    // Pulse the refresh dot
    const dot = document.getElementById('refresh-dot');
    if (dot) { setInterval(() => { dot.style.opacity = dot.style.opacity === '0.3' ? '1' : '0.3'; }, 5000); }
  </script>
</body>
</html>`;

  return new Response(html, {
    headers: { "Content-Type": "text/html;charset=UTF-8" },
  });
}

// ── Worker entry ──
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const authErr = checkAuth(request, env);
    if (authErr) return authErr;

    const url = new URL(request.url);
    const path = url.pathname;

    try {
      if (path === "/api/reflections") return await handleApiReflections(request, env);
      if (path === "/api/stats") return await handleApiStats(env);
      return await handleDashboard(request, env);
    } catch (err: any) {
      return new Response(`Error: ${err.message}`, { status: 500 });
    }
  },
};
