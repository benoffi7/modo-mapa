# Plan: Tech debt — performance — allBusinesses lookups x16, lazy `<img>` x3, MUI chunk split, firebase/storage lazy

**Specs:** [specs.md](specs.md) (Diego Ciclo 2 — VALIDADO CON OBSERVACIONES)
**PRD:** [prd.md](prd.md) (Sofia Ciclo 2 — VALIDADO CON OBSERVACIONES)
**Fecha:** 2026-04-25
**Issue:** #324
**Branch:** `feat/324-perf-bundle-business-lookup` (single branch — no per-workstream branches)

---

## Resumen ejecutivo

| Workstream | Riesgo | Owner | Commits | Depende de |
|------------|--------|-------|---------|------------|
| **F0** — Baseline pre-#324 captura | Cero | luna | 1 (no-code; baseline file) | — |
| **F1 / S1** — 16 callsites a `getBusinessById` / `getBusinessMap` (+ patch R4 exclusion) | Bajo | luna | 7 | F0 |
| **F2 / S2** — 3 `<img>` lazy + decoding + dimensiones | Bajo | luna | 1 | — (intercalable dentro de luna; NO paralelo entre agentes — mismo owner que F1) |
| **F3 / S4** — 9 callsites de service: `limit()` + `measuredGetDocs` | Medio-bajo | nico | 4 | F1 |
| **F4 / S3.a** — Split MUI chunk en `mui-core` + `mui-icons` | Bajo | luna | 1 | F1 |
| **F5 / S3.b** — Refactor 4 consumers eager de `firebase/storage` + `getStorageLazy()` + tests | Medio | luna (firebase.ts singleton + componentes) + nico (services feedback/menuPhotos) | 4 | F4 |
| **F6 / S3.c** — Drop `firebase/storage` del manualChunk + patch R8 awk | Bajo | luna | 1 | F5 |
| **F7 / S5** — Investigar chunk `index-BuuweED0` 296 KB | Bajo | luna | 0-1 (find-only, opcional accion) | F2 + F4 + F6 |
| **F8** — Bundle size script + CI gate | Bajo | luna | 1 | F6 |
| **F9.1** — Docs pre-merge (estimaciones + baseline-post + guards docs) | Bajo | luna | 1 | F1..F8 |
| **F9.2** — Medicion latencia real post-deploy (Opcion A: commit post-staging en mismo PR; Opcion B: follow-up issue) | Cero | luna | 0-1 | post-deploy |

**Total commits planificados:** **21 base + 2 opcionales** (16 atomicos de codigo + 1 baseline + 1 bundle script + 1 docs F9.1 + 1 follow-up opcional F7.1 + 1 follow-up opcional F9.2 si Opcion A se aplica en mismo PR + auditorias).
**Tiempo estimado:** 2-3 dias de implementacion (M-grande).

---

## Workstream F0 — Baseline pre-#324 (capture-only)

**Objetivo:** congelar numeros de bundle de HEAD `new-home` antes de tocar nada (re obs Pablo #5).

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `docs/feat/infra/324-performance-bundle-business-lookup/baseline-pre.txt` | Crear archivo con output de `npx vite build` (tabla de chunks emitidos) + output de `npm run guards --guard 302` (lista de hits por rule) + tamanos exactos. Formato: stdout pegado tal cual entre `<pre>` blocks. |
| 2 | `npx vite build` | Ejecutar y pegar el bloque "dist/assets/*.js" en el archivo. |
| 3 | `npm run guards --guard 302` | Ejecutar y pegar la lista de hits por cada rule (R4, R-newMap, R6, R7, R8). |

**Commit:** `chore(#324): capture bundle + guards baseline pre-implementation`
**Owner:** luna
**Rollback:** N/A (no toca codigo).

---

## Workstream F1 — S1 callsites a `getBusinessById` / `getBusinessMap`

**Objetivo:** cerrar 14 hits de `R4-allBusinesses-find` + 2 hits de `R-newMap-allBusinesses` + caso especial Set en `useRatingPrompt`. Todos con tests.

**Branch:** `feat/324-perf-bundle-business-lookup` (todos los commits van a la misma rama).
**Owner:** luna (todos los archivos son hooks/components UI).

### Commit F1.1 — hooks de navegacion (deep links + navigate)

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `src/hooks/useDeepLinks.ts:26` | `allBusinesses.find((b) => b.id === bizId)` → `getBusinessById(bizId)` (importar de `../utils/businessMap`). |
| 2 | `src/hooks/useDeepLinks.ts:51` | `allBusinesses.find((b) => b.id === lastBusinessId)` → `getBusinessById(lastBusinessId)`. |
| 3 | `src/hooks/useDeepLinks.ts` (top) | Eliminar import de `allBusinesses` si no se usa mas en el archivo. |
| 4 | `src/hooks/useNavigateToBusiness.ts:20` | `allBusinesses.find(...) ?? null` → `getBusinessById(businessOrId) ?? null`. Limpiar import. |
| 5 | `src/hooks/useBusinessById.ts:14` | `allBusinesses.find(...) ?? null` → `getBusinessById(id) ?? null`. Limpiar import. |
| 6 | `src/hooks/__tests__/useDeepLinks.test.ts` | Crear test (si no existe) con cobertura: `?business=biz_001` selecciona biz; `?business=invalid` no navega. Mock de `getBusinessById` via `vi.mock('../../utils/businessMap')` con `vi.hoisted`. |
| 7 | `src/hooks/__tests__/useBusinessById.test.ts` | Crear/actualizar con paths `found / not_found / invalid_id`. |
| 8 | `src/hooks/__tests__/useNavigateToBusiness.test.ts` | Verificar que sigue pasando (sustitucion mecanica). |

**Commit:** `refactor(#324): migrate deep-link/navigate hooks to getBusinessById singleton`
**Riesgo:** Bajo (sustitucion mecanica).
**Rollback:** revertir el commit; `getBusinessMap` sigue intacto.
**Test gate:** `npm run test -- src/hooks/__tests__/useDeepLinks src/hooks/__tests__/useBusinessById src/hooks/__tests__/useNavigateToBusiness` debe pasar.

### Commit F1.2 — hooks de listas/historial (visitHistory, commentsListFilters, suggestions)

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `src/hooks/useVisitHistory.ts:63` | `business: allBusinesses.find(...) \|\| null` → `business: getBusinessById(v.businessId) ?? null`. Conservar el `\|\| null → ?? null` solo si es semanticamente equivalente (verificado en specs OBS-N4: ambos devuelven `null` para `undefined`). |
| 2 | `src/hooks/useCommentsListFilters.ts:48` | Idem para `data.businessId`. |
| 3 | `src/hooks/useSuggestions.ts:84` | `allBusinesses.find(...)` → `getBusinessById(fav.businessId)`. **NO tocar la iteracion de linea 66** (proyeccion pura, no es lookup). |
| 4 | `src/hooks/__tests__/useVisitHistory.test.ts` | Crear test: `visitsWithBusiness` resuelve `business: null` para id desconocido + resuelve correctamente para id conocido. Mock `getBusinessById`. |
| 5 | `src/hooks/__tests__/useCommentsListFilters.test.ts` | Crear test: comments con businessId desconocido tienen `business: null` (preservar comportamiento — no se filtran). |
| 6 | `src/hooks/__tests__/useSuggestions.test.ts` | Verificar que el scoring sigue produciendo el mismo orden post-swap. |

**Commit:** `refactor(#324): migrate list/history hooks to getBusinessById singleton`
**Riesgo:** Bajo.
**Rollback:** revertir commit.

### Commit F1.3 — useRatingPrompt (caso especial Set + lookup)

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `src/hooks/useRatingPrompt.ts:120` | Eliminar la variable `allBizIds = new Set(allBusinesses.map((b) => b.id))`. En el loop de check-ins reemplazar `if (!allBizIds.has(checkIn.businessId)) continue;` por `if (!getBusinessMap().has(checkIn.businessId)) continue;`. Importar `getBusinessMap` de `../utils/businessMap`. |
| 2 | `src/hooks/useRatingPrompt.ts:217` | `allBusinesses.find(...)` → `getBusinessById(promptData.businessId)`. |
| 3 | `src/hooks/useRatingPrompt.ts` (top) | Eliminar import de `allBusinesses` si ya no se usa. |
| 4 | `src/hooks/__tests__/useRatingPrompt.test.ts` | Actualizar: el filter de check-ins usa `getBusinessMap().has(...)` (mock con singleton vacio o con biz especifico). El navigateToBusiness usa `getBusinessById`. |

**Commit:** `refactor(#324): useRatingPrompt — drop allBizIds Set, consume singleton`
**Riesgo:** Bajo (cambio puntual, tests cubren ambos paths).

### Commit F1.4 — useLocalTrending (eliminar `useMemo` de businessCoords + dep array)

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `src/hooks/useLocalTrending.ts:39-42` | Eliminar `const businessCoords = useMemo(() => new Map(allBusinesses.map(...)), [])`. |
| 2 | `src/hooks/useLocalTrending.ts:50` | Reemplazar `const coords = businessCoords.get(biz.businessId);` por `const biz_lookup = getBusinessById(biz.businessId); if (!biz_lookup) return false;`. Cambiar el return a `return distanceKm(location.lat, location.lng, biz_lookup.lat, biz_lookup.lng) <= radius;`. Importar `getBusinessById`. |
| 3 | `src/hooks/useLocalTrending.ts:67` | Cambiar dep array de `[data, location.lat, location.lng, businessCoords]` a `[data, location.lat, location.lng]`. Agregar comentario inline: `// getBusinessById es estable (modulo-level singleton) — no entra al dep array`. |
| 4 | `src/hooks/useLocalTrending.ts` (top) | Eliminar import de `allBusinesses` si ya no se usa. |
| 5 | `src/hooks/__tests__/useLocalTrending.test.ts` | Crear/actualizar con cobertura **explicita de los 3 escenarios** (re obs Pablo Ciclo 2 #4). El test NO debe limitarse a "verificar que sigue pasando" — debe cubrir explicitamente el scenario de race condition entre mount y hidratacion del singleton. **Tests minimos requeridos:** (a) **singleton vacio en mount inicial** — `__resetBusinessMap()` antes del render; primer render con `getBusinessById` retornando `undefined` para todos los ids; el hook devuelve `[]` (no crash, no infinite loop). (b) **businesses validos en mount estable** — singleton ya hidratado al import (caso default actual); progressive radius funciona como antes (resultados ordenados por distancia ascendente). (c) **hidratacion async + segunda render** — primer render con singleton vacio devuelve `[]`; despues `__hydrateBusinessMap(...)` con businesses validos; rerender del hook (cambiar `data` o `location` en el dep array) — el hook produce los resultados validos. **Si el comportamiento actual es "allBusinesses ya esta poblado al import" (sin race posible),** el test (c) lo verifica explicitamente y documenta la asuncion en un comentario inline (`// Asumimos hidratacion sync al import — si esto cambia, el dep array necesita un trigger`). **Si Diego identifico race posible en specs OBS-N4 / I6,** el test (c) debe poder fallar reproduciblemente sin un trigger en el dep array — y el plan F1.4 step 3 debe agregar el trigger (ej. version counter del singleton). Antes de implementar, leer specs seccion OBS-N4 / I6 para confirmar cual de los dos paths aplica. |

**Commit:** `refactor(#324): useLocalTrending — drop businessCoords useMemo, consume singleton`
**Riesgo:** Bajo-medio (cambio mas profundo, dep array sensible). Si el test (c) revela que la asuncion "getBusinessById es estable" es falsa, la solucion es agregar un trigger al dep array (no revertir el commit).
**Rollback:** revertir commit; el `useMemo` original era zero-cost de re-render porque su dep array `[]` era constante.

### Commit F1.5 — RankingsView (drop new Map local)

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `src/components/social/RankingsView.tsx:38` | Eliminar `const businessMap = new Map(allBusinesses.map((b) => [b.id, b]));`. |
| 2 | `src/components/social/RankingsView.tsx:147` (donde se consume) | Reemplazar `businessMap.get(...)` por `getBusinessMap().get(...)`. Importar `getBusinessMap` de `../../utils/businessMap`. |
| 3 | `src/components/social/RankingsView.tsx` (top) | Eliminar import de `allBusinesses` si ya no se usa. |
| 4 | `src/components/social/__tests__/RankingsView.test.tsx` | Actualizar: zoneTrending mapping resuelve via `getBusinessMap().get(...)` y pasa `fullBusiness` a `TrendingBusinessCard`. Mock del singleton. |

**Commit:** `refactor(#324): RankingsView — replace local Map with getBusinessMap singleton`
**Riesgo:** Bajo.

### Commit F1.6 — components lists/social/profile (4 archivos)

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `src/components/lists/FavoritesList.tsx:58` | `allBusinesses.find(...)` → `getBusinessById(data.businessId)`. Importar. |
| 2 | `src/components/lists/ListDetailScreen.tsx:213` | Idem para `item.businessId`. |
| 3 | `src/components/social/ReceivedRecommendations.tsx:65` | Idem para `rec.businessId`. |
| 4 | `src/components/social/ReceivedRecommendations.tsx:100` | Idem (segundo callsite del mismo archivo). |
| 5 | `src/components/profile/RatingsList.tsx:41` | `\|\| null` → `?? null` con `getBusinessById(data.businessId)`. |
| 6 | `src/utils/businessHelpers.ts:5` | `allBusinesses.find((b) => b.id === id)?.name ?? id` → `getBusinessById(id)?.name ?? id`. Eliminar import de `allBusinesses` si no se usa. |
| 7 | `src/utils/__tests__/businessHelpers.test.ts` | Verificar que sigue pasando (mock `__resetBusinessMap` en `beforeEach`). |

**Commit:** `refactor(#324): migrate components lists/social/profile + businessHelpers util to singleton`
**Riesgo:** Bajo (sustituciones mecanicas con if-guard ya presentes).

### Commit F1.7 — Patch R4 exclusion + test hidratacion + JSDoc preserva

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `scripts/guards/checks.mjs:108` | Cambiar `cmd` de `R4-allBusinesses-find` de `grep -rn "allBusinesses\\.find" src/ --include="*.ts" --include="*.tsx" \|\| true` a `grep -rn "allBusinesses\\.find" src/ --include="*.ts" --include="*.tsx" \| grep -v "src/utils/businessMap.ts" \|\| true`. **Patron simetrico** con la exclusion ya presente en `R-newMap-allBusinesses` linea 123. |
| 2 | `src/utils/__tests__/businessMap.test.ts` | Agregar bloque `describe('hidratacion vacia')` con: con `allBusinesses.length = 0` mockeado, `getBusinessMap()` retorna Map vacio (`size === 0`); `getBusinessById('cualquier-id')` retorna `undefined`. Usar `vi.doMock` antes del import + `__resetBusinessMap()` en `beforeEach`. |
| 3 | `src/utils/businessMap.ts:9` | (sin cambio en el codigo) — la JSDoc que menciona el patron prohibido se preserva. **Verificar que NO se reescribe**. Decision tecnica #3 del specs. |

**Commit:** `chore(#324): exclude businessMap.ts from R4 guard + add hidratacion test`
**Riesgo:** Bajo.
**Rollback:** revertir commit; el rule R4 vuelve a reportar 15 hits (el JSDoc) — no es bloqueante porque ya esta cerrado.

**Verificacion final F1:** `npm run guards --guard 302 --rule R4-allBusinesses-find` → 0 hits. `npm run guards --guard 302 --rule R-newMap-allBusinesses` → 0 hits. `npm run test -- src/hooks src/components src/utils` → green.

---

## Workstream F2 — S2 lazy `<img>` (3 callsites)

**Objetivo:** cerrar 3 hits de `R6-img-without-lazy`.
**Owner:** luna.
**Intercalable con F1 (NO paralelo entre agentes):** F2 puede ejecutarse en cualquier punto entre los commits de F1 — luna decide el orden interno (no comparten archivos). Como ambos workstreams tienen el mismo owner, no hay paralelismo real entre agentes; es secuencial dentro de la cadena de luna. El orchestrator NO debe interpretar "paralelo" como "se puede correr simultaneo con otro agente". Re obs Pablo Ciclo 2 #1.

### Commit F2.1 — 3 imgs lazy + decoding + dimensiones + tests

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `src/components/business/MenuPhotoSection.tsx:82` | Agregar al `<img>`: `loading="lazy"`, `decoding="async"`, `width={400}`, `height={200}`. Mantener `style={{ width: '100%', maxHeight: 200, objectFit: 'cover', borderRadius: 4 }}` y `onError`. |
| 2 | `src/components/business/MenuPhotoViewer.tsx:78` | Agregar: `loading="lazy"`, `decoding="async"`. **NO** setear `width`/`height` HTML (modal fullscreen con `objectFit: contain` necesita auto-fit). Comentario inline justificando. Mantener `onError`. |
| 3 | `src/components/business/MenuPhotoUpload.tsx:129` | Agregar: `loading="lazy"`, `decoding="async"`, `width={400}`, `height={300}`. Mantener `style` y handlers. |
| 4 | `src/components/business/__tests__/MenuPhotoSection.test.tsx` | Crear/actualizar: `<img>` rendereado tiene `loading="lazy"`, `decoding="async"`, `width=400`, `height=200`. Usar `screen.getByRole('img')` + `getAttribute`. |
| 5 | `src/components/business/__tests__/MenuPhotoViewer.test.tsx` | Crear: `loading="lazy"`, `decoding="async"`. NO verificar dimensiones (intentional). |
| 6 | `src/components/business/__tests__/MenuPhotoUpload.test.tsx` | Crear: con preview presente, `<img>` tiene los 4 atributos. |

**Commit:** `perf(#324): lazy + async decode + dims on menu photo imgs`
**Riesgo:** Bajo (atributos HTML aditivos, sin cambio de logica).
**Rollback:** revertir commit; los `<img>` vuelven al estado anterior.
**Verificacion:** `npm run guards --guard 302 --rule R6-img-without-lazy` → 0 hits.

---

## Workstream F3 — S4 `limit()` + `measuredGetDocs` en 9 callsites de service

**Objetivo:** cerrar 9 hits de `303/R1-services-raw-getDocs` + agregar caps de billing-DoS.
**Owner principal:** **nico** (es capa de servicios).
**Coordinacion:** verificar branch state de #325 antes de empezar (re obs Pablo #6). Si #325 esta open, alertar tech-lead. Si #325 esta merged, **saltar este workstream** — los 9 callsites ya estarian wrappeados.
**Depende de F1:** evita mezclar refactor de business lookups con caps de queries en mismo PR commit. No es bloqueante tecnico.

### Commit F3.1 — `services/specials.ts` (incluye REG #2 absorbido — `saveAllSpecials.existingSnap`)

**Resolucion REG #2 (Diego Ciclo 2):** se incluye `saveAllSpecials.existingSnap` con `limit(100)` (cap simetrico con `saveAllAchievements`). Patron identico, mismo proposito (cleanup admin pre-upsert).

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `src/services/specials.ts` (top) | Importar `limit` desde `firebase/firestore` + `measuredGetDocs` desde `../utils/perfMetrics`. |
| 2 | `src/services/specials.ts:13` | `fetchSpecials`: wrappear con `measuredGetDocs('specials_fetchAll', query(collection(db, COLLECTIONS.SPECIALS), orderBy('order'), limit(50)))`. |
| 3 | `src/services/specials.ts:19` | `fetchActiveSpecials` (linea de declaracion — **REG #1 corregido**): wrappear con `measuredGetDocs('specials_fetchActive', query(collection(db, COLLECTIONS.SPECIALS), where('active', '==', true), orderBy('order'), limit(20)))`. **NO modificar la linea 31** — esa pertenece a `saveAllSpecials`. |
| 4 | `src/services/specials.ts:31` | `saveAllSpecials.existingSnap` (cleanup admin): wrappear con `measuredGetDocs('specials_existingForCleanup', query(collection(db, COLLECTIONS.SPECIALS), limit(100)))`. **REG #2 absorbido** — cap simetrico con achievements. |
| 5 | `src/services/__tests__/specials.test.ts` | Crear: `fetchActiveSpecials` arma query con `limit(20)` (spy de `query`). `fetchSpecials` con `limit(50)`. `saveAllSpecials.existingSnap` con `limit(100)`. Todos los calls pasan por `measuredGetDocs` (spy del modulo). |

**Commit:** `perf(#324): specials — limit() + measuredGetDocs (closes 3 R1 hits)`
**Riesgo:** Bajo-medio (admin cleanup cappeado a 100; si en runtime hay >100 specials la limpieza sera incompleta — improbable porque admin-managed con cap natural pequeno).
**Mitigacion:** comentario inline en `saveAllSpecials.existingSnap`: `// limit(100) — admin-managed coleccion con cap natural <= 50; el cap defensivo evita billing DoS si admin error introduce duplicados masivos.`

### Commit F3.2 — `services/achievements.ts`

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `src/services/achievements.ts` (top) | Importar `limit` + `measuredGetDocs`. |
| 2 | `src/services/achievements.ts:14` | `fetchAchievements`: wrappear con `measuredGetDocs('achievements_fetchAll', query(collection(db, COLLECTIONS.ACHIEVEMENTS), orderBy('order'), limit(100)))`. |
| 3 | `src/services/achievements.ts:23` | `saveAllAchievements.existingSnap`: `measuredGetDocs('achievements_existingForCleanup', query(collection(db, COLLECTIONS.ACHIEVEMENTS), limit(100)))`. |
| 4 | `src/services/__tests__/achievements.test.ts` | Crear: ambos callsites con `limit(100)` + `measuredGetDocs`. |

**Commit:** `perf(#324): achievements — limit() + measuredGetDocs (closes 2 R1 hits)`
**Riesgo:** Bajo.

### Commit F3.3 — `services/sharedLists.ts`

**Numeros de linea verificados con `grep -n` por Diego Ciclo 2 sobre HEAD `new-home`** — usar exactamente: `deleteList:86`, `fetchListItems:130`, `fetchUserLists:177`, `fetchSharedWithMe:203`.

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `src/services/sharedLists.ts` (top) | Importar `limit` + `measuredGetDocs`. |
| 2 | `src/services/sharedLists.ts:177` | `fetchUserLists`: `measuredGetDocs('sharedLists_userLists', query(getSharedListsCollection(), where('ownerId', '==', userId), orderBy('updatedAt', 'desc'), limit(100)))`. |
| 3 | `src/services/sharedLists.ts:203` | `fetchSharedWithMe`: `measuredGetDocs('sharedLists_sharedWithMe', query(getSharedListsCollection(), where('editorIds', 'array-contains', userId), orderBy('updatedAt', 'desc'), limit(100)))`. |
| 4 | `src/services/sharedLists.ts:130` | `fetchListItems`: `measuredGetDocs('sharedLists_listItems', query(collection(db, COLLECTIONS.LIST_ITEMS).withConverter(listItemConverter), where('listId', '==', listId), limit(500)))`. |
| 5 | `src/services/sharedLists.ts:86-87` | `deleteList.itemsSnap`: wrappear SIN `limit()` con `measuredGetDocs('sharedLists_deleteListItems', query(...))`. Comentario inline: `// No limit() — cascade delete needs all items. Firestore batch limit (500) is enforced manually below.`. |
| 6 | `src/services/__tests__/sharedLists.test.ts` | Agregar bloque para los 4 callsites: `fetchUserLists`/`fetchSharedWithMe`/`fetchListItems` con sus caps. `deleteList` SIN `limit` (preservado). Todos con `measuredGetDocs`. |

**Commit:** `perf(#324): sharedLists — limit() + measuredGetDocs on 4 callsites (closes 4 R1 hits)`
**Riesgo:** Medio (`fetchListItems` cap 500 puede truncar listas muy grandes; rate limit existente #289 mitiga; `getCountOfflineSafe` no aplica aca).

### Commit F3.4 — `services/feedback.ts` (`fetchUserFeedback`)

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `src/services/feedback.ts` (top) | Importar `limit` + `measuredGetDocs`. |
| 2 | `src/services/feedback.ts:64` | `fetchUserFeedback`: wrappear con `measuredGetDocs('feedback_userFeedback', query(ref, where('userId', '==', userId), orderBy('createdAt', 'desc'), limit(200)))`. |
| 3 | `src/services/__tests__/feedback.test.ts` | Crear/actualizar: `fetchUserFeedback` con `limit(200)` + `measuredGetDocs`. |

**Commit:** `perf(#324): feedback.fetchUserFeedback — limit(200) + measuredGetDocs (closes 1 R1 hit)`
**Riesgo:** Bajo.

**Verificacion final F3:** `npm run guards --guard 303 --rule R1-services-raw-getDocs`. Delta esperado: -10 hits (3 specials + 2 achievements + 4 sharedLists + 1 feedback = 10). Auditoria post-S4 obligatoria — si la cuenta no cuadra, identificar diferencia y absorber o dejar para #325.

---

## Workstream F4 — S3.a Split MUI manualChunk

**Objetivo:** cerrar 1 hit de `R7-mui-icons-not-split`.
**Owner:** luna.
**Depende de F1:** ordering. Independiente tecnicamente.

### Commit F4.1 — vite.config.ts split mui-core/mui-icons

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `vite.config.ts:117-122` | Cambiar `manualChunks` de `mui: ['@mui/material', '@mui/icons-material']` a dos entries: `'mui-core': ['@mui/material', '@mui/system']` + `'mui-icons': ['@mui/icons-material']`. **Mantener temporalmente** `firebase/storage` dentro del chunk firebase — se quita en F6. |

```ts
// Estado tras F4 (firebase/storage queda hasta F6)
manualChunks: {
  firebase: ['firebase/app', 'firebase/auth', 'firebase/firestore', 'firebase/storage'],
  'mui-core': ['@mui/material', '@mui/system'],
  'mui-icons': ['@mui/icons-material'],
  recharts: ['recharts'],
  'google-maps': ['@vis.gl/react-google-maps'],
}
```

| Paso | Archivo | Cambio |
|------|---------|--------|
| 2 | `npx vite build` (verificacion local) | Confirmar que el output emite `mui-core-*.js` y `mui-icons-*.js` separados. |
| 3 | `npm run guards --guard 302 --rule R7-mui-icons-not-split` | Confirmar 0 hits. |

**Commit:** `perf(#324): split MUI chunk into mui-core + mui-icons`
**Riesgo:** Bajo (config build-time).
**Rollback:** revertir commit; el chunk `mui` monolitico vuelve.

---

## Workstream F5 — S3.b Refactor 4 consumers eager de `firebase/storage`

**Objetivo:** desatar `firebase/storage` del grafo eager para que F6 (drop del manualChunk) tenga efecto.
**Owners mixtos:** luna (firebase.ts singleton + PhotoReviewCard) + nico (services feedback/menuPhotos).
**Depende de F4:** ordering. Tecnicamente independiente pero queremos medir el efecto del split MUI antes.
**Coordinacion ownership:** los 4 sub-commits de F5 NO se pueden mezclar entre owners — cada uno atomico, asignado.

### Commit F5.1 — [luna] `src/config/firebase.ts` — singleton → `getStorageLazy()` async + tests

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `src/config/firebase.ts:12` | Eliminar `import { getStorage, connectStorageEmulator } from 'firebase/storage'`. |
| 2 | `src/config/firebase.ts:12` (nuevo) | Agregar `import type { FirebaseStorage } from 'firebase/storage';` (type-only, no contribuye al runtime). |
| 3 | `src/config/firebase.ts:40` | Eliminar `export const storage = getStorage(app);`. |
| 4 | `src/config/firebase.ts:60` | Eliminar `connectStorageEmulator(storage, 'localhost', 9199);` del bloque eager. |
| 5 | `src/config/firebase.ts` (final) | Agregar `getStorageLazy()` con cache **promise-based** (snippet del specs seccion "Snippet conceptual"): `let storagePromise: Promise<FirebaseStorage> \| null = null; export async function getStorageLazy(): Promise<FirebaseStorage> { if (!storagePromise) { storagePromise = (async () => { const { getStorage, connectStorageEmulator } = await import('firebase/storage'); const storage = getStorage(app); if (import.meta.env.DEV) connectStorageEmulator(storage, 'localhost', 9199); return storage; })(); } return storagePromise; }`. |
| 6 | `src/config/__tests__/firebase.test.ts` | Crear archivo. **REQUERIDOS** (4 tests minimos): (a) cache miss llama `getStorage(app)`; (b) cache hit no re-importa (spy `toHaveBeenCalledTimes(1)`); (c) DEV + `Promise.all([getStorageLazy() x3])` llama `connectStorageEmulator` exactamente 1 vez; (d) PROD no llama `connectStorageEmulator`. Mock `firebase/storage` con `vi.mock` + `vi.hoisted` para spies. Mock de `import.meta.env.DEV` via `vi.stubEnv('DEV', true/false)`. |

**Commit:** `refactor(#324): firebase config — replace storage singleton with getStorageLazy() promise-cache + tests`
**Riesgo:** Medio (breaking change interno; los 3 importadores indirectos romperan `tsc -b` hasta F5.2/F5.3/F5.4).
**Mitigacion:** ejecutar F5.2/F5.3/F5.4 inmediatamente despues, sin push intermedio. Pre-push hook (`tsc -b && vite build`) bloqueara push hasta tener los 4 commits aplicados.
**Rollback:** revertir el bloque de 4 commits F5.1-F5.4 en orden inverso.

### Commit F5.2 — [nico] `src/services/feedback.ts` — dynamic import + `getStorageLazy()`

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `src/services/feedback.ts:5` | Eliminar `import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'`. |
| 2 | `src/services/feedback.ts:6` | Cambiar `import { db, storage } from '../config/firebase'` a `import { db } from '../config/firebase'`. |
| 3 | `src/services/feedback.ts:52-59` (cuerpo de `sendFeedback`, dentro de `if (mediaFile)`) | Reemplazar el codigo de upload por: `const { ref, uploadBytes, getDownloadURL } = await import('firebase/storage'); const { getStorageLazy } = await import('../config/firebase'); const storage = await getStorageLazy(); const storageRef = ref(storage, storagePath); await uploadBytes(storageRef, mediaFile); const mediaUrl = await getDownloadURL(storageRef);`. |
| 4 | `src/services/__tests__/feedback.test.ts` | Actualizar tests existentes: ajustar mocks para que reflejen el dynamic import. Mock de `await import('firebase/storage')` y `await import('../config/firebase')`. Verificar que `getStorageLazy` se llama exactamente 1 vez por upload. |

**Commit:** `refactor(#324): feedback.sendFeedback — dynamic import firebase/storage`
**Riesgo:** Medio (cambio de path async dentro de upload; el upload existente debe seguir funcionando).

### Commit F5.3 — [nico] `src/services/menuPhotos.ts` — dynamic import en upload + `getMenuPhotoUrl`

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `src/services/menuPhotos.ts:5` | Eliminar `import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage'`. |
| 2 | `src/services/menuPhotos.ts:8` | Mantener `import type { UploadTask } from 'firebase/storage'` (TS lo elide del runtime). |
| 3 | `src/services/menuPhotos.ts:9` | Cambiar `import { db, storage, functions } from '../config/firebase'` a `import { db, functions } from '../config/firebase'`. |
| 4 | `src/services/menuPhotos.ts:56-57` (`uploadMenuPhoto`, despues del check de `pendingSnap`) | Insertar: `const { ref, uploadBytesResumable } = await import('firebase/storage'); const { getStorageLazy } = await import('../config/firebase'); const storage = await getStorageLazy();` antes del `const storageRef = ref(storage, storagePath);` y `const uploadTask: UploadTask = uploadBytesResumable(...);`. |
| 5 | `src/services/menuPhotos.ts:140-141` (`getMenuPhotoUrl`) | Cuerpo: `const { ref, getDownloadURL } = await import('firebase/storage'); const { getStorageLazy } = await import('../config/firebase'); const storage = await getStorageLazy(); return getDownloadURL(ref(storage, path));`. |
| 6 | `src/services/__tests__/menuPhotos.test.ts` | Actualizar mocks para dynamic imports. Verificar que `getStorageLazy` se llama 1 vez por path. |

**Commit:** `refactor(#324): menuPhotos — dynamic import firebase/storage in upload + getUrl`
**Riesgo:** Medio (overhead `await import` en primer mount; specs cuantifica ~80-100ms en 4G primera vez, <5ms despues).

### Commit F5.4 — [luna] `src/components/admin/PhotoReviewCard.tsx` — IIFE async en useEffect (OBS-N1 corregido)

**Aclaracion OBS-N1 absorbida del specs**: el import real es `ref, getDownloadURL` (no `deleteObject` como el PRD original). El delete pasa por `deleteMenuPhoto` (callable HTTPS) y NO se toca aqui — solo refactorizamos el `useEffect` que resuelve la URL del thumbnail.

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `src/components/admin/PhotoReviewCard.tsx:4` | Eliminar `import { ref, getDownloadURL } from 'firebase/storage'`. |
| 2 | `src/components/admin/PhotoReviewCard.tsx:5` | Eliminar `import { storage } from '../../config/firebase'`. |
| 3 | `src/components/admin/PhotoReviewCard.tsx:27-35` (`useEffect` que resuelve URL) | Refactorizar a IIFE async con cancelacion: `useEffect(() => { let cancelled = false; (async () => { const path = photo.thumbnailPath \|\| photo.storagePath; if (!path) return; try { const { ref, getDownloadURL } = await import('firebase/storage'); const { getStorageLazy } = await import('../../config/firebase'); const storage = await getStorageLazy(); const url = await getDownloadURL(ref(storage, path)); if (!cancelled) setImageUrl(url); } catch (err) { logger.error('[PhotoReviewCard] getDownloadURL failed:', err); if (!cancelled) setImageUrl(null); } })(); return () => { cancelled = true; }; }, [photo]);`. |
| 4 | `src/components/admin/PhotoReviewCard.tsx:62` (`handleDelete`) | **Sin cambio** — sigue invocando `deleteMenuPhoto` (callable HTTPS). |
| 5 | `src/components/admin/__tests__/PhotoReviewCard.test.tsx` | Actualizar/crear: el `useEffect` ejecuta IIFE async, setea `imageUrl` cuando resuelve, y `setImageUrl(null)` en error. Mock de `firebase/storage` y `getStorageLazy`. Verificar cleanup `cancelled`. |

**Commit:** `refactor(#324): PhotoReviewCard — dynamic import firebase/storage in useEffect`
**Riesgo:** Bajo (admin lazy a nivel ruta; cambio se aplica solo al montaje de la card).

**Verificacion final F5:** `tsc -b && vite build` debe pasar (verifica que no quedan importadores indirectos del singleton `storage`). Si hay un import oculto no listado, TS lo reporta como error de import. Auditoria adicional: `grep -rn "from '.*config/firebase'" src/ | grep storage` → 0 hits.

---

## Workstream F6 — S3.c Drop `firebase/storage` del manualChunk + patch R8 awk

**Objetivo:** materializar la separacion del chunk `firebase/storage` async post-S3.b.
**Owner:** luna.
**Depende estrictamente de F5 completo**.

### Commit F6.1 — drop firebase/storage + patch R8 + verificar dist/stats.html

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `vite.config.ts:118` | Cambiar `firebase: ['firebase/app', 'firebase/auth', 'firebase/firestore', 'firebase/storage']` a `firebase: ['firebase/app', 'firebase/auth', 'firebase/firestore']`. |
| 2 | `scripts/guards/checks.mjs:138` | Cambiar `cmd` de R8 de `awk "/'firebase':/,/]/" vite.config.ts \| grep "firebase/storage" \|\| true` a `awk "/[\"']?firebase[\"']?:/,/]/" vite.config.ts \| grep "firebase/storage" \|\| true`. **Patron mas permisivo** acepta key con o sin quotes (resuelve bug IMPORTANTE #9). |
| 3 | `ANALYZE=1 npm run build` (verificacion local) | Ejecutar y abrir `dist/stats.html`. Confirmar: (a) chunk `firebase-*.js` <= 350 KB raw; (b) `firebase/storage/*` aparece en chunk separado async (no en `firebase`); (c) chunk `mui-core-*.js` <= 200 KB. |
| 4 | `npm run guards --guard 302 --rule R8-firebase-storage-in-critical` | Con el rule patcheado, debe reportar 0 hits. (Antes del patch reportaba 0 falsamente; tras el drop+patch reporta 0 honesto.) |

**Commit:** `perf(#324): drop firebase/storage from manualChunk + patch R8 awk pattern`
**Riesgo:** Bajo si F5 esta completo (verificable por `tsc -b`); si F5 esta parcial el chunk firebase queda igual (no efecto observable).
**Rollback:** revertir commit; los chunks vuelven al estado de F5 (mui split + firebase con storage). El patch al rule R8 se preserva en el revert solo del manualChunks si se hace cherry-pick selectivo.

---

## Workstream F7 — S5 Investigar chunk `index-BuuweED0` 296 KB

**Objetivo:** entender que esta colapsando en el chunk huerfano. **Find-only**, accion correctiva opcional.
**Owner:** luna.
**Depende de F2 + F4 + F6** (baseline limpio, sin ruido de chunks ya separados).

### Commit F7.1 (opcional) — investigacion + finding documentado

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `ANALYZE=1 npm run build` | Ejecutar y abrir `dist/stats.html`. Filtrar por chunks `index-*` que pesen ~290+ KB. |
| 2 | `docs/feat/infra/324-performance-bundle-business-lookup/s5-finding.md` | Crear archivo con: (a) nombre del chunk encontrado; (b) modulos colapsados (top 10 por size); (c) hipotesis (admin barrel? stats utilities? duplicacion entry?); (d) recomendacion (manualChunks adicional? React.lazy adicional? followup issue?). |
| 3 | Si la accion es trivial (manualChunk adicional) | Aplicar en `vite.config.ts` y rebuild para verificar. |
| 4 | Si la accion es no-trivial | Abrir issue followup `gh issue create --title "Investigated chunk X collapses Y/Z modules"` y dejar S5 cerrado como "investigado". |

**Commit:** `docs(#324): S5 finding — index-* chunk investigation` (solo si hay finding actionable; si no, omitir).
**Riesgo:** Bajo (investigacion sin codigo de produccion; si la accion correctiva entra, riesgo equivalente al de S3.a).

---

## Workstream F8 — Bundle size script + CI gate

**Objetivo:** materializar el gate bloqueante de bundle size en CI.
**Owner:** luna.
**Depende de F6** (los chunks ya estan en su forma final).

### Commit F8.1 — `scripts/bundle-size-check.mjs` + npm script + CI step (warning-only en primer ciclo)

**Estrategia de calibracion (re obs Pablo Ciclo 2 #2):** el primer PR que pasa por el gate es #324 mismo. Si los thresholds estan calibrados por intuicion y el bundle real post-F6 mide por encima, el merge se bloquea a si mismo. Para evitar esto:

1. **Step 0 obligatorio antes de hardcodear cualquier threshold**: medir el output de F6.1 step 3 (`dist/stats.html` post-drop firebase/storage + post-split MUI) y leer numeros reales de cada chunk.
2. **Aplicar 5% de margen sobre los numeros reales** para definir los thresholds (ej. si `firebase` real es 340 KB, threshold 357 KB ~= 360 KB).
3. **Primer ciclo en `warning-only` mode**: el script imprime tabla y warnings pero `process.exit(0)` siempre. Esto permite que #324 mergee sin bloqueo, registra los numeros reales en CI, y le da al equipo una iteracion para verificar que los thresholds son sanos.
4. **Endurecer a blocker en follow-up**: una vez post-merge se valida que los numeros reales estan dentro del margen calibrado, abrir issue follow-up `#324-followup-bundle-gate-blocker` para flippear el flag a `process.exit(1)` cuando excede.

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `npx vite build` (medicion local pre-script) | Ejecutar localmente post-F6 completo. Capturar tamanos reales de cada chunk relevante (`firebase`, `mui-core`, `mui-icons`, `recharts`, `google-maps`, entry). Anotar numeros en `baseline-post.txt`. **Sin estos numeros, NO se hardcodean thresholds.** |
| 2 | `scripts/bundle-size-check.mjs` | Crear el script. **APIs nativas de Node solamente**: `node:fs/promises` (`readdir`, `readFile`, `stat`) + `node:zlib` (`gzipSync`). No agregar deps. Algoritmo: (1) leer `dist/assets/*.js`; (2) agrupar por chunk-name (extraer prefijo antes del hash, ej. `firebase-CK1zEjci.js` → `firebase`); (3) calcular raw size + gzipped size por chunk; (4) verificar thresholds calculados desde paso 1 + 5% margen (ej. `firebase-*` raw <= 360 KB si real es 340; `mui-core-*` raw <= 210 KB si real es 200; `mui-icons-*` chunk EXISTE; critical-path entry + firebase + mui-core + recharts + google-maps raw <= 1024 KB y gzipped <= 700 KB); (5) imprimir tabla con raw + gzipped + threshold + delta; (6) **MODE FLAG** `BUNDLE_SIZE_BLOCKING=true` (env var) para enforcement; **default warning-only** — imprime warnings pero `process.exit(0)`. |
| 3 | `package.json` | Agregar script `"test:bundle-size": "node scripts/bundle-size-check.mjs"`. |
| 4 | `.github/workflows/ci.yml` (o equivalente) | Agregar step post-`npm run build`: `- run: npm run test:bundle-size` (sin `BUNDLE_SIZE_BLOCKING` — corre en warning-only mode en primer ciclo). Archivar `dist/stats.html` como artifact si `ANALYZE=1` se setea. **Comentario inline en el workflow:** `# bundle-size gate corre en warning-only mode hasta validar thresholds. Issue #324-followup para flippear a blocker.` |
| 5 | `docs/feat/infra/324-performance-bundle-business-lookup/baseline-pre.txt` (referencia) | Verificar que los thresholds del script son consistentes con el baseline pre-#324 + targets post-#324. |
| 6 | Issue follow-up | Abrir `#324-followup-bundle-gate-blocker` con scope: "flippear `BUNDLE_SIZE_BLOCKING=true` en CI workflow una vez se valido en N ciclos consecutivos que los thresholds son sanos. Estimacion: 2-3 dias post-deploy de #324." |

**Commit:** `ci(#324): add bundle-size-check.mjs + CI step (warning-only mode)`
**Riesgo:** Bajo en primer ciclo (warning-only no bloquea). Medio post-flip a blocker (mitigado con thresholds calibrados desde numeros reales + 5% margen).
**Rollback:** revertir commit; el script y el step CI desaparecen sin afectar el bundle.

---

## Workstream F9 — Documentacion (pre-merge) + medicion latencia (post-deploy follow-up)

**Objetivo:** cerrar la deuda documental + capturar la latencia real medida en prod.
**Owner:** luna.

**Split F9.1 / F9.2 (re obs Pablo Ciclo 2 #3):** la latencia real del primer mount de `MenuPhotoSection` solo se puede medir post-deploy (requiere prod build + RUM). El plan distingue:

- **F9.1 (pre-merge):** docs + baseline-post.txt + estimaciones de latencia (numeros teoricos basados en specs). Es lo que entra al PR de #324.
- **F9.2 (post-deploy follow-up):** capturar latencia real con RUM/perf-baselines.md actualizado. Puede ser commit aparte tras el merge (mismo PR si el deploy ocurre en ventana corta) o un issue follow-up separado (`#324-followup-perf-measure`).

### Commit F9.1 — docs pre-merge (estimaciones + baseline-post + guards docs)

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `docs/reference/guards/302-performance.md` | Actualizar: (a) seccion "Reglas → 4. Lookup por businessId" — confirmar que `businessMap.ts` esta excluido del `R4` (consistente con `R-newMap-allBusinesses`); (b) seccion "Patrones de deteccion → Check 9 — firebase/storage" — actualizar el grep al pattern nuevo (`awk "/[\"']?firebase[\"']?:/,/]/"`). |
| 2 | `docs/reference/patterns.md` | Confirmar que la seccion "Singleton businessMap" sigue describiendo el patron correcto. Agregar nota sobre `getStorageLazy()` en seccion "Lazy Firebase modules" (si existe) o crear una si no. |
| 3 | `docs/reference/project-reference.md` | Actualizar version + fecha + bundle target alcanzado (numeros del bundle ya medibles en F6.1 step 3 + F8.1 step 1). |
| 4 | `docs/reference/perf-baselines.md` (crear si no existe) | Registrar bundle pre/post (numeros reales medibles pre-merge) + **estimaciones** de latencia primer mount: `~80-100ms en 4G estimado, <5ms despues (cache promise)`. Marcar explicitamente como **`PENDIENTE MEDICION POST-DEPLOY`** la fila de latencia real. NO escribir numeros inventados — usar el placeholder `TBD post-deploy (ver F9.2)`. |
| 5 | `docs/feat/infra/324-performance-bundle-business-lookup/baseline-post.txt` | Crear: output de `npx vite build` post-implementacion + output de `npm run guards --guard 302` (todas las rules en 0 hits). |

**Commit:** `docs(#324): update guards docs + perf-baselines (estimates) + post-implementation snapshot`
**Riesgo:** Cero (documentacion).
**Notas:** este commit entra al PR de #324 sin numeros de latencia real. La fila correspondiente en `perf-baselines.md` queda con placeholder `TBD post-deploy`.

### Commit F9.2 — medicion latencia real post-deploy (follow-up)

**Cuando ejecutar:** despues del deploy de #324 a prod, una vez se acumularon ~24-48h de RUM data o se ejecuto un test manual con DevTools throttling 4G/3G en `MenuPhotoSection`.

**Donde ejecutar:**
- **Opcion A (preferida si el ciclo deploy lo permite):** segundo commit en el mismo PR de #324, post-staging-deploy verification. Requiere que el merger tenga acceso a metrics de staging y los promueva.
- **Opcion B (default):** abrir issue follow-up `#324-followup-perf-measure` con scope acotado: "actualizar `docs/reference/perf-baselines.md` con latencia real medida del primer mount de `MenuPhotoSection` (P50, P95) en 4G/3G + WiFi. Si excede 200ms en 4G, abrir mitigacion (modulepreload, prefetch idle)."

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `docs/reference/perf-baselines.md` | Reemplazar el placeholder `TBD post-deploy` con numeros reales medidos (P50, P95) en 3G/4G/WiFi. Documentar metodologia (RUM, manual DevTools, etc.). |
| 2 | (Opcional) Issue de mitigacion | Si la latencia real excede 200ms en 4G, abrir issue de mitigacion (preload chunk en idle, prefetch al hover de menu photo, etc.). Documentar como riesgo aceptado o trade-off explicito. |

**Commit (Opcion A):** `docs(#324): perf-baselines — replace estimate with real measured latency post-deploy`
**Commit (Opcion B):** N/A en #324; se traslada al issue follow-up.
**Riesgo:** Cero (documentacion).

---

## Orden de implementacion

```
F0 (baseline) → F1 (S1 lookups, 7 commits) → F2 (S2 imgs, intercalable dentro de luna)
                                              ↓
                                    F3 (S4 limit + measured, 4 commits)
                                              ↓
                                    F4 (S3.a split MUI)
                                              ↓
                                    F5 (S3.b 4 consumers, 4 commits — ATOMICOS, no se mezclan)
                                              ↓
                                    F6 (S3.c drop + patch R8)
                                              ↓
                                    F7 (S5 finding, opcional)
                                              ↓
                                    F8 (bundle-size script + CI warning-only)
                                              ↓
                                    F9.1 (docs + perf-baselines estimaciones — pre-merge)
                                              ↓
                                    [merge + deploy]
                                              ↓
                                    F9.2 (latencia real medida — post-deploy follow-up)
```

**Razon del orden:**

1. **F0 primero** — sin baseline no podemos medir reduccion. Pablo obs #5.
2. **F1 antes que F3** — refactor de business lookups consolida ownership del singleton; F3 toca services no relacionados a business lookups, pero el ordering reduce conflict surface.
3. **F4 antes que F5** — split MUI es independiente y de bajo riesgo; nos da confianza visual del split working antes de pelear con `firebase/storage`.
4. **F5 antes que F6** — sin F5 completo, F6 no tiene efecto (verificado en specs). Tener F6 separable como commit independiente permite revertir el drop sin revertir todo el refactor (re obs Pablo #3).
5. **F7 al final** — solo tiene sentido medir el chunk `index-*` despues de que los chunks ya separados (mui-icons, firebase/storage async) salieron del entry.
6. **F8 antes de F9** — el script entra al PR como gate; F9 usa la output del script para registrar baseline-post.

---

## Atomic commits — resumen consolidado

| # | Commit | Workstream | Owner | Archivos tocados | Tests |
|---|--------|------------|-------|-----------------|-------|
| 1 | `chore: capture bundle + guards baseline pre-implementation` | F0 | luna | `baseline-pre.txt` | — |
| 2 | `refactor: migrate deep-link/navigate hooks to getBusinessById singleton` | F1.1 | luna | 3 hooks + 3 tests | si |
| 3 | `refactor: migrate list/history hooks to getBusinessById singleton` | F1.2 | luna | 3 hooks + 3 tests | si |
| 4 | `refactor: useRatingPrompt — drop allBizIds Set, consume singleton` | F1.3 | luna | 1 hook + 1 test | si |
| 5 | `refactor: useLocalTrending — drop businessCoords useMemo, consume singleton` | F1.4 | luna | 1 hook + 1 test | si |
| 6 | `refactor: RankingsView — replace local Map with getBusinessMap singleton` | F1.5 | luna | 1 component + 1 test | si |
| 7 | `refactor: migrate components lists/social/profile + businessHelpers util to singleton` | F1.6 | luna | 5 archivos + 1 test | si |
| 8 | `chore: exclude businessMap.ts from R4 guard + add hidratacion test` | F1.7 | luna | `checks.mjs` + 1 test | si |
| 9 | `perf: lazy + async decode + dims on menu photo imgs` | F2.1 | luna | 3 components + 3 tests | si |
| 10 | `perf: specials — limit() + measuredGetDocs (closes 3 R1 hits)` | F3.1 | nico | 1 service + 1 test | si |
| 11 | `perf: achievements — limit() + measuredGetDocs (closes 2 R1 hits)` | F3.2 | nico | 1 service + 1 test | si |
| 12 | `perf: sharedLists — limit() + measuredGetDocs on 4 callsites (closes 4 R1 hits)` | F3.3 | nico | 1 service + 1 test | si |
| 13 | `perf: feedback.fetchUserFeedback — limit(200) + measuredGetDocs (closes 1 R1 hit)` | F3.4 | nico | 1 service + 1 test | si |
| 14 | `perf: split MUI chunk into mui-core + mui-icons` | F4.1 | luna | `vite.config.ts` | guard |
| 15 | `refactor: firebase config — replace storage singleton with getStorageLazy() + tests` | F5.1 | luna | `firebase.ts` + 1 nuevo test | si (REQUERIDO) |
| 16 | `refactor: feedback.sendFeedback — dynamic import firebase/storage` | F5.2 | nico | `feedback.ts` + 1 test | si |
| 17 | `refactor: menuPhotos — dynamic import firebase/storage in upload + getUrl` | F5.3 | nico | `menuPhotos.ts` + 1 test | si |
| 18 | `refactor: PhotoReviewCard — dynamic import firebase/storage in useEffect` | F5.4 | luna | `PhotoReviewCard.tsx` + 1 test | si |
| 19 | `perf: drop firebase/storage from manualChunk + patch R8 awk pattern` | F6.1 | luna | `vite.config.ts` + `checks.mjs` | guard |
| 20 | `ci: add bundle-size-check.mjs + CI gate post-build` | F8.1 | luna | `scripts/bundle-size-check.mjs` + `package.json` + `.github/workflows/ci.yml` | — |
| 21 | `docs: update guards docs + perf-baselines (estimates) + post-implementation snapshot` | F9.1 | luna | 4 docs + `baseline-post.txt` | — |
| 22 (opcional/follow-up) | `docs: perf-baselines — replace estimate with real measured latency post-deploy` | F9.2 | luna | `perf-baselines.md` | — |

**Opcional:** commit adicional para F7.1 si la investigacion produce accion correctiva.

---

## Riesgos

1. **F5 parcial deja `tsc -b` rojo** — los 4 sub-commits de F5 tienen que hacerse en orden y sin push intermedio. Mitigacion: pre-push hook (`tsc -b && vite build`) bloquea push hasta tener los 4 commits aplicados. Si el implementador hace `git push` despues de F5.1 sin F5.2/F5.3/F5.4, el hook lo bloquea.

2. **Coordinacion con #325** — si #325 esta abierto en otra rama, los 9 callsites de F3 pueden tener conflict con sus commits de wrap. Mitigacion: verificar branch state al inicio de F3 (`gh issue view 325` + `gh pr list --search 'is:open #325'`). Si #325 esta en flight, alertar tech-lead. Si #325 esta merged, **saltar F3 entera** (los callsites ya estarian wrappeados; solo agregar `limit()` en quirks puntuales).

3. **Bundle thresholds calibrados con margen** — el script de F8 falla si `firebase-*` excede 350 KB. Si el split de S3.b deja `firebase` en 360 KB por mala medicion, bloquea el merge del propio #324. Mitigacion: medir post-F6 antes de calibrar el threshold; si el chunk real es 340 KB, threshold queda en 360 KB (5% margen).

4. **REG #2 absorbida — `saveAllSpecials.existingSnap` con `limit(100)`** — si en runtime hay >100 specials, el cleanup admin queda incompleto y deja docs huerfanos al hacer save. Mitigacion: cap natural <= 50 en specials admin-managed; comentario inline justifica; si en algun momento el cap se llena, abrir issue followup para paginar la limpieza.

5. **Latencia primer mount post-deploy excede 200ms en 3G/4G lento** — el specs estima 80-100ms en 4G y <5ms despues. Si la realidad excede el estimado, el LCP de business sheet puede degradarse en redes lentas. Mitigacion: F9 incluye step de medicion post-deploy + perf-baselines. Si excede 200ms, abrir issue de followup para preload del chunk firebase/storage en idle time (ej. via `<link rel="modulepreload">`).

---

## Guardrails de modularidad

- [x] Ningun componente nuevo importa `firebase/firestore` directamente — F3 toca services (capa correcta), no componentes.
- [x] Archivos nuevos en carpetas correctas — `scripts/bundle-size-check.mjs` (consistente con `scripts/guards/`).
- [x] Logica de negocio en hooks/services, no en componentes — F1 mueve lookups a `getBusinessById` (helper en `utils/`).
- [x] Si se toca un archivo con deuda tecnica, se incluye el fix en el plan — F1.7 patchea R4; F6 patchea R8.
- [x] Ningun archivo resultante supera 400 lineas — los archivos tocados (`firebase.ts`, `feedback.ts`, `menuPhotos.ts`, services y hooks) estan todos por debajo. `getStorageLazy()` agrega ~12 lineas a `firebase.ts`.

## Guardrails de seguridad

- [x] Sin colecciones nuevas; sin rules nuevas; sin Cloud Functions.
- [x] `limit()` en 9 callsites de service mejora postura defensiva.
- [x] Rate limits server-side existentes (sharedLists 10/dia #289, feedback existente) preservados.
- [x] No hay secrets, admin emails, ni credenciales en commits.
- [x] `getCountFromServer` → `fetchFollowersCount` ya usa `getCountOfflineSafe` (no se toca).
- [x] No se usan secrets en los chunks publicos — verificado por inspeccion del bundle baseline.

## Guardrails de observabilidad

- [x] Todos los servicios tocados en F3 agregan `measuredGetDocs` (cierran 9 hits de `303/R1`).
- [x] Se preservan los `trackEvent` existentes (`feedback_submit`, `menu_photo_upload`).
- [x] No se introducen Cloud Function triggers nuevos.
- [x] `logger.error` se preserva en `PhotoReviewCard` (F5.4).

## Guardrails de accesibilidad y UI

- [x] No se agregan `<IconButton>` nuevos.
- [x] Touch targets sin cambios.
- [x] `<img>` con URL dinamica preservan `onError` fallback (F2).
- [x] `httpsCallable` no se introduce en este feature.

## Guardrails de copy

- [x] No se modifica copy user-facing.

---

## Fase final: Documentacion (OBLIGATORIA — F9.1 + F9.2)

| Paso | Archivo | Cambio | Fase |
|------|---------|--------|------|
| 1 | `docs/reference/guards/302-performance.md` | Actualizar reglas R4 (exclusion `businessMap.ts`) + R8 (pattern awk corregido). Documentar el patch del runner. | F9.1 |
| 2 | `docs/reference/firestore.md` | **N/A** — sin cambios de schema. | — |
| 3 | `docs/reference/features.md` | **N/A** — feature 100% interno (no hay funcionalidad nueva visible al usuario). | — |
| 4 | `docs/reference/patterns.md` | Confirmar singleton `businessMap` y agregar nota sobre `getStorageLazy()` en patron "Lazy Firebase modules" (crear seccion si no existe). | F9.1 |
| 5 | `docs/reference/project-reference.md` | Actualizar version + fecha + nuevo bundle target alcanzado. | F9.1 |
| 6 | `docs/reference/perf-baselines.md` (1ra pasada) | Crear (si no existe) o actualizar: bundle pre/post + **estimaciones** de latencia primer mount con placeholder `TBD post-deploy`. | F9.1 |
| 7 | `docs/reference/perf-baselines.md` (2da pasada) | Reemplazar placeholder con numeros reales medidos post-deploy. | F9.2 |
| 8 | `src/components/menu/HelpSection.tsx` | **N/A** — sin cambios visibles al usuario. | — |
| 9 | `docs/feat/infra/324-performance-bundle-business-lookup/baseline-post.txt` | Output post-implementacion. | F9.1 |
| 10 | `docs/_sidebar.md` | Agregar entries de specs + plan de #324 si no estan ya. | F9.1 |

---

## Criterios de done

- [ ] **F0** — `baseline-pre.txt` capturado y commiteado.
- [ ] **F1** — `npm run guards --guard 302 --rule R4-allBusinesses-find` → 0 hits. `R-newMap-allBusinesses` → 0 hits. Tests verdes en hooks tocados (incluido path de hidratacion en `businessMap.test.ts`).
- [ ] **F2** — `R6-img-without-lazy` → 0 hits. Tests verdes en `MenuPhotoSection`/`MenuPhotoViewer`/`MenuPhotoUpload`.
- [ ] **F3** — `R1-services-raw-getDocs` reduce -10 hits (3 specials + 2 achievements + 4 sharedLists + 1 feedback). Tests verdes en services.
- [ ] **F4** — `R7-mui-icons-not-split` → 0 hits. Build emite `mui-core-*` y `mui-icons-*` separados.
- [ ] **F5** — `tsc -b && vite build` verde post-F5 completo. Tests REQUERIDOS de `getStorageLazy()` (4 tests minimos a-d) verdes.
- [ ] **F6** — `R8-firebase-storage-in-critical` (con rule patcheado) → 0 hits. `dist/stats.html` muestra `firebase/storage/*` en chunk async.
- [ ] **F7** — finding documentado en `s5-finding.md` (o nota en plan que se cerro como "investigado").
- [ ] **F8** — `npm run test:bundle-size` pasa local + step CI integrado y bloqueante.
- [ ] **F9.1 (pre-merge)** — docs actualizadas + `perf-baselines.md` con bundle pre/post + estimaciones de latencia (placeholder `TBD post-deploy` para latencia real) + `baseline-post.txt` commiteado.
- [ ] **F9.2 (post-deploy)** — latencia real medida (RUM o DevTools throttling) + `perf-baselines.md` reemplaza placeholder con numeros reales (Opcion A: commit en mismo PR post-staging; Opcion B: issue follow-up `#324-followup-perf-measure`).
- [ ] **Coverage >= 80%** en archivos modificados (politica del proyecto).
- [ ] **Lint + tsc -b** verde.
- [ ] **Build verde** + `dist/stats.html` confirma chunks dentro de targets (`firebase` <= 350 KB raw, `mui-core` <= 200 KB raw, bundle inicial <= 1 MB raw / 700 KB gzipped).
- [ ] **Pre-push hook** (`tsc -b && vite build`) verde.

---

## Coordinacion con otros issues en flight

| Issue | Estado esperado | Accion |
|-------|----------------|--------|
| **#322** (referenciado en task) | Coordinar orden de merge con #324 | Verificar al iniciar; si #322 esta open, esperar merge antes de #324 (o coordinar con tech-lead). |
| **#323** (referenciado en task) | Coordinar orden de merge con #324 | Idem. |
| **#325** (perf-instrumentation) | Si abierto: F3 puede tener conflict en imports/firmas. Si merged: F3 simplifica (solo `limit()`). | Step explicito al inicio de F3 para verificar branch state. |
| **#289** (sharedLists rate limit) | Merged | Caps en F3.3 son defense-in-depth complementaria. |
| **#302** (perf bundle splits) | Merged | Este feature reaplica las 5 rules. |

---

## Validacion de Plan

**Delivery Lead:** Pablo
**Fecha Ciclo 1:** 2026-04-25
**Fecha Ciclo 2:** 2026-04-25
**Estado:** **Ciclo 2 — VALIDADO**

### Veredicto Pablo (Ciclo 2)

Las 4 observaciones de Ciclo 1 quedaron correctamente absorbidas. Una regresion menor detectada en el diagrama ASCII "Orden de implementacion" (F2 marcada como "paralelo OK" — contradice OBS #1 cerrada) fue corregida a "intercalable dentro de luna". El plan queda ejecutable tal cual; no hay bloqueantes ni observaciones nuevas. Se promueve a implementacion.

### Cerrado en esta iteracion

- **OBS #1 (F2 "paralelo a F1" mientras ambos son luna)** -> resuelto. Tabla Resumen ejecutivo (linea 17) reformulada a "intercalable dentro de luna; NO paralelo entre agentes — mismo owner que F1". Header del Workstream F2 (linea 161) reemplaza "Paralelizable con F1" por bloque explicativo que aclara: F2 es intercalable con F1 (no comparten archivos), pero ambos workstreams tienen el mismo owner (luna), por lo que NO hay paralelismo real entre agentes; el orchestrator NO debe interpretar "paralelo" como "se puede correr simultaneo con otro agente".
- **OBS #2 (F8.1 thresholds bloquean al propio #324 si calibracion erra)** -> resuelto. F8.1 ahora arranca con bloque "Estrategia de calibracion" (4 puntos: medir post-F6, 5% margen, warning-only en primer ciclo, endurecer en follow-up). Step 1 obligatorio captura tamanos reales en `baseline-post.txt` antes de hardcodear thresholds. Step 2 introduce `MODE FLAG` `BUNDLE_SIZE_BLOCKING=true` con default warning-only (`process.exit(0)` siempre). Step 4 anota comentario inline en CI workflow + Step 6 agenda issue follow-up `#324-followup-bundle-gate-blocker` para flippear a blocker. Commit message refleja "warning-only mode".
- **OBS #3 (F9 mide latencia post-deploy pero F9.1 es pre-merge)** -> resuelto. F9 quedo split en F9.1 (pre-merge: docs + baseline-post + estimaciones, con placeholder `TBD post-deploy` en `perf-baselines.md`) y F9.2 (post-deploy: latencia real medida con Opcion A: commit en mismo PR post-staging-deploy, o Opcion B: issue follow-up `#324-followup-perf-measure`). Tabla Resumen ejecutivo, Atomic commits, Orden de implementacion, Criterios de done y Fase final Documentacion reflejan el split de forma consistente.
- **OBS #4 (F1.4 dep array + test debe cubrir hidratacion async)** -> resuelto. F1.4 step 5 reemplaza "verificar que sigue pasando" por **3 escenarios explicitos requeridos**: (a) singleton vacio en mount inicial -> hook devuelve `[]` sin crash ni infinite loop; (b) businesses validos en mount estable -> progressive radius produce resultados ordenados por distancia; (c) hidratacion async + segunda render -> primer render devuelve `[]`, despues `__hydrateBusinessMap(...)` + rerender produce resultados validos. Nota explicita: si el test (c) revela race posible, agregar trigger al dep array (no revertir el commit). Cross-reference a specs OBS-N4 / I6 antes de implementar.

### Regresion detectada y corregida en Ciclo 2

- **Diagrama "Orden de implementacion"**: contenia `F2 (S2 imgs, paralelo OK)`, contradecia el cierre de OBS #1. Corregido a `F2 (S2 imgs, intercalable dentro de luna)`. Las menciones restantes a "paralelo" en el plan corresponden a citas historicas dentro de los hallazgos OBS #1 (texto descriptivo de lo cerrado, no instrucciones operativas).

### Verificaciones realizadas en Ciclo 2

1. **OBS #1 cerrado en 3 puntos del plan**: tabla Resumen ejecutivo (linea 17), header Workstream F2 (~linea 161), diagrama ASCII Orden de implementacion (regresion corregida). Sin contradicciones operativas restantes.
2. **OBS #2 cerrado en 6 puntos**: bloque "Estrategia de calibracion" (4 puntos enumerados en F8.1), step 1 medicion local pre-script, step 2 MODE FLAG `BUNDLE_SIZE_BLOCKING`, step 4 comentario inline en CI workflow, step 6 follow-up agendado, commit message "warning-only mode", Riesgo #3 actualizado.
3. **OBS #3 cerrado en 5 puntos**: tabla Resumen ejecutivo (F9.1 + F9.2), Atomic commits (commits 21 y 22 opcional), Orden de implementacion (split visible con `[merge + deploy]` entre F9.1 y F9.2), Criterios de done (dos checkboxes), Fase final Documentacion (filas 6 y 7).
4. **OBS #4 cerrado en F1.4 step 5**: 3 escenarios explicitos (a/b/c) con cross-reference a specs OBS-N4 / I6, nota sobre dep array trigger si race revelado, formulacion alternativa documentada para ambos paths (sync vs lazy-hidratado).
5. **No hay regresiones en cobertura specs->plan, granularidad, ownership F5 (4 commits atomicos), risk staging F0->F9, REG #1/REG #2 de Diego, patches R4/R8, coordinacion #325, rollback F5, bundle-size script F8, test plan integrado.**
6. **Sellos previos**: PRD VALIDADO Sofia Ciclo 2; specs VALIDADO Diego Ciclo 2 (REG #1 + REG #2 absorbidas en plan F3.1).

### Contexto revisado (Ciclo 2)

- PRD: `docs/feat/infra/324-performance-bundle-business-lookup/prd.md` (sello Sofia: VALIDADO CON OBSERVACIONES Ciclo 2)
- Specs: `docs/feat/infra/324-performance-bundle-business-lookup/specs.md` (sello Diego: VALIDADO CON OBSERVACIONES Ciclo 2)
- Plan: `docs/feat/infra/324-performance-bundle-business-lookup/plan.md`
- Total commits planificados: **21 base + 2 opcionales** (F7.1 + F9.2 Opcion A)
- Workstreams: 10 (F0..F9 con F9 split en F9.1/F9.2)
- Agentes propuestos: luna (15 commits incl. F5.1/F5.4), nico (4 commits F3.1-F3.4 + 2 commits F5.2/F5.3)

### Abierto

Ninguno. Plan listo para implementacion sin nuevos hallazgos.

### Observaciones para la implementacion (manu)

1. **F2 dentro de luna**: intercalar entre commits de F1 segun convenga; no esperar a terminar F1 entero si hay tiempo idle. NO asignar a otro agente — mismo owner que F1.
2. **F8.1 threshold calibration**: ejecutar step 1 (`npx vite build` post-F6) ANTES de hardcodear thresholds. CI corre en warning-only en primer ciclo; flippear a blocker via issue follow-up `#324-followup-bundle-gate-blocker` post-validacion.
3. **F9 split**: F9.1 entra al PR pre-merge con placeholder `TBD post-deploy` en `perf-baselines.md`. F9.2 post-deploy: preferentemente Opcion A (commit en mismo PR si ciclo de deploy lo permite); fallback Opcion B (issue follow-up `#324-followup-perf-measure`).
4. **F1.4 test coverage**: implementar los 3 escenarios (a/b/c) explicitos. Antes de empezar, leer specs seccion OBS-N4 / I6 para confirmar si el comportamiento es sync (allBusinesses ya poblado al import) o lazy (necesita trigger en dep array).
5. **F5 bloque atomico**: los 4 commits F5.1-F5.4 deben aplicarse localmente antes del primer push. Orden recomendado de cherry-pick en feature branch: F5.1 (luna) -> F5.2 (nico) -> F5.3 (nico) -> F5.4 (luna), luego primer push (pre-push hook valida `tsc -b && vite build`).
6. **Verificacion #325 antes de F3**: primera tarea de nico es `gh issue view 325 && gh pr list --search 'is:open #325'`. Si abierto, parar y consultar tech-lead. Si merged, saltar F3 entera.

### Listo para pasar a implementacion?

**Si.** Plan validado sin observaciones bloqueantes. Las 6 observaciones para la implementacion son matices de coordinacion para manu, no condicionan la mecanica de cada commit. Delegar segun tabla "Atomic commits — resumen consolidado".

**Estado final Ciclo 2: VALIDADO**
