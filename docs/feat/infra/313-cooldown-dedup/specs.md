# Specs: Tech Debt — Extraer isCooldownActive a utils/forceUpdate.ts

**PRD:** [prd.md](prd.md)
**Fecha:** 2026-04-23

---

## Modelo de datos

No aplica. Este refactor no modifica Firestore, no agrega colecciones, ni cambia tipos.

Las funciones operan exclusivamente sobre `localStorage` usando las keys ya existentes en `src/constants/storage.ts`:

- `STORAGE_KEY_FORCE_UPDATE_LAST_REFRESH` — timestamp del ultimo hard refresh
- `STORAGE_KEY_FORCE_UPDATE_RELOAD_COUNT` — JSON `{ count: number; firstAt: number }`

Las constantes de timing no se modifican (`FORCE_UPDATE_COOLDOWN_MS`, `MAX_FORCE_UPDATE_RELOADS` en `src/constants/timing.ts`).

### Tipos involucrados

No se agregan tipos nuevos. El tipo interno del valor de `STORAGE_KEY_FORCE_UPDATE_RELOAD_COUNT` ya existe como objeto inlined en `getReloadCount`:

```ts
// Actualmente en useForceUpdate.ts — se mueve a utils/forceUpdate.ts sin cambios
{ count: number; firstAt: number }
```

---

## Firestore Rules

No aplica. Este refactor no toca Firestore.

### Rules impact analysis

No hay queries nuevas. Sin cambios en rules.

### Field whitelist check

No aplica. No hay escrituras nuevas a Firestore.

---

## Cloud Functions

No aplica.

---

## Seed Data

No aplica. No hay cambios de schema en Firestore.

---

## Componentes

No se crean ni modifican componentes React.

---

## Hooks

### `useForceUpdate` — modificacion menor

**Archivo:** `src/hooks/useForceUpdate.ts`

**Cambio:** eliminar las definiciones locales de las 4 funciones puras y reemplazarlas por imports de `src/utils/forceUpdate.ts`. El hook conserva:

- `performHardRefresh()` — async, acoplada al hook (usa `navigator.serviceWorker`, `caches`, `window.location.reload`)
- `checkVersion()` — orquestadora, usa las funciones importadas + servicios + analytics
- `writeLastCheck()` — helper local de una linea (puede quedarse en el hook)
- `useForceUpdate` — el React hook (`useState` + `useEffect` + `setInterval`)
- Los exports `@internal`: `_checkVersion`, `_getReloadCount`, `_isReloadLimitReached`

Los exports `@internal` `_getReloadCount` e `_isReloadLimitReached` pueden mantenerse en el hook como re-exports de lo que llega de `utils/forceUpdate.ts`, preservando backward compatibility de los tests sin ninguna modificacion al archivo de tests.

**Tamano resultante estimado:** ~155 lineas (baja de 232 a ~155, eliminando las ~77 lineas de las 4 funciones puras).

---

## Servicios

No se crean ni modifican servicios.

---

## Nuevo modulo: `src/utils/forceUpdate.ts`

**Responsabilidad:** funciones puras de cooldown y conteo de reloads. Sin dependencias de React.

### Funciones exportadas

```ts
/**
 * Retorna true si el cooldown de force-update esta activo
 * (se realizo un hard refresh hace menos de FORCE_UPDATE_COOLDOWN_MS).
 * Retorna false si localStorage no esta disponible o si el valor es invalido.
 */
export function isCooldownActive(): boolean

/**
 * Lee el contador de reloads desde localStorage.
 * Retorna { count: 0, firstAt: 0 } si el dato falta, es invalido o el parse falla.
 */
export function getReloadCount(): { count: number; firstAt: number }

/**
 * Incrementa el contador de reloads en localStorage.
 * Resetea automaticamente si la ventana de cooldown expiro.
 * No-op si localStorage no esta disponible.
 */
export function incrementReloadCount(): void

/**
 * Retorna true si se alcanzo el limite de reloads dentro de la ventana de cooldown.
 * Retorna false si la ventana expiro (aunque count sea alto).
 */
export function isReloadLimitReached(): boolean
```

**Dependencias del modulo:**

- `FORCE_UPDATE_COOLDOWN_MS`, `MAX_FORCE_UPDATE_RELOADS` de `src/constants/timing.ts`
- `STORAGE_KEY_FORCE_UPDATE_LAST_REFRESH`, `STORAGE_KEY_FORCE_UPDATE_RELOAD_COUNT` de `src/constants/storage.ts`

**Sin dependencias de React** — correcto para `src/utils/`.

**Tamano estimado:** ~80 lineas.

---

## Integracion

### Cambios en `src/hooks/useForceUpdate.ts`

1. Agregar al bloque de imports:

   ```ts
   import { isCooldownActive, getReloadCount, incrementReloadCount, isReloadLimitReached } from '../utils/forceUpdate';
   ```

2. Eliminar los cuerpos de las 4 funciones locales (`isCooldownActive`, `getReloadCount`, `incrementReloadCount`, `isReloadLimitReached`).

3. Los exports `@internal` se convierten en re-exports directos de utils:

   ```ts
   /** @internal Exported for testing only */
   export { getReloadCount as _getReloadCount } from '../utils/forceUpdate';
   /** @internal Exported for testing only */
   export { isReloadLimitReached as _isReloadLimitReached } from '../utils/forceUpdate';
   ```

   De esta forma `src/hooks/useForceUpdate.test.ts` no necesita ningun ajuste — los imports `_getReloadCount` e `_isReloadLimitReached` siguen resolviendo desde el mismo archivo del hook.

### Preventive checklist

- [x] **Service layer**: No hay imports de `firebase/firestore` en el nuevo modulo
- [x] **Duplicated constants**: Las constantes de storage y timing no se duplican — se importan desde sus ubicaciones canonicas
- [x] **Context-first data**: No aplica — el modulo lee `localStorage`, no Firestore ni Context
- [x] **Silent .catch**: No hay `.catch(() => {})` — todas las excepciones en `try/catch` tienen comportamiento explicito (return defaults o no-op documentado)
- [x] **Stale props**: No aplica — no hay componentes

---

## Tests

### `src/utils/forceUpdate.test.ts` (nuevo)

Tests directos de las funciones extraidas. No requieren mocks de React ni de Firebase.

| Funcion | Escenario | Tipo |
|---------|-----------|------|
| `isCooldownActive` | localStorage ausente → false | unit |
| `isCooldownActive` | dentro del cooldown (timestamp reciente) → true | unit |
| `isCooldownActive` | fuera del cooldown (timestamp expirado) → false | unit |
| `isCooldownActive` | localStorage.getItem lanza excepcion → false | unit |
| `getReloadCount` | clave ausente → `{ count: 0, firstAt: 0 }` | unit |
| `getReloadCount` | JSON valido con count y firstAt numericos | unit |
| `getReloadCount` | JSON con campos no numericos → defaults | unit |
| `getReloadCount` | JSON invalido (parse error) → defaults | unit |
| `incrementReloadCount` | primer uso → count: 1, firstAt > 0 | unit |
| `incrementReloadCount` | segundo uso dentro de ventana → count: 2 | unit |
| `incrementReloadCount` | ventana expirada → reset a count: 1, firstAt nuevo | unit |
| `incrementReloadCount` | localStorage lanza excepcion → no-op, sin crash | unit |
| `isReloadLimitReached` | count bajo el limite → false | unit |
| `isReloadLimitReached` | count igual al limite → true | unit |
| `isReloadLimitReached` | count sobre el limite → true | unit |
| `isReloadLimitReached` | ventana expirada aunque count alto → false | unit |

**Mock strategy:** usar `localStorage` real de jsdom + `vi.spyOn(localStorage, 'getItem').mockImplementation(() => { throw new Error() })` para testear los catch. `beforeEach` llama `localStorage.clear()`.

### `src/hooks/useForceUpdate.test.ts` (sin modificaciones de logica)

Con la estrategia de re-exports descripta en Integracion, todos los tests existentes siguen pasando sin cambios. Verificar que los imports `_getReloadCount` e `_isReloadLimitReached` resuelven correctamente tras el refactor.

| Archivo test | Que testear | Tipo |
|-------------|-------------|------|
| `src/utils/forceUpdate.test.ts` | 16 escenarios de las 4 funciones puras | unit |
| `src/hooks/useForceUpdate.test.ts` | Sin cambios — verificar que los ~25 tests existentes siguen pasando | regression |

---

## Analytics

No hay nuevos `logEvent` ni eventos analytics. El refactor es puramente estructural.

---

## Offline

No aplica. Las funciones operan sobre `localStorage` de forma sincrona. El comportamiento offline no cambia.

---

## Accesibilidad y UI mobile

No aplica. Refactor de logica pura sin UI.

---

## Textos y copy

No aplica. No hay textos visibles al usuario.

---

## Decisiones tecnicas

### Re-exports `@internal` en lugar de modificar el test file

Las funciones `_getReloadCount` e `_isReloadLimitReached` se re-exportan desde `useForceUpdate.ts` en lugar de modificar `useForceUpdate.test.ts`. Razon: minimizar la superficie de cambio y garantizar que los ~25 tests existentes pasan sin ninguna modificacion. Los tests del hook ejercitan `_checkVersion` que a su vez llama a las funciones de utils — el comportamiento observable no cambia.

Alternativa descartada: actualizar los imports en el test file para que apunten a `utils/forceUpdate`. Se descarto porque aumentaria el diff innecesariamente y romperia la convencion de que los exports `@internal` de un hook se importan desde el hook.

### `performHardRefresh` se queda en el hook

`performHardRefresh` es async y depende de `navigator.serviceWorker`, `caches` y `window.location.reload` — APIs de browser que pertenecen al entorno de ejecucion del hook, no a logica pura. Moverla a `utils/` no aporta valor de testabilidad porque igual requeriria los mismos mocks de browser. Se mantiene en el hook.

### `writeLastCheck` se queda en el hook

Es una funcion de una linea con una responsabilidad especifica del orquestador `checkVersion`. Moverla a utils agregaria complejidad sin beneficio de testabilidad (ya esta cubierta indirectamente por los tests de `_checkVersion`).

---

## Hardening de seguridad

No aplica. Este refactor no agrega ni modifica superficies expuestas. No hay nuevas colecciones, endpoints, ni vectores de ataque.

---

## Deuda tecnica: mitigacion incorporada

| Issue | Que se resuelve | Paso del plan |
|-------|----------------|---------------|
| #313 `isCooldownActive` duplication | Mover las 4 funciones puras a `utils/forceUpdate.ts` — ubicacion canonica | Fase 1 completa |

Issues relacionados que NO se tocan (out of scope, no agravar):

| Issue | Por que no se toca |
|-------|-------------------|
| #316 debounce/concurrency guard en `useForceUpdate` | Logica de `setInterval`/`visibilitychange` — distinto problema |
| #315 `measureAsync` en `fetchAppVersionConfig` | Solo se modifican imports del hook, no la logica de `checkVersion` |
| #314 import `RETRY_DELAYS_MS` desde `timing.ts` | Solo se tocan las funciones puras, no `fetchAppVersionConfig` ni `config.ts` |

---

## Estimacion de tamano de archivos resultantes

| Archivo | Lineas actuales | Lineas estimadas | Estado |
|---------|----------------|-----------------|--------|
| `src/utils/forceUpdate.ts` | 0 (nuevo) | ~80 | Ideal |
| `src/utils/forceUpdate.test.ts` | 0 (nuevo) | ~180 | Ideal |
| `src/hooks/useForceUpdate.ts` | 232 | ~155 | Ideal |
| `src/hooks/useForceUpdate.test.ts` | 586 | 586 (sin cambios) | Aceptable |
