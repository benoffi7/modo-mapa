# Specs: Tech debt — security + architecture findings v2.31.0

**PRD:** [prd.md](prd.md)
**Fecha:** 2026-03-29

---

## Modelo de datos

No se crean colecciones nuevas. Se usa la coleccion existente `_rateLimits` para rate limiting de callables.

### Documento de rate limit para callables de editores

```typescript
// _rateLimits/editors_invite_{userId} y _rateLimits/editors_remove_{userId}
interface CallableRateLimit {
  count: number;
  resetAt: number; // epoch ms, inicio del dia siguiente
}
```

Sigue el patron existente de `_rateLimits` usado en `backups.ts` (transaccion atomica con ventana de tiempo).

### Cambio en respuesta de inviteListEditor

```typescript
// ANTES
return { success: true, targetUid };

// DESPUES
return { success: true };
```

### Cambio en useCheckIn return type

```typescript
// ANTES
performCheckIn: () => Promise<void>;
undoCheckIn: () => Promise<void>;

// DESPUES
type CheckInBlockReason = 'auth' | 'cooldown' | 'none';
performCheckIn: () => Promise<'success' | 'error'>;
undoCheckIn: () => Promise<'success' | 'error'>;
```

---

## Firestore Rules

No se requieren cambios en `firestore.rules`. Las escrituras a `_rateLimits` se hacen via Admin SDK desde Cloud Functions, y la coleccion ya no tiene reglas client-side (solo Functions write).

Los campos `editorIds` y `featured` en `sharedLists` ya estan marcados como "ONLY writable via admin SDK" en las rules (linea 358), lo cual es correcto para los callables.

### Rules impact analysis

| Query (service file) | Coleccion | Auth context | Rule que lo permite | Cambio necesario? |
|---|---|---|---|---|
| `inviteListEditor` (callable) | `sharedLists` | Admin SDK | N/A (Admin SDK bypasses rules) | No |
| `removeListEditor` (callable) | `sharedLists` | Admin SDK | N/A (Admin SDK bypasses rules) | No |
| Rate limit writes (callable) | `_rateLimits` | Admin SDK | N/A (Admin SDK bypasses rules) | No |

### Field whitelist check

| Coleccion | Campo nuevo/modificado | En create `hasOnly()`? | En update `affectedKeys().hasOnly()`? | Cambio necesario? |
|---|---|---|---|---|
| `_rateLimits` | `count`, `resetAt` | N/A (Admin SDK) | N/A (Admin SDK) | No |

No se agregan campos nuevos a colecciones con reglas client-side.

---

## Cloud Functions

### Modificacion: `inviteListEditor` callable

**Archivo:** `functions/src/callable/inviteListEditor.ts`

Cambios:

1. Agregar rate limit transaccional (10 invocaciones/dia por usuario) usando `_rateLimits` con clave `editors_invite_{userId}`.
2. Eliminar `targetUid` de la respuesta. Retornar solo `{ success: true }`.

Patron de rate limit (extraido de `backups.ts`):

```typescript
const DAILY_LIMIT = 10;

async function checkCallableRateLimit(db: Firestore, key: string, limit: number): Promise<void> {
  const docRef = db.collection('_rateLimits').doc(key);
  const now = Date.now();
  const startOfTomorrow = new Date();
  startOfTomorrow.setHours(24, 0, 0, 0);

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(docRef);
    const data = snap.data() as { count: number; resetAt: number } | undefined;

    if (!data || now >= data.resetAt) {
      tx.set(docRef, { count: 1, resetAt: startOfTomorrow.getTime() });
      return;
    }

    if (data.count >= limit) {
      throw new HttpsError('resource-exhausted', 'Limite diario alcanzado. Intenta manana.');
    }

    tx.update(docRef, { count: data.count + 1 });
  });
}
```

### Modificacion: `removeListEditor` callable

**Archivo:** `functions/src/callable/removeListEditor.ts`

Cambio: agregar el mismo rate limit transaccional (10/dia) con clave `editors_remove_{userId}`.

### Utilidad compartida: `checkCallableRateLimit`

**Archivo nuevo:** `functions/src/utils/callableRateLimit.ts`

Para evitar duplicar la logica en ambos callables, extraer la funcion a un util compartido. Esto tambien beneficia a futuros callables que necesiten rate limiting diario.

```typescript
export async function checkCallableRateLimit(
  db: Firestore,
  key: string,
  limit: number,
): Promise<void>;
```

---

## Componentes

### Modificacion: `EditorsDialog`

**Archivo:** `src/components/lists/EditorsDialog.tsx`

- Eliminar `secondary={editor.uid.slice(0, 8) + '...'}` del `ListItemText` (linea 106).
- Reemplazar con `secondary="Editor"` como indicador neutral de rol.

### Modificacion: `CheckInButton`

**Archivo:** `src/components/business/CheckInButton.tsx`

- Eliminar la guarda `if (!user || user.isAnonymous)` (linea 29-32). La auth guard se mueve al hook.
- Eliminar la referencia a `status` post-performCheckIn (stale closure, linea 46). Usar el resultado retornado por `performCheckIn`.
- Simplificar `handleClick` para consumir resultados tipados del hook.

```typescript
const handleClick = useCallback(async () => {
  if (isSuccess && recentCheckInId) {
    const result = await undoCheckIn();
    if (result === 'success') toast.info(MSG_CHECKIN.removed);
    return;
  }

  if (!isNearby) toast.info(MSG_CHECKIN.tooFar);

  const result = await performCheckIn();
  if (result === 'success') toast.success(MSG_CHECKIN.success);
}, [isNearby, isSuccess, recentCheckInId, performCheckIn, undoCheckIn, toast]);
```

### Modificacion: `DirectionsButton`

**Archivo:** `src/components/business/DirectionsButton.tsx`

- Wrappear con `memo`.
- Reemplazar `useFilters()` por prop `userLocation`.
- Nueva interface:

```typescript
interface Props {
  business: Business;
  userLocation?: { lat: number; lng: number } | null;
}
```

### Modificacion: `BusinessSheetHeader`

**Archivo:** `src/components/business/BusinessSheetHeader.tsx`

- Pasar `userLocation` como prop a `DirectionsButton`. Obtenerlo de `useFilters()` en este componente (que ya subscribes a filtros por otros motivos).

### Modificacion: `ListDetailScreen`

**Archivo:** `src/components/lists/ListDetailScreen.tsx`

- Convertir imports de `IconPicker`, `EditorsDialog` e `InviteEditorDialog` a `React.lazy()`.
- Wrappear los 3 componentes lazy en `Suspense` con fallback `null` (los dialogs no necesitan skeleton).
- Wrappear `handleEditorsChanged` en `useCallback` con dependencia `[list.id]`.

```typescript
const IconPicker = lazy(() => import('./IconPicker'));
const EditorsDialog = lazy(() => import('./EditorsDialog'));
const InviteEditorDialog = lazy(() => import('./InviteEditorDialog'));
```

### Mutable prop audit

| Componente | Prop | Campos editables | State local necesario? | Parent callback |
|---|---|---|---|---|
| `ListDetailScreen` | `list: SharedList` | `color, isPublic, itemCount, editorIds, icon` | SI (ya implementado) | `onBack(updated)` |
| `CheckInButton` | N/A | N/A | No (estado en hook) | N/A |

---

## Textos de usuario

| Texto | Donde se usa | Notas |
|---|---|---|
| "No se pudo eliminar la lista" | `MSG_LIST.deleteError` | Reemplaza "Error al eliminar lista" |
| "No se pudo cambiar el color" | `MSG_LIST.colorError` | Reemplaza "Error al cambiar color" |
| "No se pudo cambiar la visibilidad" | `MSG_LIST.visibilityError` | Reemplaza "Error al cambiar visibilidad" |
| "No se pudo cambiar el icono" | `MSG_LIST.iconError` | Reemplaza "Error al cambiar icono" |
| "No se pudo agregar favoritos" | `MSG_LIST.addFavoritesError` | Reemplaza "Error al agregar favoritos" |
| "No se pudo actualizar el favorito" | `MSG_LIST.favoriteUpdateError` | Reemplaza "Error al actualizar favorito" |
| "Editor" | `EditorsDialog` secondary text | Reemplaza UID parcial |
| "Limite diario alcanzado. Intenta manana." | `checkCallableRateLimit` | Nuevo error de rate limit |

---

## Hooks

### Modificacion: `useCheckIn`

**Archivo:** `src/hooks/useCheckIn.ts`

Cambios:

1. Mover auth guard a `performCheckIn` y `undoCheckIn`. Si `!user || user.isAnonymous`, retornar `'auth'` como blocked reason.
2. Cambiar return type de `performCheckIn` y `undoCheckIn` a `Promise<'success' | 'error' | 'blocked'>`.
3. El componente `CheckInButton` usara el resultado para decidir que toast mostrar.

```typescript
export type CheckInResult = 'success' | 'error' | 'blocked';

// En performCheckIn:
if (!user || user.isAnonymous) return 'blocked';
// ...
try { ... return 'success'; }
catch { ... return 'error'; }

// En undoCheckIn:
if (!user || user.isAnonymous) return 'blocked';
// ...
try { ... return 'success'; }
catch { ... return 'error'; }
```

4. Eliminar `useToast` del hook (no es responsabilidad del hook mostrar toasts, excepto para `withOfflineSupport` que requiere el toast como parametro; se puede pasar como argumento o mantener solo para offline).

**Nota:** `withOfflineSupport` recibe `toast` como parametro para mostrar el toast de "accion encolada". Se mantiene `useToast()` en el hook unicamente para ese uso, pero los toasts de resultado (exito/error) se manejan en el componente.

### Eliminacion: `useConnectivity` wrapper

**Archivo a eliminar:** `src/hooks/useConnectivity.ts`

Es un re-export de una linea. Los 11 archivos que lo importan se actualizaran para importar directamente de `context/ConnectivityContext`.

---

## Servicios

No se modifican servicios del frontend. Los cambios son en Cloud Functions (callables) y hooks.

---

## Integracion

### Archivos que necesitan modificacion de imports

**CATEGORY_LABELS (6 archivos a actualizar):**

| Archivo | Import actual | Import nuevo |
|---|---|---|
| `src/components/business/BusinessHeader.tsx` | `from '../../types'` | `from '../../constants/business'` |
| `src/components/home/TrendingBusinessCard.tsx` | `from '../../types'` | `from '../../constants/business'` |
| `src/components/common/ListFilters.tsx` | `from '../../types'` | `from '../../constants/business'` |
| `src/components/lists/FavoritesList.tsx` | `from '../../types'` | `from '../../constants/business'` |
| `src/components/lists/RecentsUnifiedTab.tsx` | `from '../../types'` | `from '../../constants/business'` |
| `src/components/admin/FeaturedListsPanel.tsx` | `from '../../types'` | `from '../../constants/business'` |

Luego eliminar re-export de `CATEGORY_LABELS` en `src/types/index.ts` (linea 137). Mantener `PREDEFINED_TAGS` y `PRICE_LEVEL_LABELS` por ahora.

**useConnectivity (11 archivos + 1 test a actualizar):**

| Archivo | Import actual | Import nuevo |
|---|---|---|
| `src/components/business/BusinessPriceLevel.tsx` | `from '../../hooks/useConnectivity'` | `from '../../context/ConnectivityContext'` |
| `src/components/business/RecommendDialog.tsx` | `from '../../hooks/useConnectivity'` | `from '../../context/ConnectivityContext'` |
| `src/components/business/FavoriteButton.tsx` | `from '../../hooks/useConnectivity'` | `from '../../context/ConnectivityContext'` |
| `src/components/business/BusinessTags.tsx` | `from '../../hooks/useConnectivity'` | `from '../../context/ConnectivityContext'` |
| `src/components/business/MenuPhotoViewer.tsx` | `from '../../hooks/useConnectivity'` | `from '../../context/ConnectivityContext'` |
| `src/components/ui/OfflineIndicator.tsx` | `from '../../hooks/useConnectivity'` | `from '../../context/ConnectivityContext'` |
| `src/components/ui/OfflineIndicator.test.tsx` | `from '../../hooks/useConnectivity'` | `from '../../context/ConnectivityContext'` |
| `src/components/profile/FeedbackForm.tsx` | `from '../../hooks/useConnectivity'` | `from '../../context/ConnectivityContext'` |
| `src/components/profile/PendingActionsSection.tsx` | `from '../../hooks/useConnectivity'` | `from '../../context/ConnectivityContext'` |
| `src/components/social/ReceivedRecommendations.tsx` | `from '../../hooks/useConnectivity'` | `from '../../context/ConnectivityContext'` |
| `src/components/lists/InviteEditorDialog.tsx` | `from '../../hooks/useConnectivity'` | `from '../../context/ConnectivityContext'` |

Luego eliminar `src/hooks/useConnectivity.ts`.

### Preventive checklist

- [x] **Service layer**: Ningun componente importa `firebase/firestore` para writes. Rate limit se agrega en Cloud Functions (Admin SDK).
- [x] **Duplicated constants**: No se duplican constantes. Se unifica `CATEGORY_LABELS` a una sola fuente.
- [x] **Context-first data**: `DirectionsButton` deja de subscribirse a `useFilters` context; recibe `userLocation` como prop desde parent que ya lo tiene.
- [x] **Silent .catch**: No se agregan `.catch(() => {})`. Los errores se loguean con `logger.warn`.
- [x] **Stale props**: `CheckInButton` no tiene mutable props; el stale-closure de `status` se corrige usando el resultado de `performCheckIn`.

---

## Tests

| Archivo test | Que testear | Tipo |
|---|---|---|
| `functions/src/__tests__/callable/inviteListEditor.test.ts` | Respuesta NO incluye `targetUid`. Rate limit rechaza >10/dia con `resource-exhausted`. | Callable (modificar existente) |
| `functions/src/__tests__/callable/removeListEditor.test.ts` | Rate limit rechaza >10/dia con `resource-exhausted`. | Callable (modificar existente) |
| `functions/src/__tests__/utils/callableRateLimit.test.ts` | Ventana diaria, incremento, reset, rechazo al exceder limite. | Util (nuevo) |
| `src/components/lists/__tests__/EditorsDialog.test.tsx` | No renderiza ningun UID en el DOM. Secondary text es "Editor". | Componente (nuevo) |
| `src/hooks/__tests__/useCheckIn.test.ts` | Auth guard retorna `'blocked'` para anonimos. `performCheckIn` retorna `'success'`/`'error'` correctamente. | Hook (nuevo) |

### Casos a cubrir

- `checkCallableRateLimit`: primera llamada OK, llamadas dentro de ventana incrementan, llamada N+1 lanza `resource-exhausted`, reset al dia siguiente.
- `inviteListEditor`: resultado es `{ success: true }` sin `targetUid`.
- `EditorsDialog`: snapshot del DOM no contiene substring de UID.
- `useCheckIn.performCheckIn`: retorna `'blocked'` si user es anonimo, `'success'` si OK, `'error'` si falla.

### Mock strategy

- Cloud Functions: mock `getDb()`, `getAuth()`, `FieldValue`, `HttpsError` (patron existente en tests).
- `callableRateLimit`: mock Firestore transaction con `runTransaction`.
- `EditorsDialog`: mock `fetchEditorName`, `removeEditor` services.
- `useCheckIn`: mock `createCheckIn`, `deleteCheckIn`, `fetchCheckInsForBusiness`, `useAuth`, `useFilters`, `useConnectivity`.

---

## Analytics

No se agregan eventos de analytics nuevos. Los eventos existentes (`checkin_cooldown_blocked`, `checkin_proximity_warning`, `EVT_LIST_ICON_CHANGED`) no se modifican.

---

## Offline

### Cache strategy

| Dato | Estrategia | TTL | Storage |
|---|---|---|---|
| `sharedLists` (editorIds refetch) | Firestore persistent cache | Persistente | IndexedDB (Firestore SDK) |
| Check-ins | Offline queue via `withOfflineSupport` | N/A | IndexedDB (offlineQueue) |

### Writes offline

| Operacion | Mecanismo | Conflict resolution |
|---|---|---|
| `inviteListEditor` callable | No soporta offline (requiere conexion) | Error toast |
| `removeListEditor` callable | No soporta offline (requiere conexion) | Error toast |
| `performCheckIn` | `withOfflineSupport` encola en IndexedDB | Last-write-wins al sync |
| `undoCheckIn` | `withOfflineSupport` encola en IndexedDB | Last-write-wins al sync |

### Fallback UI

Sin cambios. `InviteEditorDialog` ya usa `useConnectivity` para detectar offline.

---

## Decisiones tecnicas

1. **Rate limit en `_rateLimits` vs. triggers**: Los triggers usan `checkRateLimit` de `utils/rateLimiter.ts` que cuenta documentos en la coleccion del dominio (ej: `favorites`). Para callables, no hay un documento que contar post-creacion (el callable hace `arrayUnion`, no crea docs). Se usa el patron de `_rateLimits` con contador atomico en transaccion, igual que `backups.ts` y `deleteUserAccount.ts`.

2. **Funcion compartida `checkCallableRateLimit`**: Se extrae a un util en vez de inlinear en cada callable, porque el patron de rate limit transaccional con ventana diaria se repite y probablemente se use en futuros callables.

3. **`performCheckIn` retorna resultado vs. lanzar error**: Retornar `'success' | 'error' | 'blocked'` es mas limpio que try/catch en el componente, y elimina el stale-closure bug porque el resultado es sincrono en el flujo del `handleClick`.

4. **`DirectionsButton` prop vs. context**: Pasar `userLocation` como prop reduce acoplamiento y evita re-renders innecesarios cuando cambian otros filtros. `BusinessSheetHeader` ya tiene acceso a todo el contexto.

5. **Lazy dialogs con fallback `null`**: Los dialogs son modales que se abren por interaccion del usuario. No necesitan skeleton loader; `null` como fallback es imperceptible porque el dialog aparece tras el chunk load (~<100ms).

---

## Hardening de seguridad

### Firestore rules requeridas

No se modifican reglas client-side. Las escrituras a `_rateLimits` y `sharedLists.editorIds` se hacen via Admin SDK.

### Rate limiting

| Coleccion | Limite | Implementacion |
|---|---|---|
| `_rateLimits` (editors_invite) | 10/dia | `checkCallableRateLimit` en `inviteListEditor` |
| `_rateLimits` (editors_remove) | 10/dia | `checkCallableRateLimit` en `removeListEditor` |

### Vectores de ataque mitigados

| Ataque | Mitigacion | Archivo |
|---|---|---|
| Email enumeration via `inviteListEditor` | Error generico ya implementado + rate limit 10/dia + App Check | `functions/src/callable/inviteListEditor.ts` |
| UID harvesting via response | Eliminar `targetUid` de respuesta | `functions/src/callable/inviteListEditor.ts` |
| UID scraping via DOM | Eliminar UID parcial del `ListItemText` secondary | `src/components/lists/EditorsDialog.tsx` |
| Spam de invites/removes | Rate limit 10/dia por callable | `functions/src/utils/callableRateLimit.ts` |

---

## Deuda tecnica: mitigacion incorporada

No hay issues abiertos con label `security` o `tech debt` en el repositorio.

| Issue/Finding | Que se resuelve | Donde |
|---|---|---|
| H-1 (merge audit) | UID leak en respuesta callable | `inviteListEditor.ts` |
| M-1 (merge audit) | Rate limit faltante en callables | `inviteListEditor.ts`, `removeListEditor.ts` |
| M-3 (merge audit) | UID en UI | `EditorsDialog.tsx` |
| Stale closure en CheckInButton | Toast de exito siempre se mostraba | `CheckInButton.tsx`, `useCheckIn.ts` |
| Dual import CATEGORY_LABELS | 6 archivos importaban desde path incorrecto | `types/index.ts`, 6 consumidores |
| Re-export innecesario useConnectivity | 11 archivos usaban wrapper de 1 linea | `hooks/useConnectivity.ts` eliminado |
| Copy inconsistente | 6 mensajes "Error al..." corregidos a "No se pudo..." | `constants/messages/list.ts` |
