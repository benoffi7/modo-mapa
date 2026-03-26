# Plan de Implementacion: Mejoras en Comentarios + Dark Mode + Refactors

**Feature:** comments-improvements
**Fecha:** 2026-03-14
**PRD:** revision 4 | **Specs:** revision final (post-auditoria)

---

## Estrategia

**Feature branch** como punto de integracion. Cada fase se mergea al feature branch (no a main). Main solo con aprobacion explicita del usuario.

```text
main
  └── feat/comments-improvements          ← feature branch (integracion)
        ├── feat/comments-prereqs         ← DT-1, DT-2, DT-3
        ├── feat/comments-phase1          ← #110, #111, #108, #104, #103, #102
        ├── feat/comments-phase2          ← DT-5, DT-6, DT-4, #106, #101, #107
        └── feat/comments-phase3          ← #109
```

**Flujo:**

1. Crear `feat/comments-improvements` desde main
2. Cada fase crea branch desde `feat/comments-improvements`
3. PR de fase → merge a `feat/comments-improvements`
4. Auditorias, tests, docs se corren en el feature branch
5. Merge a main solo con aprobacion del usuario (paso final)

---

## Pre-requisitos (Branch 1)

### Step 1: DT-2 — Extraer `truncate`

**Crear:** `src/utils/text.ts`

```typescript
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
}
```

**Refactor:**

- `CommentsList.tsx`: eliminar funcion inline `truncate`, agregar `import { truncate } from '@/utils/text'`
- `UserProfileSheet.tsx`: idem

**Test unitario:** edge cases (empty string, exact length, over length, length 0).
**Test manual:** verificar que los textos truncados se muestran igual que antes.

**Archivos:** 3 (1 nuevo, 2 refactor)
**Riesgo:** Ninguno

---

### Step 2: DT-3 — Dark mode fixes (27 reemplazos)

Ejecutar en orden de severidad. Cada grupo es un commit.

**Commit 1 — Criticos (12 reemplazos):**

| Archivo | Cambio |
|---------|--------|
| `LocationFAB.tsx` | `#fff` → `background.paper`, `#666` → `text.secondary`, `#f5f5f5` → `action.hover` |
| `UserProfileSheet.tsx` | `#dadce0` → `divider` |
| `BusinessSheet.tsx` | `#dadce0` → `divider` |
| `CommentsList.tsx` | `#ccc` → `action.disabled` |
| `FavoritesList.tsx` | `#ccc` → `action.disabled` |
| `RatingsList.tsx` | `#ccc` → `action.disabled` |
| `BusinessComments.tsx` | `#fff` (L519) → `primary.contrastText`, `#fff` (L619) → `primary.contrastText` |
| `MapView.tsx` | `rgba(255,255,255,0.95)` → `alpha(theme.palette.background.paper, 0.95)` |
| `NotificationItem.tsx` | `#34a853` → `success.main` |

**Commit 2 — Moderados (6 reemplazos):**

| Archivo | Cambio |
|---------|--------|
| `FilterChips.tsx` | shadows hardcodeados → `boxShadow: 1` / `boxShadow: 2` |
| `BusinessComments.tsx` | `#e91e63` → `LIKE_COLOR`, `#1a73e8` → `primary.main` |
| `SideMenu.tsx` | `#1a73e8` (avatar) → `primary.main` |
| `UserProfileSheet.tsx` | `#1a73e8` → `primary.main` |

Requiere primero agregar constantes a `src/constants/ui.ts`:

```typescript
export const LIKE_COLOR = '#e91e63';
export const RANKINGS_COLOR = '#e65100';
export const STATS_COLOR = '#7b1fa2';
```

**Commit 3 — Menores (9 reemplazos):**

| Archivo | Cambio |
|---------|--------|
| `FeedbackForm.tsx` | `#34a853` → `success.main` |
| `SideMenu.tsx` | 7 reemplazos (warning.main, warning.light, success.main, RANKINGS_COLOR, STATS_COLOR) |
| `LineChartCard.tsx` | `#ccc` → `action.disabled` |

**Verificacion:** `grep -rn "#[0-9a-fA-F]\{3,8\}" src/components/ --include="*.tsx"` solo debe mostrar excepciones documentadas.

**Test:** test local con dark mode activo, verificar visualmente que todo se ve correcto.

**Archivos:** 13
**Riesgo:** Bajo — solo cambios de styling

---

### Step 3: DT-1 — Hook `useUndoDelete`

**Crear:** `src/hooks/useUndoDelete.ts` (implementacion completa en specs)

**Puntos criticos de la implementacion:**

- `lastDeletedIdRef` para evitar stale closure en `confirmDelete`
- `pendingRef` con Map para soportar multiples deletes simultaneos
- `useEffect` cleanup que cancela todos los timers en unmount
- `message` configurable via options

**Refactor CommentsList.tsx:**

- Eliminar: `pendingDeleteId` state, `deleteTimerRef` ref, `handleDelete` con setTimeout, snackbar manual
- Agregar: `useUndoDelete<Comment>({ onConfirmDelete, onDeleteComplete: reload, message: 'Comentario eliminado' })`
- Actualizar render: `isPendingDelete(id)` para filtrar, `markForDelete(id, comment)` en onClick, `snackbarProps` en Snackbar

**Refactor BusinessComments.tsx:**

- Eliminar: `pendingDeletes` Map state, `deleteTimersRef` Map ref, `handleDeleteWithUndo`, snackbar manual (~40 lineas)
- Agregar: `useUndoDelete<Comment>({ onConfirmDelete, onDeleteComplete: onCommentsChange, message: 'Comentario eliminado' })`
- Actualizar render: mismo patron

**Test:** test unitario del hook (timer, cleanup, undo, multiples deletes). Test manual: eliminar, undo, eliminar 2 seguidos, navegar durante pending.

**Archivos:** 3 (1 nuevo, 2 refactor)
**Riesgo:** Medio — cambio de logica en 2 componentes criticos

---

### Step 4: Commit, test local, PR

- Correr tests: `npm test`
- Test local con emuladores: verificar delete/undo funciona en CommentsList y BusinessComments
- Verificar dark mode en ambos temas
- Crear PR `feat/comments-prereqs` → `feat/comments-improvements`

---

## Fase 1 — Features (Branch 2)

### Step 5: #110 — Skeleton Loader

**Cambio en CommentsList.tsx:**

Reemplazar el bloque `if (isLoading)` que muestra "Cargando..." por el skeleton de 5 items (3 lineas + circulo por item).

**Nota:** este skeleton es transitorio — sera absorbido por `PaginatedListShell` en Fase 2 (Step 12). Pero se implementa ahora para tener UX correcta desde Fase 1.

**Archivos:** 1
**Riesgo:** Ninguno

---

### Step 6: #111 — Empty State Mejorado

**Cambio en CommentsList.tsx:**

Reemplazar el bloque empty state existente por la version con texto motivacional ("Toca un comercio..."). Ya usa `action.disabled` (fijado en DT-3).

**Archivos:** 1
**Riesgo:** Ninguno

---

### Step 7: #108 + #104 — Preview Mejorado + Likes

**Cambio en CommentsList.tsx:**

- Agregar import `formatRelativeTime` de `src/utils/formatDate.ts`
- Agregar import `FavoriteIcon`, `ChatBubbleOutlineIcon`
- Reemplazar el secondary text de cada item: quitar `formatDateMedium`, agregar metadata row con fecha relativa, "(editado)", like count, reply count
- Ajustar truncado: usar `truncate` importado (ya de DT-2)

**Nota:** este step resuelve implicitamente **#105 (Indicador de respuestas)** al mostrar `replyCount` en el preview. No se necesita trabajo adicional para #105.

**Archivos:** 1
**Riesgo:** Bajo

---

### Step 8: #103 — Sorting

**Cambio en CommentsList.tsx:**

- Agregar import `ToggleButtonGroup`, `ToggleButton`
- Agregar state `sortMode`
- Agregar `sortedComments` useMemo
- Agregar UI: ToggleButtonGroup (oculto con < 3 items)
- Actualizar render para usar `sortedComments` en vez de `comments` directo

**Archivos:** 1
**Riesgo:** Bajo

---

### Step 9: #102 — Busqueda

**Cambio en CommentsList.tsx:**

- Agregar imports: `useDeferredValue`, `SearchIcon`, `CloseIcon`, `TextField`, `IconButton`
- Agregar states: `searchInput`, `deferredSearch` via useDeferredValue
- Agregar efecto reactivo para "cargar todos" cuando hay busqueda activa (workaround temporal — en Fase 2 se reemplaza por `loadAll` de DT-5)
- Agregar `filteredComments` useMemo
- Agregar UI: TextField en Box con padding (fix overflow 360px)
- Agregar `aria-live` para contador de resultados
- Agregar loading indicator durante carga masiva
- Actualizar render para usar `filteredComments`

**Workaround "cargar todos" (Fase 1):**

```typescript
// Approach simple: useEffect reactivo que llama loadMore repetidamente
// Funciona porque loadMore depende de [hasMore, isLoadingMore, loadPage]
// Cuando isLoadingMore cambia false→true→false, loadMore se recrea y el effect re-dispara
useEffect(() => {
  if (!searchInput || !hasMore || isLoadingMore) return;
  loadMore();
}, [searchInput, hasMore, isLoadingMore, loadMore]);
```

En Fase 2 (Step 11, DT-5) este effect se reemplaza por `loadAll(200)` del hook refactorizado, que es mas robusto (usa `hasMoreRef` interno).

**Archivos:** 1
**Riesgo:** Medio — el efecto reactivo depende del ciclo de recreacion de `loadMore`. Si un usuario tiene 200 comentarios, dispara ~10 requests secuenciales (20/pagina). Funciona pero es fragil.

---

### Step 10: Commit, test local, PR

- Correr tests
- Test local: verificar skeleton, empty state, preview mejorado, sorting, busqueda
- Verificar en 360px que no hay overflow
- Verificar dark mode
- Crear PR `feat/comments-phase1` → `feat/comments-improvements`

---

## Fase 2 — DT + Features (Branch 3)

### Step 11: DT-5 — `usePaginatedQuery` constraints genericos

**Cambio en `src/hooks/usePaginatedQuery.ts`:**

- Cambiar firma: `userId: string` → `constraints: QueryConstraint[]` + `cacheKey: string` (obligatorio)
- Internamente: reemplazar `where('userId', '==', userId)` por spread de `constraints`
- Agregar `hasMoreRef` que mirrorea `hasMore` state
- Agregar `loadAll(limit)` al return
- Actualizar tipo `UsePaginatedQueryReturn<T>` para incluir `loadAll`
- Cambiar `error: boolean` → `error: string | null` (compatibilidad con PaginatedListShell)
- Cache key: usar `${collectionPath}_${cacheKey}` en vez de `${collectionPath}_${userId}`

**Actualizar consumidores:**

- `CommentsList.tsx`: `usePaginatedQuery(collection, [where('userId', '==', uid)], 'createdAt', 20, uid)`
- `RatingsList.tsx`: idem con ratings collection
- `FavoritesList.tsx`: idem con favorites collection

**Tests:** actualizar 9 tests en `usePaginatedQuery.test.ts` con nueva firma.

**Archivos:** 4 (1 refactor + 3 consumidores)
**Riesgo:** Medio — cambio de firma, pero todos los consumidores se actualizan en el mismo commit

---

### Step 12: DT-6 — `PaginatedListShell`

**Crear:** `src/components/menu/PaginatedListShell.tsx` (implementacion completa en specs)

**Refactor de las 3 listas:**

**CommentsList** (mas simple — no tiene filtros previos):

- Eliminar: bloques `if (isLoading)`, `if (error)`, `if (isEmpty)`, boton "Cargar mas"
- Envolver en `<PaginatedListShell>` con `isFiltered` derivado de searchInput/filterBusiness

**RatingsList y FavoritesList** (ya tienen `useListFilters` + `<ListFilters>`):

- Estas listas ya usan `useListFilters` hook y renderizan `<ListFilters>` component para busqueda/filtros propios
- `PaginatedListShell` solo envuelve la parte de loading/error/empty/pagination, NO los filtros
- `isFiltered` se deriva del estado de `useListFilters` (no de PaginatedListShell)
- `noResultsMessage` se integra con el sistema de filtros existente
- RatingsList: pasar `renderSkeleton` custom con `Skeleton variant="rectangular"` para estrellas

**Archivos:** 4 (1 nuevo, 3 refactor)
**Riesgo:** Medio — refactor de 3 componentes, pero es extraccion de boilerplate sin cambio de logica

---

### Step 13: DT-4 — Extraer `CommentRow`

**Crear:** `src/components/business/CommentRow.tsx`

- Extraer ~170 lineas de `renderComment` en BusinessComments
- Props: 18 props (ver specs — incluye `replyCount` precalculado)
- Envolver con `memo()`

**Refactor BusinessComments.tsx:**

- Eliminar `renderComment` funcion inline
- Reemplazar por `<CommentRow>` con props explicitas
- Envolver handlers con `useCallback`: `handleToggleLike`, `handleStartEdit`, `handleSaveEdit`, `handleCancelEdit`, `handleDeleteComment`, `handleStartReply`

**Archivos:** 2 (1 nuevo, 1 refactor)
**Riesgo:** Medio-alto — componente complejo con muchas props. Testing exhaustivo necesario.

---

### Step 14: #106 — Editar Inline

**Cambio en CommentsList.tsx:**

- Agregar states: `editingId`, `editText`, `isSavingEdit`
- Agregar handlers: `handleStartEdit`, `handleSaveEdit`, `handleCancelEdit` (con `useCallback`)
- Agregar import `editComment` de services, `MAX_COMMENT_LENGTH` de constants
- Agregar IconButton de editar (EditIcon) junto al de eliminar
- Agregar UI condicional: cuando `editingId === comment.id`, mostrar TextField + check/close en vez de texto

**Archivos:** 1
**Riesgo:** Bajo — patron ya probado en BusinessComments

---

### Step 15: #101 — Filtro por Comercio

**Cambio en CommentsList.tsx:**

- Agregar import `Autocomplete`
- Agregar `businessOptions` useMemo (comercios unicos de items cargados)
- Agregar state `filterBusiness`
- Agregar `finalComments` useMemo que aplica filtro de business sobre `filteredComments`
- Agregar UI: Autocomplete en Box con padding (fix overflow)
- Actualizar render para usar `finalComments`

**Archivos:** 1
**Riesgo:** Bajo

---

### Step 16: #107 — Stats Resumen

**Cambio en CommentsList.tsx:**

- Agregar imports: `Collapse`, `ExpandLessIcon`, `ExpandMoreIcon`
- Agregar state `statsExpanded`
- Agregar `stats` useMemo
- Agregar UI: Box con role="button", tabIndex, aria-expanded, onKeyDown, grid 2x2 con Collapse

**Archivos:** 1
**Riesgo:** Bajo

---

### Step 17: Commit, test local, PR

- Correr tests (incluyendo los 9 actualizados de usePaginatedQuery)
- Test local: verificar todos los features de Fase 1 siguen funcionando
- Test edit inline, filtro por comercio, stats
- Verificar que PaginatedListShell funciona en las 3 listas
- Verificar dark mode y 360px
- Crear PR `feat/comments-phase2` → `feat/comments-improvements`

---

## Fase 3 — UX Avanzada (Branch 4)

### Step 18: #109 — Swipe Actions

**Crear:** `src/hooks/useSwipeActions.ts`

- Touch events: `onTouchStart`, `onTouchMove`, `onTouchEnd`
- Threshold: 80px horizontal, cancela si >10px vertical
- `transform: translateX()` con CSS transition
- Solo en `pointer: coarse`
- Reset al tocar otro item o scrollear

**Cambio en CommentsList.tsx:**

- Integrar `useSwipeActions` en cada item de la lista
- Botones revelados: eliminar (rojo) a la izquierda, editar (azul) a la derecha
- **Mantener** IconButtons visibles como fallback accesible

**Archivos:** 2 (1 nuevo, 1 cambio)
**Riesgo:** Alto — interaccion touch compleja. Testing exhaustivo en multiples dispositivos.

---

### Step 19: Commit, test local, PR

- Test en dispositivos reales (o emulador) con touch
- Verificar que no interfiere con scroll vertical
- Verificar fallback accesible (botones visibles)
- Crear PR `feat/comments-phase3` → `feat/comments-improvements`

---

## Post-implementacion (en feature branch, antes de main)

### Step 20: Actualizaciones de plataforma

**Ayuda:** actualizar `HelpSection.tsx` con 6 entradas nuevas (busqueda, sorting, edit, filtro, stats, swipe).

**Seed:** verificar que `scripts/seed-admin-data.mjs` tiene comments con `updatedAt`, `replyCount`, `likeCount` variado, `parentId`. Correr `seed-manager` agent.

**Privacidad y Admin:** N/A (confirmado en PRD).

### Step 21: Auditorias finales

- `help-docs-reviewer` — validar HelpSection vs features.md
- `dark-mode-auditor` — verificar zero `#hex` en archivos impactados
- `admin-metrics-auditor` — confirmar N/A
- `seed-manager` — validar seed data
- `security` — revisar cambios en services y hooks
- `architecture` — validar patrones nuevos

### Step 22: Documentacion

- Actualizar `docs/reference/PROJECT_REFERENCE.md` — resumen rapido, patrones clave, conteo de tests
- Actualizar `docs/reference/features.md` con nuevas capacidades del menu lateral
- Actualizar `docs/reference/files.md` con archivos nuevos (4)
- Actualizar `docs/reference/patterns.md` con nuevos patrones (`useUndoDelete`, `PaginatedListShell`, constraints genericos)
- Actualizar `docs/reference/issues.md` con issues #101-#111 resueltos
- Actualizar conteo de tests en PROJECT_REFERENCE (162+ → nuevo total)
- Crear `changelog.md` en la carpeta del feature

### Step 23: Merge a main (requiere aprobacion)

**Solo con aprobacion explicita del usuario.**

1. Verificar CI verde en feature branch
2. Test local completo en feature branch
3. Presentar resumen al usuario: features, DTs, tests, auditorias
4. Con aprobacion: merge `feat/comments-improvements` → main
5. Correr `/bump` (minor — features nuevas)
6. Verificar CI en main
7. Cleanup: eliminar feature branch y sub-branches

---

## Resumen

| Fase | Branch | Merge a | Steps | Archivos | Issues | DTs | Riesgo |
|------|--------|---------|-------|----------|--------|-----|--------|
| Pre-req | `comments-prereqs` | feature branch | 1-4 | 17 | 0 | DT-1,2,3 | Bajo-Medio |
| Fase 1 | `comments-phase1` | feature branch | 5-10 | 1 | 6 | 0 | Bajo-Medio |
| Fase 2 | `comments-phase2` | feature branch | 11-17 | 10 | 4 | DT-4,5,6 | Medio |
| Fase 3 | `comments-phase3` | feature branch | 18-19 | 2 | 1 | 0 | Alto |
| Post | feature branch | — | 20-22 | ~8 | 0 | 0 | Bajo |
| Main | feature branch | **main** | 23 | 0 | 0 | 0 | Bajo |

**Total: 23 steps, 4 PRs (→ feature branch) + 1 merge (→ main), ~38 archivos, 11 issues, 6 DTs.**
