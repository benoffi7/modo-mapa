# Specs: Ratings trigger sin rate limit server-side

**PRD:** [prd.md](prd.md)
**Fecha:** 2026-03-28

---

## Modelo de datos

Sin cambios en el modelo de datos. La coleccion `ratings` mantiene su estructura existente:

```typescript
interface Rating {
  userId: string;
  businessId: string;
  score: number;       // 1-5
  criteria?: RatingCriteria;
  createdAt: Date;
  updatedAt: Date;
}
```

El rate limit se evalua server-side en el trigger, no requiere campos adicionales. Los registros de abuso se escriben en la coleccion `abuseLogs` existente con Admin SDK.

## Firestore Rules

Sin cambios en Firestore rules. El rate limit es server-side (Cloud Functions), no client-side.

### Rules impact analysis

| Query (service file) | Collection | Auth context | Rule that allows it | Change needed? |
|---------------------|------------|-------------|-------------------|----------------|
| `checkRateLimit` count query (Cloud Function) | `ratings` | Admin SDK (bypasses rules) | N/A | No |
| `logAbuse` write (Cloud Function) | `abuseLogs` | Admin SDK (bypasses rules) | N/A | No |
| `after.ref.delete()` (Cloud Function) | `ratings` | Admin SDK (bypasses rules) | N/A | No |

### Field whitelist check

Sin campos nuevos o modificados. No aplica.

| Collection | New/modified field | In create `hasOnly()`? | In update `affectedKeys().hasOnly()`? | Rule change needed? |
|-----------|-------------------|----------------------|--------------------------------------|-------------------|
| N/A | N/A | N/A | N/A | No |

## Cloud Functions

### Modificacion: `onRatingWritten` en `functions/src/triggers/ratings.ts`

**Cambio:** Agregar `checkRateLimit` y `logAbuse` al path de create, siguiendo el patron de `onFavoriteCreated` en `functions/src/triggers/favorites.ts`.

**Logica:**

1. En el path de create (cuando `!beforeExists && afterExists`):
   - Extraer `userId` del documento creado
   - Llamar a `checkRateLimit(db, { collection: 'ratings', limit: 30, windowType: 'daily' }, userId)`
   - Si `exceeded === true`:
     - Eliminar el documento recien creado via `after.ref.delete()`
     - Registrar en `abuseLogs` via `logAbuse(db, { userId, type: 'rate_limit', collection: 'ratings', detail: 'Exceeded 30 ratings/day' })`
     - Early return (no ejecutar counters, aggregates, ni fan-out)
   - Si no excedido: continuar con el flow normal

**Imports agregados:**

```typescript
import { checkRateLimit } from '../utils/rateLimiter';
import { logAbuse } from '../utils/abuseLogger';
```

Ambas utilidades ya estan testeadas y usadas en 9+ triggers.

## Componentes

Sin cambios en componentes frontend. Este cambio es exclusivamente server-side.

### Mutable prop audit

No aplica. Sin cambios en frontend.

## Textos de usuario

Sin textos nuevos visibles al usuario. El rate limit es transparente al usuario (server-side delete + abuse log).

## Hooks

Sin cambios en hooks.

## Servicios

Sin cambios en servicios frontend.

## Integracion

Este cambio no tiene impacto en el frontend. Solo modifica el trigger `onRatingWritten` en Cloud Functions.

### Preventive checklist

- [x] **Service layer**: No aplica (solo Cloud Functions)
- [x] **Duplicated constants**: No aplica
- [x] **Context-first data**: No aplica
- [x] **Silent .catch**: No aplica
- [x] **Stale props**: No aplica

## Tests

Tests agregados al archivo existente `functions/src/__tests__/triggers/ratings.test.ts`.

| Archivo test | Que testear | Tipo |
|-------------|-------------|------|
| `functions/src/__tests__/triggers/ratings.test.ts` | Rate limit check en create, delete del doc cuando excede, logAbuse cuando excede, flow normal continua si no excede | Unit |

### Casos a cubrir

1. **Create con rate limit NO excedido**: verificar que `checkRateLimit` se llama con los parametros correctos (`collection: 'ratings', limit: 30, windowType: 'daily'`) y el flow continua normalmente (counters, aggregates, fan-out)
2. **Create con rate limit excedido**: verificar que el doc se elimina via `after.ref.delete()`, se llama a `logAbuse` con los parametros correctos, y se hace early return (sin counters, sin aggregates, sin fan-out)
3. **Create sin userId**: verificar que el trigger no crashea (guard defensivo existente: `userId` se extrae de `data.userId`)

### Mock strategy

- `checkRateLimit`: mock default retorna `false` (no excedido); test de rate limit excedido retorna `true`
- `logAbuse`: mock que verifica parametros de llamada
- `after.ref.delete`: mock en el objeto de evento fake

## Analytics

Sin cambios en analytics. Los abuse logs son los registros de monitoreo.

---

## Offline

### Cache strategy

No aplica. Cambio exclusivamente en Cloud Functions.

| Dato | Estrategia | TTL | Storage |
|------|-----------|-----|---------|
| N/A | N/A | N/A | N/A |

### Writes offline

| Operacion | Mecanismo | Conflict resolution |
|-----------|-----------|-------------------|
| Crear rating (offline) | Firestore persistent cache / offline queue | Al sincronizar, el trigger evalua rate limit server-side. Si excede, el doc se elimina |

### Fallback UI

Sin cambios. El comportamiento offline existente (optimistic UI con `pendingRating`) no se modifica.

---

## Decisiones tecnicas

1. **Solo rate limit en create, no en update/delete**: Un usuario solo puede tener 1 rating por negocio (doc ID compuesto `{userId}__{businessId}`), asi que updates no son un vector de abuso por volumen. Deletes no generan fan-out ni aggregates costosos.

2. **Limite de 30/dia**: La app tiene ~40 negocios. Un usuario legitimo no calificaria mas de 30 en un solo dia. El limite es suficientemente alto para no interferir con uso normal y suficientemente bajo para prevenir abuso automatizado.

3. **Patron identico a favorites**: Se sigue el patron exacto de `onFavoriteCreated` para consistencia del codebase. Las utilidades `checkRateLimit` y `logAbuse` ya estan testeadas y usadas en 9+ triggers.

---

## Hardening de seguridad

### Firestore rules requeridas

Sin cambios. Las rules existentes de `ratings` ya validan ownership, score 1-5, y timestamps. El rate limit es server-side via Cloud Functions.

### Rate limiting

| Coleccion | Limite | Implementacion |
|-----------|--------|---------------|
| `ratings` | 30/dia por usuario | `checkRateLimit` en `onRatingWritten` create path |

### Vectores de ataque mitigados

| Ataque | Mitigacion | Archivo |
|--------|-----------|---------|
| Bot crea ratings en loop (fan-out + aggregates + counters) | `checkRateLimit` 30/dia + delete + `logAbuse` | `functions/src/triggers/ratings.ts` |
| Bot delete+create loop para resetear rate limit | Rate limit cuenta creates totales del dia (query `createdAt >= startOfDay`), cada create cuenta | `functions/src/utils/rateLimiter.ts` |
| Field injection en ratings | `hasOnly()` en Firestore rules (preexistente) | `firestore.rules` |

---

## Deuda tecnica: mitigacion incorporada

No hay issues abiertos de seguridad o deuda tecnica relacionados con este cambio.

| Issue | Que se resuelve | Paso del plan |
|-------|----------------|---------------|
| #223 | Cierra la brecha de rate limiting en `ratings`, la unica coleccion user-writable con trigger que no tenia `checkRateLimit` | Fase 1, paso 1 |
