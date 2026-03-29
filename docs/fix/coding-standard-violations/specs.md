# Specs: 3 coding standard violations (large components, noop callbacks, layer breach)

**PRD:** [prd.md](prd.md)
**Fecha:** 2026-03-29

---

## Modelo de datos

No se agregan ni modifican colecciones, campos, ni tipos de Firestore. Este fix es puramente de refactorizacion interna del frontend.

## Firestore Rules

No se modifican reglas. No hay queries nuevas ni cambios en patrones de acceso.

### Rules impact analysis

No aplica. No se agregan queries nuevas.

### Field whitelist check

No aplica. No se agregan ni modifican campos en servicios.

## Cloud Functions

No aplica. No se agregan ni modifican Cloud Functions.

## Componentes

### S2a. CommentRow: props de edicion opcionales

**Archivo:** `src/components/business/CommentRow.tsx`

Cambio en la interfaz `CommentRowProps`:

```typescript
// ANTES (todas requeridas)
export interface CommentRowProps {
  // ...
  isEditing: boolean;
  editText: string;
  isSavingEdit: boolean;
  onStartEdit: (comment: Comment) => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onEditTextChange: (text: string) => void;
  // ...
}

// DESPUES (opcionales)
export interface CommentRowProps {
  // ...
  isEditing?: boolean;
  editText?: string;
  isSavingEdit?: boolean;
  onStartEdit?: (comment: Comment) => void;
  onSaveEdit?: () => void;
  onCancelEdit?: () => void;
  onEditTextChange?: (text: string) => void;
  // ...
}
```

Comportamiento condicional dentro de `CommentRow`:

1. El bloque de edicion inline (TextField + Save/Cancel) solo se renderiza si `isEditing` es `true` (ya lo hace, pero ahora `isEditing` defaultea a `false` cuando no se pasa).
2. El boton de edicion (EditOutlinedIcon) solo se renderiza si `isOwn && !isEditing && onStartEdit` esta definido. Actualmente solo chequea `isOwn && !isEditing`.
3. Lineas afectadas: la condicion en linea 215 (`{isOwn && !isEditing && (`) debe agregar `&& onStartEdit`.

### S2b. BusinessQuestions: eliminar noops

**Archivo:** `src/components/business/BusinessQuestions.tsx`

1. Eliminar las lineas 139-140 (`noopEdit` y `noopEditText`).
2. Remover las 5 props de edicion de cada invocacion de `CommentRow` en el archivo (lineas 218-225 y 285-291): `isEditing`, `editText`, `isSavingEdit`, `onStartEdit`, `onSaveEdit`, `onCancelEdit`, `onEditTextChange`.

### S3. FollowedList: eliminar import de firebase/firestore

**Archivo:** `src/components/social/FollowedList.tsx`

El tipo `QueryDocumentSnapshot` (linea 15) se usa para tipar el cursor `lastDoc` (linea 32). La solucion es cambiar el servicio `fetchFollowing` para que retorne un cursor opaco en vez de exponer el `QueryDocumentSnapshot` al componente.

Cambios en `src/services/follows.ts`:

```typescript
// Nuevo tipo opaco exportado
export type FollowCursor = QueryDocumentSnapshot<Follow>;

// fetchFollowing retorna FollowCursor en vez de exponer QDS
export async function fetchFollowing(
  userId: string,
  pageSize?: number,
  afterDoc?: FollowCursor,
): Promise<{ docs: QueryDocumentSnapshot<Follow>[]; hasMore: boolean; cursor: FollowCursor | null }> {
  // ... logica existente ...
  return { docs, hasMore, cursor: docs[docs.length - 1] ?? null };
}
```

Cambios en `FollowedList.tsx`:

```typescript
// ANTES
import type { QueryDocumentSnapshot } from 'firebase/firestore';
const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot<Follow> | null>(null);

// DESPUES
import type { FollowCursor } from '../../services/follows';
const [lastDoc, setLastDoc] = useState<FollowCursor | null>(null);
```

Tambien aplicar el mismo patron a `fetchFollowers` por consistencia, ya que exporta la misma firma.

### S1. Extraer CommentThreadList de BusinessComments

**Archivo nuevo:** `src/components/business/CommentThreadList.tsx` (~120 lineas)

Subcomponente que encapsula el loop de renderizado de comentarios (lineas 258-375 de BusinessComments). Recibe:

```typescript
interface CommentThreadListProps {
  comments: Comment[];                    // sortedTopLevel
  repliesByParent: Map<string, Comment[]>;
  expandedThreads: Set<string>;
  replyingTo: { id: string; userName: string } | null;
  replyText: string;
  replyInputRef: React.RefObject<HTMLInputElement | null>;
  editingId: string | null;
  editText: string;
  isSavingEdit: boolean;
  isSubmitting: boolean;
  userCommentsToday: number;
  user: { uid: string } | null;
  profileVisibility: Map<string, boolean>;
  isPendingDelete: (id: string) => boolean;
  isLiked: (id: string) => boolean;
  getLikeCount: (comment: Comment) => number;
  getReplyCount: (comment: Comment) => number;
  onToggleLike: (commentId: string) => void;
  onStartEdit: (comment: Comment) => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onEditTextChange: (text: string) => void;
  onDelete: (comment: Comment) => void;
  onStartReply: (comment: Comment) => void;
  onCancelReply: () => void;
  onSubmitReply: () => void;
  onToggleThread: (commentId: string) => void;
  setReplyText: (text: string) => void;
  onShowProfile: (userId: string, userName: string) => void;
}
```

Este componente renderiza: el `<List>` con cada `CommentRow`, el thread expand/collapse, el formulario inline de respuesta, y el mensaje "Se el primero en comentar".

### S2c. Extraer QuestionThread de BusinessQuestions

**Archivo nuevo:** `src/components/business/QuestionThread.tsx` (~100 lineas)

Subcomponente que encapsula el rendering de una pregunta con sus respuestas (lineas 211-367 de BusinessQuestions). Recibe:

```typescript
interface QuestionThreadProps {
  question: Comment;
  answers: Comment[];
  isExpanded: boolean;
  isLast: boolean;
  replyingTo: { id: string; userName: string } | null;
  replyText: string;
  replyInputRef: React.RefObject<HTMLInputElement | null>;
  isSubmitting: boolean;
  userCommentsToday: number;
  user: { uid: string } | null;
  profileVisibility: Map<string, boolean>;
  isPendingDelete: (id: string) => boolean;
  isLiked: (id: string) => boolean;
  getLikeCount: (comment: Comment) => number;
  answerCount: number;
  onToggleLike: (commentId: string) => void;
  onDelete: (comment: Comment) => void;
  onStartReply: (comment: Comment) => void;
  onCancelReply: () => void;
  onSubmitReply: () => void;
  onToggleQuestion: (questionId: string) => void;
  setReplyText: (text: string) => void;
  onShowProfile: (userId: string, userName: string) => void;
}
```

### Mutable prop audit

No aplica. Ningun componente en este fix recibe datos que el usuario modifica. Los subcomponentes extraidos son de display + delegacion de callbacks al parent.

## Textos de usuario

No se agregan textos nuevos. Todos los textos existentes se mantienen sin cambios.

## Hooks

No se agregan ni modifican hooks. La logica que se extrae va a subcomponentes de rendering, no a hooks.

## Servicios

### Modificacion: `src/services/follows.ts`

1. Exportar tipo opaco `FollowCursor` (alias de `QueryDocumentSnapshot<Follow>`).
2. Agregar campo `cursor` al retorno de `fetchFollowing` y `fetchFollowers`.
3. No cambia logica de negocio ni queries.

## Integracion

### BusinessComments.tsx

- El loop de rendering (lineas 258-375) se reemplaza por `<CommentThreadList ... />`.
- Todos los handlers y state se pasan como props al nuevo subcomponente.
- Se mantiene la logica de sort, edit, dirty detection, y submit en el archivo principal.

### BusinessQuestions.tsx

- El loop de rendering (lineas 204-367) se reemplaza por un `.map()` que renderiza `<QuestionThread ... />`.
- Se eliminan `noopEdit` y `noopEditText` (lineas 139-140).
- Se remueven las props de edicion de todas las invocaciones de `CommentRow`.

### FollowedList.tsx

- Se reemplaza `import type { QueryDocumentSnapshot } from 'firebase/firestore'` por `import type { FollowCursor } from '../../services/follows'`.
- Se actualiza el tipo de `lastDoc` state.
- Se usa `result.cursor` en vez de `result.docs[result.docs.length - 1]`.

### Preventive checklist

- [x] **Service layer**: Ninguno de los componentes nuevos importa `firebase/firestore` para writes. FollowedList deja de importar de `firebase/firestore`.
- [x] **Duplicated constants**: No se definen constantes nuevas. Se reutilizan las existentes.
- [x] **Context-first data**: No se agregan getDoc en componentes. Los subcomponentes reciben datos por props.
- [x] **Silent .catch**: No se agrega ningun `.catch()`. Se eliminan los noop callbacks.
- [x] **Stale props**: Los subcomponentes extraidos no mutan datos; solo delegando callbacks al parent.

## Tests

### Archivos existentes

No hay tests existentes para CommentRow, BusinessComments, BusinessQuestions, ni FollowedList.

### Tests nuevos

| Archivo test | Que testear | Tipo |
|-------------|-------------|------|
| `src/components/business/__tests__/CommentRow.test.tsx` | (1) Renderiza correctamente con props de edicion completas. (2) Renderiza correctamente SIN props de edicion (no muestra boton editar, no muestra TextField inline). (3) Boton editar solo visible cuando `isOwn && onStartEdit` definido. (4) Boton delete siempre visible para `isOwn`. | Componente |
| `src/components/business/__tests__/CommentThreadList.test.tsx` | (1) Renderiza lista de comentarios. (2) Muestra/oculta thread al togglear. (3) Muestra formulario de respuesta cuando `replyingTo` coincide. (4) Muestra mensaje vacio cuando no hay comentarios. | Componente |
| `src/components/business/__tests__/QuestionThread.test.tsx` | (1) Renderiza pregunta con boton de respuestas. (2) Expande/colapsa respuestas. (3) Muestra chip "Mejor respuesta" para answers con suficientes likes. (4) No renderiza boton editar en CommentRow. | Componente |

### Mock strategy

- Mock `useAuth`, `useToast`, `useConnectivity` para tests de subcomponentes.
- Mock `formatDateMedium` para determinismo en snapshots.
- Los subcomponentes reciben todo por props, minimizando necesidad de mocks de servicios.

### Criterio de aceptacion

- Cobertura >= 80% del codigo nuevo (CommentThreadList, QuestionThread).
- CommentRow cubierto en ambos paths: con y sin props de edicion.
- Todos los paths condicionales nuevos cubiertos.

## Analytics

No se agregan ni modifican eventos de analytics.

---

## Offline

No aplica. Este fix es puramente de refactorizacion. No se agregan data flows nuevos.

### Cache strategy

| Dato | Estrategia | TTL | Storage |
|------|-----------|-----|---------|
| N/A | N/A | N/A | N/A |

### Writes offline

| Operacion | Mecanismo | Conflict resolution |
|-----------|-----------|-------------------|
| N/A | N/A | N/A |

### Fallback UI

No aplica.

---

## Decisiones tecnicas

1. **Props opcionales vs prop `editMode` booleana**: Se opta por hacer las 7 props de edicion opcionales individualmente en vez de un unico booleano `editMode` porque: (a) no requiere cambiar la firma en BusinessComments que ya pasa las props, (b) permite a CommentRow ser mas granular si en el futuro se quiere habilitar edicion solo parcialmente, (c) es el cambio minimo necesario.

2. **Cursor opaco vs re-export de tipo**: Se opta por el tipo opaco `FollowCursor` exportado desde el servicio en vez de re-exportar `QueryDocumentSnapshot` desde `types/` porque: (a) el componente no necesita saber que internamente es un QDS de Firestore, (b) si en el futuro se cambia el mecanismo de paginacion, el componente no se afecta, (c) sigue el patron de service layer del proyecto.

3. **CommentThreadList vs solo extraer InlineReplyForm**: Se extrae el loop completo porque la reduccion de lineas necesaria (~150) no se logra extrayendo solo el formulario de reply (~50 lineas). El loop + thread expansion + reply form juntos conforman una unidad logica coherente.

---

## Hardening de seguridad

No aplica. Este fix no introduce superficies nuevas de seguridad. No se agregan colecciones, endpoints, ni Cloud Functions.

### Firestore rules requeridas

Ninguna.

### Rate limiting

No aplica.

### Vectores de ataque mitigados

No aplica.

---

## Deuda tecnica: mitigacion incorporada

| Issue | Que se resuelve | Paso del plan |
|-------|----------------|---------------|
| #227 (coding standard violations) | Las 3 violaciones: file size, noop callbacks, layer breach | Todas las fases |
| #195 (split-large-components) | Completar la reduccion de BusinessComments y BusinessQuestions por debajo de 300 lineas | Fases 2 y 3 |

---

## Estimacion de archivos

| Archivo | Lineas actuales | Lineas estimadas post-refactor | Accion |
|---------|----------------|-------------------------------|--------|
| `CommentRow.tsx` | 239 | ~245 (+6 por guards opcionales) | OK |
| `BusinessComments.tsx` | 398 | ~250 (extrae ~150 al subcomponente) | OK, debajo de 300 |
| `BusinessQuestions.tsx` | 392 | ~240 (elimina noops -2, extrae ~150 al subcomponente) | OK, debajo de 300 |
| `FollowedList.tsx` | 135 | ~135 (cambio de import, misma cantidad) | OK |
| `CommentThreadList.tsx` (nuevo) | 0 | ~130 | OK |
| `QuestionThread.tsx` (nuevo) | 0 | ~110 | OK |
| `follows.ts` (servicio) | 101 | ~108 (+tipo + campo cursor) | OK |
