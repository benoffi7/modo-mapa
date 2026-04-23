# Plan: Tech Debt — Extraer isCooldownActive a utils/forceUpdate.ts

**Specs:** [specs.md](specs.md)
**Fecha:** 2026-04-23

---

## Fases de implementacion

### Fase 1: Extraer funciones puras y actualizar el hook

**Branch:** `feat/313-cooldown-dedup`

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `src/utils/forceUpdate.ts` | Crear archivo nuevo con las 4 funciones puras: `isCooldownActive`, `getReloadCount`, `incrementReloadCount`, `isReloadLimitReached`. Importar constantes desde `../constants/timing` y `../constants/storage`. Sin dependencias de React. |
| 2 | `src/hooks/useForceUpdate.ts` | Agregar import de las 4 funciones desde `../utils/forceUpdate`. Eliminar las definiciones locales de `isCooldownActive`, `getReloadCount`, `incrementReloadCount`, `isReloadLimitReached` (lineas 43-99). Convertir `_getReloadCount` y `_isReloadLimitReached` en re-exports de `../utils/forceUpdate` para backward compat de tests. |
| 3 | `src/utils/forceUpdate.test.ts` | Crear archivo nuevo con ~16 casos de test directos de las 4 funciones. Usar `localStorage` de jsdom + `vi.spyOn` para simular excepciones. `beforeEach` con `localStorage.clear()`. |

---

## Orden de implementacion

1. Paso 1 — crear `src/utils/forceUpdate.ts` (no tiene dependencias de codigo nuevo)
2. Paso 2 — actualizar `src/hooks/useForceUpdate.ts` (depende de que el nuevo modulo exista)
3. Paso 3 — crear `src/utils/forceUpdate.test.ts` (puede hacerse en paralelo con paso 2, pero conviene tener el modulo final antes de testear)

---

## Riesgos

| Riesgo | Mitigacion |
|--------|-----------|
| Los re-exports `@internal` rompan la resolucion de modulos en los tests existentes | Verificar que `_getReloadCount` y `_isReloadLimitReached` resuelven correctamente despues del paso 2 corriendo `npm run test:run -- useForceUpdate` antes de hacer commit |
| Cobertura baja en el nuevo modulo | El nuevo archivo de tests (paso 3) cubre todos los paths de `try/catch`. Meta: 100% del nuevo codigo — es un modulo de logica pura sin side effects condicionales por entorno |
| Lint falla por import no usado | Al eliminar las definiciones locales del hook, asegurarse de que las constantes `FORCE_UPDATE_COOLDOWN_MS` y `MAX_FORCE_UPDATE_RELOADS` solo queden en `utils/forceUpdate.ts` y no aparezcan importadas en el hook si ya no se usan ahi |

---

## Estimacion de tamano de archivos resultantes

| Archivo | Lineas actuales | Lineas estimadas | Estado |
|---------|----------------|-----------------|--------|
| `src/utils/forceUpdate.ts` | 0 (nuevo) | ~80 | Ideal |
| `src/utils/forceUpdate.test.ts` | 0 (nuevo) | ~180 | Ideal |
| `src/hooks/useForceUpdate.ts` | 232 | ~155 | Ideal |
| `src/hooks/useForceUpdate.test.ts` | 586 | 586 (sin cambios) | Aceptable |

---

## Guardrails de modularidad

- [x] Ningun componente nuevo importa `firebase/firestore` directamente
- [x] `src/utils/forceUpdate.ts` va en `src/utils/` — correcto para logica pura sin React
- [x] Logica de negocio (cooldown, conteo de reloads) sale de hooks/ y va a utils/ — mejora la separacion
- [x] No hay archivo resultante que supere 400 lineas
- [x] No se agrega god-context ni estado global

## Guardrails de seguridad

- [x] No hay escrituras nuevas a Firestore
- [x] No hay colecciones nuevas
- [x] No hay secrets ni credenciales en archivos nuevos
- [x] Los `try/catch` de localStorage se preservan intactos — no se silencian con `.catch(() => {})`

## Guardrails de observabilidad

- [x] No hay queries nuevas a Firestore — no se necesita `measureAsync`
- [x] No hay eventos analytics nuevos
- [x] No hay Cloud Functions nuevas

## Guardrails de accesibilidad y UI

No aplica — refactor de logica pura.

## Guardrails de copy

No aplica — no hay textos visibles al usuario.

---

## Fase final: Documentacion

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `docs/reference/patterns.md` | No requiere cambio: el patron "Archivos en `src/hooks/` DEBEN usar al menos un React hook" ya esta documentado. Este issue es aplicacion del patron existente, no un patron nuevo. |
| 2 | `docs/reference/files.md` | Agregar entrada para `src/utils/forceUpdate.ts` si existe un inventario de modulos utils. |

---

## Criterios de done

- [x] `src/utils/forceUpdate.ts` existe con las 4 funciones (`isCooldownActive`, `getReloadCount`, `incrementReloadCount`, `isReloadLimitReached`) sin logica de React
- [x] `src/hooks/useForceUpdate.ts` importa las 4 funciones desde `../utils/forceUpdate` y no las define localmente
- [x] `src/utils/forceUpdate.test.ts` existe con >= 80% de cobertura (objetivo: 100% para modulo de logica pura)
- [x] `npm run test:run -- useForceUpdate` pasa sin modificaciones al archivo de test del hook
- [x] `npm run test:coverage` pasa sin degradacion de cobertura global
- [x] `npm run lint` sin errores (verificar especialmente imports no usados en el hook tras eliminar las definiciones locales)
- [x] Build (`npm run build`) exitoso
