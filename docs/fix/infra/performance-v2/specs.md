# Specs: #283 Performance Fixes v2

**Issue:** #283
**Fecha:** 2026-03-31

---

## Resumen

Tres grupos de mejoras de rendimiento sin cambios al modelo de datos, reglas de Firestore, ni seed data:

- **MEDIUM** — `BusinessSheet` — `useCallback` deps sobre `data` (objeto nuevo en cada render), anulando toda memoizacion.
- **MEDIUM** — Cloud Functions — 3 bloques de writes secuenciales (`comments.ts` x2, `ratings.ts` x2) que pueden correr en paralelo con `Promise.all`.
- **LOW** — `useCommentListBase` — `handleSubmitReply` es una `async function` plana (referencia nueva en cada render).

No hay cambios al modelo de datos, reglas de Firestore, ni seed data.

---

## Fix 1 — BusinessSheet: useCallback con dep inestable

### Problema

`BusinessSheet.tsx` lineas 96-100:

```typescript
const handleRatingChange = useCallback(() => data.refetch('ratings'), [data]);
const handleTagsChange = useCallback(() => {
  data.refetch('userTags');
  data.refetch('customTags');
}, [data]);
```

`data` es el objeto devuelto por `useBusinessData(businessId)`. Este objeto se recrea en cada render (spread en la linea 185 de `useBusinessData.ts`: `return { ...data, isLoading, ... }`). Por lo tanto `[data]` cambia en cada render, `useCallback` nunca memoiza, y los componentes hijos que reciben `handleRatingChange`/`handleTagsChange` como prop se re-renderizan innecesariamente.

### Causa raiz

`useBusinessData` devuelve `{ ...data, isLoading, ... }` — un objeto nuevo en cada render. El consumidor no puede depender de la referencia del objeto completo; debe depender de `refetch` directamente.

### Fix propuesto

La funcion `refetch` de `useBusinessData` **ya esta** memoizada con `useCallback` (lineas 159-181 de `useBusinessData.ts`). Su identidad es estable mientras `businessId`, `user` y `load` no cambien. El fix es sacar `refetch` directamente del hook y usarlo como dep en lugar de `data`:

```typescript
// En BusinessSheet.tsx — reemplazar lineas 53 y 96-100
const data = useBusinessData(businessId);
const { refetch } = data;  // referencia estable memoizada por useBusinessData

const handleRatingChange = useCallback(() => refetch('ratings'), [refetch]);
const handleTagsChange = useCallback(() => {
  refetch('userTags');
  refetch('customTags');
}, [refetch]);
```

Esto es correcto porque `refetch` ya captura `businessId`, `user` y `load` en su propio closure (ver `useBusinessData.ts:159-181`).

### Impacto

- `handleRatingChange` y `handleTagsChange` pasan el check de igualdad referencial de React.
- `BusinessRating` y `InfoTab` (receptores de estas callbacks) no se re-renderizan cuando `data.comments` o `data.ratings` cambian si las callbacks son estables.
- Cambio de 3 lineas. Riesgo bajo.

---

## Fix 2 — Cloud Functions: writes secuenciales → Promise.all

### Problema

Tres bloques de writes independientes se ejecutan secuencialmente cuando pueden correr en paralelo.

#### 2a — `comments.ts:68-72` — onCommentCreated (create path)

```typescript
// Actual — secuencial (~3 RTTs a Firestore)
await incrementCounter(db, 'comments', 1);
await trackWrite(db, 'comments');
if (businessId) {
  await incrementBusinessCount(db, 'businessComments', businessId, 1);
}
```

```typescript
// Propuesto — paralelo
await Promise.all([
  incrementCounter(db, 'comments', 1),
  trackWrite(db, 'comments'),
  businessId ? incrementBusinessCount(db, 'businessComments', businessId, 1) : Promise.resolve(),
]);
```

#### 2b — `comments.ts:178-182` — onCommentDeleted (delete path)

```typescript
// Actual — secuencial
await incrementCounter(db, 'comments', -1);
await trackDelete(db, 'comments');
if (businessId) {
  await incrementBusinessCount(db, 'businessComments', businessId, -1);
}
```

```typescript
// Propuesto — paralelo
await Promise.all([
  incrementCounter(db, 'comments', -1),
  trackDelete(db, 'comments'),
  businessId ? incrementBusinessCount(db, 'businessComments', businessId, -1) : Promise.resolve(),
]);
```

#### 2c — `ratings.ts:35-37` — onRatingWritten (create branch)

```typescript
// Actual — secuencial
await incrementCounter(db, 'ratings', 1);
await trackWrite(db, 'ratings');
await updateRatingAggregates(db, businessId, 'add', score);
```

```typescript
// Propuesto — paralelo
await Promise.all([
  incrementCounter(db, 'ratings', 1),
  trackWrite(db, 'ratings'),
  updateRatingAggregates(db, businessId, 'add', score),
]);
```

#### 2d — `ratings.ts:64-66` — onRatingWritten (delete branch)

```typescript
// Actual — secuencial
await incrementCounter(db, 'ratings', -1);
await trackDelete(db, 'ratings');
await updateRatingAggregates(db, businessId, 'remove', score);
```

```typescript
// Propuesto — paralelo
await Promise.all([
  incrementCounter(db, 'ratings', -1),
  trackDelete(db, 'ratings'),
  updateRatingAggregates(db, businessId, 'remove', score),
]);
```

### Precondicion de seguridad

Estos tres writes son **independientes entre si** — no hay dependencia de datos entre `incrementCounter`, `trackWrite`/`trackDelete`, e `incrementBusinessCount`/`updateRatingAggregates`. Paralelizarlos no introduce race conditions.

Nota: el bloque de `parentRef.update + parentRef.get` en `onCommentCreated:59-63` ya usa `Promise.all` correctamente.

### Impacto estimado

Cada bloque secuencial tiene ~3 Firestore RTTs (round-trip a Cloud Firestore desde Cloud Functions, tipicamente 5-15ms c/u en la misma region). Paralelizando, se reducen a 1 RTT efectivo. En `onCommentCreated` esto es parte de una cadena mas larga (rate limit → moderation → counters → notify → fan-out), por lo que el ahorro acorta la duracion total de la funcion, reduciendo costos de compute y tiempo de escritura del trigger.

---

## Fix 3 — useCommentListBase: handleSubmitReply sin useCallback

### Problema

`useCommentListBase.ts:141`:

```typescript
const handleSubmitReply = async () => {
  // ...
};
```

Es una funcion anonima plain, no memoizada. Se crea una referencia nueva en cada render del hook. Los consumidores (`BusinessComments`, `BusinessQuestions`) reciben esta funcion via el objeto retornado y la pasan a `InlineReplyForm` como prop `onSubmit`. Cada render de `useCommentListBase` invalida la referencia, causando re-renders innecesarios en `InlineReplyForm`.

### Fix propuesto

```typescript
const handleSubmitReply = useCallback(async () => {
  if (!user || !replyingTo || !replyText.trim()) return;
  if (userCommentsToday >= MAX_COMMENTS_PER_DAY) return;
  setIsSubmitting(true);
  try {
    const trimmedReply = replyText.trim();
    await withOfflineSupport(
      isOffline, 'comment_create',
      { userId: user.uid, businessId, businessName },
      { userName: displayName || 'Anónimo', text: trimmedReply, parentId: replyingTo.id },
      () => addComment(user.uid, displayName || 'Anónimo', businessId, trimmedReply, replyingTo.id),
      toast,
    );
    setReplyingTo(null);
    setReplyText('');
    onCommentsChange();
    if (!isOffline) toast.success(MSG_COMMENT.replySuccess);
  } catch (error) {
    if (import.meta.env.DEV) logger.error('Error adding reply:', error);
    toast.error(MSG_COMMENT.replyError);
  }
  setIsSubmitting(false);
}, [user, replyingTo, replyText, userCommentsToday, isOffline, businessId, businessName, displayName, onCommentsChange, toast]);
```

### Nota sobre deps

`replyText` y `replyingTo` son state del hook, por lo que cambian al escribir. Esto significa que `handleSubmitReply` igualmente se recrea cuando el usuario tipea. El beneficio real es cuando `isOffline`, `user`, etc. no cambian pero el hook re-renderiza por otro motivo (ej: actualizacion de `comments` prop). La severidad es LOW porque `InlineReplyForm` no es un componente particularmente costoso de re-renderizar.

---

## Modelo de datos

Sin cambios. No hay modificaciones a colecciones, documentos, ni tipos de Firestore.

## Firestore Rules

Sin cambios.

## Cloud Functions

Modificaciones internas a `functions/src/triggers/comments.ts` y `functions/src/triggers/ratings.ts`. Sin cambios a triggers, paths, ni contratos de entrada/salida.

## Seed Data

No aplica — sin cambios de schema.

## Componentes

### BusinessSheet.tsx (modificado)

Cambio minimo: destructurar `refetch` de `data` antes de los `useCallback`. Sin cambios a JSX ni props.

## Hooks

### useCommentListBase.ts (modificado)

`handleSubmitReply` pasa de funcion anonima a `useCallback`. Sin cambios a la firma del hook ni a su valor de retorno.

## Tests

| Archivo test | Que testear | Tipo |
|-------------|-------------|------|
| `src/__tests__/hooks/useCommentListBase.test.ts` | `handleSubmitReply` existe y es callable; llamada correcta a `addComment` via `withOfflineSupport` | Unit |
| `functions/src/__tests__/triggers/comments.test.ts` | `onCommentCreated` y `onCommentDeleted` ejecutan los tres writes (mock verificable via spies en `Promise.all`) | Unit (CF) |
| `functions/src/__tests__/triggers/ratings.test.ts` | `onRatingWritten` create/delete ejecutan writes en paralelo | Unit (CF) |

No se agregan tests para el fix de `useCallback` en `BusinessSheet` — el patron es identico al ya existente en la codebase y no tiene logica de negocio nueva.

## Analytics

Sin cambios.

## Offline

Sin impacto. Los fixes son de memoizacion (client) y paralelizacion de writes server-side (CF). No afectan la estrategia de cache ni el comportamiento offline del cliente.

---

## Decisiones tecnicas

### Por que destructurar refetch en lugar de usar useRef

Alternativa considerada: almacenar `data.refetch` en un `useRef` dentro de `BusinessSheet` y actualizar el ref en cada render, usando una arrow function `() => refetchRef.current('ratings')` como dep.

Razon de rechazo: es innecesariamente complejo. `refetch` ya es estable por diseno en `useBusinessData` (memoizado con `useCallback` con deps `[businessId, user, load]`). Destructurarlo es suficiente y es el patron idiomatico de React.

### Por que Promise.all y no un batch de Firestore

Los writes van a distintas colecciones/documentos (`counters`, `writes`, `businessAggregates`). Firestore batches son para multiples writes que deben ser atomicos. Aqui no hay requisito de atomicidad entre counters y aggregates — si uno falla, el otro puede proseguir. `Promise.all` es el mecanismo correcto.

### handleSubmitReply: deps completas vs deps reducidas

Se listan todas las deps que realmente se usan en la funcion (comportamiento correcto segun reglas de exhaustive-deps). `replyText` y `replyingTo` causan recreacion al tipear, pero esto es correcto — la funcion necesita el valor actual de ambas.

---

## Deuda tecnica: mitigacion incorporada

Sin deuda tecnica nueva introducida. No hay issues de tech debt abiertos que apliquen directamente a los 3 archivos tocados.
