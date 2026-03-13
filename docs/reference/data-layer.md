# Data layer — Services, Hooks, Utils

## Constantes centralizadas (`src/constants/`)

Todos los valores magicos, configuraciones, labels y opciones estan centralizados en `src/constants/` organizados por dominio:

| Modulo | Contenido |
| ------ | --------- |
| `validation.ts` | Limites de longitud (comment, displayName, customTag, feedback), truncamiento, score options |
| `cache.ts` | TTLs de cache (business 5min, query 2min, profile 60s) |
| `storage.ts` | Keys de localStorage (colorMode, visits, analyticsConsent) |
| `timing.ts` | Intervalos (poll 60s, auto-dismiss 5s, six months) |
| `feedback.ts` | Categorias validas de feedback |
| `ui.ts` | Colores de graficos, URL agregar comercio |
| `map.ts` | Centro de Buenos Aires, colores por categoria |
| `tags.ts` | Tags predefinidos, IDs validos |
| `rankings.ts` | Scoring, medallas, labels de acciones, opciones de periodo |
| `business.ts` | Niveles de precio, simbolos, chips, labels de categoria |
| `criteria.ts` | Configuracion de criterios multi-rating (`RATING_CRITERIA`: food, service, price, ambiance, speed) |
| `suggestions.ts` | Pesos del algoritmo de sugerencias (`SUGGESTION_WEIGHTS`), `MAX_SUGGESTIONS`, `NEARBY_RADIUS_KM` |
| `admin.ts` | Email admin, page size, status chips/labels, abuse type labels/colors |
| `index.ts` | Barrel re-export de todos los modulos (14) + COLLECTIONS de config |

`types/index.ts` re-exporta `PREDEFINED_TAGS`, `PRICE_LEVEL_LABELS` y `CATEGORY_LABELS` desde constants para backwards compatibility.

---

## Service layer (`src/services/`)

Capa de abstraccion entre componentes y Firestore. Los componentes nunca importan `firebase/firestore` directamente para escrituras.

| Modulo | Coleccion | Operaciones |
|--------|-----------|-------------|
| `favorites.ts` | `favorites` | `addFavorite`, `removeFavorite`, `getFavoritesCollection` |
| `ratings.ts` | `ratings` | `upsertRating`, `deleteRating`, `getRatingsCollection` |
| `comments.ts` | `comments`, `commentLikes` | `addComment`, `editComment`, `deleteComment`, `likeComment`, `unlikeComment`, `getCommentsCollection` |
| `tags.ts` | `userTags`, `customTags` | `addUserTag`, `removeUserTag`, `createCustomTag`, `updateCustomTag`, `deleteCustomTag` |
| `feedback.ts` | `feedback` | `sendFeedback` |
| `menuPhotos.ts` | `menuPhotos` | `uploadMenuPhoto` (con AbortSignal + progress callback), `getUserPendingPhotos` |
| `priceLevels.ts` | `priceLevels` | `upsertPriceLevel`, `deletePriceLevel`, `getBusinessPriceLevels` |
| `userSettings.ts` | `userSettings` | `fetchUserSettings`, `updateUserSettings`, `DEFAULT_SETTINGS` |
| `suggestions.ts` | `favorites`, `ratings`, `userTags` | `fetchUserSuggestionData` (datos para scoring de sugerencias) |
| `admin.ts` | Todas (read-only) | `fetchCounters`, `fetchRecent*` (6 colecciones), `fetchAllCustomTags`, `fetchUsersPanelData`, `fetchDailyMetrics`, `fetchAbuseLogs`, `fetchAllPhotos` |
| `index.ts` | — | Barrel export de todas las operaciones CRUD |

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

| Hook | Descripcion |
|------|-------------|
| `useAsyncData<T>` | Hook generico para fetch async. Retorna `{ data, loading, error }`. Usado por todos los paneles admin via `AdminPanelWrapper`. |
| `useBusinessData` | Orquesta 7 queries Firestore del business view con `Promise.all` + cache (5 min TTL). Incluye `patchedRef` para prevenir race conditions entre full loads y refetches parciales. Tambien fetchea user likes por comentario. |
| `useBusinessDataCache` | Cache module-level (`Map`) para datos del business view. TTL 5 min. Se invalida en cada write. Soporta `patchBusinessCache` para updates parciales. |
| `useColorMode` | Hook para dark/light mode. Consume `ColorModeContext`. Retorna `{ mode, toggleColorMode }`. |
| `useBusinesses` | Filtra `businesses.json` por searchQuery + activeFilters + activePriceFilter con `useDeferredValue`. |
| `useListFilters<T>` | Filtrado generico: busqueda (debounced), categoria, estrellas, ordenamiento. Usado en FavoritesList y RatingsList. |
| `usePaginatedQuery<T>` | Paginacion generica con cursores Firestore + cache primera pagina (2 min TTL). Exporta `invalidateQueryCache()`. |
| `usePriceLevelFilter` | Cache global de promedios de precio por comercio. Fetch unico con `fetchPromise` singleton. Exporta `invalidatePriceLevelCache()`. |
| `useVisitHistory` | Historial de visitas en localStorage (ultimos 20 comercios). Retorna `{ visits, recordVisit }`. Se usa en BusinessSheet para registrar y en RecentVisits para mostrar. |
| `useUserLocation` | Geolocalizacion del navegador. |
| `usePublicMetrics` | Hook para metricas publicas de dailyMetrics (estadisticas en menu lateral). |
| `useUserSettings` | Settings del usuario (perfil publico, notificaciones). Optimistic UI con revert on error. Retorna `{ settings, loading, updateSetting }`. |
| `useProfileVisibility` | Cache module-level con TTL 60s para `profilePublic` de otros usuarios. Batch fetch con `documentId() in`. Retorna `Map<string, boolean>`. Usa `useSyncExternalStore`. |
| `useNotifications` | Polling cada 60s de notificaciones no leidas. Retorna `{ notifications, unreadCount, loading, markRead, markAllRead, refresh }`. |
| `useSuggestions` | Sugerencias personalizadas. Fetch de favoritos/ratings/tags del usuario via `services/suggestions.ts`, scoring client-side con Haversine para cercania. Retorna `{ suggestions, isLoading, error }`. Max 10 resultados. |

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
| `formatDateFull(dateStr)` | Formato completo desde ISO string: dd/MM/yyyy, HH:mm | `12/03/2026, 14:30` |

### `analytics.ts`

Utilidad centralizada para Firebase Analytics (GA4). Solo activa en produccion, lazy-loaded via dynamic import.

| Funcion | Descripcion |
|---------|-------------|
| `initAnalytics(app)` | Inicializa analytics (solo en PROD). Llamada desde `main.tsx` |
| `trackEvent(name, params?)` | Envia evento custom a GA4. No-op si analytics no inicializado |
| `setUserProperty(name, value)` | Establece propiedad de usuario en GA4 |

### `businessHelpers.ts`

| Funcion | Descripcion |
|---------|-------------|
| `getBusinessName(id)` | Obtiene nombre del comercio por ID desde `businesses.json` |
| `getTagLabel(tagId)` | Obtiene label en espanol de un tag predefinido |

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
