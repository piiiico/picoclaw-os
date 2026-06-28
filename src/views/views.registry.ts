/**
 * View registry — single source of truth for all dashboard views.
 *
 * REGRESSION GUARD: If you add a view to the nav, add it here.
 * If you add it here, it MUST exist in worker.ts routing.
 * The build check (check-views.ts) enforces this at build time.
 */

export const DASHBOARD_VIEWS = [
  "reflections",
  "evolution",
  "tasks",
  "requests",
  "memory",
  "sessions",
  "self-modifications",
] as const;

export type DashboardView = (typeof DASHBOARD_VIEWS)[number];
