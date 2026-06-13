# Specs: Tech Debt — Retry Delays timing.ts consolidation (#314)

**PRD:** [prd.md](prd.md)
**Fecha:** 2026-04-23

---

## Estado actual del codigo (critico para entender el scope real)

El PRD fue escrito asumiendo que la logica de retry estaba ausente en `config.ts`. Al leer el codigo real se encuentra que **la logica de retry ya esta completamente implementada** desde v2.39.0:

- `src/services/config.ts` tiene un loop `for (attempt = 0; attempt < 3; attempt++)` con `isRetryable()`, delays entre reintentos, y fallback a cache local.
- `src/constants/timing.ts` exporta `FORCE_UPDATE_FETCH_RETRY_DELAYS_MS = [500, 1500]` con documentacion.
- `src/services/config.test.ts` cubre 7 escenarios: happy path, retry parcial, agotamiento de reintentos, error no-retryable, doc no existe, fallback a cache, cache tambien falla.
- `src/utils/retry.ts` **no existe** — el helper `withRetry` del PRD tampoco fue creado.

El trabajo real que queda es:

1. En `config.ts`: reemplazar `const RETRY_DELAYS_MS = [500, 1500]` por un import de `FORCE_UPDATE_FETCH_RETRY_DELAYS_MS` desde `timing.ts`.
2. Crear `src/utils/retry.ts` con `withRetry<T>` y su test `src/utils/retry.test.ts`.
3. **No** refactorizar `fetchAppVersionConfig` para usar `withRetry` internamente — la logica actual con el loop for ya funciona, esta testeada, y es correctamente especifica al comportamiento de fallback a cache. `withRetry` es para uso futuro en otros servicios.

---

## Modelo de datos

No hay cambios a Firestore. Esta tarea es puramente de capa de utilidades y servicios.

## Firestore Rules

No aplica. Sin cambios.

### Rules impact analysis

No hay queries nuevas. `fetchAppVersionConfig` no cambia su comportamiento observable.

| Query | Coleccion | Auth context | Rule que lo permite | Cambio necesario? |
|-------|-----------|-------------|--------------------|--------------------|
| `fetchAppVersionConfig` (sin cambio) | config | Cualquier autenticado | `allow read: if auth != null` en coleccion config | No |

### Field whitelist check

No aplica. Sin cambios de escritura a Firestore.

## Cloud Functions

No aplica.

## Seed Data

No aplica. Sin cambios de schema.

---

## Componentes

No hay componentes nuevos ni modificados. Esta tarea no toca la UI.

---

## Hooks

No hay hooks nuevos ni modificados. `useForceUpdate.ts` mockea `fetchAppVersionConfig` directamente y no requiere cambios.

---

## Servicios

### `src/services/config.ts` — cambio minimo

**Cambio:** eliminar `const RETRY_DELAYS_MS = [500, 1500]` y agregar import de `FORCE_UPDATE_FETCH_RETRY_DELAYS_MS` desde `../constants/timing`. Actualizar la referencia en el loop.

**Antes:**
```typescript
const RETRY_DELAYS_MS = [500, 1500];
// ...
await new Promise((r) => setTimeout(r, RETRY_DELAYS_MS[attempt]));
```

**Despues:**
```typescript
import { FORCE_UPDATE_FETCH_RETRY_DELAYS_MS } from '../constants/timing';
// ...
await new Promise((r) => setTimeout(r, FORCE_UPDATE_FETCH_RETRY_DELAYS_MS[attempt]));
```

El comportamiento en runtime es identico. Los tests existentes en `config.test.ts` siguen pasando sin cambios.

---

## Utilidades nuevas

### `src/utils/retry.ts`

Funcion generica reutilizable para reintentos con backoff. No tiene dependencias de React ni de Firebase.

**Interfaz:**
```typescript
/**
 * Ejecuta `fn` y la reintenta con delays entre intentos si falla.
 * `delays` define cuantos reintentos y cuanto esperar antes de cada uno.
 * Si `delays` esta vacio, cualquier error se lanza inmediatamente.
 * Si todos los reintentos se agotan, relanza el ultimo error.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  delays: number[],
): Promise<T>
```

**Implementacion referencia (del PRD):**
```typescript
async function withRetry<T>(
  fn: () => Promise<T>,
  delays: number[],
): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (delays.length === 0) throw err;
    await new Promise((resolve) => setTimeout(resolve, delays[0]));
    return withRetry(fn, delays.slice(1));
  }
}
```

**Archivo:** `src/utils/retry.ts`
**Lineas estimadas:** ~25 (con JSDoc)

**Nota:** `withRetry` es un helper de proposito general. `fetchAppVersionConfig` NO se refactoriza para usarlo porque su logica de fallback a cache local (que distingue entre error retryable y no-retryable, y entre `getDocFromServer` y `getDoc`) es mas compleja que lo que `withRetry` cubre. `withRetry` queda disponible para futuros servicios que necesiten retry simple.

---

## Integracion

### Cambios en archivos existentes

| Archivo | Cambio |
|---------|--------|
| `src/services/config.ts` | Eliminar `RETRY_DELAYS_MS` local; importar `FORCE_UPDATE_FETCH_RETRY_DELAYS_MS` |
| `src/constants/timing.ts` | Sin cambios (ya tiene la constante correcta) |

### Sin cambios en

- `src/hooks/useForceUpdate.ts`
- `src/hooks/useForceUpdate.test.ts`
- `firestore.rules`
- Cualquier componente

### Preventive checklist

- [x] **Service layer**: `config.ts` no importa `firebase/firestore` directamente — ya usa `db` de `config/firebase` e importa solo tipos/funciones de `firebase/firestore`. Sin cambio.
- [x] **Duplicated constants**: `RETRY_DELAYS_MS = [500, 1500]` es exactamente la deuda que se resuelve — se elimina el duplicado.
- [x] **Context-first data**: No aplica.
- [x] **Silent .catch**: No hay `.catch(() => {})` nuevo. Los warn existentes se mantienen.
- [x] **Stale props**: No aplica — no hay componentes.

---

## Tests

### Archivos de test

| Archivo test | Que testear | Tipo |
|-------------|-------------|------|
| `src/utils/retry.test.ts` (nuevo) | `withRetry`: exito en primer intento; reintento con delay correcto; agotamiento lanza el ultimo error; `delays=[]` lanza inmediatamente sin delay | Unitario (Vitest) |
| `src/services/config.test.ts` (existente) | Sin cambios necesarios — los 7 tests actuales siguen pasando. El import de la constante no cambia el comportamiento. | — |

### Mock strategy para `retry.test.ts`

- `vi.useFakeTimers()` para avanzar los delays sin espera real.
- `fn` mockeada con `vi.fn()` que puede rechazar N veces y luego resolver.
- Verificar numero de llamadas a `fn` y que el error correcto se propaga.

---

## Analytics

No aplica. El retry es transparente al usuario.

---

## Offline

`fetchAppVersionConfig` no cambia su comportamiento offline. Si el dispositivo esta offline, `getDocFromServer` falla inmediatamente y el loop intenta hasta 3 veces (con delays 500ms, 1500ms) antes de hacer fallback a cache local. Este comportamiento ya existia y no cambia.

### Cache strategy

| Dato | Estrategia | TTL | Storage |
|------|-----------|-----|---------|
| `config/appVersion` | `getDocFromServer` → fallback a `getDoc` (IndexedDB de Firestore) | Sin TTL explicito | IndexedDB (gestionado por Firebase SDK) |

---

## Accesibilidad y UI mobile

No aplica.

---

## Textos y copy

No aplica.

---

## Decisiones tecnicas

### Por que NO refactorizar `fetchAppVersionConfig` para usar `withRetry`

`withRetry` es una abstraccion simple: reintenta una funcion N veces. `fetchAppVersionConfig` tiene logica mas rica:
- Distingue errores retryables de no-retryable (con `isRetryable`).
- Tiene dos funciones distintas (`getDocFromServer` para los reintentos, `getDoc` para el fallback).
- Distingue el source del resultado (`'server'`, `'server-retry'`, `'cache'`, `'empty'`).

Refactorizar para usar `withRetry` requeriria complejidad adicional (predicado de retryability, two-phase fetch) que eliminaria el beneficio de la abstraccion y romperia los 7 tests existentes. La decision es crear `withRetry` como utilidad para casos futuros mas simples, sin tocar la logica correcta y testeada de `fetchAppVersionConfig`.

### Por que crear `src/utils/retry.ts` de todas formas

- El PRD lo requiere explicitamente como entregable.
- Establece el patron para futuros servicios que puedan necesitar retry simple.
- Es un archivo de ~25 lineas con alta testabilidad aislada.
- Cumple el criterio del PRD: "no hay magic numbers `[500, 1500]` hardcodeados en ningun archivo de `src/`" (junto con el import desde timing.ts en config.ts).

---

## Hardening de seguridad

No hay superficies nuevas. Esta tarea es read-only desde Firestore, sin cambios de reglas.

### Vectores de ataque mitigados

| Ataque | Mitigacion | Archivo |
|--------|-----------|---------|
| DoS por retry ilimitado | Maximo 3 reads por check de version (1 + 2 reintentos) — sin cambio | `config.ts` |

---

## Deuda tecnica: mitigacion incorporada

| Issue | Que se resuelve | Paso del plan |
|-------|----------------|---------------|
| #314 — `RETRY_DELAYS_MS` duplicado | Eliminar la constante local y usar la canonica de `timing.ts` | Fase 1, paso 2 |

---

## Estimacion de tamano de archivos resultantes

| Archivo | Lineas actuales | Lineas estimadas post-cambio |
|---------|----------------|------------------------------|
| `src/services/config.ts` | 69 | ~69 (reemplaza 1 linea por 1 import) |
| `src/constants/timing.ts` | 46 | 46 (sin cambio) |
| `src/utils/retry.ts` | 0 (nuevo) | ~25 |
| `src/utils/retry.test.ts` | 0 (nuevo) | ~70 |
| `src/services/config.test.ts` | 180 | 180 (sin cambio) |

Ningun archivo supera 400 lineas.
