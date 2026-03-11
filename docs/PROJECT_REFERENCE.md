# Modo Mapa — Referencia completa del proyecto

**Versión:** 1.3.0
**Repo:** <https://github.com/benoffi7/modo-mapa>
**Producción:** <https://modo-mapa-app.web.app>
**Última actualización:** 2026-03-11

---

## Descripción

App web mobile-first para empleados que necesitan encontrar comercios gastronómicos cercanos en un mapa interactivo. Los usuarios pueden buscar, filtrar, calificar, comentar, marcar favoritos y etiquetar comercios. Localizada en español (es-AR), orientada a Buenos Aires.

---

## Stack tecnológico

| Capa | Tecnología | Versión |
|------|-----------|---------|
| Framework | React | 19.2 |
| Bundler | Vite | 7.3 |
| Lenguaje | TypeScript | 5.9 (strict) |
| UI | Material UI (MUI) | 7.3 |
| Mapa | @vis.gl/react-google-maps | 1.7 |
| Gráficos | recharts | 3.8 |
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
       │    └─ AdminLayout (tabs: Overview, Actividad, Feedback, Tendencias, Usuarios, Firebase Usage, Alertas)
       │         ├─ DashboardOverview (StatCards + PieCharts + TopLists + Custom Tags ranking)
       │         ├─ ActivityFeed (tabs: comentarios, ratings, favoritos, tags)
       │         ├─ FeedbackList (tabla de feedback con categoría y estado)
       │         ├─ TrendsPanel (gráficos evolución + selector día/semana/mes/año)
       │         ├─ UsersPanel (rankings por usuario + stats)
       │         ├─ FirebaseUsage (LineCharts + PieCharts + barras cuota)
       │         └─ AbuseAlerts (tabla de logs de abuso)
       └─ [/*] MapProvider + APIProvider
            └─ AppShell.tsx
                 ├─ SearchBar (búsqueda + menú hamburguesa)
                 ├─ FilterChips (tags predefinidos)
                 ├─ MapView (Google Maps + markers)
                 ├─ LocationFAB (geolocalización)
                 ├─ BusinessSheet (bottom sheet con detalle)
                 │    ├─ BusinessHeader (nombre, dirección, favorito, direcciones)
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
                      └─ Footer (versión)
```

### Cloud Functions

```text
functions/
├── src/
│   ├── index.ts              → exports de todas las functions
│   ├── triggers/
│   │   ├── comments.ts       → rate limit + moderación + counters
│   │   ├── customTags.ts     → rate limit + moderación + counters
│   │   ├── feedback.ts       → rate limit + moderación + counters
│   │   ├── ratings.ts        → counters (create/update/delete)
│   │   ├── favorites.ts      → counters (create/delete)
│   │   └── users.ts          → counters (create)
│   ├── scheduled/
│   │   └── dailyMetrics.ts   → cron diario: distribución, tops, active users
│   └── utils/
│       ├── rateLimiter.ts    → rate limiting (daily/per-entity)
│       ├── moderator.ts      → filtro de palabras prohibidas (caché 5 min)
│       ├── counters.ts       → helpers increment/trackWrite/trackDelete
│       └── abuseLogger.ts    → logger a colección abuseLogs
├── package.json              → Node 22, firebase-admin, firebase-functions
├── tsconfig.json             → CommonJS, strict
└── vitest.config.ts
```

### Flujo de datos

1. **Datos estáticos**: `businesses.json` (40 comercios) se carga como import estático. No hay fetch.
2. **Datos dinámicos**: Firestore (favoritos, ratings, comentarios, tags, feedback). Cada componente hace su propia query.
3. **Estado global**: `AuthContext` (user, displayName, signInWithGoogle, signOut) + `MapContext` (selectedBusiness, searchQuery, filters, userLocation).
4. **Estado local**: Cada sección del menú carga sus datos al montarse y los filtra client-side con `useListFilters`.
5. **Server-side**: Cloud Functions triggers validan rate limits, moderan contenido y actualizan counters/métricas.

---

## Estructura de archivos

```text
src/
├── App.tsx                          # Routing: /admin (lazy) vs /* (mapa)
├── main.tsx                         # Entry point (StrictMode)
├── index.css                        # Estilos globales mínimos
├── config/
│   ├── firebase.ts                  # Init Firebase + emuladores en DEV + App Check (prod)
│   ├── collections.ts               # Nombres de colecciones Firestore centralizados
│   ├── converters.ts                # FirestoreDataConverter<T> tipados por colección (incl. feedback)
│   └── adminConverters.ts           # Converters para AdminCounters, DailyMetrics, AbuseLog
├── context/
│   ├── AuthContext.tsx               # Auth anónima + Google Sign-In + displayName
│   └── MapContext.tsx                # Estado del mapa (selected, search, filters)
├── types/
│   ├── index.ts                     # Business, Rating, Comment, CustomTag, UserTag, Favorite, Feedback
│   └── admin.ts                     # AdminCounters, DailyMetrics, AbuseLog
├── theme/
│   └── index.ts                     # MUI theme (colores Google, Roboto, borderRadius 8)
├── data/
│   └── businesses.json              # 40 comercios
├── hooks/
│   ├── useBusinesses.ts             # Filtra businesses por searchQuery + activeFilters
│   ├── useListFilters.ts            # Filtrado genérico: búsqueda (debounced), categoría, estrellas
│   ├── usePaginatedQuery.ts         # Paginación genérica con cursores Firestore
│   └── useUserLocation.ts           # Geolocalización del navegador
├── pages/
│   └── AdminDashboard.tsx           # Entry point admin (AdminGuard + AdminLayout)
├── components/
│   ├── admin/
│   │   ├── AdminGuard.tsx           # Google Sign-In + verificación email
│   │   ├── AdminLayout.tsx          # AppBar + Tabs (7 secciones)
│   │   ├── DashboardOverview.tsx    # StatCards + PieCharts + TopLists + Custom Tags ranking
│   │   ├── ActivityFeed.tsx         # Tabs por colección (últimos 20 items)
│   │   ├── FeedbackList.tsx         # Tabla de feedback con categoría y flagged
│   │   ├── TrendsPanel.tsx          # Gráficos evolución + selector día/semana/mes/año
│   │   ├── UsersPanel.tsx           # Rankings por usuario (comments, ratings, favs, tags, feedback)
│   │   ├── FirebaseUsage.tsx        # LineCharts + PieCharts + barras de cuota
│   │   ├── AbuseAlerts.tsx          # Tabla de abuse logs
│   │   ├── StatCard.tsx             # Card con número grande
│   │   ├── TopList.tsx              # Tabla con barras de progreso
│   │   ├── ActivityTable.tsx        # Tabla genérica
│   │   └── charts/
│   │       ├── PieChartCard.tsx     # Wrapper recharts pie
│   │       └── LineChartCard.tsx    # Wrapper recharts line (click legend toggle)
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
│   │   ├── BusinessSheet.tsx
│   │   ├── BusinessHeader.tsx
│   │   ├── BusinessRating.tsx
│   │   ├── BusinessTags.tsx
│   │   ├── BusinessComments.tsx     # Filtra comments flaggeados client-side
│   │   ├── FavoriteButton.tsx
│   │   └── DirectionsButton.tsx
│   └── menu/
│       ├── FavoritesList.tsx
│       ├── CommentsList.tsx
│       ├── RatingsList.tsx
│       ├── FeedbackForm.tsx
│       └── ListFilters.tsx
```

### Otros archivos clave

| Archivo | Descripción |
|---------|-------------|
| `firestore.rules` | Reglas de seguridad: auth, ownership, admin (email check), config/metrics |
| `firebase.json` | Config de hosting, functions, emuladores, reglas |
| `.firebaserc` | Proyecto: `modo-mapa-app` |
| `vite.config.ts` | Plugin React + `__APP_VERSION__` desde package.json |
| `.github/workflows/deploy.yml` | CI/CD: build + deploy a Firebase en push a main |
| `PROCEDURES.md` | Flujo de desarrollo (PRD → specs → plan → implementar) |
| `.env.example` | Template de variables de entorno |
| `docs/SECURITY_GUIDELINES.md` | Guía de seguridad: App Check, timestamps, converters, patrones |
| `docs/INFORME_SEGURIDAD.md` | Informe de auditoría de seguridad |
| `docs/INFORME_MEJORAS.md` | Informe de mejoras pendientes y resueltas |

---

## Colecciones Firestore

| Colección | Doc ID | Campos | Reglas |
|-----------|--------|--------|--------|
| `users` | `{userId}` | displayName, createdAt | R/W owner; admin read |
| `favorites` | `{userId}__{businessId}` | userId, businessId, createdAt | Read auth; create/delete owner |
| `ratings` | `{userId}__{businessId}` | userId, businessId, score (1-5), createdAt, updatedAt | Read auth; create/update owner, score 1-5 |
| `comments` | auto-generated | userId, userName, businessId, text (1-500), createdAt, flagged? | Read auth; create owner; delete owner |
| `userTags` | `{userId}__{businessId}__{tagId}` | userId, businessId, tagId, createdAt | Read auth; create/delete owner |
| `customTags` | auto-generated | userId, businessId, label (1-30), createdAt | Read auth; create/update/delete owner |
| `feedback` | auto-generated | userId, message (1-1000), category (bug/sugerencia/otro), createdAt, flagged? | Create auth+owner; read/delete owner; admin read |
| `config` | `counters`, `moderation` | counters: totales + daily reads/writes/deletes; moderation: bannedWords | Admin read; Functions write |
| `dailyMetrics` | `YYYY-MM-DD` | ratingDistribution, tops, activeUsers, daily ops, byCollection | Admin read; Functions write |
| `abuseLogs` | auto-generated | userId, type, collection, detail, timestamp | Admin read; Functions write |

---

## Tipos principales

```typescript
// Business (datos estáticos del JSON)
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

// Categorías con labels en español (7)
CATEGORY_LABELS: restaurant→Restaurante, cafe→Café, bakery→Panadería, bar→Bar,
                 fastfood→Comida rápida, icecream→Heladería, pizza→Pizzería

// Admin types
interface AdminCounters { comments, ratings, favorites, feedback, users, customTags, userTags, dailyReads, dailyWrites, dailyDeletes }
interface DailyMetrics { date, ratingDistribution, topFavorited, topCommented, topRated, topTags, dailyReads/Writes/Deletes, byCollection, activeUsers }
interface AbuseLog { id, userId, type, collection, detail, timestamp }
```

---

## Variables de entorno

```bash
VITE_GOOGLE_MAPS_API_KEY=       # API key de Google Maps
VITE_GOOGLE_MAPS_MAP_ID=        # Map ID para estilos
VITE_FIREBASE_API_KEY=           # Firebase web API key
VITE_FIREBASE_AUTH_DOMAIN=       # *.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=        # modo-mapa-app
VITE_FIREBASE_STORAGE_BUCKET=    # *.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=

# Opcional: App Check con reCAPTCHA Enterprise (ver docs/SECURITY_GUIDELINES.md)
VITE_RECAPTCHA_ENTERPRISE_SITE_KEY=
```

En CI/CD se inyectan como GitHub Secrets.

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

| Comando | Descripción |
|---------|-------------|
| `npm run dev` | Vite dev server (sin emuladores) |
| `npm run dev:full` | Dev + emuladores Firebase (auth, firestore, functions) |
| `npm run emulators` | Solo emuladores (Auth :9099, Firestore :8080, Functions :5001, UI :4000) |
| `npm run build` | tsc + vite build → `dist/` |
| `npm run lint` | ESLint check |
| `npm run preview` | Preview del build de producción |
| `npm run test` | Vitest watch mode |
| `npm run test:run` | Vitest single run |
| `npm run seed` | Poblar emulador Firestore con datos de prueba (requiere emuladores corriendo) |
| `npm run analyze` | Build + genera `dist/stats.html` con análisis del bundle |

---

## CI/CD

**GitHub Actions** (`.github/workflows/deploy.yml`):

1. Trigger: push a `main`
2. Setup: Node 20 + npm cache
3. Build: `npm run build` con secrets como env vars
4. Deploy: Firebase Hosting (canal `live`) via `FirebaseExtended/action-hosting-deploy@v0`

**Flujo de feature:**

1. Crear issue en GitHub
2. Branch: `feat/<N>-<descripcion>` o `fix/<N>-<descripcion>`
3. PRD → specs → plan → implementar (ver `PROCEDURES.md`)
4. Test local con `npm run dev`
5. Commit con referencia al issue
6. PR con resumen y test plan
7. Merge a main → deploy automático

---

## Versionado

- Versión en `package.json` → expuesta via `__APP_VERSION__` (Vite define) → mostrada en footer del menú lateral.
- Cada 10 issues se incrementa el número mayor (1.x → 2.0).
- Formato: `MAJOR.MINOR.PATCH` donde MINOR se incrementa por feature/fix.

---

## Patrones y convenciones

| Patrón | Descripción |
|--------|-------------|
| **Auth anónima + Google Sign-In** | Usuarios normales se autentican anónimamente. Admin usa Google Sign-In solo en `/admin`. |
| **Admin guard (2 capas)** | Frontend: `AdminGuard` verifica `user.email === 'benoffi11@gmail.com'`. Server: Firestore rules con `request.auth.token.email`. |
| **Doc ID compuesto** | `{userId}__{businessId}` para favoritos, ratings y userTags. Garantiza unicidad sin queries extra. |
| **Datos estáticos + dinámicos** | Comercios en JSON local, interacciones en Firestore. Se cruzan por `businessId` client-side. |
| **Optimistic UI** | Comentarios se agregan al state local antes de que Firestore confirme. |
| **Rate limiting (2 capas)** | Client-side (UI) + server-side (Cloud Functions triggers). Functions eliminan docs que exceden límites. |
| **Moderación de contenido** | Cloud Functions filtran texto con lista de banned words (configurable en `config/moderation`). |
| **Counters server-side** | Cloud Functions triggers actualizan `config/counters` atómicamente con `FieldValue.increment`. |
| **Métricas diarias** | Scheduled function calcula distribución, tops, active users a las 3AM y guarda en `dailyMetrics/{YYYY-MM-DD}`. |
| **Component remount via key** | `feedbackKey` en SideMenu fuerza remount del FeedbackForm al re-entrar a la sección. |
| **`component="span"`** | En MUI `ListItemText` secondary, para evitar `<p>` dentro de `<p>`. Se usa `display: block` en spans. |
| **import type** | Obligatorio por `verbatimModuleSyntax: true` en tsconfig. |
| **Hook genérico de filtros** | `useListFilters<T>` acepta cualquier item con `business` asociado. Reutilizado en favoritos y ratings. |
| **Emuladores en DEV** | `firebase.ts` conecta a emuladores solo en `import.meta.env.DEV`. |
| **App Check (prod)** | Firebase App Check con reCAPTCHA Enterprise, solo en producción. |
| **withConverter\<T\>()** | Todas las lecturas usan converters tipados. Escrituras usan refs sin converter (por `serverTimestamp()`). |
| **Timestamps server-side** | Todas las reglas de `create` validan `createdAt == request.time`. |
| **Collection names** | Centralizados en `src/config/collections.ts`. Sin strings mágicos. |
| **ErrorBoundary** | Envuelve `AppShell` y `AdminDashboard`. Fallback UI con opción de recargar. |
| **usePaginatedQuery** | Hook genérico para paginación con cursores Firestore. Botón "Cargar más". |
| **Debounce con useDeferredValue** | React 19 `useDeferredValue` para debounce de búsqueda. |
| **Pre-commit hooks** | `husky` + `lint-staged` ejecuta ESLint en `.ts/.tsx` staged. |
| **exactOptionalPropertyTypes** | Habilitado en tsconfig. |
| **Markdown lint** | Archivos `.md` deben cumplir markdownlint. |
| **Lazy loading admin** | `/admin` usa `lazy()` + `Suspense`. No carga MapProvider/APIProvider. |

---

## Issues resueltos

| Issue | Tipo | Título | PR | Estado | Docs |
|-------|------|--------|----|--------|------|
| [#1](https://github.com/benoffi7/modo-mapa/issues/1) | fix | Google Maps: error de carga y warning de Map ID faltante | [#2](https://github.com/benoffi7/modo-mapa/pull/2) | Merged | — |
| [#3](https://github.com/benoffi7/modo-mapa/issues/3) | fix | Comentarios no aparecen después de enviar | [#4](https://github.com/benoffi7/modo-mapa/pull/4) | Merged | — |
| [#5](https://github.com/benoffi7/modo-mapa/issues/5) | feat | Etiquetas personalizadas por usuario | [#6](https://github.com/benoffi7/modo-mapa/pull/6) | Merged | `docs/feat-custom-user-tags/` |
| [#7](https://github.com/benoffi7/modo-mapa/issues/7) | feat | Menú lateral con sección Favoritos | [#8](https://github.com/benoffi7/modo-mapa/pull/8) | Merged | `docs/feat-menu-favoritos/` |
| [#9](https://github.com/benoffi7/modo-mapa/issues/9) | feat | Sección Comentarios en menú lateral | [#10](https://github.com/benoffi7/modo-mapa/pull/10) | Merged | `docs/feat-menu-comentarios/` |
| [#11](https://github.com/benoffi7/modo-mapa/issues/11) | feat | Feedback, Ratings, Agregar comercio, Versión, Filtros | [#12](https://github.com/benoffi7/modo-mapa/pull/12) | Merged | `docs/feat-menu-feedback-ratings-version/` |
| [#13](https://github.com/benoffi7/modo-mapa/issues/13) | fix | customTags read rule demasiado restrictiva | [#14](https://github.com/benoffi7/modo-mapa/pull/14) | Merged | — |
| [#15](https://github.com/benoffi7/modo-mapa/issues/15) | security | Auditoría de seguridad — hallazgos iniciales | [#16](https://github.com/benoffi7/modo-mapa/pull/16) | Merged | — |
| [#17](https://github.com/benoffi7/modo-mapa/issues/17) | feat | Agregar edición de comentarios | — | Open | — |
| — | security | Resolver hallazgos pendientes: App Check, timestamps, converters | [#18](https://github.com/benoffi7/modo-mapa/pull/18) | Merged | — |
| — | chore | Resolver mejoras técnicas: debounce, tests, paginación, husky, bundle analysis, strictTypes | [#20](https://github.com/benoffi7/modo-mapa/pull/20) | Merged | — |
| [#19](https://github.com/benoffi7/modo-mapa/issues/19) | fix | Fix CSP policy, tags auth guard, lint errors | [#22](https://github.com/benoffi7/modo-mapa/pull/22) | Merged | `docs/fix-csp-and-tags-permissions/` |
| — | feat | Security hardening: Cloud Functions, admin dashboard, rate limiting, moderation | — | In PR | `docs/feat-security-hardening/` |
| [#24](https://github.com/benoffi7/modo-mapa/issues/24) | feat | Mitigaciones cuota Firebase + modo offline | — | Open | `docs/feat-firebase-quota-offline/` |

---

## Documentación por feature

Cada feature tiene su carpeta en `docs/<tipo>-<descripcion>/` con:

| Archivo | Contenido |
|---------|-----------|
| `prd.md` | Requisitos del producto |
| `specs.md` | Especificaciones técnicas (interfaces, props, lógica) |
| `plan.md` | Plan de implementación paso a paso |
| `changelog.md` | Archivos creados y modificados |

---

## Funcionalidades actuales

### Mapa

- Google Maps centrado en Buenos Aires (-34.6037, -58.3816)
- 40 marcadores con color por categoría
- Click en marker abre bottom sheet con detalle
- Geolocalización del usuario (FAB)
- Búsqueda por nombre/dirección/categoría
- Filtro por tags predefinidos (chips)

### Comercio (BusinessSheet)

- Nombre, categoría, dirección, teléfono (link tel:)
- Botón favorito (toggle corazón)
- Botón direcciones (abre Google Maps)
- Rating: promedio + estrellas del usuario (1-5)
- Tags predefinidos: vote count + toggle del usuario
- Tags custom: crear, editar, eliminar (privados por usuario)
- Comentarios: lista + formulario + eliminar propios (flaggeados ocultos)

### Menú lateral (SideMenu)

- Header con avatar, nombre, botón editar nombre
- Secciones:
  - **Favoritos**: lista con filtros (búsqueda, categoría, orden). Quitar favorito inline. Click navega al comercio.
  - **Comentarios**: lista con texto truncado. Eliminar con confirmación. Click navega al comercio.
  - **Calificaciones**: lista con estrellas y filtros (búsqueda, categoría, estrellas mínimas, orden). Click navega al comercio.
  - **Feedback**: formulario con categoría (bug/sugerencia/otro) + mensaje (max 1000). Estado de éxito.
  - **Agregar comercio**: link externo a Google Forms.
- Footer con versión de la app

### Dashboard Admin (/admin)

- Login con Google Sign-In (solo `benoffi11@gmail.com`)
- Verificación en frontend (AdminGuard) y server-side (Firestore rules)
- **Overview**: totales (comercios, usuarios, comentarios, ratings, favoritos, feedback), distribución de ratings (pie), tags más usados (pie), top 10 comercios, custom tags candidatas a promover
- **Actividad**: feed por sección (comentarios, ratings, favoritos, tags) con últimos 20 items, indicador de flagged
- **Feedback**: tabla de feedback recibido con categoría (bug/sugerencia/otro), mensaje, estado flagged
- **Tendencias**: gráficos de evolución temporal con selector día/semana/mes/año — actividad por tipo, usuarios activos, total escrituras. Click en leyenda para mostrar/ocultar series
- **Usuarios**: rankings top 10 por métrica (comentarios, ratings, favoritos, tags, feedback, total), stats generales (total, activos, promedio acciones)
- **Firebase Usage**: gráficos lineales de reads/writes/deletes y usuarios activos (últimos 30 días), pie charts por colección, barras de cuota vs free tier
- **Alertas**: logs de abuso (rate limit excedido, contenido flaggeado, top writers)

### Cloud Functions (server-side)

- **Rate limiting server-side**: comments (20/día), customTags (10/business), feedback (5/día)
- **Moderación de contenido**: banned words con normalización de acentos, word boundary matching
- **Counters atómicos**: totales por colección + operaciones diarias
- **Métricas diarias**: cron a las 3AM — distribución, tops, active users, reset counters

### Filtros reutilizables

- Hook `useListFilters<T>`: filtrado por nombre, categoría, score + ordenamiento
- Componente `ListFilters`: TextField búsqueda, chips categoría, chips estrellas (opcional), Select orden, contador "N de M"
- Usado en FavoritesList y RatingsList
