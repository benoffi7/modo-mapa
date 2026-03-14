# Technical Plan: Admin Auth Metrics & Data Coverage Gaps

**Issue:** #84
**Fecha:** 2026-03-14
**Base:** Specs aprobados (`specs.md`)

---

## Orden de implementacion

### Paso 1 — Types & Constants

**Archivos:** `src/types/admin.ts`, `src/config/adminConverters.ts`

1. Agregar a `src/types/admin.ts`:
   - `AuthUserInfo` interface
   - `AuthStats` interface
   - `NotificationStats` interface
   - `SettingsAggregates` interface
   - `newAccounts?: number` a `DailyMetrics`

2. Actualizar `dailyMetricsConverter` en `src/config/adminConverters.ts`:
   - Agregar `newAccounts: asNumber(d.newAccounts)` al fromFirestore

---

### Paso 2 — Cloud Function `getAuthStats`

**Crear:** `functions/src/admin/authStats.ts`

1. Implementar callable `getAuthStats`:
   - Auth check: verificar `auth.token.email === ADMIN_EMAIL_PARAM.value()` + `emailVerified`
   - `getAuth().listUsers()` con paginacion (maxResults 1000)
   - Clasificar cada user: sin providerData o solo anonymous → `anonymous`, con `password` provider → `email`
   - Excluir admin user del conteo (email !== ADMIN_EMAIL)
   - Retornar `AuthStatsResponse`
   - `enforceAppCheck: !IS_EMULATOR`

2. **Modificar:** `functions/src/index.ts` — agregar export

---

### Paso 3 — Extender dailyMetrics con `newAccounts`

**Modificar:** `functions/src/scheduled/dailyMetrics.ts`

1. Agregar query: `users` collection where `createdAt >= startOfDay`
2. Contar docs → `newAccounts`
3. Agregar al `.set()` del dailyMetrics doc

---

### Paso 4 — Frontend services

**Modificar:** `src/services/admin.ts`

1. `fetchAuthStats()` — callable via `httpsCallable(functions, 'getAuthStats')`
2. `fetchNotificationStats()` — query `notifications` collection, agregar counts
3. `fetchSettingsAggregates()` — query `userSettings` collection, agregar counts
4. `fetchRecentPriceLevels(count)` — query `priceLevels` orderBy createdAt desc
5. `fetchRecentCommentLikes(count)` — query `commentLikes` orderBy createdAt desc

---

### Paso 5 — DashboardOverview (R1 + R4)

**Modificar:** `src/components/admin/DashboardOverview.tsx`

1. Agregar `fetchAuthStats()` y `fetchNotificationStats()` al fetcher
2. Seccion "Autenticacion":
   - Fila de StatCards: Email, Anonimos, Verificados
   - PieChartCard "Usuarios por metodo de auth"
3. Seccion "Notificaciones":
   - StatCards: Total enviadas, Leidas (%)
   - PieChartCard "Notificaciones por tipo"

---

### Paso 6 — UsersPanel (R2 + R5)

**Modificar:** `src/components/admin/UsersPanel.tsx`

1. Agregar `fetchAuthStats()` y `fetchSettingsAggregates()` al fetcher
2. Nuevos StatCards en fila de auth: Email, Anonimos, Verificados
3. Nuevos StatCards en fila de preferencias: Perfiles publicos, Notificaciones activas, Analytics activo
4. Enriquecer `processData` con auth info — agregar `authMethod` y `emailVerified` a cada user entry cruzando por uid

---

### Paso 7 — TrendsPanel (R3)

**Modificar:** `src/components/admin/TrendsPanel.tsx`

1. Agregar `newAccounts` a `AggregatedPoint` interface
2. Agregar sum en `aggregate()` function
3. Nuevo `LineChartCard` "Nuevos registros" con dataKey `newAccounts`

---

### Paso 8 — ActivityFeed (R6 + R7)

**Modificar:** `src/components/admin/ActivityFeed.tsx`

1. Agregar `fetchRecentPriceLevels` y `fetchRecentCommentLikes` al fetcher
2. Tab "Precios" con ActivityTable: Usuario, Comercio, Nivel ($/$$/$$), Fecha
3. Tab "Likes" con ActivityTable: Usuario, Comment ID, Fecha
4. Importar `PRICE_LEVEL_LABELS` para mostrar $/$$/$$

---

### Paso 9 — Tests

1. `functions/src/__tests__/admin/authStats.test.ts` — mock listUsers, verify classification
2. Actualizar tests existentes de admin components si los hay
3. Test de nuevos service functions

---

### Paso 10 — Local testing

1. `npm run build` — verificar que compila
2. `npm test` — verificar que pasan todos los tests
3. Test manual en emuladores si es posible

---

## Dependencias entre pasos

```text
Paso 1 (types) ──┬── Paso 2 (Cloud Function)
                  ├── Paso 3 (dailyMetrics)
                  ├── Paso 4 (services) ──┬── Paso 5 (Overview)
                  │                       ├── Paso 6 (UsersPanel)
                  │                       └── Paso 8 (ActivityFeed)
                  └── Paso 7 (TrendsPanel — solo necesita types)

Paso 9 (tests) ── depende de todos los anteriores
Paso 10 (local testing) ── depende de Paso 9
```

---

## Estimacion de archivos

| Accion | Archivo | LOC estimadas |
|---|---|---|
| Crear | `functions/src/admin/authStats.ts` | ~80 |
| Crear | `functions/src/__tests__/admin/authStats.test.ts` | ~60 |
| Modificar | `functions/src/index.ts` | +1 |
| Modificar | `functions/src/scheduled/dailyMetrics.ts` | +10 |
| Modificar | `src/types/admin.ts` | +25 |
| Modificar | `src/config/adminConverters.ts` | +1 |
| Modificar | `src/services/admin.ts` | +60 |
| Modificar | `src/components/admin/DashboardOverview.tsx` | +50 |
| Modificar | `src/components/admin/UsersPanel.tsx` | +60 |
| Modificar | `src/components/admin/TrendsPanel.tsx` | +15 |
| Modificar | `src/components/admin/ActivityFeed.tsx` | +50 |
