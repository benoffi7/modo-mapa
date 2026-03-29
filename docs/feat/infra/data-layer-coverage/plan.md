# Plan: Data Layer Coverage

**Specs:** [specs.md](specs.md)
**Fecha:** 2026-03-29

---

## Fases de implementacion

### Fase 1: Corregir funciones phantom y actualizar servicios existentes

**Branch:** `docs/data-layer-coverage`

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `docs/reference/data-layer.md` | En la tabla de `priceLevels.ts`, reemplazar `getBusinessPriceLevels` por `getPriceLevelsCollection`, `upsertPriceLevel`, `deletePriceLevel` |
| 2 | `docs/reference/data-layer.md` | En la entrada de `admin.ts`, eliminar `fetchPriceLevelStats` y `fetchCommentLikeStats` de la lista de operaciones |
| 3 | `docs/reference/data-layer.md` | En la entrada de `admin.ts`, corregir `fetchNotificationStats` a `fetchNotificationDetails` |
| 4 | `docs/reference/data-layer.md` | Reemplazar la entrada monolitica de `admin.ts` por 5 entradas correspondientes a los submodulos actuales: `admin/activity.ts`, `admin/content.ts`, `admin/counters.ts`, `admin/social.ts`, `admin/users.ts` con sus operaciones reales |

### Fase 2: Documentar servicios faltantes (19 modulos)

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `docs/reference/data-layer.md` | Agregar entrada para `achievements.ts`: coleccion `achievements`, operaciones `fetchAchievements`, `saveAllAchievements`, `deleteAchievement` |
| 2 | `docs/reference/data-layer.md` | Agregar entrada para `activityFeed.ts`: subcollection `activityFeed/{userId}/items`, operacion `getActivityFeedCollection` |
| 3 | `docs/reference/data-layer.md` | Agregar entrada para `businessData.ts`: 7 colecciones, operaciones `fetchBusinessData`, `fetchSingleCollection`, `fetchUserLikes` + tipos exportados |
| 4 | `docs/reference/data-layer.md` | Agregar entrada para `checkins.ts`: coleccion `checkins`, operaciones `getCheckinsCollection`, `createCheckIn`, `fetchMyCheckIns`, `fetchCheckInsForBusiness`, `deleteCheckIn` |
| 5 | `docs/reference/data-layer.md` | Agregar entrada para `follows.ts`: coleccion `follows`, operaciones `getFollowsCollection`, `followUser`, `unfollowUser`, `isFollowing`, `fetchFollowing`, `fetchFollowers` |
| 6 | `docs/reference/data-layer.md` | Agregar entrada para `notifications.ts`: coleccion `notifications`, operaciones `fetchUserNotifications`, `markNotificationRead`, `markAllNotificationsRead`, `getUnreadCount` |
| 7 | `docs/reference/data-layer.md` | Agregar entrada para `offlineInterceptor.ts`: sin coleccion (wrapper), operaciones `withOfflineSupport`, constante `OFFLINE_ENQUEUED_MSG` |
| 8 | `docs/reference/data-layer.md` | Agregar entrada para `offlineQueue.ts`: IndexedDB `offline-queue`, operaciones `openDb`, `enqueue`, `getAll`, `getPending`, `updateStatus`, `bulkUpdateStatus`, `remove`, `cleanup`, `count`, `subscribe` |
| 9 | `docs/reference/data-layer.md` | Completar entrada de `queryCache.ts`: agregar operaciones faltantes `getCacheKey`, `getQueryCache`, `setQueryCache`, `invalidateAllQueryCache` + tipo `CacheEntry` |
| 10 | `docs/reference/data-layer.md` | Agregar entrada para `rankings.ts`: coleccion `userRankings`, operaciones `fetchRanking`, `fetchLatestRanking`, `getPreviousPeriodKey`, `getCurrentPeriodKey`, `fetchUserScoreHistory`, `fetchUserLiveScore` |
| 11 | `docs/reference/data-layer.md` | Agregar entrada para `readCache.ts`: IndexedDB `modo-mapa-read-cache`, operaciones `openReadCacheDb`, `getReadCacheEntry`, `setReadCacheEntry`, `clearReadCache` + tipo `ReadCacheEntry` |
| 12 | `docs/reference/data-layer.md` | Agregar entrada para `recommendations.ts`: coleccion `recommendations`, operaciones `getRecommendationsCollection`, `getReceivedRecommendationsConstraints`, `createRecommendation`, `markRecommendationAsRead`, `markAllRecommendationsAsRead`, `countUnreadRecommendations`, `countRecommendationsSentToday` |
| 13 | `docs/reference/data-layer.md` | Agregar entrada para `specials.ts`: coleccion `specials`, operaciones `fetchSpecials`, `fetchActiveSpecials`, `saveAllSpecials`, `deleteSpecial` |
| 14 | `docs/reference/data-layer.md` | Agregar entrada para `syncEngine.ts`: sin coleccion (orchestrator), operaciones `executeAction`, `processQueue` |
| 15 | `docs/reference/data-layer.md` | Agregar entrada para `userProfile.ts`: colecciones `users`, `favorites`, `ratings`, `comments`, `follows`, `checkins`, `userRankings`, operacion `fetchUserProfile` + tipo `UserProfileData` |
| 16 | `docs/reference/data-layer.md` | Agregar entrada para `users.ts`: colecciones `users`, `userSettings`, operaciones `searchUsers`, `fetchUserDisplayNames` + tipo `UserSearchResult` |

### Fase 3: Documentar hooks faltantes (31 hooks)

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `docs/reference/data-layer.md` | Agregar seccion de agrupamiento por dominio en la tabla de hooks. Reorganizar hooks existentes bajo categorias: Business, Social, Offline, UI, Admin, Auth, Navigation, Check-ins, Comments, Onboarding, Analytics, Infra |
| 2 | `docs/reference/data-layer.md` | Agregar 5 hooks de Comments: `useBusinessRating`, `useCommentEdit`, `useCommentListBase`, `useCommentSort`, `useCommentThreads`, `useOptimisticLikes` |
| 3 | `docs/reference/data-layer.md` | Agregar 6 hooks de Social: `useActivityFeed`, `useFollow`, `useRankings`, `useUnreadRecommendations`, `useUserProfile`, `useUserSearch` |
| 4 | `docs/reference/data-layer.md` | Agregar 4 hooks de Navigation: `useDeepLinks`, `useNavigateToBusiness`, `useTabNavigation`, `useTabRefresh` (+ variantes `useSocialSubTabRefresh`, `useListsSubTabRefresh`) |
| 5 | `docs/reference/data-layer.md` | Agregar 3 hooks de Auth: `usePasswordConfirmation`, `useRememberedEmail`, `useVerificationCooldown` |
| 6 | `docs/reference/data-layer.md` | Agregar 2 hooks de Check-ins: `useCheckIn`, `useMyCheckIns` |
| 7 | `docs/reference/data-layer.md` | Agregar 2 hooks de Onboarding: `useActivityReminder` (+ export `incrementAnonRatingCount`), `useRatingPrompt` |
| 8 | `docs/reference/data-layer.md` | Agregar 2 hooks de Offline: `useConnectivity` (re-export), `useForceUpdate` |
| 9 | `docs/reference/data-layer.md` | Agregar 2 hooks de UI: `useSortLocation`, `useUnsavedChanges` |
| 10 | `docs/reference/data-layer.md` | Agregar 2 hooks de Profile/Stats: `useProfileStats`, `useScreenTracking` |
| 11 | `docs/reference/data-layer.md` | Agregar 1 hook de Admin: `useAbuseLogsRealtime` |

### Fase 4: Documentar utils faltantes (6 utils)

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `docs/reference/data-layer.md` | Agregar tabla para `contrast.ts`: `relativeLuminance(hex)`, `getContrastText(backgroundHex)` |
| 2 | `docs/reference/data-layer.md` | Agregar tabla para `distance.ts`: `distanceKm(lat1,lng1,lat2,lng2)`, `formatDistance(km)` (ya mencionado en patterns.md pero falta tabla completa en data-layer) |
| 3 | `docs/reference/data-layer.md` | Agregar tabla para `getCountOfflineSafe.ts`: `getCountOfflineSafe(query)` con descripcion del fallback a cache |
| 4 | `docs/reference/data-layer.md` | Agregar tabla para `logger.ts`: `logger.error()`, `.warn()`, `.log()` con comportamiento DEV vs PROD |
| 5 | `docs/reference/data-layer.md` | Agregar tabla para `media.ts`: `isValidStorageUrl(url)` |
| 6 | `docs/reference/data-layer.md` | Agregar tabla para `version.ts`: `compareSemver(a, b)`, `isUpdateRequired(required, current)` |

### Fase 5: Validacion cruzada

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | N/A (validacion manual) | Verificar que cada feature en `features.md` tiene sus hooks/services correspondientes documentados en `data-layer.md`. Corregir cualquier gap detectado |
| 2 | N/A (validacion manual) | Verificar que cada patron en `patterns.md` que referencia un hook/service tiene su entrada en `data-layer.md`. Corregir cualquier gap detectado |
| 3 | N/A (validacion manual) | Verificar que cada archivo testeado en `tests.md` tiene su modulo documentado en `data-layer.md`. Corregir cualquier gap detectado |
| 4 | N/A (validacion manual) | Contar totales finales y verificar que se cumplen los criterios de exito: 33+ servicios, 52+ hooks, 11+ utils documentados, 0 phantoms |

### Fase final: Documentacion (OBLIGATORIA)

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `docs/reference/data-layer.md` | Este ES el entregable principal — ya actualizado en fases 1-4 |
| 2 | `docs/_sidebar.md` | Agregar entradas de Specs y Plan para `data-layer-coverage` bajo la seccion Infra |

---

## Orden de implementacion

1. **Fase 1** (phantoms): Primero para tener una base limpia sin entradas incorrectas
2. **Fase 2** (servicios): Agregar los 19 servicios faltantes + reestructurar admin
3. **Fase 3** (hooks): Agregar los 31 hooks faltantes con agrupamiento por dominio
4. **Fase 4** (utils): Agregar las 6 utils faltantes
5. **Fase 5** (validacion): Verificar consistencia con otros docs de referencia
6. **Fase final** (sidebar): Actualizar sidebar

No hay dependencias entre fases 2-4, pero se recomienda el orden indicado porque los hooks referencian servicios, y las utils son transversales.

---

## Estimacion de tamano de archivo

| Archivo | Tamano actual | Tamano estimado post-cambio | Excede 400 lineas? |
|---------|--------------|----------------------------|-------------------|
| `docs/reference/data-layer.md` | ~190 lineas | ~450-500 lineas | SI |

### Estrategia de descomposicion

El archivo ya tiene secciones claras (Constants, Services, Hooks, Utils, Admin). Si supera 500 lineas, considerar extraer la seccion de admin services a un bloque colapsable o simplemente aceptar el tamano dado que es documentacion de referencia y no codigo. Los docs de referencia no tienen el mismo riesgo de mantenibilidad que los archivos de codigo, asi que el limite de 400 lineas aplica con flexibilidad.

---

## Riesgos

| Riesgo | Probabilidad | Mitigacion |
|--------|-------------|------------|
| Nuevos servicios/hooks se agregan entre la auditoria y el merge | Baja | Branch corto, merge rapido. Si pasa, un diff rapido de `src/services/` y `src/hooks/` antes del merge |
| Descripcion de hooks incompleta por falta de JSDoc en codigo fuente | Media | Leer la implementacion de cada hook para entender retorno y parametros. No inventar comportamientos |
| Inconsistencia sutil entre data-layer.md y otros docs post-merge | Baja | La validacion cruzada en fase 5 cubre los docs principales. Futuras features deben mantener sincronizados |

---

## Guardrails de modularidad

- [x] Ningun componente nuevo importa `firebase/firestore` directamente (no hay codigo nuevo)
- [x] Archivos nuevos en carpeta de dominio correcta (solo `docs/reference/`)
- [x] Logica de negocio en hooks/services, no en componentes (no hay codigo nuevo)
- [x] Si se toca un archivo con deuda tecnica, se incluye el fix en el plan (N/A)
- [x] Ningun archivo resultante supera 400 lineas (data-layer.md puede llegar a ~500 pero es docs, no codigo)

---

## Criterios de done

- [ ] Las 4 funciones phantom eliminadas o corregidas
- [ ] Todos los servicios en `src/services/` documentados en data-layer.md (33+ modulos)
- [ ] Todos los hooks en `src/hooks/` documentados en data-layer.md (52+ hooks)
- [ ] Todos los utils en `src/utils/` documentados en data-layer.md (11+ archivos)
- [ ] Admin services reflejados como submodulos (`admin/activity`, `admin/content`, etc.)
- [ ] Hooks agrupados por dominio funcional
- [ ] Validacion cruzada completada contra features.md, patterns.md, tests.md
- [ ] No hay inconsistencias detectadas entre data-layer.md y otros docs
- [ ] Sidebar actualizado con entries de specs y plan
- [ ] Markdownlint pasa sin errores en data-layer.md
