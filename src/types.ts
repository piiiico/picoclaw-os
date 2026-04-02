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
  blocked_reason: string | null;
  blocked_until: string | null;
}

export interface TaskStats {
  total: number;
  pending: number;
  blocked: number;
  completed: number;
  failed: number;
  byModel: Record<string, number>;
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

// ── CLAUDE.md Evolution ──

export interface Snapshot {
  id: string;
  content: string;
  hash: string;
  created_at: string;
  trigger: string;
}

export interface SnapshotMeta {
  id: string;
  hash: string;
  created_at: string;
  trigger: string;
  content_len: number;
}

export interface SnapshotStats {
  total: number;
  latestDate: string;
  triggerCount: number;
}

export interface DiffLine {
  type: "add" | "remove" | "same";
  content: string;
  oldNum?: number;
  newNum?: number;
}
