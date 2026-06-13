# Plan: Tech Debt — Retry Delays timing.ts consolidation (#314)

**Specs:** [specs.md](specs.md)
**Fecha:** 2026-04-23

---

## Contexto critico

La logica de retry en `fetchAppVersionConfig` ya existe y esta testeada. El plan es minimo:
- Un import en `config.ts` (reemplazar constante local por la de `timing.ts`).
- Crear `src/utils/retry.ts` con `withRetry<T>` y su test.
- NO refactorizar `fetchAppVersionConfig` para usar `withRetry`.

---

## Fases de implementacion

### Fase 1: Consolidar la constante en config.ts

**Branch:** `feat/314-retry-delays-timing-consolidation`

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `src/services/config.ts` | Eliminar `const RETRY_DELAYS_MS = [500, 1500]` (linea 29). Agregar import: `import { FORCE_UPDATE_FETCH_RETRY_DELAYS_MS } from '../constants/timing';` |
| 2 | `src/services/config.ts` | En la linea del setTimeout, cambiar `RETRY_DELAYS_MS[attempt]` por `FORCE_UPDATE_FETCH_RETRY_DELAYS_MS[attempt]` |
| 3 | `src/services/config.test.ts` | Verificar que los 7 tests siguen pasando sin cambios (comportamiento identico) |

### Fase 2: Crear el helper withRetry

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `src/utils/retry.ts` (nuevo) | Crear con `withRetry<T>(fn, delays)` — implementacion recursiva, JSDoc con ejemplo de uso |
| 2 | `src/utils/retry.test.ts` (nuevo) | Tests con `vi.useFakeTimers()`: (a) exito en primer intento sin delay; (b) falla 1 vez, reintenta y triunfa; (c) agota todos los delays, relanza el ultimo error; (d) `delays=[]` lanza inmediatamente |

### Fase 3: Actualizacion de docs

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `docs/reference/patterns.md` | Agregar seccion sobre `withRetry` como patron disponible para servicios criticos |
| 2 | `docs/_sidebar.md` | Agregar entradas de Specs y Plan bajo la entrada #314 existente |

---

## Orden de implementacion

1. Fase 1 paso 1-2: cambio de import en `config.ts` (prerequisito logico de todo lo demas).
2. Fase 1 paso 3: correr tests para confirmar que el cambio de import no rompio nada.
3. Fase 2 paso 1: crear `retry.ts` (no depende de Fase 1 pero conviene tener el contexto claro).
4. Fase 2 paso 2: crear `retry.test.ts` (depende de que `retry.ts` exista).
5. Fase 3: docs (siempre al final).

---

## Riesgos

| Riesgo | Probabilidad | Mitigacion |
|--------|-------------|-----------|
| El import de `timing.ts` introduce una dependencia circular | Baja — `config.ts` importa de `constants/`, que no importa de `services/` | Verificar con `tsc --noEmit` antes de commitear |
| `retry.test.ts` es fragil con fake timers por timing de async/await | Media — el patron `vi.runAllTimersAsync()` puede requerir ajuste | Seguir el mismo patron de `config.test.ts` que ya funciona con fake timers |
| `withRetry` nunca se usa y queda como dead code | Baja — el PRD lo requiere; es baja prioridad si el linter lo marca | Agregar `// NOTE: available for future services` en el JSDoc |

---

## Guardrails de modularidad

- [x] Ningun componente nuevo importa `firebase/firestore` directamente
- [x] Archivos nuevos en carpeta correcta: `src/utils/retry.ts` (utilidad pura sin React)
- [x] Logica de negocio en hooks/services, no en componentes — sin cambio
- [x] No se toca ningun archivo con deuda tecnica adicional (el unico archivo tocado es `config.ts`, y el fix es el propio issue #314)
- [x] Ningun archivo resultante supera 400 lineas (el mas grande es `config.test.ts` con 180 lineas)

## Guardrails de seguridad

- [x] No hay colecciones nuevas — sin `hasOnly()` requerido
- [x] Sin strings nuevos — sin `.size()` requerido
- [x] Sin writes a Firestore
- [x] Sin secrets en archivos commiteados
- [x] No aplica `getCountOfflineSafe` — no hay count queries

## Guardrails de observabilidad

- [x] Sin Cloud Functions nuevas — no aplica `trackFunctionTiming`
- [x] Sin queries Firestore nuevas — `measureAsync` es scope de issue #315, no de este
- [x] Sin `trackEvent` nuevo — el retry es transparente al usuario
- [x] `logger.warn` existente en `config.ts` se mantiene (no se elimina)

## Guardrails de accesibilidad y UI

- [x] No aplica — sin cambios de UI

## Guardrails de copy

- [x] No aplica — sin textos visibles al usuario

---

## Fase final: Documentacion (OBLIGATORIA)

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `docs/reference/patterns.md` | Agregar mencion de `withRetry` como utilidad disponible para servicios criticos (`src/utils/retry.ts`) |
| 2 | `docs/_sidebar.md` | Agregar Specs y Plan bajo entrada #314 |

No aplica: `security.md` (sin cambios de rules ni auth), `firestore.md` (sin cambios de schema), `features.md` (sin funcionalidad visible), `project-reference.md` (cambio de infra menor, no requiere bump de version).

---

## Criterios de done

- [x] `src/constants/timing.ts` exporta `FORCE_UPDATE_FETCH_RETRY_DELAYS_MS = [500, 1500]` (ya cumplido)
- [ ] `src/services/config.ts` importa `FORCE_UPDATE_FETCH_RETRY_DELAYS_MS` desde `timing.ts` y no tiene `RETRY_DELAYS_MS` local
- [ ] `src/utils/retry.ts` exporta `withRetry<T>` con JSDoc
- [ ] `src/utils/retry.test.ts` cubre los 4 escenarios con fake timers
- [ ] `src/services/config.test.ts` sigue pasando los 7 tests sin modificaciones
- [ ] No hay magic numbers `[500, 1500]` hardcodeados en ningun archivo de `src/`
- [ ] `tsc --noEmit` pasa sin errores
- [ ] `docs/reference/patterns.md` menciona `withRetry`
- [ ] `docs/_sidebar.md` actualizado con Specs y Plan
