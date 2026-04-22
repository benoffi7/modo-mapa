# Specs: #304 Offline guards for Lists domain + notifications

**Issue:** [#304](https://github.com/benoffi7/modo-mapa/issues/304)
**PRD:** [prd.md](prd.md)
**Fecha:** 2026-04-18

---

## Alcance

Cierre del audit offline del `/health-check` 2026-04-18. Cuatro workstreams:

- **WS1** (High) — Dominio Lists: 6 operaciones (`createList`, `updateList`, `toggleListPublic`, `deleteList`, `addBusinessToList`, `removeBusinessFromList`) pasan a tener soporte offline via `withOfflineSupport`. `deleteList` queda bloqueado offline intencionalmente (cascade delete inseguro).
- **WS2** (High) — Small ops: `markNotificationRead`/`markAllNotificationsRead` guard `isOffline` early-return. `EditDisplayNameDialog` y avatar click en `ProfileScreen` bloquean + toast offline.
- **WS3** (Med) — Fallback UI: `MapErrorBoundary` en `components/search/` con auto-switch a list view si Google Maps falla. Detect empty API key.
- **WS4** (Low) — SharedListsView: chip "Desactualizado" cuando se usa cache de localStorage tras fallo de `fetchFeaturedLists`.

---

## Modelo de datos

No se introducen colecciones nuevas ni se modifican esquemas de Firestore. Todos los campos de `sharedLists` y `listItems` que ya existen quedan identicos.

### Cambios en tipos TypeScript (client-only)

#### `src/types/offline.ts`

Agregar 6 variantes a `OfflineActionType`:

```typescript
export type OfflineActionType =
  | 'rating_upsert' | 'rating_delete'
  | 'comment_create'
  | 'favorite_add' | 'favorite_remove'
  | 'price_level_upsert' | 'price_level_delete'
  | 'tag_add' | 'tag_remove'
  | 'comment_like' | 'comment_unlike'
  | 'checkin_create' | 'checkin_delete'
  | 'follow_add' | 'follow_remove'
  | 'recommendation_create' | 'recommendation_read'
  // Nuevos (#304)
  | 'list_create'
  | 'list_update'
  | 'list_toggle_public'
  | 'list_delete'
  | 'list_item_add'
  | 'list_item_remove';
```

Agregar el campo opcional `listId` a `OfflineAction` (usado por operaciones de listas; las action types de business siguen usando `businessId`):

```typescript
export interface OfflineAction {
  id: string;
  type: OfflineActionType;
  payload: OfflineActionPayload;
  userId: string;
  businessId: string; // sigue siendo required para backward compat; list_* usa listId
  businessName?: string;
  referenceId?: string;
  listId?: string; // NUEVO — usado por list_* action types
  createdAt: number;
  retryCount: number;
  status: OfflineActionStatus;
}
```

**Decision**: `businessId` queda required para no romper todas las action types existentes. Para `list_create` usamos el listId generado client-side como `businessId` (hack transitorio) y ademas el campo `listId`. Para `list_item_add/remove` ambos campos estan presentes.

Alternativa considerada: hacer `businessId` opcional. Descartada porque implica audit de todas las usages (60+ llamadas a `withOfflineSupport`) y el campo `businessName` ya hace doble duty para contexto UI.

#### Payloads nuevos

```typescript
export interface ListCreatePayload {
  name: string;
  description: string;
  icon?: string;
}

export interface ListUpdatePayload {
  name: string;
  description: string;
  color?: string;
  icon?: string;
}

export interface ListTogglePublicPayload {
  isPublic: boolean;
}

export interface ListDeletePayload {
  ownerId: string; // para invalidateQueryCache
}

export interface ListItemAddPayload {
  addedBy?: string; // solo presente si no es owner
}

// ListItemRemovePayload no necesita datos extra (businessId + listId suficiente)
```

Agregar a la union `OfflineActionPayload`.

---

## Firestore Rules

No se requieren cambios en `firestore.rules`. Validado contra `firestore.rules` actual (post #289):

### Rules impact analysis

| Query (service file) | Collection | Auth context | Rule que la permite | Cambio necesario? |
|---------------------|------------|-------------|-------------------|----------------|
| `setDoc(listId)` con auto-gen ID | `sharedLists` | user | `create if request.auth.uid == request.resource.data.ownerId && keys().hasOnly(...) && ...` — ya cubre set con ID arbitrario | No |
| `updateDoc` (name, desc, color, icon) | `sharedLists` | owner | `update if request.auth.uid == resource.data.ownerId && affectedKeys().hasOnly([name, description, color, icon, updatedAt, isPublic, editorIds, itemCount])` | No |
| `setDoc` listItem | `listItems` | owner or editor | `create if ... && listId es owned or editor del list` | No |
| Sin cambios de campos | — | — | — | No |

### Field whitelist check

No se agregan campos a ninguna colección. `sharedLists.create` sigue usando los mismos 8 campos; `listItems.create` sigue usando 4 campos.

| Collection | Campo nuevo/modificado | En create `hasOnly()`? | En update `affectedKeys().hasOnly()`? | Cambio necesario? |
|-----------|----------------------|----------------------|--------------------------------------|-------------------|
| (ninguno) | — | — | — | No |

---

## Cloud Functions

Ningun cambio. Los triggers existentes (`onSharedListCreated` con rate limit de #289, `onListItemCreated/Deleted` con counter sync) se aplican tanto a writes directos como a writes encolados que replayan al reconectar. El flujo es:

1. Cliente encola `list_create` en IndexedDB con listId client-gen.
2. Al reconectar, `syncEngine.executeAction` invoca `createList(userId, name, desc, icon, listId)`.
3. `createList` hace `setDoc(doc(SHARED_LISTS, listId), {...})`.
4. Firestore dispara `onSharedListCreated` trigger que aplica rate limit.
5. Si rate limit excedido, trigger hace `snap.ref.delete()` — el cliente no se entera, el write desaparece. Aceptable porque la UI optimista mostro la lista pero al siguiente refresh de `fetchUserLists` ya no existe.

Mejora opcional (fuera de scope): notificar al cliente que la lista fue rechazada via notification. Fuera de scope porque el rate limit es alto (10/dia) y edge case.

---

## Servicios

### `src/services/sharedLists.ts` — `createList` aceptar listId opcional

**Firma actual:**

```typescript
export async function createList(
  userId: string,
  name: string,
  description: string = '',
  icon?: string,
): Promise<string>
```

**Nueva firma:**

```typescript
export async function createList(
  userId: string,
  name: string,
  description: string = '',
  icon?: string,
  listId?: string, // NUEVO — si se provee, usa setDoc en vez de addDoc
): Promise<string>
```

**Implementacion:**

```typescript
export async function createList(
  userId: string,
  name: string,
  description: string = '',
  icon?: string,
  listId?: string,
): Promise<string> {
  const docData: Record<string, unknown> = {
    ownerId: userId,
    name: name.trim(),
    description: description.trim(),
    isPublic: false,
    itemCount: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  if (icon && getListIconById(icon)) docData.icon = icon;

  let resolvedId: string;
  if (listId) {
    // Client-generated ID (offline-first flow)
    await setDoc(doc(db, COLLECTIONS.SHARED_LISTS, listId), docData);
    resolvedId = listId;
  } else {
    const ref = await addDoc(collection(db, COLLECTIONS.SHARED_LISTS), docData);
    resolvedId = ref.id;
  }

  invalidateQueryCache(COLLECTIONS.SHARED_LISTS, userId);
  trackEvent('list_created', { list_id: resolvedId });
  return resolvedId;
}
```

**Seguridad**: `setDoc` con ID arbitrario pasa por la misma Firestore rule (`create`) que `addDoc`. La rule valida `ownerId == auth.uid` y los campos permitidos; el ID no es validado per se, y no tiene sentido validarlo (Firestore asume que IDs generados por cliente son unicos).

### `src/services/sharedLists.ts` — helper para generar listId

Exportar helper que usa `doc(collection(...))` para generar IDs compatibles con Firestore:

```typescript
import { collection as fbCollection, doc as fbDoc } from 'firebase/firestore';

export function generateListId(): string {
  return fbDoc(fbCollection(db, COLLECTIONS.SHARED_LISTS)).id;
}
```

Esta funcion no hace network calls — solo usa el SDK de Firestore para generar un ID de 20 chars con alta entropia.

### `src/services/syncEngine.ts` — branches nuevos en `executeAction`

Agregar los 6 cases dentro del switch:

```typescript
case 'list_create': {
  const { name, description, icon } = p as ListCreatePayload;
  const { createList } = await import('./sharedLists');
  // Use action.listId (generated client-side at enqueue time) to preserve ID
  await createList(userId, name, description, icon, action.listId);
  break;
}
case 'list_update': {
  const { name, description, color, icon } = p as ListUpdatePayload;
  const { updateList } = await import('./sharedLists');
  if (!action.listId) throw new Error('list_update requires listId');
  await updateList(action.listId, name, description, color, icon);
  break;
}
case 'list_toggle_public': {
  const { isPublic } = p as ListTogglePublicPayload;
  const { toggleListPublic } = await import('./sharedLists');
  if (!action.listId) throw new Error('list_toggle_public requires listId');
  await toggleListPublic(action.listId, isPublic);
  break;
}
case 'list_delete': {
  const { ownerId } = p as ListDeletePayload;
  const { deleteList } = await import('./sharedLists');
  if (!action.listId) throw new Error('list_delete requires listId');
  await deleteList(action.listId, ownerId);
  break;
}
case 'list_item_add': {
  const { addedBy } = p as ListItemAddPayload;
  const { addBusinessToList } = await import('./sharedLists');
  if (!action.listId) throw new Error('list_item_add requires listId');
  await addBusinessToList(action.listId, businessId, addedBy);
  break;
}
case 'list_item_remove': {
  const { removeBusinessFromList } = await import('./sharedLists');
  if (!action.listId) throw new Error('list_item_remove requires listId');
  await removeBusinessFromList(action.listId, businessId);
  break;
}
```

### Servicios `notifications.ts`, `userProfile.ts`

Sin cambios. Las operaciones `markNotificationRead`, `markAllNotificationsRead`, `updateUserDisplayName`, `updateUserAvatar` siguen igual. Los cambios de guard van en el CONTEXT (Notifications) y en los COMPONENTES (EditDisplayNameDialog, ProfileScreen avatar), no en services.

### Duplicated constants

Verificar: `OFFLINE_ENQUEUED_MSG` ya existe en `offlineInterceptor.ts`. Los nuevos labels/iconos para list_* van en `PendingActionsSection.tsx` (lugar canonico de UI de cola).

### Checklist de servicios

- [x] Service layer boundary respetado (solo `sharedLists.ts` y `syncEngine.ts` importan `firebase/firestore`)
- [x] `withConverter<T>()` — `createList` no necesita converter (es write con refs puros)
- [x] `measureAsync` ya esta en reads criticos de `sharedLists.ts`
- [x] No circular deps (syncEngine dynamic imports services)

---

## Context-first data access audit

| Dato que el componente necesita | Ya disponible en Context? | Plan |
|--------------------------------|--------------------------|------|
| `isOffline` | Si (`ConnectivityContext`) | Consumir via `useConnectivity()` |
| `user.uid` | Si (`AuthContext`) | Consumir via `useAuth()` |
| `editorIds` de lista actual | No — prop del ListDetailScreen | Se mantiene como prop |
| `setDisplayName` | Si (`AuthContext`) | Consumir via `useAuth()` |

Verificado: ningun componente nuevo hace `getDoc` de datos que ya viven en un context.

---

## Hooks

No se agregan hooks nuevos. Se modifican:

### `src/context/NotificationsContext.tsx`

Importar `useConnectivity`:

```typescript
import { useConnectivity } from './ConnectivityContext';
```

Dentro del provider, extraer `isOffline` y agregar guard en ambas funciones:

```typescript
const { isOffline } = useConnectivity();

const markRead = useCallback(async (notificationId: string) => {
  if (isOffline) return; // early return, no optimistic, no toast
  // ... resto igual
}, [toast, isOffline]);

const markAllRead = useCallback(async () => {
  if (!uid || isOffline) return;
  // ... resto igual
}, [uid, notifications, unreadCount, toast, isOffline]);
```

### Checklist de hooks

- [x] Dependency arrays correctos (agregar `isOffline` a markRead/markAllRead)
- [x] No side effects en render
- [x] Tests de todos los paths
- [x] `logger.error` fuera de `if (DEV)` — los existentes en markRead/markAllRead ya son `logger.warn` que son silenciados en prod. Cambiar a no-loguear en caso offline (es expected), mantener `logger.warn` en el catch para errores de red reales.

---

## Componentes

### `src/components/lists/CreateListDialog.tsx`

**Problema actual:** `await createList()` offline queda pendiente indefinidamente.

**Cambios:**

```typescript
import { useConnectivity } from '../../context/ConnectivityContext';
import { withOfflineSupport } from '../../services/offlineInterceptor';
import { generateListId } from '../../services/sharedLists';

// dentro del componente:
const { isOffline } = useConnectivity();

const handleCreate = async () => {
  if (!user || !name.trim()) return;
  setIsCreating(true);

  // Pre-generate ID so UI can proceed immediately (offline or online)
  const listId = generateListId();

  try {
    await withOfflineSupport(
      isOffline,
      'list_create',
      { userId: user.uid, businessId: listId }, // businessId hack: use listId as unique ref
      { name, description: desc, ...(selectedIcon ? { icon: selectedIcon } : {}) },
      () => createList(user.uid, name, desc, selectedIcon, listId),
      toast,
    );

    const createdName = name.trim();
    const createdDesc = desc.trim();
    const createdIcon = selectedIcon;
    setName('');
    setDesc('');
    setSelectedIcon(undefined);
    if (!isOffline) toast.success(MSG_LIST.createSuccess);
    // toast.info('Guardado offline...') ya lo dispara withOfflineSupport
    onClose();
    onCreated(listId, createdName, createdDesc, createdIcon);
  } catch (err) {
    toast.error(err instanceof Error ? err.message : MSG_LIST.createError);
  }
  setIsCreating(false);
};
```

**Importante**: el hack de `businessId: listId` en `actionMeta` es transitorio. Con el campo `listId` del OfflineAction necesitamos que `withOfflineSupport` lo propague. Revisar:

**Actualizar `offlineInterceptor.ts`**:

```typescript
export async function withOfflineSupport<T>(
  isOffline: boolean,
  actionType: OfflineActionType,
  actionMeta: {
    userId: string;
    businessId: string;
    businessName?: string | undefined;
    referenceId?: string | undefined;
    listId?: string | undefined; // NUEVO
  },
  payload: OfflineActionPayload,
  onlineAction: () => Promise<T>,
  toast?: { info: (msg: string) => void },
): Promise<T | void> {
  // ... igual, agregar propagacion de listId
  if (actionMeta.listId) {
    actionData.listId = actionMeta.listId;
  }
  // ...
}
```

Y en `offlineQueue.enqueue` el tipo `Omit<OfflineAction, ...>` ya incluye `listId`.

### `src/components/lists/ListDetailScreen.tsx`

**Problema actual:** 4 handlers (color, togglePublic, delete, removeItem) fallan silenciosamente offline.

**Cambios:**

1. Importar `useConnectivity`, `withOfflineSupport`.
2. `handleColorChange` — encolar via `list_update`.
3. `handleTogglePublic` — encolar via `list_toggle_public`. Optimistic ya presente.
4. `handleDelete` — **bloquear** offline: si `isOffline`, mostrar Alert "Requiere conexión" y no disparar (disabled el boton tambien).
5. `handleRemoveItem` — encolar via `list_item_remove`. Optimistic ya presente.
6. `handleIconChange` — encolar via `list_update`.

Ejemplo (`handleColorChange`):

```typescript
const handleColorChange = async (hex: string) => {
  const prev = currentColor;
  setCurrentColor(hex);
  try {
    await withOfflineSupport(
      isOffline,
      'list_update',
      { userId: user!.uid, businessId: list.id, listId: list.id },
      { name: list.name, description: list.description, color: hex, icon: currentIcon },
      () => updateList(list.id, list.name, list.description, hex),
      toast,
    );
  } catch {
    setCurrentColor(prev);
    toast.error(MSG_LIST.colorError);
  }
};
```

`handleDelete` bloqueo:

```typescript
const handleDelete = async () => {
  if (isOffline) {
    toast.warning(MSG_LIST.deleteRequiresConnection);
    setConfirmDeleteOpen(false);
    return;
  }
  try {
    await deleteList(list.id, list.ownerId);
    toast.success(MSG_LIST.deleteSuccess);
    onDeleted();
  } catch {
    toast.error(MSG_LIST.deleteError);
  }
  setConfirmDeleteOpen(false);
};
```

Y en el boton `IconButton DeleteOutline` del Toolbar:

```typescript
<IconButton
  size="small"
  color="error"
  aria-label="Eliminar lista"
  disabled={isOffline}
  onClick={() => setConfirmDeleteOpen(true)}
>
  <DeleteOutlineIcon fontSize="small" />
</IconButton>
```

### `src/components/business/AddToListDialog.tsx`

**Problema actual:** `handleToggle` (add/remove item) y `handleCreate` (create + add) fallan silenciosamente.

**Cambios:**

- `handleToggle` — encolar via `list_item_add` o `list_item_remove`.
- `handleCreate` — pre-generar listId, encolar `list_create` + `list_item_add` en secuencia. **Orden preservado** por FIFO de la queue (creado antes → ejecutado antes).

```typescript
const handleCreate = async () => {
  if (!user || !newName.trim()) return;
  setIsCreating(true);
  const listId = generateListId();
  try {
    await withOfflineSupport(
      isOffline, 'list_create',
      { userId: user.uid, businessId: listId, listId },
      { name: newName, description: '' },
      () => createList(user.uid, newName, '', undefined, listId),
      toast,
    );
    await withOfflineSupport(
      isOffline, 'list_item_add',
      { userId: user.uid, businessId, listId },
      {},
      () => addBusinessToList(listId, businessId),
      toast,
    );
    setNewName('');
    setShowCreate(false);
    if (!isOffline) toast.success(MSG_LIST.createAndAddSuccess);
    // Reload lists (works offline if Firestore persistent cache has data, otherwise optimistic add)
    if (!isOffline) {
      const refreshed = await fetchUserLists(user.uid);
      setLists(refreshed);
    } else {
      // Append optimistically
      setLists((prev) => [
        ...prev,
        { id: listId, ownerId: user.uid, name: newName, description: '', isPublic: false, itemCount: 1, createdAt: new Date(), updatedAt: new Date() } as SharedList,
      ]);
    }
    setCheckedIds((prev) => new Set(prev).add(listId));
  } catch (err) {
    logger.error('[AddToListDialog] create failed:', err);
    toast.error(MSG_LIST.createError);
  }
  setIsCreating(false);
};
```

**Riesgo identificado — FIFO vs parallel**: el `syncEngine.processQueue` usa `for...of` secuencial, no Promise.all. Confirmado en `syncEngine.ts:143`. Por lo tanto la orden de `list_create` → `list_item_add` se preserva.

### `src/components/profile/EditDisplayNameDialog.tsx`

**Cambios:**

```typescript
import { useConnectivity } from '../../context/ConnectivityContext';
import { useToast } from '../../context/ToastContext';
import { MSG_COMMON } from '../../constants/messages';

// dentro:
const { isOffline } = useConnectivity();
const toast = useToast();

const handleSave = async () => {
  const trimmed = nameValue.trim();
  if (!trimmed) return;
  if (isOffline) {
    toast.warning(MSG_COMMON.noConnectionForProfile);
    return;
  }
  setIsSaving(true);
  try {
    await setDisplayName(trimmed);
  } catch (err) {
    toast.error(err instanceof Error ? err.message : MSG_COMMON.settingUpdateError);
  }
  setIsSaving(false);
  onClose();
};

// En el boton Guardar:
<Button onClick={handleSave} variant="contained" disabled={isSaving || !nameValue.trim() || isOffline}>
  Guardar
</Button>
```

### `src/components/profile/ProfileScreen.tsx` — avatar click

El avatar ya abre `AvatarPicker`. El save del avatar pasa por `setAvatarId` (AuthContext). Guard offline en `AvatarPicker.onSelect` (o wrapping del click):

```typescript
onClick={() => {
  if (isOffline) {
    toast.warning(MSG_COMMON.noConnectionForProfile);
    return;
  }
  setAvatarPickerOpen(true);
}}
aria-disabled={isOffline}
```

### `src/components/search/MapErrorBoundary.tsx` (nuevo)

Error Boundary de React clase tradicional:

```typescript
import { Component, type ReactNode } from 'react';
import { Box, Button, Typography, Alert } from '@mui/material';
import { logger } from '../../utils/logger';

interface Props {
  children: ReactNode;
  onFallback?: () => void; // callback cuando hay que caer a list view
}

interface State {
  hasError: boolean;
}

export default class MapErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  override componentDidCatch(error: Error): void {
    logger.error('[MapErrorBoundary] Map failed:', error);
    this.props.onFallback?.();
  }

  override render(): ReactNode {
    if (this.state.hasError) {
      return (
        <Box sx={{ p: 3 }}>
          <Alert severity="warning" sx={{ mb: 2 }}>
            No se pudo cargar el mapa. Mostrando lista.
          </Alert>
          <Button variant="outlined" onClick={() => this.setState({ hasError: false })}>
            Reintentar
          </Button>
        </Box>
      );
    }
    return this.props.children;
  }
}
```

**SearchScreen integration**:

```typescript
const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

// Si no hay API key, forzar list view desde el inicio:
const [viewMode, setViewMode] = useState<SearchViewMode>(
  GOOGLE_MAPS_API_KEY ? 'map' : 'list',
);

// Envolver la parte de mapa en MapErrorBoundary:
{viewMode === 'map' && GOOGLE_MAPS_API_KEY ? (
  <MapErrorBoundary onFallback={() => setViewMode('list')}>
    <APIProvider apiKey={GOOGLE_MAPS_API_KEY} libraries={['places']}>
      <MapView />
      <LocationFAB />
      <OfficeFAB />
      <MapHint />
    </APIProvider>
  </MapErrorBoundary>
) : (
  // list view
)}
```

### `src/components/lists/SharedListsView.tsx` — chip stale

Agregar state `isFeaturedStale`:

```typescript
const [isFeaturedStale, setIsFeaturedStale] = useState(false);

// En el catch de fetchFeaturedLists:
.catch((err) => {
  logger.error('[SharedListsView] fetchFeaturedLists failed:', err);
  if (warmedFromCache) setIsFeaturedStale(true);
});
```

En el render del header de la seccion destacadas:

```typescript
<Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
  <Typography>Listas destacadas</Typography>
  {isFeaturedStale && (
    <Chip
      label="Desactualizado"
      size="small"
      variant="outlined"
      color="warning"
      sx={{ borderRadius: 1 }}
    />
  )}
</Box>
```

### `src/components/profile/PendingActionsSection.tsx` — agregar list_* labels/icons

Agregar al map existente:

```typescript
import FormatListBulletedIcon from '@mui/icons-material/FormatListBulleted';
import BookmarkIcon from '@mui/icons-material/Bookmark';
import BookmarkRemoveIcon from '@mui/icons-material/BookmarkRemove';

const ACTION_LABELS: Record<OfflineActionType, string> = {
  // ... existentes
  list_create: 'Crear lista',
  list_update: 'Editar lista',
  list_toggle_public: 'Cambiar visibilidad',
  list_delete: 'Eliminar lista',
  list_item_add: 'Agregar a lista',
  list_item_remove: 'Quitar de lista',
};

const ACTION_ICONS: Record<OfflineActionType, typeof StarOutlineIcon> = {
  // ... existentes
  list_create: FormatListBulletedIcon,
  list_update: FormatListBulletedIcon,
  list_toggle_public: FormatListBulletedIcon,
  list_delete: DeleteOutlineIcon,
  list_item_add: BookmarkIcon,
  list_item_remove: BookmarkRemoveIcon,
};
```

### Mutable prop audit

| Componente | Prop | Campos editables | Local state necesario? | Parent callback |
|-----------|------|-----------------|----------------------|-----------------|
| ListDetailScreen | `list` | color, isPublic, icon, itemCount | Ya usa useState + callback `onBack(updated)` | `onBack` ya propaga Partial<SharedList> |
| AddToListDialog | — | (no props de datos) | Lists y checkedIds en state local | No aplica |
| SharedListsView | — | featured lists | State local, no prop mutable | No aplica |

---

## Textos de usuario

Agregar a `src/constants/messages/list.ts`:

```typescript
export const MSG_LIST = {
  // ... existentes
  deleteRequiresConnection: 'Eliminar listas requiere conexión',
  featuredStale: 'Listas destacadas desactualizadas',
} as const;
```

Agregar a `src/constants/messages/common.ts`:

```typescript
export const MSG_COMMON = {
  // ... existentes
  noConnectionForProfile: 'No se puede cambiar sin conexión',
} as const;
```

Todos los textos en español argentino:

- "Eliminar listas requiere conexión" (con tilde)
- "Listas destacadas desactualizadas"
- "No se puede cambiar sin conexión"
- "No se pudo cargar el mapa. Mostrando lista."
- "Reintentar"

---

## Integracion

### Orden de implementacion

1. **Types first**: agregar variantes a `OfflineActionType` + payloads + `listId` en `OfflineAction`.
2. **Interceptor**: actualizar `withOfflineSupport` para propagar `listId`.
3. **Services**: `generateListId()` helper + `createList()` con param opcional.
4. **syncEngine**: 6 branches nuevos.
5. **Messages**: agregar constants.
6. **Components**: CreateListDialog, ListDetailScreen, AddToListDialog, EditDisplayNameDialog, ProfileScreen, SharedListsView.
7. **NotificationsContext**: guard isOffline.
8. **PendingActionsSection**: labels e iconos nuevos.
9. **MapErrorBoundary + SearchScreen**.
10. **Tests**.

### Preventive checklist

- [x] **Service layer**: Ningún componente nuevo importa `firebase/firestore` (verificado: todas las ops usan `sharedLists.ts`).
- [x] **Duplicated constants**: `MSG_LIST.deleteRequiresConnection` y `MSG_COMMON.noConnectionForProfile` son nuevas, no duplicadas.
- [x] **Context-first data**: `isOffline` siempre de `useConnectivity`, no de prop drilling.
- [x] **Silent .catch**: todos los catches en los handlers modificados propagan a `toast.error` o son guards intencionales (documented).
- [x] **Stale props**: `ListDetailScreen` usa `list` prop + local state; pattern ya establecido.

---

## Tests

| Archivo test | Que testear | Tipo |
|-------------|-------------|------|
| `src/services/sharedLists.test.ts` (extend) | `createList` con `listId` param: verificar uso de `setDoc` con ref explicita. `generateListId()` devuelve string de 20 chars. | Unitario |
| `src/services/syncEngine.test.ts` (extend) | 6 nuevos cases: `list_create`, `list_update`, `list_toggle_public`, `list_delete`, `list_item_add`, `list_item_remove`. Cada uno verifica que el service correcto se invoca con los args del payload + `action.listId`. | Unitario |
| `src/services/syncEngine.test.ts` — error path | `list_update`/`list_delete`/`list_toggle_public` sin `action.listId` tiran error descriptivo. | Unitario |
| `src/services/offlineInterceptor.test.ts` (extend) | `listId` en `actionMeta` se propaga a la action encolada. | Unitario |
| `src/context/NotificationsContext.test.tsx` (nuevo) | `markRead` offline: no llama a `markNotificationRead`, no hace setState optimista, no dispara toast. `markAllRead` offline: idem. | Integracion |
| `src/components/lists/CreateListDialog.test.tsx` (nuevo) | Offline: `handleCreate` genera listId, encola, llama `onCreated` con el ID, cierra dialog. Online: comportamiento original. | Integracion |
| `src/components/lists/ListDetailScreen.test.tsx` (nuevo o extend) | 4 handlers offline + delete bloqueado. Boton delete disabled cuando `isOffline`. | Integracion |
| `src/components/business/AddToListDialog.test.tsx` (nuevo) | `handleToggle` y `handleCreate` offline. FIFO preservado (create antes que add). | Integracion |
| `src/components/profile/EditDisplayNameDialog.test.tsx` (nuevo o extend) | Boton disabled offline, toast al intentar guardar. | Unitario |
| `src/components/search/MapErrorBoundary.test.tsx` (nuevo) | `getDerivedStateFromError` setea `hasError`. Render con error muestra fallback. `onFallback` se llama en `componentDidCatch`. `setState({ hasError: false })` permite retry. | Unitario |
| `src/components/lists/SharedListsView.test.tsx` (nuevo o extend) | Stale chip aparece cuando `fetchFeaturedLists` falla y hay cache local. | Integracion |

### Mock strategy

- **`useConnectivity`**: `vi.mock('../../context/ConnectivityContext', () => ({ useConnectivity: () => ({ isOffline: true, ... }) }))` con defaults per-test.
- **`withOfflineSupport`**: no mockear; usar la implementacion real con `offlineQueue` mock (`fake-indexeddb` ya en uso).
- **`offlineQueue.enqueue`**: mockear para capturar las acciones encoladas y verificar forma.
- **`syncEngine.executeAction`**: ya mockeable (pattern establecido en `syncEngine.test.ts`).

### Criterio de aceptacion

- Cobertura >= 80% del codigo nuevo (verificado con `npm run test:coverage`).
- Todos los paths condicionales cubiertos: isOffline true/false, createList con/sin listId, markRead online/offline.
- Tests de integracion para flujos offline completos (create → enqueue → reconnect → sync → verify).
- Side effects: `invalidateQueryCache` post-sync, `trackEvent(EVT_OFFLINE_ACTION_QUEUED)` al enqueue.

---

## Analytics

No se agregan eventos nuevos. `EVT_OFFLINE_ACTION_QUEUED` se dispara con los nuevos `action_type` values (list_*). Los eventos agrupados en `constants/analyticsEvents/offline.ts` ya cubren el dominio.

`EVT_LIST_CREATED`, `EVT_LIST_DELETED`, `EVT_LIST_ITEM_ADDED`, `EVT_LIST_ITEM_REMOVED` (en `sharedLists.ts` services) siguen disparandose cuando la accion ejecuta (online o post-sync).

`trackEvent('map_load_failed', { error })` en `MapErrorBoundary.componentDidCatch` — **nuevo evento**. Registrar en `src/constants/analyticsEvents/system.ts` como `EVT_MAP_LOAD_FAILED`.

---

## Offline

### Estrategia explicita

| Operacion | Estrategia offline | Comportamiento UI offline |
|-----------|-------------------|--------------------------|
| createList | Queue + client-gen listId | Dialog se cierra normal, lista aparece en state, toast "Guardado offline" |
| updateList (name/desc/color/icon) | Queue | Optimistic UI, toast offline |
| toggleListPublic | Queue | Optimistic UI, toast offline |
| deleteList | **Bloqueada** | Boton disabled, Alert en dialog, toast informativo |
| addBusinessToList | Queue | Optimistic check, toast offline |
| removeBusinessFromList | Queue | Optimistic removal, toast offline |
| markNotificationRead | **Early return** | No-op silencioso |
| markAllNotificationsRead | **Early return** | No-op silencioso |
| setDisplayName | **Bloqueada** | Boton disabled, toast al intentar |
| setAvatarId | **Bloqueada** | Avatar no abre picker offline, toast |
| Google Maps load | Fallback a list | Auto-switch + toast + boton retry |
| fetchFeaturedLists | Cache local + chip stale | Chip "Desactualizado" |

### Cache strategy

Sin cambios. Firestore persistent cache (prod) ya cubre reads de `sharedLists` y `listItems`. La primera carga offline de una lista nueva (creada offline) tiene los datos en localStorage/state optimista; al sincronizar, el refetch hace merge con Firestore.

### Writes offline

| Operacion | Mecanismo | Conflict resolution |
|-----------|-----------|-------------------|
| list_create | Queue con client-gen ID | last-write-wins (no hay conflicts posibles con ID unico) |
| list_update | Queue | last-write-wins |
| list_toggle_public | Queue | last-write-wins (es un bool toggle) |
| list_delete | Bloqueado offline | N/A |
| list_item_add | Queue con ID compuesto `{listId}__{businessId}` | setDoc idempotente |
| list_item_remove | Queue | Si el item ya no existe al sync, `deleteDoc` es idempotente |

### Fallback UI

- **CreateListDialog**: sin cambios visuales en online; en offline el toast "Guardado offline" sustituye al de success.
- **ListDetailScreen**: boton delete disabled offline con tooltip (MUI Tooltip) "Requiere conexión".
- **MapErrorBoundary**: fallback con Alert + boton "Reintentar".
- **SharedListsView**: chip "Desactualizado" discreto (color warning, outlined).

---

## Accesibilidad y UI mobile

| Componente | Elemento | aria-label | Min touch target | Error state |
|-----------|----------|------------|-----------------|-------------|
| ListDetailScreen (delete btn) | IconButton size="small" | "Eliminar lista" | 40x40px (ok) | disabled cuando offline |
| CreateListDialog (crear btn) | Button | (texto visible) | >40x40 | disabled cuando isCreating |
| EditDisplayNameDialog (save btn) | Button | (texto visible) | >40x40 | disabled cuando offline |
| ProfileScreen (avatar) | Avatar role="button" | "Cambiar avatar" | 64x64px | aria-disabled offline |
| MapErrorBoundary (retry btn) | Button | "Reintentar cargar mapa" | >40x40 | — |
| SharedListsView (chip stale) | Chip | (texto visible) | N/A visual | — |

---

## Decisiones tecnicas

### 1. Client-generated listId vs bloqueo offline

**Decision**: generar ID client-side. Razones:

- Firestore permite IDs arbitrarios; `addDoc` internamente hace lo mismo (genera ID + setDoc).
- Evita UX hostil de bloquear creacion offline.
- Pattern ya usado en `addBusinessToList` (ID compuesto `{listId}__{businessId}`).
- Entropia de 120 bits suficiente para evitar collisions.

**Trade-off**: si el usuario crea offline y antes de sync agrega items, los items apuntan a un `listId` que aun no existe en Firestore. Aceptable porque FIFO preserva orden de ejecucion.

### 2. markRead offline: early return vs encolar

**Decision**: early return. Razones:

- mark-as-read es cosmetico (decrementa badge, no altera datos criticos).
- Polling cada 5min ya refresca el count al reconectar.
- Encolar agregaria complejidad sin beneficio real.
- El bug actual (toast ruidoso) se elimina sin UX trade-off.

**Alternativa**: agregar `notification_read` al queue (como `recommendation_read`). Descartada porque mark-as-read no tiene el mismo valor de "el usuario quiere confirmar lectura" (recommendations si, porque hay feedback visual al remitente indirectamente).

### 3. Bloqueo de setDisplayName/setAvatarId offline

**Decision**: bloquear. Razones:

- Cambios cosmeticos de perfil. No urgente.
- Encolar agregaria complejidad al registry USER_OWNED_COLLECTIONS (sincronizacion con #192).
- Si se permite offline, hay risk de UID mismatch con lookup de followers que leen `displayNameLower`.
- Evita inconsistencia temporal en displayNameLower (usado en busqueda, si se encola puede haber mismatch hasta sync).

### 4. MapErrorBoundary vs gracefully handling en APIProvider

**Decision**: Error Boundary separado. Razones:

- `APIProvider` de `@vis.gl/react-google-maps` no tiene un hook oficial para handling de errores.
- Error Boundary captura cualquier throw en el subtree (incluye child components del mapa).
- Pattern reutilizable para otros componentes con carga external.

### 5. Field `listId` en `OfflineAction` vs reuse `businessId`

**Decision**: agregar campo `listId` separado. Razones:

- Claridad de intent al debugging.
- `list_item_add` necesita ambos (listId + businessId).
- Action types futuros pueden necesitar referencias a otros recursos (collections, users) — el patron de "businessId como default" se vuelve confuso.

**Trade-off**: la action `list_create` tiene `businessId = listId` (duplicado). Aceptable — solo un campo extra, no rompe backward compat.

---

## Riesgos y mitigaciones

| Riesgo | Impacto | Mitigacion |
|--------|---------|-----------|
| `list_create` encolado + `list_item_add` encolado + user crea otro `list_item_add` para la misma lista antes de sync | Duplicate items | Idempotencia del setDoc con ID compuesto (no duplica) |
| Usuario crea lista offline, cierra app, elimina IndexedDB storage | Lista perdida | Aceptable — documentado en PrivacyPolicy como behaviour esperado |
| Rate limit server-side (10 lists/dia) rechaza creates encolados | Lista desaparece post-sync | Documentado; el cliente aun muestra "Guardado offline" como feedback. Refresh de `fetchUserLists` al reconectar quita las rechazadas. Acceptable edge case con rate limit tan alto |
| Cambio de `ownerId` entre enqueue y sync (signOut/signIn) | listItems huerfanos | `withOfflineSupport` captura `userId` actual; si cambia, fallara rules check y se reintentara hasta maxRetries (3) y luego `failed` |
| `MapErrorBoundary` catch loops | Infinite re-render | `componentDidCatch` solo loguea + llama `onFallback` una vez; `setState` solo en boton retry |
