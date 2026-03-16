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

**IMPORTANT:** When creating feature branches, always branch from latest `main` HEAD. Never reuse branches that merged other feature branches (e.g., unified staging branches). This prevents duplicate commit conflicts during rebase/merge.

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

## Phase 2: Automated audits (run ALL in parallel via agents)

Launch ALL these agents in parallel using `subagent_type: Explore`. These produce warnings but don't block unless critical issues found:

1. **dark-mode-auditor** — scan changed `.tsx`/`.ts` files for hardcoded colors in NEW code
2. **security** — XSS, query injection, race conditions, input validation in changed files
3. **architecture** — separation of concerns, duplication, React antipatterns in changed files
4. **ui-reviewer** — 360px layout, accessibility, dark mode, empty states in changed files
5. **performance** — bundle impact, re-render efficiency, memoization in changed files
6. **privacy-policy** — check for new logEvent/addDoc/setDoc/collection/localStorage in diff

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
| `docs/reference/PROJECT_REFERENCE.md` | Version, date, feature summary, test count |
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

If types/converters changed → verify seed data is in sync.

### 3d. Commit docs updates

If any docs were updated in this phase, commit them now before merging.

## Phase 4: Merge

```bash
git checkout main
git merge <branch-name> --no-ff -m "merge message summarizing the feature/fix"
```

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

```bash
git push origin main
git push origin --tags
```

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

### Docs updated
- features.md, patterns.md, PROJECT_REFERENCE.md, HelpSection.tsx
- Branch cleaned: remote + local
```

## Phase 7: Update Backlog de Producto

**MANDATORY** — Update `docs/reports/backlog-producto.md` with:

1. Add the merged feature to the "Implementado" table (version, issues, description)
2. Move completed issues from backlog sections to implemented
3. Update "En desarrollo / Próximo" if priorities changed
4. Update "Métricas de progreso" counts
5. Commit and push: `git add docs/reports/backlog-producto.md && git commit -m "docs: update backlog de producto post-merge" && git push origin main`

This file is the **single source of truth** for product roadmap and issue tracking.
Referenced by: workflow.md, memory (feedback_features_vs_backlog.md).

## Phase 8: Post-merge review

Ask: "¿Hay algo que mejorar de los agentes, del flujo de trabajo o permisos?"
If improvements identified, implement or save to memory.
