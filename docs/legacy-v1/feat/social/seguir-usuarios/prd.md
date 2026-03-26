# PRD: Seguir usuarios

**Feature:** seguir-usuarios
**Categoria:** social
**Fecha:** 2026-03-25
**Issue:** #129
**Prioridad:** Media

---

## Contexto

Modo Mapa (v2.27.5) tiene funcionalidades sociales maduras: comentarios con threads, likes, perfil publico con stats y badges, rankings con tiers, y listas compartidas/colaborativas. Sin embargo, no existe conexion entre usuarios individuales. El issue #129 propone permitir seguir usuarios para ver su actividad en un feed, completando el circuito social de la app.

## Problema

- El descubrimiento de comercios depende exclusivamente de rankings globales, sugerencias algoritmicas y busqueda. No hay forma de descubrir comercios a traves de personas de confianza.
- El perfil publico existente (bottom sheet con stats, badges, comentarios recientes) es de solo lectura -- no permite establecer una relacion con el usuario.
- No existe concepto de red social dentro de la app, a pesar de tener toda la infraestructura social necesaria (comentarios, ratings, likes, listas).

## Solucion

### S1: Modelo de follows en Firestore

- Coleccion `follows` con doc ID compuesto `{followerId}__{followedId}` (patron existente en favoritos, ratings, commentLikes).
- Campos: `followerId`, `followedId`, `createdAt` (server timestamp).
- Relacion unidireccional (seguir, no amistad).
- Counters server-side: `followersCount` y `followingCount` en doc de usuario, gestionados por Cloud Function triggers `onFollowCreated`/`onFollowDeleted` (patron existente en `onCommentLikeCreated`/`Deleted`).
- Rate limit: 50 follows/dia por usuario (trigger, patron existente en `commentLikes`).
- Max follows por usuario: 200 (validacion client + rules).

### S2: Buscar y seguir usuarios

- Boton "Seguir" en el perfil publico existente (bottom sheet). Toggle follow/unfollow con optimistic UI (patron de `FavoriteButton` con derived state).
- Solo usuarios con `profilePublic: true` pueden ser seguidos. Si un usuario cambia a privado, los follows existentes se mantienen pero el feed deja de mostrar su actividad.
- Busqueda de usuarios: campo en seccion "Seguidos" del menu lateral. Query a Firestore por `displayName` (case-insensitive via campo normalizado `displayNameLower`). Solo muestra resultados con `profilePublic: true`. Si no hay resultados: mensaje generico "No se encontro" con hint "Quizas el usuario no tenga el perfil publico". Nunca exponer si la cuenta existe.
- Seccion "Seguidos" en menu lateral: lista de usuarios seguidos con avatar, nombre, badge de ranking (si top 3). Click abre perfil publico. Pull-to-refresh. Lazy-loaded via `React.lazy()`.

### S3: Feed de actividad

- Seccion "Actividad" en menu lateral (debajo de "Seguidos" o como tab dentro de la misma seccion).
- Muestra acciones recientes de usuarios seguidos: nuevo rating, nuevo comentario, nuevo favorito.
- Coleccion `activityFeed` con docs generados por Cloud Functions triggers (cuando un usuario seguido realiza una accion). Campos: `actorId`, `actorName`, `type` (rating/comment/favorite), `businessId`, `businessName`, `createdAt`.
- Alternativa mas eficiente: fan-out write. Al crear rating/comment/favorite, el trigger consulta los followers del actor y escribe una entrada por follower en `activityFeed/{followerId}/items/{activityId}`. Esto permite queries simples por follower sin joins.
- Feed paginado con `usePaginatedQuery` (patron existente). Max 20 items por pagina.
- Click en item del feed navega al comercio en el mapa.
- Expiracion: items del feed expiran a los 30 dias (cleanup scheduled, patron de `cleanupExpiredNotifications`).
- Skeleton loader mientras carga (patron existente).

### S4: Extension del perfil publico

- Agregar followers/following counts al bottom sheet de perfil publico existente.
- Boton "Seguir" / "Siguiendo" con optimistic UI.
- Tab o seccion de comercios favoritos publicos del usuario (solo si `profilePublic: true`).

---

## Scope

| Item | Prioridad | Esfuerzo |
|------|-----------|----------|
| Coleccion `follows` + Firestore rules + tipo TS | Alta | S |
| Cloud Function triggers `onFollowCreated`/`Deleted` (counters + rate limit) | Alta | M |
| Servicio `services/follows.ts` (follow, unfollow, getFollowers, getFollowing, isFollowing) | Alta | S |
| Hook `useFollow` (optimistic toggle, derived state) | Alta | S |
| Boton Seguir en perfil publico (bottom sheet) | Alta | S |
| Seccion "Seguidos" en SideMenu (lista + busqueda usuarios) | Alta | M |
| Campo `displayNameLower` en users + migracion | Alta | S |
| Fan-out Cloud Function para generar feed (en triggers de rating/comment/favorite) | Alta | L |
| Seccion "Actividad" en SideMenu (feed paginado) | Alta | M |
| Scheduled cleanup de feed items expirados (30 dias) | Media | S |
| Extension perfil publico (counts + favoritos publicos) | Media | M |
| Notificacion "X empezo a seguirte" (tipo `new_follower`) | Media | S |
| Analytics events (follow, unfollow, feed_viewed, feed_item_clicked) | Media | S |

**Esfuerzo total estimado:** XL

---

## Out of Scope

- Mensajeria directa entre usuarios.
- Sugerencias de "a quien seguir" (puede ser issue futuro).
- Feed algoritmico (solo cronologico por ahora).
- Importar contactos del telefono.
- Follows mutuos / concepto de "amigos".
- Notificaciones push (solo in-app).

---

## Tests

### Archivos que necesitaran tests

| Archivo | Tipo | Que testear |
|---------|------|-------------|
| `src/services/follows.ts` | Service | follow/unfollow CRUD, isFollowing, getFollowers/getFollowing con paginacion, busqueda por displayName |
| `src/hooks/useFollow.ts` | Hook | Optimistic toggle, derived state, error rollback |
| `functions/src/triggers/follows.ts` | Trigger | Counter increment/decrement, rate limit (50/dia), floor 0 en decrement |
| `functions/src/triggers/comments.ts` (extension) | Trigger | Fan-out write a activityFeed de followers |
| `functions/src/triggers/ratings.ts` (extension) | Trigger | Fan-out write a activityFeed de followers |
| `functions/src/scheduled/cleanupActivityFeed.ts` | Scheduled | Eliminacion de items > 30 dias |
| `src/services/activityFeed.ts` | Service | Fetch paginado, tipos de actividad |

### Criterios de testing

- Cobertura >= 80% del codigo nuevo
- Tests de validacion para todos los inputs del usuario
- Todos los paths condicionales cubiertos
- Side effects verificados (cache, analytics, notifications)

---

## Seguridad

- [ ] Firestore rules para `follows`: auth requerida, ownership (`followerId == request.auth.uid`), `keys().hasOnly(['followerId', 'followedId', 'createdAt'])`, timestamp server-side
- [ ] Firestore rules para `activityFeed/{userId}/items`: read solo por owner, write solo por Functions
- [ ] Busqueda de usuarios: nunca exponer existencia de cuenta privada. Mensaje generico "No se encontro"
- [ ] Rate limit server-side: 50 follows/dia (Cloud Function trigger)
- [ ] `displayNameLower` solo para busqueda, no expone datos adicionales
- [ ] Fan-out writes: solo Cloud Functions escriben al feed (no el cliente)
- [ ] Counters `followersCount`/`followingCount` gestionados exclusivamente por Cloud Functions (server-only, patron de `replyCount`/`likeCount`)
- [ ] Doc ID compuesto `{followerId}__{followedId}` previene duplicados sin query extra

---

## Offline

### Data flows

| Operacion | Tipo (read/write) | Estrategia offline | Fallback UI |
|-----------|-------------------|-------------------|-------------|
| Follow/unfollow | write | Encolar con `withOfflineSupport` (tipo `follow`/`unfollow`) | Optimistic UI + indicador pendiente |
| Listar seguidos | read | Firestore persistent cache (prod) | Datos cacheados, stale OK |
| Buscar usuarios | read | No soportado offline (requiere query server) | Alert "Necesitas conexion para buscar usuarios" |
| Feed de actividad | read | Firestore persistent cache (subcollection del usuario) | Datos cacheados, pull-to-refresh al reconectar |

### Checklist offline

- [ ] Reads de Firestore: usan persistencia offline (subcollection `activityFeed/{userId}/items` cacheable)
- [ ] Writes: follow/unfollow con `withOfflineSupport` wrapper + optimistic UI
- [ ] APIs externas: N/A (todo Firestore)
- [ ] UI: OfflineIndicator existente cubre el estado global
- [ ] Datos criticos: lista de seguidos cacheable para primera carga

### Esfuerzo offline adicional: S

---

## Modularizacion

La solucion debe mantener separacion estricta UI/logica:

- `useFollow` hook encapsula toda la logica de follow/unfollow, isFollowing, optimistic state
- `useActivityFeed` hook maneja fetch paginado del feed, sin logica en componentes de layout
- `useUserSearch` hook encapsula busqueda por displayName, filtro profilePublic
- `FollowButton`, `FollowedList`, `ActivityFeed` son componentes puros que reciben datos via props/hooks

### Checklist modularizacion

- [ ] Logica de negocio en hooks/services (no inline en componentes de layout)
- [ ] Componentes nuevos son reutilizables fuera del contexto actual de layout
- [ ] No se agregan useState de logica de negocio a AppShell o SideMenu
- [ ] Props explicitas en vez de dependencias implicitas a contextos de layout

---

## Success Criteria

1. Un usuario puede buscar y seguir a otro usuario con perfil publico desde el perfil o la seccion "Seguidos".
2. El feed muestra actividad reciente (ratings, comentarios, favoritos) de usuarios seguidos, paginado y con click-to-navigate.
3. El perfil publico muestra contadores de followers/following y boton de follow con optimistic UI.
4. Un usuario puede dejar de seguir en cualquier momento desde el perfil o la lista de seguidos.
5. La privacidad se respeta: usuarios privados no aparecen en busqueda ni exponen su existencia. Feed no muestra actividad de usuarios que cambiaron a privado.
