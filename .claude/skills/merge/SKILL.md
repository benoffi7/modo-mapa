---
name: merge
description: Full automated merge-to-main checklist with quality gates, audits, docs update, version bump. Run from feature branch.
argument-hint: "[issue-numbers]"
---

# Merge Branch to Main (Full Automated Checklist)

Automated pre-merge checklist. Run this when you are on the feature/fix branch ready to merge. Never run on main.

Issue numbers (optional): $ARGUMENTS

## Pre-flight checks

1. Verify you are NOT on main: `git branch --show-current` — abort if on main
2. Verify working tree is clean: `git status --short` — commit or stash if dirty
3. Store the branch name and issue number (parse from branch name or $ARGUMENTS)

## CRITICAL: Working directory

**Before EVERY `npm`, `npx`, or `vite` command, verify you are in the correct directory.** If in a worktree, all commands MUST run from the worktree path. Running from the main repo will silently use main's files.

```bash
# Set once at the start, use for all commands:
WORKDIR="$(git rev-parse --show-toplevel)"
echo "Working directory: $WORKDIR"
```

Prefix all commands with `cd $WORKDIR &&` to prevent wrong-directory execution.

## Phase 1: Quality gates (abort on failure)

Run these sequentially — any failure aborts the merge:

**Note:** Add `npm run test:coverage 2>&1 | grep -E "does not meet|All files"` after tests to catch coverage threshold failures early (CI enforces 80% branches).

### 1a. Sync with main

```bash
git fetch origin main
git merge origin/main --no-edit
```

Use `merge` instead of `rebase` to avoid conflicts from branches that share commits with previously merged features. If conflicts arise, resolve them and commit.

**IMPORTANT:** When creating feature branches, always branch from latest `main` HEAD. Never reuse branches that merged other feature branches (e.g., unified staging branches). This prevents duplicate commit conflicts during rebase/merge. See `docs/procedures/worktree-workflow.md` for the full branch strategy rationale.

### 1b. Lint

```bash
npm run lint
```

Must have 0 errors. Warnings are OK.

### 1c. Frontend tests

```bash
npx vitest run --dir src
```

### 1d. Functions tests

```bash
cd functions && npm run test:run
```

### 1e. Build check

```bash
npx vite build
```

### 1f. Test coverage for new files

**BLOCKER:** Verify every new `.ts`/`.tsx` file in `src/services/` and `src/hooks/` has a corresponding `.test.ts` file. This catches the "forgot to write tests" gap that CI's 80% threshold may not catch until deploy.

```bash
# List new service/hook files without tests
for f in $(git diff --name-only --diff-filter=A origin/main -- 'src/services/*.ts' 'src/hooks/*.ts' | grep -v '.test.'); do
  test_file="${f%.ts}.test.ts"
  if [ ! -f "$test_file" ]; then
    echo "MISSING TEST: $f → $test_file"
  fi
done
```

If any test files are missing, write them before proceeding. The PRD specifies which files need tests — cross-reference with the plan's test section.

### 1g. Coverage threshold (local)

**BLOCKER:** Run full coverage locally. Do NOT rely on `vitest run` alone — it doesn't check thresholds. CI enforces 80% branches and will fail even at 79.97%.

```bash
npx vitest run --coverage 2>&1 | grep -E "does not meet|All files"
```

If `does not meet` appears, write more tests before proceeding. Common gap: `syncEngine.ts` — new action types need corresponding test cases in `syncEngine.test.ts`.

### 1h. Firestore index validation

If `firestore.indexes.json` was modified, validate indexes locally:

```bash
if git diff --name-only origin/main | grep -q 'firestore.indexes.json'; then
  # Check for single-field indexes (Firestore rejects these — they're automatic)
  node -e "
    const idx = require('./firestore.indexes.json').indexes;
    const bad = idx.filter(i => i.fields.length === 1);
    if (bad.length) {
      console.error('ERROR: Single-field indexes found (Firestore auto-creates these):');
      bad.forEach(i => console.error('  -', i.collectionGroup, i.fields[0].fieldPath));
      process.exit(1);
    }
    console.log('OK: All', idx.length, 'indexes are composite');
  "
fi
```

Single-field indexes cause deploy failures because Firestore creates them automatically. Only composite (2+ fields) indexes belong in `firestore.indexes.json`.

### 1i. Firestore rules field whitelist audit

If `firestore.rules` OR any service file (`src/services/**`) was modified, cross-check that every field written by client code is allowed by the rules' `hasOnly()` whitelist.

**How to check:**
1. For each collection with `hasOnly()` in `firestore.rules`, extract the allowed field names from both `create` and `update` rules.
2. In the corresponding service functions (`src/services/*.ts`), find all `updateDoc`, `setDoc`, `addDoc` calls for that collection and extract the field names being written.
3. Any field written by services but NOT in the rules' `hasOnly()` list = **BLOCKER**. Firestore silently rejects the entire write with "Missing or insufficient permissions".

**Common miss:** Adding a new optional field (e.g. `color`, `icon`) to a type and service without updating the rules whitelist.

If mismatch found, update `firestore.rules` to include the missing fields before proceeding.

If any step fails, stop and fix. Do NOT proceed to Phase 2.

## Phase 2: Automated audits (run ALL in parallel, FOREGROUND)

**IMPORTANT: Run audits in FOREGROUND (not background).** Wait for all results before proceeding. This ensures findings can influence the merge decision. ~60s total running in parallel is acceptable.

### Audit scope by branch type

Determine branch type from the branch name prefix:

- **`feat/`** — Full audit (all 7 agents below)
- **`fix/`** — Reduced audit: security + architecture + performance only (3 agents)
- **`chore/` or `docs/`** — Minimal audit: security + architecture only (2 agents). These branches refactor existing code or update docs — UI, dark mode, offline, and privacy audits add no value since user-visible behavior doesn't change

### Full audit agents

Launch these agents in parallel using their specialized `subagent_type`. These produce warnings but don't block unless critical issues found:

1. **dark-mode-auditor** — scan changed `.tsx`/`.ts` files for hardcoded colors in NEW code
2. **security** — XSS, query injection, race conditions, input validation in changed files
3. **architecture** — separation of concerns, duplication, React antipatterns in changed files
4. **ui-reviewer** — 360px layout, accessibility, dark mode, empty states in changed files
5. **performance** — bundle impact, re-render efficiency, memoization in changed files
6. **privacy-policy** — check for new logEvent/addDoc/setDoc/collection/localStorage in diff
7. **offline-auditor** — audit changed files for offline support: uncached reads, unqueued writes, missing network error handling, no fallback UI. Creates tech debt issue if findings are non-trivial (warning, not blocker)

Get changed files with: `git diff --name-only origin/main -- 'src/**/*.tsx' 'src/**/*.ts'`

**IMPORTANT:** When running from a worktree, pass the full worktree path (`$WORKDIR`) as "Working directory" in every agent prompt. Agents that receive only a relative path or no path will default to the main repo and read stale files.

Fix critical issues. Report all results as summary table before proceeding.

## Phase 3: Documentation updates — MANDATORY CHECKPOINT

**BLOCKER: Do NOT proceed to Phase 4 until all docs are updated. This phase is NOT optional.**

### 3a. Update reference docs

Check what changed and update these files as needed:

| File | Update if... | How to check |
|------|-------------|-------------|
| `docs/reference/features.md` | Any user-visible feature added/changed | `git diff origin/main -- 'src/components/**' 'src/pages/**'` |
| `docs/reference/patterns.md` | New hook, context, UI pattern, or convention | `git diff origin/main -- 'src/hooks/**' 'src/contexts/**'` |
| `docs/reference/firestore.md` | New collections, types, or rules | `git diff origin/main -- 'src/types/**' 'firestore.rules' 'firestore.indexes.json'` |
| `docs/reference/project-reference.md` | Version, date, feature summary, test count | Always update on feat/ branches |
| `src/components/menu/HelpSection.tsx` | Any user-facing behavior change | `git diff origin/main -- 'src/components/**'` |
| `docs/reference/architecture.md` | New services, major refactors | `git diff origin/main -- 'src/services/**'` |

**Systematic check:** Run `git diff --stat origin/main` and for each changed area, verify the corresponding doc is up to date. Do not rely on memory alone.

### 3b. Check privacy policy

```bash
git diff origin/main -- 'src/services/**' 'src/constants/**' 'functions/src/**' | grep -E '(logEvent|addDoc|setDoc|collection\()'
```

If new data collection → warn user and update privacy policy if needed.

### 3c. Check seed data (if schema changed)

```bash
git diff --name-only origin/main -- 'src/types/**' 'src/config/adminConverters.ts' 'functions/src/**'
```

If types/converters changed → run the **seed-manager** agent to verify and update seed data automatically. Do NOT just check manually — delegate to the agent.

### 3d. Update docs site (if docs changed)

```bash
git diff --name-only origin/main -- 'docs/**/*.md'
```

If any docs changed → run the **docs-site-maintainer** agent to regenerate README.md index files and update `_sidebar.md`. This ensures new PRDs, specs, plans, and changelogs are properly linked.

### 3e. Commit docs updates

If any docs were updated in this phase, commit them now before merging.

## Phase 4: Merge

```bash
# If merging from a worktree, switch to the main repo directory first.
# Stash any uncommitted WIP on main before merging to avoid conflicts:
git stash --include-untracked 2>/dev/null
git checkout main
git merge <branch-name> --no-ff -m "merge message summarizing the feature/fix"
git stash pop 2>/dev/null
```

### 4a. Reinstall dependencies if changed

After merging, check if `package.json` or `functions/package.json` changed and reinstall:

```bash
git diff HEAD~1 --name-only | grep -q '^package.json$' && npm ci
git diff HEAD~1 --name-only | grep -q 'functions/package.json' && (cd functions && npm ci)
```

This is critical when merging from worktrees — `node_modules` don't transfer. New devDependencies (e.g. `fake-indexeddb`) installed in the worktree won't be available in the main repo until `npm ci` runs.

## Phase 5: Post-merge

### 5a. Version bump

- Any `feat:` commits → minor bump
- Only `fix:` → patch bump
- Only `docs:`/`chore:` → no bump

```bash
npm version minor --no-git-tag-version  # or patch
git add package.json package-lock.json
git commit -m "chore: bump version to X.Y.Z"
git tag vX.Y.Z
```

### 5b. Push

**IMPORTANT:** If there are uncommitted WIP files on main (from another in-progress feature), the pre-push hook (`tsc`) will fail because those files may reference types/modules that don't exist yet. Always stash before pushing:

```bash
# Stash any uncommitted/untracked WIP to avoid pre-push hook failures
git stash --include-untracked 2>/dev/null
git push origin main
git push origin --tags
git stash pop 2>/dev/null
```

If the push still fails due to pre-push hooks, check `git stash list` — the WIP may need to be in a worktree instead of loose on main.

### 5c. Verify CI

```bash
gh run watch $(gh run list --branch main --limit 1 --json databaseId -q '.[0].databaseId') --exit-status
```

### 5d. Clean up branches

```bash
git push origin --delete <branch-name>
git branch -d <branch-name>
```

### 5e. Close related issues

Parse issue numbers from branch name or $ARGUMENTS and close them:

```bash
gh issue close <number> -c "Implemented and merged to main (vX.Y.Z)."
```

## Phase 6: Report

Output a final summary:

```
## Merge Complete

- Branch: feat/xxx → main
- Version: X.Y.Z → X.Y+1.Z
- CI: passing (run #NNNNN)
- Issues: #N closed

### Audits
| Agent | Result |
|-------|--------|
| dark-mode | ... |
| security | ... |
| architecture | ... |
| ui-reviewer | ... |
| performance | ... |
| privacy-policy | ... |
| offline-auditor | ... |

### Docs updated
- features.md, patterns.md, project-reference.md, HelpSection.tsx
- Branch cleaned: remote + local
```

## Phase 7: Update Backlog & Changelog

**MANDATORY** — Update both product tracking documents:

### 7a. Changelog (`docs/reports/changelog.md`)

Add the new version at the **top** of the table (newest first):

```markdown
| vX.Y.Z | [#N](url) | Description of what was implemented |
```

### 7b. Backlog (`docs/reports/backlog-producto.md`)

1. Remove completed issues from their milestone section
2. If a milestone has no remaining issues, remove the milestone section
3. Update "Métricas de progreso" counts (issues abiertos, cerrados)
4. Update the date at the top of the file

### 7c. Commit and push

```bash
git add docs/reports/backlog-producto.md docs/reports/changelog.md
git commit -m "docs: update backlog and changelog post-merge"
git push origin main
```

These files are the **single source of truth** for product roadmap and release history.
Referenced by: workflow.md, memory (feedback_features_vs_backlog.md).

## Phase 8: Post-merge review — MANDATORY, DO NOT SKIP

**⚠️ This phase is as mandatory as Phase 3 (docs). Do NOT end the conversation without completing it.**

### 8a. Tech debt issue

If any audit (Phase 2) identified tech debt, architectural improvements, or non-blocking warnings:

```bash
gh issue create --title "Tech debt: <summary>" --body "<consolidated list>" --label "enhancement"
```

Do NOT just report tech debt in the merge summary — create a trackable issue.

### 8b. Self-reflection

Self-reflect on what could improve in agents, workflow, or permissions based on this merge.

1. List 2-3 concrete improvements observed during this merge
2. For each: classify as "agent fix", "skill update", "doc update", or "memory"
3. Implement agent/skill/doc fixes immediately if trivial (< 5 min)
4. Save only non-formalizable insights to memory (user preferences, operational learnings)
5. Report the summary to the user

**Prefer formalizing improvements in agents/skills/docs over saving to memory.** Memory is for context that can't live elsewhere.

### 8c. Ask the user

Ask: "¿Algún feedback o mejora sobre el proceso de hoy?"
