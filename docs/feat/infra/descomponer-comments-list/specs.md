# Specs: Descomponer CommentsList.tsx

**PRD:** [prd.md](prd.md)
**Fecha:** 2026-03-28

---

## Modelo de datos

No aplica. Este refactor no modifica colecciones, documentos ni tipos de Firestore. Todos los tipos existentes (`Comment`, `Business`) se reutilizan sin cambios.

## Firestore Rules

No aplica. No hay queries nuevas ni modificadas.

### Rules impact analysis

No hay queries nuevas. Todas las queries existentes permanecen identicas.

| Query (service file) | Collection | Auth context | Rule that allows it | Change needed? |
|---------------------|------------|-------------|-------------------|----------------|
| N/A | — | — | — | No |

### Field whitelist check

No hay campos nuevos ni modificados.

| Collection | New/modified field | In create `hasOnly()`? | In update `affectedKeys().hasOnly()`? | Rule change needed? |
|-----------|-------------------|----------------------|--------------------------------------|-------------------|
| N/A | — | — | — | No |

## Cloud Functions

No aplica.

## Componentes

### CommentsListItem.tsx (nuevo)

- **Path:** `src/components/menu/CommentsListItem.tsx`
- **Tipo:** Componente memo extraido de `CommentsList.tsx` (lineas 61-244)
- **Props:** `CommentItemProps` (interfaz movida desde `CommentsList.tsx`, renombrada a `CommentsListItemProps` para consistencia con el nombre del archivo)

```typescript
export interface CommentsListItemProps {
  id: string;
  comment: Comment;
  business: Business | null;
  editingId: string | null;
  editText: string;
  isSavingEdit: boolean;
  swipe: ReturnType<typeof useSwipeActions>;
  getSwipeRef: (id: string) => React.RefObject<HTMLElement | null>;
  unreadReplyCommentIds: Set<string>;
  onSelectBusiness: (business: Business | null, commentId?: string) => void;
  onStartEdit: (comment: Comment) => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onSetEditText: (text: string) => void;
  onMarkForDelete: (id: string, comment: Comment) => void;
}
```

- **Comportamiento:** Identico al `CommentItem` actual. Renderiza un item de la lista de comentarios del usuario con soporte para swipe, edicion inline y acciones (editar/eliminar).
- **Patron:** Sigue el patron de `CommentRow` extraido de `BusinessComments` en #195. Componente memo con props explicitas.

### CommentsListContent.tsx (nuevo)

- **Path:** `src/components/menu/CommentsListContent.tsx`
- **Tipo:** Componente que encapsula el renderizado de la lista (normal y virtualizada)
- **Props:**

```typescript
interface CommentsListContentProps {
  filteredComments: Array<{ id: string; comment: Comment; business: Business | null }>;
  shouldVirtualize: boolean;
  virtualizer: ReturnType<typeof useVirtualizedList>['virtualizer'];
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
  // Props para CommentsListItem (pasadas directamente)
  editingId: string | null;
  editText: string;
  isSavingEdit: boolean;
  swipe: ReturnType<typeof useSwipeActions>;
  getSwipeRef: (id: string) => React.RefObject<HTMLElement | null>;
  unreadReplyCommentIds: Set<string>;
  onSelectBusiness: (business: Business | null, commentId?: string) => void;
  onStartEdit: (comment: Comment) => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onSetEditText: (text: string) => void;
  onMarkForDelete: (id: string, comment: Comment) => void;
}
```

- **Comportamiento:** Renderiza `<List>` con `CommentsListItem` para cada comentario. Si `shouldVirtualize` es true, usa el virtualizer con posicionamiento absoluto. Si es false, renderiza la lista normal con `.map()`. Elimina la duplicacion de instanciacion de `CommentsListItem` que existe actualmente en `CommentsList.tsx` (lineas 385-458).

### CommentsList.tsx (modificado)

- **Path:** `src/components/menu/CommentsList.tsx`
- **Cambio:** Se reduce a orquestador. Mantiene todos los hooks (datos, filtros, undo-delete, edit, swipe, notificaciones, virtualizacion) y delega el renderizado de la lista a `CommentsListContent`.
- **Se eliminan:** La definicion de `CommentItem` y `CommentItemProps`, y la logica de renderizado duplicada de la lista normal/virtualizada.
- **Se mantienen:** `PullToRefreshWrapper`, `PaginatedListShell`, `CommentsStats`, `CommentsToolbar`, search result count, loading message, y `Snackbar`.

### Mutable prop audit

No aplica. `CommentsListItem` y `CommentsListContent` no modifican datos recibidos por props. Son componentes de presentacion pura que delegan acciones via callbacks al parent.

| Component | Prop | Editable fields | Local state needed? | Parent callback |
|-----------|------|----------------|-------------------|-----------------|
| CommentsListItem | comment, business | Ninguno (edit usa editText del parent) | NO | N/A |
| CommentsListContent | filteredComments | Ninguno | NO | N/A |

## Textos de usuario

No hay textos nuevos. Todos los textos existentes se mueven sin modificacion.

| Texto | Donde se usa | Notas |
|-------|-------------|-------|
| N/A | — | Sin textos nuevos |

## Hooks

No hay hooks nuevos ni modificados. Todos los hooks existentes (`useCommentsListFilters`, `useVirtualizedList`, `useCommentEdit`, `useUndoDelete`, `useSwipeActions`, `usePaginatedQuery`) se mantienen identicos.

## Servicios

No hay servicios nuevos ni modificados.

## Integracion

### Importaciones afectadas

`CommentsList.tsx` es importado unicamente desde `ListsScreen` (via lazy o directa). Este import no cambia ya que `CommentsList` sigue siendo el export default del mismo archivo.

Los archivos nuevos (`CommentsListItem.tsx`, `CommentsListContent.tsx`) son internos al directorio `menu/` y solo los importa `CommentsList.tsx` y `CommentsListContent.tsx` respectivamente.

### Preventive checklist

- [x] **Service layer**: No hay imports directos de `firebase/firestore` en los archivos nuevos
- [x] **Duplicated constants**: No se definen constantes nuevas
- [x] **Context-first data**: No hay `getDoc` nuevos
- [x] **Silent .catch**: No hay `.catch` nuevos
- [x] **Stale props**: Los componentes nuevos son de presentacion pura, no mutan datos

## Tests

No hay logica nueva. Es movimiento de codigo existente. No se agregan tests nuevos.

| Archivo test | Que testear | Tipo |
|-------------|-------------|------|
| N/A | No hay logica nueva | — |

**Verificacion requerida:** build y lint pasan sin errores, y la app funciona identicamente.

## Analytics

No hay eventos nuevos.

---

## Offline

No aplica. El comportamiento offline existente permanece identico.

### Cache strategy

| Dato | Estrategia | TTL | Storage |
|------|-----------|-----|---------|
| N/A | — | — | — |

### Writes offline

| Operacion | Mecanismo | Conflict resolution |
|-----------|-----------|-------------------|
| N/A | — | — |

### Fallback UI

No aplica.

---

## Decisiones tecnicas

### D1: Nombrar `CommentsListItem` en vez de `CommentItem`

El nombre interno `CommentItem` es generico y podria colisionar con otros usos. `CommentsListItem` sigue la convencion de prefijar con el nombre del parent (`CommentsList` -> `CommentsListItem`), similar a como `CommentRow` es especifico de `BusinessComments`.

### D2: Props directas en vez de render callback para CommentsListContent

Se opto por pasar todas las props de `CommentsListItem` como props directas de `CommentsListContent` en vez de usar un render callback. Razon: el pattern de render callback agregaria complejidad sin beneficio real, ya que `CommentsListContent` solo instancia `CommentsListItem` y no hay variantes de renderizado.

### D3: No crear subdirectorio

Los 3 archivos nuevos/modificados se mantienen en `src/components/menu/` (flat) en vez de crear `src/components/menu/comments-list/`. Razon: ya existen `CommentsStats.tsx` y `CommentsToolbar.tsx` en el mismo directorio, y el total de archivos relacionados (5) no justifica un subdirectorio. Si en el futuro crece, se puede agrupar.

### D4: Renombrar interfaz a CommentsListItemProps

La interfaz `CommentItemProps` se renombra a `CommentsListItemProps` para consistencia con el nombre del componente exportado. Se exporta para que `CommentsListContent` pueda importarla.

---

## Estimacion de archivos

| Archivo | Lineas estimadas | Accion |
|---------|-----------------|--------|
| `src/components/menu/CommentsListItem.tsx` | ~195 | OK (componente memo + imports) |
| `src/components/menu/CommentsListContent.tsx` | ~85 | OK (wrapper de lista + virtualizado) |
| `src/components/menu/CommentsList.tsx` | ~175 | OK (orquestador con hooks) |
