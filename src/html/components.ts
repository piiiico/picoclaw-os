/**
 * Reusable HTML component primitives.
 */

export function esc(s: string | null | undefined): string {
  if (!s) return "";
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function outcomeBadge(outcome: string | null): string {
  if (!outcome) return "";
  const colors: Record<string, string> = {
    success: "#10b981",
    partial: "#f59e0b",
    failure: "#ef4444",
  };
  const color = colors[outcome] || "#6b7280";
  return `<span style="background:${color}20;color:${color};padding:2px 8px;border-radius:4px;font-size:12px;font-weight:600">${esc(outcome)}</span>`;
}

export function domainTag(domain: string | null): string {
  if (!domain) return "";
  return `<span style="background:#374151;color:#9ca3af;padding:2px 8px;border-radius:4px;font-size:11px;margin-left:6px">${esc(domain)}</span>`;
}

export function statusBadge(endedAt: string | null): string {
  if (!endedAt) {
    return `<span style="background:#10b98120;color:#10b981;padding:2px 8px;border-radius:4px;font-size:12px;font-weight:600">active</span>`;
  }
  return `<span style="background:#37415120;color:#6b7280;padding:2px 8px;border-radius:4px;font-size:12px">ended</span>`;
}

export function modelTag(model: string | null): string {
  if (!model) return '<span style="color:#4b5563">—</span>';
  const short = model.replace("claude-", "").replace("-latest", "");
  const color = model.includes("opus")
    ? "#8b5cf6"
    : model.includes("sonnet")
    ? "#3b82f6"
    : "#6b7280";
  return `<span style="color:${color};font-size:12px;font-weight:500">${esc(short)}</span>`;
}

export function sourceBadge(userSource: string | null): string {
  if (!userSource) return '<span style="color:#4b5563">—</span>';
  const colors: Record<string, string> = {
    telegram: "#2481cc",
    cron: "#f59e0b",
    startup: "#6b7280",
  };
  const color = colors[userSource] || "#6b7280";
  return `<span style="color:${color};font-size:12px">${esc(userSource)}</span>`;
}

export function duration(startedAt: string, endedAt: string | null): string {
  const start = new Date(startedAt).getTime();
  const end = endedAt ? new Date(endedAt).getTime() : Date.now();
  const ms = end - start;
  if (ms < 0 || isNaN(ms)) return "—";
  const mins = Math.floor(ms / 60000);
  const secs = Math.floor((ms % 60000) / 1000);
  if (mins === 0) return `${secs}s`;
  if (mins < 60) return `${mins}m ${secs}s`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

export function statCard(label: string, value: string | number, color = "#e0e0e0"): string {
  return `
    <div style="background:#1a1a1a;border:1px solid #262626;border-radius:8px;padding:16px">
      <div style="color:#6b7280;font-size:12px;margin-bottom:4px">${esc(label)}</div>
      <div style="font-size:28px;font-weight:700;color:${color}">${value}</div>
    </div>`;
}

/** H / A / S pill for task source */
export function sourceBadgeTask(source: string | null): string {
  if (!source) return "";
  const map: Record<string, { label: string; color: string }> = {
    hakon:      { label: "H", color: "#f59e0b" },
    autonomous: { label: "A", color: "#6b7280" },
    scheduled:  { label: "S", color: "#3b82f6" },
  };
  const info = map[source] || { label: source.slice(0, 1).toUpperCase(), color: "#6b7280" };
  return `<span title="${esc(source)}" style="background:${info.color}30;color:${info.color};padding:1px 6px;border-radius:3px;font-size:10px;font-weight:700;font-family:monospace">${info.label}</span>`;
}

/** "↻ X/Y" retry indicator — only renders when retry_count > 0 */
export function retryIndicator(retryCount: number, maxRetries: number): string {
  if (!retryCount) return "";
  const color = retryCount >= maxRetries ? "#ef4444" : "#f59e0b";
  return `<span style="color:${color};font-size:11px;margin-left:4px" title="retry ${retryCount} of ${maxRetries}">↻ ${retryCount}/${maxRetries}</span>`;
}

/** 0-100 health gauge rendered as colored text with a mini bar */
export function healthScoreGauge(score: number): string {
  const color = score >= 80 ? "#10b981" : score >= 60 ? "#f59e0b" : "#ef4444";
  const filled = Math.round(score / 10);
  const bar = "█".repeat(filled) + "░".repeat(10 - filled);
  return `<span style="color:${color};font-family:monospace;font-size:13px" title="Queue health score">${bar} ${score}</span>`;
}
export function triggerBadge(trigger: string): string {
  const colors: Record<string, string> = {
    consolidation: "#8b5cf6",
    manual: "#6b7280",
    session: "#3b82f6",
  };
  const color = colors[trigger] || "#6b7280";
  return `<span style="background:${color}20;color:${color};padding:2px 8px;border-radius:4px;font-size:12px;font-weight:500">${esc(trigger)}</span>`;
}

// ── Diff algorithm (LCS-based, line-level) ──
import type { DiffLine } from "../types.ts";

export function computeDiff(oldText: string, newText: string): DiffLine[] {
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
  let i = m, j = n;
  const stack: DiffLine[] = [];

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      stack.push({ type: "same", content: oldLines[i - 1], oldNum: i, newNum: j });
      i--; j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      stack.push({ type: "add", content: newLines[j - 1], newNum: j });
      j--;
    } else {
      stack.push({ type: "remove", content: oldLines[i - 1], oldNum: i });
      i--;
    }
  }

  while (stack.length) result.push(stack.pop()!);
  return result;
}
