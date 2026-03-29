# Specs: Data Layer Coverage

**PRD:** [prd.md](prd.md)
**Fecha:** 2026-03-29

---

## Modelo de datos

No aplica. Este feature es exclusivamente de documentacion. No se crean ni modifican colecciones, campos ni tipos.

## Firestore Rules

No aplica. No hay rules nuevas ni modificadas.

### Rules impact analysis

No hay queries nuevas. La auditoria de servicios existentes puede detectar gaps en rules como efecto secundario, pero corregirlos esta fuera de scope.

| Query (service file) | Collection | Auth context | Rule that allows it | Change needed? |
|---------------------|------------|-------------|-------------------|----------------|
| N/A | N/A | N/A | N/A | N/A |

### Field whitelist check

No hay campos nuevos ni modificados.

| Collection | New/modified field | In create `hasOnly()`? | In update `affectedKeys().hasOnly()`? | Rule change needed? |
|-----------|-------------------|----------------------|--------------------------------------|-------------------|
| N/A | N/A | N/A | N/A | N/A |

## Cloud Functions

No aplica.

## Componentes

No aplica. No hay componentes nuevos ni modificados.

## Textos de usuario

No aplica. No hay textos user-facing nuevos.

## Hooks

No aplica.

## Servicios

No aplica.

## Integracion

No hay cambios de codigo. La unica integracion es la actualizacion de `docs/reference/data-layer.md` para que refleje con precision el codigo existente en `src/services/`, `src/hooks/` y `src/utils/`.

### Preventive checklist

- [x] **Service layer**: N/A (solo documentacion)
- [x] **Duplicated constants**: N/A
- [x] **Context-first data**: N/A
- [x] **Silent .catch**: N/A
- [x] **Stale props**: N/A

## Tests

No aplica. No hay codigo nuevo que testear.

| Archivo test | Que testear | Tipo |
|-------------|-------------|------|
| N/A | N/A | N/A |

## Analytics

No aplica.

---

## Offline

No aplica.

---

## Decisiones tecnicas

### DT1. Mantener formato existente de tablas

Se mantiene el formato actual de `data-layer.md` (tablas Markdown por seccion). No se cambia la estructura del documento para minimizar diff y facilitar review.

### DT2. Agrupar hooks por dominio

Los 31 hooks faltantes se agrupan por dominio funcional (social, offline, UI, admin, auth, navigation, check-ins, comments) para facilitar la lectura. Los hooks existentes ya documentados se reubican dentro de estos grupos si tiene sentido, pero sin romper el formato actual.

### DT3. Admin service refactor en data-layer.md

El servicio `admin.ts` monolitico fue descompuesto en `src/services/admin/` con 5 submodulos (activity, content, counters, social, users). La documentacion debe reflejar esta estructura actual, no la entrada monolitica que existe hoy.

### DT4. Validacion manual en vez de automatizada

La validacion cruzada se hace manualmente comparando el inventario final contra features.md, patterns.md y tests.md. No se crea tooling de validacion automatica (seria over-engineering para un one-shot).

---

## Inventario completo del codebase

### Servicios en `src/services/` (33 modulos)

#### Documentados actualmente (14)

| Modulo | Estado |
|--------|--------|
| `favorites.ts` | OK |
| `ratings.ts` | OK |
| `comments.ts` | OK |
| `tags.ts` | OK |
| `feedback.ts` | OK |
| `adminFeedback.ts` | OK |
| `menuPhotos.ts` | OK |
| `priceLevels.ts` | Tiene entrada phantom `getBusinessPriceLevels` -> corregir a `getPriceLevelsCollection` |
| `userSettings.ts` | OK |
| `suggestions.ts` | OK |
| `trending.ts` | OK |
| `emailAuth.ts` | OK |
| `admin.ts` | Desactualizado: fue refactoreado a `admin/` con 5 submodulos. Contiene phantoms: `fetchPriceLevelStats`, `fetchCommentLikeStats`, `fetchNotificationStats` |
| `sharedLists.ts` | OK |

#### Faltantes (19 modulos)

| Modulo | Coleccion(es) | Operaciones exportadas |
|--------|--------------|----------------------|
| `achievements.ts` | `achievements` | `fetchAchievements`, `saveAllAchievements`, `deleteAchievement` |
| `activityFeed.ts` | `activityFeed/{userId}/items` | `getActivityFeedCollection` |
| `businessData.ts` | `favorites`, `ratings`, `comments`, `userTags`, `customTags`, `priceLevels`, `menuPhotos` | `fetchBusinessData`, `fetchSingleCollection`, `fetchUserLikes` + tipos `BusinessDataResult`, `BusinessDataCollectionName` |
| `checkins.ts` | `checkins` | `getCheckinsCollection`, `createCheckIn`, `fetchMyCheckIns`, `fetchCheckInsForBusiness`, `deleteCheckIn` |
| `follows.ts` | `follows` | `getFollowsCollection`, `followUser`, `unfollowUser`, `isFollowing`, `fetchFollowing`, `fetchFollowers` |
| `notifications.ts` | `notifications` | `fetchUserNotifications`, `markNotificationRead`, `markAllNotificationsRead`, `getUnreadCount` |
| `offlineInterceptor.ts` | N/A (wrapper) | `withOfflineSupport`, `OFFLINE_ENQUEUED_MSG` |
| `offlineQueue.ts` | IndexedDB `offline-queue` | `openDb`, `enqueue`, `getAll`, `getPending`, `updateStatus`, `bulkUpdateStatus`, `remove`, `cleanup`, `count`, `subscribe` |
| `queryCache.ts` | N/A (in-memory) | `getCacheKey`, `invalidateQueryCache`, `getQueryCache`, `setQueryCache`, `invalidateAllQueryCache` + tipo `CacheEntry` (parcialmente documentado, falta completar) |
| `rankings.ts` | `userRankings` | `fetchRanking`, `fetchLatestRanking`, `getPreviousPeriodKey`, `getCurrentPeriodKey`, `fetchUserScoreHistory`, `fetchUserLiveScore` |
| `readCache.ts` | IndexedDB `modo-mapa-read-cache` | `openReadCacheDb`, `getReadCacheEntry`, `setReadCacheEntry`, `clearReadCache` + tipo `ReadCacheEntry` |
| `recommendations.ts` | `recommendations` | `getRecommendationsCollection`, `getReceivedRecommendationsConstraints`, `createRecommendation`, `markRecommendationAsRead`, `markAllRecommendationsAsRead`, `countUnreadRecommendations`, `countRecommendationsSentToday` |
| `specials.ts` | `specials` | `fetchSpecials`, `fetchActiveSpecials`, `saveAllSpecials`, `deleteSpecial` |
| `syncEngine.ts` | N/A (orchestrator) | `executeAction`, `processQueue` |
| `userProfile.ts` | `users`, `favorites`, `ratings`, `comments`, `follows`, `checkins`, `userRankings` | `fetchUserProfile` + tipo `UserProfileData` |
| `users.ts` | `users`, `userSettings` | `searchUsers`, `fetchUserDisplayNames` + tipo `UserSearchResult` |
| `admin/activity.ts` | Varias (read-only) | `fetchRecentComments`, `fetchRecentRatings`, `fetchRecentFavorites`, `fetchRecentUserTags`, `fetchRecentCustomTags`, `fetchAllCustomTags`, `fetchRecentCommentLikes`, `fetchRecentPriceLevels`, `fetchRecentCheckins` |
| `admin/content.ts` | Varias (read-only + callable) | `fetchRecentFeedback`, `fetchPendingPhotos`, `fetchAllPhotos`, `fetchAbuseLogs`, `reviewAbuseLog`, `dismissAbuseLog`, `fetchLatestRanking`, `fetchTrendingCurrent`, `fetchNotificationDetails`, `fetchListStats`, `fetchTopLists`, `fetchPerfMetrics`, `fetchStorageStats`, `fetchAnalyticsReport` |
| `admin/counters.ts` | `config`, `dailyMetrics` | `fetchCounters`, `fetchDailyMetrics` |
| `admin/social.ts` | `follows`, `recommendations` | `fetchRecentFollows`, `fetchRecentRecommendations`, `fetchFollowStats`, `fetchRecommendationStats` |
| `admin/users.ts` | `users`, `userSettings`, `commentLikes` | `fetchUsersPanelData`, `fetchCommentStats`, `fetchAuthStats`, `fetchSettingsAggregates` |

### Funciones phantom (4 entradas a corregir/eliminar)

| Entrada actual | Problema | Correccion |
|---------------|----------|------------|
| `getBusinessPriceLevels` en `priceLevels.ts` | No existe. Nombre real es `getPriceLevelsCollection` | Corregir a: `getPriceLevelsCollection`, `upsertPriceLevel`, `deletePriceLevel` |
| `fetchPriceLevelStats` en `admin.ts` | No existe en ningun archivo del codebase | Eliminar |
| `fetchCommentLikeStats` en `admin.ts` | No existe en ningun archivo del codebase | Eliminar |
| `fetchNotificationStats` en `admin.ts` | Nombre incorrecto. La funcion real es `fetchNotificationDetails` en `admin/content.ts` | Corregir a `fetchNotificationDetails` |

### Hooks en `src/hooks/` (52 archivos)

#### Documentados actualmente (21)

`useAsyncData`, `useBusinessData`, `useBusinessDataCache`, `useBusinesses`, `useColorMode`, `useListFilters`, `useNotifications`, `useOnboardingFlow`, `useOnboardingHint`, `usePaginatedQuery`, `usePriceLevelFilter`, `useProfileVisibility`, `usePublicMetrics`, `usePullToRefresh` (mencionado pero sin entrada propia), `useSuggestions`, `useSurpriseMe`, `useSwipeActions`, `useTrending`, `useUndoDelete`, `useUserLocation`, `useUserSettings`, `useVisitHistory`

#### Faltantes (31)

| Hook | Dominio | Descripcion |
|------|---------|-------------|
| `useAbuseLogsRealtime` | Admin | Realtime listener de abuse logs (max N docs) |
| `useActivityFeed` | Social | Feed de actividad de usuarios seguidos, paginado |
| `useActivityReminder` | Onboarding | Nudge post-rating para anonimos. `incrementAnonRatingCount` + `showReminder`/`dismissReminder` |
| `useBusinessRating` | Business | Logica de rating del BusinessSheet: promedio, criterios, pendingRating, handlers |
| `useCheckIn` | Check-ins | Check-in en un comercio con cooldown 4h, validacion proximidad, rate limit |
| `useCommentEdit` | Comments | Estado de edicion de comentarios + handlers save/cancel |
| `useCommentListBase` | Comments | Logica compartida entre BusinessComments y BusinessQuestions |
| `useCommentSort` | Comments | Sorting de comentarios (recent/oldest/useful). Tipo `SortMode` |
| `useCommentThreads` | Comments | Expand/collapse de threads de comentarios |
| `useConnectivity` | Offline | Re-export de `ConnectivityContext`. Expone `isOffline`, `pendingActions` |
| `useDeepLinks` | Navigation | Manejo de `?business=`, `?tab=`, `?list=` en URL |
| `useFollow` | Social | Toggle follow/unfollow optimistico con soporte offline |
| `useForceUpdate` | Infra | Chequeo de version minima, force refresh si desactualizado |
| `useMyCheckIns` | Check-ins | Lista paginada de check-ins propios del usuario |
| `useNavigateToBusiness` | Navigation | Helper para navegar a un comercio (cambiar tab + seleccionar business) |
| `useOptimisticLikes` | Comments | Likes optimisticos con Maps para toggle + delta count |
| `usePasswordConfirmation` | Auth | Validacion de confirmacion de password |
| `useProfileStats` | Profile | Estadisticas del perfil del usuario (lugares, resenas, seguidores, favoritos) |
| `useRankings` | Social | Rankings por periodo con position change tracking |
| `useRatingPrompt` | Onboarding | Prompt contextual post-interaccion para incentivar ratings |
| `useRememberedEmail` | Auth | Logica de localStorage para "recordar email" en login |
| `useScreenTracking` | Analytics | Tracking automatico de pantalla activa para analytics |
| `useSortLocation` | UI | Ubicacion del usuario para ordenar listas por distancia |
| `useTabNavigation` | Navigation | Helpers de navegacion entre tabs y sub-tabs |
| `useTabRefresh` | Navigation | Refresh al activar tab/sub-tab. Variantes: `useSocialSubTabRefresh`, `useListsSubTabRefresh` |
| `useUnreadRecommendations` | Social | Contador de recomendaciones no leidas |
| `useUnsavedChanges` | UI | Deteccion de cambios sin guardar + DiscardDialog |
| `useUserProfile` | Social | Fetch de perfil publico de otro usuario |
| `useUserSearch` | Social | Busqueda de usuarios con debounce 300ms, prefijo displayNameLower |
| `useVerificationCooldown` | Auth | Cooldown 60s para re-envio de email de verificacion |

### Utils en `src/utils/` (11 archivos)

#### Documentados actualmente (5)

`formatDate.ts`, `analytics.ts`, `text.ts`, `perfMetrics.ts`, `businessHelpers.ts`

#### Faltantes (6)

| Util | Funciones exportadas | Descripcion |
|------|---------------------|-------------|
| `contrast.ts` | `relativeLuminance(hex)`, `getContrastText(backgroundHex)` | Calculo de luminancia y contraste WCAG para seleccion de color de texto |
| `distance.ts` | `distanceKm(lat1,lng1,lat2,lng2)`, `formatDistance(km)` | Ya documentado en patterns.md pero falta entrada completa en data-layer.md con tabla de funciones |
| `getCountOfflineSafe.ts` | `getCountOfflineSafe(query)` | Wrapper de `getCountFromServer` con fallback a `getDocsFromCache().size` si offline |
| `logger.ts` | `logger.error()`, `.warn()`, `.log()` | Logger centralizado. DEV: console. PROD: errors a Sentry, warn/log silenciados |
| `media.ts` | `isValidStorageUrl(url)` | Validacion de URLs de Firebase Storage |
| `version.ts` | `compareSemver(a, b)`, `isUpdateRequired(required, current)` | Comparacion de versiones semver para force-update |

---

## Validacion cruzada

### vs features.md

| Feature en features.md | Hooks/services que debe documentar data-layer.md |
|----------------------|--------------------------------------------------|
| Check-ins | `checkins.ts`, `useCheckIn`, `useMyCheckIns` |
| Seguir usuarios | `follows.ts`, `useFollow`, `useUserSearch`, `users.ts` |
| Activity feed | `activityFeed.ts`, `useActivityFeed` |
| Rankings | `rankings.ts`, `useRankings` |
| Recomendaciones | `recommendations.ts`, `useUnreadRecommendations` |
| Offline queue | `offlineInterceptor.ts`, `offlineQueue.ts`, `syncEngine.ts`, `useConnectivity` |
| Force update | `useForceUpdate`, `version.ts` |
| Achievements | `achievements.ts` |
| Specials | `specials.ts` |
| Perfil publico | `userProfile.ts`, `useUserProfile`, `useProfileStats` |
| Onboarding | `useActivityReminder`, `useRatingPrompt` |

### vs patterns.md

| Patron en patterns.md | Referencia en data-layer.md |
|-----------------------|----------------------------|
| `useOptimisticLikes` | Falta. Agregar |
| `useCommentSort` | Falta. Agregar |
| `useCommentEdit` | Falta. Agregar |
| `useCommentThreads` | Falta. Agregar |
| `useVerificationCooldown` | Falta. Agregar |
| `withOfflineSupport` | Falta. Agregar (`offlineInterceptor.ts`) |
| `readCache.ts` 3-tier lookup | Falta. Agregar |
| `syncEngine.ts` dynamic imports | Falta. Agregar |
| `useFollow` optimistic + offline | Falta. Agregar |
| `usePasswordConfirmation` | Falta. Agregar |
| `useRememberedEmail` | Falta. Agregar |

### vs tests.md

| Test en tests.md | Modulo documentado en data-layer.md |
|-----------------|-------------------------------------|
| `rankings.test.ts` | Falta `rankings.ts` service |
| `follows.test.ts` | Falta `follows.ts` service |
| `checkins.test.ts` | Falta `checkins.ts` service |
| `offlineQueue.test.ts` | Falta `offlineQueue.ts` service |
| `syncEngine.test.ts` | Falta `syncEngine.ts` service |
| `readCache.test.ts` | Falta `readCache.ts` service |
| `recommendations.test.ts` | Falta `recommendations.ts` service |
| `users.test.ts` | Falta `users.ts` service |
| `useFollow.test.ts` | Falta `useFollow` hook |
| `useCheckIn.test.ts` | Falta `useCheckIn` hook |
| `useForceUpdate.test.ts` | Falta `useForceUpdate` hook |

---

## Hardening de seguridad

No aplica. No hay superficies nuevas.

---

## Deuda tecnica: mitigacion incorporada

No hay issues abiertos de seguridad ni tech debt en el repo actualmente.

La auditoria del data layer tiene un efecto secundario positivo: al documentar todos los servicios, se puede detectar si algun servicio escribe campos no cubiertos por `hasOnly()` en Firestore rules. Si se detecta alguno durante la implementacion, se crea un issue separado (fuera de scope de este PR).
