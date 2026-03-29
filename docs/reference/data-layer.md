# Data layer — Services, Hooks, Utils

## Constantes centralizadas (`src/constants/`)

Todos los valores magicos, configuraciones, labels y opciones estan centralizados en `src/constants/` organizados por dominio:

| Modulo | Contenido |
| ------ | --------- |
| `validation.ts` | Limites de longitud (comment, displayName, customTag, feedback), truncamiento, score options |
| `cache.ts` | TTLs de cache (business 5min, query 2min, profile 60s) |
| `storage.ts` | Keys de localStorage (colorMode, visits, analyticsConsent) |
| `timing.ts` | Intervalos (poll 60s, auto-dismiss 5s, six months) |
| `feedback.ts` | Categorias validas, `FEEDBACK_STATUSES` (label+color por status), `MAX_ADMIN_RESPONSE_LENGTH` (500), `MAX_FEEDBACK_MEDIA_SIZE` (10MB) |
| `ui.ts` | Colores de graficos, URL agregar comercio |
| `map.ts` | Centro de Buenos Aires, colores por categoria |
| `tags.ts` | Tags predefinidos, IDs validos |
| `rankings.ts` | Scoring, medallas, labels de acciones, opciones de periodo |
| `business.ts` | Niveles de precio, simbolos, chips, labels de categoria |
| `criteria.ts` | Configuracion de criterios multi-rating (`RATING_CRITERIA`: food, service, price, ambiance, speed) |
| `suggestions.ts` | Pesos del algoritmo de sugerencias (`SUGGESTION_WEIGHTS`), `MAX_SUGGESTIONS`, `NEARBY_RADIUS_KM` |
| `trending.ts` | `TRENDING_WINDOW_DAYS` (7), `TRENDING_MAX_BUSINESSES` (10), `TRENDING_SCORING` (pesos por tipo de actividad) |
| `auth.ts` | PASSWORD_MIN_LENGTH, EMAIL_REGEX, AUTH_ERRORS (en espanol) |
| `admin.ts` | Email admin, page size, status chips/labels, abuse type labels/colors |
| `performance.ts` | `PERF_THRESHOLDS` (green/red por vital: LCP, INP, CLS, TTFB), `PERF_FLUSH_DELAY_MS` (30s) |
| `index.ts` | Barrel re-export de todos los modulos (15) + COLLECTIONS de config |

`types/index.ts` re-exporta `PREDEFINED_TAGS`, `PRICE_LEVEL_LABELS` y `CATEGORY_LABELS` desde constants para backwards compatibility.

---

## Service layer (`src/services/`)

Capa de abstraccion entre componentes y Firestore. Los componentes nunca importan `firebase/firestore` directamente para escrituras.

### Servicios CRUD por coleccion

| Modulo | Coleccion | Operaciones |
|--------|-----------|-------------|
| `favorites.ts` | `favorites` | `addFavorite`, `removeFavorite`, `getFavoritesCollection`, `fetchUserFavoriteIds` |
| `ratings.ts` | `ratings` | `upsertRating`, `deleteRating`, `getRatingsCollection` |
| `comments.ts` | `comments`, `commentLikes` | `addComment`, `editComment`, `deleteComment`, `likeComment`, `unlikeComment`, `getCommentsCollection` |
| `tags.ts` | `userTags`, `customTags` | `addUserTag`, `removeUserTag`, `createCustomTag`, `updateCustomTag`, `deleteCustomTag` |
| `feedback.ts` | `feedback` + `feedback-media` (Storage) | `sendFeedback` (with optional media upload), `fetchUserFeedback`, `markFeedbackViewed` |
| `adminFeedback.ts` | `feedback` (via callable) | `respondToFeedback`, `resolveFeedback`, `createGithubIssueFromFeedback` |
| `menuPhotos.ts` | `menuPhotos` | `uploadMenuPhoto` (con AbortSignal + progress), `getUserPendingPhotos` |
| `priceLevels.ts` | `priceLevels` | `upsertPriceLevel`, `deletePriceLevel`, `getPriceLevelsCollection` |
| `userSettings.ts` | `userSettings` | `fetchUserSettings`, `updateUserSettings`, `DEFAULT_SETTINGS` |
| `checkins.ts` | `checkins` | `createCheckIn`, `deleteCheckIn`, `fetchMyCheckIns`, `fetchCheckInsForBusiness`, `getCheckinsCollection` |
| `follows.ts` | `follows` | `followUser`, `unfollowUser`, `isFollowing`, `fetchFollowing`, `fetchFollowers`, `getFollowsCollection` |
| `notifications.ts` | `notifications` | `fetchUserNotifications`, `markNotificationRead`, `markAllNotificationsRead`, `getUnreadCount` |
| `recommendations.ts` | `recommendations` | `createRecommendation`, `markRecommendationAsRead`, `markAllRecommendationsAsRead`, `countUnreadRecommendations`, `countRecommendationsSentToday`, `getRecommendationsCollection`, `getReceivedRecommendationsConstraints` |
| `rankings.ts` | `userRankings` | `fetchRanking`, `fetchLatestRanking`, `getCurrentPeriodKey`, `getPreviousPeriodKey`, `fetchUserScoreHistory`, `fetchUserLiveScore` |
| `achievements.ts` | `achievements` | `fetchAchievements`, `saveAllAchievements`, `deleteAchievement` |
| `specials.ts` | `specials` (config) | `fetchSpecials`, `fetchActiveSpecials`, `saveAllSpecials`, `deleteSpecial` |
| `users.ts` | `users` | `searchUsers`, `fetchUserDisplayNames` |
| `userProfile.ts` | `users` + aggregados | `fetchUserProfile` (read-only aggregate con stats) |
| `sharedLists.ts` | `sharedLists`, `listItems` | `fetchSharedList`, `fetchUserLists`, `fetchEditorName`, `inviteEditor` + operaciones CRUD de listas y items. `createList` y `updateList` aceptan `icon?: string` (validado via `getListIconById`) |
| `emailAuth.ts` | Firebase Auth | `linkWithCredential`, `signInWithEmailAndPassword`, `signOut`, `sendEmailVerification`, `sendPasswordResetEmail`, `reauthenticate`, `updatePassword`, `getAuthErrorMessage` |

### Servicios de datos agregados

| Modulo | Descripcion |
|--------|-------------|
| `businessData.ts` | Batch fetch de todos los datos de un comercio: `fetchBusinessData` (7 colecciones en paralelo), `fetchSingleCollection`, `fetchUserLikes` |
| `suggestions.ts` | `fetchUserSuggestionData` (agrega favorites, ratings, userTags para scoring) |
| `trending.ts` | `fetchTrending` (lee `trendingBusinesses/current`, convierte Timestamps a Dates) |
| `activityFeed.ts` | `getActivityFeedCollection` (CollectionReference tipada) |

### Servicios de offline y cache

| Modulo | Descripcion |
|--------|-------------|
| `offlineInterceptor.ts` | `withOfflineSupport<T>` — wrapper que detecta offline y encola en IndexedDB. Exporta `OFFLINE_ENQUEUED_MSG` |
| `offlineQueue.ts` | IndexedDB CRUD para la cola offline: `enqueue`, `getAll`, `getPending`, `updateStatus`, `bulkUpdateStatus`, `remove`, `cleanup`, `count`, `subscribe` |
| `syncEngine.ts` | `executeAction` (ejecuta una accion encolada), `processQueue` (procesa toda la cola con retry) |
| `queryCache.ts` | Cache en memoria para queries paginadas: `getQueryCache`, `setQueryCache`, `invalidateQueryCache`, `invalidateAllQueryCache`, `getCacheKey` |
| `readCache.ts` | Cache en IndexedDB para lectura offline: `getReadCacheEntry`, `setReadCacheEntry`, `clearReadCache`, `openReadCacheDb` |

### Admin services (`src/services/admin/`)

| Modulo | Operaciones |
|--------|-------------|
| `counters.ts` | `fetchCounters`, `fetchDailyMetrics` |
| `activity.ts` | `fetchRecentComments`, `fetchRecentRatings`, `fetchRecentFavorites`, `fetchRecentUserTags`, `fetchRecentCustomTags`, `fetchAllCustomTags`, `fetchRecentCommentLikes`, `fetchRecentPriceLevels`, `fetchRecentCheckins` |
| `content.ts` | `fetchRecentFeedback`, `fetchPendingPhotos`, `fetchAllPhotos`, `fetchAbuseLogs`, `reviewAbuseLog`, `dismissAbuseLog`, `fetchLatestRanking`, `fetchTrendingCurrent`, `fetchNotificationDetails`, `fetchListStats`, `fetchTopLists`, `fetchPerfMetrics`, `fetchStorageStats`, `fetchAnalyticsReport` |
| `social.ts` | `fetchRecentFollows`, `fetchRecentRecommendations`, `fetchFollowStats`, `fetchRecommendationStats` |
| `users.ts` | `fetchUsersPanelData`, `fetchCommentStats`, `fetchAuthStats`, `fetchSettingsAggregates` |
| `index.ts` | Barrel re-export de todos los modulos admin |

### Reglas del service layer

- Las funciones son `async` planas, no hooks.
- Aceptan parametros primitivos (userId, businessId, etc.), no objetos Firebase.
- **Validan entrada** como primera linea de defensa (defense in depth): longitudes, rangos, whitelists.
- Invalidan caches internamente (`invalidateQueryCache`, `invalidateBusinessCache`).
- Los errores propagan al componente que llama.
- Usan tipos estrictos (`FeedbackCategory`, `PredefinedTagId`) en vez de `string` generico.

### Upload de fotos (`menuPhotos.ts`)

El upload soporta cancelacion completa a traves de `AbortSignal`:

1. El componente crea un `AbortController` y pasa `signal` al servicio.
2. Si se cancela durante la compresion (`browser-image-compression`), se aborta inmediatamente.
3. Si se cancela durante el upload a Storage (`uploadBytesResumable`), se llama `uploadTask.cancel()`.
4. `contentType` se establece explicitamente (`file.type || 'image/jpeg'`) para evitar que Storage lo infiera incorrectamente.

---

## Hooks compartidos

### Hooks de datos y fetch

| Hook | Descripcion |
|------|-------------|
| `useAsyncData<T>` | Hook generico para fetch async. Retorna `{ data, loading, error }`. Usado por todos los paneles admin via `AdminPanelWrapper`. |
| `useBusinessData` | Orquesta 7 queries Firestore del business view con `Promise.all` + cache (5 min TTL). Incluye `patchedRef` para prevenir race conditions entre full loads y refetches parciales. Tambien fetchea user likes por comentario. |
| `useBusinessDataCache` | Cache module-level (`Map`) para datos del business view. TTL 5 min. Se invalida en cada write. Soporta `patchBusinessCache` para updates parciales. |
| `useBusinesses` | Filtra `businesses.json` por searchQuery + activeFilters + activePriceFilter con `useDeferredValue`. |
| `useBusinessRating` | Estado de rating del usuario para un comercio: score, criterios, promedios. Retorna `CriteriaAverages` y acciones. |
| `useProfileStats` | Estadisticas del perfil del usuario (comments, ratings, checkins, etc.). |
| `useUserProfile` | Perfil de otro usuario con stats agregadas. Recibe `userId` y `fallbackName`. |
| `useUserSettings` | Settings del usuario (perfil publico, notificaciones). Optimistic UI con revert on error. Retorna `{ settings, loading, updateSetting }`. |
| `useUserSearch` | Busqueda de usuarios por nombre con debounce 300ms. Prefix search en `displayNameLower`. |
| `useMyCheckIns` | Historial de check-ins del usuario con paginacion. |
| `useRankings` | Rankings semanales/mensuales/anuales/alltime. Retorna `PositionChangeMap` para deltas. |
| `useActivityFeed` | Feed de actividad de usuarios seguidos. |
| `useNotifications` | Polling cada 60s de notificaciones no leidas. Retorna `{ notifications, unreadCount, loading, markRead, markAllRead, refresh }`. |
| `useUnreadRecommendations` | Cuenta de recomendaciones no leidas. |
| `useTrending` | Trending businesses. Wrapper sobre `useAsyncData` + `fetchTrending`. |
| `useSuggestions` | Sugerencias personalizadas. Fetch de favoritos/ratings/tags, scoring client-side con Haversine. Max 10 resultados. |
| `usePublicMetrics` | Metricas publicas de dailyMetrics (estadisticas en menu lateral). |
| `useProfileVisibility` | Cache module-level con TTL 60s para `profilePublic` de otros usuarios. Batch fetch con `documentId() in`. Usa `useSyncExternalStore`. |
| `useAbuseLogsRealtime` | Suscripcion realtime a abuse logs para panel admin. Max 200 docs. |
| `useVisitHistory` | Historial de visitas en localStorage (ultimos 20 comercios). |
| `useUserLocation` | Geolocalizacion del navegador. |

### Hooks de interaccion

| Hook | Descripcion |
|------|-------------|
| `useCheckIn` | Check-in/check-out en comercio. Valida cooldown 4h y limite 10/dia. |
| `useFollow` | Follow/unfollow de usuarios. Estado optimistico. |
| `useOptimisticLikes` | Likes optimisticos en comentarios. Toggle con delta local. |
| `useCommentEdit` | Estado de edicion de comentario: `editingId`, `editText`, `startEdit`, `saveEdit`, `cancelEdit`. |
| `useCommentSort` | Ordena comentarios por `recent`, `oldest`, `useful`. |
| `useCommentThreads` | Agrupa comentarios por `parentId`. Retorna `topLevelComments` + mapa de respuestas. |
| `useCommentListBase` | Logica base compartida entre BusinessComments y BusinessQuestions (paginacion, likes, threads). |
| `useUndoDelete` | Undo-delete con `Map` de pending deletes, timer cleanup, `snackbarProps`. |
| `useSwipeActions` | Gestos swipe-to-reveal en mobile. Threshold 80px. Solo en `pointer: coarse`. |
| `useNavigateToBusiness` | Helper centralizado para navegar al detalle de un comercio. |
| `useTabNavigation` | Cross-tab navigation helpers. |

### Hooks de UI y estado

| Hook | Descripcion |
|------|-------------|
| `useColorMode` | Dark/light mode. Consume `ColorModeContext`. Retorna `{ mode, toggleColorMode }`. |
| `useConnectivity` | Estado online/offline. Re-exporta desde `ConnectivityContext`. |
| `usePullToRefresh` | Gesto pull-to-refresh. Threshold 80px, invoca `onRefresh` async. |
| `useTabRefresh` | Refresh al activar un tab. Variantes: `useSocialSubTabRefresh`, `useListsSubTabRefresh`. |
| `useUnsavedChanges` | Detecta cambios no guardados en formularios. `isDirty`, `confirmClose`. |
| `useForceUpdate` | Compara version del cliente con Firestore `config/app.minVersion`. Fuerza recarga si es necesario. |
| `useDeepLinks` | Deep linking por URL: `?business={id}&sheetTab=`, `?list={id}`. |
| `useScreenTracking` | Track automatico de pathname para analytics. |

### Hooks de filtrado y paginacion

| Hook | Descripcion |
|------|-------------|
| `useListFilters<T>` | Filtrado generico: busqueda (debounced), categoria, estrellas, ordenamiento. |
| `usePaginatedQuery<T>` | Paginacion generica con cursores Firestore + cache primera pagina (2 min TTL). `cacheKey` obligatorio. |
| `usePriceLevelFilter` | Cache global de promedios de precio por comercio. Fetch unico con singleton. |
| `useSortLocation` | Ubicacion para ordenar por distancia. Fallback chain: GPS → localidad → oficina. |

### Hooks de features

| Hook | Descripcion |
|------|-------------|
| `useRatingPrompt` | Prompt contextual de rating. Detecta check-ins recientes, ventana 2-8h, cap 3/dia. |
| `useActivityReminder` | Recordatorio de actividad para usuarios anonimos. `incrementAnonRatingCount`. |
| `useOnboardingHint` | Logica de cuando mostrar hint de onboarding. |
| `useOnboardingFlow` | Pasos y transiciones del flujo de onboarding. |
| `useSurpriseMe` | Seleccion aleatoria de comercio ("sorprendeme"). |

### Hooks de auth

| Hook | Descripcion |
|------|-------------|
| `usePasswordConfirmation` | Validacion de confirmacion de password. `isValid`, `error`, `helperText`. |
| `useRememberedEmail` | Recuerda ultimo email en localStorage. |
| `useVerificationCooldown` | Cooldown de verificacion de email. `verificationSent`, `verificationLoading`. |

### `useBusinessData` — Race condition fix

El hook ejecuta 7 queries en paralelo. Cuando el usuario interactua (ej: vota precio), se hace un refetch parcial de esa coleccion. Sin proteccion, el full load puede completar despues y sobreescribir el dato recien actualizado.

**Solucion con `patchedRef`:**

1. Al iniciar un full load, se limpia `patchedRef.current`.
2. Cada refetch parcial agrega el nombre de coleccion a `patchedRef.current` y actualiza el state con `setData(prev => ...)`.
3. Al completar el full load, si `patchedRef.current.size > 0`, se mergea el resultado preservando las colecciones ya patcheadas del state actual.
4. Los refetches parciales **no incrementan** `fetchIdRef`, evitando que se descarte el full load como stale.

---

## Utilidades compartidas (`src/utils/`)

### `formatDate.ts`

Funciones centralizadas de formato de fecha en locale argentino (es-AR):

| Funcion | Descripcion | Ejemplo salida |
|---------|-------------|----------------|
| `toDate(field)` | Convierte Firestore Timestamp-like a `Date` nativo | `Date` object |
| `formatDateShort(date)` | Formato corto: dd/MM, HH:mm | `12/03, 14:30` |
| `formatDateMedium(date)` | Formato medio: d MMM yyyy | `12 mar 2026` |
| `formatRelativeTime(date)` | Tiempo relativo humanizado (hace X min/horas/dias, ayer) | `hace 2 min`, `ayer` |
| `formatDateFull(dateStr)` | Formato completo desde ISO string: dd/MM/yyyy, HH:mm | `12/03/2026, 14:30` |

### `analytics.ts`

Utilidad centralizada para Firebase Analytics (GA4). Solo activa en produccion, lazy-loaded via dynamic import.

| Funcion | Descripcion |
|---------|-------------|
| `initAnalytics(app)` | Inicializa analytics (solo en PROD). Llamada desde `main.tsx` |
| `trackEvent(name, params?)` | Envia evento custom a GA4. No-op si analytics no inicializado |
| `setUserProperty(name, value)` | Establece propiedad de usuario en GA4 |

### `text.ts`

| Funcion | Descripcion |
|---------|-------------|
| `truncate(text, maxLength)` | Trunca texto y agrega `...` si excede `maxLength` |

### `perfMetrics.ts`

Utilidad de captura de Web Vitals y query timing. Solo activa en produccion si `analyticsEnabled`.

| Funcion | Descripcion |
|---------|-------------|
| `initPerfMetrics(uid, analyticsEnabled)` | Inicializa session, observa LCP/INP/CLS/TTFB, registra flush en `visibilitychange` |
| `measureAsync(name, fn)` | Wrapper que mide duracion de una operacion async y acumula timing por nombre |
| `calculatePercentile(arr, p)` | Calcula percentil `p` de un array numerico |
| `getDeviceInfo()` | Detecta mobile/desktop y tipo de conexion (`effectiveType`) |

Flush: una unica escritura por sesion (al ocultar tab o tras 30s) via `writePerfMetrics` callable (Admin SDK), no direct Firestore addDoc. Best-effort, silent fail.

### `businessHelpers.ts`

| Funcion | Descripcion |
|---------|-------------|
| `getBusinessName(id)` | Obtiene nombre del comercio por ID desde `businesses.json` |
| `getTagLabel(tagId)` | Obtiene label en espanol de un tag predefinido |

### `contrast.ts`

| Funcion | Descripcion |
|---------|-------------|
| `relativeLuminance(hex)` | Calcula luminancia relativa de un color hex |
| `getContrastText(backgroundHex)` | Retorna `#fff` o `#000` segun contraste con el fondo |

### `distance.ts`

| Funcion | Descripcion |
|---------|-------------|
| `distanceKm(lat1, lng1, lat2, lng2)` | Calcula distancia en km entre dos puntos (Haversine) |
| `formatDistance(km)` | Formatea distancia a string legible (ej: `1.2 km`, `500 m`) |

### `getCountOfflineSafe.ts`

| Funcion | Descripcion |
|---------|-------------|
| `getCountOfflineSafe(query)` | `getCountFromServer` con fallback a 0 si offline |

### `logger.ts`

| Export | Descripcion |
|--------|-------------|
| `logger` | Objeto con metodos `log`, `warn`, `error`, `debug`. Solo activo en dev mode |

### `media.ts`

| Funcion | Descripcion |
|---------|-------------|
| `isValidStorageUrl(url)` | Valida que una URL sea de Firebase Storage |

### `version.ts`

| Funcion | Descripcion |
|---------|-------------|
| `compareSemver(a, b)` | Compara dos versiones semver. Retorna -1, 0, o 1 |
| `isUpdateRequired(required, current)` | Determina si la version actual necesita update forzado |

---

## Componentes compartidos admin

### `AdminPanelWrapper`

Wrapper para los estados loading/error/empty de paneles admin. Elimina la duplicacion de `Box+CircularProgress / Alert` en cada panel.

**Props:** `loading`, `error`, `errorMessage?`, `children`.

**Patron de uso con `useAsyncData`:**

```typescript
const fetcher = useCallback(() => fetchSomeData(), []);
const { data, loading, error } = useAsyncData(fetcher);

return (
  <AdminPanelWrapper loading={loading} error={error} errorMessage="Error cargando datos.">
    {/* contenido del panel */}
  </AdminPanelWrapper>
);
```

### Filtros reutilizables

- Hook `useListFilters<T>`: filtrado por nombre, categoria, score + ordenamiento
- Componente `ListFilters`: TextField busqueda, chips categoria, chips estrellas (opcional), Select orden, contador "N de M"
- Usado en FavoritesList y RatingsList
