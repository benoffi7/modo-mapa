# Specs: Debounce y guard de concurrencia en useForceUpdate

**PRD:** [prd.md](prd.md)
**Fecha:** 2026-04-23

---

## Estado actual del codigo

La validacion de Sofia confirma que los listeners `visibilitychange` y `online` YA ESTAN implementados en `src/hooks/useForceUpdate.ts` desde v2.39.0. El `useEffect` existente (lineas 186-229) ya registra `handleVisibilityChange` y `handleOnline` y los remueve en cleanup.

Lo que NO existe todavia:

- `checkingRef`: guard de concurrencia que previene multiples `checkVersion()` en vuelo simultaneamente.
- `lastCheckTs`: ref de debounce que previene rafagas de eventos dentro de la ventana de 5s.
- Los handlers actuales llaman `void run()` directamente sin ningun guard.

El scope de este issue es exclusivamente agregar esos dos guards al hook existente y la constante correspondiente.

---

## Modelo de datos

No hay cambios en Firestore. No hay tipos nuevos. No hay colecciones nuevas.

Los dos refs son estado interno del hook — no se exponen en la API publica ni en el store.

```typescript
// Internos al hook, no exportados
const checkingRef = useRef<boolean>(false);   // guard de concurrencia
const lastCheckTs = useRef<number>(0);         // debounce por eventos
```

La API publica del hook no cambia:

```typescript
export function useForceUpdate(): { updateAvailable: boolean }
```

---

## Firestore Rules

Sin cambios. Este feature no agrega ni modifica colecciones, campos ni reglas.

### Rules impact analysis

| Query (service file) | Collection | Auth context | Rule que lo permite | Cambio necesario? |
|---------------------|------------|-------------|-------------------|----------------|
| `fetchAppVersionConfig()` | `config/appVersion` | Publica (sin auth) | `allow read: if true` existente | No |

### Field whitelist check

No aplica — no se agregan ni modifican campos en Firestore.

---

## Cloud Functions

Sin cambios. No hay triggers ni callables nuevas.

---

## Seed Data

No aplica — no hay cambios de schema en Firestore.

---

## Componentes

Sin componentes nuevos ni modificados. Este feature es puramente interno al hook.

---

## Hooks

### `useForceUpdate` (modificado)

**Archivo:** `src/hooks/useForceUpdate.ts`

**Cambios internos:**

1. Dos refs nuevas (dentro de `useForceUpdate`, antes del `useEffect`):

```typescript
const checkingRef = useRef<boolean>(false);
const lastCheckTs = useRef<number>(0);
```

2. La funcion `run()` interna recibe el guard de concurrencia:

```typescript
async function run() {
  // Guard concurrencia: solo una instancia en vuelo a la vez
  if (checkingRef.current) return;
  checkingRef.current = true;
  try {
    const { status, minVersion, source } = await checkVersion();
    if (status === 'limit-reached') setUpdateAvailable(true);
    // ... logica EVT_APP_VERSION_ACTIVE sin cambios ...
  } finally {
    checkingRef.current = false;
  }
}
```

3. Los handlers existentes reciben el debounce de eventos:

```typescript
const handleVisibilityChange = () => {
  if (document.visibilityState !== 'visible') return;
  if (Date.now() - lastCheckTs.current < FORCE_UPDATE_EVENT_DEBOUNCE_MS) return;
  lastCheckTs.current = Date.now();
  void run();
};

const handleOnline = () => {
  if (Date.now() - lastCheckTs.current < FORCE_UPDATE_EVENT_DEBOUNCE_MS) return;
  lastCheckTs.current = Date.now();
  void run();
};
```

**Notas de implementacion:**

- `lastCheckTs` NO aplica al `void run()` del mount ni al `setInterval`. Solo a los event handlers.
- El `finally` en `run()` garantiza que `checkingRef.current = false` se ejecuta en TODOS los paths: success, `limit-reached`, `reloading` (antes de `performHardRefresh`), y `error`.
- Ambas refs son `useRef` — no causan re-renders.
- La API publica `{ updateAvailable: boolean }` no cambia.

**Estimacion de lineas resultantes:** ~250 (vs 233 actuales). Dentro del limite de 400.

---

## Servicios

Sin cambios en servicios.

---

## Constantes

### `src/constants/timing.ts` (modificado)

Agregar al final del archivo:

```typescript
/**
 * Ventana minima entre checks de version disparados por eventos de visibilidad/red.
 * Previene rafagas de lecturas a Firestore cuando el usuario alterna tabs rapidamente
 * o cuando la conexion reconecta de forma intermitente.
 * No aplica al setInterval (que tiene su propio intervalo de 30 min).
 */
export const FORCE_UPDATE_EVENT_DEBOUNCE_MS = 5_000; // 5s
```

El nombre distingue claramente de `FORCE_UPDATE_COOLDOWN_MS` (que controla la ventana entre recargas forzadas, no entre checks).

---

## Integracion

No hay cambios de integracion. `useForceUpdate` es consumido por un unico punto (`AppShell` o equivalente) que no necesita modificaciones — la API del hook no cambia.

### Preventive checklist

- [x] **Service layer**: No hay imports de `firebase/firestore` en componentes nuevos.
- [x] **Duplicated constants**: `FORCE_UPDATE_EVENT_DEBOUNCE_MS` es nueva, no duplica ninguna existente.
- [x] **Context-first data**: No se accede a Context para datos que ya existen.
- [x] **Silent .catch**: No hay `.catch(() => {})` nuevo — el catch existente en `checkVersion()` ya usa `writeLastCheck()` y retorna `'error'` explicitamente.
- [x] **Stale props**: No hay props mutables — el hook no recibe props.

---

## Tests

> **ADVERTENCIA DE REGRESIÓN — revisado por Diego (2026-04-23):** Los 3 tests de listeners existentes que dispatchean eventos inmediatamente después del mount (líneas ~310, ~340, ~374 del test file actual) pueden fallar con el guard `checkingRef` si el `run()` del mount sigue in-flight cuando el evento llega — el guard hace `early-return` y el test recibe igualdad donde espera incremento. El implementador DEBE revisar esos tests durante TDD y, si fallan, ajustar el pattern de `await` (usar `await vi.waitFor(...)` o `await act(async () => { await Promise.resolve(); })` adicional antes del dispatch). Esto no es un bug del guard sino una consecuencia correcta del comportamiento esperado.

El archivo `src/hooks/useForceUpdate.test.ts` ya existe con 27 tests. Se amplia con los siguientes tests nuevos (todos en ese mismo archivo):

### Tests nuevos a agregar

| Test | Describe block | Que verifica |
|------|---------------|-------------|
| `checkingRef guard: segunda invocacion simultanea no llama fetchAppVersionConfig` | `concurrency guard` | Si `run()` ya esta en vuelo, una segunda llamada retorna sin llamar al service |
| `checkingRef guard: libera el flag en finally cuando checkVersion retorna error` | `concurrency guard` | `checkingRef.current` queda en `false` despues de un error |
| `checkingRef guard: libera el flag en finally cuando checkVersion retorna limit-reached` | `concurrency guard` | `checkingRef.current` queda en `false` despues de `limit-reached` |
| `debounce: segundo evento dentro de 5s no llama fetchAppVersionConfig` | `debounce guard` | Con `vi.useFakeTimers()`, evento rapido dentro de la ventana es ignorado |
| `debounce: evento despues de 5s SI llama fetchAppVersionConfig` | `debounce guard` | Con `vi.useFakeTimers()`, evento despues de `FORCE_UPDATE_EVENT_DEBOUNCE_MS` procede |
| `debounce: visibilitychange hidden no actualiza lastCheckTs` | `debounce guard` | El guard de visibilidad se aplica antes del debounce — el hidden path no consume el debounce |
| `debounce no aplica al mount inicial` | `debounce guard` | El `void run()` del mount siempre procede, incluso si se llama dentro de 5s del ultimo evento |
| `debounce no aplica al setInterval` | `debounce guard` | Las ejecuciones del intervalo siempre proceden independientemente de `lastCheckTs` |
| `removeEventListener llamado en cleanup` | `cleanup` | `vi.spyOn(document, 'removeEventListener')` verifica que ambos listeners se remueven |
| `combinacion debounce + concurrencia bajo rapid firing` | `combined` | Multiples eventos rapidos resultan en una sola llamada a `fetchAppVersionConfig` |

### Estrategia de mock

Los tests de debounce usan `vi.useFakeTimers()` + `vi.setSystemTime()` para controlar `Date.now()`. Los tests de concurrencia usan `mockFetchAppVersionConfig` con una Promise que se resuelve manualmente (deferred pattern). Los tests de cleanup usan `vi.spyOn` sobre `document.removeEventListener` y `window.removeEventListener`.

Los tests de la hook que requieren salir del modo DEV siguen el patron ya establecido en el archivo: `vi.stubEnv('DEV', false)` + `vi.unstubAllEnvs()` en cleanup.

---

## Analytics

Sin cambios. Los eventos existentes `EVT_FORCE_UPDATE_TRIGGERED`, `EVT_FORCE_UPDATE_LIMIT_REACHED` y `EVT_APP_VERSION_ACTIVE` siguen siendo suficientes. Los guards no introducen eventos nuevos.

Se puede agregar opcionalmente (no requerido):

```typescript
logger.warn('checkVersion skipped: in-flight');  // en checkingRef guard
logger.warn('checkVersion skipped: debounce');    // en lastCheckTs guard
```

Estos son logs de debug, no analytics.

---

## Offline

### Cache strategy

| Dato | Estrategia | TTL | Storage |
|------|-----------|-----|---------|
| `config/appVersion` | Firestore persistent cache (prod) | Manejado por Firestore SDK | IndexedDB |

### Writes offline

No aplica — sin writes.

### Fallback UI

Sin cambios. El comportamiento offline es identico al actual: `fetchAppVersionConfig()` falla, `checkVersion()` retorna `{ status: 'error' }`, el hook no cambia `updateAvailable`. Los guards de debounce y concurrencia no introducen estado persistente.

El listener `online` sigue siendo el mecanismo de recovery — cuando la red vuelve, dispara `run()` con el guard de debounce aplicado.

---

## Accesibilidad y UI mobile

No aplica — este feature no tiene superficie de UI.

---

## Textos y copy

No aplica — sin texto visible al usuario.

---

## Decisiones tecnicas

### Por que `useRef` y no `useState`

`checkingRef` y `lastCheckTs` son refs porque:
1. Sus cambios no deben causar re-renders del componente.
2. Son leidos y escritos de forma sincrona dentro de closures del `useEffect`.
3. `setState` seria unsafe en el `finally` post-unmount (aunque React 18+ silencia el warning, es semanticamente incorrecto).

### Por que el debounce NO aplica al mount ni al intervalo

El mount inicial necesita siempre ejecutar para detectar updates que ocurrieron mientras la app estaba cerrada. El intervalo de 30 min es su propio throttle — aplicar debounce encima seria redundante e incorrecto (podria bloquear la ejecucion si un evento ocurrio justo antes del intervalo).

### Por que la constante es `FORCE_UPDATE_EVENT_DEBOUNCE_MS` y no `FORCE_UPDATE_DEBOUNCE_MS`

El sufijo `_EVENT_` hace explicito que aplica solo a los handlers de eventos, no al intervalo. Reduce la ambiguedad para futuros lectores del codigo.

### Alternativa descartada: debounce con `setTimeout`

Se descarto usar `setTimeout`/`clearTimeout` en los handlers porque introduce complejidad de cleanup (el timeout debe limpiarse en el return del `useEffect`). El patron de `useRef<number>(0)` con comparacion de timestamps es mas simple y sin side effects de scheduling.

---

## Hardening de seguridad

### Firestore rules requeridas

Sin cambios en rules.

### Rate limiting

Sin cambios. Los guards son client-side y complementan (no reemplazan) los rate limits server-side existentes en `fetchAppVersionConfig`.

### Vectores de ataque mitigados

| Ataque | Mitigacion | Archivo |
|--------|-----------|---------|
| Script XSS que dispara eventos `visibilitychange`/`online` en rafaga para generar N lecturas a Firestore | `checkingRef` bloquea concurrencia; `lastCheckTs` bloquea rafagas dentro de 5s | `src/hooks/useForceUpdate.ts` |

---

## Deuda tecnica: mitigacion incorporada

| Issue | Que se resuelve | Paso del plan |
|-------|----------------|---------------|
| #313 `isCooldownActive` duplication | No se toca en este PR — refactor separable, scope controlado | Fuera de scope |
| #315 `measureAsync` en `fetchAppVersionConfig` | No se toca — los guards reducen frecuencia de llamadas complementariamente | Fuera de scope |
