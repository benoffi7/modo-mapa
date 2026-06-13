# PRD: Inspector admin de `_ipRateLimits` + cierre del tipo `ip_rate_limit` muerto

**Feature:** admin-ip-rate-limits-inspector
**Categoria:** admin
**Fecha:** 2026-06-09
**Issue:** #348
**Prioridad:** Media

---

## Contexto

`functions/src/utils/ipRateLimiter.ts` escribe contadores de abuso por IP (creacion de cuentas anonimas, hasta 10/dia/IP) en la coleccion `_ipRateLimits`, pero el admin esta ciego a esos datos: la coleccion no aparece en ningun panel, a diferencia de `_rateLimits` (por usuario) que tiene su inspector `RateLimitsSection.tsx` desde #327 dentro del subtab "Rate Limits" de la tab Alertas. Ademas el tipo `ip_rate_limit` esta definido en `abuseLogger.ts` (con `severity: 'medium'`) y en `src/constants/admin.ts` (label "Rate Limit IP" + color warning), pero ningun call site lo emite — `authBlocking.ts` siempre usa `anon_flood` —, dejando una categoria de Alertas que nunca recibira datos.

## Problema

- El admin no tiene visibilidad de los rate limits por IP (`_ipRateLimits`): no puede ver cuantas IPs estan cerca o por encima del limite de creacion de cuentas anonimas, ni desbloquear una IP legitima falsamente bloqueada (housekeeping o incidente).
- La unica senal actual de abuso por IP es indirecta: un `abuseLog` de tipo `anon_flood` que se escribe al cruzar el umbral o el limite — pero no expone el contador acumulado ni el estado de la ventana diaria.
- El tipo `ip_rate_limit` es codigo muerto: el panel Alertas muestra una categoria/filtro que nunca tendra resultados, lo que confunde al admin (parece un bug de datos) y es deuda de consistencia entre el enum del backend, las constantes del frontend y los call sites reales.

## Solucion

La solucion tiene dos mitades independientes pero coherentes: dar visibilidad de `_ipRateLimits` reusando el patron de `_rateLimits` (#327), y resolver el tipo `ip_rate_limit` muerto decidiendo entre emitirlo o eliminarlo. Por privacidad, `_ipRateLimits` nunca almacena IPs raw — solo `ipHash` (SHA-256 truncado a 16 chars, con bucketing IPv6 /64). El inspector trabaja sobre `ipHash`, nunca sobre IPs reales.

### S1 — Callable admin `adminListIpRateLimits` (backend)

Crear un callable en `functions/src/admin/` (archivo nuevo `ipRateLimits.ts`, NO appendear a `rateLimits.ts` para respetar regla de no-append y mantener archivos < 400 lineas) siguiendo el patron exacto de `adminListRateLimits`:

- `onCall` con `enforceAppCheck: ENFORCE_APP_CHECK_ADMIN`, `timeoutSeconds: 30`.
- `assertAdmin(auth)` como primera linea de autorizacion.
- `checkCallableRateLimit(db, 'admin_ip_rate_limits_{uid}', 30, uid)` — 30/dia por admin, igual que el inspector de usuario, para desalentar scraping.
- Lee `_ipRateLimits` ordenado por algun criterio estable. Los docs tienen `{ ipHash, action, date, count, createdAt }` (ID = `{ipHash}_{action}_{date}`). Como no hay campo `resetAt`, la ventana es diaria por `date` (string `YYYY-MM-DD`); el item derivado expone `windowActive = (date === hoy)`.
- Filtro opcional por `action` (ej: `anon_create`) y/o por `ipHash` (input validado con regex hex 16 chars). NO aceptar IP raw como input — solo hash.
- Clamp de `limit` a `[1, 100]`, default 50.
- `trackFunctionTiming('adminListIpRateLimits', start)` en happy path y catch (patron try/catch de callables de patterns.md).
- `captureException` + `logger.error` en catch, mapeo a `HttpsError('internal', ...)`.
- Tipo de respuesta `AdminIpRateLimitItem[]` con `{ docId, ipHash, action, date, count, windowActive }`.

Exportar en `functions/src/index.ts`.

### S2 — Callable admin `adminResetIpRateLimit` (backend, opcional segun decision de producto)

Mismo patron que `adminResetRateLimit`: borra un doc de `_ipRateLimits` por `docId` (validado con regex), 20/dia por admin, escribe `abuseLog` de tipo `config_edit` con `collection: '_ipRateLimits'` y detalle JSON (`action: 'reset_ip_rate_limit'`, `docId`, `action` del doc, `ipHash`). Permite desbloquear una IP legitima falsamente limitada (ej: NAT corporativo, oficina compartida).

> Decision de producto pendiente (ver Sofia): si el reset de IP se considera fuera de scope por ahora (el bloqueo es por dia y se auto-resetea), S2 puede quedar Out of Scope y el inspector ser solo lectura. El default propuesto es incluirlo por simetria con `_rateLimits`.

### S3 — Servicio frontend + UI subtab IP (frontend)

- Servicio: `src/services/admin/ipRateLimits.ts` (archivo nuevo de dominio, no appendear a `rateLimits.ts`) — wrappers `listAdminIpRateLimits()` y `resetAdminIpRateLimit(docId)` via `httpsCallable`, identicos en forma a `services/admin/rateLimits.ts`. Re-exportar desde `services/admin/index.ts` si existe el barrel (verificar; no crear barrel nuevo).
- Tipo `AdminIpRateLimitItem` en `src/types/admin.ts` (mirror del backend).
- UI: extender `AbuseAlerts.tsx` agregando un cuarto subtab `ipRateLimits` (label "Rate Limits IP") al `<Tabs>` existente. El subtab renderiza un componente nuevo `src/components/admin/alerts/IpRateLimitsSection.tsx` (NO en `menu/`, va en el dominio de su tab). El componente reusa el shell de `RateLimitsSection`: `useAsyncData(fetcher)` + `AdminPanelWrapper` + tabla (columnas: IP Hash, Accion, Fecha, Count, Estado, [Accion si S2]).
  - Mostrar `ipHash` truncado con `Tooltip` (igual que userId en RateLimitsSection). Aclarar en caption que es un hash, no una IP.
  - Chip de estado Activa/Expirada por `windowActive`.
  - Si S2: boton "Resetear" con dialog `role="alertdialog"` deshabilitado offline (`useConnectivity` + `MSG_OFFLINE.requiresConnection`).
- Analytics: `EVT_ADMIN_IP_RATE_LIMIT_VIEWED` (+ `EVT_ADMIN_IP_RATE_LIMIT_RESET` si S2) en `src/constants/analyticsEvents/admin.ts`. Registrar en `GA4_EVENT_NAMES` (analyticsReport.ts) y `ga4FeatureDefinitions.ts`.

### S4 — Resolver el tipo `ip_rate_limit` muerto

Dos opciones; elegir UNA (decision de producto, ver Sofia):

- **Opcion A (emitir):** en `authBlocking.ts`, cuando `checkIpRateLimit` devuelve `exceeded`, escribir el `abuseLog` con `type: 'ip_rate_limit'` en vez de (o ademas de) `anon_flood`. Asi la categoria del panel recibe datos reales y el tipo deja de estar muerto. Ventaja: distingue semanticamente "umbral de flood detectado" (`anon_flood`, alerta) de "IP bloqueada por rate limit" (`ip_rate_limit`, accion tomada).
- **Opcion B (eliminar):** remover `'ip_rate_limit'` del enum en `abuseLogger.ts`, del `SEVERITY_MAP`, del enum en `src/types/admin.ts`, y de los maps de label/color en `src/constants/admin.ts`. Ventaja: menos superficie, una sola fuente de verdad (`anon_flood`).

Recomendacion: **Opcion A**, porque el inspector de S1 + S3 da sentido a que exista un tipo de alerta distinto para bloqueos por IP, y el cambio en `authBlocking.ts` es de una linea. Pero requiere actualizar el test del flujo `authBlocking` y posiblemente la doc de seguridad.

### Consideraciones de seguridad

- `_ipRateLimits` esta protegido en `firestore.rules` con `allow read, write: if false` — solo el admin SDK puede leerlo. Por eso el inspector DEBE pasar por un callable admin, nunca leer la coleccion desde el cliente. No se modifican las rules.
- Nunca exponer IPs raw: el doc ya solo guarda `ipHash`. El callable no debe re-derivar ni aceptar IPs.
- El reset (S2) es una accion privilegiada que debe quedar auditada via `abuseLog` (`config_edit`), igual que `adminResetRateLimit`.

### UX

- Vive dentro de la tab "Alertas" del admin (`/admin`), como cuarto subtab junto a Alertas / Reincidentes / Rate Limits. Cero navegacion nueva: el admin ya conoce el patron de subtabs.
- Flujo: admin abre Alertas → subtab "Rate Limits IP" → ve tabla de hashes con su contador y estado de ventana → (si S2) puede resetear una entrada con confirmacion.

---

## Scope

| Item | Prioridad | Esfuerzo |
|------|-----------|----------|
| S1 — callable `adminListIpRateLimits` + tipo backend + export | Alta | S |
| S3 — servicio frontend + tipo + subtab UI `IpRateLimitsSection` | Alta | M |
| S4 — resolver tipo `ip_rate_limit` (Opcion A o B) | Alta | S |
| S2 — callable `adminResetIpRateLimit` + boton reset UI | Media | S |
| Analytics events (viewed/reset) + registro en reportes GA4 | Media | S |
| Tests (callable, servicio, componente) | Alta | M |

**Esfuerzo total estimado:** M

---

## Out of Scope

- Cambiar la politica de rate limiting por IP (limites, ventana, bucketing IPv6) — solo se inspecciona lo que ya escribe `ipRateLimiter.ts`.
- Geolocalizacion o de-anonimizacion de IPs: el sistema es hash-only por diseno y asi se mantiene.
- Inspector de `_fanoutDedup` u otras colecciones internas (`_cronRuns` ya tiene su panel).
- Agregar `_ipRateLimits` a `src/config/collections.ts` (no es accedida desde el frontend; el acceso es 100% via callable). Si se agrega, debe ser solo como constante backend.

---

## Tests

### Archivos que necesitaran tests

| Archivo | Tipo | Que testear |
|---------|------|-------------|
| `functions/src/admin/ipRateLimits.ts` | Callable | assertAdmin rechaza no-admin; rate limit por admin; validacion de input (`action`/`ipHash`/`limit` clamp); mapeo de docs a `AdminIpRateLimitItem` con `windowActive` segun `date`; filtro por action/hash; catch → `HttpsError('internal')`; `trackFunctionTiming` invocado en ambos paths. Si S2: reset borra doc, escribe `abuseLog` config_edit, not-found cuando no existe |
| `src/services/admin/ipRateLimits.ts` | Service | wrappers llaman al callable correcto con payload correcto; propagan error; mapean `result.data.items` |
| `src/components/admin/alerts/IpRateLimitsSection.tsx` | Component | render de tabla; estado loading/error/empty via `AdminPanelWrapper`; emite `EVT_ADMIN_IP_RATE_LIMIT_VIEWED` una vez por mount; truncado de hash; (S2) dialog reset, disabled offline, toast success/error/already-reset |
| `functions/src/triggers/authBlocking.ts` (si Opcion A) | Trigger | el bloqueo por IP emite `abuseLog` con `type: 'ip_rate_limit'`; el umbral sigue emitiendo `anon_flood` |
| `src/constants/admin.ts` (si Opcion B) | Constants | ausencia del tipo no rompe el render del panel Alertas (cobertura via AbuseAlerts test existente) |

### Criterios de testing

- Cobertura >= 80% del codigo nuevo
- Tests de validacion para todos los inputs del usuario (action, ipHash regex, limit clamp, docId regex)
- Todos los paths condicionales cubiertos (filtro vs sin filtro, windowActive true/false, doc exists/not-found)
- Side effects verificados (abuseLog en reset, trackFunctionTiming, trackEvent)

---

## Seguridad

- [ ] El acceso a `_ipRateLimits` es 100% via callable admin — el cliente NUNCA lee la coleccion directamente (rules: `allow read, write: if false`, no se modifican)
- [ ] `adminListIpRateLimits` / `adminResetIpRateLimit` llaman `assertAdmin(auth)` antes de cualquier query
- [ ] App Check enforced server-side (`ENFORCE_APP_CHECK_ADMIN`)
- [ ] Rate limit por admin en ambos callables (30/dia list, 20/dia reset) via `checkCallableRateLimit`
- [ ] Inputs validados: `action` whitelist o string acotado, `ipHash` regex hex 16, `limit` clamp `[1,100]`, `docId` regex
- [ ] No se expone ninguna IP raw — solo `ipHash`. El callable no acepta ni deriva IPs
- [ ] Reset (S2) escribe `abuseLog` de tipo `config_edit` para audit trail

### Vectores de ataque automatizado

| Superficie | Ataque posible | Mitigacion requerida |
|-----------|---------------|---------------------|
| `adminListIpRateLimits` callable | usuario no-admin intenta scrapear hashes de IP / patrones de abuso | `assertAdmin` + App Check + rate limit 30/dia por admin |
| `adminResetIpRateLimit` callable | admin comprometido borra masivamente entradas para deshabilitar la proteccion anti-flood | rate limit 20/dia + `abuseLog` audit + `docId` regex (no wildcard delete) |
| Input `ipHash`/`action` | inyeccion para forzar query costosa o index scan | regex estricto + `limit` clamp + sin orderBy compuesto sin indice |

`_ipRateLimits` NO es escribible por usuarios (solo admin SDK desde `beforeUserCreated`), por lo que no aplican los checklists de create/update rules ni de rate limit de trigger — la coleccion ya tiene su escritura controlada server-side en `ipRateLimiter.ts`.

Este feature lee datos sensibles (hashes de IP + contadores de abuso). El acceso queda restringido a admin + rate-limit + audit. No hay scraping masivo posible para usuarios normales.

---

## Deuda tecnica y seguridad

Consultado: `gh issue list --label security --state open` y `--label "tech debt"` no devuelven resultados con esos labels exactos; los tech-debt activos usan `enhancement` y viven en #341-#349 + #168.

### Issues relacionados

| Issue | Relacion | Accion |
|-------|----------|--------|
| #348 (este) | resuelve | inspector `_ipRateLimits` + cierre del tipo `ip_rate_limit` muerto |
| #347 (perf — count queries sin `measureAsync`) | empeora si se ignora | el callable es backend, usa `trackFunctionTiming` (no `measureAsync`); no agrega count queries sin instrumentar |
| #342 (security — secrets en functions/.env) | no agrava | el feature no agrega env vars ni secrets nuevos |

### Mitigacion incorporada

- Cierre del tipo `ip_rate_limit` muerto (S4): elimina la inconsistencia entre enum backend, tipos frontend, constantes y call sites. Paso explicito en el plan de implementacion.
- El inspector cierra la asimetria detectada en #327 (donde `_rateLimits` quedo con inspector pero `_ipRateLimits` no).

---

## Robustez del codigo

### Checklist de hooks async

- [ ] `IpRateLimitsSection` usa `useAsyncData` (ya maneja cancelacion/cleanup) — no agregar `useEffect` con await crudo
- [ ] Handler de reset (si S2) tiene `try/catch` con `toast.error` y maneja el caso `not-found` como `toast.info`
- [ ] `logger.error` NUNCA dentro de `if (import.meta.env.DEV)` (callsite del catch del componente y del callable)
- [ ] Constantes de analytics nuevas en `constants/analyticsEvents/admin.ts`, no string literals
- [ ] Archivos nuevos no superan 300 lineas (`IpRateLimitsSection.tsx` puede compartir helpers con `RateLimitsSection` si crece)
- [ ] El emit de `EVT_ADMIN_IP_RATE_LIMIT_VIEWED` usa `useRef` para dedup una vez por mount (patron de `RateLimitsSection`)

### Checklist de observabilidad

- [ ] Callables nuevos incluyen `trackFunctionTiming('adminListIpRateLimits' / 'adminResetIpRateLimit', start)` en happy path y catch
- [ ] `EVT_ADMIN_IP_RATE_LIMIT_VIEWED` (+ reset) registrado en `GA4_EVENT_NAMES` (analyticsReport.ts) y `ga4FeatureDefinitions.ts`
- [ ] El servicio frontend no hace queries Firestore (solo `httpsCallable`), por lo que no requiere `measureAsync`

### Checklist offline

- [ ] El inspector es read-only-by-default; si el dato no carga offline, `AdminPanelWrapper` muestra error state (no skeleton infinito)
- [ ] Boton "Resetear" (S2) deshabilitado cuando `isOffline`, con tooltip `MSG_OFFLINE.requiresConnection`
- [ ] Error handler del catch muestra `toast.error` en todos los environments

### Checklist de documentacion

- [ ] No se agregan secciones a HomeScreen (es admin)
- [ ] Nuevos analytics events en `src/constants/analyticsEvents/admin.ts` (dominio, no barrel)
- [ ] Nuevo tipo `AdminIpRateLimitItem` en `src/types/admin.ts` (dominio admin)
- [ ] `docs/reference/features.md` actualizado: nuevo subtab "Rate Limits IP" en tab Alertas del admin
- [ ] `docs/reference/firestore.md` actualizado si se documenta la lectura admin de `_ipRateLimits`
- [ ] `docs/reference/security.md` actualizado: seccion "IP-based rate limiting" menciona el inspector y (Opcion A) el tipo `ip_rate_limit`
- [ ] `docs/reference/patterns.md`: la fila "Abuse alerts (admin)" / "Admin panel decomposition" puede mencionar el subtab IP si aporta

---

## Offline

### Data flows

| Operacion | Tipo (read/write) | Estrategia offline | Fallback UI |
|-----------|-------------------|-------------------|-------------|
| Listar `_ipRateLimits` via callable | read (callable) | sin persistencia offline — callable requiere red | `AdminPanelWrapper` error state con reintentar |
| Resetear IP rate limit (S2) | write (callable) | sin queue offline — accion admin critica + auditada | boton disabled offline + tooltip "Requiere conexion" |

### Checklist offline

- [ ] Reads via callable: no usan persistencia offline (callable). Error de red → error state visible
- [ ] Writes (reset): boton disabled offline, NO se encola (accion admin auditada, no apta para offline queue)
- [ ] APIs externas: ninguna nueva
- [ ] UI: indicador offline en el boton de reset (tooltip + disabled)
- [ ] Datos criticos: no aplica primera carga (panel admin, no flujo de usuario)

### Esfuerzo offline adicional: S

---

## Modularizacion y % monolitico

- Logica de negocio en callable backend + servicio frontend; el componente es shell sobre `useAsyncData` + `AdminPanelWrapper`.
- `IpRateLimitsSection` recibe datos via su propio servicio/hook, no se acopla a contexto de layout.
- Firebase SDK (`httpsCallable`) solo en `src/services/admin/ipRateLimits.ts`, nunca en el componente.
- Componente nuevo en `src/components/admin/alerts/` (dominio de su tab), NO en `menu/`.

### Checklist modularizacion

- [ ] Logica en callable + servicio, no inline en `AbuseAlerts`
- [ ] `IpRateLimitsSection` reutilizable (recibe sus datos via servicio propio)
- [ ] No se agregan `useState` de logica de negocio a AppShell/SideMenu (es admin)
- [ ] Props/handlers explicitos en el dialog de reset (sin noop `() => {}`)
- [ ] El componente NO importa `firebase/functions` directamente — solo el servicio
- [ ] Servicio nuevo en archivo de dominio `services/admin/ipRateLimits.ts` (no appendear a `rateLimits.ts`)
- [ ] Callable nuevo en `functions/src/admin/ipRateLimits.ts` (no appendear a `rateLimits.ts`)
- [ ] Ningun archivo nuevo supera 400 lineas (300 = warning); compartir helpers con `RateLimitsSection` si conviene
- [ ] Usa el contexto existente (`ToastContext`, `ConnectivityContext`) — no crea contexto nuevo

### Impacto en % monolitico

| Aspecto | Impacto | Justificacion |
|---------|---------|---------------|
| Acoplamiento de componentes | = | componente aislado en `admin/alerts/`, espejo de `RateLimitsSection` |
| Estado global | = | usa Toast/Connectivity existentes, sin god-context |
| Firebase coupling | = | `httpsCallable` solo en servicio; componente desacoplado |
| Organizacion por dominio | = | archivos en carpetas correctas (admin/alerts, services/admin, functions/admin) |

---

## Accesibilidad y UI mobile

### Checklist de accesibilidad

- [ ] El `<Tab>` "Rate Limits IP" hereda la semantica de tablist de MUI Tabs (igual que los 3 subtabs existentes)
- [ ] Boton "Resetear" (S2) tiene `aria-label` descriptivo con el hash truncado y la accion
- [ ] Dialog de reset usa `role="alertdialog"` + `aria-labelledby`/`aria-describedby` (patron de `RateLimitsSection`)
- [ ] Touch targets >= 44px (`minHeight: 44` en botones, igual que `RateLimitsSection`)
- [ ] Tabla con error state via `AdminPanelWrapper` (no skeleton infinito)
- [ ] `Tooltip` sobre el hash truncado con el valor completo

### Checklist de copy

- [ ] Textos en espanol con tildes correctas ("Acción", "Estado", "Activa"/"Expirada")
- [ ] Voseo donde aplique (es panel admin, mayormente labels)
- [ ] Terminologia consistente con `RateLimitsSection`
- [ ] Aclaracion visible de que se muestra un hash de IP, no la IP real (caption)
- [ ] Mensajes de error accionables (reusar `MSG_ADMIN`/`MSG_OFFLINE` o agregar al dominio admin si falta)

---

## Success Criteria

1. El admin puede ver, dentro de la tab Alertas (subtab "Rate Limits IP"), las entradas de `_ipRateLimits` con hash de IP, accion, fecha, contador y estado de ventana — sin exponer ninguna IP raw.
2. El acceso pasa exclusivamente por un callable admin (`assertAdmin` + App Check + rate limit + audit), sin lecturas directas del cliente a `_ipRateLimits`.
3. El tipo `ip_rate_limit` deja de ser codigo muerto: o bien `authBlocking.ts` lo emite en bloqueos por IP (Opcion A), o se elimina de enum/tipos/constantes (Opcion B) — sin dejar inconsistencias.
4. (Si S2) El admin puede resetear una entrada de IP rate limit con confirmacion, accion auditada en `abuseLogs`, deshabilitada offline.
5. Cobertura de tests >= 80% del codigo nuevo (callable, servicio, componente), con todos los paths condicionales y side effects verificados.


## Validacion Funcional (Gate Sofia)

**Estado:** VALIDADO CON OBSERVACIONES
**Fecha:** 2026-06-10
**Revisor:** Sofia (analista funcional)

**Observaciones clave (detalle completo incorporado a specs):** Recomendado: incluir S2 (reset callable) in-scope y Opcion A (emitir ip_rate_limit). La Opcion B subestima superficie: falta alertsHelpers.ts (SEVERITY_MAP:17 + ALL_TYPES:39). Ruta real: AbuseAlerts.tsx en admin/ (no alerts/). El subtab es union type en 2 lugares. Replicar el patron de saltar orderBy cuando hay filtro (sin indice).
