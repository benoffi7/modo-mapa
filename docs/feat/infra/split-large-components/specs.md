# Specs: Split large components

**PRD:** [prd.md](prd.md)
**Fecha:** 2026-03-27

---

## Modelo de datos

No hay cambios en el modelo de datos de Firestore. Este refactoring es puramente interno: extrae logica de componentes existentes a hooks y subcomponentes sin modificar queries, escrituras ni estructura de datos.

## Firestore Rules

Sin cambios. Todas las queries existentes siguen funcionando identicas.

### Rules impact analysis

| Query (service file) | Collection | Auth context | Rule that allows it | Change needed? |
|---------------------|------------|-------------|-------------------|----------------|
| N/A | N/A | N/A | N/A | No |

No se introducen queries nuevas. Los hooks extraidos reutilizan los mismos service calls que ya existen en los componentes.

## Cloud Functions

Sin cambios.

## Componentes

### QuestionInput (nuevo)

- **Archivo:** `src/components/business/QuestionInput.tsx`
- **Props:**

```typescript
interface QuestionInputProps {
  userCommentsToday: number;
  isSubmitting: boolean;
  onSubmit: (text: string) => void;
}
```

- **Donde se renderiza:** `BusinessQuestions`, reemplaza el bloque inline de TextField + IconButton + Alert (lineas 274-314 actuales).
- **Comportamiento:** Analogo a `CommentInput` pero con icono `HelpOutline`, placeholder "Hace una pregunta...", `MAX_QUESTION_LENGTH` y sin prop `onTextChange`. Muestra Alert cuando `userCommentsToday >= MAX_COMMENTS_PER_DAY`. Maneja estado de texto internamente.
- **Patron:** `memo` wrapper, igual que `CommentInput`.

### AccountSection (nuevo)

- **Archivo:** `src/components/menu/AccountSection.tsx`
- **Props:**

```typescript
interface AccountSectionProps {
  authMethod: 'anonymous' | 'email' | 'google';
  emailVerified: boolean;
  userEmail: string | null;
  onSignOut: () => Promise<void>;
  onResendVerification: () => Promise<void>;
  onRefreshVerified: () => Promise<void>;
}
```

- **Donde se renderiza:** `SettingsPanel`, reemplaza todo el bloque "Cuenta" (lineas 128-221 actuales).
- **Comportamiento:** Contiene la logica de anonymous CTA, email display, verification chip, resend button con cooldown (via `useVerificationCooldown`), change password button, logout dialog, delete account button. Lazy-loads `EmailPasswordDialog`, `ChangePasswordDialog`, `DeleteAccountDialog`. Contiene los 6 estados de dialog internos.

### NotificationsSection (nuevo)

- **Archivo:** `src/components/menu/NotificationsSection.tsx`
- **Props:**

```typescript
interface NotificationsSectionProps {
  settings: UserSettings;
  onUpdateSetting: (key: BooleanSettingKey, value: boolean) => void;
}
```

- **Donde se renderiza:** `SettingsPanel`, reemplaza el bloque "Notificaciones" (lineas 253-311 actuales).
- **Comportamiento:** Master toggle + 7 toggles granulares con cascading disabled. Usa `SettingRow` importado.

### SettingRow (extraido a archivo propio)

- **Archivo:** `src/components/menu/SettingRow.tsx`
- **Props:** Sin cambios respecto a la interfaz `SettingRowProps` actual (lineas 26-33 de SettingsPanel.tsx).
- **Donde se renderiza:** `NotificationsSection`, `SettingsPanel` (secciones Privacy, Analytics, Apariencia).

### Componentes modificados

- **BusinessComments:** Queda como orquestador (~200 lineas). Importa `useCommentSort`, `useOptimisticLikes`, `useCommentThreads`, `useCommentEdit`. La JSX permanece igual, solo cambian las fuentes de datos/handlers.
- **BusinessQuestions:** Queda como orquestador (~180 lineas). Importa `useOptimisticLikes`, `useQuestionThreads`, `QuestionInput`. Elimina los noop handlers (`noopEdit`, `noopEditText`).
- **SettingsPanel:** Queda como compositor de secciones (~150 lineas). Importa `AccountSection`, `NotificationsSection`, `SettingRow`.
- **CommentsList:** Queda en ~200 lineas. Importa `useCommentsListFilters`, `useVirtualizedList`.

## Hooks

### useOptimisticLikes (nuevo, compartido)

- **Archivo:** `src/hooks/useOptimisticLikes.ts`
- **Params:**

```typescript
interface UseOptimisticLikesParams {
  userCommentLikes: Set<string>;
}
```

- **Return:**

```typescript
interface UseOptimisticLikesReturn {
  isLiked: (commentId: string) => boolean;
  getLikeCount: (comment: Comment) => number;
  handleToggleLike: (commentId: string, toggleAction: (liked: boolean) => Promise<void>) => Promise<void>;
}
```

- **Logica:** Unifica las dos implementaciones (BusinessComments usa dos Maps, BusinessQuestions usa una Map con `{toggled, delta}`). La implementacion unificada usa una sola Map con `{toggled: boolean; delta: number}`. El `handleToggleLike` recibe una funcion async de toggle que el componente padre define (wrapping `withOfflineSupport` + `likeComment`/`unlikeComment`). El hook maneja solo el optimistic state + revert on error.
- **Dependencias:** Ninguna externa. Solo React state.
- **Caching:** No aplica (state local efimero).

### useCommentSort (nuevo, compartido)

- **Archivo:** `src/hooks/useCommentSort.ts`
- **Params:**

```typescript
interface UseCommentSortParams<T extends { createdAt: Date; likeCount: number }> {
  items: T[];
  isPendingDelete: (id: string) => boolean;
  getId: (item: T) => string;
}
```

- **Return:**

```typescript
interface UseCommentSortReturn<T> {
  sortMode: SortMode;
  setSortMode: (mode: SortMode) => void;
  sortedItems: T[];
}
```

- **Logica:** Gestiona `sortMode` state (`'recent' | 'oldest' | 'useful'`), filtra items con `isPendingDelete`, y retorna array ordenado via `useMemo`. Generico para reutilizar en BusinessComments (top-level comments) y potencialmente CommentsList.
- **Dependencias:** React state + useMemo.

### useCommentThreads (nuevo, co-localizado)

- **Archivo:** `src/hooks/useCommentThreads.ts`
- **Params:**

```typescript
interface UseCommentThreadsParams {
  comments: Comment[];
}
```

- **Return:**

```typescript
interface UseCommentThreadsReturn {
  topLevelComments: Comment[];
  repliesByParent: Map<string, Comment[]>;
  expandedThreads: Set<string>;
  toggleThread: (commentId: string) => void;
  replyingTo: { id: string; userName: string } | null;
  replyText: string;
  setReplyText: (text: string) => void;
  startReply: (comment: Comment) => void;
  cancelReply: () => void;
  replyInputRef: React.RefObject<HTMLInputElement | null>;
}
```

- **Logica:** Grouping memo (top-level vs replies con sort cronologico), expanded threads set, reply state (replyingTo, replyText, ref for auto-focus). `startReply` auto-expands the thread.
- **Dependencias:** React state + useMemo + useRef.

### useCommentEdit (nuevo, compartido)

- **Archivo:** `src/hooks/useCommentEdit.ts`
- **Params:**

```typescript
interface UseCommentEditParams {
  onSave: (commentId: string, text: string) => Promise<void>;
  onComplete?: () => void;
}
```

- **Return:**

```typescript
interface UseCommentEditReturn {
  editingId: string | null;
  editText: string;
  isSavingEdit: boolean;
  startEdit: (comment: Comment) => void;
  saveEdit: () => Promise<void>;
  cancelEdit: () => void;
  setEditText: (text: string) => void;
}
```

- **Logica:** Encapsula `editingId`, `editText`, `isSavingEdit` state. `startEdit` setea id+text, `saveEdit` llama a `onSave` con guard de empty text, `cancelEdit` resetea todo.
- **Dependencias:** React state.

### useQuestionThreads (nuevo, co-localizado)

- **Archivo:** `src/components/business/useQuestionThreads.ts`
- **Params:**

```typescript
interface UseQuestionThreadsParams {
  comments: Comment[];
  isPendingDelete: (id: string) => boolean;
}
```

- **Return:**

```typescript
interface UseQuestionThreadsReturn {
  questions: Comment[];
  filteredAnswersByQuestion: Map<string, Comment[]>;
  visibleQuestions: Comment[];
  expandedQuestions: Set<string>;
  toggleQuestion: (questionId: string, businessId: string) => void;
  getAnswerCount: (question: Comment) => number;
  replyingTo: { id: string; userName: string } | null;
  replyText: string;
  setReplyText: (text: string) => void;
  startReply: (comment: Comment) => void;
  cancelReply: () => void;
  replyInputRef: React.RefObject<HTMLInputElement | null>;
}
```

- **Logica:** Separa questions de answers, filtra por question IDs, ordena answers por likeCount desc, questions por fecha desc. `toggleQuestion` trackea analytics event. Incluye reply state (paralelo a `useCommentThreads`).
- **Dependencias:** React state + useMemo + useRef + `trackEvent`.
- **Co-localizado** porque la logica de best answer y question type filtering es especifica de BusinessQuestions.

### useVerificationCooldown (nuevo)

- **Archivo:** `src/hooks/useVerificationCooldown.ts`
- **Params:** Ninguno.
- **Return:**

```typescript
interface UseVerificationCooldownReturn {
  cooldown: number;
  startCooldown: (seconds: number) => void;
  isActive: boolean;
}
```

- **Logica:** Maneja countdown con `setInterval`, cleanup en unmount. `startCooldown` inicia el timer. `isActive` es `cooldown > 0`.
- **Dependencias:** React state + useEffect + useRef.

### useCommentsListFilters (nuevo, co-localizado)

- **Archivo:** `src/components/menu/useCommentsListFilters.ts`
- **Params:**

```typescript
interface UseCommentsListFiltersParams {
  comments: Array<{ id: string; comment: Comment; business: Business | null }>;
}
```

- **Return:**

```typescript
interface UseCommentsListFiltersReturn {
  sortMode: SortMode;
  setSortMode: (mode: SortMode) => void;
  searchInput: string;
  setSearchInput: (value: string) => void;
  deferredSearch: string;
  filterBusiness: Business | null;
  setFilterBusiness: (business: Business | null) => void;
  filteredComments: Array<{ id: string; comment: Comment; business: Business | null }>;
  businessOptions: Business[];
  isFiltered: boolean;
  showControls: boolean;
}
```

- **Logica:** Encapsula sort mode, search input con `useDeferredValue`, business filter, y los tres memos encadenados (sort -> search -> business filter). Incluye `businessOptions` derivado y flags `isFiltered`/`showControls`.
- **Co-localizado** porque es especifico de la vista CommentsList del menu.

### useVirtualizedList (nuevo, co-localizado)

- **Archivo:** `src/components/menu/useVirtualizedList.ts`
- **Params:**

```typescript
interface UseVirtualizedListParams {
  itemCount: number;
  hasMore: boolean;
  isLoadingMore: boolean;
  searchActive: boolean;
  loadMore: () => void;
}
```

- **Return:**

```typescript
interface UseVirtualizedListReturn {
  shouldVirtualize: boolean;
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
  virtualizer: ReturnType<typeof useVirtualizer>;
}
```

- **Logica:** Encapsula `VIRTUALIZE_THRESHOLD` check, `useVirtualizer` setup, auto-loadMore cuando se acerca al final de la lista virtual. El `useEffect` de auto-load vive dentro del hook.
- **Co-localizado** porque los parametros del virtualizer (estimateSize, overscan) son especificos de CommentsList.

## Servicios

Sin cambios. Los hooks extraidos no introducen nuevas llamadas a servicios. Reutilizan los service calls existentes (`addComment`, `editComment`, `deleteComment`, `likeComment`, `unlikeComment`, `createQuestion`).

## Integracion

### BusinessComments

El componente importa los 4 hooks nuevos y delega toda la logica de state management:

```typescript
const { sortMode, setSortMode, sortedItems: sortedTopLevel } = useCommentSort({
  items: topLevelComments,
  isPendingDelete,
  getId: (c) => c.id,
});
const { isLiked, getLikeCount, handleToggleLike } = useOptimisticLikes({ userCommentLikes });
const { topLevelComments, repliesByParent, expandedThreads, toggleThread, replyingTo, replyText, setReplyText, startReply, cancelReply, replyInputRef } = useCommentThreads({ comments });
const { editingId, editText, isSavingEdit, startEdit, saveEdit, cancelEdit, setEditText } = useCommentEdit({
  onSave: (id, text) => editComment(id, user!.uid, text),
  onComplete: onCommentsChange,
});
```

El `handleToggleLike` del hook recibe un callback que el componente define con `withOfflineSupport`.

### BusinessQuestions

Importa `useOptimisticLikes` (mismo hook compartido), `useQuestionThreads`, `QuestionInput`:

```typescript
const { isLiked, getLikeCount, handleToggleLike } = useOptimisticLikes({ userCommentLikes });
const { questions, filteredAnswersByQuestion, visibleQuestions, expandedQuestions, toggleQuestion, getAnswerCount, replyingTo, replyText, setReplyText, startReply, cancelReply, replyInputRef } = useQuestionThreads({ comments, isPendingDelete });
```

Elimina los `noopEdit`/`noopEditText` callbacks - pasa `undefined` o no-op inline donde `CommentRow` lo requiera (las props de edit en CommentRow ya aceptan el patron actual).

### SettingsPanel

Reemplaza el bloque de cuenta con `<AccountSection>`, el bloque de notificaciones con `<NotificationsSection>`, y extrae `SettingRow` a archivo propio:

```typescript
import SettingRow from './SettingRow';
import AccountSection from './AccountSection';
import NotificationsSection from './NotificationsSection';
```

`AccountSection` recibe props de `useAuth()` y los handlers de signOut/verification.
`NotificationsSection` recibe `settings` y `updateSetting` de `useUserSettings()`.

### CommentsList

Extrae la logica de filtros y virtualizacion:

```typescript
const { sortMode, setSortMode, searchInput, setSearchInput, deferredSearch, filterBusiness, setFilterBusiness, filteredComments, businessOptions, isFiltered, showControls } = useCommentsListFilters({ comments });
const { shouldVirtualize, scrollContainerRef, virtualizer } = useVirtualizedList({
  itemCount: filteredComments.length,
  hasMore,
  isLoadingMore,
  searchActive: !!searchInput,
  loadMore,
});
```

## Tests

### Mock strategy

- **Hooks puros (useCommentSort, useOptimisticLikes, useCommentEdit, useVerificationCooldown):** Se testean con `renderHook` de `@testing-library/react`. No requieren mocks de Firestore ni servicios.
- **Hooks con trackEvent (useQuestionThreads):** Mock de `trackEvent` via `vi.mock('../../utils/analytics')`.
- **Hooks co-localizados (useCommentsListFilters, useVirtualizedList):** `renderHook`. useVirtualizedList requiere mock de `@tanstack/react-virtual`.
- **QuestionInput:** `render` con `@testing-library/react`. Mock minimo.
- **AccountSection:** `render` con mocks de `useAuth` context y lazy-loaded dialogs.

| Archivo test | Que testear | Tipo |
|-------------|-------------|------|
| `src/hooks/useOptimisticLikes.test.ts` | Toggle state, delta calculation, isLiked/getLikeCount helpers, double toggle, revert on error, unknown commentId | Hook unit |
| `src/hooks/useCommentSort.test.ts` | Sort modes (recent/oldest/useful), filtering de pending deletes, empty array, single item | Hook unit |
| `src/hooks/useCommentThreads.test.ts` | Grouping top-level vs replies, reply sorting chronological, expanded threads toggle, startReply auto-expands, cancelReply resets | Hook unit |
| `src/hooks/useCommentEdit.test.ts` | Start/save/cancel edit flow, isSavingEdit flag, empty text guard, onComplete callback, onSave error handling | Hook unit |
| `src/components/business/useQuestionThreads.test.ts` | Question/answer separation, best answer sorting, expanded toggle, analytics event, getAnswerCount fallback, reply state | Hook unit |
| `src/components/business/QuestionInput.test.tsx` | Render, submit, rate limit precheck, max length enforcement, Enter key submit, empty text guard | Component |
| `src/components/menu/AccountSection.test.tsx` | Anonymous vs email states, dialog open triggers, verification cooldown display, logout flow | Component |
| `src/hooks/useVerificationCooldown.test.ts` | Timer countdown, cleanup on unmount, startCooldown re-trigger, isActive flag | Hook unit |

### Criterios de testing

- Cobertura >= 80% del codigo nuevo
- Tests de validacion para todos los inputs del usuario
- Todos los paths condicionales cubiertos
- Los tests existentes no deben romperse (zero behavioral changes)

## Analytics

Sin nuevos eventos. `useQuestionThreads` reutiliza los eventos existentes `question_viewed` y `question_answered` que ya se trackean en BusinessQuestions.

---

## Offline

Este refactoring no modifica flujos de datos. Los componentes ya usan `withOfflineSupport` para writes y Firestore persistent cache para reads.

### Cache strategy

| Dato | Estrategia | TTL | Storage |
|------|-----------|-----|---------|
| N/A | Sin cambios | N/A | N/A |

### Writes offline

| Operacion | Mecanismo | Conflict resolution |
|-----------|-----------|-------------------|
| N/A | Sin cambios | N/A |

### Fallback UI

Sin cambios en indicadores offline.

---

## Decisiones tecnicas

### DT1: useOptimisticLikes usa Map unica con `{toggled, delta}`

**Decision:** Unificar las dos implementaciones (BusinessComments usa dos Maps separadas, BusinessQuestions usa una Map con objeto) a una sola Map con `{toggled: boolean; delta: number}`.

**Razon:** La implementacion de BusinessQuestions es mas limpia y tiene menos allocations (un solo `new Map()` por toggle vs dos). El revert on error tambien es mas simple con una sola Map.

**Alternativa descartada:** Mantener dos Maps como en BusinessComments. Mas verboso sin beneficio.

### DT2: handleToggleLike recibe callback en vez de servicios directos

**Decision:** El hook `useOptimisticLikes` no importa servicios de comments ni `withOfflineSupport`. El componente padre pasa una funcion `toggleAction: (currentlyLiked: boolean) => Promise<void>` que encapsula la logica de servicio.

**Razon:** Mantiene el hook puro y testeable sin mocks de Firebase. Cada consumidor (BusinessComments, BusinessQuestions) define su propia logica de servicio con `withOfflineSupport` y toast messages.

### DT3: Hooks co-localizados vs compartidos

**Decision:**
- `useOptimisticLikes`, `useCommentSort`, `useCommentEdit`, `useVerificationCooldown` en `src/hooks/` (compartidos).
- `useCommentThreads` en `src/hooks/` (reutilizable para threads genericos).
- `useQuestionThreads` en `src/components/business/` (especifico de Q&A).
- `useCommentsListFilters`, `useVirtualizedList` en `src/components/menu/` (especificos de CommentsList).

**Razon:** Los hooks en `src/hooks/` tienen potencial de reutilizacion. Los co-localizados tienen logica especifica del contexto (question types, virtualizer config).

### DT4: SettingRow extraido a archivo pero no a directorio

**Decision:** `SettingRow` va a `src/components/menu/SettingRow.tsx` como archivo simple, no en subdirectorio.

**Razon:** Es un componente simple (~30 lineas) sin subcomponentes. Un subdirectorio seria overhead innecesario. Sigue el patron de `CommentInput`, `CommentRow` que son archivos simples junto al padre.

### DT5: AccountSection contiene todos los dialogs lazy-loaded

**Decision:** Los tres lazy-loaded dialogs (`EmailPasswordDialog`, `ChangePasswordDialog`, `DeleteAccountDialog`) y el logout dialog se mueven a `AccountSection`.

**Razon:** Estos dialogs solo se abren desde la seccion de cuenta. Moverlos a `AccountSection` mantiene la cohesion y reduce las importaciones en `SettingsPanel`.
