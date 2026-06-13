# PRD: Tech debt — separate lastCheckTs refs per event type in useForceUpdate

**Feature:** 321-useforceupdate-separate-last-check-refs
**Categoria:** infra
**Fecha:** 2026-04-23
**Issue:** #321
**Prioridad:** Baja

---

## Contexto

En `src/hooks/useForceUpdate.ts` los handlers `handleVisibilityChange` y `handleOnline` comparten un unico `lastCheckTs` (`useRef<number>`) como ventana de debounce de 5s (`FORCE_UPDATE_EVENT_DEBOUNCE_MS`). Esto fue implementado en #316 para evitar spam de `fetchAppVersionConfig` cuando un usuario rapidamente vuelve al tab y el dispositivo reconecta a la red. El problema detectado durante la auditoria de seguridad de #316 es que ambos eventos son triggers independientes, y compartir el debounce puede perder checks validos.

## Problema

- Un tab-switch (`visible`) y un `online` event ocurridos con menos de 5s de diferencia hacen que el segundo se descarte silenciosamente, aun cuando son disparadores logicamente distintos.
- En escenarios reales (tab al frente → reconexion WiFi 2s despues) se puede perder la ventana donde recien hay conectividad para descubrir una version nueva. El `setInterval` de 30min cubre eventualmente el gap, pero retrasa la deteccion hasta media hora.
- El comportamiento no esta documentado como intencional: el lector razona "un debounce por tipo de evento" y el codigo rompe esa expectativa sin comentario que lo justifique.

## Solucion

### S1 — Split de refs por tipo de evento

Reemplazar `lastCheckTs` por dos refs independientes:

```ts
const lastVisibilityTs = useRef<number>(0);
const lastOnlineTs = useRef<number>(0);
```

`handleVisibilityChange` consulta/actualiza solo `lastVisibilityTs`. `handleOnline` consulta/actualiza solo `lastOnlineTs`. Ambos mantienen la ventana de 5s via `FORCE_UPDATE_EVENT_DEBOUNCE_MS` (sin cambios al valor).

La garantia de no re-entrar sigue siendo la del `checkingRef` (concurrency guard). IMPORTANTE: `checkingRef` NO serializa llamadas simultaneas — las DESCARTA. En `useForceUpdate.ts:136` el guard es `if (checkingRef.current) return;`, que sale inmediato sin encolar. En la practica significa:

- Si el primer `run()` ya resolvio antes de que dispare el segundo evento, ambos `fetchAppVersionConfig` corren (secuencialmente, por tiempos de JS).
- Si el primer `run()` sigue en vuelo cuando llega el segundo, el segundo se descarta y NO se reintenta.

El debounce es solo anti-chatter para el MISMO tipo de evento; la dedup cross-event ya no existe y eso es lo que buscamos.

El patron esta alineado con "Stable event listeners via refs" de `patterns.md` (refs para valores accedidos desde listeners sin recrear callbacks), solo que ahora hay una ref por listener en vez de compartida.

### S2 — Sin cambios de comportamiento visible

- `setInterval` de 30min sigue sin debounce.
- `run()` del mount sigue sin debounce.
- `checkingRef` sigue siendo el guard contra concurrencia.
- `FORCE_UPDATE_EVENT_DEBOUNCE_MS = 5000` no cambia.
- API publica del hook (`useForceUpdate`) no cambia.

### S3 — Documentacion

- Actualizar la entrada de `useForceUpdate` en `docs/reference/patterns.md` (seccion "Stable event listeners via refs"). `patterns.md` L79 actualmente menciona `lastCheckTs` por nombre; la entrada debe actualizarse a "una ref por tipo de evento (`lastVisibilityTs`, `lastOnlineTs`)" para reflejar la nueva estructura.
- No es necesario tocar `features.md` ni `firestore.md` — no hay cambios de dominio.

---

## Scope

| Item | Prioridad | Esfuerzo |
|------|-----------|----------|
| Reemplazar `lastCheckTs` por `lastVisibilityTs` + `lastOnlineTs` en `useForceUpdate.ts` | Alta | XS |
| Ajustar tests existentes del grupo "debounce guard" para cubrir el nuevo comportamiento (visible no consume el debounce de online y viceversa) | Alta | XS |
| Actualizar `docs/reference/patterns.md` (seccion refs estables) con la aclaracion | Media | XS |

**Esfuerzo total estimado:** XS

**Impact billing:** hasta +1 read Firestore en el escenario fix-eado (visible + online dentro de 5s, ambos eventos con el fetch previo ya resuelto). Marginal — decenas de reads extra/dia en peor caso, irrelevante vs free tier de 50K/dia.

---

## Out of Scope

- Cambiar el valor de `FORCE_UPDATE_EVENT_DEBOUNCE_MS` (sigue 5000ms).
- Anadir debounce al `setInterval` o al `run()` del mount.
- Cambios en `fetchAppVersionConfig`, `checkVersion` o el manejo de `EVT_APP_VERSION_ACTIVE`.
- Refactor de `useForceUpdate` mas alla del split de refs (no se divide en sub-hooks, no se extrae util nuevo).
- Retry del evento descartado por `checkingRef` (caso: segundo evento llega con el primer `run()` todavia en vuelo → se pierde y el proximo check lo cubre el `setInterval` de 30min o el siguiente evento >5s despues). Queda fuera de este issue. Si se detecta que afecta la experiencia, abrir issue separado.

---

## Tests

Se apunta a mantener la cobertura del hook al mismo nivel actual (100% de lineas en paths debounce/concurrency segun tests existentes). No se abren branches nuevos — se reemplaza una variable por dos.

### Archivos que necesitaran tests

| Archivo | Tipo | Que testear |
|---------|------|-------------|
| `src/hooks/useForceUpdate.test.ts` | Hook (existente) | Ajustar los 4 tests del grupo "debounce guard": mantener "segundo online dentro de 5s bloqueado" y "online despues de 5s pasa"; actualizar "visibilitychange hidden no consume el debounce" para verificar tambien que un `online` intercalado NO consume el debounce de `visibilitychange`; agregar caso nuevo "visible y online dentro de 5s AMBOS llaman fetchAppVersionConfig" (regresion del bug reportado en #321). |

### Preservar test existente

El test `segunda invocacion simultanea no llama fetchAppVersionConfig dos veces` (`useForceUpdate.test.ts:590-614`) debe mantenerse sin cambios. Cubre el caso "fetch pendiente + segundo evento = bloqueado por `checkingRef`" (1 llamada total), que es un escenario distinto al del bug reportado en #321. Un implementador descuidado podria borrarlo creyendo que contradice el test nuevo — NO hacerlo. Los dos escenarios son complementarios:

- Test viejo: primer `run()` EN VUELO + segundo evento → `checkingRef` descarta el segundo (1 call).
- Test nuevo: primer `run()` YA RESUELTO + segundo evento dentro de 5s (pero tipo distinto) → ambos corren (2 calls).

### Test nuevo: estructura requerida

`visible + online dentro de 5s con fetch resuelto antes del segundo evento → ambos disparan fetch`. Estructura:

1. Disparar primer evento (`visibilitychange` → `visible`).
2. Drenar el primer fetch: `await Promise.resolve()` + `vi.advanceTimersByTimeAsync(...)` segun corresponda, hasta que `checkingRef` vuelva a `false` (fin del `run()`).
3. Disparar segundo evento (`online`) inmediato pero DENTRO de 5s de la ventana desde el primero.
4. Assert: `fetchAppVersionConfig` fue llamada 2 veces.

Key: el test debe drenar el primer fetch antes de disparar el segundo evento, si no queda ambiguedad sobre si `checkingRef` intervino o el debounce cross-event lo bloqueo. Los helpers de drenado ya existen en el archivo de tests (seguir patron de los tests actuales).

### Criterios de testing

- Cobertura >= 80% del codigo modificado (se mantiene la cobertura actual del hook).
- Todos los paths condicionales de los dos handlers cubiertos con tests independientes por tipo de evento.
- Side effects verificados: `fetchAppVersionConfig` se llama la cantidad esperada segun cada combinacion evento-tiempo.
- El test de concurrencia existente sigue pasando (no se regressiona el `checkingRef`).

---

## Seguridad

Ningun vector nuevo. El cambio es puramente interno a un hook client-side, no modifica reglas Firestore, callables, Storage, ni agrega nuevos surfaces de escritura.

- [ ] No se tocan Firestore rules.
- [ ] No se agregan endpoints ni callables.
- [ ] No se escriben campos nuevos a ninguna coleccion.
- [ ] No se expone data de usuarios.

### Vectores de ataque automatizado

| Superficie | Ataque posible | Mitigacion requerida |
|-----------|---------------|---------------------|
| Ninguna nueva | N/A | N/A |

El hook ya es defensivo contra spam (`checkingRef` descarta concurrent runs, `setInterval` cap de 30min, MAX_FORCE_UPDATE_RELOADS limita reloads). Split de refs no aumenta la superficie: en el peor caso, un atacante que pueda disparar `visibilitychange` y `online` simultaneamente dispararia hasta 2 calls en vez de 1 — si el primer `run()` aun esta en vuelo cuando llega el segundo evento, el segundo se DESCARTA por `checkingRef` (no se encola). Si ya resolvio, corren ambos secuencialmente. Tope duro: el `setInterval` sigue a 30min, asi que el burst maximo es acotado.

---

## Deuda tecnica y seguridad

### Issues relacionados

| Issue | Relacion | Accion |
|-------|----------|--------|
| #316 (cerrado, v2.40.4) | Introdujo `lastCheckTs` compartido. Este PRD es el follow-up explicito registrado en el issue. | Refinar sin revertir — mantener la ventana de 5s, solo separarla por tipo de evento. |
| #315 (cerrado, v2.40.5) | Agrego `measureAsync` a `fetchAppVersionConfig`. Cualquier llamada evitada por debounce mal compartido tambien se perdia de la instrumentacion. Al fixear este bug, la telemetria de frecuencia de check por tipo de evento sera mas fiel. | Sin cambios requeridos en la instrumentacion — solo habra mas samples legitimos. |
| #191 (cerrado, v2.30.0) | Feature original de force-update. Define el contrato del hook. | Mantener API publica (`useForceUpdate(): { updateAvailable: boolean }`) sin cambios. |

### Mitigacion incorporada

- Se elimina la regresion silenciosa del debounce compartido (missed check en escenario tab-switch + reconnect en <5s).
- Se deja el codigo mas legible: una ref por tipo de evento se mapea 1:1 con el listener correspondiente.

---

## Robustez del codigo

### Checklist de hooks async

- [x] El `useEffect` del hook ya maneja cleanup (`clearInterval` + `removeEventListener`). Sin cambios.
- [x] `run()` ya tiene `try/finally` que libera `checkingRef`. Sin cambios.
- [x] No hay `setState` async sin guard (el `setUpdateAvailable` ocurre dentro del `run()` que respeta el ciclo del `finally`).
- [x] Las constantes de debounce ya viven en `src/constants/timing.ts` (`FORCE_UPDATE_EVENT_DEBOUNCE_MS`). No se agregan constantes nuevas.
- [x] Archivo de hook contiene React hooks (`useEffect`, `useRef`, `useState`). Cumple la regla de `src/hooks/`.
- [x] `logger.error` no se wrappea en `import.meta.env.DEV` (el hook usa `logger.log` y `logger.warn`, correcto).
- [x] Archivo esta muy por debajo de 300 lineas.

### Checklist de observabilidad

- [x] `trackEvent(EVT_APP_VERSION_ACTIVE)` y `trackEvent(EVT_FORCE_UPDATE_*)` ya registrados. Sin eventos nuevos.
- [x] `measureAsync` en `fetchAppVersionConfig` ya cubierto por #315. Sin cambios.

### Checklist offline

- [x] El hook es tolerante a offline via el `catch` de `checkVersion` (status `error`). Sin cambios.

### Checklist de documentacion

- [ ] Actualizar entrada de "Stable event listeners via refs" en `docs/reference/patterns.md` para aclarar que el debounce es por tipo de evento (uno por `visibilitychange`, otro por `online`).
- [x] `docs/reference/features.md` no requiere update (comportamiento user-facing no cambia).
- [x] `docs/reference/firestore.md` no requiere update.

---

## Offline

El hook se comporta igual que hoy en offline.

### Data flows

| Operacion | Tipo (read/write) | Estrategia offline | Fallback UI |
|-----------|-------------------|-------------------|-------------|
| `fetchAppVersionConfig` | read | `getDocFromServer` con 2 reintentos, luego cache local | `status: 'error'`, hook no muestra nada (silencioso) |

### Checklist offline

- [x] Reads ya tienen fallback a cache via `fetchAppVersionConfig` (#315 conserva su comportamiento).
- [x] Writes: el hook no escribe a Firestore.
- [x] APIs externas: el `catch` externo cubre errores de red.
- [x] UI: el hook expone `updateAvailable: boolean`, sin cambios.
- [x] Datos criticos: la config de version se cachea en IndexedDB por Firestore.

### Esfuerzo offline adicional: S

---

## Modularizacion y % monolitico

Cambio contenido al hook. No toca contextos, layout, ni cross-cutting concerns.

### Checklist modularizacion

- [x] Logica de negocio en hook (no inline en AppShell/SideMenu).
- [x] El hook es reutilizable; API publica no cambia.
- [x] No se agregan `useState` a AppShell o SideMenu.
- [x] Props explicitas no aplican (hook sin props).
- [x] No hay callbacks nuevos (no aplica noop).
- [x] No se agregan imports de Firebase SDK directos en componentes (sigue via `services/config.ts`).
- [x] `src/hooks/useForceUpdate.ts` contiene React hooks.
- [x] Ningun archivo nuevo.
- [x] Converters no aplican.
- [x] Sin archivos en `components/menu/`.
- [x] No se crea contexto nuevo.
- [x] Archivo queda muy por debajo de 300 lineas.

### Impacto en % monolitico

| Aspecto | Impacto | Justificacion |
|---------|---------|---------------|
| Acoplamiento de componentes | = | No se tocan componentes. |
| Estado global | = | No se tocan contextos. |
| Firebase coupling | = | No se tocan llamadas a SDK (el hook usa `services/config.ts`). |
| Organizacion por dominio | = | Archivo ya esta en `src/hooks/` segun convencion. |

---

## Accesibilidad y UI mobile

No hay cambios visuales ni de interaccion. El hook no renderiza UI.

### Checklist de accesibilidad

- [x] No se agregan controles nuevos.
- [x] No hay touch targets afectados.
- [x] No hay estados de carga afectados.
- [x] No se agregan imagenes.
- [x] No se agregan formularios.

### Checklist de copy

- [x] No hay strings user-facing en este cambio.
- [x] `logger.log` y `logger.warn` son logs internos en ingles (patron vigente del hook).
- [x] No hay mensajes de error user-facing nuevos.

---

## Success Criteria

1. `handleVisibilityChange` y `handleOnline` mantienen ventanas de debounce independientes de 5s cada una; un evento de un tipo no consume el debounce del otro.
2. Un `visibilitychange → visible` seguido de un `online` dentro de 5s puede disparar una o dos llamadas a `fetchAppVersionConfig`, segun el estado del primer fetch:
   - Si el primer fetch resolvio antes del segundo evento → se disparan dos llamadas independientes.
   - Si el primer fetch aun esta en vuelo → el segundo `run()` se descarta por `checkingRef` y NO se reintenta (el proximo check lo cubre el `setInterval` de 30min o el siguiente evento >5s despues).

   Esto es comportamiento aceptado: el billing impact es marginal y el retry agresivo seria scope mayor.
3. Dos eventos del mismo tipo dentro de 5s siguen dedupeados a uno solo (comportamiento actual preservado).
4. La suite de tests `useForceUpdate.test.ts` sigue verde, con casos nuevos que cubren cross-event debounce independence, y el test `segunda invocacion simultanea no llama fetchAppVersionConfig dos veces` (`useForceUpdate.test.ts:590-614`) sigue presente y pasando.
5. `docs/reference/patterns.md` describe explicitamente que el debounce es por tipo de evento (refs `lastVisibilityTs` + `lastOnlineTs`).

---

## Validacion Funcional

**Analista**: Sofia
**Fecha**: 2026-04-23
**Estado**: VALIDADO (Ciclo 2)

### Hallazgos cerrados en esta iteracion

- IMPORTANTE: "`serializa` es incorrecto; `checkingRef` descarta" → resuelto en seccion "S1 — Split de refs por tipo de evento" (aclarada la semantica de `checkingRef` con referencia a `useForceUpdate.ts:136`), en "Vectores de ataque automatizado" (reemplazado "serializados" por descripcion real), y en "Success Criteria #2" (reescrito el criterio para cubrir los dos sub-casos: primer fetch resuelto vs en vuelo). Reforzado con nota en "Out of Scope" sobre el evento descartado.
- IMPORTANTE: "Colision con test existente de concurrency guard" → resuelto en seccion "Tests" con dos sub-secciones nuevas: "Preservar test existente" (instruccion explicita de no borrar `useForceUpdate.test.ts:590-614`, con explicacion de por que los dos escenarios son complementarios) y "Test nuevo: estructura requerida" (pasos del test nuevo con drenado del primer fetch para evitar ambiguedad). Reforzado en Success Criteria #4.

### Observaciones cerradas

- OBSERVACION: "billing impact no cuantificado" → agregada nota breve en Scope: "hasta +1 read Firestore en escenario fix-eado... marginal vs free tier de 50K/dia".
- OBSERVACION: "patterns.md L79 menciona `lastCheckTs` por nombre" → actualizada S3 con la instruccion de reemplazar por "una ref por tipo de evento (`lastVisibilityTs`, `lastOnlineTs`)".

### Observaciones abiertas para el implementador

- Ninguna. Listo para specs-plan-writer.
