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

- Header con avatar, nombre, boton editar nombre
- Todas las secciones lazy-loaded via `React.lazy()` + `Suspense` con spinner fallback (reduce main chunk ~25%)
- Secciones:
  - **Recientes**: ultimos 20 comercios visitados (localStorage). Click navega al comercio en el mapa
  - **Sugeridos para vos**: sugerencias personalizadas via `useSuggestions` hook + `services/suggestions.ts`. Fetch de favoritos, ratings y tags del usuario → scoring client-side (Haversine para cercania). Pesos en `constants/suggestions.ts` (`SUGGESTION_WEIGHTS`): categoria=3, tags=2, cercania=1, penalizacion por ya favorito=-5 o ya calificado=-3. Chips de razon (categoria, tags, cercania). Max 10 sugerencias. Componente: `SuggestionsView.tsx`
  - **Favoritos**: lista con filtros (busqueda, categoria, orden). Quitar favorito inline. Click navega al comercio
  - **Comentarios**: lista con texto truncado. Eliminar con undo (5s). Click navega al comercio
  - **Calificaciones**: lista con estrellas y filtros (busqueda, categoria, estrellas minimas, orden). Click navega al comercio
  - **Rankings**: ranking semanal/mensual con scoring por actividad. Cards con medallas y barra de progreso. "Tu actividad" con desglose de puntos (en vivo si no estas en ranking pre-computado)
  - **Feedback**: formulario con categoria (bug/sugerencia/otro) + mensaje (max 1000). Estado de exito
  - **Estadisticas**: distribucion de ratings (pie), tags mas usados (pie), top 10 favoriteados/comentados/calificados. Usa `usePublicMetrics` + componentes de `stats/`
  - **Configuracion**: panel con toggles de privacidad (perfil publico/privado) y notificaciones (master + likes/fotos/rankings). Defaults todos en false. Optimistic UI con revert on error
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
- Tipos: `like`, `photo_approved`, `photo_rejected`, `ranking`
- Generadas automaticamente por Cloud Functions triggers
- Expiran a los 30 dias (cleanup diario)

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
- 9 tabs con paneles que usan `useAsyncData` + `AdminPanelWrapper`:

| Tab | Descripcion |
|-----|-------------|
| **Overview** | Totales (comercios, usuarios, comentarios, ratings, favoritos, feedback), distribucion de ratings (pie), tags mas usados (pie), top 10 comercios, custom tags candidatas a promover |
| **Actividad** | Feed por seccion (comentarios, ratings, favoritos, tags) con ultimos 20 items, indicador de flagged |
| **Feedback** | Tabla de feedback recibido con categoria (bug/sugerencia/otro), mensaje, estado flagged |
| **Tendencias** | Graficos de evolucion temporal con selector dia/semana/mes/ano — actividad por tipo, usuarios activos, total escrituras. Click en leyenda para mostrar/ocultar series |
| **Usuarios** | Rankings top 10 por metrica (comentarios, ratings, favoritos, tags, feedback, total), stats generales (total, activos, promedio acciones) |
| **Firebase Usage** | Graficos lineales de reads/writes/deletes y usuarios activos (ultimos 30 dias), pie charts por coleccion, barras de cuota vs free tier |
| **Alertas** | Logs de abuso (rate limit excedido, contenido flaggeado, top writers) |
| **Backups** | Crear backup manual, listar con paginacion (20/pagina), restaurar con backup de seguridad automatico, eliminar con confirmacion. Usa Cloud Functions callable |
| **Fotos** | Panel de revision de fotos de menu. Filtro por status (todas/pendientes/aprobadas/rechazadas) con contadores. Acciones contextuales por status: aprobar pendientes/rechazadas, rechazar con razon, eliminar aprobadas/rechazadas. Badge de reportes en cada card |

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

Todas las callable admin:

- Verifican admin (email + `email_verified`)
- Rate limit: 5 llamadas/minuto por usuario (Firestore-backed)
- `enforceAppCheck: !IS_EMULATOR` (deshabilitado en emuladores)
- Logging con email enmascarado

### Triggers

| Trigger | Coleccion | Acciones |
|---------|-----------|----------|
| `onCommentCreated` | `comments` | Rate limit (20/dia) + moderacion + increment parent `replyCount` (si es reply) + counters |
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
| `dailyMetrics` | 3:00 AM | Calcula distribucion, tops, active users. Reset daily counters |
| `cleanupRejectedPhotos` | Diario | Elimina fotos rechazadas con mas de 7 dias (Storage + Firestore) |
| `computeWeeklyRanking` | Lunes 4:00 AM | Calcula ranking semanal. Scoring: Comment=3, Rating=2, Like/Tag/Favorite=1, Photo=5 |
| `computeMonthlyRanking` | 1ro de mes 4:00 AM | Calcula ranking mensual con misma formula |
| `cleanupExpiredNotifications` | 5:00 AM | Elimina notificaciones expiradas (>30 dias) |
