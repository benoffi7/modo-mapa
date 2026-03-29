# Specs: Tech Debt — InlineReplyForm, FollowedList Pagination, Boilerplate

**PRD:** [prd.md](prd.md)
**Fecha:** 2026-03-29

---

## Modelo de datos

Sin cambios en colecciones ni tipos de Firestore. Este feature es un refactor interno sin modificaciones al data model.

Los unicos cambios de datos son constantes locales movidas a `src/constants/`:

```typescript
// src/constants/social.ts (NUEVO)
export const MAX_FOLLOWS = 200;
export const FOLLOWS_PAGE_SIZE = 20;
```

## Firestore Rules

Sin cambios. Este feature no modifica queries ni colecciones.

### Rules impact analysis

No hay queries nuevas. Las queries existentes en `follows.ts` (`fetchFollowing`, `fetchFollowers`) no cambian su forma ni coleccion. El refactor de FollowedList cambia de paginacion manual a `usePaginatedQuery` pero las queries subyacentes usan los mismos constraints (`where('followerId', '==', userId)`, `orderBy('createdAt', 'desc')`).

| Query (service file) | Collection | Auth context | Rule that allows it | Change needed? |
|----------------------|------------|-------------|-------------------|----------------|
| fetchFollowing (follows.ts) | follows | Authenticated user | `allow read: if auth != null` | No |

### Field whitelist check

No hay campos nuevos ni modificados en ningun servicio.

## Cloud Functions

Sin cambios.

## Componentes

### InlineReplyForm (EXISTENTE, sin cambios)

`src/components/business/InlineReplyForm.tsx` — 100 lineas. Ya exporta el componente con props: `replyingToName`, `replyText`, `onReplyTextChange`, `onSubmit`, `onCancel`, `isSubmitting`, `isOverDailyLimit`, `inputRef`. No requiere modificaciones.

### BusinessComments (MODIFICAR)

`src/components/business/BusinessComments.tsx` — 398 lineas.

Cambios:

1. **Reemplazar JSX de reply inline** (lineas 307-369) por `<InlineReplyForm>`. El bloque actual renderiza dos ramas condicionales (`isOverDailyLimit` y formulario con TextField+botones) que son identicas al componente extraido. Elimina ~60 lineas de JSX + imports de `TextField`, `SendIcon`, `CloseIcon`.
2. **Reemplazar Snackbar + UserProfileSheet footer** (lineas 383-396) por `<CommentListFooter>`. Elimina ~15 lineas.

Resultado estimado: ~325 lineas (de 398).

### BusinessQuestions (MODIFICAR)

`src/components/business/BusinessQuestions.tsx` — 375 lineas.

Cambios:

1. **Reemplazar JSX de reply inline** (lineas 288-347) por `<InlineReplyForm>`. Mismo patron que BusinessComments.
2. **Reemplazar Snackbar + UserProfileSheet footer** (lineas 360-373) por `<CommentListFooter>`. Mismo patron.

Resultado estimado: ~300 lineas (de 375).

### CommentListFooter (NUEVO)

`src/components/common/CommentListFooter.tsx` — componente compartido.

```typescript
interface CommentListFooterProps {
  deleteSnackbarProps: {
    open: boolean;
    message: string;
    onUndo: () => void;
    autoHideDuration: number;
    onClose: () => void;
  };
  profileUser: { id: string; name: string } | null;
  onCloseProfile: () => void;
}
```

Renderiza:

- `<Snackbar>` con boton "Deshacer" usando `deleteSnackbarProps`
- `<UserProfileSheet>` con `userId`, `userName`, `onClose`

Estimado: ~40 lineas.

### FollowedList (MODIFICAR)

`src/components/social/FollowedList.tsx` — 134 lineas.

Cambio principal: reemplazar los 6 `useState` (`items`, `isLoading`, `error`, `hasMore`, `isLoadingMore`, `lastDoc`) y el `loadPage` callback por un custom hook `useFollowedList` que encapsula la logica de paginacion con post-processing de displayNames.

**Motivo de no usar `usePaginatedQuery` directamente:** `usePaginatedQuery` opera sobre una `CollectionReference<T>` y retorna items `T[]` via `.data()`. FollowedList necesita post-procesar los docs (extraer `followedId` y resolver displayNames via `fetchUserDisplayNames`). Esto requiere un paso intermedio que `usePaginatedQuery` no soporta. Modificar `usePaginatedQuery` para soportar transformaciones esta fuera de scope (PRD, Out of Scope).

**Solucion:** crear `useFollowedList` como adapter que internamente usa `usePaginatedQuery` para la coleccion `follows` con constraints `[where('followerId', '==', userId)]` y `orderByField: 'createdAt'`, y luego post-procesa los items para resolver displayNames. El hook expone la misma interfaz (`items`, `isLoading`, `error`, `hasMore`, `isLoadingMore`, `loadMore`, `reload`) pero los items son `{ userId: string; displayName: string }[]`.

Resultado estimado FollowedList: ~95 lineas (de 134).

### Mutable prop audit

No aplica. Ningun componente nuevo recibe datos editables como props. `CommentListFooter` es puramente de display/callback.

## Textos de usuario

No hay textos nuevos visibles al usuario. Todos los textos existentes (Snackbar "Deshacer", Alert de limite diario, placeholder "Escribi tu respuesta...") se mantienen identicos al ser adoptados desde InlineReplyForm y CommentListFooter.

## Hooks

### useFollowedList (NUEVO)

`src/hooks/useFollowedList.ts`

```typescript
interface FollowedItem {
  userId: string;
  displayName: string;
}

interface UseFollowedListReturn {
  items: FollowedItem[];
  isLoading: boolean;
  isLoadingMore: boolean;
  error: string | null;
  hasMore: boolean;
  loadMore: () => Promise<void>;
  reload: () => Promise<void>;
}

function useFollowedList(userId: string | undefined): UseFollowedListReturn
```

- Internamente usa `usePaginatedQuery<Follow>` con `getFollowsCollection()`, `[where('followerId', '==', userId)]`, `'createdAt'`, `FOLLOWS_PAGE_SIZE`, `cacheKey: userId`.
- Post-procesa items: extrae `followedId` de cada `Follow`, llama `fetchUserDisplayNames` en un `useEffect` que observa los items del hook paginado.
- Mantiene un `Map<string, string>` de nombres resueltos en state local.
- Retorna items combinados con displayNames.
- Se beneficia del cache de primera pagina (2-min TTL) de `usePaginatedQuery`.

**Dependencias:** `usePaginatedQuery`, `getFollowsCollection`, `fetchUserDisplayNames`, `FOLLOWS_PAGE_SIZE`.

## Servicios

### follows.ts (MODIFICAR)

`src/services/follows.ts`

Cambios:

1. Eliminar `const MAX_FOLLOWS = 200;` y `const PAGE_SIZE = 20;` (lineas 22-23).
2. Importar `MAX_FOLLOWS`, `FOLLOWS_PAGE_SIZE` de `../../constants/social`.
3. Reemplazar usos de `PAGE_SIZE` por `FOLLOWS_PAGE_SIZE` en `fetchFollowing` y `fetchFollowers`.

## Integracion

### Archivos que necesitan modificaciones

| Archivo | Tipo de cambio |
|---------|---------------|
| `src/components/business/BusinessComments.tsx` | Adoptar InlineReplyForm + CommentListFooter |
| `src/components/business/BusinessQuestions.tsx` | Adoptar InlineReplyForm + CommentListFooter |
| `src/components/social/FollowedList.tsx` | Usar useFollowedList |
| `src/services/follows.ts` | Mover constantes a imports |
| `src/constants/social.ts` | NUEVO — constantes de follows |
| `src/constants/index.ts` | Re-export social.ts |
| `src/hooks/useFollowedList.ts` | NUEVO — adapter hook |
| `src/components/common/CommentListFooter.tsx` | NUEVO — footer compartido |

### Preventive checklist

- [x] **Service layer**: Ningun componente importa `firebase/firestore` para writes. FollowedList ya delega a `follows.ts`.
- [x] **Duplicated constants**: `MAX_FOLLOWS` y `PAGE_SIZE` se mueven a `src/constants/social.ts`. No se duplican.
- [x] **Context-first data**: No aplica. FollowedList usa datos de Firestore que no estan en ningun context.
- [x] **Silent .catch**: El `catch` en FollowedList se reemplaza por el manejo de error de `usePaginatedQuery`. El hook actual ya usa `logger.error`.
- [x] **Stale props**: No aplica. `CommentListFooter` recibe callbacks, no datos editables.

## Tests

| Archivo test | Que testear | Tipo |
|-------------|-------------|------|
| `src/hooks/__tests__/useFollowedList.test.ts` | Hook retorna items con displayNames, maneja loading/error, loadMore funciona, reload invalida cache | Hook |
| `src/components/common/__tests__/CommentListFooter.test.tsx` | Renderiza Snackbar cuando open=true, renderiza boton Deshacer, renderiza UserProfileSheet con userId, llama onCloseProfile | Componente |

**Notas sobre tests:**

- `InlineReplyForm` ya existe y no se modifica, no necesita tests nuevos.
- `BusinessComments` y `BusinessQuestions` tienen cambios cosmeticos (reemplazar JSX por componentes). Si existen tests, deben seguir pasando. No hay tests existentes para estos componentes (son mayormente visuales).
- `CommentListFooter` es ~40 lineas de JSX wrapper pero tiene logica condicional (spread de `userName` solo si `profileUser?.name != null`), por lo que merece tests basicos.
- `useFollowedList` encapsula logica de post-processing que es la parte critica de esta migracion.

### Mock strategy

```typescript
// useFollowedList.test.ts
vi.mock('../../services/follows', () => ({
  getFollowsCollection: vi.fn(),
}));
vi.mock('../../services/users', () => ({
  fetchUserDisplayNames: vi.fn(),
}));
vi.mock('../usePaginatedQuery', () => ({
  usePaginatedQuery: vi.fn(),
}));
```

## Analytics

Sin cambios. No hay eventos nuevos.

---

## Offline

### Cache strategy

| Dato | Estrategia | TTL | Storage |
|------|-----------|-----|---------|
| FollowedList primera pagina | `usePaginatedQuery` first-page cache | 2 min | Module-level Map |
| FollowedList datos Firestore | Firestore persistent cache | N/A | IndexedDB (Firebase SDK) |

### Writes offline

No hay writes nuevos en este feature.

### Fallback UI

Sin cambios. `PaginatedListShell` ya maneja estados de error para FollowedList.

---

## Decisiones tecnicas

1. **Adapter hook en vez de modificar `usePaginatedQuery`:** El PRD define como out of scope refactorizar `usePaginatedQuery` para soportar post-processing nativo. Crear `useFollowedList` como adapter mantiene el hook generico intacto y encapsula la logica especifica de resoluccion de displayNames.

2. **`CommentListFooter` en `common/` en vez de `business/`:** Aunque actualmente solo lo usan `BusinessComments` y `BusinessQuestions`, el patron de Snackbar undo-delete + UserProfileSheet es generico y podria usarse en otros contextos sociales (CommentsList ya tiene un patron similar).

3. **No renombrar `InlineReplyForm`:** El componente ya existe con el nombre correcto y la interfaz correcta. Solo se adopta en los dos componentes que duplican su funcionalidad.

4. **Renombrar `PAGE_SIZE` a `FOLLOWS_PAGE_SIZE`:** Evita colision con `ADMIN_PAGE_SIZE` y el `PAGE_SIZE` local de `alertsHelpers.ts`. Hace explicito el dominio de la constante.

---

## Hardening de seguridad

No aplica. Este feature es un refactor interno sin superficies nuevas. No hay colecciones nuevas, endpoints nuevos, inputs de usuario nuevos, ni modificaciones a autenticacion.

### Firestore rules requeridas

Ninguna.

### Rate limiting

No aplica. No hay escrituras nuevas.

### Vectores de ataque mitigados

No aplica. El refactor mantiene las mismas validaciones y rate limits existentes.

---

## Deuda tecnica: mitigacion incorporada

No hay issues abiertos de security ni tech debt en GitHub.

Este feature ES la resolucion de deuda tecnica (issue #234). Mitigaciones incluidas:

| Issue | Que se resuelve | Paso del plan |
|-------|----------------|---------------|
| #234 item 1 | InlineReplyForm sin adoptar en BusinessComments/Questions | Fase 1 |
| #234 item 2 | FollowedList paginacion manual | Fase 2 |
| #234 item 3 | Snackbar+UserProfileSheet duplicado | Fase 1 |
| #234 item 4 | Constantes locales en follows.ts | Fase 1 |
