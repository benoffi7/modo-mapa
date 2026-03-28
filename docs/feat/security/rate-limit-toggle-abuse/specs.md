# Specs: Rate limit en favorites, userTags, customTags, priceLevels, commentLikes

**PRD:** [prd.md](prd.md)
**Fecha:** 2026-03-28

---

## Modelo de datos

No se agregan colecciones ni campos nuevos. Los cambios son exclusivamente en Cloud Functions triggers. Las colecciones afectadas (`favorites`, `userTags`, `priceLevels`, `customTags`, `commentLikes`) ya existen con sus tipos definidos en `src/types/`.

La coleccion `abuseLogs` ya existe y recibe los registros de abuso via `logAbuse()`.

## Firestore Rules

No se requieren cambios en Firestore rules. La proteccion es enteramente server-side via Cloud Functions triggers.

### Rules impact analysis

| Query (trigger file) | Collection | Auth context | Rule that allows it | Change needed? |
|---------------------|------------|-------------|-------------------|----------------|
| `checkRateLimit` en favorites | `favorites` | Admin SDK (Cloud Functions) | Admin SDK bypasses rules | No |
| `snap.ref.delete()` en favorites | `favorites` | Admin SDK (Cloud Functions) | Admin SDK bypasses rules | No |
| `logAbuse` en favorites | `abuseLogs` | Admin SDK (Cloud Functions) | Admin SDK bypasses rules | No |
| `checkRateLimit` en userTags | `userTags` | Admin SDK (Cloud Functions) | Admin SDK bypasses rules | No |
| `incrementCounter` en userTags | `config` | Admin SDK (Cloud Functions) | Admin SDK bypasses rules | No |
| `checkRateLimit` en priceLevels | `priceLevels` | Admin SDK (Cloud Functions) | Admin SDK bypasses rules | No |
| `checkRateLimit` daily en customTags | `customTags` | Admin SDK (Cloud Functions) | Admin SDK bypasses rules | No |

Todas las operaciones se ejecutan desde Cloud Functions con Admin SDK, que bypasea las Firestore rules. No hay queries nuevas desde el cliente.

### Field whitelist check

No se agregan ni modifican campos en ninguna coleccion. No se requieren cambios en `hasOnly()`.

| Collection | New/modified field | In create `hasOnly()`? | In update `affectedKeys().hasOnly()`? | Rule change needed? |
|-----------|-------------------|----------------------|--------------------------------------|-------------------|
| N/A | N/A | N/A | N/A | No |

## Cloud Functions

### S1. Modificar `onFavoriteCreated` (favorites.ts)

Agregar `checkRateLimit` con `{ collection: 'favorites', limit: 100, windowType: 'daily' }` al inicio del trigger, antes de counters y fan-out. Si excede: `snap.ref.delete()` + `logAbuse()` + return early.

Patron identico a `onCheckInCreated` en `functions/src/triggers/checkins.ts`.

Requiere acceso a `snap` y `snap.ref`, lo que implica cambiar la firma del trigger de `async (event)` con `event.data?.data()` a usar `event.data` como snapshot (patron actual de checkins/comments).

### S2. Crear triggers `userTags.ts`

Nuevo archivo `functions/src/triggers/userTags.ts` con dos triggers:

- **`onUserTagCreated`**: `checkRateLimit` (100/dia daily) + `incrementCounter` + `trackWrite`. Si excede: `snap.ref.delete()` + `logAbuse()` + return.
- **`onUserTagDeleted`**: `incrementCounter(-1)` + `trackDelete`.

Patron identico a `checkins.ts`.

### S3. Modificar `onPriceLevelCreated` (priceLevels.ts)

Agregar `checkRateLimit` con `{ collection: 'priceLevels', limit: 50, windowType: 'daily' }`. Si excede: `snap.ref.delete()` + `logAbuse()` + return early.

Requiere acceso a `event.data` para obtener `snap.ref` y `userId`.

### S4. Modificar `onCustomTagCreated` (customTags.ts)

Agregar un segundo `checkRateLimit` con `{ collection: 'customTags', limit: 50, windowType: 'daily' }` **antes** del rate limit per-entity existente. El daily check es mas barato (una sola count query sin filtro de businessId) y short-circuits antes del per-entity check.

Orden de checks:
1. Daily rate limit (50/dia) -- nuevo
2. Per-entity rate limit (10/business) -- existente
3. Content moderation -- existente

### S5. Modificar `onCommentLikeCreated` (commentLikes.ts)

Agregar `logAbuse()` dentro del bloque `if (exceeded)`, despues de `snap.ref.delete()`. Actualmente solo hace delete sin registrar el abuso.

```typescript
if (exceeded) {
  await snap.ref.delete();
  await logAbuse(db, {
    userId,
    type: 'rate_limit',
    collection: 'commentLikes',
    detail: 'Exceeded 50 commentLikes/day',
  });
  return;
}
```

## Componentes

No hay cambios en componentes frontend. Todos los cambios son en Cloud Functions.

### Mutable prop audit

N/A -- no hay componentes UI afectados.

## Textos de usuario

No hay textos nuevos visibles al usuario. Los rate limits son transparentes (el doc se elimina server-side).

## Hooks

No hay cambios en hooks frontend.

## Servicios

No hay cambios en servicios frontend.

## Integracion

### Archivo `functions/src/index.ts`

Agregar exports para los nuevos triggers de userTags:

```typescript
export { onUserTagCreated, onUserTagDeleted } from './triggers/userTags';
```

### Archivo `docs/reference/security.md`

Actualizar la tabla "Rate limiting server-side (triggers)" con las 4 colecciones nuevas/modificadas:

| Coleccion | Limite |
|-----------|--------|
| `comments` | 20/dia por usuario |
| `commentLikes` | 50/dia por usuario |
| `customTags` | 10/business por usuario + 50/dia por usuario |
| `favorites` | 100/dia por usuario |
| `feedback` | 5/dia por usuario |
| `priceLevels` | 50/dia por usuario |
| `userTags` | 100/dia por usuario |

### Preventive checklist

- [x] **Service layer**: No aplica -- solo Cloud Functions triggers, no hay cambios frontend
- [x] **Duplicated constants**: Los limites (100, 50, etc.) son inline en cada trigger como el patron existente (comments usa `limit: 20` inline)
- [x] **Context-first data**: No aplica -- solo backend
- [x] **Silent .catch**: No aplica -- triggers usan async/await sin catch (errores propagan al runtime de Cloud Functions)
- [x] **Stale props**: No aplica -- no hay componentes UI

## Tests

| Archivo test | Que testear | Tipo |
|-------------|-------------|------|
| `functions/src/__tests__/triggers/favorites.test.ts` | Rate limit check en create, delete del doc si excede, logAbuse call, flujo normal sin cambios | Trigger (modificar existente) |
| `functions/src/__tests__/triggers/userTags.test.ts` | Rate limit check en create, counter increment/decrement, delete del doc si excede, logAbuse call, skip si no hay snap | Trigger (nuevo) |
| `functions/src/__tests__/triggers/priceLevels.test.ts` | Rate limit check en create, delete del doc si excede, logAbuse call, flujo normal preserved, update sin rate limit | Trigger (nuevo) |
| `functions/src/__tests__/triggers/customTags.test.ts` | Rate limit daily adicional, interaccion daily + per-entity, logAbuse en ambos excesos | Trigger (nuevo) |
| `functions/src/__tests__/triggers/commentLikes.test.ts` | logAbuse call cuando excede (agregar caso al test existente) | Trigger (modificar existente) |

### Casos a cubrir

**favorites.test.ts (agregar ~4 casos):**
- Rate limit exceeded: snap.ref.delete + logAbuse + no counters/fanout
- Rate limit NOT exceeded: flujo existente sin cambios
- Skip si no hay snap

**userTags.test.ts (nuevo, ~6 casos):**
- onUserTagCreated: normal flow (counter + trackWrite)
- onUserTagCreated: rate limit exceeded (delete + logAbuse + no counters)
- onUserTagCreated: skip si no hay snap
- onUserTagDeleted: normal flow (counter decrement + trackDelete)

**priceLevels.test.ts (nuevo, ~5 casos):**
- onPriceLevelCreated: normal flow (counter + trackWrite)
- onPriceLevelCreated: rate limit exceeded (delete + logAbuse + no counters)
- onPriceLevelCreated: skip si no hay snap
- onPriceLevelUpdated: trackWrite (sin rate limit)

**customTags.test.ts (nuevo, ~8 casos):**
- onCustomTagCreated: normal flow completo (daily OK + per-entity OK + moderation OK)
- onCustomTagCreated: daily rate limit exceeded (delete + logAbuse + no further checks)
- onCustomTagCreated: daily OK pero per-entity exceeded (delete + logAbuse)
- onCustomTagCreated: ambos OK pero moderation flags (flagged + logAbuse)
- onCustomTagCreated: skip si no hay snap
- onCustomTagDeleted: counter decrement + trackDelete

**commentLikes.test.ts (agregar ~1 caso):**
- Rate limit exceeded: verify logAbuse IS called (currently only checks delete)

### Mock strategy

Patron identico al existente en `commentLikes.test.ts` y `favorites.test.ts`:
- `vi.mock('../../utils/rateLimiter')` con `mockCheckRateLimit`
- `vi.mock('../../utils/counters')` con `mockIncrementCounter`, `mockTrackWrite`, `mockTrackDelete`
- `vi.mock('../../utils/abuseLogger')` con `mockLogAbuse`
- Handler registry via `vi.mock('firebase-functions/v2/firestore')`

### Criterio de aceptacion

- Cobertura >= 80% del codigo nuevo y modificado
- Todos los paths condicionales cubiertos (exceeded/not exceeded)
- Side effects verificados (logAbuse, snap.ref.delete, counters)

## Analytics

No se agregan eventos de analytics. Los rate limit excesses se registran en `abuseLogs` (ya existente), no en analytics.

---

## Offline

### Cache strategy

| Dato | Estrategia | TTL | Storage |
|------|-----------|-----|---------|
| N/A | N/A | N/A | N/A |

No hay cambios en cache. Los rate limits son server-side y transparentes al cliente.

### Writes offline

| Operacion | Mecanismo | Conflict resolution |
|-----------|-----------|-------------------|
| Toggle favorite (offline) | Firestore persistent cache + `withOfflineSupport` | Doc se crea offline, trigger se ejecuta al sync. Si excede rate limit, trigger elimina el doc. El usuario ve el item desaparecer. Consistente con rate limits existentes. |
| Create/delete userTag (offline) | Firestore persistent cache | Idem favorites |
| Set priceLevel (offline) | Firestore persistent cache | Idem favorites |
| Create customTag (offline) | Firestore persistent cache | Idem favorites |

### Fallback UI

No se requieren cambios en UI. Los rate limits son transparentes. El unico efecto visible es que un doc creado offline puede desaparecer al sincronizar si excede el limite.

---

## Decisiones tecnicas

1. **Daily check antes de per-entity en customTags**: El daily check es una sola count query (`userId` + `createdAt >= startOfDay`), mientras que per-entity agrega un filtro adicional (`businessId`). Ejecutar daily primero permite short-circuit sin el costo del segundo query cuando un abusador ya excedio el limite global.

2. **Limites generosos**: 100/dia para favorites y userTags, 50/dia para priceLevels y customTags. Con ~40 comercios, un usuario legitimo no deberia alcanzar estos limites. El objetivo es prevenir automation/bots, no limitar uso normal.

3. **No se agrega rate limit a deletes**: Solo se limitan creates. Los deletes no generan fan-out ni writes a otras colecciones (excepto counter decrements que son baratos). El ciclo create-delete que queremos prevenir ya se corta limitando los creates.

4. **logAbuse para commentLikes**: Actualmente commentLikes es la unica coleccion con rate limit que no registra logAbuse al exceder. Agregar la llamada completa el patron y permite deteccion de abuso unificada en el admin panel.

5. **No se agregan imports a `logAbuse` en favorites y priceLevels**: Actualmente estos triggers no importan `logAbuse`. Se agrega el import como parte de la modificacion.
