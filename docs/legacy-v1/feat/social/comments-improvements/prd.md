# PRD: Mejoras en Comentarios + Dark Mode + Refactors

**Feature:** comments-improvements
**Categoria:** social
**Fecha:** 2026-03-14
**Issues:** #101-#112
**Revision:** 4 (scope completo: features + deuda tecnica + dark mode global)

---

## Contexto

El menu lateral tiene una seccion "Mis Comentarios" (`CommentsList.tsx`) basica: nombre del comercio, texto truncado, fecha y boton de eliminar. `BusinessComments.tsx` ya tiene edicion inline, likes, sorting y threads que el menu lateral no expone.

Las auditorias (arquitectura, UI, performance, dark mode) detectaron:

- **27 colores hardcodeados** en `src/` (12 criticos, 6 moderados, 9 menores)
- **Memory leak** en timer de delete sin cleanup
- **Codigo duplicado** (undo-delete, truncate, loading/error/empty en 3 listas)
- **God component** en BusinessComments (668 lineas, funcion inline 170 lineas)
- **Hook `usePaginatedQuery` no generico** (hardcodea `userId` filter)

---

## Objetivo

1. Transformar "Mis Comentarios" en un hub completo de gestion
2. Resolver toda la deuda tecnica del modulo de comentarios y listas del menu
3. Eliminar todos los colores hardcodeados de `src/` (dark mode completo)
4. Establecer patrones reutilizables (`useUndoDelete`, `PaginatedListShell`, constraints genericos)

---

## Alcance

### A. Features nuevas (11 issues)

#### Fase 1 — Quick Wins (6 issues)

| Issue | Mejora | Descripcion |
|-------|--------|-------------|
| #110 | Skeleton loader | Skeletons MUI en lugar de "Cargando..." |
| #111 | Empty state mejorado | Mensaje motivacional, icono dark-mode-compatible |
| #108 | Preview mejorado | Fecha relativa, replies count, "(editado)", likes badge |
| #102 | Busqueda de texto | `useDeferredValue`, filtra por texto y nombre de comercio. "Cargar todos" automatico al activar busqueda (safety limit: 200 items). Loading indicator durante carga masiva |
| #103 | Ordenamiento multiple | Chips: Recientes, Antiguos, Mas likes. Ocultos con menos de 3 items |
| #104 | Mostrar likes recibidos | Icono + cantidad en cada item |

**Fixes incluidos en Fase 1:**

| Fix | Descripcion |
|-----|-------------|
| Memory leak: timer sin cleanup | `useEffect` cleanup para timers al desmontar |
| Snackbar sin `autoHideDuration` | Agregar en CommentsList y BusinessComments |
| Accesibilidad | `aria-label` en "Cargar mas", items disabled, busqueda, `aria-live` para resultados, `aria-pressed` en sorting chips |

#### Fase 2 — Mejoras Core (4 issues)

| Issue | Mejora | Descripcion |
|-------|--------|-------------|
| #106 | Editar inline | Editar desde el menu sin navegar al comercio |
| #101 | Filtrar por comercio | Autocomplete con comercios del usuario |
| #107 | Stats resumen | Card colapsable: total, likes, promedio, mas popular |
| #105 | Indicador de respuestas | Solo replyCount (ya resuelto en #108) |

#### Fase 3 — UX Avanzada (1 issue)

| Issue | Mejora | Descripcion |
|-------|--------|-------------|
| #109 | Swipe actions | Gestos swipe en mobile + fallback con botones visibles para accesibilidad |

---

### B. Deuda tecnica (6 items)

#### DT-1: Hook `useUndoDelete` (Fase 1)

**Problema:** Logica duplicada entre CommentsList y BusinessComments. Sin cleanup en unmount (memory leak). Sin `autoHideDuration` en snackbar.

**Solucion:** Hook con Map de pending deletes, timers, undo del mas reciente, cleanup en unmount, `snackbarProps` con `autoHideDuration`. Adoptar en ambos componentes.

**Archivos:** nuevo `src/hooks/useUndoDelete.ts`, refactor CommentsList, BusinessComments

#### DT-2: Funcion `truncate` duplicada (Fase 1)

**Problema:** Misma funcion inline en CommentsList y UserProfileSheet.

**Solucion:** Extraer a `src/utils/text.ts`.

**Archivos:** nuevo `src/utils/text.ts`, refactor CommentsList, UserProfileSheet

#### DT-3: Dark mode — colores hardcodeados (Fase 1)

**Problema:** 27 colores hardcodeados en `src/`.

**Solucion por severidad:**

**Criticos (12) — rompen dark mode:**

| Archivo | Actual | Nuevo |
|---------|--------|-------|
| `LocationFAB.tsx:18` | `#fff` (background) | `background.paper` |
| `LocationFAB.tsx:19` | `#666` (icon) | `text.secondary` |
| `LocationFAB.tsx:21` | `#f5f5f5` (hover) | `action.hover` |
| `UserProfileSheet.tsx:67` | `#dadce0` (drag handle) | `divider` |
| `BusinessSheet.tsx:64` | `#dadce0` (drag handle) | `divider` |
| `CommentsList.tsx:107` | `#ccc` (empty icon) | `action.disabled` |
| `FavoritesList.tsx:101` | `#ccc` (empty icon) | `action.disabled` |
| `RatingsList.tsx:88` | `#ccc` (empty icon) | `action.disabled` |
| `BusinessComments.tsx:519` | `#fff` (send btn) | `primary.contrastText` |
| `BusinessComments.tsx:619` | `#fff` (reply send btn) | `primary.contrastText` |
| `MapView.tsx:82` | `rgba(255,255,255,0.95)` (loading) | `background.paper` con alpha |
| `NotificationItem.tsx:24` | `#34a853` (feedback icon) | `success.main` |

**Moderados (6) — funcionan pero no usan tokens:**

| Archivo | Actual | Nuevo |
|---------|--------|-------|
| `FilterChips.tsx:12` | `boxShadow: '0 1px 3px rgba(0,0,0,0.15)'` | `theme.shadows[1]` |
| `FilterChips.tsx:15` | `boxShadow: '0 1px 4px rgba(0,0,0,0.25)'` | `theme.shadows[2]` |
| `BusinessComments.tsx:387` | `#e91e63` (like active) | Constante `LIKE_COLOR` en `src/constants/ui.ts` |
| `BusinessComments.tsx:311` | `#1a73e8` (avatar) | `primary.main` |
| `SideMenu.tsx:155` | `#1a73e8` (avatar) | `primary.main` |
| `UserProfileSheet.tsx:84` | `#1a73e8` (avatar) | `primary.main` |

**Menores (9) — decorativos, tokenizar para consistencia:**

| Archivo | Actual | Nuevo |
|---------|--------|-------|
| `FeedbackForm.tsx:71` | `#34a853` (check icon) | `success.main` |
| `SideMenu.tsx:222` | `#ff9800` (Recientes icon) | `warning.main` |
| `SideMenu.tsx:229` | `#fbc02d` (Sugeridos icon) | `warning.light` |
| `SideMenu.tsx:243` | `#fbbc04` (Calificaciones) | `warning.light` |
| `SideMenu.tsx:250` | `#34a853` (Feedback icon) | `success.main` |
| `SideMenu.tsx:257` | `#e65100` (Rankings icon) | Constante `RANKINGS_COLOR` |
| `SideMenu.tsx:264` | `#7b1fa2` (Stats icon) | Constante `STATS_COLOR` |
| `SideMenu.tsx:300` | `#ffb74d`/`#fb8c00` (toggle) | `warning.light`/`warning.main` |
| `admin/charts/LineChartCard.tsx:68` | `#ccc` (legend) | `action.disabled` |

**No requieren fix (excepciones validas):** theme definitions, ThemePlayground, rankings constants, map constants, chart palettes, BusinessMarker (Google Maps Pin), MenuPhotoViewer/Section (fullscreen overlay intencional), UserScoreCard (gradients decorativos), FavoriteButton/FavoritesList `#ea4335`/SideMenu `#ea4335`/`#1a73e8` icons (marca).

#### DT-4: Extraer `CommentRow` de BusinessComments (Fase 2)

**Problema:** `renderComment` es funcion inline ~170 lineas que no se puede memoizar. Accede a ~12 variables del scope via closure.

**Solucion:** Componente `CommentRow` con `memo()`. Prop `isEditing: boolean` precalculada (evita re-renders de todos los rows al cambiar `editingId`). Handlers con `useCallback`.

**Archivos:** nuevo `src/components/business/CommentRow.tsx`, refactor BusinessComments

#### DT-5: Refactor `usePaginatedQuery` a constraints genericos (Fase 2)

**Problema:** Hook hardcodea `where('userId', '==', userId)`. No es reutilizable para otros filtros.

**Solucion:** Cambiar firma a `constraints: QueryConstraint[]`. Los consumidores pasan `[where('userId', '==', uid)]` explicitamente.

**Restriccion critica:** `invalidateQueryCache(collectionPath, userId)` tiene 10+ call sites en services (comments, ratings, favorites, priceLevels). NO cambiar su firma. El hook internamente extrae el userId de los constraints para derivar la misma cache key, o acepta un `cacheKey` opcional.

**Archivos:** refactor `usePaginatedQuery.ts`, actualizar CommentsList, RatingsList, FavoritesList. NO tocar `queryCache.ts` ni services.

#### DT-6: Extraer `PaginatedListShell` (Fase 2)

**Problema:** 3 listas del menu repiten ~50 lineas de loading/error/empty/pagination.

**Solucion:** Componente wrapper con props: `isLoading`, `error`, `hasMore`, `isEmpty`, `emptyIcon`, `emptyMessage`, `emptySubtext`, `onRetry`, `onLoadMore`, `isLoadingMore`, `skeletonCount`, `noResultsMessage` (para busqueda sin resultados, distinto de empty state), `children`.

**Archivos:** nuevo `src/components/menu/PaginatedListShell.tsx`, refactor CommentsList, RatingsList, FavoritesList

---

### C. Decisiones de scope

| Item | Decision | Razon |
|------|----------|-------|
| #112 Virtualizacion | **Diferido** | DOM nunca supera 40-60 nodos con paginacion |
| #105 "Nuevas" | **Simplificado** | Requiere Cloud Function `latestReplyAt` |
| Like color `#e91e63` | **Constante** | Rosa intencional, distinto de secondary (rojo) |
| Busqueda | **Cargar todos + limit 200** | Loading indicator + safety net |
| `invalidateQueryCache` | **No tocar firma** | 10+ call sites en services |
| FavoriteButton `#ea4335` | **Excepcion** | Color de marca, no cambia entre temas |

---

## Archivos impactados

| Archivo | Cambios |
|---------|---------|
| `src/components/menu/CommentsList.tsx` | Features + DT-1, DT-2, DT-5, DT-6 |
| `src/components/business/BusinessComments.tsx` | DT-1, DT-3 (x4), DT-4 |
| `src/components/menu/RatingsList.tsx` | DT-3, DT-5, DT-6 |
| `src/components/menu/FavoritesList.tsx` | DT-3, DT-5, DT-6 |
| `src/components/user/UserProfileSheet.tsx` | DT-2, DT-3 (x2) |
| `src/components/business/BusinessSheet.tsx` | DT-3 |
| `src/components/map/LocationFAB.tsx` | DT-3 (x3) |
| `src/components/map/MapView.tsx` | DT-3 |
| `src/components/notifications/NotificationItem.tsx` | DT-3 |
| `src/components/search/FilterChips.tsx` | DT-3 (x2) |
| `src/components/menu/FeedbackForm.tsx` | DT-3 |
| `src/components/layout/SideMenu.tsx` | DT-3 (x8) |
| `src/components/admin/charts/LineChartCard.tsx` | DT-3 |
| `src/hooks/usePaginatedQuery.ts` | DT-5 |
| `src/hooks/useUndoDelete.ts` | **Nuevo** — DT-1 |
| `src/utils/text.ts` | **Nuevo** — DT-2 |
| `src/constants/ui.ts` | DT-3 (`LIKE_COLOR`, `RANKINGS_COLOR`, `STATS_COLOR`) |
| `src/components/business/CommentRow.tsx` | **Nuevo** — DT-4 |
| `src/components/menu/PaginatedListShell.tsx` | **Nuevo** — DT-6 |

---

## Orden de implementacion

### Pre-requisitos (DT, Fase 1)

1. DT-2: Extraer `truncate`
2. DT-3: Dark mode fixes (27 reemplazos en 13 archivos)
3. DT-1: Hook `useUndoDelete`

### Fase 1 (Features)

1. #110: Skeleton loader
2. #111: Empty state mejorado
3. #108 + #104: Preview mejorado + likes
4. #103: Sorting chips
5. #102: Busqueda de texto

### Fase 2 (DT + Features)

1. DT-5: `usePaginatedQuery` constraints genericos (primero, DT-6 depende)
2. DT-6: `PaginatedListShell`
3. DT-4: Extraer `CommentRow`
4. #106: Editar inline
5. #101: Filtro por comercio
6. #107: Stats resumen

### Fase 3

1. #109: Swipe actions

---

## Restricciones

- **Dark mode**: cero `#hex` en archivos impactados (excepto excepciones documentadas)
- **Consistencia**: reutilizar patrones de BusinessComments
- **Mobile-first**: 360px+
- **Sin dependencias nuevas**
- **Offline**: degradacion graciosa (modo tren)
- **Cache backward-compatible**: no cambiar firma de `invalidateQueryCache`
- **Sorting/busqueda**: ocultos con menos de 3 items
- **Busqueda**: cargar todos automatico, safety limit 200, loading indicator

---

## Criterios de exito

- Encontrar un comentario en menos de 5 segundos
- Zero regresiones en comments, ratings, favoritos
- Tests pasan, cobertura no disminuye
- Lighthouse performance no baja
- Zero `#hex` en archivos impactados (grep verification)
- Sin memory leaks en unmount
- `PaginatedListShell` en las 3 listas
- `usePaginatedQuery` acepta constraints genericos

---

## Actualizaciones de plataforma

### Seccion de Ayuda (`HelpSection.tsx`)

Agregar/actualizar entradas para:

- **Busqueda de comentarios**: "Podes buscar tus comentarios por texto o nombre de comercio desde el menu lateral"
- **Ordenamiento**: "Ordena tus comentarios por recientes, antiguos o mas likes"
- **Edicion inline**: "Edita tus comentarios directamente desde el menu lateral sin navegar al comercio"
- **Filtro por comercio**: "Filtra tus comentarios por comercio especifico"
- **Stats**: "Ve un resumen de tus comentarios: total, likes recibidos, promedio y mas popular"
- **Swipe actions**: "Desliza a izquierda o derecha para eliminar o editar un comentario (mobile)"

### Politica de Privacidad

**N/A — sin cambios.** No se recopilan datos nuevos. Las features nuevas (busqueda, sorting, stats) operan sobre datos ya existentes en Firestore (comments, commentLikes). No hay nuevo tracking, analytics, ni almacenamiento.

### Seed Data (`scripts/seed-admin-data.mjs`)

Verificar que los comentarios de seed tengan:

- `updatedAt` en algunos (para probar indicador "editado")
- `replyCount > 0` en algunos (para probar badge de replies)
- `likeCount` variado (para probar sorting por likes y stats)
- `parentId` en algunos (replies existentes)

Si faltan estos campos, agregar datos de seed que los cubran.

### Panel Admin

**N/A — sin cambios.** Las features son todas de UI del menu lateral del usuario. No se agregan nuevas metricas, eventos, ni colecciones que requieran visibilidad en el admin dashboard.

---

## Fuera de alcance

- Virtualizacion (diferido)
- Indicador "nuevas" respuestas (requiere Cloud Function)
- Cambios en `queryCache.ts` ni services
- Exportar comentarios
