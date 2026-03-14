# Merge Branch to Main (Full Automated Checklist)

Automated pre-merge checklist that runs all validations, audits, and post-merge tasks. This replaces the manual merge process entirely.

**IMPORTANT**: Run this command when you are on the feature/fix branch ready to merge. Never run on main.

## Pre-flight checks

1. Verify you are NOT on main: `git branch --show-current` — abort if on main
2. Verify working tree is clean: `git status --short` — commit or stash if dirty
3. Store the branch name and issue number (parse from branch name if possible)

## Phase 1: Quality gates (abort on failure)

Run these sequentially — any failure aborts the merge:

### 1a. Rebase on main

```bash
git fetch origin main
git rebase origin/main
```

If conflicts, report them and abort — do NOT auto-resolve.

### 1b. TypeScript check

```bash
npx tsc --noEmit -p tsconfig.app.json
```

### 1c. Lint

```bash
npm run lint
```

### 1d. Markdownlint on changed .md files

```bash
git diff --name-only main -- '*.md' | xargs npx markdownlint-cli 2>/dev/null
```

### 1e. Frontend tests

```bash
npm run test:run
```

### 1f. Functions tests

```bash
cd functions && npm run test:run
```

### 1g. Build check

```bash
npm run build
```

If any step fails, stop and fix. Do NOT proceed to Phase 2.

## Phase 2: Automated audits (run in parallel via agents)

Launch these agents and collect their reports. These are informational — they produce warnings but don't block the merge unless critical issues are found:

1. **dark-mode-auditor** — scan for hardcoded colors in changed files only:
   - Get changed files: `git diff --name-only main -- 'src/**/*.tsx' 'src/**/*.ts'`
   - If any hardcoded colors found in NEW code (not pre-existing), warn the user

2. **help-docs-reviewer** — validate HelpSection matches features.md (only if help-related files changed)

Report audit results as a summary. If critical issues found, ask user before proceeding.

## Phase 3: Documentation updates (automated)

### 3a. Update PROJECT_REFERENCE

Launch the **documentation** agent to update docs/reference/ files based on the changes in this branch. The agent should:

- Read `git diff main --stat` to understand what changed
- Update features.md, firestore.md, data-layer.md, files.md, issues.md as needed

### 3b. Update seed data (if schema changed)

Check if any of these files were modified:

```bash
git diff --name-only main -- 'src/types/**' 'src/config/adminConverters.ts' 'functions/src/**'
```

If yes, launch the **seed-manager** agent to verify seed data is in sync.

### 3c. Check privacy policy (if data collection changed)

Check if analytics events, new collections, or new user data fields were added:

```bash
git diff main -- 'src/services/**' 'src/constants/**' 'functions/src/**' | grep -E '(logEvent|addDoc|setDoc|collection\()'
```

If new data collection detected, warn: "New data collection detected — verify privacy policy is up to date."

## Phase 4: Merge

```bash
git checkout main
git merge <branch-name> --no-ff -m "merge message based on commits"
```

The merge message should summarize the feature/fix based on the branch commits.

## Phase 5: Post-merge

### 5a. Version bump

Run the `/bump` command logic:

- Analyze commits in the branch
- If any `feat:` → minor bump
- If only `fix:` → patch bump
- If only `docs:`/`chore:` → no bump

### 5b. Push

```bash
git push origin main
git push origin --tags  # if version was bumped
```

### 5c. Verify CI

```bash
gh run list --branch main --limit 1 --json status,conclusion,databaseId
```

Watch the run. If it fails, invoke the **ci-guardian** agent automatically.

### 5d. Clean up branches

```bash
git push origin --delete <branch-name>
git branch -d <branch-name>
```

### 5e. Close related issue

If the branch name contains an issue number (e.g., `feat/84-auth-metrics`), close it:

```bash
gh issue close <number> -c "Implemented and merged to main."
```

## Phase 6: Report

Output a final summary:

```
## Merge Complete

- Branch: feat/auth-metrics → main
- Version: 2.3.0 → 2.4.0
- CI: passing (run #12345)
- Issue: #84 closed
- Audits: dark-mode (0 issues), help-docs (ok)
- Docs updated: features.md, firestore.md, issues.md
- Branch cleaned: remote + local
```
