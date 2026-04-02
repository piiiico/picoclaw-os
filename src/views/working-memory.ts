/**
 * Working Memory view — threaded ambient context.
 */

import type { WorkingMemoryEntry, WorkingMemoryStats } from "../types.ts";
import { esc, statCard } from "../html/components.ts";

function groupByThread(entries: WorkingMemoryEntry[]): Map<string, WorkingMemoryEntry[]> {
  const groups = new Map<string, WorkingMemoryEntry[]>();
  for (const e of entries) {
    if (!groups.has(e.thread)) groups.set(e.thread, []);
    groups.get(e.thread)!.push(e);
  }
  return groups;
}

function threadColor(thread: string): string {
  // Deterministic color from thread name
  let hash = 0;
  for (let i = 0; i < thread.length; i++) {
    hash = ((hash << 5) - hash + thread.charCodeAt(i)) | 0;
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 50%, 60%)`;
}

function renderThreadCard(thread: string, entries: WorkingMemoryEntry[]): string {
  const color = threadColor(thread);
  const latest = entries[entries.length - 1];
  const latestDate = latest.created_at?.slice(0, 10) ?? "";

  return `
    <details style="margin-bottom:8px;background:#1a1a1a;border-radius:8px;border:1px solid #262626" open>
      <summary style="padding:12px 16px;cursor:pointer;list-style:none;display:flex;align-items:center;gap:8px;flex-wrap:wrap">
        <span style="width:8px;height:8px;border-radius:50%;background:${color};flex-shrink:0"></span>
        <span style="color:#e0e0e0;font-weight:500;flex:1;min-width:200px">${esc(thread)}</span>
        <span style="color:#6b7280;font-size:12px">${entries.length} entr${entries.length === 1 ? "y" : "ies"}</span>
        <span style="color:#4b5563;font-size:11px;font-family:monospace">${esc(latestDate)}</span>
      </summary>
      <div style="padding:0 16px 12px;border-top:1px solid #262626">
        ${entries
          .map((e) => {
            const date = e.created_at?.slice(0, 10) ?? "";
            return `<div style="padding:6px 0;border-bottom:1px solid #1f1f1f;font-size:13px;display:flex;gap:8px">
              <span style="color:#4b5563;font-family:monospace;font-size:11px;min-width:80px;padding-top:1px">${esc(date)}</span>
              <span style="color:#d1d5db">${esc(e.note)}</span>
            </div>`;
          })
          .join("")}
      </div>
    </details>`;
}

function renderThreadSidebar(grouped: Map<string, WorkingMemoryEntry[]>): string {
  const sorted = [...grouped.entries()].sort((a, b) => {
    const aLatest = a[1][a[1].length - 1].created_at ?? "";
    const bLatest = b[1][b[1].length - 1].created_at ?? "";
    return bLatest.localeCompare(aLatest);
  });

  return sorted
    .map(([thread, entries]) => {
      const color = threadColor(thread);
      return `<div style="display:flex;justify-content:space-between;align-items:center;padding:4px 0;font-size:13px">
        <span style="display:flex;align-items:center;gap:6px;overflow:hidden">
          <span style="width:6px;height:6px;border-radius:50%;background:${color};flex-shrink:0"></span>
          <span style="color:#9ca3af;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(thread)}">${esc(thread)}</span>
        </span>
        <span style="color:#e0e0e0;flex-shrink:0;margin-left:8px">${entries.length}</span>
      </div>`;
    })
    .join("");
}

export function renderWorkingMemoryView(
  entries: WorkingMemoryEntry[],
  stats: WorkingMemoryStats
): string {
  const grouped = groupByThread(entries);

  // Sort threads by most recent entry
  const sortedThreads = [...grouped.entries()].sort((a, b) => {
    const aLatest = a[1][a[1].length - 1].created_at ?? "";
    const bLatest = b[1][b[1].length - 1].created_at ?? "";
    return bLatest.localeCompare(aLatest);
  });

  const newestLabel = stats.newestEntry
    ? stats.newestEntry.slice(0, 16).replace("T", " ")
    : "—";

  return `
    <!-- Stats cards -->
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin-bottom:24px">
      ${statCard("Active Threads", stats.activeThreads, "#10b981")}
      ${statCard("Entries (7d)", stats.totalEntries)}
      ${statCard("Latest", newestLabel, "#3b82f6")}
    </div>

    <!-- Layout: threads + sidebar -->
    <div class="sidebar-grid">
      <div>
        <h2 style="font-size:16px;font-weight:600;margin-bottom:16px;color:#e0e0e0">Working Memory — Last 7 Days</h2>
        ${sortedThreads.map(([thread, entries]) => renderThreadCard(thread, entries)).join("")}
        ${entries.length === 0 ? '<div style="padding:32px;text-align:center;color:#4b5563">No working memory entries in the last 7 days</div>' : ""}
      </div>
      <div>
        <div class="sticky-sidebar" style="background:#1a1a1a;border:1px solid #262626;border-radius:8px;padding:16px">
          <h3 style="font-size:14px;font-weight:600;margin-bottom:12px;color:#e0e0e0">Threads</h3>
          ${renderThreadSidebar(grouped)}
          ${grouped.size === 0 ? '<div style="color:#4b5563;font-size:13px">No threads</div>' : ""}
        </div>
      </div>
    </div>`;
}
