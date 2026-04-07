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
  fetchTaskDependencyMap,
  fetchRequests,
  fetchRequestStats,
  fetchSnapshotsMeta,
  fetchSnapshot,
  fetchSnapshotStats,
} from "./db.ts";
import { pageShell } from "./html/layout.ts";
import { renderReflectionsView } from "./views/reflections.ts";
import { renderSessionsView } from "./views/sessions.ts";
import { renderWorkingMemoryView } from "./views/working-memory.ts";
import { renderTasksView } from "./views/tasks.ts";
import { renderRequestsView } from "./views/requests.ts";
import { renderEvolutionView, renderSnapshotView, renderDiffView } from "./views/evolution.ts";

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
    const source = url.searchParams.get("source") ?? undefined;
    const [tasks, stats] = await Promise.all([
      fetchTasks(env, { source }),
      fetchTaskStats(env),
    ]);
    const depMap = await fetchTaskDependencyMap(env, tasks);
    content = renderTasksView(tasks, stats, depMap, source ?? null);
    title = "Tasks";
  } else if (view === "requests") {
    const [requests, stats] = await Promise.all([
      fetchRequests(env),
      fetchRequestStats(env),
    ]);
    content = renderRequestsView(requests, stats);
    title = "Requests";
  } else if (view === "evolution") {
    const [snapshots, stats] = await Promise.all([
      fetchSnapshotsMeta(env),
      fetchSnapshotStats(env),
    ]);
    content = renderEvolutionView(snapshots, stats, key);
    title = "Evolution";
  } else if (view === "snapshot") {
    const id = url.searchParams.get("id");
    if (!id) return new Response("Missing snapshot id", { status: 400 });
    const snap = await fetchSnapshot(env, id);
    if (!snap) return new Response("Snapshot not found", { status: 404 });
    content = renderSnapshotView(snap, key);
    title = "Snapshot";
  } else if (view === "diff") {
    const a = url.searchParams.get("a");
    const b = url.searchParams.get("b");
    if (!a || !b) return new Response("Missing snapshot ids (a, b)", { status: 400 });
    const [snapA, snapB] = await Promise.all([
      fetchSnapshot(env, a),
      fetchSnapshot(env, b),
    ]);
    if (!snapA || !snapB) return new Response("Snapshot(s) not found", { status: 404 });
    content = renderDiffView(snapA, snapB, key);
    title = "Diff";
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

// ── API: tasks ──
async function handleApiTasks(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const tasks = await fetchTasks(env, {
    status: url.searchParams.get("status") ?? undefined,
    limit: parseInt(url.searchParams.get("limit") || "100"),
  });
  return new Response(JSON.stringify(tasks), {
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
  });
}

// ── API: requests ──
async function handleApiRequests(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const requests = await fetchRequests(env, {
    status: url.searchParams.get("status") ?? undefined,
    limit: parseInt(url.searchParams.get("limit") || "100"),
  });
  return new Response(JSON.stringify(requests), {
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
  });
}

// ── API: evolution ──
async function handleApiEvolution(request: Request, env: Env): Promise<Response> {
  const snapshots = await fetchSnapshotsMeta(env);
  return new Response(JSON.stringify(snapshots), {
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
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
      if (path === "/api/tasks") return await handleApiTasks(request, env);
      if (path === "/api/requests") return await handleApiRequests(request, env);
      if (path === "/api/evolution") return await handleApiEvolution(request, env);
      return await handleDashboard(request, env);
    } catch (err: any) {
      return new Response(`Error: ${err.message}`, { status: 500 });
    }
  },
};
