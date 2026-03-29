# Specs: Conectar listas colaborativas a la UI

**PRD:** [prd.md](prd.md)
**Fecha:** 2026-03-29

---

## Modelo de datos

No se crean colecciones ni campos nuevos. Todos los datos ya existen:

```typescript
// Existente en src/types/index.ts
export interface SharedList {
  id: string;
  ownerId: string;
  name: string;
  description: string;
  isPublic: boolean;
  featured: boolean;
  editorIds: string[];    // <- campo clave para esta feature
  itemCount: number;
  icon?: string | undefined;
  color?: string | undefined;
  createdAt: Date;
  updatedAt: Date;
}
```

No se agregan campos nuevos a ninguna coleccion.

## Firestore Rules

No se modifican. Las rules existentes ya soportan todo el flujo:

- `isListEditor()` permite read a editores
- Editor update limitado a `['itemCount', 'updatedAt']`
- `editorIds` solo escribible via admin SDK (Cloud Functions)
- `listItems` validados contra `isItemListOwnerOrEditor()` / `isItemDeleteListOwnerOrEditor()`

### Rules impact analysis

| Query (service file) | Collection | Auth context | Rule que lo permite | Cambio necesario? |
|----------------------|------------|-------------|---------------------|-------------------|
| `fetchSharedList(listId)` en `sharedLists.ts` | sharedLists | Owner o editor autenticado | `allow read: if ... isListOwner() \|\| isListEditor() ...` | No |
| `fetchListItems(listId)` en `sharedLists.ts` | listItems | Owner o editor autenticado | `canReadListItem()` valida owner/editor/isPublic | No |
| `removeBusinessFromList(listId, bizId)` en `sharedLists.ts` | listItems + sharedLists | Editor autenticado | `isItemDeleteListOwnerOrEditor()` + editor update `['itemCount', 'updatedAt']` | No |
| `inviteEditor(listId, email)` en `sharedLists.ts` | N/A (callable) | Owner autenticado | CF valida `ownerId === request.auth.uid` | No |
| `removeEditor(listId, targetUid)` en `sharedLists.ts` | N/A (callable) | Owner autenticado | CF valida `ownerId === request.auth.uid` | No |
| `fetchEditorName(uid)` en `sharedLists.ts` | users | Any autenticado | `allow read: if request.auth != null` (users tiene read publico para auth) | No |

### Field whitelist check

No se agregan campos nuevos a ninguna coleccion. No hay cambios necesarios en `hasOnly()`.

| Collection | Campo nuevo/modificado | En create `hasOnly()`? | En update `affectedKeys().hasOnly()`? | Cambio necesario? |
|-----------|----------------------|----------------------|--------------------------------------|-------------------|
| N/A | N/A | N/A | N/A | No |

## Cloud Functions

No se crean ni modifican Cloud Functions. Las existentes ya estan deployadas y testeadas:

- `inviteListEditor` -- callable, verifica ownership, agrega uid a `editorIds`
- `removeListEditor` -- callable, verifica ownership, remueve uid de `editorIds`

## Componentes

### Modificado: `ListDetailScreen` (`src/components/lists/ListDetailScreen.tsx`)

**Cambios:**

1. **Nueva variable `isEditor`**: `user?.uid` esta en `list.editorIds`
2. **Refactorizar `canEdit`**: distinguir permisos owner vs editor
   - `canEditConfig = isOwner && !readOnly` (color, visibilidad, share, delete, gestionar editores)
   - `canEditItems = (isOwner || isEditor) && !readOnly` (agregar/quitar items)
3. **Nuevos estados**: `editorsOpen`, `inviteOpen`, `editorIds` (local)
4. **Toolbar condicional**:
   - Owner: palette + visibilidad + share + editores + invitar + delete (existentes + 2 nuevos)
   - Editor: solo ve el titulo y back
   - readOnly: solo ve el titulo y back
5. **Items**: el boton de remover item usa `canEditItems` en vez de `canEdit`
6. **Montar `EditorsDialog`**: abierto via `editorsOpen`, pasa `editorIds` local y `list.id`
7. **Montar `InviteEditorDialog`**: abierto via `inviteOpen` (pasa `list.id` cuando open, `null` cuando cerrado)
8. **Badge en boton editores**: muestra count si `editorIds.length > 0`
9. **Refrescar editorIds**: `handleEditorsChanged` llama `fetchSharedList(list.id)` y actualiza `editorIds` local

**Props interface** -- sin cambios:

```typescript
interface Props {
  list: SharedList;
  onBack: (updated?: Partial<SharedList>) => void;
  onDeleted: () => void;
  readOnly?: boolean;
}
```

**Estimacion de lineas resultante**: ~250 lineas (actual ~200 + ~50 nuevas). Dentro del limite de 400.

### Modificado: `CollaborativeTab` (`src/components/lists/CollaborativeTab.tsx`)

**Cambio**: Remover `readOnly` del `<ListDetailScreen>`. Los editores necesitan ver el boton de quitar items dentro de `ListDetailScreen`. La logica de permisos ahora vive en `ListDetailScreen` via `isEditor`.

Actualmente:
```tsx
<ListDetailScreen list={selectedList} onBack={...} onDeleted={...} readOnly />
```

Despues:
```tsx
<ListDetailScreen list={selectedList} onBack={...} onDeleted={...} />
```

### Mutable prop audit

| Component | Prop | Editable fields | Local state needed? | Parent callback |
|-----------|------|----------------|-------------------|-----------------|
| ListDetailScreen | list: SharedList | color, isPublic, itemCount, editorIds | SI -- `currentColor`, `isPublic`, `items`, `editorIds` (nuevo) | `onBack(updated)` ya incluye id, color, itemCount, isPublic. Agregar editorIds al updated. |

## Textos de usuario

No se agregan textos nuevos. Todos los textos ya existen en `src/constants/messages/list.ts`:

| Texto | Donde se usa | Notas |
|-------|-------------|-------|
| `editorInvited(email)` | toast en InviteEditorDialog | Ya existente |
| `editorRemoved` | toast en EditorsDialog | Ya existente |
| `editorInviteError` | toast en InviteEditorDialog | Ya existente |
| `editorRemoveError` | toast en EditorsDialog | Ya existente |

Los dialogs `EditorsDialog` e `InviteEditorDialog` ya usan estos textos.

## Hooks

No se crean hooks nuevos. La logica es suficientemente simple para vivir en el componente (3 estados booleanos + 1 array + 1 callback de refetch).

## Servicios

No se crean ni modifican servicios. Funciones existentes usadas:

| Funcion | Archivo | Uso en este feature |
|---------|---------|-------------------|
| `fetchSharedList(listId)` | `services/sharedLists.ts` | Refrescar `editorIds` despues de invite/remove |
| `inviteEditor(listId, email)` | `services/sharedLists.ts` | Usado por `InviteEditorDialog` (ya existente) |
| `removeEditor(listId, targetUid)` | `services/sharedLists.ts` | Usado por `EditorsDialog` (ya existente) |
| `fetchEditorName(uid)` | `services/sharedLists.ts` | Usado por `EditorsDialog` (ya existente) |
| `removeBusinessFromList(listId, bizId)` | `services/sharedLists.ts` | Usado por ListDetailScreen (ya existente) |

## Integracion

### `ListDetailScreen` <- `EditorsDialog` + `InviteEditorDialog`

- `EditorsDialog` recibe `open`, `onClose`, `listId`, `editorIds`, `onEditorRemoved`
- `InviteEditorDialog` recibe `listId` (null cuando cerrado), `onClose`, `onInvited`
- Ambos callbacks (`onEditorRemoved`, `onInvited`) disparan `handleEditorsChanged` que refetcha la lista

### `CollaborativeTab` -> `ListDetailScreen`

- Remover `readOnly` prop para que `isEditor` funcione correctamente dentro de `ListDetailScreen`

### `SharedListsView` -> `ListDetailScreen`

- Sin cambios. El owner ya ve todo. El `onBack` ya recibe `Partial<SharedList>` con `editorIds` incluido en el updated.

### Preventive checklist

- [x] **Service layer**: Ningun componente importa `firebase/firestore` para writes. Todos los writes van via `services/sharedLists.ts` (ya existente)
- [x] **Duplicated constants**: No se definen constantes nuevas
- [x] **Context-first data**: `editorIds` viene del prop `list` que ya esta en el state del parent. El refetch es necesario porque el dato cambia server-side via Cloud Functions
- [x] **Silent .catch**: El `fetchSharedList` en `handleEditorsChanged` debe usar `.catch((e) => logger.warn(...))` como minimo
- [x] **Stale props**: `editorIds` se copia a state local (`useState(list.editorIds)`) y se actualiza via refetch. El `onBack` propaga los cambios al parent

## Tests

| Archivo test | Que testear | Tipo |
|-------------|-------------|------|
| `src/components/lists/__tests__/ListDetailScreen.test.tsx` | Permisos owner vs editor vs readOnly. Rendering de botones de toolbar. Apertura de dialogs. Refetch de editorIds. Badge de editores. Items removibles por editor. | Componente |

### Casos a cubrir

1. **Owner ve todos los botones de toolbar**: palette, visibilidad, share (si publica), editores, invitar, delete
2. **Owner ve botones de editores con badge**: si `editorIds.length > 0`, badge con count visible
3. **Editor ve boton de quitar items**: pero NO ve palette, visibilidad, share, delete, editores, invitar
4. **readOnly no ve ninguna accion**: ni toolbar actions ni remove item
5. **Click en boton editores abre `EditorsDialog`**
6. **Click en boton invitar abre `InviteEditorDialog`**
7. **Despues de `onEditorRemoved`, `editorIds` se actualiza** (mock `fetchSharedList`)
8. **Despues de `onInvited`, `editorIds` se actualiza** (mock `fetchSharedList`)
9. **`onBack` incluye `editorIds` actualizado**

### Mock strategy

```typescript
vi.mock('../../services/sharedLists', () => ({
  fetchListItems: vi.fn().mockResolvedValue([]),
  removeBusinessFromList: vi.fn(),
  toggleListPublic: vi.fn(),
  deleteList: vi.fn(),
  updateList: vi.fn(),
  fetchSharedList: vi.fn(),
}));
vi.mock('../../context/AuthContext', () => ({
  useAuth: vi.fn(),
}));
vi.mock('../../context/ToastContext', () => ({
  useToast: vi.fn(() => ({ success: vi.fn(), error: vi.fn() })),
}));
vi.mock('../../hooks/useNavigateToBusiness', () => ({
  useNavigateToBusiness: vi.fn(() => ({ navigateToBusiness: vi.fn() })),
}));
vi.mock('../../hooks/useBusinesses', () => ({
  allBusinesses: [],
}));
```

### Criterio de aceptacion

- Cobertura >= 80% del codigo nuevo en `ListDetailScreen`
- Todos los paths condicionales cubiertos (owner/editor/readOnly)
- Side effects verificados (refetch despues de invite/remove)

## Analytics

No se agregan eventos de analytics nuevos. Las acciones de invite/remove ya son server-side (Cloud Functions) y se pueden trackear desde ahi si se necesita en el futuro.

---

## Offline

### Cache strategy

| Dato | Estrategia | TTL | Storage |
|------|-----------|-----|---------|
| `editorIds` (parte de SharedList) | Firestore persistent cache | Gestionado por Firestore SDK | IndexedDB (Firestore persistent cache) |
| Editor names (`fetchEditorName`) | Firestore persistent cache | Gestionado por Firestore SDK | IndexedDB |

### Writes offline

| Operacion | Mecanismo | Conflict resolution |
|-----------|-----------|-------------------|
| Invitar editor (callable) | No soportado offline | `InviteEditorDialog` ya deshabilita boton via `isOffline` |
| Remover editor (callable) | No soportado offline | Toast de error si falla (ya implementado en `EditorsDialog`) |
| Remover item de lista | Firestore SDK write (puede encolarse) | Firestore last-write-wins |

### Fallback UI

- `EditorsDialog`: loading spinner mientras carga nombres. Si offline, los nombres pueden venir del cache de Firestore. El boton de remover no tiene guard de offline -- considerar agregar `disabled={isOffline}` en una iteracion futura (fuera de scope per PRD).
- `InviteEditorDialog`: ya tiene `isOffline` guard en el boton.

---

## Decisiones tecnicas

1. **`editorIds` como state local en `ListDetailScreen`**: necesario porque los dialogs modifican `editorIds` server-side via Cloud Functions. El componente necesita refetchear para obtener el array actualizado. No se puede hacer optimistic update porque la CF es la que valida y ejecuta el cambio.

2. **No crear hook dedicado**: la logica es 3 estados booleanos + 1 refetch callback. Extraer un hook agregaria complejidad innecesaria para ~15 lineas de logica.

3. **Remover `readOnly` de `CollaborativeTab`**: actualmente `CollaborativeTab` pasa `readOnly` a `ListDetailScreen`, lo que impide que los editores hagan cualquier accion. La logica de permisos correcta es: `ListDetailScreen` determina internamente que puede hacer cada rol (owner vs editor vs visitante). `readOnly` queda reservado para visitantes de listas publicas que no son ni owner ni editor.

4. **No modificar `EditorsDialog` ni `InviteEditorDialog`**: estan fuera de scope del PRD y ya funcionan correctamente. Solo se conectan.

---

## Hardening de seguridad

### Firestore rules requeridas

Ninguna nueva. Las rules existentes ya cubren todos los casos:

```
// sharedLists -- editor solo puede escribir itemCount + updatedAt
(isListEditor()
  && request.resource.data.diff(resource.data).affectedKeys()
     .hasOnly(['itemCount', 'updatedAt']))

// listItems -- owner o editor del parent list
function isItemListOwnerOrEditor() {
  let list = get(/databases/$(database)/documents/sharedLists/$(request.resource.data.listId));
  return list != null
    && (list.data.ownerId == request.auth.uid
        || request.auth.uid in list.data.get('editorIds', []));
}
```

### Rate limiting

No se agregan colecciones nuevas. Rate limits existentes:

| Coleccion/Callable | Limite | Implementacion |
|-------------------|--------|---------------|
| `inviteListEditor` callable | 5/min/user | Rate limit callable existente (Firestore-backed) |
| `removeListEditor` callable | 5/min/user | Rate limit callable existente |

### Vectores de ataque mitigados

| Ataque | Mitigacion | Archivo |
|--------|-----------|---------|
| Editor llama `inviteListEditor` directamente | CF valida `ownerId === request.auth.uid` | `functions/src/callables/inviteListEditor.ts` |
| Spam de invitaciones | Rate limit 5/min/user + max 5 editores por lista | `functions/src/callables/inviteListEditor.ts` |
| Enumeracion de emails via invite | CF devuelve mensaje generico, no revela si el email existe | `functions/src/callables/inviteListEditor.ts` |
| Editor intenta modificar campos de config | Firestore rules `hasOnly(['itemCount', 'updatedAt'])` para editors | `firestore.rules` |
| Field injection en sharedLists | `hasOnly()` en create y update rules | `firestore.rules` |

---

## Deuda tecnica: mitigacion incorporada

No hay issues abiertos de security ni tech debt en GitHub.

El PRD menciona que `sharedLists.ts` no tiene tests completos, pero eso esta fuera de scope. El test file `src/services/sharedLists.test.ts` ya existe con tests basicos para `fetchSharedList` y otros. No se agrava la deuda existente.

| Issue | Que se resuelve | Paso del plan |
|-------|----------------|---------------|
| N/A | N/A | N/A |
