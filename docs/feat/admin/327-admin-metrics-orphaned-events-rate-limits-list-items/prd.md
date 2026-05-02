# PRD: Admin metrics — orphaned events, _rateLimits/listItems moderation gaps

**Feature:** 327-admin-metrics-orphaned-events-rate-limits-list-items
**Categoria:** admin
**Fecha:** 2026-04-29
**Issue:** #327
**Prioridad:** Media

---

## Contexto

El health-check del admin-metrics-auditor (2026-04-25) detecto que el merge de #310 (v2.42.x) dejo callables admin sin UI consumidora y eventos analytics sin registrar en GA4. Concretamente: `functions/src/admin/rateLimits.ts` (`adminListRateLimits`, `adminResetRateLimit`) y `functions/src/admin/listItems.ts` (`adminDeleteListItem`) estan implementados, testeados y desplegados, pero ningun componente del dashboard `/admin` los invoca todavia. Ademas el evento `map_load_failed` (emitido desde `MapErrorBoundary` tras el merge de #304) no esta en `GA4_EVENT_NAMES` ni en `GA4_FEATURE_CATEGORIES`, por lo que las fallas silenciosas del mapa son invisibles al admin.

## Problema

- **Soporte ciego a usuarios bloqueados:** las callables `adminListRateLimits` y `adminResetRateLimit` ya existen y respetan `assertAdmin` + `ENFORCE_APP_CHECK_ADMIN` + rate limit propio, pero el tab Alertas (`AbuseAlerts`) no las consume. Cuando un usuario reporta "no puedo comentar / agregar favorito", el admin no tiene UI para inspeccionar `_rateLimits/{key}` ni desbloquear al usuario. Diagnostico actual: leer logs de Sentry o queries manuales con Firebase Console.
- **listItems sin moderacion item-level:** `adminDeleteListItem` ya existe (decrementa `itemCount` atomicamente, escribe `abuseLog`), pero `FeaturedListsPanel` solo expande items en read-only sin boton de eliminar. Cuando un usuario reporta un item corrupto/spam en una lista colaborativa publica, el admin no puede actuar desde el dashboard.
- **`map_load_failed` orphan:** el evento se trackea desde `MapErrorBoundary.tsx:31` via `EVT_MAP_LOAD_FAILED` (`constants/analyticsEvents/system.ts`) pero no esta en `GA4_EVENT_NAMES` (`functions/src/admin/analyticsReport.ts`) ni en ninguna categoria de `ga4FeatureDefinitions.ts`. El dashboard de Funcionalidades no cuenta map failures, asi que un pico de errores del SDK de Google Maps (quota, blockers, key revoked) pasa inadvertido.
- **Verification badges sin per-user audit:** `useVerificationBadges` cachea unlocks en localStorage (`mm_verification_badges_{userId}`, TTL 24h) y emite `verification_badge_earned` a GA4, pero no persiste el unlock en Firestore. Admin ve totales agregados pero no puede auditar por-usuario (cuando un usuario afirma "ya soy Local Guide pero perdi el badge", no hay registro server-side).

## Solucion

### S1 — Wiring de UI para rate limits inspector

- Servicio frontend nuevo `src/services/admin/rateLimits.ts` que envuelve los callables `adminListRateLimits` y `adminResetRateLimit` con `httpsCallable`. Re-exportado desde `services/admin/index.ts` barrel.
- Componente nuevo `src/components/admin/alerts/RateLimitsSection.tsx` agregado dentro de `AbuseAlerts.tsx` (tab Alertas) — patron coherente con `ReincidentesView` que ya vive ahi. Renderiza:
  - Filtro: input `userId` (debounced 300ms) + boton "Limpiar".
  - Tabla MUI: `category` (chip), `userId` (truncado a 8 chars + tooltip), `count`, `resetAt` (tiempo relativo con `formatRelativeTime`), `windowActive` (chip ON/OFF), accion "Resetear".
  - Boton "Resetear" abre `Dialog` confirmacion con `role="alertdialog"` y aviso "Desbloquea al usuario inmediatamente". Llamar al callable como `adminResetRateLimit({ docId: row.docId })`.
  - El boton "Resetear" se muestra siempre (independiente de `windowActive`). Cuando `windowActive: false` el doc en `_rateLimits` ya esta expirado pero todavia ocupa storage; ofrecer la accion como "housekeeping" — el copy del boton sigue siendo "Resetear" pero el dialog explica "Limpia esta entrada (la ventana ya expiro)".
- Usar `useAsyncData` para fetch + `refetch` post-reset. Toast de exito/error (centralizar en `MSG_ADMIN`).
- Analytics: emitir `admin_rate_limit_viewed` (nuevo) al primer fetch de la seccion + `admin_rate_limit_reset` (ya declarado en GA4_EVENT_NAMES) al confirmar reset.
- Subtab dentro del tab Alertas: agregar tercera tab `'rateLimits'` al `Tabs` interno de `AbuseAlerts` (junto a `'alerts'` y `'reincidentes'`).
- **Comportamiento del tab cuando `innerTab === 'rateLimits'`** (importante para no consumir reads ni confundir al admin con cabecera de abuse logs):
  - **KPIs de abuse logs (`KpiCard` x4 — alertas hoy, top type, top user, total): se ocultan.** No tienen sentido fuera del subtab "Alertas".
  - **`AlertsFilters` (date preset, type, severity, status, collection, user search): se oculta.** El subtab tiene su propio filtro (`userId`).
  - **`useAbuseLogsRealtime(200)` se pausa**: refactorizar el hook para aceptar un parametro `enabled: boolean` (similar a `useDocSubscription` con flag); cuando el subtab activo no es `'alerts'` ni `'reincidentes'`, pasar `enabled: false` para que el `onSnapshot` se desuscriba y deje de consumir reads. Alternativa equivalente si el refactor del hook se complica: detach en `useEffect` cuando `innerTab === 'rateLimits'`. Decidir en specs cual es menos invasivo.
  - El header con titulo "Alertas de abuso" + badge `newCount` se mantiene visible (es el header del tab completo); solo cambia el contenido segun el subtab.
- Patron seguido: ver `docs/reference/patterns.md` "Admin panel pattern" (`useAsyncData` + `AdminPanelWrapper`) y "Mutable prop audit" (refetch post-write).

### S2 — Wiring de UI para listItems delete (moderacion item-level)

- Servicio frontend nuevo `src/services/admin/listItems.ts` que envuelve el callable `adminDeleteListItem`. Re-exportado desde `services/admin/index.ts`.
- Modificar `FeaturedListsPanel.tsx` (no agregar panel nuevo): cuando se expande una lista, cada `ListItem` adentro del `Collapse` recibe un `IconButton` con `DeleteOutlineIcon` (`aria-label="Eliminar item {businessName}"`). Solo visible para admin (componente ya esta en `/admin` por lo que el guard es de ruta).
- Click abre `Dialog` confirmacion con `role="alertdialog"`: "¿Eliminar {businessName} de {listName}?". Si confirma, llamar a `adminDeleteListItem({ itemId })`, mostrar toast, refetch de items expandidos.
- Mostrar tambien `addedBy` resuelto a displayName via `fetchUserDisplayNames([uid])` (vive en `src/services/users.ts` linea 108, NO en `services/admin/social`) + chip "Editor" si `addedBy !== list.ownerId`. Esto cierra parte del scope original de #310 que quedo en "lightweight read-only".
- Analytics: emitir `admin_list_item_deleted` (ya declarado en GA4_EVENT_NAMES) al confirmar delete + `admin_list_items_inspected` (ya declarado) al expandir una lista.
  - **Dedup de `admin_list_items_inspected`:** el evento se emite UNA sola vez por `listId` por sesion del admin (cache miss → fetch real de items). El componente mantiene un `Set<string>` interno (`expandedItems` / `inspectedListIds`) — si el `listId` ya esta en el set al expandir, el evento NO se vuelve a emitir aunque el admin colapse y reexpanda. Esto evita inflar GA4 cuando un admin abre/cierra repetidamente la misma lista durante una sesion de moderacion.
  - **Params del evento:** `{ listId: string, itemCount: number }` (itemCount = total real de la lista, no el truncado a 50). Sin `userId` del admin (GA4 ya lo asocia via `user_id` global).
- Limites de UI: mostrar maximo 50 items por lista expandida — **truncado client-side via `items.slice(0, 50)`** despues del fetch (la query a `listItems` no se limita server-side; admin descarga todos los items para calcular `itemCount` y luego se renderiza solo el slice). Las listas grandes ya estan acotadas por `LIST_ITEM_MAX` del producto. Si `items.length > 50`, agregar texto "Mostrando 50 de N — usar Cloud Console para casos extremos".

### S3 — Registrar `map_load_failed` en GA4 + categoria System

- **Backend:** agregar `'map_load_failed'` al array `GA4_EVENT_NAMES` en `functions/src/admin/analyticsReport.ts` (insertar en seccion "System" del array, junto a `'force_update_*'` y `'app_version_active'`).
- **Frontend:** agregar feature `map_errors` a la categoria `system` de `GA4_FEATURE_CATEGORIES` en `src/components/admin/features/ga4FeatureDefinitions.ts`:
  ```
  { key: 'map_errors', name: 'Errores de mapa', icon: icon(MapOutlinedIcon), eventNames: ['map_load_failed'], color: '#F44336' }
  ```
- **Constantes:** el event name ya esta en `src/constants/analyticsEvents/system.ts` (`EVT_MAP_LOAD_FAILED`); no hace falta tocar. Verificar que el barrel `analyticsEvents/index.ts` lo re-exporte (lo hace via `export * from './system'`).
- **Surfacing en PerformancePanel:** opcional — el `FeaturesPanel` (categoria System) ya muestra el conteo 30-dias. No agregar duplicacion en PerformancePanel salvo que el equipo lo pida.

### S4 — Verification badges per-user audit (deferido a M1)

- **Decision:** queda fuera de scope de este PRD por costo / beneficio. La cache localStorage es suficiente para UX y los totales de GA4 dan vision agregada.
- **Magnitud estimada del costo de no diferir:** 4 badges definidos hoy (Local Guide, Top Reviewer, Foto Lover, Trustworthy). Cada badge se gana 1 vez por usuario (idempotente, no se pierde — solo si el usuario reset cache). Si en el futuro se agregaran 6 badges adicionales (10 totales), el costo es **maximo 10 writes/usuario/lifetime** a `users/{uid}/verifications/{badgeId}` (write una sola vez, sin updates). Para 100k usuarios activos: ~1M writes lifetime — barato comparado con los reads. La razon real para diferir no es costo de Firestore sino **costo de implementacion del trigger** (Cloud Function que evalua thresholds en cada rating/checkin) y la complejidad de migrar usuarios actuales que ya tienen badges en localStorage pero no en Firestore.
- Si surgen casos de soporte concretos, abrir issue futuro para persistir unlocks en una subcoleccion `users/{uid}/verifications/{badgeId}` con `earnedAt` server-timestamp via Cloud Function trigger sobre el primer rating/check-in que cruza el threshold.
- Documentar la decision en el changelog de #327 para que quede explicito.

### Consideraciones UX

- **Subtab nuevo en AbuseAlerts:** preserva el patron existente (`Tabs` interno con `'alerts' | 'reincidentes'`) — agregar `'rateLimits'` mantiene la cohesion del tab "Alertas".
- **Delete inline en FeaturedListsPanel:** usar `IconButton` chico (`size="small"`) para no agrandar la celda del item. Touch target >= 44x44 si el panel se ve en mobile (admin es desktop-first pero respetamos).
- **Tiempo relativo:** preferir "hace 12 min" / "en 5 h" sobre timestamps absolutos para que sea legible. Reusar `formatRelativeTime` de `utils/formatDate.ts`.
- **Filtros persistentes durante la sesion:** si admin filtra por `userId`, el filtro se mantiene al refetch (no resetear). Patron existente en `AlertsFilters`.
- **Race condition multi-admin (rate limit ya reseteado por otro admin):** si dos admins abren el subtab Rate Limits y uno resetea un row antes que el otro, el segundo callable retorna `HttpsError 'not-found'`. El servicio frontend mapea ese error a `MSG_ADMIN.rateLimitAlreadyReset` ("Esta entrada ya fue reseteada por otro admin. Refrescamos la tabla."), muestra `toast.info` (no error), cierra el dialog, y dispara `refetch()` automaticamente para descartar el row obsoleto. Mismo patron aplicable a `adminDeleteListItem` (`MSG_ADMIN.listItemAlreadyDeleted` ya mencionado en checklist de copy).
- **Docs viejos de `_rateLimits` sin campo `userId` (pre-v2.42):** el callable `adminListRateLimits` filtra por `where('userId', '==', uid)` cuando se aplica filtro, lo que NO devuelve docs creados antes de la migracion (cuando el `userId` solo vivia en el docId, no como campo). Decision producto: documentar la limitacion en la UI con un texto pequeno debajo del filtro: **"Mostrando docs con campo userId. Para casos previos a v2.42, listar sin filtro o usar Cloud Console."**. La opcion alternativa (cambiar el callable a doble query: `where userId` + scan parsing docId) requiere cambios en `functions/src/admin/rateLimits.ts` y queda fuera de scope de #327. Como los docs son ephimeros (TTL = ventana de rate limit, max ~24h), la cohorte pre-v2.42 ya esta extinta o casi extinta; la limitacion es transitoria.

### Consideraciones de seguridad

- Los 3 callables ya existen y respetan `assertAdmin` + `ENFORCE_APP_CHECK_ADMIN` + `checkCallableRateLimit`. No hay nuevas escrituras a Firestore desde el cliente — todo via callable.
- No relajar Firestore rules de `_rateLimits` ni `listItems` (ambas siguen `Functions only` para write).
- Cada accion destructiva (reset / delete) ya escribe a `abuseLogs` con `type: 'config_edit'` (incluye `targetUserId`, `category`, `docId` en `detail`) — auditable.
- `userId` mostrado en la UI: ya se exhibe en otros paneles admin (UsersPanel, AbuseAlerts), no es PII nueva.

---

## Scope

| Item | Prioridad | Esfuerzo |
|------|-----------|----------|
| S1: `services/admin/rateLimits.ts` (wrapper httpsCallable) | Alta | XS |
| S1: `RateLimitsSection.tsx` (tabla + filtro + reset) en AbuseAlerts subtab | Alta | M |
| S1: `admin_rate_limit_viewed` analytics event nuevo (registrar en `analyticsEvents/admin.ts` + GA4_EVENT_NAMES + categoria admin_tools) | Media | XS |
| S2: `services/admin/listItems.ts` (wrapper httpsCallable) | Alta | XS |
| S2: Wire delete inline en `FeaturedListsPanel.tsx` (IconButton + Dialog confirmacion + refetch) | Alta | S |
| S2: Resolve `addedBy` displayName + chip "Editor" | Media | S |
| S3: Agregar `'map_load_failed'` a `GA4_EVENT_NAMES` (analyticsReport.ts) | Alta | XS |
| S3: Agregar feature `map_errors` a categoria `system` en `ga4FeatureDefinitions.ts` | Alta | XS |
| Tests: services nuevos + RateLimitsSection + FeaturedListsPanel delete flow + ga4FeatureDefinitions | Alta | M |
| Docs: actualizar `docs/reference/features.md` (admin tab actualizado) + `docs/reference/security.md` (agregar 3 callables admin a la tabla de "Rate limiting server-side") | Media | XS |

**Esfuerzo total estimado:** M

---

## Out of Scope

- Persistir unlocks de verification badges server-side (S4 deferido a M1, abrir issue futuro si hay demanda real).
- Editar `_rateLimits.count` manualmente (solo reset-to-zero via delete del doc).
- Inspector cross-user de `_rateLimits` con history (los docs son ephimeros — se borran al reset).
- Modificar Firestore rules de `_rateLimits` o `listItems` (siguen `Functions only`).
- Inspector de items para listas privadas no-featured (FeaturedListsPanel solo lista publicas; admin moderation cross-listas se evalua en issue futuro si hay demanda).
- Bulk reset / bulk delete (1-by-1 con confirmacion para evitar errores).

---

## Tests

### Archivos que necesitaran tests

| Archivo | Tipo | Que testear |
|---------|------|-------------|
| `src/services/admin/rateLimits.ts` | Service | httpsCallable wiring, parse de `resetAt` (number → Date), error de `permission-denied` mapeado a mensaje legible, llamada con/sin filtro `userId` |
| `src/services/admin/listItems.ts` | Service | httpsCallable wiring de `adminDeleteListItem`, error path `not-found` |
| `src/components/admin/alerts/RateLimitsSection.tsx` | Component | Renderiza tabla con loading/empty/error states, filtra por userId (debounced), abre dialog con role="alertdialog", llama a reset y refetch al confirmar, emite analytics `admin_rate_limit_viewed` y `admin_rate_limit_reset` |
| `src/components/admin/FeaturedListsPanel.tsx` | Component | Delete inline: aparece IconButton solo en items expandidos, dialog confirmacion abre/cierra, llama a `adminDeleteListItem` y refetch, emite `admin_list_item_deleted`. addedBy se resuelve a displayName |
| `src/components/admin/features/ga4FeatureDefinitions.ts` | Constants | Test snapshot existente debe seguir pasando con feature nuevo `map_errors`; verificar que `map_load_failed` esta en exactamente UNA categoria (constraint que ya enforcea el test) |
| `functions/src/admin/analyticsReport.ts` | Backend (snapshot) | Si hay test de `GA4_EVENT_NAMES` length, actualizar el numero esperado |

### Criterios de testing

- Cobertura >= 80% del codigo nuevo (hooks/services/components)
- Tests de validacion para todos los inputs del usuario (userId filter clamp, confirmacion obligatoria antes de reset/delete)
- Todos los paths condicionales cubiertos (loading, error, empty, with-filter, without-filter, dialog cancel, dialog confirm)
- Side effects verificados: refetch tras reset/delete, `trackEvent` disparado, toast.error en caso de fallo de la callable
- Tests del callable backend (`adminListRateLimits`, `adminResetRateLimit`, `adminDeleteListItem`) ya existen del merge de #310 — no se duplican aqui

---

## Seguridad

- [ ] Servicios frontend nuevos NO importan `firebase/firestore` ni `firebase/storage` directamente — solo `firebase/functions` para `httpsCallable` (consistente con patron de `services/admin/backups.ts`)
- [ ] Componentes nuevos NO importan Firebase SDK — solo de `services/admin/*`
- [ ] Botones destructivos (reset / delete) deshabilitados cuando `useConnectivity().isOffline`
- [ ] Dialogs de confirmacion usan `role="alertdialog"` (patron `DeleteAccountDialog`, `DiscardDialog`)
- [ ] No se relajan Firestore rules de `_rateLimits` ni `listItems` (siguen `Functions only`)
- [ ] No se cambian las rate-limits de las callables ya desplegadas (30/dia list, 20/dia reset, 50/dia delete-item)
- [ ] React escapa por default — `displayName` y `userId` se renderizan via JSX (no `dangerouslySetInnerHTML`)

### Vectores de ataque automatizado

| Superficie | Ataque posible | Mitigacion requerida |
|-----------|---------------|---------------------|
| `RateLimitsSection` UI | Admin comprometido scrapea historial de rate limits via spam de paginas | Rate limit ya enforced server-side (30/dia por admin); `abuseLog` si excede |
| `FeaturedListsPanel` delete | Admin comprometido elimina items masivamente sin trail | Cada `adminDeleteListItem` ya escribe `abuseLog` con `{ itemId, listId, businessId, addedBy }` |
| Filtro userId del UI | Inyeccion de userId arbitrario para enumerar usuarios | Validacion server-side ya enforced (UID_REGEX); el cliente solo pasa el string |
| `displayName` de `addedBy` mostrado | XSS via displayName malicioso | React escaping default; no usar `dangerouslySetInnerHTML` |

Este feature **no escribe a Firestore desde el cliente** — todas las escrituras pasan por Cloud Functions callables admin-only ya desplegadas.

- [x] Callables admin existentes ya respetan `enforceAppCheck: ENFORCE_APP_CHECK_ADMIN` (verificado en `functions/src/admin/rateLimits.ts` y `listItems.ts`)
- [x] `assertAdmin()` como primera linea de cada callable (verificado)
- [x] `checkCallableRateLimit` con keys `admin_rate_limits_{uid}`, `admin_rate_limit_reset_{uid}`, `admin_delete_list_item_{uid}` (verificado, 30/20/50 por dia respectivamente)
- [x] `captureException(err)` en catch + `HttpsError` apropiado (verificado)
- [x] Toda accion destructiva loggea a `abuseLogs` con `type: 'config_edit'` (verificado)

(Sin cambios de Firestore rules. Sin colecciones nuevas. Sin campos nuevos en `userSettings`.)

---

## Deuda tecnica y seguridad

### Issues relacionados

| Issue | Relacion | Accion |
|-------|----------|--------|
| #310 Admin metrics gaps (cerrado) | Mitiga — este PRD completa el wiring UI que quedo pendiente | Completar S1 + S2 |
| #303 Perf instrumentation | No empeora — los callables ya tienen `trackFunctionTiming` (verificado en codigo) | Ninguna |
| #325 Perf-instrumentation coverage (cerrado) | No empeora — los servicios frontend nuevos NO hacen queries Firestore directas (todo via callable), no requieren `measureAsync` | Ninguna |
| #322 Firestore rules hardening (cerrado) | No empeora — no se modifican rules | Ninguna |

### Mitigacion incorporada

- Cierra el gap de UI dejado por #310 sin reabrir el issue (es un followup explicito en el health-check report).
- Cierra el orphan de `map_load_failed` que dejo el merge de #304 (MapErrorBoundary).
- Documenta explicitamente la decision de NO persistir verification badges server-side en este PRD para evitar que vuelva a aparecer en futuros health-checks como deuda silenciosa.

---

## Robustez del codigo

### Checklist de hooks async

- [ ] `RateLimitsSection` usa `useAsyncData` que ya maneja cancellation con `ignore` flag
- [ ] Handlers `handleReset` / `handleDelete` tienen `try/catch` con `toast.error` en todos los environments (no solo DEV)
- [ ] Sin `setState` despues de operaciones async sin guard (los componentes que se desmontan durante el await son cubiertos por `useAsyncData`)
- [ ] `services/admin/rateLimits.ts` y `services/admin/listItems.ts` exportan funciones nombradas (no default)
- [ ] Archivos nuevos no superan 300 lineas (warn) ni 400 (blocker)
- [ ] `logger.error` en catch handlers NUNCA dentro de `if (import.meta.env.DEV)` — siempre visible para Sentry
- [ ] Sin storage keys nuevos (este feature no usa localStorage)
- [ ] Archivos en `src/services/admin/` (no `src/hooks/`) — no son hooks

### Checklist de observabilidad

- [x] Cloud Functions callables ya tienen `trackFunctionTiming` (verificado en codigo de #310)
- [x] Servicios nuevos (frontend) no hacen queries Firestore — no requieren `measureAsync`
- [ ] `admin_rate_limit_viewed` (nuevo) registrado en `GA4_EVENT_NAMES` y en categoria `admin_tools` de `ga4FeatureDefinitions.ts`
- [ ] `map_load_failed` (orphan existente) registrado en `GA4_EVENT_NAMES` y nueva feature `map_errors` en categoria `system` de `ga4FeatureDefinitions.ts`

### Checklist offline

- [ ] Botones de reset / delete deshabilitados cuando `isOffline` con tooltip "Requiere conexion"
- [ ] Si `useConnectivity` no esta provisto en el subtree admin, agregar el check con `try/catch` defensivo (admin-layout deberia tenerlo, verificar en specs)
- [ ] Catch handlers muestran `toast.error` siempre (no solo DEV)

### Checklist de documentacion

- [ ] Nuevos analytics events en archivo de dominio (`src/constants/analyticsEvents/admin.ts` para `admin_rate_limit_viewed`) — no appendear al barrel
- [ ] Tipos nuevos en `src/types/admin.ts` (ya existe; agregar `AdminRateLimitItem` que refleje el `AdminRateLimitItem` server-side)
- [ ] `docs/reference/features.md` actualizado: admin tab Alertas ahora tiene subtab "Rate Limits"; FeaturedListsPanel permite eliminar items
- [ ] `docs/reference/firestore.md` — sin cambios (sin colecciones nuevas)
- [ ] `docs/reference/patterns.md` — sin cambios (reusa Admin panel pattern existente)
- [ ] `docs/reference/security.md` — la tabla "Rate limiting server-side (callables)" en lineas 197-205 actualmente lista solo 6 callables (`inviteListEditor`, `removeListEditor`, `backups`, `deleteUserAccount`, `cleanAnonymousData`, `writePerfMetrics`) y NO incluye los callables admin de #310. Agregar 3 entradas:
  - `adminListRateLimits` — 30/dia por admin — clave `admin_rate_limits_{uid}`
  - `adminResetRateLimit` — 20/dia por admin — clave `admin_rate_limit_reset_{uid}`
  - `adminDeleteListItem` — 50/dia por admin — clave `admin_delete_list_item_{uid}`

---

## Offline

### Data flows

| Operacion | Tipo (read/write) | Estrategia offline | Fallback UI |
|-----------|-------------------|-------------------|-------------|
| `adminListRateLimits` callable | Read | Sin cache offline (admin desktop-only) | `AdminPanelWrapper` error state |
| `adminResetRateLimit` callable | Write | Boton deshabilitado si `isOffline` | Tooltip "Requiere conexion" |
| `adminDeleteListItem` callable | Write | Boton deshabilitado si `isOffline` | Tooltip "Requiere conexion" |
| `fetchListItems` (lectura existente) | Read | Patron actual sin cambios | Error state en Collapse |

### Checklist offline

- [ ] Reads de Firestore: n/a (todo via callable)
- [ ] Writes: botones deshabilitados con `useConnectivity().isOffline`
- [ ] APIs externas: callables tienen manejo de error de red (`HttpsError unavailable`) — el toast genera mensaje legible
- [ ] UI: `OfflineIndicator` global ya existe
- [ ] Datos criticos: admin no requiere cache offline

### Esfuerzo offline adicional: S

---

## Modularizacion y % monolitico

### Checklist modularizacion

- [ ] Logica de servicios en `src/services/admin/rateLimits.ts` y `src/services/admin/listItems.ts` — re-exportada desde `services/admin/index.ts` barrel
- [ ] Componente nuevo en `src/components/admin/alerts/RateLimitsSection.tsx` (subdirectorio del dominio "alerts" donde ya viven `AlertsTable`, `ReincidentesView`, etc.)
- [ ] Modificacion a `FeaturedListsPanel.tsx` mantiene la responsabilidad: el panel orquesta, los servicios encapsulan la I/O
- [ ] No se agregan useState de logica al `AdminLayout` — el subtab dentro de AbuseAlerts es self-contained
- [ ] Cada prop de accion tiene handler real (no noop `() => {}`)
- [ ] Componentes nuevos NO importan de `firebase/firestore`, `firebase/functions` ni `firebase/storage` — solo via `services/admin/*`
- [ ] Archivos en `src/hooks/` — n/a (no se agregan hooks; reusamos `useAsyncData`)
- [ ] Converters nuevos — n/a
- [ ] Archivos nuevos van en carpeta correcta (`components/admin/alerts/`, `services/admin/`)
- [ ] No crear contextos nuevos
- [ ] Ningun archivo nuevo supera 400 lineas

### Impacto en % monolitico

| Aspecto | Impacto | Justificacion |
|---------|---------|---------------|
| Acoplamiento de componentes | = | `RateLimitsSection` aislado en subdir alerts; `FeaturedListsPanel` solo agrega botones inline a items existentes |
| Estado global | = | Sin nuevos contextos; usa `useAsyncData` por seccion |
| Firebase coupling | - | Todas las llamadas via callables ya existentes; cero nuevos imports de `firebase/firestore` o `firebase/storage` |
| Organizacion por dominio | + | Subcarpeta `alerts/` ya existe; nuevo file `RateLimitsSection.tsx` se suma a `AlertsTable`, `ReincidentesView`, etc. — agrupado correctamente |

---

## Accesibilidad y UI mobile

### Checklist de accesibilidad

- [ ] `IconButton` de delete en FeaturedListsPanel tiene `aria-label="Eliminar {businessName} de {listName}"` descriptivo
- [ ] `IconButton` / `Button` de reset en RateLimitsSection tiene `aria-label="Resetear rate limit de {userId} (categoria {category})"`
- [ ] Dialogs de confirmacion usan `role="alertdialog"` (patron canonico)
- [ ] Touch targets >= 44x44px (admin es desktop-first; tamanos `size="small"` ok pero respetar minimo en mobile zoom)
- [ ] Tablas con loading state via `AdminPanelWrapper` o skeleton consistente
- [ ] Filtro de userId tiene `<TextField>` con label visible "Filtrar por User ID"
- [ ] Mensajes dinamicos (count de items, "X items eliminados") con `aria-live="polite"` si aplican

### Checklist de copy

- [ ] Todos los textos en espanol con tildes correctas: "Resetear rate límite", "Categoría", "Usuario bloqueado", "¿Eliminar item?"
- [ ] Tono voseo: "Reseteá el contador", "Eliminá el item"
- [ ] Terminologia: "comercio" (no "negocio"); "rate limit" se mantiene (es termino tecnico admin)
- [ ] Strings reutilizables en `src/constants/messages/admin.ts` — agregar `MSG_ADMIN.rateLimitResetSuccess`, `rateLimitResetError`, `rateLimitAlreadyReset`, `listItemDeleteSuccess`, `listItemDeleteError`, `listItemAlreadyDeleted`
- [ ] Mensajes de error accionables: "No se pudo resetear. Verificá tu sesion admin." / "Esta entrada ya fue reseteada por otro admin. Refrescamos la tabla." / "Item ya eliminado por otro admin. Refrescá la lista."

---

## Success Criteria

1. Admin puede abrir tab Alertas, cambiar al subtab "Rate Limits", filtrar por userId y ver una tabla con `category`, `userId`, `count`, `resetAt`, `windowActive` actualizada al momento.
2. Admin puede resetear un rate limit con dialog de confirmacion; tras confirmar, el doc `_rateLimits/{key}` se borra, el usuario queda desbloqueado inmediatamente, y se genera un `abuseLog` con `type: 'config_edit'` auditable.
3. Admin puede expandir una lista publica en `FeaturedListsPanel`, ver `addedBy` resuelto a displayName, y eliminar un item corrupto via IconButton + dialog confirmacion. El `itemCount` de la lista se decrementa atomicamente.
4. El dashboard de Funcionalidades muestra una nueva feature "Errores de mapa" en categoria System (con conteo 30-dias de `map_load_failed`) y una nueva feature en categoria Admin Tools que cuenta `admin_rate_limit_viewed`.
5. No se modifican Firestore rules ni se agregan superficies de escritura cliente — todas las acciones admin destructivas siguen pasando por callables con `assertAdmin` + `abuseLog` ya desplegados de #310.

---

## Validacion Funcional

**Sofia — Cycle 2 (2026-05-01): VALIDADO**

Todos los BLOQUEANTES e IMPORTANTES de Cycle 1 cerrados (5 IMPORTANTES + 5 OBSERVACIONES). El PRD quedó coherente con `features.md` y respeta los patrones del proyecto.

**Listo para specs-plan-writer.**

Observaciones para el implementador:
- Decidir en specs entre refactor de `useAbuseLogsRealtime` con `enabled` flag vs detach via useEffect.
- El truncado client-side a 50 items implica descarga completa para calcular `itemCount` real — evaluar si conviene mover a count server-side para listas grandes.
- Verificar en specs que `useConnectivity` este disponible en el subtree admin antes de usar `isOffline` para gating de botones.
