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

Cinco cambios independientes, cada uno apunta a un gap. Implementables por separado.

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

### Cambio 3 — Re-check en `visibilitychange`

Agregar listener al hook:

```ts
useEffect(() => {
  if (import.meta.env.DEV) return;

  async function run() { ... }

  run();
  const id = setInterval(run, FORCE_UPDATE_CHECK_INTERVAL_MS);

  const onVisibility = () => {
    if (document.visibilityState === 'visible') run();
  };
  document.addEventListener('visibilitychange', onVisibility);

  return () => {
    clearInterval(id);
    document.removeEventListener('visibilitychange', onVisibility);
  };
}, []);
```

**Justificacion:**
- Cuando el usuario vuelve a la tab (desbloquea el telefono, switchea desde otra app), verificamos inmediatamente.
- Cubre el caso de mobile con `setInterval` throttled: aunque el interval quede congelado, el visibilitychange dispara al volver.
- El cooldown de 5 min y el max-reloads=3 ya existentes previenen loops.

### Cambio 4 — Acelerar take-over del SW nuevo

Registrar el SW con auto-prompt + skipWaiting al detectar nueva version, sin esperar a que se cierren todas las tabs.

Hoy el hook hace hard-refresh cuando detecta `minVersion > __APP_VERSION__`. Pero eso depende de que el ciclo de Firestore funcione. Como defense-in-depth, tambien escuchar el evento nativo de vite-plugin-pwa:

```ts
import { registerSW } from 'virtual:pwa-register';

const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    // Nuevo SW disponible. No esperar a cerrar tabs.
    updateSW(true);
  },
});
```

Esto hace que, independiente de Firestore, cuando vite-plugin-pwa detecta un SW nuevo, lo activa con skipWaiting y recarga. Es un segundo camino para llegar a la misma meta.

**Nota:** evaluar si esto causa reloads duplicados con el camino de Firestore. El cooldown de 5 min y el max-reloads=3 ya protegen contra eso, pero agregar un flag en `sessionStorage` para coordinar ambos caminos puede ser necesario. A decidir en specs.

### Cambio 5 — Metrica de version distribution

Emitir un evento `app_version_active` al montar la app con:
```ts
trackEvent('app_version_active', {
  version: __APP_VERSION__,
  minVersionSeen: minVersionFromFirestore,
  gap: isUpdateRequired(minVersionSeen, __APP_VERSION__),
});
```

**Justificacion:**
- Permite ver en admin/GA4 que porcentaje de sesiones estan en `minVersion` vs. atrasadas.
- Despues de cada release, el admin puede confirmar que el rollout llego al >95% de sesiones en <30 min.
- Sin esta metrica, no sabemos si el fix funciona — seguimos dependiendo del reporte manual del usuario.

## Flujo completo post-cambios

1. Dev mergea a `main` con cualquier cambio (inclusive `chore: bump`)
2. `/merge` bumpea version y pushea
3. CI corre `deploy.yml`: build, deploy hosting
4. **Cambio 1:** CI escribe `config/appVersion.minVersion = "2.36.6"` SIEMPRE
5. Usuario con app abierta en version 2.36.5:
   - **Cambio 3:** vuelve al foreground → check inmediato
   - **Cambio 2:** lee de servidor, no de cache → ve 2.36.6
   - Hook detecta gap, desregistra SW, limpia caches, recarga
6. Usuario con app recien abierta:
   - Check en mount → mismo flujo
7. Usuario que quedo con SW nuevo en "waiting":
   - **Cambio 4:** vite-plugin-pwa lo activa sin esperar cierre de tabs
8. **Cambio 5:** evento `app_version_active` al montar → visibilidad en admin del rollout

## Consideraciones

### Backwards compatibility
- Clientes en versiones <2.31 (pre-#191) no tienen el hook. No podemos forzarlos a actualizar via Firestore — deben abrir la app y el browser eventualmente les servira el SW nuevo. Aceptable: son una minoria residual.
- `getDocFromServer` esta disponible desde firebase-js-sdk v9.7+. Ya usamos v9+ en el proyecto.

### Costo de reads de Firestore
- Cambio 1: escritura de `minVersion` ocurre en cada deploy. Escrituras son gratis a esta escala.
- Cambio 2: `getDocFromServer` es **igual de caro que `getDoc` en el primer fetch**. En subsecuentes, `getDoc` sirve del cache y ahorra; `getDocFromServer` no. Con 100 usuarios activos, 1 read al mount + 1 read cada 30 min + 1 read por visibilitychange (rate limited al cooldown de 5 min) = ~10K-20K reads/dia. Libre (free tier 50K/dia).
- Cambio 3: sin costo adicional — el check ya existe, solo se dispara mas seguido.

### Race conditions
- Si el hook de Firestore y el camino de vite-plugin-pwa disparan al mismo tiempo: el cooldown de 5 min en `useForceUpdate` y la proteccion interna de vite-plugin-pwa previenen doble reload. Validar en specs.

### Deploy order
- El script `update-min-version.js` corre **despues** de `firebase deploy --only hosting`. Si el deploy de hosting fallara pero ya se escribio `minVersion`, los clientes reloadearian en loop buscando una version que no esta en hosting. El orden actual es correcto; validar que se mantenga.

### Caso edge: rollback
- Si hacemos rollback de prod a una version anterior, `minVersion` queda adelante y los clientes con la version vieja (que es la version target del rollback) serian forzados a... la misma version que ya tienen. El `isUpdateRequired` compara strict-greater, asi que si son iguales no pasa nada. Pero si `minVersion` en Firestore quedo en 2.36.7 y hicimos rollback a 2.36.5, los clientes de 2.36.5 intentarian actualizar a 2.36.7 que ya no existe. **Mitigacion:** el rollback debe actualizar `minVersion` a la version target. Documentar en el procedure de rollback.

## Fuera de scope

- Banner "hay actualizacion, queres recargar?" — el feature sigue siendo forzado y transparente
- Versionado de schema de Firestore
- UI para que el admin vea la distribucion de versiones (solo emitimos la metrica; el dashboard es separado)
- Comunicacion por push notification de nueva version

## Tests

### Unitarios
- `fetchAppVersionConfig`: con `getDocFromServer` resuelto → retorna minVersion del server
- `fetchAppVersionConfig`: con `getDocFromServer` rechazado (offline) → fallback a `getDoc` cache
- `useForceUpdate`: dispara `run()` cuando `document.visibilityState` cambia a `'visible'`
- `useForceUpdate`: NO dispara cuando `visibilityState` es `'hidden'`
- `useForceUpdate`: emite `app_version_active` al montar, con `gap: true` si hay gap, `false` si no
- CI: test de `update-min-version.js` (ya existe en specs de #191, mantener)

### Integracion
- E2E en staging: deploy fake, verificar que el evento `app_version_active` aparece en el feed
- E2E en staging: con min-version adelantada manualmente, verificar hard-refresh en la siguiente visibilitychange

### Manual
- Desktop Chrome: abrir app, deploy nueva version, minimizar 30 segundos, volver → debe recargar en <5s
- Mobile Android (tab en background 2+ horas): volver → debe recargar
- Mobile iOS Safari: idem
- PWA instalada: idem, verificar que no rompe el SW del shell
- Offline: verificar que no hay reload en loop ni crash

## Seguridad

- `update-min-version.js` ya corre con service account en CI. No cambia el modelo.
- `getDocFromServer` NO expone mas datos que `getDoc` — son la misma rule.
- Evento `app_version_active` no tiene PII. Version string y comparacion booleana.
- El fallback a cache en `fetchAppVersionConfig` no es un vector: si el attacker pudiera pisar el cache de Firestore local, ya tiene acceso al IndexedDB del usuario y puede hacer cosas mucho peores.

## Dependencias

- Cero dependencias nuevas.
- Requiere `virtual:pwa-register` (ya provisto por vite-plugin-pwa).
- `getDocFromServer` viene con firebase-js-sdk ya en el proyecto.

## Criterios de aceptacion

- [ ] Cambio 1: un commit `chore: bump version X.Y.Z` push-eado solo a main dispara el write a Firestore
- [ ] Cambio 2: `fetchAppVersionConfig` se prueba con network throttled → refleja el valor del server inmediatamente
- [ ] Cambio 3: en staging, volver a la app despues de 1 min en background dispara re-check en <2s
- [ ] Cambio 4: con SW en "waiting" artificialmente, el nuevo SW toma control sin cerrar tabs
- [ ] Cambio 5: evento `app_version_active` aparece en GA4/admin con la distribucion de versiones
- [ ] Post-deploy: el 95% de sesiones activas llegan a la nueva version en <30 min (medido por el evento)
- [ ] Gonzalo confirma en staging que **no** tuvo que hacer hard-reset despues de un deploy

## Riesgos

- **Riesgo alto:** Cambio 4 (skipWaiting inmediato) puede romper flows in-flight (ej: upload de imagen en curso). **Mitigacion:** detectar estado busy via un flag global y diferir skipWaiting. Revisar en specs.
- **Riesgo medio:** Cambio 2 (`getDocFromServer`) puede aumentar latencia perceptible al montar la app si la red es mala. **Mitigacion:** el hook ya corre en background, no bloquea UI.
- **Riesgo bajo:** Cambio 1 fuerza reloads en deploys de emergencia/hotfix con bugs — cada usuario pasa a la version nueva rotada. Aceptable; el flujo de rollback debe actualizar minVersion en el sentido opuesto.
