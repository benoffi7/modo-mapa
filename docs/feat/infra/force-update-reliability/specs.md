# Specs: Force Update Reliability (followup #191)

**PRD:** [prd.md](prd.md)
**Fecha:** 2026-04-22

---

## Modelo de datos

No hay colecciones nuevas. Se modifica el documento existente `config/appVersion` y se agregan tres claves nuevas a `localStorage`/`sessionStorage`.

### Firestore: `config/appVersion` (existente, tipo extendido)

```ts
// src/services/config.ts (modificado)
import type { Timestamp } from 'firebase/firestore';

export interface AppVersionConfig {
  minVersion: string | undefined;
  /**
   * Marca de tiempo del último write desde CI (`scripts/update-min-version.js`).
   * Server-only: no consumido por el cliente hoy, pero persistido para telemetría
   * futura (age del último deploy) y verificado por los tests del script.
   * Backwards-compatible: opcional.
   */
  updatedAt?: Timestamp;
}
```

Campos persistidos por `scripts/update-min-version.js`:
- `minVersion: string` — version de `package.json` en el deploy exitoso mas reciente.
- `updatedAt: FieldValue.serverTimestamp()` — marca de tiempo del ultimo write (tipada arriba como `Timestamp` opcional).

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

### Nota de coherencia con PRD — `BUSY_FLAG_MAX_AGE_MS`

El PRD propone `90s` como baseline del busy-flag-stale. Este specs elige **`180s` (3 min)** amparado en la observación abierta de Sofía ("uploads >90s en red lenta", Ciclo 1 review). El test unitario declarado en el PRD (`isBusyFlagActive() retorna false si startedAt tiene >90s`) se actualiza a `>180s` (3 min) para reflejar esta decisión. **Owner de la decisión: specs-plan-writer (este documento)**; no requiere nuevo approval porque Sofía delegó el rango `90-300s` al scope de specs.

### Evento de analytics nuevo

Agregar a `src/constants/analyticsEvents/system.ts`:

```ts
/** Emitido una vez por sesion (primer check exitoso desde server/server-retry/empty) con la version activa del cliente. */
export const EVT_APP_VERSION_ACTIVE = 'app_version_active';
```

Payload:

```ts
{
  version: string;           // __APP_VERSION__ del build
  minVersionSeen: string;    // minVersion leido de Firestore (o '' si undefined)
  gap: boolean;              // isUpdateRequired(minVersionSeen, version)
  source: 'server' | 'server-retry' | 'empty'; // nunca 'cache' ni 'unknown' — ver hook spec
}
```

**Invariante**: el evento nunca se emite con `source ∈ { 'cache', 'unknown' }`. El dashboard de adopción se construye filtrando por `source != null`, lo cual ya viene garantizado por la omisión en el cliente.

---

## Firestore Rules

### Rules impact analysis

| Query (service file) | Collection | Auth context | Rule que lo permite | Cambio? |
|---|---|---|---|---|
| `fetchAppVersionConfig` → `getDocFromServer(config/appVersion)` (src/services/config.ts) | `config/appVersion` | Anonimo o autenticado | bloque `match /config/appVersion { allow read: if true; allow write: if false; }` en `firestore.rules` | **NO** |
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

4. **`run()`**: despues de `checkVersion()`, emitir `EVT_APP_VERSION_ACTIVE` **una sola vez por sesion** (guard con `sessionStorage.getItem(STORAGE_KEY_APP_VERSION_EVENT_EMITTED)`) **solo si**:
   - `status` ∈ `{ 'up-to-date', 'reloading', 'limit-reached' }` (NUNCA `'error'`). En `'error'` no sabemos si el cliente está efectivamente up-to-date; emitir ahí mete ruido en la métrica de adopción.
   - El `source` devuelto por `fetchAppVersionConfig` es `'server'` o `'server-retry'`. Si `source === 'cache'`, omitimos la emisión: el dato puede estar desactualizado y la métrica refleja adopción real del servidor, no adopción según cache local. Si `source === 'empty'`, emitimos (es un estado conocido: primer deploy, aún no hay `minVersion`).
   - Payload incluye `source` para trazabilidad. Si en el futuro se quiere medir cobertura de cache-only, se hace con otra métrica.

   - Para que `run()` tenga acceso al `minVersion` y el `source`, `checkVersion()` debe retornar también estos valores. Refactor: cambiar signature a `Promise<{ status: 'reloading' | 'limit-reached' | 'up-to-date' | 'error'; minVersion: string | undefined; source: 'server' | 'server-retry' | 'cache' | 'empty' | 'unknown' }>` (donde `'unknown'` aplica al path `'error'`).

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
import { doc, getDoc, getDocFromServer, FirestoreError, type Timestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import { COLLECTIONS } from '../config/collections';
import { logger } from '../utils/logger';

export interface AppVersionConfig {
  minVersion: string | undefined;
  updatedAt?: Timestamp;
  /**
   * De dónde vino el dato. Lo usan consumidores de telemetría (useForceUpdate)
   * para decidir si emitir `app_version_active` o no.
   *  - 'server'  → getDocFromServer resolvió en 1er intento
   *  - 'server-retry' → resolvió en intento 2 o 3
   *  - 'cache'   → fallback a getDoc tras 3 fallos de server
   *  - 'empty'   → doc no existe aún (primer deploy)
   */
  source: 'server' | 'server-retry' | 'cache' | 'empty';
}

const RETRY_DELAYS_MS = [500, 1500];
const RETRYABLE_CODES = new Set(['unavailable', 'deadline-exceeded']);

function isRetryable(err: unknown): boolean {
  return err instanceof FirestoreError && RETRYABLE_CODES.has(err.code);
}

export async function fetchAppVersionConfig(): Promise<AppVersionConfig> {
  const ref = doc(db, COLLECTIONS.CONFIG, 'appVersion');

  // Intento 1 + 2 retries con backoff para manejar el caso subte→4G:
  // el evento `online` del browser puede dispararse antes de que Firestore
  // restablezca sesión, devolviendo `unavailable` o `deadline-exceeded`.
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const snap = await getDocFromServer(ref);
      const source: 'server' | 'server-retry' = attempt === 0 ? 'server' : 'server-retry';
      if (!snap.exists()) return { minVersion: undefined, source: 'empty' };
      const data = snap.data() as { minVersion?: string; updatedAt?: Timestamp };
      return { minVersion: data.minVersion, updatedAt: data.updatedAt, source };
    } catch (e) {
      if (attempt < 2 && isRetryable(e)) {
        await new Promise((r) => setTimeout(r, RETRY_DELAYS_MS[attempt]));
        continue;
      }
      if (attempt < 2) {
        // Error no retryable: saltamos directo al fallback.
        logger.warn('fetchAppVersionConfig: non-retryable error on getDocFromServer', e);
        break;
      }
      logger.warn('fetchAppVersionConfig: server exhausted retries, falling back to cache', e);
    }
  }

  // Fallback: cache local de Firestore (IndexedDB).
  try {
    const snap = await getDoc(ref);
    if (!snap.exists()) return { minVersion: undefined, source: 'empty' };
    const data = snap.data() as { minVersion?: string; updatedAt?: Timestamp };
    return { minVersion: data.minVersion, updatedAt: data.updatedAt, source: 'cache' };
  } catch (e) {
    // Sin red y sin cache: ceder control arriba — el error se propaga.
    throw e;
  }
}
```

**Notas:**
- `getDocFromServer` ya existe en `firebase/firestore` (v9.7+, ya en el proyecto).
- Los retries mitigan el gap entre `window.online` y la reanudación de sesión de Firestore (observado en subte/túneles). Backoff `500ms → 1500ms` da ~2s máximo antes de ceder al cache, dentro del criterio "<2s" del PRD **cuando la conectividad Firestore está restablecida**; si no lo está, la telemetría lo refleja (`source: 'cache'`) y el próximo trigger (`visibilitychange`/`online`/interval) reintenta.
- `source` permite filtrar la métrica `app_version_active`: solo emitimos cuando `source !== 'cache'` para que la métrica refleje estado real del servidor (ver IMPORTANTE #8 abajo).
- `logger.warn` (no `.error`) porque el fallback es esperado offline; Sentry no debe explotar en cada pérdida de red.

### `withBusyFlag` y `isBusyFlagActive` (nuevas)

**Archivo:** `src/utils/busyFlag.ts` (nuevo)

**Decision de ubicacion:** en `src/utils/` en vez de `src/hooks/` porque:
- NO es un hook de React (no usa `useState`, `useEffect`, etc.).
- Es una funcion pura que envuelve promesas.
- `src/utils/` ya contiene helpers de bajo nivel (logger, analytics, formatDate, perfMetrics, busyFlag encaja aca).

**Contrato** (soporta concurrency via refcount, heartbeat sólo con tab visible, cancel via `AbortSignal`):

```ts
// src/utils/busyFlag.ts
import { BUSY_FLAG_MAX_AGE_MS, BUSY_FLAG_HEARTBEAT_MS } from '../constants/timing';
import { STORAGE_KEY_FORCE_UPDATE_BUSY } from '../constants/storage';
import { logger } from './logger';

interface BusyFlag {
  startedAt: number;
  kind: string;
  /** Refcount: cantidad de operaciones concurrentes activas. Solo se limpia cuando llega a 0. */
  count: number;
}

/**
 * Envuelve una operacion critica (upload, submit) y expone el flag en sessionStorage
 * para que useForceUpdate no recargue la app a mitad de camino.
 *
 * Concurrency: si ya hay un flag activo y llega una segunda operación, incrementa
 * el refcount en vez de sobreescribir. El flag se limpia solo cuando count llega a 0.
 *
 * Heartbeat: el callback que recibe `fn` solo refresca `startedAt` si `document.visibilityState === 'visible'`.
 * Si el tab está oculto, el heartbeat es no-op y el flag expira naturalmente a los 3 min,
 * evitando que uploads fantasma (tabs en background con red cortada) bloqueen force-update
 * indefinidamente.
 *
 * AbortSignal: el wrapper no cancela directamente — si `fn` lanza por AbortError,
 * el `finally` libera el flag (decrementa el refcount) igual que en cualquier otro error.
 */
export async function withBusyFlag<T>(
  kind: string,
  fn: (heartbeat: () => void) => Promise<T>,
): Promise<T> {
  incrementBusyFlag(kind);
  try {
    return await fn(() => refreshBusyFlagIfVisible(kind));
  } finally {
    decrementBusyFlag();
  }
}

/** Retorna true si hay un busy-flag activo, no stale, y con count > 0. */
export function isBusyFlagActive(): boolean {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY_FORCE_UPDATE_BUSY);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as Partial<BusyFlag>;
    if (typeof parsed.startedAt !== 'number') return false;
    if (typeof parsed.count !== 'number' || parsed.count <= 0) return false;
    if (Date.now() - parsed.startedAt > BUSY_FLAG_MAX_AGE_MS) return false; // stale
    return true;
  } catch {
    return false;
  }
}

function readFlag(): BusyFlag | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY_FORCE_UPDATE_BUSY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<BusyFlag>;
    if (typeof parsed.startedAt !== 'number' || typeof parsed.count !== 'number') return null;
    return { startedAt: parsed.startedAt, kind: parsed.kind ?? '', count: parsed.count };
  } catch {
    return null;
  }
}

function writeFlag(flag: BusyFlag): void {
  try {
    sessionStorage.setItem(STORAGE_KEY_FORCE_UPDATE_BUSY, JSON.stringify(flag));
  } catch (e) {
    logger.warn('busyFlag: setItem failed', e);
  }
}

function incrementBusyFlag(kind: string): void {
  const current = readFlag();
  if (current && current.count > 0 && Date.now() - current.startedAt <= BUSY_FLAG_MAX_AGE_MS) {
    writeFlag({ startedAt: Date.now(), kind: current.kind, count: current.count + 1 });
  } else {
    writeFlag({ startedAt: Date.now(), kind, count: 1 });
  }
}

function decrementBusyFlag(): void {
  const current = readFlag();
  if (!current) return;
  const nextCount = current.count - 1;
  if (nextCount <= 0) {
    try { sessionStorage.removeItem(STORAGE_KEY_FORCE_UPDATE_BUSY); } catch { /* unavailable */ }
  } else {
    writeFlag({ ...current, count: nextCount });
  }
}

function refreshBusyFlagIfVisible(kind: string): void {
  // Heartbeat guard: solo refrescamos si el tab está visible. Tabs hidden
  // no deben extender el flag (caso: usuario minimizó la app en medio de un upload
  // que se colgó; el tab sigue vivo pero el upload no progresa).
  if (typeof document !== 'undefined' && document.visibilityState !== 'visible') {
    return;
  }
  const current = readFlag();
  if (!current || current.count <= 0) return;
  writeFlag({ ...current, startedAt: Date.now(), kind: current.kind || kind });
}

/** @internal Para tests */
export const _writeBusyFlag = writeFlag;
export const _readBusyFlag = readFlag;

export const BUSY_FLAG_HEARTBEAT_INTERVAL_MS = BUSY_FLAG_HEARTBEAT_MS;
```

**Propiedades garantizadas:**
1. **Refcount**: N operaciones concurrentes comparten el mismo flag; se apaga solo cuando la última resuelve/rechaza.
2. **Heartbeat background-aware**: si el tab se oculta durante un upload largo, el heartbeat pausa y el flag caduca en ≤3 min (no queda pegado indefinidamente).
3. **Cancel via `AbortSignal`**: el wrapper no conoce al signal; el `finally` libera el flag igual cuando la promesa rechaza por `AbortError` (verificado por test específico).

### Sitios de uso de `withBusyFlag`

**Capa correcta de integración.** El proyecto usa el patrón `withOfflineSupport(isOffline, type, meta, payload, onlineAction)` (ver `src/services/offlineInterceptor.ts`). Si estamos online, invoca `onlineAction()`; si estamos offline, encola la acción y `syncEngine.processQueue` la drena más tarde llamando al mismo service real.

**Regla dura — dónde va `withBusyFlag`:**

1. **SÍ**: en el **callsite del submit explícito del usuario** — o sea, el `onlineAction` (quinto argumento de `withOfflineSupport`) cuando existe, o el handler del componente cuando la operación no pasa por offlineInterceptor.
2. **NO**: dentro del service (`upsertRating`, `addComment`, `createList`, etc.). Si el wrap estuviera ahí, `syncEngine.processQueue` al drenar la cola invocaría el service y **prendería el busy-flag durante una sincronización automática**, violando la decisión v1 del PRD ("auto-sync NO prende busy-flag; el flag solo refleja operaciones in-flight iniciadas por el usuario en esta tab").
3. **NO**: en `syncEngine.executeAction` ni `processQueue`. Esto queda documentado en texto explícito y se chequea en el plan.

**Criterio de selección:** solo envolver **handlers de submit explícito del usuario** (botón "Guardar", "Enviar", "Confirmar"). NO envolver:
- Reads (`getDoc`, `getDocs`, `fetch*`).
- Writes background fire-and-forget (preferences, tracking, `lastSeen`, rate limit counters).
- Toggles optimistas rápidos (`toggleFavorite`, `toggleFollow`, `toggleListPublic`, `comment_like/unlike`) — <1s, reversibles; el cooldown de 5 min del force-update ya es protección suficiente y envolverlos genera ruido constante.
- `updateUserSettings` **como service**: se llama fire-and-forget desde `useUserSettings`, `useFollowedTags`, `useInterestsFeed` para toggles optimistas de preferences. Envolverlo globalmente prendería el flag en cada cambio de preference → ruido constante. **Sólo se envuelve** si en el futuro aparece un form con botón "Guardar" explícito que llame a `updateUserSettings` (no hay ninguno hoy).

**Callsites concretos a tocar** (verificados con grep):

| Submit explícito | Archivo (componente/hook) | Símbolo real | Cambio concreto |
|---|---|---|---|
| Submit feedback | `src/components/profile/FeedbackForm.tsx` | `handleSubmit` (line 80) | Envolver el cuerpo del `try` completo (`sendFeedback(...)`) con `withBusyFlag('feedback_submit', async () => { ... })`. El service `sendFeedback` queda intacto. |
| Upload foto de menú | `src/components/business/MenuPhotoUpload.tsx` | `handleSubmit` (line 38) | Envolver la llamada a `uploadMenuPhoto(...)` con `withBusyFlag('menu_photo_upload', async (heartbeat) => { ... })`. Llamar `heartbeat()` dentro del callback `setProgress` (la prop `onProgress` del service se invoca en cada `state_changed`; interceptamos eso en el componente sin tocar el service). |
| Crear lista (perfil) | `src/components/lists/CreateListDialog.tsx` | `handleCreate` (line 39) | Envolver `await createList(user.uid, name, desc, selectedIcon)` con `withBusyFlag('list_create', ...)`. No pasa por `withOfflineSupport` en este componente (fallback offline se evalúa en otra ruta). |
| Crear lista (add-to-list) | `src/components/business/AddToListDialog.tsx` | `handleCreate` (line 110) | Envolver `createList` + `addBusinessToList` subsiguientes con `withBusyFlag('list_create', ...)`. |
| Renombrar/editar lista (color/icon/nombre) | `src/components/lists/ListDetailScreen.tsx` | `handleColorChange` (line 74), `handleIconChange` (line 138) | **Scope-out** — son toggles optimistas rápidos (cambiar color o icono); no cualifican como submit explícito. `deleteList` tampoco entra (toggle binario con confirmación pero reversible en <1s server-side). Decisión autónoma: evita ruido. |
| Submit reseña (rating) | `src/hooks/useBusinessRating.ts` | `handleRate` (line 94) | Envolver el bloque `await withOfflineSupport(..., () => upsertRating(...))` (line 98) con `withBusyFlag('rating_submit', ...)`. Envolvemos **la llamada a `withOfflineSupport`** — si estamos online, ejecuta el service (flag activo durante el write); si estamos offline, encola (flag activo durante la escritura a IndexedDB, que es <50ms → flag se limpia casi inmediato, sin falsos positivos). |
| Submit criterio de reseña | `src/hooks/useBusinessRating.ts` | `handleCriterionRate` (line 139) | Envolver `upsertCriteriaRating` con `withBusyFlag('rating_submit', ...)`. Este no pasa por `withOfflineSupport` (solo online); wrap directo en el handler. |
| Submit comentario/pregunta | `src/components/business/BusinessComments.tsx` | `handleSubmit` del form de nuevo comentario | Envolver el bloque `await withOfflineSupport(..., () => addComment(...))` con `withBusyFlag('comment_submit', ...)`. |
| Submit reply | `src/hooks/useCommentListBase.ts` | `handleSubmitReply` (line 141) | Envolver el bloque `await withOfflineSupport(..., () => addComment(...))` con `withBusyFlag('comment_submit', ...)`. |
| Change password | `src/components/auth/ChangePasswordDialog.tsx` | `handleSubmit` (line 55) | Envolver `await changePassword(currentPassword, newPassword)` con `withBusyFlag('password_change', ...)`. El service `changePassword` queda intacto. |
| Editar displayName | `src/components/profile/EditDisplayNameDialog.tsx` | `handleSave` (ver archivo; llama `setDisplayName` de `AuthContext`) | Envolver `await setDisplayName(trimmed)` con `withBusyFlag('profile_save', ...)`. El wrap va en el componente, NO en `AuthContext.setDisplayName` (ese context method también se llama desde `EmailPasswordDialog.onSubmit` — ambos submits son explícitos, ambos se envuelven). |
| Submit displayName en onboarding email | `src/components/auth/EmailPasswordDialog.tsx` | `handleSubmit` (line 94: `await setDisplayName(name.trim())` y write anterior) | Envolver el bloque submit completo con `withBusyFlag('profile_save', ...)`. |
| Submit displayName en NameDialog | `src/components/auth/NameDialog.tsx` | `handleSubmit` (line 31) | Envolver `await setDisplayName(name.trim())` con `withBusyFlag('profile_save', ...)`. |

**No entran a `withBusyFlag` (decisión explícita y documentada):**

| Callsite | Razón |
|---|---|
| `ProfileScreen.setAvatarId` (line 136) | Tap directo en avatar picker → toggle optimista, no submit con botón. |
| `useUserSettings.*` (todos los toggles) | Writes fire-and-forget de preferences; prender flag constantemente sería ruido. |
| `useFollowedTags.toggleFollow` (líneas 75, 97) | Toggle optimista. |
| `useInterestsFeed.markSeen` (line 46) | Tracking silencioso. |
| `useFollow.toggleFollow` | Toggle rápido. |
| `useCheckIn.*` | Ver abajo: se evalúa. Checkin es submit explícito → **SÍ** entra (`useCheckIn.ts:98` y `:125`, envolver los dos `withOfflineSupport`). |
| `sharedLists.toggleListPublic` | Toggle binario <1s (aunque tiene confirmación UI, el revert es instantáneo). |
| `sharedLists.deleteList` | Destructivo pero <1s; plan expone riesgo en "Riesgos" si usuario hace hard-refresh justo en el delete: el optimistic UI ya eliminó y el server drops → idempotente. |
| `sharedLists.removeBusinessFromList` | Toggle. |
| `sharedLists.inviteEditor` / `removeEditor` | Se evalúa como submit explícito; entran. Ver fila nueva abajo. |
| `comment_like` / `comment_unlike` | Toggles en `useCommentListBase.handleToggleLike` (line 83). |

**Ajuste — también entran (submits explícitos con confirmación UI):**

| Submit explícito | Archivo | Símbolo real | Cambio |
|---|---|---|---|
| Check-in manual | `src/hooks/useCheckIn.ts` | líneas 98 y 125 (ambos `withOfflineSupport`) | Envolver cada bloque con `withBusyFlag('checkin_submit', ...)`. |
| Invitar editor a lista | `src/services/sharedLists.ts` (`inviteEditor`) invocado desde `ListEditorsDialog` (ver archivo) | handler de "Invitar" en el dialog | Envolver en el componente que invoca `inviteEditor` (no en el service). |
| Remover editor de lista | idem `removeEditor` | handler de "Quitar editor" | Envolver en el componente. |

**Verificación de nombres reales — actualización del BLOQUEANTE #3:**

El specs original citaba `createSharedList`, `updateSharedList`, `addItemToList`. Los nombres reales en `src/services/sharedLists.ts` (verificado con grep) son:
- `createList` (línea 35)
- `updateList` (línea 75)
- `addBusinessToList` (línea 105)
- `toggleListPublic` (línea 68), `deleteList` (línea 86), `removeBusinessFromList` (línea 120), `inviteEditor` (línea 154), `removeEditor` (línea 162).

Los callsites en la tabla arriba ya usan los nombres reales.

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

### Gate: `registerPwa()` no puede deployarse sin invocar en `main.tsx`

**Problema:** con `registerType: 'prompt'`, el SW no se registra automáticamente. Si en un refactor futuro alguien elimina o comenta `registerPwa()` en `main.tsx`, perdemos el fallback pasivo silenciosamente (el hook de force-update sigue funcionando, pero el fallback queda muerto).

**Mitigación — Opción A elegida (test unitario de `main.tsx`):**

Crear `src/__tests__/main.test.ts` (o `src/main.test.ts`) que:
1. Mockea `virtual:pwa-register` y el default export de `App`.
2. Spy sobre el módulo `./pwa/registerPwa` con `vi.mock('./pwa/registerPwa', () => ({ registerPwa: vi.fn() }))`.
3. Importa `./main` (se ejecuta el side-effect de bootstrap).
4. Verifica que `registerPwa` fue invocado exactamente 1 vez.

**Por qué Opción A:** es la más idiomática con Vitest + jsdom (ya en el stack). Opción B (grep sobre `dist/`) requiere infraestructura de CI adicional. Opción C (pre-commit hook) es frágil (usuarios pueden pasar `--no-verify`).

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

**Nota crítica de capa**: las modificaciones a continuación son **en componentes y hooks** (callsites de submit explícito), **NO en services**. Services quedan intactos. Razón: `withBusyFlag` en capa de service prendería el flag durante `syncEngine.processQueue` drain (auto-sync), violando decisión v1 del PRD.

| Archivo | Cambio |
|---|---|
| `src/services/config.ts` | `fetchAppVersionConfig` usa `getDocFromServer` con retries (500ms + 1500ms) + fallback a `getDoc`; retorna `source` en el resultado; extiende `AppVersionConfig` con `updatedAt?: Timestamp` y `source` |
| `src/hooks/useForceUpdate.ts` | Agregar listeners `visibilitychange`/`online`; escribir `STORAGE_KEY_FORCE_UPDATE_LAST_CHECK` por tick; chequear `isBusyFlagActive()`; emitir `EVT_APP_VERSION_ACTIVE` una vez por sesion **condicionado a `source ∈ { 'server', 'server-retry', 'empty' }` y `status ≠ 'error'`** |
| `src/utils/busyFlag.ts` | **Nuevo** — helper `withBusyFlag` + `isBusyFlagActive` con refcount, heartbeat visibility-aware, AbortSignal-safe |
| `src/pwa/registerPwa.ts` | **Nuevo** — fallback pasivo que respeta cooldown/busy-flag/hook-grace |
| `src/main.tsx` | Invocar `registerPwa()` despues de `initSentry()` |
| `src/main.test.ts` | **Nuevo** — gate test que verifica `registerPwa()` se invoca en bootstrap |
| `vite.config.ts` | `registerType: 'prompt'` |
| `src/constants/timing.ts` | Agregar `PWA_FALLBACK_GRACE_MS`, `BUSY_FLAG_MAX_AGE_MS` (180s), `BUSY_FLAG_HEARTBEAT_MS` |
| `src/constants/storage.ts` | Agregar 3 claves nuevas |
| `src/constants/analyticsEvents/system.ts` | Agregar `EVT_APP_VERSION_ACTIVE` |
| `src/hooks/useBusinessRating.ts` | Envolver `handleRate` y `handleCriterionRate` con `withBusyFlag('rating_submit', ...)` (capa hook, NO service) |
| `src/hooks/useCommentListBase.ts` | Envolver `handleSubmitReply` con `withBusyFlag('comment_submit', ...)` |
| `src/hooks/useCheckIn.ts` | Envolver ambos `withOfflineSupport` con `withBusyFlag('checkin_submit', ...)` |
| `src/components/business/BusinessComments.tsx` | Envolver el submit de nuevo comentario con `withBusyFlag('comment_submit', ...)` |
| `src/components/business/MenuPhotoUpload.tsx` | Envolver `handleSubmit` con `withBusyFlag('menu_photo_upload', async (heartbeat) => { ... })`; wirear `heartbeat()` al callback `onProgress` |
| `src/components/profile/FeedbackForm.tsx` | Envolver `handleSubmit` con `withBusyFlag('feedback_submit', ...)` |
| `src/components/lists/CreateListDialog.tsx` | Envolver `handleCreate` con `withBusyFlag('list_create', ...)` |
| `src/components/business/AddToListDialog.tsx` | Envolver `handleCreate` con `withBusyFlag('list_create', ...)` |
| `src/components/auth/ChangePasswordDialog.tsx` | Envolver `handleSubmit` con `withBusyFlag('password_change', ...)` |
| `src/components/auth/NameDialog.tsx` | Envolver `handleSubmit` con `withBusyFlag('profile_save', ...)` |
| `src/components/auth/EmailPasswordDialog.tsx` | Envolver `handleSubmit` con `withBusyFlag('profile_save', ...)` |
| `src/components/profile/EditDisplayNameDialog.tsx` | Envolver `handleSave` con `withBusyFlag('profile_save', ...)` |
| `src/services/syncEngine.ts` | **No se modifica** — `processQueue` y `executeAction` NO deben invocar `withBusyFlag` ni indirectamente. Plan verifica vía test/grep. |
| `.github/workflows/deploy.yml` | Quitar check condicional de `update-min-version.js` |
| `src/components/admin/features/ga4FeatureDefinitions.ts` | Agregar `app_version_active` a `eventNames` del feature `force_update` (grupo `system`) |
| `src/components/admin/features/__tests__/ga4FeatureDefinitions.test.ts` | Agregar assert: `force_update.eventNames.includes('app_version_active')` |
| `functions/src/admin/analyticsReport.ts` | Agregar `'app_version_active'` al array `GA4_EVENT_NAMES` (seccion System, agrupado con force-update) |
| `scripts/update-min-version.js` | Refactor mínimo a funciones inyectables (ver sección Tests); agregar parseo del flag `--set=X.Y.Z` |
| `scripts/update-min-version.test.js` | **Nuevo** — tests del script (package.json read, write a Firestore, flag --set, exit code) |
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
| `src/services/config.test.ts` (modificar) | `fetchAppVersionConfig` — happy path con `getDocFromServer` resuelto (`source: 'server'`); resuelve en intento 2 tras `unavailable` (`source: 'server-retry'`, verifica backoff 500ms); fallback a `getDoc` (`source: 'cache'`) tras 3 fallos retryables; error no-retryable salta directo a cache; doc no existe → `{ minVersion: undefined, source: 'empty' }`; cache también falla → re-throw | Service |
| `src/hooks/useForceUpdate.test.ts` (modificar) | Escribe `STORAGE_KEY_FORCE_UPDATE_LAST_CHECK` al final de cada check (incluso en `error`); listener `visibilitychange` dispara `run()` cuando state es `'visible'`; NO dispara cuando `'hidden'`; listener `online` dispara `run()`; `EVT_APP_VERSION_ACTIVE` se emite solo con `source ∈ { 'server', 'server-retry', 'empty' }` y status ∈ `{ 'up-to-date', 'reloading', 'limit-reached' }`; NO se emite en `status: 'error'` ni en `source: 'cache'`; flag `STORAGE_KEY_APP_VERSION_EVENT_EMITTED` se setea solo tras emisión exitosa (si no emitió, el próximo tick puede emitir); con `isBusyFlagActive() === true` NO recarga aunque haya gap | Hook |
| `src/utils/busyFlag.test.ts` (nuevo) | `withBusyFlag` prende flag, lo limpia en success; en fail (promesa rechazada) también limpia (finally); `withBusyFlag` con promesa que rechaza por `AbortError` también libera (refcount decrementa); `isBusyFlagActive` retorna `true` con flag fresco; `false` con flag >3 min (stale); `false` sin flag; `false` con `count === 0`; heartbeat refresca `startedAt` cuando `document.visibilityState === 'visible'`; heartbeat es no-op cuando `visibilityState === 'hidden'`; refcount: dos `withBusyFlag` concurrentes mantienen flag hasta que ambas resuelven; JSON malformado en sessionStorage retorna `false` sin crashear | Utility |
| `src/pwa/registerPwa.test.ts` (nuevo) | `registerSW` registrado con `immediate: true`; `onNeedRefresh` respeta cooldown (no llama `updateSW(true)` si `<5 min`); respeta busy-flag (no llama si activo); respeta hook-grace (no llama si `lastCheck <60 min`); llama `updateSW(true)` y escribe `STORAGE_KEY_FORCE_UPDATE_LAST_REFRESH` cuando las tres condiciones se cumplen; en DEV retorna sin registrar | Module |
| `src/main.test.ts` (nuevo) | **Gate de `registerPwa`**: al importar `src/main.tsx`, `registerPwa()` se invoca exactamente 1 vez. Previene regresión de IMPORTANTE #9 (se deploya `registerType: 'prompt'` sin registrar SW). | Bootstrap |
| `scripts/update-min-version.test.js` (nuevo) | (a) Lee `version` de `package.json` correctamente; (b) `db.doc('config/appVersion').set(...)` recibe `{ minVersion, updatedAt: FieldValue.serverTimestamp() }`; (c) exit code `≠0` si el write rechaza; (d) path del flag `--set=2.36.5` override `pkg.version`; (e) flag con valor inválido (`--set=bad`) emite error y sale con código 1. **Runner**: Vitest (el `exclude` actual de `vitest.config.ts` ya cubre `scripts/` con `.test.js` por defecto de Vitest — no requiere cambio de config, solo omitir `scripts/` del `exclude` si está ahí; actualmente NO está excluido). **Precondición**: refactor del script — ver abajo. | Script |
| `src/components/admin/features/__tests__/ga4FeatureDefinitions.test.ts` (modificar) | Agregar assert explícito: `const forceUpdate = GA4_FEATURE_CATEGORIES.find((c) => c.id === 'system').features.find((f) => f.key === 'force_update'); expect(forceUpdate.eventNames).toContain('app_version_active')`. Esto previene regresión del registro. | Admin |
| `src/hooks/useBusinessRating.test.ts` (modificar) | `handleRate` y `handleCriterionRate` invocan `withBusyFlag` con `kind: 'rating_submit'` antes de `withOfflineSupport` / service. Spy sobre el helper. | Hook |
| `src/hooks/__tests__/useCommentListBase.test.ts` (modificar) | `handleSubmitReply` invoca `withBusyFlag` con `kind: 'comment_submit'`. | Hook |
| `src/hooks/useCheckIn.test.ts` (modificar) | Ambos callsites de `withOfflineSupport` (create + delete) están envueltos por `withBusyFlag('checkin_submit', ...)`. | Hook |
| `src/components/profile/FeedbackForm.test.tsx` (modificar si existe; crear si no) | `handleSubmit` envuelve el `sendFeedback` con `withBusyFlag('feedback_submit', ...)`. El service `sendFeedback` NO se modifica. | Component |
| `src/components/business/MenuPhotoUpload.test.tsx` (modificar si existe; crear si no) | `handleSubmit` envuelve la llamada a `uploadMenuPhoto` con `withBusyFlag('menu_photo_upload', ...)`; verifica que el callback `onProgress` internamente dispara el `heartbeat()` del wrapper (spy sobre busyFlag para confirmar `_writeBusyFlag` refrescó `startedAt`). | Component |
| `src/components/lists/CreateListDialog.test.tsx` (modificar si existe; crear si no) | `handleCreate` envuelve `createList` con `withBusyFlag('list_create', ...)`. | Component |
| `src/components/business/AddToListDialog.test.tsx` (modificar si existe; crear si no) | `handleCreate` envuelve el bloque `createList + addBusinessToList` con `withBusyFlag('list_create', ...)`. | Component |
| `src/components/auth/ChangePasswordDialog.test.tsx` (modificar) | `handleSubmit` envuelve `changePassword` con `withBusyFlag('password_change', ...)`. | Component |
| `src/components/auth/NameDialog.test.tsx` (modificar si existe; crear si no) | `handleSubmit` envuelve `setDisplayName` con `withBusyFlag('profile_save', ...)`. | Component |

**Precondición para `scripts/update-min-version.test.js`** — refactor mínimo del script:

El script actual (`scripts/update-min-version.js`) ejecuta `initializeApp({ credential: applicationDefault() })` y `await db.doc(...).set(...)` en top-level module, lo cual es inobservable y no-testeable. Se refactoriza a:

```js
#!/usr/bin/env node
import { initializeApp, applicationDefault, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';

/** @internal Inyectable para tests. Default: lee package.json del cwd. */
export function readPackageVersion(path = './package.json') {
  const pkg = JSON.parse(readFileSync(path, 'utf-8'));
  return pkg.version;
}

/** @internal Inyectable para tests. Default: initializeApp + getFirestore. */
export function getDb() {
  if (!getApps().length) initializeApp({ credential: applicationDefault() });
  return getFirestore();
}

/** @internal Parseo del flag --set=X.Y.Z */
export function resolveVersion(argv, pkgVersion) {
  const setArg = argv.find((a) => a.startsWith('--set='));
  const version = setArg ? setArg.split('=')[1] : pkgVersion;
  if (!version || !/^\d+\.\d+\.\d+$/.test(version)) {
    throw new Error(`Invalid version: ${version}`);
  }
  return version;
}

export async function run({ db, version } = {}) {
  const resolvedDb = db ?? getDb();
  const resolvedVersion = version ?? resolveVersion(process.argv.slice(2), readPackageVersion());
  await resolvedDb.doc('config/appVersion').set({
    minVersion: resolvedVersion,
    updatedAt: FieldValue.serverTimestamp(),
  });
  return resolvedVersion;
}

// Solo ejecuta si se invoca directo (no cuando se importa desde tests).
if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    const v = await run();
    console.log(`✓ config/appVersion.minVersion updated to ${v}`);
  } catch (e) {
    console.error(e.message ?? e);
    process.exit(1);
  }
}
```

El test mockea `firebase-admin/app` y `firebase-admin/firestore` con `vi.mock`, o inyecta un mock `db` directamente a `run({ db: mockDb, version: '2.36.5' })` — la inyección es el path preferido (no requiere `vi.mock` de módulos ESM, que en Vitest con ESM puro a veces es frágil).

**Mock strategy:**
- `vi.mock('virtual:pwa-register', () => ({ registerSW: vi.fn(() => vi.fn()) }))` para `registerPwa.test.ts`.
- `vi.mock('../utils/busyFlag', () => ({ withBusyFlag: vi.fn((_, fn) => fn(() => {})), isBusyFlagActive: vi.fn(() => false) }))` en los tests de hooks/components para spy en `withBusyFlag`.
- `vi.useFakeTimers()` + `vi.setSystemTime()` para tests de staleness y grace.
- `sessionStorage.clear()` y `localStorage.clear()` en `beforeEach` de `useForceUpdate.test.ts` y `busyFlag.test.ts`.
- Para `scripts/update-min-version.test.js`: inyectar `db` mock directo a `run(...)`; no usar `vi.mock` de `firebase-admin`.
- Para `main.test.ts`: `vi.mock('./pwa/registerPwa', () => ({ registerPwa: vi.fn() }))` + `vi.mock('./config/sentry', ...)` + `vi.mock('react-dom/client', ...)` para evitar el DOM render.

**Cobertura esperada:**
- `src/utils/busyFlag.ts` — 100% (todo el codigo es testeable, sin dependencias externas).
- `src/pwa/registerPwa.ts` — >=90% (el path de DEV es un short-circuit dificil de medir con coverage en el mismo run).
- `src/hooks/useForceUpdate.ts` — mantener o superar la cobertura actual (100% statements/branches, 91% functions segun `tests.md`).
- `src/services/config.ts` — 100% (seis paths: server OK, server-retry OK en intento 2, cache OK tras 3 fallos, error no-retryable → cache directo, doc no existe, cache también falla).
- `scripts/update-min-version.js` — >=90% (un path happy, dos error paths).

---

## Analytics

### Evento nuevo: `app_version_active`

**Payload:**
```ts
{
  version: string;         // __APP_VERSION__ del build activo
  minVersionSeen: string;  // lo que devolvio Firestore (string vacio si undefined)
  gap: boolean;            // isUpdateRequired(minVersionSeen, version)
  source: 'server' | 'server-retry' | 'empty'; // excluye 'cache' y 'unknown'/'error'
}
```

**Disparo:** una sola vez por sesion (tab load), **solo si** el check fue exitoso contra el servidor (`source ∈ { 'server', 'server-retry', 'empty' }`) **y** el status es ∈ `{ 'up-to-date', 'reloading', 'limit-reached' }`. Si el fetch cae al cache (`source: 'cache'`) o falla completamente (`status: 'error'`), **no se emite** y el one-shot guard sigue disponible para un próximo intento exitoso.

Flag guard: `sessionStorage[STORAGE_KEY_APP_VERSION_EVENT_EMITTED] = '1'` se escribe **después** de emitir exitosamente; no se setea en paths no-emisión.

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

2. **`functions/src/admin/analyticsReport.ts` línea 127-130** — agregar `'app_version_active'` al array `GA4_EVENT_NAMES` en la sección `// System`, **agrupado inmediatamente después de los dos eventos existentes de force-update** (criterio de orden: agrupar por sub-dominio dentro de la sección; los tres eventos de `force_update` van juntos, después vienen los de otras features de system):

   ```ts
   // System
   'force_update_triggered',
   'force_update_limit_reached',
   'app_version_active',  // nuevo — agrupado con los otros dos de force-update
   'account_deleted',
   'perf_vitals_captured',
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
| Busy-flag pegado (denial of service local contra force-update) | `BUSY_FLAG_MAX_AGE_MS = 3 min` caduca el flag; heartbeat NO se ejecuta si `document.visibilityState !== 'visible'` (tabs ocultos o crasheados no extienden el flag); refcount garantiza que múltiples operaciones concurrentes no bloquean indefinidamente (todas tienen que resolver/rechazar) | `src/utils/busyFlag.ts` |
| Metric spam v2 (`app_version_active` emitido desde cache) | Emisión condicionada a `source ∈ { 'server', 'server-retry', 'empty' }`; `source: 'cache'` NO emite, evitando falsos positivos de adopción | `src/hooks/useForceUpdate.ts`, `src/services/config.ts` |
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

---

## Validacion Tecnica — Diego

**Estado:** VALIDADO
**Revisor:** Diego (Solution Architect)
**Fecha:** 2026-04-22
**Ciclos:** 2

### Hallazgos cerrados

**Ciclo 1 (13 hallazgos):**

- **BLOQ #1** — `withBusyFlag` en callsite, no en service. Regla dura + tabla de callsites verificados con grep (sección "Sitios de uso", Integración).
- **BLOQ #2** — `updateUserSettings` excluido como service-wide; sólo submits explícitos entran. Lista exclusiones/inclusiones explícita.
- **BLOQ #3** — Nombres reales de `sharedLists` (`createList`, `updateList`, `addBusinessToList`, `toggleListPublic`, `deleteList`, `removeBusinessFromList`, `inviteEditor`, `removeEditor`) verificados con grep y aplicados a la tabla.
- **IMP #4** — Coherencia 90s→180s documentada; test del PRD refleja el nuevo umbral.
- **IMP #5** — `scripts/update-min-version.test.js` declarado con runner Vitest, 5 casos, mock strategy por inyección, refactor precondición incluido.
- **IMP #6** — `updatedAt?: Timestamp` agregado a `AppVersionConfig` con JSDoc y backwards-compat.
- **IMP #7** — Retry pattern (1 intento + 2 retries, backoff 500/1500ms) para `unavailable`/`deadline-exceeded` en `fetchAppVersionConfig`.
- **IMP #8** — `EVT_APP_VERSION_ACTIVE` emite solo con `source ∈ { 'server', 'server-retry', 'empty' }` y status `≠ 'error'`; nunca `'cache'` ni `'unknown'`.
- **IMP #9** — Gate `registerPwa` implementado como test unitario de `main.tsx` (opción A, justificada sobre B/C).
- **IMP #10** — `busyFlag` con refcount (concurrency), heartbeat visibility-aware, y libera vía `finally` ante `AbortError`.
- **OBS #11** — Rule citada textualmente (bloque `match /config/appVersion`) en la tabla de rules impact analysis.
- **OBS #12** — Orden explícito de `GA4_EVENT_NAMES`: agrupado por sub-dominio en la sección System.
- **OBS #13** — `ga4FeatureDefinitions.test.ts` listado en Integración y Tests con assert concreto.

### Observaciones abiertas para Pablo / plan

- El dialog citado "ListEditorsDialog" en sección de sitios de uso es en realidad `src/components/lists/InviteEditorDialog.tsx` (handler `handleInvite` en `:33`). Plan debe usar ese path.
- `EmailPasswordDialog.handleSubmit` está en `:137` (no `:94`); la línea 94 es el `await setDisplayName`. El wrap va alrededor del cuerpo del `handleSubmit` en `:137`.
- Varios tests de componentes (FeedbackForm, MenuPhotoUpload, CreateListDialog, AddToListDialog, NameDialog, EditDisplayNameDialog) y el test `useBusinessRating.test.ts` no existen hoy. El specs dice "modificar si existe; crear si no": plan debe dimensionar el costo de crear estos tests mínimos (mount + spy sobre `withBusyFlag`) y confirmar que la política acepta cobertura parcial.
- `BUSY_FLAG_MAX_AGE_MS` desvía del PRD de 90s a 180s dentro del rango 90-300s delegado por Sofía; es una decisión autónoma del specs documentada en la nota de coherencia. Plan debe reflejarlo en tests y en cualquier referencia cruzada.
- `registerType: 'prompt'` cambia el lifecycle del SW; el primer deploy post-merge tiene comportamiento transicional. Plan debería incluir smoke test manual de SW post-deploy.
- `uploadMenuPhoto` expone `onProgress` (verificado en `menuPhotos.test.ts`); la intercepción del componente para llamar `heartbeat()` es viable sin tocar el service.
- `scripts/` no está excluido en `vitest.config.ts`; `update-min-version.test.js` será captado por el include implícito sin cambios de config.
- Las 3 observaciones abiertas de Sofía (uploads >90s con heartbeat, hotfix vs ventana 3-releases, rollback.md como gate de merge) siguen abiertas como "no-blockers" — plan las hereda.

### Listo para specs-plan-writer / plan

**Sí.** No quedan hallazgos bloqueantes ni ambigüedades técnicas. Observaciones arriba son heredadas al plan (Pablo) como decisiones de implementación, no huecos del specs.
