# Plan: Tech debt — RankingsView/MapView O(n) lookups + useRatingPrompt Set construction

**Specs:** [specs.md](specs.md)
**PRD:** [prd.md](prd.md)
**Fecha:** 2026-05-16
**Issue:** #333

---

## Fases de implementacion

### Fase 1: Extender `businessMap.ts` + S1 + S4 (cierra guard baseline)

**Branch:** `feat/333-perf-rankings-mapview-ratingprompt`

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `src/utils/businessMap.ts` | Agregar `let cachedIdsSet: Set<string> \| null = null;` debajo del `cachedMap`. Agregar funcion `export function getAllBusinessIdsSet(): Set<string>` con patron lazy singleton (mismo shape que `getBusinessMap`). Modificar `__resetBusinessMap()` para resetear AMBOS singletons (`cachedMap = null; cachedIdsSet = null;`). Actualizar JSDoc del reset para explicitar el coordinado. |
| 2 | `src/utils/businessMap.test.ts` | Agregar suite `describe('getAllBusinessIdsSet', ...)` con: (a) devuelve Set con todos los ids, (b) size === allBusinesses.length, (c) singleton (misma instancia entre dos calls), (d) reset rebuilds el Set, (e) **reset coordinado**: tras `__resetBusinessMap()`, llamar `getBusinessMap()` Y `getAllBusinessIdsSet()` produce instancias distintas — verificar con `expect(prevMap).not.toBe(newMap); expect(prevSet).not.toBe(newSet);` en una sola transicion. |
| 3 | `src/components/social/RankingsView.tsx` | **S1**: Linea 38, reemplazar `const businessMap = new Map(allBusinesses.map((b) => [b.id, b]));` por `const businessMap = getBusinessMap();`. Agregar import `import { getBusinessMap } from '../../utils/businessMap';`. Verificar si `allBusinesses` queda sin uso — si si, eliminar el import. |
| 4 | `src/hooks/useLocalTrending.ts` | **S4**: Eliminar el `useMemo` de `businessCoords` (lineas 39-42). Obtener `const businessMap = getBusinessMap();` al inicio del hook (no en `useMemo`). Reemplazar el bucle de filtrado: pasar de `const coords = businessCoords.get(biz.businessId); if (!coords) return false; return distanceKm(location.lat, location.lng, coords.lat, coords.lng) <= radius;` a `const biz2 = businessMap.get(biz.businessId); if (!biz2) return false; return distanceKm(location.lat, location.lng, biz2.lat, biz2.lng) <= radius;`. Actualizar deps del `useMemo` de filtrado: quitar `businessCoords`. Agregar import `import { getBusinessMap } from '../utils/businessMap';`. Eliminar `import { allBusinesses } from './useBusinesses';` (queda sin uso). |
| 5 | `src/hooks/useLocalTrending.test.ts` | Agregar `import { __resetBusinessMap } from '../utils/businessMap';` y `beforeEach(() => { __resetBusinessMap(); });` (mantener el `vi.clearAllMocks` existente). Ajustar la suite para que el mock de `allBusinesses` siga vigente (el mock via `vi.mock('./useBusinesses', ...)` con `get allBusinesses()` se conserva — el reset solo limpia el cache de `businessMap`). Verificar que los 8 tests existentes siguen verdes. Agregar test nuevo de regression bit-identical: fixture controlado de `mockAllBusinesses` + `mockTrendingData`, snapshot del output `result.current.businesses` (ids, score, orden). |

**Resultado al cierre de Fase 1**: Guard `R-newMap-allBusinesses` baja de 2 a 0 grep hits en codigo. Falta solo actualizar la baseline en Fase 4.

### Fase 2: S2 (MapView cleanup) + S3 (useRatingPrompt)

| Paso | Archivo | Cambio |
|------|---------|--------|
| 6 | `src/components/map/MapView.tsx` | **S2**: (a) Linea 85: `handleMarkerClick` pasa de `const business = businessesRef.current.find((b) => b.id === businessId);` a `const business = getBusinessById(businessId);`. (b) Eliminar lineas 58 (comentario huerfano) + 59 (`const businessesRef = useRef(businesses);`) + 60-62 (`useEffect` que sincroniza `businessesRef.current = businesses`). (c) Verificar que `useRef` sigue importado (lo usa `hasInitialLocation`). (d) Agregar import `import { getBusinessById } from '../../utils/businessMap';`. (e) Verificar que `useBusinesses` sigue importado — `businesses` aun se consume en el render del marker loop (`businesses.map(...)`). NO eliminar. |
| 7 | `src/components/map/MapView.markerTap.test.tsx` (NUEVO) | Crear suite nueva. Mockear `@vis.gl/react-google-maps` (igual que `MapView.timeout.test.tsx`), `useSelection` (con spy en `setSelectedBusiness`), `useFilters`, `useBusinesses`, `useUserSettings`, `BusinessMarker` (capturar la prop `onClick` para invocarla manualmente), `OfficeMarker`, `MapSkeleton`. Mockear `../../utils/businessMap` con `getBusinessById` que retorne el business correcto. Tests: (a) **sin filtro**: invocar `onClick('biz_001')` → spy `setSelectedBusiness` recibe el business correcto. (b) **con filtro activo que excluye**: `useBusinesses` retorna `businesses: []` (filtrado), pero `getBusinessById('biz_001')` igual lo devuelve → `setSelectedBusiness` recibe el business correcto (invariante: dataset estatico es fuente de verdad). (c) **id desconocido**: `getBusinessById` retorna `undefined` → `setSelectedBusiness` NO se llama. |
| 8 | `src/hooks/useRatingPrompt.ts` | **S3**: Linea 121, reemplazar `const allBizIds = new Set(allBusinesses.map((b) => b.id));` por `const allBizIds = getAllBusinessIdsSet();`. Modificar import existente: `import { getBusinessById } from '../utils/businessMap';` → `import { getAllBusinessIdsSet, getBusinessById } from '../utils/businessMap';`. Eliminar `import { allBusinesses } from './useBusinesses';` (queda sin uso). |
| 9 | `src/hooks/useRatingPrompt.test.ts` | Agregar `import { __resetBusinessMap } from '../utils/businessMap';` y en el `beforeEach` agregar `__resetBusinessMap();` despues de `vi.clearAllMocks()`. Verificar que los 8+ tests existentes siguen verdes. El mock de `allBusinesses` via `vi.mock('./useBusinesses', ...)` se conserva — el reset solo limpia los singletons del modulo. Verificar explicitamente que el test "Business not in current dataset" (si existe; sino agregarlo) sigue funcionando: check-in con `businessId` que no esta en `mockAllBusinesses` → `promptData === null`. |

**Resultado al cierre de Fase 2**: Los 4 callsites del PRD estan migrados. `MapView.tsx` ya no contiene `businessesRef` ni su `useEffect` ni el comentario L58. `useRatingPrompt` y `useLocalTrending` ya no construyen Set/Map localmente.

### Fase 3: Validacion local

| Paso | Archivo / Comando | Cambio |
|------|------------------|--------|
| 10 | `pnpm test src/utils/businessMap.test.ts src/hooks/useLocalTrending.test.ts src/hooks/useRatingPrompt.test.ts src/components/map/MapView.markerTap.test.tsx src/components/map/MapView.timeout.test.tsx` | Suite focused — todos verdes. |
| 11 | `pnpm test` | Suite completa — todos verdes, sin regression en otros tests. |
| 12 | `pnpm lint` | Cero errores. Si el linter detecta imports sin uso (`allBusinesses` en archivos modificados), fixearlos. |
| 13 | `pnpm tsc -b` | Cero errores de TypeScript. |
| 14 | `pnpm build` | Build sucede. Nota: con pre-push hook esto se ejecuta automaticamente al pushear. |
| 15 | (manual) `grep -rn "new Map(allBusinesses.map" src/` | Debe devolver 0 hits (verificacion manual del guard). |
| 16 | (manual) `grep -rn "businessesRef" src/components/map/MapView.tsx` | Debe devolver 0 hits. |

### Fase 4: Bajar baseline del guard

| Paso | Archivo | Cambio |
|------|---------|--------|
| 17 | `.guards-baseline.json` | Seccion `"302"`, modificar `"R-newMap-allBusinesses": 2` → `"R-newMap-allBusinesses": 0`. Validar JSON con `node -e "JSON.parse(require('fs').readFileSync('.guards-baseline.json'))"`. |
| 18 | `pnpm test:guards` o equivalente (ej: `node scripts/run-guards.mjs` o el comando documentado) | El guard `302/R-newMap-allBusinesses` debe quedar verde con baseline 0 — cero hits actuales, cero baseline. Si el guard usa un nombre distinto, ajustar segun `docs/reference/guards/`. |

### Fase 5: Documentacion (OBLIGATORIA)

| Paso | Archivo | Cambio |
|------|---------|--------|
| 19 | `docs/reference/patterns.md` | Seccion "Utilidades compartidas" → entrada **businessMap singleton (#302)**: actualizar a "#302, expandido en #324 y #333". Mencionar `getAllBusinessIdsSet()` con su semantica (lazy + singleton + reset coordinado con `getBusinessMap()`). Mencionar que la migracion completa cubre RankingsView + MapView + useRatingPrompt + useLocalTrending. |
| 20 | `docs/reference/project-reference.md` | Linea del summary / changelog interno: incorporar referencia a #333 (perf followups, baseline `R-newMap-allBusinesses` cerrada a 0, patron singleton expandido). |
| 21 | `docs/_sidebar.md` | Linea 179 (`#333 Perf — ...`): agregar `- [Specs](/feat/infra/333-perf-rankings-mapview-ratingprompt/specs.md)` y `- [Plan](/feat/infra/333-perf-rankings-mapview-ratingprompt/plan.md)` como sub-items. |
| 22 | `docs/reference/security.md` | NO aplica (cero superficie nueva). Saltear. |
| 23 | `docs/reference/firestore.md` | NO aplica (cero cambios al modelo). Saltear. |
| 24 | `docs/reference/features.md` | NO aplica (cero feature visible al usuario). Saltear. |
| 25 | `src/components/menu/HelpSection.tsx` / `HELP_GROUPS` | NO aplica (cero cambio visible al usuario). Saltear. |

---

## Orden de implementacion

1. **Fase 1 paso 1-2**: extender `businessMap.ts` + sus tests primero. Esto es prerequisito de S3 (paso 8) porque `getAllBusinessIdsSet` debe existir antes de consumirlo.
2. **Fase 1 paso 3 (S1)**: cambio aislado en `RankingsView`. Sin tests modificados (la suite de RankingsView no se toca).
3. **Fase 1 paso 4-5 (S4)**: `useLocalTrending` + sus tests. Cierra uno de los 2 hits del guard.
4. **Fase 2 paso 6 (S2 codigo)**: `MapView.tsx` cleanup. Cierra el find O(n) + ref muerto + comentario huerfano.
5. **Fase 2 paso 7 (S2 test nuevo)**: crear `MapView.markerTap.test.tsx`. Cubrir los 3 escenarios.
6. **Fase 2 paso 8-9 (S3)**: `useRatingPrompt` + reset coordinado en su test.
7. **Fase 3**: validacion (tests + lint + tsc + build + grep verifications).
8. **Fase 4**: bajar baseline del guard. Hacer ESTE paso DESPUES de validar que los grep no devuelven hits, no antes.
9. **Fase 5**: docs.

## Riesgos

1. **Tests de `useRatingPrompt` rompen tras agregar `__resetBusinessMap`**. Probabilidad: baja. El mock de `allBusinesses` vive a nivel modulo (`vi.mock`) y no se resetea — solo se resetean los singletons internos de `businessMap.ts`. Mitigacion: si rompe, agregar el reset DESPUES del `vi.clearAllMocks()` (no antes) y validar que el mock `vi.mock('./useBusinesses', ...)` no se afecta. Verificacion empirica en Fase 3 paso 11.
2. **Test nuevo `MapView.markerTap.test.tsx` colisiona con `MapView.timeout.test.tsx`**. Probabilidad: media. Ambos archivos importan `MapView` y mockean `@vis.gl/react-google-maps` y demas contexts. Mitigacion: mantener mocks compatibles (mismo shape), usar describe blocks independientes. Si hay colision, considerar consolidar en un solo archivo `MapView.test.tsx` con dos `describe` blocks. Decision al implementar segun lo que se observe.
3. **Linter / TS detecta imports muertos tras eliminar `allBusinesses`**. Probabilidad: alta (esperado). Mitigacion: eliminar imports en el mismo paso que se eliminan los usos. La regla ESLint `no-unused-vars` lo flaggea.
4. **`useLocalTrending` cambia el output bit-identical**. Probabilidad: muy baja. El acceso `business.lat/lng` directo sobre el `Business` retornado por `getBusinessMap()` es el mismo dato que la proyeccion previa `{lat, lng}`. Mitigacion: el test nuevo de regression bit-identical detecta cualquier divergencia. Si rompe, escalar — pero no deberia ocurrir.

## Guardrails de modularidad

- [x] Ningun componente nuevo importa `firebase/firestore` directamente — el cambio es 100% local a utils + hooks existentes.
- [x] Archivos nuevos en carpeta de dominio correcta — `MapView.markerTap.test.tsx` vive en `src/components/map/` junto a `MapView.tsx`.
- [x] Logica de negocio en hooks/services, no en componentes — `getAllBusinessIdsSet` es util puro, no React.
- [x] Si se toca un archivo con deuda tecnica, se incluye el fix en el plan — `MapView.tsx` tenia el ref muerto + comentario huerfano, ambos fixeados en el mismo paso.
- [x] Ningun archivo resultante supera 400 lineas. Estimaciones:
  - `businessMap.ts`: ~55 lineas (era 38, +17 por nuevo Set + reset coordinado).
  - `MapView.tsx`: ~120 lineas (era ~130, -10 por eliminar `businessesRef` + `useEffect` + comentario).
  - `RankingsView.tsx`: sin cambio de tamano (1 linea sustituida).
  - `useRatingPrompt.ts`: 227 lineas (1 linea sustituida, 1 import sustituido, 1 import removido).
  - `useLocalTrending.ts`: ~75 lineas (era 76, -1 por useMemo eliminado).
  - `MapView.markerTap.test.tsx`: ~80 lineas estimadas.

## Guardrails de seguridad

- [x] Toda coleccion nueva tiene `hasOnly()` — no aplica (cero colecciones).
- [x] Todo campo string tiene `.size() <= N` — no aplica.
- [x] Todo campo list tiene `.size() <= N` — no aplica.
- [x] Admin writes tambien tienen validacion — no aplica.
- [x] Counter decrements en triggers usan `Math.max(0, ...)` — no aplica.
- [x] Rate limits llaman `snap.ref.delete()` — no aplica.
- [x] Toda coleccion nueva escribible por usuarios tiene Cloud Function trigger — no aplica.
- [x] No hay secrets, admin emails, ni credenciales en archivos commiteados — verificado: cero cambios a config files con secrets.
- [x] `getCountFromServer` → no aplica.

## Guardrails de observabilidad

- [x] Todo CF trigger nuevo tiene `trackFunctionTiming` — no aplica (cero CF).
- [x] Todo service nuevo con queries Firestore tiene `measureAsync` — no aplica (cero queries).
- [x] Todo `trackEvent` nuevo esta registrado — no aplica (cero eventos nuevos).
- [x] Todo `trackEvent` nuevo tiene feature card — no aplica.
- [x] `logger.error` NUNCA dentro de `if (import.meta.env.DEV)` — no aplica (no se introduce `logger.error`).

## Guardrails de accesibilidad y UI

- [x] Todo `<IconButton>` tiene `aria-label` — no aplica (cero IconButton nuevo).
- [x] No hay `<Typography onClick>` — verificado.
- [x] Touch targets minimo 44x44px — sin cambios.
- [x] Componentes con fetch tienen error state — no aplica (sin nuevos fetch).
- [x] `<img>` con URL dinamica tienen `onError` fallback — no aplica.
- [x] httpsCallable en componentes user-facing tienen guard offline — no aplica.

## Guardrails de copy

- [x] Todos los textos nuevos usan voseo — no aplica (cero texto nuevo).
- [x] Tildes correctas — no aplica.
- [x] Terminologia consistente: "comercios" — no aplica.
- [x] Strings reutilizables en `src/constants/messages/` — no aplica.

## Fase final: Documentacion (OBLIGATORIA)

Cubierta en Fase 5 arriba (pasos 19-21). Pasos 22-25 explicitamente marcados como NO aplica con justificacion (cero superficie nueva, cero feature usuario, cero rules, cero modelo).

## Criterios de done

- [ ] **S1** — `RankingsView.tsx:38` usa `getBusinessMap()`. Grep `new Map(allBusinesses.map` en `src/components/social/RankingsView.tsx` devuelve 0.
- [ ] **S2** — `MapView.tsx:85` (o equivalente tras edicion) usa `getBusinessById(businessId)`. `businessesRef` no existe en el archivo. Su `useEffect` no existe. Comentario L58 no existe.
- [ ] **S3** — `useRatingPrompt.ts:121` (o equivalente) usa `getAllBusinessIdsSet()`. `new Set(allBusinesses.map` en `src/hooks/useRatingPrompt.ts` devuelve 0.
- [ ] **S4** — `useLocalTrending.ts:40` (o equivalente) usa `getBusinessMap()` directo. `new Map(allBusinesses.map` en `src/hooks/useLocalTrending.ts` devuelve 0. El `useMemo` de `businessCoords` ya no existe.
- [ ] **businessMap.ts** exporta `getAllBusinessIdsSet()` con semantica lazy + singleton + reset coordinado.
- [ ] **`__resetBusinessMap()`** resetea AMBOS singletons (Map + Set) en una invocacion.
- [ ] **Baseline guard** `R-newMap-allBusinesses` en `.guards-baseline.json` seccion `"302"`: `0`.
- [ ] **Tests** — `businessMap.test.ts` cubre `getAllBusinessIdsSet` + reset coordinado. `MapView.markerTap.test.tsx` cubre 3 escenarios (sin filtro, con filtro excluyente, id desconocido). `useRatingPrompt.test.ts` y `useLocalTrending.test.ts` tienen `__resetBusinessMap()` en `beforeEach`. Test de regression bit-identical de `useLocalTrending` agregado.
- [ ] **Cobertura** >= 80% del codigo nuevo (`getAllBusinessIdsSet` deberia llegar a 100%).
- [ ] **Lint** sin errores.
- [ ] **TypeScript** build sin errores.
- [ ] **Build** vite build sucede.
- [ ] **Suite completa** verde — sin regression en tests existentes de RankingsView, MapView, useRatingPrompt, useLocalTrending, businessHelpers ni demas suites.
- [ ] **Docs** — `patterns.md`, `project-reference.md`, `_sidebar.md` actualizados.
- [ ] **No quedan grep hits**: `grep -rn "new Map(allBusinesses.map" src/` devuelve vacio; `grep -rn "new Set(allBusinesses.map" src/` devuelve vacio (excluyendo tests si los hubiera con fixtures intencionales).

---

## Validacion de Plan

**Validado por**: Pablo (delivery lead)
**Fecha**: 2026-05-02
**Estado**: VALIDADO CON OBSERVACIONES

### Verificaciones cerradas

- Cobertura specs→plan: los 4 callsites (S1-S4) + extender `businessMap.ts` + ajustes de tests + baseline + docs estan mapeados.
- Orden infraestructura primero: paso 1 (`getAllBusinessIdsSet`) precede a paso 8 (consumidor en `useRatingPrompt`). Correcto.
- Tests integrados en pasos de feature, no en paso final.
- Baseline del guard se baja DESPUES del codigo (paso 17 tras paso 6), con verificacion grep intermedia en paso 15.
- Granularidad razonable: cada paso = un commit logico atomico.
- Pasos NO aplica de docs (22-25) marcados explicitamente con justificacion en lugar de omitirlos.
- Riesgos identificados con mitigacion concreta y verificacion empirica agendada.
- Rollback trivial: cambios 100% in-memory, sin schema/rules/CF/migrations. Revert commit es suficiente.

### Observaciones (ajustes recomendados al implementar)

- **OBS #1** — paso 15: el grep `grep -rn "new Map(allBusinesses.map" src/` va a devolver 1 hit intrinseco en `src/utils/businessMap.ts:19` (linea de la implementacion del singleton). El guard real (`scripts/guards/checks.mjs:123`) excluye ese archivo con `| grep -v "src/utils/businessMap.ts"`. Alinear el comando del paso 15 al del guard, o anotar "esperado: 1 hit en `businessMap.ts` que ES la implementacion; cero hits fuera de ese archivo".
- **OBS #2** — paso 21: los sub-items `[Specs](/feat/infra/333-perf-rankings-mapview-ratingprompt/specs.md)` y `[Plan](/feat/infra/333-perf-rankings-mapview-ratingprompt/plan.md)` ya existen en `docs/_sidebar.md` lineas 180-181. Tratarlo como "verificar idempotencia" en lugar de "agregar".
- **OBS #3** — el PRD (linea 81) menciona el archivo de tests como `src/utils/__tests__/businessMap.test.ts`, pero la ubicacion real es `src/utils/businessMap.test.ts` (sibling, no en subdir). El plan tiene la ubicacion correcta — solo nota al implementador para no crear duplicado guiandose por el PRD.
- **OBS #4** — paso 18: el comando real en `package.json` es `pnpm guards:check` (linea 20). El plan menciona `pnpm test:guards` que no existe. Usar `pnpm guards:check` (valida baseline + actuales) o `pnpm guards` (corre guards con pretty output).

### Listo para implementacion

Si — las 4 observaciones son ajustes menores de comandos/coordenadas, no bloquean delegacion. Manu puede pasar a `luna` directamente; idealmente patchear OBS #1, #2 y #4 antes de ejecutar.
