# Arquitectura

## Arbol de componentes

```text
main.tsx
  └─ BrowserRouter (react-router-dom)
       └─ App.tsx
            ├─ ColorModeProvider (dark/light theme + persistence)
            ├─ AuthProvider (Firebase Auth + displayName + Google Sign-In)
            ├─ Routes
            ├─ [/dev/theme] ThemePlayground (lazy, DEV only)
            ├─ [/dev/constants] ConstantsDashboard (lazy, DEV only)
            ├─ [/admin/*] AdminDashboard (lazy loaded)
       │    ├─ AdminGuard (Google Sign-In + email verification)
       │    └─ AdminLayout (tabs: Overview, Actividad, Feedback, Tendencias, Usuarios, Firebase Usage, Alertas, Backups, Fotos)
       │         ├─ DashboardOverview (StatCards + PieCharts + TopLists + Custom Tags ranking)
       │         ├─ ActivityFeed (tabs: comentarios, ratings, favoritos, tags)
       │         ├─ FeedbackList (feedback con status filters, respond/resolve/create-issue actions)
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
                 ├─ EmailPasswordDialog (registro/login con tabs, forgot password)
                 ├─ ChangePasswordDialog (cambio de contrasena con re-auth)
                 └─ SideMenu (drawer lateral)
                      ├─ Header (avatar + nombre + editar + badge tipo cuenta + botones auth)
                      ├─ Nav (Favoritos, Recientes, Comentarios, Calificaciones, Feedback, Agregar comercio)
                      ├─ FavoritesList + ListFilters
                      ├─ RecentVisits (historial localStorage)
                      ├─ CommentsList
                      ├─ RatingsList + ListFilters
                      ├─ FeedbackForm (Tabs: Enviar / Mis envíos)
                      │    └─ MyFeedbackList (status chips, admin responses, nueva respuesta indicator)
                      ├─ HelpSection (7 Accordion topics, lazy-loaded)
                      ├─ Dark mode toggle (switch + icon)
                      └─ Footer (version + Theme/Constants links in DEV)
```

## Capas de la arquitectura

```text
Components ──► Services ──► Firestore SDK ──► Cloud Firestore
     │              │
     │              └─ config/ (firebase.ts, collections.ts, converters)
     │
     ├─ Constants (src/constants/ — valores centralizados por dominio)
     ├─ Hooks (useAsyncData, useBusinessData, usePaginatedQuery, etc.)
     ├─ Context (AuthContext, MapContext)
     └─ Utils (formatDate, businessHelpers)
```

Los componentes **nunca** importan `firebase/firestore` directamente. Usan el service layer (`src/services/`) para escrituras y collection ref getters para lecturas paginadas. Las lecturas de admin pasan por `services/admin.ts`.

## Cloud Functions

```text
functions/
├── src/
│   ├── index.ts              → exports de todas las functions
│   ├── admin/
│   │   ├── backups.ts        → createBackup, listBackups, restoreBackup, deleteBackup (callable)
│   │   ├── menuPhotos.ts     → approveMenuPhoto, rejectMenuPhoto, deleteMenuPhoto, reportMenuPhoto (callable)
│   │   └── feedback.ts       → respondToFeedback, resolveFeedback, createGithubIssueFromFeedback (callable)
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
│       ├── notifications.ts  → createNotification helper (feedback_response type, BYPASS_MASTER_TOGGLE, DEFAULT_SETTINGS)
│       └── abuseLogger.ts    → logger a coleccion abuseLogs
├── .env                       → ADMIN_EMAIL (parametrizado con defineString)
├── package.json               → Node 22, firebase-admin, firebase-functions, @google-cloud/firestore, @google-cloud/storage
├── tsconfig.json              → CommonJS, strict
└── vitest.config.ts
```

## Flujo de datos

1. **Datos estaticos**: `businesses.json` (40 comercios) se carga como import estatico. No hay fetch.
2. **Datos dinamicos**: Firestore (favoritos, ratings, comentarios, tags, feedback, priceLevels, menuPhotos). El hook `useBusinessData` orquesta las 7 queries en paralelo con `Promise.all` y cache client-side. `refetch(collectionName)` recarga selectivamente una sola coleccion sin incrementar `fetchIdRef`. `patchedRef` previene que full loads sobreescriban datos de refetches parciales.
3. **Service layer**: Componentes llaman funciones de `src/services/` para operaciones CRUD. Los servicios encapsulan Firestore SDK e invalidan caches internamente.
4. **Estado global**: `AuthContext` (user, displayName, signInWithGoogle, signOut) + `MapContext` (selectedBusiness, searchQuery, filters, activePriceFilter, userLocation).
5. **Estado local**: Cada seccion del menu carga sus datos al montarse y los filtra client-side con `useListFilters`.
6. **Cache de datos**: Dos capas de cache client-side reducen lecturas Firestore:
   - `useBusinessDataCache`: cache de vista de negocio (5 min TTL) para las 7 queries del bottom sheet.
   - `usePaginatedQuery`: cache de primera pagina (2 min TTL) para listas del menu lateral.
7. **Server-side**: Cloud Functions triggers validan rate limits, moderan contenido y actualizan counters/metricas.

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
- **Constants Dashboard:** `/dev/constants` (solo DEV) — browser de todas las constantes centralizadas, busqueda, filtro por modulo, copy import, deteccion de duplicados
