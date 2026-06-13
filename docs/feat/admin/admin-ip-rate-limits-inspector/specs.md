# Specs: Inspector admin de `_ipRateLimits` + cierre del tipo `ip_rate_limit` muerto

**PRD:** [prd.md](prd.md)
**Fecha:** 2026-06-10

---

## Resumen de decisiones adoptadas (Sofia, VALIDADO CON OBSERVACIONES)

- **S2 (reset por IP): IN-SCOPE.** Simetría con `adminResetRateLimit`. El bloqueo por IP es diario (`date == hoy`) y se auto-resetea a medianoche UTC; el reset manual desbloquea antes (NAT corporativo, oficina compartida, incidente).
- **S4: OPCIÓN A (emitir `ip_rate_limit`).** En `authBlocking.ts`, el bloqueo por IP (`exceeded == true`) cambia el `type` del `abuseLog` de `anon_flood` a `ip_rate_limit`, conservando el `severity: 'high'` explícito del entry actual (override deliberado del `SEVERITY_MAP.ip_rate_limit = 'medium'`: "IP bloqueada" es más severo que "umbral detectado"). El umbral de flood (`currentCount >= ANON_FLOOD_ALERT_THRESHOLD`, bloque líneas 49-56) NO cambia: sigue emitiendo `anon_flood` con su `severity: 'medium'` explícito actual. Así el tipo deja de ser código muerto **sin tocar** `abuseLogger.ts`/`alertsHelpers.ts`/`types/admin.ts`/`constants/admin.ts` (el tipo `ip_rate_limit` ya está definido en los 4: `abuseLogger.ts:6`+`SEVERITY_MAP:18`, `alertsHelpers.ts:17`+`ALL_TYPES:39`, `types/admin.ts:59`, `constants/admin.ts:45`+`:56`), evitando la superficie de la Opción B.
- **Ruta real:** `AbuseAlerts.tsx` está en `src/components/admin/` (NO en `alerts/`). El nuevo `IpRateLimitsSection.tsx` SÍ va en `src/components/admin/alerts/`.
- **Subtab union type:** se toca en 2 lugares de `AbuseAlerts.tsx` (declaración del `useState` línea 32 y el `onChange` del `<Tabs>` línea 174). Se agrega `'ipRateLimits'`.
- **Sin índice compuesto:** replicar el patrón de `adminListRateLimits` (saltar `orderBy` cuando hay filtro).

---

## Modelo de datos

### Colección existente (NO se modifica): `_ipRateLimits`

Escrita exclusivamente por `functions/src/utils/ipRateLimiter.ts` vía Admin SDK. Sin acceso de cliente (rules `allow read, write: if false`).

- **Doc ID:** `{ipHash}_{action}_{date}` — ej. `a1b2c3d4e5f60718_anon_create_2026-06-10`.
- **Campos:** `{ ipHash: string (16 hex), action: string, date: string 'YYYY-MM-DD', count: number, createdAt: Timestamp }`.
- **Ventana:** diaria por `date`. NO existe campo `resetAt`. El item derivado calcula `windowActive = (date === hoyUTC)`.
- **Privacidad:** solo `ipHash` (SHA-256 truncado a 16 chars, IPv6 bucketeado a /64). Nunca IP raw.

> NO se agrega `_ipRateLimits` a `src/config/collections.ts` (acceso 100% vía callable). Si se necesitara constante, sería solo backend.

### Tipo backend nuevo (`functions/src/admin/ipRateLimits.ts`)

```typescript
export interface AdminIpRateLimitItem {
  docId: string;       // {ipHash}_{action}_{date}
  ipHash: string;      // 16 hex chars
  action: string;      // ej. 'anon_create'
  date: string;        // 'YYYY-MM-DD'
  count: number;
  windowActive: boolean; // date === hoyUTC ('YYYY-MM-DD')
}
```

### Tipo frontend nuevo (`src/types/admin.ts`)

Mirror exacto del backend (mismo patrón que `AdminRateLimitItem` líneas 217-226):

```typescript
/**
 * Frontend mirror of the backend `AdminIpRateLimitItem` payload returned by the
 * `adminListIpRateLimits` callable (`functions/src/admin/ipRateLimits.ts`).
 * Shape MUST stay in sync with the server-side interface.
 */
export interface AdminIpRateLimitItem {
  docId: string;
  ipHash: string;
  action: string;
  date: string;          // 'YYYY-MM-DD'
  count: number;
  /** `true` when `date === todayUTC` at the moment the callable resolved */
  windowActive: boolean;
}
```

## Firestore Rules

**Ningún cambio.** `_ipRateLimits` ya está en `firestore.rules` con `allow read, write: if false`. El acceso es 100% vía callable admin con Admin SDK (que bypassa rules). Esto es intencional y se mantiene.

### Rules impact analysis

| Query (service file) | Collection | Auth context | Rule que la permite | Cambio? |
|---------------------|------------|-------------|--------------------|---------|
| `adminListIpRateLimits` (functions/admin/ipRateLimits.ts) | `_ipRateLimits` | Admin SDK (bypassa rules) | N/A — Admin SDK ignora rules | No |
| `adminResetIpRateLimit` (functions/admin/ipRateLimits.ts) | `_ipRateLimits` | Admin SDK (bypassa rules) | N/A — Admin SDK ignora rules | No |
| `checkCallableRateLimit` (`_rateLimits`) | `_rateLimits` | Admin SDK | N/A | No |
| `logAbuse` (`abuseLogs`) | `abuseLogs` | Admin SDK | N/A | No |
| `authBlocking` emit `ip_rate_limit` | `abuseLogs` | Admin SDK | N/A | No |

No hay queries de cliente nuevas. Ninguna query lee de una colección que el caller no debería leer — todas son Admin SDK.

### Field whitelist check

No aplica: ninguna escritura nueva de cliente a Firestore. Las escrituras son Admin SDK (`_ipRateLimits` delete en reset, `abuseLogs` add en audit) y no pasan por `hasOnly()`. El `abuseLog` con `type: 'ip_rate_limit'` usa el shape ya existente de `AbuseLogEntry` (sin campos nuevos).

## Cloud Functions

### `adminListIpRateLimits` (callable, nuevo)

Archivo nuevo `functions/src/admin/ipRateLimits.ts`. Patrón exacto de `adminListRateLimits`:

- `onCall<AdminListIpRateLimitsRequest>` con `{ enforceAppCheck: ENFORCE_APP_CHECK_ADMIN, timeoutSeconds: 30 }`.
- `const start = performance.now();` primero.
- `const adminAuth = assertAdmin(auth);` como primera línea de autorización.
- Validación de input:
  - `data.action` (opcional): `typeof === 'string'` y `ACTION_REGEX.test` (`/^[a-z0-9_]{1,40}$/`). Si inválido → `HttpsError('invalid-argument')`.
  - `data.ipHash` (opcional): `typeof === 'string'` y `IP_HASH_REGEX.test` (`/^[a-f0-9]{16}$/`). NO acepta IP raw. Si inválido → `HttpsError('invalid-argument')`.
  - `data.limit` (opcional): number finito, clamp a `[1, 100]`, default 50.
- `await checkCallableRateLimit(db, 'admin_ip_rate_limits_' + adminAuth.uid, 30, adminAuth.uid)`.
- Query (sin índice compuesto, replicando el patrón):
  - Si `ipHash`: `baseCol.where('ipHash', '==', ipHash).limit(itemLimit)` (+ filtro `action` client-side post-fetch si ambos presentes, para no requerir índice compuesto `ipHash+action`).
  - Else si `action`: `baseCol.where('action', '==', action).limit(itemLimit)`.
  - Else: `baseCol.orderBy('date', 'desc').limit(itemLimit)`.
  - **Regla:** nunca combinar `where` + `orderBy` sobre campos distintos (evita índice compuesto). Cuando hay filtro, se omite `orderBy`.
- Mapeo de docs a `AdminIpRateLimitItem[]`: `windowActive = (docData.date === todayUTC)` donde `todayUTC = new Date().toISOString().slice(0,10)`.
- `await trackFunctionTiming('adminListIpRateLimits', start)` antes del `return` happy.
- Catch: `captureException(err); logger.error(...); await trackFunctionTiming(...); if (err instanceof HttpsError) throw err; throw new HttpsError('internal', 'No se pudo listar IP rate limits')`.

### `adminResetIpRateLimit` (callable, nuevo)

Mismo archivo. Patrón exacto de `adminResetRateLimit`:

- `onCall<AdminResetIpRateLimitRequest>` con `{ enforceAppCheck: ENFORCE_APP_CHECK_ADMIN, timeoutSeconds: 30 }`.
- `assertAdmin`, validación `data.docId` con `DOC_ID_REGEX` (`/^[a-zA-Z0-9_-]{1,200}$/`, reutilizar el del archivo o exportar uno local equivalente; NO importar el privado de `rateLimits.ts` — duplicar la constante local respeta no-append).
- `await checkCallableRateLimit(db, 'admin_ip_rate_limit_reset_' + adminAuth.uid, 20, adminAuth.uid)`.
- `const docRef = db.collection('_ipRateLimits').doc(data.docId); const snap = await docRef.get(); if (!snap.exists) throw new HttpsError('not-found', ...)`.
- `await docRef.delete();`.
- Parsear `docId` para extraer `ipHash` y `action` (helper `parseIpRateLimitDocId(docId)` que separa por `_`: `ipHash` = primer segmento, `date` = último, `action` = lo del medio). Se documenta como best-effort para el audit detail.
- `await logAbuse(db, { userId: adminAuth.uid, type: 'config_edit', collection: '_ipRateLimits', detail: JSON.stringify({ action: 'reset_ip_rate_limit', docId, ipHash, ipAction }) })`.
- `trackFunctionTiming('adminResetIpRateLimit', start)` en happy y catch.
- Catch idéntico a `adminResetRateLimit` (`if (!(err instanceof HttpsError)) { captureException; logger.error }`).

### Trigger modificado: `functions/src/triggers/authBlocking.ts` (Opción A)

En el bloque `if (exceeded)` (líneas 65-73), cambiar el `type` del `logAbuse` de `'anon_flood'` a `'ip_rate_limit'`:

```typescript
if (exceeded) {
  await logAbuse(db, {
    userId: hashIp(ip),
    type: 'ip_rate_limit',     // antes: 'anon_flood'
    collection: '_ipRateLimits',
    detail: `IP exceeded ${MAX_ANON_CREATES_PER_IP_PER_DAY} anonymous accounts/day — blocked`,
    severity: 'high',
  });
  throw new HttpsError('resource-exhausted', 'Too many accounts created from this network.');
}
```

El umbral de alerta (líneas 49-56) NO cambia: sigue emitiendo `anon_flood` (severity `medium`). Distinción semántica: `anon_flood` = umbral detectado (alerta), `ip_rate_limit` = IP bloqueada (acción tomada). Se agrega `collection: '_ipRateLimits'` al entry para coherencia con el resto de logs (el campo es opcional en `AbuseLogEntry`).

### Export en `functions/src/index.ts`

```typescript
export { adminListIpRateLimits, adminResetIpRateLimit } from './admin/ipRateLimits';
```

> Nota no-append (worktrees): si se trabaja en worktree paralelo, dejar este export al merge. En este caso es un feature único, se agrega directamente.

## Seed Data

No aplica. El feature NO crea colecciones nuevas ni agrega campos requeridos. `_ipRateLimits` ya existe y es poblada en runtime por `ipRateLimiter.ts`. El inspector lee lo que ya escribe el sistema. Si se quisiera data de QA, se puede sembrar manualmente en el emulador, pero no es requerido por el plan.

## Componentes

### `IpRateLimitsSection.tsx` (nuevo, `src/components/admin/alerts/`)

Espejo de `RateLimitsSection.tsx`. Sin props (igual que `RateLimitsSection`). Renderizado por `AbuseAlerts` cuando `innerTab === 'ipRateLimits'`.

- Estado: `actionFilter` (TextField o select), `ipHashFilter` (TextField), `useDeferredValue` sobre el filtro activo.
- `fetcher = useCallback(() => listAdminIpRateLimits(filtros), [deferred...])` → `useAsyncData(fetcher)`.
- Dedup de analytics: `viewedEmittedRef` (useRef) emite `EVT_ADMIN_IP_RATE_LIMIT_VIEWED` una vez por mount en el primer load exitoso (patrón idéntico a `RateLimitsSection` líneas 77-83).
- Caption visible: aclara que **IP Hash es un hash SHA-256 de la IP, no la IP real**.
- Tabla (`AdminPanelWrapper` envuelve loading/error). Columnas:
  - **IP Hash**: `Tooltip` con hash completo, monospace truncado (`{ipHash.slice(0,8)}…`).
  - **Acción** (`action`): `Chip` con `CHIP_SMALL_SX`.
  - **Fecha** (`date`): texto `YYYY-MM-DD`.
  - **Count** (`count`): align right.
  - **Estado**: `Chip` `Activa`/`Expirada` por `windowActive` (success/default).
  - **Acción** (S2): botón "Resetear" `color="error"`, `disabled={isOffline}`, `Tooltip` con `MSG_OFFLINE.requiresConnection` cuando offline, `aria-label` descriptivo con hash truncado + acción. `minHeight: 44`.
- Dialog reset: `role="alertdialog"`, `aria-labelledby`/`aria-describedby`, body explica que desbloquea esa IP+acción hasta el reset diario. Handler `handleConfirmReset` con try/catch: success → `MSG_ADMIN.ipRateLimitResetSuccess` + `trackEvent(EVT_ADMIN_IP_RATE_LIMIT_RESET, { action })` + refetch; `not-found` (`isAlreadyResetError`) → `toast.info(MSG_ADMIN.ipRateLimitAlreadyReset)` + refetch; otro → `logger.error` + `toast.error(MSG_ADMIN.ipRateLimitResetError)`.

Estimación: ~230 líneas (igual que `RateLimitsSection`, 253). Si excede 300, extraer helper `parseAndTruncateHash`/`isAlreadyResetError` a un helper compartido en `alerts/` — pero `isAlreadyResetError` ya está duplicado localmente en `RateLimitsSection`; mantener el patrón local para no acoplar archivos en worktree.

### `AbuseAlerts.tsx` (modificado, `src/components/admin/`)

- Línea 32: `useState<'alerts' | 'reincidentes' | 'rateLimits' | 'ipRateLimits'>('alerts')`.
- Línea 33: `useAbuseLogsRealtime(200, innerTab !== 'rateLimits' && innerTab !== 'ipRateLimits')` — el subtab IP, como rateLimits, no necesita el realtime de abuseLogs (suspender la suscripción).
- Línea 157: `const isRateLimitsTab = innerTab === 'rateLimits' || innerTab === 'ipRateLimits';` (renombrar conceptualmente a "tab que no usa abuseLogs"; o agregar `const isCallableTab = ...`). Esto hace que `AdminPanelWrapper` no muestre loading/error de abuseLogs ni los KPIs en el subtab IP.
- Línea 174: el `onChange` del `<Tabs>` actualiza el union type → agregar `'ipRateLimits'` al tipo del callback.
- Agregar `<Tab value="ipRateLimits" label="Rate Limits IP" />` después del de "Rate Limits".
- Agregar render condicional: `{innerTab === 'ipRateLimits' && <IpRateLimitsSection />}`.
- Import: `import IpRateLimitsSection from './alerts/IpRateLimitsSection';`.

### Mutable prop audit

No aplica. `IpRateLimitsSection` no recibe datos mutables como props (sin props, obtiene datos vía su servicio). El reset es un write vía callable + refetch, no muta props del parent.

## Textos de usuario

| Texto | Donde se usa | Notas |
|-------|-------------|-------|
| "Rate Limits IP" | label del `<Tab>` en AbuseAlerts | — |
| "IP Hash" | header de columna en IpRateLimitsSection | — |
| "Acción" | header de columna + label de filtro | tilde en Acción |
| "Fecha" | header de columna | — |
| "Count" | header de columna | término consistente con RateLimitsSection |
| "Estado" | header de columna | — |
| "Activa" / "Expirada" | chip de estado | — |
| "Resetear" | botón + título dialog | consistente con RateLimitsSection |
| "Se muestra un hash SHA-256 de la IP, no la dirección real." | caption en IpRateLimitsSection | tildes: dirección |
| "Filtrar por acción" | label del filtro action | tilde en acción |
| "Filtrar por IP Hash" | label del filtro ipHash | — |
| "Limpiar" / "Limpiar filtro" | botón clear + aria-label | — |
| "Sin entradas." / "Sin resultados para este filtro." | empty states | — |
| "¿Resetear rate limit de IP?" | título dialog | signo apertura ¿ |
| "Desbloquea esta IP para la acción {action} hasta el reset diario." | body dialog (ventana activa) | tildes: acción |
| "Limpia esta entrada (la ventana del día ya expiró). Es housekeeping." | body dialog (expirada) | tilde: día, expiró |
| `MSG_ADMIN.ipRateLimitResetSuccess` = "Reseteado correctamente" | toast success | — |
| `MSG_ADMIN.ipRateLimitResetError` = "No se pudo resetear. Verificá tu sesión admin." | toast error | voseo: Verificá; tilde: sesión |
| `MSG_ADMIN.ipRateLimitAlreadyReset` = "Esta entrada ya fue reseteada por otro admin. Refrescamos la tabla." | toast info | — |

Los 3 últimos se agregan a `src/constants/messages/admin.ts` (sección nueva `// #348 — IP rate limits inspector`).

## Hooks

Ninguno nuevo. Se reutiliza `useAsyncData` (existente), `useToast`, `useConnectivity`. El emit dedup usa `useRef` inline (patrón de `RateLimitsSection`, no es un hook extraído).

## Servicios

### `src/services/admin/ipRateLimits.ts` (nuevo, archivo de dominio)

Espejo de `services/admin/rateLimits.ts`. Solo wrappers `httpsCallable` (sin queries Firestore → no requiere `measureAsync`).

```typescript
export async function listAdminIpRateLimits(
  params: { action?: string; ipHash?: string; limit?: number } = {},
): Promise<AdminIpRateLimitItem[]>
// httpsCallable<Req, { items: AdminIpRateLimitItem[] }>(functions, 'adminListIpRateLimits')
// arma request solo con campos definidos (igual que listAdminRateLimits)

export async function resetAdminIpRateLimit(docId: string): Promise<void>
// httpsCallable<{ docId: string }, { success: true }>(functions, 'adminResetIpRateLimit')
```

Re-export en `src/services/admin/index.ts` (barrel existente, línea 56 vecina):

```typescript
export { listAdminIpRateLimits, resetAdminIpRateLimit } from './ipRateLimits';
```

## Integracion

- `AbuseAlerts.tsx` importa `IpRateLimitsSection` y agrega el subtab (4 puntos de cambio: union type línea 32, `useAbuseLogsRealtime` guard línea 33, `isRateLimitsTab`/guard de KPIs línea 157, `onChange` tipo + `<Tab>` + render condicional líneas 174-248).
- `IpRateLimitsSection` consume `listAdminIpRateLimits`/`resetAdminIpRateLimit` desde `../../../services/admin` (barrel).
- `functions/src/index.ts` exporta los 2 callables nuevos.
- `authBlocking.ts` emite `ip_rate_limit`.
- Analytics: `admin.ts` (constants) + `analyticsReport.ts` (GA4_EVENT_NAMES) + `ga4FeatureDefinitions.ts` (card `admin_metrics`).

### Preventive checklist

- [x] **Service layer**: `IpRateLimitsSection` NO importa `firebase/functions` — solo el servicio `services/admin/ipRateLimits.ts`.
- [x] **Duplicated constants**: `DOC_ID_REGEX`/`isAlreadyResetError` se duplican localmente (no se importa el privado de `rateLimits.ts`) por regla no-append. Las constantes de analytics van a `constants/analyticsEvents/admin.ts`, no inline.
- [x] **Context-first data**: no hay `getDoc` de cliente. Datos vía callable (única vía posible para `_ipRateLimits`).
- [x] **Silent .catch**: el catch del handler de reset usa `logger.error` + `toast.error`. El callable usa `captureException` + `logger.error`.
- [x] **Stale props**: `IpRateLimitsSection` no recibe props mutables.

## Tests

| Archivo test | Que testear | Tipo |
|-------------|-------------|------|
| `functions/src/admin/__tests__/ipRateLimits.test.ts` | `adminListIpRateLimits`: `assertAdmin` rechaza no-admin; rate limit por admin invocado (`admin_ip_rate_limits_{uid}`, 30); validación `action` regex / `ipHash` regex hex16 / `limit` clamp `[1,100]`+default 50; mapeo doc→`AdminIpRateLimitItem` con `windowActive` true (date==hoy) y false; filtro por `action` (where), por `ipHash` (where, action client-side post-fetch), sin filtro (orderBy date desc); catch → `HttpsError('internal')`; `trackFunctionTiming` en happy + catch. `adminResetIpRateLimit`: borra doc; escribe `abuseLog` `config_edit` con `_ipRateLimits` + detalle parseado; `not-found` cuando no existe; rate limit 20; `docId` regex inválido → `invalid-argument`; `trackFunctionTiming` ambos paths | Callable |
| `functions/src/__tests__/triggers/authBlocking.test.ts` (modificar) | El bloqueo por IP (`exceeded`) emite `abuseLog` con `type: 'ip_rate_limit'` (severity high); el umbral (`currentCount >= threshold`) sigue emitiendo `anon_flood`; ambos coexisten en el flujo de exceso | Trigger |
| `src/services/admin/__tests__/ipRateLimits.test.ts` | `listAdminIpRateLimits` llama `'adminListIpRateLimits'` con payload correcto (solo campos definidos); mapea `result.data.items`; propaga error. `resetAdminIpRateLimit` llama `'adminResetIpRateLimit'` con `{ docId }`; propaga error | Service (smoke) |
| `src/components/admin/alerts/__tests__/IpRateLimitsSection.test.tsx` | render tabla; estados loading/error/empty vía `AdminPanelWrapper`; emite `EVT_ADMIN_IP_RATE_LIMIT_VIEWED` una vez por mount; truncado de hash + Tooltip; dialog reset (open/confirm); botón disabled offline (`useConnectivity` mock); toast success / error / already-reset (`not-found`); filtro action/ipHash | Component |
| `src/components/admin/__tests__/AbuseAlerts.test.tsx` (modificar) | el subtab "Rate Limits IP" se renderiza y monta `IpRateLimitsSection`; `useAbuseLogsRealtime` se suspende en ese subtab | Component |
| `functions/src/admin/__tests__/analyticsReport` o test de constantes | el evento `admin_ip_rate_limit_viewed`/`_reset` está en `GA4_EVENT_NAMES` (cobertura vía test existente de ga4FeatureDefinitions) | Constants |

### Mock strategy

- **Callable (functions)**: mock de `firebase-admin/firestore` (`FieldValue`, `collection().doc().get/delete`, `runTransaction` no aplica aquí), mock de `assertAdmin`, `checkCallableRateLimit`, `logAbuse`, `trackFunctionTiming`, `captureException`. Patrón de `rateLimits.test.ts`.
- **Service**: mock de `firebase/functions` (`httpsCallable` devuelve fn que resuelve `{ data: { items } }`), mock de `config/firebase`.
- **Component**: mock de `services/admin` (`listAdminIpRateLimits`/`resetAdminIpRateLimit`), `utils/analytics` (`trackEvent`), `context/ToastContext`, `context/ConnectivityContext`, `utils/logger`.

### Criterio de aceptación

- Cobertura >= 80% del código nuevo. Todos los paths condicionales (filtro vs sin filtro, `windowActive` true/false, doc exists/not-found, offline true/false) cubiertos. Side effects (abuseLog, trackFunctionTiming, trackEvent) verificados.

## Analytics

Nuevos en `src/constants/analyticsEvents/admin.ts`:

```typescript
// #348 — IP rate limits inspector
export const EVT_ADMIN_IP_RATE_LIMIT_VIEWED = 'admin_ip_rate_limit_viewed';
export const EVT_ADMIN_IP_RATE_LIMIT_RESET = 'admin_ip_rate_limit_reset';
```

| Evento | Cuándo | Parámetros |
|--------|--------|-----------|
| `admin_ip_rate_limit_viewed` | Una vez por mount de `IpRateLimitsSection`, primer load exitoso | — |
| `admin_ip_rate_limit_reset` | Reset confirmado y exitoso | `{ action: string }` |

Registro:

- `functions/src/admin/analyticsReport.ts` → agregar `'admin_ip_rate_limit_viewed'` y `'admin_ip_rate_limit_reset'` a `GA4_EVENT_NAMES` (array líneas 145-152).
- `src/components/admin/features/ga4FeatureDefinitions.ts` → agregar ambos a `eventNames` de la card `admin_metrics` (línea 194).

---

## Offline

### Cache strategy

| Dato | Estrategia | TTL | Storage |
|------|-----------|-----|---------|
| Listado `_ipRateLimits` | sin persistencia (callable requiere red) | — | — |

### Writes offline

| Operacion | Mecanismo | Conflict resolution |
|-----------|-----------|-------------------|
| Reset IP rate limit | NO se encola — botón disabled offline (`useConnectivity`) | N/A — acción admin auditada, no apta para offline queue |

### Fallback UI

- Read: `AdminPanelWrapper` muestra error state con reintentar (no skeleton infinito).
- Write: botón "Resetear" `disabled` cuando `isOffline` + `Tooltip` con `MSG_OFFLINE.requiresConnection`. Botón confirmar del dialog también `disabled={submitting || isOffline}`.

---

## Accesibilidad y UI mobile

| Componente | Elemento | aria-label | Min touch target | Error state |
|-----------|----------|------------|-----------------|-------------|
| IpRateLimitsSection | Botón Resetear | `Resetear rate limit de IP {hashShort} (acción {action})` | `minHeight: 44` | `AdminPanelWrapper` |
| IpRateLimitsSection | Botón Limpiar filtro | `Limpiar filtro` | `minHeight: 44` | — |
| IpRateLimitsSection | Dialog reset | `role="alertdialog"` + `aria-labelledby` + `aria-describedby` | — | — |
| AbuseAlerts | `<Tab>` Rate Limits IP | semántica tablist nativa MUI | nativo MUI | — |

### Reglas aplicadas

- Botones tienen `aria-label` descriptivo. Sin `<Typography onClick>` ni `<Box onClick>`.
- Touch targets `minHeight: 44`.
- Tabla con error state vía `AdminPanelWrapper`.
- No hay `<img>` con URL dinámica.
- `Tooltip` sobre el hash truncado con valor completo.

## Textos y copy

| Texto | Donde | Regla aplicada |
|-------|-------|----------------|
| "Verificá tu sesión admin." | toast error | voseo + tilde sesión |
| "Se muestra un hash SHA-256 de la IP, no la dirección real." | caption | tilde dirección |
| "Filtrar por acción" | label filtro | tilde acción |
| "¿Resetear rate limit de IP?" | título dialog | signo apertura ¿ |
| "la ventana del día ya expiró" | body dialog | tildes día, expiró |

### Reglas de copy

- Voseo en mensajes accionables ("Verificá").
- Tildes: acción, sesión, dirección, día, expiró.
- Terminología consistente con `RateLimitsSection` (Count, Resetear, Activa/Expirada).
- Strings reutilizables en `src/constants/messages/admin.ts` (`MSG_ADMIN`).

---

## Decisiones tecnicas

- **No-append a `rateLimits.ts`**: callable y servicio en archivos de dominio nuevos (`ipRateLimits.ts`) para respetar la regla de no-append y mantener archivos < 400 líneas. Constantes locales (`DOC_ID_REGEX`, `isAlreadyResetError`) se duplican en vez de importarse de `rateLimits.ts` (export privado + worktree boundary).
- **Sin índice compuesto**: se replica el patrón de `adminListRateLimits` — `where` simple o `orderBy` simple, nunca combinados sobre campos distintos. Cuando ambos filtros (`ipHash` + `action`) están presentes, se filtra `action` client-side post-fetch sobre el resultado del `where('ipHash')`. Alternativa rechazada: declarar índice compuesto `ipHash+action` (overkill para un inspector admin de bajo volumen).
- **Opción A (emitir) vs B (eliminar)**: A elegida porque el inspector da sentido a un tipo de alerta distinto para bloqueos por IP y el cambio es de ~3 líneas en `authBlocking.ts`. B tocaría 5 archivos (`abuseLogger.ts`, `alertsHelpers.ts` SEVERITY_MAP+ALL_TYPES, `types/admin.ts`, `constants/admin.ts` labels+colors) — mayor superficie, peor ROI.
- **`windowActive` por `date`**: la colección no tiene `resetAt`; la ventana es diaria por string `date`. `windowActive = (date === todayUTC)`. Coherente con la semántica de `ipRateLimiter.ts` (que usa `new Date().toISOString().slice(0,10)`).

---

## Hardening de seguridad

### Firestore rules requeridas

Ninguna. `_ipRateLimits` mantiene `allow read, write: if false`. El acceso es 100% Admin SDK vía callable. No se modifica `firestore.rules`.

### Rate limiting

| Coleccion / superficie | Limite | Implementacion |
|-----------|--------|---------------|
| `adminListIpRateLimits` (callable) | 30/día por admin | `checkCallableRateLimit(db, 'admin_ip_rate_limits_{uid}', 30, uid)` |
| `adminResetIpRateLimit` (callable) | 20/día por admin | `checkCallableRateLimit(db, 'admin_ip_rate_limit_reset_{uid}', 20, uid)` |
| `_ipRateLimits` (writes) | N/A | Ya controlado server-side en `ipRateLimiter.ts` (no escribible por usuarios) |

### Vectores de ataque mitigados

| Ataque | Mitigacion | Archivo |
|--------|-----------|---------|
| no-admin scrapea hashes de IP / patrones de abuso | `assertAdmin` + App Check (`ENFORCE_APP_CHECK_ADMIN`) + rate limit 30/día | `functions/src/admin/ipRateLimits.ts` |
| admin comprometido borra masivamente entradas para deshabilitar anti-flood | rate limit 20/día + `abuseLog` audit + `docId` regex (no wildcard delete) | `functions/src/admin/ipRateLimits.ts` |
| inyección en `ipHash`/`action` para forzar query costosa o index scan | regex estricto (`/^[a-f0-9]{16}$/`, `/^[a-z0-9_]{1,40}$/`) + `limit` clamp + sin orderBy compuesto sin índice | `functions/src/admin/ipRateLimits.ts` |
| de-anonimización de IP | la colección solo guarda `ipHash`; el callable no acepta ni deriva IPs raw | `functions/src/utils/ipRateLimiter.ts` (sin cambios) |

---

## Deuda tecnica: mitigacion incorporada

Consultado en el PRD: `--label security` y `--label "tech debt"` no devuelven resultados con esos labels exactos; los tech-debt activos usan `enhancement` (#341-#349 + #168).

| Issue | Que se resuelve | Paso del plan |
|-------|----------------|---------------|
| #348 (este) | inspector `_ipRateLimits` + cierre del tipo `ip_rate_limit` muerto | Todas las fases |
| #327 (asimetría) | `_rateLimits` tenía inspector pero `_ipRateLimits` no — se cierra | Fase 1 + 3 |
| #347 (count queries sin `measureAsync`) | no se agrava — el callable usa `trackFunctionTiming` (backend), el servicio no hace queries Firestore | Fase 1 + 3 |

No se agrava ninguna deuda existente. Los archivos tocados (`authBlocking.ts`, `AbuseAlerts.tsx`, `analyticsReport.ts`, `ga4FeatureDefinitions.ts`, `messages/admin.ts`, `types/admin.ts`, barrels) reciben cambios acotados que respetan sus convenciones.

---

## Validacion Tecnica

## Revisión Técnica (Gate Diego)

**Estado:** VALIDADO CON OBSERVACIONES
**Fecha:** 2026-06-12
**Revisor:** Diego (solution architect)

**Observaciones:** El spec es un espejo verificado linea por linea del patron #327 (`rateLimits.ts` / `RateLimitsSection.tsx` / `AbuseAlerts.tsx`): las lineas referenciadas (useState:32, useAbuseLogsRealtime:33, isRateLimitsTab:157, Tabs onChange:174), el barrel `services/admin/index.ts`, los sitios de analytics (`GA4_EVENT_NAMES` ~149-151, card `admin_metrics` :194), `MSG_OFFLINE.requiresConnection`, la rule `_ipRateLimits: allow read, write: if false` (firestore.rules:762) y el trigger `authBlocking.ts` (bloque exceeded con severity:'high') fueron todos confirmados contra el codigo real. Cobertura PRD->specs completa con las decisiones de Sofia (S2 in-scope, Opcion A) bien integradas. Security model completo (assertAdmin + App Check + rate-limit + audit + regex). Dos observaciones que el plan.md debe respetar, ninguna bloqueante: (1) **orderBy('date','desc') sin tie-breaker** — al no haber filtro, todos los docs de la misma `date` (los de hoy) carecen de orden estable entre hashes; el spec dice "criterio estable" pero `date` no lo es dentro del dia. Aceptable para un inspector de bajo volumen con `limit`, pero el plan debe documentar que el orden intra-dia es no-deterministico (no introducir un orderBy compuesto que requeriria indice). (2) **parseo del docId `{ipHash}_{action}_{date}`** — `action` ('anon_create') contiene underscore; el helper `parseIpRateLimitDocId` (primer segmento=ipHash, ultimo=date, medio=action via join) maneja el caso, pero el plan debe incluir un test explicito para un action multi-segmento, ya que es donde un split naive por '_' fallaria. El campo `action` en el audit detail es best-effort, lo cual el spec ya declara — correcto.
