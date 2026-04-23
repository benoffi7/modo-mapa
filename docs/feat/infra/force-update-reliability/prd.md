# PRD — Force Update Reliability (followup de #191)

## Contexto

El PRD #191 implemento `useForceUpdate`: un hook que compara `config/appVersion.minVersion` (Firestore) contra `__APP_VERSION__` (build) y fuerza un hard refresh si el servidor esta adelante. Esta en produccion desde la v2.31.x.

El problema: **todavia hay version bumps donde los usuarios quedan en la version vieja y tienen que hacer hard-reset de cache manualmente**. Reportado por Gonzalo el 2026-04-22 con los ultimos cambios: version deployada nueva, app abierta, pero el cliente no se actualiza hasta intervencion manual.

No es aceptable: la promesa del feature es que el usuario **siempre** vea la ultima version, aunque el bump sea minimo.

## Problema

Auditoria del pipeline actual (CI → Firestore → cliente → refresh) encontro **cinco gaps** que explican por que algunos bumps no se propagan:

### Gap 1 — CI no escribe `minVersion` cuando el unico commit es el bump

En `.github/workflows/deploy.yml:109-120`:

```yaml
- name: Check if src/ or functions/ changed
  id: check-changes
  run: |
    if git diff --name-only HEAD~1 HEAD | grep -qE '^(src/|functions/)'; then
      echo "changed=true" >> "$GITHUB_OUTPUT"
    else
      echo "changed=false" >> "$GITHUB_OUTPUT"
    fi

- name: Update minVersion in Firestore
  if: steps.check-changes.outputs.changed == 'true'
  run: node scripts/update-min-version.js
```

Dos problemas:

1. **`HEAD~1 HEAD` mira solo un commit.** Si el push incluye varios commits (caso tipico de `/merge`), el check puede pasar por alto cambios en `src/` que estan en commits anteriores.
2. **Un `chore: bump version to X.Y.Z` aislado no toca `src/` ni `functions/`** — solo `package.json`. El bump de version NO actualiza `minVersion` en Firestore. Esto es exactamente el escenario del reporte: hay version nueva deployada, pero el servidor sigue diciendo que `minVersion` es la anterior.

### Gap 2 — `fetchAppVersionConfig` puede devolver cache de Firestore

En [src/services/config.ts:17-22](src/services/config.ts#L17-L22):

```ts
export async function fetchAppVersionConfig(): Promise<AppVersionConfig> {
  const snap = await getDoc(doc(db, COLLECTIONS.CONFIG, 'appVersion'));
  ...
}
```

`getDoc` con Firestore persistent cache habilitado puede resolver desde IndexedDB sin pegarle al servidor. Si el cliente cacheo una version anterior del doc, nunca ve la actualizacion hasta que el cache expire o se invalide — contradiciendo directamente el proposito del hook.

### Gap 3 — No hay re-check al volver a la app (`visibilitychange`)

En [src/hooks/useForceUpdate.ts:150-161](src/hooks/useForceUpdate.ts#L150-L161):

```ts
useEffect(() => {
  if (import.meta.env.DEV) return;
  async function run() { ... }
  run();
  const id = setInterval(run, FORCE_UPDATE_CHECK_INTERVAL_MS);
  return () => clearInterval(id);
}, []);
```

Solo se verifica:
- Al montar la app
- Cada 30 minutos mientras esta en foreground

Problemas:
- Mobile browsers **pausan `setInterval` en pestanas en background**. Si el usuario minimiza la app 2 horas y vuelve, el intervalo esta congelado y el check no se disparo.
- Al volver al foreground no hay re-check inmediato. El usuario puede usar la app vieja varios minutos antes del proximo tick.

### Gap 4 — PWA: nuevo SW queda en "waiting" indefinido

`vite.config.ts:15-16` configura `VitePWA({ registerType: 'autoUpdate' })`. El modo `autoUpdate` de vite-plugin-pwa solo activa `skipWaiting` cuando **todas** las tabs de la app se cierran. En PWAs instaladas y en usuarios que dejan la tab abierta eternamente (caso real en mobile), el SW nuevo queda "waiting" y nunca toma control.

El hook de force-update ya cubre este caso (desregistra el SW y recarga), pero **solo si los gaps 1-3 no bloquean la deteccion**.

### Gap 5 — Sin visibilidad cuando el mecanismo falla

Si `fetchAppVersionConfig` falla (offline, Firestore down, rules mal), `checkVersion` devuelve `'error'` silenciosamente. El usuario sigue en version vieja sin ninguna senal. Tampoco hay metrica para detectar que el rollout no se esta propagando.

Actualmente hay `EVT_FORCE_UPDATE_TRIGGERED` y `EVT_FORCE_UPDATE_LIMIT_REACHED`, pero no hay metrica de *distribucion de versiones activas* para saber cuanto tarda un rollout.

## Solucion propuesta

Seis cambios independientes. Los cambios 1-5 apuntan a los gaps; el Cambio 6 resuelve la coordinacion con operaciones in-flight (busy-flag) surgida en la revision.

### Cambio 1 — CI escribe `minVersion` en cada deploy exitoso

Quitar el check condicional de `deploy.yml`. Si el deploy de hosting tuvo exito, la version de `package.json` **es** la nueva version prod, y `minVersion` debe reflejarla.

**Antes:**
```yaml
- name: Check if src/ or functions/ changed
  ...
- name: Update minVersion in Firestore
  if: steps.check-changes.outputs.changed == 'true'
  run: node scripts/update-min-version.js
```

**Despues:**
```yaml
- name: Update minVersion in Firestore
  run: node scripts/update-min-version.js
```

**Justificacion:**
- El PRD original queria evitar forzar updates por cambios solo en `docs/`. Pero docs no se deployan a production hosting (se deployan via GitHub Pages separadamente), asi que el job de `deploy.yml` nunca se dispara por docs puros.
- Un bump de version (aunque sea patch) implica que se subio una build nueva con assets diferentes. El SW y los chunks son diferentes → vale la pena forzar la actualizacion.
- Elimina la ambiguedad de "cuando se bumpea minVersion".
- **Tradeoff consciente:** deploys que solo tocan `functions/` (sin cambios en `src/`) tambien van a disparar reload de todos los clientes. Aceptable porque: (a) el reload es barato (<5s con buena red), (b) es preferible over-update a under-update, (c) simplifica drasticamente el modelo mental.

**Alternativa considerada (rechazada):** usar un rango completo de commits con `${{ github.event.before }}..HEAD`. Mas complejo y no resuelve el caso de `chore: bump` aislado.

### Cambio 2 — Forzar lectura desde servidor

Modificar `fetchAppVersionConfig` para usar `getDocFromServer`:

```ts
import { doc, getDocFromServer, getDoc } from 'firebase/firestore';

export async function fetchAppVersionConfig(): Promise<AppVersionConfig> {
  let snap;
  try {
    snap = await getDocFromServer(doc(db, COLLECTIONS.CONFIG, 'appVersion'));
  } catch {
    // Offline: fallback al cache para no bloquear el flujo
    snap = await getDoc(doc(db, COLLECTIONS.CONFIG, 'appVersion'));
  }
  if (!snap.exists()) return { minVersion: undefined };
  const data = snap.data() as { minVersion?: string };
  return { minVersion: data.minVersion };
}
```

**Justificacion:**
- `getDocFromServer` garantiza que vemos el valor actualizado.
- Fallback a cache si offline, para no romper el flujo normal — solo hace que el force-update no se dispare mientras no hay red, lo cual es aceptable.
- El costo en reads es despreciable (ya calculado en PRD original).

### Cambio 3 — Re-check en `visibilitychange` y `online`

Agregar listeners al hook:

```ts
useEffect(() => {
  if (import.meta.env.DEV) return;

  async function run() { ... }

  run();
  const id = setInterval(run, FORCE_UPDATE_CHECK_INTERVAL_MS);

  const onVisibility = () => {
    if (document.visibilityState === 'visible') run();
  };
  const onOnline = () => {
    // Cubre el caso "usuario salio del subte / volvio de tunel" sin cambiar de tab
    run();
  };
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('online', onOnline);

  return () => {
    clearInterval(id);
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('online', onOnline);
  };
}, []);
```

**Justificacion:**
- Cuando el usuario vuelve a la tab (desbloquea el telefono, switchea desde otra app), verificamos inmediatamente.
- Cubre el caso de mobile con `setInterval` throttled: aunque el interval quede congelado, el visibilitychange dispara al volver.
- El listener `online` resuelve el caso "usuario sale del subte, recupera red sin cambiar de tab": sin este listener, quedaria hasta 30 min en version vieja. Con el listener, el check se dispara apenas recupera conectividad.
- El cooldown de 5 min y el max-reloads=3 ya existentes previenen loops por triggers solapados (ej: `online` + `visibilitychange` al volver del avion → solo uno efectivamente recarga).

### Cambio 4 — Acelerar take-over del SW nuevo (fallback pasivo)

Registrar el SW con auto-prompt + skipWaiting al detectar nueva version, sin esperar a que se cierren todas las tabs.

Hoy el hook hace hard-refresh cuando detecta `minVersion > __APP_VERSION__`. Pero eso depende de que el ciclo de Firestore funcione. Como defense-in-depth, tambien escuchar el evento nativo de vite-plugin-pwa:

**Nota de configuración:** `vite.config.ts` actualmente usa `registerType: 'autoUpdate'`. El hook `onNeedRefresh` del snippet de abajo solo se dispara en modo `prompt`. Hay dos caminos válidos y el PRD no prescribe cuál:

1. Cambiar a `registerType: 'prompt'` y usar `onNeedRefresh` como en el snippet. Impacto: se pierde el auto-update nativo del plugin (clientes que hoy se actualizan cerrando tabs dependerán exclusivamente del hook Firestore + fallback manual).
2. Mantener `registerType: 'autoUpdate'` y disparar el fallback vía otra señal (ej: `navigator.serviceWorker.addEventListener('controllerchange')` o similar). No usar `onNeedRefresh`.

Owner de la decisión: specs-plan-writer. Criterios de aceptación observables independientes del mecanismo exacto: (a) con SW nuevo en "waiting" y hook muerto >60min, el SW nuevo toma control sin cerrar tabs; (b) cooldown y busy-flag se respetan.

```ts
import { registerSW } from 'virtual:pwa-register';

const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    // Solo actuamos si el camino autoritativo (hook Firestore) no corrio recientemente,
    // el cooldown compartido no esta activo, y no hay operacion busy.
    if (isCooldownActive()) return;
    if (isBusyFlagActive()) return; // hay upload/submit in-flight, diferimos
    const lastCheck = Number(localStorage.getItem(STORAGE_KEY_FORCE_UPDATE_LAST_CHECK) ?? 0);
    if (Date.now() - lastCheck < PWA_FALLBACK_GRACE_MS) return; // el hook esta vivo, que recargue el
    updateSW(true);
  },
});
```

**Coordinacion entre caminos (autoritativo vs fallback pasivo):**

- El **hook `useForceUpdate` (Firestore) es autoritativo**. Es el unico camino que escribe `STORAGE_KEY_FORCE_UPDATE_RELOAD_COUNT` y dispara `EVT_FORCE_UPDATE_TRIGGERED`.
- El **camino vite-plugin-pwa es fallback pasivo.** Solo dispara si se cumplen las tres condiciones:
  1. El cooldown compartido (`STORAGE_KEY_FORCE_UPDATE_LAST_REFRESH`) no esta activo.
  2. No hay busy-flag activo (ver Cambio 6).
  3. El hook no corrio un check exitoso en los ultimos `PWA_FALLBACK_GRACE_MS` (propuesta: 60 min = 2x el interval del hook).
- Para soportar el punto 3, el hook escribe un **nuevo key** `STORAGE_KEY_FORCE_UPDATE_LAST_CHECK` al final de cada ejecucion de `checkVersion` (independiente de si recargo o no). Asi el fallback sabe si el hook esta "vivo".
- Ambos caminos pisan `STORAGE_KEY_FORCE_UPDATE_LAST_REFRESH` al recargar, asegurando que el cooldown de 5 min sea compartido.
- **Criterio observable:** si el usuario reloadea por un camino, el otro no dispara en los proximos 5 min. Verificable en tests unitarios del fallback y manualmente en staging.

### Cambio 5 — Metrica de version distribution

Emitir un evento `app_version_active` **una vez por sesion** (no por check) con:
```ts
trackEvent('app_version_active', {
  version: __APP_VERSION__,
  minVersionSeen: minVersionFromFirestore,
  gap: isUpdateRequired(minVersionSeen, __APP_VERSION__),
});
```

**Sampling (una vez por sesion):**

- Se emite en el primer `checkVersion` exitoso de la sesion (tab load).
- Se marca un flag en `sessionStorage` (`STORAGE_KEY_APP_VERSION_EVENT_EMITTED = '1'`) para evitar re-emisiones por visibilitychange, online, interval ticks, re-renders o dependencias cambiantes de `useEffect`.
- `sessionStorage` se limpia al cerrar la tab, asi que la proxima sesion emite de nuevo. Esto es exactamente lo que queremos: "cuantas sesiones nuevas arrancan con la version X".

**Registro en el catalogo GA4:**

- Registrar `app_version_active` como constante `EVT_APP_VERSION_ACTIVE` en el archivo de dominio `system` de `constants/analyticsEvents/` (donde ya viven `EVT_FORCE_UPDATE_TRIGGERED` y `EVT_FORCE_UPDATE_LIMIT_REACHED`). El barrel `constants/analyticsEvents/index.ts` lo re-exporta automáticamente.
- Registrar el evento en el catálogo consumido por admin (`GA4_FEATURE_CATEGORIES` en `components/admin/features/ga4FeatureDefinitions.ts`), asociado a un feature con `eventNames` que lo incluya. Si no existe un feature "infra"/"force-update" en ese catálogo, crear uno nuevo como parte de este entregable. Owner de la decisión: specs-plan-writer.

**Justificacion:**
- Permite ver en admin/GA4 que porcentaje de sesiones estan en `minVersion` vs. atrasadas.
- Despues de cada release, el admin puede confirmar que el rollout llego al target.
- Sin esta metrica, no sabemos si el fix funciona — seguimos dependiendo del reporte manual del usuario.

### Cambio 6 — Busy-flag para diferir reloads durante operaciones criticas

Problema: un reload disparado durante una operacion in-flight puede corromper estado o perder datos del usuario. El Cambio 4 agrava esto porque skipWaiting + reload sin warning es mas agresivo que el flujo actual.

**Operaciones que prenden el flag:**

- Uploads a Firebase Storage (`uploadBytes`, `uploadBytesResumable`) — ej: foto de perfil, foto de reseña.
- Submits pendientes de Firestore (`addDoc`, `setDoc`, `updateDoc`) invocados desde handlers de submit explicitos — ej: crear reseña, crear lista, guardar settings.
- **Alcance acotado:** NO envolvemos reads ni writes en background (ej: tracking de analytics, updates de `lastSeen`). Solo operaciones donde perder el estado sea user-visible.

**Mecanismo:**

- Flag en `sessionStorage` (scope de tab) con key `STORAGE_KEY_FORCE_UPDATE_BUSY` conteniendo `{ startedAt: number, kind: string }`.
- Helper `withBusyFlag(kind, fn)` envuelve la operacion: prende al entrar, apaga en `finally` (success o fail).
- Ambos caminos (hook Firestore y fallback PWA) consultan `isBusyFlagActive()` antes de recargar. Si esta activo, skip silencioso en ese tick.
- **Timeout de seguridad:** si `Date.now() - startedAt > BUSY_FLAG_MAX_AGE_MS` (propuesta: 90 segundos), el flag se considera stale y se ignora. Previene flags pegados por crashes a mitad de operacion.
- **Que pasa cuando la operacion termina:** NO disparamos update inmediato. Confiamos en el proximo tick del interval, visibilitychange u online. Esto evita race con el `finally` y simplifica el flujo.

**Interacción con la offline queue (IndexedDB):**

El proyecto tiene una cola offline (`offlineQueue.ts` + `ConnectivityContext`) que encola writes cuando el usuario está sin red (comments, ratings, lists CRUD, follows). Al volver online, se dispara un auto-sync que drena la cola.

**Decisión v1:** el auto-sync de la offline queue **no prende** el busy-flag. Los writes encolados son idempotentes (clave determinística o check de existencia) y tolerantes a reload — si el reload interrumpe el drain, los writes pendientes se reintentan en el próximo montaje. El usuario puede ver un flash de estado "sincronizando" que se reinicia, lo cual es aceptable.

**Alternativa considerada (rechazada v1):** extender busy-flag a operaciones de sync. Descartada porque bloquearía el reload durante minutos en casos de cola grande, y la idempotencia del queue ya cubre el caso.

**Criterio observable:** un usuario con N writes en cola que vuelve online y encuentra gap de versión debe ver sus N writes sincronizados después del reload (puede ser antes o después del reload). No hay pérdida de datos user-visible.

**Multi-tab (scope-out explicito):**

- `sessionStorage` NO se comparte entre tabs. Tab A con upload in-flight NO bloquea a Tab B que podria recargar sin problema. Esto es intencional.
- Riesgo residual: Tab B recarga (respetando el cooldown compartido de 5 min), luego pasan >5 min, y Tab A con upload todavia en curso puede ser forzado a recargar en el siguiente tick.
- **Decision v1:** aceptamos este riesgo. En la practica: (a) tabs multiples son raras en mobile (el publico principal), (b) uploads normales terminan en <5 min, (c) observamos en prod via `app_version_active`.
- **Scope-out:** coordinacion activa multi-tab via BroadcastChannel (compartir busy-flag entre tabs). Se reevalua si la telemetria lo pide.

## Flujo completo post-cambios

1. Dev mergea a `main` con cualquier cambio (inclusive `chore: bump`)
2. `/merge` bumpea version y pushea
3. CI corre `deploy.yml`: build, deploy hosting
4. **Cambio 1:** CI escribe `config/appVersion.minVersion = "2.36.6"` SIEMPRE
5. Usuario con app abierta en version 2.36.5:
   - **Cambio 3:** vuelve al foreground (o recupera red) → check inmediato
   - **Cambio 2:** lee de servidor, no de cache → ve 2.36.6
   - **Cambio 6:** si hay upload/submit in-flight → skip ese tick, intenta en el proximo
   - Hook detecta gap, desregistra SW, limpia caches, recarga
6. Usuario con app recien abierta:
   - Check en mount → mismo flujo
7. Usuario que quedo con SW nuevo en "waiting" y el hook murio/no corrio en 60 min:
   - **Cambio 4:** vite-plugin-pwa (fallback pasivo) lo activa sin esperar cierre de tabs, respetando cooldown y busy-flag
8. **Cambio 5:** evento `app_version_active` al primer check exitoso (una vez por sesion) → visibilidad en GA4 del rollout

## Consideraciones

### Backwards compatibility
- Clientes en versiones <2.31 (pre-#191) no tienen el hook. No podemos forzarlos a actualizar via Firestore — deben abrir la app y el browser eventualmente les servira el SW nuevo. Aceptable: son una minoria residual.
- `getDocFromServer` esta disponible desde firebase-js-sdk v9.7+. Ya usamos v9+ en el proyecto.

### Estado inicial post-rollout de este feature

Usuarios que abren la app por primera vez en la versión con estos cambios no tienen `STORAGE_KEY_FORCE_UPDATE_LAST_CHECK` en `localStorage`. El fallback PWA debe tratar ese caso como "hook todavía no corrió en esta sesión" e inhibirse hasta que el hook setee la key al menos una vez, para evitar doble-trigger en el primer montaje. El cooldown compartido acota el peor caso a un solo reload, pero la intención es que el fallback arranque silencioso.

### Costo de reads de Firestore
- Cambio 1: escritura de `minVersion` ocurre en cada deploy. Escrituras son gratis a esta escala.
- Cambio 2: `getDocFromServer` es **igual de caro que `getDoc` en el primer fetch**. En subsecuentes, `getDoc` sirve del cache y ahorra; `getDocFromServer` no. Con 100 usuarios activos, 1 read al mount + 1 read cada 30 min + 1 read por visibilitychange (rate limited al cooldown de 5 min) + 1 read por `online` (idem) = ~10K-20K reads/dia. Libre (free tier 50K/dia).
- Cambio 3: sin costo adicional respecto al baseline de Cambio 2 — el check ya existe, solo se dispara mas seguido.

### Race conditions
- Si el hook de Firestore y el fallback vite-plugin-pwa disparan al mismo tiempo: el cooldown de 5 min compartido (`STORAGE_KEY_FORCE_UPDATE_LAST_REFRESH`) garantiza que solo uno recargue. El fallback ademas respeta el grace de 60 min del hook (`STORAGE_KEY_FORCE_UPDATE_LAST_CHECK`), lo que en la practica hace que solo dispare si el hook esta muerto.
- Si `visibilitychange` y `online` disparan juntos (ej: desbloquear telefono saliendo del subte): ambos llaman `run()`, pero el segundo entra en cooldown del primero si el primero ya recargo. Si ninguno recargo (solo hizo check), se ejecuta el segundo — 1 read extra de Firestore, despreciable.
- Multi-tab con cooldown compartido: detalle en Cambio 6 > Multi-tab.

### Deploy order
- El script `update-min-version.js` corre **despues** de `firebase deploy --only hosting`. Si el deploy de hosting fallara pero ya se escribio `minVersion`, los clientes reloadearian en loop buscando una version que no esta en hosting. El orden actual es correcto; validar que se mantenga.

### Caso edge: rollback
- Si hacemos rollback de prod a una version anterior, `minVersion` queda adelante y los clientes con la version vieja (que es la version target del rollback) serian forzados a... la misma version que ya tienen. El `isUpdateRequired` compara strict-greater, asi que si son iguales no pasa nada. Pero si `minVersion` en Firestore quedo en 2.36.7 y hicimos rollback a 2.36.5, los clientes de 2.36.5 intentarian actualizar a 2.36.7 que ya no existe.
- **Mitigacion:** el rollback debe actualizar `minVersion` a la version target.
- **Scope-in:** crear `docs/procedures/rollback.md` como parte de este feature, con el paso explicito de revertir `config/appVersion.minVersion` al numero de la version target **antes** de hacer el rollback de hosting. Un parrafo + snippet de como correr `update-min-version.js --set=X.Y.Z`. Owner: Gonzalo (dev principal). Sin este doc, el Cambio 1 introduce un foot-gun.

## Fuera de scope

- Banner "hay actualizacion, queres recargar?" — el feature sigue siendo forzado y transparente
- Versionado de schema de Firestore
- Dashboard dedicado de distribucion de versiones en admin (solo emitimos la metrica; la medicion del criterio 95% se hace via GA4 Exploration/DebugView hasta que exista dashboard)
- Comunicacion por push notification de nueva version
- Coordinacion activa multi-tab (BroadcastChannel para compartir busy-flag). Se reevalua con telemetria post-deploy.

## Tests

### Unitarios
- `fetchAppVersionConfig`: con `getDocFromServer` resuelto → retorna minVersion del server
- `fetchAppVersionConfig`: con `getDocFromServer` rechazado (offline) → fallback a `getDoc` cache
- `useForceUpdate`: dispara `run()` cuando `document.visibilityState` cambia a `'visible'`
- `useForceUpdate`: NO dispara cuando `visibilityState` es `'hidden'`
- `useForceUpdate`: dispara `run()` en el evento `online` de `window`
- `useForceUpdate`: emite `app_version_active` solo en el primer check exitoso de la sesion; no re-emite por visibilitychange/online/ticks sucesivos
- `useForceUpdate`: escribe `STORAGE_KEY_FORCE_UPDATE_LAST_CHECK` al final de cada check (incluso sin recarga)
- `useForceUpdate`: con `isBusyFlagActive() === true` NO recarga, aunque haya gap
- Cambio 4 (fallback): con `lastCheck` <60 min → `updateSW(true)` NO se llama
- Cambio 4 (fallback): con cooldown activo → `updateSW(true)` NO se llama
- Cambio 4 (fallback): con busy-flag activo → `updateSW(true)` NO se llama
- Cambio 6: `withBusyFlag` prende y apaga el flag correctamente en success y en fail
- Cambio 6: `isBusyFlagActive()` retorna `false` si `startedAt` tiene >90s (stale)
- CI: nuevo test unitario de `scripts/update-min-version.js` como parte de este feature. Cubre: (a) lectura correcta de `version` desde `package.json`, (b) escritura a `config/appVersion.minVersion` via mock de Firestore Admin, (c) exit code ≠ 0 si la escritura falla. El Cambio 1 incrementa la criticidad del script al correrlo en todo deploy, incluyendo deploys `chore: bump` aislados.

### Integracion
- E2E en staging: deploy fake, verificar que el evento `app_version_active` aparece en el feed GA4
- E2E en staging: con min-version adelantada manualmente, verificar hard-refresh en la siguiente visibilitychange
- E2E en staging: simular perdida y recuperacion de conectividad (`window.dispatchEvent(new Event('online'))`) → verificar re-check

### Manual
- Desktop Chrome: abrir app, deploy nueva version, minimizar 30 segundos, volver → debe recargar en <5s
- Mobile Android (tab en background 2+ horas): volver → debe recargar
- Mobile iOS Safari: idem
- PWA instalada: idem, verificar que no rompe el SW del shell
- Offline: verificar que no hay reload en loop ni crash
- Busy-flag: iniciar upload de foto de perfil, forzar gap de version durante el upload → NO debe recargar hasta que termine el upload
- Subte/tunel: iniciar con red → perder red (airplane mode) → desplegar version nueva → recuperar red SIN cambiar de tab → debe recargar

## Seguridad

- `update-min-version.js` ya corre con service account en CI. No cambia el modelo.
- `getDocFromServer` NO expone mas datos que `getDoc` — son la misma rule.
- Evento `app_version_active` no tiene PII. Version string y comparacion booleana.
- El fallback a cache en `fetchAppVersionConfig` no es un vector: si el attacker pudiera pisar el cache de Firestore local, ya tiene acceso al IndexedDB del usuario y puede hacer cosas mucho peores.

## Dependencias

- Cero dependencias nuevas.
- Requiere `virtual:pwa-register` (ya provisto por vite-plugin-pwa).
- `getDocFromServer` viene con firebase-js-sdk ya en el proyecto.
- Nuevas constantes a crear en `src/constants/storage.ts`: `STORAGE_KEY_FORCE_UPDATE_LAST_CHECK`, `STORAGE_KEY_FORCE_UPDATE_BUSY`, `STORAGE_KEY_APP_VERSION_EVENT_EMITTED`.
- Nuevas constantes a crear en `src/constants/timing.ts`: `PWA_FALLBACK_GRACE_MS` (60 min), `BUSY_FLAG_MAX_AGE_MS` (90 s).

## Decisiones post-review (ciclo 1)

- **Coordinacion de caminos (BLOQUEANTE #1):** el hook `useForceUpdate` (Firestore) es autoritativo; el camino vite-plugin-pwa es fallback pasivo. Comparten `STORAGE_KEY_FORCE_UPDATE_LAST_REFRESH` (cooldown 5 min) y se agrega un nuevo key `STORAGE_KEY_FORCE_UPDATE_LAST_CHECK` que el hook escribe al final de cada check. El fallback PWA solo actua si ese key tiene mas de 60 min de antiguedad (hook murio/desmontado). Criterio observable: si un camino recarga, el otro no dispara en los proximos 5 min. Detalle en Cambio 4.
- **Busy-flag (BLOQUEANTE #2):** nuevo Cambio 6. Prende en uploads de Storage y submits criticos de Firestore (envueltos en helper `withBusyFlag`). Flag en `sessionStorage` con timeout de 90s para evitar flags pegados. Al terminar la operacion NO dispara update inmediato: confia en el proximo tick. Ambos caminos (hook y fallback) consultan `isBusyFlagActive()` antes de recargar.
- **Multi-tab (BLOQUEANTE #3):** scope-out explicito de coordinacion activa. Busy-flag es `sessionStorage` (por tab), cooldown `LAST_REFRESH` es `localStorage` (compartido). Tab A con upload no bloquea a Tab B, pero el cooldown compartido reduce la chance de reload simultaneo. Riesgo residual documentado en Cambio 6.
- **Medicion 95% (BLOQUEANTE #4):** se mide via GA4 Exploration query sobre el evento `app_version_active` (una vez por sesion). Ventana de observacion: **3 releases consecutivos post-merge**. Si no se cumple al 3er release, rollback del Cambio 4 (mas riesgoso) y se ajusta interval o se evalua coordinacion multi-tab. Los Cambios 1-3 quedan como baseline aun en rollback parcial del 4-6.
- **Offline → online (IMPORTANTE #5):** resuelto. Se agrega listener `online` a `window` en Cambio 3. Cubre el caso subte/tunel sin cambio de visibility.
- **Sampling de `app_version_active` (IMPORTANTE #6):** resuelto. Una vez por sesion, controlado por flag en `sessionStorage` (`STORAGE_KEY_APP_VERSION_EVENT_EMITTED`). Sin re-emisiones por visibilitychange/online/interval. Detalle en Cambio 5.
- **Dashboard del 95% (IMPORTANTE #7):** resuelto. Medicion via GA4 Exploration/DebugView. Dashboard dedicado queda fuera de scope con owner explicito (feature separado). Agregado en Fuera de scope y reflejado en criterios de aceptacion.
- **Procedure de rollback (IMPORTANTE #8):** scope-in. Se crea `docs/procedures/rollback.md` como parte de este feature con el paso de revertir `minVersion`. Owner: Gonzalo.
- **Tradeoff chore-only / functions-only deploys (OBSERVACION):** documentado en Cambio 1 > Justificacion. Tradeoff aceptado conscientemente.
- **Catalogo GA4 (OBSERVACION):** `app_version_active` se agrega a `GA4_EVENT_NAMES` (analyticsReport.ts) y a `ga4FeatureDefinitions.ts`. Detalle en Cambio 5.

## Decisiones post-review (ciclo 2)

1. **Cambio 4 — `onNeedRefresh` vs `autoUpdate`**: ambos caminos documentados en el PRD como Opción 1 (cambiar a `'prompt'`) y Opción 2 (mantener `'autoUpdate'` con otra señal). Owner de decisión final: specs-plan-writer. El PRD no prescribe — define criterios observables independientes del mecanismo.
2. **Cambio 6 — Offline queue**: el auto-sync de la offline queue NO prende el busy-flag en v1. Justificación: idempotencia de los writes encolados cubre el caso; extender el flag bloquearía el reload durante minutos en colas grandes.
3. **Cambio 5 — Grupo admin en catálogo GA4**: si no existe un feature "infra" / "force-update" en `GA4_FEATURE_CATEGORIES`, crear uno nuevo como parte del entregable de este feature. La decisión concreta (feature existente vs crear nuevo) queda para specs-plan-writer al leer el archivo real.

## Criterios de aceptacion

- [ ] Cambio 1: un commit `chore: bump version X.Y.Z` push-eado solo a main dispara el write a Firestore
- [ ] Cambio 2: `fetchAppVersionConfig` se prueba con network throttled → refleja el valor del server inmediatamente
- [ ] Cambio 3: en staging, volver a la app despues de 1 min en background dispara re-check en <2s
- [ ] Cambio 3: en staging, simular perdida/recuperacion de red sin cambiar tab → el evento `online` dispara re-check en <2s
- [ ] Cambio 4: con SW en "waiting" artificialmente y el hook muerto (no corrio check en >60 min), el nuevo SW toma control sin cerrar tabs
- [ ] Cambio 4 (coordinacion): si el hook recargo hace <5 min, el fallback PWA no dispara (test unitario + manual en staging)
- [ ] Cambio 4 (coordinacion): si el hook corrio un check hace <60 min, el fallback PWA no dispara aunque haya SW nuevo (test unitario)
- [ ] Cambio 5: evento `app_version_active` aparece en GA4 **una sola vez por sesion** (no se re-emite por visibilitychange/online/ticks)
- [ ] Cambio 5: `EVT_APP_VERSION_ACTIVE` está exportado desde `constants/analyticsEvents/system.ts` (o archivo de dominio equivalente) y visible via barrel `constants/analyticsEvents/index.ts`.
- [ ] Cambio 5: El evento aparece en `GA4_FEATURE_CATEGORIES` (`components/admin/features/ga4FeatureDefinitions.ts`) bajo un feature correspondiente, con tests que cubren el registro (siguiendo el patrón de `ga4FeatureDefinitions.test.ts` existente).
- [ ] Cambio 6: durante un upload de Storage simulado, el hook encuentra gap y NO recarga; al terminar, el proximo tick recarga
- [ ] Cambio 6: si el busy-flag tiene >90s de antiguedad (stale), ambos caminos lo ignoran y recargan
- [ ] `docs/procedures/rollback.md` existe y documenta el paso de revertir `minVersion` antes del rollback de hosting
- [ ] Post-deploy (medicion via GA4 Exploration sobre `app_version_active`): definiendo **T0 = timestamp del write de `minVersion` a Firestore** (paso final del pipeline de deploy) y **denominador = sesiones que emitieron `app_version_active` entre T0 y T0+30min**, en **3 releases consecutivos** el % de sesiones cuya `version == minVersionSeen` llega a 95%+. Si no se cumple al 3er release, rollback de Cambios 4-6 y se ajusta.
- [ ] Gonzalo confirma en staging (y en el primer release prod post-merge) que **no** tuvo que hacer hard-reset despues del deploy

## Riesgos

- **Riesgo alto:** Cambio 4 (skipWaiting inmediato) puede romper flows in-flight (ej: upload de imagen en curso). **Mitigacion:** Cambio 6 (busy-flag) detecta estado busy y difiere el reload. Timeout de 90s previene flags pegados.
- **Riesgo medio:** Cambio 2 (`getDocFromServer`) puede aumentar latencia perceptible al montar la app si la red es mala. **Mitigacion:** el hook ya corre en background, no bloquea UI.
- **Riesgo medio:** tab multiple sin coordinacion activa puede forzar reload de Tab A mientras Tab B recien recargo. **Mitigacion:** cooldown compartido de 5 min acota el caso al usuario que tiene >5 min de upload continuo, lo cual es raro. Telemetria `app_version_active` nos dejara ver si pasa en prod.
- **Riesgo bajo:** Cambio 1 fuerza reloads en deploys de emergencia/hotfix con bugs — cada usuario pasa a la version nueva rotada. Aceptable; el flujo de rollback (ahora documentado) actualiza minVersion en el sentido opuesto.
- **Riesgo bajo:** `getDocFromServer` en redes marginales (3G, edge rural) puede fallar por timeout y caer al fallback de `getDoc` (cache), que devolvería la `minVersion` previa. El check queda inefectivo en ese tick pero el próximo trigger (interval, `visibilitychange`, `online`) reintenta. Aceptado.

## Validacion Funcional — Sofia

**Estado:** VALIDADO
**Revisora:** Sofia (Analista Funcional Senior)
**Fecha:** 2026-04-22
**Ciclos:** 2

### Hallazgos cerrados

**Ciclo 1 (8 hallazgos):** coordinacion hook vs fallback PWA, busy-flag para operaciones criticas, scope-out de multi-tab coordination, medicion del 95% con ventana de 3 releases, listener `online` para caso subte/tunel, sampling una-vez-por-sesion de `app_version_active`, dashboard del 95% fuera de scope, scope-in de `docs/procedures/rollback.md`, tradeoff chore-only/functions-only, catalogo GA4. Detalles en "Decisiones post-review (ciclo 1)".

**Ciclo 2 (7 hallazgos):**
- BLOQ #1 — Rutas GA4 correctas: Cambio 5 ahora referencia `constants/analyticsEvents/system.ts` (EVT_APP_VERSION_ACTIVE) y `components/admin/features/ga4FeatureDefinitions.ts` (GA4_FEATURE_CATEGORIES). Ambos archivos verificados en disco.
- BLOQ #2 — Test de `update-min-version.js` declarado como nuevo entregable en Tests > Unitarios, con tres casos (package.json, write a mock Firestore, exit code).
- IMP #3 — Interaccion con offline queue (IndexedDB) resuelta en Cambio 6: decision v1 = auto-sync NO prende busy-flag; idempotencia de writes encolados cubre el caso.
- IMP #4 — Cambio 4 documenta Opcion 1 (`registerType: 'prompt'` + `onNeedRefresh`) y Opcion 2 (mantener `autoUpdate` + otra senal). Criterios observables independientes del mecanismo. Owner: specs-plan-writer.
- IMP #5 — Criterio del 95%: T0 = write de minVersion a Firestore; denominador = sesiones con `app_version_active` entre T0 y T0+30min; ventana = 3 releases consecutivos.
- OBS #6 — Sub-seccion "Estado inicial post-rollout" cubre el caso del key ausente en localStorage: fallback PWA debe inhibirse hasta que el hook setee `STORAGE_KEY_FORCE_UPDATE_LAST_CHECK`.
- OBS #7 — Riesgo bajo agregado: `getDocFromServer` en redes marginales puede fallar por timeout y caer al cache; el proximo trigger reintenta.

Detalles en "Decisiones post-review (ciclo 2)".

### Observaciones abiertas (no bloqueantes)

- **Uploads >90s en red lenta:** el timeout del busy-flag (90s) puede marcarse stale durante uploads largos en 3G. Considerar en specs/plan: (a) `uploadBytesResumable` con heartbeat que refresque `startedAt` mientras hay progreso, o (b) subir `BUSY_FLAG_MAX_AGE_MS` a 3-5 min. Tradeoff entre "flag pegado por crash" y "upload largo interrumpido". Owner: specs-plan-writer + Gonzalo.
- **Hotfix urgente vs ventana "3 releases":** la ventana puede abreviarse por decision manual ante falla evidente (reload en loop, usuarios reportando). No es commit ciego. Owner: Gonzalo.
- **rollback.md como gate de merge:** el criterio exige que el doc exista antes del merge. Implementador debe incluirlo en el mismo PR. Owner: Gonzalo.
- **Decisiones delegadas a specs-plan-writer:** Cambio 4 (mecanismo SW), Cambio 5 (feature GA4 existente vs nuevo). Son decisiones tecnicas explicitas, no huecos del PRD.
- **Coherencia grace/interval verificada:** `FORCE_UPDATE_CHECK_INTERVAL_MS = 30 min`. Grace de 60 min = 2x interval; no hay ventana de disparo simultaneo.

### Listo para specs-plan-writer

**Si.** No quedan bloqueantes ni huecos que requieran un tercer ciclo.
