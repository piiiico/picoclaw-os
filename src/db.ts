/**
 * Database layer — all Turso queries in one place.
 */

import { createClient, type Client } from "@libsql/client/web";
import type { Env, Reflection, ReflectionStats, Session, SessionStats, WorkingMemoryEntry, WorkingMemoryStats, Task, TaskStats, PicoRequest, RequestStats } from "./types.ts";

export function getDb(env: Env): Client {
  return createClient({
    url: env.TURSO_URL.replace(/^libsql:\/\//, "https://"),
    authToken: env.TURSO_AUTH_TOKEN,
  });
}

// ── Reflections ──

export async function fetchReflections(
  env: Env,
  opts: { since?: string; domain?: string; limit?: number } = {}
): Promise<Reflection[]> {
  const db = getDb(env);
  const conditions: string[] = [];
  const args: any[] = [];

  if (opts.since) {
    conditions.push("timestamp >= ?");
    args.push(
      opts.since === "today"
        ? new Date().toISOString().slice(0, 10) + "T00:00:00Z"
        : opts.since
    );
  }
  if (opts.domain) {
    conditions.push("domain = ?");
    args.push(opts.domain);
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const limit = opts.limit ?? 200;

  const result = await db.execute({
    sql: `SELECT * FROM reflections ${where} ORDER BY timestamp DESC LIMIT ?`,
    args: [...args, limit],
  });

  return result.rows as unknown as Reflection[];
}

export async function fetchReflectionStats(env: Env): Promise<ReflectionStats> {
  const db = getDb(env);
  const [totalR, domainR, outcomeR, surpriseR] = await Promise.all([
    db.execute("SELECT COUNT(*) as c FROM reflections"),
    db.execute(
      "SELECT domain, COUNT(*) as c FROM reflections WHERE domain IS NOT NULL GROUP BY domain ORDER BY c DESC"
    ),
    db.execute(
      "SELECT outcome, COUNT(*) as c FROM reflections WHERE outcome IS NOT NULL GROUP BY outcome"
    ),
    db.execute(
      "SELECT COUNT(*) as c FROM reflections WHERE surprise IS NOT NULL AND surprise != 'none'"
    ),
  ]);

  return {
    total: Number(totalR.rows[0].c),
    byDomain: domainR.rows as unknown as Array<{ domain: string; c: number }>,
    byOutcome: Object.fromEntries(
      outcomeR.rows.map((r) => [r.outcome, Number(r.c)])
    ),
    surpriseCount: Number(surpriseR.rows[0].c),
  };
}

// ── Sessions ──

export async function fetchSessions(env: Env, limit = 50): Promise<Session[]> {
  const db = getDb(env);
  const result = await db.execute({
    sql: "SELECT * FROM sessions ORDER BY started_at DESC LIMIT ?",
    args: [limit],
  });
  return result.rows as unknown as Session[];
}

export async function fetchSessionStats(env: Env): Promise<SessionStats> {
  const db = getDb(env);
  const today = new Date().toISOString().slice(0, 10) + "T00:00:00Z";

  const [totalR, activeR, todayR, modelsR] = await Promise.all([
    db.execute("SELECT COUNT(*) as c FROM sessions"),
    db.execute("SELECT COUNT(*) as c FROM sessions WHERE ended_at IS NULL"),
    db.execute({
      sql: "SELECT COUNT(*) as c FROM sessions WHERE started_at >= ?",
      args: [today],
    }),
    db.execute(
      "SELECT model, COUNT(*) as c FROM sessions WHERE model IS NOT NULL GROUP BY model ORDER BY c DESC"
    ),
  ]);

  return {
    total: Number(totalR.rows[0].c),
    active: Number(activeR.rows[0].c),
    today: Number(todayR.rows[0].c),
    byModel: modelsR.rows as unknown as Array<{ model: string; c: number }>,
  };
}

// ── Working Memory ──

export async function fetchWorkingMemory(
  env: Env,
  opts: { days?: number } = {}
): Promise<WorkingMemoryEntry[]> {
  const db = getDb(env);
  const days = opts.days ?? 7;
  const since = new Date(Date.now() - days * 86400000).toISOString();

  const result = await db.execute({
    sql: "SELECT * FROM working_memory WHERE created_at >= ? ORDER BY thread, created_at ASC",
    args: [since],
  });

  return result.rows as unknown as WorkingMemoryEntry[];
}

export async function fetchWorkingMemoryStats(env: Env): Promise<WorkingMemoryStats> {
  const db = getDb(env);
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();

  const [totalR, threadsR, rangeR] = await Promise.all([
    db.execute({
      sql: "SELECT COUNT(*) as c FROM working_memory WHERE created_at >= ?",
      args: [sevenDaysAgo],
    }),
    db.execute({
      sql: "SELECT COUNT(DISTINCT thread) as c FROM working_memory WHERE created_at >= ?",
      args: [sevenDaysAgo],
    }),
    db.execute({
      sql: "SELECT MIN(created_at) as oldest, MAX(created_at) as newest FROM working_memory WHERE created_at >= ?",
      args: [sevenDaysAgo],
    }),
  ]);

  return {
    totalEntries: Number(totalR.rows[0].c),
    activeThreads: Number(threadsR.rows[0].c),
    oldestEntry: rangeR.rows[0].oldest as string | null,
    newestEntry: rangeR.rows[0].newest as string | null,
  };
}

// ── Tasks ──

export async function fetchTasks(env: Env, opts: { status?: string; limit?: number } = {}): Promise<Task[]> {
  const db = getDb(env);
  const conditions: string[] = [];
  const args: any[] = [];

  if (opts.status) {
    conditions.push("status = ?");
    args.push(opts.status);
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const limit = opts.limit ?? 100;

  const result = await db.execute({
    sql: `SELECT * FROM tasks ${where} ORDER BY CASE status WHEN 'in_progress' THEN 0 WHEN 'pending' THEN 1 WHEN 'failed' THEN 2 ELSE 3 END, priority DESC, created_at ASC LIMIT ?`,
    args: [...args, limit],
  });

  return result.rows as unknown as Task[];
}

export async function fetchTaskStats(env: Env): Promise<TaskStats> {
  const db = getDb(env);
  const [totalR, statusR, modelR] = await Promise.all([
    db.execute("SELECT COUNT(*) as c FROM tasks"),
    db.execute("SELECT status, COUNT(*) as c FROM tasks GROUP BY status"),
    db.execute("SELECT model, COUNT(*) as c FROM tasks WHERE status = 'pending' GROUP BY model"),
  ]);

  const byStatus = Object.fromEntries(statusR.rows.map((r) => [r.status, Number(r.c)]));
  const byModel = Object.fromEntries(modelR.rows.map((r) => [r.model as string, Number(r.c)]));

  return {
    total: Number(totalR.rows[0].c),
    pending: byStatus.pending || 0,
    completed: byStatus.completed || 0,
    failed: byStatus.failed || 0,
    byModel,
  };
}

// ── Requests ──

export async function fetchRequests(env: Env, opts: { status?: string; limit?: number } = {}): Promise<PicoRequest[]> {
  const db = getDb(env);
  const conditions: string[] = [];
  const args: any[] = [];

  if (opts.status) {
    conditions.push("status = ?");
    args.push(opts.status);
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const limit = opts.limit ?? 100;

  const result = await db.execute({
    sql: `SELECT * FROM requests ${where} ORDER BY CASE status WHEN 'pending' THEN 0 ELSE 1 END, priority DESC, created_at ASC LIMIT ?`,
    args: [...args, limit],
  });

  return result.rows as unknown as PicoRequest[];
}

export async function fetchRequestStats(env: Env): Promise<RequestStats> {
  const db = getDb(env);
  const [totalR, statusR] = await Promise.all([
    db.execute("SELECT COUNT(*) as c FROM requests"),
    db.execute("SELECT status, COUNT(*) as c FROM requests GROUP BY status"),
  ]);

  const byStatus = Object.fromEntries(statusR.rows.map((r) => [r.status, Number(r.c)]));

  return {
    total: Number(totalR.rows[0].c),
    pending: byStatus.pending || 0,
    done: byStatus.done || 0,
  };
}
