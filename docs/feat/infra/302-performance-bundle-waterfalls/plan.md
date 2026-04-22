# Plan: Performance — bundle splits + Firestore waterfalls

**Feature:** 302-performance-bundle-waterfalls
**Issue:** #302
**PRD:** [prd.md](./prd.md) — **Specs:** [specs.md](./specs.md)

---

## Orden de ejecucion

Secuencia ordenada para mantener el sistema funcionando en cada paso. Los pasos de S1 (split recharts) y S4 (singleton Map) son independientes y pueden intercalarse, pero S2 (schema change) tiene orden estricto.

---

## Fase 1 — Singleton businessMap (S4)

**Objetivo**: crear util + migrar consumers. Sin cambios de schema, bajo riesgo.

### Paso 1.1 — Crear `src/utils/businessMap.ts`

Nuevo archivo con `getBusinessMap()`, `getBusinessById()`, `__resetBusinessMap()`.

### Paso 1.2 — Tests del singleton

Crear `src/utils/businessMap.test.ts`:

- `getBusinessMap()` devuelve Map
- Llamadas sucesivas devuelven misma referencia
- `getBusinessById('biz_001')` devuelve business correcto
- `getBusinessById('invalid')` devuelve undefined
- `__resetBusinessMap()` fuerza rebuild

### Paso 1.3 — Migrar consumers (6 componentes + 1 util)

Archivos a tocar:

- `src/utils/businessHelpers.ts` — `getBusinessName`
- `src/components/user/UserProfileContent.tsx:29`
- `src/components/admin/FeedbackList.tsx` (revisar lineas con `allBusinesses.find`)
- `src/components/admin/PhotoReviewCard.tsx:24`
- `src/components/admin/FeaturedListsPanel.tsx` (revisar)
- `src/components/home/TrendingList.tsx:18` — reemplazar Map local por singleton
- `src/components/home/TrendingNearYouSection.tsx:25` — idem

Patron: reemplazar `allBusinesses.find((b) => b.id === id)` por `getBusinessById(id)`.

### Paso 1.4 — Correr tests

```bash
npm run test:run
```

**Gate**: todos los tests pasan, cobertura >=80% sobre archivo nuevo.

### Paso 1.5 — Commit

`perf(#302): add singleton businessMap util to replace O(n) lookups`

---

## Fase 2 — SearchListView memoizacion (S5) + SpecialsSection cache (S6)

**Objetivo**: micro-optimizaciones sin riesgo.

### Paso 2.1 — Refactor `SearchListView.tsx`

- Wrappear `BusinessRow` en `React.memo`
- `sorted` useMemo con distance precomputada
- Render map con objeto `{ business, distance }` precomputado

### Paso 2.2 — Cache en `SpecialsSection.tsx`

- Agregar `specialBusinessesCache` a nivel modulo
- `getBusinessesForSpecial` consulta cache antes de recomputar

### Paso 2.3 — Tests (si hay archivo de test existente, extender)

- `SearchListView.test.tsx`: si existe, verificar que BusinessRow no re-renderiza si props son iguales
- `SpecialsSection.test.tsx`: si existe, verificar que `getBusinessesForSpecial` devuelve mismo array en llamadas sucesivas

### Paso 2.4 — Commit

`perf(#302): memoize BusinessRow and cache SpecialsSection shuffles`

---

## Fase 3 — Split recharts (S1)

**Objetivo**: remover recharts del profile path.

### Paso 3.1 — Modificar `src/components/stats/index.ts`

Exportar solo `TopList` (value) + tipos de `PieChartCard`. Remover `default as PieChartCard`.

### Paso 3.2 — Modificar `src/components/profile/StatsView.tsx`

- `import { lazy, Suspense } from 'react'`
- `const PieChartCard = lazy(() => import('../stats/PieChartCard'))`
- Wrappear los 2 PieChartCard en Suspense con fallback

### Paso 3.3 — Buscar otros consumers de PieChartCard

```bash
grep -rn "PieChartCard" src/ --include="*.tsx" --include="*.ts"
```

Aplicar lazy tambien si alguno esta en hot path.

### Paso 3.4 — Build local + verificacion de chunks

```bash
npm run build
ls -lh dist/assets/ | grep -E "recharts|index"
```

**Gate**: el chunk de recharts existe por separado y NO aparece en el import chain de StatsView sin Suspense.

### Paso 3.5 — Tests

- Si hay test de StatsView, verificar que renderiza con Suspense fallback inicial

### Paso 3.6 — Commit

`perf(#302): lazy-load recharts in StatsView to remove 374KB from profile path`

---

## Fase 4 — Admin lazy panels (S3)

**Objetivo**: reducir admin first-paint bundle.

### Paso 4.1 — Crear `src/components/ui/AdminPanelLoader.tsx`

Componente simple con CircularProgress centered (copiar patron de `TabLoader`).

### Paso 4.2 — Modificar `src/components/admin/AdminLayout.tsx`

- Convertir `TrendsPanel`, `FirebaseUsage`, `PerformancePanel`, `FeaturesPanel` a `React.lazy`
- Wrappear esos 4 tabs en `<Suspense fallback={<AdminPanelLoader />}>`
- Resto de tabs sin Suspense (no son lazy)

### Paso 4.3 — Build verification

```bash
npm run build
```

Verificar que hay chunks separados para cada lazy panel.

### Paso 4.4 — Test manual

- Abrir `/admin` en DEV
- Verificar que tab Resumen carga sin demora
- Click en Tendencias muestra brevemente el loader

### Paso 4.5 — Commit

`perf(#302): lazy-load recharts-heavy admin panels (TrendsPanel, FirebaseUsage, PerformancePanel, FeaturesPanel)`

---

## Fase 5 — Firestore waterfall fix (S2) — mas cuidado

**Objetivo**: paralelizar `fetchUserLikes` via schema change.

### Paso 5.1 — Actualizar tipo `CommentLike` en `src/types/` (o donde este)

Agregar `businessId: string`.

### Paso 5.2 — Actualizar converter (si existe)

Buscar `commentLikeConverter` — si no existe, usar el existente o crear. Agregar `businessId` al `fromFirestore`/`toFirestore`.

### Paso 5.3 — Modificar `src/services/comments.ts`

`likeComment(userId, commentId, businessId)` — agregar param, escribir campo.

### Paso 5.4 — Modificar consumers de `likeComment`

- `src/hooks/useCommentListBase.ts:112` — pasar `businessId` (ya disponible en scope)
- `src/services/syncEngine.ts:79` — leer `businessId` del payload y pasarlo

### Paso 5.5 — Modificar `src/types/offline.ts`

`CommentLikeOfflinePayload` agrega `businessId: string`.

### Paso 5.6 — Actualizar enqueue en `useCommentListBase`

Donde `withOfflineSupport` se llama para `comment_like`, incluir `businessId` en el payload.

### Paso 5.7 — Actualizar firestore.rules

`commentLikes` create:

- `keys().hasOnly(['userId', 'commentId', 'businessId', 'createdAt'])`
- Validacion: `businessId is string && size() > 0 && size() <= 50`
- Validacion: `commentId size() <= 128`

### Paso 5.8 — Actualizar firestore.indexes.json

Agregar indice `commentLikes(userId, businessId)`.

### Paso 5.9 — Crear Cloud Function `backfillCommentLikes`

En `functions/src/callable/backfillCommentLikes.ts`:

- Admin-only, rate limit 1/hora
- Itera `commentLikes` en batches de 500
- Por cada doc sin `businessId`, obtiene `comments/{commentId}.businessId` y hace update
- Logs de progreso
- Idempotente

### Paso 5.10 — Tests del callable

`functions/src/__tests__/callable/backfillCommentLikes.test.ts`:

- Skip docs con businessId ya seteado
- Batch update exitoso
- Docs con commentId invalido se skippean (no fallan)

### Paso 5.11 — Modificar `src/services/businessData.ts`

- `fetchBusinessData`: agregar 8va query al Promise.all (commentLikes con `where userId + where businessId`)
- Eliminar el `await fetchUserLikes` post-Promise.all
- Reconstruir `userCommentLikes: Set<string>` desde los docs
- Aplicar mismo fix en `fetchSingleCollection` case 'comments'

### Paso 5.12 — Deprecar `fetchUserLikes`

Marcar con JSDoc `@deprecated`. En una siguiente release se elimina (no en esta PR para permitir rollback).

### Paso 5.13 — Tests de businessData

Si no existe `src/services/businessData.test.ts`, crearlo:

- Mock de 8 queries
- Verificar que se invocan en Promise.all (sin `await` secuencial)
- Verificar que `userCommentLikes` se construye correctamente del resultado
- Edge case: sin comments, sin likes

### Paso 5.14 — Tests existentes a actualizar

- `src/services/comments.test.ts` — `likeComment` acepta 3er parametro
- `src/services/syncEngine.test.ts` — payload incluye `businessId`
- `functions/src/__tests__/triggers/commentLikes.test.ts` — validar `businessId` presente

### Paso 5.15 — Actualizar docs

- `docs/reference/firestore.md` — `commentLikes` con campo `businessId`
- `docs/reference/patterns.md` — nota "Paralelizacion de commentLikes via query directa"
- `docs/reference/security.md` — actualizar si hace falta en tabla de limits

### Paso 5.16 — Correr tests

```bash
npm run test:run
cd functions && npx vitest run
```

### Paso 5.17 — Commit (multiple, logical)

- `perf(#302): add businessId to commentLikes schema and rules`
- `perf(#302): paralellize commentLikes query in fetchBusinessData`
- `chore(#302): add backfillCommentLikes callable for migration`

---

## Fase 6 — Deploy y migracion

Este feature incluye un schema change no retrocompatible para `likeComment` (el frontend nuevo requiere pasar `businessId`, y la rule nueva requiere el campo). Orden de deploy preciso:

### Paso 6.1 — Pre-deploy: deploy de rules + indices (permisivas)

**Primero** desplegar una version intermedia de las rules que acepte con O sin `businessId`:

```javascript
// Transitional rule:
&& request.resource.data.keys().hasOnly(['userId', 'commentId', 'businessId', 'createdAt'])
    || request.resource.data.keys().hasOnly(['userId', 'commentId', 'createdAt'])
```

Deploy:

```bash
firebase deploy --only firestore:rules,firestore:indexes
```

Esperar que el indice se construya (~5-10 min, visible en Firebase console).

### Paso 6.2 — Deploy de Cloud Functions

```bash
firebase deploy --only functions
```

Incluye `backfillCommentLikes` callable nuevo + trigger actualizado.

### Paso 6.3 — Deploy de Hosting

```bash
firebase deploy --only hosting
```

Frontend nuevo envia `businessId` en todos los nuevos `likeComment`.

### Paso 6.4 — Ejecutar backfill

Admin ejecuta `backfillCommentLikes` via panel admin (o por consola). Script local opcional:

```bash
node scripts/run-backfill-commentLikes.mjs
```

Verificar en admin panel: `commentLikes` sin `businessId` deben ser 0 tras completar.

### Paso 6.5 — Deploy final de rules strict

Ya con backfill completo, deploy de rules strict (solo acepta con `businessId`):

```bash
firebase deploy --only firestore:rules
```

Esto es la version en specs.md.

### Paso 6.6 — Verificacion post-deploy

- Abrir un BusinessSheet con comments likeados → verificar que los likes se muestran (corazones llenos)
- Likear un comment nuevo → verificar que el doc tiene `businessId`
- Admin panel: revisar perfMetrics de `fetchBusinessData` tras 1 dia (esperado: p50 reduccion de 150ms+)

---

## Fase 7 — Cleanup y docs

### Paso 7.1 — Actualizar CHANGELOG

`docs/reports/changelog.md`:

```markdown
## v2.36.0

### Performance

- #302: Recharts removido de profile path (bundle -374KB). PieChartCard lazy-loaded en StatsView.
- #302: Admin panels con recharts (TrendsPanel, FirebaseUsage, PerformancePanel, FeaturesPanel) lazy-loaded (-60KB en admin first-paint).
- #302: `fetchBusinessData` paralelizado — elimina waterfall de commentLikes (-150 a -300ms por apertura).
- #302: Singleton businessMap util reemplaza `allBusinesses.find()` O(n) en 7 componentes.
- #302: SearchListView memoizado (BusinessRow React.memo + distancia precomputada).
- #302: SpecialsSection cache modulo-level para shuffles determinsticos.

### Schema changes

- `commentLikes` coleccion: campo `businessId: string` agregado. Backfill ejecutado post-deploy via callable admin.
```

### Paso 7.2 — Actualizar backlog

`docs/reports/backlog-producto.md`:

Marcar #302 como cerrado, mover a metricas.

### Paso 7.3 — Commit docs

`docs(#302): update changelog, backlog, firestore reference`

---

## Gates de calidad

En cada fase:

- [ ] `npm run lint` sin errores
- [ ] `npm run test:run` pasa
- [ ] `cd functions && npx vitest run` pasa
- [ ] `npm run build` exitoso
- [ ] Cobertura global >=80% (chequeo post-fase 5)

---

## Rollback plan

| Escenario | Accion |
|-----------|--------|
| Indice no construido al deploy | Esperar. Hosting deploy se puede diferir. |
| Query paralela falla | Revertir `services/businessData.ts` al patron con `fetchUserLikes` separado. No requiere rollback de rules si son transicionales. |
| Rule strict rechaza likes (frontend viejo en cache) | Aplicar rule transicional (paso 6.1) temporalmente. Frontend nuevo ya tiene SW que fuerza update. |
| Backfill falla a mitad | Idempotente — re-ejecutar. Documentar docs afectados en log. |
| Bundle regression (recharts vuelve) | Verificar con analyzer local antes del deploy. Si se detecta en prod, revertir Fase 3. |

---

## Tracking de progreso

| Fase | Descripcion | Estado |
|------|-------------|--------|
| 1 | Singleton businessMap + refactor consumers | ⏳ |
| 2 | SearchListView memo + SpecialsSection cache | ⏳ |
| 3 | Split recharts (StatsView lazy) | ⏳ |
| 4 | Admin lazy panels | ⏳ |
| 5 | Firestore waterfall fix (schema change) | ⏳ |
| 6 | Deploy + migracion | ⏳ |
| 7 | Cleanup y docs | ⏳ |

---

## Referencias

- PRD: [prd.md](./prd.md)
- Specs: [specs.md](./specs.md)
- Issue: <https://github.com/benoffi7/modo-mapa/issues/302>
- Health check fuente: `/health-check` 2026-04-18, reportado en body del issue
