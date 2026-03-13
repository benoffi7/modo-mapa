# Modo Mapa — Referencia completa del proyecto

**Version:** 2.1.0
**Repo:** <https://github.com/benoffi7/modo-mapa>
**Produccion:** <https://modo-mapa-app.web.app>
**Ultima actualizacion:** 2026-03-12

---

## Descripcion

App web mobile-first para empleados que necesitan encontrar comercios gastronomicos cercanos en un mapa interactivo. Los usuarios pueden buscar, filtrar, calificar, comentar, marcar favoritos y etiquetar comercios. Localizada en espanol (es-AR), orientada a Buenos Aires.

---

## Stack tecnologico

| Capa | Tecnologia | Version |
|------|-----------|---------|
| Framework | React | 19.2 |
| Bundler | Vite | 7.3 |
| Lenguaje | TypeScript | 5.9 (strict) |
| UI | Material UI (MUI) | 7.3 |
| Mapa | @vis.gl/react-google-maps | 1.7 |
| Graficos | recharts | 3.8 |
| Auth | Firebase Anonymous Auth + Google Sign-In | 12.10 |
| Base de datos | Cloud Firestore | 12.10 |
| Cloud Functions | Firebase Functions v2 | 6.3 |
| Hosting | Firebase Hosting | — |
| Routing | react-router-dom | 7.x |
| Error tracking | @sentry/react + @sentry/node | latest |
| PWA | vite-plugin-pwa (Workbox) | 1.2 |
| CI/CD | GitHub Actions | — |

---

## Arquitectura

```text
main.tsx
  └─ BrowserRouter (react-router-dom)
       └─ App.tsx
            ├─ ColorModeProvider (dark/light theme + persistence)
            ├─ AuthProvider (Firebase Auth + displayName + Google Sign-In)
            ├─ Routes
            ├─ [/dev/theme] ThemePlayground (lazy, DEV only)
            ├─ [/admin/*] AdminDashboard (lazy loaded)
       │    ├─ AdminGuard (Google Sign-In + email verification)
       │    └─ AdminLayout (tabs: Overview, Actividad, Feedback, Tendencias, Usuarios, Firebase Usage, Alertas, Backups, Fotos)
       │         ├─ DashboardOverview (StatCards + PieCharts + TopLists + Custom Tags ranking)
       │         ├─ ActivityFeed (tabs: comentarios, ratings, favoritos, tags)
       │         ├─ FeedbackList (tabla de feedback con categoria y estado)
       │         ├─ TrendsPanel (graficos evolucion + selector dia/semana/mes/ano)
       │         ├─ UsersPanel (rankings por usuario + stats)
       │         ├─ FirebaseUsage (LineCharts + PieCharts + barras cuota)
       │         ├─ AbuseAlerts (tabla de logs de abuso)
       │         ├─ BackupsPanel (crear, listar, restaurar, eliminar backups Firestore)
       │         └─ PhotoReviewPanel (revisar, aprobar, rechazar fotos de menu)
       └─ [/*] MapProvider + APIProvider
            └─ AppShell.tsx
                 ├─ OfflineIndicator (chip offline, PWA)
                 ├─ SearchBar (busqueda + menu hamburguesa)
                 ├─ FilterChips (tags predefinidos + nivel de gasto $/$$/$$)
                 ├─ MapView (Google Maps + markers)
                 ├─ LocationFAB (geolocalizacion)
                 ├─ BusinessSheet (bottom sheet con detalle)
                 │    ├─ BusinessHeader (nombre, direccion, favorito, share, direcciones)
                 │    ├─ BusinessRating (estrellas promedio + calificar)
                 │    ├─ BusinessPriceLevel (nivel de gasto $/$$/$$$ + votar)
                 │    ├─ BusinessTags (tags predefinidos + custom)
                 │    ├─ MenuPhotoSection (foto de menu + upload + viewer)
                 │    ├─ BusinessComments (lista + formulario + editar + undo delete + likes + sorting)
                 │    └─ ShareButton (Web Share API + clipboard fallback)
                 ├─ NameDialog (nombre de usuario, primera visita)
                 └─ SideMenu (drawer lateral)
                      ├─ Header (avatar + nombre + editar)
                      ├─ Nav (Favoritos, Recientes, Comentarios, Calificaciones, Feedback, Agregar comercio)
                      ├─ FavoritesList + ListFilters
                      ├─ RecentVisits (historial localStorage)
                      ├─ CommentsList
                      ├─ RatingsList + ListFilters
                      ├─ FeedbackForm
                      ├─ Dark mode toggle (switch + icon)
                      └─ Footer (version + Theme link in DEV)
```

### Capas de la arquitectura

```text
Components ──► Services ──► Firestore SDK ──► Cloud Firestore
     │              │
     │              └─ config/ (firebase.ts, collections.ts, converters)
     │
     ├─ Hooks (useAsyncData, useBusinessData, usePaginatedQuery, etc.)
     ├─ Context (AuthContext, MapContext)
     └─ Utils (formatDate, businessHelpers)
```

Los componentes **nunca** importan `firebase/firestore` directamente. Usan el service layer (`src/services/`) para escrituras y collection ref getters para lecturas paginadas. Las lecturas de admin pasan por `services/admin.ts`.

### Cloud Functions

```text
functions/
├── src/
│   ├── index.ts              → exports de todas las functions
│   ├── admin/
│   │   ├── backups.ts        → createBackup, listBackups, restoreBackup, deleteBackup (callable)
│   │   └── menuPhotos.ts     → approveMenuPhoto, rejectMenuPhoto, deleteMenuPhoto, reportMenuPhoto (callable)
│   ├── triggers/
│   │   ├── comments.ts       → rate limit + moderacion + counters + onUpdate re-moderation
│   │   ├── commentLikes.ts   → likeCount increment/decrement + rate limit + counters
│   │   ├── customTags.ts     → rate limit + moderacion + counters
│   │   ├── feedback.ts       → rate limit + moderacion + counters
│   │   ├── ratings.ts        → counters (create/update/delete)
│   │   ├── favorites.ts      → counters (create/delete)
│   │   ├── users.ts          → counters (create)
│   │   ├── menuPhotos.ts     → thumbnail generation con sharp + counters
│   │   └── priceLevels.ts    → counters (create/update)
│   ├── scheduled/
│   │   ├── dailyMetrics.ts   → cron diario: distribucion, tops, active users
│   │   └── cleanupPhotos.ts  → cron diario: elimina fotos rechazadas > 7 dias
│   └── utils/
│       ├── rateLimiter.ts    → rate limiting (daily/per-entity)
│       ├── moderator.ts      → filtro de palabras prohibidas (cache 5 min)
│       ├── counters.ts       → helpers increment/trackWrite/trackDelete
│       └── abuseLogger.ts    → logger a coleccion abuseLogs
├── .env                       → ADMIN_EMAIL (parametrizado con defineString)
├── package.json               → Node 22, firebase-admin, firebase-functions, @google-cloud/firestore, @google-cloud/storage
├── tsconfig.json              → CommonJS, strict
└── vitest.config.ts
```

### Flujo de datos

1. **Datos estaticos**: `businesses.json` (40 comercios) se carga como import estatico. No hay fetch.
2. **Datos dinamicos**: Firestore (favoritos, ratings, comentarios, tags, feedback, priceLevels, menuPhotos). El hook `useBusinessData` orquesta las 7 queries en paralelo con `Promise.all` y cache client-side. `refetch(collectionName)` recarga selectivamente una sola coleccion sin incrementar `fetchIdRef`. `patchedRef` previene que full loads sobreescriban datos de refetches parciales.
3. **Service layer**: Componentes llaman funciones de `src/services/` para operaciones CRUD. Los servicios encapsulan Firestore SDK e invalidan caches internamente.
4. **Estado global**: `AuthContext` (user, displayName, signInWithGoogle, signOut) + `MapContext` (selectedBusiness, searchQuery, filters, activePriceFilter, userLocation).
5. **Estado local**: Cada seccion del menu carga sus datos al montarse y los filtra client-side con `useListFilters`.
6. **Cache de datos**: Dos capas de cache client-side reducen lecturas Firestore:
   - `useBusinessDataCache`: cache de vista de negocio (5 min TTL) para las 5 queries del bottom sheet.
   - `usePaginatedQuery`: cache de primera pagina (2 min TTL) para listas del menu lateral.
7. **Server-side**: Cloud Functions triggers validan rate limits, moderan contenido y actualizan counters/metricas.

---

## Estructura de archivos

```text
src/
├── App.tsx                          # Routing: /admin (lazy) vs /* (mapa)
├── main.tsx                         # Entry point (StrictMode)
├── index.css                        # Estilos globales minimos
├── config/
│   ├── firebase.ts                  # Init Firebase + emuladores en DEV + App Check (prod) + persistent cache (prod)
│   ├── collections.ts               # Nombres de colecciones Firestore centralizados (incl. COMMENT_LIKES)
│   ├── converters.ts                # FirestoreDataConverter<T> tipados por coleccion (incl. feedback, commentLike)
│   ├── adminConverters.ts           # Converters para AdminCounters, DailyMetrics, AbuseLog
│   └── metricsConverter.ts          # Converter para PublicMetrics (solo campos publicos)
├── context/
│   ├── AuthContext.tsx               # Auth anonima + Google Sign-In + displayName
│   ├── ColorModeContext.tsx          # Dark/light mode provider + localStorage persistence
│   └── MapContext.tsx                # Estado del mapa (selected, search, filters)
├── services/
│   ├── index.ts                     # Barrel export de todas las operaciones CRUD
│   ├── favorites.ts                 # addFavorite, removeFavorite
│   ├── ratings.ts                   # upsertRating
│   ├── comments.ts                  # addComment, editComment, deleteComment, likeComment, unlikeComment
│   ├── tags.ts                      # addUserTag, removeUserTag, createCustomTag, updateCustomTag, deleteCustomTag
│   ├── feedback.ts                  # sendFeedback
│   ├── menuPhotos.ts                # uploadMenuPhoto (con AbortSignal), getUserPendingPhotos
│   ├── priceLevels.ts               # upsertPriceLevel, getBusinessPriceLevels
│   └── admin.ts                     # fetchCounters, fetchRecent*, fetchUsersPanelData, fetchDailyMetrics, fetchAbuseLogs, fetchAllPhotos
├── types/
│   ├── index.ts                     # Business, Rating, Comment, CommentLike, CustomTag, UserTag, Favorite, Feedback, MenuPhoto, MenuPhotoStatus, PriceLevel, PRICE_LEVEL_LABELS
│   ├── admin.ts                     # AdminCounters, DailyMetrics (extends PublicMetrics), AbuseLog
│   └── metrics.ts                   # PublicMetrics, TopTagEntry, TopBusinessEntry, TopRatedEntry
├── theme/
│   └── index.ts                     # MUI theme with getDesignTokens(mode) for light/dark
├── data/
│   └── businesses.json              # 40 comercios
├── hooks/
│   ├── useAsyncData.ts              # Hook generico para fetch async con loading/error states
│   ├── useBusinesses.ts             # Filtra businesses por searchQuery + activeFilters
│   ├── useBusinessData.ts           # Orquesta 7 queries del business view con Promise.all + cache + patchedRef race condition fix
│   ├── useBusinessDataCache.ts      # Cache client-side para datos del business view (5 min TTL) + patchBusinessCache
│   ├── useColorMode.ts              # Hook for dark/light mode toggle (consumes ColorModeContext)
│   ├── useListFilters.ts            # Filtrado generico: busqueda (debounced), categoria, estrellas, ordenamiento
│   ├── usePaginatedQuery.ts         # Paginacion generica con cursores Firestore + cache primera pagina (2 min TTL)
│   ├── usePriceLevelFilter.ts       # Cache global de promedios de precio para filtro de mapa
│   ├── useVisitHistory.ts           # Historial de visitas en localStorage (ultimos 20)
│   ├── useUserLocation.ts           # Geolocalizacion del navegador
│   └── usePublicMetrics.ts          # Hook para metricas publicas de dailyMetrics
├── utils/
│   ├── businessHelpers.ts           # getBusinessName, getTagLabel (compartidos)
│   └── formatDate.ts                # toDate, formatDateShort, formatDateMedium, formatDateFull (compartidos)
├── pages/
│   ├── AdminDashboard.tsx           # Entry point admin (AdminGuard + AdminLayout)
│   └── ThemePlayground.tsx          # Dev-only color playground with palette generator + output
├── components/
│   ├── admin/
│   │   ├── AdminGuard.tsx           # Google Sign-In + verificacion email
│   │   ├── AdminLayout.tsx          # AppBar + Tabs (9 secciones)
│   │   ├── AdminPanelWrapper.tsx    # Wrapper compartido loading/error/empty para paneles admin
│   │   ├── DashboardOverview.tsx    # StatCards + PieCharts + TopLists + Custom Tags ranking
│   │   ├── ActivityFeed.tsx         # Tabs por coleccion (ultimos 20 items)
│   │   ├── FeedbackList.tsx         # Tabla de feedback con categoria y flagged
│   │   ├── TrendsPanel.tsx          # Graficos evolucion + selector dia/semana/mes/ano
│   │   ├── UsersPanel.tsx           # Rankings por usuario (comments, ratings, favs, tags, feedback)
│   │   ├── FirebaseUsage.tsx        # LineCharts + PieCharts + barras de cuota
│   │   ├── AbuseAlerts.tsx          # Tabla de abuse logs
│   │   ├── BackupsPanel.tsx         # Gestion de backups Firestore (orquestacion)
│   │   ├── BackupTable.tsx          # Tabla de backups (memoizada con React.memo)
│   │   ├── BackupConfirmDialog.tsx  # Dialog de confirmacion restore/delete (memoizado)
│   │   ├── PhotoReviewPanel.tsx     # Panel admin: filtro por status, lista de fotos
│   │   ├── PhotoReviewCard.tsx      # Card individual: approve/reject/delete + revert actions + report count
│   │   ├── backupTypes.ts           # Tipos: BackupEntry, ConfirmAction
│   │   ├── backupUtils.ts           # formatBackupDate, extractErrorMessage, mapErrorToUserMessage
│   │   ├── StatCard.tsx             # Card con numero grande
│   │   ├── ActivityTable.tsx        # Tabla generica
│   │   └── charts/
│   │       └── LineChartCard.tsx    # Wrapper recharts line (click legend toggle)
│   ├── stats/                       # Componentes compartidos de estadisticas
│   │   ├── PieChartCard.tsx         # Wrapper recharts pie (compartido admin + publico)
│   │   ├── TopList.tsx              # Tabla con barras de progreso, auto-sort descendente
│   │   └── index.ts                 # Barrel export
│   ├── auth/
│   │   └── NameDialog.tsx
│   ├── layout/
│   │   ├── AppShell.tsx
│   │   ├── ErrorBoundary.tsx
│   │   └── SideMenu.tsx
│   ├── map/
│   │   ├── MapView.tsx
│   │   ├── BusinessMarker.tsx
│   │   └── LocationFAB.tsx
│   ├── search/
│   │   ├── SearchBar.tsx
│   │   └── FilterChips.tsx
│   ├── business/
│   │   ├── BusinessSheet.tsx        # Bottom sheet — orquesta useBusinessData + pasa props
│   │   ├── BusinessHeader.tsx       # Nombre, categoria, direccion, telefono, favorito (prop), direcciones
│   │   ├── BusinessRating.tsx       # Rating promedio + estrellas del usuario (props-driven)
│   │   ├── BusinessTags.tsx         # Tags predefinidos (voto) + custom tags (orquestacion, props-driven)
│   │   ├── CustomTagDialog.tsx      # Dialog crear/editar custom tag (memoizado)
│   │   ├── DeleteTagDialog.tsx      # Dialog confirmacion eliminacion tag (memoizado)
│   │   ├── BusinessComments.tsx     # Comentarios + formulario + editar + undo delete + likes + sorting (props-driven)
│   │   ├── BusinessPriceLevel.tsx    # Nivel de gasto $/$$/$$$ con optimistic UI (pendingLevel + key remount)
│   │   ├── MenuPhotoSection.tsx     # Foto de menu: preview, staleness chip, upload/viewer toggle
│   │   ├── MenuPhotoUpload.tsx      # Dialog upload con preview, progress, AbortController cancel
│   │   ├── MenuPhotoViewer.tsx      # Dialog fullscreen foto + report button
│   │   ├── FavoriteButton.tsx       # Corazon toggle (props-driven)
│   │   ├── ShareButton.tsx          # Compartir comercio (Web Share API + clipboard fallback)
│   │   └── DirectionsButton.tsx     # Abre Google Maps Directions
│   ├── ui/
│   │   ├── OfflineIndicator.tsx     # Chip MUI offline (PWA)
│   │   └── OfflineIndicator.test.tsx
│   └── menu/
│       ├── FavoritesList.tsx
│       ├── CommentsList.tsx
│       ├── RatingsList.tsx
│       ├── RecentVisits.tsx         # Lista de comercios visitados recientemente (localStorage)
│       ├── FeedbackForm.tsx
│       ├── StatsView.tsx            # Vista publica de estadisticas (usePublicMetrics)
│       └── ListFilters.tsx
```

### Otros archivos clave

| Archivo | Descripcion |
|---------|-------------|
| `firestore.rules` | Reglas de seguridad: auth, ownership, admin (email check), timestamps server-side |
| `firebase.json` | Config de hosting (CSP), functions, emuladores, reglas |
| `.firebaserc` | Proyecto: `modo-mapa-app` |
| `vite.config.ts` | Plugin React + VitePWA + Sentry + `__APP_VERSION__` desde package.json |
| `src/config/sentry.ts` | Inicializacion condicional de Sentry (frontend) |
| `functions/src/utils/sentry.ts` | Inicializacion + captureException de Sentry (Cloud Functions) |
| `firestore.indexes.json` | Indices compuestos Firestore (comments, ratings, favorites por userId+timestamp) |
| `.github/workflows/deploy.yml` | CI/CD: build + deploy Firestore rules/indexes + hosting en push a main |
| `.github/workflows/preview.yml` | CI: lint + test + build + deploy preview channel en PRs |
| `PROCEDURES.md` | Flujo de desarrollo (PRD -> specs -> plan -> implementar) |
| `.env.example` | Template de variables de entorno |
| `functions/.env` | Variables de entorno de Cloud Functions (ADMIN_EMAIL) |
| `docs/CODING_STANDARDS.md` | Estandares de codigo: service layer, patrones de componentes, convenciones TS |
| `docs/SECURITY_GUIDELINES.md` | Guia de seguridad: App Check, timestamps, converters, patrones |
| `docs/INFORME_SEGURIDAD.md` | Informe de auditoria de seguridad |
| `docs/INFORME_MEJORAS.md` | Informe de mejoras pendientes y resueltas |
| `docs/reports/security-audit-v1.4.md` | Auditoria de seguridad v1.4 |
| `docs/reports/architecture-audit-v1.4.md` | Auditoria de arquitectura v1.4 |

---

## Service layer (`src/services/`)

Capa de abstraccion entre componentes y Firestore. Los componentes nunca importan `firebase/firestore` directamente para escrituras.

| Modulo | Coleccion | Operaciones |
|--------|-----------|-------------|
| `favorites.ts` | `favorites` | `addFavorite`, `removeFavorite`, `getFavoritesCollection` |
| `ratings.ts` | `ratings` | `upsertRating`, `getRatingsCollection` |
| `comments.ts` | `comments`, `commentLikes` | `addComment`, `editComment`, `deleteComment`, `likeComment`, `unlikeComment`, `getCommentsCollection` |
| `tags.ts` | `userTags`, `customTags` | `addUserTag`, `removeUserTag`, `createCustomTag`, `updateCustomTag`, `deleteCustomTag` |
| `feedback.ts` | `feedback` | `sendFeedback` |
| `admin.ts` | Todas (read-only) | `fetchCounters`, `fetchRecent*` (6 colecciones), `fetchAllCustomTags`, `fetchUsersPanelData`, `fetchDailyMetrics`, `fetchAbuseLogs` |
| `index.ts` | — | Barrel export de todas las operaciones CRUD |

**Reglas del service layer:**

- Las funciones son `async` planas, no hooks.
- Aceptan parametros primitivos (userId, businessId, etc.), no objetos Firebase.
- **Validan entrada** como primera linea de defensa (defense in depth): longitudes, rangos, whitelists.
- Invalidan caches internamente (`invalidateQueryCache`, `invalidateBusinessCache`).
- Los errores propagan al componente que llama.
- Usan tipos estrictos (`FeedbackCategory`, `PredefinedTagId`) en vez de `string` generico.

---

## Hooks compartidos

| Hook | Descripcion |
|------|-------------|
| `useAsyncData<T>` | Hook generico para fetch async. Retorna `{ data, loading, error }`. Usado por todos los paneles admin via `AdminPanelWrapper`. |
| `useBusinessData` | Orquesta 5 queries Firestore del business view con `Promise.all` + cache (5 min TTL). Tambien fetchea user likes por comentario. |
| `useBusinessDataCache` | Cache module-level (`Map`) para datos del business view. TTL 5 min. Se invalida en cada write. Soporta `patchBusinessCache` para updates parciales. |
| `useColorMode` | Hook para dark/light mode. Consume `ColorModeContext`. Retorna `{ mode, toggleColorMode }`. |
| `useBusinesses` | Filtra `businesses.json` por searchQuery + activeFilters con `useDeferredValue`. |
| `useListFilters<T>` | Filtrado generico: busqueda (debounced), categoria, estrellas, ordenamiento. Usado en FavoritesList y RatingsList. |
| `usePaginatedQuery<T>` | Paginacion generica con cursores Firestore + cache primera pagina (2 min TTL). Exporta `invalidateQueryCache()`. |
| `useUserLocation` | Geolocalizacion del navegador. |
| `usePublicMetrics` | Hook para metricas publicas de dailyMetrics (estadisticas en menu lateral). |

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

---

## Colecciones Firestore

| Coleccion | Doc ID | Campos | Reglas |
|-----------|--------|--------|--------|
| `users` | `{userId}` | displayName, createdAt | R/W owner; admin read |
| `favorites` | `{userId}__{businessId}` | userId, businessId, createdAt | Read auth; create/delete owner |
| `ratings` | `{userId}__{businessId}` | userId, businessId, score (1-5), createdAt, updatedAt | Read auth; create/update owner, score 1-5 |
| `comments` | auto-generated | userId, userName, businessId, text (1-500), createdAt, updatedAt?, likeCount, flagged? | Read auth; create owner; update owner (text+updatedAt only); delete owner |
| `commentLikes` | `{userId}__{commentId}` | userId, commentId, createdAt | Read auth; create/delete owner |
| `userTags` | `{userId}__{businessId}__{tagId}` | userId, businessId, tagId, createdAt | Read auth; create/delete owner |
| `customTags` | auto-generated | userId, businessId, label (1-30), createdAt | Read auth; create/update/delete owner |
| `feedback` | auto-generated | userId, message (1-1000), category (bug/sugerencia/otro), createdAt, flagged? | Create auth+owner; read/delete owner; admin read |
| `config` | `counters`, `moderation` | counters: totales + daily reads/writes/deletes; moderation: bannedWords | Admin read; Functions write |
| `dailyMetrics` | `YYYY-MM-DD` | ratingDistribution, tops, activeUsers, daily ops, byCollection | Auth read; Functions write |
| `abuseLogs` | auto-generated | userId, type, collection, detail, timestamp | Admin read; Functions write |
| `menuPhotos` | auto-generated | userId, businessId, storagePath, thumbnailPath, status (pending/approved/rejected), rejectionReason?, reviewedBy?, reviewedAt?, createdAt, reportCount | Read auth; create owner (pending only); update/delete: Functions only |
| `priceLevels` | `{userId}__{businessId}` | userId, businessId, level (1-3), createdAt, updatedAt | Read auth; create/update owner, level 1-3 |
| `_rateLimits` | `backup_{userId}` | count, resetAt | No client access; Functions write (admin SDK) |

---

## Tipos principales

```typescript
// Business (datos estaticos del JSON)
interface Business {
  id: string;             // "biz_001"
  name: string;           // "La Parrilla de Juan"
  address: string;        // "Av. Corrientes 1234, CABA"
  category: BusinessCategory;
  lat: number;
  lng: number;
  tags: string[];         // ["barato", "buena_atencion"]
  phone: string | null;
}

type BusinessCategory = 'restaurant' | 'cafe' | 'bakery' | 'bar' | 'fastfood' | 'icecream' | 'pizza';

// Tags predefinidos (6)
PREDEFINED_TAGS: barato, apto_celiacos, apto_veganos, rapido, delivery, buena_atencion

// Categorias con labels en espanol (7)
CATEGORY_LABELS: restaurant→Restaurante, cafe→Cafe, bakery→Panaderia, bar→Bar,
                 fastfood→Comida rapida, icecream→Heladeria, pizza→Pizzeria

// Menu Photos & Price Levels
type MenuPhotoStatus = 'pending' | 'approved' | 'rejected';
interface MenuPhoto { id, userId, businessId, storagePath, thumbnailPath, status, rejectionReason?, reviewedBy?, reviewedAt?, createdAt, reportCount }
interface PriceLevel { userId, businessId, level (1-3), createdAt, updatedAt }
PRICE_LEVEL_LABELS: 1→Economico, 2→Moderado, 3→Caro

// Admin types
interface AdminCounters { comments, ratings, favorites, feedback, users, customTags, userTags, commentLikes, priceLevels, menuPhotos, dailyReads, dailyWrites, dailyDeletes }
interface DailyMetrics { date, ratingDistribution, topFavorited, topCommented, topRated, topTags, dailyReads/Writes/Deletes, byCollection, activeUsers }
interface AbuseLog { id, userId, type, collection, detail, timestamp }
```

---

## Variables de entorno

### Frontend (`/.env`)

```bash
VITE_GOOGLE_MAPS_API_KEY=       # API key de Google Maps
VITE_GOOGLE_MAPS_MAP_ID=        # Map ID para estilos
VITE_FIREBASE_API_KEY=           # Firebase web API key
VITE_FIREBASE_AUTH_DOMAIN=       # *.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=        # modo-mapa-app
VITE_FIREBASE_STORAGE_BUCKET=    # *.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=

# App Check con reCAPTCHA Enterprise (ver docs/SECURITY_GUIDELINES.md)
VITE_RECAPTCHA_ENTERPRISE_SITE_KEY=
```

### Cloud Functions (`functions/.env`)

```bash
ADMIN_EMAIL=benoffi11@gmail.com  # Email del admin (usado por defineString en backups.ts)
```

En CI/CD se inyectan como GitHub Secrets.

---

## Seguridad

### App Check

- **Obligatorio en Cloud Functions (prod)**: todas las funciones callable usan `enforceAppCheck: !IS_EMULATOR` — habilitado en prod, deshabilitado en emuladores.
- **Frontend**: se inicializa con `ReCaptchaEnterpriseProvider` solo en produccion (`VITE_RECAPTCHA_ENTERPRISE_SITE_KEY`).
- **Emuladores**: no requieren App Check (`IS_EMULATOR = process.env.FUNCTIONS_EMULATOR === 'true'`).

### Firestore rules

- **Auth requerida**: todas las colecciones requieren `request.auth != null`.
- **Ownership**: escrituras validan `request.resource.data.userId == request.auth.uid`.
- **Timestamps server-side**: todas las reglas de `create` validan `createdAt == request.time`.
- **Validacion de campos**: longitudes maximas (displayName 30, text 500, message 1000, label 30), score 1-5.
- **Admin check**: `isAdmin()` verifica `request.auth.token.email == 'benoffi11@gmail.com'`.
- **Metricas publicas**: `dailyMetrics` es legible por cualquier usuario autenticado (estadisticas publicas).

### Cloud Functions — seguridad

- **Verificacion de admin**: email + `email_verified` + comparacion con `ADMIN_EMAIL` parametrizado.
- **Rate limiting**: 5 llamadas por minuto por usuario (Firestore-backed, persiste entre cold starts).
- **Validacion de input**: `validateBackupId` rechaza caracteres invalidos con regex `^[\w.-]+$`.
- **Logging seguro**: `maskEmail()` enmascara emails en logs (`ben***@gmail.com`).
- **Manejo de errores**: errores de permisos y not-found se mapean a `HttpsError` apropiados.

### Content Security Policy (CSP)

Configurado en `firebase.json` headers:

- `connect-src`: incluye `*.cloudfunctions.net` para llamadas a Cloud Functions
- `script-src`: incluye `*.googleapis.com`, `apis.google.com`, `www.google.com`, `www.gstatic.com`
- `frame-src`: incluye `*.firebaseapp.com`, `www.google.com`

---

## Cloud Storage — Backups

### Bucket

- **Nombre**: `modo-mapa-app-backups`
- **Region**: `southamerica-east1`
- **Estructura**: `gs://modo-mapa-app-backups/backups/{timestamp}/`
- **Formato timestamp**: ISO 8601 con `:` y `.` reemplazados por `-` (ej: `2026-03-12T14-30-00-000Z`)

### Lifecycle policy

- **Retencion**: 90 dias. Los backups mas antiguos se eliminan automaticamente via lifecycle rule del bucket.
- **Eliminacion manual**: disponible via `deleteBackup` Cloud Function.

### Backups de seguridad pre-restore

Antes de cada restore, se crea automaticamente un backup con prefijo `pre-restore-` para poder revertir si algo sale mal.

---

## Tema visual

- **Primary:** #1a73e8 (Google Blue)
- **Secondary:** #ea4335 (Google Red)
- **Light mode:** bg #ffffff, text #202124 / #5f6368
- **Dark mode:** bg #121212, paper #1e1e1e, text #e8eaed / #9aa0a6
- **Fuente:** Roboto
- **Border radius:** 8px (general), 16px (chips)
- **Estilo:** inspirado en Google Maps
- **Toggle:** Switch en menu lateral, persiste en localStorage, respeta `prefers-color-scheme`
- **Playground:** `/dev/theme` (solo DEV) — color pickers, palette generator, component preview, copyable output

---

## Scripts

| Comando | Descripcion |
|---------|-------------|
| `npm run dev` | Vite dev server (sin emuladores) |
| `npm run dev:full` | Dev + emuladores Firebase (auth, firestore, functions) |
| `npm run emulators` | Solo emuladores (Auth :9099, Firestore :8080, Functions :5001, Storage :9199, UI :4000) |
| `npm run build` | tsc + vite build -> `dist/` |
| `npm run lint` | ESLint check |
| `npm run preview` | Preview del build de produccion |
| `npm run test` | Vitest watch mode |
| `npm run test:run` | Vitest single run |
| `npm run seed` | Poblar emulador Firestore con datos de prueba (requiere emuladores corriendo) |
| `npm run analyze` | Build + genera `dist/stats.html` con analisis del bundle |
| `scripts/dev-env.sh` | Gestion de entorno dev: status, start, stop, restart, seed, health, logs. Auto-seed al iniciar. |

---

## CI/CD

**GitHub Actions** (`.github/workflows/deploy.yml`):

1. Trigger: push a `main`
2. Setup: Node 22 + npm cache
3. `npm audit --audit-level=high` (continue-on-error)
4. `npm run lint`
5. `npm run test:run`
6. `npm run build` con secrets como env vars
7. Auth: `google-github-actions/auth@v2` con service account
8. Deploy Firestore rules + indexes: `firebase deploy --only firestore:rules,firestore:indexes`
9. Deploy Cloud Functions: `cd functions && npm ci && firebase deploy --only functions`
10. Deploy Hosting: Firebase Hosting (canal `live`) via `FirebaseExtended/action-hosting-deploy@v0`

**Todo se despliega automaticamente** en cada push a main: hosting, Firestore rules/indexes, y Cloud Functions.

**IAM roles requeridos** para el service account de CI/CD:

- `roles/serviceusage.serviceUsageConsumer` — para invocar APIs de Firebase
- `roles/firebase.admin` — para deploy de rules/indexes

**IAM roles requeridos** para el service account de Cloud Functions (`591435782056-compute@developer.gserviceaccount.com`):

- `roles/datastore.importExportAdmin` — para backup export/import Firestore
- `roles/storage.admin` — para listar/escribir/eliminar backups en GCS

**Flujo de feature:**

1. Crear issue en GitHub
2. Branch: `feat/<N>-<descripcion>` o `fix/<N>-<descripcion>`
3. PRD -> specs -> plan -> implementar (ver `PROCEDURES.md`)
4. Test local con `npm run dev`
5. Commit con referencia al issue
6. PR con resumen y test plan
7. Merge a main -> deploy automatico

---

## Versionado

- Version en `package.json` -> expuesta via `__APP_VERSION__` (Vite define) -> mostrada en footer del menu lateral.
- Cada 10 issues se incrementa el numero mayor (1.x -> 2.0).
- Formato: `MAJOR.MINOR.PATCH` donde MINOR se incrementa por feature/fix.

---

## Patrones y convenciones

| Patron | Descripcion |
|--------|-------------|
| **Auth anonima + Google Sign-In** | Usuarios normales se autentican anonimamente. Admin usa Google Sign-In solo en `/admin`. |
| **Admin guard (2 capas)** | Frontend: `AdminGuard` verifica `user.email === 'benoffi11@gmail.com'`. Server: Firestore rules con `request.auth.token.email`. |
| **Doc ID compuesto** | `{userId}__{businessId}` para favoritos, ratings y userTags. `{userId}__{commentId}` para commentLikes. Garantiza unicidad sin queries extra. |
| **Service layer** | Componentes llaman `src/services/` para CRUD. Nunca importan `firebase/firestore` directamente para escrituras. |
| **Datos estaticos + dinamicos** | Comercios en JSON local, interacciones en Firestore. Se cruzan por `businessId` client-side. |
| **Optimistic UI** | Comentarios se agregan al state local antes de que Firestore confirme. Likes usan Maps para toggle state + delta count. |
| **Undo delete** | Comentarios se eliminan con undo (5s timer + Snackbar). Usado en BusinessComments y CommentsList. |
| **Deep linking** | `?business={id}` en URL abre el bottom sheet del comercio. Usado por ShareButton. |
| **Rate limiting (3 capas)** | Client-side (UI) + server-side (Cloud Functions triggers) + Cloud Functions callable (Firestore-backed, 5/min/user). |
| **Moderacion de contenido** | Cloud Functions filtran texto con lista de banned words (configurable en `config/moderation`). |
| **Counters server-side** | Cloud Functions triggers actualizan `config/counters` atomicamente con `FieldValue.increment`. |
| **Metricas diarias** | Scheduled function calcula distribucion, tops, active users a las 3AM y guarda en `dailyMetrics/{YYYY-MM-DD}`. |
| **Admin panel pattern** | Todos los paneles admin usan `useAsyncData` + `AdminPanelWrapper` para estados loading/error. |
| **Component remount via key** | `feedbackKey` en SideMenu fuerza remount del FeedbackForm. `key={businessId}` en BusinessPriceLevel para reset de `pendingLevel`. |
| **patchedRef race condition fix** | En `useBusinessData`, `patchedRef` trackea colecciones actualizadas por refetches parciales. Al completar full load, preserva esas colecciones del state actual. |
| **AbortController for uploads** | `MenuPhotoUpload` usa `AbortController` para cancelar compression + Storage upload. Cancel siempre habilitado. |
| **Photo reporting** | Usuarios reportan fotos via `reportMenuPhoto` callable. Subcollection `reports` bajo cada foto previene duplicados. `reportCount` incrementado atomicamente. |
| **`component="span"`** | En MUI `ListItemText` secondary, para evitar `<p>` dentro de `<p>`. Se usa `display: block` en spans. |
| **import type** | Obligatorio por `verbatimModuleSyntax: true` en tsconfig. |
| **Hook generico de filtros** | `useListFilters<T>` acepta cualquier item con `business` asociado. Reutilizado en favoritos y ratings. |
| **Emuladores en DEV** | `firebase.ts` conecta a emuladores solo en `import.meta.env.DEV`. |
| **App Check (prod + functions)** | Firebase App Check con reCAPTCHA Enterprise en frontend. `enforceAppCheck: !IS_EMULATOR` en todas las Cloud Functions callable. |
| **withConverter\<T\>()** | Todas las lecturas de Firestore usan `withConverter<T>()` con converters centralizados. Escrituras usan refs sin converter (por `serverTimestamp()`). |
| **Timestamps server-side** | Todas las reglas de `create` validan `createdAt == request.time`. Ratings valida `updatedAt == request.time` en create y update. |
| **Collection names** | Nombres de colecciones centralizados en `src/config/collections.ts` como constantes. Sin strings magicos. |
| **ErrorBoundary** | Envuelve `AppShell` y `AdminDashboard`. Fallback UI con opcion de recargar. |
| **usePaginatedQuery** | Hook generico para paginacion con cursores Firestore. Usado en FavoritesList, CommentsList, RatingsList. Boton "Cargar mas". |
| **Debounce con useDeferredValue** | `useBusinesses` y `useListFilters` usan `useDeferredValue` de React 19 para debounce de busqueda. |
| **Pre-commit hooks** | `husky` + `lint-staged` ejecuta ESLint en archivos `.ts/.tsx` staged antes de cada commit. |
| **exactOptionalPropertyTypes** | Habilitado en tsconfig. Propiedades opcionales requieren `\| undefined` explicito para asignar `undefined`. |
| **Markdown lint** | Archivos `.md` deben cumplir markdownlint (`.markdownlint.json`). Reglas clave: blank lines around headings/lists/fences, language en code blocks. |
| **Lazy loading admin** | `/admin` usa `lazy()` + `Suspense`. No carga MapProvider/APIProvider. |
| **Firestore persistent cache (prod)** | En produccion se usa `initializeFirestore` con `persistentLocalCache` + `persistentMultipleTabManager` para cachear datos en IndexedDB. |
| **Business data cache** | `useBusinessDataCache.ts` — cache module-level (`Map`) con TTL de 5 min para las 5 queries del business view. Se invalida en cada write. |
| **First-page query cache** | `usePaginatedQuery.ts` exporta `invalidateQueryCache()`. Cache module-level (`Map`) con TTL de 2 min para la primera pagina de listas paginadas. |
| **Props-driven business components** | BusinessRating, BusinessComments, BusinessTags y FavoriteButton reciben datos como props desde BusinessSheet (via `useBusinessData`). No hacen queries internas. |
| **Parallel query batching** | `useBusinessData` ejecuta las 5 queries de Firestore del business view en un solo `Promise.all` para reducir latencia y facilitar cache. |
| **Selective refetch** | `refetch(collectionName)` recarga solo la coleccion afectada (1 query) en vez de las 5. `patchBusinessCache` mergea updates parciales en cache. |
| **Optimistic UI (rating)** | `BusinessRating` usa `pendingRating` state para mostrar estrellas inmediatamente mientras el server confirma. |
| **Dark mode** | `ColorModeContext` + `useColorMode` hook. Persiste en `localStorage`, respeta `prefers-color-scheme`. Toggle en SideMenu footer. |
| **Theme playground (DEV)** | `/dev/theme` — palette generator, side-by-side light/dark preview, sticky output panel. Solo en `import.meta.env.DEV`. |
| **Shared date utils** | `src/utils/formatDate.ts` centraliza `toDate`, `formatDateShort`, `formatDateMedium`, `formatDateFull`. Reemplaza duplicados en paneles admin y converters. |

---

## Issues resueltos

| Issue | Tipo | Titulo | PR | Estado | Docs |
|-------|------|--------|----|--------|------|
| [#1](https://github.com/benoffi7/modo-mapa/issues/1) | fix | Google Maps: error de carga y warning de Map ID faltante | [#2](https://github.com/benoffi7/modo-mapa/pull/2) | Merged | — |
| [#3](https://github.com/benoffi7/modo-mapa/issues/3) | fix | Comentarios no aparecen despues de enviar | [#4](https://github.com/benoffi7/modo-mapa/pull/4) | Merged | — |
| [#5](https://github.com/benoffi7/modo-mapa/issues/5) | feat | Etiquetas personalizadas por usuario | [#6](https://github.com/benoffi7/modo-mapa/pull/6) | Merged | `docs/feat-custom-user-tags/` |
| [#7](https://github.com/benoffi7/modo-mapa/issues/7) | feat | Menu lateral con seccion Favoritos | [#8](https://github.com/benoffi7/modo-mapa/pull/8) | Merged | `docs/feat-menu-favoritos/` |
| [#9](https://github.com/benoffi7/modo-mapa/issues/9) | feat | Seccion Comentarios en menu lateral | [#10](https://github.com/benoffi7/modo-mapa/pull/10) | Merged | `docs/feat-menu-comentarios/` |
| [#11](https://github.com/benoffi7/modo-mapa/issues/11) | feat | Feedback, Ratings, Agregar comercio, Version, Filtros | [#12](https://github.com/benoffi7/modo-mapa/pull/12) | Merged | `docs/feat-menu-feedback-ratings-version/` |
| [#13](https://github.com/benoffi7/modo-mapa/issues/13) | fix | customTags read rule demasiado restrictiva | [#14](https://github.com/benoffi7/modo-mapa/pull/14) | Merged | — |
| [#15](https://github.com/benoffi7/modo-mapa/issues/15) | security | Auditoria de seguridad — hallazgos iniciales | [#16](https://github.com/benoffi7/modo-mapa/pull/16) | Merged | — |
| [#17](https://github.com/benoffi7/modo-mapa/issues/17) | feat | Agregar edicion de comentarios | — | Closed (via #45) | — |
| — | security | Resolver hallazgos pendientes: App Check, timestamps, converters | [#18](https://github.com/benoffi7/modo-mapa/pull/18) | Merged | — |
| — | chore | Resolver mejoras tecnicas: debounce, tests, paginacion, husky, bundle analysis, strictTypes | [#20](https://github.com/benoffi7/modo-mapa/pull/20) | Merged | — |
| [#19](https://github.com/benoffi7/modo-mapa/issues/19) | fix | Fix CSP policy, tags auth guard, lint errors | [#22](https://github.com/benoffi7/modo-mapa/pull/22) | Merged | `docs/fix-csp-and-tags-permissions/` |
| — | feat | Security hardening: Cloud Functions, admin dashboard, rate limiting, moderation | [#27](https://github.com/benoffi7/modo-mapa/pull/27) | Merged | `docs/feat-security-hardening/` |
| [#24](https://github.com/benoffi7/modo-mapa/issues/24) | feat | Firebase quota mitigations: offline persistence, business view cache, paginated query cache | [#26](https://github.com/benoffi7/modo-mapa/pull/26) | Merged | `docs/feat-firebase-quota-offline/` |
| [#28](https://github.com/benoffi7/modo-mapa/issues/28) | feat | Modularizar componentes de estadisticas + seccion publica | [#32](https://github.com/benoffi7/modo-mapa/pull/32) | Merged | `docs/feat-modularizar-stats/` |
| [#31](https://github.com/benoffi7/modo-mapa/issues/31) | fix | Admin login popup se cierra automaticamente | [#33](https://github.com/benoffi7/modo-mapa/pull/33) | Merged | — |
| [#34](https://github.com/benoffi7/modo-mapa/issues/34) | feat | Gestion de backups de Firestore desde /admin | [#35](https://github.com/benoffi7/modo-mapa/pull/35) | Merged | `docs/feat-admin-backups/` |
| [#25](https://github.com/benoffi7/modo-mapa/issues/25) | feat | PWA + offline mode | [#40](https://github.com/benoffi7/modo-mapa/pull/40) | Merged | — |
| [#37](https://github.com/benoffi7/modo-mapa/issues/37) | feat | Migrar a React Router | [#40](https://github.com/benoffi7/modo-mapa/pull/40) | Merged | — |
| [#38](https://github.com/benoffi7/modo-mapa/issues/38) | feat | Preview environments para PRs | [#40](https://github.com/benoffi7/modo-mapa/pull/40) | Merged | — |
| [#39](https://github.com/benoffi7/modo-mapa/issues/39) | feat | Sentry error tracking | [#40](https://github.com/benoffi7/modo-mapa/pull/40) | Merged | — |
| [#41](https://github.com/benoffi7/modo-mapa/issues/41) | fix | Tags reload on any action + rating flicker | [#42](https://github.com/benoffi7/modo-mapa/pull/42) | Merged | — |
| [#43](https://github.com/benoffi7/modo-mapa/issues/43) | feat | Dark mode + theme playground | — | Open | — |
| [#45](https://github.com/benoffi7/modo-mapa/issues/45) | feat | Comentarios 2.0: editar, undo delete, likes, sorting | — | Open | `docs/feat-comments-2.0/` |
| [#46](https://github.com/benoffi7/modo-mapa/issues/46) | feat | Compartir comercio (share + deep link) | — | Open | `docs/feat-comments-2.0/` |
| [#48](https://github.com/benoffi7/modo-mapa/issues/48) | feat | Fotos de menu: upload, review, report, admin lifecycle | [#51](https://github.com/benoffi7/modo-mapa/pull/51) | Merged | `docs/feat-menu-photos-history/` |
| [#49](https://github.com/benoffi7/modo-mapa/issues/49) | feat | Historial de visitas recientes (localStorage) | [#51](https://github.com/benoffi7/modo-mapa/pull/51) | Merged | `docs/feat-menu-photos-history/` |
| [#50](https://github.com/benoffi7/modo-mapa/issues/50) | feat | Nivel de gasto ($/$$/$$) con filtro en mapa | [#51](https://github.com/benoffi7/modo-mapa/pull/51) | Merged | `docs/feat-menu-photos-history/` |

---

## Documentacion por feature

Cada feature tiene su carpeta en `docs/<tipo>-<descripcion>/` con:

| Archivo | Contenido |
|---------|-----------|
| `prd.md` | Requisitos del producto |
| `specs.md` | Especificaciones tecnicas (interfaces, props, logica) |
| `plan.md` | Plan de implementacion paso a paso |
| `changelog.md` | Archivos creados y modificados |

Documentacion adicional:

| Archivo | Contenido |
|---------|-----------|
| `docs/CODING_STANDARDS.md` | Estandares de codigo, service layer, patrones de componentes, convenciones TS, SOLID |
| `docs/reports/security-audit-v1.4.md` | Auditoria de seguridad v1.4 |
| `docs/reports/architecture-audit-v1.4.md` | Auditoria de arquitectura v1.4 |

---

## Funcionalidades actuales

### Mapa

- Google Maps centrado en Buenos Aires (-34.6037, -58.3816)
- 40 marcadores con color por categoria
- Click en marker abre bottom sheet con detalle
- Geolocalizacion del usuario (FAB)
- Busqueda por nombre/direccion/categoria
- Filtro por tags predefinidos (chips)

### Comercio (BusinessSheet)

- Nombre, categoria, direccion, telefono (link tel:)
- Boton favorito (toggle corazon)
- Boton direcciones (abre Google Maps)
- Rating: promedio + estrellas del usuario (1-5)
- Tags predefinidos: vote count + toggle del usuario
- Tags custom: crear, editar, eliminar (privados por usuario)
- Comentarios: lista + formulario + editar propios + undo delete + likes (otros) + sorting (Recientes/Antiguos/Utiles). Flaggeados ocultos. Indicador "(editado)"
- Compartir: boton share (Web Share API con fallback a clipboard). Deep link via `?business={id}`
- Nivel de gasto: $/$$/$$$ con votos y promedio. Optimistic UI con `pendingLevel` + `key={businessId}` remount
- Foto de menu: preview con staleness chip (>6 meses), upload con compression + cancel, viewer fullscreen con report
- Datos cargados en paralelo (`Promise.all`) con cache client-side (5 min TTL). Race condition fix con `patchedRef`
- Escrituras via service layer (`src/services/`)

### Menu lateral (SideMenu)

- Header con avatar, nombre, boton editar nombre
- Secciones:
  - **Recientes**: ultimos 20 comercios visitados (localStorage). Click navega al comercio.
  - **Favoritos**: lista con filtros (busqueda, categoria, orden). Quitar favorito inline. Click navega al comercio.
  - **Comentarios**: lista con texto truncado. Eliminar con undo (5s). Click navega al comercio.
  - **Calificaciones**: lista con estrellas y filtros (busqueda, categoria, estrellas minimas, orden). Click navega al comercio.
  - **Feedback**: formulario con categoria (bug/sugerencia/otro) + mensaje (max 1000). Estado de exito.
  - **Estadisticas**: distribucion de ratings (pie), tags mas usados (pie), top 10 favoriteados/comentados/calificados. Usa `usePublicMetrics` + componentes de `stats/`.
  - **Agregar comercio**: link externo a Google Forms.
- Dark mode toggle con switch (persiste en localStorage, respeta `prefers-color-scheme`)
- Footer con version de la app (+ link a Theme Playground en DEV)

### Dashboard Admin (/admin)

- Login con Google Sign-In (solo `benoffi11@gmail.com`)
- Verificacion en frontend (AdminGuard) y server-side (Firestore rules)
- 9 tabs con paneles que usan `useAsyncData` + `AdminPanelWrapper`:
  - **Overview**: totales (comercios, usuarios, comentarios, ratings, favoritos, feedback), distribucion de ratings (pie), tags mas usados (pie), top 10 comercios, custom tags candidatas a promover
  - **Actividad**: feed por seccion (comentarios, ratings, favoritos, tags) con ultimos 20 items, indicador de flagged
  - **Feedback**: tabla de feedback recibido con categoria (bug/sugerencia/otro), mensaje, estado flagged
  - **Tendencias**: graficos de evolucion temporal con selector dia/semana/mes/ano — actividad por tipo, usuarios activos, total escrituras. Click en leyenda para mostrar/ocultar series
  - **Usuarios**: rankings top 10 por metrica (comentarios, ratings, favoritos, tags, feedback, total), stats generales (total, activos, promedio acciones)
  - **Firebase Usage**: graficos lineales de reads/writes/deletes y usuarios activos (ultimos 30 dias), pie charts por coleccion, barras de cuota vs free tier
  - **Alertas**: logs de abuso (rate limit excedido, contenido flaggeado, top writers)
  - **Backups**: crear backup manual, listar con paginacion (20 por pagina), restaurar con backup de seguridad automatico, eliminar con confirmacion. Usa Cloud Functions callable
  - **Fotos**: panel de revision de fotos de menu. Filtro por status (todas/pendientes/aprobadas/rechazadas). Acciones: aprobar, rechazar (con razon), eliminar, revertir. Badge de reportes

### Cloud Functions (server-side)

8 funciones callable + triggers + scheduled:

| Funcion | Tipo | Descripcion |
|---------|------|-------------|
| `createBackup` | callable (admin) | Firestore export -> GCS (`modo-mapa-app-backups`). Timeout 300s. |
| `listBackups` | callable (admin) | Lista prefijos en GCS con paginacion (max 100/pagina). Timeout 60s. |
| `restoreBackup` | callable (admin) | Crea backup de seguridad pre-restore + Firestore import <- GCS. Timeout 300s. |
| `deleteBackup` | callable (admin) | Elimina todos los archivos del backup en GCS. Timeout 120s. |
| `approveMenuPhoto` | callable (admin) | Aprueba foto pendiente o rechazada. Timeout 30s. |
| `rejectMenuPhoto` | callable (admin) | Rechaza foto con razon. Timeout 30s. |
| `deleteMenuPhoto` | callable (admin) | Elimina foto de Storage + Firestore. Timeout 60s. |
| `reportMenuPhoto` | callable (auth) | Reporta foto (usuario). Previene duplicados via subcollection `reports`. Timeout 30s. |

Funciones callable admin:

- Verifican admin (email + `email_verified`)
- Rate limit: 5 llamadas/minuto por usuario
- `enforceAppCheck: !IS_EMULATOR` (deshabilitado en emuladores)
- Validan input (backupId con regex `^[\w.-]+$`)
- Logging con email enmascarado

**Rate limiting server-side (triggers):** comments (20/dia), commentLikes (50/dia), customTags (10/business), feedback (5/dia).

**Moderacion de contenido:** banned words con normalizacion de acentos, word boundary matching.

**Counters atomicos:** totales por coleccion + operaciones diarias.

**Metricas diarias:** cron a las 3AM — distribucion, tops, active users, reset counters.

### Filtros reutilizables

- Hook `useListFilters<T>`: filtrado por nombre, categoria, score + ordenamiento
- Componente `ListFilters`: TextField busqueda, chips categoria, chips estrellas (opcional), Select orden, contador "N de M"
- Usado en FavoritesList y RatingsList
