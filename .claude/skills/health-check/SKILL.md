---
name: health-check
description: "Run full project audit (quality gates + all 7 merge agents) without merging. Generates tech debt issues."
user_invocable: true
---

# Project Health Check

Run the merge audit phases as a dry-run to assess project state and generate tech debt issues. No merge, no branch required. Run from main.

## Process

### Step 1: Quality gates

Run sequentially — report results but don't abort:

1. `npm run lint` — count errors and warnings
2. `npx vitest run --dir src` — count passed/failed
3. `cd functions && npm run test:run` — count passed/failed
4. `npm run test:coverage 2>&1 | grep -E "does not meet|All files|ERROR"` — verify 80% branch threshold
5. `npx vite build` — pass/fail

Report as summary table. **If coverage is below threshold, flag as blocker** — CI will reject the deploy.

### Step 2: Full audit (all 7 agents, in parallel)

Launch ALL 7 audit agents against the entire `src/` directory (not a diff — full project scan):

1. **dark-mode-auditor** — hardcoded colors across all `.tsx`/`.ts` files
2. **security** — XSS, injection, race conditions, rules, auth bypass
3. **architecture** — separation of concerns, duplication, antipatterns
4. **ui-reviewer** — 360px layout, accessibility, dark mode, empty states
5. **performance** — bundle size, re-renders, memoization, query optimization
6. **privacy-policy** — data collection vs privacy policy consistency
7. **offline-auditor** — uncached reads, unqueued writes, missing fallbacks

Wait for all results before proceeding.

### Step 3: Consolidate findings

Report all results as a summary table with severity counts per agent.

### Step 4: Create tech debt issues

Group findings by domain and create GitHub issues:

```bash
gh issue create --title "Tech debt: <domain> — <summary>" --body "<findings>" --label "enhancement"
```

Domains: security, performance, offline, ui-ux, architecture, dark-mode, privacy.

Only create issues for domains with medium+ findings. Skip if an open issue already covers the same domain — check with `gh issue list --state open`.

### Step 5: Report

Output final summary with:
- Quality gates table
- Audit results table (agent × severity)
- Issues created (with links)
- Top 3 priorities recommendation
