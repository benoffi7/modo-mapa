# Modo Mapa — Referencia completa del proyecto

**Version:** 1.4.0
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
| CI/CD | GitHub Actions | — |

---

## Arquitectura

```text
main.tsx
  └─ App.tsx
       ├─ ThemeProvider (MUI theme)
       ├─ AuthProvider (Firebase Auth + displayName + Google Sign-In)
       ├─ [/admin] AdminDashboard (lazy loaded)
       │    ├─ AdminGuard (Google Sign-In + email verification)
       │    └─ AdminLayout (tabs: Overview, Actividad, Feedback, Tendencias, Usuarios, Firebase Usage, Alertas, Backups)
       │         ├─ DashboardOverview (StatCards + PieCharts + TopLists + Custom Tags ranking)
       │         ├─ ActivityFeed (tabs: comentarios, ratings, favoritos, tags)
       │         ├─ FeedbackList (tabla de feedback con categoria y estado)
       │         ├─ TrendsPanel (graficos evolucion + selector dia/semana/mes/ano)
       │         ├─ UsersPanel (rankings por usuario + stats)
       │         ├─ FirebaseUsage (LineCharts + PieCharts + barras cuota)
       │         ├─ AbuseAlerts (tabla de logs de abuso)
       │         └─ BackupsPanel (crear, listar, restaurar, eliminar backups Firestore)
       └─ [/*] MapProvider + APIProvider
            └─ AppShell.tsx
                 ├─ SearchBar (busqueda + menu hamburguesa)
                 ├─ FilterChips (tags predefinidos)
                 ├─ MapView (Google Maps + markers)
                 ├─ LocationFAB (geolocalizacion)
                 ├─ BusinessSheet (bottom sheet con detalle)
                 │    ├─ BusinessHeader (nombre, direccion, favorito, direcciones)
                 │    ├─ BusinessRating (estrellas promedio + calificar)
                 │    ├─ BusinessTags (tags predefinidos + custom)
                 │    └─ BusinessComments (lista + formulario + eliminar)
                 ├─ NameDialog (nombre de usuario, primera visita)
                 └─ SideMenu (drawer lateral)
                      ├─ Header (avatar + nombre + editar)
                      ├─ Nav (Favoritos, Comentarios, Calificaciones, Feedback, Agregar comercio)
                      ├─ FavoritesList + ListFilters
                      ├─ CommentsList
                      ├─ RatingsList + ListFilters
                      ├─ FeedbackForm
                      └─ Footer (version)
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

Los componentes **nunca** importan `firebase/firestore` directamente para escrituras. Usan el service layer (`src/services/`). Las lecturas de admin tambien pasan por `services/admin.ts`.

### Cloud Functions

```text
functions/
├── src/
│   ├── index.ts              → exports de todas las functions
│   ├── admin/
│   │   └── backups.ts        → createBackup, listBackups, restoreBackup, deleteBackup (callable)
│   ├── triggers/
│   │   ├── comments.ts       → rate limit + moderacion + counters
│   │   ├── customTags.ts     → rate limit + moderacion + counters
│   │   ├── feedback.ts       → rate limit + moderacion + counters
│   │   ├── ratings.ts        → counters (create/update/delete)
│   │   ├── favorites.ts      → counters (create/delete)
│   │   └── users.ts          → counters (create)
│   ├── scheduled/
│   │   └── dailyMetrics.ts   → cron diario: distribucion, tops, active users
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
2. **Datos dinamicos**: Firestore (favoritos, ratings, comentarios, tags, feedback). El hook `useBusinessData` orquesta las 5 queries en paralelo con `Promise.all` y cache client-side.
3. **Service layer**: Componentes llaman funciones de `src/services/` para operaciones CRUD. Los servicios encapsulan Firestore SDK e invalidan caches internamente.
4. **Estado global**: `AuthContext` (user, displayName, signInWithGoogle, signOut) + `MapContext` (selectedBusiness, searchQuery, filters, userLocation).
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
│   ├── collections.ts               # Nombres de colecciones Firestore centralizados
│   ├── converters.ts                # FirestoreDataConverter<T> tipados por coleccion (incl. feedback)
│   ├── adminConverters.ts           # Converters para AdminCounters, DailyMetrics, AbuseLog
│   └── metricsConverter.ts          # Converter para PublicMetrics (solo campos publicos)
├── context/
│   ├── AuthContext.tsx               # Auth anonima + Google Sign-In + displayName
│   └── MapContext.tsx                # Estado del mapa (selected, search, filters)
├── services/
│   ├── index.ts                     # Barrel export de todas las operaciones CRUD
│   ├── favorites.ts                 # addFavorite, removeFavorite
│   ├── ratings.ts                   # upsertRating
│   ├── comments.ts                  # addComment, deleteComment
│   ├── tags.ts                      # addUserTag, removeUserTag, createCustomTag, updateCustomTag, deleteCustomTag
│   ├── feedback.ts                  # sendFeedback
│   └── admin.ts                     # fetchCounters, fetchRecent*, fetchUsersPanelData, fetchDailyMetrics, fetchAbuseLogs
├── types/
│   ├── index.ts                     # Business, Rating, Comment, CustomTag, UserTag, Favorite, Feedback
│   ├── admin.ts                     # AdminCounters, DailyMetrics (extends PublicMetrics), AbuseLog
│   └── metrics.ts                   # PublicMetrics, TopTagEntry, TopBusinessEntry, TopRatedEntry
├── theme/
│   └── index.ts                     # MUI theme (colores Google, Roboto, borderRadius 8)
├── data/
│   └── businesses.json              # 40 comercios
├── hooks/
│   ├── useAsyncData.ts              # Hook generico para fetch async con loading/error states
│   ├── useBusinesses.ts             # Filtra businesses por searchQuery + activeFilters
│   ├── useBusinessData.ts           # Orquesta 5 queries del business view con Promise.all + cache
│   ├── useBusinessDataCache.ts      # Cache client-side para datos del business view (5 min TTL)
│   ├── useListFilters.ts            # Filtrado generico: busqueda (debounced), categoria, estrellas, ordenamiento
│   ├── usePaginatedQuery.ts         # Paginacion generica con cursores Firestore + cache primera pagina (2 min TTL)
│   ├── useUserLocation.ts           # Geolocalizacion del navegador
│   └── usePublicMetrics.ts          # Hook para metricas publicas de dailyMetrics
├── utils/
│   ├── businessHelpers.ts           # getBusinessName, getTagLabel (compartidos)
│   └── formatDate.ts                # toDate, formatDateShort, formatDateMedium, formatDateFull (compartidos)
├── pages/
│   └── AdminDashboard.tsx           # Entry point admin (AdminGuard + AdminLayout)
├── components/
│   ├── admin/
│   │   ├── AdminGuard.tsx           # Google Sign-In + verificacion email
│   │   ├── AdminLayout.tsx          # AppBar + Tabs (8 secciones)
│   │   ├── AdminPanelWrapper.tsx    # Wrapper compartido loading/error/empty para paneles admin
│   │   ├── DashboardOverview.tsx    # StatCards + PieCharts + TopLists + Custom Tags ranking
│   │   ├── ActivityFeed.tsx         # Tabs por coleccion (ultimos 20 items)
│   │   ├── FeedbackList.tsx         # Tabla de feedback con categoria y flagged
│   │   ├── TrendsPanel.tsx          # Graficos evolucion + selector dia/semana/mes/ano
│   │   ├── UsersPanel.tsx           # Rankings por usuario (comments, ratings, favs, tags, feedback)
│   │   ├── FirebaseUsage.tsx        # LineCharts + PieCharts + barras de cuota
│   │   ├── AbuseAlerts.tsx          # Tabla de abuse logs
│   │   ├── BackupsPanel.tsx         # Gestion de backups Firestore (crear, listar, restaurar, eliminar + paginacion)
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
│   │   ├── BusinessTags.tsx         # Tags predefinidos (voto) + custom tags (CRUD) (props-driven)
│   │   ├── BusinessComments.tsx     # Comentarios + formulario + eliminar propios (props-driven, flagged filtrados)
│   │   ├── FavoriteButton.tsx       # Corazon toggle (props-driven)
│   │   └── DirectionsButton.tsx     # Abre Google Maps Directions
│   └── menu/
│       ├── FavoritesList.tsx
│       ├── CommentsList.tsx
│       ├── RatingsList.tsx
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
| `vite.config.ts` | Plugin React + `__APP_VERSION__` desde package.json |
| `firestore.indexes.json` | Indices compuestos Firestore (comments, ratings, favorites por userId+timestamp) |
| `.github/workflows/deploy.yml` | CI/CD: build + deploy Firestore rules/indexes + hosting en push a main |
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
| `favorites.ts` | `favorites` | `addFavorite`, `removeFavorite` |
| `ratings.ts` | `ratings` | `upsertRating` |
| `comments.ts` | `comments` | `addComment`, `deleteComment` |
| `tags.ts` | `userTags`, `customTags` | `addUserTag`, `removeUserTag`, `createCustomTag`, `updateCustomTag`, `deleteCustomTag` |
| `feedback.ts` | `feedback` | `sendFeedback` |
| `admin.ts` | Todas (read-only) | `fetchCounters`, `fetchRecent*` (6 colecciones), `fetchAllCustomTags`, `fetchUsersPanelData`, `fetchDailyMetrics`, `fetchAbuseLogs` |
| `index.ts` | — | Barrel export de todas las operaciones CRUD |

**Reglas del service layer:**

- Las funciones son `async` planas, no hooks.
- Aceptan parametros primitivos (userId, businessId, etc.), no objetos Firebase.
- Invalidan caches internamente (`invalidateQueryCache`, `invalidateBusinessCache`).
- Los errores propagan al componente que llama.

---

## Hooks compartidos

| Hook | Descripcion |
|------|-------------|
| `useAsyncData<T>` | Hook generico para fetch async. Retorna `{ data, loading, error }`. Usado por todos los paneles admin via `AdminPanelWrapper`. |
| `useBusinessData` | Orquesta 5 queries Firestore del business view con `Promise.all` + cache (5 min TTL). |
| `useBusinessDataCache` | Cache module-level (`Map`) para datos del business view. TTL 5 min. Se invalida en cada write. |
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
| `comments` | auto-generated | userId, userName, businessId, text (1-500), createdAt, flagged? | Read auth; create owner; delete owner |
| `userTags` | `{userId}__{businessId}__{tagId}` | userId, businessId, tagId, createdAt | Read auth; create/delete owner |
| `customTags` | auto-generated | userId, businessId, label (1-30), createdAt | Read auth; create/update/delete owner |
| `feedback` | auto-generated | userId, message (1-1000), category (bug/sugerencia/otro), createdAt, flagged? | Create auth+owner; read/delete owner; admin read |
| `config` | `counters`, `moderation` | counters: totales + daily reads/writes/deletes; moderation: bannedWords | Admin read; Functions write |
| `dailyMetrics` | `YYYY-MM-DD` | ratingDistribution, tops, activeUsers, daily ops, byCollection | Auth read; Functions write |
| `abuseLogs` | auto-generated | userId, type, collection, detail, timestamp | Admin read; Functions write |

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

// Admin types
interface AdminCounters { comments, ratings, favorites, feedback, users, customTags, userTags, dailyReads, dailyWrites, dailyDeletes }
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

- **Obligatorio en Cloud Functions**: todas las funciones callable usan `enforceAppCheck: true`.
- **Frontend**: se inicializa con `ReCaptchaEnterpriseProvider` solo en produccion (`VITE_RECAPTCHA_ENTERPRISE_SITE_KEY`).
- **Emuladores**: no requieren App Check.

### Firestore rules

- **Auth requerida**: todas las colecciones requieren `request.auth != null`.
- **Ownership**: escrituras validan `request.resource.data.userId == request.auth.uid`.
- **Timestamps server-side**: todas las reglas de `create` validan `createdAt == request.time`.
- **Validacion de campos**: longitudes maximas (displayName 30, text 500, message 1000, label 30), score 1-5.
- **Admin check**: `isAdmin()` verifica `request.auth.token.email == 'benoffi11@gmail.com'`.
- **Metricas publicas**: `dailyMetrics` es legible por cualquier usuario autenticado (estadisticas publicas).

### Cloud Functions — seguridad

- **Verificacion de admin**: email + `email_verified` + comparacion con `ADMIN_EMAIL` parametrizado.
- **Rate limiting**: 5 llamadas por minuto por usuario (in-memory, por instancia).
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
- **Texto:** #202124 (primary), #5f6368 (secondary)
- **Fuente:** Roboto
- **Border radius:** 8px (general), 16px (chips)
- **Estilo:** inspirado en Google Maps

---

## Scripts

| Comando | Descripcion |
|---------|-------------|
| `npm run dev` | Vite dev server (sin emuladores) |
| `npm run dev:full` | Dev + emuladores Firebase (auth, firestore, functions) |
| `npm run emulators` | Solo emuladores (Auth :9099, Firestore :8080, Functions :5001, UI :4000) |
| `npm run build` | tsc + vite build -> `dist/` |
| `npm run lint` | ESLint check |
| `npm run preview` | Preview del build de produccion |
| `npm run test` | Vitest watch mode |
| `npm run test:run` | Vitest single run |
| `npm run seed` | Poblar emulador Firestore con datos de prueba (requiere emuladores corriendo) |
| `npm run analyze` | Build + genera `dist/stats.html` con analisis del bundle |

---

## CI/CD

**GitHub Actions** (`.github/workflows/deploy.yml`):

1. Trigger: push a `main`
2. Setup: Node 22 + npm cache
3. Build: `npm run build` con secrets como env vars
4. Auth: `google-github-actions/auth@v2` con service account
5. Deploy Firestore rules + indexes: `firebase deploy --only firestore:rules,firestore:indexes`
6. Deploy Hosting: Firebase Hosting (canal `live`) via `FirebaseExtended/action-hosting-deploy@v0`

**IMPORTANTE:** Firestore rules e indexes se despliegan automaticamente en cada push a main. Cloud Functions se despliegan manualmente con `firebase deploy --only functions`.

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
| **Doc ID compuesto** | `{userId}__{businessId}` para favoritos, ratings y userTags. Garantiza unicidad sin queries extra. |
| **Service layer** | Componentes llaman `src/services/` para CRUD. Nunca importan `firebase/firestore` directamente para escrituras. |
| **Datos estaticos + dinamicos** | Comercios en JSON local, interacciones en Firestore. Se cruzan por `businessId` client-side. |
| **Optimistic UI** | Comentarios se agregan al state local antes de que Firestore confirme. |
| **Rate limiting (3 capas)** | Client-side (UI) + server-side (Cloud Functions triggers) + Cloud Functions callable (in-memory, 5/min/user). |
| **Moderacion de contenido** | Cloud Functions filtran texto con lista de banned words (configurable en `config/moderation`). |
| **Counters server-side** | Cloud Functions triggers actualizan `config/counters` atomicamente con `FieldValue.increment`. |
| **Metricas diarias** | Scheduled function calcula distribucion, tops, active users a las 3AM y guarda en `dailyMetrics/{YYYY-MM-DD}`. |
| **Admin panel pattern** | Todos los paneles admin usan `useAsyncData` + `AdminPanelWrapper` para estados loading/error. |
| **Component remount via key** | `feedbackKey` en SideMenu fuerza remount del FeedbackForm al re-entrar a la seccion. |
| **`component="span"`** | En MUI `ListItemText` secondary, para evitar `<p>` dentro de `<p>`. Se usa `display: block` en spans. |
| **import type** | Obligatorio por `verbatimModuleSyntax: true` en tsconfig. |
| **Hook generico de filtros** | `useListFilters<T>` acepta cualquier item con `business` asociado. Reutilizado en favoritos y ratings. |
| **Emuladores en DEV** | `firebase.ts` conecta a emuladores solo en `import.meta.env.DEV`. |
| **App Check (prod + functions)** | Firebase App Check con reCAPTCHA Enterprise en frontend. `enforceAppCheck: true` en todas las Cloud Functions callable. |
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
| [#17](https://github.com/benoffi7/modo-mapa/issues/17) | feat | Agregar edicion de comentarios | — | Open | — |
| — | security | Resolver hallazgos pendientes: App Check, timestamps, converters | [#18](https://github.com/benoffi7/modo-mapa/pull/18) | Merged | — |
| — | chore | Resolver mejoras tecnicas: debounce, tests, paginacion, husky, bundle analysis, strictTypes | [#20](https://github.com/benoffi7/modo-mapa/pull/20) | Merged | — |
| [#19](https://github.com/benoffi7/modo-mapa/issues/19) | fix | Fix CSP policy, tags auth guard, lint errors | [#22](https://github.com/benoffi7/modo-mapa/pull/22) | Merged | `docs/fix-csp-and-tags-permissions/` |
| — | feat | Security hardening: Cloud Functions, admin dashboard, rate limiting, moderation | [#27](https://github.com/benoffi7/modo-mapa/pull/27) | Merged | `docs/feat-security-hardening/` |
| [#24](https://github.com/benoffi7/modo-mapa/issues/24) | feat | Firebase quota mitigations: offline persistence, business view cache, paginated query cache | [#26](https://github.com/benoffi7/modo-mapa/pull/26) | Merged | `docs/feat-firebase-quota-offline/` |
| [#28](https://github.com/benoffi7/modo-mapa/issues/28) | feat | Modularizar componentes de estadisticas + seccion publica | [#32](https://github.com/benoffi7/modo-mapa/pull/32) | Merged | `docs/feat-modularizar-stats/` |
| [#31](https://github.com/benoffi7/modo-mapa/issues/31) | fix | Admin login popup se cierra automaticamente | [#33](https://github.com/benoffi7/modo-mapa/pull/33) | Merged | — |
| [#34](https://github.com/benoffi7/modo-mapa/issues/34) | feat | Gestion de backups de Firestore desde /admin | [#35](https://github.com/benoffi7/modo-mapa/pull/35) | Merged | `docs/feat-admin-backups/` |
| [#25](https://github.com/benoffi7/modo-mapa/issues/25) | feat | PWA + offline mode | — | Open | — |

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
- Comentarios: lista + formulario + eliminar propios (flaggeados ocultos)
- Datos cargados en paralelo (`Promise.all`) con cache client-side (5 min TTL)
- Escrituras via service layer (`src/services/`)

### Menu lateral (SideMenu)

- Header con avatar, nombre, boton editar nombre
- Secciones:
  - **Favoritos**: lista con filtros (busqueda, categoria, orden). Quitar favorito inline. Click navega al comercio.
  - **Comentarios**: lista con texto truncado. Eliminar con confirmacion. Click navega al comercio.
  - **Calificaciones**: lista con estrellas y filtros (busqueda, categoria, estrellas minimas, orden). Click navega al comercio.
  - **Feedback**: formulario con categoria (bug/sugerencia/otro) + mensaje (max 1000). Estado de exito.
  - **Estadisticas**: distribucion de ratings (pie), tags mas usados (pie), top 10 favoriteados/comentados/calificados. Usa `usePublicMetrics` + componentes de `stats/`.
  - **Agregar comercio**: link externo a Google Forms.
- Footer con version de la app

### Dashboard Admin (/admin)

- Login con Google Sign-In (solo `benoffi11@gmail.com`)
- Verificacion en frontend (AdminGuard) y server-side (Firestore rules)
- 8 tabs con paneles que usan `useAsyncData` + `AdminPanelWrapper`:
  - **Overview**: totales (comercios, usuarios, comentarios, ratings, favoritos, feedback), distribucion de ratings (pie), tags mas usados (pie), top 10 comercios, custom tags candidatas a promover
  - **Actividad**: feed por seccion (comentarios, ratings, favoritos, tags) con ultimos 20 items, indicador de flagged
  - **Feedback**: tabla de feedback recibido con categoria (bug/sugerencia/otro), mensaje, estado flagged
  - **Tendencias**: graficos de evolucion temporal con selector dia/semana/mes/ano — actividad por tipo, usuarios activos, total escrituras. Click en leyenda para mostrar/ocultar series
  - **Usuarios**: rankings top 10 por metrica (comentarios, ratings, favoritos, tags, feedback, total), stats generales (total, activos, promedio acciones)
  - **Firebase Usage**: graficos lineales de reads/writes/deletes y usuarios activos (ultimos 30 dias), pie charts por coleccion, barras de cuota vs free tier
  - **Alertas**: logs de abuso (rate limit excedido, contenido flaggeado, top writers)
  - **Backups**: crear backup manual, listar con paginacion (20 por pagina), restaurar con backup de seguridad automatico, eliminar con confirmacion. Usa Cloud Functions callable con `enforceAppCheck: true`

### Cloud Functions (server-side)

4 funciones admin callable + triggers + scheduled:

| Funcion | Tipo | Descripcion |
|---------|------|-------------|
| `createBackup` | callable | Firestore export -> GCS (`modo-mapa-app-backups`). Timeout 300s. |
| `listBackups` | callable | Lista prefijos en GCS con paginacion (max 100/pagina). Timeout 60s. |
| `restoreBackup` | callable | Crea backup de seguridad pre-restore + Firestore import <- GCS. Timeout 300s. |
| `deleteBackup` | callable | Elimina todos los archivos del backup en GCS. Timeout 120s. |

Todas las funciones callable:

- Verifican admin (email + `email_verified`)
- Rate limit: 5 llamadas/minuto por usuario
- `enforceAppCheck: true`
- Validan input (backupId con regex `^[\w.-]+$`)
- Logging con email enmascarado

**Rate limiting server-side (triggers):** comments (20/dia), customTags (10/business), feedback (5/dia).

**Moderacion de contenido:** banned words con normalizacion de acentos, word boundary matching.

**Counters atomicos:** totales por coleccion + operaciones diarias.

**Metricas diarias:** cron a las 3AM — distribucion, tops, active users, reset counters.

### Filtros reutilizables

- Hook `useListFilters<T>`: filtrado por nombre, categoria, score + ordenamiento
- Componente `ListFilters`: TextField busqueda, chips categoria, chips estrellas (opcional), Select orden, contador "N de M"
- Usado en FavoritesList y RatingsList
