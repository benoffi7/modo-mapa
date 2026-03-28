# Specs: Anonymous Auth Abuse Prevention

**PRD:** [prd.md](prd.md)
**Fecha:** 2026-03-28

---

## Modelo de datos

### Nueva coleccion: `_ipRateLimits`

Coleccion server-side (admin SDK only) para trackear rate limits por IP.

```typescript
// Doc ID: `{hashedIp}__{action}` (e.g. "a1b2c3__comment_write")
interface IpRateLimitDoc {
  hashedIp: string;          // SHA-256 del IP (privacidad)
  action: string;            // e.g. "comment_write", "anon_create"
  count: number;             // contador acumulado en la ventana
  resetAt: Timestamp;        // inicio de la siguiente ventana (00:00 UTC del dia siguiente)
}
```

### Nuevo tipo de abuse log: `anon_flood`

Se agrega al union type existente `AbuseLogEntry['type']`.

```typescript
// Modificar AbuseLogEntry en functions/src/utils/abuseLogger.ts
export interface AbuseLogEntry {
  userId: string;
  type: 'rate_limit' | 'flagged' | 'top_writers' | 'anon_flood' | 'ip_rate_limit';
  collection: string;
  detail: string;
}
```

### Constantes de rate limiting por IP

```typescript
// functions/src/constants/ipRateLimits.ts
export const IP_RATE_LIMITS = {
  /** Max total writes from a single IP per day (across all users) */
  MAX_WRITES_PER_IP_PER_DAY: 200,
  /** Max anonymous account creations from a single IP per day */
  MAX_ANON_CREATES_PER_IP_PER_DAY: 10,
  /** Threshold for anon_flood alert */
  ANON_FLOOD_ALERT_THRESHOLD: 5,
} as const;
```

## Firestore Rules

### `_ipRateLimits` -- deny all client access

```
match /_ipRateLimits/{docId} {
  allow read, write: if false;
}
```

Esto es consistente con la regla existente de `_rateLimits`.

### Rules impact analysis

| Query (service file) | Collection | Auth context | Rule that allows it | Change needed? |
|---------------------|------------|-------------|-------------------|----------------|
| `checkIpRateLimit` (ipRateLimiter.ts) | `_ipRateLimits` | Admin SDK (Cloud Functions) | N/A -- Admin SDK bypasses rules | No |
| `logAbuse` (abuseLogger.ts) | `abuseLogs` | Admin SDK (Cloud Functions) | N/A -- Admin SDK bypasses rules | No |
| Existing trigger reads | Various | Admin SDK | N/A | No |

Todas las operaciones nuevas son server-side via Admin SDK. No se agregan queries client-side.

### Field whitelist check

| Collection | New/modified field | In create `hasOnly()`? | In update `affectedKeys().hasOnly()`? | Rule change needed? |
|-----------|-------------------|----------------------|--------------------------------------|-------------------|
| `_ipRateLimits` | hashedIp, action, count, resetAt | N/A (Admin SDK, deny all client) | N/A | No |
| `abuseLogs` | (no new fields, new type value only) | N/A (Cloud Functions write) | N/A | No |

No se requieren cambios en Firestore rules para campos, ya que todas las escrituras son via Admin SDK.

## Cloud Functions

### S1: App Check enforcement

**Nota:** La separacion de App Check por entorno se cubre en el PRD hermano `app-check-enforcement` (issue #209). Este specs asume que `ENFORCE_APP_CHECK` pasa a ser `true` en produccion como prerequisito. Los cambios especificos a `env.ts` se detallan en ese PRD.

Las 4 callable functions user-facing que deben tener `enforceAppCheck: true` en produccion:

1. `inviteListEditor` -- `functions/src/callable/inviteListEditor.ts`
2. `removeListEditor` -- `functions/src/callable/removeListEditor.ts`
3. `reportMenuPhoto` -- `functions/src/admin/menuPhotos.ts`
4. `writePerfMetrics` -- `functions/src/admin/perfMetrics.ts`

Ya importan `ENFORCE_APP_CHECK` de `env.ts`. Una vez que el PRD #209 resuelva la configuracion por entorno, estas funciones quedan protegidas automaticamente.

### S2: IP rate limiter helper

**Archivo nuevo:** `functions/src/utils/ipRateLimiter.ts`

```typescript
export interface IpRateLimitConfig {
  action: string;       // e.g. "comment_write"
  limit: number;        // max operations per day per IP
}

/**
 * Extracts client IP from Cloud Function event context.
 * Falls back to 'unknown' if IP cannot be determined.
 */
export function extractIp(event: unknown): string;

/**
 * Hashes IP with SHA-256 for privacy (no raw IPs stored).
 */
export function hashIp(ip: string): string;

/**
 * Checks if an IP has exceeded its rate limit for a given action.
 * Returns true if limit EXCEEDED.
 * Creates/updates the _ipRateLimits doc atomically.
 */
export async function checkIpRateLimit(
  db: Firestore,
  config: IpRateLimitConfig,
  rawIp: string,
): Promise<boolean>;
```

**Logica de `checkIpRateLimit`:**

1. Calcular `hashedIp = hashIp(rawIp)`.
2. Doc ID: `{hashedIp}__{action}`.
3. Leer el doc. Si no existe o `resetAt <= now`, crear con `count: 1, resetAt: tomorrow 00:00 UTC`.
4. Si existe y `resetAt > now`, incrementar `count` con `FieldValue.increment(1)`.
5. Retornar `count > config.limit`.
6. Usar transaccion para atomicidad.

**IP extraction:** Los Firestore triggers (`onDocumentCreated`, etc.) no reciben IP directamente. Se obtiene IP solo en callable functions via `request.rawRequest?.ip` o headers. Para triggers, no hay IP disponible -- el rate limiting por IP se aplica solo a callables y al trigger `onUserCreated` (donde se puede pasar via un campo temporal o no aplicar).

**Decision clave:** Para triggers de Firestore (comments, likes, etc.), no es posible extraer IP del cliente. El rate limiting por IP se limita a:
- Callable functions (tienen `request.rawRequest`)
- `onUserCreated` trigger (donde se registra la creacion de cuentas anonimas, pero sin IP del trigger -- se trackea via un callable wrapper opcional)

Para maximizar cobertura sin refactorear triggers a callables, el approach es:
1. **Callables:** Aplicar `checkIpRateLimit` directamente.
2. **Triggers:** Mantener el rate limiting por userId existente. La combinacion de App Check (S1) + IP rate limiting en callables cubre el vector principal de abuso.

### S3: onUserCreated -- tracking de cuentas anonimas

**Archivo modificado:** `functions/src/triggers/users.ts`

El trigger `onUserCreated` ya existe. Se agrega:

1. Detectar si el usuario creado es anonimo (via Firebase Auth -- no hay campo `authMethod` en el doc de `users`).
2. Si es anonimo, obtener info del usuario via Admin Auth SDK (`getAuth().getUser(userId)`) para verificar que tiene `providerData.length === 0` (anonimo).
3. Registrar en `abuseLogs` si se detecta que la misma IP ha creado mas de `ANON_FLOOD_ALERT_THRESHOLD` cuentas anonimas en el dia.

**Limitacion:** El trigger `onDocumentCreated` no tiene acceso al IP del request. Para trackear IP en creacion de cuentas, se necesita un enfoque alternativo:

- **Opcion A (elegida):** Agregar un campo `_clientIp` hasheado en el doc de `users` al crear desde el frontend, que el trigger lee y luego elimina. Descartado por ser client-writable y manipulable.
- **Opcion B (elegida):** Usar `firebase-functions/v2/identity` triggers (`beforeUserCreated`) que SI reciben IP via `event.ipAddress`. Este es el approach correcto.

**Approach final: `beforeUserCreated` blocking function**

```typescript
// functions/src/triggers/authBlocking.ts
import { beforeUserCreated } from 'firebase-functions/v2/identity';

export const onBeforeUserCreated = beforeUserCreated(async (event) => {
  const ip = event.ipAddress;
  const isAnon = !event.data.email && (event.additionalUserInfo?.providerId === undefined);

  if (isAnon && ip) {
    // Track in _ipRateLimits
    const exceeded = await checkIpRateLimit(db, {
      action: 'anon_create',
      limit: IP_RATE_LIMITS.MAX_ANON_CREATES_PER_IP_PER_DAY,
    }, ip);

    if (exceeded) {
      await logAbuse(db, {
        userId: event.data.uid,
        type: 'anon_flood',
        collection: 'users',
        detail: `IP ${hashIp(ip)} exceeded ${IP_RATE_LIMITS.MAX_ANON_CREATES_PER_IP_PER_DAY} anon creates/day`,
      });
      // Block the creation
      throw new HttpsError('resource-exhausted', 'Too many accounts created');
    }

    // Track for alert threshold (even if not exceeded)
    const count = await getIpActionCount(db, 'anon_create', ip);
    if (count >= IP_RATE_LIMITS.ANON_FLOOD_ALERT_THRESHOLD) {
      await logAbuse(db, {
        userId: event.data.uid,
        type: 'anon_flood',
        collection: 'users',
        detail: `IP ${hashIp(ip)} created ${count} anon accounts today (alert threshold)`,
      });
    }
  }
});
```

### S2+: IP rate limiting en callable functions existentes

Para las callable functions user-facing, agregar `checkIpRateLimit` antes del procesamiento principal:

| Callable | Action name | Limit |
|----------|------------|-------|
| `inviteListEditor` | `invite_editor` | 200/day/IP |
| `removeListEditor` | `remove_editor` | 200/day/IP |
| `reportMenuPhoto` | `report_photo` | 200/day/IP |
| `writePerfMetrics` | `perf_metrics` | 200/day/IP |

Se usa el limite global `MAX_WRITES_PER_IP_PER_DAY` como safety net. El rate limiting por userId existente es mas granular.

## Componentes

No hay componentes frontend nuevos ni modificados. Este feature es 100% server-side.

### Mutable prop audit

N/A -- no hay componentes de UI.

## Textos de usuario

No hay textos nuevos de usuario. Los errores de rate limiting son genericos y ya existen en el sistema.

## Hooks

No hay hooks nuevos ni modificados.

## Servicios

No hay servicios frontend nuevos ni modificados.

## Integracion

### Dependencias entre PRDs

Este PRD depende de **app-check-enforcement (#209)** para la S1. Sin embargo, S2 y S3 son independientes y pueden implementarse primero.

### Modificaciones a archivos existentes

| Archivo | Cambio |
|---------|--------|
| `functions/src/helpers/env.ts` | Depende del PRD #209 -- no modificar aqui |
| `functions/src/utils/abuseLogger.ts` | Agregar tipos `anon_flood` e `ip_rate_limit` al union type |
| `functions/src/triggers/users.ts` | Sin cambios (el tracking de IP usa `beforeUserCreated`, no este trigger) |
| `functions/src/index.ts` | Exportar `onBeforeUserCreated` |
| `functions/src/callable/inviteListEditor.ts` | Agregar `checkIpRateLimit` call |
| `functions/src/callable/removeListEditor.ts` | Agregar `checkIpRateLimit` call |
| `functions/src/admin/menuPhotos.ts` | Agregar `checkIpRateLimit` en `reportMenuPhoto` |
| `functions/src/admin/perfMetrics.ts` | Agregar `checkIpRateLimit` call |
| `firestore.rules` | Agregar regla deny para `_ipRateLimits` |

### Preventive checklist

- [x] **Service layer**: No hay componentes importando `firebase/firestore` para writes -- todo es server-side.
- [x] **Duplicated constants**: Rate limit constants centralizadas en `functions/src/constants/ipRateLimits.ts`.
- [x] **Context-first data**: No aplica -- no hay UI.
- [x] **Silent .catch**: Se usara `logger.warn` en catch blocks de IP rate limit (non-blocking).
- [x] **Stale props**: No aplica -- no hay UI.

## Tests

| Archivo test | Que testear | Tipo |
|-------------|-------------|------|
| `functions/src/__tests__/utils/ipRateLimiter.test.ts` | `checkIpRateLimit`: under limit, at limit, over limit, IP missing/unknown, daily reset, IPv6 normalization, hash determinism, transaction behavior | Unit |
| `functions/src/__tests__/triggers/authBlocking.test.ts` | `onBeforeUserCreated`: anon user tracking, non-anon passthrough, IP missing, flood alert threshold, flood block, existing user (email link) passthrough | Unit |
| `functions/src/__tests__/utils/rateLimiter.test.ts` | Verify existing tests still pass (no regression) | Regression |
| `functions/src/__tests__/utils/abuseLogger.test.ts` | Verify new types `anon_flood` and `ip_rate_limit` produce correct severity | Unit (extend existing) |

### Casos a cubrir

- [x] `checkIpRateLimit` happy path (under limit returns false)
- [x] `checkIpRateLimit` limit exceeded (returns true)
- [x] `checkIpRateLimit` IP missing/empty string (falls back to 'unknown', logs warning)
- [x] `checkIpRateLimit` daily reset (doc with expired resetAt resets count)
- [x] `checkIpRateLimit` IPv6 normalization (::1 and 127.0.0.1 treated consistently)
- [x] `hashIp` determinism (same IP always produces same hash)
- [x] `extractIp` from callable request (rawRequest.ip, X-Forwarded-For fallback)
- [x] `onBeforeUserCreated` blocks anon creation when IP exceeds daily limit
- [x] `onBeforeUserCreated` allows non-anon creation (email/Google)
- [x] `onBeforeUserCreated` logs anon_flood alert at threshold
- [x] `onBeforeUserCreated` handles missing IP gracefully (allows creation)
- [x] Callable integration: verify `checkIpRateLimit` is called before business logic
- [x] Abuse log severity mapping for new types

### Mock strategy

- Firestore: mock Admin SDK (`doc`, `get`, `set`, `update`, `runTransaction`)
- Firebase Auth: mock `getAuth().getUser()` for anon detection
- IP: mock `event.ipAddress` for identity triggers
- SHA-256: use real crypto (no mock needed, deterministic)

### Criterio de aceptacion

- Cobertura >= 80% del codigo nuevo
- Todos los paths condicionales cubiertos
- Tests de validacion para todos los inputs (IP formats, edge cases)
- Side effects verificados (abuseLogs writes, rate limit doc creation)

## Analytics

No hay eventos de analytics nuevos. Los abuse logs son la fuente de metricas para este feature (consultados via admin panel).

---

## Offline

### Cache strategy

| Dato | Estrategia | TTL | Storage |
|------|-----------|-----|---------|
| IP rate limit docs | N/A (server-side only) | N/A | Firestore `_ipRateLimits` |
| Abuse logs | N/A (server-side only) | N/A | Firestore `abuseLogs` |

### Writes offline

| Operacion | Mecanismo | Conflict resolution |
|-----------|-----------|-------------------|
| N/A | Todo es server-side | N/A |

### Fallback UI

No hay cambios de UI. Si App Check token refresh falla offline, el Firebase SDK maneja el retry internamente. Las escrituras del usuario fallan con un error generico que ya se muestra via toast existente.

---

## Decisiones tecnicas

### 1. `beforeUserCreated` vs. `onDocumentCreated` para tracking de IP

**Elegido:** `beforeUserCreated` (Identity Platform blocking function).

**Razon:** Los Firestore triggers no reciben el IP del cliente. Los Identity Platform triggers (`beforeUserCreated`) reciben `event.ipAddress` directamente. Ademas, permiten **bloquear** la creacion del usuario (throwing error), no solo reaccionar despues.

**Alternativa rechazada:** Agregar un campo `_clientIp` al doc de `users` desde el frontend. Rechazado porque el cliente puede falsificar el IP.

### 2. SHA-256 para hashear IPs en lugar de almacenar raw

**Elegido:** Hash con SHA-256 antes de almacenar.

**Razon:** Privacidad. Los IPs son datos personales. Al hashear, se puede trackear comportamiento sin almacenar IPs en texto plano. El hash es determinista, asi que el rate limiting funciona correctamente.

### 3. Rate limiting por IP solo en callables, no en triggers

**Elegido:** Aplicar `checkIpRateLimit` solo en callable functions y `beforeUserCreated`.

**Razon:** Los Firestore triggers (`onDocumentCreated` para comments, likes, etc.) no tienen acceso al IP del request. Refactorear todos los writes a callables seria un cambio masivo y romperia el modelo de Firestore-first. La combinacion de App Check (bloquea scripts sin browser) + rate limit por userId (en triggers) + rate limit por IP (en callables y auth) cubre el vector de ataque principal.

### 4. Limites conservadores para IPs compartidos

**Elegido:** 200 writes/day/IP, 10 anon creates/day/IP.

**Razon:** Redes corporativas y universitarias comparten IP. Una oficina de 20 personas podria generar legitimamente ~100 writes/day. 200 es 2x ese estimado. 10 anon creates es alto para uso normal (tipicamente 1-2 por IP) pero bajo para un ataque automatizado. Estos valores son configurables via constantes.
