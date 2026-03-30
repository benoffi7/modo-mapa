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

### Worktrees branch from main, not from current branch

**Problema:** `isolation: "worktree"` siempre crea el worktree desde `main`, no desde el branch actual. Si estas trabajando en un feature branch (ej: `new-home`), el agente en worktree recibe archivos de `main` — que pueden estar desactualizados o no contener tus cambios recientes.

**Consecuencias observadas:**

- Archivos de constantes sobreescritos (el agente ve las constantes de main, no las del feature branch)
- Archivos de layout del branch equivocado
- Necesidad de copiar archivos manualmente en vez de hacer git merge

**Mitigacion:**

1. Para archivos NUEVOS que el agente crea: copiar directamente al feature branch (no existen en ninguna rama)
2. Para archivos MODIFICADOS que ya existen en el feature branch: NO copiar directamente — restaurar la version del feature branch y aplicar los cambios del agente via Edit
3. SIEMPRE restaurar archivos de constantes desde el feature branch despues de integrar
4. Ejecutar `tsc --noEmit` y tests despues de cada integracion

---

## Pre-flight para agentes paralelos

Antes de lanzar multiples agentes en paralelo, seguir este checklist:

### 1. Inventario de archivos

Para cada agente, listar los archivos que va a crear o modificar.

### 2. Deteccion de overlaps

Comparar las listas. Si dos agentes tocan el mismo archivo, hay overlap.

### 3. Resolver overlaps

| Situacion | Accion |
|-----------|--------|
| Overlap en archivos existentes | Asignar ownership exclusivo: un solo agente modifica cada archivo |
| Overlap inevitable | Secuenciar en vez de paralelizar esos agentes |
| Overlap en constantes/types | Un agente crea, el otro consume — secuenciar |

### 4. Documentar ownership

Incluir en el prompt de cada agente: "Tu eres responsable EXCLUSIVO de estos archivos: [lista]. NO modifiques: [lista de archivos del otro agente]."

**Ejemplo real:** Issues #195 y #196 ambos modificaron `BusinessComments.tsx`. Requirio merge manual. Si se hubiera asignado ownership exclusivo, no habria conflicto.

---

## Integracion de worktrees al feature branch

Procedimiento para integrar el trabajo de worktrees al branch actual.

### Paso 1: Inventariar cambios del worktree

```bash
# Desde el worktree
cd <worktree-dir>
git diff --name-only main..HEAD
```

Clasificar cada archivo:

- **Nuevo** (no existe en feature branch) — copiar directamente
- **Modificado** (existe en feature branch) — requiere merge cuidadoso

### Paso 2: Copiar archivos nuevos

```bash
cp <worktree-dir>/src/components/NewComponent.tsx src/components/NewComponent.tsx
```

### Paso 3: Integrar archivos modificados

Para cada archivo modificado:

1. NO copiar directamente (perderia los cambios del feature branch)
2. Revisar el diff del worktree: `git diff main..HEAD -- <archivo>` desde el worktree
3. Aplicar SOLO los cambios nuevos al archivo del feature branch usando Edit

### Paso 4: Restaurar constantes

**SIEMPRE** despues de integrar, verificar que los archivos de constantes no fueron sobreescritos:

```bash
git diff -- src/constants/
git diff -- src/config/
```

Si fueron sobreescritos, restaurar desde el feature branch:

```bash
git checkout HEAD -- src/constants/<archivo>
```

Y luego agregar SOLO las nuevas constantes via Edit.

### Paso 5: Validar integracion

```bash
npx tsc --noEmit
npx vitest run --dir src
npm run lint
```

---

## Patron aditivo para constantes

**Regla:** Los agentes DEBEN usar Edit (no Write) para archivos existentes. Para archivos de constantes, solo AGREGAR nuevos exports — nunca sobreescribir el archivo completo.

**Problema observado:** Agentes en worktrees ven la version de main de los archivos de constantes. Si usan Write para crear el archivo completo, pierden todas las constantes agregadas en el feature branch.

**Patron correcto:**

```typescript
// Agregar al final del archivo existente
export const NEW_CONSTANT = 'value';
```

**Patron incorrecto:**

```typescript
// Reescribir todo el archivo — PIERDE constantes del feature branch
export const OLD_CONSTANT = 'old';
export const NEW_CONSTANT = 'value';
```

**Incluir en el prompt de agentes:** "Para archivos de constantes (`src/constants/*`, `src/config/*`), usa SOLO la herramienta Edit para agregar nuevos exports al final. NUNCA uses Write para reescribir estos archivos."

---

## Regla de no-append para barrel files

**Regla:** Cuando se agregan constantes, tipos o secciones a un modulo organizado por dominio, CREAR un archivo nuevo por dominio en vez de hacer append a un archivo existente. Los barrels (`index.ts`) solo re-exportan.

### Archivos afectados

| Modulo | Directorio | Barrel | Accion para agregar |
|--------|-----------|--------|-------------------|
| Analytics events | `src/constants/analyticsEvents/` | `analyticsEvents/index.ts` | Crear `{dominio}.ts`, agregar `export * from './{dominio}'` al barrel |
| Types | `src/types/` | `types/index.ts` | Crear `{dominio}.ts`, agregar `export * from './{dominio}'` al barrel |
| Home sections | `src/components/home/homeSections.ts` | N/A (array declarativo) | Agregar entrada al array `HOME_SECTIONS` |

### Por que no-append

Los archivos append-only (donde multiples features agregan lineas al final) son la causa principal de conflictos de merge en trabajo paralelo. Cada agente en worktree toca la misma zona del archivo.

Con archivos por dominio, cada agente crea su propio archivo y solo agrega una linea al barrel. La probabilidad de conflicto baja de ~100% a ~5%.

### Incluir en prompts de agentes

"Para `analyticsEvents`, crea un archivo nuevo en `src/constants/analyticsEvents/{dominio}.ts` y agrega el re-export en el barrel `index.ts`. NO hagas append a archivos de dominio existentes de otros features. Para types, crea un archivo nuevo en `src/types/{dominio}.ts` y agrega el re-export en el barrel."

---

## Requisitos para prompts de agentes de implementacion

Todo prompt enviado a un agente de implementacion (ya sea en worktree o directo) DEBE incluir estos pasos finales:

```
Antes de terminar:
1. Ejecuta `npx tsc --noEmit` y corrige todos los errores de tipo
2. Ejecuta `npx eslint --fix src/path/to/changed/files`
3. Corrige manualmente cualquier error de lint restante (Function types, unused vars, spread args)
4. Haz un commit con mensaje descriptivo
```

**Justificacion:** Sin estos pasos, cada ronda de agente requiere 5-10 minutos de fixup manual para errores de lint recurrentes (tipos `Function`, variables sin usar, spread args).

---

## Branch strategy

- **Siempre** crear feature branches desde latest `main` HEAD
- **Nunca** reutilizar branches que mergearon staging u otros features
- Para staging: usar `git push origin feat/branch:staging` sin mergear staging al feature branch
- Si staging divergio, mergear staging en un branch temporal descartable, no en el feature branch

**Por que:** Branches que mergearon `origin/staging` (con commits de otros features) causan conflictos de commits duplicados durante rebase/merge. Paso dos veces (P2 merge y #142 merge).
