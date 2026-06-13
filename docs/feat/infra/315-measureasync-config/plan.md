# Plan: measureAsync instrumentation en fetchAppVersionConfig

**Specs:** [specs.md](specs.md)
**Fecha:** 2026-04-23

---

## Fases de implementación

### Fase 1: Instrumentar config.ts y resolver #314

**Branch:** `feat/315-measureasync-config`

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `src/services/config.ts` | Agregar import de `measuredGetDoc` desde `../utils/perfMetrics` |
| 2 | `src/services/config.ts` | Reemplazar `const RETRY_DELAYS_MS = [500, 1500]` por import de `FORCE_UPDATE_FETCH_RETRY_DELAYS_MS` desde `../constants/timing`; actualizar referencia en el loop |
| 3 | `src/services/config.ts` | Reemplazar `getDoc(ref)` en el fallback de cache (línea 65) por `measuredGetDoc('appVersionConfig', ref)` |
| 4 | `src/services/config.ts` | Eliminar `getDoc` del import de `firebase/firestore` (queda: `doc`, `getDocFromServer`, `FirestoreError`, `type Timestamp`) |

### Fase 2: Actualizar tests

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `src/services/config.test.ts` | Agregar `vi.mock('../utils/perfMetrics', ...)` con `mockMeasuredGetDoc` spy |
| 2 | `src/services/config.test.ts` | Agregar `vi.mock('../constants/timing', ...)` con `FORCE_UPDATE_FETCH_RETRY_DELAYS_MS: [500, 1500]` |
| 3 | `src/services/config.test.ts` | En `beforeEach`: configurar `mockMeasuredGetDoc.mockImplementation((_name, ref) => mockGetDoc(ref))` para mantener transparencia en casos existentes |
| 4 | `src/services/config.test.ts` | Eliminar `getDoc` del mock de `firebase/firestore` (ya no es importado por `config.ts`) |
| 5 | `src/services/config.test.ts` | Agregar caso `g)`: verifica que `mockMeasuredGetDoc` fue llamado exactamente una vez con `'appVersionConfig'` como primer argumento cuando el path de cache es ejecutado |

### Fase final: Documentación

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `docs/reference/patterns.md` | No requiere cambio — `measuredGetDoc` ya está documentado; el patrón no es nuevo |
| 2 | `docs/reference/firestore.md` | No requiere cambio — sin cambios en colecciones ni reglas |
| 3 | `docs/reference/features.md` | No requiere cambio — no es un feature de usuario |
| 4 | `docs/_sidebar.md` | Agregar entradas de Specs y Plan bajo `#315 measureAsync en fetchAppVersionConfig` |

---

## Orden de implementación

1. `src/services/config.ts` — todos los cambios en un solo commit (imports + reemplazo + eliminación son atómicos)
2. `src/services/config.test.ts` — actualizar mocks y agregar caso g)
3. `docs/_sidebar.md` — actualizar sidebar

El paso 1 y 2 pueden ir en el mismo commit si se prefiere atomicidad de cambio + test.

---

## Estimación de tamaño de archivos resultantes

| Archivo | Líneas actuales | Líneas resultantes | Delta |
|---------|----------------|-------------------|-------|
| `src/services/config.ts` | 69 | ~69 | Sin cambio neto (1 import agregado, 2 líneas eliminadas, 1 línea modificada) |
| `src/services/config.test.ts` | 181 | ~205 | +24 (mocks adicionales + caso g) |

Ambos archivos quedan muy por debajo de 400 líneas. Sin necesidad de decomposición.

---

## Riesgos

1. **El mock de `firebase/firestore` en `config.test.ts` expone `getDoc` que algunos casos usan indirectamente.** Mitigación: `mockMeasuredGetDoc` delega a `mockGetDoc` en `beforeEach`, por lo que los casos b), c), d) y f) que hoy testean el fallback de cache siguen funcionando. Solo cambia el punto de intercepción (de `getDoc` a `measuredGetDoc`).

2. **`getDocFromServer` no queda instrumentado.** Es intencional y está documentado en las specs. No es un riesgo funcional. Si en el futuro se instrumenta, requiere un nuevo issue porque implica una decisión de naming de métricas (`appVersionConfig_server` vs otros).

3. **La constante importada desde `timing.ts` tiene nombre diferente** (`FORCE_UPDATE_FETCH_RETRY_DELAYS_MS` vs `RETRY_DELAYS_MS` local). Mitigación: el cambio es en una sola línea de uso y el test mockea la constante con los mismos valores, sin riesgo de regresión.

---

## Guardrails de modularidad

- [x] Ningún componente nuevo importa `firebase/firestore` directamente — el cambio elimina un import directo existente
- [x] Sin archivos nuevos — modificación de 2 archivos existentes
- [x] Lógica de negocio permanece en service (`config.ts`), no en componentes
- [x] El fix de #314 queda incorporado en el mismo PR (deuda técnica no agravada)
- [x] Ningún archivo resultante supera 400 líneas

## Guardrails de seguridad

- [x] Sin nuevas colecciones ni campos — no aplica `hasOnly()`
- [x] Sin nuevas superficies de ataque
- [x] Sin secrets ni credenciales en archivos commiteados
- [x] Sin rate limit requerido — solo read instrumentado

## Guardrails de observabilidad

- [x] `measuredGetDoc('appVersionConfig', ...)` registra timing en `queryTimings` → agregado en `dailyMetrics` p50/p95
- [x] Sin nuevo `trackEvent` — no requiere entrada en `GA4_EVENT_NAMES`
- [x] Sin Cloud Functions nuevas — no requiere `trackFunctionTiming`

## Guardrails de accesibilidad y UI

- [x] No aplica — cambio en service puro

## Guardrails de copy

- [x] No aplica — sin textos visibles al usuario

---

## Criterios de done

- [x] `fetchAppVersionConfig` usa `measuredGetDoc('appVersionConfig', ref)` en el path de cache (línea ~65 de `config.ts`)
- [x] `config.ts` no importa `getDoc` de `firebase/firestore`
- [x] `config.ts` usa `FORCE_UPDATE_FETCH_RETRY_DELAYS_MS` de `timing.ts` (fix #314 incluido)
- [x] `config.test.ts` mockea `../utils/perfMetrics` con `mockMeasuredGetDoc` spy
- [x] `config.test.ts` tiene al menos 1 caso que verifica `measuredGetDoc` llamado con `'appVersionConfig'`
- [x] Los 7+ casos existentes de `config.test.ts` pasan sin modificar sus aserciones de resultado
- [x] `npm run test:run` pasa sin errores
- [x] `npm run lint` pasa sin errores
- [x] `docs/_sidebar.md` actualizado con Specs y Plan
