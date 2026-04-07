/**
 * Tasks view — Pico's autonomous work queue.
 * Redesigned with health metrics, retry visibility, dependency chains, source filtering.
 */

import type { Task, TaskStats, TaskDependencyMap } from "../types.ts";
import { esc, statCard, sourceBadgeTask, retryIndicator, healthScoreGauge } from "../html/components.ts";

// ── Small helpers ──

function statusIcon(status: string): string {
  switch (status) {
    case "pending":        return "⏳";
    case "in_progress":   return "🔄";
    case "completed":     return "✅";
    case "failed":        return "❌";
    case "cancelled":     return "🚫";
    case "blocked":       return "🔒";
    case "pending_review": return "👀";
    case "needs_review":  return "🚨";
    default: return "•";
  }
}

function modelBadge(model: string): string {
  const color = model === "opus" ? "#8b5cf6" : model === "sonnet" ? "#3b82f6" : "#6b7280";
  return `<span style="background:${color}20;color:${color};padding:2px 6px;border-radius:4px;font-size:11px;font-weight:600">${esc(model)}</span>`;
}

function priorityBadge(priority: number, weighted: number): string {
  const color = priority >= 8 ? "#ef4444" : priority >= 6 ? "#f59e0b" : "#6b7280";
  const bonusStr = weighted > priority ? `<span style="color:#4b5563;font-size:9px"> +${weighted - priority}</span>` : "";
  return `<span style="color:${color};font-size:12px;font-weight:600">p${priority}${bonusStr}</span>`;
}

function statusBadge(status: string): string {
  const colors: Record<string, string> = {
    pending:        "#f59e0b",
    in_progress:    "#3b82f6",
    completed:      "#10b981",
    failed:         "#ef4444",
    cancelled:      "#4b5563",
    blocked:        "#8b5cf6",
    pending_review: "#06b6d4",
    needs_review:   "#f97316",
  };
  const color = colors[status] || "#6b7280";
  return `<span style="background:${color}20;color:${color};padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600">${esc(status.replace("_", " "))}</span>`;
}

function depChain(task: Task, depMap: TaskDependencyMap): string {
  const deps = depMap[task.id];
  if (!deps || deps.length === 0) return "";
  const items = deps.map((d) => {
    const doneColor = d.status === "completed" ? "#10b981" : d.status === "failed" ? "#ef4444" : "#6b7280";
    return `<span style="color:${doneColor};font-size:10px" title="${esc(d.status)}">↳ ${esc(d.title.slice(0, 40))}</span>`;
  });
  return `<div style="margin-top:3px;display:flex;flex-wrap:wrap;gap:4px">${items.join("")}</div>`;
}

function renderTaskRow(task: Task, depMap: TaskDependencyMap): string {
  const scheduled = task.scheduled_for
    ? `<span style="color:#6b7280;font-size:10px">📅 ${esc(task.scheduled_for.slice(0, 16))}</span>`
    : "";
  const result = task.result
    ? `<div style="color:#9ca3af;font-size:11px;margin-top:4px;padding:4px 8px;background:#111;border-radius:4px;max-width:500px">${esc(task.result.slice(0, 200))}${task.result.length > 200 ? "…" : ""}</div>`
    : "";
  const failure = task.last_failure_reason && task.status !== "completed"
    ? `<div style="color:#ef444480;font-size:10px;margin-top:2px">⚠ ${esc(task.last_failure_reason.slice(0, 120))}</div>`
    : "";
  const blocked = task.blocked_reason
    ? `<div style="color:#8b5cf680;font-size:10px;margin-top:2px">🔒 ${esc(task.blocked_reason.slice(0, 100))}</div>`
    : "";

  return `
    <tr>
      <td style="width:32px;text-align:center;font-size:14px">${statusIcon(task.status)}</td>
      <td>
        <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
          ${sourceBadgeTask(task.source)}
          <span style="font-weight:500;color:#e0e0e0">${esc(task.title)}</span>
          ${retryIndicator(task.retry_count, task.max_retries)}
        </div>
        <div style="color:#6b7280;font-size:11px;margin-top:2px">${esc(task.description.slice(0, 120))}${task.description.length > 120 ? "…" : ""}</div>
        ${depChain(task, depMap)}
        ${scheduled}
        ${failure}
        ${blocked}
        ${result}
      </td>
      <td style="width:72px;text-align:center">${modelBadge(task.model)}</td>
      <td style="width:56px;text-align:center">${priorityBadge(task.priority, task.weighted_priority)}</td>
      <td style="width:110px">${statusBadge(task.status)}</td>
      <td style="width:82px;color:#4b5563;font-size:10px;font-family:monospace">${esc(task.created_at?.slice(0, 10) ?? "")}</td>
    </tr>`;
}

function taskSection(
  title: string,
  tasks: Task[],
  depMap: TaskDependencyMap,
  opts: { open?: boolean; emptyMsg?: string } = {}
): string {
  if (tasks.length === 0 && !opts.emptyMsg) return "";
  const header = `<summary style="font-size:15px;font-weight:600;cursor:pointer;padding:8px 0;color:#e0e0e0">${esc(title)} <span style="color:#4b5563;font-weight:400;font-size:12px">(${tasks.length})</span></summary>`;
  const body = tasks.length === 0
    ? `<div style="padding:16px;color:#4b5563;font-size:13px">${opts.emptyMsg || ""}</div>`
    : `<div style="background:#1a1a1a;border:1px solid #262626;border-radius:8px;margin-top:8px;overflow:hidden">
        <table>
          <thead><tr>
            <th></th><th>Task</th><th>Model</th><th>Pri</th><th>Status</th><th>Created</th>
          </tr></thead>
          <tbody>${tasks.map((t) => renderTaskRow(t, depMap)).join("")}</tbody>
        </table>
      </div>`;

  return `<details ${opts.open !== false ? "open" : ""} style="margin-bottom:16px">${header}${body}</details>`;
}

// ── Source filter bar ──
function sourceFilterBar(currentSource: string | null, bySource: Record<string, number>): string {
  const all = Object.values(bySource).reduce((a, b) => a + b, 0);
  const sources = [
    { key: null,        label: "All",       count: all },
    { key: "hakon",     label: "Håkon",     count: bySource.hakon || 0 },
    { key: "autonomous",label: "Autonomous",count: bySource.autonomous || 0 },
    { key: "scheduled", label: "Scheduled", count: bySource.scheduled || 0 },
  ];

  return `<div style="display:flex;gap:8px;margin-bottom:20px;flex-wrap:wrap">
    ${sources.map(({ key, label, count }) => {
      const active = currentSource === key;
      const href = key ? `?view=tasks&source=${key}` : `?view=tasks`;
      return `<a href="${href}" style="text-decoration:none;padding:4px 12px;border-radius:4px;font-size:12px;font-weight:${active ? "700" : "400"};background:${active ? "#262626" : "transparent"};border:1px solid ${active ? "#404040" : "#262626"};color:${active ? "#e0e0e0" : "#6b7280"}">${esc(label)} <span style="opacity:0.7">${count}</span></a>`;
    }).join("")}
  </div>`;
}

// ── Main render ──

export function renderTasksView(
  tasks: Task[],
  stats: TaskStats,
  depMap: TaskDependencyMap,
  currentSource: string | null = null
): string {
  // Bucket tasks by status
  const reviewNow      = tasks.filter((t) => t.status === "needs_review");
  const pendingReview  = tasks.filter((t) => t.status === "pending_review");
  const inProgress     = tasks.filter((t) => t.status === "in_progress");
  const stuck          = inProgress.filter((t) => {
    if (!t.picked_up_at) return false;
    return (Date.now() - new Date(t.picked_up_at).getTime()) > 3600000;
  });
  const running        = inProgress.filter((t) => !stuck.includes(t));
  const pending        = tasks.filter((t) => t.status === "pending");
  // "ready now" = pending + no unmet deps
  const readyNow       = pending.filter((t) => {
    const deps = depMap[t.id];
    if (!deps || deps.length === 0) return true;
    return deps.every((d) => d.status === "completed");
  });
  const waiting        = pending.filter((t) => {
    const deps = depMap[t.id];
    return deps && deps.length > 0 && !deps.every((d) => d.status === "completed");
  });
  const blocked        = tasks.filter((t) => t.status === "blocked");
  const cancelled      = tasks.filter((t) => t.status === "cancelled");
  const done           = tasks.filter((t) => t.status === "completed" || t.status === "failed");

  return `
    <!-- Health overview -->
    <div style="background:#1a1a1a;border:1px solid #262626;border-radius:8px;padding:16px;margin-bottom:20px">
      <div style="font-size:13px;color:#6b7280;margin-bottom:8px;font-weight:600">QUEUE HEALTH</div>
      <div style="margin-bottom:10px">${healthScoreGauge(stats.healthScore)}</div>
      <div style="display:flex;gap:20px;flex-wrap:wrap;font-size:12px">
        <span style="color:${stats.stuckCount > 0 ? '#ef4444' : '#4b5563'}">🔴 ${stats.stuckCount} stuck (&gt;1h)</span>
        <span style="color:${stats.zombieCount > 0 ? '#f59e0b' : '#4b5563'}">⚡ ${stats.zombieCount} zombie (failed+retried)</span>
        <span style="color:${stats.blocked > 0 ? '#8b5cf6' : '#4b5563'}">🔒 ${stats.blocked} blocked</span>
        <span style="color:#4b5563">↻ retry rate: ${(stats.retryRate * 100).toFixed(0)}%</span>
        <span style="color:#4b5563">fail rate: ${((stats.failed / Math.max(stats.completed + stats.failed, 1)) * 100).toFixed(0)}%</span>
      </div>
    </div>

    <!-- Stats cards -->
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:10px;margin-bottom:20px">
      ${statCard("Pending", stats.pending + stats.in_progress, "#f59e0b")}
      ${statCard("Completed", stats.completed, "#10b981")}
      ${statCard("Failed", stats.failed, "#ef4444")}
      ${statCard("Blocked", stats.blocked, "#8b5cf6")}
      ${statCard("Sonnet queue", stats.byModel["sonnet"] || 0, "#3b82f6")}
      ${statCard("Opus queue",   stats.byModel["opus"]   || 0, "#8b5cf6")}
      ${statCard("Total", stats.total)}
    </div>

    <!-- Source filter -->
    ${sourceFilterBar(currentSource, stats.bySource)}

    <!-- Review now (urgent) -->
    ${reviewNow.length > 0 ? taskSection("🚨 Needs Review", reviewNow, depMap, { open: true }) : ""}
    ${pendingReview.length > 0 ? taskSection("👀 Pending Review", pendingReview, depMap, { open: true }) : ""}

    <!-- Active / stuck -->
    ${stuck.length > 0 ? taskSection("⚠️ Stuck (>1h in progress)", stuck, depMap, { open: true }) : ""}
    ${taskSection("🔄 In Progress", running, depMap, { open: true, emptyMsg: "No tasks currently running" })}

    <!-- Pending queue -->
    ${taskSection("✅ Ready Now", readyNow, depMap, { open: true, emptyMsg: "Queue empty" })}
    ${waiting.length > 0 ? taskSection("⏳ Waiting on Dependencies", waiting, depMap, { open: true }) : ""}
    ${blocked.length > 0 ? taskSection("🔒 Blocked", blocked, depMap, { open: true }) : ""}

    <!-- Done -->
    ${done.length > 0 ? `
      <details style="margin-bottom:16px">
        <summary style="font-size:15px;font-weight:600;cursor:pointer;padding:8px 0;color:#6b7280">
          Completed / Failed <span style="color:#4b5563;font-weight:400;font-size:12px">(${done.length})</span>
        </summary>
        <div style="background:#1a1a1a;border:1px solid #262626;border-radius:8px;margin-top:8px;overflow:hidden">
          <table>
            <thead><tr>
              <th></th><th>Task</th><th>Model</th><th>Pri</th><th>Status</th><th>Created</th>
            </tr></thead>
            <tbody>${done.slice(0, 100).map((t) => renderTaskRow(t, depMap)).join("")}</tbody>
          </table>
        </div>
        ${done.length > 100 ? `<div style="color:#4b5563;font-size:11px;padding:8px">Showing 100 of ${done.length}</div>` : ""}
      </details>` : ""}

    ${cancelled.length > 0 ? `
      <details style="margin-bottom:16px">
        <summary style="font-size:14px;cursor:pointer;padding:6px 0;color:#4b5563">
          Cancelled <span style="color:#374151;font-size:12px">(${cancelled.length})</span>
        </summary>
        <div style="background:#111;border:1px solid #1f1f1f;border-radius:8px;margin-top:8px;overflow:hidden">
          <table>
            <thead><tr>
              <th></th><th>Task</th><th>Model</th><th>Pri</th><th>Status</th><th>Created</th>
            </tr></thead>
            <tbody>${cancelled.slice(0, 50).map((t) => renderTaskRow(t, depMap)).join("")}</tbody>
          </table>
        </div>
      </details>` : ""}`;
}
