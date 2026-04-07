/**
 * Database layer — all Turso queries in one place.
 */

import { createClient, type Client } from "@libsql/client/web";
import type { Env, Reflection, ReflectionStats, Session, SessionStats, WorkingMemoryEntry, WorkingMemoryStats, Task, TaskStats, TaskDependencyMap, PicoRequest, RequestStats, Snapshot, SnapshotMeta, SnapshotStats } from "./types.ts";

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

export async function fetchTasks(
  env: Env,
  opts: { status?: string; source?: string; limit?: number } = {}
): Promise<Task[]> {
  const db = getDb(env);
  const conditions: string[] = [];
  const args: any[] = [];

  if (opts.status) {
    conditions.push("status = ?");
    args.push(opts.status);
  }
  if (opts.source) {
    conditions.push("source = ?");
    args.push(opts.source);
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const limit = opts.limit ?? 300;

  const result = await db.execute({
    sql: `SELECT *,
      (priority + CAST((julianday('now') - julianday(created_at)) * 0.1 AS INTEGER)) as weighted_priority
    FROM tasks ${where}
    ORDER BY
      CASE status
        WHEN 'needs_review'   THEN 0
        WHEN 'pending_review' THEN 1
        WHEN 'in_progress'    THEN 2
        WHEN 'pending'        THEN 3
        WHEN 'blocked'        THEN 4
        WHEN 'failed'         THEN 5
        WHEN 'cancelled'      THEN 6
        ELSE 7
      END,
      (priority + CAST((julianday('now') - julianday(created_at)) * 0.1 AS INTEGER)) DESC,
      created_at ASC
    LIMIT ?`,
    args: [...args, limit],
  });

  return result.rows as unknown as Task[];
}

export async function fetchTaskStats(env: Env): Promise<TaskStats> {
  const db = getDb(env);
  const [statsR, modelR, sourceR] = await Promise.all([
    db.execute(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'pending'        THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'in_progress'    THEN 1 ELSE 0 END) as in_progress,
        SUM(CASE WHEN status = 'completed'      THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status = 'failed'         THEN 1 ELSE 0 END) as failed,
        SUM(CASE WHEN status = 'cancelled'      THEN 1 ELSE 0 END) as cancelled,
        SUM(CASE WHEN status = 'blocked'        THEN 1 ELSE 0 END) as blocked,
        SUM(CASE WHEN status = 'pending_review' THEN 1 ELSE 0 END) as pending_review,
        SUM(CASE WHEN status = 'needs_review'   THEN 1 ELSE 0 END) as needs_review,
        SUM(CASE WHEN status = 'in_progress'
                  AND picked_up_at < datetime('now', '-1 hour') THEN 1 ELSE 0 END) as stuck,
        SUM(CASE WHEN status = 'failed'
                  AND retry_count > 0 THEN 1 ELSE 0 END) as zombie,
        SUM(CASE WHEN (status = 'pending' OR status = 'in_progress')
                  AND retry_count > 0 THEN 1 ELSE 0 END) as with_retries,
        SUM(CASE WHEN status IN ('pending','in_progress') THEN 1 ELSE 0 END) as active_total
      FROM tasks
    `),
    db.execute(`
      SELECT model, COUNT(*) as c FROM tasks
      WHERE status IN ('pending','in_progress','pending_review','needs_review','blocked')
      GROUP BY model
    `),
    db.execute(`
      SELECT source, COUNT(*) as c FROM tasks GROUP BY source
    `),
  ]);

  const row = statsR.rows[0] as any;
  const total = Number(row.total);
  const completed = Number(row.completed);
  const failed = Number(row.failed);
  const stuckCount = Number(row.stuck);
  const zombieCount = Number(row.zombie);
  const blockedCount = Number(row.blocked);
  const withRetries = Number(row.with_retries);
  const activeTotal = Number(row.active_total);
  const retryRate = activeTotal > 0 ? withRetries / activeTotal : 0;
  const failRate = (completed + failed) > 0 ? failed / (completed + failed) : 0;

  const healthScore = Math.max(0, Math.min(100,
    100
    - (stuckCount * 10)
    - (zombieCount * 2)
    - (blockedCount * 5)
    - (retryRate * 30)
    - (failRate * 20)
  ));

  const byModel = Object.fromEntries(modelR.rows.map((r: any) => [r.model as string, Number(r.c)]));
  const bySource = Object.fromEntries(sourceR.rows.map((r: any) => [r.source as string, Number(r.c)]));

  return {
    total,
    pending: Number(row.pending),
    in_progress: Number(row.in_progress),
    completed,
    failed,
    cancelled: Number(row.cancelled),
    blocked: blockedCount,
    pending_review: Number(row.pending_review),
    needs_review: Number(row.needs_review),
    byModel,
    bySource,
    retryRate,
    stuckCount,
    zombieCount,
    healthScore: Math.round(healthScore),
  };
}

export async function fetchTaskDependencyMap(env: Env, tasks: Task[]): Promise<TaskDependencyMap> {
  // Collect all unique dep IDs from tasks that have depends_on
  const depIds = new Set<string>();
  for (const task of tasks) {
    if (task.depends_on) {
      try {
        const ids: string[] = JSON.parse(task.depends_on);
        ids.forEach((id) => depIds.add(id));
      } catch {}
    }
  }

  if (depIds.size === 0) return {};

  // Fetch titles and statuses for all dep IDs
  const db = getDb(env);
  const placeholders = Array.from(depIds).map(() => "?").join(",");
  const result = await db.execute({
    sql: `SELECT id, title, status FROM tasks WHERE id IN (${placeholders})`,
    args: Array.from(depIds),
  });

  const depInfo = new Map<string, { id: string; title: string; status: string }>();
  for (const row of result.rows as any[]) {
    depInfo.set(row.id, { id: row.id, title: row.title, status: row.status });
  }

  // Build map: taskId -> resolved dep objects
  const map: TaskDependencyMap = {};
  for (const task of tasks) {
    if (task.depends_on) {
      try {
        const ids: string[] = JSON.parse(task.depends_on);
        map[task.id] = ids.map((id) => depInfo.get(id) || { id, title: "(unknown)", status: "unknown" });
      } catch {}
    }
  }
  return map;
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

// ── CLAUDE.md Snapshots ──

export async function fetchSnapshotsMeta(env: Env): Promise<SnapshotMeta[]> {
  const db = getDb(env);
  const result = await db.execute(
    "SELECT id, hash, created_at, trigger, LENGTH(content) as content_len FROM claude_md_snapshots ORDER BY created_at DESC"
  );
  return result.rows as unknown as SnapshotMeta[];
}

export async function fetchSnapshot(env: Env, id: string): Promise<Snapshot | null> {
  const db = getDb(env);
  const result = await db.execute({
    sql: "SELECT * FROM claude_md_snapshots WHERE id = ?",
    args: [id],
  });
  return result.rows.length > 0 ? (result.rows[0] as unknown as Snapshot) : null;
}

export async function fetchSnapshotStats(env: Env): Promise<SnapshotStats> {
  const db = getDb(env);
  const [totalR, latestR, triggersR] = await Promise.all([
    db.execute("SELECT COUNT(*) as c FROM claude_md_snapshots"),
    db.execute("SELECT created_at FROM claude_md_snapshots ORDER BY created_at DESC LIMIT 1"),
    db.execute("SELECT COUNT(DISTINCT trigger) as c FROM claude_md_snapshots"),
  ]);

  return {
    total: Number(totalR.rows[0].c),
    latestDate: latestR.rows.length > 0 ? (latestR.rows[0].created_at as string).slice(0, 10) : "—",
    triggerCount: Number(triggersR.rows[0].c),
  };
}
