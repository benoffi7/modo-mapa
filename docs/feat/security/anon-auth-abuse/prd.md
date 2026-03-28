# PRD: Anonymous Auth abuse bypasea rate limits

**Feature:** anon-auth-abuse
**Categoria:** security
**Fecha:** 2026-03-28
**Issue:** #210
**Prioridad:** Alta

---

## Contexto

Modo Mapa usa Firebase Anonymous Auth como metodo de entrada por defecto. Todos los rate limits server-side (comentarios 20/dia, likes 50/dia, custom tags 10/business, feedback 5/dia) estan indexados por `userId`. Dado que `signInAnonymously()` crea un nuevo UID sin friccion alguna, un atacante puede rotar cuentas anonimas para evadir todos los limites existentes.

## Problema

- **Rate limits bypasseables:** Un bot puede ejecutar `signInAnonymously()` -> realizar 20 comentarios -> `signOut()` -> repetir. Miles de documentos spam por hora, todos con UIDs diferentes.
- **Manipulacion de datos:** Ratings, check-ins, favoritos y price levels pueden inflarse artificialmente creando multiples cuentas anonimas, distorsionando rankings y promedios.
- **Impacto economico:** Cada write a Firestore y cada invocacion de Cloud Function (triggers de moderacion, rate limiting, counters, fan-out) genera costo. Un ataque sostenido puede escalar el billing significativamente.
- **Notification spam:** Los triggers de fan-out (follows, recommendations) y notificaciones (likes, replies) generan documentos adicionales por cada accion del atacante, amplificando el impacto a usuarios legitimos.

## Solucion

### S1. Enforce App Check en todas las Cloud Functions

Actualmente `ENFORCE_APP_CHECK` esta en `false` para user-facing callables porque staging y produccion comparten deployment. El primer paso es habilitar App Check enforcement para que solo clientes verificados (con reCAPTCHA Enterprise token valido) puedan invocar funciones y escribir a Firestore.

- Separar la configuracion de App Check entre staging y produccion (flag por environment o deployment separado).
- Habilitar `enforceAppCheck: true` en todas las Cloud Functions callable user-facing (`inviteListEditor`, `removeListEditor`, `reportMenuPhoto`, `writePerfMetrics`).
- Habilitar App Check enforcement en Firestore rules (Firebase Console).
- Esto bloquea llamadas desde scripts que no corren en el browser con reCAPTCHA valido.

### S2. Rate limiting por IP en Cloud Functions

Agregar una segunda dimension de rate limiting que no dependa del `userId`:

- Extraer IP del request en Cloud Functions (`request.rawRequest.ip` o header `X-Forwarded-For`).
- Crear coleccion `_ipRateLimits` con documentos `{ip}__{action}` y contador diario.
- Limites por IP: maximo N cuentas anonimas nuevas por dia por IP, maximo M escrituras totales por dia por IP.
- Implementar como middleware reutilizable (`checkIpRateLimit`) que se invoca en triggers antes del `checkRateLimit` existente.

### S3. Throttle de creacion de cuentas anonimas

Monitorear la tasa de creacion de cuentas anonimas y actuar cuando se detecta abuso:

- Cloud Function trigger `onUserCreated` (ya deberia existir o crear) que registra creaciones en `_ipRateLimits`.
- Si una IP crea mas de X cuentas anonimas en Y horas, loggear en `abuseLogs` con tipo `anon_flood`.
- Alerta automatica en el panel de admin (Abuse Alerts ya existente).
- Opcional: bloquear temporalmente escrituras desde esa IP.

### S4. Requerir email para acciones sensibles (futuro)

Evaluar requerir email verificado antes de permitir writes en colecciones de alto impacto (`comments`, `ratings`, `recommendations`). Esto es un cambio de producto significativo que afecta el onboarding, por lo que se deja como fase futura a validar con metricas de la S1-S3.

### Consideraciones de UX

- S1 y S2 son transparentes para el usuario legitimo: App Check corre en background y el rate limiting por IP no afecta a usuarios normales.
- S3 puede generar false positives en redes corporativas/universitarias donde multiples usuarios comparten IP. Usar limites conservadores.
- S4 requiere evaluacion de impacto en conversion de nuevos usuarios.

---

## Scope

| Item | Prioridad | Esfuerzo |
|------|-----------|----------|
| S1: Enforce App Check en callables user-facing | P0 | S |
| S1: Enforce App Check en Firestore (Firebase Console) | P0 | S |
| S1: Separar config staging/prod para App Check | P0 | M |
| S2: Extraer IP en Cloud Functions triggers | P1 | S |
| S2: Coleccion `_ipRateLimits` + `checkIpRateLimit` helper | P1 | M |
| S2: Integrar `checkIpRateLimit` en triggers existentes (comments, likes, tags, feedback, follows, checkins, recommendations) | P1 | M |
| S3: Trigger `onUserCreated` con tracking de IP | P2 | S |
| S3: Alerta `anon_flood` en abuseLogs + badge en admin | P2 | S |
| Tests para `checkIpRateLimit` y trigger `onUserCreated` | P1 | M |

**Esfuerzo total estimado:** L

---

## Out of Scope

- Requerir email verificado para escribir (S4) -- evaluacion futura post-metricas
- Cloud Armor o WAF a nivel de infraestructura de Google Cloud (requiere plan Blaze configuracion avanzada)
- Device fingerprinting en el frontend (complejidad alta, privacidad cuestionable)
- CAPTCHA visible para usuarios antes de cada accion (impacto negativo en UX)

---

## Tests

### Archivos que necesitaran tests

| Archivo | Tipo | Que testear |
|---------|------|-------------|
| `functions/src/utils/ipRateLimiter.ts` | Util | Limites por IP, ventana diaria, doc ID compuesto, edge cases (IP faltante, IPv6) |
| `functions/src/triggers/users.ts` (modificado) | Trigger | Tracking de creacion anonima, alerta anon_flood, integracion con abuseLogs |
| `functions/src/utils/rateLimiter.test.ts` (ampliado) | Util | Verificar que `checkRateLimit` sigue funcionando con la nueva capa de IP |
| `functions/src/utils/ipRateLimiter.test.ts` | Util | Happy path, limite excedido, IP missing, reset diario, IPv6 normalizacion |

### Criterios de testing

- Cobertura >= 80% del codigo nuevo
- Tests de validacion para todos los inputs del usuario
- Todos los paths condicionales cubiertos
- Side effects verificados (abuseLogs writes, rate limit doc creation)

---

## Seguridad

- [x] Rate limits actuales son per-userId -- esta es la vulnerabilidad que este PRD resuelve
- [ ] App Check enforcement habilitado en todas las Cloud Functions user-facing
- [ ] App Check enforcement habilitado en Firestore (Firebase Console)
- [ ] IP rate limiting no expone informacion de IP a otros usuarios (solo en `_ipRateLimits` server-side)
- [ ] Logs de IP hasheados o anonimizados si se guardan a largo plazo (privacidad)
- [ ] Limites por IP conservadores para evitar false positives en NAT/corporativos
- [ ] `_ipRateLimits` no es legible por clientes (Firestore rules: deny all client access)
- [ ] No se agregan secretos al codigo -- configuracion via env vars o Firebase Console

---

## Offline

### Data flows

| Operacion | Tipo (read/write) | Estrategia offline | Fallback UI |
|-----------|-------------------|-------------------|-------------|
| App Check token refresh | read | Firebase SDK maneja cache de token | Writes fallan con error generico |
| IP rate limit check (server-side) | read/write | N/A (solo en Cloud Functions) | N/A |
| Abuse log creation (server-side) | write | N/A (solo en Cloud Functions) | N/A |

### Checklist offline

- [x] Reads de Firestore: no aplica (todo es server-side)
- [x] Writes: no aplica (Cloud Functions, no cliente)
- [ ] APIs externas: App Check token refresh puede fallar offline -- Firebase SDK lo maneja
- [x] UI: no hay cambios de UI en este feature
- [x] Datos criticos: no aplica

### Esfuerzo offline adicional: S

---

## Modularizacion

Esta feature es predominantemente server-side (Cloud Functions). No agrega UI nueva.

### Checklist modularizacion

- [x] Logica de negocio en hooks/services (no inline en componentes de layout) -- N/A, es server-side
- [x] Componentes nuevos son reutilizables fuera del contexto actual de layout -- no hay componentes nuevos
- [x] No se agregan useState de logica de negocio a AppShell o SideMenu
- [x] Props explicitas en vez de dependencias implicitas a contextos de layout -- N/A
- [x] Cada prop de accion tiene un handler real especificado -- N/A
- [ ] `checkIpRateLimit` es un helper reutilizable en `functions/src/utils/`, no inline en triggers
- [ ] Configuracion de limites por IP centralizada en constantes, no hardcodeada en triggers

---

## Success Criteria

1. App Check enforcement habilitado en produccion para todas las Cloud Functions y Firestore, sin romper la funcionalidad para usuarios legitimos.
2. Un script que rote cuentas anonimas es bloqueado por App Check antes de poder escribir a Firestore.
3. Si un atacante logra pasar App Check, el rate limiting por IP limita el impacto a N escrituras por dia desde una misma IP, independientemente de cuantos UIDs use.
4. Creacion masiva de cuentas anonimas desde una misma IP genera alerta `anon_flood` visible en el panel de admin.
5. Usuarios legitimos en redes compartidas (corporativas, universidades) no experimentan bloqueos con los limites configurados.
