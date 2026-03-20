# Worktree Workflow

Procedimiento seguro para implementacion paralela usando git worktrees.

---

## Cuando usar worktrees

| Escenario | Estrategia |
|-----------|-----------|
| Issues grandes (M-L effort) | Worktrees separados, cada uno con su rama. Push cada rama inmediatamente |
| Issues chicos (XS-S effort) | Un solo worktree con rama unificada y un commit por issue |

---

## Workflow paso a paso

### 1. Pre-implementacion

- Verificar que `tsconfig.node.json` excluye `.claude/**`
- Commit todos los cambios pendientes a main antes de crear worktrees
- Crear branch desde latest main: `git checkout main && git pull && git checkout -b feat/new-feature`

### 2. Proteger trabajo — INMEDIATAMENTE despues de que los agentes terminen

**Ramas separadas (issues grandes):**

```bash
git push origin <branch>
```

**Rama unificada (issues chicos):**

Cherry-pick commits al branch unificado inmediatamente.

Para encontrar commits del worktree:

```bash
# Desde el repo principal
git log --oneline worktree-branch-name

# Si solo muestra el commit base, entrar al worktree
cd <worktree-dir>
git log --oneline main..HEAD

# O usar el script automatizado
scripts/collect-worktrees.sh <target-branch>
```

### 3. Verificar ANTES de limpiar

```bash
# Build completo
npm run build

# Si functions/package.json cambio
cd functions && npm ci && cd ..

# Tests
npx vitest run --dir src
cd functions && npm run test:run
```

**Solo limpiar worktrees despues de que todo pase.**

### 4. Limpiar worktrees

```bash
# SIEMPRE usar git worktree remove, NUNCA rm -rf
git worktree remove <path>
git worktree prune
```

### 5. Deploy a staging

```bash
npm run build
git push origin <feature-branch>:staging
# Si cambio functions/rules:
firebase deploy --only functions,firestore:rules --project modo-mapa-app
git checkout <feature-branch>
```

---

## Reglas criticas

### NUNCA borrar worktrees antes de cherry-pick

Los commits en worktrees NO se preservan en branches locales despues de la remocion. En v2.16.0 se perdieron tres implementaciones completas por borrar worktrees sin cherry-pick previo.

**Orden obligatorio:** agente termina -> cherry-pick commit -> verificar build -> ENTONCES limpiar worktrees.

Si los worktrees causan problemas de build (ej: tsc detectando sus archivos), arreglar la config del build en vez de borrar los worktrees.

### NUNCA editar skills/config en el repo principal durante un feature

Solo editar `.claude/skills/` o archivos de configuracion en worktrees, nunca en el repo principal mientras hay un feature branch activo. Previene conflictos de merge con archivos no trackeados.

### Agentes en worktrees: limitaciones

Los agentes ejecutados en worktrees a menudo carecen de permisos de Bash/Write. Preferir implementacion directa para tareas de codigo. Solo usar worktree agents para exploracion read-only.

---

## Branch strategy

- **Siempre** crear feature branches desde latest `main` HEAD
- **Nunca** reutilizar branches que mergearon staging u otros features
- Para staging: usar `git push origin feat/branch:staging` sin mergear staging al feature branch
- Si staging divergio, mergear staging en un branch temporal descartable, no en el feature branch

**Por que:** Branches que mergearon `origin/staging` (con commits de otros features) causan conflictos de commits duplicados durante rebase/merge. Paso dos veces (P2 merge y #142 merge).
