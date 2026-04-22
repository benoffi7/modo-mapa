# PRD: Admin metrics — listItems / _rateLimits visibility + admin event tracking

**Feature:** 310-admin-metrics-gaps
**Categoria:** admin
**Fecha:** 2026-04-18
**Issue:** #310
**Prioridad:** Media

---

## Contexto

El reporte `/health-check` del 2026-04-18 identifico gaps de observabilidad en el dashboard admin (`/admin`, 17 tabs). La app tiene 28 colecciones con visibilidad, pero dos colecciones sensibles a soporte y deteccion de abuso no son inspectables por el admin: `listItems` (solo agregados via `fetchListStats`) y `_rateLimits` (sin acceso alguno). Adicionalmente, 3 eventos analytics internos de admin (`admin_config_viewed`, `admin_moderation_updated`, `admin_activity_feed_diag`) estan declarados en `src/constants/analyticsEvents/admin.ts` y se emiten desde `ConfigPanel.tsx` y `ActivityFeedDiag.tsx`, pero no estan registrados en `GA4_EVENT_NAMES` de `functions/src/admin/analyticsReport.ts` ni en `GA4_FEATURE_CATEGORIES` de `ga4FeatureDefinitions.ts`, por lo que el propio dashboard de Funcionalidades no los cuenta.

## Problema

- **Soporte ciego a problemas de listas:** cuando un usuario reporta que un item aparece/desaparece de una lista colaborativa, el admin solo ve contadores agregados. No puede auditar items puntuales de una lista, ver quien los agrego (`addedBy`), ni detectar corrupciones o abuso de editores.
- **Rate limits invisibles:** cuando un usuario reporta estar bloqueado (ej: "no puedo comentar"), el admin no tiene forma de ver el doc `_rateLimits/{category}_{userId}` para confirmar el bloqueo, su ventana (`resetAt`), ni el count actual. Diagnostico por logs de Sentry es el unico recurso.
- **Drift de analytics admin-tool:** los 3 eventos `admin_*` no se propagan a GA4 reports. El dashboard de Funcionalidades no puede medir adopcion interna de tools admin ni detectar anomalias (ej: edicion masiva de `bannedWords`).
- **Nota del issue invalida:** el reporte original afirmaba que `fetchLatestRanking` y `fetchTrendingCurrent` son "orphaned services". Verificacion directa: ambos son consumidos por `CronHealthSection.tsx` (lineas 26-27) desde el merge de #257. No es un gap real — ajustar PRD para no incluirlos.

## Solucion

### S1 — Inspector de listItems (admin-only)

- Agregar seccion "Items por lista" al panel `FeaturedListsPanel` (ya tiene listado de listas y expansion por lista).
- Ampliar el expansion actual para mostrar:
  - Nombre del comercio (`getBusinessName(businessId)`).
  - `addedBy` resuelto a displayName via `fetchUserDisplayNames([uid])`.
  - Fecha de agregado (`formatDateShort(createdAt)`).
  - Chip "Editor" si `addedBy !== list.ownerId`.
- Accion admin: boton "Eliminar item" con confirmacion. Usa `deleteDoc(listItems/{id})` via servicio nuevo `deleteListItemAsAdmin`. Reglas actuales ya permiten delete al owner/editor — requerira relax para admin O una Cloud Function callable `adminDeleteListItem` que verifique `isAdmin()` y ejecute via Admin SDK.
- **Preferir callable** para no ampliar rules (menos superficie). Analytics: `admin_list_item_deleted`.
- Alternativa lightweight: solo lectura en M0 (sin delete), agregar delete en fase posterior si se necesita. **Elegimos lightweight primero** para minimizar riesgo.

### S2 — Inspector de _rateLimits

- Nueva seccion "Rate limits activos" en `AbuseAlerts` (tab Alertas) — es el lugar natural ya que ambos tratan abuso.
- Cloud Function callable nueva: `adminListRateLimits({ userId?: string, limit?: number = 50 })` — admin-only. Lee docs de `_rateLimits/*` via Admin SDK, filtra por userId si se pasa.
- Respuesta: array `[{ docId, category, userId, count, resetAt, windowActive }]`. `category` deriva del docId prefix (ej: `comments`, `commentLikes_50d`, `backup`, `perf`, `delete`, `clean`, `editors_invite`, `editors_remove`, `sharedLists`).
- UI: tabla con filtro por userId (input texto) y categoria. Muestra tiempo relativo a `resetAt`. Accion admin: boton "Resetear" (elimina el doc para desbloquear al usuario) con confirmacion. Analytics: `admin_rate_limit_viewed`, `admin_rate_limit_reset`.
- Rate limit de la propia callable: 10/min por admin (via `checkCallableRateLimit`) para evitar scraping.

### S3 — Registrar eventos admin en GA4 + dashboard Funcionalidades

- **Backend:** agregar `'admin_config_viewed'`, `'admin_moderation_updated'`, `'admin_activity_feed_diag'`, `'admin_list_item_deleted'`, `'admin_rate_limit_viewed'`, `'admin_rate_limit_reset'` al array `GA4_EVENT_NAMES` en `functions/src/admin/analyticsReport.ts`.
- **Frontend:** crear nueva categoria `'admin_tools'` en `GA4_FEATURE_CATEGORIES` (`ga4FeatureDefinitions.ts`) con los 6 eventos agrupados en 2 features (`config_tools`, `metrics_tools`).
- **Constantes:** agregar los 3 nuevos event names a `src/constants/analyticsEvents/admin.ts`.

### S4 (nice-to-have, fuera del alcance M0)

- Aggregate "Top followed tags" en UsersPanel.
- Aggregate adopcion de quickActions/recentSearches — estos son localStorage-only (no hay doc Firestore), solo via GA4 `quick_action_tapped` / `recent_search_tapped` que ya existen. Se incluyen en S3 como parte de la categoria Admin pero no requieren nueva instrumentacion.

### Consideraciones UX

- listItems inspector se agrega al mismo panel donde ya se veian listas (FeaturedListsPanel), minimizando cambio de contexto.
- Rate limits en tab Alertas (ya tiene `KpiCard` pattern + filtros) — usar `AdminPanelWrapper` + `ActivityTable` existente.
- Delete actions tienen dialog de confirmacion destructivo con `role="alertdialog"`.

### Consideraciones de seguridad

- Nueva callable `adminListRateLimits` respeta `ENFORCE_APP_CHECK_ADMIN` y `assertAdmin(request.auth)`.
- No exponer PII: `_rateLimits` ya usa `userId` (no hasheado), pero admin siempre ha visto userIds en otros paneles. Seguir convencion existente.
- Todo admin action que escribe (delete listItem, reset rateLimit) se registra en `abuseLogs` con `type: 'config_edit'` (patron ya existente para acciones admin destructivas).

---

## Scope

| Item | Prioridad | Esfuerzo |
|------|-----------|----------|
| S1: listItems inspector (read-only) en FeaturedListsPanel | Alta | S |
| S2: adminListRateLimits callable + UI en AbuseAlerts | Alta | M |
| S2: resetRateLimit callable + accion UI | Media | S |
| S3: registrar 6 eventos admin en GA4_EVENT_NAMES + admin.ts constants | Alta | XS |
| S3: nueva categoria admin_tools en ga4FeatureDefinitions.ts | Media | XS |
| Tests: callable + componentes nuevos + helper listItems service | Alta | S |
| Actualizar `docs/reference/features.md`, `docs/reference/firestore.md`, `docs/reference/security.md` | Alta | XS |

**Esfuerzo total estimado:** M

---

## Out of Scope

- Inspector generico del doc `_rateLimits` por usuario (cross-collection) — el requeste minimo es categoria+reset, no history.
- Aggregate top-followedTags en UsersPanel (movido a issue futuro si hay demanda).
- Modificar reglas de Firestore para que admin lea `_rateLimits` directo — preferimos callable para no expandir superficie de rules.
- UI para editar `_rateLimits.count` manualmente (solo reset-to-zero via delete).
- `listItems` inspector con edicion (solo read + delete con confirmacion).

---

## Tests

### Archivos que necesitaran tests

| Archivo | Tipo | Que testear |
|---------|------|-------------|
| `functions/src/admin/rateLimits.ts` | Callable | assertAdmin, listRateLimits con/sin filtro userId, resetRateLimit (delete doc + abuseLog), rate limit de la callable |
| `src/services/admin/rateLimits.ts` | Service | httpsCallable wiring, parsing de resetAt, error de no-admin |
| `src/services/admin/listItems.ts` | Service | fetchListItemsAdmin (read), deleteListItemAdmin (via callable) |
| `functions/src/admin/listItems.ts` | Callable | assertAdmin, delete listItem via Admin SDK, abuseLog |
| `src/components/admin/alerts/RateLimitsSection.tsx` | Component | Renderiza tabla, filtra, llama reset con confirmacion |
| `src/components/admin/FeaturedListsPanel.tsx` | Component | Muestra items extendidos con addedBy + delete action |

### Criterios de testing

- Cobertura >= 80% del codigo nuevo
- Tests de validacion para todos los inputs del usuario (userId filter, limit param)
- Todos los paths condicionales cubiertos (callable no-admin, doc not found, filter vacio)
- Side effects verificados (abuseLog creado, analytics `admin_rate_limit_reset` disparado, cache invalidation)

---

## Seguridad

- [ ] Nueva callable `adminListRateLimits` verifica admin via `assertAdmin(request.auth)`
- [ ] Nueva callable `adminResetRateLimit` verifica admin via `assertAdmin(request.auth)`
- [ ] Nueva callable `adminDeleteListItem` verifica admin via `assertAdmin(request.auth)`
- [ ] Las 3 callables usan `enforceAppCheck: ENFORCE_APP_CHECK_ADMIN`
- [ ] Todas respetan rate limit callable (5-10/min por admin via `checkCallableRateLimit`)
- [ ] Validacion de input: `userId` (regex uid firebase), `limit` (int 1-100), `docId` (listItems path)
- [ ] Logging con `maskEmail()` si aparece email en logs
- [ ] `resetRateLimit` y `deleteListItem` escriben a `abuseLogs` con `type: 'config_edit'` para trail auditable
- [ ] No se relajan reglas de `_rateLimits` ni `listItems` (se mantiene `allow read, write: if false` + patron existente en listItems)

### Vectores de ataque automatizado

| Superficie | Ataque posible | Mitigacion requerida |
|-----------|---------------|---------------------|
| `adminListRateLimits` callable | Admin comprometido escrapea historial de rate limits de todos los usuarios | Rate limit 10/min por admin + log a `abuseLogs` si excede |
| `adminResetRateLimit` | Admin comprometido resetea rate limits masivamente para facilitar abuso de cuenta delegada | Cada reset genera `abuseLog` con `type: 'config_edit'` + detail con `docId` |
| `adminDeleteListItem` | Admin comprometido elimina items de listas ajenas sin trail | `abuseLog` con detail `{ listId, businessId, ownerId }` |
| UI admin | XSS via displayName de `addedBy` | React escaping default + no usar dangerouslySetInnerHTML |

{Este feature NO escribe a Firestore desde el cliente — todas las escrituras pasan por Cloud Functions callables admin-only.}

- [ ] Callables admin nuevas usan `enforceAppCheck: ENFORCE_APP_CHECK_ADMIN`
- [ ] `assertAdmin()` como primera linea de cada callable
- [ ] `checkCallableRateLimit` con key `rate_limits_list_{uid}`, `rate_limits_reset_{uid}`, `list_item_delete_{uid}` (10/min)
- [ ] `captureException(err)` en catch + `HttpsError` apropiado
- [ ] Toda accion destructiva (`reset`, `delete`) loggea a `abuseLogs` con `type: 'config_edit'` + detalle minimo (no full snapshot)

---

## Deuda tecnica y seguridad

### Issues relacionados

| Issue | Relacion | Accion |
|-------|----------|--------|
| #300 Tech debt: security | No agrava — este feature no toca App Check ni deps | Ninguna |
| #303 Tech debt: perf-instrumentation | Afecta — nuevas callables deben incluir `trackFunctionTiming` | Instrumentar las 3 callables nuevas |
| #311 Tech debt: help-docs | Relacion baja — podemos actualizar HelpSection con una tarjeta "Para administradores" si corresponde | Fuera de scope |

### Mitigacion incorporada

- Agregar `trackFunctionTiming('adminListRateLimits', start)` a cada callable nueva (resuelve item de #303 para estas superficies).
- Registrar los 3 analytics events admin pre-existentes + 3 nuevos en GA4 — cierra el gap reportado en #310.

---

## Robustez del codigo

### Checklist de hooks async

- [ ] `useAsyncData` ya maneja cancellation (ignore flag) — los nuevos paneles lo usan
- [ ] Handlers de delete/reset tienen `try/catch` con `toast.error`
- [ ] Sin `setState` fuera de `useAsyncData` / `useState` controlado
- [ ] Callables admin exportadas nombradas explicitamente en barrel `services/admin/index.ts`
- [ ] Constantes `localStorage` — n/a (este feature es server-side)
- [ ] Archivos nuevos no superan 300 lineas
- [ ] `logger.error` NUNCA dentro de `if (import.meta.env.DEV)` — siempre visible

### Checklist de observabilidad

- [ ] Nuevos callables `adminListRateLimits`, `adminResetRateLimit`, `adminDeleteListItem` incluyen `trackFunctionTiming`
- [ ] Servicios nuevos no hacen queries Firestore directas (todo via callable) — no requiere `measureAsync`
- [ ] `trackEvent` nuevo registrado en `GA4_EVENT_NAMES` (analyticsReport.ts) y `ga4FeatureDefinitions.ts`

### Checklist offline

- [ ] Dashboard admin deshabilita submits cuando `isOffline` (patron existente en AbuseAlerts) — aplicar a nuevos botones delete/reset
- [ ] Error handlers muestran `toast.error` en todos los environments
- [ ] Paneles admin no requieren soporte offline full (las queries fallan y se muestra error state via `AdminPanelWrapper`)

### Checklist de documentacion

- [ ] Nuevos analytics events en `src/constants/analyticsEvents/admin.ts` (archivo de dominio, no barrel)
- [ ] Nuevos tipos en `src/types/admin.ts` (dominio correcto, ya existe)
- [ ] `docs/reference/features.md` actualizado: nuevo inspector listItems + rate limits
- [ ] `docs/reference/firestore.md` — sin cambios (no hay colecciones nuevas)
- [ ] `docs/reference/patterns.md` — sin cambios (usa patrones existentes: callable + `useAsyncData`)
- [ ] `docs/reference/security.md` — agregar las 3 callables nuevas a tabla de rate limiting callable

---

## Offline

### Data flows

| Operacion | Tipo (read/write) | Estrategia offline | Fallback UI |
|-----------|-------------------|-------------------|-------------|
| `adminListRateLimits` callable | Read | Sin cache offline (admin-only feature) | `AdminPanelWrapper` error state |
| `adminResetRateLimit` callable | Write | Deshabilitar boton si `isOffline` | Tooltip "Sin conexion" |
| `adminDeleteListItem` callable | Write | Deshabilitar boton si `isOffline` | Tooltip "Sin conexion" |
| `fetchListItems` (lectura expandida) | Read | Ya usa patron existente (refetch on expand) | Error state en Collapse |

### Checklist offline

- [ ] Reads de Firestore: n/a (todo via callable)
- [ ] Writes: botones deshabilitados con `useConnectivity().isOffline`
- [ ] APIs externas: callables tienen manejo de error de red (HttpsError unavailable)
- [ ] UI: `OfflineIndicator` global ya existe
- [ ] Datos criticos: admin no requiere cache offline

### Esfuerzo offline adicional: S

---

## Modularizacion y % monolitico

### Checklist modularizacion

- [ ] Logica de callable en `functions/src/admin/rateLimits.ts` y `functions/src/admin/listItems.ts` (no mezclar con otros modulos)
- [ ] Servicios frontend en `src/services/admin/rateLimits.ts` y `src/services/admin/listItems.ts`, re-exportados del barrel
- [ ] Componentes nuevos en `src/components/admin/alerts/RateLimitsSection.tsx` (subdirectorio por dominio del panel)
- [ ] No se agregan useState de logica al `AdminLayout` — el tab Alertas ya orquesta via `AbuseAlerts`
- [ ] Cada prop de accion tiene handler real (no noop)
- [ ] Componentes nuevos NO importan de `firebase/firestore` — solo de `services/admin/*`
- [ ] Archivos en `src/hooks/` — n/a (no se agregan hooks nuevos, se reusa `useAsyncData`)
- [ ] Converters nuevos — n/a (tipos simples en `types/admin.ts`)
- [ ] Archivos nuevos van en `components/admin/alerts/` y `components/admin/` (dominio correcto)
- [ ] No crear contextos nuevos; el panel admin es stateless orquestado por `AdminLayout`

### Impacto en % monolitico

| Aspecto | Impacto | Justificacion |
|---------|---------|---------------|
| Acoplamiento de componentes | = | Agregamos secciones aisladas dentro de paneles existentes (AbuseAlerts, FeaturedListsPanel) |
| Estado global | = | Sin nuevos contextos; usa `useAsyncData` por panel |
| Firebase coupling | - | Nuevas escrituras solo via callable; no tocamos rules |
| Organizacion por dominio | + | Subcarpeta `alerts/` ya existe, agregamos `RateLimitsSection.tsx` correctamente agrupado |

---

## Accesibilidad y UI mobile

### Checklist de accesibilidad

- [ ] Todo `<IconButton>` de delete/reset tiene `aria-label` descriptivo ("Resetear rate limit de {userId}", "Eliminar item {businessName}")
- [ ] Elementos interactivos usan `<Button>` / `<IconButton>` MUI (no `<Box onClick>`)
- [ ] Dialogs de confirmacion de delete/reset usan `role="alertdialog"`
- [ ] Touch targets >= 44x44px en mobile (admin es desktop-first pero respetamos)
- [ ] Tablas con loading state via `AdminPanelWrapper`
- [ ] Formulario de filtro (userId input) tiene `<label>` o `aria-label`

### Checklist de copy

- [ ] Todos los textos en espanol con tildes correctas ("Rate limits activos", "Restablecer contador")
- [ ] Tono voseo donde aplica ("Eliminá el item", "Reseteá el contador")
- [ ] Terminologia: "comercio" (no "negocio")
- [ ] Strings centralizados en `src/constants/messages/admin.ts`
- [ ] Mensajes de error accionables ("No se pudo resetear. Verifica tu sesion.")

---

## Success Criteria

1. Admin puede abrir el tab Alertas y ver una tabla de rate limits activos filtrable por userId, con tiempo restante hasta `resetAt`.
2. Admin puede resetear un rate limit con confirmacion; el action genera un `abuseLog` auditable y el usuario queda desbloqueado inmediatamente.
3. Admin puede expandir una lista en el tab Listas y ver sus items con `addedBy` resuelto a displayName, pudiendo eliminar items corruptos.
4. El dashboard de Funcionalidades muestra una nueva categoria "Admin tools" con metricas de uso de los 6 eventos admin (3 existentes + 3 nuevos).
5. No se degradan rules de Firestore ni se expone `_rateLimits`/`listItems` directo al cliente — toda escritura destructiva pasa por callable con `assertAdmin` + `abuseLog`.
