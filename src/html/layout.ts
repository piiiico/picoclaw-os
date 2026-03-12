/**
 * Page shell: nav, header, footer, global styles.
 */

import { esc } from "./components.ts";

export function pageShell(opts: {
  title: string;
  view: string;
  key: string;
  content: string;
  now: string;
}): string {
  const navLink = (v: string, label: string) => {
    const active = opts.view === v;
    return `<a href="?key=${esc(opts.key)}&view=${v}" class="nav-link" style="padding:6px 14px;border-radius:6px;font-size:13px;font-weight:500;text-decoration:none;${
      active
        ? "background:#1a1a1a;color:#e0e0e0;border:1px solid #374151"
        : "color:#6b7280;border:1px solid transparent"
    }">${label}</a>`;
  };

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(opts.title)} — PicoClaw OS</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: #0a0a0a; color: #e0e0e0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
    details > summary::-webkit-details-marker { display: none; }
    details > summary { list-style: none; }
    details > summary::before { content: "\\25B6"; color: #4b5563; margin-right: 8px; font-size: 10px; transition: transform 0.2s; display: inline-block; }
    details[open] > summary::before { transform: rotate(90deg); }
    a { color: #10b981; text-decoration: none; }
    a:hover { text-decoration: underline; }
    .nav-link:hover { color: #e0e0e0 !important; text-decoration: none !important; }
    .refresh-btn {
      background: #1a1a1a;
      border: 1px solid #374151;
      color: #9ca3af;
      padding: 6px 14px;
      border-radius: 6px;
      font-size: 13px;
      cursor: pointer;
      font-family: inherit;
      transition: border-color 0.15s, color 0.15s;
    }
    .refresh-btn:hover { border-color: #10b981; color: #10b981; }
    table { width: 100%; border-collapse: collapse; }
    th { text-align: left; color: #6b7280; font-size: 12px; font-weight: 500; padding: 8px 12px; border-bottom: 1px solid #262626; }
    td { padding: 10px 12px; border-bottom: 1px solid #1a1a1a; font-size: 13px; vertical-align: middle; }
    tr:hover td { background: #111; }
  </style>
</head>
<body>
  <!-- Top bar -->
  <div style="background:#111;border-bottom:1px solid #262626;padding:14px 24px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px">
    <div style="display:flex;align-items:center;gap:16px">
      <span style="font-size:18px;font-weight:700;color:#10b981">PicoClaw OS</span>
      <nav style="display:flex;gap:4px">
        ${navLink("reflections", "Reflections")}
        ${navLink("tasks", "Tasks")}
        ${navLink("requests", "Requests")}
        ${navLink("memory", "Working Memory")}
        ${navLink("sessions", "Sessions")}
      </nav>
    </div>
    <div style="display:flex;align-items:center;gap:12px;font-size:12px;color:#6b7280">
      <span>Updated: ${esc(opts.now)}</span>
      <button class="refresh-btn" onclick="location.reload()">↺ Refresh</button>
    </div>
  </div>

  <div style="max-width:1200px;margin:0 auto;padding:24px">
    ${opts.content}
  </div>

  <div style="text-align:center;padding:40px 24px;color:#374151;font-size:12px">
    <a href="https://github.com/piiiico/picoclaw-os" target="_blank">picoclaw-os</a> &mdash; open source agent operating system
  </div>
</body>
</html>`;
}
