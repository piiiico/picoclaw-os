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
  };
  const color = colors[status] || "#6b7280";
  return `<span style="background:${color}20;color:${color};padding:2px 8px;border-radius:4px;font-size:12px;font-weight:600">${esc(status)}</span>`;
}

function renderTaskRow(task: Task): string {
  const scheduled = task.scheduled_for
    ? `<div style="color:#6b7280;font-size:11px;margin-top:2px">📅 ${esc(task.scheduled_for.slice(0, 16))}</div>`
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
        ${result}
      </td>
      <td style="width:80px;text-align:center">${modelBadge(task.model)}</td>
      <td style="width:50px;text-align:center">${priorityBadge(task.priority)}</td>
      <td style="width:100px">${statusBadge(task.status)}</td>
      <td style="width:90px;color:#4b5563;font-size:11px;font-family:monospace">${esc(task.created_at?.slice(0, 10) ?? "")}</td>
    </tr>`;
}

export function renderTasksView(tasks: Task[], stats: TaskStats): string {
  const pending = tasks.filter((t) => t.status === "pending" || t.status === "in_progress");
  const done = tasks.filter((t) => t.status === "completed" || t.status === "failed");

  return `
    <!-- Stats cards -->
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin-bottom:24px">
      ${statCard("Pending", stats.pending, "#f59e0b")}
      ${statCard("Completed", stats.completed, "#10b981")}
      ${statCard("Failed", stats.failed, "#ef4444")}
      ${statCard("Total", stats.total)}
      ${statCard("Sonnet queue", stats.byModel.sonnet || 0, "#3b82f6")}
      ${statCard("Opus queue", stats.byModel.opus || 0, "#8b5cf6")}
    </div>

    <!-- Active tasks -->
    <h2 style="font-size:16px;font-weight:600;margin-bottom:16px;color:#e0e0e0">Pending Tasks</h2>
    ${pending.length === 0
      ? '<div style="padding:32px;text-align:center;color:#4b5563;background:#1a1a1a;border-radius:8px;margin-bottom:24px">No pending tasks — queue is empty</div>'
      : `<div style="background:#1a1a1a;border:1px solid #262626;border-radius:8px;margin-bottom:24px;overflow:hidden">
        <table>
          <thead><tr>
            <th></th><th>Task</th><th>Model</th><th>Pri</th><th>Status</th><th>Created</th>
          </tr></thead>
          <tbody>${pending.map(renderTaskRow).join("")}</tbody>
        </table>
      </div>`}

    <!-- Completed tasks -->
    ${done.length > 0 ? `
      <details style="margin-top:16px">
        <summary style="font-size:16px;font-weight:600;color:#6b7280;cursor:pointer;padding:8px 0">Completed / Failed (${done.length})</summary>
        <div style="background:#1a1a1a;border:1px solid #262626;border-radius:8px;margin-top:8px;overflow:hidden">
          <table>
            <thead><tr>
              <th></th><th>Task</th><th>Model</th><th>Pri</th><th>Status</th><th>Created</th>
            </tr></thead>
            <tbody>${done.map(renderTaskRow).join("")}</tbody>
          </table>
        </div>
      </details>` : ""}`;
}
