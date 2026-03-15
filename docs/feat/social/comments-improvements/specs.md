# Specs Tecnicas: Mejoras en Comentarios + Dark Mode + Refactors

**Feature:** comments-improvements
**Fecha:** 2026-03-14
**Issues:** #101-#111 (excl. #112)
**PRD:** revision 4

---

## Pre-requisitos (DT)

### DT-2: Extraer `truncate` a utils

**Archivo nuevo:** `src/utils/text.ts`

```typescript
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
}
```

**Refactor:** eliminar definiciones inline en `CommentsList.tsx` y `UserProfileSheet.tsx`, importar desde `src/utils/text.ts`.

---

### DT-3: Dark mode — 27 reemplazos en 13 archivos

Reemplazos directos sin cambio de logica. Agrupar por patron para eficiencia.

**Paso 1 — Constantes nuevas en `src/constants/ui.ts`:**

```typescript
// Agregar a las constantes existentes
export const LIKE_COLOR = '#e91e63'; // Rosa intencional para likes, distinto de secondary (rojo)
export const RANKINGS_COLOR = '#e65100'; // Naranja oscuro para icono rankings
export const STATS_COLOR = '#7b1fa2'; // Purpura para icono estadisticas
```

**Paso 2 — Criticos (12 reemplazos):**

| Archivo | Linea | `old` | `new` |
|---------|-------|-------|-------|
| `LocationFAB.tsx` | 18 | `backgroundColor: '#fff'` | `backgroundColor: 'background.paper'` |
| `LocationFAB.tsx` | 19 | `color: '#666'` | `color: 'text.secondary'` |
| `LocationFAB.tsx` | 21 | `backgroundColor: '#f5f5f5'` | `backgroundColor: 'action.hover'` |
| `UserProfileSheet.tsx` | 67 | `backgroundColor: '#dadce0'` | `backgroundColor: 'divider'` |
| `BusinessSheet.tsx` | 64 | `backgroundColor: '#dadce0'` | `backgroundColor: 'divider'` |
| `CommentsList.tsx` | 107 | `color: '#ccc'` | `color: 'action.disabled'` |
| `FavoritesList.tsx` | 101 | `color: '#ccc'` | `color: 'action.disabled'` |
| `RatingsList.tsx` | 88 | `color: '#ccc'` | `color: 'action.disabled'` |
| `BusinessComments.tsx` | 519 | `color: '#fff'` | `color: 'primary.contrastText'` |
| `BusinessComments.tsx` | 619 | `color: '#fff'` | `color: 'primary.contrastText'` |
| `MapView.tsx` | 82 | `rgba(255,255,255,0.95)` | `(theme) => alpha(theme.palette.background.paper, 0.95)` |
| `NotificationItem.tsx` | 24 | `#34a853` | `success.main` |

**Paso 3 — Moderados (6 reemplazos):**

| Archivo | Linea | `old` | `new` |
|---------|-------|-------|-------|
| `FilterChips.tsx` | 12 | `boxShadow: '0 1px 3px rgba(0,0,0,0.15)'` | `boxShadow: 1` (theme.shadows) |
| `FilterChips.tsx` | 15 | `boxShadow: '0 1px 4px rgba(0,0,0,0.25)'` | `boxShadow: 2` |
| `BusinessComments.tsx` | 387 | `'#e91e63'` | `LIKE_COLOR` (import desde constants) |
| `BusinessComments.tsx` | 311 | `'#1a73e8'` | `'primary.main'` |
| `SideMenu.tsx` | 155 | `'#1a73e8'` | `'primary.main'` |
| `UserProfileSheet.tsx` | 84 | `'#1a73e8'` | `'primary.main'` |

**Paso 4 — Menores (9 reemplazos):**

| Archivo | Linea | `old` | `new` |
|---------|-------|-------|-------|
| `FeedbackForm.tsx` | 71 | `'#34a853'` | `'success.main'` |
| `SideMenu.tsx` | 222 | `'#ff9800'` | `'warning.main'` |
| `SideMenu.tsx` | 229 | `'#fbc02d'` | `'warning.light'` |
| `SideMenu.tsx` | 243 | `'#fbbc04'` | `'warning.light'` |
| `SideMenu.tsx` | 250 | `'#34a853'` | `'success.main'` |
| `SideMenu.tsx` | 257 | `'#e65100'` | `RANKINGS_COLOR` |
| `SideMenu.tsx` | 264 | `'#7b1fa2'` | `STATS_COLOR` |
| `SideMenu.tsx` | 300 | `'#ffb74d'`/`'#fb8c00'` | `'warning.light'`/`'warning.main'` |
| `LineChartCard.tsx` | 68 | `'#ccc'` | `'action.disabled'` |

**Verificacion post-fix:** `grep -rn "#[0-9a-fA-F]\{3,8\}" src/components/` debe mostrar solo excepciones documentadas (FavoriteButton, BusinessMarker, MenuPhotoViewer/Section, UserScoreCard, constants).

---

### DT-1: Hook `useUndoDelete`

**Archivo nuevo:** `src/hooks/useUndoDelete.ts`

```typescript
import { useState, useRef, useEffect, useCallback } from 'react';

interface UseUndoDeleteOptions<T> {
  onConfirmDelete: (item: T) => Promise<void>;
  onDeleteComplete?: () => void;
  timeout?: number;
  message?: string; // configurable para reusar en otros contextos
}

interface SnackbarProps {
  open: boolean;
  message: string;
  onUndo: () => void;
  autoHideDuration: number;
  onClose: () => void;
}

interface UseUndoDeleteReturn<T> {
  isPendingDelete: (id: string) => boolean;
  markForDelete: (id: string, item: T) => void;
  undoDelete: (id: string) => void;
  undoLast: () => void;
  snackbarProps: SnackbarProps;
}

export function useUndoDelete<T>(
  options: UseUndoDeleteOptions<T>,
): UseUndoDeleteReturn<T> {
  const { onConfirmDelete, onDeleteComplete, timeout = 5000, message = 'Eliminado' } = options;
  const pendingRef = useRef<Map<string, { item: T; timer: ReturnType<typeof setTimeout> }>>(
    new Map(),
  );
  const [lastDeletedId, setLastDeletedId] = useState<string | null>(null);
  // Ref para evitar stale closure en confirmDelete
  const lastDeletedIdRef = useRef<string | null>(null);
  lastDeletedIdRef.current = lastDeletedId;

  // Cleanup ALL timers on unmount — deletes se cancelan silenciosamente
  // (decision UX: si el usuario navega antes del timeout, el delete no se ejecuta)
  useEffect(() => {
    return () => {
      for (const { timer } of pendingRef.current.values()) {
        clearTimeout(timer);
      }
      pendingRef.current.clear();
    };
  }, []);

  const confirmDelete = useCallback(
    async (id: string) => {
      const entry = pendingRef.current.get(id);
      if (!entry) return;
      pendingRef.current.delete(id);
      try {
        await onConfirmDelete(entry.item);
        onDeleteComplete?.();
      } catch {
        // Item already removed from UI, nothing to revert visually
      }
      // Usar ref para evitar stale closure (fix: race condition con multiples deletes)
      if (lastDeletedIdRef.current === id) setLastDeletedId(null);
    },
    [onConfirmDelete, onDeleteComplete],
  );

  const markForDelete = useCallback(
    (id: string, item: T) => {
      // Cancel existing timer for this id if any
      const existing = pendingRef.current.get(id);
      if (existing) clearTimeout(existing.timer);

      const timer = setTimeout(() => confirmDelete(id), timeout);
      pendingRef.current.set(id, { item, timer });
      setLastDeletedId(id);
    },
    [confirmDelete, timeout],
  );

  const undoDelete = useCallback((id: string) => {
    const entry = pendingRef.current.get(id);
    if (entry) {
      clearTimeout(entry.timer);
      pendingRef.current.delete(id);
    }
    setLastDeletedId((prev) => (prev === id ? null : prev));
  }, []);

  const undoLast = useCallback(() => {
    const id = lastDeletedIdRef.current;
    if (id) undoDelete(id);
  }, [undoDelete]);

  const isPendingDelete = useCallback(
    (id: string) => pendingRef.current.has(id),
    [],
  );

  const snackbarProps: SnackbarProps = {
    open: lastDeletedId !== null,
    message,
    onUndo: undoLast,
    autoHideDuration: timeout,
    onClose: () => setLastDeletedId(null),
  };

  return { isPendingDelete, markForDelete, undoDelete, undoLast, snackbarProps };
}
```

**Adopcion en CommentsList:**

```typescript
const { isPendingDelete, markForDelete, snackbarProps } = useUndoDelete<Comment>({
  onConfirmDelete: (comment) => deleteComment(comment.id, user!.uid),
  onDeleteComplete: reload,
});
```

Eliminar: `pendingDeleteId`, `deleteTimerRef`, snackbar manual, timeout logic.

**Adopcion en BusinessComments:**

```typescript
const { isPendingDelete, markForDelete, snackbarProps } = useUndoDelete<Comment>({
  onConfirmDelete: (comment) => deleteComment(comment.id, user!.uid),
  onDeleteComplete: onCommentsChange,
});
```

Eliminar: `pendingDeletes` Map, `deleteTimersRef` Map, snackbar manual.

---

## Fase 1 — Features

### #110 Skeleton Loader

Reemplazar "Cargando..." por skeletons que simulan la estructura de un item.

```tsx
import { Skeleton } from '@mui/material';

if (isLoading) {
  return (
    <Box sx={{ px: 2, py: 1 }}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Box key={i} sx={{ display: 'flex', alignItems: 'center', py: 1 }}>
          <Box sx={{ flex: 1 }}>
            <Skeleton width="60%" height={20} />
            <Skeleton width="90%" height={16} sx={{ mt: 0.5 }} />
            <Skeleton width="30%" height={14} sx={{ mt: 0.5 }} />
          </Box>
          <Skeleton variant="circular" width={32} height={32} />
        </Box>
      ))}
    </Box>
  );
}
```

**Archivo:** `CommentsList.tsx`

---

### #111 Empty State Mejorado

```tsx
<Box sx={{ p: 4, textAlign: 'center' }}>
  <ChatBubbleOutlineIcon sx={{ fontSize: 48, color: 'action.disabled', mb: 1 }} />
  <Typography variant="body2" color="text.secondary" gutterBottom>
    No dejaste comentarios todavia
  </Typography>
  <Typography variant="caption" color="text.secondary">
    Toca un comercio en el mapa para dejar tu opinion
  </Typography>
</Box>
```

Usa `action.disabled` (no `#ccc`). Sin boton CTA.

**Archivo:** `CommentsList.tsx`

---

### #108 Preview Mejorado + #104 Likes

Se implementan juntos — misma zona de render (metadata row).

**Cambios por item:**

- `formatDateMedium` → `formatRelativeTime` (ya existe en `src/utils/formatDate.ts`)
- Agregar "(editado)" si `comment.updatedAt`
- Agregar like count si `comment.likeCount > 0`
- Agregar reply count si `comment.replyCount > 0`

```tsx
// Metadata row debajo del texto truncado
<Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mt: 0.25, flexWrap: 'wrap' }}>
  <Typography variant="caption" color="text.secondary">
    {formatRelativeTime(comment.createdAt)}
  </Typography>
  {comment.updatedAt && (
    <Typography variant="caption" color="text.disabled">
      (editado)
    </Typography>
  )}
  {comment.likeCount > 0 && (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
      <FavoriteIcon sx={{ fontSize: 14, color: 'text.disabled' }} />
      <Typography variant="caption" color="text.disabled">
        {comment.likeCount}
      </Typography>
    </Box>
  )}
  {(comment.replyCount ?? 0) > 0 && (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
      <ChatBubbleOutlineIcon sx={{ fontSize: 12, color: 'text.secondary' }} />
      <Typography variant="caption" color="text.secondary">
        {comment.replyCount}
      </Typography>
    </Box>
  )}
</Box>
```

**Archivo:** `CommentsList.tsx`
**Import:** `formatRelativeTime` de `src/utils/formatDate.ts`

---

### #103 Ordenamiento Multiple

Sorting client-side sobre items cargados. `usePaginatedQuery` no se modifica.

**Estado:**

```typescript
type SortMode = 'recent' | 'oldest' | 'useful';
const [sortMode, setSortMode] = useState<SortMode>('recent');
```

**Logica:**

```typescript
const sortedComments = useMemo(() => {
  const list = [...comments];
  switch (sortMode) {
    case 'oldest':
      return list.reverse();
    case 'useful':
      return list.sort((a, b) => b.comment.likeCount - a.comment.likeCount);
    default:
      return list;
  }
}, [comments, sortMode]);
```

**UI (oculto con menos de 3 items):**

```tsx
{comments.length >= 3 && (
  <ToggleButtonGroup
    value={sortMode}
    exclusive
    onChange={(_, v) => v && setSortMode(v)}
    size="small"
    aria-label="Ordenar comentarios"
    sx={{ display: 'flex', gap: 0.5, px: 2, py: 1 }}
  >
    {(['recent', 'oldest', 'useful'] as const).map((mode) => (
      <ToggleButton
        key={mode}
        value={mode}
        sx={{
          height: 24,
          fontSize: '0.7rem',
          borderRadius: '16px !important',
          border: '1px solid',
          borderColor: 'divider',
          textTransform: 'none',
          px: 1.5,
        }}
      >
        {mode === 'recent' ? 'Recientes' : mode === 'oldest' ? 'Antiguos' : 'Mas likes'}
      </ToggleButton>
    ))}
  </ToggleButtonGroup>
)}
```

**Nota:** Se usa `ToggleButtonGroup exclusive` en lugar de Chips con `aria-pressed`. MUI ToggleButtonGroup maneja correctamente `role="radiogroup"` + `role="radio"` + `aria-checked` (WCAG 4.1.2). Los estilos se ajustan para que visualmente parezcan chips (borderRadius 16px, height 24).

**Archivo:** `CommentsList.tsx`

---

### #102 Busqueda de Texto

`useDeferredValue` (patron existente en `useBusinesses.ts`). "Cargar todos" automatico al activar.

**Estado:**

```typescript
const [searchInput, setSearchInput] = useState('');
const deferredSearch = useDeferredValue(searchInput);
```

**"Cargar todos" al activar busqueda:**

```typescript
// Cuando el usuario empieza a tipear, cargar todos los items paginados
useEffect(() => {
  if (searchInput && hasMore) {
    loadAll(200); // safety limit
  }
}, [searchInput, hasMore, loadAll]);
```

Esto requiere agregar `loadAll(limit)` a `usePaginatedQuery` — una funcion que llama `loadMore()` en loop hasta `!hasMore` o alcanzar el limite. Se implementa en DT-5 (Fase 2) cuando se refactoriza el hook, pero para Fase 1 se puede hacer un approach simple:

```typescript
// Approach simple Fase 1: loop manual
useEffect(() => {
  if (!searchInput || !hasMore || isLoadingMore) return;
  loadMore();
}, [searchInput, hasMore, isLoadingMore, loadMore]);
```

**Filtrado:**

```typescript
const filteredComments = useMemo(() => {
  if (!deferredSearch) return sortedComments;
  const q = deferredSearch.toLowerCase();
  return sortedComments.filter(
    (c) =>
      c.comment.text.toLowerCase().includes(q) ||
      (c.business?.name.toLowerCase().includes(q) ?? false),
  );
}, [sortedComments, deferredSearch]);
```

**UI (oculto con menos de 3 items):**

```tsx
{comments.length >= 3 && (
  <>
    <Box sx={{ px: 2, mb: 1 }}>
      <TextField
        size="small"
        placeholder="Buscar comentarios..."
        value={searchInput}
        onChange={(e) => setSearchInput(e.target.value)}
        aria-label="Buscar comentarios"
        fullWidth
        slotProps={{
          input: {
            startAdornment: (
              <SearchIcon sx={{ fontSize: 18, color: 'text.secondary', mr: 0.5 }} />
            ),
            endAdornment: searchInput ? (
              <IconButton
                size="small"
                onClick={() => setSearchInput('')}
                aria-label="Limpiar busqueda"
              >
                <CloseIcon sx={{ fontSize: 16 }} />
              </IconButton>
            ) : null,
          },
        }}
      />
    </Box>
    {deferredSearch && (
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ px: 2 }}
        aria-live="polite"
      >
        {filteredComments.length} resultado{filteredComments.length !== 1 ? 's' : ''}
      </Typography>
    )}
  </>
)}
```

**Loading durante carga masiva:**

```tsx
{searchInput && hasMore && (
  <Typography variant="caption" color="text.secondary" sx={{ px: 2 }}>
    Cargando todos los comentarios...
  </Typography>
)}
```

**Archivo:** `CommentsList.tsx`

---

## Fase 2 — DT + Features

### DT-5: `usePaginatedQuery` constraints genericos

**Cambio de firma:**

```typescript
// Antes
function usePaginatedQuery<T>(
  collectionRef: CollectionReference<T>,
  userId: string,
  orderByField: string,
  pageSize?: number,
): UsePaginatedQueryReturn<T>

// Despues
function usePaginatedQuery<T>(
  collectionRef: CollectionReference<T>,
  constraints: QueryConstraint[],
  orderByField: string,
  pageSize?: number,
): UsePaginatedQueryReturn<T>
```

**Cache key:** `cacheKey` es parametro **obligatorio** (no opcional). `QueryConstraint` de Firebase no es serializable de forma deterministica — `JSON.stringify` produce keys inconsistentes. Los consumidores pasan `userId` como cache key, compatible con `invalidateQueryCache(collectionPath, userId)` existente.

```typescript
function usePaginatedQuery<T>(
  collectionRef: CollectionReference<T>,
  constraints: QueryConstraint[],
  orderByField: string,
  pageSize: number,
  cacheKey: string, // obligatorio — usado para queryCache compat
): UsePaginatedQueryReturn<T>
```

**Consumidores actualizados:**

```typescript
// CommentsList
usePaginatedQuery(
  commentsCollection,
  [where('userId', '==', user.uid)],
  'createdAt',
  20,
  user.uid,
);

// RatingsList - mismo patron
// FavoritesList - mismo patron
```

**Agregar `hasMoreRef` + `loadAll`:**

El hook necesita un ref que mirroree el state `hasMore` para que `loadAll` pueda leerlo dentro de un loop async sin stale closures:

```typescript
// Agregar ref que mirrorea hasMore state
const hasMoreRef = useRef(false);
hasMoreRef.current = hasMore;

// Nuevo metodo en el return del hook
const loadAll = useCallback(async (limit = 200) => {
  let loaded = 0;
  while (hasMoreRef.current && loaded < limit) {
    await loadMore();
    loaded += pageSize;
  }
}, [loadMore, pageSize]);
```

**NO tocar:** `src/services/queryCache.ts`, `invalidateQueryCache` ni ningun service.

**Tests:** actualizar `usePaginatedQuery.test.ts` (cambiar firma en los 9 tests).

**Archivo:** `src/hooks/usePaginatedQuery.ts`

---

### DT-6: `PaginatedListShell`

**Archivo nuevo:** `src/components/menu/PaginatedListShell.tsx`

```tsx
import type { ReactNode } from 'react';
import { Box, Typography, Button, CircularProgress, Skeleton } from '@mui/material';

interface PaginatedListShellProps {
  isLoading: boolean;
  error: string | null;
  isEmpty: boolean;
  hasMore: boolean;
  isLoadingMore: boolean;
  emptyIcon: ReactNode;
  emptyMessage: string;
  emptySubtext?: string;
  noResultsMessage?: string; // "busqueda sin resultados" (distinto de empty)
  isFiltered?: boolean; // true cuando hay busqueda/filtro activo
  skeletonCount?: number;
  renderSkeleton?: () => ReactNode; // custom skeleton layout (default: titulo + texto + fecha + circulo)
  onRetry: () => void;
  onLoadMore: () => void;
  children: ReactNode;
}

export function PaginatedListShell({
  isLoading,
  error,
  isEmpty,
  hasMore,
  isLoadingMore,
  emptyIcon,
  emptyMessage,
  emptySubtext,
  noResultsMessage = 'No se encontraron resultados',
  isFiltered = false,
  skeletonCount = 5,
  onRetry,
  onLoadMore,
  children,
}: PaginatedListShellProps) {
  if (isLoading) {
    return (
      <Box sx={{ px: 2, py: 1 }}>
        {Array.from({ length: skeletonCount }).map((_, i) => (
          <Box key={i} sx={{ display: 'flex', alignItems: 'center', py: 1 }}>
            <Box sx={{ flex: 1 }}>
              <Skeleton width="60%" height={20} />
              <Skeleton width="90%" height={16} sx={{ mt: 0.5 }} />
              <Skeleton width="30%" height={14} sx={{ mt: 0.5 }} />
            </Box>
            <Skeleton variant="circular" width={32} height={32} />
          </Box>
        ))}
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <Typography variant="body2" color="error" gutterBottom>
          {error}
        </Typography>
        <Button size="small" onClick={onRetry}>
          Reintentar
        </Button>
      </Box>
    );
  }

  if (isEmpty && isFiltered) {
    return (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <Typography variant="body2" color="text.secondary">
          {noResultsMessage}
        </Typography>
      </Box>
    );
  }

  if (isEmpty) {
    return (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <Box sx={{ color: 'action.disabled', mb: 1 }}>{emptyIcon}</Box>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          {emptyMessage}
        </Typography>
        {emptySubtext && (
          <Typography variant="caption" color="text.secondary">
            {emptySubtext}
          </Typography>
        )}
      </Box>
    );
  }

  return (
    <>
      {children}
      {hasMore && (
        <Box sx={{ textAlign: 'center', py: 1 }}>
          <Button
            size="small"
            onClick={onLoadMore}
            disabled={isLoadingMore}
            aria-label="Cargar mas"
            startIcon={isLoadingMore ? <CircularProgress size={16} /> : null}
          >
            {isLoadingMore ? 'Cargando...' : 'Cargar mas'}
          </Button>
        </Box>
      )}
    </>
  );
}
```

**Adopcion en las 3 listas:**

```tsx
// CommentsList — ejemplo
<PaginatedListShell
  isLoading={isLoading}
  error={error}
  isEmpty={finalComments.length === 0}
  isFiltered={!!deferredSearch || !!filterBusiness}
  hasMore={hasMore}
  isLoadingMore={isLoadingMore}
  emptyIcon={<ChatBubbleOutlineIcon sx={{ fontSize: 48 }} />}
  emptyMessage="No dejaste comentarios todavia"
  emptySubtext="Toca un comercio en el mapa para dejar tu opinion"
  noResultsMessage={`No se encontraron resultados para "${deferredSearch}"`}
  onRetry={reload}
  onLoadMore={loadMore}
>
  <List disablePadding>
    {finalComments.map((c) => (
      // render each item
    ))}
  </List>
</PaginatedListShell>
```

Eliminar de cada lista: estados loading/error/empty/pagination inline (~50 lineas cada una).

---

### DT-4: Extraer `CommentRow`

**Archivo nuevo:** `src/components/business/CommentRow.tsx`

```typescript
interface CommentRowProps {
  comment: Comment;
  isOwn: boolean;
  isLiked: boolean;
  likeCount: number;
  replyCount: number; // precalculado via getReplyCount (tiene fallback a repliesByParent)
  isReply?: boolean;
  isEditing: boolean;
  editText: string;
  isSavingEdit: boolean;
  userName: string;
  isProfilePublic: boolean;
  onToggleLike: (commentId: string) => void;
  onStartEdit: (comment: Comment) => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onEditTextChange: (text: string) => void;
  onDelete: (commentId: string) => void;
  onReply?: (commentId: string) => void;
  onShowProfile?: (userId: string) => void;
}

const CommentRow = memo(function CommentRow(props: CommentRowProps) {
  // ~170 lineas extraidas de renderComment en BusinessComments
  // Recibe isEditing como boolean precalculado (no compara editingId internamente)
  // Esto evita re-renders de todos los rows cuando cambia editingId
});

export default CommentRow;
```

**En BusinessComments:** reemplazar `renderComment(comment, isReply)` por:

```tsx
<CommentRow
  comment={comment}
  isOwn={comment.userId === user?.uid}
  isLiked={isLiked(comment.id)}
  likeCount={getLikeCount(comment)}
  isReply={isReply}
  isEditing={editingId === comment.id}
  editText={editText}
  isSavingEdit={isSavingEdit}
  userName={comment.userName}
  isProfilePublic={profileVisibility.get(comment.userId) ?? false}
  onToggleLike={handleToggleLike}
  onStartEdit={handleStartEdit}
  onSaveEdit={handleSaveEdit}
  onCancelEdit={handleCancelEdit}
  onEditTextChange={setEditText}
  onDelete={handleDeleteComment}
  onReply={handleStartReply}
  onShowProfile={setProfileUser}
/>
```

**Envolver handlers con `useCallback`:** `handleToggleLike`, `handleStartEdit`, `handleSaveEdit`, `handleCancelEdit`, `handleDeleteComment`, `handleStartReply`.

---

### #106 Editar Inline

Patron identico a BusinessComments, adaptado para CommentsList.

**Estado:**

```typescript
const [editingId, setEditingId] = useState<string | null>(null);
const [editText, setEditText] = useState('');
const [isSavingEdit, setIsSavingEdit] = useState(false);
```

**Handlers:**

```typescript
const handleStartEdit = useCallback((comment: Comment) => {
  setEditingId(comment.id);
  setEditText(comment.text);
}, []);

const handleSaveEdit = useCallback(async () => {
  if (!editingId || !editText.trim() || !user) return;
  setIsSavingEdit(true);
  try {
    await editComment(editingId, user.uid, editText.trim());
    setEditingId(null);
    reload();
  } finally {
    setIsSavingEdit(false);
  }
}, [editingId, editText, user, reload]);

const handleCancelEdit = useCallback(() => {
  setEditingId(null);
  setEditText('');
}, []);
```

**UI en cada item:** cuando `editingId === comment.id`:

```tsx
<Box sx={{ mt: 0.5 }}>
  <TextField
    fullWidth
    size="small"
    multiline
    maxRows={4}
    value={editText}
    onChange={(e) => setEditText(e.target.value)}
    disabled={isSavingEdit}
    slotProps={{ htmlInput: { maxLength: MAX_COMMENT_LENGTH } }}
    helperText={`${editText.length}/${MAX_COMMENT_LENGTH}`}
  />
  <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5 }}>
    <IconButton
      size="small"
      color="primary"
      onClick={handleSaveEdit}
      disabled={isSavingEdit || !editText.trim()}
      aria-label="Guardar edicion"
    >
      <CheckIcon fontSize="small" />
    </IconButton>
    <IconButton
      size="small"
      onClick={handleCancelEdit}
      disabled={isSavingEdit}
      aria-label="Cancelar edicion"
    >
      <CloseIcon fontSize="small" />
    </IconButton>
  </Box>
</Box>
```

**Boton de editar:** IconButton con EditIcon junto al delete, visible siempre (todos los comentarios de la lista son del usuario).

**Archivo:** `CommentsList.tsx`
**Import:** `editComment` de `src/services/comments.ts`, `MAX_COMMENT_LENGTH` de `src/constants/validation.ts`

---

### #101 Filtrar por Comercio

Autocomplete con comercios extraidos de items cargados.

```typescript
const businessOptions = useMemo(() => {
  const seen = new Set<string>();
  return comments
    .map((c) => c.business)
    .filter(
      (b): b is Business => b !== null && !seen.has(b.id) && seen.add(b.id) && true,
    )
    .sort((a, b) => a.name.localeCompare(b.name));
}, [comments]);

const [filterBusiness, setFilterBusiness] = useState<Business | null>(null);
```

**UI:**

```tsx
<Box sx={{ px: 2, mb: 1 }}>
  <Autocomplete
    size="small"
    options={businessOptions}
    getOptionLabel={(b) => b.name}
    value={filterBusiness}
    onChange={(_, v) => setFilterBusiness(v)}
    renderInput={(params) => (
      <TextField {...params} placeholder="Filtrar por comercio..." size="small" />
    )}
  />
</Box>
```

**Pipeline de filtrado final:**

```typescript
const finalComments = useMemo(() => {
  let result = filteredComments; // ya sorted + searched
  if (filterBusiness) {
    result = result.filter((c) => c.comment.businessId === filterBusiness.id);
  }
  return result;
}, [filteredComments, filterBusiness]);
```

**Archivo:** `CommentsList.tsx`

---

### #107 Stats Resumen

Card colapsable con metricas client-side.

```typescript
const [statsExpanded, setStatsExpanded] = useState(false);

const stats = useMemo(() => {
  if (comments.length === 0) return null;
  const totalLikes = comments.reduce((sum, c) => sum + c.comment.likeCount, 0);
  const avgLikes = comments.length > 0 ? totalLikes / comments.length : 0;
  const mostPopular = comments.reduce(
    (best, c) =>
      c.comment.likeCount > (best?.comment.likeCount ?? 0) ? c : best,
    comments[0],
  );
  return { total: comments.length, totalLikes, avgLikes, mostPopular };
}, [comments]);
```

**UI:**

```tsx
{stats && (
  <Box sx={{ mx: 2, mb: 1 }}>
    <Box
      role="button"
      tabIndex={0}
      aria-expanded={statsExpanded}
      aria-label="Resumen de comentarios"
      onClick={() => setStatsExpanded(!statsExpanded)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          setStatsExpanded(!statsExpanded);
        }
      }}
      sx={{
        display: 'flex',
        alignItems: 'center',
        cursor: 'pointer',
        py: 0.5,
      }}
    >
      <Typography variant="caption" color="text.secondary" sx={{ flex: 1 }}>
        Resumen
      </Typography>
      {statsExpanded ? (
        <ExpandLessIcon fontSize="small" color="action" />
      ) : (
        <ExpandMoreIcon fontSize="small" color="action" />
      )}
    </Box>
    <Collapse in={statsExpanded}>
      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, pb: 1 }}>
        <Box>
          <Typography variant="caption" color="text.secondary">Comentarios</Typography>
          <Typography variant="body2" fontWeight={600}>{stats.total}</Typography>
        </Box>
        <Box>
          <Typography variant="caption" color="text.secondary">Likes recibidos</Typography>
          <Typography variant="body2" fontWeight={600}>{stats.totalLikes}</Typography>
        </Box>
        <Box>
          <Typography variant="caption" color="text.secondary">Promedio likes</Typography>
          <Typography variant="body2" fontWeight={600}>{stats.avgLikes.toFixed(1)}</Typography>
        </Box>
        <Box>
          <Typography variant="caption" color="text.secondary">Mas popular</Typography>
          <Typography variant="body2" fontWeight={600}>
            {truncate(stats.mostPopular?.business?.name ?? '—', 20)}
          </Typography>
        </Box>
      </Box>
    </Collapse>
  </Box>
)}
```

**Archivo:** `CommentsList.tsx`

---

### #105 Indicador de Respuestas

Ya resuelto en #108 (badge `replyCount`). Sin trabajo adicional.

---

## Fase 3

### #109 Swipe Actions (Mobile)

**Hook nuevo:** `src/hooks/useSwipeActions.ts`

```typescript
interface UseSwipeActionsOptions {
  threshold?: number; // default 80px
  onSwipeLeft?: (id: string) => void;
  onSwipeRight?: (id: string) => void;
}

interface SwipeHandlers {
  onTouchStart: (e: React.TouchEvent) => void;
  onTouchMove: (e: React.TouchEvent) => void;
  onTouchEnd: () => void;
}

interface UseSwipeActionsReturn {
  swipedId: string | null;
  getHandlers: (id: string) => SwipeHandlers;
  resetSwipe: () => void;
  getTransform: (id: string) => React.CSSProperties;
}
```

**Comportamiento:**

- Swipe left (>80px) → revelar boton eliminar (rojo)
- Swipe right (>80px) → revelar boton editar (azul)
- Solo en `pointer: coarse` (touch devices)
- Threshold vertical >10px cancela swipe (no interferir con scroll)
- Cerrar al tocar otro item o al scrollear
- `transform: translateX()` con CSS transition
- **Fallback accesible:** botones editar/eliminar siempre visibles como IconButtons (no depender de swipe)

**Archivo:** nuevo `src/hooks/useSwipeActions.ts`, `CommentsList.tsx`

---

## Pipeline de datos final

```text
usePaginatedQuery (Firestore, constraints, createdAt desc)
  → rawItems: Comment[]
  → map to { comment, business } via allBusinesses.find()
  → exclude pendingDelete IDs (useUndoDelete)
  → sortedComments (useMemo, sortMode)           // #103
  → filteredBySearch (useMemo, deferredSearch)    // #102
  → filteredByBusiness (useMemo, filterBusiness)  // #101
  → finalComments → PaginatedListShell → render
```

---

## Layout del componente

```text
+-------------------------------+
| Stats resumen (colapsable)    | #107
+-------------------------------+
| [Recientes] [Antiguos] [...]  | #103 (>= 3 items)
+-------------------------------+
| Buscar comentarios...         | #102 (>= 3 items)
+-------------------------------+
| Filtrar por comercio v        | #101
+-------------------------------+
| N resultados                  | aria-live
+-------------------------------+
| +---------------------------+ |
| | Nombre Comercio      E  D | |
| | Texto del comentario...   | | #108 + #104
| | hace 2h (editado) L3 R2  | |
| +---------------------------+ |
+-------------------------------+
|        [Cargar mas]           | PaginatedListShell
+-------------------------------+
| Snackbar: "Eliminado" [Undo] | useUndoDelete
+-------------------------------+
```

---

## Orden de implementacion detallado

### Pre-requisitos

1. DT-2: `truncate` → `src/utils/text.ts`
2. DT-3: Dark mode (27 reemplazos, 13 archivos)
3. DT-1: `useUndoDelete` hook + adopcion en 2 componentes

### Fase 1

1. #110: Skeleton loader
2. #111: Empty state
3. #108 + #104: Preview + likes
4. #103: Sorting chips
5. #102: Busqueda

### Fase 2

1. DT-5: `usePaginatedQuery` constraints (primero — DT-6 depende)
2. DT-6: `PaginatedListShell` (depende de DT-5)
3. DT-4: `CommentRow` extraction
4. #106: Edit inline
5. #101: Filtro por comercio
6. #107: Stats resumen

### Fase 3

1. #109: Swipe actions

---

## Actualizaciones de plataforma

### Seccion de Ayuda

**Archivo:** `src/components/menu/HelpSection.tsx`

Agregar entradas en la seccion correspondiente:

- Busqueda de comentarios (texto + nombre comercio)
- Ordenamiento (recientes, antiguos, mas likes)
- Edicion inline desde el menu
- Filtro por comercio
- Stats resumen
- Swipe actions (mobile)

Validar con `help-docs-reviewer` agent post-implementacion.

### Politica de Privacidad

**N/A.** Sin datos nuevos recopilados.

### Seed Data

**Archivo:** `scripts/seed-admin-data.mjs`

Verificar/agregar en comments de seed:

- Algunos con `updatedAt` (para "(editado)")
- Algunos con `replyCount > 0`
- `likeCount` variado (0, 1, 5, 10+)
- Algunos con `parentId` (replies)

Validar con `seed-manager` agent.

### Panel Admin

**N/A.** Sin metricas ni datos nuevos para el admin. Validar con `admin-metrics-auditor` agent.

---

## Testing

| Item | Tipo | Que verificar |
|------|------|---------------|
| `useUndoDelete` | Unit | timer, cleanup en unmount, undo, multiple deletes |
| `truncate` | Unit | edge cases (empty, exact length, over) |
| Sorting | Unit | 3 modos sobre array de Comments |
| Filtering | Unit | busqueda por texto y nombre, filtro por business |
| `PaginatedListShell` | Render | 5 estados (loading, error, empty, no results, content) |
| `CommentRow` | Render | own vs other, editing, liked, reply count |
| `usePaginatedQuery` | Unit | actualizar 9 tests con nueva firma |
| Edit inline | Integration | start edit, save, cancel, error handling |
| Dark mode | Grep | zero `#hex` en archivos impactados |
| Skeleton | Render | muestra 5 skeletons durante loading |
| Busqueda | Integration | cargar todos, filtrar, limpiar, aria-live |
