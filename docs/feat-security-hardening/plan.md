# Plan de Implementación: Security Hardening

## Rama

`feat/security-hardening` — creada desde `main`.

**Importante**: No tocar archivos fuera del scope de este feature. Otro agente trabaja en `feat-firebase-quota-offline`.

---

## Fase 1: Cloud Functions — Setup y Utils

### Paso 1.1: Inicializar proyecto Functions

**Archivos nuevos:**

- `functions/package.json` — dependencias (firebase-admin, firebase-functions, vitest)
- `functions/tsconfig.json` — TypeScript config (target ES2022, strict)
- `functions/vitest.config.ts` — config de tests
- `functions/src/index.ts` — entry point vacío (se llena en pasos siguientes)

**Acciones:**

1. Crear directorio `functions/src/`
2. Crear `functions/package.json` con Node 22, firebase-admin ^13, firebase-functions ^6.3
3. Crear `functions/tsconfig.json` estricto
4. Crear `functions/vitest.config.ts`
5. Crear `functions/src/index.ts` con init de admin SDK
6. `cd functions && npm install`

**Verificación:** `cd functions && npx tsc --noEmit`

### Paso 1.2: Utils — rateLimiter

**Archivos nuevos:**

- `functions/src/utils/rateLimiter.ts`
- `functions/src/__tests__/utils/rateLimiter.test.ts`

**Lógica:**

- `checkRateLimit(db, config, userId, entityId?)` → `Promise<boolean>`
- Config con `collection`, `field`, `limit`, `windowType` (`daily` | `per_entity`)
- Para `daily`: query con `where('createdAt', '>=', startOfDay)`
- Para `per_entity`: query con `where('businessId', '==', entityId)`
- Retorna `true` si excede el límite

**Tests:**

- Mock Firestore con objetos simples
- Test: bajo el límite → retorna false
- Test: en el límite exacto → retorna false
- Test: sobre el límite → retorna true
- Test: daily reset (startOfDay correcto)

**Verificación:** `cd functions && npx vitest run`

### Paso 1.3: Utils — moderator

**Archivos nuevos:**

- `functions/src/utils/moderator.ts`
- `functions/src/__tests__/utils/moderator.test.ts`

**Lógica:**

- `checkModeration(db, text)` → `Promise<boolean>`
- Lee `config/moderation` doc con caché en memoria (TTL 5 min)
- Normaliza texto (lowercase + quita acentos)
- Busca match con word boundary regex

**Tests:**

- Test: texto limpio → false
- Test: palabra prohibida exacta → true
- Test: palabra con acentos → true (normalización)
- Test: palabra parcial (no word boundary) → false
- Test: caché funciona (no re-lee doc)

### Paso 1.4: Utils — counters y abuseLogger

**Archivos nuevos:**

- `functions/src/utils/counters.ts`
- `functions/src/utils/abuseLogger.ts`
- `functions/src/__tests__/utils/counters.test.ts`

**Lógica counters:**

- `incrementCounter(db, field, delta)` — FieldValue.increment en `config/counters`
- `trackWrite(db, collectionName)` — incrementa dailyWrites + writesByCollection
- `trackDelete(db, collectionName)` — incrementa dailyDeletes

**Lógica abuseLogger:**

- `logAbuse(db, { userId, type, collection, detail })` — escribe en `abuseLogs`

---

## Fase 2: Cloud Functions — Triggers

### Paso 2.1: Trigger comments

**Archivos nuevos:**

- `functions/src/triggers/comments.ts`
- `functions/src/__tests__/triggers/comments.test.ts`

**onCommentCreated:**

1. Rate limit check (20/day/user)
2. Si excede → delete doc + logAbuse
3. Moderation check en `text`
4. Si flagged → update `{ flagged: true }` + logAbuse
5. incrementCounter('comments', 1) + trackWrite('comments')

**onCommentDeleted:**

1. incrementCounter('comments', -1) + trackDelete('comments')

### Paso 2.2: Trigger customTags

**Archivos nuevos:**

- `functions/src/triggers/customTags.ts`
- `functions/src/__tests__/triggers/customTags.test.ts`

**onCustomTagCreated:**

1. Rate limit check (10/business/user)
2. Si excede → delete doc + logAbuse
3. Moderation check en `label`
4. Si flagged → delete doc + logAbuse
5. incrementCounter('customTags', 1) + trackWrite('customTags')

**onCustomTagDeleted:**

1. incrementCounter('customTags', -1) + trackDelete('customTags')

### Paso 2.3: Trigger feedback

**Archivos nuevos:**

- `functions/src/triggers/feedback.ts`
- `functions/src/__tests__/triggers/feedback.test.ts`

**onFeedbackCreated:**

1. Rate limit check (5/day/user)
2. Si excede → delete doc + logAbuse
3. Moderation check en `message`
4. Si flagged → update `{ flagged: true }` + logAbuse
5. incrementCounter('feedback', 1) + trackWrite('feedback')

### Paso 2.4: Triggers ratings, favorites, users

**Archivos nuevos:**

- `functions/src/triggers/ratings.ts`
- `functions/src/triggers/favorites.ts`
- `functions/src/triggers/users.ts`

**onRatingWritten** (onDocumentWritten):

1. Si es create: incrementCounter('ratings', 1) + trackWrite('ratings')
2. Si es update: solo trackWrite('ratings') (no incrementa counter)
3. Si es delete: incrementCounter('ratings', -1) + trackDelete('ratings')

**onFavoriteCreated/Deleted:**

1. incrementCounter('favorites', ±1) + trackWrite/trackDelete

**onUserCreated:**

1. incrementCounter('users', 1) + trackWrite('users')

### Paso 2.5: Index.ts — exportar todo

**Archivo modificado:** `functions/src/index.ts`

- Import y re-export todos los triggers
- Import y re-export dailyMetrics (se crea en fase 3)

**Verificación:** `cd functions && npx tsc --noEmit && npx vitest run`

---

## Fase 3: Scheduled Function

### Paso 3.1: dailyMetrics

**Archivos nuevos:**

- `functions/src/scheduled/dailyMetrics.ts`
- `functions/src/__tests__/scheduled/dailyMetrics.test.ts`

**Lógica (cron 3:00 AM Argentina):**

1. Query `ratings` → calcular distribución 1-5
2. Query `favorites` → group by businessId → top 10
3. Query `comments` (no flagged) → group by businessId → top 10
4. Query `ratings` → group by businessId → avg score → top 10
5. Query `userTags` → group by tagId → sort desc
6. Contar usuarios únicos del día (userId distintos en todas las colecciones con createdAt >= startOfDay)
7. Leer counters diarios (`dailyReads`, `dailyWrites`, `dailyDeletes`)
8. Escribir doc `dailyMetrics/{YYYY-MM-DD}` con todo lo calculado
9. Reset counters diarios a 0

**Tests:**

- Mock colecciones con datos conocidos
- Verificar distribución, tops, y reset de counters

---

## Fase 4: Firestore Rules

### Paso 4.1: Actualizar firestore.rules

**Archivo modificado:** `firestore.rules`

**Cambios:**

1. Agregar regla `config/{document=**}` — admin read only
2. Agregar regla `abuseLogs/{docId}` — admin read only
3. Agregar regla `dailyMetrics/{docId}` — admin read only
4. Modificar `feedback` — agregar admin read
5. Modificar `users` — agregar admin read

**Verificación:** Revisar que las reglas existentes no se rompen.

---

## Fase 5: Frontend — Tipos y Config

### Paso 5.1: Tipos y collections

**Archivos nuevos:**

- `src/types/admin.ts` — `AdminCounters`, `DailyMetrics`, `AbuseLog`

**Archivos modificados:**

- `src/types/index.ts` — agregar `flagged?: boolean` a `Comment`
- `src/config/collections.ts` — agregar `CONFIG`, `ABUSE_LOGS`, `DAILY_METRICS`
- `src/config/converters.ts` — agregar `flagged` al commentConverter

### Paso 5.2: Admin converters

**Archivos nuevos:**

- `src/config/adminConverters.ts` — `countersConverter`, `dailyMetricsConverter`, `abuseLogConverter`

---

## Fase 6: Frontend — Auth y Routing

### Paso 6.1: AuthContext — Google Sign-In

**Archivo modificado:** `src/context/AuthContext.tsx`

**Cambios:**

1. Import `GoogleAuthProvider`, `signInWithPopup`, `signOut`
2. Agregar `signInWithGoogle()` y `signOut()` al context
3. Actualizar `AuthContextType` interface

### Paso 6.2: Routing `/admin`

**Archivo modificado:** `src/App.tsx`

**Cambios:**

1. Import `lazy`, `Suspense`
2. Check `window.location.pathname.startsWith('/admin')`
3. Renderizar `AdminDashboard` (lazy) sin MapProvider/APIProvider
4. Mantener la app normal para todas las demás rutas

---

## Fase 7: Frontend — Dashboard

### Paso 7.1: AdminGuard + AdminLayout

**Archivos nuevos:**

- `src/components/admin/AdminGuard.tsx` — login Google + verificación email
- `src/components/admin/AdminLayout.tsx` — AppBar + Tabs (4 secciones)
- `src/pages/AdminDashboard.tsx` — wrapper con AdminGuard

### Paso 7.2: Componentes reutilizables

**Archivos nuevos:**

- `src/components/admin/StatCard.tsx` — card con número grande
- `src/components/admin/TopList.tsx` — tabla con barras de progreso
- `src/components/admin/ActivityTable.tsx` — tabla genérica con paginación
- `src/components/admin/charts/PieChartCard.tsx` — wrapper recharts pie
- `src/components/admin/charts/LineChartCard.tsx` — wrapper recharts line

### Paso 7.3: DashboardOverview

**Archivo nuevo:** `src/components/admin/DashboardOverview.tsx`

- Grid de StatCards (6 totales)
- 2 PieCharts (distribución ratings, tags más usados)
- 3 TopLists (favoriteados, comentados, calificados)
- Data fetch: `config/counters` + `dailyMetrics/{hoy}`

### Paso 7.4: ActivityFeed

**Archivo nuevo:** `src/components/admin/ActivityFeed.tsx`

- Tabs: Comentarios, Ratings, Favoritos, Feedback, Tags
- Cada tab: ActivityTable con últimos 20 items
- Items flaggeados con Chip rojo

### Paso 7.5: FirebaseUsage

**Archivo nuevo:** `src/components/admin/FirebaseUsage.tsx`

- LineChart: reads/writes/deletes últimos 30 días
- LineChart: usuarios activos últimos 30 días
- 2 PieCharts: reads/writes por colección (hoy)
- Barras de progreso: estimación vs cuota gratuita

### Paso 7.6: AbuseAlerts

**Archivo nuevo:** `src/components/admin/AbuseAlerts.tsx`

- Tabla de abuseLogs (últimos 50)
- Chips por tipo (rate_limit amarillo, flagged rojo, top_writers azul)

---

## Fase 8: Frontend — Filtro de flagged

### Paso 8.1: Filtrar comments flaggeados

**Archivo modificado:** `src/components/business/BusinessComments.tsx`

- Filtrar client-side: `.filter((c) => !c.flagged)`

---

## Fase 9: Firebase config

### Paso 9.1: firebase.json

**Archivo modificado:** `firebase.json`

- Agregar sección `functions` con source, runtime, predeploy
- Agregar emulador de functions (port 5001)
- Actualizar script `dev:full` en `package.json` para incluir functions

### Paso 9.2: Dependencia recharts

```bash
npm install recharts
```

---

## Fase 10: Testing y verificación

### Paso 10.1: Tests Cloud Functions

```bash
cd functions && npx vitest run
```

### Paso 10.2: Tests y build frontend

```bash
npm run lint
npm run test:run
npm run build
```

### Paso 10.3: Test local con emuladores

```bash
firebase emulators:start --only auth,firestore,functions
# En otra terminal:
npm run dev
# Navegar a /admin → verificar login, dashboard, métricas
```

---

## Fase 11: Commit y PR

### Paso 11.1: Commit docs

```bash
git checkout -b feat/security-hardening
git add docs/feat-security-hardening/
git commit -m "docs: add PRD, specs, and plan for security hardening"
```

### Paso 11.2: Commits por fase

Un commit por fase completada:

1. `feat(functions): initialize Cloud Functions project with utils`
2. `feat(functions): add Firestore triggers for rate limiting and moderation`
3. `feat(functions): add daily metrics scheduled function`
4. `feat(rules): add admin and config Firestore rules`
5. `feat(admin): add types, converters, and auth for admin dashboard`
6. `feat(admin): add dashboard pages with charts and activity feed`
7. `feat(comments): filter flagged comments in frontend`
8. `chore: configure functions emulator and add recharts`

### Paso 11.3: PR

```bash
git push -u origin feat/security-hardening
gh pr create --title "feat: security hardening — rate limiting, moderation, admin dashboard"
```

---

## Resumen de archivos

| Fase | Archivos nuevos | Archivos modificados |
|------|----------------|---------------------|
| 1 | 8 (functions setup + utils) | 0 |
| 2 | 10 (triggers + tests) | 1 (index.ts) |
| 3 | 2 (scheduled + test) | 0 |
| 4 | 0 | 1 (firestore.rules) |
| 5 | 2 (types/admin, adminConverters) | 3 (types, collections, converters) |
| 6 | 0 | 2 (AuthContext, App.tsx) |
| 7 | 10 (dashboard components) | 0 |
| 8 | 0 | 1 (BusinessComments) |
| 9 | 0 | 2 (firebase.json, package.json) |
| **Total** | **32 archivos nuevos** | **10 archivos modificados** |
