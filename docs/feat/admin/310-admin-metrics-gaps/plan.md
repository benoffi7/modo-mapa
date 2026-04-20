# Plan: Admin metrics — listItems / _rateLimits visibility + admin event tracking

**Feature:** 310-admin-metrics-gaps
**PRD:** [prd.md](./prd.md)
**Specs:** [specs.md](./specs.md)
**Fecha:** 2026-04-18

---

## Overview

Implementacion en 8 fases incrementales. Cada fase es independientemente testeable y desplegable. La unica dependencia fuerte es Fase 3 (callables) antes de Fase 6 (UI que consume callables).

Las 3 primeras fases son bajas de riesgo (no afectan prod). Las callables admin se pueden desplegar parcialmente ya que las tres son independientes.

---

## Fase 1 — Analytics event whitelist (XS)

**Objetivo:** Registrar los 6 eventos admin (3 existentes + 3 nuevos) en GA4 y dashboard de Funcionalidades.

### Pasos

1. **Agregar constantes** — `src/constants/analyticsEvents/admin.ts`
   - Agregar `ADMIN_LIST_ITEM_DELETED`, `ADMIN_RATE_LIMIT_VIEWED`, `ADMIN_RATE_LIMIT_RESET`
2. **Actualizar barrel test** — `src/constants/analyticsEvents/__tests__/barrel.test.ts`
   - Agregar los 3 nuevos al array de expected exports
3. **Extender GA4 whitelist** — `functions/src/admin/analyticsReport.ts`
   - Agregar 6 eventos al array `GA4_EVENT_NAMES` (bloque `// Admin tools`)
4. **Agregar categoria al dashboard** — `src/components/admin/features/ga4FeatureDefinitions.ts`
   - Nueva entry `{ id: 'admin_tools', label: 'Admin Tools', features: [...] }`
5. **Run tests:** `npm test -- --run analyticsEvents` y `npm test -- --run ga4FeatureDefinitions` (si existe)

### Criterios de aceptacion

- [ ] Los 6 eventos aparecen en `GA4_EVENT_NAMES`
- [ ] La categoria "Admin Tools" aparece en dashboard de Funcionalidades (visible tras deploy)
- [ ] `barrel.test.ts` pasa con los 3 nuevos
- [ ] Sin warnings de typescript

### Esfuerzo: XS (15-30 min)

---

## Fase 2 — Types admin

**Objetivo:** Agregar tipos para las nuevas respuestas de callables.

### Pasos

1. **Agregar type** — `src/types/admin.ts`
   ```typescript
   export interface AdminRateLimit {
     docId: string;
     category: string;
     userId: string;
     count: number;
     resetAt: number;
     windowActive: boolean;
   }
   ```
2. **Agregar copy** — `src/constants/messages/admin.ts`
   - 8 constantes nuevas (ver specs seccion 9)

### Criterios de aceptacion

- [ ] Type exportado y usable desde services
- [ ] Copy con tildes correctas y voseo

### Esfuerzo: XS (10 min)

---

## Fase 3 — Cloud Functions callables (M)

**Objetivo:** Implementar las 3 callables admin con tests y deploy a staging.

### Pasos

1. **Crear `functions/src/admin/rateLimits.ts`**
   - Export `adminListRateLimits` — lee `_rateLimits/*`, parsea docId → `{category, userId}`, filtra por userId si se pasa
   - Export `adminResetRateLimit` — valida docId, elimina doc, escribe `abuseLog`
   - Helper `categorizeRateLimit(docId: string): { category: string; userId: string }`
   - `assertAdmin` primera linea
   - `enforceAppCheck: ENFORCE_APP_CHECK_ADMIN`
   - `checkCallableRateLimit(db, 'admin_rate_limits_{uid}', 30, uid)` en list
   - `checkCallableRateLimit(db, 'admin_rate_limit_reset_{uid}', 20, uid)` en reset
   - `trackFunctionTiming` al inicio y final (try/finally)
   - `captureException(err)` en catch
2. **Crear `functions/src/admin/listItems.ts`**
   - Export `adminDeleteListItem({ itemId })` — lee doc → batch delete + `sharedLists.itemCount -1` + `abuseLog`
   - Misma plantilla de seguridad que rateLimits
   - `checkCallableRateLimit(db, 'admin_delete_list_item_{uid}', 50, uid)`
3. **Crear tests:**
   - `functions/src/admin/rateLimits.test.ts` — 10 casos minimos (ver specs)
   - `functions/src/admin/listItems.test.ts` — 8 casos minimos
4. **Exportar desde `functions/src/index.ts`:**
   ```typescript
   export { adminListRateLimits, adminResetRateLimit } from './admin/rateLimits';
   export { adminDeleteListItem } from './admin/listItems';
   ```
5. **Run tests:** `cd functions && npx vitest run src/admin/rateLimits src/admin/listItems`
6. **Verificar coverage >= 80%** con `npx vitest run --coverage src/admin/rateLimits src/admin/listItems`
7. **Deploy a staging** solo cuando los tests pasen

### Criterios de aceptacion

- [ ] `rateLimits.test.ts` ≥10 tests pasan
- [ ] `listItems.test.ts` ≥8 tests pasan
- [ ] Cobertura ≥80% en statements/branches/functions
- [ ] Las 3 callables verifican admin + App Check + rate limit
- [ ] `logAbuse` se invoca con `type: 'config_edit'`
- [ ] `trackFunctionTiming` se invoca en cada callable
- [ ] Deploy a staging exitoso

### Riesgo

- Parsing de docId: algunos rate limits tienen formato `editors_invite_{uid}` (prefijo compuesto con underscore). El helper debe listar prefijos conocidos en constante y hacer match por prefijo antes de extraer uid. Cubierto por tests de `categorizeRateLimit`.

### Esfuerzo: M (2-3h)

---

## Fase 4 — Frontend services (S)

**Objetivo:** Envolver las callables en funciones tipadas.

### Pasos

1. **Crear `src/services/admin/rateLimits.ts`**
   - `fetchAdminRateLimits(params)` y `resetAdminRateLimit(docId)`
2. **Crear `src/services/admin/listItems.ts`**
   - `deleteAdminListItem(itemId)`
3. **Extender barrel** — `src/services/admin/index.ts`
   - Re-exportar las 3 funciones nuevas
4. **Crear tests:**
   - `src/services/admin/rateLimits.test.ts` (mock `httpsCallable`)
   - `src/services/admin/listItems.test.ts`

### Criterios de aceptacion

- [ ] Tests pasan con cobertura ≥80%
- [ ] Sin warnings typescript
- [ ] Import path: `import { fetchAdminRateLimits } from '../../services/admin'` funciona

### Esfuerzo: S (30 min)

---

## Fase 5 — RateLimitsSection component (M)

**Objetivo:** Implementar la UI de inspeccion y reset de rate limits.

### Pasos

1. **Crear `src/components/admin/alerts/RateLimitRow.tsx`**
   - Component memoizado con props `{ item, onReset, isResetting }`
   - Renderiza fila con Categoria | Usuario | Count | Reset en | IconButton reset
2. **Crear `src/components/admin/alerts/RateLimitsSection.tsx`**
   - `useAsyncData` para carga (lazy — no carga hasta buscar)
   - Input `userId` + boton "Buscar"
   - Table renderizando RateLimitRow por item
   - Dialog de confirmacion con `role="alertdialog"`
   - Handler `handleReset(docId)`:
     - Loading state
     - `resetAdminRateLimit(docId)`
     - Toast success/error
     - `trackEvent(ADMIN_RATE_LIMIT_RESET, { category, userId })`
     - Refetch
   - `useEffect` en mount: `trackEvent(ADMIN_RATE_LIMIT_VIEWED)`
   - Deshabilitar boton reset si `useConnectivity().isOffline`
3. **Crear tests** `RateLimitsSection.test.tsx` — al menos 6 cases

### Criterios de aceptacion

- [ ] Tabla renderiza correctamente
- [ ] Dialog de confirmacion abre y permite cancelar
- [ ] Reset ejecuta callable + toast + refetch
- [ ] Filtro userId funciona
- [ ] Botones deshabilitados offline
- [ ] aria-label en IconButton reset

### Esfuerzo: M (2-3h)

---

## Fase 6 — Integracion en AbuseAlerts (XS)

**Objetivo:** Exponer RateLimitsSection como tab dentro del panel de Alertas.

### Pasos

1. **Editar `src/components/admin/AbuseAlerts.tsx`**
   - Extender `innerTab` union: `'alerts' | 'reincidentes' | 'rateLimits'`
   - Agregar `<Tab label="Rate limits" />` al componente `<Tabs>`
   - Render condicional: `{innerTab === 'rateLimits' && <RateLimitsSection />}`
2. **Verificar tests existentes de AbuseAlerts** — si hay test snapshot, actualizar

### Criterios de aceptacion

- [ ] Tab "Rate limits" visible en UI admin
- [ ] Al hacer click se muestra RateLimitsSection
- [ ] Navegacion entre tabs preserva state de cada uno

### Esfuerzo: XS (15 min)

---

## Fase 7 — FeaturedListsPanel extension (M)

**Objetivo:** Agregar visibilidad de `addedBy` y accion de delete a la expansion de items.

### Pasos

1. **Agregar service helper** — `src/services/users.ts` (o donde viva `fetchUserDisplayNames` — verificar)
   - Si no existe, crear `fetchUserDisplayNames(uids: string[]): Promise<Map<string, string>>`
2. **Extender `src/components/admin/FeaturedListsPanel.tsx`:**
   - Nuevo state: `deletingId`, `itemToDelete`, `displayNames` (Map)
   - Al expandir lista: resolver displayNames para uniqueAddedBy
   - En render de item: caption con `Agregado por: {displayName ?? uid.slice(0,8)}`
   - Chip "Editor" si `addedBy !== list.ownerId`
   - IconButton delete con dialog confirmacion
   - Handler delete: `deleteAdminListItem` + refetch + toast + analytics
3. **Extender tests** — crear `FeaturedListsPanel.test.tsx` si no existe (+ al menos 4 cases)

### Criterios de aceptacion

- [ ] Items muestran `addedBy` resuelto a displayName
- [ ] Chip "Editor" aparece correctamente
- [ ] Delete flow: dialog → callable → refetch → toast
- [ ] Analytics event disparado
- [ ] aria-label en IconButton delete

### Riesgo

- `fetchUserDisplayNames` puede no existir o tener signature distinta — verificar antes de implementar. Si es async con batch, ya existe como parte de `services/users.ts` (patron usado por social).

### Esfuerzo: M (2h)

---

## Fase 8 — Documentacion (S)

**Objetivo:** Actualizar docs de referencia.

### Pasos

1. **`docs/reference/features.md`**
   - Seccion "Dashboard Admin": agregar fila "Rate limits activos" en tab Alertas
   - Agregar mencion de inspector de listItems en tab Listas
2. **`docs/reference/security.md`**
   - Tabla "Rate limiting server-side (callables)": agregar 3 filas nuevas
     - `adminListRateLimits` 30/dia
     - `adminResetRateLimit` 20/dia
     - `adminDeleteListItem` 50/dia
3. **`docs/reference/patterns.md`** — sin cambios
4. **`docs/reference/firestore.md`** — sin cambios (no hay colecciones nuevas)
5. **`docs/_sidebar.md`** — agregar entrada para PRD/Specs/Plan
   - Bajo categoria "Admin" (crear si no existe) o "Infra"
6. **`docs/reports/changelog.md`** — sera actualizado en merge

### Criterios de aceptacion

- [ ] Docs reflejan las nuevas funcionalidades
- [ ] Sidebar tiene entrada
- [ ] Markdown lint pasa

### Esfuerzo: S (30 min)

---

## Fase 9 — Verificacion end-to-end (S)

**Objetivo:** Validar en staging con admin real.

### Pasos

1. Deploy a staging: `npm run deploy:staging`
2. Login a staging admin
3. Verificar tab Alertas > Rate limits:
   - Lista muestra docs de `_rateLimits`
   - Filtro userId funciona
   - Reset elimina doc + genera abuseLog visible en tab Alertas
4. Verificar tab Listas:
   - Expandir una lista con items
   - `addedBy` aparece resuelto
   - Delete item → item desaparece, `sharedLists.itemCount` decrementa
5. Verificar tab Funcionalidades:
   - Nueva categoria "Admin Tools" aparece (esperar ≥1h para que GA4 tenga datos)
6. Verificar tab Alertas > Alertas:
   - Los reset/delete aparecen como `type: 'config_edit'`

### Criterios de aceptacion

- [ ] Flows completos funcionan en staging
- [ ] Sin errores en Sentry
- [ ] Abuse logs correctos
- [ ] Analytics events llegan a GA4 (verificable al dia siguiente)

### Esfuerzo: S (45 min)

---

## Checklist pre-merge (phase 8b — reflection)

- [ ] Todos los tests pasan (`npm run test:run` + `cd functions && npx vitest run`)
- [ ] Cobertura >= 80% (frontend + backend)
- [ ] Lint pasa (`npm run lint`)
- [ ] Markdown lint pasa (`npm run lint:md`)
- [ ] Build pasa (`npm run build`)
- [ ] Deploy staging exitoso
- [ ] Manual QA en staging pasa
- [ ] Docs actualizados (features, security, sidebar)
- [ ] `pre-staging-check.sh` pasa (sin silent catches, sin console.error, etc.)
- [ ] PR description incluye screenshots de los 2 nuevos paneles

---

## Riesgos y mitigaciones

| Riesgo | Probabilidad | Impacto | Mitigacion |
|--------|--------------|---------|------------|
| `categorizeRateLimit` falla con formatos nuevos de docId | Media | Bajo | Tests exhaustivos + fallback a `category: 'unknown'` en vez de throw |
| Admin borra rate limit mientras usuario esta en request activo | Baja | Bajo | Worst case: usuario se desbloquea "gratis" — aceptable |
| Callable agota quota de Firestore reads si admin abre frecuentemente | Baja | Bajo | Rate limit 30/dia en listRateLimits + limit 50 por respuesta |
| Tests de callables fallan en CI por mock de FieldValue | Media | Medio | Usar `vi.hoisted` con FieldValue mock (patron existente de feedback.test.ts) |
| UI deja items huerfanos si delete falla parcialmente | Baja | Bajo | Batch write atomico en Admin SDK + refetch siempre tras la llamada |

---

## Estimacion total

| Fase | Esfuerzo | Acumulado |
|------|----------|-----------|
| 1 — Analytics whitelist | XS (30 min) | 30 min |
| 2 — Types + copy | XS (10 min) | 40 min |
| 3 — Cloud Functions | M (3h) | 3h 40 min |
| 4 — Frontend services | S (30 min) | 4h 10 min |
| 5 — RateLimitsSection | M (2.5h) | 6h 40 min |
| 6 — AbuseAlerts integration | XS (15 min) | 6h 55 min |
| 7 — FeaturedListsPanel ext | M (2h) | 8h 55 min |
| 8 — Docs | S (30 min) | 9h 25 min |
| 9 — E2E verification | S (45 min) | 10h 10 min |

**Estimado total:** ~10h de trabajo dirigido.

---

## Orden de merge sugerido

Un solo branch `feat/310-admin-metrics-gaps` que incluye todas las fases. Merge unico al completar Fase 9. No tiene sentido mergear parcialmente porque cada pieza se apoya en la anterior para ser util (los eventos sin UI no sirven, la UI sin callables no funciona).
