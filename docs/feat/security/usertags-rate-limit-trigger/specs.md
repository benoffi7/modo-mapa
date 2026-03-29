# Specs: userTags Rate Limit Trigger

**PRD:** [prd.md](prd.md)
**Fecha:** 2026-03-28

---

## Modelo de datos

No se agregan colecciones ni campos nuevos. El feature opera sobre la coleccion `userTags` existente y escribe en colecciones de infraestructura ya establecidas (`config/counters`, `abuseLogs`).

### Tipos existentes referenciados

```typescript
// userTags doc (ya existente)
interface UserTag {
  userId: string;
  businessId: string;
  tagId: string;       // uno de los 6 predefinidos
  createdAt: Date;
}

// abuseLogs doc (ya existente)
interface AbuseLog {
  id: string;
  userId: string;
  type: string;        // 'rate_limit'
  collection: string;  // 'userTags'
  detail: string;
  timestamp: Date;
}
```

## Firestore Rules

No se requieren cambios. Las reglas de `userTags` ya incluyen:

- `request.auth != null` para read
- `keys().hasOnly(['userId', 'businessId', 'tagId', 'createdAt'])` para create
- Ownership validation (`request.resource.data.userId == request.auth.uid`)
- `createdAt == request.time`
- Owner-only delete

### Rules impact analysis

| Query (service file) | Collection | Auth context | Rule that allows it | Change needed? |
|---------------------|------------|-------------|-------------------|----------------|
| `snap.ref.delete()` (trigger, Admin SDK) | userTags | Admin SDK (bypasses rules) | N/A — Admin SDK | No |
| `logAbuse(db, ...)` (trigger, Admin SDK) | abuseLogs | Admin SDK | N/A — Admin SDK | No |
| `incrementCounter(db, ...)` (trigger, Admin SDK) | config | Admin SDK | N/A — Admin SDK | No |
| `checkRateLimit(db, ...)` (trigger, Admin SDK) | userTags | Admin SDK | N/A — Admin SDK | No |

Todos los accesos son desde Cloud Functions usando Admin SDK, que bypasea Firestore rules.

### Field whitelist check

No se agregan ni modifican campos en ninguna coleccion. No aplica.

| Collection | New/modified field | In create `hasOnly()`? | In update `affectedKeys().hasOnly()`? | Rule change needed? |
|-----------|-------------------|----------------------|--------------------------------------|-------------------|
| N/A | N/A | N/A | N/A | No |

## Cloud Functions

### `onUserTagCreated` (trigger)

- **Trigger path:** `userTags/{tagId}` via `onDocumentCreated`
- **Logica:**
  1. Obtener `snap` del evento. Si es null, return early.
  2. Extraer `userId` del documento.
  3. Llamar `checkRateLimit(db, { collection: 'userTags', limit: 100, windowType: 'daily' }, userId)`.
  4. Si excede: `snap.ref.delete()` + `logAbuse(db, { userId, type: 'rate_limit', collection: 'userTags', detail: 'Exceeded 100 userTags/day' })` + return.
  5. Si no excede: `incrementCounter(db, 'userTags', 1)` + `trackWrite(db, 'userTags')`.

### `onUserTagDeleted` (trigger)

- **Trigger path:** `userTags/{tagId}` via `onDocumentDeleted`
- **Logica:**
  1. `incrementCounter(db, 'userTags', -1)`
  2. `trackDelete(db, 'userTags')`

## Componentes

No hay componentes nuevos ni modificados. Este feature es 100% backend.

### Mutable prop audit

No aplica. Sin cambios frontend.

## Textos de usuario

No aplica. Sin textos user-facing nuevos.

## Hooks

No hay hooks nuevos ni modificados.

## Servicios

No hay servicios nuevos ni modificados.

## Integracion

### Registro en `functions/src/index.ts`

Exportar ambos triggers:

```typescript
export { onUserTagCreated, onUserTagDeleted } from './triggers/userTags';
```

Se integra junto con los demas triggers existentes (comments, commentLikes, favorites, priceLevels, customTags, etc.) que ya siguen el mismo patron.

### Preventive checklist

- [x] **Service layer**: No aplica -- solo Cloud Functions, sin cambios frontend.
- [x] **Duplicated constants**: No aplica -- usa utils existentes (`checkRateLimit`, `incrementCounter`, etc.).
- [x] **Context-first data**: No aplica -- sin lecturas frontend.
- [x] **Silent .catch**: No aplica -- el trigger usa async/await sin catch (errores se propagan a Cloud Functions runtime).
- [x] **Stale props**: No aplica -- sin componentes.

## Tests

| Archivo test | Que testear | Tipo |
|-------------|-------------|------|
| `functions/src/__tests__/triggers/userTags.test.ts` | Rate limit enforcement, counter increment, abuse logging, delete tracking | Unit |

### Casos a cubrir

1. **onCreate -- happy path**: documento creado sin exceder rate limit. Verifica `incrementCounter(db, 'userTags', 1)` y `trackWrite(db, 'userTags')` llamados.
2. **onCreate -- rate limit exceeded**: `checkRateLimit` retorna `true`. Verifica `snap.ref.delete()` llamado, `logAbuse` llamado con datos correctos, `incrementCounter` NO llamado.
3. **onCreate -- snap null**: `event.data` es null. Verifica return early sin llamar a ninguna funcion.
4. **onDelete -- happy path**: Verifica `incrementCounter(db, 'userTags', -1)` y `trackDelete(db, 'userTags')` llamados.

### Mock strategy

- `firebase-functions/v2/firestore`: mock `onDocumentCreated`/`onDocumentDeleted` para exponer handlers directamente.
- `../helpers/env`: mock `getDb()` retornando un mock de Firestore.
- `../utils/rateLimiter`: mock `checkRateLimit`.
- `../utils/counters`: mock `incrementCounter`, `trackWrite`, `trackDelete`.
- `../utils/abuseLogger`: mock `logAbuse`.
- `snap.ref.delete()`: mock en el objeto snap del evento.

Patron identico al de `comments.test.ts` y `commentLikes.test.ts`.

## Analytics

No se agregan eventos de analytics nuevos. El tracking de actividad se realiza via `trackWrite`/`trackDelete` en `config/counters` (infraestructura existente).

---

## Offline

### Cache strategy

No aplica. Este feature no modifica comportamiento offline del cliente.

| Dato | Estrategia | TTL | Storage |
|------|-----------|-----|---------|
| N/A | N/A | N/A | N/A |

### Writes offline

Los writes de `userTags` ya tienen soporte offline via Firestore persistent cache. El trigger se ejecuta cuando el write llega al servidor (no cambia con este feature).

| Operacion | Mecanismo | Conflict resolution |
|-----------|-----------|-------------------|
| Tag toggle (create/delete) | Firestore persistent cache | Last-write-wins (Firestore default) |

### Fallback UI

Sin cambios. El componente `BusinessTags` ya maneja optimistic UI.

---

## Decisiones tecnicas

1. **Rate limit de 100/dia**: Consistente con `favorites` (100/dia). Un usuario normal no va a votar mas de 240 combinaciones posibles (6 tags x 40 negocios) en un dia, pero un bot si. 100 es un limite generoso para uso legitimo.

2. **Sin guard de `userId` ausente**: A diferencia de `favorites.ts` que tiene un `if (userId)` guard, `userTags` siempre requiere `userId` en las rules de create (`request.resource.data.userId == request.auth.uid`). Si el doc llego al trigger, tiene `userId`. Se accede directamente como `data.userId`.

3. **Sin fan-out**: Los tags no son una accion social relevante para el activity feed. No se notifica a seguidores.

4. **Sin businessCount aggregation**: A diferencia de favorites que mantiene `businessFavorites`, los tags ya se agregan por tag-business en el frontend con queries directas. No se necesita un counter agregado.

---

## Hardening de seguridad

### Firestore rules requeridas

Sin cambios. Las rules existentes ya cubren:

```
match /userTags/{docId} {
  allow read: if request.auth != null;
  allow create: if request.auth != null
    && request.resource.data.keys().hasOnly(['userId', 'businessId', 'tagId', 'createdAt'])
    && request.resource.data.userId == request.auth.uid
    && request.resource.data.createdAt == request.time;
  allow delete: if request.auth != null
    && resource.data.userId == request.auth.uid;
}
```

### Rate limiting

| Coleccion | Limite | Implementacion |
|-----------|--------|---------------|
| `userTags` | 100/dia por usuario | `checkRateLimit` en `onUserTagCreated` |

### Vectores de ataque mitigados

| Ataque | Mitigacion | Archivo |
|--------|-----------|---------|
| Bot crea cientos de tags/dia para manipular votos | Rate limit 100/dia + delete doc si excede + logAbuse | `functions/src/triggers/userTags.ts` |
| Bot alterna create/delete para evadir rate limit | `checkRateLimit` cuenta creates totales del dia (no docs actuales) | `functions/src/utils/rateLimiter.ts` (existente) |
| Field injection en userTags | `keys().hasOnly()` en Firestore rules | `firestore.rules` (existente) |
| Delete de tags ajenos | Ownership check `resource.data.userId == request.auth.uid` | `firestore.rules` (existente) |

---

## Deuda tecnica: mitigacion incorporada

No hay issues abiertos de security ni tech debt en este momento.

Este feature cierra el gap de rate limiting para `userTags`, alineando las 8 colecciones user-facing escritas desde el cliente con triggers server-side.

| Issue | Que se resuelve | Paso del plan |
|-------|----------------|---------------|
| #222 | userTags sin rate limit ni tracking | Fase 1, pasos 1-3 |
