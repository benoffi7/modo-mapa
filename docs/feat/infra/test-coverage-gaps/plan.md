# Plan: Test coverage gaps -- 20 hooks + 15 services untested

**Specs:** [specs.md](specs.md)
**Fecha:** 2026-03-27

---

## Fases de implementacion

### Fase 1: Hooks criticos (UX-blocking)

**Branch:** `feat/test-hooks-critical`

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `src/hooks/useCheckIn.test.ts` | Crear test file. Mock AuthContext, MapContext, ConnectivityContext, ToastContext, checkins service, offlineInterceptor, analytics, distance. 12-15 test cases: cooldown logic, proximity, performCheckIn/undoCheckIn flows, offline support, error handling, cleanup on unmount. |
| 2 | `src/hooks/useAsyncData.test.ts` | Crear test file. Mock logger. 8-10 test cases: loading/error/data states, race condition (concurrent fetches, ignore flag), refetch via tick, cleanup on unmount, fetcher dependency change. |
| 3 | `src/hooks/useUnsavedChanges.test.ts` | Crear test file. No mocks needed (pure hook). 8-10 test cases: isDirty detection (empty, whitespace, non-empty), confirmClose with clean/dirty state, dialog state machine (open/keepEditing/discard), pendingClose ref behavior. |
| 4 | `src/hooks/useUndoDelete.test.ts` | Crear test file. Use `vi.useFakeTimers()`. 10-12 test cases: markForDelete/isPendingDelete, timer fires onConfirmDelete, undoDelete clears timer, undoLast, multiple pending deletes, same-ID replacement, unmount cleanup, snackbarProps, onDeleteComplete, error in onConfirmDelete. |
| 5 | `src/context/ConnectivityContext.test.tsx` | Crear test file. Mock offlineQueue, syncEngine, ToastContext, analytics, fetch global, navigator.onLine. 8-10 test cases: initial state, online/offline events, real connectivity check, sync flow with toast messages, discardAction, retryFailed, pendingActionsCount, useConnectivity outside provider. |
| 6 | `src/context/NotificationsContext.test.tsx` | Crear test file. Mock AuthContext, notifications service, timing constants, logger. Use `vi.useFakeTimers()`. 8-10 test cases: load on mount, no user returns empty, polling interval, visibility-aware pause, navigator.onLine pause, markRead optimistic, markAllRead, refresh, cleanup interval, user change. |

### Fase 2: Hooks secundarios

**Branch:** `feat/test-hooks-secondary`

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `src/hooks/useOnboardingFlow.test.ts` | Crear test file. Mock localStorage, storage constants. 8-10 test cases: initial state, createAccount first time vs repeat, custom source, login flow, benefitsContinue, close dialogs, full flow. |
| 2 | `src/hooks/usePasswordConfirmation.test.ts` | Crear test file. No mocks. 6-8 test cases: matching/non-matching, empty confirm, both empty, whitespace. |
| 3 | `src/hooks/useRememberedEmail.test.ts` | Crear test file. Mock localStorage. 7-9 test cases: initial state with/without saved email, save when remember true/false, toggleRemember, reset, setEmail. |
| 4 | `src/hooks/useProfileStats.test.ts` | Crear test file. Mock AuthContext, useMyCheckIns, firebase/firestore, getCountOfflineSafe. 5-7 test cases: aggregation, places from checkInStats, no user, query error. |
| 5 | `src/hooks/useProfileVisibility.test.ts` | Crear test file. Use `vi.resetModules()` per test for fresh cache. Mock firebase/firestore, collections, cache constant. 6-8 test cases: uncached returns false, cache populated after fetch, batch 30, stale TTL refetch, error defaults false, dedup pending. |
| 6 | `src/hooks/useMyCheckIns.test.ts` | Crear test file. Mock AuthContext, checkins service. 5-7 test cases: load on mount, stats computation, error, refresh, no user. |

### Fase 3: Hooks de baja prioridad

**Branch:** `feat/test-hooks-low`

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `src/hooks/useUserLocation.test.ts` | Crear test file. Mock MapContext (useFilters), navigator.geolocation stub. 6-8 test cases: no geolocation support, success, permission denied, other error, isLocating transitions, requestLocation. |
| 2 | `src/hooks/usePullToRefresh.test.ts` | Crear test file. Simulate touch events. 6-8 test cases: initial state, pull past threshold triggers refresh, below threshold no trigger, negative delta cancels, scrollTop check, isRefreshing state, cleanup. |
| 3 | `src/hooks/useScreenTracking.test.ts` | Crear test file. Mock react-router-dom (useLocation), analytics. 4-5 test cases: root path screen_view, path conversion, nested paths, re-track on change. |
| 4 | `src/hooks/useTabRefresh.test.ts` | Crear test file. Mock TabContext (useTab). 6-8 test cases: skip initial mount, call on target tab active, skip other tabs, useSocialSubTabRefresh, useListsSubTabRefresh. |
| 5 | `src/hooks/useAbuseLogsRealtime.test.ts` | Crear test file. Mock firebase/firestore (onSnapshot), adminConverters. 6-8 test cases: initial loading, first snapshot, subsequent with new docs, error, resetNewCount, cleanup unsubscribe. |

### Fase 4: Services frontend

**Branch:** `feat/test-services`

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `src/services/feedback.test.ts` | Crear test file. Mock firebase/firestore, firebase/storage, firebase config, converters, analytics, constants. 12-14 test cases: sendFeedback happy path/with media/with PDF/with business, validation (empty, long, invalid category, bad media type, media too large), fetchUserFeedback, markFeedbackViewed. |
| 2 | `src/services/notifications.test.ts` | Crear test file. Mock firebase/firestore, config, converters, perfMetrics, getCountOfflineSafe. 8-10 test cases: fetchUserNotifications, custom limit, markNotificationRead, markAllNotificationsRead, markAll empty, getUnreadCount. |
| 3 | `src/services/userProfile.test.ts` | Crear test file. Mock firebase/firestore, config, converters, businessHelpers, rankings service, logger. 8-10 test cases: happy path 7 queries, likesReceived calc, recent comments, ranking position found/not found, user doc missing, user doc error, ranking error, fallbackName. |
| 4 | `src/services/menuPhotos.test.ts` | Crear test file. Mock firebase/firestore, firebase/storage (uploadBytesResumable), config, converters, useBusinessDataCache, analytics. 10-12 test cases: uploadMenuPhoto happy path, validation (type, size), pending limit, abort signal, progress callback, getApprovedMenuPhoto found/not found, getUserPendingPhotos. |
| 5 | `src/services/activityFeed.test.ts` | Crear test file. Mock firebase/firestore, config, converters. 2-3 test cases: collection reference with converter, correct path. |
| 6 | `src/services/trending.test.ts` | Crear test file. Mock firebase/firestore, config, converters. 3-4 test cases: fetchTrending exists/not exists. |
| 7 | `src/services/suggestions.test.ts` | Crear test file. Mock firebase/firestore, config, converters. 4-5 test cases: 3 parallel queries, typed return, limit 200. |
| 8 | `src/services/adminFeedback.test.ts` | Crear test file. Mock firebase/functions (httpsCallable), config. 3-4 test cases: callable wrappers configured correctly. |

### Fase 5: Cloud Functions -- Triggers criticos

**Branch:** `feat/test-triggers-critical`

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `functions/src/__tests__/triggers/favorites.test.ts` | Crear test file. Hoisted mocks: env, counters, aggregates, fanOut. 8-10 test cases: onCreate counter+business+fanout, onCreate without businessId, onCreate without userId, onDelete counter+business, onDelete without businessId, no data early returns. |
| 2 | `functions/src/__tests__/triggers/customTags.test.ts` | Crear test file. Hoisted mocks: env, rateLimiter, moderator, counters, abuseLogger. 8-10 test cases: happy path, rate limited, flagged moderation, no data, onDelete counter. |
| 3 | `functions/src/__tests__/triggers/feedback.test.ts` | Crear test file. Same mock pattern. 7-9 test cases: happy path, rate limited, flagged (update not delete), no data, status set to pending. |
| 4 | `functions/src/__tests__/triggers/follows.test.ts` | Crear test file. Hoisted mocks: env, FieldValue.increment, rateLimiter, counters, notifications, abuseLogger. Mock db.doc/collection chain. 12-15 test cases: onCreate happy path (counters, notification), rate limited, max follows, private profile, no settings doc, update fallback to set merge, onDelete decrement with floor 0, onDelete counters at 0, no data. |
| 5 | `functions/src/__tests__/triggers/recommendations.test.ts` | Crear test file. 8-10 test cases: happy path, self-recommend, rate limited, flagged message, empty message, no data. |

### Fase 6: Cloud Functions -- Triggers secundarios

**Branch:** `feat/test-triggers-secondary`

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `functions/src/__tests__/triggers/menuPhotos.test.ts` | Crear test file. Mock sharp (resize chain), firebase-admin/storage. 5-7 test cases: thumbnail generation, thumbnail error, no data, counters. |
| 2 | `functions/src/__tests__/triggers/users.test.ts` | Crear test file. Mock env, counters. 4-5 test cases: counter increment, displayNameLower update, no displayName. |
| 3 | `functions/src/__tests__/triggers/priceLevels.test.ts` | Crear test file. Mock env, counters. 3-4 test cases: created counter+trackWrite, updated trackWrite. |

### Fase 7: Cloud Functions -- Scheduled

**Branch:** `feat/test-scheduled`

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `functions/src/__tests__/scheduled/rankings.test.ts` | Crear test file. Mock scheduler (capture handler), Timestamp. Export internal helpers for unit testing via separate tests. 10-12 test cases: getWeekStart, getISOWeekKey, score algorithm, weights, empty data, top50 truncation, weekly/monthly/alltime date ranges, doc write path. |
| 2 | `functions/src/__tests__/scheduled/cleanupNotifications.test.ts` | Crear test file. Mock scheduler, env. 4-5 test cases: batch delete expired, empty collection, log message. |
| 3 | `functions/src/__tests__/scheduled/cleanupPhotos.test.ts` | Crear test file. Mock scheduler, env, firebase-admin/storage. 4-5 test cases: delete rejected >7d, delete both paths, storage error continues, empty. |
| 4 | `functions/src/__tests__/scheduled/cleanupActivityFeed.test.ts` | Crear test file. Mock scheduler, env. 4-5 test cases: batch delete expired, path filter (activityFeed only), empty, limit 500. |
| 5 | `functions/src/__tests__/scheduled/dailyMetrics.test.ts` | Crear test file. Mock scheduler, env, FieldValue, Timestamp, perfTracker. 6-8 test cases: aggregation, distribution, top businesses, active users, doc write, performance data. |

### Fase 8: Cloud Functions -- Callable + Admin

**Branch:** `feat/test-admin-callable`

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `functions/src/__tests__/callable/cleanAnonymousData.test.ts` | Crear test file. Mock onCall, FieldValue, env, deleteUserData. 6-8 test cases: happy path, unauthenticated, email user, rate limited, rate limit doc set. |
| 2 | `functions/src/__tests__/admin/feedback.test.ts` | Crear test file. Mock onCall, assertAdmin, env, notifications, FieldValue, Octokit. 12-14 test cases: respondToFeedback (happy, validation, not found, non-admin), resolveFeedback, createGithubIssueFromFeedback (happy, already exists, no token, label mapping). |
| 3 | `functions/src/__tests__/admin/claims.test.ts` | Crear test file. Mock onCall, assertAdmin, firebase-admin/auth, env, logger. 8-10 test cases: setAdminClaim (admin, bootstrap, unauthorized, emulator), removeAdminClaim (happy, self-remove), invalid input. |
| 4 | `functions/src/__tests__/admin/menuPhotos.test.ts` | Crear test file. Mock onCall, assertAdmin, env, firebase-admin/storage, notifications, FieldValue. 12-14 test cases: approve (happy, not pending, not found, replace existing), reject (happy), delete (happy, storage files), report (happy, duplicate, non-approved, unauth). |
| 5 | `functions/src/__tests__/admin/backups.test.ts` | Crear test file. Mock onCall, assertAdmin, env, @google-cloud/firestore, firebase-admin/storage, sentry. 6-8 test cases: createBackup, listBackups pagination, restoreBackup, deleteBackup, admin auth, input validation. |
| 6 | `functions/src/__tests__/admin/storageStats.test.ts` | Crear test file. Mock onCall, assertAdmin, firebase-admin/storage. 3-4 test cases: happy path, admin auth, empty bucket. |
| 7 | `functions/src/__tests__/admin/analyticsReport.test.ts` | Crear test file. Mock onCall, assertAdmin, GA4 client. 3-4 test cases: happy path, admin auth, API error. |
| 8 | `functions/src/__tests__/admin/perfMetrics.test.ts` | Crear test file. Mock onCall, env. 3-4 test cases: happy path write, validation, rate limit. |

---

## Orden de implementacion

1. **Fase 1** (hooks criticos) -- no tiene dependencias, mayor impacto en calidad
2. **Fase 2** (hooks secundarios) -- independiente de Fase 1
3. **Fase 3** (hooks baja prioridad) -- independiente
4. **Fase 4** (services) -- independiente de hooks
5. **Fase 5** (triggers criticos) -- independiente del frontend
6. **Fase 6** (triggers secundarios) -- independiente
7. **Fase 7** (scheduled) -- independiente
8. **Fase 8** (callable + admin) -- independiente

Fases 1-4 (frontend) y Fases 5-8 (backend) pueden ejecutarse en paralelo.

Dentro de cada fase, los pasos son independientes y pueden ejecutarse en cualquier orden.

---

## Riesgos

1. **Coverage threshold change**: Al agregar tests para archivos que no estaban en el coverage report, la cobertura global podria temporalmente bajar si algun archivo tiene branches dificiles de cubrir. **Mitigacion:** Verificar `npm run test:coverage` al final de cada fase. Si un archivo baja la cobertura global, agregar tests adicionales o excluir de coverage temporalmente.

2. **Mock brittleness**: Los mocks de Firestore SDK son fragiles -- si se actualiza `firebase/firestore` o se cambia la API, muchos tests se rompen. **Mitigacion:** Seguir el patron establecido de mocks (ya hay 465 tests con este patron). Agrupar mocks comunes en helpers si la repeticion es excesiva.

3. **jsdom limitations for touch/geolocation**: `usePullToRefresh` y `useUserLocation` dependen de APIs del browser que jsdom puede no soportar completamente. **Mitigacion:** Usar stubs globales (`vi.stubGlobal`) para `navigator.geolocation` y constructores de `TouchEvent`. Si `TouchEvent` no esta disponible, usar `new Event()` con propiedades mock adjuntas.

---

## Criterios de done

- [ ] All items from PRD scope implemented
- [ ] Tests pass with >= 80% coverage on new code
- [ ] No lint errors
- [ ] Build succeeds
- [ ] Frontend coverage: statements, branches, functions, lines all >= 80%
- [ ] Backend coverage: statements, branches, functions, lines all >= 80%
- [ ] All 45 test files created and passing
- [ ] Estimated 250-300 new test cases total
- [ ] `npm run test:coverage` passes for both frontend and backend
