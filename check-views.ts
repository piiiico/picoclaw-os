#!/usr/bin/env bun
/**
 * Build-time regression check: ensures every registered view
 * has both a nav link in layout.ts and a handler in worker.ts.
 *
 * Run: bun check-views.ts
 * Add to CI or pre-deploy to prevent future regressions.
 */

import { readFileSync } from "fs";
import { DASHBOARD_VIEWS } from "./src/views/views.registry.ts";

const workerSrc = readFileSync("src/worker.ts", "utf-8");
const layoutSrc = readFileSync("src/html/layout.ts", "utf-8");

let failures: string[] = [];

for (const view of DASHBOARD_VIEWS) {
  // Check that the view appears in worker.ts routing
  // Views are routed via: view === "evolution" or similar
  const inWorker =
    workerSrc.includes(`view === "${view}"`) ||
    workerSrc.includes(`view === '${view}'`) ||
    // "reflections" is the else/default case
    view === "reflections";

  if (!inWorker) {
    failures.push(`View "${view}" is registered but has NO handler in worker.ts`);
  }

  // Check that the view appears in layout.ts nav
  const inNav =
    layoutSrc.includes(`"${view}"`) || layoutSrc.includes(`'${view}'`);

  if (!inNav) {
    failures.push(`View "${view}" is registered but has NO nav link in layout.ts`);
  }
}

// Also check for nav links that aren't in the registry
const navLinkPattern = /navLink\("([^"]+)"/g;
let match;
while ((match = navLinkPattern.exec(layoutSrc)) !== null) {
  const navView = match[1];
  if (!DASHBOARD_VIEWS.includes(navView as any)) {
    failures.push(
      `Nav link "${navView}" exists in layout.ts but is NOT in views.registry.ts`
    );
  }
}

if (failures.length > 0) {
  console.error("VIEW REGISTRY CHECK FAILED:");
  for (const f of failures) {
    console.error(`  - ${f}`);
  }
  process.exit(1);
} else {
  console.log(
    `All ${DASHBOARD_VIEWS.length} views verified: nav links + worker handlers present.`
  );
}
