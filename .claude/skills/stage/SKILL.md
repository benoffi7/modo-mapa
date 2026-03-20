---
name: stage
description: Deploy current feature branch to staging environment for testing
user-invocable: true
---

# Deploy to Staging

Deploys the current feature branch to the staging environment (modo-mapa-staging.web.app). Runs local quality gates first, then pushes to the `staging` branch to trigger the GitHub Actions deploy.

**Usage**: `/stage`

## Protocol

### Step 1: Pre-staging gate (local)

Verify you are NOT on main or staging:

```bash
BRANCH=$(git branch --show-current)
# Abort if on main or staging
```

Run local checks that mirror CI to catch issues before pushing:

```bash
# 1. TypeScript compiles
npx tsc --noEmit -p tsconfig.app.json

# 2. Lint (0 errors)
npm run lint

# 3. Frontend tests
npx vitest run --dir src

# 4. Functions tests
cd functions && npm run test:run && cd ..

# 5. Pre-staging check script
bash scripts/pre-staging-check.sh
```

If any step fails, stop and fix. Do NOT proceed.

### Step 2: Push feature branch

```bash
git push origin $BRANCH
```

### Step 3: Merge to staging

```bash
git checkout staging
git pull origin staging
git merge $BRANCH --no-edit
git push origin staging
```

### Step 4: Wait for deploy

```bash
RUN_ID=$(gh run list --branch staging --limit 1 --json databaseId --jq '.[0].databaseId')
gh run watch $RUN_ID --exit-status
```

Check conclusion:

```bash
gh run view $RUN_ID --json conclusion --jq '.conclusion'
```

If failed, check logs with `gh run view $RUN_ID --log-failed` and fix.

### Step 5: Return to feature branch

```bash
git checkout $BRANCH
```

### Step 6: Report

```
## Staging Deploy Complete

- Branch: $BRANCH → staging
- CI: passing (run #$RUN_ID)
- URL: https://modo-mapa-staging.web.app

Ready for testing.
```

### Step 7: Deploy rules/functions if changed

Check if Firestore rules or Cloud Functions changed:

```bash
git diff origin/main -- firestore.rules functions/src/
```

If rules changed → deploy to staging DB via REST API (see `docs/reference/staging.md`).
If functions changed → CI auto-deploys, but verify with `gh run view`.

For the full deploy checklist, see `docs/reference/staging.md#checklist-de-deploy-completo-a-staging`.

## Important notes

- **Always run pre-staging gate first** — catches CI issues locally before the 5-minute deploy cycle
- **Never push to staging without local validation** — saves time and avoids wasted CI runs
- The staging branch is a throwaway merge target — it gets force-updated from the feature branch
- After testing, use `/merge` to merge to main (not staging → main)
- **Never tell the user to test until `conclusion` is `"success"`** — verify explicitly with `gh run view`
- Full staging reference: `docs/reference/staging.md`
