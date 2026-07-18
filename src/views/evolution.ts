/**
 * Evolution view — CLAUDE.md snapshot timeline, viewer, and diff.
 */

import type { Snapshot, SnapshotMeta, SnapshotStats } from "../types.ts";
import { esc, statCard, triggerBadge, computeDiff } from "../html/components.ts";

// ── Single snapshot viewer ──

export function renderSnapshotView(snap: Snapshot, key: string): string {
  const lines = snap.content.split("\n");

  return `
    <div style="margin-bottom:16px;display:flex;align-items:center;gap:12px;flex-wrap:wrap">
      <a href="?key=${esc(key)}&view=evolution&file=${esc(snap.file)}" style="color:#6b7280;font-size:13px">&larr; Back to timeline</a>
      <span style="color:#4b5563">|</span>
      <span style="color:#9ca3af;font-size:13px">${esc(snap.created_at.slice(0, 19).replace("T", " "))} UTC</span>
      ${triggerBadge(snap.trigger)}
      <span style="color:#4b5563;font-size:12px;font-family:monospace">${esc(snap.hash.slice(0, 12))}</span>
    </div>
    <div style="background:#1a1a1a;border:1px solid #262626;border-radius:8px;overflow:hidden">
      <div style="padding:12px 16px;border-bottom:1px solid #262626;display:flex;justify-content:space-between;align-items:center">
        <span style="font-size:14px;font-weight:600;color:#e0e0e0">${esc(snap.file)}</span>
        <span style="font-size:12px;color:#6b7280">${lines.length} lines &middot; ${Math.round(snap.content.length / 1024)}KB</span>
      </div>
      <pre style="padding:16px;margin:0;font-family:'SF Mono','Fira Code',monospace;font-size:12px;line-height:1.6;color:#a0a0a0;overflow-x:auto;white-space:pre-wrap;max-height:80vh;overflow-y:auto">${esc(snap.content)}</pre>
    </div>`;
}

// ── Diff view between two snapshots ──

export function renderDiffView(snapA: Snapshot, snapB: Snapshot, key: string): string {
  // A = older, B = newer (by created_at)
  const older = snapA.created_at <= snapB.created_at ? snapA : snapB;
  const newer = snapA.created_at <= snapB.created_at ? snapB : snapA;

  const diff = computeDiff(older.content, newer.content);

  const added = diff.filter((d) => d.type === "add").length;
  const removed = diff.filter((d) => d.type === "remove").length;
  const unchanged = diff.filter((d) => d.type === "same").length;

  let diffHtml = "";
  for (const line of diff) {
    const cls = line.type === "add" ? "diff-add" : line.type === "remove" ? "diff-remove" : "diff-same";
    const marker = line.type === "add" ? "+" : line.type === "remove" ? "-" : " ";
    const oldN = line.oldNum != null ? String(line.oldNum) : "";
    const newN = line.newNum != null ? String(line.newNum) : "";
    diffHtml += `<div class="diff-line ${cls}"><span class="diff-gutter">${oldN} ${newN}</span><span class="diff-marker">${marker}</span><span style="flex:1;white-space:pre-wrap">${esc(line.content)}</span></div>`;
  }

  return `
    <div style="margin-bottom:16px;display:flex;align-items:center;gap:12px;flex-wrap:wrap">
      <a href="?key=${esc(key)}&view=evolution&file=${esc(newer.file)}" style="color:#6b7280;font-size:13px">&larr; Back to timeline</a>
      <span style="color:#4b5563;font-size:13px;font-family:monospace">${esc(newer.file)}</span>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px">
      <div style="background:#1a1a1a;border:1px solid #262626;border-radius:8px;padding:12px">
        <div style="font-size:11px;color:#6b7280;margin-bottom:4px">OLDER</div>
        <div style="font-size:13px;color:#e0e0e0">${esc(older.created_at.slice(0, 19).replace("T", " "))} UTC</div>
        <div style="font-size:11px;color:#4b5563;font-family:monospace;margin-top:4px">${esc(older.hash.slice(0, 12))}</div>
      </div>
      <div style="background:#1a1a1a;border:1px solid #262626;border-radius:8px;padding:12px">
        <div style="font-size:11px;color:#6b7280;margin-bottom:4px">NEWER</div>
        <div style="font-size:13px;color:#e0e0e0">${esc(newer.created_at.slice(0, 19).replace("T", " "))} UTC</div>
        <div style="font-size:11px;color:#4b5563;font-family:monospace;margin-top:4px">${esc(newer.hash.slice(0, 12))}</div>
      </div>
    </div>
    <div style="display:flex;gap:16px;margin-bottom:16px;font-size:13px">
      <span style="color:#6ee7b7">+${added} added</span>
      <span style="color:#fca5a5">-${removed} removed</span>
      <span style="color:#6b7280">${unchanged} unchanged</span>
    </div>
    <div style="background:#1a1a1a;border:1px solid #262626;border-radius:8px;overflow:hidden;max-height:80vh;overflow-y:auto">
      ${diffHtml}
    </div>`;
}

// ── Snapshot timeline (main evolution view) ──

export function renderEvolutionView(
  snapshots: SnapshotMeta[],
  stats: SnapshotStats,
  key: string,
  file: string = "my-prompt.md"
): string {
  let timelineHtml = "";
  if (snapshots.length === 0) {
    timelineHtml = '<div style="text-align:center;padding:48px;color:#6b7280;font-size:14px">No snapshots yet. Run <code style="color:#10b981">snapshot-claude-md.ts</code> to capture the first one.</div>';
  }

  // Group by date
  const groupedSnaps = new Map<string, SnapshotMeta[]>();
  for (const s of snapshots) {
    const day = s.created_at.slice(0, 10);
    if (!groupedSnaps.has(day)) groupedSnaps.set(day, []);
    groupedSnaps.get(day)!.push(s);
  }

  for (const [day, snaps] of groupedSnaps) {
    timelineHtml += `<div style="margin-top:24px"><h3 style="color:#9ca3af;font-size:14px;font-weight:500;margin-bottom:12px;padding-bottom:8px;border-bottom:1px solid #262626">${esc(day)} &mdash; ${snaps.length} snapshot${snaps.length > 1 ? "s" : ""}</h3>`;
    for (let i = 0; i < snaps.length; i++) {
      const s = snaps[i];
      const time = s.created_at.slice(11, 16);
      const sizeKb = Math.round(Number(s.content_len) / 1024);

      // Find previous snapshot for diff link (next in array = older)
      const prevSnap = i + 1 < snaps.length
        ? snaps[i + 1]
        : (() => {
            const days = [...groupedSnaps.keys()];
            const dayIdx = days.indexOf(day);
            if (dayIdx + 1 < days.length) {
              const nextDaySnaps = groupedSnaps.get(days[dayIdx + 1])!;
              return nextDaySnaps[0];
            }
            return null;
          })();

      timelineHtml += `
        <div style="margin-bottom:8px;background:#1a1a1a;border-radius:8px;border:1px solid #262626;padding:12px 16px;display:flex;align-items:center;gap:12px;flex-wrap:wrap">
          <span style="color:#6b7280;font-family:monospace;font-size:13px;min-width:44px">${esc(time)}</span>
          ${triggerBadge(s.trigger)}
          <span style="color:#4b5563;font-size:12px;font-family:monospace">${esc(s.hash.slice(0, 12))}</span>
          <span style="color:#6b7280;font-size:12px">${sizeKb}KB</span>
          <span style="flex:1"></span>
          <a href="?key=${esc(key)}&view=snapshot&id=${esc(s.id)}" style="font-size:12px;color:#10b981;padding:4px 10px;background:#10b98115;border-radius:4px">View</a>
          ${prevSnap ? `<a href="?key=${esc(key)}&view=diff&a=${esc(prevSnap.id)}&b=${esc(s.id)}&file=${esc(file)}" style="font-size:12px;color:#8b5cf6;padding:4px 10px;background:#8b5cf615;border-radius:4px">Diff&darr;</a>` : ""}
        </div>`;
    }
    timelineHtml += `</div>`;
  }

  // Custom diff selector
  const selectorHtml = snapshots.length >= 2
    ? `
    <div style="background:#1a1a1a;border:1px solid #262626;border-radius:8px;padding:16px;margin-top:24px">
      <h3 style="font-size:14px;font-weight:600;margin-bottom:12px;color:#e0e0e0">Compare any two snapshots</h3>
      <form style="display:flex;gap:12px;align-items:end;flex-wrap:wrap" onsubmit="event.preventDefault(); const a=document.getElementById('cmp-a').value; const b=document.getElementById('cmp-b').value; if(a&&b&&a!==b) location.href='?key=${esc(key)}&view=diff&a='+a+'&b='+b+'&file=${esc(file)}';">
        <div>
          <label style="font-size:12px;color:#6b7280;display:block;margin-bottom:4px">Snapshot A</label>
          <select id="cmp-a" style="background:#0a0a0a;color:#e0e0e0;border:1px solid #374151;border-radius:4px;padding:6px 8px;font-size:12px;font-family:monospace">
            ${snapshots.map((s) => `<option value="${esc(s.id)}">${esc(s.created_at.slice(0, 16).replace("T", " "))} (${esc(s.hash.slice(0, 8))})</option>`).join("")}
          </select>
        </div>
        <div>
          <label style="font-size:12px;color:#6b7280;display:block;margin-bottom:4px">Snapshot B</label>
          <select id="cmp-b" style="background:#0a0a0a;color:#e0e0e0;border:1px solid #374151;border-radius:4px;padding:6px 8px;font-size:12px;font-family:monospace">
            ${snapshots.map((s, i) => `<option value="${esc(s.id)}" ${i === 1 ? "selected" : ""}>${esc(s.created_at.slice(0, 16).replace("T", " "))} (${esc(s.hash.slice(0, 8))})</option>`).join("")}
          </select>
        </div>
        <button type="submit" style="background:#8b5cf6;color:white;border:none;border-radius:4px;padding:6px 16px;font-size:13px;cursor:pointer;font-weight:500">Compare</button>
      </form>
    </div>` : "";

  // File toggle — my-prompt.md (constitution, higher weight) vs CLAUDE.md (operational manual)
  const tab = (f: string, label: string) => {
    const active = f === file;
    return `<a href="?key=${esc(key)}&view=evolution&file=${esc(f)}" style="font-size:13px;padding:6px 14px;border-radius:6px;font-family:monospace;${active ? "background:#8b5cf6;color:#fff;font-weight:600" : "background:#1a1a1a;color:#9ca3af;border:1px solid #262626"}">${esc(label)}</a>`;
  };
  const toggleHtml = `<div style="display:flex;gap:8px;margin-bottom:16px">${tab("my-prompt.md", "my-prompt.md")}${tab("CLAUDE.md", "CLAUDE.md")}</div>`;

  const isConstitution = file === "my-prompt.md";
  const subtitle = isConstitution
    ? "The workspace constitution — always-injected, overrides CLAUDE.md. This file must change the most (non-negotiable #6)."
    : "The operational manual — behavioral DNA, maintained by nightly consolidation.";

  return `
    ${toggleHtml}
    <!-- Stats cards -->
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin-bottom:24px">
      ${statCard("Total Snapshots", stats.total, "#8b5cf6")}
      ${statCard("Latest", stats.latestDate)}
      ${statCard("Trigger Types", stats.triggerCount)}
    </div>

    <h2 style="font-size:16px;font-weight:600;margin-bottom:4px;color:#e0e0e0">${esc(file)} Evolution</h2>
    <p style="font-size:13px;color:#6b7280;margin-bottom:16px">${esc(subtitle)}</p>
    ${timelineHtml}
    ${selectorHtml}`;
}
