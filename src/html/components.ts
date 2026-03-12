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
