# PRD: Reorganizar components/menu/ (39 archivos, 6+ dominios mezclados)

**Feature:** reorganizar-components-menu
**Categoria:** infra
**Fecha:** 2026-03-28
**Issue:** #218
**Prioridad:** Media

---

## Contexto

La app paso de una navegacion por side-menu a tabs (v3.0.0, #158), pero el directorio `components/menu/` no se reorganizo. Contiene 42 archivos que mezclan 6+ dominios: social (activity feed, follows, rankings, recommendations), perfil (settings, onboarding, account), listas (shared lists, favorites, create dialog), comentarios/ratings, feedback, y utilidades compartidas (PaginatedListShell, ListFilters). Las pantallas de tabs (`ProfileScreen`, `SocialScreen`, `ListsScreen`) ya existen en sus directorios correctos pero importan lazy desde `../menu/`.

## Problema

- **Discoverability degradada:** Un desarrollador buscando codigo de rankings debe saber que vive en `menu/`, no en `social/`. Lo mismo para settings (en `menu/`, no en `profile/`).
- **Acoplamiento organizacional blando:** Los archivos no reflejan la arquitectura de tabs actual. `SocialScreen` importa 4 componentes desde `menu/`; `ProfileScreen` importa 10; `ListsScreen` importa 3. Esto dificulta entender las dependencias reales de cada tab.
- **Barrera para nuevos contribuidores:** `menu/` con 42 archivos es el directorio mas grande de `components/`. Un directorio "cajon de sastre" senala falta de estructura y complica el onboarding al codebase.

## Solucion

### S1. Redistribuir archivos por dominio de tab

Mover cada archivo de `menu/` al directorio del dominio al que pertenece segun la arquitectura de tabs actual:

**A `components/social/`** (importados por `SocialScreen`):
- `ActivityFeedView.tsx`, `ActivityFeedItem.tsx` -- feed de actividad de seguidos
- `FollowedList.tsx` -- lista de seguidos
- `ReceivedRecommendations.tsx` -- recomendaciones recibidas
- `RankingsView.tsx`, `RankingItem.tsx`, `RankingsEmptyState.tsx` -- rankings semanales
- `UserProfileModal.tsx`, `UserScoreCard.tsx`, `BadgesList.tsx`, `ScoreSparkline.tsx` -- perfil publico (usado desde rankings)

**A `components/profile/`** (importados por `ProfileScreen`):
- `SettingsPanel.tsx`, `AccountSection.tsx`, `LocalityPicker.tsx` -- configuracion
- `OnboardingChecklist.tsx`, `PendingActionsSection.tsx` -- onboarding
- `EditDisplayNameDialog.tsx` -- edicion de nombre
- `HelpSection.tsx` -- ayuda
- `FeedbackForm.tsx`, `MyFeedbackList.tsx` -- feedback
- `PrivacyPolicy.tsx` -- politica de privacidad
- `CommentsList.tsx`, `CommentsStats.tsx`, `CommentsToolbar.tsx`, `CommentItem.tsx` -- mis comentarios
- `useCommentsListFilters.ts`, `useVirtualizedList.ts` -- hooks de comentarios
- `RatingsList.tsx` -- mis calificaciones
- `StatsView.tsx` -- estadisticas personales
- `CheckInsView.tsx` -- check-ins del usuario

**A `components/lists/`** (importados por `ListsScreen`):
- `FavoritesList.tsx` -- favoritos
- `SharedListsView.tsx`, `SharedListDetailView.tsx` -- listas compartidas
- `CreateListDialog.tsx` -- crear lista (ya importado por `ListsScreen`)
- `EditorsDialog.tsx`, `InviteEditorDialog.tsx` -- editores de listas

**A `components/home/`** (importados por `HomeScreen`/mapa):
- `SuggestionsView.tsx` -- sugerencias contextuales
- `TrendingList.tsx`, `TrendingBusinessCard.tsx` -- trending
- `RecentVisits.tsx` -- visitas recientes

**A `components/common/`** (reutilizables cross-domain):
- `PaginatedListShell.tsx` -- wrapper generico de listas paginadas
- `ListFilters.tsx` -- filtros compartidos entre FavoritesList, RatingsList, SuggestionsView

### S2. Actualizar imports

Actualizar todos los `import` y `lazy()` que referencian `menu/`:
- `ProfileScreen.tsx` -- 10 lazy imports
- `SocialScreen.tsx` -- 4 lazy imports
- `ListsScreen.tsx` -- 3 imports (1 directo + 2 lazy)
- Imports internos entre archivos movidos (ej: `CommentsList` importa `CommentsStats`, `PaginatedListShell`, etc.)

### S3. Eliminar directorio `menu/`

Una vez redistribuidos todos los archivos, eliminar `components/menu/`. Si algun archivo queda sin destino claro, evaluar caso por caso.

### S4. Actualizar documentacion

Actualizar `docs/reference/files.md` y `docs/reference/architecture.md` para reflejar la nueva estructura.

---

## Scope

| Item | Prioridad | Esfuerzo |
|------|-----------|----------|
| Mover 11 archivos a `social/` | Alta | S |
| Mover 21 archivos a `profile/` | Alta | M |
| Mover 5 archivos a `lists/` | Alta | S |
| Mover 3 archivos a `home/` | Alta | S |
| Mover 2 archivos a `common/` | Alta | S |
| Actualizar imports en consumidores (ProfileScreen, SocialScreen, ListsScreen) | Alta | S |
| Actualizar imports internos entre archivos movidos | Alta | M |
| Verificar que build compila sin errores | Alta | S |
| Verificar que todos los tests pasan | Alta | S |
| Actualizar `files.md` y `architecture.md` | Media | S |
| Eliminar directorio `menu/` vacio | Baja | S |

**Esfuerzo total estimado:** M

---

## Out of Scope

- Refactorizar la logica interna de ningun componente movido (solo mover + actualizar imports)
- Renombrar archivos o componentes (los nombres se mantienen identicos)
- Cambiar la estructura de hooks o services (solo se mueven componentes de `menu/`)
- Mover tests (los archivos en `menu/` no tienen tests unitarios propios; los hooks `useCommentsListFilters` y `useVirtualizedList` tampoco tienen tests en el inventario actual)

---

## Tests

Este es un refactor puramente organizacional. No se agrega ni modifica logica. La validacion es que la suite existente siga pasando.

### Archivos que necesitaran tests

| Archivo | Tipo | Que testear |
|---------|------|-------------|
| N/A | N/A | No hay logica nueva. Verificar que los 1131 tests existentes pasan sin cambios. |

### Criterios de testing

- Todos los tests existentes pasan sin modificaciones (0 failures)
- Build de produccion compila sin errores TypeScript
- Lint pasa sin errores nuevos
- Lazy loading funciona correctamente (verificar en dev que cada tab carga sus componentes)

---

## Seguridad

No hay impacto de seguridad. Este refactor solo mueve archivos y actualiza paths de imports. No modifica logica, datos, Firestore rules, ni Cloud Functions.

- [x] No se agregan colecciones ni campos nuevos
- [x] No se modifican servicios ni hooks con side effects
- [x] No se cambian rutas publicas ni permisos

---

## Offline

No hay impacto en comportamiento offline. Los componentes movidos mantienen su misma logica y los mismos imports a servicios/hooks.

### Data flows

| Operacion | Tipo (read/write) | Estrategia offline | Fallback UI |
|-----------|-------------------|-------------------|-------------|
| N/A | N/A | Sin cambios | Sin cambios |

### Checklist offline

- [x] Sin cambios en reads de Firestore
- [x] Sin cambios en writes
- [x] Sin cambios en APIs externas
- [x] Sin cambios en UI offline
- [x] Sin cambios en cache

### Esfuerzo offline adicional: N/A

---

## Modularizacion

Este refactor mejora la modularizacion existente al alinear la estructura de directorios con la arquitectura de tabs. Los componentes ya estan desacoplados (reciben datos via props o hooks propios); solo cambia su ubicacion fisica.

### Checklist modularizacion

- [x] Logica de negocio ya vive en hooks/services (no se modifica)
- [x] Componentes movidos son reutilizables fuera del contexto actual
- [x] No se agregan useState de logica de negocio a ningun layout
- [x] Props explicitas se mantienen sin cambios
- [x] Cada prop de accion mantiene su handler real

**Nota sobre `PaginatedListShell` y `ListFilters`:** Estos dos componentes son genuinamente cross-domain (usados por 3+ dominios). Moverlos a `common/` refleja mejor su naturaleza reutilizable que tenerlos en un dominio especifico.

---

## Success Criteria

1. El directorio `components/menu/` deja de existir; los 42 archivos estan distribuidos en `social/`, `profile/`, `lists/`, `home/` y `common/`
2. `npm run build` compila sin errores TypeScript
3. Los 1131 tests pasan sin modificaciones
4. `npm run lint` pasa sin errores nuevos
5. Las 4 tabs de la app cargan correctamente sus componentes lazy-loaded en `dev:full`
