# Specs: Separate `lastCheckTs` refs per event type in `useForceUpdate`

**PRD:** [prd.md](prd.md)
**Fecha:** 2026-04-23

---

## Modelo de datos

Sin cambios. No se tocan colecciones Firestore ni se agregan/modifican tipos en `src/types/`.

El cambio es puramente interno a `src/hooks/useForceUpdate.ts`: se reemplaza una ref `number` compartida por dos refs `number` independientes, cada una asociada a un listener.

## Firestore Rules

Sin cambios. El hook no escribe a Firestore y la lectura via `fetchAppVersionConfig` (`services/config.ts`) sigue usando la regla existente para `appConfig/version`.

### Rules impact analysis

| Query (service file) | Collection | Auth context | Rule that allows it | Change needed? |
|---------------------|------------|-------------|-------------------|----------------|
| `fetchAppVersionConfig` (services/config.ts) | appConfig | Any authenticated | Regla existente para `appConfig/version` | No |

Ninguna nueva query introducida por este cambio.

### Field whitelist check

No aplica. El hook no escribe a Firestore.

## Cloud Functions

Sin cambios. No se agregan triggers ni callables.

## Seed Data

No aplica. No se introducen colecciones nuevas ni campos requeridos.

## Componentes

Sin cambios. El hook no renderiza UI y su API publica (`useForceUpdate(): { updateAvailable: boolean }`) no cambia. Los consumidores (ej. `AppShell`, `ForceUpdateBanner`) siguen usandolo igual.

### Mutable prop audit

No aplica. El hook no recibe props.

## Textos de usuario

Sin cambios. El hook no emite texto user-facing. `logger.log`/`logger.warn` son logs internos en ingles (patron vigente).

## Hooks

### `useForceUpdate` (modificado)

Ubicacion: `src/hooks/useForceUpdate.ts:127-192`

Cambio interno:

```ts
// ANTES (linea 130)
const lastCheckTs = useRef<number>(0);

// DESPUES
const lastVisibilityTs = useRef<number>(0);
const lastOnlineTs = useRef<number>(0);
```

Handlers actualizados:

```ts
const handleVisibilityChange = () => {
  if (document.visibilityState !== 'visible') return;
  if (Date.now() - lastVisibilityTs.current < FORCE_UPDATE_EVENT_DEBOUNCE_MS) return;
  lastVisibilityTs.current = Date.now();
  void run();
};

const handleOnline = () => {
  if (Date.now() - lastOnlineTs.current < FORCE_UPDATE_EVENT_DEBOUNCE_MS) return;
  lastOnlineTs.current = Date.now();
  void run();
};
```

Invariantes preservados:

- `checkingRef` (concurrency guard boolean) sigue siendo el gate contra concurrent `run()`. Descarta (no serializa) re-entradas.
- `FORCE_UPDATE_EVENT_DEBOUNCE_MS = 5000` sin cambios (en `src/constants/timing.ts`).
- `void run()` del mount y `setInterval` cada 30min no consultan ningun debounce ref.
- `try/finally` en `run()` libera `checkingRef` siempre.
- API publica (`{ updateAvailable: boolean }`) sin cambios.

Dependencias del `useEffect`: `[]` (como ahora). Los refs se acceden siempre via `.current` desde los listeners.

## Servicios

Sin cambios. `services/config.ts::fetchAppVersionConfig` no se toca.

## Integracion

### Preventive checklist

- [x] **Service layer**: El hook ya usa `services/config.ts::fetchAppVersionConfig`. No se introducen imports directos de `firebase/firestore`.
- [x] **Duplicated constants**: No se agregan constantes. `FORCE_UPDATE_EVENT_DEBOUNCE_MS` sigue en `constants/timing.ts`.
- [x] **Context-first data**: No aplica. El hook no consume contextos.
- [x] **Silent .catch**: El `catch` existente en `checkVersion` (linea 113) se mantiene — falla silenciosa es intencional (offline/Firestore error) y ya esta documentado con comentario.
- [x] **Stale props**: No aplica. El hook no recibe props.

Ningun consumidor del hook necesita cambios. La API publica es identica.

## Tests

### Ubicacion

`src/hooks/useForceUpdate.test.ts` — modificar el grupo `describe('debounce guard', ...)` (actualmente lineas ~664-780).

### Tests a modificar

| Archivo test | Que testear | Tipo |
|-------------|-------------|------|
| `src/hooks/useForceUpdate.test.ts` — `debounce guard` | Cross-event independence: evento `online` no consume debounce de `visibilitychange` y viceversa | Hook (modificar + agregar) |

### Tests a preservar sin cambios

| Test | Linea | Por que preservar |
|------|-------|-------------------|
| `segunda invocacion simultanea no llama fetchAppVersionConfig dos veces` | `useForceUpdate.test.ts:590-614` | Cubre el caso `checkingRef` descarta (primer fetch EN VUELO + segundo evento → 1 call). Complementario al test nuevo — no contradictorio. Ver PRD seccion "Preservar test existente". |

### Tests existentes que siguen iguales

Los siguientes tests del grupo `debounce guard` no cambian su intencion (siguen pasando porque el comportamiento intra-evento es el mismo):

- `segundo evento online dentro de 5s no llama fetchAppVersionConfig` (lineas ~671-698) — sigue verde (usa `lastOnlineTs`).
- `evento online despues de 5s SI llama fetchAppVersionConfig` (lineas ~700-726) — sigue verde (usa `lastOnlineTs`).
- `mount y setInterval no son afectados por debounce` (lineas ~758-779) — sigue verde.

### Tests a actualizar

**`visibilitychange hidden no consume el debounce` (lineas ~728-756)**

Extender el caso para verificar tambien que un `online` intercalado NO consume el debounce de `visibilitychange`. Estructura:

1. Render hook (mount dispara `run()` — drenar).
2. Dispatch `online` (consume debounce de `lastOnlineTs`, no de `lastVisibilityTs`).
3. Inmediatamente dispatch `visibilitychange → visible` (dentro de 5s del `online`, pero con `lastVisibilityTs=0` aun → DEBE pasar).
4. Assert: `fetchAppVersionConfig.mock.calls.length > callsAfterMount`.

### Tests a agregar

**`visible y online dentro de 5s AMBOS llaman fetchAppVersionConfig (cross-event independence)`**

Regresion del bug de #321. Estructura (basada en PRD "Test nuevo: estructura requerida"):

1. `vi.useFakeTimers(); vi.stubEnv('DEV', false);`
2. `mockFetchAppVersionConfig.mockResolvedValue({ minVersion: undefined, source: 'server' as const });` — fetch resuelve inmediato.
3. Render hook + drenar mount `run()`: `await act(async () => { renderHook(...); await Promise.resolve(); });`
4. Drenar cualquier microtask pendiente para asegurar que `checkingRef` volvio a `false`: `await act(async () => { await Promise.resolve(); });`
5. Guardar `callsAfterMount = mockFetchAppVersionConfig.mock.calls.length`.
6. Dispatch `visibilitychange → visible` y drenar.
7. Dispatch `online` dentro de 5s (sin avanzar `vi.setSystemTime`) y drenar.
8. Assert: `mockFetchAppVersionConfig.mock.calls.length === callsAfterMount + 2` — ambos eventos dispararon fetch.

Key: el fetch del mock resuelve inmediato (no queda en vuelo), por lo que `checkingRef` no interviene y el test valida unicamente la independencia cross-event del debounce. Esto lo diferencia del test de concurrencia `useForceUpdate.test.ts:590-614`, que mockea un fetch pendiente.

**`segundo visibilitychange dentro de 5s no llama fetchAppVersionConfig (intra-event dedup)`** (complemento de simetria con el test existente `segundo evento online dentro de 5s...`)

Opcional pero recomendado para cubrir explicitamente el debounce intra-evento de `visibilitychange` (actualmente solo se testea para `online`). Estructura simetrica al test existente de `online`, usando `document.dispatchEvent(new Event('visibilitychange'))` con `visibilityState: 'visible'`.

### Mock strategy

Sin cambios respecto a los mocks existentes en el archivo:

- `mockFetchAppVersionConfig` ya declarado (via `vi.hoisted()` + `vi.mock('../services/config', ...)`).
- `mockTrackEvent`, `mockReload`, `mockIsBusyFlagActive` ya declarados.
- Control de tiempo via `vi.useFakeTimers()` + `vi.setSystemTime(...)` (patron ya usado en el grupo).

## Analytics

Sin cambios. Los eventos existentes (`EVT_APP_VERSION_ACTIVE`, `EVT_FORCE_UPDATE_TRIGGERED`, `EVT_FORCE_UPDATE_LIMIT_REACHED`) siguen emitiendose igual. La telemetria de frecuencia de check por tipo de evento sera mas fiel (sin drop silencioso cross-event) — nota de contexto solamente, sin cambio en los llamados `trackEvent`.

---

## Offline

Sin cambios. El hook es tolerante a offline via el `catch` de `checkVersion` (status `error`).

### Cache strategy

| Dato | Estrategia | TTL | Storage |
|------|-----------|-----|---------|
| `appConfig/version` | `getDocFromServer` con 2 reintentos, fallback a cache local (#315) | N/A (cache Firestore) | IndexedDB (Firestore persistent cache) |

Sin cambios respecto a comportamiento actual.

### Writes offline

No aplica. El hook no escribe.

### Fallback UI

No aplica. El hook expone `updateAvailable: boolean` (sin cambios). El consumidor (`AppShell`) decide si mostrar banner.

---

## Accesibilidad y UI mobile

No aplica. El hook no renderiza UI ni introduce controles nuevos.

### Reglas

- No se agregan `IconButton`, `Typography onClick`, `Box onClick`, imagenes, ni touch targets.
- No se agregan componentes con fetch ni estados de error visibles.

## Textos y copy

Sin cambios. No hay strings user-facing.

### Reglas de copy

No aplica.

---

## Decisiones tecnicas

1. **Dos refs en vez de un objeto o map** — `useRef<{ visibility: number; online: number }>` seria tecnicamente equivalente pero mas verboso y sin beneficio: el acceso es directo desde listeners distintos, no hay iteracion. Dos refs separadas mapean 1:1 con los listeners y el codigo se lee linealmente.
2. **Sin extraer helper `useEventDebounce`** — seria over-engineering para 2 usos internos. Tres lineas por handler son legibles y el cambio futuro (si aparece un tercer listener) tiene un costo marginal. Scope deliberadamente acotado al split de refs (ver PRD "Out of Scope").
3. **Mantener `FORCE_UPDATE_EVENT_DEBOUNCE_MS = 5000`** — el intervalo de 5s sigue justificado como anti-chatter para el mismo tipo de evento. Cambiarlo es out of scope.
4. **No retry del evento descartado por `checkingRef`** — el caso "segundo evento llega con primer run en vuelo → se pierde" se mantiene como deuda aceptada (ver PRD "Out of Scope"). El `setInterval` de 30min cubre el gap en el peor caso.
5. **Preservar el test de concurrencia existente** — Sofia en Ciclo 2 identifico que un implementador podria borrarlo creyendo que contradice el test nuevo. Los dos escenarios son complementarios (fetch en vuelo vs fetch resuelto) y ambos son invariantes que no debemos regresar.

---

## Hardening de seguridad

### Firestore rules requeridas

Ninguna. No se tocan rules.

### Rate limiting

No aplica. No se introducen colecciones escribibles por usuarios.

### Vectores de ataque mitigados

| Ataque | Mitigacion | Archivo |
|--------|-----------|---------|
| Ninguno nuevo | N/A | N/A |

En el peor caso teorico, un atacante que pueda disparar `visibilitychange` y `online` simultaneamente dispara hasta 2 calls a `fetchAppVersionConfig` en vez de 1 por ventana de 5s. Esto es:

- Acotado por `setInterval` (30min) y `checkingRef` (si el primer fetch sigue en vuelo, el segundo se descarta).
- Impacto billing marginal: decenas de reads extra/dia en peor caso vs free tier de 50K/dia.

---

## Deuda tecnica: mitigacion incorporada

Issues consultados:

```bash
gh issue list --label security --state open
gh issue list --label "tech debt" --state open
```

| Issue | Que se resuelve | Paso del plan |
|-------|----------------|---------------|
| #321 | Split de `lastCheckTs` en `lastVisibilityTs` + `lastOnlineTs` (este issue) | Fase 1, paso 1 |

No se detecta deuda adicional en `src/hooks/useForceUpdate.ts` que toque este cambio (el archivo es chico, bien testeado, y fue auditado en #316/#315). No se agrava deuda existente.

---

## Validacion Tecnica

**Arquitecto**: Diego
**Fecha**: 2026-04-23
**Ciclo**: 1
**Estado**: VALIDADO CON OBSERVACIONES

### Hallazgos

Sin BLOQUEANTES. Sin IMPORTANTES. Una OBSERVACION menor.

### Observaciones abiertas para el implementador

- **OBS Diego #1 (cobertura de tests solapada)**: La extensión propuesta al test `visibilitychange hidden no consume el debounce` (dispatch `online` intercalado) cubre la misma invariante que el test nuevo `visible y online dentro de 5s AMBOS llaman fetchAppVersionConfig (cross-event independence)`. Resolver:
  - (a) Mantener la extensión del test `hidden no consume` enfocada solo en hidden→visible (sin mezclar `online`) y dejar la cobertura cross-event al test nuevo.
  - (b) Eliminar el test nuevo y dejar la extensión del test existente como cobertura única.

  No bloquea: ambas opciones satisfacen Success Criteria #4.

### Observaciones para el plan

- `docs/reference/patterns.md` L79 debe actualizarse en el mismo commit que el cambio de código.

### Claims verificados contra codebase

- `useForceUpdate.ts:130` tiene `const lastCheckTs = useRef<number>(0);` (bug).
- Handlers en `useForceUpdate.ts:167` y `:173` comparten `lastCheckTs`.
- Test de concurrency en `useForceUpdate.test.ts:590-614` presente y preservado en specs.
- Grupo `debounce guard` en `useForceUpdate.test.ts:666-780` con 4 tests.
- `patterns.md` L79 menciona `lastCheckTs` por nombre.
- `FORCE_UPDATE_EVENT_DEBOUNCE_MS = 5000` en `timing.ts`.

### Listo para pasar a plan?

Sí.
