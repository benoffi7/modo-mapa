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

## Phase 1: Quality gates (abort on failure)

Run these sequentially — any failure aborts the merge:

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

If any step fails, stop and fix. Do NOT proceed to Phase 2.

## Phase 2: Automated audits (run ALL in parallel, FOREGROUND)

**IMPORTANT: Run audits in FOREGROUND (not background).** Wait for all results before proceeding. This ensures findings can influence the merge decision. ~60s total running in parallel is acceptable.

Launch ALL these agents in parallel using their specialized `subagent_type`. These produce warnings but don't block unless critical issues found:

1. **dark-mode-auditor** — scan changed `.tsx`/`.ts` files for hardcoded colors in NEW code
2. **security** — XSS, query injection, race conditions, input validation in changed files
3. **architecture** — separation of concerns, duplication, React antipatterns in changed files
4. **ui-reviewer** — 360px layout, accessibility, dark mode, empty states in changed files
5. **performance** — bundle impact, re-render efficiency, memoization in changed files
6. **privacy-policy** — check for new logEvent/addDoc/setDoc/collection/localStorage in diff
7. **offline-auditor** — audit changed files for offline support: uncached reads, unqueued writes, missing network error handling, no fallback UI. Creates tech debt issue if findings are non-trivial (warning, not blocker)

Get changed files with: `git diff --name-only origin/main -- 'src/**/*.tsx' 'src/**/*.ts'`

Fix critical issues. Report all results as summary table before proceeding.

## Phase 3: Documentation updates — MANDATORY CHECKPOINT

**BLOCKER: Do NOT proceed to Phase 4 until all docs are updated. This phase is NOT optional.**

### 3a. Update reference docs

Check what changed and update these files as needed:

| File | Update if... |
|------|-------------|
| `docs/reference/features.md` | Any user-visible feature added/changed |
| `docs/reference/patterns.md` | New hook, context, UI pattern, or convention |
| `docs/reference/project-reference.md` | Version, date, feature summary, test count |
| `src/components/menu/HelpSection.tsx` | Any user-facing behavior change |

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
