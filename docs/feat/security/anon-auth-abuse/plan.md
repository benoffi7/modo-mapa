# Plan: Anonymous Auth Abuse Prevention

**Specs:** [specs.md](specs.md)
**Fecha:** 2026-03-28

---

## Fases de implementacion

### Fase 1: IP Rate Limiter utility + Firestore rules

**Branch:** `feat/anon-auth-abuse`

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `functions/src/constants/ipRateLimits.ts` | Crear archivo con constantes `MAX_WRITES_PER_IP_PER_DAY` (200), `MAX_ANON_CREATES_PER_IP_PER_DAY` (10), `ANON_FLOOD_ALERT_THRESHOLD` (5) |
| 2 | `functions/src/utils/ipRateLimiter.ts` | Crear `extractIp(request)`, `hashIp(ip)`, `checkIpRateLimit(db, config, rawIp)`, `getIpActionCount(db, action, rawIp)`. Usar `crypto.createHash('sha256')` para hash. Transaccion para atomicidad de increment + check. Manejar IP faltante con fallback 'unknown' + warning log. |
| 3 | `functions/src/utils/abuseLogger.ts` | Agregar `'anon_flood' \| 'ip_rate_limit'` al union type de `AbuseLogEntry['type']`. Agregar al `SEVERITY_MAP`: `anon_flood: 'high'`, `ip_rate_limit: 'medium'`. |
| 4 | `firestore.rules` | Agregar regla `match /_ipRateLimits/{docId} { allow read, write: if false; }` junto a la regla existente de `_rateLimits`. |
| 5 | `functions/src/__tests__/utils/ipRateLimiter.test.ts` | Crear tests: under limit, at limit, over limit, IP missing, daily reset, IPv6, hash determinism, extractIp from callable request |
| 6 | `functions/src/__tests__/utils/abuseLogger.test.ts` | Extender tests existentes para verificar severity de `anon_flood` (high) e `ip_rate_limit` (medium) |

### Fase 2: Auth blocking function (S3)

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `functions/src/triggers/authBlocking.ts` | Crear `onBeforeUserCreated` usando `beforeUserCreated` de `firebase-functions/v2/identity`. Extraer IP de `event.ipAddress`. Detectar usuario anonimo via `event.additionalUserInfo`. Si anon: llamar `checkIpRateLimit` con action `anon_create`. Si excede limite: log abuse + throw error para bloquear creacion. Si alcanza threshold pero no excede: log abuse alert sin bloquear. Si no es anon o no hay IP: passthrough. |
| 2 | `functions/src/index.ts` | Agregar export: `export { onBeforeUserCreated } from './triggers/authBlocking';` |
| 3 | `functions/src/__tests__/triggers/authBlocking.test.ts` | Crear tests: anon user under limit (passthrough), anon user exceeds limit (blocked), anon user at alert threshold (log but passthrough), non-anon user (passthrough), missing IP (passthrough), email user creation (passthrough) |

### Fase 3: IP rate limiting en callable functions (S2)

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `functions/src/callable/inviteListEditor.ts` | Importar `checkIpRateLimit`, `extractIp` de `ipRateLimiter.ts` y `IP_RATE_LIMITS` de constantes. Despues del auth check y antes de la logica de negocio, llamar `checkIpRateLimit(db, { action: 'invite_editor', limit: IP_RATE_LIMITS.MAX_WRITES_PER_IP_PER_DAY }, extractIp(request))`. Si excede: throw `HttpsError('resource-exhausted', 'Too many requests')` + `logAbuse` con type `ip_rate_limit`. |
| 2 | `functions/src/callable/removeListEditor.ts` | Mismo patron que inviteListEditor con action `remove_editor`. |
| 3 | `functions/src/admin/menuPhotos.ts` | Agregar IP rate limit check en `reportMenuPhoto` (unica funcion user-facing en este archivo). Action: `report_photo`. Las funciones admin (`approveMenuPhoto`, etc.) no necesitan IP rate limit porque ya tienen `assertAdmin`. |
| 4 | `functions/src/admin/perfMetrics.ts` | Agregar IP rate limit check en `writePerfMetrics`. Action: `perf_metrics`. |
| 5 | `functions/src/__tests__/callable/inviteListEditor.test.ts` | Extender tests existentes: verificar que `checkIpRateLimit` es llamado, test para IP rate limit exceeded (throws resource-exhausted). |
| 6 | `functions/src/__tests__/callable/removeListEditor.test.ts` | Extender tests existentes con mismos patrones. |

### Fase 4: Verificacion y lint

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | N/A | Ejecutar `cd functions && npx vitest run` -- verificar que todos los tests pasan |
| 2 | N/A | Ejecutar `cd functions && npm run test:coverage` -- verificar >= 80% en codigo nuevo |
| 3 | N/A | Ejecutar `cd functions && npx tsc --noEmit` -- verificar que no hay errores de tipos |
| 4 | N/A | Ejecutar lint en archivos modificados |

---

## Orden de implementacion

1. `functions/src/constants/ipRateLimits.ts` -- constantes (sin dependencias)
2. `functions/src/utils/ipRateLimiter.ts` -- utility (depende de constantes)
3. `functions/src/utils/abuseLogger.ts` -- modificar types (sin dependencias nuevas)
4. `firestore.rules` -- agregar regla (sin dependencias)
5. `functions/src/__tests__/utils/ipRateLimiter.test.ts` -- tests del utility
6. `functions/src/__tests__/utils/abuseLogger.test.ts` -- extension de tests
7. `functions/src/triggers/authBlocking.ts` -- blocking function (depende de 2, 3)
8. `functions/src/index.ts` -- exportar blocking function
9. `functions/src/__tests__/triggers/authBlocking.test.ts` -- tests
10. Callable modifications (inviteListEditor, removeListEditor, reportMenuPhoto, writePerfMetrics)
11. Tests de callables
12. Verificacion final (tests, coverage, lint)

---

## Estimacion de archivos

| Archivo | Lineas estimadas | Accion |
|---------|-----------------|--------|
| `functions/src/constants/ipRateLimits.ts` | ~15 | OK |
| `functions/src/utils/ipRateLimiter.ts` | ~100 | OK |
| `functions/src/utils/abuseLogger.ts` | ~30 (actual ~27 + 3) | OK |
| `functions/src/triggers/authBlocking.ts` | ~60 | OK |
| `functions/src/callable/inviteListEditor.ts` | ~70 (actual ~57 + 13) | OK |
| `functions/src/callable/removeListEditor.ts` | ~45 (actual ~34 + 11) | OK |
| `functions/src/admin/menuPhotos.ts` | +10 en reportMenuPhoto | OK (archivo largo pero solo se agrega un bloque) |
| `functions/src/admin/perfMetrics.ts` | +10 | OK |
| `functions/src/__tests__/utils/ipRateLimiter.test.ts` | ~150 | OK |
| `functions/src/__tests__/triggers/authBlocking.test.ts` | ~120 | OK |

Ningun archivo supera las 400 lineas.

---

## Riesgos

### 1. False positives en redes corporativas

**Riesgo:** Multiples usuarios legitimos detras de la misma IP corporativa alcanzan el limite de 200 writes/day.

**Mitigacion:** Los limites son conservadores (200/day es alto para uso normal). Monitorear `abuseLogs` con tipo `ip_rate_limit` en las primeras semanas y ajustar si hay falsos positivos. Las constantes son facilmente configurables.

### 2. `beforeUserCreated` no disponible en emuladores

**Riesgo:** Los Identity Platform blocking functions pueden tener soporte limitado en Firebase emuladores locales.

**Mitigacion:** Los tests unitarios mockean completamente el trigger. Para testing de integracion, verificar manualmente en staging. La funcion tiene un fallback seguro: si `event.ipAddress` es undefined, permite la creacion (passthrough).

### 3. Dependency en PRD #209 para S1 completo

**Riesgo:** Si el PRD de App Check enforcement (#209) se retrasa, la capa mas importante de defensa (App Check) no estara activa.

**Mitigacion:** S2 y S3 son independientes y proveen proteccion parcial. El rate limiting por IP y el blocking de cuentas anonimas funcionan sin App Check. Se puede priorizar #209 en paralelo.

---

## Criterios de done

- [ ] `checkIpRateLimit` implementado y testeado con >= 80% coverage
- [ ] `onBeforeUserCreated` blocking function implementada y testeada
- [ ] IP rate limiting integrado en las 4 callable functions user-facing
- [ ] Regla `_ipRateLimits` deny-all agregada a `firestore.rules`
- [ ] Tipos `anon_flood` e `ip_rate_limit` agregados a `AbuseLogEntry`
- [ ] Constantes centralizadas en `functions/src/constants/ipRateLimits.ts`
- [ ] Todos los tests pasan con >= 80% coverage en codigo nuevo
- [ ] No lint errors
- [ ] Build succeeds (`cd functions && npx tsc --noEmit`)
- [ ] IPs hasheados (SHA-256), nunca almacenados en texto plano
