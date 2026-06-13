# PRD: Tech Debt — Extraer isCooldownActive a utils/forceUpdate.ts

**Feature:** 313-cooldown-dedup
**Categoria:** infra
**Fecha:** 2026-04-23
**Issue:** #313
**Prioridad:** Baja

---

## Contexto

El hook `useForceUpdate` contiene funciones de logica pura (deteccion de cooldown, conteo de reloads, lectura de localStorage) que estan embebidas directamente en el archivo del hook. La issue original identifico una duplicacion con `src/pwa/registerPwa.ts`, pero ese archivo ya no existe en el codebase; la oportunidad de refactor persiste: mover la logica pura a `src/utils/forceUpdate.ts` cumple con el patron del proyecto que reserva `src/hooks/` solo para archivos que usan al menos un React hook.

## Problema

- `src/hooks/useForceUpdate.ts` contiene cuatro funciones de logica pura (`isCooldownActive`, `getReloadCount`, `incrementReloadCount`, `isReloadLimitReached`) que no usan ningun React hook y no deberian vivir en `src/hooks/`
- El patron del proyecto establece: "Archivos en `src/hooks/` DEBEN usar al menos un React hook — si no, van en `src/services/` o `src/utils/`"
- Si se agrega un segundo consumidor de la logica de cooldown (ej: un futuro `registerPwa.ts` o un modulo de service worker), la duplicacion reaparecera porque la logica no esta en una ubicacion canonica
- La funcion `isCooldownActive` no es exportada ni testeable de forma aislada; los tests actuales la ejercitan indirectamente via `_checkVersion`

## Solucion

### S1 — Extraer funciones puras a `src/utils/forceUpdate.ts`

Crear `src/utils/forceUpdate.ts` con las funciones:
- `isCooldownActive(): boolean`
- `getReloadCount(): { count: number; firstAt: number }`
- `incrementReloadCount(): void`
- `isReloadLimitReached(): boolean`

Cada funcion lee constantes de `constants/storage.ts` y `constants/timing.ts` (sin cambios). Exportar todas con visibilidad publica (no `@internal`) para facilitar tests directos.

### S2 — Simplificar `useForceUpdate.ts`

Importar las cuatro funciones desde `src/utils/forceUpdate.ts`. El archivo del hook queda con:
- `performHardRefresh()` (funcion async, podria quedarse en el hook o moverse tambien a utils segun tamano resultante)
- `checkVersion()` (orquestadora, usa las funciones importadas)
- `useForceUpdate` (el React hook, unico responsable de `useState` + `useEffect` + `setInterval`)
- Los exports `@internal` para tests: `_checkVersion`, `_getReloadCount`, `_isReloadLimitReached`

### S3 — Actualizar tests

- Agregar `src/utils/forceUpdate.test.ts` con tests directos de las funciones extraidas (actualmente cubiertas indirectamente)
- Ajustar `src/hooks/useForceUpdate.test.ts` para que los imports de `_getReloadCount` y `_isReloadLimitReached` apunten al nuevo modulo o se re-exporten desde el hook para backward compat de tests

---

## Scope

| Item | Prioridad | Esfuerzo |
|------|-----------|----------|
| Crear `src/utils/forceUpdate.ts` con las 4 funciones extraidas | Alta | XS |
| Actualizar `src/hooks/useForceUpdate.ts` para importar de utils | Alta | XS |
| Crear `src/utils/forceUpdate.test.ts` con tests directos | Alta | XS |
| Ajustar `src/hooks/useForceUpdate.test.ts` si cambian exports internos | Media | XS |

**Esfuerzo total estimado:** S

---

## Out of Scope

- Cambiar la logica de cooldown o sus constantes (`FORCE_UPDATE_COOLDOWN_MS`, `MAX_FORCE_UPDATE_RELOADS`)
- Agregar nuevos consumidores de `isCooldownActive`
- Mover `performHardRefresh` (es async y esta acoplada al hook; puede quedar en el hook)
- Refactorizar el comportamiento de force update (eso es #316)

---

## Tests

### Archivos que necesitaran tests

| Archivo | Tipo | Que testear |
|---------|------|-------------|
| `src/utils/forceUpdate.test.ts` (nuevo) | unit | `isCooldownActive` con cooldown activo/vencido/localStorage ausente/corrupto; `getReloadCount` con data valida/invalida/ausente; `incrementReloadCount` primer uso / incremento / reset por ventana vencida; `isReloadLimitReached` bajo/igual/sobre el limite / ventana vencida |
| `src/hooks/useForceUpdate.test.ts` (ajuste) | unit | Verificar que los tests de `_getReloadCount` e `_isReloadLimitReached` siguen pasando tras mover la implementacion (ajustar imports si es necesario) |

### Criterios de testing

- Cobertura >= 80% del codigo nuevo en `src/utils/forceUpdate.ts`
- Los tests de `isCooldownActive` cubren: `localStorage` ausente (return false), dentro del cooldown (return true), fuera del cooldown (return false), `localStorage` lanza excepcion (return false)
- Los tests de `getReloadCount` cubren: ausente (defaults), JSON valido, JSON con campos no numericos, JSON invalido (parse error)
- Los tests de `isReloadLimitReached` cubren: bajo limite, igual al limite, ventana expirada (false aunque count alto)
- Todos los paths de `try/catch` cubiertos (localStorage puede no estar disponible)

---

## Seguridad

Este refactor es puramente estructural y no modifica comportamiento ni expone superficies nuevas.

- No hay escrituras nuevas a Firestore
- No hay nuevas colecciones ni endpoints
- No hay cambios en la logica de cooldown

### Vectores de ataque automatizado

No aplica — el refactor no agrega ni modifica superficies expuestas.

---

## Deuda tecnica y seguridad

```bash
gh issue list --label security --state open --json number,title
gh issue list --label "tech-debt" --state open --json number,title
```

### Issues relacionados

| Issue | Relacion | Accion |
|-------|----------|--------|
| #316 debounce/concurrency guard en useForceUpdate | Mismo archivo, distinto problema | No agravar — el refactor de extraccion no toca la logica de setInterval ni visibilitychange |
| #315 measureAsync en fetchAppVersionConfig | Mismo archivo, distinto problema | No agravar — no tocar checkVersion mas alla de los imports de utils |
| #314 import RETRY_DELAYS_MS desde timing.ts | Mismo archivo de constantes | No agravar — solo mover funciones, no tocar imports de constantes |

### Mitigacion incorporada

- Cumplimiento del patron "Archivos en `src/hooks/` DEBEN usar al menos un React hook" — elimina una instancia de violacion detectada

---

## Robustez del codigo

### Checklist de hooks async

- [ ] `useForceUpdate` ya tiene patron de cancelacion via `clearInterval` en cleanup de `useEffect` — no se modifica
- [ ] Los `try/catch` en las funciones extraidas se preservan intactos (localStorage puede no estar disponible)
- [ ] No se agregan nuevos `setState` ni efectos
- [ ] Las funciones extraidas a `utils/` no usan ningun React hook — correcto para `src/utils/`
- [ ] No hay constantes de localStorage hardcodeadas; usan keys de `src/constants/storage.ts`
- [ ] `src/utils/forceUpdate.ts` deberia quedar bien bajo 100 lineas (no es un riesgo de tamano)

### Checklist de observabilidad

No aplica — no hay queries nuevas ni eventos analytics.

### Checklist offline

No aplica — el modulo lee localStorage, no Firestore.

### Checklist de documentacion

- [ ] `docs/reference/patterns.md` no requiere actualizacion (no es un patron nuevo, es aplicacion del patron existente de hooks/services/utils)

---

## Offline

Este refactor no cambia comportamiento offline. Las funciones operan sobre `localStorage` y son synchronas.

| Operacion | Tipo | Estrategia offline | Fallback UI |
|-----------|------|-------------------|-------------|
| `isCooldownActive` | read localStorage | N/A (sync) | try/catch retorna false |
| `getReloadCount` | read localStorage | N/A (sync) | try/catch retorna defaults |
| `incrementReloadCount` | write localStorage | N/A (sync) | try/catch silencioso |

### Esfuerzo offline adicional: S (ninguno)

---

## Modularizacion y % monolitico

El refactor reduce acoplamiento al mover logica pura fuera de un hook.

### Checklist modularizacion

- [ ] Las funciones extraidas no usan React hooks — correctas para `src/utils/`
- [ ] `useForceUpdate.ts` queda mas delgado y cohesivo (solo codigo que usa `useState`/`useEffect`)
- [ ] No se agrega estado global
- [ ] No hay imports de Firebase SDK
- [ ] `src/utils/forceUpdate.ts` deberia quedar bajo 80 lineas
- [ ] Los exports `@internal` para tests pueden mantenerse en el hook o re-exportarse desde utils

### Impacto en % monolitico

| Aspecto | Impacto | Justificacion |
|---------|---------|---------------|
| Acoplamiento de componentes | = | No hay componentes nuevos |
| Estado global | = | No se agrega estado global |
| Firebase coupling | = | No hay Firebase SDK |
| Organizacion por dominio | + | Logica pura sale de hooks/ y va a utils/ donde corresponde |

---

## Accesibilidad y UI mobile

No aplica — es un refactor de logica pura sin UI.

---

## Success Criteria

1. `src/utils/forceUpdate.ts` existe y contiene las 4 funciones (`isCooldownActive`, `getReloadCount`, `incrementReloadCount`, `isReloadLimitReached`) sin logica de React
2. `src/hooks/useForceUpdate.ts` importa esas funciones desde `../utils/forceUpdate` y no las define localmente
3. `src/utils/forceUpdate.test.ts` existe con tests directos de todas las funciones y >= 80% de cobertura
4. Todos los tests existentes de `useForceUpdate.test.ts` siguen pasando sin modificar su logica de negocio
5. `npm run test:coverage` pasa sin degradacion de cobertura
