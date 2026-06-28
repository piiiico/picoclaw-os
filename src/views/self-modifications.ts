/**
 * Self-Modifications view — timeline of all self-modification entries.
 * Each entry represents a deliberate change to the workspace constitution,
 * code, or skills, with rationale, subtraction, and predicted effect.
 */

import type { SelfModification, SelfModificationStats } from "../types.ts";
import { esc, statCard } from "../html/components.ts";

function groupByDay(mods: SelfModification[]): Map<string, SelfModification[]> {
  const groups = new Map<string, SelfModification[]>();
  for (const m of mods) {
    const day = m.created_at.slice(0, 10);
    if (!groups.has(day)) groups.set(day, []);
    groups.get(day)!.push(m);
  }
  return groups;
}

function subtractionBadge(subtraction: string | null): string {
  if (!subtraction) return "";
  return `<span style="background:#ef444415;color:#fca5a5;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:500">−&nbsp;subtraction</span>`;
}

function predictionLink(predictionId: string | null, key: string): string {
  if (!predictionId) return '<span style="color:#4b5563">—</span>';
  const short = predictionId.slice(0, 8);
  return `<span style="font-family:monospace;font-size:12px;color:#8b5cf6" title="${esc(predictionId)}">${esc(short)}</span>`;
}

function effectBadge(effect: string | null): string {
  if (!effect) return `<span style="color:#4b5563;font-size:12px">pending</span>`;
  return `<span style="background:#10b98115;color:#6ee7b7;padding:2px 8px;border-radius:4px;font-size:11px">${esc(effect)}</span>`;
}

function renderTimeline(mods: SelfModification[], key: string): string {
  if (mods.length === 0) {
    return '<div style="text-align:center;padding:48px;color:#6b7280;font-size:14px">No self-modifications recorded yet.</div>';
  }

  const grouped = groupByDay(mods);
  let html = "";

  for (const [day, entries] of grouped) {
    html += `<div style="margin-top:24px">
      <h3 style="color:#9ca3af;font-size:14px;font-weight:500;margin-bottom:12px;padding-bottom:8px;border-bottom:1px solid #262626">
        ${esc(day)} &mdash; ${entries.length} modification${entries.length > 1 ? "s" : ""}
      </h3>`;

    for (const m of entries) {
      const time = m.created_at.slice(11, 16);
      html += `
        <details style="margin-bottom:8px;background:#1a1a1a;border-radius:8px;border:1px solid #262626">
          <summary style="padding:12px 16px;cursor:pointer;list-style:none;display:flex;align-items:center;gap:8px;flex-wrap:wrap">
            <span style="color:#6b7280;font-family:monospace;font-size:13px;min-width:44px">${esc(time)}</span>
            <span style="color:#f59e0b;font-family:monospace;font-size:12px;padding:2px 8px;background:#f59e0b10;border-radius:4px;max-width:280px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(m.artifact)}">${esc(m.artifact)}</span>
            <span style="color:#e0e0e0;flex:1;min-width:200px;font-size:13px">${esc(m.summary)}</span>
            ${m.subtraction ? subtractionBadge(m.subtraction) : ""}
          </summary>
          <div style="padding:0 16px 16px;border-top:1px solid #262626;margin-top:0">
            <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:8px;margin-top:12px;font-size:13px">
              <div><span style="color:#6b7280">Session:</span> <span style="color:#d1d5db;font-family:monospace;font-size:12px">${esc(m.session_id?.slice(0, 12) ?? "—")}</span></div>
              <div><span style="color:#6b7280">Prediction:</span> ${predictionLink(m.prediction_id, key)}</div>
              <div><span style="color:#6b7280">Effect:</span> ${effectBadge(m.effect)}</div>
            </div>
            ${m.rationale ? `
            <div style="margin-top:12px">
              <div style="color:#6b7280;font-size:12px;margin-bottom:4px;font-weight:500">Rationale</div>
              <div style="color:#d1d5db;font-size:13px;line-height:1.6;padding:10px 12px;background:#0a0a0a;border-radius:6px">${esc(m.rationale)}</div>
            </div>` : ""}
            ${m.subtraction ? `
            <div style="margin-top:12px">
              <div style="color:#fca5a5;font-size:12px;margin-bottom:4px;font-weight:500">− Subtraction</div>
              <div style="color:#fcd5d5;font-size:13px;line-height:1.6;padding:10px 12px;background:#ef444408;border-radius:6px;border-left:2px solid #ef444440">${esc(m.subtraction)}</div>
            </div>` : ""}
          </div>
        </details>`;
    }
    html += `</div>`;
  }

  return html;
}

export function renderSelfModificationsView(
  mods: SelfModification[],
  stats: SelfModificationStats
): string {
  const withSubtraction = mods.filter((m) => m.subtraction).length;
  const withEffect = mods.filter((m) => m.effect).length;
  const pendingEffect = stats.total - withEffect;

  return `
    <!-- Stats cards -->
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin-bottom:24px">
      ${statCard("Total", stats.total, "#f59e0b")}
      ${statCard("With Subtraction", withSubtraction, "#ef4444")}
      ${statCard("Effect Pending", pendingEffect, "#6b7280")}
      ${statCard("With Prediction", stats.withPrediction, "#8b5cf6")}
    </div>

    <h2 style="font-size:16px;font-weight:600;margin-bottom:4px;color:#e0e0e0">Self-Modifications</h2>
    <p style="font-size:13px;color:#6b7280;margin-bottom:16px">
      Every deliberate change to workspace constitution, code, or skills — with rationale, what was removed, and predicted effect.
      Ordered newest first. Subtraction is diagnostic (non-negotiable #2).
    </p>
    ${renderTimeline(mods, "")}`;
}
