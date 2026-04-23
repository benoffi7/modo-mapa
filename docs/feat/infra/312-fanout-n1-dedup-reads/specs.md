# Specs: Tech Debt — fanOut N+1 Dedup Reads

**PRD:** [prd.md](prd.md)
**Fecha:** 2026-04-23

---

## Modelo de datos

Sin cambios de schema. Las colecciones `_fanoutDedup` y `activityFeed/{userId}/items` mantienen exactamente la misma estructura. Este cambio es puramente de implementacion interna.

### Tipos relevantes (sin modificacion)

```typescript
// Interno a fanOut.ts — sin cambio
interface FanOutData {
  actorId: string;
  actorName: string;
  type: 'rating' | 'comment' | 'favorite';
  businessId: string;
  businessName: string;
  referenceId: string;
}

// Resultado de db.getAll() — Admin SDK
// firebase-admin/firestore: DocumentSnapshot[]
// El metodo acepta ...DocumentReference[] y devuelve Promise<DocumentSnapshot[]>
// Limite del Admin SDK: 30 refs por llamada
```

### Nueva constante auxiliar

```typescript
// functions/src/constants/fanOut.ts — agregar
/** Max refs per db.getAll() call (Admin SDK hard limit). */
export const FANOUT_GETALL_CHUNK_SIZE = 30;
```

---

## Firestore Rules

Sin cambios. Las reglas de `_fanoutDedup` y `activityFeed` no se modifican; ambas colecciones son de acceso exclusivo del Admin SDK.

### Rules impact analysis

| Query (archivo) | Coleccion | Auth context | Regla que lo permite | Cambio necesario? |
|----------------|-----------|-------------|---------------------|------------------|
| `db.getAll(...refs)` en chunks | `_fanoutDedup` | Admin SDK (server) | Admin SDK bypasea rules | No |
| `batch.set(dedupRef, ...)` | `_fanoutDedup` | Admin SDK (server) | Admin SDK bypasea rules | No |
| `batch.set(feedRef, ...)` | `activityFeed/{uid}/items` | Admin SDK (server) | Admin SDK bypasea rules | No |

### Field whitelist check

No aplica. Ninguna coleccion escrita por clientes esta involucrada. El Admin SDK bypasea `hasOnly()`.

---

## Cloud Functions

Sin nuevas Cloud Functions. El cambio es un refactor interno de `functions/src/utils/fanOut.ts`, invocado por los triggers existentes de ratings, comments y favorites.

---

## Seed Data

No aplica. Sin cambios de schema.

---

## Componentes

No aplica. Cambio puramente server-side.

---

## Hooks

No aplica.

---

## Servicios

No aplica. El cambio vive en `functions/src/utils/` (utility de Cloud Functions, no en `src/services/` del frontend).

---

## Implementacion — `fanOutToFollowers` refactorizado

### Algoritmo batch dedup (S1)

El loop actual hace un `await dedupRef.get()` por cada follower (N reads secuenciales). El nuevo algoritmo:

1. Construir el array de `{ followerId, dedupKey, dedupRef }` para todos los followers en un solo pase (sin I/O).
2. Dividir los refs de dedup en chunks de `FANOUT_GETALL_CHUNK_SIZE` (30).
3. Ejecutar `Promise.all(chunks.map(chunk => db.getAll(...chunk)))` — paralelo entre chunks, cada chunk es una sola llamada de red.
4. Aplanar los resultados en un `Map<string, DocumentSnapshot>` indexado por `dedupKey`.
5. El loop de escritura de batch consulta el Map local — cero reads adicionales.

### Pseudocodigo del refactor

```typescript
// Fase 1: preparar refs (sin I/O)
const entries = recipients.map((followDoc) => {
  const followerId = followDoc.data().followerId as string;
  const dedupKey = fanOutDedupKey(data.actorId, data.type, data.businessId, followerId);
  const dedupRef = db.collection('_fanoutDedup').doc(dedupKey);
  return { followerId, dedupKey, dedupRef };
});

// Fase 2: batch reads en paralelo
const batchStartMs = performance.now();
const chunks: typeof entries[0]['dedupRef'][][] = [];
for (let i = 0; i < entries.length; i += FANOUT_GETALL_CHUNK_SIZE) {
  chunks.push(entries.slice(i, i + FANOUT_GETALL_CHUNK_SIZE).map((e) => e.dedupRef));
}
const snapArrays = await Promise.all(chunks.map((chunk) => db.getAll(...chunk)));
await trackFunctionTiming('fanOutDedupBatch', batchStartMs); // S3 opcional

// Fase 3: construir Map local
const dedupMap = new Map<string, FirebaseFirestore.DocumentSnapshot>();
let snapIdx = 0;
for (const chunkSnaps of snapArrays) {
  for (const snap of chunkSnaps) {
    dedupMap.set(entries[snapIdx].dedupKey, snap);
    snapIdx++;
  }
}

// Fase 4: loop de escritura (sin I/O de lectura)
let batch = db.batch();
let count = 0;
for (const { followerId, dedupKey, dedupRef } of entries) {
  const dedupSnap = dedupMap.get(dedupKey);
  if (dedupSnap?.exists) {
    const raw = dedupSnap.get('createdAt');
    // ... misma logica de cutoff que hoy ...
    if (createdAtMs >= cutoff) continue;
  }
  // ... batch.set(dedupRef, ...) y batch.set(feedRef, ...) igual que hoy ...
}
```

### Ajuste de constante (S2)

`FANOUT_MAX_RECIPIENTS_PER_ACTION` baja de 5000 a 500. Esto alinea el cap con la descripcion del hotspot H-3 e implica un maximo teorico de `ceil(500/30) = 17` llamadas `getAll` por invocacion.

El comentario JSDoc en `functions/src/constants/fanOut.ts` debe explicar la razon del valor (cota conservadora hasta tener datos de uso real; fan-out selectivo queda para un issue futuro).

### Timing granular (S3, opcional pero recomendado)

Agregar `trackFunctionTiming('fanOutDedupBatch', batchStartMs)` inmediatamente despues del `Promise.all` de chunks, antes de construir el Map. Esto permite al Admin Panel de Performance detectar regresiones en la fase de reads de dedup de forma independiente al timing total de `fanOutToFollowers`.

---

## Integracion

`fanOutToFollowers` es llamada sin cambios de firma desde:

- `functions/src/triggers/ratings.ts`
- `functions/src/triggers/comments.ts`
- `functions/src/triggers/favorites.ts`

Ninguno de estos archivos requiere modificacion. La interfaz `FanOutData` no cambia.

### Preventive checklist

- [x] **Service layer**: Cambio en Cloud Functions utils — sin imports de `firebase/firestore` en frontend.
- [x] **Duplicated constants**: `FANOUT_GETALL_CHUNK_SIZE` es nueva, no duplica nada existente.
- [x] **Context-first data**: No aplica — server-side.
- [x] **Silent .catch**: El `Promise.all` de chunks no tiene `.catch` silencioso — un fallo propaga y Cloud Functions reintenta automaticamente. Comportamiento correcto.
- [x] **Stale props**: No aplica — server-side.

---

## Tests

### Cambios al mock de `buildDb`

El mock existente en `fanOut.test.ts` tiene `dedupCollection.doc` con `.get()` individual. Necesita agregar `getAll` como metodo del objeto `db`:

```typescript
getAll: vi.fn().mockImplementation(async (...refs: Array<{ _path: string; _dedupKey?: string }>) => {
  return refs.map((ref) => {
    // El ref debe exponer _dedupKey para que el mock pueda resolver el estado
    const key = ref._dedupKey ?? ref._path.split('/').pop() ?? '';
    const existing = state.dedup.get(key);
    return {
      exists: existing !== undefined,
      get: (k: string) => (k === 'createdAt' ? existing?.createdAt : undefined),
    };
  });
}),
```

Los refs construidos en `fanOut.ts` deben incluir `_dedupKey` como propiedad de test. Para esto, `db.collection('_fanoutDedup').doc(dedupKey)` en el mock devuelve un objeto con `_dedupKey: dedupKey` ademas de `_path`.

Actualizar `dedupCollection.doc` en `buildDb`:

```typescript
const dedupCollection = {
  doc: vi.fn().mockImplementation((id: string) => ({
    _path: `_fanoutDedup/${id}`,
    _dedupKey: id,          // nuevo: para que getAll pueda resolver
    get: vi.fn().mockResolvedValue({ ... }),  // se mantiene por backward compat
  })),
};
```

### Casos de test a agregar/modificar

| Caso | Verificacion clave |
|------|--------------------|
| 1 follower sin dedup previo | `db.getAll` llamado 1 vez con 1 ref; 1 feed write + 1 dedup write |
| 31 followers sin dedup previo | `db.getAll` llamado 2 veces (chunk 30 + chunk 1); 31 feed writes |
| 31 followers, primeros 30 con dedup fresco | `db.getAll` llamado 2 veces; solo 1 feed write (el follower 31) |
| Dedup expirado | Se sobreescribe; 1 feed write + 1 dedup write |
| `profilePublic === false` | Early return antes de `getAll`; `db.getAll` nunca llamado |
| Sin followers | Early return antes de `getAll`; `db.getAll` nunca llamado |
| Cap de 500 | `getAll` nunca recibe mas de 500 refs en total; `Math.ceil(500/30) = 17` llamadas |
| Batch de escrituras (>250 recipients) | Multiples commits cuando `count >= 500` (2 writes/recipient) |
| `trackFunctionTiming` en todos los paths | Llamado exactamente 1 vez en early-return (profilePublic), early-return (sin followers), y path normal |
| `db.getAll` no delega a `.get()` individual | El spy de `dedupCollection.doc().get` NO recibe llamadas en el path normal |

### Archivo test

| Archivo | Que testear | Tipo |
|---------|-------------|------|
| `functions/src/__tests__/utils/fanOut.test.ts` | Todos los casos arriba + casos existentes migrados | Unit (vitest, env: node) |

### Criterios

- Cobertura >= 100% del codigo modificado en `fanOut.ts` (nivel actual del archivo — mantener).
- `db.getAll` llamado exactamente `ceil(n/30)` veces para n followers.
- `dedupCollection.doc().get` (read individual) no recibe llamadas en el path normal post-refactor.

---

## Analytics

Sin nuevos eventos de analytics. `trackFunctionTiming` no es analytics de usuario, es instrumentacion de performance del Admin Panel.

---

## Offline

No aplica. Cloud Function server-side.

---

## Accesibilidad y UI mobile

No aplica. Sin cambios de UI.

---

## Textos y copy

No aplica. Sin cambios de UI.

---

## Decisiones tecnicas

### Por que `db.getAll()` en chunks de 30 y no en un solo batch

El metodo `getAll` del Admin SDK de Firebase tiene un limite de 30 referencias por llamada (documentado en la API). Pasar mas de 30 provoca un error en runtime. Los chunks se ejecutan en paralelo via `Promise.all`, lo que minimiza la latencia total: para 500 followers, son 17 llamadas paralelas en lugar de 500 secuenciales.

### Por que no usar `runTransaction` para leer y escribir atomicamente

El patron dedup no requiere atomicidad estricta en la lectura. Si dos invocaciones concurrentes pasan el check de dedup simultaneamente, el resultado es un duplicado de feed item, que es aceptable (el receptor ve 2 notificaciones en vez de 1, en el peor caso). La alternativa de usar transacciones para 500 recipients en lotes de 30 aumentaria dramaticamente la complejidad y el riesgo de contention.

### Por que 500 como nuevo cap de `FANOUT_MAX_RECIPIENTS_PER_ACTION`

500 implica un maximo de `ceil(500/30) = 17` reads de dedup + 1 read de follows + 1 read de userSettings = 19 reads por invocacion. Con el cap anterior de 5000, el worst-case era 5000 reads secuenciales. 500 es conservador para el volumen actual de usuarios; puede revisarse cuando haya datos reales de distribucion de seguidores.

### Alternativas descartadas (out of scope, documentadas en PRD)

- Migrar dedup a campo `lastFanOutAt` en el doc del actor — requiere cambio de schema y rules, mas riesgo.
- Redis/Memorystore — costo y complejidad desproporcionados.
- Fan-out selectivo basado en frecuencia del actor — requiere logica adicional de throttling.

---

## Hardening de seguridad

### Firestore rules requeridas

Sin cambios. `_fanoutDedup` y `activityFeed` son escritos exclusivamente por el Admin SDK.

### Rate limiting

Sin cambios. El rate limit que mitiga el abuso indirecto del fan-out (ratings/comentarios/favoritos masivos desde bots) ya existe en los triggers de esas colecciones:
- Ratings: 30/dia
- Comments: 20/dia
- Follows: 50/dia

### Vectores de ataque mitigados

| Ataque | Mitigacion | Archivo |
|--------|-----------|---------|
| Amplificacion de billing via fan-out masivo | Cap de 500 recipients + 17 batch reads maximo | `functions/src/constants/fanOut.ts` |
| Path injection en dedupKey | SHA-256 de datos internos; no user-supplied | `functions/src/utils/fanOut.ts` |
| Timeout de CF por reads secuenciales | `Promise.all` de chunks reduce latencia de O(n) a O(ceil(n/30)) | `functions/src/utils/fanOut.ts` |

---

## Deuda tecnica: mitigacion incorporada

| Issue | Que se resuelve | Paso del plan |
|-------|----------------|---------------|
| #312 (este issue) | Elimina hotspot H-3: N+1 reads de dedup en `fanOutToFollowers` | Fase 1 completa |
| #300 (cerrado, dejó pendiente) | Completar lo que el `.limit()` de #300 inicio — acotar reads internos | Fase 1, paso 1 |
