# Modo Tren (Offline Mode)

Activates fully offline mode for working with unstable connectivity (e.g., train travel).

## Activation

When this command runs, immediately switch to offline mode and confirm:

```
MODO TREN ACTIVADO — trabajando offline.
Permitido: git commit/branch/log/diff, editar archivos, tests locales.
Bloqueado: push, fetch, pull, gh, npm install, firebase deploy.
Acumulo commits. Decime "hay señal" para pushear todo.
```

## Rules while active

### Allowed

- All local git operations: commit, branch, log, diff, stash, rebase, merge
- File edits (Read, Write, Edit)
- Local tests: `npm run test:run`, `npx tsc --noEmit`
- Emulator operations (if already running): `./scripts/dev-env.sh`
- Build: `npm run build`

### Blocked (queue for later)

- `git push`, `git fetch`, `git pull`
- `gh` (any GitHub CLI command)
- `npm install`, `npm ci`
- `firebase deploy`
- `curl`, `wget`, any network request
- `WebFetch`, `WebSearch`

Before ANY tool call, check if it requires network. If yes, skip it and say: "Bloqueado en modo tren — lo hago cuando haya señal."

## Deactivation

User says any of: "hay señal", "push", "modo normal", "salí del modo tren"

On deactivation:

1. Show accumulated work: `git log --oneline` (unpushed commits)
2. Push all branches: `git push origin --all`
3. Push tags: `git push origin --tags`
4. Run any queued network operations
5. Confirm: "Modo tren desactivado. Todo pusheado."
