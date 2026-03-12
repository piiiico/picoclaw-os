/**
 * Requests view — things that need Håkon's action.
 */

import type { PicoRequest, RequestStats } from "../types.ts";
import { esc, statCard } from "../html/components.ts";

function priorityColor(priority: number): string {
  if (priority >= 8) return "#ef4444";
  if (priority >= 6) return "#f59e0b";
  if (priority >= 4) return "#6b7280";
  return "#4b5563";
}

function renderRequestCard(req: PicoRequest): string {
  const isDone = req.status === "done";
  const priColor = priorityColor(req.priority);

  return `
    <div style="background:#1a1a1a;border:1px solid ${isDone ? "#1a1a1a" : "#262626"};border-left:3px solid ${isDone ? "#374151" : priColor};border-radius:8px;padding:16px;margin-bottom:8px;${isDone ? "opacity:0.6" : ""}">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px">
        <div style="flex:1">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
            <span style="font-size:16px">${isDone ? "✅" : "🔴"}</span>
            <span style="font-weight:600;color:${isDone ? "#6b7280" : "#e0e0e0"};font-size:15px">${esc(req.title)}</span>
          </div>
          <div style="color:#9ca3af;font-size:13px;line-height:1.5">${esc(req.description)}</div>
          ${req.result ? `<div style="color:#10b981;font-size:12px;margin-top:8px;padding:6px 10px;background:#10b98110;border-radius:4px">✓ ${esc(req.result)}</div>` : ""}
        </div>
        <div style="flex-shrink:0;text-align:right">
          <div style="color:${priColor};font-weight:700;font-size:14px">p${req.priority}</div>
          <div style="color:#4b5563;font-size:11px;font-family:monospace;margin-top:4px">${esc(req.created_at?.slice(0, 10) ?? "")}</div>
        </div>
      </div>
    </div>`;
}

export function renderRequestsView(requests: PicoRequest[], stats: RequestStats): string {
  const pending = requests.filter((r) => r.status === "pending");
  const done = requests.filter((r) => r.status === "done");

  return `
    <!-- Stats cards -->
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin-bottom:24px">
      ${statCard("Pending", stats.pending, "#ef4444")}
      ${statCard("Done", stats.done, "#10b981")}
      ${statCard("Total", stats.total)}
    </div>

    <h2 style="font-size:16px;font-weight:600;margin-bottom:16px;color:#e0e0e0">Needs Håkon</h2>
    ${pending.length === 0
      ? '<div style="padding:32px;text-align:center;color:#4b5563;background:#1a1a1a;border-radius:8px;margin-bottom:24px">No pending requests — all clear 🎉</div>'
      : pending.map(renderRequestCard).join("")}

    ${done.length > 0 ? `
      <details style="margin-top:24px">
        <summary style="font-size:16px;font-weight:600;color:#6b7280;cursor:pointer;padding:8px 0">Completed (${done.length})</summary>
        <div style="margin-top:8px">
          ${done.map(renderRequestCard).join("")}
        </div>
      </details>` : ""}`;
}
