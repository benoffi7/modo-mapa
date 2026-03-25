# Patrones y convenciones

## Autenticacion y acceso

| Patron | Descripcion |
|--------|-------------|
| **Auth anonima + email/password + Google Sign-In** | Usuarios ingresan como anonimos. Pueden vincular email/password via `linkWithCredential` (preserva UID). Login cross-device con `signInWithEmailAndPassword`. Admin usa Google Sign-In solo en `/admin`. AuthMethod: `'anonymous' \| 'email' \| 'google'`. |
| **Email auth service layer** | Todas las operaciones de auth email en `services/emailAuth.ts`: link, signIn, signOut, verify, reset, changePassword, getAuthErrorMessage. Errores mapeados a espanol en `constants/auth.ts`. |
| **Admin guard (2 capas)** | Frontend: `AdminGuard` verifica `user.email === 'benoffi11@gmail.com'`. Server: Firestore rules con `request.auth.token.email`. |
| **App Check (prod + functions)** | Firebase App Check con reCAPTCHA Enterprise en frontend. `enforceAppCheck: !IS_EMULATOR` en todas las Cloud Functions callable. |

## Constantes centralizadas

| Patron | Descripcion |
| ------ | ----------- |
| **Constantes en `src/constants/`** | Todos los valores magicos, configuraciones y labels centralizados en modulos por dominio (validation, cache, storage, timing, feedback, ui, map, tags, rankings, business, admin, auth, analyticsEvents). Barrel re-export en `constants/index.ts`. |
| **Analytics event names** | Nombres de eventos centralizados en `constants/analyticsEvents.ts` como `EVT_*` constants. Nunca usar string literals para trackEvent. |
| **Sin circular deps** | Los modulos de constantes usan `import type` para tipos de `src/types/`. Los tipos no importan logica de constantes. `types/index.ts` re-exporta PREDEFINED_TAGS, PRICE_LEVEL_LABELS, CATEGORY_LABELS para backwards compatibility. |
| **Constants Dashboard (DEV)** | `/dev/constants` — registry auto-descubre constantes via `Object.entries`. Solo en bundle DEV (lazy-loaded). |

## Datos y estado

| Patron | Descripcion |
|--------|-------------|
| **Datos estaticos + dinamicos** | Comercios en JSON local (`src/data/businesses.json`), interacciones en Firestore. Se cruzan por `businessId` client-side. **NUNCA** hacer `getDoc('businesses/{id}')` — usar `allBusinesses` de `hooks/useBusinesses.ts`. |
| **Service layer** | Componentes llaman `src/services/` para CRUD. Nunca importan `firebase/firestore` directamente para escrituras. |
| **Doc ID compuesto** | `{userId}__{businessId}` para favoritos, ratings y userTags. `{userId}__{commentId}` para commentLikes. `{followerId}__{followedId}` para follows. Garantiza unicidad sin queries extra. |
| **withConverter\<T\>()** | Todas las lecturas de Firestore usan `withConverter<T>()` con converters centralizados. Escrituras usan refs sin converter (por `serverTimestamp()`). |
| **Collection names** | Nombres de colecciones centralizados en `src/config/collections.ts` como constantes. Sin strings magicos. |
| **Timestamps server-side** | Todas las reglas de `create` validan `createdAt == request.time`. Ratings valida `updatedAt == request.time` en create y update. |

## Queries y cache

| Patron | Descripcion |
|--------|-------------|
| **Parallel query batching** | `useBusinessData` ejecuta las 7 queries de Firestore del business view en un solo `Promise.all` para reducir latencia y facilitar cache. |
| **Selective refetch** | `refetch(collectionName)` recarga solo la coleccion afectada (1 query) en vez de las 7. `patchBusinessCache` mergea updates parciales en cache. |
| **patchedRef race condition fix** | En `useBusinessData`, `patchedRef` trackea colecciones actualizadas por refetches parciales. Al completar full load, preserva esas colecciones del state actual en vez de sobreescribir. Refetches parciales no incrementan `fetchIdRef`. |
| **Business data cache** | `useBusinessDataCache.ts` — cache module-level (`Map`) con TTL de 5 min para las 7 queries del business view. Se invalida en cada write. |
| **First-page query cache** | `usePaginatedQuery.ts` exporta `invalidateQueryCache()`. Cache module-level (`Map`) con TTL de 2 min para la primera pagina de listas paginadas. |
| **Firestore persistent cache (prod)** | En produccion se usa `initializeFirestore` con `persistentLocalCache` + `persistentMultipleTabManager` para cachear datos en IndexedDB. |
| **usePaginatedQuery** | Hook generico para paginacion con cursores Firestore. Usado en FavoritesList, CommentsList, RatingsList. Boton "Cargar mas". |

## UI patterns

| Patron | Descripcion |
|--------|-------------|
| **Optimistic UI** | Comentarios se agregan al state local antes de que Firestore confirme. Likes usan Maps para toggle state + delta count. Rating usa `pendingRating`. Price level usa `pendingLevel`. FavoriteButton usa derived state pattern (`prevIsFavorite` + `optimistic`) para reset sin flicker al re-render del parent. `useFollow` usa optimistic toggle con revert on error + offline support. |
| **Toast global (`useToast`)** | Context provider en `ToastContext.tsx` con `useMemo` para valor estable. Metodos `success/error/warning/info`. Auto-dismiss 4s. Un toast a la vez. Integrado en ratings (error), comments (exito+error), favorites (exito+error). |
| **Pull-to-refresh (`usePullToRefresh`)** | Hook custom para gesto touch vertical. Solo activa si `scrollTop === 0`. Threshold 80px. `PullToRefreshWrapper` component con CircularProgress. Integrado en FavoritesList, CommentsList, RatingsList, RankingsView. |
| **Rate limit precheck (UI)** | En BusinessComments, si `userCommentsToday >= MAX_COMMENTS_PER_DAY`, se reemplaza el input por Alert informativo. Contador "X/20 hoy" en helperText con color warning cuando quedan ≤3. Evita que el usuario escriba un comentario que no podra publicar. |
| **Component remount via key** | `feedbackKey` en SideMenu fuerza remount del FeedbackForm. `key={businessId}` en BusinessPriceLevel para reset de `pendingLevel`. Evita useEffect + refs para reset, compatible con strict lint rules. |
| **Undo delete (`useUndoDelete`)** | Hook generico para undo-delete con Map de pending deletes, timer cleanup en unmount, `lastDeletedIdRef` para evitar stale closures, `snackbarProps` con `autoHideDuration`. Usado en BusinessComments y CommentsList. |
| **`PaginatedListShell`** | Componente wrapper para listas paginadas: skeleton/error/empty/no-results/pagination. Props configurables (`emptyIcon`, `renderSkeleton`, `noResultsMessage`, `isFiltered`). Adoptado en CommentsList. |
| **`CommentRow` (memo)** | Componente memoizado extraido de BusinessComments (~170 lineas). Recibe `isEditing: boolean` precalculado para evitar re-renders de todos los rows al cambiar `editingId`. |
| **`CommentInput` (memo)** | Formulario de comentario extraido de BusinessComments. Maneja rate limit precheck, contador diario, warning visual. Estado del texto encapsulado. |
| **Admin panel decomposition** | PerformancePanel → `admin/perf/` (SemaphoreCard, QueryLatencyTable, FunctionTimingTable, StorageCard, perfHelpers). AbuseAlerts → `admin/alerts/` (KpiCard, alertsHelpers). Patron: helpers y subcomponentes en subdirectorio, parent como orquestador. |
| **Swipe actions (`useSwipeActions`)** | Hook para gestos swipe-to-reveal en mobile. Touch events con threshold 80px, cancela si vertical >10px. Swipe left=delete, right=edit. Solo en `pointer: coarse`. Fallback accesible con botones visibles. |
| **Deep linking** | `?business={id}` en URL abre el bottom sheet del comercio. Usado por ShareButton. |
| **Props-driven business components** | BusinessRating, BusinessComments, BusinessTags, BusinessPriceLevel y FavoriteButton reciben datos como props desde BusinessSheet (via `useBusinessData`). No hacen queries internas. |
| **Admin panel pattern** | Todos los paneles admin usan `useAsyncData` + `AdminPanelWrapper` para estados loading/error. |
| **`component="span"`** | En MUI `ListItemText` secondary, para evitar `<p>` dentro de `<p>`. Se usa `display: block` en spans. |
| **Hook generico de filtros** | `useListFilters<T>` acepta cualquier item con `business` asociado. Reutilizado en favoritos y ratings. |
| **Debounce con useDeferredValue** | `useBusinesses`, `useListFilters` y `CommentsList` usan `useDeferredValue` de React 19 para debounce de busqueda. |
| **`usePaginatedQuery` constraints genericos** | El hook acepta `QueryConstraint[]` o `string` (backward compat con userId). `cacheKey` obligatorio para cache compat. Incluye `loadAll(maxItems)` con `hasMoreRef` para loops async seguros. |
| **ErrorBoundary** | Envuelve `AppShell` y `AdminDashboard`. Fallback UI con opcion de recargar. |
| **Stable event listeners via refs** | Cuando un event listener necesita acceder a state reactivo, usar `useRef` para mantener valores actualizados sin recrear el callback. El listener se registra una sola vez (`useEffect(fn, [])`). Usado en `AccountBanner` y `useActivityReminder` para el evento `anon-interaction`. |
| **Unified account creation flow** | AppShell coordina el flujo register/login via props a SideMenu (`onCreateAccount`, `onLogin`, `emailDialogOpen`, `emailDialogTab`). El estado de onboarding (hint display, flow steps) vive en hooks extraidos: `useOnboardingHint` y `useOnboardingFlow`. El flujo es: CTA → BenefitsDialog (primera vez) → EmailPasswordDialog. |
| **Auth dialog hooks** | `usePasswordConfirmation(password, confirm)` para validación de confirmación compartida entre EmailPasswordDialog y ChangePasswordDialog. `useRememberedEmail()` aísla lógica de localStorage para "recordar email". `clearAuthError()` en AuthContext limpia errores stale al cerrar/cambiar tab. Timeout cleanup con `useRef` + `useEffect` en ChangePasswordDialog. Focus con `useLayoutEffect` + `requestAnimationFrame`. |
| **Onboarding hooks** | `useOnboardingHint` encapsula lógica de cuándo/cómo mostrar el hint de onboarding (extraido de AppShell). `useOnboardingFlow` maneja los pasos del flujo de onboarding. `useSurpriseMe` encapsula la lógica de "sorpréndeme" (selección aleatoria de comercio), extraida de SideMenu. |

## Uploads y media

| Patron | Descripcion |
|--------|-------------|
| **AbortController for uploads** | `MenuPhotoUpload` usa `AbortController` para cancelar compression + Storage upload en cualquier punto de la cadena. Boton cancel siempre habilitado durante upload. |
| **Photo reporting** | Usuarios reportan fotos via `reportMenuPhoto` callable. Subcollection `reports` bajo cada foto previene duplicados (doc ID = userId). `reportCount` incrementado atomicamente con `FieldValue.increment(1)`. |
| **Photo staleness** | Si la foto fue revisada hace mas de 6 meses, se muestra un chip "Posiblemente desactualizado" (warning). |
| **Feedback media upload** | `sendFeedback` acepta un `File` opcional. Valida tipo (JPG/PNG/WebP) y tamanio (max 10MB). Sube a `feedback-media/{feedbackId}/{fileName}`, obtiene download URL y actualiza el doc con `mediaUrl` y `mediaType`. |

## Shared lists

| Patron | Descripcion |
|--------|-------------|
| **Two-collection model** | `sharedLists` (metadata + owner) + `listItems` (compound ID `{listId}__{businessId}`). itemCount mantenido manualmente con `increment()`. |
| **Public/private toggle** | Campo `isPublic` en sharedList. Rules: read solo para owner o `isPublic == true`. Share button solo visible si pública. |
| **Deep link** | `?list={id}` en URL abre SideMenu en sección lists con la lista específica. `sharedListId` prop propagado AppShell → SideMenu → SharedListsView. |
| **AddToListDialog** | Dialog desde BusinessSheet con checkboxes por lista. Carga estado checked via `fetchListItems` por cada lista del usuario. Crear nueva lista inline. |

## Follows y activity feed

| Patron | Descripcion |
|--------|-------------|
| **useFollow (optimistic toggle + offline)** | Hook que expone `following`, `loading`, `toggling`, `toggle`, `isSelf`. Check inicial con `isFollowing()`. Toggle optimista: invierte state local antes de escribir, revierte si falla. Integrado con `withOfflineSupport` para encolar en IndexedDB si offline. No permite seguirse a si mismo (`isSelf` guard). |
| **useUserSearch (debounced prefix)** | Hook con debounce de 300ms via `setTimeout` + `clearTimeout` en ref. Minimo 2 caracteres. Llama a `searchUsers()` que consulta `displayNameLower` con range query (`>=` lower, `<=` lower + `\uf8ff`). Filtra por `profilePublic` client-side (revisa `userSettings` por candidato). Max 10 resultados. |
| **displayNameLower search** | Campo `displayNameLower` en docs de `users` (mantenido por `AuthContext` al crear/editar displayName). Permite busqueda por prefijo case-insensitive usando Firestore range queries sin indices custom adicionales. |
| **Fan-out writes pattern** | `fanOutToFollowers(db, data)` en Cloud Functions: lee todos los seguidores del actor, escribe un `ActivityFeedItem` en `activityFeed/{followerId}/items` para cada uno. Batch writes de 500. Solo ejecuta si el actor tiene perfil publico. Items expiran a 30 dias (`expiresAt`). Invocado desde triggers de ratings, comments y favorites. |
| **Activity feed subcollection** | `activityFeed/{userId}/items` — subcolleccion por usuario para O(1) reads del feed. Cada item tiene `actorId`, `actorName`, `type` (rating/comment/favorite), `businessId`, `businessName`, `referenceId`, `createdAt`, `expiresAt`. Paginado con `usePaginatedQuery` (20 items/pagina). |
| **Follow counters server-managed** | `followingCount` y `followersCount` en docs de `users` gestionados exclusivamente por Cloud Functions (`FieldValue.increment`). `onFollowCreated` incrementa, `onFollowDeleted` decrementa con floor 0 (lee valor actual antes de decrementar). |

## Abuse alerts (admin)

| Patron | Descripcion |
|--------|-------------|
| **Review/dismiss actions** | Admin puede marcar alertas como revisadas o descartadas via `updateDoc` directo (no callable). Campos `reviewed`, `dismissed`, `reviewedAt` en `abuseLogs`. Firestore rules permiten update parcial por admin con `affectedKeys().hasOnly()`. |
| **Local optimistic state** | `localUpdates` Map mergeado con datos de `useAsyncData` via `effectiveLogs` memo. Evita refetch completo post-acción. |
| **Status filter** | Filtro por estado (Pendientes/Revisadas/Descartadas/Todas). Default: Pendientes. |
| **User inline stats** | Total alertas del usuario y badge "Reincidente" (>3) calculados client-side desde datos ya cargados. Sin query adicional. |

## Feedback status tracking

| Patron | Descripcion |
|--------|-------------|
| **Status state machine** | `pending` → `viewed` → `responded` → `resolved`. Admin avanza status via Cloud Functions callable (`respondToFeedback`, `resolveFeedback`). |
| **Admin actions** | Responder (guarda `adminResponse` + crea notificacion), resolver (marca resuelto + notificacion), crear GitHub issue (`createGithubIssueFromFeedback` usa `@octokit/rest` + `GITHUB_TOKEN` secret, mapea categoria a label). |
| **User "Mis envios"** | Tab dentro de `FeedbackForm` (no item de menu separado). `MyFeedbackList` muestra feedback propio con chips de status (colores: pending=warning, viewed=info, responded=success, resolved=secondary), respuestas colapsables, indicador de nueva respuesta (dot verde). |
| **viewedByUser tracking** | Al expandir un feedback respondido, se marca `viewedByUser: true` via `markFeedbackViewed`. El dot verde desaparece. |
| **BYPASS_MASTER_TOGGLE** | Las notificaciones de `feedback_response` ignoran el toggle master de notificaciones — siempre se envian si `notifyFeedback` esta habilitado. |

## Server-side

| Patron | Descripcion |
|--------|-------------|
| **Rate limiting (3 capas)** | Client-side (UI) + server-side (Cloud Functions triggers) + Cloud Functions callable (Firestore-backed, 5/min/user). |
| **Moderacion de contenido** | Cloud Functions filtran texto con lista de banned words (configurable en `config/moderation`). Normalizacion de acentos + word boundary. |
| **Counters server-side** | Cloud Functions triggers actualizan `config/counters` atomicamente con `FieldValue.increment`. |
| **Metricas diarias** | Scheduled function calcula distribucion, tops, active users a las 3AM y guarda en `dailyMetrics/{YYYY-MM-DD}`. |

## TypeScript y build

| Patron | Descripcion |
|--------|-------------|
| **import type** | Obligatorio por `verbatimModuleSyntax: true` en tsconfig. |
| **exactOptionalPropertyTypes** | Habilitado en tsconfig. Propiedades opcionales requieren `\| undefined` explicito para asignar `undefined`. |
| **Pre-commit hooks** | `husky` + `lint-staged` ejecuta ESLint en archivos `.ts/.tsx` staged antes de cada commit. |
| **Markdown lint** | Archivos `.md` deben cumplir markdownlint (`.markdownlint.json`). Reglas clave: blank lines around headings/lists/fences, language en code blocks. |
| **Lazy loading admin** | `/admin` usa `lazy()` + `Suspense`. No carga MapProvider/APIProvider. |
| **Emuladores en DEV** | `firebase.ts` conecta a emuladores solo en `import.meta.env.DEV`. |
| **Logger centralizado** | `src/utils/logger.ts` — `logger.error()`, `.warn()`, `.log()`. En DEV: console. En PROD: errors a Sentry, warn/log silenciados. Nunca usar `console.*` directamente. |

## Dark mode

| Patron | Descripcion |
|--------|-------------|
| **Dark mode** | `ColorModeContext` + `useColorMode` hook. Persiste en `localStorage`, respeta `prefers-color-scheme`. Toggle en SideMenu footer. |
| **Theme playground (DEV)** | `/dev/theme` — palette generator, side-by-side light/dark preview, sticky output panel. Solo en `import.meta.env.DEV`. |

## Offline queue

| Patron | Descripcion |
|--------|-------------|
| **withOfflineSupport wrapper** | Componentes wrappean llamadas a servicios con `withOfflineSupport(isOffline, type, meta, payload, onlineAction, onEnqueued)`. Si offline, encola en IndexedDB. Si online, ejecuta la accion. Servicios no se modifican. |
| **ConnectivityContext** | Provider debajo de ToastProvider. Escucha online/offline events + verifica conectividad real con fetch HEAD. Auto-sync al reconectar. Expone `useConnectivity()` hook. |
| **IndexedDB nativa** | `offlineQueue.ts` usa IndexedDB API directamente (sin idb/Dexie). Singleton DB, subscribe/notify pattern, indexes por status y createdAt. |
| **SyncEngine dynamic imports** | `syncEngine.ts` usa `await import()` para cargar servicios bajo demanda, evitando que el import chain tire de firebase.ts en tests. |
| **Offline action types** | Union discriminada `OfflineActionType` con 9 tipos. Payloads tipados por tipo de accion en `types/offline.ts`. |

---

## Utilidades compartidas

| Patron | Descripcion |
|--------|-------------|
| **Shared date utils** | `src/utils/formatDate.ts` centraliza `toDate`, `formatDateShort`, `formatDateMedium`, `formatRelativeTime`, `formatDateFull`. Reemplaza duplicados en paneles admin, converters y componentes de menu (ej: `RecentVisits` usaba una copia local de `formatRelativeTime`). |
| **Shared distance utils** | `src/utils/distance.ts` exporta `distanceKm` (Haversine) y `formatDistance` ("a 300m" / "a 1.2km"). Usado por `useSuggestions`, `SuggestionsView`, `FavoritesList`. |
