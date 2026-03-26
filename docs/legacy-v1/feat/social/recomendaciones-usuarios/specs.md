# Specs: Recomendaciones entre usuarios

**PRD:** [prd.md](prd.md)
**Fecha:** 2026-03-25

---

## Modelo de datos

### Coleccion `recommendations`

```text
recommendations/{autoId}
  senderId:     string    // userId del remitente (== auth.uid en create)
  senderName:   string    // displayName del remitente (denormalizado)
  recipientId:  string    // userId del destinatario
  businessId:   string    // ID del comercio recomendado
  businessName: string    // nombre del comercio (denormalizado)
  message:      string    // mensaje opcional, max 200 chars (string vacio si no hay)
  read:         boolean   // false por default, true al abrir
  createdAt:    Timestamp // serverTimestamp()
```

**Doc ID:** auto-generated (un usuario puede recomendar el mismo comercio multiples veces).

**Indices necesarios:**

- `recipientId ASC, createdAt DESC` -- query principal: recomendaciones recibidas por fecha
- `recipientId ASC, read ASC, createdAt DESC` -- count de no leidas (composite)
- `senderId ASC, createdAt DESC` -- rate limit precheck (contar recomendaciones del dia)

### TypeScript interface

Agregar a `src/types/index.ts`:

```typescript
export interface Recommendation {
  id: string;
  senderId: string;
  senderName: string;
  recipientId: string;
  businessId: string;
  businessName: string;
  message: string;
  read: boolean;
  createdAt: Date;
}
```

### Cambio en `UserSettings`

Agregar campo a la interface existente en `src/types/index.ts`:

```typescript
export interface UserSettings {
  // ... campos existentes ...
  notifyRecommendations: boolean;  // default true
  // ...
}
```

### Cambio en `NotificationType`

Agregar `'recommendation'` a la union type existente:

```typescript
export type NotificationType = 'like' | 'photo_approved' | 'photo_rejected' | 'ranking'
  | 'feedback_response' | 'comment_reply' | 'new_follower' | 'recommendation';
```

---

## Firestore Rules

### Nueva regla para `recommendations`

```javascript
// Recomendaciones entre usuarios — destinatario o admin puede leer.
// Remitente puede crear. Destinatario puede marcar como leida. No deletes.
match /recommendations/{docId} {
  allow read: if request.auth != null
    && (resource.data.recipientId == request.auth.uid || isAdmin());
  allow create: if request.auth != null
    && request.resource.data.keys().hasOnly(['senderId', 'recipientId', 'businessId', 'businessName', 'senderName', 'message', 'read', 'createdAt'])
    && request.resource.data.senderId == request.auth.uid
    && request.resource.data.senderId != request.resource.data.recipientId
    && request.resource.data.recipientId is string
    && request.resource.data.recipientId.size() > 0
    && isValidBusinessId(request.resource.data.businessId)
    && request.resource.data.businessName is string
    && request.resource.data.businessName.size() > 0
    && request.resource.data.businessName.size() <= 100
    && request.resource.data.senderName is string
    && request.resource.data.senderName.size() > 0
    && request.resource.data.senderName.size() <= 30
    && request.resource.data.message is string
    && request.resource.data.message.size() <= 200
    && request.resource.data.read == false
    && request.resource.data.createdAt == request.time;
  allow update: if request.auth != null
    && resource.data.recipientId == request.auth.uid
    && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['read'])
    && request.resource.data.read == true;
  allow delete: if false;
}
```

### Cambio en `userSettings` rule

Agregar `notifyRecommendations` a la lista de `keys().hasOnly(...)` y agregar validacion booleana:

```javascript
match /userSettings/{userId} {
  allow write: if request.auth != null && request.auth.uid == userId
    && request.resource.data.keys().hasOnly([
      'profilePublic', 'notificationsEnabled', 'notifyLikes', 'notifyPhotos',
      'notifyRankings', 'notifyFeedback', 'notifyReplies', 'notifyFollowers',
      'notifyRecommendations',  // NUEVO
      'analyticsEnabled', 'locality', 'localityLat', 'localityLng', 'updatedAt'
    ])
    // ... validaciones existentes ...
    && request.resource.data.notifyRecommendations is bool  // NUEVO (o condicion opcional)
    // ...
}
```

### Rules impact analysis

| Coleccion | Operacion | Cambio | Impacto |
|-----------|-----------|--------|---------|
| `recommendations` | read | Nueva regla | Solo recipientId o admin |
| `recommendations` | create | Nueva regla | Solo senderId == auth.uid, no self-recommend, fields validados |
| `recommendations` | update | Nueva regla | Solo recipientId puede marcar `read: true` |
| `recommendations` | delete | Nueva regla | Bloqueado (false) |
| `userSettings` | write | Modificacion | Agregar `notifyRecommendations` a hasOnly + validacion bool |

---

## Cloud Functions

### Trigger `onRecommendationCreated`

**Path:** `recommendations/{docId}`
**Trigger:** `onDocumentCreated`

**Logica:**

1. Extraer `senderId`, `recipientId`, `businessId`, `businessName`, `senderName`, `message` del documento.
2. **Rate limit:** `checkRateLimit(db, { collection: 'recommendations', limit: 20, windowType: 'daily' }, senderId)`. Si excede, eliminar doc + `logAbuse`.
3. **Self-recommend guard:** Si `senderId === recipientId`, eliminar doc (defense in depth, rules ya lo bloquean).
4. **Moderacion mensaje:** Si `message` no vacio, `checkModeration(db, message)`. Si flagged, eliminar doc + `logAbuse`.
5. **Notificacion:** Llamar `createNotification(db, { userId: recipientId, type: 'recommendation', message: '{senderName} te recomienda {businessName}', actorId: senderId, actorName: senderName, businessId, businessName })`.
6. **Counter:** `incrementCounter(db, 'recommendations', 1)` + `trackWrite(db, 'recommendations')`.

---

## Componentes

### `RecommendDialog`

**Ubicacion:** `src/components/business/RecommendDialog.tsx`

```typescript
interface RecommendDialogProps {
  open: boolean;
  onClose: () => void;
  businessId: string;
  businessName: string;
}
```

**Comportamiento:**

- Dialog con `UserSearchField` existente (de `src/components/user/UserSearchField.tsx`) para buscar destinatario.
- Campo `TextField` multiline para mensaje opcional (max 200 chars) con contador `{length}/200` en `helperText`.
- Boton "Recomendar" deshabilitado si no se selecciono destinatario o si `submitting`.
- Al submit: llama a `createRecommendation()` via `withOfflineSupport`.
- Toast de exito via `useToast()`. Cierra dialog al completar.
- Si rate limit precheck indica que se supero el maximo, mostrar `Alert` en lugar del form (patron de `CommentInput`).
- Solo disponible para usuarios con `authMethod !== 'anonymous'`.

### `RecommendButton`

**Ubicacion:** `src/components/business/RecommendButton.tsx`

```typescript
interface RecommendButtonProps {
  businessId: string;
  businessName: string;
}
```

**Comportamiento:**

- `IconButton` con icono `Send` de MUI.
- Al click, abre `RecommendDialog`.
- Solo visible si `user && !user.isAnonymous` (patron de `addToListButton` en `BusinessSheet.tsx`).
- Se renderiza en `BusinessHeader` como nuevo prop `recommendButton` entre `addToListButton` y `shareButton`.

### `ReceivedRecommendations`

**Ubicacion:** `src/components/menu/ReceivedRecommendations.tsx`

```typescript
interface ReceivedRecommendationsProps {
  onSelectBusiness: (business: { id: string }) => void;
}
```

**Comportamiento:**

- Lista paginada via `usePaginatedQuery` (20 items/pagina).
- Cada item: avatar con inicial del remitente (`Avatar` MUI), nombre del remitente, nombre del comercio, mensaje truncado (2 lineas con `-webkit-line-clamp`), fecha relativa via `formatRelativeTime`.
- Click en item: `onSelectBusiness({ id: recommendation.businessId })` + `markAsRead(docId)`.
- `PaginatedListShell` para estados loading/error/empty.
- Empty state: "Todavia no recibiste recomendaciones. Segui a otros usuarios para empezar!"
- `PullToRefreshWrapper` para pull-to-refresh.
- Mark all as read al montar la seccion.
- Lazy-loaded en SideMenu via `React.lazy()`.

---

## Hooks

### `useRecommendations`

**Ubicacion:** `src/hooks/useRecommendations.ts`

**No se crea un hook custom separado.** Las recomendaciones recibidas se cargan directamente con `usePaginatedQuery` en `ReceivedRecommendations.tsx`, siguiendo el patron de `FollowedList` y `ActivityFeedView` que usan el hook generico sin wrapper.

El unread count se maneja con una query aparte dentro de `ReceivedRecommendations` o en el `SideMenuNav` (ver Integracion).

### `useUnreadRecommendations`

**Ubicacion:** `src/hooks/useUnreadRecommendations.ts`

```typescript
function useUnreadRecommendations(): { unreadCount: number; loading: boolean }
```

- Query `where('recipientId', '==', userId)` + `where('read', '==', false)` con `getCountFromServer` (o `getDocs` con limit para efficiency).
- Se usa en `SideMenuNav` para mostrar badge.
- Refresh al montar SideMenu.

---

## Servicios

### `services/recommendations.ts`

**Ubicacion:** `src/services/recommendations.ts`

Siguiendo el patron de `services/follows.ts`:

```typescript
// Collection ref with converter
export function getRecommendationsCollection(): CollectionReference<Recommendation>;

// Create
export async function createRecommendation(
  senderId: string,
  senderName: string,
  recipientId: string,
  businessId: string,
  businessName: string,
  message: string,
): Promise<void>;
// Validaciones: senderId/recipientId requeridos, senderId !== recipientId,
// message.length <= 200.
// addDoc a COLLECTIONS.RECOMMENDATIONS sin converter (serverTimestamp).
// invalidateQueryCache(COLLECTIONS.RECOMMENDATIONS, recipientId).
// trackEvent(EVT_RECOMMENDATION_SENT, { business_id: businessId, recipient_id: recipientId }).

// Mark as read (single)
export async function markRecommendationAsRead(docId: string): Promise<void>;
// updateDoc con { read: true }.

// Mark all as read
export async function markAllRecommendationsAsRead(userId: string): Promise<void>;
// Query where recipientId == userId && read == false, batch update.

// Count unread
export async function countUnreadRecommendations(userId: string): Promise<number>;
// Query where recipientId == userId && read == false, getCountFromServer.

// Count sent today (rate limit precheck)
export async function countRecommendationsSentToday(userId: string): Promise<number>;
// Query where senderId == userId && createdAt >= startOfToday.
```

---

## Integracion

### Archivos existentes que necesitan modificacion

| Archivo | Cambio |
|---------|--------|
| `src/config/collections.ts` | Agregar `RECOMMENDATIONS: 'recommendations'` |
| `src/config/converters.ts` | Agregar `recommendationConverter` |
| `src/types/index.ts` | Agregar `Recommendation`, `notifyRecommendations` en `UserSettings`, `'recommendation'` en `NotificationType`, re-export `RecommendationPayload` |
| `src/types/offline.ts` | Agregar `'recommendation_create'` a `OfflineActionType`, agregar `RecommendationPayload` |
| `src/services/syncEngine.ts` | Agregar case `'recommendation_create'` que importa `createRecommendation` |
| `src/services/userSettings.ts` | Agregar `notifyRecommendations: true` a `DEFAULT_SETTINGS` |
| `src/constants/analyticsEvents.ts` | Agregar `EVT_RECOMMENDATION_SENT`, `EVT_RECOMMENDATION_OPENED`, `EVT_RECOMMENDATION_LIST_VIEWED` |
| `src/constants/validation.ts` | Agregar `MAX_RECOMMENDATION_MESSAGE_LENGTH = 200`, `MAX_RECOMMENDATIONS_PER_DAY = 20` |
| `src/components/business/BusinessHeader.tsx` | Agregar prop `recommendButton?: ReactNode`, renderizar entre `addToListButton` y `shareButton` |
| `src/components/business/BusinessSheet.tsx` | Importar `RecommendButton`, pasarlo a `BusinessHeader` como prop (guard: `user && !user.isAnonymous`) |
| `src/components/layout/SideMenu.tsx` | Agregar `'recommendations'` a `Section` type, agregar lazy import de `ReceivedRecommendations`, agregar rendering en section switch |
| `src/components/layout/SideMenuNav.tsx` | Agregar item "Recomendaciones" con `Badge` entre "Actividad" y "Comentarios", importar `useUnreadRecommendations` |
| `src/components/menu/SettingsPanel.tsx` | Agregar `SettingRow` para `notifyRecommendations` en seccion Notificaciones |
| `src/components/menu/HelpSection.tsx` | Agregar seccion de ayuda sobre recomendaciones |
| `firestore.rules` | Agregar regla `recommendations`, modificar `userSettings` |
| `functions/src/index.ts` | Exportar `onRecommendationCreated` |
| `functions/src/utils/notifications.ts` | Agregar `'recommendation'` a `NotificationType` union, agregar `recommendation: 'notifyRecommendations'` a `TYPE_TO_SETTING`, agregar default en `DEFAULT_SETTINGS` |
| `scripts/seed-admin-data.mjs` | Agregar `notifyRecommendations: true` al seed de `userSettings` |

---

## Tests

| Archivo test | Que testear | Tipo |
|-------------|-------------|------|
| `src/services/recommendations.test.ts` | `createRecommendation`: validacion inputs, addDoc con campos correctos, cache invalidation, analytics. `markRecommendationAsRead`: updateDoc. `markAllRecommendationsAsRead`: batch update. `countUnreadRecommendations`: query correcta. `countRecommendationsSentToday`: filtro fecha. | Service |
| `src/hooks/useUnreadRecommendations.test.ts` | Retorna count correcto, loading state, no query si no auth. | Hook |
| `functions/src/triggers/recommendations.test.ts` | Rate limit (20/dia) respetado y doc eliminado si excede. Self-recommendation eliminada. Moderacion: mensaje flagged elimina doc. Notificacion creada cuando `notifyRecommendations` habilitado. Notificacion omitida cuando deshabilitado. Counter increment. | Trigger |
| `src/components/business/RecommendDialog.test.tsx` | Render dialog, busqueda usuarios, seleccion, submit con campos correctos, mensaje max 200 chars validado, loading/disabled states, rate limit precheck muestra Alert, error toast. | Component |

### Mock strategy

- Firestore: mock SDK functions (patron existente en `services/follows.test.ts`).
- Analytics: mock `trackEvent`.
- Auth: mock `useAuth()` context.
- Toast: mock `useToast()`.
- Connectivity: mock `useConnectivity()`.
- UserSearchField: mock como componente dummy que llama `onSelect`.

### Criterio de aceptacion

- Cobertura >= 80% del codigo nuevo.
- Todos los paths condicionales cubiertos (offline enqueue, rate limit precheck, notificacion respetando settings).
- Tests de validacion para todos los inputs del usuario (mensaje max 200, recipientId != senderId).

---

## Analytics

| Evento | Parametros | Donde se dispara |
|--------|------------|-----------------|
| `EVT_RECOMMENDATION_SENT` (`recommendation_sent`) | `business_id`, `recipient_id`, `has_message` | `services/recommendations.ts` en `createRecommendation` |
| `EVT_RECOMMENDATION_OPENED` (`recommendation_opened`) | `business_id`, `sender_id` | `ReceivedRecommendations.tsx` al click en item |
| `EVT_RECOMMENDATION_LIST_VIEWED` (`recommendation_list_viewed`) | -- | `ReceivedRecommendations.tsx` al montar |

---

## Offline

### Cache strategy

| Dato | Estrategia | TTL | Storage |
|------|-----------|-----|---------|
| Recomendaciones recibidas | Firestore `persistentLocalCache` (existente en prod) | Indefinido (Firestore SDK) | IndexedDB (Firestore) |
| Unread count | Refetch on mount, no cache adicional | -- | -- |
| Primera pagina de lista | `usePaginatedQuery` cache | 2 min | Module-level Map |

### Writes offline

| Operacion | Mecanismo | Conflict resolution |
|-----------|-----------|-------------------|
| Crear recomendacion | `withOfflineSupport(isOffline, 'recommendation_create', meta, payload, onlineAction, toast)` | Idempotente: autoId, no hay conflicto de duplicados. Si falla tras max retries, se descarta con toast. |
| Marcar como leida | `withOfflineSupport(isOffline, 'recommendation_read', meta, payload, onlineAction, toast)` | Idempotente: set read=true, repetir es no-op. |

### Fallback UI

- **Sin conexion al crear:** Toast "Se enviara cuando vuelvas a conectar" (patron existente de `withOfflineSupport`). `OfflineIndicator` muestra pendientes.
- **Sin conexion al listar:** Datos de Firestore persistent cache mostrados. `OfflineIndicator` visible.
- **Sin conexion al buscar usuarios en dialog:** `UserSearchField` ya maneja offline mostrando mensaje "Sin conexion".

---

## Decisiones tecnicas

### 1. Auto-generated doc ID (no compuesto)

**Decision:** Usar auto-generated ID en lugar de compuesto `{senderId}__{recipientId}__{businessId}`.

**Razon:** El PRD explicita que un usuario puede recomendar el mismo comercio a la misma persona multiples veces con distintos mensajes. Un ID compuesto forzaria unicidad no deseada.

### 2. No crear `useRecommendations` hook wrapper

**Decision:** Usar `usePaginatedQuery` directamente en `ReceivedRecommendations.tsx`.

**Razon:** `FollowedList` y `ActivityFeedView` ya siguen este patron. Un hook wrapper solo agrega indirection sin valor cuando la logica es una sola query paginada. El unread count es un hook separado (`useUnreadRecommendations`) porque se usa en `SideMenuNav` (fuera del componente de lista).

### 3. `message` como string (no optional)

**Decision:** `message` es siempre string, vacio si no hay mensaje.

**Razon:** Simplifica las Firestore rules (no necesita `!('message' in data)` condicional) y el converter. El PRD dice "campo opcional" pero implementar como string vacio es equivalente y mas simple para validacion.

### 4. Dos tipos offline separados

**Decision:** `recommendation_create` y `recommendation_read` como tipos separados en `OfflineActionType`.

**Razon:** Tienen payloads distintos y handlers distintos en `syncEngine.ts`. Seguir el patron de `follow_add`/`follow_remove`.

**Alternativa considerada:** Un solo tipo `recommendation` con sub-action. Rechazada por inconsistencia con el patron existente de tipos granulares.

### 5. Rate limit precheck con query directa

**Decision:** `countRecommendationsSentToday()` hace query directa a Firestore en lugar de mantener un contador local.

**Razon:** Patron identico a `BusinessComments` donde se cuentan comentarios del dia. El contador es preciso y no requiere estado persistente adicional. La query es ligera (solo count, no docs).
