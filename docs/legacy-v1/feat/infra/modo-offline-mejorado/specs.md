# Specs: Modo offline mejorado

**PRD:** [prd.md](prd.md)
**Fecha:** 2026-03-23

---

## Modelo de datos

### IndexedDB Schema — Cola offline

La cola offline usa IndexedDB directamente (sin libreria wrapper) via una abstraccion en `src/services/offlineQueue.ts`.

**Database:** `modo-mapa-offline`
**Version:** 1
**Object Store:** `pendingActions`

```typescript
// src/types/offline.ts

/** Tipos de acciones encolables */
export type OfflineActionType =
  | 'rating_upsert'
  | 'rating_delete'
  | 'comment_create'
  | 'favorite_add'
  | 'favorite_remove'
  | 'price_level_upsert'
  | 'price_level_delete'
  | 'tag_add'
  | 'tag_remove';

/** Status de una accion en cola */
export type OfflineActionStatus = 'pending' | 'syncing' | 'failed';

/** Estructura de una accion encolada en IndexedDB */
export interface OfflineAction {
  id: string;                    // crypto.randomUUID()
  type: OfflineActionType;
  payload: OfflineActionPayload;
  userId: string;
  businessId: string;
  businessName?: string;         // Para display en UI (SideMenu pendientes)
  createdAt: number;             // Date.now() timestamp
  retryCount: number;            // Empieza en 0
  status: OfflineActionStatus;
}

/** Union de payloads por tipo de accion */
export type OfflineActionPayload =
  | RatingUpsertPayload
  | RatingDeletePayload
  | CommentCreatePayload
  | FavoriteTogglePayload
  | PriceLevelUpsertPayload
  | PriceLevelDeletePayload
  | TagAddPayload
  | TagRemovePayload;

export interface RatingUpsertPayload {
  userId: string;
  businessId: string;
  score: number;
  criteria?: import('../types').RatingCriteria;
}

export interface RatingDeletePayload {
  userId: string;
  businessId: string;
}

export interface CommentCreatePayload {
  userId: string;
  userName: string;
  businessId: string;
  text: string;
  parentId?: string;
}

export interface FavoriteTogglePayload {
  userId: string;
  businessId: string;
  action: 'add' | 'remove';
}

export interface PriceLevelUpsertPayload {
  userId: string;
  businessId: string;
  level: number;
}

export interface PriceLevelDeletePayload {
  userId: string;
  businessId: string;
}

export interface TagAddPayload {
  userId: string;
  businessId: string;
  tagId: string;
}

export interface TagRemovePayload {
  userId: string;
  businessId: string;
  tagId: string;
}
```

**IndexedDB indexes:**

- `status` — para queries de acciones pendientes
- `createdAt` — para orden FIFO y cleanup por edad

No se necesitan cambios en Firestore. La cola es puramente client-side.

### Constantes

```typescript
// src/constants/offline.ts

/** Maximo de acciones en cola */
export const OFFLINE_QUEUE_MAX_ITEMS = 50;

/** Edad maxima de acciones en cola (7 dias) */
export const OFFLINE_QUEUE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

/** Maximo de reintentos por accion */
export const OFFLINE_MAX_RETRIES = 3;

/** Base del backoff exponencial en ms */
export const OFFLINE_BACKOFF_BASE_MS = 1000;

/** Nombre de la base de datos IndexedDB */
export const OFFLINE_DB_NAME = 'modo-mapa-offline';

/** Version del schema IndexedDB */
export const OFFLINE_DB_VERSION = 1;

/** Nombre del object store */
export const OFFLINE_STORE_NAME = 'pendingActions';

/** URL para verificacion de conectividad real */
export const CONNECTIVITY_CHECK_URL = '/favicon.ico';

/** Timeout para verificacion de conectividad (ms) */
export const CONNECTIVITY_CHECK_TIMEOUT_MS = 5000;
```

---

## Firestore Rules

Sin cambios. Las escrituras offline se ejecutan con las mismas funciones de servicio existentes al sincronizar, asi que las reglas de `createdAt == request.time` aplican al momento de la sincronizacion real (no al momento del encolado).

---

## Cloud Functions

Sin cambios. Los triggers existentes (rate limits, moderacion, counters) se ejecutan normalmente cuando las acciones se sincronizan. Las validaciones server-side (20 comments/dia, 50 likes/dia) siguen aplicando.

---

## Componentes

### OfflineIndicator (modificado)

**Archivo:** `src/components/ui/OfflineIndicator.tsx`
**Cambios:**

- Eliminar state local `isOffline` y `useEffect` con event listeners
- Consumir `useConnectivity()` del nuevo contexto
- Mostrar badge con `pendingActionsCount` cuando > 0: "Sin conexion - N pendientes"
- Cuando esta online pero hay acciones sincronizando, mostrar "Sincronizando..."

```typescript
// Props: ninguna (consume contexto)
// Render: Chip con badge condicional
```

### PendingActionsSection (nuevo)

**Archivo:** `src/components/menu/PendingActionsSection.tsx`
**Props:**

```typescript
interface PendingActionsSectionProps {
  onClose: () => void;  // Para cerrar el SideMenu si se navega
}
```

**Comportamiento:**

- Lista de acciones pendientes desde `useConnectivity().pendingActions`
- Cada item muestra: icono por tipo, descripcion (ej: "Rating - La Parrilla de Juan"), fecha relativa
- Boton de descartar individual (con confirmacion)
- Boton "Reintentar todo" si hay acciones `failed`
- Solo visible si `pendingActions.length > 0`
- Usa `List`, `ListItem`, `ListItemText`, `ListItemSecondaryAction`, `IconButton` de MUI

### SideMenu (modificado)

**Archivo:** `src/components/layout/SideMenu.tsx`
**Cambios:**

- Agregar `Badge` junto al nombre de usuario en header cuando `pendingActionsCount > 0`
- Agregar item de navegacion "Pendientes" con badge count (solo si > 0) debajo de "Check-ins" en `SideMenuNav`
- Lazy-load `PendingActionsSection`

---

## Hooks

### useConnectivity (nuevo)

**Archivo:** `src/hooks/useConnectivity.ts`
**Retorno:**

```typescript
interface ConnectivityContextValue {
  isOffline: boolean;
  isSyncing: boolean;
  pendingActionsCount: number;
  pendingActions: OfflineAction[];
  discardAction: (actionId: string) => Promise<void>;
  retryFailed: () => Promise<void>;
}
```

**Implementacion:**

- Hook que consume `ConnectivityContext`
- Throw si se usa fuera del provider (patron existente en el proyecto)

### ConnectivityProvider (nuevo)

**Archivo:** `src/context/ConnectivityContext.tsx`
**Comportamiento:**

- Escucha `online`/`offline` events del browser
- Al detectar `online`, verifica conectividad real con `fetch(CONNECTIVITY_CHECK_URL)` con timeout
- Mantiene estado `isOffline`, `isSyncing`
- Carga `pendingActions` desde `offlineQueue` al montar y lo actualiza reactivamente via suscripcion
- Al pasar de offline a online confirmado, dispara `syncEngine.processQueue()`
- Expone `discardAction` que llama a `offlineQueue.remove(id)` y actualiza estado
- Expone `retryFailed` que resetea status de acciones `failed` a `pending` y dispara sync

---

## Servicios

### offlineQueue (nuevo)

**Archivo:** `src/services/offlineQueue.ts`
**API:**

```typescript
/** Abre/crea la base de datos IndexedDB */
function openDb(): Promise<IDBDatabase>;

/** Encola una accion. Descarta si ya hay OFFLINE_QUEUE_MAX_ITEMS */
function enqueue(action: Omit<OfflineAction, 'id' | 'createdAt' | 'retryCount' | 'status'>): Promise<OfflineAction>;

/** Obtiene todas las acciones ordenadas por createdAt (FIFO) */
function getAll(): Promise<OfflineAction[]>;

/** Obtiene acciones pendientes (status = 'pending') */
function getPending(): Promise<OfflineAction[]>;

/** Actualiza el status/retryCount de una accion */
function updateStatus(id: string, status: OfflineActionStatus, retryCount?: number): Promise<void>;

/** Elimina una accion por id */
function remove(id: string): Promise<void>;

/** Elimina acciones sincronizadas o mas viejas que OFFLINE_QUEUE_MAX_AGE_MS */
function cleanup(): Promise<number>;

/** Cuenta total de acciones */
function count(): Promise<number>;

/** Suscribe a cambios (callback cuando cambia el store). Retorna unsubscribe */
function subscribe(callback: () => void): () => void;
```

**Detalles:**

- Usa IndexedDB API nativa (sin idb wrapper — evita dependencia extra)
- `subscribe` usa un pattern de listeners internos notificados despues de cada mutacion
- `cleanup` se ejecuta al abrir y periodicamente en el sync engine
- Si `enqueue` detecta que hay >= `OFFLINE_QUEUE_MAX_ITEMS`, rechaza con error (toast warning para el usuario)

### syncEngine (nuevo)

**Archivo:** `src/services/syncEngine.ts`
**API:**

```typescript
/** Procesa la cola de acciones pendientes en orden FIFO */
function processQueue(
  onActionSynced: (action: OfflineAction) => void,
  onActionFailed: (action: OfflineAction, error: Error) => void,
  onComplete: (syncedCount: number, failedCount: number) => void,
): Promise<void>;

/** Ejecuta una accion individual llamando al servicio correspondiente */
function executeAction(action: OfflineAction): Promise<void>;
```

**Comportamiento de `processQueue`:**

1. Llama a `offlineQueue.cleanup()` para purgar acciones viejas
2. Obtiene acciones con `getPending()`
3. Itera en orden FIFO, una a la vez:
   a. Marca status `syncing`
   b. Llama a `executeAction(action)`
   c. Si exito: `offlineQueue.remove(action.id)`, callback `onActionSynced`
   d. Si error: incrementa `retryCount`, aplica backoff exponencial (`OFFLINE_BACKOFF_BASE_MS * 2^retryCount`)
   e. Si `retryCount >= OFFLINE_MAX_RETRIES`: marca `failed`, callback `onActionFailed`
   f. Si `retryCount < OFFLINE_MAX_RETRIES`: marca `pending` para el proximo ciclo
4. Al terminar: callback `onComplete`

**`executeAction` mapea tipo a servicio:**

| `type` | Servicio llamado |
|--------|-----------------|
| `rating_upsert` | `upsertRating(payload.userId, payload.businessId, payload.score, payload.criteria)` |
| `rating_delete` | `deleteRating(payload.userId, payload.businessId)` |
| `comment_create` | `addComment(payload.userId, payload.userName, payload.businessId, payload.text, payload.parentId)` |
| `favorite_add` | `addFavorite(payload.userId, payload.businessId)` |
| `favorite_remove` | `removeFavorite(payload.userId, payload.businessId)` |
| `price_level_upsert` | `upsertPriceLevel(payload.userId, payload.businessId, payload.level)` |
| `price_level_delete` | `deletePriceLevel(payload.userId, payload.businessId)` |
| `tag_add` | `addUserTag(payload.userId, payload.businessId, payload.tagId)` |
| `tag_remove` | `removeUserTag(payload.userId, payload.businessId, payload.tagId)` |

### offlineInterceptor (nuevo)

**Archivo:** `src/services/offlineInterceptor.ts`
**API:**

```typescript
/**
 * Wrapper que intercepta escrituras cuando esta offline.
 * Si isOffline, encola la accion y retorna.
 * Si online, ejecuta la funcion original.
 */
function withOfflineSupport<T>(
  isOffline: boolean,
  actionType: OfflineActionType,
  actionMeta: { userId: string; businessId: string; businessName?: string },
  payload: OfflineActionPayload,
  onlineAction: () => Promise<T>,
  onEnqueued: () => void,
): Promise<T | void>;
```

**Patron de intercepcion en servicios existentes:**

En lugar de modificar los servicios directamente, los componentes que llaman a los servicios (BusinessRating, BusinessComments, FavoriteButton, BusinessPriceLevel, BusinessTags) usaran `withOfflineSupport` como wrapper. Esto mantiene los servicios puros y testables.

Ejemplo en BusinessRating:

```typescript
// Antes:
await upsertRating(userId, businessId, score);

// Despues:
await withOfflineSupport(
  isOffline,
  'rating_upsert',
  { userId, businessId, businessName: business.name },
  { userId, businessId, score },
  () => upsertRating(userId, businessId, score),
  () => toast.info('Guardado offline — se sincronizara al reconectar'),
);
```

**Ventajas de este patron:**

- Los servicios (`ratings.ts`, `comments.ts`, etc.) no se modifican
- La logica offline es explicita en el punto de llamada
- Se puede testear el interceptor aislado
- El UI optimista existente sigue funcionando igual (se aplica antes de la llamada al servicio)

---

## Integracion

### Componentes que necesitan cambios

| Componente | Cambio |
|------------|--------|
| `src/components/business/BusinessRating.tsx` | Wrap `upsertRating`/`deleteRating` con `withOfflineSupport` |
| `src/components/business/BusinessComments.tsx` | Wrap `addComment` con `withOfflineSupport` |
| `src/components/business/FavoriteButton.tsx` | Wrap `addFavorite`/`removeFavorite` con `withOfflineSupport` |
| `src/components/business/BusinessPriceLevel.tsx` | Wrap `upsertPriceLevel`/`deletePriceLevel` con `withOfflineSupport` |
| `src/components/business/BusinessTags.tsx` | Wrap `addUserTag`/`removeUserTag` con `withOfflineSupport` |
| `src/components/ui/OfflineIndicator.tsx` | Consumir `useConnectivity()`, mostrar badge pendientes |
| `src/components/layout/SideMenu.tsx` | Badge pendientes en header, nav item "Pendientes" |
| `src/components/layout/SideMenuNav.tsx` | Item "Pendientes" condicional |
| `src/App.tsx` | Wrappear con `ConnectivityProvider` |

### Arbol de providers actualizado

```text
App.tsx
  └─ ColorModeProvider
       └─ AuthProvider
            └─ ToastProvider
                 └─ ConnectivityProvider  ← NUEVO (necesita ToastContext)
                      └─ Routes...
```

`ConnectivityProvider` necesita estar debajo de `ToastProvider` porque usa `useToast()` para los toasts de sincronizacion.

---

## Tests

| Archivo test | Que testear | Tipo |
|-------------|-------------|------|
| `src/services/offlineQueue.test.ts` | enqueue, getAll, getPending, updateStatus, remove, cleanup, max items, max age, subscribe | Service |
| `src/services/syncEngine.test.ts` | FIFO order, backoff timing, max retries, executeAction mapping, cleanup, callbacks | Service |
| `src/services/offlineInterceptor.test.ts` | Online passthrough, offline enqueue, onEnqueued callback | Service |
| `src/hooks/useConnectivity.test.ts` | Online/offline transitions, connectivity check, pendingActionsCount reactivity, discardAction, retryFailed | Hook |
| `src/components/ui/OfflineIndicator.test.tsx` | Badge count, "Sin conexion" label, "Sincronizando" state | Component |

### Mock strategy

- **IndexedDB:** Mock con `fake-indexeddb` (ya existe como dev dependency pattern en el ecosistema) o un in-memory Map que simula la API de `offlineQueue`
- **navigator.onLine:** `vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)`
- **fetch (connectivity check):** `vi.stubGlobal('fetch', vi.fn())`
- **Servicios existentes:** Mock las funciones de servicio (`upsertRating`, `addComment`, etc.) en tests de `syncEngine`
- **useToast:** Mock `ToastContext`

### Criterios

- Cobertura >= 80% del codigo nuevo
- Todos los paths: online, offline enqueue, sync success, sync failure, max retries, max queue, stale cleanup
- Side effects verificados: IndexedDB writes, toast calls, analytics events

---

## Analytics

Nuevos eventos en `src/constants/analyticsEvents.ts`:

```typescript
export const EVT_OFFLINE_ACTION_QUEUED = 'offline_action_queued';
export const EVT_OFFLINE_SYNC_COMPLETED = 'offline_sync_completed';
export const EVT_OFFLINE_SYNC_FAILED = 'offline_sync_failed';
export const EVT_OFFLINE_ACTION_DISCARDED = 'offline_action_discarded';
```

Parametros:

- `offline_action_queued`: `{ action_type, business_id }`
- `offline_sync_completed`: `{ synced_count, failed_count }`
- `offline_sync_failed`: `{ action_type, retry_count, error }`
- `offline_action_discarded`: `{ action_type, business_id }`

---

## Decisiones tecnicas

### IndexedDB nativa vs idb/Dexie

Se usa IndexedDB API nativa envuelta en un modulo simple. El proyecto no tiene dependencia de `idb` ni `Dexie`, y la API que necesitamos es minima (open, put, get, delete, getAll con index). Agregar una libreria para 6 operaciones no justifica el bundle extra.

### Wrapper pattern vs modificacion directa de servicios

Se opto por un wrapper (`withOfflineSupport`) que se usa en los componentes en el punto de llamada, en lugar de modificar los servicios existentes (`ratings.ts`, `comments.ts`, etc.). Razones:

- Los servicios se mantienen puros y no necesitan saber sobre offline
- Los tests existentes de servicios (13 para ratings, 16 para comments, 7 para favorites, etc.) no se rompen
- La intercepcion es explicita y visible en el componente
- Alternativa rechazada: decorar las funciones de servicio con un HOF. Esto acopla el service layer a la logica offline y complica los mocks en tests existentes.

### Sync engine: procesamiento secuencial vs paralelo

Se procesa la cola secuencialmente (una accion a la vez) para:

- Respetar rate limits del servidor (triggers validan daily limits)
- Evitar race conditions en acciones sobre el mismo recurso (ej: rating_upsert seguido de rating_delete para el mismo negocio)
- Simplicidad de backoff y error handling

### Conflictos: last-write-wins

Consistente con el modelo actual de Firestore. Sin CRDTs ni merge strategies. Si el usuario califica un negocio offline y luego lo califica desde otro dispositivo online, el ultimo `updatedAt` gana. Esto ya es el comportamiento actual del `upsertRating` (hace `updateDoc` si el doc existe).

### ConnectivityProvider debajo de ToastProvider

Necesita acceso a `useToast()` para mostrar toasts de sincronizacion. La alternativa de pasar callbacks desde arriba es mas compleja sin beneficio.

### SW y PWA config

La configuracion actual de `vite-plugin-pwa` ya cubre Maps tiles caching (3 patterns en `runtimeCaching`), `navigateFallback` no esta configurado explicitamente pero `globPatterns` incluye `**/*.html` que cubre el SPA. Se verificara que funciona correctamente y se agrega `navigateFallback: 'index.html'` si es necesario.
