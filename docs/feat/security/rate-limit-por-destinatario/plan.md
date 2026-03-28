# Plan: Rate limit por destinatario en notificaciones

**Specs:** [specs.md](specs.md)
**Fecha:** 2026-03-28

---

## Fases de implementacion

### Fase 1: Abuse logger type extension

**Branch:** `feat/rate-limit-recipient`

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `functions/src/utils/abuseLogger.ts` | Agregar `'recipient_flood'` al union type `AbuseLogEntry['type']`. Agregar `recipient_flood: 'medium'` al `SEVERITY_MAP` |

### Fase 2: Rate limit por destinatario en createNotification

| Paso | Archivo | Cambio |
|------|---------|--------|
| 2 | `functions/src/utils/notifications.ts` | Agregar constante `RECIPIENT_DAILY_LIMIT = 50` |
| 3 | `functions/src/utils/notifications.ts` | Agregar constante `ADMIN_NOTIFICATION_TYPES: Set<NotificationType>` con `['feedback_response', 'photo_approved', 'photo_rejected', 'ranking']` |
| 4 | `functions/src/utils/notifications.ts` | Agregar funcion `getStartOfDay(): Date` (misma logica que en `rateLimiter.ts`) |
| 5 | `functions/src/utils/notifications.ts` | Agregar funcion `isRecipientFloodExceeded(db, userId): Promise<boolean>` que cuenta notificaciones del destinatario con `createdAt >= startOfDay()` y retorna `count >= RECIPIENT_DAILY_LIMIT` |
| 6 | `functions/src/utils/notifications.ts` | En `createNotification`, despues del check `shouldNotify`, agregar: si el tipo NO esta en `ADMIN_NOTIFICATION_TYPES` y `isRecipientFloodExceeded` retorna `true`, loggear abuse con `logAbuse(db, { userId: data.actorId ?? 'unknown', type: 'recipient_flood', collection: 'notifications', detail })` y retornar sin crear la notificacion |
| 7 | `functions/src/utils/notifications.ts` | Agregar import de `logAbuse` desde `./abuseLogger` |

### Fase 3: Deduplicacion de follow notification

| Paso | Archivo | Cambio |
|------|---------|--------|
| 8 | `functions/src/triggers/follows.ts` | Antes de `createNotification` en `onFollowCreated`, agregar query: `db.collection('notifications').where('userId', '==', followedId).where('actorId', '==', followerId).where('type', '==', 'new_follower').where('createdAt', '>=', startOfDay).count().get()`. Si `count > 0`, skip `createNotification` |
| 9 | `functions/src/triggers/follows.ts` | Agregar funcion local `getStartOfDay(): Date` (o importar de un modulo compartido si se extrae en Fase 2) |

### Fase 4: Tests

| Paso | Archivo | Cambio |
|------|---------|--------|
| 10 | `functions/src/__tests__/utils/notifications.test.ts` | Actualizar `createMockDb` para soportar mock de count query (`.where().where().count().get()`) con resultado configurable |
| 11 | `functions/src/__tests__/utils/notifications.test.ts` | Agregar describe block `createNotification -- recipient rate limit` con 6 test cases: permite cuando count < 50, bloquea cuando count >= 50, no aplica a feedback_response, no aplica a photo_approved, no aplica a photo_rejected, no aplica a ranking |
| 12 | `functions/src/__tests__/utils/notifications.test.ts` | Agregar test: verifica que `logAbuse` se llama con `type: 'recipient_flood'` y detail correcto cuando rate limit se excede |
| 13 | `functions/src/__tests__/utils/notifications.test.ts` | Agregar test: verifica que `logAbuse` NO se llama cuando count < 50 |
| 14 | `functions/src/__tests__/triggers/follows.test.ts` | Agregar mock de count query para notificaciones de deduplicacion al `createMockDb` |
| 15 | `functions/src/__tests__/triggers/follows.test.ts` | Agregar test: no crea notificacion `new_follower` si ya existe una del mismo actor en 24h (count > 0) |
| 16 | `functions/src/__tests__/triggers/follows.test.ts` | Agregar test: si crea notificacion cuando no hay duplicada (count == 0) |
| 17 | `functions/src/__tests__/triggers/follows.test.ts` | Agregar test: counters y tracking se ejecutan normalmente incluso cuando la notificacion se deduplica |

### Fase 5: Lint y commit

| Paso | Archivo | Cambio |
|------|---------|--------|
| 18 | N/A | Ejecutar `cd functions && npx vitest run` para verificar que todos los tests pasan |
| 19 | N/A | Ejecutar `cd functions && npx tsc --noEmit` para verificar tipos |
| 20 | N/A | Commit con mensaje descriptivo |

---

## Orden de implementacion

1. `functions/src/utils/abuseLogger.ts` -- agregar tipo (dependencia de paso 6)
2. `functions/src/utils/notifications.ts` -- agregar rate limit (nucleo del feature)
3. `functions/src/triggers/follows.ts` -- agregar deduplicacion
4. `functions/src/__tests__/utils/notifications.test.ts` -- tests de rate limit
5. `functions/src/__tests__/triggers/follows.test.ts` -- tests de deduplicacion
6. Lint + type check + run tests

## Estimacion de archivos

| Archivo | Lineas actuales | Lineas estimadas tras cambio | Accion |
|---------|----------------|------------------------------|--------|
| `functions/src/utils/notifications.ts` | ~92 | ~140 | OK |
| `functions/src/utils/abuseLogger.ts` | ~27 | ~30 | OK |
| `functions/src/triggers/follows.ts` | ~128 | ~145 | OK |
| `functions/src/__tests__/utils/notifications.test.ts` | ~190 | ~320 | OK |
| `functions/src/__tests__/triggers/follows.test.ts` | ~308 | ~380 | OK |

Ningun archivo supera las 400 lineas.

## Riesgos

1. **Query de count adicional en cada notificacion**: Cada llamada a `createNotification` para tipos no-admin ahora hace una query de count a `notifications`. Esto agrega ~1 read por notificacion creada. Mitigacion: el volumen de notificaciones es bajo (~100-300/dia en total) y la query usa un indice existente. El costo adicional es despreciable.

2. **Funcion `getStartOfDay` duplicada**: Existe en `rateLimiter.ts` y se duplicaria en `notifications.ts` y `follows.ts`. Mitigacion: son 4 lineas de codigo trivial. Extraer a un modulo compartido es over-engineering para este caso. Si se necesita en un cuarto lugar, refactorizar.

3. **Race condition en deduplicacion de follows**: Si dos follows del mismo actor al mismo destinatario llegan en paralelo (antes de que la primera notificacion se escriba), ambos pasarian el check de deduplicacion. Mitigacion: esto es extremadamente improbable en uso real (requeriria dos requests simultaneos del mismo usuario). El rate limit por destinatario (50/dia) actua como segunda linea de defensa.

## Criterios de done

- [ ] Rate limit por destinatario implementado en `createNotification`
- [ ] Tipos admin exentos del rate limit (feedback_response, photo_approved, photo_rejected, ranking)
- [ ] Deduplicacion de notificacion `new_follower` por actor/destinatario/dia
- [ ] Logging en `abuseLogs` con tipo `recipient_flood` cuando se excede el limite
- [ ] Tests pasan con >= 80% cobertura en codigo nuevo
- [ ] No lint errors
- [ ] Build succeeds (`tsc --noEmit` en functions)
- [ ] Tests existentes siguen pasando sin modificacion
