# Specs: fetchUserLikes fan-out → query-by-businessId (cerrar guard #302 R3)

**PRD:** [prd.md](prd.md)
**Fecha:** 2026-06-10
**Issue:** #343

---

## Modelo de datos

### Coleccion `commentLikes` (modificada)

- **Doc ID compuesto:** `{userId}__{commentId}` (sin cambio — Out of Scope mantenerlo).
- **Campo nuevo:** `businessId: string` (formato `biz_NNN`). Permite la query directa `where('userId','==',uid) && where('businessId','==',bId)`, eliminando el fan-out por `documentId() in`.

Documento resultante:

```text
commentLikes/{userId}__{commentId}
  userId: string        // == auth.uid
  commentId: string      // 1+ chars
  businessId: string     // NUEVO — formato biz_NNN
  createdAt: Timestamp   // == request.time
```

### Tipo `CommentLike` (`src/types/business.ts`)

```typescript
export interface CommentLike {
  userId: string;
  commentId: string;
  businessId: string;   // NUEVO
  createdAt: Date;
}
```

### Indice compuesto (`firestore.indexes.json`)

Nuevo indice `COLLECTION` scope sobre `commentLikes`:

```json
{
  "collectionGroup": "commentLikes",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "userId", "order": "ASCENDING" },
    { "fieldPath": "businessId", "order": "ASCENDING" }
  ]
}
```

> El indice existente `commentLikes(userId ASC, createdAt ASC)` se **conserva**. No tiene consumidor verificado hoy (ninguna query lo usa: `fetchRecentCommentLikes` ordena por `createdAt` sin `where('userId')`, `fetchUsersPanelData` usa solo `limit()`, `deleteUserData` filtra por `userId` sin `orderBy`). Se conserva por conservadurismo — borrar indices fuera del scope del feature es out-of-scope y de bajo riesgo, no porque una query especifica lo requiera. El nuevo es aditivo.

### Edge — cache `userCommentLikes` (no cambia de shape)

`useBusinessData` deriva `userCommentLikes` como `Set<commentId>` (string), lo serializa en `readCache` como `string[]` y lo preserva en el merge de `patchedRef` (`useBusinessData.ts:93,117-118`). Este feature **no cambia el shape del Set**: sigue siendo `Set<string>` de `commentId`s. El cambio es solo *como se obtiene* (query directa por field en vez de fan-out por doc ID). No requiere invalidar ni migrar entries cacheadas — el merge `merged.userCommentLikes = prev.userCommentLikes` sigue siendo correcto.

## Firestore Rules

Reemplazo de `match /commentLikes/{docId}` (firestore.rules lineas 172-185). Se elimina el comentario obsoleto (lineas 173-175) que justificaba la imposibilidad de `resource.data` checks — ya no aplica porque la query nueva filtra por field.

```
    // Likes en comentarios — cualquier usuario autenticado puede leer.
    // La query de likes filtra por (userId == auth.uid, businessId), por lo que
    // un usuario solo ve sus propios likes. Owner crea/elimina su like.
    match /commentLikes/{docId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null
        && request.resource.data.keys().hasOnly(['userId', 'commentId', 'businessId', 'createdAt'])
        && request.resource.data.userId == request.auth.uid
        && request.resource.data.commentId is string
        && request.resource.data.commentId.size() > 0
        && isValidBusinessId(request.resource.data.businessId)
        && request.resource.data.createdAt == request.time;
      allow delete: if request.auth != null
        && resource.data.userId == request.auth.uid;
    }
```

> `commentLikes` no tiene `update` rule (solo create/delete) — `businessId` es inmutable por construccion (no hay path de modificacion).

### Rules impact analysis

| Query (service file) | Collection | Auth context | Rule que la permite | Cambio? |
|---------------------|------------|-------------|-------------------|---------|
| query directa likes en `fetchBusinessData` (`businessData.ts`) `where(userId==uid)+where(businessId==bId)` | commentLikes | Owner leyendo sus propios likes | `allow read: if auth != null` (read no filtra por field; el filtro `userId==uid` lo aplica la query) | No (rule de read sin cambio) |
| query directa likes en `fetchSingleCollection('comments')` | commentLikes | idem | idem | No |
| `likeComment(uid, commentId, businessId)` create (`comments.ts`) | commentLikes | Owner creando su like con businessId | `allow create … hasOnly([…,'businessId'])` | **SI** — agregar `businessId` al `hasOnly()` + `isValidBusinessId()` |
| replay offline `comment_like` (`registerOfflineHandlers.ts`) | commentLikes | idem (mismo `likeComment`) | idem create rule | cubierto por el mismo cambio |

> El backfill (`scripts/backfill-commentlikes-businessid.mjs`) corre con Admin SDK (ADC) — bypasea rules. No requiere analisis de rules.

### Field whitelist check

| Collection | Campo nuevo | En create `hasOnly()`? | En update `affectedKeys().hasOnly()`? | Cambio? |
|-----------|-------------|----------------------|--------------------------------------|---------|
| commentLikes | businessId | NO (hoy `['userId','commentId','createdAt']`) | N/A (no hay update rule) | **SI** — agregar `'businessId'` al create `hasOnly()` |

## Cloud Functions

Sin cambios. `onCommentLikeCreated` / `onCommentLikeDeleted` (`functions/src/triggers/commentLikes.ts`) se gatillan por el path `commentLikes/{docId}` — agregar `businessId` al doc no altera el path ni el rate limit (50/dia via `checkRateLimit`). El trigger ya tiene `trackFunctionTiming`.

> **Caso conocido (re-like durante el window de backfill):** un like legacy (sin `businessId`) se ve "no likeado" en la query nueva hasta que el backfill corre. El usuario puede re-likear; el `setDoc` con doc ID compuesto es idempotente y **auto-backfillea** el `businessId` faltante — pero re-escribir el doc **re-dispara `onCommentLikeCreated`**, lo que (a) genera una notificacion duplicada al autor del comentario y (b) consume una unidad del rate limit 50/dia del usuario. **Decision: aceptable.** El window es corto (orden de minutos tras el deploy del codigo, hasta correr `--apply`), el doble-disparo solo afecta a usuarios que re-likean en ese intervalo un comentario que ya habian likeado antes, y el rate limit 50/dia tiene margen suficiente. La mitigacion operativa es minimizar el window: correr `--apply` inmediatamente despues del deploy del codigo (ver orden de rollout en plan).

## Seed Data

El campo `businessId` se agrega a `commentLikes`. **Ambos seeds crean docs `commentLikes` hoy** (verificado: `seed-admin-data.mjs:281`, `seed-staging.ts:241`), por lo que actualizarlos es **obligatorio** — sin el campo, las rules nuevas rechazan los writes del seed y la query directa no encuentra esos likes.

### Emulator seed (`scripts/seed-admin-data.mjs`)

- Coleccion: `commentLikes` (bloque "5c. Comment likes", lineas 270-286).
- El `setDoc` (linea 281-285) debe incluir `businessId`. El `businessId` correcto es el del comentario likeado. Hoy el tracking `commentIds.push({ id: ref.id, userId })` (linea 232) **no captura** `businessId` — el comment write (linea 225) genera `businessId: randomFrom(BUSINESS_IDS)` en una variable local. Cambio: capturar ese `businessId` en una const y pushearlo: `commentIds.push({ id: ref.id, userId, businessId })`. Luego en el like: `{ userId, commentId: comment.id, businessId: comment.businessId, createdAt: daysAgo(...) }`. Hacer lo mismo en el bloque de replies (lineas 249-258) si esos comments tambien se likean.
- Ejemplo resultante: `{ userId: 'seed_user_1', commentId: '<ref.id>', businessId: 'biz_001', createdAt: daysAgo(5) }`.

### Staging seed (`scripts/seed-staging.ts`)

- Coleccion: `commentLikes` (bloque "11. Comment likes", lineas 238-246).
- El like usa `commentId: \`seed_comment_${randomInt(0, 59)}\`` (string sin ref real). Derivar un `businessId` valido del pool: `businessId: BUSINESS_IDS[i % BUSINESS_IDS.length]` (mismo patron que el resto del archivo). Como el `commentId` es sintetico y no apunta a un doc real, el `businessId` no necesita coincidir con un comment existente — solo debe ser un `biz_NNN` valido para pasar las rules y aparecer en la query.
- Ejemplo resultante: `{ userId: USER_IDS[i % USER_IDS.length], commentId: 'seed_comment_3', businessId: BUSINESS_IDS[i % BUSINESS_IDS.length], createdAt: daysAgo(...) }`.

## Componentes

Sin componentes nuevos ni modificados visualmente. La UI de like (`BusinessComments`, `BusinessQuestions` via `useCommentListBase`/`useCommentListBase.ts`) no cambia su markup ni a11y. La unica diferencia es que el estado "ya le diste me gusta" llega junto con los comentarios (dentro del `Promise.all`).

### Mutable prop audit

No aplica — no hay screens de detalle/form editables nuevos. El toggle de like ya usa estado local optimista (`optimisticLikes` Map) en `useCommentListBase`; no cambia.

## Textos de usuario

Sin copy nuevo. Los toasts de error de like ya existen en `MSG_COMMENT.likeError`. Los logs/comentarios del script de backfill van en espanol consistente.

| Texto | Donde se usa | Notas |
|-------|-------------|-------|
| (ninguno nuevo) | — | — |

## Hooks

Sin hooks nuevos. `useCommentListBase` (hook que centraliza el toggle de like de comments y questions) se modifica en un solo punto: la closure que invoca `likeComment` pasa a propagar `businessId` (ver Integracion).

## Servicios

### `likeComment` (`src/services/comments.ts`) — firma modificada

```typescript
export async function likeComment(userId: string, commentId: string, businessId: string): Promise<void> {
  const docId = `${userId}__${commentId}`;
  await setDoc(doc(db, COLLECTIONS.COMMENT_LIKES, docId), {
    userId,
    commentId,
    businessId,             // NUEVO
    createdAt: serverTimestamp(),
  });
  trackEvent('comment_like', { comment_id: commentId });
}
```

- `unlikeComment` no cambia (borra por doc ID).

### `fetchBusinessData` (`src/services/businessData.ts`) — query directa

- Agregar la query de likes como **octavo elemento** del `Promise.all`:

```typescript
measuredGetDocs('businessData_userLikes', query(
  collection(db, COLLECTIONS.COMMENT_LIKES).withConverter(commentLikeConverter),
  where('userId', '==', uid),
  where('businessId', '==', bId),
)),
```

- Mapear el resultado a `Set<string>` directamente desde `d.data().commentId` (ya no se parsea el doc id):
  `const userCommentLikes = new Set(likesSnap.docs.map((d) => d.data().commentId));`
- Eliminar la llamada post-`Promise.all` a `fetchUserLikes` (lineas 148) y la funcion `fetchUserLikes` (lineas 21-50).
- Importar `commentLikeConverter` desde `../config/converters`.

### `fetchSingleCollection('comments')` (`src/services/businessData.ts`)

- En el `case 'comments'`, reemplazar `const userCommentLikes = await fetchUserLikes(uid, ...)` por la misma query directa filtrada por `(userId, businessId)`. Se resuelve junto al snap de comments (puede ser un `Promise.all` interno de 2 queries o secuencial — el shape de retorno `{ comments, userCommentLikes }` no cambia).

### Instrumentacion

- La clave `businessData_userLikes` se conserva (ahora envuelve `measuredGetDocs` de una sola query dentro del `Promise.all`).
- Agregar `businessData_userLikes: 'Detalle: likes del usuario'` a `QUERY_LABELS` en `src/components/admin/perf/perfHelpers.ts` (hoy falta — alineado con #347).

### `commentLikeConverter` (`src/config/converters/businessConverters.ts`)

```typescript
export const commentLikeConverter: FirestoreDataConverter<CommentLike> = {
  toFirestore(like: CommentLike) {
    return { userId: like.userId, commentId: like.commentId, businessId: like.businessId, createdAt: like.createdAt };
  },
  fromFirestore(snapshot, options?) {
    const d = snapshot.data(options);
    return { userId: d.userId, commentId: d.commentId, businessId: d.businessId, createdAt: toDate(d.createdAt) };
  },
};
```

### Script backfill (`scripts/backfill-commentlikes-businessid.mjs`)

Sigue el patron canonico de `scripts/migrate-displayname-lower-sync.mjs`:

- Modos `--audit` (default, read-only) y `--apply`.
- Admin SDK via ADC (`applicationDefault()`), precondicion `checkCredentials()`.
- Bloque CLI gateado por `import.meta.url === file://${process.argv[1]}`.
- Primitivas exportadas para test: `parseMode`, `getDb`, `audit(db)`, `applyBackfill(db, plan)`, `printAuditReport`, `run`.
- Batches de 500 (`BATCH_SIZE`).
- Reads de `comments/{commentId}` agrupados con `db.getAll(...refs)` en chunks de 30 (mismo patron que `fanOutToFollowers` #312, `FANOUT_GETALL_CHUNK_SIZE`), resueltos en paralelo.

Logica de `audit(db)`:

1. `db.collection('commentLikes').get()` → recorrer docs.
2. Clasificar cada doc:
   - `hasBusinessId`: ya tiene `businessId` string valido → skip (idempotencia).
   - candidato: sin `businessId`. Extraer `commentId` (del campo o del doc id `split('__')[1]`).
3. Para los candidatos: chunk de `commentId`s en grupos de 30, `db.getAll(...commentRefs)`. Por cada like:
   - comment existe → categoria `toBackfill` con `{ likeId, businessId: comment.businessId }`.
   - comment NO existe → categoria `orphan` con `{ likeId }`.
4. **Reportar el conteo total de docs legacy** (`total`, `withBusinessId`, `toBackfill`, `orphan`) en el reporte de `--audit`. Este conteo decide si el `--apply` supera el cap de writes/dia del free tier (un backfill = `toBackfill` writes + `orphan` deletes). Si el volumen excede el cap diario, ventanear el `--apply` (correr en multiples dias o con pausa entre lotes). El reporte de `--audit` imprime explicitamente: `"Legacy docs a escribir: <N>. Cap free tier writes/dia: 20000. Ventanear si N supera el cap."`.

Logica de `applyBackfill(db, plan)` (idempotente):

- `plan.toBackfill`: `batch.update(ref, { businessId })`.
- `plan.orphan`: `batch.delete(ref)` (un like sin comentario nunca volveria a leerse por la query nueva).
- Commit cada 500 ops. Re-run tras exito = 0 ops (los docs ya tienen `businessId` o ya fueron borrados).

## Integracion

### Punto 1 — call site del toggle de like (`src/hooks/useCommentListBase.ts:116-122`)

El meta del `withOfflineSupport('comment_like', { userId, businessId, businessName }, ...)` **ya pasa `businessId`** (linea 118). El cambio es que el `onlineAction` propague `businessId` a `likeComment`:

```typescript
() => likeComment(user.uid, commentId, businessId),
```

(`businessId` ya esta en el closure scope del `useCallback`, dependencia listada en linea 131).

### Punto 2 — handler offline `comment_like` (`src/services/registerOfflineHandlers.ts:83-87`)

Hoy el handler destructura `{ userId, payload }` y **NO extrae `businessId`** — llama `likeComment(userId, commentId)` (2 args). El call site SI lo pasa al `OfflineAction` (`businessId` es campo top-level requerido de `OfflineAction`, propagado por `withOfflineSupport` desde el meta). El cambio es la firma de destructuring del handler:

```typescript
comment_like: async ({ userId, businessId, payload }: OfflineAction) => {
  const { commentId } = payload as CommentLikePayload;
  const { likeComment } = await import('./comments');
  await likeComment(userId, commentId, businessId);
},
```

- `CommentLikePayload` (`src/types/offline.ts:110-112`) **no cambia** (`{ commentId }`) — `businessId` viaja en el top-level del `OfflineAction`, no en el payload.
- `comment_unlike` no cambia.

### Preventive checklist

- [x] **Service layer**: la query y el write viven en `src/services/` (`businessData.ts`, `comments.ts`). Ningun componente importa `firebase/firestore` para esto.
- [x] **Duplicated constants**: ninguna constante nueva duplicada. `BATCH_SIZE`/chunk size son locales al script (consistentes con el patron migrate).
- [x] **Context-first data**: no aplica — la query reemplaza otra query, no lee de un context.
- [x] **Silent .catch**: el script usa `logger.error?.(...)` en los catch de batch commit; el toggle conserva `logger.error` + `toast.error` (`useCommentListBase.ts:126-127`).
- [x] **Stale props**: no aplica — sin componentes nuevos con props mutables.

## Tests

| Archivo test | Que testear | Tipo |
|-------------|-------------|------|
| `src/services/businessData.test.ts` (nuevo o ampliado) | Query directa de likes dentro del `Promise.all` mapea a `Set<commentId>` desde `d.data().commentId`; lista de comentarios vacia no rompe (Set vacio); `fetchSingleCollection('comments')` resuelve likes via query directa; `fetchUserLikes` eliminada (no exportada / sin referencias) | Service |
| `src/services/comments.test.ts` (16 cases existentes) | `likeComment` escribe `businessId` en el doc (3er arg en el `setDoc` payload); firma de 3 args; `unlikeComment` sin cambio; actualizar cases que llaman `likeComment` con 2 args | Service |
| `src/config/converters/businessConverters.test.ts` (23 cases existentes) | `commentLikeConverter` round-trip con `businessId` (`toFirestore` incluye `businessId`, `fromFirestore` lo lee) | Converter |
| `src/services/__tests__/registerOfflineHandlers.test.ts` (o el existente del replay) | `comment_like` replay extrae `action.businessId` y lo pasa a `likeComment(userId, commentId, businessId)` — **assertion explicita del 3er arg**; `comment_unlike` sin cambio | Handler |
| `scripts/__tests__/backfill-commentlikes-businessid.test.mjs` | `--audit` no escribe; `audit` clasifica `withBusinessId`/`toBackfill`/`orphan` y reporta `total`; chunking de `getAll` en grupos de 30; `applyBackfill` setea `businessId` desde el comment; orphan (comment borrado) se elimina en `--apply`; idempotencia (re-run = 0 ops); reporte imprime conteo de legacy docs | Script |
| `tests/rules/commentLikes.rules.test.ts` (nuevo) | ALLOW create con `businessId` valido + owner + `commentId` no vacio + `createdAt==request.time`; DENY: `businessId` invalido (no `biz_NNN`), `businessId` ausente, campo extra (`hasOnly`), `userId != auth.uid`, `createdAt != request.time`; ALLOW delete owner; DENY delete no-owner; ALLOW read autenticado | Rules |

### Mock strategy

- Firestore (service tests): mock SDK (`getDocs`, `setDoc`, `collection`, `query`, `where`, `withConverter`). Verificar el payload del `setDoc` incluye `businessId`.
- Analytics: mock `trackEvent`.
- Script: inyectar `db` fake con `collection().get()` y `getAll()` mockeados (sin emulador). Patron del test de `migrate-displayname-lower-sync`.
- Rules: `@firebase/rules-unit-testing` v5 contra emulador, helpers de `tests/rules/setup.ts`.

### Criterio de aceptacion

- Cobertura >= 80% del codigo nuevo.
- Paths condicionales cubiertos: lista vacia, orphan, idempotencia, chunking.
- Side effects: cache shape (Set), analytics `comment_like`, perf `businessData_userLikes`.
- `commentLikes` marca su checkbox allow+deny en el inventario de rules de `tests.md`.

## Analytics

Sin eventos nuevos. `comment_like` ya existe en GA4 definitions y se conserva intacto en `likeComment`.

---

## Offline

### Cache strategy

| Dato | Estrategia | TTL | Storage |
|------|-----------|-----|---------|
| `userCommentLikes` (Set<commentId>) | Entra al `Promise.all` de `useBusinessData` → readCache 3-tier (memory → IndexedDB → Firestore). Shape **identico** al actual | 5 min (memory) / LRU 20 entries (IndexedDB) | `modo-mapa-read-cache` (IndexedDB) + Firestore persistent cache (prod) |

### Writes offline

| Operacion | Mecanismo | Conflict resolution |
|-----------|-----------|-------------------|
| `likeComment` (con businessId) | `withOfflineSupport('comment_like', { userId, businessId, businessName }, { commentId }, ...)` — ya existe. Replay pasa `action.businessId` a `likeComment` | Doc ID compuesto `{userId}__{commentId}` → `setDoc` idempotente (re-like no duplica) |
| `unlikeComment` | `withOfflineSupport('comment_unlike', ...)` — sin cambio | `deleteDoc` idempotente |

### Fallback UI

Sin cambios. El toggle optimista local + `StaleBanner` (cuando datos stale) ya cubren el offline. El boton de like conserva su comportamiento offline.

---

## Accesibilidad y UI mobile

| Componente | Elemento | aria-label | Min touch target | Error state |
|-----------|----------|------------|-----------------|-------------|
| (ninguno nuevo) | — | — | — | — |

Sin elementos interactivos nuevos. El boton de like existente conserva su `aria-label` y el `aria-live="polite"` del contador.

### Reglas

- Sin cambios de UI — no aplican las reglas de IconButton/touch target/img onError.

## Textos y copy

| Texto | Donde | Regla aplicada |
|-------|-------|----------------|
| (ninguno nuevo) | — | — |

### Reglas de copy

- Logs/comentarios del script en espanol consistente.
- Terminologia: "comercios", "comentarios", "me gusta".

---

## Decisiones tecnicas

1. **`businessId` en el top-level del `OfflineAction`, no en el payload.** `OfflineAction.businessId` ya es un campo requerido (`types/offline.ts:41`) y el call site ya lo pasa via el meta de `withOfflineSupport`. No se toca `CommentLikePayload`. Esto minimiza el cambio y mantiene el contrato del replay consistente con los otros handlers (favorite/tag/rating ya leen `businessId` del top-level).

2. **Indice aditivo, no reemplazo.** Se agrega `(userId, businessId)`. El indice `(userId, createdAt)` se conserva por conservadurismo: no tiene consumidor verificado hoy (ninguna query lo usa), pero borrar indices ajenos al scope del feature es out-of-scope y de bajo riesgo.

3. **Orphan cleanup en el backfill.** Un like cuyo comentario fue borrado nunca volveria a leerse por la query nueva (filtra por `businessId`, que el orphan no puede resolver), por lo que no aporta. Hoy **no existe cascade de likes al borrar un comentario** (`onCommentDeleted` solo cascadea las replies huerfanas, no los `commentLikes`), por eso los orphans se acumulan. El backfill es la unica via de limpieza; borrarlos (vs dejarlos con `businessId` vacio) evita basura permanente.

4. **Re-dispatch del trigger en re-like durante el window: aceptado.** Ver seccion Cloud Functions. Window minimizado corriendo `--apply` inmediatamente post-deploy.

5. **Reportar conteo de legacy docs en `--audit`.** Decide si `--apply` supera el cap de writes/dia del free tier; si lo supera, ventanear. El `--audit` lo imprime explicito.

6. **No invalidar cache.** El shape del `Set<commentId>` no cambia; el merge `patchedRef` sigue siendo correcto sin migrar entries cacheadas.

---

## Hardening de seguridad

### Firestore rules requeridas

Ver seccion "Firestore Rules" arriba — el bloque `match /commentLikes/{docId}` con `hasOnly(['userId','commentId','businessId','createdAt'])`, `isValidBusinessId(businessId)`, `userId == auth.uid`, `commentId.size() > 0`, `createdAt == request.time`. Comentario obsoleto (lineas 173-175) eliminado.

### Rate limiting

| Coleccion | Limite | Implementacion |
|-----------|--------|---------------|
| commentLikes | 50/dia | `checkRateLimit` en `onCommentLikeCreated` (ya existe, `snap.ref.delete()` al exceder) — **no se toca** |

### Vectores de ataque mitigados

| Ataque | Mitigacion | Archivo |
|--------|-----------|---------|
| Inyectar `businessId` falso para envenenar query / inflar conteos cross-business | `isValidBusinessId()` (regex `biz_NNN`) en create rule | `firestore.rules` |
| Inyeccion de campo extra | `hasOnly()` whitelist estricta | `firestore.rules` |
| Scraping de likes ajenos | Query siempre filtra `userId == auth.uid`; read rule `auth != null` | `firestore.rules` + `businessData.ts` |
| Spam de likes | Rate limit 50/dia server-side (intacto) | `functions/src/triggers/commentLikes.ts` |
| Backfill con credenciales en disco | ADC (`gcloud auth application-default login`), sin Service Account keys commiteadas | `scripts/backfill-commentlikes-businessid.mjs` |

---

## Deuda tecnica: mitigacion incorporada

Consultado en PRD: no hay issues con labels `security`/`tech debt` abiertos; tech-debt actuales bajo `enhancement`. Issues relacionados: #347 (perf-instrumentation), #344 (offline guard), #342 (deps+secrets).

| Issue | Que se resuelve | Paso del plan |
|-------|----------------|---------------|
| Guard #302 R3 (`docs/reference/guards/302-performance.md`) | Fan-out prohibido → query directa por `(userId, businessId)`; `fetchUserLikes` eliminada | Fase 3 |
| #347 (queries sin label en `QUERY_LABELS`) | `businessData_userLikes` agregada a `QUERY_LABELS` con label en espanol | Fase 3 |
| #344 (offline guard) | Verificar que el replay con `businessId` no rompe la cola existente | Fase 2 + test |

---

## Revisión Técnica (Gate Diego)

**Estado:** VALIDADO CON OBSERVACIONES
**Fecha:** 2026-06-12
**Revisor:** Diego (solution architect)

**Observaciones:** Cobertura PRD→specs completa, data model/security/rollout/offline verificados contra el código y correctos. Dos justificaciones fácticas se corrigieron por contradecir el código: (1) el índice `(userId, createdAt)` no tiene consumidor verificado — `fetchCommentLikeStats` no existe; ninguna query usa el compuesto. Se conserva por conservadurismo, no por uso. (2) `onCommentDeleted` NO cascadea likes (solo replies huérfanas), así que el orphan cleanup del backfill es la única vía de limpieza, no una redundancia con un cascade inexistente. El plan debe respetar: (a) el orden de rollout secuenciado índice→rules→código→backfill con el window de degradación suave documentado; (b) correr `--audit` y validar el conteo de legacy docs contra el cap de writes/día ANTES de `--apply`, ventaneando si excede; (c) actualizar los 4 tests de `fetchUserLikes` en businessData.test.ts (se eliminan junto con la función); (d) el replay offline debe pasar `action.businessId` (3er arg) — handler hoy no lo extrae.
