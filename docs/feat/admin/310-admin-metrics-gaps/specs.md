# Specs: Admin metrics — listItems / _rateLimits visibility + admin event tracking

**Feature:** 310-admin-metrics-gaps
**PRD:** [prd.md](./prd.md)
**Fecha:** 2026-04-18

---

## Arquitectura de la solucion

### Cambios de alto nivel

```
┌─────────────────────────────────────────────────────────────────┐
│  src/constants/analyticsEvents/admin.ts                         │
│    + EVT_ADMIN_LIST_ITEM_DELETED                                │
│    + EVT_ADMIN_RATE_LIMIT_VIEWED                                │
│    + EVT_ADMIN_RATE_LIMIT_RESET                                 │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  functions/src/admin/                                            │
│    + rateLimits.ts  (adminListRateLimits, adminResetRateLimit)   │
│    + listItems.ts   (adminDeleteListItem)                        │
│    * analyticsReport.ts: +6 eventos en GA4_EVENT_NAMES           │
│    * index.ts: export nuevas callables                           │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  src/services/admin/                                             │
│    + rateLimits.ts  (fetchAdminRateLimits, resetAdminRateLimit)  │
│    + listItems.ts   (deleteAdminListItem)                        │
│    * index.ts: re-export                                         │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  src/components/admin/                                           │
│    + alerts/RateLimitsSection.tsx                                │
│    + alerts/RateLimitRow.tsx                                     │
│    * AbuseAlerts.tsx: agregar Tab "Rate limits"                  │
│    * FeaturedListsPanel.tsx: extender expansion con addedBy+delete│
│    * features/ga4FeatureDefinitions.ts: + categoria admin_tools  │
└─────────────────────────────────────────────────────────────────┘
```

### Diagrama de datos

```
Admin UI                Services              Cloud Functions        Firestore
  │                        │                          │                 │
  │ viewRateLimits         │                          │                 │
  ├──────────────────────▶ │ fetchAdminRateLimits    │                 │
  │                        ├───────────────────────▶ │ adminListRateL. │
  │                        │                          ├──────────────▶ │ _rateLimits (read)
  │                        │                          │ ◀──────────── │
  │                        │ ◀─────────────────────── │                 │
  │ ◀────────────────────  │                          │                 │
  │                        │                          │                 │
  │ resetRateLimit(id)     │                          │                 │
  ├──────────────────────▶ │ resetAdminRateLimit      │                 │
  │                        ├───────────────────────▶ │ adminResetRateL │
  │                        │                          ├──────────────▶ │ _rateLimits/{id} DEL
  │                        │                          ├──────────────▶ │ abuseLogs ADD
  │                        │                          │                 │
  │ deleteListItem(id)     │                          │                 │
  ├──────────────────────▶ │ deleteAdminListItem      │                 │
  │                        ├───────────────────────▶ │ adminDeleteListI│
  │                        │                          ├──────────────▶ │ listItems/{id} DEL
  │                        │                          ├──────────────▶ │ abuseLogs ADD
  │                        │                          ├──────────────▶ │ sharedLists/{} itemCount--
```

---

## Cambios detallados

### 1. Analytics events — constants

**Archivo:** `src/constants/analyticsEvents/admin.ts`

```typescript
// Admin config events (existentes)
export const ADMIN_CONFIG_VIEWED = 'admin_config_viewed';
export const ADMIN_MODERATION_UPDATED = 'admin_moderation_updated';
export const ADMIN_ACTIVITY_FEED_DIAG = 'admin_activity_feed_diag';

// Admin metrics events (nuevos — #310)
export const ADMIN_LIST_ITEM_DELETED = 'admin_list_item_deleted';
export const ADMIN_RATE_LIMIT_VIEWED = 'admin_rate_limit_viewed';
export const ADMIN_RATE_LIMIT_RESET = 'admin_rate_limit_reset';
```

**Archivo:** `src/constants/analyticsEvents/__tests__/barrel.test.ts`

Actualizar el array de nombres esperados para incluir los 3 nuevos.

---

### 2. GA4 event registration

**Archivo:** `functions/src/admin/analyticsReport.ts`

```typescript
const GA4_EVENT_NAMES = [
  // ... (todos los existentes, sin cambios)
  // Admin tools (#310)
  'admin_config_viewed',
  'admin_moderation_updated',
  'admin_activity_feed_diag',
  'admin_list_item_deleted',
  'admin_rate_limit_viewed',
  'admin_rate_limit_reset',
] as const;
```

**Archivo:** `src/components/admin/features/ga4FeatureDefinitions.ts`

Agregar categoria al final (antes de `'other'`):

```typescript
{
  id: 'admin_tools',
  label: 'Admin Tools',
  features: [
    {
      key: 'admin_config',
      name: 'Config tools',
      icon: icon(SettingsOutlinedIcon),
      eventNames: ['admin_config_viewed', 'admin_moderation_updated', 'admin_activity_feed_diag'],
      color: '#455A64',
    },
    {
      key: 'admin_metrics',
      name: 'Metrics tools',
      icon: icon(SettingsOutlinedIcon),
      eventNames: ['admin_list_item_deleted', 'admin_rate_limit_viewed', 'admin_rate_limit_reset'],
      color: '#546E7A',
    },
  ],
},
```

---

### 3. Cloud Functions callable — rate limits

**Archivo nuevo:** `functions/src/admin/rateLimits.ts`

Responsabilidades:
- `adminListRateLimits({ userId?, limit? = 50 })` — lista docs de `_rateLimits` ordenados por `resetAt` desc
- `adminResetRateLimit({ docId })` — elimina el doc (reset implicito) + escribe `abuseLog`

Funciones internas:
- `categorizeRateLimit(docId)`: parse del docId (`comments_{uid}`, `backup_{uid}`, etc) retorna `{ category, userId }`

Signatura respuesta:
```typescript
interface AdminRateLimit {
  docId: string;
  category: string;          // 'comments', 'backup', 'editors_invite', etc.
  userId: string;
  count: number;
  resetAt: number;           // epoch ms
  windowActive: boolean;     // Date.now() < resetAt
}

interface AdminRateLimitsResponse {
  items: AdminRateLimit[];
}
```

Validaciones:
- `assertAdmin(request.auth)` primera linea
- `userId` si se pasa: regex `^[a-zA-Z0-9_-]{20,50}$` (firebase uid format)
- `limit` si se pasa: int 1-100, default 50
- `docId` en reset: string no-vacio, max 200 chars

Side effects:
- Reset: `logAbuse({ userId: adminUid, type: 'config_edit', detail: 'Reset rate limit: {docId}' })`
- Rate limit propia: `checkCallableRateLimit(db, 'admin_rate_limits_{adminUid}', 30, adminUid)` — 30/dia (operacion rara)
- `trackFunctionTiming('adminListRateLimits', start)` al inicio y final

---

### 4. Cloud Functions callable — listItems

**Archivo nuevo:** `functions/src/admin/listItems.ts`

Responsabilidades:
- `adminDeleteListItem({ itemId })` — elimina un doc de `listItems`, decrementa `sharedLists/{listId}.itemCount` atomicamente, escribe `abuseLog`

Validaciones:
- `assertAdmin(request.auth)` primera linea
- `itemId`: string, 1-128 chars
- Lee el doc primero para obtener `listId` (rechaza si no existe con `HttpsError('not-found')`)

Side effects:
- Batch write:
  - `db.doc('listItems/{itemId}').delete()`
  - `db.doc('sharedLists/{listId}').update({ itemCount: FieldValue.increment(-1), updatedAt: FieldValue.serverTimestamp() })`
- `logAbuse({ userId: adminUid, type: 'config_edit', detail: 'Delete listItem {itemId} from list {listId}' })`
- `trackFunctionTiming`

---

### 5. Frontend services

**Archivo nuevo:** `src/services/admin/rateLimits.ts`

```typescript
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../config/firebase';
import type { AdminRateLimit } from '../../types/admin';

export interface AdminRateLimitsRequest {
  userId?: string;
  limit?: number;
}

export async function fetchAdminRateLimits(
  params: AdminRateLimitsRequest = {},
): Promise<AdminRateLimit[]> {
  const fn = httpsCallable<AdminRateLimitsRequest, { items: AdminRateLimit[] }>(
    functions,
    'adminListRateLimits',
  );
  const result = await fn(params);
  return result.data.items;
}

export async function resetAdminRateLimit(docId: string): Promise<void> {
  const fn = httpsCallable<{ docId: string }, { success: true }>(
    functions,
    'adminResetRateLimit',
  );
  await fn({ docId });
}
```

**Archivo nuevo:** `src/services/admin/listItems.ts`

```typescript
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../config/firebase';

export async function deleteAdminListItem(itemId: string): Promise<void> {
  const fn = httpsCallable<{ itemId: string }, { success: true }>(
    functions,
    'adminDeleteListItem',
  );
  await fn({ itemId });
}
```

**Archivo:** `src/services/admin/index.ts`

Agregar al barrel:
```typescript
export { fetchAdminRateLimits, resetAdminRateLimit } from './rateLimits';
export { deleteAdminListItem } from './listItems';
```

**Archivo:** `src/types/admin.ts`

```typescript
export interface AdminRateLimit {
  docId: string;
  category: string;
  userId: string;
  count: number;
  resetAt: number;
  windowActive: boolean;
}
```

---

### 6. UI — RateLimitsSection

**Archivo nuevo:** `src/components/admin/alerts/RateLimitsSection.tsx` (~200 lineas)

Estructura:
- `useAsyncData(fetcher)` para carga inicial (sin filtro) — delay refetch hasta click "Buscar"
- Input `TextField` para `userId` con boton "Buscar" (explicit search, no debounce — el endpoint es rate-limited)
- `Table` con columnas: Categoria | Usuario | Count | Reset en | Accion
- Cada fila: `RateLimitRow` memo component
- Boton "Resetear" por fila → dialog confirmacion `role="alertdialog"` → `resetAdminRateLimit(docId)` → refetch + toast + `trackEvent(ADMIN_RATE_LIMIT_RESET)`
- `useEffect` en mount: `trackEvent(ADMIN_RATE_LIMIT_VIEWED)` (una sola vez)

Props:
```typescript
interface Props {
  // Ninguna prop — component auto-contenido
}
```

**Archivo nuevo:** `src/components/admin/alerts/RateLimitRow.tsx`

```typescript
interface Props {
  item: AdminRateLimit;
  onReset: (docId: string) => Promise<void>;
  isResetting: boolean;
}
```

Memoizado con `React.memo`. Usa `formatRelativeTime(new Date(item.resetAt))`.

---

### 7. UI — AbuseAlerts integration

**Archivo:** `src/components/admin/AbuseAlerts.tsx`

Cambio puntual: agregar tab "Rate limits" al `Tabs` existente (lineas 65: `innerTab` state).

```typescript
const [innerTab, setInnerTab] = useState<'alerts' | 'reincidentes' | 'rateLimits'>('alerts');
```

Render condicional:
```typescript
{innerTab === 'rateLimits' && <RateLimitsSection />}
```

No modificar logica de alerts/reincidentes.

---

### 8. UI — FeaturedListsPanel extension

**Archivo:** `src/components/admin/FeaturedListsPanel.tsx`

Cambios:
- Al expandir una lista (`handleToggleExpand`), ademas de `fetchListItems(listId)` llamar `fetchUserDisplayNames([...uniqueAddedBy])` para resolver nombres
- En el render del item agregar:
  - Nombre resuelto de `addedBy` como caption
  - Chip "Editor" si `item.addedBy !== list.ownerId && item.addedBy !== ''`
  - `IconButton` con `DeleteOutlineIcon` + `aria-label="Eliminar item {business.name}"` → dialog confirm → `deleteAdminListItem(item.id)` → refetch items
- `trackEvent(ADMIN_LIST_ITEM_DELETED, { listId, businessId })`

Nuevo state:
```typescript
const [itemToDelete, setItemToDelete] = useState<{ listId: string; item: ListItem } | null>(null);
const [deletingId, setDeletingId] = useState<string | null>(null);
const [displayNames, setDisplayNames] = useState<Map<string, string>>(new Map());
```

---

### 9. Copy centralizado

**Archivo:** `src/constants/messages/admin.ts`

```typescript
// ... existente ...
export const rateLimitResetSuccess = 'Rate limit restablecido.';
export const rateLimitResetError = 'No se pudo restablecer el rate limit.';
export const rateLimitResetConfirmTitle = '¿Restablecer rate limit?';
export const rateLimitResetConfirmBody = (category: string, userId: string) =>
  `El usuario ${userId.slice(0, 8)}… podrá volver a ejecutar acciones de "${category}" inmediatamente.`;

export const listItemDeleteSuccess = 'Item eliminado de la lista.';
export const listItemDeleteError = 'No se pudo eliminar el item.';
export const listItemDeleteConfirmTitle = '¿Eliminar este item?';
export const listItemDeleteConfirmBody = (businessName: string) =>
  `Se quitará "${businessName}" de la lista. Esta acción no se puede deshacer.`;
```

---

## Modelo de datos

Sin cambios en Firestore. Las callables leen/escriben colecciones existentes (`_rateLimits`, `listItems`, `sharedLists`, `abuseLogs`).

Rules sin cambios:
- `_rateLimits`: sigue `allow read, write: if false` (solo Admin SDK)
- `listItems`: sin cambios (admin usa callable, no cliente directo)

---

## Tests

### Archivos que necesitaran tests

| Archivo | Tipo | Que testear |
|---------|------|-------------|
| `functions/src/admin/rateLimits.test.ts` | Callable | assertAdmin en no-admin; listRateLimits con/sin userId filter; limit clamp (0/100/>100); resetRateLimit deletes doc + logs abuse; rate limit de la propia callable |
| `functions/src/admin/listItems.test.ts` | Callable | assertAdmin; delete inexistente → not-found; delete valido → batch delete + decrement + abuseLog |
| `src/services/admin/rateLimits.test.ts` | Service | httpsCallable mock — retorna items; error propagation |
| `src/services/admin/listItems.test.ts` | Service | httpsCallable mock — success + error |
| `src/components/admin/alerts/RateLimitsSection.test.tsx` | Component | Renderiza tabla; filtro userId busca; dialog confirmacion; reset flow completo (loading → success → toast) |
| `src/components/admin/FeaturedListsPanel.test.tsx` | Component | Nuevo: expansion resuelve displayNames; delete item flow |

### Casos a cubrir

- [ ] Callable sin auth → `unauthenticated`
- [ ] Callable con auth no-admin → `permission-denied`
- [ ] `adminListRateLimits` con `userId` invalido → `invalid-argument`
- [ ] `adminListRateLimits` con `limit` fuera de rango → clampea a 50
- [ ] `adminResetRateLimit` con docId vacio → `invalid-argument`
- [ ] `adminResetRateLimit` exitoso → doc eliminado + abuseLog creado + `trackFunctionTiming`
- [ ] `adminDeleteListItem` con itemId inexistente → `not-found`
- [ ] `adminDeleteListItem` exitoso → listItem eliminado + sharedList.itemCount decrementado + abuseLog
- [ ] `categorizeRateLimit('comments_abc123')` → `{ category: 'comments', userId: 'abc123' }`
- [ ] `categorizeRateLimit('editors_invite_xyz')` → `{ category: 'editors_invite', userId: 'xyz' }`
- [ ] Componente RateLimitsSection: disable boton cuando `isOffline`
- [ ] Componente RateLimitsSection: dialog de confirmacion cancel cierra sin resetear
- [ ] Componente FeaturedListsPanel: agregar item con `addedBy !== ownerId` muestra chip "Editor"

### Mock strategy

- Firestore Admin SDK: mock via `vi.hoisted` para `FieldValue` + `getDb()`
- Frontend callables: mock `httpsCallable` para retornar respuestas fake
- `assertAdmin`: mockear via `vi.mock('../helpers/assertAdmin')` + control de comportamiento
- `logAbuse`, `trackFunctionTiming`: mock vi.fn() verificado por count + args

### Criterios de aceptacion

- Cobertura >= 80% de los archivos nuevos (callables + services + componentes)
- Branches cubiertas: admin check (si/no), validation errors, happy path, Firestore errors
- Side effects verificados: `abuseLogs` escrito con detail correcto, `trackEvent` con payload correcto

---

## Rollout

### Orden sugerido

1. Constants analytics + GA4_EVENT_NAMES (cero risk — extension de whitelist)
2. Callable `adminListRateLimits` + tests + deploy a staging
3. Callable `adminResetRateLimit` + tests + deploy staging
4. Callable `adminDeleteListItem` + tests + deploy staging
5. Servicios frontend + tests
6. RateLimitsSection + tests
7. Integracion en AbuseAlerts (nueva tab)
8. FeaturedListsPanel extension + tests
9. Verificacion manual en staging con admin account

### Feature flag

No necesario — es una tab nueva de admin, no afecta usuarios finales. Si fallara, admin simplemente no usa la nueva seccion.

### Rollback

1. Cloud Functions: redeploy sin las nuevas callables (`firebase deploy --only functions:adminListRateLimits:delete`)
2. Frontend: revert branch merge

---

## Alineacion con patterns existentes

- ✅ Service layer boundary (`services/admin/*`, nunca `firebase/firestore` en componentes)
- ✅ `useAsyncData` para fetching con loading/error
- ✅ `AdminPanelWrapper` para envoltura consistente
- ✅ Callable pattern con `assertAdmin` + `ENFORCE_APP_CHECK_ADMIN`
- ✅ Rate limit callable con `checkCallableRateLimit`
- ✅ `trackFunctionTiming` en todas las callables nuevas
- ✅ `logAbuse` con `type: 'config_edit'` para trail auditable
- ✅ Toasts via `useToast()` context
- ✅ Copy centralizado en `src/constants/messages/admin.ts`
- ✅ Analytics events en archivo de dominio `admin.ts` (no barrel)
- ✅ React.memo en componentes de row con props estables

---

## Estimacion de LOC

| Archivo | LOC |
|---------|-----|
| `functions/src/admin/rateLimits.ts` | ~120 |
| `functions/src/admin/listItems.ts` | ~80 |
| `functions/src/admin/rateLimits.test.ts` | ~200 |
| `functions/src/admin/listItems.test.ts` | ~130 |
| `src/services/admin/rateLimits.ts` | ~30 |
| `src/services/admin/listItems.ts` | ~15 |
| `src/services/admin/rateLimits.test.ts` | ~80 |
| `src/services/admin/listItems.test.ts` | ~40 |
| `src/components/admin/alerts/RateLimitsSection.tsx` | ~200 |
| `src/components/admin/alerts/RateLimitRow.tsx` | ~60 |
| `src/components/admin/alerts/RateLimitsSection.test.tsx` | ~150 |
| FeaturedListsPanel delta | +80 |
| FeaturedListsPanel test nuevo | ~120 |
| AbuseAlerts delta | +10 |
| analyticsReport delta | +6 |
| ga4FeatureDefinitions delta | +18 |
| constants/messages/admin delta | +15 |
| constants/analyticsEvents/admin delta | +3 |
| types/admin delta | +10 |

**Total estimado:** ~1360 LOC (codigo + tests)

Ningun archivo supera el limite de 400 lineas.
