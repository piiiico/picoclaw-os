/**
 * Shared types for PicoClaw OS Dashboard.
 */

export interface Env {
  TURSO_URL: string;
  TURSO_AUTH_TOKEN: string;
  DASHBOARD_KEY: string;
}

export interface Reflection {
  id: string;
  timestamp: string;
  title: string;
  goal: string | null;
  intended_effect: string | null;
  outcome: string | null;
  surprise: string | null;
  technique: string | null;
  domain: string | null;
  body: string;
  session_id: string | null;
  created_at: string;
}

export interface Session {
  session_id: string;
  model: string | null;
  source: string | null;
  started_at: string;
  last_reply_at: string | null;
  ended_at: string | null;
  end_reason: string | null;
  session_type: string | null;
  user_name: string | null;
  user_source: string | null;
  transcript_path: string | null;
  summary: string | null;
  tasks_completed: number;
  tasks_created: number;
  reflections_count: number;
}

export interface ReflectionStats {
  total: number;
  byDomain: Array<{ domain: string; c: number }>;
  byOutcome: Record<string, number>;
  surpriseCount: number;
}

export interface SessionStats {
  total: number;
  active: number;
  today: number;
  byModel: Array<{ model: string; c: number }>;
}

export interface WorkingMemoryEntry {
  id: string;
  thread: string;
  note: string;
  created_at: string;
}

export interface WorkingMemoryStats {
  totalEntries: number;
  activeThreads: number;
  oldestEntry: string | null;
  newestEntry: string | null;
}

// ── Tasks (Pico's work queue) ──

export interface Task {
  id: string;
  title: string;
  description: string;
  status: string;
  model: string;
  priority: number;
  context: string | null;
  created_at: string;
  scheduled_for: string | null;
  picked_up_at: string | null;
  completed_at: string | null;
  result: string | null;
  depends_on: string | null;       // JSON array of task IDs
  source: string | null;           // "hakon" | "autonomous" | "scheduled"
  blocked_reason: string | null;
  blocked_until: string | null;
  retry_count: number;
  max_retries: number;
  last_failure_reason: string | null;
  weighted_priority: number;       // computed: priority + age bonus
}

export interface TaskStats {
  total: number;
  pending: number;
  in_progress: number;
  completed: number;
  failed: number;
  cancelled: number;
  blocked: number;
  pending_review: number;
  needs_review: number;
  byModel: Record<string, number>;
  bySource: Record<string, number>;
  retryRate: number;    // 0-1: fraction of pending tasks with retry_count > 0
  stuckCount: number;   // in_progress > 1h
  zombieCount: number;  // failed with retry_count > 0
  healthScore: number;  // 0-100
}

export interface TaskDependencyMap {
  // task id -> array of { id, title, status }
  [taskId: string]: Array<{ id: string; title: string; status: string }>;
}

// ── Requests (Håkon's action items) ──

export interface PicoRequest {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: number;
  context: string | null;
  created_at: string;
  completed_at: string | null;
  result: string | null;
}

export interface RequestStats {
  total: number;
  pending: number;
  done: number;
}

// ── CLAUDE.md Snapshots ──

export interface Snapshot {
  id: string;
  content: string;
  hash: string;
  created_at: string;
  trigger: string;
  file: string;
}

export interface SnapshotMeta {
  id: string;
  hash: string;
  created_at: string;
  trigger: string;
  content_len: number;
  file: string;
}

export interface SnapshotStats {
  total: number;
  latestDate: string;
  triggerCount: number;
}

// Constitution files tracked by the evolution timeline.
export const SNAPSHOT_FILES = ["my-prompt.md", "CLAUDE.md"] as const;
export type SnapshotFile = (typeof SNAPSHOT_FILES)[number];

export interface DiffLine {
  type: "add" | "remove" | "same";
  content: string;
  oldNum?: number;
  newNum?: number;
}

// ── Self-Modifications ──

export interface SelfModification {
  id: string;
  created_at: string;
  session_id: string | null;
  artifact: string;
  summary: string;
  subtraction: string | null;
  rationale: string | null;
  prediction_id: string | null;
  effect: string | null;
}

export interface SelfModificationStats {
  total: number;
  withPrediction: number;
  withEffect: number;
  withSubtraction: number;
}
