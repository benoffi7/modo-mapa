# Specs: Force Update Reliability (followup #191)

**PRD:** [prd.md](prd.md)
**Fecha:** 2026-04-22

---

## Modelo de datos

No hay colecciones nuevas. Se modifica el documento existente `config/appVersion` y se agregan tres claves nuevas a `localStorage`/`sessionStorage`.

### Firestore: `config/appVersion` (existente, sin cambios de schema)

```ts
// src/services/config.ts (existente)
export interface AppVersionConfig {
  minVersion: string | undefined;
}
```

Campos persistidos por `scripts/update-min-version.js`:
- `minVersion: string` — version de `package.json` en el deploy exitoso mas reciente.
- `updatedAt: FieldValue.serverTimestamp()` — marca de tiempo del ultimo write.

### Nuevas claves de storage

Agregar a `src/constants/storage.ts`:

```ts
/** localStorage — ultima vez que useForceUpdate corrio checkVersion() exitosamente.
 *  Valor: string(number) con Date.now(). Usado por el fallback PWA para saber si el hook esta "vivo". */
export const STORAGE_KEY_FORCE_UPDATE_LAST_CHECK = 'force_update_last_check';

/** sessionStorage — flag de operacion in-flight (upload/submit critico).
 *  Valor: JSON { startedAt: number, kind: string }. Scope por tab. */
export const STORAGE_KEY_FORCE_UPDATE_BUSY = 'force_update_busy';

/** sessionStorage — flag one-shot por sesion para emitir app_version_active una sola vez. */
export const STORAGE_KEY_APP_VERSION_EVENT_EMITTED = 'app_version_event_emitted';
```

### Nuevas constantes de timing

Agregar a `src/constants/timing.ts`:

```ts
/** Grace window para el fallback PWA: si el hook no corrio en este tiempo, se considera muerto (60 min = 2x interval). */
export const PWA_FALLBACK_GRACE_MS = 60 * 60 * 1000;

/** Edad maxima del busy-flag antes de considerarlo stale (3 min; cubre uploads medianos en 3G). */
export const BUSY_FLAG_MAX_AGE_MS = 3 * 60 * 1000;

/** Heartbeat para uploads largos: cada 30s el progress callback refresca startedAt del busy-flag. */
export const BUSY_FLAG_HEARTBEAT_MS = 30 * 1000;
```

### Evento de analytics nuevo

Agregar a `src/constants/analyticsEvents/system.ts`:

```ts
/** Emitido una vez por sesion (primer check exitoso) con la version activa del cliente. */
export const EVT_APP_VERSION_ACTIVE = 'app_version_active';
```

Payload:

```ts
{
  version: string;           // __APP_VERSION__ del build
  minVersionSeen: string;    // minVersion leido de Firestore (o '' si undefined)
  gap: boolean;              // isUpdateRequired(minVersionSeen, version)
}
```

---

## Firestore Rules

### Rules impact analysis

| Query (service file) | Collection | Auth context | Rule que lo permite | Cambio? |
|---|---|---|---|---|
| `fetchAppVersionConfig` → `getDocFromServer(config/appVersion)` (src/services/config.ts) | `config/appVersion` | Anonimo o autenticado | `match /config/appVersion { allow read: if true; }` (firestore.rules:241-244) | **NO** |
| Fallback `getDoc(config/appVersion)` (mismo archivo, rama offline) | `config/appVersion` | Anonimo o autenticado | idem | **NO** |
| `scripts/update-min-version.js` → `db.doc('config/appVersion').set(...)` en CI | `config/appVersion` | Admin SDK (CI) | Admin SDK bypasea rules | **NO** |

**Conclusion:** el feature **no requiere cambios de rules**. El doc `config/appVersion` ya tiene `allow read: if true` (publico) y `allow write: if false` (solo Admin SDK). `getDocFromServer` usa la misma rule que `getDoc`.

### Field whitelist check

| Collection | Campo nuevo/modificado | En create `hasOnly()`? | En update `affectedKeys().hasOnly()`? | Rule change needed? |
|---|---|---|---|---|
| `config/appVersion` | — | N/A (write: false, solo Admin SDK) | N/A | **NO** |

Ningun servicio de frontend escribe a `config/appVersion`. El Admin SDK bypasea rules, por lo que no hay whitelist que mantener.

---

## Cloud Functions

**No se agregan Cloud Functions en este feature.** La escritura a `config/appVersion` la hace `scripts/update-min-version.js` desde GitHub Actions con service account (Admin SDK).

### Cambio en CI workflow

`.github/workflows/deploy.yml:109-120` — eliminar el step `Check if src/ or functions/ changed` y el `if:` del step `Update minVersion in Firestore`. El script correra en cada deploy exitoso.

Antes:
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

Despues:
```yaml
- name: Update minVersion in Firestore
  run: node scripts/update-min-version.js
```

El script `scripts/update-min-version.js` ya existe y funciona con `pkg.version`. Se mantiene sin cambios (pero ver seccion "Migracion" para el flag `--set`).

---

## Seed Data

**No aplica.** El feature no introduce colecciones nuevas ni campos nuevos en documentos existentes que requieran seeding. El doc `config/appVersion` se escribe desde CI en produccion; en emuladores no es necesario porque `import.meta.env.DEV` hace que el hook retorne early.

---

## Componentes

**No hay componentes UI nuevos.** El feature es puramente infraestructura (hook, service, SW register, CI). Los componentes existentes que hacen uploads/submits se tocan solo para envolver sus writes con `withBusyFlag` (sin cambios visibles al usuario).

### Mutable prop audit

No aplica — no hay components editables agregados ni modificados en sus props.

---

## Textos de usuario

**No se agregan textos de usuario.** El feature sigue siendo transparente (hard refresh silencioso). El unico texto user-facing preexistente es el banner de limite alcanzado (`updateAvailable`), que no se modifica en este ciclo.

---

## Hooks

### `useForceUpdate` (modificado)

**Archivo:** `src/hooks/useForceUpdate.ts`

**Cambios:**

1. **`checkVersion()`**: al final de cada corrida (antes del `return`), escribir `STORAGE_KEY_FORCE_UPDATE_LAST_CHECK = String(Date.now())`. Se escribe **independiente del resultado** (`reloading`, `limit-reached`, `up-to-date`, `error`). En el path `error` tambien se escribe, para que el fallback PWA sepa que el hook esta vivo aunque Firestore este caido.

2. **`checkVersion()`**: agregar chequeo de busy-flag. **Antes** de `isCooldownActive()` y `isReloadLimitReached()` pero **despues** de detectar que `isUpdateRequired === true`:

   ```ts
   if (isBusyFlagActive()) {
     logger.log('Force update deferred: busy flag active');
     return 'up-to-date'; // no error, no reload, solo skip este tick
   }
   ```

3. **`useForceUpdate()` hook body**: agregar listeners `visibilitychange` (document) y `online` (window). Ambos llaman `run()` sin argumentos. Cleanup en el return del `useEffect`.

4. **`run()`**: despues de `checkVersion()`, si retorno `'up-to-date'` o `'error'` con `minVersion` no-nulo, emitir `EVT_APP_VERSION_ACTIVE` **una sola vez por sesion** (guard con `sessionStorage.getItem(STORAGE_KEY_APP_VERSION_EVENT_EMITTED)`). La emision usa la metadata del check (version del build + minVersion leido + gap calculado).

   - Para que `run()` tenga acceso al `minVersion`, `checkVersion()` debe retornar tambien este valor. Refactor: cambiar signature a `Promise<{ status: 'reloading' | 'limit-reached' | 'up-to-date' | 'error'; minVersion: string | undefined }>`.

**Signature final:**

```ts
export function useForceUpdate(): { updateAvailable: boolean };
```

(sin cambios en la API publica)

### `isBusyFlagActive()` (nueva utility privada)

Vive en el **mismo archivo del helper `withBusyFlag`** (ver seccion Servicios). Exportada para que `useForceUpdate` la consuma via import.

---

## Servicios

### `fetchAppVersionConfig` (modificado)

**Archivo:** `src/services/config.ts`

```ts
import { doc, getDoc, getDocFromServer } from 'firebase/firestore';
import { db } from '../config/firebase';
import { COLLECTIONS } from '../config/collections';
import { logger } from '../utils/logger';

export interface AppVersionConfig {
  minVersion: string | undefined;
}

export async function fetchAppVersionConfig(): Promise<AppVersionConfig> {
  const ref = doc(db, COLLECTIONS.CONFIG, 'appVersion');
  let snap;
  try {
    snap = await getDocFromServer(ref);
  } catch (e) {
    // Offline o Firestore down: fallback al cache para no bloquear el flujo.
    logger.warn('fetchAppVersionConfig: getDocFromServer failed, falling back to cache', e);
    snap = await getDoc(ref);
  }
  if (!snap.exists()) return { minVersion: undefined };
  const data = snap.data() as { minVersion?: string };
  return { minVersion: data.minVersion };
}
```

**Notas:**
- `getDocFromServer` ya existe en `firebase/firestore` (v9.7+, ya en el proyecto).
- El fallback `getDoc` usa cache de Firestore — aceptable porque si la red esta caida, no podemos validar una version nueva.
- `logger.warn` (no `.error`) porque el fallback es esperado offline; Sentry no debe explotar en cada perdida de red.

### `withBusyFlag` y `isBusyFlagActive` (nuevas)

**Archivo:** `src/utils/busyFlag.ts` (nuevo)

**Decision de ubicacion:** en `src/utils/` en vez de `src/hooks/` porque:
- NO es un hook de React (no usa `useState`, `useEffect`, etc.).
- Es una funcion pura que envuelve promesas.
- `src/utils/` ya contiene helpers de bajo nivel (logger, analytics, formatDate, perfMetrics, busyFlag encaja aca).

**Signature:**

```ts
// src/utils/busyFlag.ts
import { BUSY_FLAG_MAX_AGE_MS, BUSY_FLAG_HEARTBEAT_MS } from '../constants/timing';
import { STORAGE_KEY_FORCE_UPDATE_BUSY } from '../constants/storage';
import { logger } from './logger';

interface BusyFlag {
  startedAt: number;
  kind: string;
}

/**
 * Envuelve una operacion critica (upload, submit) y expone el flag en sessionStorage
 * para que useForceUpdate no recargue la app a mitad de camino.
 *
 * El `heartbeat` callback debe llamarse periodicamente por operaciones largas (ej:
 * progress callbacks de uploadBytesResumable) para refrescar `startedAt` y evitar
 * que se marque stale. Si la operacion es sincrona o breve, no hace falta llamarlo.
 */
export async function withBusyFlag<T>(
  kind: string,
  fn: (heartbeat: () => void) => Promise<T>,
): Promise<T> {
  setBusyFlag(kind);
  try {
    return await fn(() => refreshBusyFlag(kind));
  } finally {
    clearBusyFlag();
  }
}

/** Retorna true si hay un busy-flag activo y no esta stale. */
export function isBusyFlagActive(): boolean {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY_FORCE_UPDATE_BUSY);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as Partial<BusyFlag>;
    if (typeof parsed.startedAt !== 'number') return false;
    if (Date.now() - parsed.startedAt > BUSY_FLAG_MAX_AGE_MS) return false; // stale
    return true;
  } catch {
    return false;
  }
}

function setBusyFlag(kind: string): void {
  try {
    sessionStorage.setItem(
      STORAGE_KEY_FORCE_UPDATE_BUSY,
      JSON.stringify({ startedAt: Date.now(), kind }),
    );
  } catch (e) {
    logger.warn('withBusyFlag: setItem failed', e);
  }
}

function refreshBusyFlag(kind: string): void {
  setBusyFlag(kind); // actualizamos startedAt al valor actual
}

function clearBusyFlag(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY_FORCE_UPDATE_BUSY);
  } catch {
    // sessionStorage may be unavailable
  }
}

/** @internal Para tests */
export const _setBusyFlag = setBusyFlag;
export const _clearBusyFlag = clearBusyFlag;

export const BUSY_FLAG_HEARTBEAT_INTERVAL_MS = BUSY_FLAG_HEARTBEAT_MS;
```

### Sitios de uso de `withBusyFlag`

El PRD scope-in: "uploads de foto de perfil / foto de reseña / crear reseña / crear lista / guardar settings". Mapeo concreto a archivos reales del repo:

| Operacion del PRD | Ubicacion real del codigo | Accion |
|---|---|---|
| Upload foto de perfil | **No existe hoy** — los avatars son emojis estaticos en `AVATAR_OPTIONS` (`src/constants/avatars.ts`), consumidos por `AvatarPicker.tsx`. `updateUserAvatar` solo guarda un `avatarId: string`, no sube a Storage. | **Scope-out** en este feature. Si mas adelante se implementa upload real de avatar, se envuelve con `withBusyFlag('avatar_upload', ...)`. Documentado en specs como referencia futura. |
| Upload foto de reseña (menu) | `src/services/menuPhotos.ts` → `uploadMenuPhoto` usa `uploadBytesResumable` | Envolver el cuerpo de `uploadMenuPhoto` con `withBusyFlag('menu_photo_upload', async (heartbeat) => { ... })`. Llamar `heartbeat()` dentro del `uploadTask.on('state_changed', (snapshot) => { ... })` cuando `snapshot.bytesTransferred > 0` — al menos cada 30s por diseño del SDK. |
| Upload media en feedback | `src/services/feedback.ts` → `sendFeedback` usa `uploadBytes` (no resumable) | Envolver el `await uploadBytes(...)` + el `updateDoc` subsiguiente con `withBusyFlag('feedback_media_upload', ...)`. No necesita heartbeat (archivos <10MB). |
| Crear reseña (rating) | `src/services/ratings.ts` → `upsertRating` / `upsertCriteriaRating` | Envolver el `setDoc`/`updateDoc` con `withBusyFlag('rating_submit', ...)`. No heartbeat (escritura rapida). |
| Crear comentario | `src/services/comments.ts` → `addComment` / `addReply` (`addDoc`) | Envolver el `addDoc` con `withBusyFlag('comment_submit', ...)`. |
| Crear lista / actualizar lista | `src/services/sharedLists.ts` → `createSharedList`, `updateSharedList`, `addItemToList` | Envolver con `withBusyFlag('list_submit', ...)`. |
| Guardar settings | `src/services/userSettings.ts` → `setDoc` en `updateUserSettings` | Envolver con `withBusyFlag('settings_save', ...)`. |
| Cambiar displayName / avatar / password | `src/services/userProfile.ts` → `updateUserDisplayName`, `updateUserAvatar`; `src/services/emailAuth.ts` → `changePassword` | Envolver con `withBusyFlag('profile_save', ...)`. |

**Regla general aplicada:** solo envolver operaciones invocadas desde **handlers de submit explicitos** del usuario. NO envolver:
- Reads (`getDoc`, `getDocs`, `fetchX`)
- Writes en background (tracking, `lastSeen`, rate limit counters)
- Toggles optimistas rapidos como `toggleFavorite`, `toggleFollow` (<1s, no justifican el overhead; el cooldown de 5 min del force-update ya es proteccion suficiente)
- Subcollections de likes/reactions (rapidos y reversibles)

### Resolucion del tradeoff busy-flag vs uploads largos

**Decision:** subir `BUSY_FLAG_MAX_AGE_MS` a **3 minutos** (PRD propone 90s como baseline, Sofia sugiere 3-5 min) **y** agregar soporte de `heartbeat` en `uploadBytesResumable` (cada 30s minimo por diseno del progress callback del SDK).

**Tradeoff explicito:**

| Opcion | Pros | Contras |
|---|---|---|
| (a) Solo heartbeat | Cubre uploads arbitrariamente largos. | Requiere instrumentacion en cada callsite resumable. Si el heartbeat no se engancha bien (ej: upload inicia pero el browser pausa el tab antes del primer `state_changed`), el flag expira igual. |
| (b) Solo subir a 3-5 min | Cero instrumentacion adicional en callsites. Simple. | Flags pegados por crash/kill de tab pueden bloquear la deteccion hasta 5 min (vs 90s). Con cooldown compartido de 5 min, el peor caso es ~10 min de atraso. |
| **(c) Heartbeat + 3 min (elegida)** | Combina lo mejor: uploads largos refrescan automaticamente; flags pegados caducan en 3 min (no 90s, no 5 min). | Mas codigo que (b), menos intuitivo que (a). |

**Por que 3 min y no 5:** 3 min cubre uploads de fotos de menu (5MB) incluso en 3G lento (~3 min worst case medido en produccion del feature #240). El `heartbeat` del uploadBytesResumable extiende este limite para casos extremos. 5 min duplicaria el tiempo maximo que un flag pegado bloquea updates, sin beneficio practico.

**Para uploads no-resumable (feedback, ratings, comments, settings):** no se llama `heartbeat()`. Son operaciones <3 min por construccion (Firestore writes son <1s, feedback media es <10MB y usa `uploadBytes` blocking que no permite instrumentacion). Si falla, el flag expira en 3 min via `BUSY_FLAG_MAX_AGE_MS` y el proximo tick del hook recarga.

---

## Estrategia de registro del Service Worker (Cambio 4)

### Estado actual

`vite.config.ts:15-16`:
```ts
VitePWA({
  registerType: 'autoUpdate',
  ...
})
```

`registerType: 'autoUpdate'` hace que vite-plugin-pwa inyecte **automaticamente** el codigo de registro en el bundle (en `main.tsx` implicitamente, via el virtual module). **No hay `registerSW()` explicito en `src/`**. Esto implica que no podemos escuchar `onNeedRefresh` sin cambiar la estrategia.

### Decision: migrar a registro manual con `registerType: 'prompt'`

**Cambio en `vite.config.ts`:**

```ts
VitePWA({
  registerType: 'prompt', // antes: 'autoUpdate'
  ...
})
```

**Nuevo archivo: `src/pwa/registerPwa.ts`**

```ts
/**
 * Registra el Service Worker de vite-plugin-pwa y actua como fallback pasivo
 * del useForceUpdate hook. Solo dispara skipWaiting+reload si:
 *   1. Cooldown de 5 min no esta activo.
 *   2. No hay busy-flag activo.
 *   3. El hook Firestore no corrio un check exitoso en los ultimos PWA_FALLBACK_GRACE_MS.
 *
 * Si alguna condicion no se cumple, deja el SW en waiting (se retoma en el proximo ciclo).
 */
import { registerSW } from 'virtual:pwa-register';
import {
  FORCE_UPDATE_COOLDOWN_MS,
  PWA_FALLBACK_GRACE_MS,
} from '../constants/timing';
import {
  STORAGE_KEY_FORCE_UPDATE_LAST_CHECK,
  STORAGE_KEY_FORCE_UPDATE_LAST_REFRESH,
} from '../constants/storage';
import { isBusyFlagActive } from '../utils/busyFlag';
import { logger } from '../utils/logger';

function isCooldownActive(): boolean {
  try {
    const last = localStorage.getItem(STORAGE_KEY_FORCE_UPDATE_LAST_REFRESH);
    if (!last) return false;
    return Date.now() - Number(last) < FORCE_UPDATE_COOLDOWN_MS;
  } catch {
    return false;
  }
}

function isHookAlive(): boolean {
  try {
    const last = localStorage.getItem(STORAGE_KEY_FORCE_UPDATE_LAST_CHECK);
    if (!last) return false;
    return Date.now() - Number(last) < PWA_FALLBACK_GRACE_MS;
  } catch {
    return false;
  }
}

export function registerPwa(): void {
  if (import.meta.env.DEV) return;

  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      if (isCooldownActive()) {
        logger.log('PWA fallback: cooldown active, deferring update');
        return;
      }
      if (isBusyFlagActive()) {
        logger.log('PWA fallback: busy flag active, deferring update');
        return;
      }
      if (isHookAlive()) {
        logger.log('PWA fallback: hook is alive, deferring update');
        return;
      }
      logger.log('PWA fallback: triggering skipWaiting + reload');
      try {
        localStorage.setItem(STORAGE_KEY_FORCE_UPDATE_LAST_REFRESH, String(Date.now()));
      } catch {
        // localStorage may be unavailable
      }
      void updateSW(true);
    },
    onOfflineReady() {
      // No-op: no mostramos toast de "listo offline".
    },
  });
}
```

**`src/main.tsx`: invocar `registerPwa()`**

```ts
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import { initSentry } from './config/sentry'
import { registerPwa } from './pwa/registerPwa'

initSentry()
registerPwa()  // nuevo

createRoot(document.getElementById('root')!).render(...)
```

### Justificacion

- `registerType: 'prompt'` expone `onNeedRefresh` que se dispara cuando el nuevo SW esta instalado y en "waiting". En `autoUpdate` este callback no se puede conectar porque el plugin maneja el flow internamente.
- El modulo virtual `virtual:pwa-register` es provisto por vite-plugin-pwa en ambos modos, pero **con `autoUpdate` el plugin lo importa y lo invoca internamente**, mientras que con `prompt` lo expone para el usuario.
- El registro se hace en `main.tsx` y no dentro del componente React porque:
  - El SW es global (una sola instancia por origen), no debe acoplarse al ciclo de vida de React.
  - Evita problemas con StrictMode double-invoke del useEffect en dev (aunque dev retorna early por `import.meta.env.DEV`).

### Backwards compat

- En DEV, `registerPwa` retorna sin hacer nada — no registra ningun SW (consistente con el comportamiento actual de `autoUpdate` en dev, que no genera SW).
- Clientes ya instalados con el SW viejo (de `autoUpdate`) van a recibir el SW nuevo por el flujo normal de `updateSW`. El primer deploy post-cambio **puede** ser el ultimo bump donde el usuario experimenta el bug (esperado, es el fix).

---

## Integracion

### Componentes/hooks que deben cambiar

| Archivo | Cambio |
|---|---|
| `src/services/config.ts` | `fetchAppVersionConfig` usa `getDocFromServer` con fallback a `getDoc` |
| `src/hooks/useForceUpdate.ts` | Agregar listeners `visibilitychange`/`online`; escribir `STORAGE_KEY_FORCE_UPDATE_LAST_CHECK` por tick; chequear `isBusyFlagActive()`; emitir `EVT_APP_VERSION_ACTIVE` una vez por sesion |
| `src/utils/busyFlag.ts` | **Nuevo** — helper `withBusyFlag` + `isBusyFlagActive` |
| `src/pwa/registerPwa.ts` | **Nuevo** — fallback pasivo que respeta cooldown/busy-flag/hook-grace |
| `src/main.tsx` | Invocar `registerPwa()` despues de `initSentry()` |
| `vite.config.ts` | `registerType: 'prompt'` |
| `src/constants/timing.ts` | Agregar `PWA_FALLBACK_GRACE_MS`, `BUSY_FLAG_MAX_AGE_MS`, `BUSY_FLAG_HEARTBEAT_MS` |
| `src/constants/storage.ts` | Agregar 3 claves nuevas |
| `src/constants/analyticsEvents/system.ts` | Agregar `EVT_APP_VERSION_ACTIVE` |
| `src/services/menuPhotos.ts` | Envolver `uploadMenuPhoto` con `withBusyFlag` + heartbeat en progress callback |
| `src/services/feedback.ts` | Envolver `sendFeedback` (solo cuando hay mediaFile) con `withBusyFlag` |
| `src/services/ratings.ts` | Envolver `upsertRating` y `upsertCriteriaRating` con `withBusyFlag` |
| `src/services/comments.ts` | Envolver `addComment`, `addReply` con `withBusyFlag` |
| `src/services/sharedLists.ts` | Envolver `createSharedList`, `updateSharedList`, `addItemToList` con `withBusyFlag` |
| `src/services/userSettings.ts` | Envolver `updateUserSettings` con `withBusyFlag` |
| `src/services/userProfile.ts` | Envolver `updateUserDisplayName`, `updateUserAvatar` con `withBusyFlag` |
| `src/services/emailAuth.ts` | Envolver `changePassword` con `withBusyFlag` |
| `.github/workflows/deploy.yml` | Quitar check condicional de `update-min-version.js` |
| `src/components/admin/features/ga4FeatureDefinitions.ts` | Agregar `app_version_active` a `eventNames` del feature `force_update` (grupo `system`) |
| `functions/src/admin/analyticsReport.ts` | Agregar `'app_version_active'` al array `GA4_EVENT_NAMES` (seccion System) |
| `docs/procedures/rollback.md` | **Nuevo** — procedure de rollback con step explicito de revertir `minVersion` |

### Preventive checklist

- [x] **Service layer**: `src/hooks/useForceUpdate.ts` ya consume `fetchAppVersionConfig` desde `src/services/config.ts`. El fallback PWA no importa `firebase/firestore` — solo `virtual:pwa-register`. OK.
- [x] **Duplicated constants**: `STORAGE_KEY_FORCE_UPDATE_LAST_CHECK`, `STORAGE_KEY_FORCE_UPDATE_BUSY`, `STORAGE_KEY_APP_VERSION_EVENT_EMITTED` se definen en `src/constants/storage.ts` (unico lugar). `PWA_FALLBACK_GRACE_MS`, `BUSY_FLAG_MAX_AGE_MS`, `BUSY_FLAG_HEARTBEAT_MS` en `src/constants/timing.ts` (unico lugar).
- [x] **Context-first data**: no aplica — el minVersion solo se consume dentro de `useForceUpdate`.
- [x] **Silent .catch**: `src/utils/busyFlag.ts` usa `logger.warn` en el primer catch y `// sessionStorage may be unavailable` silencioso solo en `clearBusyFlag` (intencional; un clear fallido no es accionable). `registerPwa.ts` usa `logger.log` en los path de defer. `fetchAppVersionConfig` usa `logger.warn` en el fallback.
- [x] **Stale props**: no aplica — no hay componentes editables agregados.

---

## Tests

| Archivo test | Que testear | Tipo |
|---|---|---|
| `src/services/config.test.ts` (modificar) | `fetchAppVersionConfig` — happy path con `getDocFromServer` resuelto; fallback a `getDoc` cuando `getDocFromServer` rechaza; retorno `{ minVersion: undefined }` si doc no existe | Service |
| `src/hooks/useForceUpdate.test.ts` (modificar) | Escribe `STORAGE_KEY_FORCE_UPDATE_LAST_CHECK` al final de cada check (incluso en `error`); listener `visibilitychange` dispara `run()` cuando state es `'visible'`; NO dispara cuando `'hidden'`; listener `online` dispara `run()`; `EVT_APP_VERSION_ACTIVE` se emite solo en primer check con flag en sessionStorage; NO se re-emite en ticks/visibilitychange/online subsecuentes; con `isBusyFlagActive() === true` NO recarga aunque haya gap | Hook |
| `src/utils/busyFlag.test.ts` (nuevo) | `withBusyFlag` prende flag, lo limpia en success; en fail (promesa rechazada) tambien limpia (finally); `isBusyFlagActive` retorna true con flag fresco; false con flag >3 min (stale); false sin flag; heartbeat refresca `startedAt`; JSON malformado en sessionStorage retorna false sin crashear | Utility |
| `src/pwa/registerPwa.test.ts` (nuevo) | `registerSW` registrado con `immediate: true`; `onNeedRefresh` respeta cooldown (no llama `updateSW(true)` si `<5 min`); respeta busy-flag (no llama si activo); respeta hook-grace (no llama si `lastCheck <60 min`); llama `updateSW(true)` y escribe `STORAGE_KEY_FORCE_UPDATE_LAST_REFRESH` cuando las tres condiciones se cumplen; en DEV retorna sin registrar | Module |
| `src/services/menuPhotos.test.ts` (modificar) | `uploadMenuPhoto` envuelve con `withBusyFlag`; el `state_changed` callback invoca `heartbeat` al menos una vez | Service |
| `src/services/ratings.test.ts` (modificar) | `upsertRating` / `upsertCriteriaRating` envuelven write con `withBusyFlag` (verificar via spy del helper) | Service |
| `src/services/comments.test.ts` (modificar) | `addComment` / `addReply` envuelven write con `withBusyFlag` | Service |
| `src/services/sharedLists.test.ts` (modificar) | `createSharedList`, `updateSharedList`, `addItemToList` envuelven con `withBusyFlag` | Service |
| `src/services/feedback.test.ts` (modificar) | `sendFeedback` con media envuelve con `withBusyFlag`; sin media tambien envuelve (consistencia) | Service |

**Mock strategy:**
- `vi.mock('virtual:pwa-register', () => ({ registerSW: vi.fn(() => vi.fn()) }))` para `registerPwa.test.ts`.
- `vi.mock('../utils/busyFlag')` en los tests de services para spy en `withBusyFlag`.
- `vi.useFakeTimers()` + `vi.setSystemTime()` para tests de staleness y grace.
- `sessionStorage.clear()` y `localStorage.clear()` en `beforeEach` de `useForceUpdate.test.ts`.

**Cobertura esperada:**
- `src/utils/busyFlag.ts` — 100% (todo el codigo es testeable, sin dependencias externas).
- `src/pwa/registerPwa.ts` — >=90% (el path de DEV es un short-circuit dificil de medir con coverage en el mismo run).
- `src/hooks/useForceUpdate.ts` — mantener o superar la cobertura actual (100% statements/branches, 91% functions segun `tests.md`).
- `src/services/config.ts` — 100% (dos paths: server OK y fallback).

---

## Analytics

### Evento nuevo: `app_version_active`

**Payload:**
```ts
{
  version: string;         // __APP_VERSION__ del build activo
  minVersionSeen: string;  // lo que devolvio Firestore (string vacio si undefined)
  gap: boolean;            // isUpdateRequired(minVersionSeen, version)
}
```

**Disparo:** una sola vez por sesion (tab load). Flag guard en `sessionStorage[STORAGE_KEY_APP_VERSION_EVENT_EMITTED] = '1'`. No se re-emite por visibilitychange/online/interval.

### Registro en catalogos

1. **`src/components/admin/features/ga4FeatureDefinitions.ts` linea 173** — agregar a `eventNames` del feature existente `force_update` (grupo `system`):

   ```ts
   {
     key: 'force_update',
     name: 'Force update',
     icon: icon(SettingsOutlinedIcon),
     eventNames: ['force_update_triggered', 'force_update_limit_reached', 'app_version_active'],
     color: '#607D8B',
   },
   ```

   No se crea un feature card separado — `app_version_active` es parte del mismo dominio (force update) y se visualiza agregado con los otros dos eventos.

2. **`functions/src/admin/analyticsReport.ts` linea 127-130** — agregar `'app_version_active'` al array `GA4_EVENT_NAMES` en la seccion `// System`:

   ```ts
   // System
   'force_update_triggered',
   'force_update_limit_reached',
   'app_version_active',  // nuevo
   'account_deleted',
   ```

   Esto lo incluye en el enum del admin dashboard que rankea volumen de eventos.

### Eventos existentes (sin cambios)

- `force_update_triggered` — ya emitido desde `useForceUpdate.checkVersion` cuando se detecta gap y se recarga.
- `force_update_limit_reached` — ya emitido cuando se llega a `MAX_FORCE_UPDATE_RELOADS`.

---

## Offline

### Cache strategy

| Dato | Estrategia | TTL | Storage |
|---|---|---|---|
| `config/appVersion` | `getDocFromServer` en primer intento; fallback a cache persistente de Firestore (IndexedDB) si red falla | N/A (stale-while-offline) | Firestore persistent cache |
| `STORAGE_KEY_FORCE_UPDATE_LAST_CHECK` | localStorage — sobrevive reload | No expira; se reemplaza en cada tick | localStorage |
| `STORAGE_KEY_FORCE_UPDATE_BUSY` | sessionStorage — muere con la tab | Max `BUSY_FLAG_MAX_AGE_MS` (3 min) | sessionStorage |
| `STORAGE_KEY_APP_VERSION_EVENT_EMITTED` | sessionStorage — muere con la tab | Vive lo que viva la tab | sessionStorage |

### Writes offline

| Operacion | Mecanismo | Conflict resolution |
|---|---|---|
| `scripts/update-min-version.js` (CI) | Admin SDK; solo corre en CI con red garantizada | N/A (server-side unique writer) |

El feature es principalmente read-only desde el cliente. No hay writes a Firestore desde el frontend en este feature (los writes son al local/sessionStorage, que no tiene concepto de offline).

### Fallback UI

**No hay UI nueva.** Si `fetchAppVersionConfig` falla completamente (sin cache y sin red), `checkVersion` retorna `'error'`. El hook no muestra nada al usuario — se respeta el flujo actual.

---

## Accesibilidad y UI mobile

No aplica — el feature no introduce elementos interactivos nuevos. El unico UI pre-existente (banner de limite alcanzado via `updateAvailable`) no se modifica.

---

## Textos y copy

No se agregan textos nuevos.

---

## Decisiones tecnicas

### 1. Helper en `src/utils/` vs `src/hooks/`

**Decision:** `src/utils/busyFlag.ts`.

**Razon:** `withBusyFlag` no es un hook de React (sin `useState`, sin `useEffect`). Es una funcion pura async. Los modulos vecinos en `src/utils/` son del mismo nivel (logger, analytics, distance, formatDate). Poner el helper en `src/hooks/` obligaria a cambiar su naturaleza (ej: retornar un ref) o forzaria convencion incorrecta.

### 2. `isBusyFlagActive` vive junto al helper

**Decision:** ambos en `src/utils/busyFlag.ts`.

**Razon:** ambos comparten el mismo contrato de sessionStorage (key, shape, staleness). Mantenerlos juntos evita drift entre escritor y lector. Exportamos los dos para que `useForceUpdate` y `registerPwa` importen solo `isBusyFlagActive`.

### 3. SW register en `main.tsx` via `registerPwa.ts`

**Decision:** archivo dedicado `src/pwa/registerPwa.ts` invocado desde `main.tsx`, NO desde `App.tsx` ni desde un useEffect.

**Razon:**
- El SW es global (una sola instancia por origen). Acoplarlo al ciclo de vida de React genera problemas con StrictMode double-invoke.
- Separa concerns: `main.tsx` se encarga de bootstrap global (Sentry, SW), `App.tsx` de routing y tree.
- Facilita test aislado del modulo.
- `src/pwa/` como carpeta nueva es mas clara que meterlo en `src/config/` (que es para firebase/sentry) o `src/utils/` (que es para helpers puros).

### 4. Busy-flag con heartbeat + ventana de 3 min

Ver seccion **Servicios > Resolucion del tradeoff busy-flag vs uploads largos**.

### 5. `app_version_active` en el feature card existente (no nuevo)

**Decision:** agregar al `eventNames` de `force_update` en `ga4FeatureDefinitions.ts`, NO crear una card nueva.

**Razon:** los tres eventos (`triggered`, `limit_reached`, `app_version_active`) son facetas del mismo flujo de force-update. Admin ve un solo card con volumen agregado. Si mas adelante se necesita separar para una metrica dedicada, se puede splitar sin costo de migracion (los nombres de eventos ya estan estables).

### 6. `rollback.md` contenido

**Decision:** crear `docs/procedures/rollback.md` con:

```markdown
# Rollback de produccion

## Cuando hacer rollback
- Bug critico en la version recien deployada (crash loops, perdida de datos, ruptura de flujos clave).
- Reportes masivos en <30 min desde el deploy.

## Procedimiento

1. **Identificar la version target** (la que esta estable, previa al deploy roto).

2. **Revertir `minVersion` en Firestore ANTES del rollback de hosting.**

   Usar el flag `--set` del script:

   ```bash
   node scripts/update-min-version.js --set=2.36.5
   ```

   Esto previene un loop: si rollback-easemos hosting primero, los clientes
   verian `minVersion = 2.36.7` (la que falla) y `__APP_VERSION__ = 2.36.5` (rollback),
   e intentarian forzar update a una version que ya no existe en hosting.

3. **Hacer rollback de hosting**: `firebase hosting:rollback` o redeploy manual
   de la version estable desde CI (retriggerear workflow del tag anterior).

4. **Verificar**: abrir la app en incognito; `__APP_VERSION__` debe ser 2.36.5 y
   el hook de force-update no debe dispararse (ya es igual a minVersion).

5. **Post-rollback**: abrir issue describing que fallo, y bloquear auto-deploy
   hasta fix.

## Notas
- El flag `--set=X.Y.Z` es un add-on del script `scripts/update-min-version.js`
  (agregado en este feature). Default sin flag: usa `package.json` actual.
- Monitorear `app_version_active` en GA4 post-rollback para confirmar que la
  flota volvio a la version estable.
```

**Cambio menor en `scripts/update-min-version.js`:** agregar parseo del flag `--set=X.Y.Z` que overridea `pkg.version` si esta presente. Implementacion:

```js
// al principio del script, despues de leer pkg.version
const setArg = process.argv.find((a) => a.startsWith('--set='));
const version = setArg ? setArg.split('=')[1] : pkg.version;

if (!version || !/^\d+\.\d+\.\d+$/.test(version)) {
  console.error(`Invalid version: ${version}`);
  process.exit(1);
}
```

### 7. `dispatchEvent(online)` en tests

Los tests de `useForceUpdate` usan `window.dispatchEvent(new Event('online'))` y `document.dispatchEvent(new Event('visibilitychange'))` junto con `Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })`. Vitest + jsdom soportan ambos.

---

## Hardening de seguridad

### Firestore rules requeridas

**Ningun cambio.** Las rules actuales de `config/appVersion` son correctas:

```
match /config/appVersion {
  allow read: if true;
  allow write: if false;
}
```

`allow read: if true` es intencional y seguro: `minVersion` es publico por naturaleza (cualquier cliente anonimo necesita leerlo en mount para evaluar si recargar).

### Rate limiting

No aplica — el feature no introduce writes from user input. `scripts/update-min-version.js` solo corre en CI con service account.

### Vectores de ataque mitigados

| Ataque | Mitigacion | Archivo |
|---|---|---|
| Pisa de cache Firestore local (cliente usa versión stale indefinidamente) | `getDocFromServer` fuerza ida al server; fallback a cache es aceptable porque si el atacante tiene acceso al IndexedDB del browser, ya tiene acceso a datos mucho mas sensibles | `src/services/config.ts` |
| Reload loop malicioso (atacante setea `minVersion` alto inalcanzable) | Solo Admin SDK escribe (`allow write: if false`); CI es el unico escritor. Cooldown 5 min + MAX_FORCE_UPDATE_RELOADS=3 ya previenen loops client-side | `firestore.rules`, `src/hooks/useForceUpdate.ts` |
| Busy-flag pegado (denial of service local contra force-update) | `BUSY_FLAG_MAX_AGE_MS = 3 min` caduca el flag; heartbeat NO se ejecuta si el tab esta muerto, asi que un tab crasheado libera el flag en <3 min | `src/utils/busyFlag.ts` |
| PWA fallback dispara sin coordinacion y borra datos in-flight | Triple guard (cooldown + busy-flag + hook-grace) en `registerPwa.onNeedRefresh` | `src/pwa/registerPwa.ts` |
| Metric spam (`app_version_active` emitido en cada tick/visibilitychange) | Guard one-shot con `STORAGE_KEY_APP_VERSION_EVENT_EMITTED` en sessionStorage; se resetea solo al cerrar la tab | `src/hooks/useForceUpdate.ts` |

---

## Deuda tecnica: mitigacion incorporada

```bash
gh issue list --label security --state open --json number,title
gh issue list --label "tech debt" --state open --json number,title
```

| Issue | Que se resuelve | Paso del plan |
|---|---|---|
| (ninguno conocido relacionado a force-update) | — | — |

**Nota:** el feature toca principalmente `useForceUpdate.ts`, `config.ts`, y agrega `busyFlag.ts` + `registerPwa.ts`. Ninguno de estos archivos figura como deuda tecnica abierta al momento de escribir estos specs (verificar antes del plan via `gh issue list`). Si el feature #191 hubiera dejado algun TODO abierto, se resuelve ahora (revisar `src/hooks/useForceUpdate.ts` comments en el plan).

Un archivo que **sí** se toca y tiene trade-offs conocidos: `scripts/update-min-version.js`. La extension con flag `--set=X.Y.Z` mantiene la interfaz compatible (sin flag = comportamiento previo).

---

## Migracion / rollout plan

### Plan de rollout

1. **Merge a `main`** del worktree con los cambios.
2. **CI deploy** sube la nueva version (primer release con este fix).
3. **Monitoreo post-deploy (3 releases consecutivos):**
   - GA4 Exploration sobre `app_version_active` filtrado por `gap = true`: <5% de sesiones deberian tener gap tras 30 min del deploy.
   - Si al 3er release no se llega a 95% de adopcion en <30 min, rollback de Cambios 4-6 (revertir `registerType: 'prompt'` a `'autoUpdate'`, quitar `withBusyFlag` de services). Cambios 1-3 (CI + getDocFromServer + visibilitychange/online listeners) son low-risk y quedan.
4. **Confirmacion manual:** Gonzalo verifica en staging y primer release prod que no tuvo que hacer hard-reset.

### Rollback del feature

Si post-deploy hay reload loops o perdida de uploads:

1. Seguir `docs/procedures/rollback.md` (este mismo feature lo crea).
2. Revertir `minVersion` en Firestore a la version estable (pre-feature).
3. Revertir el deploy de hosting.
4. Abrir issue con telemetria capturada de `app_version_active`.

### Gate de merge

- `docs/procedures/rollback.md` DEBE existir antes del merge (criterio de aceptacion del PRD).
- Tests nuevos pasando con cobertura >=80% del codigo nuevo.
- Build OK con `registerType: 'prompt'` (verifica que `virtual:pwa-register` este disponible en runtime).

---

## Resumen

Seis cambios coordinados que llevan el force-update de "se dispara cuando funciona" a "se dispara siempre que haya gap, pero nunca a mitad de un upload". Core: (a) CI escribe minVersion en cada deploy sin condicional; (b) cliente lee siempre del servidor; (c) re-check en visibilitychange + online; (d) fallback PWA pasivo con triple guard; (e) metrica `app_version_active` una vez por sesion; (f) busy-flag con heartbeat + 3 min para no interrumpir operaciones criticas. Cero dependencias nuevas. Cero cambios de rules. Un doc nuevo (`rollback.md`) como procedure gate.
