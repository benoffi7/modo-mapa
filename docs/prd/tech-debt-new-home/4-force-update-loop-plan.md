# Plan: Harden useForceUpdate reload loop protection

**Specs:** [4-force-update-loop-specs.md](4-force-update-loop-specs.md)
**Fecha:** 2026-03-27

---

## Fases de implementacion

### Fase 1: Constantes y tipos

**Branch:** `fix/force-update-loop`

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `src/constants/storage.ts` | Renombrar `SESSION_KEY_FORCE_UPDATE_LAST_REFRESH` a `STORAGE_KEY_FORCE_UPDATE_LAST_REFRESH`. Agregar `STORAGE_KEY_FORCE_UPDATE_RELOAD_COUNT = 'force_update_reload_count'`. |
| 2 | `src/constants/timing.ts` | Agregar `MAX_FORCE_UPDATE_RELOADS = 3`. |
| 3 | `src/constants/analyticsEvents.ts` | Agregar `EVT_FORCE_UPDATE_LIMIT_REACHED = 'force_update_limit_reached'`. |

### Fase 2: Refactorizar useForceUpdate

| Paso | Archivo | Cambio |
|------|---------|--------|
| 4 | `src/hooks/useForceUpdate.ts` | Reemplazar import de `SESSION_KEY_FORCE_UPDATE_LAST_REFRESH` por `STORAGE_KEY_FORCE_UPDATE_LAST_REFRESH` y agregar imports de `STORAGE_KEY_FORCE_UPDATE_RELOAD_COUNT`, `MAX_FORCE_UPDATE_RELOADS`, `EVT_FORCE_UPDATE_LIMIT_REACHED`. |
| 5 | `src/hooks/useForceUpdate.ts` | En `isCooldownActive()`: cambiar `sessionStorage.getItem` por `localStorage.getItem` y `sessionStorage.setItem` por `localStorage.setItem` (en la zona de escritura del cooldown, linea 62). |
| 6 | `src/hooks/useForceUpdate.ts` | Agregar funciones auxiliares: `getReloadCount()` que lee y parsea el JSON de `localStorage.getItem(STORAGE_KEY_FORCE_UPDATE_RELOAD_COUNT)`, devolviendo `{ count: 0, firstAt: 0 }` si no existe o el JSON es invalido. `incrementReloadCount()` que lee el estado actual, resetea si la ventana expiro (`Date.now() - firstAt >= FORCE_UPDATE_COOLDOWN_MS`), incrementa `count` y escribe el JSON. `isReloadLimitReached()` que lee el contador y retorna `count >= MAX_FORCE_UPDATE_RELOADS` dentro de la ventana activa. |
| 7 | `src/hooks/useForceUpdate.ts` | Modificar `checkVersion()` para: (a) despues de verificar cooldown, verificar `isReloadLimitReached()` -- si true, retornar `'limit-reached'`; (b) antes de llamar `performHardRefresh()`, llamar `incrementReloadCount()`; (c) cambiar retorno a `Promise<'reloading' \| 'limit-reached' \| 'up-to-date' \| 'error'>`. |
| 8 | `src/hooks/useForceUpdate.ts` | Agregar `trackEvent(EVT_FORCE_UPDATE_LIMIT_REACHED, { from: __APP_VERSION__, to: minVersion, reloadCount: count })` cuando el limite se alcanza. |
| 9 | `src/hooks/useForceUpdate.ts` | Modificar el hook `useForceUpdate()`: agregar `const [updateAvailable, setUpdateAvailable] = useState(false)`. Wrappear `checkVersion()` en una funcion async que, si el resultado es `'limit-reached'`, llame `setUpdateAvailable(true)`. Retornar `{ updateAvailable }`. |
| 10 | `src/hooks/useForceUpdate.ts` | Exportar `_getReloadCount` y `_isReloadLimitReached` para testing (junto al existente `_checkVersion`). |

### Fase 3: Componente ForceUpdateBanner

| Paso | Archivo | Cambio |
|------|---------|--------|
| 11 | `src/components/layout/ForceUpdateBanner.tsx` | Crear componente. MUI `Alert` severity="warning" con `position: fixed, top: 0, left: 0, right: 0, zIndex: snackbar`. Texto: "Hay una nueva version disponible. Recarga la pagina para actualizar." Boton de accion: "Recargar" que llama `window.location.reload()`. |

### Fase 4: Integracion en App.tsx

| Paso | Archivo | Cambio |
|------|---------|--------|
| 12 | `src/App.tsx` | Cambiar `useForceUpdate()` a `const { updateAvailable } = useForceUpdate()`. Importar `ForceUpdateBanner`. Renderizar `{updateAvailable && <ForceUpdateBanner />}` como primer hijo dentro del arbol de providers (antes de Routes). |

### Fase 5: Tests

| Paso | Archivo | Cambio |
|------|---------|--------|
| 13 | `src/hooks/useForceUpdate.test.ts` | Actualizar test "respects cooldown from sessionStorage": cambiar `sessionStorage.setItem` por `localStorage.setItem`, actualizar nombre del test a "respects cooldown from localStorage". Cambiar `sessionStorage.clear()` en `beforeEach` a `localStorage.removeItem` de las dos keys relevantes (no hacer `localStorage.clear()` que borraria otros datos de otros tests). |
| 14 | `src/hooks/useForceUpdate.test.ts` | Agregar test: "increments reload counter in localStorage" -- llamar `_checkVersion` con minVersion > app, verificar que `localStorage.getItem(STORAGE_KEY_FORCE_UPDATE_RELOAD_COUNT)` contiene JSON con `count: 1`. |
| 15 | `src/hooks/useForceUpdate.test.ts` | Agregar test: "stops reloading after MAX_FORCE_UPDATE_RELOADS" -- pre-setear el contador a `{ count: 3, firstAt: Date.now() }` en localStorage, llamar `_checkVersion` con minVersion > app, verificar que `mockReload` no fue llamado y retorno es `'limit-reached'`. |
| 16 | `src/hooks/useForceUpdate.test.ts` | Agregar test: "resets counter when cooldown window expires" -- pre-setear contador a `{ count: 3, firstAt: Date.now() - 6 * 60 * 1000 }` (6 min atras), llamar `_checkVersion`, verificar que `mockReload` fue llamado (ventana expirada, contador reseteado). |
| 17 | `src/hooks/useForceUpdate.test.ts` | Agregar test: "handles corrupted localStorage gracefully" -- setear `localStorage.setItem(STORAGE_KEY_FORCE_UPDATE_RELOAD_COUNT, 'not-json')`, llamar `_checkVersion` con minVersion > app, verificar que procede con reload normalmente. |
| 18 | `src/hooks/useForceUpdate.test.ts` | Agregar test: "tracks EVT_FORCE_UPDATE_LIMIT_REACHED analytics" -- pre-setear contador al limite, llamar `_checkVersion`, verificar `mockTrackEvent` fue llamado con `EVT_FORCE_UPDATE_LIMIT_REACHED`. |
| 19 | `src/hooks/useForceUpdate.test.ts` | Agregar test: "hook returns updateAvailable true when limit reached" -- usar `renderHook` con modulo reimportado, pre-setear contador al limite, verificar que `result.current.updateAvailable` es `true` despues de que checkVersion resuelva. Nota: requiere controlar el mock de `import.meta.env.DEV` o testear via `_checkVersion` + state. |
| 20 | `src/hooks/useForceUpdate.test.ts` | Actualizar imports para las nuevas constantes (`STORAGE_KEY_FORCE_UPDATE_RELOAD_COUNT`, `MAX_FORCE_UPDATE_RELOADS`, `EVT_FORCE_UPDATE_LIMIT_REACHED`). Limpiar ambas keys de localStorage en `beforeEach`. |

### Fase 6: Lint, build y commit

| Paso | Archivo | Cambio |
|------|---------|--------|
| 21 | - | Ejecutar `npx eslint src/hooks/useForceUpdate.ts src/constants/storage.ts src/constants/timing.ts src/constants/analyticsEvents.ts src/components/layout/ForceUpdateBanner.tsx src/App.tsx --fix` |
| 22 | - | Ejecutar `npx tsc --noEmit` para verificar que no hay errores de tipo. |
| 23 | - | Ejecutar `npm run test:run -- --reporter=verbose src/hooks/useForceUpdate.test.ts` para verificar que todos los tests pasan. |
| 24 | - | Ejecutar `npm run test:coverage` para verificar que la cobertura global no bajo del 80%. |
| 25 | - | Commit: `fix: harden useForceUpdate to prevent reload loops (#206)` con mensaje descriptivo. Stage solo los archivos modificados: `src/hooks/useForceUpdate.ts`, `src/hooks/useForceUpdate.test.ts`, `src/constants/storage.ts`, `src/constants/timing.ts`, `src/constants/analyticsEvents.ts`, `src/components/layout/ForceUpdateBanner.tsx`, `src/App.tsx`. |

---

## Orden de implementacion

1. `src/constants/storage.ts` -- nuevas keys (dependencia de todo lo demas)
2. `src/constants/timing.ts` -- nueva constante MAX_FORCE_UPDATE_RELOADS
3. `src/constants/analyticsEvents.ts` -- nuevo evento
4. `src/hooks/useForceUpdate.ts` -- refactor principal (depende de 1, 2, 3)
5. `src/components/layout/ForceUpdateBanner.tsx` -- componente nuevo (independiente)
6. `src/App.tsx` -- integracion (depende de 4 y 5)
7. `src/hooks/useForceUpdate.test.ts` -- tests (depende de 4)
8. Lint + build + verificacion

## Riesgos

1. **Import renaming rompe algo** -- Al renombrar `SESSION_KEY_FORCE_UPDATE_LAST_REFRESH` a `STORAGE_KEY_FORCE_UPDATE_LAST_REFRESH`, cualquier otro archivo que importe la vieja constante fallara en compilacion. Mitigacion: buscar todos los usos con grep antes de renombrar; la unica referencia es `useForceUpdate.ts` (ya verificado).

2. **Usuarios existentes con datos en sessionStorage** -- Usuarios que ya tenian el cooldown en sessionStorage no tendran el dato en localStorage. Esto no es un riesgo real: el peor caso es que pierden el cooldown una vez (un reload extra), y a partir de ahi el nuevo mecanismo toma efecto.

3. **localStorage lleno o deshabilitado** -- En modo privado de algunos browsers, `localStorage` puede lanzar excepciones. Mitigacion: todos los accesos a localStorage ya estan wrapeados en try/catch (patron existente en el hook). Si localStorage falla, el hook se comporta como si no hubiera cooldown ni contador, pero el catch de `sessionStorage` existente ya manejaba esto.

## Criterios de done

- [ ] No hay reload loop posible aunque `sessionStorage` falle
- [ ] El usuario siempre puede acceder a la app (banner manual, no bloqueo)
- [ ] Cooldown y contador persisten en `localStorage`
- [ ] Maximo 3 reloads en 5 minutos antes de mostrar banner
- [ ] Test unitario para escenario de cooldown, limite y ventana expirada
- [ ] Tests pasan con >= 80% coverage en codigo nuevo
- [ ] No lint errors
- [ ] Build succeeds (`npx tsc --noEmit`)
- [ ] Analytics event `EVT_FORCE_UPDATE_LIMIT_REACHED` trackeado al alcanzar limite
