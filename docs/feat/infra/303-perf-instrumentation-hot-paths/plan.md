# Plan: Perf instrumentation — hot paths

**Feature:** 303-perf-instrumentation-hot-paths
**PRD:** [prd.md](./prd.md)
**Specs:** [specs.md](./specs.md)

Branch: se hace dentro de la base `new-home` (siguiendo la convencion del repo) o en una feature branch `feat/303-perf-instrumentation` si el volumen lo amerita.

---

## Fase 1 — Helpers y tests base

**Objetivo:** dejar disponibles los wrappers antes de adoptarlos.

1. Editar `src/utils/perfMetrics.ts`:
   - Agregar `import type { Query, DocumentReference, QuerySnapshot, DocumentSnapshot } from 'firebase/firestore';`
   - Agregar `import { getDocs, getDoc } from 'firebase/firestore';` (imports reales, no type-only)
   - Exportar `measuredGetDocs<T>(name, q)` y `measuredGetDoc<T>(name, ref)` (ver specs)
2. Editar `src/utils/perfMetrics.test.ts`:
   - Agregar `describe('measuredGetDocs')` con 2 casos (delegates to measureAsync with name, returns snapshot)
   - Agregar `describe('measuredGetDoc')` con 2 casos
3. Correr `npm run test:run -- perfMetrics`. Debe pasar verde.
4. Commit: `feat(#303): add measuredGetDocs/measuredGetDoc helpers in perfMetrics`

---

## Fase 2 — Seed perfCounters y performance.queries

**Objetivo:** poblar el admin panel post-seed sin esperar a triggers.

1. Editar `scripts/seed-admin-data.mjs`:
   - Agregar bloque `console.log('Seeding perf counters...')` despues del bloque de 7 perfMetrics docs (linea ~852).
   - Escribir `config/perfCounters` con muestras de los 17 triggers (ver specs §15).
   - Enriquecer `dailyMetrics/{today}` con `performance.{vitals, queries, functions}` via merge (ver specs §15).
   - Actualizar los logs finales (`console.log('- seed perfCounters con 17 triggers...')`).
2. Correr local:
   ```bash
   npm run emulators   # dejar corriendo
   node scripts/seed-admin-data.mjs
   ```
3. Abrir `http://localhost:5173/admin` → tab Rendimiento. Verificar:
   - `FunctionTimingTable` muestra 17 filas con p50/p95.
   - `QueryLatencyTable` muestra 11 filas incluyendo `businessData_ratings`, `userProfile_comments`, etc.
   - Semaforos de vitals pintan (LCP 2100ms, INP 150ms).
4. Commit: `chore(#303): seed perfCounters and dailyMetrics performance sample`

---

## Fase 3 — P0 hot paths (businessData.ts + userProfile.ts)

**Objetivo:** instrumentar los paths mas transitados.

### 3.1 businessData.ts

1. Editar `src/services/businessData.ts`:
   - Agregar `import { measureAsync, measuredGetDocs, measuredGetDoc } from '../utils/perfMetrics';`
   - En `fetchUserLikes`: envolver el `Promise.all(batches.map(...))` con `measureAsync('businessData_userLikes', () => Promise.all(...))`
   - En `fetchSingleCollection`: envolver cada case segun specs §2
   - En `fetchBusinessData`: reemplazar cada `getDoc`/`getDocs` del `Promise.all` con `measuredGetDoc` / `measuredGetDocs`
2. Crear `src/services/businessData.test.ts` con los 3 suites: `fetchBusinessData`, `fetchSingleCollection` (7 cases parametrizados), `fetchUserLikes` (2 casos: con IDs y sin IDs). Ver specs §Estrategia de tests.
3. Correr `npm run test:run -- businessData`. Verificar cobertura >= 80% para lineas modificadas.
4. Verificar manualmente en el browser (DEV mode con `analyticsEnabled: true` simulado) que `measureAsync` se llama — no es critico en DEV porque el sessionId solo se inicializa en PROD, pero el spy de tests ya valida el wrappeo.

### 3.2 userProfile.ts

1. Editar `src/services/userProfile.ts`:
   - Agregar import de `measureAsync, measuredGetDoc, measuredGetDocs`
   - Envolver `fetchUserProfile`: 6 lecturas paralelas + userDocPromise wrapper
   - Envolver `fetchUserProfileDoc` con `measuredGetDoc('userProfile_doc', ref)`
   - Envolver el `getDoc` dentro de `updateUserDisplayName` con `measuredGetDoc('userProfile_existsCheck', ref)`
2. Editar `src/services/__tests__/userProfile.test.ts`:
   - Agregar mock de `measureAsync` / helpers
   - Agregar suite de instrumentacion (6 names en fetchUserProfile + 1 en fetchUserProfileDoc + 1 en updateUserDisplayName)
3. Correr tests. Deben pasar.
4. Commit: `perf(#303): instrument businessData and userProfile hot paths with measureAsync`

---

## Fase 4 — P1 user-facing frecuentes

**Objetivo:** cubrir los 5 services de mas volumen despues de los hot paths.

Para cada uno repetir el patron: importar helpers → envolver cada read → ampliar tests con instrumentation suite → correr tests.

1. `src/services/ratings.ts` (+ ampliar `ratings.test.ts`): 5 sites segun specs §4
2. `src/services/checkins.ts` (+ ampliar `checkins.test.ts`): 3 sites segun specs §5
3. `src/services/recommendations.ts` (crear `recommendations.test.ts` si no existe): 3 sites segun specs §6
4. `src/services/menuPhotos.ts` (+ ampliar `__tests__/menuPhotos.test.ts`): 3 sites segun specs §7
5. `src/services/follows.ts` (crear `follows.test.ts` si no existe): 4 sites segun specs §8

Correr `npm run test:run` al final de la fase para validar todo pasa.

Commit: `perf(#303): instrument ratings, checkins, recommendations, menuPhotos, follows`

---

## Fase 5 — P2 paginados y secundarios

1. `src/services/sharedLists.ts` (+ ampliar `sharedLists.test.ts`): 6 sites segun specs §9
2. `src/services/suggestions.ts` (crear `suggestions.test.ts` si no existe — marcada baja prioridad en tests.md pero ahora tiene logica instrumentable): 3 sites segun specs §10
3. `src/services/users.ts` (crear `users.test.ts` si no existe): 3 sites segun specs §11
4. `src/services/rankings.ts` (+ ampliar `rankings.test.ts`): 3 sites segun specs §12

Commit: `perf(#303): instrument sharedLists, suggestions, users, rankings`

---

## Fase 6 — P3 infrecuentes

1. `src/services/trending.ts` (crear test si no existe — 1 test): `trending_current`
2. `src/services/metrics.ts` (crear test si no existe — 1 test): `metrics_byDate`
3. `src/services/config.ts` (crear test si no existe — 1 test): `config_appVersion`
4. `src/services/priceLevels.ts` (+ ampliar `priceLevels.test.ts`): 2 sites segun specs §14

Commit: `perf(#303): instrument trending, metrics, config, priceLevels`

---

## Fase 7 — Documentacion

1. Editar `docs/reference/patterns.md` seccion "Queries y cache":
   - Agregar la fila "measureAsync en services" segun specs §16.
2. Editar `docs/_sidebar.md`:
   - Agregar dentro del grupo **Infra** (despues de `#259 Admin GA4 Analytics Dashboard`):
     ```md
     - [#303 Perf Instrumentation Hot Paths](/feat/infra/303-perf-instrumentation-hot-paths/prd.md)
       - [Specs](/feat/infra/303-perf-instrumentation-hot-paths/specs.md)
       - [Plan](/feat/infra/303-perf-instrumentation-hot-paths/plan.md)
     ```
3. Commit: `docs(#303): document measureAsync convention in patterns and register in sidebar`

---

## Fase 8 — Verificacion final

1. Correr suite completa:
   ```bash
   npm run lint
   npm run typecheck
   npm run test:run
   npm run test:coverage
   ```
   Todos deben pasar. Cobertura >= 80% enforced en CI.
2. Smoke test con emuladores:
   ```bash
   npm run dev:full
   # en otra terminal:
   node scripts/seed-admin-data.mjs
   ```
   - Login como admin en `/admin` → tab Rendimiento.
   - Verificar `FunctionTimingTable` poblada con 17 triggers.
   - Verificar `QueryLatencyTable` poblada con >= 11 queries (incluyendo las nuevas hot paths).
3. Navegar a un BusinessSheet en el mapa, abrir un perfil de usuario en Social → verificar que no hay errores en consola. Los timings de `measureAsync` solo se capturan en PROD (guard `sessionId` en `measureAsync`), por lo que en DEV el wrappeo es passthrough silencioso.
4. Checklist merge:
   - [ ] Todos los tests pasan
   - [ ] Lint + typecheck pasan
   - [ ] Coverage >= 80% en archivos modificados
   - [ ] Panel admin se ve correctamente post-seed
   - [ ] `docs/reference/patterns.md` actualizado
   - [ ] `docs/_sidebar.md` incluye la nueva entrada

---

## Orden de commits recomendado

1. `feat(#303): add measuredGetDocs/measuredGetDoc helpers in perfMetrics`
2. `chore(#303): seed perfCounters and dailyMetrics performance sample`
3. `perf(#303): instrument businessData and userProfile hot paths`
4. `perf(#303): instrument ratings, checkins, recommendations, menuPhotos, follows`
5. `perf(#303): instrument sharedLists, suggestions, users, rankings`
6. `perf(#303): instrument trending, metrics, config, priceLevels`
7. `docs(#303): document measureAsync convention in patterns and sidebar`

Alternativamente, si se prefiere un solo commit grande por la naturaleza cross-cutting:

- Opcion B: `perf(#303): wrap service-layer Firestore reads with measureAsync + seed perfCounters`

La opcion A es preferible porque cada commit es reviewable independientemente y no bloquea el CI si una fase rompe algo puntual.

---

## Criterios de aceptacion post-merge

- [ ] Despues de 48h en prod, el admin panel muestra en `QueryLatencyTable` al menos 11 queries nuevas con count > 0 (incluyendo las P0: `businessData_ratings`, `businessData_comments`, `userProfile_comments`, `userProfile_ratings`).
- [ ] No aparecen regresiones en vitals (LCP / INP / CLS no suben en el daily trend durante 3 dias post-deploy).
- [ ] El grep `getDocs\(|getDoc\(` en `src/services/*.ts` fuera de lineas que incluyan `measureAsync` o `measuredGetDocs` / `measuredGetDoc` devuelve 0 matches (excepto los 4 legacy ya instrumentados: `notifications`, `userSettings`, `usePaginatedQuery`, y el `getCountOfflineSafe` interno).

---

## Rollback

El cambio es puramente aditivo:

- `measureAsync` es passthrough (si `sessionId` no esta inicializado, ejecuta `fn()` directamente).
- No hay nuevas colecciones Firestore ni cambios de schema.
- No hay cambios en rules.

Si se necesita rollback:

- `git revert` de los commits de instrumentacion deja el codigo como antes.
- El seed extra de `config/perfCounters` no afecta a produccion (el trigger `dailyMetrics` lo borra tras leer, ver `scheduled/dailyMetrics.ts`).
- No se requiere migracion de datos.

---

## Notas operativas

- No se necesitan indices Firestore nuevos.
- No se necesitan Cloud Function deploys (no se tocan triggers).
- No se necesita actualizar `firestore.rules`.
- No se necesita actualizar `_ipRateLimits`, `_rateLimits`, ni `USER_OWNED_COLLECTIONS`.
