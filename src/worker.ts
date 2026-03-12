/**
 * PicoClaw OS Dashboard — Cloudflare Worker
 * Reads from Turso, renders a live dashboard.
 * Open source: github.com/piiiico/picoclaw-os
 */

import type { Env } from "./types.ts";
import {
  fetchReflections,
  fetchReflectionStats,
  fetchSessions,
  fetchSessionStats,
  fetchWorkingMemory,
  fetchWorkingMemoryStats,
  fetchTasks,
  fetchTaskStats,
  fetchRequests,
  fetchRequestStats,
} from "./db.ts";
import { pageShell } from "./html/layout.ts";
import { renderReflectionsView } from "./views/reflections.ts";
import { renderSessionsView } from "./views/sessions.ts";
import { renderWorkingMemoryView } from "./views/working-memory.ts";
import { renderTasksView } from "./views/tasks.ts";
import { renderRequestsView } from "./views/requests.ts";

// ── Auth ──
function checkAuth(request: Request, env: Env): Response | null {
  const key = new URL(request.url).searchParams.get("key");
  if (!key || key !== env.DASHBOARD_KEY) {
    return new Response("Unauthorized", { status: 401 });
  }
  return null;
}

// ── API: reflections ──
async function handleApiReflections(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const reflections = await fetchReflections(env, {
    since: url.searchParams.get("since") ?? undefined,
    domain: url.searchParams.get("domain") ?? undefined,
    limit: parseInt(url.searchParams.get("limit") || "100"),
  });
  return new Response(JSON.stringify(reflections), {
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
  });
}

// ── API: stats ──
async function handleApiStats(env: Env): Promise<Response> {
  const stats = await fetchReflectionStats(env);
  return new Response(JSON.stringify(stats), {
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
  });
}

// ── API: sessions ──
async function handleApiSessions(env: Env): Promise<Response> {
  const sessions = await fetchSessions(env);
  return new Response(JSON.stringify(sessions), {
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
  });
}

// ── API: working memory ──
async function handleApiWorkingMemory(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const days = parseInt(url.searchParams.get("days") || "7");
  const entries = await fetchWorkingMemory(env, { days });
  return new Response(JSON.stringify(entries), {
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
  });
}

// ── Dashboard (server-rendered) ──
async function handleDashboard(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const key = url.searchParams.get("key") ?? "";
  const view = url.searchParams.get("view") ?? "reflections";
  const now = new Date().toISOString().slice(0, 19) + "Z";

  let content: string;
  let title: string;

  if (view === "sessions") {
    const [sessions, stats] = await Promise.all([
      fetchSessions(env, 100),
      fetchSessionStats(env),
    ]);
    content = renderSessionsView(sessions, stats);
    title = "Sessions";
  } else if (view === "memory") {
    const [entries, stats] = await Promise.all([
      fetchWorkingMemory(env, { days: 7 }),
      fetchWorkingMemoryStats(env),
    ]);
    content = renderWorkingMemoryView(entries, stats);
    title = "Working Memory";
  } else if (view === "tasks") {
    const [tasks, stats] = await Promise.all([
      fetchTasks(env),
      fetchTaskStats(env),
    ]);
    content = renderTasksView(tasks, stats);
    title = "Tasks";
  } else if (view === "requests") {
    const [requests, stats] = await Promise.all([
      fetchRequests(env),
      fetchRequestStats(env),
    ]);
    content = renderRequestsView(requests, stats);
    title = "Requests";
  } else {
    const [reflections, stats] = await Promise.all([
      fetchReflections(env),
      fetchReflectionStats(env),
    ]);
    content = renderReflectionsView(reflections, stats);
    title = "Reflections";
  }

  const html = pageShell({ title, view, key, content, now });
  return new Response(html, {
    headers: { "Content-Type": "text/html;charset=UTF-8" },
  });
}

// ── Worker entry ──
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const authErr = checkAuth(request, env);
    if (authErr) return authErr;

    const path = new URL(request.url).pathname;

    try {
      if (path === "/api/reflections") return await handleApiReflections(request, env);
      if (path === "/api/stats") return await handleApiStats(env);
      if (path === "/api/sessions") return await handleApiSessions(env);
      if (path === "/api/memory") return await handleApiWorkingMemory(request, env);
      return await handleDashboard(request, env);
    } catch (err: any) {
      return new Response(`Error: ${err.message}`, { status: 500 });
    }
  },
};
