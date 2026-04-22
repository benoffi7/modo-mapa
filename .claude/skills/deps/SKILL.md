---
name: deps
description: "Review and update project dependencies. Safe minor/patch upgrades applied automatically, major bumps reported with breaking changes."
user-invocable: true
---

# Dependency Update

Review and update project dependencies. Delegates to the `dependency-updater` agent.

**Usage**: `/deps`

## Process

### Step 1: Launch dependency-updater agent

Launch a **dependency-updater** agent with this prompt:

```
Review outdated dependencies for the modo-mapa project.

Working directory: $WORKDIR

1. Run `npm outdated` in the project root
2. Run `cd functions && npm outdated` for Cloud Functions
3. For each outdated package:
   - If minor/patch update: upgrade it (npm install pkg@latest for minor, npm install pkg@^X.Y.Z for patch)
   - If major update: DO NOT upgrade. Report the package, current version, latest version, and breaking changes from the changelog
4. After upgrades, run:
   - `npx tsc --noEmit` to verify types
   - `npm run lint` to verify no new lint errors
   - `npx vitest run --dir src` to verify tests pass
   - `cd functions && npm run test:run` for functions tests
5. If any check fails, revert the problematic upgrade and report it

Output a summary table:
| Package | From | To | Type | Status |
|---------|------|----|------|--------|
| ... | ... | ... | minor/patch/major | upgraded/skipped/failed |
```

### Step 2: Report

Show the agent's summary table to the user. Highlight:
- Number of packages upgraded
- Major bumps that need manual review
- Any upgrades that failed checks

### Step 3: Commit (if upgrades applied)

```bash
git add package.json package-lock.json functions/package.json functions/package-lock.json
git commit -m "chore: update dependencies (minor/patch)"
```
