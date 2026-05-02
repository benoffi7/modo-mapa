# Specs: Admin metrics — orphaned events + _rateLimits/listItems UI gaps

**PRD:** [prd.md](prd.md)
**Issue:** #327
**Fecha:** 2026-04-29

---

## Modelo de datos

Sin colecciones nuevas. Sin campos nuevos. Sin cambios en Firestore rules.

Reuso del payload del callable `adminListRateLimits` (ya desplegado en `functions/src/admin/rateLimits.ts`):

```ts
// functions/src/admin/rateLimits.ts (existente, sin cambios)
export interface AdminRateLimitItem {
  docId: string;
  category: string;
  userId: string;
  count: number;
  resetAt: number;        // ms epoch
  windowActive: boolean;  // now < resetAt
}
```

Espejo en frontend: agregar `AdminRateLimitItem` a `src/types/admin.ts` (mismo shape), importable por `RateLimitsSection` y por `services/admin/rateLimits.ts`.

```ts
// src/types/admin.ts (agregar al final del archivo)
export interface AdminRateLimitItem {
  docId: string;
  category: string;
  userId: string;
  count: number;
  resetAt: number;
  windowActive: boolean;
}
```

Tipos de request/response (privados al service frontend, no se exportan a consumidores):

- `adminListRateLimits` request: `{ userId?: string; limit?: number }` → response `{ items: AdminRateLimitItem[] }`
- `adminResetRateLimit` request: `{ docId: string }` → response `{ success: true }`
- `adminDeleteListItem` request: `{ itemId: string }` → response `{ success: true }`

## Firestore Rules

Sin cambios. `_rateLimits` y `listItems` siguen `Functions only` para writes — los callables admin operan via `firebase-admin` (bypass rules).

### Rules impact analysis

| Query (service file) | Collection | Auth context | Rule que la permite | Cambio? |
|----------------------|------------|--------------|---------------------|---------|
| `adminListRateLimits` (server-side, callable) | `_rateLimits` | Admin via `assertAdmin` + `firebase-admin` | Admin SDK bypass | No |
| `adminResetRateLimit` (server-side, callable) | `_rateLimits` | Admin via `assertAdmin` + `firebase-admin` | Admin SDK bypass | No |
| `adminDeleteListItem` (server-side, callable) | `listItems` + `sharedLists` | Admin via `assertAdmin` + `firebase-admin` | Admin SDK bypass | No |
| `fetchListItems(listId)` (frontend, ya existente) | `listItems` | Admin con cuenta de usuario logueada | `read: if request.auth != null && (lista publica O owner O editor)` — admin lee listas publicas | No |

### Field whitelist check

No hay campos nuevos en escrituras de cliente. Las acciones destructivas (`delete _rateLimits`, `decrement itemCount`, `delete listItems`) pasan por callables admin que ya estan auditados (#310).

## Cloud Functions

Sin cambios en las callables. Las 3 callables admin (`adminListRateLimits`, `adminResetRateLimit`, `adminDeleteListItem`) ya estan implementadas, testeadas y desplegadas (#310). Solo cambia un archivo:

- **Modificar `functions/src/admin/analyticsReport.ts`:** agregar `'map_load_failed'` y `'admin_rate_limit_viewed'` al array `GA4_EVENT_NAMES`. Insertar `'map_load_failed'` en la seccion "System" (junto a `'force_update_*'` y `'app_version_active'`); insertar `'admin_rate_limit_viewed'` en la seccion "Admin tools (#310)".

## Seed Data

N/A — no hay colecciones nuevas ni campos nuevos. Los seeds existentes para `_rateLimits` (si existen para QA) siguen vigentes.

## Componentes

### `RateLimitsSection.tsx` (nuevo)

**Path:** `src/components/admin/alerts/RateLimitsSection.tsx`

**Props:** ninguno — el componente es self-contained.

**Renderiza:**

- `TextField` "Filtrar por User ID" (debounced 300ms con `useDeferredValue`).
- Boton "Limpiar" cuando hay filtro activo.
- Texto pequeno informativo: "Mostrando docs con campo userId. Para casos previos a v2.42, listar sin filtro o usar Cloud Console."
- Tabla MUI (`size="small"`) con columnas:
  - `category` — Chip pequeno (`CHIP_SMALL_SX` de `theme/cards.ts`).
  - `userId` — texto truncado a 8 chars + `Tooltip` con uid completo.
  - `count` — numero alineado derecha.
  - `resetAt` — `formatRelativeTime(new Date(resetAt))`.
  - `windowActive` — Chip ON/OFF (verde/gris).
  - Accion: `Button size="small"` "Resetear" (deshabilitado cuando `isOffline`, tooltip "Requiere conexion").
- Estado vacio: "Sin entradas" / "Sin resultados para este User ID".
- Estado loading: spinner via `AdminPanelWrapper`.
- Estado error: `Alert severity="error"` con boton "Reintentar" → `refetch()`.
- `Dialog role="alertdialog"` confirmacion al click "Resetear":
  - Title: "¿Resetear rate limit?".
  - Body si `windowActive: true`: "Desbloquea al usuario `{userId 8 chars}…` en categoria `{category}` inmediatamente."
  - Body si `windowActive: false`: "Limpia esta entrada (la ventana ya expiró). Es housekeeping."
  - Buttons: "Cancelar" / "Resetear" (color `error`, `disabled={submitting || isOffline}`).

**Hooks usados:**

- `useAsyncData(fetcher)` con `fetcher = useCallback(() => listAdminRateLimits({ userId: filter || undefined }), [filter])`.
- `useToast()` para success/error/info toasts.
- `useConnectivity()` para gating del boton reset.
- `useState`: `userIdFilter`, `dialogState`, `submitting`.
- `useRef<boolean>` para `viewedEmittedRef` (dedup `admin_rate_limit_viewed`).

**Tamano estimado:** ~220 lineas (dentro del threshold 400).

### `AbuseAlerts.tsx` (modificar)

**Path:** `src/components/admin/AbuseAlerts.tsx`

**Cambios:**

- Tipo de `innerTab`: `'alerts' | 'reincidentes' | 'rateLimits'`.
- Agregar `<Tab value="rateLimits" label="Rate Limits" />` al `Tabs` interno.
- Wrap `KpiCard` x4 en `{innerTab !== 'rateLimits' && (<Box sx={...}>...</Box>)}`. (Las KPI cards estan **fuera** del `{innerTab === 'alerts' && ...}` actual — requiere el wrap explicito.)
- `<AlertsFilters />` y la lista filtrada ya estan dentro de `{innerTab === 'alerts' && ...}` — no requieren cambio adicional.
- Renderizar `<RateLimitsSection />` dentro de `{innerTab === 'rateLimits' && ...}`.
- Llamar a `useAbuseLogsRealtime(200, innerTab !== 'rateLimits')` (segundo argumento `enabled`).

### `FeaturedListsPanel.tsx` (modificar)

**Path:** `src/components/admin/FeaturedListsPanel.tsx`

**Imports nuevos:**

- `IconButton`, `Dialog`, `DialogTitle`, `DialogContent`, `DialogContentText`, `DialogActions`, `Tooltip`.
- `DeleteOutlineIcon` desde `@mui/icons-material/DeleteOutline`.
- `adminDeleteListItem` desde `services/admin`.
- `fetchUserDisplayNames` desde `services/users`.
- `useConnectivity` desde `context/ConnectivityContext`.
- `trackEvent` desde `utils/analytics`.
- `EVT_ADMIN_LIST_ITEMS_INSPECTED`, `EVT_ADMIN_LIST_ITEM_DELETED` desde `constants/analyticsEvents/admin`.
- `CHIP_SMALL_SX` desde `theme/cards`.
- `logger` desde `utils/logger`.

**Estado nuevo:**

- `const [displayNames, setDisplayNames] = useState<Map<string, string>>(new Map())`.
- `const [deleteDialog, setDeleteDialog] = useState<{ item: ListItemType; list: SharedList } | null>(null)`.
- `const [deleting, setDeleting] = useState<boolean>(false)`.
- `const [localItemCounts, setLocalItemCounts] = useState<Map<string, number>>(new Map())` — optimistic decrement.
- `const inspectedListsRef = useRef<Set<string>>(new Set())` — dedup de `admin_list_items_inspected`.

**Modificacion en `handleToggleExpand(listId)`:**

1. Si ya esta expandido, colapsar (sin emitir analytics).
2. Si no esta expandido y no esta en cache:
   - `const items = await fetchListItems(listId)` (existente; ya limpio el `} catch { /* ignore */ }` actual a `logger.warn`).
   - `const realCount = items.length` (antes del slice).
   - Aplicar `const truncated = items.slice(0, 50)` y guardarlos en `expandedItems`.
   - Si `inspectedListsRef.current` no contiene `listId`:
     - `trackEvent(EVT_ADMIN_LIST_ITEMS_INSPECTED, { listId, itemCount: realCount })`.
     - `inspectedListsRef.current.add(listId)`.
   - Resolver displayNames de `addedBy` para los items truncados:
     - `const uids = [...new Set(truncated.map((i) => i.addedBy).filter((uid): uid is string => Boolean(uid) && !displayNames.has(uid)))]`.
     - `if (uids.length > 0) { const newNames = await fetchUserDisplayNames(uids); setDisplayNames((prev) => new Map([...prev, ...newNames])); }`.
   - Si `realCount > 50`, mostrar texto "Mostrando 50 de {realCount} — usar Cloud Console para casos extremos" debajo del listado expandido (con `aria-live="polite"`).

**Render de cada item dentro del Collapse:**

- `<ListItem secondaryAction={<Tooltip title={isOffline ? 'Requiere conexión' : ''}><span><IconButton size="small" disabled={isOffline} onClick={() => setDeleteDialog({ item, list })} aria-label={\`Eliminar \${business.name} de \${list.name}\`}><DeleteOutlineIcon fontSize="small" /></IconButton></span></Tooltip>}>`.
- Mostrar `addedBy` resuelto:
  - Si `item.addedBy`: `<Chip size="small" sx={CHIP_SMALL_SX} label={\`\${displayNames.get(item.addedBy) ?? item.addedBy.slice(0, 8) + '…'} \${item.addedBy === list.ownerId ? '(Owner)' : '(Editor)'}\`} />` debajo de la fila secundaria.

**Render del secondary text de la lista:** usar `localItemCounts.get(list.id) ?? list.itemCount` para el conteo (refleja decremento optimistico).

**Dialog confirmacion (al final del JSX):**

- `<Dialog role="alertdialog" open={!!deleteDialog} onClose={() => !deleting && setDeleteDialog(null)} aria-labelledby="delete-item-title">`.
- Title id `"delete-item-title"`: `¿Eliminar {business.name} de {list.name}?`.
- Body: "Esta acción elimina el item de la lista y decrementa el contador. El abuseLog queda auditado."
- Buttons: "Cancelar" (close) / "Eliminar" (color `error`, `disabled={deleting || isOffline}`).
- onConfirm:
  - `setDeleting(true)`.
  - `try { await adminDeleteListItem(item.id); }`
  - Success: `toast.success(MSG_ADMIN.listItemDeleteSuccess); trackEvent(EVT_ADMIN_LIST_ITEM_DELETED, { listId: list.id, itemId: item.id });` → mutar `expandedItems` (filtrar item del array) + `setLocalItemCounts((m) => new Map(m).set(list.id, (m.get(list.id) ?? list.itemCount) - 1))` + cerrar dialog.
  - Error con `code === 'functions/not-found'`: `toast.info(MSG_ADMIN.listItemAlreadyDeleted); refetch();` (autoritativo desde `fetchPublicLists`) + cerrar dialog.
  - Otro error: `logger.error('adminDeleteListItem failed', err); toast.error(MSG_ADMIN.listItemDeleteError)`.
  - `finally { setDeleting(false); }`.

**Tamano estimado:** archivo crece de ~155 a ~310 lineas. Por debajo de 400. Si excede en implementacion, extraer `FeaturedListItemRow.tsx` y `DeleteListItemDialog.tsx` al subdir `admin/featured/`.

### Mutable prop audit

| Componente | Prop | Editable fields | Local state needed? | Parent callback |
|-----------|------|----------------|---------------------|-----------------|
| `FeaturedListsPanel` | `data: SharedList[]` (de `useAsyncData`) | `itemCount` post-delete | YES — `localItemCounts: Map<listId, number>` | Refetch via `useAsyncData.refetch()` post-delete (autoritativo desde backend) |
| `RateLimitsSection` | n/a (self-fetched) | n/a | n/a — refetch post-reset | n/a |
| `AbuseAlerts` (subtab switch) | n/a | n/a | n/a — `innerTab` es state local; el flag `enabled` resetea `useAbuseLogsRealtime` cuando vuelve a `alerts` | n/a |

**Decision sobre optimistic update de `itemCount`:** la callable decrementa server-side. Para evitar fetch full de `fetchPublicLists` post-delete (que reordena la tabla y causa flicker), aplicamos update optimista local y refetch diferido al cambiar de tab y volver. Si el delete falla, no aplicamos el decremento.

## Textos de usuario

| Texto | Donde se usa | Notas |
|-------|--------------|-------|
| "Rate Limits" | label del subtab en `AbuseAlerts` | sin tilde (termino tecnico admin) |
| "Filtrar por User ID" | label del TextField en `RateLimitsSection` | minuscula segun convencion MUI |
| "Limpiar" | boton de filtro | accion |
| "Mostrando docs con campo userId. Para casos previos a v2.42, listar sin filtro o usar Cloud Console." | helper text en `RateLimitsSection` | sin tildes especiales |
| "¿Resetear rate limit?" | titulo Dialog | apertura `¿` |
| "Desbloquea al usuario {uid}… en categoría {category} inmediatamente." | body Dialog cuando `windowActive` | tilde "categoría" |
| "Limpia esta entrada (la ventana ya expiró). Es housekeeping." | body Dialog cuando `!windowActive` | "expiró" con tilde |
| "Cancelar" / "Resetear" | acciones Dialog rate limits | reset color error |
| "Reseteado correctamente" | toast success | `MSG_ADMIN.rateLimitResetSuccess` |
| "No se pudo resetear. Verificá tu sesión admin." | toast error | `MSG_ADMIN.rateLimitResetError`, voseo |
| "Esta entrada ya fue reseteada por otro admin. Refrescamos la tabla." | toast info race | `MSG_ADMIN.rateLimitAlreadyReset` |
| "Sin entradas" / "Sin resultados para este User ID" | empty states | |
| "¿Eliminar {business.name} de {list.name}?" | titulo Dialog FeaturedListsPanel | apertura `¿` |
| "Esta acción elimina el item de la lista y decrementa el contador. El abuseLog queda auditado." | body Dialog | "acción" |
| "Eliminado correctamente" | toast success | `MSG_ADMIN.listItemDeleteSuccess` |
| "No se pudo eliminar el item. Verificá tu sesión admin." | toast error | `MSG_ADMIN.listItemDeleteError`, voseo |
| "Item ya eliminado por otro admin. Refrescá la lista." | toast info race | `MSG_ADMIN.listItemAlreadyDeleted`, voseo |
| "Mostrando 50 de {N} — usar Cloud Console para casos extremos" | helper bajo lista expandida | aria-live polite |
| "(Owner)" / "(Editor)" | chip en cada item | sin cambios |
| "Requiere conexión" | tooltip de boton offline | tilde |
| "Errores de mapa" | nombre del feature en `ga4FeatureDefinitions.ts` categoria `system` | tilde |

Todos los textos centralizados en `MSG_ADMIN` extendido (`src/constants/messages/admin.ts`). Nuevas keys:

```ts
rateLimitResetSuccess: 'Reseteado correctamente',
rateLimitResetError: 'No se pudo resetear. Verificá tu sesión admin.',
rateLimitAlreadyReset: 'Esta entrada ya fue reseteada por otro admin. Refrescamos la tabla.',
listItemDeleteSuccess: 'Eliminado correctamente',
listItemDeleteError: 'No se pudo eliminar el item. Verificá tu sesión admin.',
listItemAlreadyDeleted: 'Item ya eliminado por otro admin. Refrescá la lista.',
```

## Hooks

### `useAbuseLogsRealtime` (modificar — agregar parametro `enabled`)

**Path:** `src/hooks/useAbuseLogsRealtime.ts`

**Signature nueva:**

```ts
export function useAbuseLogsRealtime(
  maxDocs = 200,
  enabled = true,
): UseAbuseLogsRealtimeReturn
```

**Cambios:**

- Agregar `enabled` al array de deps del `useEffect`.
- Si `!enabled`: no llamar a `subscribeToAbuseLogs`. Resetear: `setLogs(null); setLoading(false); setError(false); setNewCount(0); initialIds.current = null;`. El return del effect es noop.
- Si `enabled` flippea `false → true`: el effect se re-ejecuta y suscribe limpio (con `initialIds.current` reseteado, no se cuentan como "nuevos" los que ya existian — comportamiento correcto: el primer snapshot al re-suscribir setea `initialIds`).

**Tests existentes:** los tests del hook (si existen) deben seguir pasando con `enabled = true` default. Agregar test para `enabled = false`: no se suscribe, state queda en valores reset. Test para flip `false → true`: re-suscribe limpio.

### Sin hooks nuevos para `RateLimitsSection`

Reusa `useAsyncData` + `useConnectivity` + `useToast`. No vale crear un hook custom para este caso.

## Servicios

### `src/services/admin/rateLimits.ts` (nuevo)

```ts
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../config/firebase';
import type { AdminRateLimitItem } from '../../types/admin';

interface ListAdminRateLimitsRequest {
  userId?: string;
  limit?: number;
}

interface ListAdminRateLimitsResponse {
  items: AdminRateLimitItem[];
}

interface ResetAdminRateLimitRequest {
  docId: string;
}

interface SuccessResponse {
  success: true;
}

/** Lista entradas activas de `_rateLimits`. Admin-only. */
export async function listAdminRateLimits(
  params: ListAdminRateLimitsRequest = {},
): Promise<AdminRateLimitItem[]> {
  const fn = httpsCallable<ListAdminRateLimitsRequest, ListAdminRateLimitsResponse>(
    functions,
    'adminListRateLimits',
  );
  const request: ListAdminRateLimitsRequest = {};
  if (params.userId !== undefined) request.userId = params.userId;
  if (params.limit !== undefined) request.limit = params.limit;
  const result = await fn(request);
  return result.data.items;
}

/** Resetea (borra) una entrada de `_rateLimits` por docId. Admin-only. */
export async function resetAdminRateLimit(docId: string): Promise<void> {
  const fn = httpsCallable<ResetAdminRateLimitRequest, SuccessResponse>(
    functions,
    'adminResetRateLimit',
  );
  await fn({ docId });
}
```

### `src/services/admin/listItems.ts` (nuevo)

```ts
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../config/firebase';

interface DeleteListItemRequest {
  itemId: string;
}

interface SuccessResponse {
  success: true;
}

/** Elimina un item de `listItems` con cascade del `itemCount`. Admin-only. */
export async function adminDeleteListItem(itemId: string): Promise<void> {
  const fn = httpsCallable<DeleteListItemRequest, SuccessResponse>(
    functions,
    'adminDeleteListItem',
  );
  await fn({ itemId });
}
```

### `src/services/admin/index.ts` (modificar barrel)

Agregar al final:

```ts
export { listAdminRateLimits, resetAdminRateLimit } from './rateLimits';
export { adminDeleteListItem } from './listItems';
```

Patron consistente con `backups.ts` (re-export named).

## Integracion

### Como conecta con codigo existente

1. **AbuseAlerts subtab:** `RateLimitsSection` se renderiza dentro del switch `innerTab === 'rateLimits'`. Reusa el `AdminPanelWrapper` outer del tab — solo cambia el contenido.
2. **FeaturedListsPanel inline delete:** mantiene la estructura de `Collapse + ListItem`. Solo agrega `secondaryAction` con IconButton + Chip de `addedBy`. El refetch usa `useAsyncData.refetch()` post-delete; ademas optimistic update local de `itemCount`.
3. **GA4 wiring:** `EVT_MAP_LOAD_FAILED` ya emitido desde `MapErrorBoundary.tsx:31`. Solo registrarlo en `GA4_EVENT_NAMES` (backend) + agregar feature `map_errors` en `ga4FeatureDefinitions.ts` (frontend) categoria `system`.
4. **Admin tools categoria:** el feature `admin_metrics` en `ga4FeatureDefinitions.ts` ya incluye `'admin_list_items_inspected', 'admin_rate_limit_reset', 'admin_list_item_deleted'`. Agregar `'admin_rate_limit_viewed'` (nuevo evento).

### Preventive checklist

- [x] **Service layer:** componentes nuevos solo importan de `services/admin/*`. No importan `firebase/firestore` ni `firebase/functions` directos. Wrappers via `services/admin/rateLimits.ts` y `services/admin/listItems.ts` consistentes con `backups.ts`.
- [x] **Duplicated constants:** sin nuevas constantes inline. `MSG_ADMIN` se extiende en `constants/messages/admin.ts`. Eventos analytics en `constants/analyticsEvents/admin.ts`.
- [x] **Context-first data:** ninguno de los datos nuevos esta en un Context — todos via callable.
- [x] **Silent .catch:** todos los `try/catch` usan `logger.error` minimo + `toast.error` user-facing. Existing `} catch { /* ignore */ }` en `FeaturedListsPanel:58` se reemplaza por `logger.warn('FeaturedListsPanel fetchListItems failed', err)`.
- [x] **Stale props:** `FeaturedListsPanel` modifica `itemCount` con state local (`localItemCounts`) + refetch diferido. Documentado en "Mutable prop audit".

## Tests

| Archivo test | Que testear | Tipo |
|--------------|-------------|------|
| `src/services/admin/__tests__/rateLimits.test.ts` (crear) | `listAdminRateLimits` con/sin filtro userId, retorna `items` directo, propagacion de errores. `resetAdminRateLimit` llama a `adminResetRateLimit` con `{ docId }`, propagacion de error `not-found` | Service |
| `src/services/admin/__tests__/listItems.test.ts` (crear) | `adminDeleteListItem` llama a `adminDeleteListItem` con `{ itemId }`, propagacion de error `not-found` | Service |
| `src/components/admin/alerts/__tests__/RateLimitsSection.test.tsx` (crear) | Loading via `AdminPanelWrapper`, empty state, filtro userId con debounce, tabla con rows, click reset abre `Dialog role="alertdialog"`, confirmar llama `resetAdminRateLimit` y refetch, emite `admin_rate_limit_viewed` (1 vez por mount), emite `admin_rate_limit_reset` al confirmar, error `not-found` mapea a `toast.info` con `MSG_ADMIN.rateLimitAlreadyReset`, boton reset deshabilitado cuando offline | Component |
| `src/components/admin/__tests__/FeaturedListsPanel.test.tsx` (crear) | Expandir lista emite `admin_list_items_inspected` UNA vez (no se reemite al colapsar/reexpandir mismo `listId`), resuelve `addedBy` a displayName via `fetchUserDisplayNames`, IconButton delete aparece en items expandidos con `aria-label`, dialog confirmacion abre/cierra, llama a `adminDeleteListItem` y emite `admin_list_item_deleted`, decrementa `itemCount` local optimisticamente, error `not-found` mapea a `MSG_ADMIN.listItemAlreadyDeleted`. Truncado a 50 items y mensaje "Mostrando 50 de N" cuando `items.length > 50` | Component |
| `src/components/admin/features/__tests__/ga4FeatureDefinitions.test.ts` (existente) | Sigue pasando con feature `map_errors` agregado y `map_load_failed` en exactamente UNA categoria (constraint enforced por test "no duplicate eventNames"). `admin_rate_limit_viewed` en categoria `admin_tools.admin_metrics` | Constants |
| `src/hooks/__tests__/useAbuseLogsRealtime.test.ts` (verificar — crear si no existe) | `enabled = true` (default): suscribe normal. `enabled = false`: NO se suscribe, state reset a `{ logs: null, loading: false, error: false, newCount: 0 }`. Flip `false → true`: re-suscribe limpio | Hook |
| `functions/src/admin/__tests__/analyticsReport.test.ts` (verificar) | Si hay test snapshot de `GA4_EVENT_NAMES.length`, actualizar valor esperado | Backend |

**Mock strategy:**

- Servicios: `vi.mock('firebase/functions', () => ({ httpsCallable: vi.fn(() => mockCallable) }))` siguiendo patron de `backups.test.ts`.
- Componentes: mockear barrel `services/admin` con `vi.hoisted()` (siguiendo memoria `feedback_vitest_mock_patterns`) + mock de `useToast`, `useConnectivity`, `trackEvent`.
- Hooks: mockear `subscribeToAbuseLogs` (de `services/abuseLogs`) para retornar funciones unsubscribe que el test pueda spy.

## Analytics

| Evento | Donde se emite | Params | Estado |
|--------|----------------|--------|--------|
| `admin_rate_limit_viewed` | `RateLimitsSection`, primera vez que `useAsyncData` resuelve con success en el mount (dedup `viewedEmittedRef`) | `{}` | NUEVO — agregar `EVT_ADMIN_RATE_LIMIT_VIEWED` en `constants/analyticsEvents/admin.ts` + `GA4_EVENT_NAMES` (backend) + `admin_tools.admin_metrics.eventNames` (frontend) |
| `admin_rate_limit_reset` | `RateLimitsSection`, despues de confirmar Dialog y resolver callable success | `{ category }` | YA REGISTRADO (#310) |
| `admin_list_item_deleted` | `FeaturedListsPanel`, despues de confirmar Dialog y resolver delete | `{ listId, itemId }` | YA REGISTRADO |
| `admin_list_items_inspected` | `FeaturedListsPanel.handleToggleExpand`, una vez por `listId` por mount (dedup via `inspectedListsRef`) | `{ listId, itemCount }` (real, no truncado) | YA REGISTRADO |
| `map_load_failed` | `MapErrorBoundary.tsx:31` (existente, sin cambios) | params existentes | YA EMITIDO; agregar a `GA4_EVENT_NAMES` (backend) + nueva feature `map_errors` (frontend) |

Constantes nuevas en `src/constants/analyticsEvents/admin.ts`:

```ts
export const EVT_ADMIN_RATE_LIMIT_VIEWED = 'admin_rate_limit_viewed';
export const EVT_ADMIN_RATE_LIMIT_RESET = 'admin_rate_limit_reset';
export const EVT_ADMIN_LIST_ITEM_DELETED = 'admin_list_item_deleted';
export const EVT_ADMIN_LIST_ITEMS_INSPECTED = 'admin_list_items_inspected';
```

(Las 3 ultimas existen como string literales en el codigo de #310 — esta es una migracion suave a constantes para los nuevos callsites; los callsites existentes pueden migrarse en cleanup posterior, no es scope de #327.)

---

## Offline

### Cache strategy

| Dato | Estrategia | TTL | Storage |
|------|-----------|-----|---------|
| `_rateLimits` items | Sin cache (admin-only, reads via callable) | n/a | n/a |
| `listItems` (FeaturedListsPanel) | Patron actual sin cambios (in-memory `expandedItems` Map) | sesion | RAM |
| `displayNames` resueltos | In-memory durante la vida del componente | sesion | RAM |

### Writes offline

| Operacion | Mecanismo | Conflict resolution |
|-----------|-----------|--------------------|
| `resetAdminRateLimit` | Boton deshabilitado cuando `isOffline === true`, tooltip "Requiere conexión" | n/a — accion bloqueada offline |
| `adminDeleteListItem` | Boton deshabilitado cuando `isOffline === true` | n/a |
| `adminListRateLimits` (read) | Si callable falla por offline, `AdminPanelWrapper` muestra error state con boton "Reintentar" | Reintento manual |

### Fallback UI

- `RateLimitsSection`: si `useAsyncData.error === true`, mostrar `Alert severity="error"` con boton "Reintentar" → `refetch()`. Empty state: "Sin entradas" / "Sin resultados".
- `FeaturedListsPanel`: si `adminDeleteListItem` falla por offline, el toast.error muestra mensaje generico "No se pudo eliminar el item. Verificá tu sesión admin.".

**Decision verificada: `useConnectivity` SI esta disponible en el subtree admin** — `App.tsx:38` envuelve toda la app (incluyendo `/admin` lazy-loaded) en `ConnectivityProvider`. Componentes admin existentes ya lo consumen sin guards defensivos (`SpecialsPanel.tsx:31`, `AchievementsPanel.tsx:41`, `ModerationActions.tsx:40`). **Resuelve observacion #3 de Sofia.**

---

## Accesibilidad y UI mobile

| Componente | Elemento | aria-label | Min touch target | Error state |
|-----------|----------|------------|------------------|-------------|
| `RateLimitsSection` | TextField filtro | label nativo "Filtrar por User ID" | n/a (input) | helperText error si callable falla |
| `RateLimitsSection` | Boton "Limpiar" | "Limpiar filtro" | 44x44 (Button `size="small"` con `sx={{ minHeight: 44 }}`) | n/a |
| `RateLimitsSection` | Boton "Resetear" en row | `Resetear rate limit de {userId}… (categoría {category})` | 44x44 | tooltip "Requiere conexión" si offline |
| `RateLimitsSection` | Dialog confirmacion | `role="alertdialog"`, `aria-labelledby` apuntando al title | n/a | n/a |
| `FeaturedListsPanel` | IconButton delete | `Eliminar {business.name} de {list.name}` | 44x44 (IconButton `size="small"` con `sx={{ p: 1 }}`) | tooltip offline |
| `FeaturedListsPanel` | Dialog confirmacion | `role="alertdialog"`, `aria-labelledby` | n/a | n/a |
| `FeaturedListsPanel` | Chip "(Owner)"/"(Editor)" | dato visual; sin aria-label | n/a | n/a |

### Reglas

- `<IconButton>` delete **siempre** con `aria-label` que incluye business name + list name.
- `<Button>` reset incluye categoria + uid en el aria-label para contexto a screen readers.
- Dialogs destructivos: `role="alertdialog"` (patron `DeleteAccountDialog`).
- Touch targets: IconButton/Button `size="small"` por default es 30x30. Override con `sx={{ p: 1 }}` o `sx={{ minHeight: 44 }}` para llegar a 44x44.
- Tablas con loading via `AdminPanelWrapper`.
- `<img>`: n/a (sin imagenes nuevas).
- `aria-live="polite"` en el contador "Mostrando 50 de N" para que screen readers anuncien al expandir distintas listas.

## Textos y copy

Reutilizar `MSG_ADMIN` extendido. Voseo y tildes verificados en tabla "Textos de usuario".

### Reglas de copy aplicadas

- Voseo: "Verificá", "Refrescá".
- Tildes: "categoría", "acción", "conexión", "expiró", "sesión".
- Terminologia: "rate limit" se mantiene (tecnico admin).
- Strings reutilizables en `src/constants/messages/admin.ts`.

---

## Decisiones tecnicas

### D1. Refactor de `useAbuseLogsRealtime` con `enabled` flag (vs detach via `useEffect`)

**Decision:** refactor del hook con parametro `enabled = true` default. **Resuelve observacion #1 de Sofia.**

**Razones:**

- Patron canonico del proyecto: hooks con suscripciones onSnapshot que necesitan pausarse aceptan `enabled` como flag.
- El detach via `useEffect` en el componente requiere reachar dentro del hook con un cleanup manual desde el componente — invasivo y duplica responsabilidad.
- Backward compat: tests existentes pasan default `true`.
- Reset de state al `enabled = false`: evita header con badges desactualizados al cambiar de subtab y volver.

**Trade-off:** un parametro adicional en la signature del hook. Aceptable.

### D2. Truncado client-side a 50 items vs count server-side

**Decision:** mantener client-side `items.slice(0, 50)` con descarga completa para calcular `itemCount` real. **Resuelve observacion #2 de Sofia.**

**Razones:**

- `LIST_ITEM_MAX` del producto ya cota las listas (typicamente ≤ 200). Una lista publica destacada raramente excede 100 items.
- Implementar count server-side requiere modificar `adminDeleteListItem` o crear callable nueva (`adminCountListItems`) — saca el cambio del scope de #327.
- El admin de moderacion espera ver TODOS los items para inspeccion; truncar server-side requeriria paginacion UI extra.
- El `itemCount` autoritativo vive en `sharedLists/{listId}.itemCount` (mantenido por triggers + `adminDeleteListItem`); el descargar completa es solo para que `admin_list_items_inspected` reporte el count real.
- Mostrar texto "Mostrando 50 de N" deja la decision al admin para casos extremos.

**Trade-off:** una lista con 200 items consume ~30KB extra de descarga (campos minimos `listItems`). Aceptable para uso admin de baja frecuencia. **Followup opcional (no #327):** mover el `realCount` a una segunda lectura cheap del field `sharedLists/{id}.itemCount` antes del fetch de items, evitando descarga full si el admin solo quiere ver los primeros 50. Anotar como tech debt si la lectura se vuelve frecuente.

### D3. Optimistic update de `itemCount` en `FeaturedListsPanel`

**Decision:** mantener `localItemCounts: Map<listId, number>` para mostrar decremento inmediato, sin refetch full del panel post-delete.

**Razones:**

- `useAsyncData.refetch()` re-corre `fetchPublicLists` que reordena la tabla — flicker visual.
- El backend ya decrementa atomicamente — el valor local converge al cambio de tab y vuelta (refetch en mount).

### D4. `useConnectivity` disponible en subtree admin

**Decision verificada:** SI esta disponible (ver "Decision verificada" en seccion Offline). Uso directo de `const { isOffline } = useConnectivity();` sin try/catch defensivo. **Resuelve observacion #3 de Sofia.**

### D5. Dedup de `admin_list_items_inspected`

**Decision:** `useRef<Set<string>>(new Set())` a nivel componente, no a nivel sesion global.

**Razones:**

- El componente se desmonta cuando el admin sale del tab "Featured Lists". Al volver, el Set se vacia y se vuelve a emitir el evento al primer expand. Esto es deseable: refleja una sesion de moderacion nueva.
- Alternativa con `sessionStorage` seria mas estricto pero la moderacion admin no es de alta frecuencia y el evento es para monitoring (no para billing). El ref local es suficiente.

### D6. Migracion suave de event-name strings a constantes

**Decision:** crear constantes `EVT_ADMIN_*` en `constants/analyticsEvents/admin.ts` para los nuevos callsites. NO migrar callsites existentes de #310 (fuera de scope). El `copy-auditor` y el sidebar quedan limpios para futuros features.

---

## Hardening de seguridad

### Firestore rules requeridas

Sin cambios. `_rateLimits` y `listItems` siguen `Functions only` para writes (verificable en `firestore.rules`). Los callables admin operan via `firebase-admin` que bypasea rules.

### Rate limiting

| Coleccion / accion | Limite | Implementacion |
|-------------------|--------|----------------|
| `adminListRateLimits` (callable) | 30/dia por admin | Ya enforced via `checkCallableRateLimit('admin_rate_limits_{uid}')` |
| `adminResetRateLimit` (callable) | 20/dia por admin | Ya enforced via `checkCallableRateLimit('admin_rate_limit_reset_{uid}')` |
| `adminDeleteListItem` (callable) | 50/dia por admin | Ya enforced via `checkCallableRateLimit('admin_delete_list_item_{uid}')` |

### Vectores de ataque mitigados

| Ataque | Mitigacion | Archivo |
|--------|-----------|---------|
| Admin comprometido scrapea historial de rate limits via spam de paginas | Rate limit 30/dia por admin server-side | `functions/src/admin/rateLimits.ts:115-121` |
| Admin comprometido elimina items masivamente sin trail | Cada `adminDeleteListItem` escribe `abuseLog` con `{ itemId, listId, businessId, addedBy }` | `functions/src/admin/listItems.ts:72-83` |
| Inyeccion de userId arbitrario en filtro UI | Validacion server-side `UID_REGEX` en `adminListRateLimits` | `functions/src/admin/rateLimits.ts:101-104` |
| XSS via displayName malicioso | React JSX escaping default — `displayNames.get(uid)` se renderiza en `<Chip label>` sin `dangerouslySetInnerHTML` | `FeaturedListsPanel.tsx` |
| Race condition multi-admin (entry ya reseteada) | Mapeo `HttpsError 'not-found'` → `toast.info` + refetch automatico | `RateLimitsSection.tsx`, `FeaturedListsPanel.tsx` handlers |

---

## Deuda tecnica: mitigacion incorporada

Issues abiertos relevantes verificados (consultar antes de implementar):

```bash
gh issue list --label security --state open --json number,title
gh issue list --label "tech debt" --state open --json number,title
```

| Issue | Que se resuelve | Paso del plan |
|-------|----------------|---------------|
| #310 (cerrado) gap UI de admin metrics | Wiring inline de UI consumidora para `adminListRateLimits`, `adminResetRateLimit`, `adminDeleteListItem` | Fase 2 + Fase 3 |
| Map errors invisibles (orphan de #304) | Registrar `map_load_failed` en GA4 backend + categoria System | Fase 4 |
| `} catch { /* ignore */ }` en `FeaturedListsPanel:58-60` | Reemplazar por `logger.warn('FeaturedListsPanel fetchListItems failed', err)` | Fase 3 |

No se agrava deuda existente.

---

## Validacion Tecnica

(Pendiente — invocar a Diego tras revisar este specs.)

**Diego — Cycle 1 (2026-05-02): VALIDADO CON OBSERVACIONES**

Cobertura PRD -> specs: 100%. Las 3 observaciones de Sofia (D1/D4 useAbuseLogsRealtime+enabled, D2 truncado client-side justificado, D4 useConnectivity disponible) tienen resolucion concreta y verificada en codigo. Las decisiones D3-D6 cierran el resto del scope.

Verificaciones de existencia (todas confirmadas en el repo a 2026-05-02):
- Callables backend: `adminListRateLimits`, `adminResetRateLimit` (`functions/src/admin/rateLimits.ts:90-`), `adminDeleteListItem` (`functions/src/admin/listItems.ts:23-`).
- `AdminRateLimitItem` exportado server-side con shape exacto al espejo del specs.
- `fetchUserDisplayNames` en `src/services/users.ts:108`.
- `fetchListItems` en `src/services/sharedLists.ts:130`.
- `useAsyncData` en `src/hooks/useAsyncData.ts:17`.
- `formatRelativeTime` en `src/utils/formatDate.ts:36`.
- `CHIP_SMALL_SX` en `src/theme/cards.ts:62`.
- `useConnectivity` consumido sin guard defensivo en `ModerationActions.tsx:40`, `SpecialsPanel.tsx:31` (admin subtree).
- `MSG_OFFLINE.requiresConnection` en `src/constants/messages/offline.ts`.
- Eventos `admin_list_items_inspected`, `admin_rate_limit_reset`, `admin_list_item_deleted` ya estan en `GA4_EVENT_NAMES` (analyticsReport.ts:147-149) y `ga4FeatureDefinitions.ts:192` admin_metrics — la frase del specs "YA REGISTRADO" es correcta para ese alcance (registro), aunque no haya callsites todavia (este feature wirea las primeras emisiones).
- Test `ga4FeatureDefinitions.test.ts` enforcea unicidad de eventNames y unicidad de feature keys (constraint que el specs respeta agregando `map_errors` en una sola categoria).

### Observaciones (no bloquean)

- **OBS-1 — `addedBy` tipado como `string` requerido.** El tipo `ListItem` en `src/types/lists.ts:20` define `addedBy: string` (no opcional). El specs en handleToggleExpand filtra con `Boolean(uid)` lo cual es defensivo pero no incorrecto. El implementador puede omitir el `Boolean(uid)` si confia en el tipo, o mantenerlo si quiere defensa para docs viejos sin el campo (caso plausible: items creados antes de que `addedBy` fuera obligatorio en rules).

- **OBS-2 — `prevNewCount` ref no se resetea al flip de `enabled` en `AbuseAlerts`.** El ref vive en el orquestador y solo trackea `newCount`. Cuando el subtab vuelve de `'rateLimits'` a `'alerts'`, el hook resuscribe limpio (newCount=0 segun specs D1) y el effect de toast comparara contra `prevNewCount.current` (posiblemente >0 de la sesion previa). El condicional `newCount > 0 && newCount !== prevNewCount.current` filtra el caso `newCount===0`, asi que no hay toast espureo. Consistente.

- **OBS-3 — Distincion Owner vs Editor sin caso "ex-editor".** El specs codifica `item.addedBy === list.ownerId ? '(Owner)' : '(Editor)'` (binario). Si un editor agrego un item y luego fue removido del `editorIds`, el chip seguira diciendo "(Editor)" aunque ya no lo sea. Coincide con el PRD ("chip 'Editor' si addedBy !== list.ownerId") asi que no es contradiccion; es informativo de "quien lo agrego" historicamente. Si en revision producto se quisiera precision actual, requeriria checkear `list.editorIds.includes(item.addedBy)` y un tercer estado "(Ex-editor)" — fuera de scope #327.

### Notas para Pablo (plan reviewer)

- El refactor de `useAbuseLogsRealtime` con `enabled` flag es el unico cambio sobre archivo existente con superficie publica de hook — el plan deberia hacerlo en una fase temprana e independiente para que los tests del hook validen antes de tocar componentes.
- La migracion suave de event-name strings a constantes (D6) explicitamente NO toca callsites de #310. Si el plan agrupa fases por archivo y `analyticsReport.ts` se toca para agregar `map_load_failed` y `admin_rate_limit_viewed`, mantener ambos cambios en la misma fase para evitar dos PRs sobre el mismo archivo.
- El truncado a 50 client-side con descarga full (D2) es un trade-off documentado pero el plan deberia prever un follow-up issue de tech debt ("count via `sharedLists.itemCount` en lugar de descargar todos los items") si la lectura se vuelve frecuente.
- No hay BLOQUEANTES abiertos. Listo para `plan-writer`.

### Listo para pasar a plan?

**Si.** Specs preciso, sin huecos tecnicos, alineado con patrones del proyecto y decisiones cerradas en D1-D6.
