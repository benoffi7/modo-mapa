# Plan: userTags Rate Limit Trigger

**Specs:** [specs.md](specs.md)
**Fecha:** 2026-03-28

---

## Fases de implementacion

### Fase 1: Trigger + registro

**Branch:** `feat/usertags-rate-limit-trigger`

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `functions/src/triggers/userTags.ts` | Crear archivo con `onUserTagCreated` (rate limit 100/dia, delete + logAbuse si excede, incrementCounter + trackWrite si no) y `onUserTagDeleted` (incrementCounter -1 + trackDelete). Seguir patron exacto de `favorites.ts`. |
| 2 | `functions/src/index.ts` | Agregar linea: `export { onUserTagCreated, onUserTagDeleted } from './triggers/userTags';` |

### Fase 2: Tests

| Paso | Archivo | Cambio |
|------|---------|--------|
| 3 | `functions/src/__tests__/triggers/userTags.test.ts` | Crear test file con 4 casos: (1) onCreate happy path, (2) onCreate rate limit exceeded, (3) onCreate snap null, (4) onDelete happy path. Mock strategy identica a `commentLikes.test.ts`. |

### Fase 3: Documentacion

| Paso | Archivo | Cambio |
|------|---------|--------|
| 4 | `docs/reference/security.md` | Verificar que la tabla "Rate limiting server-side (triggers)" incluye `userTags | 100/dia por usuario`. |
| 5 | `docs/reference/tests.md` | Agregar fila para `userTags.ts` trigger en la tabla "Cloud Functions -- Triggers". |

---

## Orden de implementacion

1. `functions/src/triggers/userTags.ts` -- el trigger es la pieza central, sin dependencias nuevas (usa utils existentes).
2. `functions/src/index.ts` -- registrar exports para que Cloud Functions reconozca los triggers.
3. `functions/src/__tests__/triggers/userTags.test.ts` -- tests unitarios del trigger.
4. `docs/reference/security.md` -- actualizar tabla de rate limits.
5. `docs/reference/tests.md` -- actualizar inventario de tests.

## Estimacion de tamano de archivos

| Archivo | Lineas estimadas | Supera 400? |
|---------|-----------------|-------------|
| `functions/src/triggers/userTags.ts` | ~47 | No |
| `functions/src/__tests__/triggers/userTags.test.ts` | ~120 | No |
| `functions/src/index.ts` (despues del cambio) | +1 linea | No |

## Riesgos

1. **Rate limit demasiado permisivo**: 100/dia es generoso. Si se observa abuso dentro del limite, se puede reducir a 50 sin cambio de codigo (solo el parametro `limit` en el trigger). Mitigacion: monitorear `abuseLogs` post-deploy.

2. **Cold start delay**: Si el trigger tarda en arrancar por cold start, un bot rapido podria crear algunos docs extra antes de que el rate limit los atrape. Mitigacion: esto es inherente a todos los triggers de Cloud Functions y ya se acepta como tradeoff en las demas colecciones.

## Guardrails de modularidad

- [x] Ningun componente nuevo importa `firebase/firestore` directamente (no hay componentes nuevos)
- [x] Archivos nuevos en carpeta de dominio correcta (`functions/src/triggers/`)
- [x] Logica de negocio en hooks/services, no en componentes (no hay componentes)
- [x] No se toca ningun archivo con deuda tecnica
- [x] Ningun archivo resultante supera 400 lineas

## Fase final: Documentacion (OBLIGATORIA)

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `docs/reference/security.md` | Verificar fila `userTags | 100/dia por usuario` en tabla de rate limits |
| 2 | `docs/reference/tests.md` | Agregar `userTags.ts` a inventario de triggers testeados |

## Criterios de done

- [x] All items from PRD scope implemented
- [x] Tests pass with >= 80% coverage on new code
- [x] No lint errors
- [x] Build succeeds
- [x] Seed data updated (if schema changed) -- N/A, sin cambios de schema
- [x] Privacy policy reviewed (if new data collection) -- N/A, sin nuevos datos
- [x] Reference docs updated (security.md rate limit table)
