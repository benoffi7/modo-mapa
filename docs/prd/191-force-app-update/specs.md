# Specs: Force App Update

**PRD:** [191-force-app-update.md](191-force-app-update.md)
**Fecha:** 2026-03-26

---

## Modelo de datos

### Documento `config/appVersion`

```typescript
// src/types/appVersion.ts
export interface AppVersionConfig {
  minVersion: string;   // semver string, e.g. "2.31.0"
  updatedAt: Date;      // timestamp del ultimo deploy que actualizo minVersion
}
```

**Coleccion:** `config` (existente, doc ID `appVersion`)
**Indices:** Ninguno nuevo (single doc read by ID).

---

## Firestore Rules

La coleccion `config` actualmente tiene una regla wildcard que solo permite lectura a admin:

```
match /config/{document=**} {
  allow read: if isAdmin();
  allow write: if false;
}
```

Se necesita una regla especifica para `config/appVersion` que permita lectura publica (incluso sin auth), porque:

- Usuarios no autenticados (anonimos pre-sign-in) tambien necesitan actualizarse
- El dato no es sensible (solo un string de version)
- La regla especifica tiene precedencia sobre la wildcard

**Nueva regla** (agregar ANTES de la wildcard `config/{document=**}`):

```
// App version — lectura publica para force-update check.
// Solo Admin SDK (CI/CD) puede escribir.
match /config/appVersion {
  allow read: if true;
  allow write: if false;
}
```

**Nota:** En Firestore rules, cuando un documento matchea multiples reglas, se permite el acceso si CUALQUIERA de las reglas lo permite. Sin embargo, la wildcard `{document=**}` y la regla especifica `appVersion` son paths distintos a nivel de match. La regla especifica `config/appVersion` matchea el doc exacto y lo permite con `read: if true`. La wildcard `config/{document=**}` tambien matchea, pero su `read: if isAdmin()` es mas restrictiva. Dado que Firestore evalua con OR entre reglas que matchean, la regla mas permisiva gana. Entonces la regla especifica con `allow read: if true` es suficiente.

### Rules impact analysis

| Query (archivo) | Coleccion | Auth context | Regla que lo permite | Cambio necesario? |
|-----------------|-----------|-------------|---------------------|-------------------|
| `getDoc(doc(db, 'config', 'appVersion'))` en `useForceUpdate` | `config` | Cualquiera (puede no estar autenticado) | `match /config/appVersion { allow read: if true }` | SI -- agregar regla nueva |

---

## Cloud Functions

No se necesitan Cloud Functions nuevas. La escritura del documento `config/appVersion` se hace desde el CI/CD usando `firebase-tools` directamente (Admin SDK via service account del workflow).

---

## CI/CD: Escritura de minVersion

### Script: `scripts/update-min-version.js`

Script Node.js que escribe `config/appVersion` en Firestore usando el Admin SDK.

```typescript
// scripts/update-min-version.js
// Ejecutado por CI despues del deploy de hosting.
// Usa GOOGLE_APPLICATION_CREDENTIALS del entorno (ya autenticado por google-github-actions/auth).
//
// Uso: node scripts/update-min-version.js
// Lee la version de package.json y la escribe como minVersion.

import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';

const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'));
const version = pkg.version;

initializeApp({ credential: applicationDefault() });
const db = getFirestore();

await db.doc('config/appVersion').set({
  minVersion: version,
  updatedAt: FieldValue.serverTimestamp(),
});

console.log(`Updated config/appVersion.minVersion to ${version}`);
```

**Parametros:** Ninguno (lee de `package.json`).
**Condicion de ejecucion:** Solo cuando hay cambios en `src/` o `functions/` (no en `docs/` only).

---

## Utilidad: compareSemver

### `src/utils/version.ts`

```typescript
/**
 * Compara dos strings semver (major.minor.patch).
 * Retorna:
 *   1  si a > b
 *  -1  si a < b
 *   0  si a == b
 *
 * No soporta pre-release tags (no los usamos).
 */
export function compareSemver(a: string, b: string): -1 | 0 | 1;

/**
 * Retorna true si `required` es mayor que `current`.
 */
export function isUpdateRequired(required: string, current: string): boolean;
```

Sin dependencias externas. Split por `.`, parseInt, compara major > minor > patch.

---

## Hooks

### `src/hooks/useForceUpdate.ts`

```typescript
/**
 * Lee config/appVersion de Firestore y fuerza hard refresh
 * si minVersion > __APP_VERSION__.
 *
 * - Al montar: lee el doc una vez.
 * - Cada 30 minutos: re-verifica.
 * - Rate limit: si ya se hizo un refresh forzado en esta sesion (sessionStorage),
 *   no reintentar por al menos 5 minutos (previene loop infinito por cache de CDN).
 * - Offline: silenciosamente no hace nada (fail-safe).
 * - Doc inexistente: no hace nada.
 */
export function useForceUpdate(): void;
```

**Parametros:** Ninguno.
**Return:** `void` (side-effect only hook).
**Dependencias:**

- `db` de `src/config/firebase.ts`
- `doc`, `getDoc` de `firebase/firestore`
- `COLLECTIONS` de `src/config/collections.ts`
- `compareSemver`, `isUpdateRequired` de `src/utils/version.ts`
- `logger` de `src/utils/logger.ts`
- `trackEvent` de `src/utils/analytics.ts`

**Logica interna:**

1. `useEffect` al montar: llama a `checkVersion()`
2. `setInterval(checkVersion, FORCE_UPDATE_CHECK_INTERVAL_MS)` con cleanup
3. `checkVersion()`:
   - `getDoc(doc(db, COLLECTIONS.CONFIG, 'appVersion'))` -- no usa `onSnapshot` para minimizar reads
   - Si doc no existe: return silencioso
   - Si `isUpdateRequired(minVersion, __APP_VERSION__)`:
     - Verificar `sessionStorage` key `force_update_last_refresh`
     - Si el timestamp existe y es menor a 5 minutos: log warning y return (previene loop)
     - Guardar timestamp actual en `sessionStorage`
     - `trackEvent(EVT_FORCE_UPDATE_TRIGGERED, { from: __APP_VERSION__, to: minVersion })`
     - Llamar a `performHardRefresh()`
4. `performHardRefresh()`:
   - Desregistrar todos los service workers: `navigator.serviceWorker.getRegistrations()` -> `reg.unregister()`
   - Limpiar caches del SW: `caches.keys()` -> `caches.delete()`
   - `window.location.reload()`

**Caching strategy:** Ninguna -- single `getDoc` cada 30 min. Firestore persistent cache en prod puede servir un read stale si el doc no cambio, pero eso es correcto (si no cambio, no hay update).

---

## Constantes

### `src/constants/timing.ts` (agregar)

```typescript
/** Interval between force-update version checks (30 minutes) */
export const FORCE_UPDATE_CHECK_INTERVAL_MS = 30 * 60 * 1000;

/** Minimum time between forced refreshes to prevent loops (5 minutes) */
export const FORCE_UPDATE_COOLDOWN_MS = 5 * 60 * 1000;
```

### `src/constants/storage.ts` (agregar)

```typescript
export const SESSION_KEY_FORCE_UPDATE_LAST_REFRESH = 'force_update_last_refresh';
```

### `src/constants/analyticsEvents.ts` (agregar)

```typescript
// Force update events (#191)
export const EVT_FORCE_UPDATE_TRIGGERED = 'force_update_triggered';
```

### `src/config/collections.ts`

No se necesita cambio. Ya existe `CONFIG: 'config'`. El doc ID `'appVersion'` se usa como string literal en el hook (patron consistente con otros docs de config como `'counters'`, `'moderation'`).

---

## Componentes

No se crean componentes nuevos. El snackbar mencionado en el PRD ("Actualizando a nueva version...") NO se implementa porque:

- El `window.location.reload()` ocurre inmediatamente despues de limpiar caches
- No hay tiempo garantizado para que el usuario vea un snackbar
- Agregar un delay artificial (setTimeout antes del reload) degradaria la experiencia
- El PRD lo marca como opcional

Si en el futuro se quiere agregar un snackbar pre-reload, se usaria `useToast().info()` con un `setTimeout(reload, 2000)`.

---

## Integracion

### `src/App.tsx`

Agregar `useForceUpdate()` dentro del componente `App`, junto a `useScreenTracking()`. El hook debe estar dentro del provider tree (necesita acceso a Firestore via `db` importado directamente, no via context), pero antes de las Routes.

```typescript
// En App():
useScreenTracking();
useForceUpdate();  // <-- agregar aqui
```

El hook se ejecuta en el nivel mas alto posible para cubrir todas las rutas (incluyendo `/admin`).

---

## Tests

| Archivo test | Que testear | Tipo |
|-------------|-------------|------|
| `src/utils/version.test.ts` | `compareSemver`: iguales, mayor major/minor/patch, menor, edge cases (0.x) | Unit |
| `src/utils/version.test.ts` | `isUpdateRequired`: wrapper booleano correcto | Unit |
| `src/hooks/useForceUpdate.test.ts` | Llama reload cuando server > client | Hook |
| `src/hooks/useForceUpdate.test.ts` | NO recarga cuando server == client | Hook |
| `src/hooks/useForceUpdate.test.ts` | NO recarga cuando server < client | Hook |
| `src/hooks/useForceUpdate.test.ts` | Maneja doc inexistente sin error | Hook |
| `src/hooks/useForceUpdate.test.ts` | Maneja error de Firestore (offline) sin crash | Hook |
| `src/hooks/useForceUpdate.test.ts` | Respeta cooldown de sessionStorage | Hook |
| `src/hooks/useForceUpdate.test.ts` | setInterval se registra y limpia correctamente | Hook |

### Mock strategy

```typescript
// version.test.ts -- no mocks, pure function

// useForceUpdate.test.ts
vi.mock('../config/firebase', () => ({ db: {} }));
vi.mock('firebase/firestore', () => ({
  doc: vi.fn(),
  getDoc: vi.fn(),
}));
vi.mock('../utils/version', () => ({
  isUpdateRequired: vi.fn(),
}));
vi.mock('../utils/analytics', () => ({ trackEvent: vi.fn() }));
vi.mock('../utils/logger', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), log: vi.fn() },
}));

// Mock de navigator.serviceWorker y caches
const mockUnregister = vi.fn().mockResolvedValue(true);
vi.stubGlobal('navigator', {
  serviceWorker: {
    getRegistrations: vi.fn().mockResolvedValue([{ unregister: mockUnregister }]),
  },
});
vi.stubGlobal('caches', {
  keys: vi.fn().mockResolvedValue(['cache-1']),
  delete: vi.fn().mockResolvedValue(true),
});

// Mock window.location.reload
const mockReload = vi.fn();
Object.defineProperty(window, 'location', {
  value: { reload: mockReload },
  writable: true,
});
```

---

## Analytics

| Evento | Parametros | Cuando |
|--------|-----------|--------|
| `EVT_FORCE_UPDATE_TRIGGERED` | `{ from: string, to: string }` | Justo antes de ejecutar hard refresh |

---

## Offline

### Cache strategy

| Dato | Estrategia | TTL | Storage |
|------|-----------|-----|---------|
| `config/appVersion` | Firestore persistent cache (prod) | N/A (single getDoc, Firestore maneja staleness) | IndexedDB (Firestore SDK) |
| Cooldown de refresh | sessionStorage timestamp | 5 min | sessionStorage |

### Writes offline

No hay writes del cliente. La escritura del doc es del CI/CD (Admin SDK).

### Fallback UI

No se necesita. Si el usuario esta offline, el `getDoc` falla silenciosamente (o retorna datos cacheados). El hook hace `catch` y loguea con `logger.warn`. No hay UI degradada -- la app funciona normalmente sin el check.

---

## Decisiones tecnicas

### 1. `getDoc` vs `onSnapshot`

**Elegido:** `getDoc` con polling cada 30 minutos.
**Alternativa:** `onSnapshot` (real-time listener).
**Razon:** Un listener real-time es innecesario para un doc que cambia una vez por deploy (max 1-2 veces al dia). `getDoc` es mas simple, no mantiene una conexion WebSocket abierta, y el costo es identico (1 read por poll). El polling de 30 min es suficiente para que un update se propague en maximo 30 min.

### 2. sessionStorage para cooldown (no localStorage)

**Elegido:** `sessionStorage` con key `force_update_last_refresh`.
**Razon:** sessionStorage se limpia al cerrar la pestana. Si el usuario cierra y reabre, se permite un nuevo intento inmediato. localStorage persistiria el cooldown entre sesiones, lo cual podria impedir un refresh necesario. El riesgo de loop infinito solo existe dentro de una misma sesion (cache de CDN serviendo assets viejos).

### 3. Regla `allow read: if true` (sin auth)

**Elegido:** Lectura publica sin autenticacion.
**Alternativa:** `allow read: if request.auth != null`.
**Razon:** La app crea usuarios anonimos automaticamente, pero hay un momento entre el load de la pagina y la creacion del usuario anonimo donde `auth` es null. El check de version debe funcionar antes de que auth se inicialice. El dato (un string de version) no tiene riesgo de privacidad.

### 4. Script CI separado (no Cloud Function)

**Elegido:** Script Node.js (`scripts/update-min-version.js`) ejecutado en el workflow.
**Alternativa:** Cloud Function triggered por deploy.
**Razon:** No existe un trigger de Firebase para "hosting deployed". Un script en CI es mas simple, determinista, y usa el service account ya autenticado. Ademas, permite controlar condicionalmente si se escribe minVersion (solo cuando cambian `src/` o `functions/`).

### 5. Condicion de ejecucion en CI

El step de CI que escribe `minVersion` se ejecuta condicionalmente. Se usa `git diff` para verificar si los cambios del merge incluyen archivos en `src/` o `functions/`. Si solo cambiaron archivos en `docs/`, no se actualiza `minVersion`. Esto evita forzar updates innecesarios.
