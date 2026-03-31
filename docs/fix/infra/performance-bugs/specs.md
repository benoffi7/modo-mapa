# Specs: #277-#278 Race Conditions, Re-renders y CF Serial Reads

**Issues:** #277 (HIGH), #278 (MEDIUM)
**Fecha:** 2026-03-31

---

## Resumen

Dos grupos de defectos agrupados en un branch `fix/performance-bugs`:

- **#277 HIGH** — tres bugs de comportamiento: setState-after-unmount en `useCheckIn`, UI desincroncronizada en `ListDetailScreen.handleRemoveItem`, y double-toggle en `useCommentListBase.handleToggleLike`.
- **#278 MEDIUM** — re-renders innecesarios por lambdas/objetos sin memoizar en `TabShell`, `BusinessSheet`, `useUserSettings` y `useBusinessRating`; mas dos Cloud Functions con reads secuenciales que pueden paralelizarse.

No hay cambios al modelo de datos, reglas de Firestore, ni seed data.

---

## Fixes detallados

### Fase 1: Bugs de comportamiento (#277)

#### Fix 1 — `useCheckIn.ts`: setState-after-unmount

| Campo | Detalle |
|-------|---------|
| **Archivo** | `src/hooks/useCheckIn.ts` |
| **Lineas** | 54-65 |
| **Comportamiento actual** | El `useEffect` que llama `fetchCheckInsForBusiness` ya tiene `cancelled = true` en el cleanup (linea 52), pero si la promesa rechaza sin `.catch`, el rechazo queda silencioso y cualquier `setState` en una rama de error imaginaria setea estado en componente desmontado. Mas importante: si el componente se desmonta *durante* la resolución, el `if (cancelled) return` guarda, pero si se agrega manejo de error futuro sin el guard, el bug reaparece. **La issue real es que no hay `.catch` en absoluto**: un rechazo de `fetchCheckInsForBusiness` produce un `UnhandledPromiseRejection` no reportado. |
| **Fix propuesto** | Agregar `.catch` explícito dentro del `useEffect` que respete el flag `cancelled` y llame `logger.warn`. El guard `if (cancelled) return` ya existe para el caso de éxito. |
| **Riesgo** | Bajo — solo agrega manejo de error que hoy no existe. |
| **Patron a usar** | Misma estructura que otros effects en la codebase: `promise.then(...).catch((err) => { if (cancelled) return; logger.warn(...); })`. |

```typescript
// Antes (linea 54-65)
fetchCheckInsForBusiness(businessId, user.uid).then((checkIns) => {
  if (cancelled) return;
  // ...setters...
});

// Despues
fetchCheckInsForBusiness(businessId, user.uid)
  .then((checkIns) => {
    if (cancelled) return;
    // ...setters sin cambio...
  })
  .catch((err) => {
    if (cancelled) return;
    logger.warn('[useCheckIn] fetchCheckInsForBusiness failed', err);
  });
```

---

#### Fix 2 — `ListDetailScreen.tsx`: handleRemoveItem sin try/catch

| Campo | Detalle |
|-------|---------|
| **Archivo** | `src/components/lists/ListDetailScreen.tsx` |
| **Lineas** | 117-121 |
| **Comportamiento actual** | `handleRemoveItem` hace el optimistic update (`setItems`) y el toast de éxito *antes* de saber si `removeBusinessFromList` tuvo éxito. Si el servicio rechaza, el item ya fue removido de la UI pero sigue en Firestore. No hay error toast ni revert. |
| **Fix propuesto** | Convertir a patron optimista correcto: guardar snapshot previo, llamar el servicio, hacer revert + `toast.error` en el catch. |
| **Riesgo** | Bajo — el patron ya existe en la misma función en `handleTogglePublic` (lineas 83-93). |

```typescript
// Antes
const handleRemoveItem = async (item: ListItem) => {
  await removeBusinessFromList(list.id, item.businessId);
  setItems((prev) => prev.filter((i) => i.id !== item.id));
  toast.success(MSG_LIST.itemRemoved);
};

// Despues
const handleRemoveItem = async (item: ListItem) => {
  const prev = items;
  setItems((current) => current.filter((i) => i.id !== item.id));
  try {
    await removeBusinessFromList(list.id, item.businessId);
    toast.success(MSG_LIST.itemRemoved);
  } catch {
    setItems(prev);
    toast.error(MSG_LIST.itemRemoveError);
  }
};
```

Requiere agregar la clave `itemRemoveError` a `MSG_LIST` en `src/constants/messages/`.

---

#### Fix 3 — `useCommentListBase.ts`: handleToggleLike double-toggle

| Campo | Detalle |
|-------|---------|
| **Archivo** | `src/hooks/useCommentListBase.ts` |
| **Lineas** | 81-116 |
| **Comportamiento actual** | `handleToggleLike` es `async` pero no tiene proteccion contra invocaciones concurrentes. Si el usuario toca el boton dos veces rapido, ambas invocaciones leen `isLiked(commentId)` con el mismo valor optimista (el segundo toggle puede leer el estado del primero antes de que se actualice), produciendo dos writes en la misma direccion. El estado optimista se aplica dos veces en la misma direccion. |
| **Fix propuesto** | Agregar un `Set<string>` de comentarios en vuelo (`togglingIds`) gestionado con `useState`. Antes de mutar estado, verificar que el id no este en el set; al entrar, agregarlo; al salir (finally), quitarlo. El handler no necesita `useCallback` todavia (se agrega en la Fase 2). |
| **Riesgo** | Bajo-medio — el `Set` de ref puede ser un `useRef<Set<string>>` para no causar re-render; los re-renders los maneja ya `optimisticLikes`. |

```typescript
// Agregar ref junto a optimisticLikes
const togglingIds = useRef<Set<string>>(new Set());

const handleToggleLike = async (commentId: string) => {
  if (!user) return;
  if (togglingIds.current.has(commentId)) return;   // guard
  togglingIds.current.add(commentId);

  const currentlyLiked = isLiked(commentId);
  setOptimisticLikes((prev) => {
    // ...igual que antes...
  });

  try {
    // ...igual que antes...
  } catch (error) {
    // ...igual que antes...
  } finally {
    togglingIds.current.delete(commentId);
  }
};
```

---

### Fase 2: Re-renders y CF serial reads (#278)

#### Fix 4 — `TabShell.tsx`: inline filter en render

| Campo | Detalle |
|-------|---------|
| **Archivo** | `src/components/layout/TabShell.tsx` |
| **Linea** | 54 |
| **Comportamiento actual** | `notifications.filter((n) => !n.read).length` se evalua en cada render del componente raiz. `TabShell` re-renderiza cuando cualquier context cambia. |
| **Fix propuesto** | `const unreadCount = useMemo(() => notifications.filter((n) => !n.read).length, [notifications]);` |
| **Riesgo** | Minimo. |

---

#### Fix 5 — `BusinessSheet.tsx`: lambdas en props de hooks

| Campo | Detalle |
|-------|---------|
| **Archivo** | `src/components/business/BusinessSheet.tsx` |
| **Lineas** | 85-86, 282-283 |
| **Comportamiento actual** | `onRatingChange: () => data.refetch('ratings')` (linea 85) y `onTagsChange: () => { data.refetch('userTags'); data.refetch('customTags'); }` (linea 283) son lambdas nuevas en cada render. `useBusinessRating` recibe `onRatingChange` en su lista de deps de `useCallback` (linea 154), por lo que el handler interno se recrea en cada render de `BusinessSheet`. |
| **Fix propuesto** | Memoizar con `useCallback` antes de pasarlas: `const handleRatingChange = useCallback(() => data.refetch('ratings'), [data.refetch])`. Misma logica para `handleTagsChange`. `data.refetch` es estable si `useBusinessData` lo devuelve memoizado — verificar. |
| **Riesgo** | Bajo. Si `data.refetch` no es estable, `useCallback` no ayuda; en ese caso la solucion es memoizar `refetch` en `useBusinessData`. |

---

#### Fix 6 — `useUserSettings.ts`: settings object reconstruido cada render

| Campo | Detalle |
|-------|---------|
| **Archivo** | `src/hooks/useUserSettings.ts` |
| **Lineas** | 25-30 |
| **Comportamiento actual** | El objeto `settings` se construye con spread en el cuerpo de la funcion (fuera de cualquier memo), creando una nueva referencia en cada render aunque `data`, `optimistic`, `digestOverride` y `localityOverride` no hayan cambiado. Cualquier consumidor que use `settings` como dep de `useEffect` o `useMemo` se re-ejecuta innecesariamente. |
| **Fix propuesto** | Envolver en `useMemo` con las cuatro fuentes como dependencias. |

```typescript
// Antes
const settings: UserSettings = {
  ...(data ?? DEFAULT_SETTINGS),
  ...optimistic,
  ...(digestOverride != null ? { notificationDigest: digestOverride } : {}),
  ...(localityOverride ?? {}),
};

// Despues
const settings = useMemo<UserSettings>(() => ({
  ...(data ?? DEFAULT_SETTINGS),
  ...optimistic,
  ...(digestOverride != null ? { notificationDigest: digestOverride } : {}),
  ...(localityOverride ?? {}),
}), [data, optimistic, digestOverride, localityOverride]);
```

---

#### Fix 7 — `useBusinessRating.ts` y `useCommentListBase.ts`: async handlers sin useCallback

| Campo | Detalle |
|-------|---------|
| **Archivos** | `src/hooks/useBusinessRating.ts` (lineas 94, 119), `src/hooks/useCommentListBase.ts` (linea 81) |
| **Comportamiento actual** | `handleRate`, `handleDeleteRating` en `useBusinessRating` y `handleToggleLike` en `useCommentListBase` son funciones `async` declaradas directamente en el cuerpo del hook, sin `useCallback`. Se recrean en cada render, causando re-renders en componentes hijos que las reciben como props. |
| **Fix propuesto** | Envolver en `useCallback` con sus dependencias correctas. `handleToggleLike` ya tiene el fix del guard (Fix 3); aqui solo se agrega el wrapper. |
| **Nota** | `handleCriterionRate` en `useBusinessRating` ya usa `useCallback` (linea 139). El patron existe — solo extender. |

---

#### Fix 8 — `functions/src/triggers/comments.ts`: sequential update+get

| Campo | Detalle |
|-------|---------|
| **Archivo** | `functions/src/triggers/comments.ts` |
| **Lineas** | 56-60 |
| **Comportamiento actual** | En `onCommentCreated`, cuando hay `parentId`: se hace `await parentRef.update(...)` y luego `parentSnap = await parentRef.get()` de forma secuencial. El `.get()` existe para leer `userId` del padre y notificar al autor. Estas dos operaciones pueden ser una transaccion o, si se acepta el costo de leer el estado previo, el `.get()` puede hacerse *antes* del `.update()` para paralelizacion con otras ops. Sin embargo, el `.get()` depende del estado ya existente del documento (no del campo `replyCount` recien actualizado), por lo que puede moverse antes del `update` o hacerse en paralelo. **Solucion limpia**: usar `runTransaction` que hace get+update atomicamente, o hacer el `.get()` antes del `.update()` y ejecutar ambas operaciones en paralelo con `Promise.all` si no necesitamos el estado post-update. |
| **Fix propuesto** | Obtener el parentSnap *antes* del update, usar `Promise.all` para paralelizar el update y cualquier otra operacion independiente posterior. |

```typescript
// Antes (secuencial)
if (parentId) {
  const parentRef = db.collection('comments').doc(parentId);
  await parentRef.update({ replyCount: FieldValue.increment(1) });
  parentSnap = await parentRef.get();
}

// Despues (paralelo: get no depende del update)
if (parentId) {
  const parentRef = db.collection('comments').doc(parentId);
  const [, snap] = await Promise.all([
    parentRef.update({ replyCount: FieldValue.increment(1) }),
    parentRef.get(),
  ]);
  parentSnap = snap;
}
```

**Nota:** El `parentSnap` pre-update tiene los datos del autor (que no cambian con `replyCount`), por lo que es correcto para construir la notificacion.

---

#### Fix 9 — `functions/src/triggers/ratings.ts`: sequential user+biz reads

| Campo | Detalle |
|-------|---------|
| **Archivo** | `functions/src/triggers/ratings.ts` |
| **Lineas** | 40-43 |
| **Comportamiento actual** | En el branch de create: `userSnap = await db.doc(users/${userId}).get()` seguido de `bizSnap = await db.doc(businesses/${businessId}).get()`. Reads independientes entre si. |
| **Fix propuesto** | `Promise.all` para los dos reads. |

```typescript
// Antes
const userSnap = await db.doc(`users/${userId}`).get();
const actorName = userSnap.exists ? (userSnap.data()!.displayName as string) : 'Alguien';
const bizSnap = await db.doc(`businesses/${businessId}`).get();
const businessName = bizSnap.exists ? (bizSnap.data()!.name as string) : '';

// Despues
const [userSnap, bizSnap] = await Promise.all([
  db.doc(`users/${userId}`).get(),
  db.doc(`businesses/${businessId}`).get(),
]);
const actorName = userSnap.exists ? (userSnap.data()!.displayName as string) : 'Alguien';
const businessName = bizSnap.exists ? (bizSnap.data()!.name as string) : '';
```

---

## Constantes a agregar

| Archivo | Clave | Valor |
|---------|-------|-------|
| `src/constants/messages/lists.ts` | `itemRemoveError` | `'No se pudo eliminar el comercio. Intentá de nuevo.'` |

---

## Tests

No hay tests existentes para los hooks afectados. Estos tests deben crearse:

| Archivo test | Que testear | Tipo |
|-------------|-------------|------|
| `src/hooks/__tests__/useCheckIn.test.ts` | (1) setState no se llama si cancelled=true al rechazar fetch; (2) logger.warn se llama en rechazo | Unit — vitest, mock de `fetchCheckInsForBusiness` |
| `src/components/lists/__tests__/ListDetailScreen.test.tsx` | (1) revert de items en fallo de removeBusinessFromList; (2) toast.error mostrado en fallo; (3) toast.success solo en exito | Unit — vitest + RTL, mock de `removeBusinessFromList` |
| `src/hooks/__tests__/useCommentListBase.test.ts` | (1) segunda invocacion de handleToggleLike ignorada mientras primera esta en vuelo; (2) estado optimisticLikes queda coherente tras double-tap | Unit — vitest, mock de `likeComment`/`unlikeComment` |
| `src/hooks/__tests__/useUserSettings.test.ts` | (1) settings referencia es estable entre renders si inputs no cambian (mismo objeto memoizado) | Unit — vitest, renderHook |

**Mock strategy:** Los tests de hooks usan `vi.mock` para los servicios de Firestore. Los tests de componentes usan `@testing-library/react` con mocks de contextos (`AuthContext`, `ToastContext`). Seguir el patron de `src/services/__tests__/userProfile.test.ts`.

---

## Textos de usuario

| Texto | Donde se usa | Notas |
|-------|-------------|-------|
| `'No se pudo eliminar el comercio. Intentá de nuevo.'` | `toast.error` en `ListDetailScreen.handleRemoveItem` | tilde en Intentá (voseo) |

---

## Decisiones tecnicas

**Double-toggle con `useRef` vs `useState`:** Se usa `useRef<Set<string>>` para el guard de `togglingIds` porque el estado del set no necesita causar un re-render — el feedback visual ya lo provee `optimisticLikes`. Un `useState` extra causaria un render adicional por cada like/unlike, que es exactamente lo que queremos evitar.

**`Promise.all` en CF vs transaccion:** En `comments.ts`, el `.get()` no necesita el valor post-`update` (solo necesita `userId` del autor, que no cambia). Por lo tanto `Promise.all` es correcto y mas simple que una transaccion. Si en el futuro se necesitara leer `replyCount` actualizado, se deberia migrar a transaccion.

**`onRatingChange` lambda en BusinessSheet:** La lambda `() => data.refetch('ratings')` es nueva en cada render porque `data` es el objeto de retorno de `useBusinessData`, que puede ser una nueva referencia en cada render. El fix de `useCallback` solo es efectivo si `data.refetch` es estable. Se debe verificar que `useBusinessData` devuelva `refetch` con referencia estable (via `useCallback` interno). Si no, el fix real esta en `useBusinessData`.
