/**
 * Reflections view — timeline of all reflection entries.
 */

import type { Reflection, ReflectionStats } from "../types.ts";
import { esc, outcomeBadge, domainTag, statCard } from "../html/components.ts";

function groupByDay(reflections: Reflection[]): Map<string, Reflection[]> {
  const groups = new Map<string, Reflection[]>();
  for (const r of reflections) {
    const day = r.timestamp.slice(0, 10);
    if (!groups.has(day)) groups.set(day, []);
    groups.get(day)!.push(r);
  }
  return groups;
}

function renderTimeline(reflections: Reflection[]): string {
  const grouped = groupByDay(reflections);
  let html = "";

  for (const [day, refs] of grouped) {
    html += `<div style="margin-top:24px">
      <h3 style="color:#9ca3af;font-size:14px;font-weight:500;margin-bottom:12px;padding-bottom:8px;border-bottom:1px solid #262626">
        ${esc(day)} &mdash; ${refs.length} reflection${refs.length > 1 ? "s" : ""}
      </h3>`;

    for (const r of refs) {
      const time = r.timestamp.slice(11, 16);
      html += `
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
    html += `</div>`;
  }

  return html;
}

function renderDomainSidebar(stats: ReflectionStats): string {
  return stats.byDomain
    .map(
      (row) =>
        `<div style="display:flex;justify-content:space-between;padding:4px 0;font-size:13px">
          <span style="color:#9ca3af">${esc(row.domain)}</span>
          <span style="color:#e0e0e0">${row.c}</span>
        </div>`
    )
    .join("");
}

export function renderReflectionsView(
  reflections: Reflection[],
  stats: ReflectionStats
): string {
  const successCount = stats.byOutcome["success"] || 0;
  const successRate =
    stats.total > 0 ? Math.round((successCount / stats.total) * 100) : 0;

  return `
    <!-- Stats cards -->
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin-bottom:24px">
      ${statCard("Total Reflections", stats.total, "#10b981")}
      ${statCard("Active Domains", stats.byDomain.length)}
      ${statCard("Success Rate", `${successRate}%`, "#10b981")}
      ${statCard("Surprises", stats.surpriseCount, "#f59e0b")}
    </div>

    <!-- Layout: timeline + sidebar -->
    <div class="sidebar-grid">
      <div>
        <h2 style="font-size:16px;font-weight:600;margin-bottom:16px;color:#e0e0e0">Reflections Timeline</h2>
        ${renderTimeline(reflections)}
      </div>
      <div>
        <div class="sticky-sidebar" style="background:#1a1a1a;border:1px solid #262626;border-radius:8px;padding:16px">
          <h3 style="font-size:14px;font-weight:600;margin-bottom:12px;color:#e0e0e0">By Domain</h3>
          ${renderDomainSidebar(stats)}
        </div>
      </div>
    </div>`;
}
