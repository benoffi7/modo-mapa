# PRD: Debounce y guard de concurrencia en useForceUpdate

**Feature:** 316-useforceupdate-debounce-concurrency
**Categoria:** infra
**Fecha:** 2026-04-23
**Issue:** #316
**Prioridad:** Media

---

## Contexto

`useForceUpdate` implementa un mecanismo de forzado de actualización que verifica la versión mínima requerida contra Firestore. La spec de #191 ("force-update-reliability") requiere que los listeners de `visibilitychange` y `online` disparen `checkVersion()` para reaccionar a cambios de tab y reconexiones de red. Sin debounce ni guard de concurrencia, múltiples eventos rápidos causan lecturas Firestore redundantes y potenciales race conditions entre llamadas en vuelo.

## Problema

- Si el usuario alterna entre tabs varias veces en rápida sucesión, cada evento `visibilitychange` dispara un `checkVersion()` independiente, acumulando hasta N lecturas Firestore simultáneas sin ningún resultado diferenciado.
- Si la red reconecta intermitentemente (evento `online` múltiple), pueden quedar varias promises de `checkVersion()` en vuelo a la vez, introduciendo race conditions en el estado `updateAvailable`.
- El hook actual usa únicamente `setInterval` — los listeners de eventos mencionados en la spec de #191 no están implementados todavía. Este PRD define los guards que DEBEN incorporarse al agregarlos.
- La ausencia de estos guards también afecta `setInterval` si el intervalo fuera muy corto o el sistema estuviera bajo carga, ya que una ejecución lenta podría solaparse con la siguiente.

## Solucion

### S1 — Constante `FORCE_UPDATE_EVENT_DEBOUNCE_MS` en `constants/timing.ts`

Agregar la constante `FORCE_UPDATE_EVENT_DEBOUNCE_MS = 5000` (5 segundos) que define la ventana mínima entre checks disparados por eventos de red/visibilidad. Nombre descriptivo para distinguirla del `FORCE_UPDATE_COOLDOWN_MS` existente (que controla la ventana de recargas).

### S2 — Ref `lastCheckTs` para debounce temporal

En `useForceUpdate`, agregar un `useRef<number>(0)` llamado `lastCheckTs`. Al inicio de cada invocación de `checkVersion()` disparada por un evento, comparar `Date.now() - lastCheckTs.current < FORCE_UPDATE_EVENT_DEBOUNCE_MS`. Si la condición es verdadera, retornar `'up-to-date'` sin hacer ninguna consulta. Actualizar `lastCheckTs.current = Date.now()` cuando se procede con la verificación.

Este debounce aplica SOLO a las invocaciones disparadas por eventos (`visibilitychange`, `online`). El `setInterval` existente no está sujeto a este guard — ya tiene su propio intervalo de 30 minutos.

### S3 — Ref `checkingRef` para guard de concurrencia (single in-flight)

Agregar un `useRef<boolean>(false)` llamado `checkingRef`. Al inicio de cada invocación de `checkVersion()` (tanto por intervalo como por evento), verificar `if (checkingRef.current) return 'up-to-date'`. Setear `checkingRef.current = true` antes de la llamada async y `checkingRef.current = false` en el bloque `finally`, garantizando que solo una instancia de `checkVersion()` esté en vuelo en cualquier momento.

El patron `finally` es crítico: si `checkVersion()` lanza (actualmente capturado internamente), el flag debe liberarse igualmente.

### S4 — Registro de listeners `visibilitychange` y `online`

Dentro del mismo `useEffect` existente, agregar los listeners de eventos que la spec de #191 requería. El handler para `visibilitychange` solo dispara si `document.visibilityState === 'visible'`. El handler para `online` dispara incondicionalmente. Ambos handlers aplican primero el debounce (S2) y luego el guard de concurrencia (S3) via la misma función `run()` que ya usa el intervalo.

Cleanup del `useEffect`: remover ambos listeners además de limpiar el `clearInterval` existente, para evitar memory leaks en unmount.

### Patron de implementacion

```
useEffect(() => {
  if (import.meta.env.DEV) return;

  async function run() {
    // Guard 1: concurrencia
    if (checkingRef.current) return;
    checkingRef.current = true;
    try {
      const result = await checkVersion();
      if (result === 'limit-reached') setUpdateAvailable(true);
    } finally {
      checkingRef.current = false;
    }
  }

  function handleVisibility() {
    if (document.visibilityState !== 'visible') return;
    // Guard 2: debounce por eventos
    if (Date.now() - lastCheckTs.current < FORCE_UPDATE_EVENT_DEBOUNCE_MS) return;
    lastCheckTs.current = Date.now();
    void run();
  }

  function handleOnline() {
    if (Date.now() - lastCheckTs.current < FORCE_UPDATE_EVENT_DEBOUNCE_MS) return;
    lastCheckTs.current = Date.now();
    void run();
  }

  run(); // check inmediato al montar
  const id = setInterval(run, FORCE_UPDATE_CHECK_INTERVAL_MS);
  document.addEventListener('visibilitychange', handleVisibility);
  window.addEventListener('online', handleOnline);

  return () => {
    clearInterval(id);
    document.removeEventListener('visibilitychange', handleVisibility);
    window.removeEventListener('online', handleOnline);
  };
}, []);
```

Nota: `lastCheckTs` no se aplica al check inmediato del mount ni a las ejecuciones del intervalo — solo a los handlers de eventos. Esto preserva el comportamiento actual del intervalo intacto.

---

## Scope

| Item | Prioridad | Esfuerzo |
|------|-----------|----------|
| Constante `FORCE_UPDATE_EVENT_DEBOUNCE_MS` en `timing.ts` | Alta | XS |
| Ref `checkingRef` + guard de concurrencia en `useForceUpdate` | Alta | XS |
| Ref `lastCheckTs` + debounce de eventos en `useForceUpdate` | Alta | XS |
| Registro de listeners `visibilitychange` y `online` con cleanup | Alta | S |
| Tests para los nuevos guards (debounce, concurrencia, listeners) | Alta | S |

**Esfuerzo total estimado:** S

---

## Out of Scope

- Refactor de `checkVersion()` a async externo (permanece como función interna del módulo).
- Debounce del `setInterval` — tiene su propio intervalo de 30 min, no necesita debounce adicional.
- UI de "actualizando" o feedback visual durante el check (ya existe el banner de `updateAvailable`).
- Modificaciones a `fetchAppVersionConfig` o `performHardRefresh`.

---

## Tests

Basado en la política de tests.md (Vitest + jsdom, cobertura >= 80%, mismos patrones de mock que el archivo existente `useForceUpdate.test.ts`).

### Archivos que necesitaran tests

| Archivo | Tipo | Que testear |
|---------|------|-------------|
| `src/hooks/useForceUpdate.test.ts` (existente, ampliar) | Unit | Guard de concurrencia: segunda invocación simultánea retorna sin llamar al service. Debounce: segunda invocación dentro de `FORCE_UPDATE_EVENT_DEBOUNCE_MS` retorna sin llamar al service. Listener `visibilitychange`: dispara run() cuando state es `visible`, no cuando es `hidden`. Listener `online`: dispara run(). Cleanup: listeners removidos en unmount. Combinacion debounce + concurrencia bajo rapid firing. |
| `src/constants/timing.ts` (sin tests propios — constante simple) | — | No aplica |

### Criterios de testing

- Cobertura >= 80% del codigo nuevo
- Tests de los dos guards de forma independiente (debounce y concurrencia no son equivalentes)
- Verificar que el `finally` libera `checkingRef` incluso cuando `checkVersion()` retorna `'error'`
- Verificar que `document.removeEventListener` y `window.removeEventListener` son llamados en cleanup (usando `vi.spyOn`)
- Usar `vi.useFakeTimers()` para controlar `Date.now()` en tests de debounce
- Mock de `document.visibilityState` para tests del handler `visibilitychange`

---

## Seguridad

Este feature no expone superficie nueva a Firestore ni tiene vectores de ataque directos. El guard de concurrencia es en sí mismo una medida de protección: previene que un atacante que pueda disparar eventos del browser (XSS) genere N lecturas Firestore simultáneas desde `useForceUpdate`.

- [ ] No se agregan campos nuevos a Firestore
- [ ] No se agregan colecciones nuevas
- [ ] No hay inputs del usuario involucrados

### Vectores de ataque automatizado

| Superficie | Ataque posible | Mitigacion requerida |
|-----------|---------------|---------------------|
| Eventos `visibilitychange`/`online` del browser | Script que dispare eventos repetidos para generar lecturas Firestore en `fetchAppVersionConfig` | `checkingRef` guard (S3) bloquea llamadas concurrentes; debounce `lastCheckTs` (S2) bloquea ráfagas |

---

## Deuda tecnica y seguridad

Issues relacionados identificados:

```bash
# Issues de tech-debt abiertos:
#313 — remove isCooldownActive duplication between registerPwa and useForceUpdate
#314 — import RETRY_DELAYS_MS from timing.ts in config.ts
#315 — add measureAsync instrumentation to fetchAppVersionConfig
#317 — barrel.test.ts hardcodes export count
#318 — business-detail-screen post-implementation review
```

### Issues relacionados

| Issue | Relacion | Accion |
|-------|----------|--------|
| #313 `isCooldownActive` duplication | Afecta el mismo archivo `useForceUpdate.ts` | Considerar resolver en el mismo PR si el scope es manejable, o dejar para PR propio (es refactor separable) |
| #315 `measureAsync` en `fetchAppVersionConfig` | El service que `useForceUpdate` llama en cada check; los guards de este PRD reducen la frecuencia de llamadas, complementa el instrumentation | No hay accion en este PRD; no empeora |
| #312 fanOut N+1 dedup reads | No relacionado con `useForceUpdate` | Sin impacto |

### Mitigacion incorporada

- El guard `checkingRef` (S3) reduce de forma efectiva las lecturas redundantes a `config/appVersion` en Firestore ante eventos en ráfaga, lo que complementa cualquier futura instrumentación de `fetchAppVersionConfig` (#315).

---

## Robustez del codigo

### Checklist de hooks async

- [ ] El `useEffect` con múltiples awaits tiene patron de cleanup correcto (clearInterval + removeEventListener en return)
- [ ] El `finally` en `run()` garantiza liberacion de `checkingRef` en todos los paths (success, error, reloading)
- [ ] No hay `setState` después de unmount: `checkingRef.current = false` en finally es safe post-unmount (no es setState)
- [ ] `lastCheckTs` es un `useRef` — no causa re-renders
- [ ] `checkingRef` es un `useRef` — no causa re-renders
- [ ] Ningun archivo supera 300 lineas — `useForceUpdate.ts` tiene 165 lineas, la adicion es ~20 lineas

### Checklist de observabilidad

- [ ] No se agregan eventos analytics nuevos — los eventos existentes (`EVT_FORCE_UPDATE_TRIGGERED`, `EVT_FORCE_UPDATE_LIMIT_REACHED`) siguen siendo suficientes
- [ ] Se puede agregar `logger.warn('checkVersion skipped: in-flight')` y `logger.warn('checkVersion skipped: debounce')` opcionales para debugging

### Checklist offline

- [ ] El listener `online` dispara `checkVersion()` que internamente llama a `fetchAppVersionConfig()` — si falla (aun sin conexion real), retorna `'error'` y `checkVersion` lo captura silenciosamente en el catch existente
- [ ] No hay cambio en el comportamiento offline; los guards no introducen estado persistente

### Checklist de documentacion

- [ ] `docs/reference/patterns.md`: agregar entrada para "Stable event listeners via refs" (ya existe para `AccountBanner` — este patron es equivalente, referenciarlo)
- [ ] No hay colecciones ni tipos nuevos — no se actualiza `firestore.md`
- [ ] No es una feature de usuario — no se actualiza `features.md`

---

## Offline

Este feature es parte de la infraestructura de actualización forzada, no del flujo de datos del usuario.

### Data flows

| Operacion | Tipo (read/write) | Estrategia offline | Fallback UI |
|-----------|-------------------|-------------------|-------------|
| `fetchAppVersionConfig()` en `checkVersion()` | Read (Firestore `config/appVersion`) | Falla silenciosamente con `return 'error'` dentro del catch | Ninguno — el hook no cambia `updateAvailable` si hay error |

### Checklist offline

- [ ] La lectura ya tiene manejo de error de red (catch silencioso existente)
- [ ] El listener `online` se dispara precisamente cuando se recupera la red — momento ideal para chequear versión
- [ ] No hay writes ni queue offline relevante

### Esfuerzo offline adicional: XS (el comportamiento offline ya está cubierto)

---

## Modularizacion y % monolitico

Este cambio es puramente interno al hook `useForceUpdate`. No agrega nuevas dependencias de componentes, no toca la capa de UI, y no crea acoplamiento nuevo.

### Checklist modularizacion

- [ ] Logica de guards en el hook (no en componentes de layout)
- [ ] No se agregan useState de logica de negocio a AppShell o SideMenu
- [ ] `checkingRef` y `lastCheckTs` son refs internas — no se exponen como parte de la API del hook
- [ ] El hook sigue retornando solo `{ updateAvailable: boolean }` — API publica sin cambios
- [ ] No se superan 300 lineas en el archivo resultante

### Impacto en % monolitico

| Aspecto | Impacto | Justificacion |
|---------|---------|---------------|
| Acoplamiento de componentes | = | Ningún componente nuevo; la API del hook no cambia |
| Estado global | = | Refs internas, no contexto global |
| Firebase coupling | = | `fetchAppVersionConfig` ya estaba en el hook |
| Organizacion por dominio | = | El archivo permanece en `src/hooks/` correctamente |

---

## Accesibilidad y UI mobile

No aplica — este feature no tiene superficie de UI.

---

## Success Criteria

1. Llamadas concurrentes a `checkVersion()` (por intervalo, `visibilitychange` u `online` solapados) ejecutan una sola llamada a `fetchAppVersionConfig()` a la vez — verificado por tests unitarios con mocks de timing.
2. Múltiples eventos `visibilitychange`/`online` dentro de la ventana de 5 segundos resultan en una única llamada a `fetchAppVersionConfig()` — verificado por tests con `vi.useFakeTimers()`.
3. El listener `visibilitychange` no dispara `checkVersion()` cuando `document.visibilityState === 'hidden'` — verificado por test unitario.
4. Los listeners son removidos correctamente en unmount del hook — verificado por `vi.spyOn(document, 'removeEventListener')` en tests.
5. El comportamiento existente (intervalo de 30 min, cooldown, reload limit, analytics) permanece sin cambios — todos los tests existentes siguen pasando sin modificaciones.
