# Test Local Environment

You are testing the modo-mapa local development environment. Follow this protocol systematically.

## Step 0: Verify working directory (CRITICAL)

Before doing ANYTHING, verify you are in the correct directory. If working in a worktree, you MUST be inside it:

```bash
pwd
git rev-parse --show-toplevel
git branch --show-current
```

**If you are in a worktree** (branch is not `main`), confirm `pwd` is inside `.claude/worktrees/<name>`, NOT the main repo root. Running `dev-env.sh` from the wrong directory uses main's seed script and rules -- this has caused 5+ rounds of silent failures in the past.

**If pwd is wrong**, `cd` to the worktree FIRST:

```bash
cd /Users/gonzalo.benoffi./Documents/GitHub/modo-mapa/.claude/worktrees/<name>
```

## Step 1: Start the dev environment

Run the script directly — it handles PATH, Java, emulators, seed, and Vite:

```bash
./scripts/dev-env.sh start
```

This **single command** does everything:

1. Ensures node/npx and Java 21 are in PATH
2. Builds Cloud Functions
3. Starts all Firebase emulators (Auth, Firestore, Storage, Functions)
4. Seeds test data (always runs on fresh emulator start)
5. Starts Vite dev server

If it fails or services are partially up, run:

```bash
./scripts/dev-env.sh restart
```

After start/restart, **always verify** with:

```bash
./scripts/dev-env.sh health
```

All 6 checks must pass (ports, HTTP responses, seed data). If any fail, check logs:

```bash
./scripts/dev-env.sh logs
```

**Do NOT manually start emulators, seed, or Vite separately.** The script handles orchestration. If the script itself fails, fix the script — don't work around it.

### Post-seed smoke check

After start/restart, verify that seed data includes any NEW fields added in this branch. For example, if you added `notifyReplies` to userSettings, check it exists:

```bash
curl -s http://localhost:8080/v1/projects/modo-mapa-app/databases/(default)/documents/userSettings/user_001 | grep -o '"notifyReplies"' || echo "MISSING FIELD"
```

If key fields are missing, the seed script is stale (likely running from main instead of the worktree -- go back to Step 0).

## Step 2: Run TypeScript and lint checks

```bash
npx tsc --noEmit && npm run lint
```

Fix any errors before testing the app.

## Step 3: Test each feature

Open the browser console (F12) and test each area. After each test, report the result.

### 3a. Authentication

- Go to `http://localhost:5173`
- Sign in via Auth emulator (http://localhost:9099 should be connected)
- Verify: no auth errors in console

### 3b. Business Sheet (open any business marker)

- Verify: ratings, tags, comments load without errors
- Verify: no "offline" or "network-request-failed" errors in console

### 3c. Price Level (F10b)

- Open a business, click a price level ($, $$, or $$$)
- Verify: button stays highlighted (no flash/reset)
- Verify: vote count updates
- Close and reopen same business — verify vote persists
- Check console for errors

### 3d. Menu Photo Upload (F2)

- Open a business, click "Subir foto del menu"
- Select an image file (JPG/PNG/WebP)
- Click "Enviar"
- Verify: progress bar shows, upload completes
- Verify: "Foto pendiente de revision" message appears
- Test cancel during upload
- Check console for errors

### 3e. Visit History (F9)

- Open 2-3 different businesses
- Open side menu -> "Recientes" section
- Verify: visited businesses appear with relative time
- Click "Limpiar" -> verify list clears

### 3f. Price Filter (F10b)

- Click $, $$, or $$$ filter chips above the map
- Verify: map markers filter by price level
- Click same chip again -> verify filter deactivates

### 3g. Admin Panel — Photos

- Go to `http://localhost:5173/admin`
- Verify: all tabs load without errors
- Click "Fotos" tab
- Verify: photos grouped by status (Pendientes, Aprobadas, Rechazadas)
- Test: Approve a pending photo
- Test: Reject a pending photo (with reason)
- Test: Approve a rejected photo (revert)
- Test: Delete an approved photo
- Verify: report count badge shows on reported photos

### 3h. Admin Panel — Other tabs

- Overview, Actividad, Feedback, Tendencias, Usuarios, Firebase Usage, Alertas, Backups
- Verify: each loads with seed data, no console errors

## Step 4: Report results

Summarize which features passed and which failed. For failures, include:

- The exact error message from the browser console
- Which component/file is likely involved

## Dev environment commands reference

| Command | Description |
|---|---|
| `./scripts/dev-env.sh start` | Start emulators + seed + Vite |
| `./scripts/dev-env.sh stop` | Stop everything |
| `./scripts/dev-env.sh restart` | Stop + Start (full reset with seed) |
| `./scripts/dev-env.sh seed` | Re-seed test data (emulators must be running) |
| `./scripts/dev-env.sh status` | Check what's running |
| `./scripts/dev-env.sh health` | Full health check (ports + HTTP + seed data) |
| `./scripts/dev-env.sh logs` | View recent logs |

## Seed data maintenance

The seed script `scripts/seed-admin-data.mjs` must always reflect the current data model. When adding new Firestore collections or fields:

1. Add seed entries to the script
2. Update the counter at `config/counters`
3. Update the summary log at the end of the script

Current seeded collections:

- `users` (10)
- `comments` (~60, with likes, flags, edits)
- `commentLikes` (~80)
- `ratings` (~40)
- `favorites` (~30)
- `userTags` (~50)
- `customTags` (15)
- `feedback` (8)
- `dailyMetrics` (15 days)
- `abuseLogs` (12)
- `priceLevels` (~35)
- `menuPhotos` (5: 2 pending, 2 approved, 1 rejected)
- `config/counters` and `config/moderation`

## Cloud Function trigger testing protocol

When testing Cloud Functions that fire on Firestore writes (e.g., onCreate triggers):

### Before creating test data

1. **Identify required user settings** -- check which user settings must be enabled for the trigger to fire (e.g., `notificationsEnabled: true`, `notifyReplies: true`)
2. **List eligible users** -- query the emulator to find users with the right settings:

   ```bash
   curl -s http://localhost:8080/v1/projects/modo-mapa-app/databases/(default)/documents/userSettings?pageSize=20 | python3 -c "import sys,json; docs=json.load(sys.stdin).get('documents',[]); [print(d['name'].split('/')[-1], {k:v for k,v in d['fields'].items() if 'notify' in k.lower() or 'enabled' in k.lower()}) for d in docs]"
   ```

3. **Use an eligible user** for the test write -- do not pick randomly

### After creating test data

Wait 2-3 seconds for the trigger, then check the target collection for the expected document.

## Anti-patterns (do NOT do these)

- **Do NOT simulate client SDK writes via REST API to test Firestore rules.** Rules that require `request.time` (e.g., `updatedAt == request.time`) cannot work with REST because you cannot send `serverTimestamp()`. For rule validation, use the actual app in the browser.
- **Do NOT run dev-env.sh from the main repo when working in a worktree.** The seed script and rules will be from main, not your branch.
- **Do NOT test Cloud Function triggers against users without checking their settings first.** This wastes multiple debug rounds.

## Troubleshooting

- **Auth errors / "offline"**: Auth emulator (port 9099) is down -> `./scripts/dev-env.sh restart`
- **Emulators partially down**: Kill and restart all -> `./scripts/dev-env.sh restart`
- **Upload hangs**: Check Storage emulator (port 9199) is up -> check logs
- **Functions 401/Unauthenticated**: Verify `enforceAppCheck: !IS_EMULATOR` in callable functions
- **Data missing after restart**: Emulators don't persist data — `start`/`restart` auto-seeds
- **Port conflicts**: `./scripts/dev-env.sh stop` kills only modo-mapa related processes
- **Firestore rules reject writes**: Check `isValidBusinessId` regex matches the business ID format being used
