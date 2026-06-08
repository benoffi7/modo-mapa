---
name: health-check
description: "Run full project audit (quality gates + all 12 audit agents) without merging. Generates tech debt issues."
user-invocable: true
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

### Step 2: Full audit (all 12 agents, in parallel)

Launch ALL audit agents against the entire `src/` directory (not a diff — full project scan):

**Core auditors (always run):**
1. **dark-mode-auditor** — hardcoded colors across all `.tsx`/`.ts` files
2. **security** — XSS, injection, race conditions, rules, auth bypass
3. **architecture** — separation of concerns, duplication, antipatterns
4. **ui-reviewer** — 360px layout, accessibility, dark mode, empty states
5. **performance** — bundle size, re-renders, memoization, query optimization
6. **privacy-policy** — data collection vs privacy policy consistency
7. **offline-auditor** — uncached reads, unqueued writes, missing fallbacks
8. **copy-auditor** — spelling errors, missing tildes, tone inconsistencies in user-facing strings

**Specialized auditors (always run in health-check):**
9. **perf-auditor** — Firestore query instrumentation (measureAsync) and Cloud Function trigger timing (trackFunctionTiming)
10. **admin-metrics-auditor** — verify all data collections and analytics events have admin dashboard visibility
11. **help-docs-reviewer** — validate HelpSection content matches features.md
12. **pr-reviewer** — overall code quality review of `src/` (treat as a full-project PR review)

Wait for all results before proceeding.

### Step 2b: Fallback — manual grep-based audit

If agents fail (quota exhausted, timeouts, empty results), run these grep-based checks directly instead:

```bash
# Dark mode: hardcoded colors in components (exclude admin/, test, ThemePlayground, constants)
grep -rn "#[0-9a-fA-F]\{3,8\}" src/components/ --include="*.tsx" | grep -v admin/ | grep -v test | grep -v ThemePlayground

# Security: dangerous patterns
grep -rn "dangerouslySetInnerHTML\|eval(\|innerHTML" src/ --include="*.ts" --include="*.tsx"

# Architecture: firebase/firestore imports in components (should be 0)
grep -rn "from 'firebase/firestore'" src/components/ --include="*.tsx"

# Architecture: console.* usage (should use logger)
grep -rn "console\.\(error\|log\|warn\)(" src/ --include="*.ts" --include="*.tsx" | grep -v test | grep -v logger.ts | grep -v sentry.ts | wc -l

# Performance: getCountFromServer without offline guard
grep -rn "getCountFromServer" src/ --include="*.ts" | grep -v test | grep -v getCountOfflineSafe

# Offline: httpsCallable in user-facing components without offline guard
grep -rn "httpsCallable" src/components/ src/services/ --include="*.ts" --include="*.tsx" | grep -v admin | grep -v test

# Privacy: new data collection patterns
grep -rn "logEvent\|addDoc\|setDoc\|collection(" src/services/ --include="*.ts" | grep -v test
```

Report each grep result as a finding with severity. This is less thorough than agents but catches the most common issues.

### Step 3: Consolidate findings + cross-reference the guard baseline

First, capture the current guard state so findings can be classified:

```bash
cat .guards-baseline.json        # locked ceiling per rule — non-zero = already-tracked debt
npm run guards:check || true     # reports REGRESSIONS (counts above baseline = real new drift)
```

`.guards-baseline.json` is `{ "<guardId>": { "<ruleId>": <count> }, "_total": n }`.
A rule with a non-zero baseline is debt the guard already tracks. `guards:check`
exits non-zero and lists any rule whose CURRENT count exceeds the baseline — those
are genuine new regressions.

Many audit agents re-report debt that is **already tracked by a guard** (e.g.
`performance` flags `fetchUserLikes`, which is `302/R-fetchUserLikes-removed`
baselined at 15; `admin-metrics` flags `_ipRateLimits`, which is `310/R4`). Those
are NOT new — creating issues for them produces duplicates and noise.

Classify every finding before reporting:

- **`[YA-GUARDADO #nnn]`** — a guard rule already covers it (the domain maps to a
  guard id, and the rule's baseline count is ≥ 1). The ratchet already prevents it
  from growing. Mention it in the report, but **do not create an issue**.
- **`[NUEVO]`** — no guard rule covers it, OR a guarded rule's current count
  exceeds its baseline (a real regression). These need attention.

Domain → guard map: security→300, coverage→301, performance→302,
perf-instrumentation→303, offline→304, ui-ux→305, architecture→306,
dark-mode→307, privacy→308, copy→309, admin-metrics→310, help-docs→311,
correctness→312. A finding is `[YA-GUARDADO]` when its matching rule exists in
`checks.mjs` and is non-zero in the baseline.

Report all results as a summary table with severity counts per agent, each
finding tagged `[NUEVO]` or `[YA-GUARDADO #nnn]`.

### Step 4: Create tech debt issues — only for `[NUEVO]` findings

Group `[NUEVO]` findings by domain and create GitHub issues:

```bash
gh issue create --title "Tech debt: <domain> — <summary>" --body "<findings>" --label "enhancement"
```

Domains: security, performance, perf-instrumentation, offline, ui-ux, architecture, dark-mode, privacy, copy, admin-metrics, help-docs, correctness.

Rules:
- Only create issues for **`[NUEVO]`** domains with medium+ findings. Never create
  an issue for a `[YA-GUARDADO]` finding — it is already tracked by the guard +
  baseline (and likely by its original GitHub issue).
- Skip if an open issue already covers the same domain — check with `gh issue list --state open`.
- **When you create an issue for a NEW class of problem, also add a guard rule**
  for it in `scripts/guards/checks.mjs` (and a `lib/` detector if it needs
  multi-line parsing), then `npm run guards:baseline --update --force` so the
  current debt becomes the ceiling and the issue cannot reappear/grow. This closes
  the audit→guard loop.

### Step 5: Report

Output final summary with:
- Quality gates table
- Audit results table (agent × severity)
- Issues created (with links)
- Top 3 priorities recommendation
