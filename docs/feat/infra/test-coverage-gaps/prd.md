# PRD: Test coverage gaps -- 20 hooks + 15 services untested

**Feature:** test-coverage-gaps
**Categoria:** infra
**Fecha:** 2026-03-27
**Issue:** #194
**Prioridad:** Media

---

## Contexto

Modo Mapa tiene 465 tests (369 frontend + 96 backend) con cobertura global >90%, pero esto refleja alta cobertura en los archivos testeados, no del codebase completo. El issue #194 identifica 20 hooks, 15 services y 48 Cloud Functions sin tests unitarios. Esta deuda tecnica se acumulo durante el desarrollo rapido de features entre v2.10 y v2.29 (47 issues cerrados). La politica de testing (tests.md) exige >=80% en codigo nuevo y el CI lo enforce, pero muchos archivos pre-existentes nunca fueron cubiertos.

## Problema

- **20 hooks sin tests**: incluye hooks criticos para UX como `useCheckIn`, `useConnectivity`, `useNotifications`, `useUnsavedChanges` y `useAsyncData` que manejan state complejo, timers y race conditions
- **15 services sin tests**: `feedback.ts`, `menuPhotos.ts`, `suggestions.ts`, `notifications.ts`, `activityFeed.ts`, `trending.ts`, `userProfile.ts` y 7+ admin services contienen logica de negocio (queries, cache invalidation, aggregations) sin cobertura
- **48 de 67 Cloud Functions sin tests**: todos los scheduled (7), la mayoria de triggers (8 de 13 sin tests), todos los callable (2 de 4 sin tests), y 8 admin endpoints. Estas funciones manejan integridad de datos (counters, cascade deletes, rate limits, moderacion) y fallos silenciosos son dificiles de detectar en produccion

## Solucion

### S1 -- Hooks criticos (UX-blocking)

Testear los hooks que impactan directamente la experiencia del usuario y tienen logica de state compleja:

- **`useCheckIn`**: cooldown 4h, limite diario 10, validacion proximidad, toggle state
- **`useConnectivity`**: online/offline detection, real connectivity check con fetch, auto-sync trigger
- **`useAsyncData`**: race conditions, cleanup on unmount, loading/error states (usado por todos los paneles admin)
- **`useUnsavedChanges`**: dialog state machine (clean -> dirty -> confirming -> discarded)
- **`useUndoDelete`**: Map de pending deletes, timer management, ref sync, cleanup on unmount
- **`useNotifications`**: polling 60s con visibility-awareness, badge count, mark as read

Patron a seguir: los tests existentes de `usePaginatedQuery.test.ts` y `useBusinessDataCache.test.ts` usan `renderHook` de `@testing-library/react` con mocks de Firestore SDK. Timers se testean con `vi.useFakeTimers()`.

### S2 -- Services de lectura y escritura

Testear services que manejan CRUD contra Firestore con logica de negocio:

- **`feedback.ts`**: sendFeedback con media upload opcional, markFeedbackViewed, rate limit client-side
- **`menuPhotos.ts`**: fetch con converter, report callable
- **`notifications.ts`**: fetch paginado, mark read, count unread
- **`suggestions.ts`**: aggregation con distancia, filtro por perfil publico
- **`activityFeed.ts`**: subcollection read, paginacion
- **`trending.ts`**: read de trending data
- **`userProfile.ts`**: 7 queries paralelas, aggregation compleja

Patron a seguir: los tests existentes de `ratings.test.ts`, `comments.test.ts`, `favorites.test.ts` mockean `firebase/firestore` a nivel de modulo y verifican que se llamen las funciones correctas con los argumentos esperados. Cache invalidation se verifica con `invalidateQueryCache` mock.

### S3 -- Cloud Functions (triggers + scheduled + callable + admin)

Testear las funciones server-side que mantienen integridad de datos:

**Triggers sin tests (8):**
- `favorites.ts`: dual counter (user favoriteCount + business stats)
- `customTags.ts`: rate limit + moderacion de labels
- `feedback.ts`: rate limit + conditional flag/delete
- `menuPhotos.ts`: thumbnail generation, Cloud Storage I/O
- `users.ts`: counter increment simple
- `priceLevels.ts`: counter simple
- `follows.ts`: follower/following counters, fan-out, new_follower notification
- `userSettings.ts`: cleanup on settings change
- `recommendations.ts`: rate limit, notification creation
- `checkins.ts`: ya tiene test parcial, verificar cobertura

**Scheduled sin tests (5 de 7):**
- `rankings.ts`: ISO week math, score computation, batch writes
- `dailyMetrics.ts`: percentile calculation, counter aggregation
- `cleanupNotifications.ts`: batch delete >30 days
- `cleanupPhotos.ts`: Storage cleanup de fotos rechazadas
- `cleanupActivityFeed.ts`: batch delete items expirados

**Callable sin tests (2 de 4):**
- `cleanAnonymousData.ts`: multi-collection cascade delete

**Admin sin tests (7 de 9):**
- `feedback.ts`: GitHub API via Octokit, notifications
- `claims.ts`: auth custom claims, bootstrap
- `backups.ts`: Firestore export, validateBackupId
- `menuPhotos.ts`: approve/reject con Storage operations
- `storageStats.ts`: Storage bucket aggregation
- `analyticsReport.ts`: GA4 data fetch
- `perfMetrics.ts`: write perf data

Patron a seguir: `comments.test.ts` y `commentLikes.test.ts` en `functions/src/__tests__/triggers/` mockean `firebase-admin/firestore` con `FieldValue.increment` hoisted, y exportan el handler directamente mockeando `firebase-functions/v2/firestore`.

---

## Scope

| Item | Prioridad | Esfuerzo |
|------|-----------|----------|
| Tests `useCheckIn` | Alta | S |
| Tests `useConnectivity` | Alta | S |
| Tests `useAsyncData` | Alta | S |
| Tests `useUnsavedChanges` | Alta | S |
| Tests `useUndoDelete` | Alta | S |
| Tests `useNotifications` | Alta | S |
| Tests `useOnboardingFlow` | Media | S |
| Tests `useRememberedEmail` | Media | S |
| Tests `usePasswordConfirmation` | Media | S |
| Tests `useProfileStats` | Media | S |
| Tests `useProfileVisibility` | Media | S |
| Tests `useTabNavigation` (existente, verificar) | Media | S |
| Tests `useUserLocation` | Baja | S |
| Tests `usePullToRefresh` | Baja | S |
| Tests `useScreenTracking` | Baja | S |
| Tests `usePriceLevelFilter` (existente) | -- | -- |
| Tests `useTabRefresh` | Baja | S |
| Tests `useAbuseLogsRealtime` | Baja | S |
| Tests `useMyCheckIns` | Media | S |
| Tests `useSuggestions` (existente) | -- | -- |
| Tests `feedback.ts` service | Alta | M |
| Tests `menuPhotos.ts` service | Media | S |
| Tests `notifications.ts` service | Alta | S |
| Tests `suggestions.ts` service | Baja | S |
| Tests `activityFeed.ts` service | Media | S |
| Tests `trending.ts` service | Baja | S |
| Tests `userProfile.ts` service | Alta | M |
| Tests admin services (7) | Media | M |
| Tests `favorites.ts` trigger | Alta | S |
| Tests `customTags.ts` trigger | Alta | M |
| Tests `feedback.ts` trigger | Alta | M |
| Tests `menuPhotos.ts` trigger | Media | M |
| Tests `follows.ts` trigger | Alta | M |
| Tests `recommendations.ts` trigger | Media | S |
| Tests simple triggers (users, priceLevels) | Baja | S |
| Tests `rankings.ts` scheduled | Media | M |
| Tests `dailyMetrics.ts` scheduled | Media | M |
| Tests cleanup scheduled (3) | Baja | S |
| Tests `cleanAnonymousData.ts` callable | Media | S |
| Tests admin functions (7) | Media | L |

**Esfuerzo total estimado:** XL (dividido en fases iterativas)

---

## Out of Scope

- Rewrite de archivos existentes para mejorar testability (refactoring se hace solo si es blocker para testear)
- Tests de componentes puramente visuales (skeletons, layouts estaticos) -- excluidos por politica
- Tests E2E o de integracion con emuladores reales de Firebase
- Aumentar coverage de archivos que ya tienen tests con >80% (ej: `AuthContext` con 77% stmts)

---

## Tests

### Archivos que necesitaran tests

**Frontend -- Hooks:**

| Archivo | Tipo | Que testear |
|---------|------|-------------|
| `src/hooks/useCheckIn.ts` | Hook | Cooldown 4h logic, daily limit 10, proximity validation, toggle on/off, error handling |
| `src/hooks/useConnectivity.ts` | Hook | Online/offline event handling, real connectivity check, auto-sync trigger, state transitions |
| `src/hooks/useAsyncData.ts` | Hook | Loading/error/data states, race condition prevention (stale closure), cleanup on unmount |
| `src/hooks/useUnsavedChanges.ts` | Hook | State machine: clean->dirty->confirming->discarded, dialog open/close, reset |
| `src/hooks/useUndoDelete.ts` | Hook | Map de pending deletes, timer management con fake timers, cleanup on unmount, snackbarProps |
| `src/hooks/useNotifications.ts` | Hook | Polling interval 60s, visibility-aware pause/resume, badge count, mark read |
| `src/hooks/useOnboardingFlow.ts` | Hook | Step progression, completion detection, localStorage persistence |
| `src/hooks/usePasswordConfirmation.ts` | Hook | Match validation, error messages, edge cases (empty, whitespace) |
| `src/hooks/useRememberedEmail.ts` | Hook | localStorage read/write, initial value, clear |
| `src/hooks/useProfileStats.ts` | Hook | Aggregation de stats, loading state, error handling |
| `src/hooks/useProfileVisibility.ts` | Hook | Public/private toggle, derived state |
| `src/hooks/useMyCheckIns.ts` | Hook | Fetch check-ins, pagination, pull-to-refresh |
| `src/hooks/useUserLocation.ts` | Hook | Geolocation API mock, permission handling, error states |
| `src/hooks/usePullToRefresh.ts` | Hook | Touch events, threshold 80px, scrollTop check, cancel vertical |
| `src/hooks/useScreenTracking.ts` | Hook | Analytics trackEvent calls con screen names |
| `src/hooks/useTabRefresh.ts` | Hook | Refresh callback trigger, tab change detection |
| `src/hooks/useAbuseLogsRealtime.ts` | Hook | Realtime listener setup/cleanup, data transformation |

**Frontend -- Services:**

| Archivo | Tipo | Que testear |
|---------|------|-------------|
| `src/services/feedback.ts` | Service | sendFeedback con/sin media, markViewed, fetchUserFeedback, rate limit |
| `src/services/menuPhotos.ts` | Service | fetchMenuPhoto, reportMenuPhoto callable |
| `src/services/notifications.ts` | Service | fetchNotifications paginado, markAsRead, countUnread |
| `src/services/activityFeed.ts` | Service | fetchActivityFeed paginado, subcollection query |
| `src/services/trending.ts` | Service | fetchTrending, data transformation |
| `src/services/userProfile.ts` | Service | 7 parallel queries, aggregation, error en queries individuales |
| `src/services/suggestions.ts` | Service | Aggregation, distance filter |
| `src/services/adminFeedback.ts` | Service | Admin CRUD operations |

**Cloud Functions -- Triggers:**

| Archivo | Tipo | Que testear |
|---------|------|-------------|
| `functions/src/triggers/favorites.ts` | Trigger | onCreate counter increment, onDelete counter decrement, fan-out to followers |
| `functions/src/triggers/customTags.ts` | Trigger | Rate limit check, moderation check, counter ops |
| `functions/src/triggers/feedback.ts` | Trigger | Rate limit, conditional flag, notification creation |
| `functions/src/triggers/menuPhotos.ts` | Trigger | onCreate thumbnail generation, Storage operations |
| `functions/src/triggers/follows.ts` | Trigger | Counter increment/decrement, floor 0 on delete, new_follower notification, fan-out check |
| `functions/src/triggers/recommendations.ts` | Trigger | Rate limit 20/day, notification creation |
| `functions/src/triggers/userSettings.ts` | Trigger | Settings change handling |

**Cloud Functions -- Scheduled:**

| Archivo | Tipo | Que testear |
|---------|------|-------------|
| `functions/src/scheduled/rankings.ts` | Scheduled | ISO week calculation, score algorithm, batch writes, empty data |
| `functions/src/scheduled/dailyMetrics.ts` | Scheduled | Counter aggregation, percentile math, date handling |
| `functions/src/scheduled/cleanupNotifications.ts` | Scheduled | Batch delete >30 days, empty collection |
| `functions/src/scheduled/cleanupPhotos.ts` | Scheduled | Storage delete, rejected photo query |
| `functions/src/scheduled/cleanupActivityFeed.ts` | Scheduled | Expired items query, batch delete |

**Cloud Functions -- Admin/Callable:**

| Archivo | Tipo | Que testear |
|---------|------|-------------|
| `functions/src/callable/cleanAnonymousData.ts` | Callable | Multi-collection cascade delete, auth verification |
| `functions/src/admin/feedback.ts` | Admin | respondToFeedback, resolveFeedback, createGithubIssue (mock Octokit) |
| `functions/src/admin/claims.ts` | Admin | setClaims, bootstrap, auth validation |
| `functions/src/admin/backups.ts` | Admin | Export trigger, validateBackupId regex, list backups |
| `functions/src/admin/menuPhotos.ts` | Admin | Approve/reject, Storage operations |
| `functions/src/admin/storageStats.ts` | Admin | Bucket aggregation |
| `functions/src/admin/analyticsReport.ts` | Admin | GA4 data fetch mock |
| `functions/src/admin/perfMetrics.ts` | Admin | Write validation |

### Criterios de testing

- Cobertura >= 80% del codigo nuevo
- Tests de validacion para todos los inputs del usuario
- Todos los paths condicionales cubiertos
- Side effects verificados (cache invalidation, analytics trackEvent, notification creation)
- Timer-based logic testeada con `vi.useFakeTimers()`
- Race conditions testeadas con async sequencing

---

## Seguridad

Este es un issue de testing infrastructure -- no introduce superficie de ataque nueva. Sin embargo, los tests deben verificar aspectos de seguridad existentes:

- [ ] Tests de triggers verifican que rate limiting se aplica correctamente
- [ ] Tests de admin functions verifican que `assertAdmin()` se llama antes de operaciones
- [ ] Tests de callable verifican auth requirement (`request.auth` check)
- [ ] Tests de services no exponen secretos ni API keys en fixtures
- [ ] Ningun test file incluye credenciales reales (solo mocks)

---

## Offline

### Data flows

No aplica directamente -- este issue es sobre testing infrastructure. Sin embargo, los tests deben cubrir comportamiento offline donde aplique:

| Operacion | Tipo (read/write) | Estrategia offline | Fallback UI |
|-----------|-------------------|-------------------|-------------|
| `useConnectivity` tests | read | Simular online/offline events | Verificar state transitions |
| `useCheckIn` tests | write | Verificar `withOfflineSupport` integration | Verificar enqueue behavior |
| Service tests con offline | write | Mock offline interceptor | Verificar error handling |

### Checklist offline

- [ ] Reads de Firestore: no aplica (tests mockean Firestore)
- [ ] Writes: tests de `useCheckIn` y `useFollow` verifican offline queue
- [ ] APIs externas: tests de admin/feedback mockean Octokit
- [ ] UI: tests de `useConnectivity` verifican estado offline
- [ ] Datos criticos: no aplica

### Esfuerzo offline adicional: S

---

## Modularizacion

Este issue no agrega componentes UI ni modifica layout. Todos los archivos nuevos son test files (`*.test.ts`/`*.test.tsx`) que importan los modulos existentes y verifican su comportamiento.

### Checklist modularizacion

- [ ] Logica de negocio en hooks/services (no inline en componentes de layout) -- no aplica, solo tests
- [ ] Componentes nuevos son reutilizables fuera del contexto actual de layout -- no aplica
- [ ] No se agregan useState de logica de negocio a AppShell o SideMenu -- no aplica
- [ ] Props explicitas en vez de dependencias implicitas a contextos de layout -- no aplica
- [ ] Cada prop de accion (onClick, onSelect, onNavigate) tiene un handler real especificado -- no aplica

---

## Success Criteria

1. Al menos 80% de los hooks listados en el issue tienen test files con >=80% cobertura de su codigo
2. Al menos 80% de los services listados tienen test files con >=80% cobertura
3. Los triggers criticos (favorites, customTags, feedback, follows, recommendations) tienen tests que cubren create/delete paths y rate limiting
4. Los scheduled functions tienen tests que verifican la logica de aggregation/cleanup sin depender de estado externo
5. La cobertura global del proyecto no baja (actualmente >90% frontend, >98% backend) -- idealmente sube al agregar tests de archivos que no estaban en el coverage report
6. Todos los tests nuevos siguen los patrones de mock establecidos en tests.md (Firestore SDK mock, hoisted mocks, renderHook)
