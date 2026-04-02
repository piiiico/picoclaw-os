/**
 * Sessions view — card-based session log with full summaries.
 */

import type { Session, SessionStats } from "../types.ts";
import { esc, statusBadge, modelTag, sourceBadge, duration, statCard } from "../html/components.ts";

function statPill(count: number, label: string, color: string): string {
  if (!count) return "";
  return `<span style="background:${color}15;color:${color};padding:1px 6px;border-radius:3px;font-size:11px">${count} ${label}</span>`;
}

function renderSessionCard(s: Session): string {
  const shortId = s.session_id.slice(0, 8) + "…";
  const startTime = s.started_at.slice(0, 16).replace("T", " ");
  const dur = duration(s.started_at, s.ended_at);
  const isActive = !s.ended_at;

  const border = isActive ? "border-left:3px solid #10b981" : "border-left:3px solid transparent";

  return `<div style="background:#1a1a1a;border:1px solid #262626;border-radius:8px;padding:14px 16px;${border}">
    <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
      <span style="font-family:monospace;font-size:11px;color:#4b5563" title="${esc(s.session_id)}">${esc(shortId)}</span>
      ${modelTag(s.model)}
      ${sourceBadge(s.user_source)}
      ${s.session_type ? `<span style="color:#6b7280;font-size:11px">${esc(s.session_type)}</span>` : ""}
      ${s.user_name ? `<span style="color:#9ca3af;font-size:11px">${esc(s.user_name)}</span>` : ""}
      <span style="color:#4b5563">·</span>
      <span style="color:#6b7280;font-family:monospace;font-size:11px">${esc(startTime)}</span>
      <span style="color:#6b7280;font-size:11px">${dur}</span>
      ${statusBadge(s.ended_at)}
      ${s.end_reason ? `<span style="color:#4b5563;font-size:11px">${esc(s.end_reason)}</span>` : ""}
      ${statPill(s.tasks_completed, "done", "#10b981")}
      ${statPill(s.tasks_created, "created", "#3b82f6")}
      ${statPill(s.reflections_count, "refl", "#8b5cf6")}
    </div>
    ${s.summary ? `<div style="color:#9ca3af;font-size:13px;line-height:1.5;margin-top:8px">${esc(s.summary)}</div>` : ""}
  </div>`;
}

function renderModelBreakdown(stats: SessionStats): string {
  return stats.byModel
    .map(
      (row) =>
        `<div style="display:flex;justify-content:space-between;padding:4px 0;font-size:13px">
          <span>${modelTag(row.model)}</span>
          <span style="color:#e0e0e0">${row.c}</span>
        </div>`
    )
    .join("");
}

export function renderSessionsView(
  sessions: Session[],
  stats: SessionStats
): string {
  const activeCount = sessions.filter((s) => !s.ended_at).length;

  return `
    <!-- Stats cards -->
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin-bottom:24px">
      ${statCard("Total Sessions", stats.total)}
      ${statCard("Active Now", activeCount > 0 ? String(activeCount) : "0", activeCount > 0 ? "#10b981" : "#e0e0e0")}
      ${statCard("Today", stats.today, "#3b82f6")}
      ${statCard("Models Used", stats.byModel.length)}
    </div>

    <!-- Layout: cards + sidebar -->
    <div class="sidebar-grid">
      <div>
        <h2 style="font-size:16px;font-weight:600;margin-bottom:16px;color:#e0e0e0">Session Log</h2>
        <div style="display:flex;flex-direction:column;gap:8px">
          ${sessions.map(renderSessionCard).join("")}
          ${sessions.length === 0 ? '<div style="padding:32px;text-align:center;color:#4b5563">No sessions recorded yet</div>' : ""}
        </div>
      </div>

      <div>
        <div class="sticky-sidebar" style="background:#1a1a1a;border:1px solid #262626;border-radius:8px;padding:16px">
          <h3 style="font-size:14px;font-weight:600;margin-bottom:12px;color:#e0e0e0">By Model</h3>
          ${renderModelBreakdown(stats)}
          ${stats.byModel.length === 0 ? '<div style="color:#4b5563;font-size:13px">No data yet</div>' : ""}
        </div>
      </div>
    </div>`;
}
