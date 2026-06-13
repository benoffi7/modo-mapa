# Plan: Inspector admin de `_ipRateLimits` + cierre del tipo `ip_rate_limit` muerto

**Specs:** [specs.md](specs.md)
**PRD:** [prd.md](prd.md)
**Issue:** #348
**Fecha:** 2026-06-12

---

## Implementacion recomendada

**Agente unico (luna o nico).** El feature toca backend (`functions/src/admin/`, `functions/src/triggers/authBlocking.ts`, `functions/src/index.ts`, `analyticsReport.ts`) y frontend (`services/admin/`, `components/admin/`, `types/admin.ts`, `constants/`), pero el flujo es secuencial-friendly y es un espejo verificado del patron #327 (`rateLimits.ts` / `RateLimitsSection.tsx` / `AbuseAlerts.tsx`). No hay riesgo de overlap que justifique paralelizar.

Si manu decide paralelizar, file ownership por workstream:

- **Backend:** `functions/src/admin/ipRateLimits.ts`, `functions/src/admin/analyticsReport.ts`, `functions/src/triggers/authBlocking.ts`, `functions/src/index.ts`
- **Frontend:** `src/services/admin/`, `src/components/admin/`, `src/types/admin.ts`, `src/constants/`

> **Boundary critica entre workstreams:** el tipo backend `AdminIpRateLimitItem` y el frontend mirror deben quedar identicos en shape. Si se paraleliza, congelar el shape del tipo en Fase 1 antes de abrir ambos workstreams.

**Estimacion total: M.** Detalle por fase en la columna "Estimacion" de cada tabla.

---

## Observaciones de Diego incorporadas (gate tecnico)

Dos observaciones no-bloqueantes del sello Diego (specs.md, "Revisión Técnica"), reflejadas como pasos/tests explicitos en este plan:

1. **`orderBy('date','desc')` sin tie-breaker** — cuando NO hay filtro, todos los docs de la misma `date` (los de hoy) carecen de orden estable entre hashes. Es aceptable para un inspector admin de bajo volumen con `limit`, pero el plan documenta que **el orden intra-dia es no-deterministico** y NO introduce un `orderBy` compuesto (requeriria indice). Ver Fase 2 paso 1 (comentario en codigo) y Decisiones tecnicas en specs.
2. **Parseo del docId `{ipHash}_{action}_{date}`** — `action` (`'anon_create'`) contiene underscore; el helper `parseIpRateLimitDocId` separa por `_` tomando primer segmento=`ipHash`, ultimo=`date`, y el medio (join) = `action`. Un split naive por `_` fallaria. El plan incluye un **test explicito con action multi-segmento**. Ver Fase 2 paso 4 (test).

---

## Fases de implementacion

### Fase 1: Tipos, constantes, mensajes y registro GA4 (foundational, sin UI)

**Branch:** `feat/348-admin-ip-rate-limits-inspector`
**Estimacion:** S (~1h)

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `src/types/admin.ts` | Agregar `interface AdminIpRateLimitItem { docId; ipHash; action; date; count; windowActive }` (mirror exacto del backend, ver specs "Tipo frontend nuevo"). Doc-comment indicando que debe mantenerse en sync con `functions/src/admin/ipRateLimits.ts` |
| 2 | `src/constants/analyticsEvents/admin.ts` | Agregar `EVT_ADMIN_IP_RATE_LIMIT_VIEWED = 'admin_ip_rate_limit_viewed'` y `EVT_ADMIN_IP_RATE_LIMIT_RESET = 'admin_ip_rate_limit_reset'` bajo comentario `// #348 — IP rate limits inspector` |
| 3 | `src/constants/messages/admin.ts` | Extender `MSG_ADMIN` con `ipRateLimitResetSuccess = 'Reseteado correctamente'`, `ipRateLimitResetError = 'No se pudo resetear. Verificá tu sesión admin.'`, `ipRateLimitAlreadyReset = 'Esta entrada ya fue reseteada por otro admin. Refrescamos la tabla.'` (seccion `// #348 — IP rate limits inspector`) |
| 4 | `functions/src/admin/analyticsReport.ts` | En el array `GA4_EVENT_NAMES` (~149-152, seccion Admin tools): agregar `'admin_ip_rate_limit_viewed'` y `'admin_ip_rate_limit_reset'`. **Registro upfront** para evitar la ventana de evento huerfano (mismo principio que #327): si Fase 4 mergeara antes que este registro, los eventos quedarian huerfanos transitoriamente |
| 5 | `src/components/admin/features/ga4FeatureDefinitions.ts` | Card `admin_metrics` (~194): agregar `'admin_ip_rate_limit_viewed'` y `'admin_ip_rate_limit_reset'` a su `eventNames`. **Registro upfront en frontend** para simetria con backend |

### Fase 2: Callable backend `adminListIpRateLimits` + `adminResetIpRateLimit`

**Estimacion:** M (~2-3h)

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `functions/src/admin/ipRateLimits.ts` (nuevo) | Crear `adminListIpRateLimits` (espejo de `adminListRateLimits`): `onCall` con `enforceAppCheck: ENFORCE_APP_CHECK_ADMIN`, `timeoutSeconds: 30`; `assertAdmin`; validacion `action` (`/^[a-z0-9_]{1,40}$/`), `ipHash` (`/^[a-f0-9]{16}$/`, NO acepta IP raw), `limit` clamp `[1,100]` default 50; `checkCallableRateLimit(db, 'admin_ip_rate_limits_'+uid, 30, uid)`; query sin indice compuesto (`where('ipHash')` simple / `where('action')` simple / `orderBy('date','desc')` solo sin filtro; filtro `action` client-side post-fetch si ambos presentes); mapeo a `AdminIpRateLimitItem[]` con `windowActive = (date === new Date().toISOString().slice(0,10))`; `trackFunctionTiming('adminListIpRateLimits', start)` happy+catch; catch `captureException`+`logger.error`+`HttpsError('internal')`. **Comentario en el `orderBy('date','desc')`: orden intra-dia no-deterministico entre hashes; NO agregar orderBy compuesto (Diego obs #1)** |
| 2 | `functions/src/admin/ipRateLimits.ts` | Agregar `adminResetIpRateLimit` (espejo de `adminResetRateLimit`): `assertAdmin`; `DOC_ID_REGEX = /^[a-zA-Z0-9_-]{1,200}$/` (constante local duplicada, NO importar la privada de `rateLimits.ts` — regla no-append); `checkCallableRateLimit(db, 'admin_ip_rate_limit_reset_'+uid, 20, uid)`; `get` doc → `not-found` si no existe → `delete()`; `logAbuse` `type:'config_edit'`, `collection:'_ipRateLimits'`, `detail: JSON.stringify({ action:'reset_ip_rate_limit', docId, ipHash, ipAction })`; `trackFunctionTiming('adminResetIpRateLimit', start)` ambos paths |
| 3 | `functions/src/admin/ipRateLimits.ts` | Agregar helper `parseIpRateLimitDocId(docId)`: split por `_`, `ipHash` = `parts[0]`, `date` = `parts[parts.length-1]`, `action` = `parts.slice(1,-1).join('_')`. Best-effort para el audit detail (Diego obs #2). Documentar que `action` puede ser multi-segmento |
| 4 | `functions/src/admin/__tests__/ipRateLimits.test.ts` (nuevo) | Tests segun specs. **Incluir explicitamente:** (a) `parseIpRateLimitDocId` con `action` multi-segmento (`a1b2c3d4e5f60718_anon_create_2026-06-10` → `ipHash:'a1b2c3d4e5f60718'`, `action:'anon_create'`, `date:'2026-06-10'`) — un split naive por `_` fallaria (Diego obs #2); (b) `assertAdmin` rechaza no-admin; (c) rate limit invocado (`admin_ip_rate_limits_{uid}` 30 / reset 20); (d) regex `action`/`ipHash`/`docId` invalido → `invalid-argument`; (e) `limit` clamp+default; (f) `windowActive` true (date==hoy) y false; (g) filtro `action` (where), `ipHash` (where + action client-side), sin filtro (orderBy date desc); (h) reset borra doc + escribe `abuseLog` config_edit; (i) `not-found`; (j) catch → `HttpsError('internal')`; (k) `trackFunctionTiming` happy+catch |
| 5 | `functions/src/index.ts` | `export { adminListIpRateLimits, adminResetIpRateLimit } from './admin/ipRateLimits';` |

### Fase 3: Servicio frontend (wrappers httpsCallable)

**Estimacion:** S (~1h)

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `src/services/admin/ipRateLimits.ts` (nuevo) | Crear `listAdminIpRateLimits({ action?, ipHash?, limit? })` (arma request solo con campos definidos, mapea `result.data.items`) y `resetAdminIpRateLimit(docId)`, espejo de `services/admin/rateLimits.ts`. Solo `httpsCallable` — sin queries Firestore, sin `measureAsync` |
| 2 | `src/services/admin/index.ts` | Agregar `export { listAdminIpRateLimits, resetAdminIpRateLimit } from './ipRateLimits';` al final del barrel (vecino a linea 56) |
| 3 | `src/services/admin/__tests__/ipRateLimits.test.ts` (nuevo) | Test de wiring: `listAdminIpRateLimits` llama `'adminListIpRateLimits'` con payload solo de campos definidos + mapea `result.data.items`; `resetAdminIpRateLimit` llama `'adminResetIpRateLimit'` con `{ docId }`; ambos propagan error |

### Fase 4: Componente `IpRateLimitsSection` + integracion en `AbuseAlerts`

**Estimacion:** L (~3-4h)

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `src/components/admin/alerts/IpRateLimitsSection.tsx` (nuevo) | Implementar segun specs (espejo de `RateLimitsSection.tsx`, sin props): state `actionFilter`/`ipHashFilter` con `useDeferredValue`; `useAsyncData(fetcher)`; emit `EVT_ADMIN_IP_RATE_LIMIT_VIEWED` 1x por mount via `useRef` (primer load exitoso); caption "Se muestra un hash SHA-256 de la IP, no la dirección real."; tabla MUI (IP Hash con `Tooltip`+truncado, Acción `Chip`, Fecha, Count align-right, Estado `Activa`/`Expirada` por `windowActive`, boton Resetear `color="error"` `minHeight:44` `aria-label` con hash+accion, `disabled={isOffline}` + `Tooltip` `MSG_OFFLINE.requiresConnection`); Dialog `role="alertdialog"` + `aria-labelledby`/`aria-describedby`, body condicional segun `windowActive`; `handleConfirmReset` try/catch: success → `MSG_ADMIN.ipRateLimitResetSuccess` + `trackEvent(EVT_ADMIN_IP_RATE_LIMIT_RESET,{action})` + refetch; `not-found` (`isAlreadyResetError` local) → `toast.info(MSG_ADMIN.ipRateLimitAlreadyReset)` + refetch; otro → `logger.error` + `toast.error(MSG_ADMIN.ipRateLimitResetError)`. Boton confirmar `disabled={submitting || isOffline}` |
| 2 | `src/components/admin/AbuseAlerts.tsx` | 4 puntos de cambio (lineas verificadas): (a) **L32** union type → `useState<'alerts'\|'reincidentes'\|'rateLimits'\|'ipRateLimits'>('alerts')`; (b) **L33** `useAbuseLogsRealtime(200, innerTab !== 'rateLimits' && innerTab !== 'ipRateLimits')`; (c) **L157** `const isRateLimitsTab = innerTab === 'rateLimits' \|\| innerTab === 'ipRateLimits';` (tab que no usa abuseLogs → suprime loading/error/KPIs); (d) **L174** ampliar el tipo del callback `onChange` con `'ipRateLimits'`, agregar `<Tab value="ipRateLimits" label="Rate Limits IP" />` despues del de "Rate Limits", y `{innerTab === 'ipRateLimits' && <IpRateLimitsSection />}`. Import `import IpRateLimitsSection from './alerts/IpRateLimitsSection';` |
| 3 | `src/components/admin/alerts/__tests__/IpRateLimitsSection.test.tsx` (nuevo) | Tests segun specs: render tabla; loading/error/empty via `AdminPanelWrapper`; `EVT_ADMIN_IP_RATE_LIMIT_VIEWED` 1x por mount; truncado de hash + `Tooltip`; dialog reset (open/confirm); boton disabled offline (`useConnectivity` mock); toast success/error/already-reset (`not-found`); filtro action/ipHash |
| 4 | `src/components/admin/__tests__/AbuseAlerts.test.tsx` (modificar) | Agregar casos: el subtab "Rate Limits IP" se renderiza y monta `IpRateLimitsSection`; `useAbuseLogsRealtime` se suspende (enabled=false) en ese subtab; volver a "alerts" re-suscribe. Si el archivo no existe aun, crearlo `(nuevo)` |

### Fase 5: Emitir tipo `ip_rate_limit` en `authBlocking` (S4 — Opcion A)

**Estimacion:** S (~1h)

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `functions/src/triggers/authBlocking.ts` | En el bloque `if (exceeded)` (~65-73): cambiar `type` del `logAbuse` de `'anon_flood'` a `'ip_rate_limit'`, conservando `severity: 'high'` explicito y agregando `collection: '_ipRateLimits'`. El bloque del umbral (`currentCount >= ANON_FLOOD_ALERT_THRESHOLD`, ~49-56) **NO cambia**: sigue emitiendo `anon_flood` con su `severity: 'medium'`. Sin tocar `abuseLogger.ts`/`alertsHelpers.ts`/`types/admin.ts`/`constants/admin.ts` (el tipo ya existe en los 4) |
| 2 | `functions/src/__tests__/triggers/authBlocking.test.ts` (modificar) | Agregar/ajustar casos: el bloqueo por IP (`exceeded`) emite `abuseLog` con `type:'ip_rate_limit'` y `severity:'high'`; el umbral (`currentCount >= threshold`) sigue emitiendo `anon_flood` `severity:'medium'`; ambos coexisten en el flujo de exceso. Verificar que no se rompan los asserts existentes que esperaban `anon_flood` en el bloqueo |

### Fase 6: Documentacion (OBLIGATORIA)

**Estimacion:** S (~1h)

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `docs/reference/security.md` | Tabla "Rate limiting server-side (callables)": agregar `adminListIpRateLimits` (30/dia, `admin_ip_rate_limits_{uid}`) y `adminResetIpRateLimit` (20/dia, `admin_ip_rate_limit_reset_{uid}`). En la seccion "IP-based rate limiting": mencionar el inspector admin y (Opcion A) que `authBlocking` emite `ip_rate_limit` (severity high) en el bloqueo, distinto de `anon_flood` (umbral) |
| 2 | `docs/reference/features.md` | Tab admin "Alertas" → mencionar el cuarto subtab "Rate Limits IP" (inspector hash-only + reset auditado) |
| 3 | `docs/reference/firestore.md` | Documentar que `_ipRateLimits` se lee exclusivamente via callable admin (Admin SDK); rules `allow read, write: if false` sin cambios. Verificar que no falte la coleccion en el doc |
| 4 | `docs/reference/patterns.md` | Verificar: reusa "Admin panel pattern" / "Abuse alerts (admin)" existentes. Agregar fila del subtab IP solo si aporta. Probable no-op |
| 5 | `docs/reference/project-reference.md` | Actualizar **solo el resumen de features** (inspector `_ipRateLimits` + cierre del tipo `ip_rate_limit` muerto). El bump de version/fecha lo hace `/merge` |
| 6 | `docs/_sidebar.md` | Agregar entradas Specs y Plan bajo "#348 admin-ip-rate-limits-inspector" (verificado: aun no estan registradas) |

---

## Estimacion de tamano de archivos

| Archivo | Lineas estimadas | Status |
|---------|-----------------|--------|
| `functions/src/admin/ipRateLimits.ts` (nuevo) | ~150 (list + reset + helper + regex) | ideal |
| `src/services/admin/ipRateLimits.ts` (nuevo) | ~52 (espejo de `rateLimits.ts`) | ideal |
| `src/components/admin/alerts/IpRateLimitsSection.tsx` (nuevo) | ~230 (espejo de `RateLimitsSection`, 253) | aceptable |
| `src/components/admin/AbuseAlerts.tsx` (modificado) | actual → +~10 | aceptable |
| `functions/src/triggers/authBlocking.ts` (modificado) | +~2 lineas | ideal |
| `src/types/admin.ts` (modificado) | +~12 | ideal |
| `src/constants/messages/admin.ts` / `analyticsEvents/admin.ts` (modificado) | +~6 c/u | ideal |

Ningun archivo supera 400 lineas. Plan B para `IpRateLimitsSection.tsx` si excede 300: extraer `parseAndTruncateHash`/`isAlreadyResetError` a helper local en `alerts/` (sin acoplar a `RateLimitsSection` por worktree boundary).

---

## Orden de implementacion

Dependency chain:

1. **Fase 1** (tipos + constantes + mensajes + registro GA4) — sin dependencias upstream. Congela el shape de `AdminIpRateLimitItem`. Habilita typing en Fases 2-4.
2. **Fase 2** (callable backend) — depende de Fase 1 (mismo shape de tipo, conceptualmente). Habilita Fase 3.
3. **Fase 3** (servicio frontend) — depende de Fase 1 (tipo) y Fase 2 (callable existe para wiring de tests). Habilita Fase 4.
4. **Fase 4** (`IpRateLimitsSection` + integracion `AbuseAlerts`) — depende de Fases 1, 3.
5. **Fase 5** (emitir `ip_rate_limit` en `authBlocking`) — **independiente** de las anteriores; puede correr en paralelo o al final. No depende del inspector.
6. **Fase 6** (docs) — al final, recoge cambios reales.

---

## Riesgos

1. **`orderBy('date','desc')` sin tie-breaker → orden intra-dia no-deterministico** (Diego obs #1). Mitigacion: documentado en codigo y en specs; inspector de bajo volumen con `limit`; NO se agrega orderBy compuesto (evita indice). Si en QA molesta, el filtro por `ipHash`/`action` da orden estable por subconjunto.
2. **Parseo del docId con `action` multi-segmento** (Diego obs #2). Mitigacion: `parseIpRateLimitDocId` separa por primer/ultimo segmento con join del medio; test explicito en Fase 2 paso 4. El `action` del audit es best-effort (ya declarado en specs).
3. **`authBlocking.test.ts` rompe asserts que esperaban `anon_flood` en el bloqueo.** Mitigacion: Fase 5 paso 2 ajusta esos asserts a `ip_rate_limit`+`severity:high` y mantiene los del umbral en `anon_flood`. Revisar el test existente antes de editar el trigger.
4. **`copy-auditor` flagea textos nuevos.** Mitigacion: los 3 mensajes centralizados en `MSG_ADMIN` con tildes/voseo verificados; ejecutar el agente antes del merge.

---

## Rollback strategy

Acoplamiento entre fases para revert (en caso de regresion en produccion):

- **Fase 1 (constantes/types/messages/registro GA4)** — rollback-safe individualmente. Si se revierte, las fases 2-4 que dependen del tipo y los eventos quedan rotas en build; en la practica conviene revertir junto con lo posterior.
- **Fase 2 (callable backend)** — rollback-safe individualmente. Sin consumidores hasta Fase 3 (servicio) y Fase 4 (UI). Revertir aislado solo afecta el export en `index.ts` (eliminar tambien).
- **Fase 3 (servicio frontend)** — **acoplado con Fase 2** (los wrappers llaman a los callables `adminListIpRateLimits`/`adminResetIpRateLimit`). Revertir Fase 2 sin Fase 3 deja el servicio llamando a un callable inexistente. Revertir juntos.
- **Fase 4 (`IpRateLimitsSection` + `AbuseAlerts`)** — depende de Fases 1 y 3. Rollback: Fase 4 sola es segura (el subtab desaparece, el resto de `AbuseAlerts` queda intacto). Si se revierte mas abajo, revertir 4 primero.
- **Fase 5 (`authBlocking` emite `ip_rate_limit`)** — **independiente y rollback-safe individualmente.** Revertir restaura `anon_flood` en el bloqueo. No afecta al inspector (que lee `_ipRateLimits`, no `abuseLogs`). El tipo `ip_rate_limit` vuelve a quedar "muerto" pero sin romper nada.
- **Fase 6 (docs)** — rollback-safe trivialmente.

**Recomendacion: merge unificado** en una sola PR/branch. Evita ventanas donde la UI (Fase 4) este sin el callable (Fase 2), o donde los eventos se emitan sin estar registrados en `GA4_EVENT_NAMES` (Fase 1 los registra upfront).

---

## Guardrails de modularidad

- [x] `IpRateLimitsSection` NO importa `firebase/functions` ni `firebase/firestore` — solo via `services/admin/ipRateLimits.ts` (barrel).
- [x] Archivos nuevos en carpeta de dominio correcta (`components/admin/alerts/`, `services/admin/`, `functions/src/admin/`), NO en `components/menu/`.
- [x] Logica de negocio en callable + servicio. El componente es shell sobre `useAsyncData` + `AdminPanelWrapper`.
- [x] No-append: callable y servicio en archivos nuevos `ipRateLimits.ts`; `DOC_ID_REGEX`/`isAlreadyResetError` se duplican localmente (no se importan los privados de `rateLimits.ts`).
- [x] Ningun archivo resultante supera 400 lineas (plan B documentado para `IpRateLimitsSection`).
- [x] Usa contextos existentes (`ToastContext`, `ConnectivityContext`) — no crea god-context.

## Guardrails de seguridad

- [x] Sin cambios en Firestore rules — `_ipRateLimits` sigue `allow read, write: if false`. Acceso 100% Admin SDK via callable.
- [x] Ambos callables: `assertAdmin` antes de cualquier query + App Check (`ENFORCE_APP_CHECK_ADMIN`).
- [x] Rate limit por admin: 30/dia (list), 20/dia (reset) via `checkCallableRateLimit`.
- [x] Inputs validados: `action` (`/^[a-z0-9_]{1,40}$/`), `ipHash` (`/^[a-f0-9]{16}$/`, no acepta IP raw), `limit` clamp `[1,100]`, `docId` (`/^[a-zA-Z0-9_-]{1,200}$/`, sin wildcard delete).
- [x] No se expone ninguna IP raw — solo `ipHash`. El callable no acepta ni deriva IPs.
- [x] Reset escribe `abuseLog` `config_edit` para audit trail.
- [x] Sin `orderBy` compuesto sin indice (mitiga query costosa por input).
- [x] No hay secrets/admin emails/credenciales en archivos commiteados.
- [x] `getCountFromServer`: n/a — sin reads de count.

## Guardrails de observabilidad

- [x] Callables nuevos incluyen `trackFunctionTiming('adminListIpRateLimits'/'adminResetIpRateLimit', start)` en happy path y catch.
- [x] Trigger modificado (`authBlocking`) ya tiene su instrumentacion existente; el cambio es solo el `type`/`severity` del `abuseLog`.
- [x] Servicio frontend NO hace queries Firestore — solo `httpsCallable`. `measureAsync` no aplica.
- [x] `admin_ip_rate_limit_viewed` y `_reset` registrados en `GA4_EVENT_NAMES` (Fase 1 paso 4, upfront) y en `ga4FeatureDefinitions.ts` card `admin_metrics` (Fase 1 paso 5).
- [x] `logger.error` NUNCA dentro de `if (import.meta.env.DEV)` — handler de reset y catch del callable lo emiten siempre (Sentry).

## Guardrails de accesibilidad y UI

- [x] Boton "Resetear" tiene `aria-label` descriptivo con hash truncado + accion.
- [x] Sin `<Typography onClick>` ni `<Box onClick>` — botones MUI.
- [x] Touch targets `minHeight: 44`.
- [x] Componente con fetch tiene error state via `AdminPanelWrapper` (no skeleton infinito).
- [x] `<img>` con URL dinamica: n/a.
- [x] `httpsCallable` user-facing con guard offline (`useConnectivity`): boton + confirmar disabled offline.
- [x] Dialog destructivo con `role="alertdialog"` + `aria-labelledby`/`aria-describedby`.
- [x] `Tooltip` sobre el hash truncado con valor completo.

## Guardrails de copy

- [x] Voseo en mensajes accionables ("Verificá").
- [x] Tildes correctas: "acción", "sesión", "dirección", "día", "expiró".
- [x] Terminologia consistente con `RateLimitsSection` (Count, Resetear, Activa/Expirada).
- [x] Strings reutilizables en `src/constants/messages/admin.ts` (`MSG_ADMIN`).
- [x] Pasar `copy-auditor` antes del merge.

---

## Criterios de done

- [ ] Todos los items del scope del PRD implementados (S1, S2 in-scope, S3, S4 Opcion A).
- [ ] Tests pasan con >= 80% coverage en codigo nuevo, incluyendo el test de `parseIpRateLimitDocId` con action multi-segmento (Diego obs #2).
- [ ] Sin lint errors. `pre-staging-check.sh` pasa.
- [ ] Build succeeds (`tsc -b && vite build`) + `cd functions && npm run build`.
- [ ] Seed data: n/a (sin cambios de schema; `_ipRateLimits` ya existe y la puebla `ipRateLimiter.ts`).
- [ ] Privacy policy: n/a (sin nueva recoleccion; hash-only existente).
- [ ] Reference docs actualizados: `security.md`, `features.md`, `firestore.md`, `project-reference.md`.
- [ ] Sidebar actualizado con Specs y Plan.
- [ ] `copy-auditor` ejecutado sin findings sobre los 3 mensajes nuevos.
- [ ] Smoke manual en emulador: subtab "Rate Limits IP" lista, filtra por action/ipHash y resetea con confirmacion; boton reset disabled offline; bloqueo por IP forzado emite `abuseLog` `ip_rate_limit`.

---

## Validacion de Plan

**Validador:** Pablo (Delivery Lead — Modo Mapa)
**Estado:** VALIDADO CON OBSERVACIONES
**Fecha:** 2026-06-12
**Ciclo:** 1

**Observaciones para el implementador:**

1. **Merge unificado, no parcial.** El plan ya lo recomienda y lo comparto: una sola PR/branch. Las Fases 2 (callable) y 3 (servicio) estan acopladas para rollback — el servicio llama a un callable que debe existir. No mergear Fase 3 sin Fase 2 en el mismo push. Si se splitea por algun motivo, Fase 2 va primero y sola.

2. **Agente unico es la opcion correcta.** El feature es secuencial-friendly y espejo verificado del #327. Si manu decide paralelizar backend/frontend igual, el unico punto de contacto es el shape de `AdminIpRateLimitItem`: congelarlo en Fase 1 antes de abrir ambos workstreams (el plan ya lo marca como boundary critica). No hay otro overlap de archivos entre workstreams.

3. **Tests en el paso de la feature, ya agendado.** Verifique que el test de `parseIpRateLimitDocId` con action multi-segmento (Diego obs #2) esta en Fase 2 paso 4, y el de regresion de `authBlocking` (que rompe asserts que esperaban `anon_flood` en el bloqueo) esta en Fase 5 paso 2. Confirmado contra el codigo: el bloque `exceeded` real (authBlocking.ts L65-73) emite hoy `anon_flood`/`severity:'high'`; el implementador DEBE ajustar ese assert existente, no solo agregar uno nuevo.

4. **Ampliar mock de test existente.** `src/components/admin/__tests__/AbuseAlerts.test.tsx` ya mockea `services/admin` con `listAdminRateLimits`/`resetAdminRateLimit`. Fase 4 paso 4 debe agregar `listAdminIpRateLimits`/`resetAdminIpRateLimit` a ese mock, o el render del nuevo subtab fallara. El plan dice "modificar" — correcto, no crear.

5. **`orderBy('date','desc')` sin tie-breaker: punto cerrado, no introducir orderBy compuesto.** Verifique que el callable real espejo (`rateLimits.ts` L125-130) usa `orderBy('resetAt','desc')` solo sin filtro; el plan adapta a `orderBy('date','desc')` y documenta el orden intra-dia no-deterministico en codigo (Fase 2 paso 1) y riesgos. No agregar indice compuesto. Cerrado.

6. **Referencias de linea menores (no bloqueante):** el plan cita `GA4_EVENT_NAMES ~149-152`; el array real termina en `'admin_rate_limit_viewed'` cerca de L152 (la seccion "Admin tools" arranca en L144). Y el sidebar #348 confirmado ausente — Fase 6 paso 6 lo agenda bien. Son refs cosmeticas; agregar al final del array/seccion correcta, no en el numero exacto.

**Sin BLOQUEANTES ni IMPORTANTES abiertos.** Orden logico correcto (infra->backend->servicio->UI->trigger independiente->docs), granularidad commit-por-paso, ningun archivo >400 lineas, risk staging sano (sin schema/rules/migrations; el cambio de mayor riesgo —trigger— aislado en Fase 5 e independiente), rollback por fase documentado con acoplamientos identificados, estimacion (S+M+S+L+S+S = M) coincide con el PRD. Listo para implementacion.
