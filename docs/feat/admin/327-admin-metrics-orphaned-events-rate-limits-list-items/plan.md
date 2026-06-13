# Plan: Admin metrics — orphaned events + _rateLimits/listItems UI gaps

**Specs:** [specs.md](specs.md)
**PRD:** [prd.md](prd.md)
**Issue:** #327
**Fecha:** 2026-04-29

---

## Implementacion recomendada

**Agente unico (luna o nico).** El feature toca frontend (services + hooks + components + types + constants) y backend (`functions/src/admin/analyticsReport.ts`), pero el flujo es secuencial-friendly y el cambio en backend es minimo (registro de event names en un array).

Si manu decide paralelizar, file ownership por workstream:

- **Frontend:** `src/services/admin/`, `src/components/admin/`, `src/hooks/`, `src/types/admin.ts`, `src/constants/`
- **Backend:** `functions/src/admin/analyticsReport.ts`

**Estimacion total: M** (suma de fases coincide con tamano del PRD). Detalle por fase en la columna "Estimacion" de cada tabla.

---

## Fases de implementacion

### Fase 1: Tipos, constantes, mensajes y registro GA4 (foundational, sin UI)

**Branch:** `feat/327-admin-metrics-orphaned-events`
**Estimacion:** S (~1h)

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `src/types/admin.ts` | Agregar `interface AdminRateLimitItem { docId; category; userId; count; resetAt; windowActive }` al final |
| 2 | `src/constants/analyticsEvents/admin.ts` | Agregar `EVT_ADMIN_RATE_LIMIT_VIEWED = 'admin_rate_limit_viewed'`, `EVT_ADMIN_RATE_LIMIT_RESET = 'admin_rate_limit_reset'`, `EVT_ADMIN_LIST_ITEM_DELETED = 'admin_list_item_deleted'`, `EVT_ADMIN_LIST_ITEMS_INSPECTED = 'admin_list_items_inspected'` |
| 3 | `src/constants/messages/admin.ts` | Extender `MSG_ADMIN` con `rateLimitResetSuccess`, `rateLimitResetError`, `rateLimitAlreadyReset`, `listItemDeleteSuccess`, `listItemDeleteError`, `listItemAlreadyDeleted` (ver textos en specs) |
| 4 | `functions/src/admin/analyticsReport.ts` | En el array `GA4_EVENT_NAMES`: agregar `'map_load_failed'` en seccion "System" (junto a `'app_version_active'`); agregar `'admin_rate_limit_viewed'` en seccion "Admin tools (#310)". **Registro upfront para evitar reproducir bug de eventos huerfanos** (si Fase 4 mergeara antes que el registro, `EVT_ADMIN_RATE_LIMIT_VIEWED` quedaria huerfano transitoriamente, exactamente lo que este feature cierra para `map_load_failed`). |
| 5 | `src/components/admin/features/ga4FeatureDefinitions.ts` | Categoria `admin_tools.admin_metrics.eventNames`: agregar `'admin_rate_limit_viewed'`. **Registro upfront en frontend para mantener simetria con backend.** (La feature card nueva `map_errors` se agrega en Fase 6.) |

### Fase 2: Servicios frontend (wrappers httpsCallable)

**Estimacion:** M (~2-3h)

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `src/services/admin/rateLimits.ts` (nuevo) | Crear con `listAdminRateLimits(params)` y `resetAdminRateLimit(docId)` siguiendo patron de `services/admin/backups.ts` |
| 2 | `src/services/admin/listItems.ts` (nuevo) | Crear con `adminDeleteListItem(itemId)` |
| 3 | `src/services/admin/index.ts` | Agregar `export { listAdminRateLimits, resetAdminRateLimit } from './rateLimits';` y `export { adminDeleteListItem } from './listItems';` al final del barrel |
| 4 | `src/services/admin/__tests__/rateLimits.test.ts` (nuevo) | Test de wiring `httpsCallable`, propagacion de error `not-found`, paso correcto de `userId`/`limit` |
| 5 | `src/services/admin/__tests__/listItems.test.ts` (nuevo) | Test de wiring `adminDeleteListItem`, propagacion de error `not-found` |

### Fase 3: Hook `useAbuseLogsRealtime` con `enabled` flag

**Estimacion:** S (~1-2h)

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `src/hooks/useAbuseLogsRealtime.ts` | Agregar parametro `enabled = true`. En `useEffect`: si `!enabled`, resetear state (`setLogs(null)`, `setLoading(false)`, `setError(false)`, `setNewCount(0)`, `initialIds.current = null`) y retornar noop. Agregar `enabled` a deps |
| 2 | `src/hooks/__tests__/useAbuseLogsRealtime.test.ts` (nuevo) | Crear archivo de test. Casos: default `enabled=true` suscribe correctamente; `enabled=false` no suscribe y resetea state; flip `false→true` re-suscribe limpio (`initialIds.current` reseteado, primer snapshot post-resume no cuenta como "nuevo"); subtab switch desmonta/remonta consistentemente |

### Fase 4: Componente `RateLimitsSection` + integracion en `AbuseAlerts`

**Estimacion:** L (~3-4h)

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `src/components/admin/alerts/RateLimitsSection.tsx` (nuevo) | Implementar segun specs: `useAsyncData(listAdminRateLimits)`, filtro userId con `useDeferredValue`, tabla MUI con columnas (`category`, `userId`, `count`, `resetAt`, `windowActive`, accion Resetear), Dialog `role="alertdialog"`, `useConnectivity` para gating, emitir `EVT_ADMIN_RATE_LIMIT_VIEWED` 1x con `useRef`, `EVT_ADMIN_RATE_LIMIT_RESET` al confirmar. Mapear `HttpsError 'not-found'` a `toast.info(MSG_ADMIN.rateLimitAlreadyReset)` + `refetch()` |
| 2 | `src/components/admin/AbuseAlerts.tsx` | Agregar `'rateLimits'` al tipo `innerTab`. Agregar `<Tab value="rateLimits" label="Rate Limits" />`. Wrap `KpiCard x4` en `{innerTab !== 'rateLimits' && (...)}`. Renderizar `<RateLimitsSection />` cuando `innerTab === 'rateLimits'`. Cambiar llamada a `useAbuseLogsRealtime(200, innerTab !== 'rateLimits')` |
| 3 | `src/components/admin/alerts/__tests__/RateLimitsSection.test.tsx` (nuevo) | Tests segun specs (loading, empty, filter debounced, dialog flow, analytics dedup, offline gating, race condition `not-found`) |
| 4 | `src/components/admin/__tests__/AbuseAlerts.test.tsx` (nuevo) | Crear archivo de test. Caso: cambiar a subtab `rateLimits` desmonta KPIs y filtros y monta `<RateLimitsSection />`; vuelta a `alerts` re-suscribe `useAbuseLogsRealtime` con `enabled=true` y reinicia el conteo `newCount` correctamente |

### Fase 5: Wire delete inline en `FeaturedListsPanel`

**Estimacion:** M (~3h, dividida en 3 sub-pasos commiteables por separado)

| Paso | Archivo | Cambio |
|------|---------|--------|
| 5a | `src/components/admin/FeaturedListsPanel.tsx` | **Cleanup + imports base.** Reemplazar `} catch { /* ignore */ }` (linea 58-60 actual) por `logger.warn('FeaturedListsPanel fetchListItems failed', err)`. Agregar imports base: `IconButton`, `Dialog`, `DialogTitle`, `DialogContent`, `DialogActions`, `Tooltip`, `DeleteOutlineIcon`, `Chip`, `CHIP_SMALL_SX`, `useConnectivity`, `MSG_ADMIN`, `logger`. Sin cambios funcionales todavia. |
| 5a-test | `src/components/admin/__tests__/FeaturedListsPanel.test.tsx` (nuevo, base) | Test base: render con lista expandible, no error en consola al fallar `fetchListItems` (warn logueado). |
| 5b | `src/components/admin/FeaturedListsPanel.tsx` | **Integracion analytics + truncado + displayNames resolve.** Agregar imports de `trackEvent`, `EVT_ADMIN_LIST_ITEMS_INSPECTED`, `fetchUserDisplayNames`. Agregar state `displayNames` y ref `inspectedListsRef`. Modificar `handleToggleExpand` para: emitir `admin_list_items_inspected` 1x por lista con `realCount` (dedup via ref), truncar a 50 con `slice(0, 50)`, resolver `addedBy → displayName` via `fetchUserDisplayNames`. Renderizar Chip `(Owner/Editor)` y texto "Mostrando 50 de N" condicional. |
| 5b-test | `src/components/admin/__tests__/FeaturedListsPanel.test.tsx` | Casos: analytics dedup (mismo expand 2x emite 1 evento); displayName resolve via `fetchUserDisplayNames` mockeado; truncado a 50 cuando `realCount > 50`; chip Owner/Editor segun `list.ownerId`. |
| 5c | `src/components/admin/FeaturedListsPanel.tsx` | **IconButton delete + Dialog + handler con race condition.** Agregar imports de `adminDeleteListItem`, `EVT_ADMIN_LIST_ITEM_DELETED`. Agregar state `deleteDialog`, `deleting`, `localItemCounts`. Renderizar IconButton delete por item con `aria-label`. Agregar Dialog confirmacion `role="alertdialog"`. Handler: emitir `admin_list_item_deleted`, optimistic decrement de `localItemCounts`, mapear `HttpsError 'not-found'` a `toast.info(MSG_ADMIN.listItemAlreadyDeleted)` + refetch. Mostrar `localItemCounts.get(list.id) ?? list.itemCount` en secondary text. |
| 5c-test | `src/components/admin/__tests__/FeaturedListsPanel.test.tsx` | Casos: IconButton click abre dialog; confirmacion dispara `adminDeleteListItem`; optimistic count decrementa antes de respuesta; race condition `not-found` mapea a toast info + refetch (no toast de error); offline gating bloquea delete. |

### Fase 6: GA4 wiring restante (feature card `map_errors`)

**Estimacion:** S (~30min)

Nota: el registro de event names (`map_load_failed`, `admin_rate_limit_viewed`) en `GA4_EVENT_NAMES` y en `ga4FeatureDefinitions.ts` (categoria `admin_tools.admin_metrics.eventNames`) ya se hizo en Fase 1 (pasos 4 y 5) para evitar la ventana huerfana entre la emision y el registro. Esta fase solo agrega la feature card visible en la UI.

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `src/components/admin/features/ga4FeatureDefinitions.ts` | Categoria `system`: agregar feature `{ key: 'map_errors', name: 'Errores de mapa', icon: icon(MapOutlinedIcon), eventNames: ['map_load_failed'], color: '#F44336' }`. Importar `MapOutlinedIcon` de `@mui/icons-material/MapOutlined` |
| 2 | `src/components/admin/features/__tests__/ga4FeatureDefinitions.test.ts` (existe — verificado) | Asegurar que el test de "no duplicate eventNames" pase con la adicion de `map_errors`. Si hay assert de longitud o snapshot por categoria `system`, actualizar acordemente |

### Fase 7: Documentacion (OBLIGATORIA)

**Estimacion:** S (~1h)

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `docs/reference/security.md` | En la tabla "Rate limiting server-side (callables)" (lineas ~197-205): agregar 3 entradas — `adminListRateLimits` (30/dia, `admin_rate_limits_{uid}`), `adminResetRateLimit` (20/dia, `admin_rate_limit_reset_{uid}`), `adminDeleteListItem` (50/dia, `admin_delete_list_item_{uid}`) |
| 2 | `docs/reference/features.md` | Tab admin "Alertas" → mencionar subtab nuevo "Rate Limits" (inspector + reset). Panel "Listas destacadas" → mencionar inline delete + chip Owner/Editor |
| 3 | `docs/reference/firestore.md` | Sin cambios (verificar — no hay colecciones nuevas) |
| 4 | `docs/reference/patterns.md` | Sin cambios (reusa "Admin panel pattern" existente). Verificar |
| 5 | `docs/reference/project-reference.md` | Actualizar **solo el resumen de features** (admin metrics gaps cerrados, `map_load_failed` observable). El bump de version + fecha lo hace automaticamente la skill `/merge` al mergear, no este paso |
| 6 | `docs/_sidebar.md` | Verificar primero — las entradas Specs y Plan bajo "#327 Admin Metrics — orphaned events..." ya estan registradas (lineas 30-32 al momento de generar el plan). **No-op esperado**; solo actualizar si por algun motivo se desincronizo |

---

## Estimacion de tamano de archivos

| Archivo | Lineas estimadas | Status |
|---------|-----------------|--------|
| `src/services/admin/rateLimits.ts` (nuevo) | ~50 | ideal |
| `src/services/admin/listItems.ts` (nuevo) | ~25 | ideal |
| `src/components/admin/alerts/RateLimitsSection.tsx` (nuevo) | ~220 | aceptable |
| `src/components/admin/AbuseAlerts.tsx` (modificado) | 239 → ~265 | aceptable |
| `src/components/admin/FeaturedListsPanel.tsx` (modificado) | 154 → ~310 | aceptable; si excede 400, extraer `FeaturedListItemRow.tsx` + `DeleteListItemDialog.tsx` al subdir `admin/featured/` |
| `src/hooks/useAbuseLogsRealtime.ts` (modificado) | 58 → ~85 | ideal |
| `src/constants/messages/admin.ts` (modificado) | 18 → ~30 | ideal |
| `src/constants/analyticsEvents/admin.ts` (modificado) | 4 → ~10 | ideal |

Ningun archivo supera 400 lineas. Plan B documentado para `FeaturedListsPanel.tsx`.

---

## Orden de implementacion

Dependency chain:

1. **Fase 1** (tipos + constantes + mensajes) — sin dependencias upstream. Habilita typing en Fases 2+.
2. **Fase 2** (services frontend) — depende de Fase 1 (tipo `AdminRateLimitItem`). Habilita Fases 4 y 5.
3. **Fase 3** (hook `enabled` flag) — independiente; puede correr en paralelo con Fase 2. Habilita Fase 4.
4. **Fase 4** (`RateLimitsSection` + integracion `AbuseAlerts`) — depende de Fases 1, 2 y 3.
5. **Fase 5** (wire delete `FeaturedListsPanel`) — depende de Fases 1 y 2. Independiente de Fase 4.
6. **Fase 6** (GA4 wiring) — independiente; puede correr en paralelo. Mejor al final cuando los eventos nuevos estan emitiendose.
7. **Fase 7** (docs) — al final, recoge cambios reales.

---

## Riesgos

1. **`useAbuseLogsRealtime` rompe el comportamiento de "newCount" al toggle subtab.** Mitigacion: tests dedicados al flip `false → true` que verifican que `initialIds.current` se resetea limpio antes de la nueva subscripcion. El primer snapshot post-resume no se cuenta como "nuevo".
2. **Lista publica grande (>200 items) ralentiza UI al expandir.** Mitigacion: el slice client-side limita el render a 50; el descarga full es solo para `realCount`. Si se vuelve problema en QA, followup en issue separada para mover el count a una segunda lectura del field `sharedLists/{id}.itemCount`.
3. **`copy-auditor` flagea textos nuevos.** Mitigacion: todos centralizados en `MSG_ADMIN` con tildes verificadas; usar el agente antes del merge.
4. **Test de `ga4FeatureDefinitions` rompe por duplicate event names.** Mitigacion: verificar que `'admin_rate_limit_viewed'` solo aparece en categoria `admin_tools` y `'map_load_failed'` solo en `system`.

---

## Rollback strategy

Acoplamiento entre fases para revert (en caso de regresion en produccion):

- **Fase 1 (constantes/types/messages/registro GA4)** — rollback-safe individualmente. Si se revierte, las fases 2-6 que dependen de constantes y eventos quedan rotas en build, por lo que en la practica solo conviene revertir junto con todo lo posterior.
- **Fase 2 (services frontend)** — rollback-safe individualmente. Sin consumidores hasta Fases 4 y 5, asi que revertir aislado solo afecta tests propios.
- **Fase 3 (hook `enabled` flag)** — **acoplado con Fase 4 para rollback**. Fase 4 llama `useAbuseLogsRealtime(200, innerTab !== 'rateLimits')` con la signature nueva. Si se revierte solo Fase 3, Fase 4 rompe en runtime (segundo arg ignorado). **Deben revertirse juntas.**
- **Fase 4 (`RateLimitsSection` + integracion `AbuseAlerts`)** — **acoplada con Fase 3** (ver arriba). Tambien depende de Fase 2 (services). Revert seguro: 4 + 3 simultaneo, o 4 + 3 + 2.
- **Fase 5 (`FeaturedListsPanel`)** — **rollback-safe individualmente.** Cambios autocontenidos al panel; sus consumos de `services/admin/listItems.ts` (Fase 2) son aditivos y revertir Fase 5 no rompe nada. Las 3 sub-fases (5a/5b/5c) se pueden revertir individualmente porque cada una compila y deja UI funcional.
- **Fase 6 (feature card `map_errors`)** — rollback-safe individualmente. Solo agrega visibilidad en FeaturesPanel; revertir no afecta emision de eventos.
- **Fase 7 (docs)** — rollback-safe trivialmente.

**Recomendacion: merge unificado** en una sola PR/branch (ver `feedback_unified_merge.md`). Esto evita ventanas donde Fase 4 esta sin Fase 3 en main, o donde el evento `EVT_ADMIN_RATE_LIMIT_VIEWED` se emite sin estar registrado en `GA4_EVENT_NAMES`.

---

## Guardrails de modularidad

- [x] Ningun componente nuevo importa `firebase/firestore` ni `firebase/functions` directamente — solo via `services/admin/*`.
- [x] Archivos nuevos en carpeta de dominio correcta (`components/admin/alerts/`, `services/admin/`, NO en `components/menu/`).
- [x] Logica de negocio en services/hooks. `RateLimitsSection` orquesta UI; el callable wrapping vive en `services/admin/rateLimits.ts`.
- [x] Si se toca un archivo con deuda tecnica conocida (`FeaturedListsPanel.tsx` con `} catch { /* ignore */ }`), se incluye el fix en el plan (Fase 5 paso 1).
- [x] Ningun archivo resultante supera 400 lineas (plan B documentado para `FeaturedListsPanel`).

## Guardrails de seguridad

- [x] Sin cambios en Firestore rules — `_rateLimits` y `listItems` siguen `Functions only`.
- [x] Toda accion destructiva pasa por callable admin con `assertAdmin` + `checkCallableRateLimit` + `abuseLog` (verificado en #310).
- [x] No se relajan rate limits ya desplegados (30/20/50 por dia).
- [x] No hay secrets, admin emails, ni credenciales en archivos commiteados.
- [x] `getCountFromServer`: n/a — sin reads de count en este feature.
- [x] Counter decrement en triggers ya usa `Math.max(0, ...)` (`adminDeleteListItem` usa `FieldValue.increment(-1)` con guard server-side, verificable).

## Guardrails de observabilidad

- [x] Todo CF trigger nuevo: n/a (no hay triggers nuevos; las 3 callables existentes ya tienen `trackFunctionTiming`).
- [x] Servicios nuevos NO hacen queries Firestore directas — todo via callable. `measureAsync` no aplica.
- [x] Todo `trackEvent` nuevo registrado en `GA4_EVENT_NAMES` (Fase 1 paso 4 — upfront para evitar ventana huerfana).
- [x] Todo `trackEvent` nuevo tiene feature card en `ga4FeatureDefinitions.ts` (registro de eventNames en Fase 1 paso 5; feature card `map_errors` en Fase 6).
- [x] `logger.error` NUNCA dentro de `if (import.meta.env.DEV)` — handlers nuevos lo emiten siempre para Sentry.

## Guardrails de accesibilidad y UI

- [x] Todo `<IconButton>` tiene `aria-label` descriptivo (Fase 5).
- [x] Sin `<Typography onClick>` — usar `<Button variant="text">` o `<IconButton>`.
- [x] Touch targets minimo 44x44px (override con `sx={{ minHeight: 44 }}` o `sx={{ p: 1 }}`).
- [x] Componentes con fetch tienen error state con retry (`AdminPanelWrapper` + boton "Reintentar").
- [x] `<img>` con URL dinamica: n/a.
- [x] httpsCallable en componentes user-facing tienen guard offline (`useConnectivity`).
- [x] Dialogs destructivos con `role="alertdialog"` (patron `DeleteAccountDialog`).

## Guardrails de copy

- [x] Todos los textos nuevos usan voseo: "Verificá", "Refrescá".
- [x] Tildes correctas: "categoría", "acción", "conexión", "expiró", "sesión".
- [x] Terminologia consistente: "rate limit" (tecnico admin); "comercio" no aplica.
- [x] Strings reutilizables en `src/constants/messages/admin.ts`.
- [x] Pasar `copy-auditor` antes de merge.

---

## Criterios de done

- [ ] Todos los items del scope del PRD implementados (S1, S2, S3 — S4 deferido).
- [ ] Tests pasan con >= 80% coverage en codigo nuevo.
- [ ] Sin lint errors. `pre-staging-check.sh` pasa.
- [ ] Build succeeds (`tsc -b && vite build`).
- [ ] Seed data: n/a (sin cambios de schema).
- [ ] Privacy policy: n/a (sin nueva recoleccion de datos).
- [ ] Reference docs actualizados: `security.md` (rate limit table), `features.md` (admin tab + featured lists), `project-reference.md` (version + summary).
- [ ] Sidebar actualizado con Specs y Plan.
- [ ] `copy-auditor` ejecutado sin findings sobre textos nuevos.
- [ ] Smoke manual en emulador: subtab Rate Limits filtra y resetea; FeaturedListsPanel elimina item con dialog; orphan `map_load_failed` aparece en FeaturesPanel categoria System tras forzar error en MapErrorBoundary.

---

## Validacion de Plan

**Pablo — Cycle 2 (2026-05-02): VALIDADO CON OBSERVACIONES**

Verifique cierre de los 7 hallazgos previos contra el plan actualizado.

### Cerrado en esta iteracion

- **BLOQUEANTE #1** "specs sin sello Diego" -> resuelto: specs.md linea 575 muestra `Diego — Cycle 1 (2026-05-02): VALIDADO CON OBSERVACIONES`. PRD con sello Sofia (linea 315).
- **BLOQUEANTE #2** "risk staging GA4 invertido" -> resuelto: Fase 1 pasos 4 y 5 registran `map_load_failed` y `admin_rate_limit_viewed` en `GA4_EVENT_NAMES` y en `ga4FeatureDefinitions.ts` categoria `admin_tools.admin_metrics.eventNames` ANTES de las fases que los emiten. Fase 6 reducida a feature card `map_errors`. Riesgo de evento huerfano transitorio cerrado y documentado en la celda del paso 4 ("Registro upfront para evitar reproducir bug de eventos huerfanos").
- **IMPORTANTE #1** "Fase 5 granularidad" -> resuelto: Fase 5 dividida en 5a (cleanup + imports base + test base), 5b (analytics + truncado + displayNames + tests), 5c (IconButton + Dialog + handler race + tests). Cada sub-fase commiteable y rollback-safe individualmente.
- **IMPORTANTE #2** "tests ambiguos nuevo vs existente" -> resuelto: 3 tests marcados `(nuevo)` (`useAbuseLogsRealtime.test.ts`, `RateLimitsSection.test.tsx`, `AbuseAlerts.test.tsx`); `FeaturedListsPanel.test.tsx` marcado `(nuevo, base)` en 5a y reusado en 5b/5c; `ga4FeatureDefinitions.test.ts` marcado `(existe — verificado)`; `analyticsReport.test.ts` correctamente omitido.
- **IMPORTANTE #3** "rollback strategy ausente" -> resuelto: seccion `Rollback strategy` (lineas 149-161) detalla acoplamiento por fase: Fase 3+4 acopladas (signature de `useAbuseLogsRealtime`), Fase 5 rollback-safe individual con sub-fases tambien individuales, recomendacion de merge unificado para evitar ventanas inconsistentes.
- **IMPORTANTE #4** "estimacion ausente" -> resuelto: cada fase tiene S/M/L con horas (F1 S ~1h, F2 M ~2-3h, F3 S ~1-2h, F4 L ~3-4h, F5 M ~3h, F6 S ~30min, F7 S ~1h). Total declarado M, consistente con scope del PRD.
- **IMPORTANTE #5** "ownership de agentes ausente" -> resuelto: bloque `Implementacion recomendada` al inicio (lineas 10-19) propone agente unico (luna o nico) con file ownership por workstream si manu paraleliza. Frontend vs backend sin overlap.
- **OBS #1, #2** -> aplicadas (verificado en estructura del plan).

### Abierto

Ninguno.

### Observaciones para la implementacion

- **Sub-fases 5a/5b/5c se commitean por separado pero pueden agruparse si manu prefiere un commit por fase.** El plan documenta cada sub-fase con su test asociado (5a-test, 5b-test, 5c-test). Si se commitean separados, recordar que 5a aporta solo imports y cleanup — el reviewer no deberia esperar funcionalidad nueva en ese commit.
- **Merge unificado recomendado.** El plan lo dice explicitamente (linea 161). Si se rompe esto y se mergean fases separadas, Fase 3 + Fase 4 deben ir juntas o Fase 4 falla en runtime por la signature del hook.
- **Plan B `FeaturedListsPanel.tsx` (>400 lineas).** Documentado en linea 117. Si al implementar 5c el archivo supera 400, manu debe extraer `FeaturedListItemRow.tsx` + `DeleteListItemDialog.tsx` antes del merge skill (que bloquea archivos >400).
- **Sidebar `_sidebar.md` linea 30-32.** Plan paso 7.6 documenta como no-op esperado. Solo accion si aparece desincronizado al momento de docs.
- **`copy-auditor` antes del merge.** Listado en criterios de done; importante porque hay 6 mensajes nuevos en `MSG_ADMIN`.

### Listo para pasar a implementacion?

Si con observaciones. Plan listo para que manu delegue a luna o nico (preferiblemente agente unico secuencial; paralelizable con file ownership documentado).
