# Plan: Debounce y guard de concurrencia en useForceUpdate

**Specs:** [specs.md](specs.md)
**Fecha:** 2026-04-23

---

## Contexto de implementacion

La implementacion es quirurgica: 2 refs nuevas + 1 constante + modificaciones a `run()` y a los dos handlers existentes. No hay componentes nuevos, no hay servicios nuevos, no hay cambios de schema.

Archivo central: `src/hooks/useForceUpdate.ts` (233 lineas actuales → ~250 lineas resultantes).

---

## Fases de implementacion

### Fase 1: Constante y guards en el hook

**Branch:** `feat/316-useforceupdate-debounce-concurrency`

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `src/constants/timing.ts` | Agregar `FORCE_UPDATE_EVENT_DEBOUNCE_MS = 5_000` con JSDoc explicando que aplica solo a event handlers, no al intervalo |
| 2 | `src/hooks/useForceUpdate.ts` | Agregar `import { FORCE_UPDATE_EVENT_DEBOUNCE_MS }` al bloque de imports de `../constants/timing` existente |
| 3 | `src/hooks/useForceUpdate.ts` | Agregar `const checkingRef = useRef<boolean>(false)` y `const lastCheckTs = useRef<number>(0)` dentro de `useForceUpdate()`, antes del `useEffect` |
| 4 | `src/hooks/useForceUpdate.ts` | Envolver el body de `run()` con el guard de concurrencia: `if (checkingRef.current) return` al inicio; `checkingRef.current = true` antes del `await checkVersion()`; `finally { checkingRef.current = false }` |
| 5 | `src/hooks/useForceUpdate.ts` | Modificar `handleVisibilityChange`: agregar debounce despues del check de `visibilityState`. Comparar `Date.now() - lastCheckTs.current < FORCE_UPDATE_EVENT_DEBOUNCE_MS`; si true, return. Actualizar `lastCheckTs.current = Date.now()` antes de `void run()` |
| 6 | `src/hooks/useForceUpdate.ts` | Modificar `handleOnline`: misma logica de debounce que `handleVisibilityChange` pero sin el check de `visibilityState` |

**Detalle del paso 4 — refactor de `run()` con guard de concurrencia:**

```typescript
async function run() {
  // Guard: una sola instancia en vuelo a la vez (tanto por interval como por eventos)
  if (checkingRef.current) return;
  checkingRef.current = true;
  try {
    const { status, minVersion, source } = await checkVersion();
    if (status === 'limit-reached') setUpdateAvailable(true);

    if (
      status !== 'error' &&
      (source === 'server' || source === 'server-retry' || source === 'empty') &&
      !sessionStorage.getItem(STORAGE_KEY_APP_VERSION_EVENT_EMITTED)
    ) {
      trackEvent(EVT_APP_VERSION_ACTIVE, {
        version: __APP_VERSION__,
        minVersionSeen: minVersion ?? '',
        gap: minVersion ? isUpdateRequired(minVersion, __APP_VERSION__) : false,
        source,
      });
      try {
        sessionStorage.setItem(STORAGE_KEY_APP_VERSION_EVENT_EMITTED, '1');
      } catch {
        // sessionStorage may be unavailable
      }
    }
  } finally {
    checkingRef.current = false;
  }
}
```

**Detalle del paso 5+6 — handlers con debounce:**

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

El `void run()` del mount y el `setInterval` no se modifican — no tienen debounce.

---

### Fase 2: Tests

| Paso | Archivo | Cambio |
|------|---------|--------|
| 7 | `src/hooks/useForceUpdate.test.ts` | Agregar describe block `concurrency guard` con 3 tests: (a) segunda invocacion simultanea no llama fetchAppVersionConfig, (b) finally libera flag en path error, (c) finally libera flag en path limit-reached |
| 8 | `src/hooks/useForceUpdate.test.ts` | Agregar describe block `debounce guard` con 4 tests: (a) segundo evento dentro de 5s ignorado, (b) evento despues de 5s procede, (c) visibilitychange hidden no consume el debounce, (d) mount y setInterval no son afectados por debounce |
| 9 | `src/hooks/useForceUpdate.test.ts` | Agregar test `cleanup: removeEventListener llamado en unmount` usando `vi.spyOn(document, 'removeEventListener')` y `vi.spyOn(window, 'removeEventListener')` |
| 10 | `src/hooks/useForceUpdate.test.ts` | Agregar test `combined: rapid firing de eventos resulta en una sola llamada a fetchAppVersionConfig` combinando debounce + concurrencia |

**Estrategia para tests de concurrencia (paso 7a):**

Usar una Promise deferred para simular `fetchAppVersionConfig` bloqueado en vuelo:

```typescript
it('segunda invocacion simultanea no llama fetchAppVersionConfig', async () => {
  vi.stubEnv('DEV', false);
  let resolve!: () => void;
  const deferred = new Promise<void>((res) => { resolve = res; });
  mockFetchAppVersionConfig.mockReturnValue(
    deferred.then(() => ({ minVersion: undefined, source: 'server' }))
  );

  const { useForceUpdate } = await import('./useForceUpdate');
  await act(async () => {
    renderHook(() => useForceUpdate());
    await Promise.resolve(); // run() starts, checkingRef = true
  });

  // Trigger second run via online event — should be blocked by checkingRef
  await act(async () => {
    window.dispatchEvent(new Event('online'));
    await Promise.resolve();
  });

  // fetchAppVersionConfig called only once (from mount), not again from event
  expect(mockFetchAppVersionConfig).toHaveBeenCalledTimes(1);

  resolve(); // unblock
  vi.unstubAllEnvs();
});
```

**Estrategia para tests de debounce (paso 8):**

```typescript
describe('debounce guard', () => {
  it('segundo evento dentro de 5s no llama fetchAppVersionConfig', async () => {
    vi.useFakeTimers();
    vi.stubEnv('DEV', false);
    mockConfig('2.30.3', 'server');

    const { useForceUpdate } = await import('./useForceUpdate');
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });

    await act(async () => {
      renderHook(() => useForceUpdate());
      await Promise.resolve();
    });

    const callsAfterMount = mockFetchAppVersionConfig.mock.calls.length;

    // Primer evento — procede y actualiza lastCheckTs
    await act(async () => {
      window.dispatchEvent(new Event('online'));
      await Promise.resolve();
    });

    const callsAfterFirstEvent = mockFetchAppVersionConfig.mock.calls.length;

    // Segundo evento dentro de 5s — debounce lo bloquea
    vi.setSystemTime(Date.now() + 2000); // 2s < 5s
    await act(async () => {
      window.dispatchEvent(new Event('online'));
      await Promise.resolve();
    });

    expect(mockFetchAppVersionConfig.mock.calls.length).toBe(callsAfterFirstEvent);

    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  it('evento despues de 5s SI llama fetchAppVersionConfig', async () => {
    vi.useFakeTimers();
    vi.stubEnv('DEV', false);
    mockConfig('2.30.3', 'server');

    const { useForceUpdate } = await import('./useForceUpdate');

    await act(async () => {
      renderHook(() => useForceUpdate());
      await Promise.resolve();
    });

    await act(async () => {
      window.dispatchEvent(new Event('online'));
      await Promise.resolve();
    });

    const callsAfterFirstEvent = mockFetchAppVersionConfig.mock.calls.length;

    // Avanzar 6s — fuera de la ventana de debounce
    vi.setSystemTime(Date.now() + 6000);
    await act(async () => {
      window.dispatchEvent(new Event('online'));
      await Promise.resolve();
    });

    expect(mockFetchAppVersionConfig.mock.calls.length).toBeGreaterThan(callsAfterFirstEvent);

    vi.useRealTimers();
    vi.unstubAllEnvs();
  });
});
```

---

### Fase 3: Documentacion

| Paso | Archivo | Cambio |
|------|---------|--------|
| 11 | `docs/reference/patterns.md` | En la fila "Stable event listeners via refs": agregar referencia a `useForceUpdate` junto a `AccountBanner` y `useActivityReminder`. Mencionar que el patron incluye debounce via `useRef<number>` para comparacion de timestamps. |
| 12 | `docs/_sidebar.md` | Agregar entradas de Specs y Plan bajo la entrada existente de `#316` en la seccion Infra |

---

## Orden de implementacion

1. `src/constants/timing.ts` — la constante debe existir antes del hook
2. `src/hooks/useForceUpdate.ts` — import de la constante + refs + guards
3. `src/hooks/useForceUpdate.test.ts` — tests de los guards nuevos
4. `docs/reference/patterns.md` + `docs/_sidebar.md` — docs al final

---

## Estimacion de tamano de archivos resultantes

| Archivo | Lineas actuales | Lineas estimadas | Dentro del limite? |
|---------|----------------|-----------------|-------------------|
| `src/constants/timing.ts` | 47 | ~53 | Si (limite 400) |
| `src/hooks/useForceUpdate.ts` | 233 | ~250 | Si (limite 400) |
| `src/hooks/useForceUpdate.test.ts` | 587 | ~700 | Si (limite 400 en produccion; tests pueden superar) |

El archivo de test excede 400 lineas (ya lo hacia antes de este issue con 587). Esto es aceptable para archivos de test — la directiva de 400 lineas aplica a codigo de produccion. El archivo de test de `useForceUpdate` es coherente en un unico archivo dado que toda la logica es del mismo hook.

---

## Riesgos

1. **El `finally` corre post-unmount**: `checkingRef.current = false` en `finally` es seguro porque es una mutation de ref, no un `setState`. React no genera warnings. Sin riesgo real.

2. **`vi.useFakeTimers()` interferencia con otros tests**: Los tests de debounce deben llamar `vi.useRealTimers()` en cleanup (ya mostrado en los snippets del plan). Si se olvida, puede afectar tests subsecuentes en el mismo archivo. Mitigacion: usar `afterEach(() => vi.useRealTimers())` en el describe block de debounce.

3. **Tests de concurrencia con deferred Promises**: El patron deferred requiere que `resolve()` se llame en cleanup para no dejar Promises pendientes. Agregar `afterEach(() => resolve?.())` si es necesario, o usar `vi.runAllTimers()` si se combina con fake timers.

---

## Guardrails de modularidad

- [x] Ningun componente nuevo importa `firebase/firestore` directamente
- [x] No hay archivos nuevos — todos los cambios son en archivos existentes
- [x] Logica de guards en el hook, no en componentes
- [x] Si se toca un archivo con deuda tecnica (#313 isCooldownActive en `useForceUpdate.ts`): se deja para PR propio — el scope de este PR es los guards solamente. No se agrava la deuda.
- [x] Ningun archivo resultante supera 400 lineas (codigo de produccion)

## Guardrails de seguridad

- [x] No hay colecciones nuevas — no aplica `hasOnly()`
- [x] No hay strings de usuario — no aplica validacion de size
- [x] `checkingRef` guard mitiga DoS via eventos browser (documentado en specs)
- [x] No hay secrets ni credenciales

## Guardrails de observabilidad

- [x] No hay CFs nuevas — no aplica `trackFunctionTiming`
- [x] No hay queries Firestore nuevas — no aplica `measureAsync` (el `fetchAppVersionConfig` existente es candidato para #315, separado)
- [x] No hay eventos analytics nuevos — no aplica registro en `GA4_EVENT_NAMES`
- [x] `logger.warn` opcional para los guards (no requerido por las specs, pero recomendado para debugging)

## Guardrails de accesibilidad y UI

- [x] Sin superficie de UI nueva — todos los guardrails N/A

## Guardrails de copy

- [x] Sin textos visibles al usuario — N/A

---

## Fase final: Documentacion (OBLIGATORIA)

| Paso | Archivo | Cambio |
|------|---------|--------|
| 11 | `docs/reference/patterns.md` | Actualizar fila "Stable event listeners via refs": agregar `useForceUpdate` como ejemplo adicional del patron; mencionar debounce via `useRef<number>` para timestamps |
| 12 | `docs/_sidebar.md` | Agregar Specs y Plan bajo la entrada existente `#316` en seccion Infra |

No aplica: `security.md` (sin cambios de rules), `firestore.md` (sin cambios de schema), `features.md` (sin cambio de feature visible al usuario), `project-reference.md` (cambio menor — actualizar en merge).

---

## Criterios de done

- [x] `FORCE_UPDATE_EVENT_DEBOUNCE_MS` definida en `timing.ts`
- [x] `checkingRef` guard implementado en `run()` con `finally` garantizado
- [x] `lastCheckTs` debounce implementado en `handleVisibilityChange` y `handleOnline`
- [x] Tests de concurrencia: guard bloquea segunda invocacion simultanea
- [x] Tests de debounce: segundo evento dentro de 5s ignorado; evento despues de 5s procede
- [x] Test de cleanup: `removeEventListener` verificado con `vi.spyOn`
- [x] Test de `finally`: flag liberado en path error y path limit-reached
- [x] Tests existentes siguen pasando sin modificaciones (comportamiento del intervalo intacto)
- [x] Cobertura >= 80% en codigo nuevo
- [x] No lint errors
- [x] Build succeeds
- [x] `docs/reference/patterns.md` actualizado
- [x] `docs/_sidebar.md` actualizado
