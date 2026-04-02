/**
 * Tasks view — Pico's autonomous work queue.
 */

import type { Task, TaskStats } from "../types.ts";
import { esc, statCard } from "../html/components.ts";

function statusIcon(status: string): string {
  switch (status) {
    case "pending": return "⏳";
    case "in_progress": return "🔄";
    case "completed": return "✅";
    case "failed": return "❌";
    case "blocked": return "🚫";
    default: return "•";
  }
}

function modelBadge(model: string): string {
  const color = model === "opus" ? "#8b5cf6" : "#3b82f6";
  return `<span style="background:${color}20;color:${color};padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600">${esc(model)}</span>`;
}

function priorityBadge(priority: number): string {
  const color = priority >= 8 ? "#ef4444" : priority >= 6 ? "#f59e0b" : "#6b7280";
  return `<span style="color:${color};font-size:12px;font-weight:600">p${priority}</span>`;
}

function statusBadge(status: string): string {
  const colors: Record<string, string> = {
    pending: "#f59e0b",
    in_progress: "#3b82f6",
    completed: "#10b981",
    failed: "#ef4444",
    blocked: "#9333ea",
  };
  const color = colors[status] || "#6b7280";
  return `<span style="background:${color}20;color:${color};padding:2px 8px;border-radius:4px;font-size:12px;font-weight:600">${esc(status)}</span>`;
}

function renderTaskRow(task: Task): string {
  const scheduled = task.scheduled_for
    ? `<div style="color:#6b7280;font-size:11px;margin-top:2px">📅 ${esc(task.scheduled_for.slice(0, 16))}</div>`
    : "";
  const blockedInfo = task.blocked_reason
    ? `<div style="color:#9333ea;font-size:11px;margin-top:2px">🚫 ${esc(task.blocked_reason)}${task.blocked_until ? ` · until ${esc(task.blocked_until.slice(0, 10))}` : ""}</div>`
    : "";
  const result = task.result
    ? `<div style="color:#9ca3af;font-size:12px;margin-top:4px;padding:4px 8px;background:#111;border-radius:4px">${esc(task.result.slice(0, 200))}</div>`
    : "";

  return `
    <tr>
      <td style="width:40px;text-align:center">${statusIcon(task.status)}</td>
      <td>
        <div style="font-weight:500;color:#e0e0e0">${esc(task.title)}</div>
        <div style="color:#6b7280;font-size:12px;margin-top:2px">${esc(task.description.slice(0, 150))}${task.description.length > 150 ? "..." : ""}</div>
        ${scheduled}
        ${blockedInfo}
        ${result}
      </td>
      <td style="width:80px;text-align:center">${modelBadge(task.model)}</td>
      <td style="width:50px;text-align:center">${priorityBadge(task.priority)}</td>
      <td style="width:100px">${statusBadge(task.status)}</td>
      <td style="width:90px;color:#4b5563;font-size:11px;font-family:monospace">${esc(task.created_at?.slice(0, 10) ?? "")}</td>
    </tr>`;
}

function renderTaskTable(tasks: Task[]): string {
  return `<div class="table-scroll" style="background:#1a1a1a;border:1px solid #262626;border-radius:8px;margin-bottom:24px">
    <table>
      <thead><tr>
        <th></th><th>Task</th><th>Model</th><th>Pri</th><th>Status</th><th>Created</th>
      </tr></thead>
      <tbody>${tasks.map(renderTaskRow).join("")}</tbody>
    </table>
  </div>`;
}

export function renderTasksView(tasks: Task[], stats: TaskStats): string {
  const now = new Date();

  // Split pending/in_progress into "ready now" vs "waiting for scheduled_for"
  const readyNow = tasks.filter((t) => {
    if (t.status === "in_progress") return true;
    if (t.status !== "pending") return false;
    if (!t.scheduled_for) return true;
    return new Date(t.scheduled_for) <= now;
  });

  const waiting = tasks.filter((t) =>
    t.status === "pending" &&
    t.scheduled_for != null &&
    new Date(t.scheduled_for) > now
  );

  const blocked = tasks.filter((t) => t.status === "blocked");

  const done = tasks.filter((t) => t.status === "completed" || t.status === "failed");

  return `
    <!-- Stats cards -->
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin-bottom:24px">
      ${statCard("Pending", stats.pending, "#f59e0b")}
      ${statCard("Blocked", stats.blocked, "#9333ea")}
      ${statCard("Completed", stats.completed, "#10b981")}
      ${statCard("Failed", stats.failed, "#ef4444")}
      ${statCard("Total", stats.total)}
      ${statCard("Sonnet queue", stats.byModel.sonnet || 0, "#3b82f6")}
      ${statCard("Opus queue", stats.byModel.opus || 0, "#8b5cf6")}
    </div>

    <!-- Ready now -->
    <h2 style="font-size:16px;font-weight:600;margin-bottom:16px;color:#e0e0e0">⚡ Klare nå</h2>
    ${readyNow.length === 0
      ? '<div style="padding:32px;text-align:center;color:#4b5563;background:#1a1a1a;border-radius:8px;margin-bottom:24px">No tasks ready — queue is empty</div>'
      : renderTaskTable(readyNow)}

    <!-- Waiting (scheduled) -->
    ${waiting.length > 0 ? `
      <h2 style="font-size:16px;font-weight:600;margin-bottom:16px;color:#e0e0e0">📅 Venter (${waiting.length})</h2>
      ${renderTaskTable(waiting)}` : ""}

    <!-- Blocked tasks -->
    ${blocked.length > 0 ? `
      <details style="margin-top:16px">
        <summary style="font-size:16px;font-weight:600;color:#9333ea;cursor:pointer;padding:8px 0">🚫 Blokkert (${blocked.length})</summary>
        <div style="margin-top:8px">
          ${renderTaskTable(blocked)}
        </div>
      </details>` : ""}

    <!-- Completed tasks -->
    ${done.length > 0 ? `
      <details style="margin-top:16px">
        <summary style="font-size:16px;font-weight:600;color:#6b7280;cursor:pointer;padding:8px 0">✅ Fullført / Feilet (${done.length})</summary>
        <div class="table-scroll" style="background:#1a1a1a;border:1px solid #262626;border-radius:8px;margin-top:8px">
          <table>
            <thead><tr>
              <th></th><th>Task</th><th>Model</th><th>Pri</th><th>Status</th><th>Created</th>
            </tr></thead>
            <tbody>${done.map(renderTaskRow).join("")}</tbody>
          </table>
        </div>
      </details>` : ""}`;
}
