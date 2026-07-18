/**
 * Self-Modifications view — the two-engine self-modification loop at a glance.
 *
 * Every entry is a deliberate change to the workspace under one of two engines:
 *   REACH (variation — create what did not exist) / BIND (selection — make what exists bind better).
 * The view joins each change to its Brier prediction (did it work?) and the independent
 * checker's verdict (did an outside reviewer agree?), and surfaces the engine schedule
 * (mode window + floor rule) so Håkon can see where every change sits in the loop.
 */

import type { SelfModEnriched, SelfModMode, PredictionLite, AuditReviewLite, LoopHealth } from "../types.ts";
import { esc } from "../html/components.ts";

// ── Palette: REACH amber, BIND blue, legacy BIND muted, CONSUME gray ──
const MODE_STYLE: Record<SelfModMode, { label: string; color: string; bg: string; border: string }> = {
  REACH:       { label: "REACH",         color: "#f59e0b", bg: "#f59e0b18", border: "#f59e0b55" },
  BIND:        { label: "BIND",          color: "#3b82f6", bg: "#3b82f618", border: "#3b82f655" },
  BIND_LEGACY: { label: "BIND (legacy)", color: "#60a5fa", bg: "#3b82f60d", border: "#3b82f633" },
  CONSUME:     { label: "CONSUME",       color: "#9ca3af", bg: "#9ca3af18", border: "#9ca3af44" },
};

function modeBadge(mode: SelfModMode, small = false): string {
  const s = MODE_STYLE[mode];
  const pad = small ? "1px 6px" : "2px 9px";
  const fs = small ? "10px" : "11px";
  return `<span style="background:${s.bg};color:${s.color};border:1px solid ${s.border};padding:${pad};border-radius:4px;font-size:${fs};font-weight:700;font-family:monospace;letter-spacing:0.3px;white-space:nowrap">${s.label}</span>`;
}

// ── State derivations (single source of truth for both the strip and the cards) ──
function predState(p: PredictionLite | null): { label: string; color: string; short: string } {
  if (!p) return { label: "no prediction", color: "#4b5563", short: "none" };
  const overdue = p.status === "open" && new Date(p.deadline).getTime() < Date.now();
  switch (p.status) {
    case "correct":              return { label: "correct ✓", color: "#10b981", short: "hit" };
    case "wrong":                return { label: "incorrect ✗", color: "#ef4444", short: "miss" };
    case "partial":              return { label: "partial", color: "#f59e0b", short: "partial" };
    case "unmeasurable":         return { label: "unmeasurable", color: "#6b7280", short: "n/a" };
    case "broken_query":         return { label: "broken query", color: "#a78bfa", short: "broke" };
    case "pending_human_review": return { label: "awaiting review", color: "#3b82f6", short: "review" };
    default:
      return overdue
        ? { label: "open · OVERDUE", color: "#ef4444", short: "overdue" }
        : { label: "open", color: "#9ca3af", short: "open" };
  }
}

function checkerState(r: AuditReviewLite | null): { label: string; color: string; short: string } {
  if (!r) return { label: "unreviewed", color: "#f59e0b", short: "pending" };
  if (r.verdict === "CHALLENGE") {
    const open = r.status === "open";
    return { label: open ? "CHALLENGE · open" : "CHALLENGE · resolved", color: open ? "#ef4444" : "#f97316", short: "CHALLENGE" };
  }
  return { label: r.status === "open" ? "PASS · open" : "PASS", color: "#10b981", short: "PASS" };
}

function effectState(effect: string | null): { label: string; color: string; filled: boolean } {
  if (!effect || effect.trim() === "") return { label: "pending", color: "#6b7280", filled: false };
  return { label: effect, color: "#10b981", filled: true };
}

// ── Lifecycle strip: change → prediction → checker → effect (glanceable, no expand needed) ──
function lifecycleStrip(m: SelfModEnriched): string {
  const ms = MODE_STYLE[m.mode];
  const ps = predState(m.prediction);
  const cs = checkerState(m.review);
  const es = effectState(m.effect);
  const seg = (color: string, label: string, title: string) =>
    `<span title="${esc(title)}" style="display:inline-flex;align-items:center;gap:4px;font-size:10px;color:#9ca3af;white-space:nowrap"><span style="width:7px;height:7px;border-radius:50%;background:${color};display:inline-block;flex:none"></span>${esc(label)}</span>`;
  const arrow = `<span style="color:#374151;font-size:10px">→</span>`;
  return `<div style="flex-basis:100%;display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-top:2px;padding-left:24px">
    ${seg(ms.color, "change", "change under mode " + ms.label)}
    ${arrow}${seg(ps.color, "pred·" + ps.short, "prediction: " + ps.label)}
    ${arrow}${seg(cs.color, "chk·" + cs.short, "checker: " + cs.label)}
    ${arrow}${seg(es.color, "eff·" + (es.filled ? "filled" : "pending"), "effect: " + es.label)}
  </div>`;
}

// ── Expanded: prediction join card ──
function predictionCard(p: PredictionLite | null, predId: string | null): string {
  const head = (color: string, badge: string) =>
    `<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;flex-wrap:wrap">
       <span style="color:#8b5cf6;font-size:12px;font-weight:600">Prediction</span>${badge}</div>`;
  if (!p) {
    if (!predId) return `<div style="margin-top:12px">${head("", "")}<span style="color:#4b5563;font-size:12px">— none linked</span></div>`;
    return `<div style="margin-top:12px">${head("", `<span style="font-family:monospace;font-size:11px;color:#6b7280">${esc(predId.slice(0, 8))}</span><span style="color:#f59e0b;font-size:11px">row not found</span>`)}</div>`;
  }
  const st = predState(p);
  const overdue = p.status === "open" && new Date(p.deadline).getTime() < Date.now();
  const conf = Math.round(p.confidence * 100);
  const brier = p.brier_score !== null ? p.brier_score.toFixed(3) : null;
  const badge = `<span style="font-family:monospace;font-size:11px;color:#6b7280" title="${esc(p.id)}">${esc(p.id.slice(0, 8))}</span>
    <span style="background:${st.color}18;color:${st.color};padding:1px 7px;border-radius:4px;font-size:11px;font-weight:600">${esc(st.label)}</span>`;
  return `
    <div style="margin-top:12px">
      ${head("", badge)}
      <div style="color:#d1d5db;font-size:13px;line-height:1.55;padding:10px 12px;background:#0a0a0a;border-radius:6px;border-left:2px solid #8b5cf640">${esc(p.claim)}</div>
      <div style="display:flex;gap:16px;margin-top:8px;font-size:12px;color:#9ca3af;flex-wrap:wrap">
        <span>confidence <strong style="color:#e0e0e0">${conf}%</strong></span>
        <span>deadline <strong style="color:${overdue ? "#ef4444" : "#e0e0e0"}">${esc(p.deadline.slice(0, 10))}${overdue ? " · overdue" : ""}</strong></span>
        ${brier !== null ? `<span>brier <strong style="color:#e0e0e0">${brier}</strong></span>` : ""}
        ${p.actual_value ? `<span>actual <strong style="color:#e0e0e0">${esc(p.actual_value)}</strong></span>` : ""}
      </div>
    </div>`;
}

// ── Expanded: checker join card ──
function checkerCard(r: AuditReviewLite | null): string {
  if (!r) {
    return `
    <div style="margin-top:12px">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
        <span style="color:#f59e0b;font-size:12px;font-weight:600">Checker</span>
        <span style="background:#f59e0b18;color:#f59e0b;padding:1px 7px;border-radius:4px;font-size:11px;font-weight:600">unreviewed</span>
      </div>
      <div style="color:#6b7280;font-size:12px">In the checker backlog — no independent verdict filed yet.</div>
    </div>`;
  }
  const cs = checkerState(r);
  const dispColor = r.recommended_disposition === "revert" ? "#ef4444" : r.recommended_disposition === "re-bind" ? "#f59e0b" : "#9ca3af";
  return `
    <div style="margin-top:12px">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;flex-wrap:wrap">
        <span style="color:${cs.color};font-size:12px;font-weight:600">Checker</span>
        <span style="background:${cs.color}18;color:${cs.color};padding:1px 7px;border-radius:4px;font-size:11px;font-weight:700">${esc(r.verdict)}</span>
        <span style="color:#6b7280;font-size:11px">${esc(r.status)}</span>
        ${r.recommended_disposition ? `<span style="color:${dispColor};font-size:11px">disposition: ${esc(r.recommended_disposition)}</span>` : ""}
        ${r.checker_correct !== null ? `<span style="color:${r.checker_correct ? "#10b981" : "#ef4444"};font-size:11px">checker ${r.checker_correct ? "correct ✓" : "wrong ✗"}</span>` : ""}
      </div>
      ${r.resolution ? `<div style="color:#9ca3af;font-size:12px;line-height:1.5;padding:8px 12px;background:#0a0a0a;border-radius:6px">${esc(r.resolution)}</div>` : ""}
    </div>`;
}

// ── Loop-health header (replaces the four bare stat cards) ──
function panel(title: string, body: string): string {
  return `<div style="background:#1a1a1a;border:1px solid #262626;border-radius:8px;padding:14px 16px">
    <div style="color:#6b7280;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:10px">${esc(title)}</div>
    ${body}
  </div>`;
}

function engineBar(reach: number, bind: number): string {
  const total = reach + bind || 1;
  const rp = Math.round((reach / total) * 100);
  return `<div style="display:flex;height:6px;border-radius:3px;overflow:hidden;background:#262626;margin-top:6px">
    <div style="width:${rp}%;background:${MODE_STYLE.REACH.color}"></div>
    <div style="width:${100 - rp}%;background:${MODE_STYLE.BIND.color}"></div>
  </div>`;
}

function bigNum(n: number, color: string): string {
  return `<span style="font-size:26px;font-weight:700;color:${color}">${n}</span>`;
}

function loopHealthHeader(h: LoopHealth): string {
  // Panel A — mode window + forced next
  const windowBadges = h.modeWindow.length
    ? h.modeWindow.map((w) => `<span title="${esc(w.id)} · ${esc(w.created_at.slice(0, 10))}">${modeBadge(w.mode, true)}</span>`).join(" ")
    : `<span style="color:#4b5563;font-size:12px">no fresh audits yet</span>`;
  const forced = h.forcedNext
    ? `<span style="background:${MODE_STYLE[h.forcedNext].bg};color:${MODE_STYLE[h.forcedNext].color};border:1px dashed ${MODE_STYLE[h.forcedNext].border};padding:3px 10px;border-radius:4px;font-size:12px;font-weight:700;font-family:monospace">FORCED&nbsp;→&nbsp;${h.forcedNext}</span>`
    : `<span style="background:#10b98115;color:#10b981;padding:3px 10px;border-radius:4px;font-size:12px;font-weight:600">free choice</span>`;
  const panelA = panel("Mode window · last 4 fresh audits", `
    <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-bottom:12px">${windowBadges}</div>
    <div style="display:flex;align-items:center;gap:8px"><span style="color:#6b7280;font-size:11px">next audit</span>${forced}</div>
  `);

  // Panel B — engine balance
  const panelB = panel("Engine balance · REACH vs BIND", `
    <div style="display:flex;justify-content:space-between;align-items:baseline">
      <span style="color:#6b7280;font-size:11px">30 days</span>
      <span style="font-size:13px"><strong style="color:${MODE_STYLE.REACH.color}">${h.reach30d}</strong> <span style="color:#4b5563">R</span> · <strong style="color:${MODE_STYLE.BIND.color}">${h.bind30d}</strong> <span style="color:#4b5563">B</span></span>
    </div>
    ${engineBar(h.reach30d, h.bind30d)}
    <div style="display:flex;justify-content:space-between;align-items:baseline;margin-top:10px">
      <span style="color:#6b7280;font-size:11px">all-time</span>
      <span style="font-size:13px"><strong style="color:${MODE_STYLE.REACH.color}">${h.reachAll}</strong> <span style="color:#4b5563">R</span> · <strong style="color:${MODE_STYLE.BIND.color}">${h.bindAll}</strong> <span style="color:#4b5563">B</span></span>
    </div>
    ${engineBar(h.reachAll, h.bindAll)}
  `);

  // Panel C — checker backlog + open challenges
  const backlogColor = h.checkerBacklog > 0 ? "#f59e0b" : "#10b981";
  const challengeColor = h.openChallenges > 0 ? "#ef4444" : "#6b7280";
  const panelC = panel("Checker", `
    <div style="display:flex;align-items:baseline;gap:8px">${bigNum(h.checkerBacklog, backlogColor)}<span style="color:#9ca3af;font-size:12px">unreviewed (backlog)</span></div>
    <div style="display:flex;align-items:center;gap:8px;margin-top:10px">
      <span style="font-size:15px;font-weight:700;color:${challengeColor}">${h.openChallenges}</span>
      <span style="color:${h.openChallenges > 0 ? "#fca5a5" : "#6b7280"};font-size:12px">open CHALLENGE${h.openChallenges === 1 ? "" : "s"}</span>
    </div>
  `);

  // Panel D — predictions due within 7 days
  const dueColor = h.predictionsDue7d > 0 ? "#f59e0b" : "#10b981";
  const panelD = panel("Predictions due", `
    <div style="display:flex;align-items:baseline;gap:8px">${bigNum(h.predictionsDue7d, dueColor)}<span style="color:#9ca3af;font-size:12px">within 7 days</span></div>
    <div style="color:#6b7280;font-size:11px;margin-top:10px">open linked predictions resolving soon (incl. overdue)</div>
  `);

  return `
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;margin-bottom:20px">
      ${panelA}${panelB}${panelC}${panelD}
    </div>`;
}

// ── Timeline ──
function groupByDay(mods: SelfModEnriched[]): Map<string, SelfModEnriched[]> {
  const groups = new Map<string, SelfModEnriched[]>();
  for (const m of mods) {
    const day = m.created_at.slice(0, 10);
    if (!groups.has(day)) groups.set(day, []);
    groups.get(day)!.push(m);
  }
  return groups;
}

function subtractionBadge(): string {
  return `<span style="background:#ef444415;color:#fca5a5;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:500">−&nbsp;subtraction</span>`;
}

function renderTimeline(mods: SelfModEnriched[]): string {
  if (mods.length === 0) {
    return '<div style="text-align:center;padding:48px;color:#6b7280;font-size:14px">No self-modifications recorded yet.</div>';
  }

  let html = "";
  for (const [day, entries] of groupByDay(mods)) {
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
            ${modeBadge(m.mode)}
            <span style="color:#f59e0b;font-family:monospace;font-size:12px;padding:2px 8px;background:#f59e0b10;border-radius:4px;max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(m.artifact)}">${esc(m.artifact)}</span>
            <span style="color:#e0e0e0;flex:1;min-width:180px;font-size:13px">${esc(m.displaySummary)}</span>
            ${m.subtraction ? subtractionBadge() : ""}
            ${lifecycleStrip(m)}
          </summary>
          <div style="padding:0 16px 16px;border-top:1px solid #262626">
            <div style="margin-top:12px;font-size:13px">
              <span style="color:#6b7280">Session:</span>
              <span style="color:#d1d5db;font-family:monospace;font-size:12px">${esc(m.session_id ?? "—")}</span>
            </div>
            ${predictionCard(m.prediction, m.prediction_id)}
            ${checkerCard(m.review)}
            ${m.rationale ? `
            <div style="margin-top:12px">
              <div style="color:#6b7280;font-size:12px;margin-bottom:4px;font-weight:500">Rationale / finding</div>
              <div style="color:#d1d5db;font-size:13px;line-height:1.6;padding:10px 12px;background:#0a0a0a;border-radius:6px">${esc(m.rationale)}</div>
            </div>` : ""}
            ${m.subtraction ? `
            <div style="margin-top:12px">
              <div style="color:#fca5a5;font-size:12px;margin-bottom:4px;font-weight:500">− Subtraction / kill-criterion</div>
              <div style="color:#fcd5d5;font-size:13px;line-height:1.6;padding:10px 12px;background:#ef444408;border-radius:6px;border-left:2px solid #ef444440">${esc(m.subtraction)}</div>
            </div>` : ""}
          </div>
        </details>`;
    }
    html += `</div>`;
  }
  return html;
}

export function renderSelfModificationsView(mods: SelfModEnriched[], health: LoopHealth): string {
  return `
    ${loopHealthHeader(health)}

    <h2 style="font-size:16px;font-weight:600;margin-bottom:4px;color:#e0e0e0">Self-Modifications</h2>
    <p style="font-size:13px;color:#6b7280;margin-bottom:8px;line-height:1.6">
      Two engines drive the loop: <span style="color:${MODE_STYLE.REACH.color}">REACH</span> (variation — a new sense, experiment, or capability)
      and <span style="color:${MODE_STYLE.BIND.color}">BIND</span> (selection — sharpen, absorb, subtract, graduate).
      Each change is joined to its <span style="color:#8b5cf6">prediction</span> (did it work?) and the independent
      <span style="color:#10b981">checker</span>'s verdict (did an outside reviewer agree?). The floor: each engine ≥1 in any 4 consecutive fresh audits.
    </p>
    ${renderTimeline(mods)}`;
}
