# Specs: Conectar IconPicker a la UI de listas

**PRD:** [prd.md](prd.md)
**Fecha:** 2026-03-29

---

## Modelo de datos

No se crean colecciones ni campos nuevos. El campo `icon?: string` ya existe en `SharedList` y en Firestore rules.

```typescript
// src/types/index.ts (existente, sin cambios)
export interface SharedList {
  id: string;
  ownerId: string;
  name: string;
  description: string;
  isPublic: boolean;
  featured: boolean;
  editorIds: string[];
  itemCount: number;
  icon?: string | undefined;
  color?: string | undefined;
  createdAt: Date;
  updatedAt: Date;
}
```

## Firestore Rules

No se requieren cambios. Las rules existentes ya incluyen `icon` en ambos whitelists:

- **create**: `request.resource.data.keys().hasOnly(['ownerId', 'name', 'description', 'isPublic', 'itemCount', 'createdAt', 'updatedAt', 'color', 'icon'])`
- **update (owner)**: `affectedKeys().hasOnly(['name', 'description', 'isPublic', 'itemCount', 'updatedAt', 'color', 'icon'])`

### Rules impact analysis

| Query (service file) | Collection | Auth context | Rule that allows it | Change needed? |
|---------------------|------------|-------------|-------------------|----------------|
| `createList(userId, name, desc, icon)` | sharedLists | Owner creating | `allow create: if ... ownerId == auth.uid` | No |
| `updateList(listId, name, desc, color, icon)` | sharedLists | Owner updating | `allow update: if ... isListOwner() && affectedKeys().hasOnly(...)` | No |

### Field whitelist check

| Collection | New/modified field | In create `hasOnly()`? | In update `affectedKeys().hasOnly()`? | Rule change needed? |
|-----------|-------------------|----------------------|--------------------------------------|-------------------|
| sharedLists | icon | YES | YES | No |

## Cloud Functions

No se requieren Cloud Functions nuevas ni modificaciones.

## Componentes

### CreateListDialog (modificacion)

**Archivo:** `src/components/lists/CreateListDialog.tsx`
**Cambios:**

- Agregar estado `selectedIcon: string | undefined` con `useState`
- Agregar estado `iconPickerOpen: boolean` con `useState`
- Debajo del TextField de descripcion, agregar un `Button` con layout horizontal:
  - Si hay icono seleccionado: muestra emoji + texto "Cambiar icono"
  - Si no hay icono: muestra `InsertEmoticonOutlined` + texto "Elegir icono"
- Renderizar `IconPicker` con props `open`, `onClose`, `onSelect`, `selectedId`
- En `handleCreate`: pasar `selectedIcon` a `createList` y a `onCreated`
- Limpiar `selectedIcon` al crear exitosamente

**Props interface (modificacion):**

```typescript
interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: (listId: string, name: string, description: string, icon?: string) => void;
}
```

### ListDetailScreen (modificacion)

**Archivo:** `src/components/lists/ListDetailScreen.tsx`
**Cambios:**

- Agregar estado `iconPickerOpen: boolean` con `useState`
- Agregar estado `currentIcon: string | undefined` con `useState(() => list.icon)`
- En la toolbar, agregar un `IconButton` al lado del `PaletteOutlinedIcon` (solo si `canEdit`):
  - Si hay `currentIcon`: muestra el emoji correspondiente via `getListIconById`
  - Si no hay icono: muestra `InsertEmoticonOutlined`
- Handler `handleIconChange`: actualizar `currentIcon` (optimistic), llamar a `updateList` con el nuevo icon, toast de error si falla
- Renderizar `IconPicker` con props correspondientes
- En `onBack`: propagar `icon: currentIcon` en el objeto `updated`

### SharedListsView (modificacion)

**Archivo:** `src/components/lists/SharedListsView.tsx`
**Cambios:**

- En el callback `onCreated` de `CreateListDialog`: recibir el cuarto parametro `icon` y propagarlo al objeto de la nueva lista en el estado local

### Mutable prop audit

| Component | Prop | Editable fields | Local state needed? | Parent callback |
|-----------|------|----------------|-------------------|-----------------|
| ListDetailScreen | list: SharedList | color, isPublic, itemCount, **icon** | YES (`currentIcon`) | `onBack({ id, color, itemCount, isPublic, icon })` |
| CreateListDialog | (no recibe data mutable) | N/A | N/A | `onCreated(id, name, desc, icon)` |

## Textos de usuario

| Texto | Donde se usa | Notas |
|-------|-------------|-------|
| "Elegir icono" | CreateListDialog, boton de seleccion | Sin tilde necesaria |
| "Cambiar icono" | CreateListDialog, boton cuando ya hay icono | Sin tilde necesaria |
| "Error al cambiar icono" | ListDetailScreen, toast de error | Agregar a MSG_LIST como `iconError` |

## Hooks

No se crean hooks nuevos. La logica es suficientemente simple para vivir como estado local en los componentes.

## Servicios

### createList (modificacion)

**Archivo:** `src/services/sharedLists.ts`
**Cambios:**

```typescript
export async function createList(
  userId: string,
  name: string,
  description: string = '',
  icon?: string,
): Promise<string> {
```

- Aceptar parametro opcional `icon?: string`
- Validar con `getListIconById(icon)` antes de escribir: si el icon ID no es valido, no incluirlo en el documento
- Si el icon es valido, agregarlo al objeto que se pasa a `addDoc`

### updateList (modificacion)

**Archivo:** `src/services/sharedLists.ts`
**Cambios:**

```typescript
export async function updateList(
  listId: string,
  name: string,
  description: string,
  color?: string,
  icon?: string,
): Promise<void> {
```

- Agregar parametro opcional `icon?: string`
- Si `icon !== undefined`, agregarlo al objeto `data` (mismo patron que `color`)

## Integracion

### SharedListsView <- CreateListDialog

El callback `onCreated` de `CreateListDialog` actualmente recibe `(listId, name, description)`. Se extiende a `(listId, name, description, icon?)`. En `SharedListsView`, el objeto de la nueva lista que se agrega al estado local debe incluir `icon`.

### SharedListsView <- ListDetailScreen

El callback `onBack` de `ListDetailScreen` ya propaga `Partial<SharedList>`. Se agrega `icon: currentIcon` al objeto. `SharedListsView` ya hace `{ ...l, ...updated }` en el `setLists`, por lo que el icono se propagara automaticamente.

### ListCardGrid (sin cambios)

`ListCardGrid` ya consume `getListIconById(list.icon)` y muestra el emoji o `FolderOutlinedIcon`. No necesita modificaciones.

### Preventive checklist

- [x] **Service layer**: `CreateListDialog` y `ListDetailScreen` usan `services/sharedLists.ts` para escrituras
- [x] **Duplicated constants**: `LIST_ICON_OPTIONS` y `getListIconById` ya existen en `constants/listIcons.ts`
- [x] **Context-first data**: no aplica, los datos de lista vienen como props del parent
- [x] **Silent .catch**: `handleIconChange` usara `toast.error()` en el catch
- [x] **Stale props**: `ListDetailScreen` ya usa state local para `color`, se agrega `currentIcon` con el mismo patron

## Tests

### sharedLists.ts (tests nuevos)

Este servicio no tiene tests actualmente (deuda tecnica documentada en `tests.md`). Se crean tests para las funciones modificadas.

| Archivo test | Que testear | Tipo |
|-------------|-------------|------|
| `src/__tests__/services/sharedLists.test.ts` | `createList` con icon valido, sin icon, con icon invalido; `updateList` con icon, sin icon | Service |
| `src/__tests__/constants/listIcons.test.ts` | `getListIconById` con ID valido, invalido, undefined, string vacio | Util |

### Casos a cubrir

**sharedLists.test.ts:**

- `createList` sin icon: no incluye campo `icon` en el documento
- `createList` con icon valido (`'pizza'`): incluye `icon: 'pizza'` en el documento
- `createList` con icon invalido (`'xxx'`): no incluye campo `icon` en el documento
- `updateList` sin icon: no incluye campo `icon` en el update
- `updateList` con icon valido: incluye `icon` en el update
- `updateList` con icon undefined: no incluye campo `icon` en el update

**listIcons.test.ts:**

- `getListIconById('food')` retorna `{ id: 'food', label: 'Comida', emoji: '...' }`
- `getListIconById('xxx')` retorna `undefined`
- `getListIconById(undefined)` retorna `undefined`
- `getListIconById('')` retorna `undefined`
- `LIST_ICON_OPTIONS` tiene 30 elementos
- Todos los IDs son unicos

### Mock strategy

```typescript
vi.mock('../config/firebase', () => ({ db: {} }));
vi.mock('../config/collections', () => ({ COLLECTIONS: { SHARED_LISTS: 'sharedLists', LIST_ITEMS: 'listItems' } }));
vi.mock('./queryCache', () => ({ invalidateQueryCache: vi.fn() }));
vi.mock('../utils/analytics', () => ({ trackEvent: vi.fn() }));
```

## Analytics

| Evento | Parametros | Donde |
|--------|-----------|-------|
| `list_icon_changed` | `{ list_id: string }` | `ListDetailScreen.handleIconChange` |

Agregar constante `EVT_LIST_ICON_CHANGED = 'list_icon_changed'` en `src/constants/analyticsEvents.ts`.

Nota: `createList` ya trackea `list_created`. No se agrega parametro `icon` al evento existente para mantener la interfaz estable.

---

## Offline

### Cache strategy

| Dato | Estrategia | TTL | Storage |
|------|-----------|-----|---------|
| Icon de lista | Firestore persistent cache | N/A (parte del doc sharedList) | IndexedDB (Firestore SDK) |

### Writes offline

| Operacion | Mecanismo | Conflict resolution |
|-----------|-----------|-------------------|
| Crear lista con icono | Firestore persistent cache encola write | Last write wins (solo un writer: el owner) |
| Cambiar icono de lista | Firestore persistent cache encola write | Last write wins |

### Fallback UI

No se necesita UI especifica para offline. Si el write falla (toast de error), el estado local ya refleja el cambio optimisticamente. Si Firestore rechaza, el usuario vera el error pero el estado local quedara con el icono nuevo. Al recargar, se sincroniza con el server state (mismo patron que color).

---

## Decisiones tecnicas

1. **Validacion solo client-side para icon IDs**: Como documenta el PRD, validar server-side en Firestore rules requeriria hardcodear los 30 IDs en las rules. Es fragil y no justifica el esfuerzo dado que IDs invalidos simplemente no muestran icono (failsafe). La validacion client-side con `getListIconById` es suficiente.

2. **Parametro icon como ultimo en `updateList`**: Se agrega despues de `color` para mantener compatibilidad con las llamadas existentes que ya pasan `color`. Todas las llamadas existentes a `updateList` siguen funcionando sin cambios.

3. **No crear hook dedicado**: La logica de estado del icon es un `useState` + un handler de ~5 lineas. No justifica un hook extraido. Si en el futuro se necesita icon picking en mas componentes, se puede extraer.

---

## Hardening de seguridad

### Firestore rules requeridas

Ninguna nueva. Las rules existentes ya cubren `icon` en create y update.

### Rate limiting

No se agrega superficie nueva de escritura. `createList` y `updateList` son las mismas funciones existentes. No se necesita rate limit adicional.

### Vectores de ataque mitigados

| Ataque | Mitigacion | Archivo |
|--------|-----------|---------|
| Icon ID arbitrario via API directa | `getListIconById` retorna undefined para IDs invalidos; ListCardGrid muestra FolderOutlinedIcon como fallback | `src/constants/listIcons.ts`, `src/components/lists/ListCardGrid.tsx` |
| Field injection en sharedLists | `hasOnly()` en rules ya limita campos permitidos | `firestore.rules` L346, L364 |

---

## Deuda tecnica: mitigacion incorporada

| Issue | Que se resuelve | Paso del plan |
|-------|----------------|---------------|
| `sharedLists.ts` sin tests (tests.md prioridad alta #3) | Se agregan tests para `createList` y `updateList` | Fase 1, paso 1 |
