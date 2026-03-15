# Funcionalidades actuales

## Mapa

- Google Maps centrado en Buenos Aires (-34.6037, -58.3816)
- 40 marcadores con color por categoria
- Click en marker abre bottom sheet con detalle
- Geolocalizacion del usuario (FAB)
- Busqueda por nombre/direccion/categoria
- Filtro por tags predefinidos (chips)
- Filtro por nivel de gasto ($/$$/$$) con chips toggle

---

## Comercio (BusinessSheet)

- Nombre, categoria, direccion, telefono (link `tel:`)
- Boton favorito (toggle corazon)
- Boton direcciones (abre Google Maps)
- Boton compartir (Web Share API con fallback a clipboard). Deep link via `?business={id}`
- **Rating**: promedio + estrellas del usuario (1-5). Optimistic UI con `pendingRating`. Boton X para borrar calificacion. Multi-criterio expandible (comida, atencion, precio, ambiente, rapidez) con promedios por criterio. Criterios definidos en `constants/criteria.ts` (`RATING_CRITERIA`). Seccion multi-criterio deshabilitada hasta que el usuario tenga un rating global. Campo `criteria?: RatingCriteria` en tipo `Rating`
- **Tags predefinidos**: vote count + toggle del usuario
- **Tags custom**: crear, editar, eliminar (privados por usuario)
- **Comentarios**: lista + formulario + editar propios + undo delete (5s, multiples pendientes simultaneas) + likes (otros) + sorting (Recientes/Antiguos/Utiles). Flaggeados ocultos. Indicador "(editado)". Threads: responder a comentarios (1 nivel), colapsables con "Ver N respuestas". `replyCount` gestionado exclusivamente por Cloud Functions (increment en create, decrement con floor en 0 en delete). Cascade delete de replies huerfanas en `onCommentDeleted`. Campos thread: `parentId` (opcional), `replyCount` (opcional, solo en root, server-managed)
- **Nivel de gasto**: $/$$/$$$ con votos y promedio. Optimistic UI con `pendingLevel`. Toggle: click en el mismo nivel remueve el voto (`deletePriceLevel`). Reset via `key={businessId}` en parent para forzar remount
- **Foto de menu**: preview con thumbnail, staleness chip si >6 meses. Upload con compresion + progress + cancel (AbortController). Viewer fullscreen con boton reportar. Overlay camera icon para subir nueva foto (reemplaza boton separado)
- Datos cargados en paralelo (`Promise.all`, 7 queries) con cache client-side (5 min TTL). User likes fetched via batched `documentId('in')` queries (30 per batch, not individual getDoc per comment)
- Race condition fix con `patchedRef` para evitar que full loads sobreescriban refetches parciales
- Escrituras via service layer (`src/services/`)
- Visita registrada automaticamente en localStorage al abrir

---

## Menu lateral (SideMenu)

- Header con avatar, nombre, boton editar nombre, badge tipo de cuenta (temporal/email+verificado), botones "Crear cuenta" / "Ya tengo cuenta" (solo anonimos). Badge en icono de Comentarios con cantidad de respuestas no leidas (unread `comment_reply` count)
- Todas las secciones lazy-loaded via `React.lazy()` + `Suspense` con spinner fallback (reduce main chunk ~25%)
- Secciones:
  - **Recientes**: ultimos 20 comercios visitados (localStorage). Click navega al comercio en el mapa
  - **Sugeridos para vos**: sugerencias personalizadas via `useSuggestions` hook + `services/suggestions.ts`. Fetch de favoritos, ratings y tags del usuario → scoring client-side (Haversine para cercania). Pesos en `constants/suggestions.ts` (`SUGGESTION_WEIGHTS`): categoria=3, tags=2, cercania=1, penalizacion por ya favorito=-5 o ya calificado=-3. Chips de razon (categoria, tags, cercania). Max 10 sugerencias. Componente: `SuggestionsView.tsx`
  - **Favoritos**: lista con filtros (busqueda, categoria, orden). Quitar favorito inline. Click navega al comercio
  - **Comentarios**: lista mejorada con skeleton loader, empty state motivacional, preview enriquecido (fecha relativa, indicador editado, likes, replies), busqueda de texto (con `useDeferredValue` + auto-load-all), ordenamiento (recientes/antiguos/mas likes via `ToggleButtonGroup`), filtro por comercio (Autocomplete), edicion inline, stats resumen colapsable (total, likes, promedio, mas popular), swipe actions en mobile (deslizar para editar/eliminar), undo delete con `useUndoDelete` hook. Envuelto en `PaginatedListShell` para loading/error/empty states consistentes. Blue dot indicator en comentarios con respuestas no leidas; mark-as-read al hacer click. `CommentItem` extraido y memoizado (`React.memo`). Virtualizacion condicional con `@tanstack/react-virtual` cuando hay >= 20 items (mejora performance en listas largas)
  - **Calificaciones**: lista con estrellas y filtros (busqueda, categoria, estrellas minimas, orden). Click navega al comercio
  - **Rankings**: ranking semanal/mensual/anual/historico (all-time) con scoring por actividad. Cards con medallas, barra de progreso y animaciones fade-in escalonadas. Indicador de tendencia (▲▼) vs periodo anterior. Sistema de tiers (Bronce/Plata/Oro/Diamante) con barra de progreso al siguiente nivel. Sistema de badges/logros (11 badges: primera reseña, comentarista, influencer, fotografo, critico, popular, todoterreno, podio, racha 7d, etc). Racha (streak) de dias consecutivos con actividad. Grafico sparkline de evolucion del score. Boton compartir (Web Share API / clipboard). Pull-to-refresh. Perfil publico al tocar un usuario (modal con desglose, badges y score). Filtro por zona (UI placeholder, proximamente). Card "Tu actividad" colapsable (2 lineas por defecto, expandible para desglose completo). Desglose con barras horizontales de colores por categoria. Live score fallback si no estas en ranking pre-computado
  - **Feedback**: formulario con 2 tabs (Enviar / Mis envios). Enviar: categoria (bug/sugerencia/datos_usuario/datos_comercio/otro) + mensaje (max 1000) + imagen adjunta opcional (max 10MB, JPG/PNG/WebP). Mis envios: `MyFeedbackList` muestra feedback del usuario con chips de status (pending/viewed/responded/resolved), respuestas del admin colapsables, indicador de nueva respuesta (dot verde), imagen adjunta inline. Al expandir un feedback respondido se marca como visto (`markFeedbackViewed`)
  - **Estadisticas**: distribucion de ratings (pie), tags mas usados (pie), top 10 favoriteados/comentados/calificados. Usa `usePublicMetrics` + componentes de `stats/`
  - **Configuracion**: seccion Cuenta (primera): anonimos ven crear cuenta/login, usuarios email ven email + badge verificacion + re-enviar verificacion (con cooldown 60s) + cambiar contrasena + cerrar sesion con confirmacion. Toggles de privacidad (perfil publico/privado), notificaciones (master + likes/fotos/rankings/feedback/replies), y datos de uso (analytics). Defaults todos en false. Optimistic UI con revert on error
  - **Ayuda**: seccion colapsable con 7 topics en formato Accordion (mapa, comercio, menu lateral, notificaciones, perfil, configuracion, feedback). Lazy-loaded via `React.lazy()`. Componente: `HelpSection.tsx`
  - **Agregar comercio**: link externo a Google Forms
- Dark mode toggle con switch (persiste en localStorage, respeta `prefers-color-scheme`)
- Footer con version de la app (+ links a Theme Playground y Constants Dashboard en DEV)

---

## Notificaciones in-app

- Campana con badge (unread count) en la barra de busqueda
- Drawer con lista de notificaciones, tiempo relativo ("hace 2 min", "ayer")
- Marcar como leida individual o todas a la vez
- Click en notificacion navega al comercio relacionado
- Polling cada 60s para unread count (con visibility awareness: se pausa cuando el tab esta oculto para ahorrar queries)
- Tipos: `like`, `photo_approved`, `photo_rejected`, `ranking`, `feedback_response`, `comment_reply`
- Generadas automaticamente por Cloud Functions triggers
- `comment_reply`: notifica al autor del comentario padre cuando alguien responde. Generada por `onCommentCreated` cuando el comentario tiene `parentId`. Respeta setting `notifyReplies` del usuario destinatario. NotificationItem muestra `ReplyIcon` para este tipo
- Expiran a los 30 dias (cleanup diario)
- `NotificationsContext` centralizado: instancia unica compartida por todos los consumidores (campana, badge SideMenu, etc.)

---

## Autenticacion por email/password (#80)

- **Cuenta anonima por defecto**: UID generado automaticamente al ingresar. Sin email ni contrasena
- **Registro (upgrade anonimo → email/password)**: `linkWithCredential(EmailAuthProvider)` preserva UID y todos los datos. Post-registro: `sendEmailVerification()` automatico
- **Login cross-device**: `signInWithEmailAndPassword()` desde otro dispositivo. Warning de perdida de datos anonimos
- **Verificacion de email**: no bloqueante. Badge en SideMenu y SettingsPanel. Re-enviar con cooldown 60s. Refresh via `user.reload()`
- **Recuperacion de contrasena**: `sendPasswordResetEmail()` desde dialog de login ("Olvide mi contrasena")
- **Cambio de contrasena**: `reauthenticateWithCredential()` + `updatePassword()` desde SettingsPanel
- **Logout**: `signOut()` + limpieza localStorage (visitas). Crea nueva cuenta anonima automaticamente
- **Componentes**: `EmailPasswordDialog` (registro/login con tabs), `ChangePasswordDialog`, seccion Cuenta en SettingsPanel
- **Service layer**: `services/emailAuth.ts` (link, signIn, signOut, verify, reset, changePassword, getAuthErrorMessage)
- **Constantes**: `constants/auth.ts` (PASSWORD_MIN_LENGTH, EMAIL_REGEX, AUTH_ERRORS en espanol)
- **Analytics**: `account_created`, `email_sign_in`, `sign_out`, `password_changed`, user property `auth_type`
- **Seguridad**: mensajes genericos para prevenir email enumeration, cooldown en re-envio verificacion, re-auth antes de cambio de contrasena

---

## Perfil publico de usuario

- Click en nombre de usuario en comentarios abre bottom sheet
- Avatar, fecha de registro, stats (comentarios, ratings, favoritos, likes recibidos, tags, fotos aprobadas, ranking mensual)
- Badge con medalla para usuarios top-3 del ranking mensual (junto al nombre)
- Ultimos 5 comentarios con link al comercio
- Graceful handling cuando el doc del usuario no es accesible (rules restringen a owner/admin)
- Fallback de nombre desde el comentario
- Visibilidad controlada por `profilePublic` en `userSettings` — cache con TTL 60s en `useProfileVisibility`

---

## Constants Dashboard (`/dev/constants`, DEV only)

- Browser de todas las constantes centralizadas en `src/constants/`
- Busqueda por nombre o valor
- Filtro por modulo (chips toggle)
- Cada constante muestra: nombre (monospace), tipo (badge), valor (formateado)
- Edicion inline con validacion: JSON format, hex colors, numeros, booleanos
- Color swatches para valores hex, ms→human-readable hints para tiempos
- Botones separados: copiar nombre (gris) y copiar valor (morado)
- Deteccion automatica de valores duplicados entre modulos (banner warning)
- Stats footer: N de M constantes visibles, total modulos, duplicados
- Registry auto-descubre constantes via `Object.entries` sobre cada modulo
- Lazy-loaded con `React.lazy()`, solo incluido en bundle DEV
- Accesible desde link en footer del SideMenu

---

## Firebase Analytics

- Firebase Analytics (GA4) integrado solo en produccion (`import.meta.env.PROD`)
- Lazy-loaded via dynamic import para no impactar bundle size
- Utilidad centralizada en `src/utils/analytics.ts`: `initAnalytics`, `trackEvent`, `setUserProperty`
- Eventos trackeados:
  - `business_view` (id, nombre, categoria)
  - `business_search` (query)
  - `business_filter_tag` / `business_filter_price`
  - `rating_submit` (business_id, score)
  - `side_menu_open`, `dark_mode_toggle`
- Inicializado en `main.tsx` despues de crear la app Firebase

---

## Dashboard Admin (`/admin`)

- Login con Google Sign-In (solo `benoffi11@gmail.com`)
- Verificacion en frontend (AdminGuard) y server-side (Firestore rules)
- 10 tabs con paneles que usan `useAsyncData` + `AdminPanelWrapper`:

| Tab | Descripcion |
|-----|-------------|
| **Overview** | Totales (comercios, usuarios, comentarios, ratings, favoritos, feedback, commentLikes), distribucion de ratings (pie), tags mas usados (pie), top 10 comercios, custom tags candidatas a promover, auth method breakdown (pie: anonimos vs email), notification read rate (StatCard), "Salud de comentarios" section (editados count, % editados, respuestas count, % respuestas) |
| **Actividad** | Feed por seccion (comentarios, ratings, favoritos, tags, price levels, comment likes) con ultimos 20 items, indicador de flagged. Comentarios: columnas Likes y Resp. (replyCount), chips "editado" (si `updatedAt`) y "Respuesta" (si `parentId`) |
| **Feedback** | Tabla de feedback con categoria, mensaje, status (pending/viewed/responded/resolved), filtro por status. Acciones admin: responder (respondToFeedback callable), resolver (resolveFeedback callable), crear issue en GitHub (createGithubIssueFromFeedback callable). Link a GitHub issue si existe |
| **Tendencias** | Graficos de evolucion temporal con selector dia/semana/mes/ano — actividad por tipo (incl. commentLikes line), usuarios activos, total escrituras, new accounts trend. Click en leyenda para mostrar/ocultar series |
| **Usuarios** | Rankings top 10 por metrica (comentarios, ratings, favoritos, tags, feedback, likesGiven, total), stats generales (total, activos, promedio acciones), auth method breakdown (anonimos vs email), email verified stats, settings aggregates (privacidad, notificaciones, analytics), "Mas likes dados" TopList |
| **Firebase Usage** | Graficos lineales de reads/writes/deletes y usuarios activos (ultimos 30 dias), pie charts por coleccion, barras de cuota vs free tier |
| **Alertas** | Logs de abuso (rate limit excedido, contenido flaggeado, top writers) |
| **Backups** | Crear backup manual, listar con paginacion (20/pagina), restaurar con backup de seguridad automatico, eliminar con confirmacion. Usa Cloud Functions callable |
| **Fotos** | Panel de revision de fotos de menu. Filtro por status (todas/pendientes/aprobadas/rechazadas) con contadores. Acciones contextuales por status: aprobar pendientes/rechazadas, rechazar con razon, eliminar aprobadas/rechazadas. Badge de reportes en cada card |
| **Performance** | Web Vitals (LCP, INP, CLS, TTFB) con semaforos verde/amarillo/rojo segun umbrales. Percentiles p50/p75/p95. Graficos de tendencia temporal. Latencia de queries Firestore (p50/p95). Timing de Cloud Functions (p50/p95/count, agregado por `dailyMetrics`). Storage stats (bytes, archivos, barra de cuota). Filtros: periodo (hoy/7d/30d), dispositivo (all/mobile/desktop), conexion (all/wifi/4g/3g) |

---

## Cloud Functions (server-side)

### Funciones callable

| Funcion | Acceso | Descripcion | Timeout |
|---------|--------|-------------|---------|
| `createBackup` | admin | Firestore export → GCS (`modo-mapa-app-backups`) | 300s |
| `listBackups` | admin | Lista prefijos en GCS con paginacion (max 100/pagina) | 60s |
| `restoreBackup` | admin | Crea backup de seguridad pre-restore + Firestore import ← GCS | 300s |
| `deleteBackup` | admin | Elimina todos los archivos del backup en GCS | 120s |
| `approveMenuPhoto` | admin | Aprueba foto pendiente o rechazada. Cambia status a `approved`, registra `reviewedBy` y `reviewedAt` | 30s |
| `rejectMenuPhoto` | admin | Rechaza foto con razon obligatoria. Cambia status a `rejected` | 30s |
| `deleteMenuPhoto` | admin | Elimina archivos de Storage (original + thumbnail) y documento de Firestore | 60s |
| `reportMenuPhoto` | auth | Reporta foto. Crea doc en subcollection `reports/{userId}` (previene duplicados). Incrementa `reportCount` atomicamente | 30s |
| `respondToFeedback` | admin | Responde a feedback de usuario. Actualiza status a `responded`, guarda `adminResponse`/`respondedAt`/`respondedBy`. Crea notificacion `feedback_response` | 60s |
| `resolveFeedback` | admin | Marca feedback como resuelto. Actualiza status a `resolved`. Crea notificacion `feedback_response` | 60s |
| `createGithubIssueFromFeedback` | admin | Crea issue en GitHub desde feedback. Usa `@octokit/rest` + `GITHUB_TOKEN` secret. Mapea categoria a label (bug/enhancement/feedback). Guarda `githubIssueUrl` en doc. Previene duplicados | 30s |
| `getAuthStats` | admin | Consulta Firebase Auth para devolver breakdown de metodos de autenticacion (anonimos vs email) y stats de verificacion de email | 30s |
| `getStorageStats` | admin | Calcula total bytes y cantidad de archivos en `menuPhotos/` de Cloud Storage. Memory: 256MiB | 60s |

Todas las callable admin:

- Verifican admin (email + `email_verified`)
- Rate limit: 5 llamadas/minuto por usuario (Firestore-backed)
- `enforceAppCheck: !IS_EMULATOR` (deshabilitado en emuladores)
- Logging con email enmascarado

### Triggers

| Trigger | Coleccion | Acciones |
|---------|-----------|----------|
| `onCommentCreated` | `comments` | Rate limit (20/dia) + moderacion + increment parent `replyCount` (si es reply) + counters + notificacion `comment_reply` al autor del comentario padre (si es reply, respeta `notifyReplies` setting) |
| `onCommentUpdated` | `comments` | Re-moderacion del texto editado (flag/unflag) |
| `onCommentDeleted` | `comments` | Decrement parent `replyCount` (floor 0) + cascade delete orphaned replies + decrement counters |
| `onCommentLikeCreated` | `commentLikes` | Increment likeCount + rate limit (50/dia) + counters + notificacion al autor (si no es self-like) |
| `onCommentLikeDeleted` | `commentLikes` | Decrement likeCount + counters |
| `onCustomTagCreated` | `customTags` | Rate limit (10/business) + moderacion + counters |
| `onCustomTagDeleted` | `customTags` | Decrement counters |
| `onFeedbackCreated` | `feedback` | Rate limit (5/dia) + moderacion + counters |
| `onRatingWritten` | `ratings` | Counters (create/update/delete) |
| `onFavoriteCreated/Deleted` | `favorites` | Counters |
| `onUserCreated` | `users` | Counters |
| `onMenuPhotoCreated` | `menuPhotos` | Thumbnail generation con sharp + counters |
| `onPriceLevelCreated/Updated` | `priceLevels` | Counters |

### Scheduled

| Funcion | Schedule | Descripcion |
|---------|----------|-------------|
| `dailyMetrics` | 3:00 AM | Calcula distribucion, tops, active users, newAccounts. Agrega performance data: vitals (p50/p75/p95 de perfMetrics del dia anterior), queries (p50/p95), Cloud Function timings (de `config/perfCounters`). Reset daily counters + perfCounters |
| `cleanupRejectedPhotos` | Diario | Elimina fotos rechazadas con mas de 7 dias (Storage + Firestore) |
| `computeWeeklyRanking` | Lunes 4:00 AM | Calcula ranking semanal. Scoring: Comment=3, Rating=2, Like/Tag/Favorite=1, Photo=5 |
| `computeMonthlyRanking` | 1ro de mes 4:00 AM | Calcula ranking mensual con misma formula |
| `computeAlltimeRanking` | Lunes 5:00 AM | Calcula ranking historico all-time. Memory: 1GiB, timeout: 540s |
| `cleanupExpiredNotifications` | 5:00 AM | Elimina notificaciones expiradas (>30 dias) |

---

## Performance Metrics

- **Web Vitals capture**: LCP, INP, CLS, TTFB via `PerformanceObserver` API. Solo en produccion y si `analyticsEnabled`. Una sesion = un flush a Firestore (al `visibilitychange:hidden` o tras 30s timeout)
- **Query timing**: `measureAsync(name, fn)` wrapper que mide duracion de queries Firestore y acumula percentiles por sesion
- **Cloud Function timing**: `trackFunctionTiming(name, startMs)` acumula tiempos en `config/perfCounters` (array union). Actualmente instrumentado en `onRatingWritten` y `onCommentCreated`
- **Daily aggregation**: `dailyMetrics` lee `perfMetrics` del dia anterior + `config/perfCounters`, calcula p50/p75/p95 de vitals y queries, p50/p95/count de functions, y escribe en `dailyMetrics/{date}.performance`. Borra `config/perfCounters` post-agregacion
- **Admin panel**: tab Performance con semaforos (verde/amarillo/rojo), graficos de tendencia, tablas de latencia, storage stats
- **Thresholds** (`constants/performance.ts`): LCP green<=2500ms, INP green<=200ms, CLS green<=0.1, TTFB green<=800ms

---

## Staging environment

- **Named Firestore DB**: database `staging` en mismo proyecto Firebase (`modo-mapa-app`). Configurado via `VITE_FIRESTORE_DATABASE_ID=staging`
- **Multi-site hosting**: target `staging` en `firebase.json`, site `modo-mapa-staging` en `.firebaserc`
- **Deploy workflow**: `.github/workflows/deploy-staging.yml` — build con env staging + deploy `hosting:staging` en push a branch `staging`
- **Firebase config**: `src/config/firebase.ts` lee `VITE_FIRESTORE_DATABASE_ID` y pasa `databaseId` a `getFirestore()`. App Check deshabilitado en staging
- **Mismas rules/indexes**: staging usa los mismos `firestore.rules` y `firestore.indexes.json` que produccion
