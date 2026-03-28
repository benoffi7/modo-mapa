# Plan: Rate limit en favorites, userTags, customTags, priceLevels, commentLikes

**Specs:** [specs.md](specs.md)
**Fecha:** 2026-03-28

---

## Fases de implementacion

### Fase 1: Rate limits en triggers existentes

**Branch:** `feat/rate-limit-toggle-abuse`

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `functions/src/triggers/favorites.ts` | Importar `checkRateLimit` de `../utils/rateLimiter` y `logAbuse` de `../utils/abuseLogger`. En `onFavoriteCreated`, obtener `snap` de `event.data`, agregar guard `if (!snap) return`, extraer `userId` de `snap.data()`, agregar `checkRateLimit(db, { collection: 'favorites', limit: 100, windowType: 'daily' }, userId)`. Si exceeded: `snap.ref.delete()` + `logAbuse(db, { userId, type: 'rate_limit', collection: 'favorites', detail: 'Exceeded 100 favorites/day' })` + return. Mover las llamadas a `incrementCounter`, `trackWrite`, `incrementBusinessCount` y `fanOutToFollowers` despues del rate limit check. |
| 2 | `functions/src/triggers/priceLevels.ts` | Importar `checkRateLimit` y `logAbuse`. En `onPriceLevelCreated`, cambiar la firma de `async ()` a `async (event)`, obtener `snap` de `event.data`, agregar guard `if (!snap) return`, extraer `userId` de `snap.data()`. Agregar `checkRateLimit(db, { collection: 'priceLevels', limit: 50, windowType: 'daily' }, userId)`. Si exceeded: `snap.ref.delete()` + `logAbuse(...)` + return. `onPriceLevelUpdated` no cambia. |
| 3 | `functions/src/triggers/customTags.ts` | Agregar un segundo `checkRateLimit` con `{ collection: 'customTags', limit: 50, windowType: 'daily' }` **antes** del per-entity check existente (linea 20). Si exceeded: `snap.ref.delete()` + `logAbuse(db, { userId, type: 'rate_limit', collection: 'customTags', detail: 'Exceeded 50 customTags/day' })` + return. El logAbuse ya esta importado. |
| 4 | `functions/src/triggers/commentLikes.ts` | Importar `logAbuse` de `../utils/abuseLogger`. Dentro del bloque `if (exceeded)` (linea 27), despues de `snap.ref.delete()`, agregar `await logAbuse(db, { userId, type: 'rate_limit', collection: 'commentLikes', detail: 'Exceeded 50 commentLikes/day' })`. |

### Fase 2: Nuevo trigger userTags

| Paso | Archivo | Cambio |
|------|---------|--------|
| 5 | `functions/src/triggers/userTags.ts` | Crear archivo nuevo. Importar `onDocumentCreated`, `onDocumentDeleted` de `firebase-functions/v2/firestore`, `getDb` de `../helpers/env`, `checkRateLimit` de `../utils/rateLimiter`, `incrementCounter`, `trackWrite`, `trackDelete` de `../utils/counters`, `logAbuse` de `../utils/abuseLogger`. Exportar `onUserTagCreated` (path `userTags/{docId}`) con: guard `if (!snap) return`, extraer `userId`, `checkRateLimit(db, { collection: 'userTags', limit: 100, windowType: 'daily' }, userId)`, si exceeded: delete + logAbuse + return, si OK: `incrementCounter(db, 'userTags', 1)` + `trackWrite(db, 'userTags')`. Exportar `onUserTagDeleted` con: `incrementCounter(db, 'userTags', -1)` + `trackDelete(db, 'userTags')`. |
| 6 | `functions/src/index.ts` | Agregar linea `export { onUserTagCreated, onUserTagDeleted } from './triggers/userTags';` en la seccion Triggers, despues de la linea de `userSettings`. |

### Fase 3: Tests

| Paso | Archivo | Cambio |
|------|---------|--------|
| 7 | `functions/src/__tests__/triggers/favorites.test.ts` | Agregar `mockCheckRateLimit` y `mockLogAbuse` a los hoisted mocks. Agregar `vi.mock('../../utils/rateLimiter')` y `vi.mock('../../utils/abuseLogger')`. Agregar 3 test cases a `onFavoriteCreated`: (1) rate limit exceeded deletes doc + calls logAbuse + skips counters/fanout, (2) rate limit not exceeded preserva flujo existente, (3) skip si snap es null. Adaptar evento mock para usar `ref` con `delete` mock. |
| 8 | `functions/src/__tests__/triggers/userTags.test.ts` | Crear archivo nuevo siguiendo patron de `checkins.test.ts`. 6 test cases: created skip null snap, created normal flow (counter + trackWrite), created rate limit exceeded (delete + logAbuse + no counters), deleted normal flow (counter decrement + trackDelete). |
| 9 | `functions/src/__tests__/triggers/priceLevels.test.ts` | Crear archivo nuevo. 5 test cases: created skip null snap, created normal flow (counter + trackWrite), created rate limit exceeded (delete + logAbuse + no counters), updated normal flow (trackWrite sin rate limit). |
| 10 | `functions/src/__tests__/triggers/customTags.test.ts` | Crear archivo nuevo. 8 test cases: skip null snap, normal flow completo, daily exceeded (delete + logAbuse daily + no per-entity check), daily OK + per-entity exceeded (delete + logAbuse per-entity), daily OK + per-entity OK + moderation flagged, deleted normal flow. Mock `checkRateLimit` para retornar valores distintos en llamadas sucesivas (`mockResolvedValueOnce`). Mock `checkModeration`. |
| 11 | `functions/src/__tests__/triggers/commentLikes.test.ts` | Agregar `mockLogAbuse` a hoisted mocks. Agregar `vi.mock('../../utils/abuseLogger')`. Agregar 1 test case: rate limit exceeded calls logAbuse. Modificar test existente "deletes like and returns early when rate limit exceeded" para verificar que `mockLogAbuse` tambien es llamado. |

### Fase 4: Documentacion

| Paso | Archivo | Cambio |
|------|---------|--------|
| 12 | `docs/reference/security.md` | Actualizar tabla "Rate limiting server-side (triggers)" (lineas 166-172). Agregar `favorites` (100/dia), `priceLevels` (50/dia), `userTags` (100/dia). Modificar entrada de `customTags` para incluir "+ 50/dia por usuario". Ordenar alfabeticamente. |
| 13 | `docs/reference/tests.md` | Actualizar inventario: mover `favorites.ts` y `priceLevels.ts` de "pending" a tested, agregar `userTags.ts` y `customTags.ts` como tested. Actualizar conteo total de test files y cases. |

---

## Orden de implementacion

1. **Paso 5** (`userTags.ts` trigger) -- sin dependencias, archivo nuevo
2. **Paso 6** (`index.ts` export) -- depende de paso 5
3. **Pasos 1-4** (modificar triggers existentes) -- independientes entre si, pueden hacerse en paralelo
4. **Pasos 7-11** (tests) -- dependen de pasos 1-6
5. **Pasos 12-13** (documentacion) -- dependen de pasos 1-6

En la practica, conviene implementar cada trigger con su test inmediatamente:
1. Paso 5 + 6 + 8 (userTags trigger + export + test)
2. Paso 1 + 7 (favorites trigger + test)
3. Paso 2 + 9 (priceLevels trigger + test)
4. Paso 3 + 10 (customTags trigger + test)
5. Paso 4 + 11 (commentLikes trigger + test)
6. Pasos 12-13 (docs)

## Estimacion de archivos

| Archivo | Lineas estimadas | Accion |
|---------|-----------------|--------|
| `functions/src/triggers/favorites.ts` | ~55 (actual 45 + ~10 rate limit) | OK |
| `functions/src/triggers/priceLevels.ts` | ~40 (actual 20 + ~20 rate limit) | OK |
| `functions/src/triggers/customTags.ts` | ~75 (actual 64 + ~11 daily check) | OK |
| `functions/src/triggers/commentLikes.ts` | ~90 (actual 83 + ~7 logAbuse) | OK |
| `functions/src/triggers/userTags.ts` | ~45 (nuevo, patron checkins) | OK |
| `functions/src/__tests__/triggers/favorites.test.ts` | ~270 (actual 219 + ~50 rate limit tests) | OK |
| `functions/src/__tests__/triggers/userTags.test.ts` | ~150 (nuevo) | OK |
| `functions/src/__tests__/triggers/priceLevels.test.ts` | ~160 (nuevo) | OK |
| `functions/src/__tests__/triggers/customTags.test.ts` | ~220 (nuevo) | OK |
| `functions/src/__tests__/triggers/commentLikes.test.ts` | ~220 (actual 201 + ~20 logAbuse test) | OK |

Ningun archivo supera las 400 lineas. No se requiere descomposicion.

## Riesgos

1. **Race condition en rate limit count**: `checkRateLimit` usa `count()` query que incluye el doc recien creado. Si dos docs se crean simultaneamente, ambos podrian pasar el check antes de que el otro sea contado. Mitigacion: el limite es generoso (100/50), por lo que un exceso de 1-2 docs por race condition no es un problema real. Este es el mismo patron que usa comments (20/dia) sin issues.

2. **Cold start de Cloud Functions**: Los nuevos triggers de userTags agregan 2 funciones mas al deployment. Mitigacion: los triggers son livianos (sin dependencias pesadas mas alla de firebase-admin). El cold start adicional es negligible.

3. **Counter desync en userTags**: Actualmente `config/counters` no tiene un counter para `userTags` (los counters se crean automaticamente via `incrementCounter` con `FieldValue.increment`). Mitigacion: `FieldValue.increment` crea el campo si no existe (lo inicializa en 0 + el incremento). No se requiere seed data.

## Criterios de done

- [x] All items from PRD scope implemented
- [ ] S1: `onFavoriteCreated` tiene rate limit de 100/dia con logAbuse
- [ ] S2: `userTags.ts` triggers creados con rate limit 100/dia + counters + logAbuse
- [ ] S3: `onPriceLevelCreated` tiene rate limit de 50/dia con logAbuse
- [ ] S4: `onCustomTagCreated` tiene rate limit daily de 50/dia (complementa per-entity)
- [ ] S5: `onCommentLikeCreated` registra logAbuse cuando excede
- [ ] Tests pass with >= 80% coverage on new code
- [ ] No lint errors
- [ ] Build succeeds (`cd functions && npm run build`)
- [ ] Tabla de rate limits en `security.md` actualizada
- [ ] Inventario de tests en `tests.md` actualizado
