# Technical Specs — Comentarios 2.0 + Compartir comercio

**Issues:** #45, #46, cierra #17

---

## 1. Tipos

### `src/types/index.ts`

```typescript
// Modificar Comment existente:
export interface Comment {
  id: string;
  userId: string;
  userName: string;
  businessId: string;
  text: string;
  createdAt: Date;
  updatedAt?: Date;       // NUEVO — fecha de última edición
  likeCount: number;       // NUEVO — contador de likes (default 0)
  flagged?: boolean;
}

// Nuevo tipo:
export interface CommentLike {
  userId: string;
  commentId: string;
  createdAt: Date;
}
```

---

## 2. Colección Firestore

### `src/config/collections.ts`

```typescript
export const COLLECTIONS = {
  // ... existentes ...
  COMMENT_LIKES: 'commentLikes',   // NUEVO
} as const;
```

### Doc ID pattern

`commentLikes/{userId}__{commentId}` — misma convención que favorites/ratings.

---

## 3. Converter

### `src/config/converters.ts`

Modificar `commentConverter` para incluir `updatedAt` y `likeCount`:

```typescript
fromFirestore(snapshot, options): Comment {
  const d = snapshot.data(options);
  return {
    id: snapshot.id,
    userId: d.userId,
    userName: d.userName,
    businessId: d.businessId,
    text: d.text,
    createdAt: toDate(d.createdAt),
    likeCount: (d.likeCount as number) ?? 0,
    ...(d.updatedAt ? { updatedAt: toDate(d.updatedAt) } : {}),
    ...(d.flagged === true ? { flagged: true } : {}),
  };
}
```

Nuevo `commentLikeConverter`:

```typescript
export const commentLikeConverter: FirestoreDataConverter<CommentLike> = {
  toFirestore(like: CommentLike) {
    return { userId: like.userId, commentId: like.commentId, createdAt: like.createdAt };
  },
  fromFirestore(snapshot, options): CommentLike {
    const d = snapshot.data(options);
    return { userId: d.userId, commentId: d.commentId, createdAt: toDate(d.createdAt) };
  },
};
```

---

## 4. Service layer

### `src/services/comments.ts` — funciones nuevas

```typescript
// Editar comentario propio
export async function editComment(commentId: string, userId: string, newText: string): Promise<void> {
  const trimmed = newText.trim();
  if (!trimmed || trimmed.length > 500) {
    throw new Error('Comment text must be 1-500 characters');
  }
  await updateDoc(doc(db, COLLECTIONS.COMMENTS, commentId), {
    text: trimmed,
    updatedAt: serverTimestamp(),
  });
  invalidateQueryCache(COLLECTIONS.COMMENTS, userId);
}

// Dar like a un comentario
export async function likeComment(userId: string, commentId: string): Promise<void> {
  const docId = `${userId}__${commentId}`;
  await setDoc(doc(db, COLLECTIONS.COMMENT_LIKES, docId), {
    userId,
    commentId,
    createdAt: serverTimestamp(),
  });
}

// Quitar like
export async function unlikeComment(userId: string, commentId: string): Promise<void> {
  const docId = `${userId}__${commentId}`;
  await deleteDoc(doc(db, COLLECTIONS.COMMENT_LIKES, docId));
}
```

---

## 5. Firestore rules

### Comments — agregar `update`

```text
match /comments/{docId} {
  allow read: if request.auth != null;
  allow create: if request.auth != null
    && request.resource.data.userId == request.auth.uid
    && isValidBusinessId(request.resource.data.businessId)
    && request.resource.data.userName.size() > 0
    && request.resource.data.userName.size() <= 30
    && request.resource.data.text.size() > 0
    && request.resource.data.text.size() <= 500
    && request.resource.data.createdAt == request.time;
  allow update: if request.auth != null
    && resource.data.userId == request.auth.uid
    && request.resource.data.text.size() > 0
    && request.resource.data.text.size() <= 500
    && request.resource.data.updatedAt == request.time
    // No permitir cambiar userId, businessId, userName, createdAt
    && request.resource.data.userId == resource.data.userId
    && request.resource.data.businessId == resource.data.businessId
    && request.resource.data.userName == resource.data.userName
    && request.resource.data.createdAt == resource.data.createdAt;
  allow delete: if request.auth != null
    && resource.data.userId == request.auth.uid;
}
```

### commentLikes — nueva colección

```text
match /commentLikes/{docId} {
  allow read: if request.auth != null;
  allow create: if request.auth != null
    && request.resource.data.userId == request.auth.uid
    && request.resource.data.commentId is string
    && request.resource.data.commentId.size() > 0
    && request.resource.data.createdAt == request.time;
  allow delete: if request.auth != null
    && resource.data.userId == request.auth.uid;
}
```

---

## 6. Cloud Functions

### `functions/src/triggers/comments.ts` — agregar onUpdate

```typescript
export const onCommentUpdated = onDocumentUpdated(
  'comments/{commentId}',
  async (event) => {
    const db = getFirestore();
    const after = event.data?.after;
    if (!after) return;

    const data = after.data();
    const before = event.data?.before.data();

    // Solo re-moderar si el texto cambió
    if (before && data.text !== before.text) {
      const flagged = await checkModeration(db, data.text as string);
      if (flagged && !data.flagged) {
        await after.ref.update({ flagged: true });
        await logAbuse(db, {
          userId: data.userId as string,
          type: 'flagged',
          collection: 'comments',
          detail: `Flagged edited text: "${(data.text as string).slice(0, 100)}"`,
        });
      }
      // Si antes estaba flagged y ahora el texto es limpio, quitar flag
      if (!flagged && data.flagged) {
        await after.ref.update({ flagged: false });
      }
    }
  },
);
```

### `functions/src/triggers/commentLikes.ts` — nuevo

```typescript
export const onCommentLikeCreated = onDocumentCreated(
  'commentLikes/{docId}',
  async (event) => {
    const db = getFirestore();
    const data = event.data?.data();
    if (!data) return;

    const userId = data.userId as string;

    // Rate limit: 50 likes/day
    const exceeded = await checkRateLimit(db, {
      collection: 'commentLikes',
      limit: 50,
      windowType: 'daily',
    }, userId);

    if (exceeded) {
      await event.data!.ref.delete();
      return;
    }

    // Incrementar likeCount en el comentario
    const commentId = data.commentId as string;
    await db.doc(`comments/${commentId}`).update({
      likeCount: FieldValue.increment(1),
    });

    await incrementCounter(db, 'commentLikes', 1);
    await trackWrite(db, 'commentLikes');
  },
);

export const onCommentLikeDeleted = onDocumentDeleted(
  'commentLikes/{docId}',
  async (event) => {
    const db = getFirestore();
    const data = event.data?.data();
    if (!data) return;

    const commentId = data.commentId as string;
    await db.doc(`comments/${commentId}`).update({
      likeCount: FieldValue.increment(-1),
    });

    await incrementCounter(db, 'commentLikes', -1);
    await trackDelete(db, 'commentLikes');
  },
);
```

---

## 7. Hook `useBusinessData` — cargar likes

Agregar al `UseBusinessDataReturn`:

```typescript
interface UseBusinessDataReturn {
  // ... existentes ...
  userCommentLikes: Set<string>;  // NUEVO — set de commentIds que el usuario likeó
}
```

En `fetchBusinessData`, agregar una 6ta query:

```typescript
// Junto a las otras 5 queries en Promise.all:
getDocs(query(
  collection(db, COLLECTIONS.COMMENT_LIKES).withConverter(commentLikeConverter),
  where('userId', '==', uid),
  // No filtrar por businessId — los likes son por commentId
  // Filtramos client-side por los commentIds del business
))
```

**Alternativa más eficiente** (para no traer todos los likes del usuario): Después de obtener los comments, hacer queries individuales por cada commentId del usuario:

```typescript
// Mejor: query los likes del usuario para los comments de este business
const commentIds = commentsResult.map(c => c.id);
const likeChecks = commentIds.map(cId =>
  getDoc(doc(db, COLLECTIONS.COMMENT_LIKES, `${uid}__${cId}`))
);
const likeSnaps = await Promise.all(likeChecks);
const userCommentLikes = new Set(
  likeSnaps.filter(s => s.exists()).map((s, i) => commentIds[i])
);
```

**Nota:** Esto es O(N) getDoc calls donde N = número de comentarios del business. Para la mayoría de comercios (< 20 comments) es aceptable. Si escala, migrar a una single query con `where('commentId', 'in', commentIds)` (max 30 por query).

---

## 8. Componente `BusinessComments.tsx` — cambios

### Props actualizado

```typescript
interface Props {
  businessId: string;
  comments: Comment[];
  userCommentLikes: Set<string>;   // NUEVO
  isLoading: boolean;
  onCommentsChange: () => void;
}
```

### Estado interno nuevo

```typescript
// Edición
const [editingId, setEditingId] = useState<string | null>(null);
const [editText, setEditText] = useState('');

// Undo delete
const [pendingDelete, setPendingDelete] = useState<Comment | null>(null);
// Timer ref para auto-confirmar delete
const deleteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

// Ordenamiento
type SortMode = 'recent' | 'oldest' | 'useful';
const [sortMode, setSortMode] = useState<SortMode>('recent');

// Likes optimistic
const [optimisticLikes, setOptimisticLikes] = useState<Map<string, number>>(new Map());
const [optimisticUserLikes, setOptimisticUserLikes] = useState<Set<string>>(new Set());
```

### Ordenamiento (client-side)

```typescript
const sortedComments = useMemo(() => {
  // Filtrar el comentario pending delete
  const visible = pendingDelete
    ? comments.filter(c => c.id !== pendingDelete.id)
    : comments;

  return [...visible].sort((a, b) => {
    switch (sortMode) {
      case 'recent': return b.createdAt.getTime() - a.createdAt.getTime();
      case 'oldest': return a.createdAt.getTime() - b.createdAt.getTime();
      case 'useful': return (b.likeCount ?? 0) - (a.likeCount ?? 0);
    }
  });
}, [comments, sortMode, pendingDelete]);
```

### Flujo de edición inline

1. Click en lápiz → `setEditingId(comment.id)`, `setEditText(comment.text)`
2. Render: si `editingId === comment.id`, mostrar TextField + Save/Cancel
3. Save → `editComment(commentId, userId, editText)` → `onCommentsChange()`
4. Cancel → `setEditingId(null)`

### Flujo de undo delete

1. Click en delete → `setPendingDelete(comment)` (no dialog)
2. Comentario desaparece de la lista (filtrado en `sortedComments`)
3. Snackbar con "Comentario eliminado" + botón "Deshacer" (5s)
4. Si Deshacer → `setPendingDelete(null)` (reaparece)
5. Si timeout → `deleteComment(id, userId)` → `onCommentsChange()` → `setPendingDelete(null)`

### Flujo de like

1. Click en corazón → optimistic toggle en `optimisticUserLikes` y `optimisticLikes`
2. Call `likeComment()` o `unlikeComment()`
3. No necesita refetch — el Cloud Function actualiza `likeCount` server-side, pero UI ya refleja el cambio optimista

---

## 9. Componente `BusinessHeader.tsx` — botón compartir

### Props actualizado

```typescript
interface Props {
  business: Business;
  favoriteButton: ReactNode;
  shareButton: ReactNode;   // NUEVO
}
```

### Componente `ShareButton`

Nuevo archivo `src/components/business/ShareButton.tsx`:

```typescript
interface Props {
  business: Business;
}

export default function ShareButton({ business }: Props) {
  const [snackOpen, setSnackOpen] = useState(false);

  const handleShare = async () => {
    const url = `${window.location.origin}/?business=${business.id}`;
    const text = `Mirá ${business.name} en Modo Mapa — ${business.address}`;

    if (navigator.share) {
      await navigator.share({ title: business.name, text, url });
    } else {
      await navigator.clipboard.writeText(url);
      setSnackOpen(true);
    }
  };

  return (
    <>
      <IconButton onClick={handleShare} aria-label="Compartir comercio">
        <ShareIcon />
      </IconButton>
      <Snackbar open={snackOpen} autoHideDuration={3000}
        onClose={() => setSnackOpen(false)} message="Link copiado" />
    </>
  );
}
```

---

## 10. Deep link — `AppShell.tsx`

Al montar, leer `?business=` de la URL y seleccionar el comercio:

```typescript
import { useSearchParams } from 'react-router-dom';
import { allBusinesses } from '../hooks/useBusinesses';

export default function AppShell() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { setSelectedBusiness } = useMapContext();

  useEffect(() => {
    const bizId = searchParams.get('business');
    if (bizId) {
      const biz = allBusinesses.find(b => b.id === bizId);
      if (biz) {
        setSelectedBusiness(biz);
        // Limpiar query param para no re-abrir en cada render
        searchParams.delete('business');
        setSearchParams(searchParams, { replace: true });
      }
    }
  }, []); // solo al montar
```

---

## 11. `CommentsList.tsx` — undo delete

Mismo patrón de undo que `BusinessComments`:

- Reemplazar dialog de confirmación por pendingDelete + Snackbar
- Timer de 5s para auto-confirmar

---

## 12. Firestore indexes

No se necesitan índices nuevos compuestos. La query de commentLikes usa doc ID directo (`getDoc`), no query compuesta.

---

## 13. Resumen de archivos

| Archivo | Acción |
|---------|--------|
| `src/types/index.ts` | Modificar Comment, agregar CommentLike |
| `src/config/collections.ts` | Agregar COMMENT_LIKES |
| `src/config/converters.ts` | Modificar commentConverter, agregar commentLikeConverter |
| `src/services/comments.ts` | Agregar editComment, likeComment, unlikeComment |
| `src/hooks/useBusinessData.ts` | Agregar userCommentLikes al return, 6ta query |
| `src/hooks/useBusinessDataCache.ts` | Agregar userCommentLikes al tipo cache |
| `src/components/business/BusinessComments.tsx` | Edit inline, likes, sort, undo delete |
| `src/components/business/BusinessHeader.tsx` | Agregar prop shareButton |
| `src/components/business/BusinessSheet.tsx` | Pasar userCommentLikes + ShareButton |
| `src/components/business/ShareButton.tsx` | Nuevo componente |
| `src/components/menu/CommentsList.tsx` | Undo delete |
| `src/components/layout/AppShell.tsx` | Deep link ?business= |
| `firestore.rules` | Update rule para comments, nueva colección commentLikes |
| `functions/src/triggers/comments.ts` | Agregar onCommentUpdated |
| `functions/src/triggers/commentLikes.ts` | Nuevo: onCreate + onDeleted |
| `functions/src/index.ts` | Exportar nuevos triggers |
