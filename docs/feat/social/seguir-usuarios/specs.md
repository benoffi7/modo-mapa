# Specs: Seguir usuarios

**PRD:** [prd.md](prd.md)
**Fecha:** 2026-03-25

---

## Modelo de datos

### Coleccion `follows`

| Campo | Tipo | Descripcion |
|-------|------|-------------|
| `followerId` | `string` | UID del usuario que sigue |
| `followedId` | `string` | UID del usuario seguido |
| `createdAt` | `Timestamp` | Server timestamp |

**Doc ID:** `{followerId}__{followedId}` (patron existente en favorites, ratings, commentLikes).

**Indexes:**

- `followerId, createdAt desc` (listar seguidos de un usuario)
- `followedId, createdAt desc` (listar followers de un usuario)

### Coleccion `activityFeed/{userId}/items`

Subcollection bajo un doc virtual por usuario. Fan-out write desde Cloud Functions.

| Campo | Tipo | Descripcion |
|-------|------|-------------|
| `actorId` | `string` | UID del usuario que realizo la accion |
| `actorName` | `string` | displayName del actor al momento del write |
| `type` | `'rating' \| 'comment' \| 'favorite'` | Tipo de actividad |
| `businessId` | `string` | Comercio relacionado |
| `businessName` | `string` | Nombre del comercio |
| `referenceId` | `string` | ID del doc original (rating/comment/favorite) |
| `createdAt` | `Timestamp` | Server timestamp |
| `expiresAt` | `Timestamp` | createdAt + 30 dias |

**Doc ID:** auto-generated.

**Indexes:**

- `activityFeed/{userId}/items`: `createdAt desc` (feed paginado)

### Campo `displayNameLower` en `users`

Agregar campo `displayNameLower: string` (lowercase del displayName) para busqueda case-insensitive. Se actualiza en Cloud Function `onUserCreated` y cuando el usuario edita su nombre.

### Campos en `users`

Agregar a doc de usuario (gestionados por Cloud Functions):

- `followersCount: number` (default 0)
- `followingCount: number` (default 0)

### TypeScript interfaces

```typescript
// src/types/index.ts
export interface Follow {
  followerId: string;
  followedId: string;
  createdAt: Date;
}

export type ActivityType = 'rating' | 'comment' | 'favorite';

export interface ActivityFeedItem {
  id: string;
  actorId: string;
  actorName: string;
  type: ActivityType;
  businessId: string;
  businessName: string;
  referenceId: string;
  createdAt: Date;
  expiresAt: Date;
}
```

---

## Firestore Rules

```javascript
// follows collection
match /follows/{docId} {
  allow read: if request.auth != null;
  allow create: if request.auth != null
    && request.auth.uid == request.resource.data.followerId
    && request.resource.data.keys().hasOnly(['followerId', 'followedId', 'createdAt'])
    && request.resource.data.createdAt == request.time;
  allow delete: if request.auth != null
    && request.auth.uid == resource.data.followerId;
  allow update: if false;
}

// activityFeed subcollection — read only by owner, write only by Functions
match /activityFeed/{userId}/items/{itemId} {
  allow read: if request.auth != null && request.auth.uid == userId;
  allow write: if false; // Cloud Functions use Admin SDK
}

// users — add followersCount/followingCount to existing rules
// These fields are managed by Cloud Functions only, not writable by client.
```

---

## Cloud Functions

### `onFollowCreated` (trigger: `follows/{docId}`)

1. Rate limit check: 50 follows/day per `followerId` (patron `checkRateLimit` con `collection: 'follows', limit: 50, windowType: 'daily'`).
2. Si excedido, delete el doc y return.
3. Validar que `followedId` tiene `profilePublic: true` en `userSettings`. Si no, delete y return.
4. Validar que `followingCount` del follower no supere 200. Si supera, delete y return.
5. Increment `followingCount` en `users/{followerId}`.
6. Increment `followersCount` en `users/{followedId}`.
7. Increment counter global `follows`.
8. `trackWrite(db, 'follows')`.
9. Crear notificacion tipo `new_follower` para el followed user.

### `onFollowDeleted` (trigger: `follows/{docId}`)

1. Decrement `followingCount` en `users/{followerId}` (floor 0).
2. Decrement `followersCount` en `users/{followedId}` (floor 0).
3. Decrement counter global `follows`.
4. `trackDelete(db, 'follows')`.

### Fan-out en triggers existentes

Extender `onRatingWritten`, `onCommentCreated`, `onFavoriteCreated`:

1. Al crear un rating/comment/favorite, consultar `follows` donde `followedId == actorUserId`.
2. Para cada follower, verificar que el actor tenga `profilePublic: true` en `userSettings`.
3. Escribir un doc en `activityFeed/{followerId}/items/` con los datos de la actividad.
4. Batch writes de max 500 docs por batch (Firestore limit).

### `cleanupActivityFeed` (scheduled: `0 5 * * *`)

Patron de `cleanupRejectedPhotos`. Eliminar docs de `activityFeed` donde `expiresAt < now()`. Iterar todas las subcollections usando collection group query.

### Migracion: `displayNameLower`

Cloud Function one-off (o script) para popular `displayNameLower` en todos los docs de `users` existentes. Tambien extender `onUserCreated` y el servicio client de edicion de nombre para mantenerlo sincronizado.

---

## Componentes

### `FollowButton`

- **Props:** `{ userId: string; size?: 'small' | 'medium' }`
- **Donde:** `UserProfileSheet` (bottom sheet de perfil publico existente)
- **Comportamiento:** Toggle follow/unfollow con optimistic UI. Patron de `FavoriteButton` con derived state (`prevIsFollowing` + `optimistic`). Deshabilitado si es el propio usuario. Usa `useFollow` hook.

### `FollowedList`

- **Props:** `{ onSelectUser: (userId: string) => void }`
- **Donde:** SideMenu, seccion "Seguidos" (nuevo item de nav). Lazy-loaded con `React.lazy()`.
- **Comportamiento:** Lista de usuarios seguidos con avatar placeholder, displayName, badge de ranking (top 3). Campo de busqueda de usuarios con `useDeferredValue`. Pull-to-refresh con `usePullToRefresh`. Click abre perfil publico.

### `UserSearchField`

- **Props:** `{ onSelect: (userId: string) => void }`
- **Donde:** Dentro de `FollowedList`.
- **Comportamiento:** TextField con debounce (`useDeferredValue`). Query `useUserSearch`. Muestra resultados en lista desplegable. Mensaje generico "No se encontro" sin revelar existencia de cuentas privadas.

### `ActivityFeedView`

- **Props:** `{ onSelectBusiness: (businessId: string) => void }`
- **Donde:** SideMenu, seccion "Actividad" (nuevo item de nav, debajo de Seguidos). Lazy-loaded.
- **Comportamiento:** Feed paginado con `usePaginatedQuery`. Skeleton loader. Pull-to-refresh. Click en item navega al comercio via `onSelectBusiness`. Cada item muestra: avatar, actorName, tipo de accion (icono + texto), businessName, tiempo relativo.

### `ActivityFeedItem` (componente de fila)

- **Props:** `{ item: ActivityFeedItem; onSelect: (businessId: string) => void }`
- **Donde:** Dentro de `ActivityFeedView`.
- **Comportamiento:** `ListItem` con icono por tipo (Star para rating, ChatBubble para comment, Favorite para favorite), texto descriptivo, tiempo relativo con `formatRelativeTime`.

### Extension de `UserProfileSheet`

- Agregar `followersCount` y `followingCount` al bottom sheet existente.
- Agregar `FollowButton`.
- Agregar tab/seccion de favoritos publicos (query `favorites` donde `userId == profileUserId`).

---

## Hooks

### `useFollow`

```typescript
function useFollow(targetUserId: string): {
  isFollowing: boolean;
  isLoading: boolean;
  toggleFollow: () => Promise<void>;
  followersCount: number;
  followingCount: number;
}
```

- **Dependencias:** `useAuth`, `useConnectivity`, `useToast`.
- **Patron:** Derived state optimistic (como `FavoriteButton`). `prevIsFollowing` ref + `optimistic` state.
- **Offline:** Usa `withOfflineSupport` para encolar follow/unfollow.
- **Cache:** Invalidar query cache de follows al toggle.

### `useUserSearch`

```typescript
function useUserSearch(searchTerm: string): {
  results: Array<{ userId: string; displayName: string }>;
  isLoading: boolean;
}
```

- **Dependencias:** `db`, `COLLECTIONS`.
- **Query:** `users` donde `displayNameLower >= term.toLowerCase()` y `displayNameLower < term.toLowerCase() + '\uf8ff'`, filtrado client-side por `profilePublic: true` via join con `userSettings`.
- **Debounce:** Caller usa `useDeferredValue`.
- **Privacidad:** Solo retorna usuarios con `profilePublic: true`. Nunca expone existencia de cuentas privadas.

### `useActivityFeed`

```typescript
function useActivityFeed(): {
  items: ActivityFeedItem[];
  isLoading: boolean;
  hasMore: boolean;
  loadMore: () => void;
  refresh: () => void;
}
```

- **Dependencias:** `usePaginatedQuery` con subcollection `activityFeed/{userId}/items`.
- **Paginacion:** 20 items por pagina, `orderBy('createdAt', 'desc')`.
- **Cache:** First-page cache via `usePaginatedQuery` (2 min TTL).

---

## Servicios

### `src/services/follows.ts`

```typescript
export function getFollowsCollection(): CollectionReference<Follow>;
export function followUser(followerId: string, followedId: string): Promise<void>;
export function unfollowUser(followerId: string, followedId: string): Promise<void>;
export async function isFollowing(followerId: string, followedId: string): Promise<boolean>;
export async function fetchFollowing(userId: string): Promise<Follow[]>;
export async function fetchFollowers(userId: string): Promise<Follow[]>;
export async function searchUsers(term: string): Promise<Array<{ userId: string; displayName: string }>>;
```

- `followUser`: `setDoc` con doc ID `{followerId}__{followedId}`. Invalida query cache. `trackEvent('follow', ...)`.
- `unfollowUser`: `deleteDoc`. Invalida query cache. `trackEvent('unfollow', ...)`.
- `isFollowing`: `getDoc` del doc compuesto, return `exists`.
- `fetchFollowing`/`fetchFollowers`: Query con `where` + `orderBy('createdAt', 'desc')`.
- `searchUsers`: Query `users` con `displayNameLower` prefix match. Join con `userSettings` para filtrar `profilePublic: true`.

### `src/services/activityFeed.ts`

```typescript
export function getActivityFeedCollection(userId: string): CollectionReference<ActivityFeedItem>;
```

Solo expone la collection ref con converter. La paginacion la maneja `usePaginatedQuery` desde el hook.

---

## Integracion

### Archivos existentes a modificar

| Archivo | Cambio |
|---------|--------|
| `src/types/index.ts` | Agregar `Follow`, `ActivityType`, `ActivityFeedItem` interfaces |
| `src/types/offline.ts` | Agregar `'follow_add' \| 'follow_remove'` a `OfflineActionType`, agregar `FollowPayload` |
| `src/config/collections.ts` | Agregar `FOLLOWS: 'follows'`, `ACTIVITY_FEED: 'activityFeed'` |
| `src/config/converters.ts` | Agregar `followConverter`, `activityFeedItemConverter` |
| `src/constants/analyticsEvents.ts` | Agregar `EVT_FOLLOW`, `EVT_UNFOLLOW`, `EVT_FEED_VIEWED`, `EVT_FEED_ITEM_CLICKED` |
| `src/services/syncEngine.ts` | Agregar handler para `follow_add`/`follow_remove` |
| `src/services/userProfile.ts` | Agregar `followersCount`, `followingCount` a `UserProfileData` |
| `src/components/SideMenu.tsx` | Agregar items de nav "Seguidos" y "Actividad", lazy imports |
| `firestore.rules` | Agregar reglas para `follows` y `activityFeed` |
| `functions/src/index.ts` | Exportar nuevos triggers y scheduled function |
| `functions/src/triggers/ratings.ts` | Agregar fan-out write al feed |
| `functions/src/triggers/comments.ts` | Agregar fan-out write al feed |
| `functions/src/triggers/favorites.ts` | Agregar fan-out write al feed |
| `functions/src/triggers/users.ts` | Agregar `displayNameLower` al crear usuario |
| `functions/src/utils/notifications.ts` | Agregar `'new_follower'` a `NotificationType` y `TYPE_TO_SETTING` |

---

## Tests

| Archivo test | Que testear | Tipo |
|-------------|-------------|------|
| `src/services/follows.test.ts` | followUser, unfollowUser, isFollowing, fetchFollowing, fetchFollowers, searchUsers. Validacion de inputs, cache invalidation, analytics tracking | Service |
| `src/services/activityFeed.test.ts` | getActivityFeedCollection con converter | Service |
| `src/hooks/useFollow.test.ts` | Optimistic toggle, error rollback, offline queueing, self-follow prevention | Hook |
| `src/hooks/useUserSearch.test.ts` | Query construction, privacy filter, empty results message | Hook |
| `src/hooks/useActivityFeed.test.ts` | Paginacion, refresh, empty state | Hook |
| `functions/src/triggers/follows.test.ts` | Counter increment/decrement, rate limit (50/dia), max 200 validation, profilePublic check, floor 0 decrement, notification creation | Trigger |
| `functions/src/triggers/comments.test.ts` (extension) | Fan-out write a activityFeed de followers | Trigger |
| `functions/src/triggers/ratings.test.ts` (extension) | Fan-out write a activityFeed de followers | Trigger |
| `functions/src/scheduled/cleanupActivityFeed.test.ts` | Eliminacion de items con expiresAt pasado | Scheduled |

### Mock strategy

- Firestore: mock SDK functions (`getDoc`, `setDoc`, `deleteDoc`, `getDocs`, `collection`, `doc`, `query`, `where`)
- Analytics: mock `trackEvent`
- Auth: mock `useAuth()` context
- Offline: mock `withOfflineSupport` y `useConnectivity`
- Notifications: mock `createNotification` en tests de triggers

### Criterio de aceptacion

- Cobertura >= 80% del codigo nuevo
- Todos los paths condicionales cubiertos (rate limit, max follows, profilePublic check, offline, error rollback)
- Tests de validacion para todos los inputs del usuario

---

## Analytics

| Evento | Parametros | Donde |
|--------|------------|-------|
| `EVT_FOLLOW` (`follow`) | `{ target_user_id: string }` | `services/follows.ts` en `followUser` |
| `EVT_UNFOLLOW` (`unfollow`) | `{ target_user_id: string }` | `services/follows.ts` en `unfollowUser` |
| `EVT_FEED_VIEWED` (`feed_viewed`) | `{}` | `ActivityFeedView` al montar |
| `EVT_FEED_ITEM_CLICKED` (`feed_item_clicked`) | `{ type: ActivityType, business_id: string }` | `ActivityFeedItem` al click |

---

## Offline

### Cache strategy

| Dato | Estrategia | TTL | Storage |
|------|-----------|-----|---------|
| Lista de seguidos | Firestore persistent cache | Indefinido (stale OK) | IndexedDB (Firestore SDK) |
| Feed de actividad | Firestore persistent cache (subcollection del usuario) | Indefinido (stale OK) | IndexedDB (Firestore SDK) |
| isFollowing (doc individual) | Firestore persistent cache | Indefinido | IndexedDB (Firestore SDK) |
| Busqueda de usuarios | No cacheable offline | N/A | N/A |
| First page cache (feed) | `usePaginatedQuery` cache | 2 min | Module-level Map |

### Writes offline

| Operacion | Mecanismo | Conflict resolution |
|-----------|-----------|-------------------|
| Follow user | `withOfflineSupport` tipo `follow_add` | Last-write-wins (setDoc idempotente por doc ID compuesto) |
| Unfollow user | `withOfflineSupport` tipo `follow_remove` | Last-write-wins (deleteDoc idempotente) |

### Fallback UI

- **Busqueda de usuarios offline:** Alert "Necesitas conexion para buscar usuarios" (patron existente de offline alerts).
- **Lista de seguidos offline:** Muestra datos cacheados. Pull-to-refresh deshabilitado.
- **Feed offline:** Muestra items cacheados. Pull-to-refresh deshabilitado.
- **FollowButton offline:** Optimistic UI + indicador de accion pendiente via `OfflineIndicator` global.

---

## Decisiones tecnicas

### Fan-out vs query-time join para el feed

**Elegido:** Fan-out write (una entrada por follower en subcollection).
**Razon:** Permite queries simples sin joins, compatible con Firestore persistent cache, y escalable. El costo es mas escrituras, pero el read pattern es mucho mas simple y rapido.
**Alternativa rechazada:** Query-time join (buscar follows, luego buscar actividad de cada followed). Demasiadas queries, no paginable eficientemente, incompatible con offline.

### Subcollection vs top-level collection para activityFeed

**Elegido:** Subcollection `activityFeed/{userId}/items`.
**Razon:** Security rules simples (read solo por owner). Cache aislado por usuario. No necesita collection group queries para reads normales.
**Alternativa rechazada:** Top-level `activityFeed` con campo `recipientId`. Requiere index compuesto y security rules mas complejas.

### displayNameLower vs Cloud Function search

**Elegido:** Campo `displayNameLower` con prefix match.
**Razon:** No requiere extensiones externas (Algolia, Typesense). Suficiente para la escala actual (~40 comercios, pocos usuarios). Patron simple y predecible.
**Alternativa rechazada:** Full-text search service. Overkill para la escala actual.

### Counters en `users` vs doc separado

**Elegido:** Campos `followersCount`/`followingCount` directamente en doc `users/{userId}`.
**Razon:** Ya se lee el doc de usuario para el perfil publico. Evita un read extra. Patron consistente con `likeCount` en comments y `replyCount`.
**Nota:** Requiere que las Firestore rules de `users` permitan que Cloud Functions (Admin SDK) escriban estos campos. Como Admin SDK bypasses rules, no hay cambio necesario en rules.
