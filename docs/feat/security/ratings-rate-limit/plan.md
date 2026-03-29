# Plan: Ratings trigger sin rate limit server-side

**Specs:** [specs.md](specs.md)
**Fecha:** 2026-03-28

---

## Fases de implementacion

### Fase 1: Rate limit en trigger

**Branch:** `fix/ratings-rate-limit`

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `functions/src/triggers/ratings.ts` | Agregar imports de `checkRateLimit` (de `../utils/rateLimiter`) y `logAbuse` (de `../utils/abuseLogger`) |
| 2 | `functions/src/triggers/ratings.ts` | En el path de create (`!beforeExists && afterExists`), despues de extraer `userId`/`businessId`/`score`, agregar llamada a `checkRateLimit(db, { collection: 'ratings', limit: 30, windowType: 'daily' }, userId)`. Si excede: `await after.ref.delete()`, `await logAbuse(...)`, y `return` early |

### Fase 2: Tests

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `functions/src/__tests__/triggers/ratings.test.ts` | Agregar mock de `checkRateLimit` (default: `false`) y `logAbuse` al setup de mocks |
| 2 | `functions/src/__tests__/triggers/ratings.test.ts` | Agregar test: create con rate limit no excedido -- verificar que `checkRateLimit` se llama y counters/aggregates/fan-out se ejecutan |
| 3 | `functions/src/__tests__/triggers/ratings.test.ts` | Agregar test: create con rate limit excedido -- mockear `checkRateLimit` retornando `true`, verificar que `after.ref.delete()` se llama, `logAbuse` se llama con parametros correctos, y counters/aggregates NO se llaman |

### Fase 3: Documentacion

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `docs/reference/security.md` | Verificar que `ratings | 30/dia por usuario` esta en la tabla de rate limiting server-side |

---

## Estimacion de tamano de archivos

| Archivo | Lineas antes | Lineas despues | Dentro de limite? |
|---------|-------------|---------------|-------------------|
| `functions/src/triggers/ratings.ts` | 69 | 69 (ya implementado) | Si (< 400) |
| `functions/src/__tests__/triggers/ratings.test.ts` | 118 | ~118 (ya implementado) | Si (< 400) |

---

## Orden de implementacion

1. `functions/src/triggers/ratings.ts` -- agregar rate limit al trigger (Fase 1)
2. `functions/src/__tests__/triggers/ratings.test.ts` -- agregar tests para el nuevo path (Fase 2)
3. `docs/reference/security.md` -- actualizar tabla de rate limits (Fase 3)

---

## Riesgos

1. **Rating creado offline sincroniza despues del rate limit diario**: Mitigacion: el trigger evalua al sincronizar. Si el usuario genuinamente creo el rating offline, es improbable que haya llegado a 30. Si es un bot, el rate limit lo frena correctamente.

2. **Count query incluye el doc recien creado**: Mitigacion: `checkRateLimit` ya maneja esto -- el limite es `> limit` (no `>=`), asi que el doc #30 pasa y el #31 se rechaza.

---

## Guardrails de modularidad

- [x] Ningun componente nuevo importa `firebase/firestore` directamente (no hay cambios en frontend)
- [x] Archivos nuevos en carpeta de dominio correcta (no hay archivos nuevos)
- [x] Logica de negocio en hooks/services, no en componentes (cambio solo en Cloud Functions)
- [x] Si se toca un archivo con deuda tecnica, se incluye el fix en el plan (no hay deuda conocida en `ratings.ts`)
- [x] Ningun archivo resultante supera 400 lineas (`ratings.ts` = 69 lineas)

## Fase final: Documentacion (OBLIGATORIA)

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `docs/reference/security.md` | Verificar que `ratings` aparece en la tabla de rate limiting server-side con limite `30/dia por usuario` |

Los demas archivos de referencia no requieren actualizacion (no hay cambios en colecciones, campos, rules, features visibles al usuario, ni patrones nuevos).

## Criterios de done

- [x] `onRatingWritten` llama a `checkRateLimit` en el path de create con limite 30/dia
- [x] Si el rate limit se excede, el documento se elimina y se registra en `abuseLogs`
- [x] Tests existentes siguen pasando + nuevos tests cubren el path de rate limit
- [x] La tabla de rate limits en `security.md` incluye `ratings | 30/dia por usuario`
- [x] Cobertura de `ratings.ts` se mantiene >= 80%
