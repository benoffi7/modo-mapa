# Specs: Tech debt — RankingsView/MapView O(n) lookups + useRatingPrompt Set construction

**PRD:** [prd.md](prd.md)
**Fecha:** 2026-05-16
**Issue:** #333

---

## Modelo de datos

No hay cambios al modelo de datos. Cero colecciones nuevas, cero campos nuevos. Toda la operacion vive sobre el dataset estatico `allBusinesses` (JSON empaquetado en el bundle) y reusa el singleton `businessMap.ts` existente (introducido en #302, expandido en #324).

Tipos involucrados (sin cambios):

```ts
// src/types/business.ts (sin cambios — referencia)
export interface Business {
  id: string;
  name: string;
  category: string;
  lat: number;
  lng: number;
  address: string;
  tags: string[];
  // ...
}

// src/utils/businessMap.ts (firma nueva)
export function getAllBusinessIdsSet(): Set<string>;
```

## Firestore Rules

No aplica. Cero cambios a Firestore rules. El feature no toca lecturas ni escrituras a Firestore.

### Rules impact analysis

| Query (service file) | Collection | Auth context | Rule that allows it | Change needed? |
|---------------------|------------|-------------|-------------------|----------------|
| (ninguna) | — | — | — | No |

### Field whitelist check

| Collection | New/modified field | In create `hasOnly()`? | In update `affectedKeys().hasOnly()`? | Rule change needed? |
|-----------|-------------------|----------------------|--------------------------------------|-------------------|
| (ninguna) | — | — | — | No |

## Cloud Functions

No aplica. Cero triggers, callables ni scheduled functions tocados.

## Seed Data

No aplica. No hay cambios a Firestore schema.

## Componentes

### `MapView` (modificado — `src/components/map/MapView.tsx`)

| Aspecto | Detalle |
|---------|---------|
| Props | Sin cambios (no recibe props) |
| Cambios internos | (1) `handleMarkerClick` deja de leer `businessesRef.current.find(...)` y pasa a `getBusinessById(businessId)`. (2) Se elimina la declaracion del `useRef` `businessesRef`. (3) Se elimina el `useEffect` que sincroniza `businessesRef.current = businesses`. (4) Se elimina el comentario aislado de L58 (`// Stable ref for businesses so handleMarkerClick doesn't invalidate memo'd markers`) que justificaba el ref ahora removido. |
| Render | Sin cambios. El loop `businesses.map((business) => <BusinessMarker .../>)` sigue iterando sobre `businesses` filtrados (correcto: el render solo muestra los markers que pasan el filtro). |
| Dependencias de `useCallback(handleMarkerClick)` | Pasa de `[setSelectedBusiness, map]` a `[setSelectedBusiness, map]` (la dependencia `businessesRef` nunca estuvo en el array — el ref es estable). Cero cambio en deps. |
| Imports nuevos | `import { getBusinessById } from '../../utils/businessMap';` |
| Imports eliminados | Ninguno (el ref es un import implicito de React; `useRef` sigue importado para `hasInitialLocation`). |

### `RankingsView` (modificado — `src/components/social/RankingsView.tsx`)

| Aspecto | Detalle |
|---------|---------|
| Props | Sin cambios |
| Cambios internos | Linea 38 pasa de `const businessMap = new Map(allBusinesses.map((b) => [b.id, b]));` a `const businessMap = getBusinessMap();`. La variable conserva el mismo nombre y tipo (`Map<string, Business>`), todos los consumidores downstream del componente quedan intactos. |
| Imports nuevos | `import { getBusinessMap } from '../../utils/businessMap';` |
| Imports a evaluar | El import `import { allBusinesses } from '../../hooks/useBusinesses';` se conserva — `RankingsView` lo sigue usando para otros lookups (ej: zoneTrending) si los hubiera. Verificacion: si tras el cambio queda como import sin uso, eliminarlo (el linter lo detecta). |

### Mutable prop audit

| Component | Prop | Editable fields | Local state needed? | Parent callback |
|-----------|------|----------------|-------------------|-----------------|
| (ninguno) | — | — | — | — |

El feature no introduce ni modifica el patron prop→state→callback. Cero superficie nueva editable.

## Textos de usuario

Cero textos nuevos. Cambio 100% interno, sin copy nuevo, sin toasts, sin labels.

| Texto | Donde se usa | Notas |
|-------|-------------|-------|
| (ninguno) | — | — |

## Hooks

### `useRatingPrompt` (modificado — `src/hooks/useRatingPrompt.ts`)

| Aspecto | Detalle |
|---------|---------|
| Firma publica | Sin cambios. Sigue retornando `{ promptData, dismiss, navigateToBusiness }`. |
| Cambio interno | Linea 121 pasa de `const allBizIds = new Set(allBusinesses.map((b) => b.id));` a `const allBizIds = getAllBusinessIdsSet();`. El check `if (!allBizIds.has(checkIn.businessId)) continue;` queda igual. |
| Effect dependencies | Sin cambios. El effect sigue dependiendo de `[user]`. |
| Cancellation pattern | Sin cambios. `let cancelled = false; return () => { cancelled = true; };` se conserva. |
| Imports nuevos | `import { getAllBusinessIdsSet, getBusinessById } from '../utils/businessMap';` (el `getBusinessById` ya esta importado — solo se agrega `getAllBusinessIdsSet`). |
| Imports a evaluar | `import { allBusinesses } from './useBusinesses';` queda sin uso tras el cambio — eliminarlo. El linter lo detecta. |

### `useLocalTrending` (modificado — `src/hooks/useLocalTrending.ts`)

| Aspecto | Detalle |
|---------|---------|
| Firma publica | Sin cambios. Sigue retornando `{ businesses, source, localityName, radiusKm, loading }`. |
| Cambio interno | El `useMemo` de `businessCoords` (lineas 39-42) se elimina por completo. El bucle de filtrado en el segundo `useMemo` pasa de `const coords = businessCoords.get(biz.businessId); if (!coords) return false; return distanceKm(location.lat, location.lng, coords.lat, coords.lng) <= radius;` a `const biz2 = businessMap.get(biz.businessId); if (!biz2) return false; return distanceKm(location.lat, location.lng, biz2.lat, biz2.lng) <= radius;`. La variable `businessMap` se obtiene de `getBusinessMap()` una sola vez al inicio del hook (no en `useMemo` porque el singleton ya esta cacheado a nivel modulo). |
| Dependencias del `useMemo` de filtrado | Pasan de `[data, location.lat, location.lng, businessCoords]` a `[data, location.lat, location.lng]`. El singleton no es deps del effect porque su referencia es estable post-construccion. |
| Imports nuevos | `import { getBusinessMap } from '../utils/businessMap';` |
| Imports a evaluar | `import { allBusinesses } from './useBusinesses';` queda sin uso tras el cambio — eliminarlo. |

### `businessMap` (modificado — `src/utils/businessMap.ts`)

| Aspecto | Detalle |
|---------|---------|
| Nueva funcion | `export function getAllBusinessIdsSet(): Set<string>` |
| Implementacion | Mismo patron lazy + singleton que `getBusinessMap()`. Cache module-level `let cachedIdsSet: Set<string> \| null = null;`. Construido en primer acceso via `new Set(allBusinesses.map((b) => b.id))`. Compartido entre todas las llamadas. |
| Reset coordinado | `__resetBusinessMap()` se modifica para resetear AMBOS singletons (Map y Set) en la misma invocacion. Garantiza que tras `__resetBusinessMap()`, ambas estructuras se reconstruyen con la misma fuente de verdad. Comentario JSDoc actualizado para explicitar que el reset es coordinado. |
| Tamano | El archivo sigue muy por debajo de 80 lineas (estimado ~55 tras el cambio). |

## Servicios

No aplica. Cero servicios tocados. `src/services/` queda intacto.

## Integracion

### Diagrama de impacto

```
src/utils/businessMap.ts                  [MODIFY: nueva fn getAllBusinessIdsSet + reset coordinado]
   ↑                ↑                ↑                ↑
   |                |                |                |
RankingsView   MapView         useRatingPrompt   useLocalTrending
[S1: 1 linea]  [S2: -ref/-useEffect/-comentario/+getBusinessById]  [S3: +getAllBusinessIdsSet]  [S4: +getBusinessMap, -proyeccion coords]
```

### Preventive checklist

- [x] **Service layer**: Ningun componente importa `firebase/firestore`. Solo se tocan utils puros e hooks ya existentes.
- [x] **Duplicated constants**: No hay constantes nuevas. Se elimina la duplicacion de cache (`businessCoords` proyectado en `useLocalTrending` y `new Set(...)` en `useRatingPrompt`).
- [x] **Context-first data**: No aplica — `allBusinesses` no es un context, es un dataset estatico empacado.
- [x] **Silent .catch**: No se introduce `.catch(() => {})`. Los `try/catch` existentes en `useRatingPrompt` no se tocan.
- [x] **Stale props**: Ningun componente recibe props mutables nuevas. El cambio es 100% interno.

### Componentes/hooks que NO se tocan (pero referencian el modulo)

- `useNavigateToBusiness`, `BusinessSheet`, `MapMarker`, demas consumidores del singleton siguen funcionando sin cambios — son consumidores existentes de `getBusinessMap()/getBusinessById()`.
- Los tests de `businessMap.test.ts`, `businessHelpers.test.ts` y demas suites que ya invocan `__resetBusinessMap()` en `beforeEach` siguen verdes — el reset coordinado del Set es transparente para ellos (resetea algo que ya estaba reseteado o que no construyeron).

## Tests

| Archivo test | Que testear | Tipo |
|-------------|-------------|------|
| `src/utils/businessMap.test.ts` | (1) `getAllBusinessIdsSet()` devuelve `Set<string>` con todos los ids. (2) `size === allBusinesses.length`. (3) Singleton: misma instancia entre dos llamadas consecutivas. (4) Reset coordinado: tras `__resetBusinessMap()`, llamar `getBusinessMap()` y `getAllBusinessIdsSet()` produce instancias **distintas** a las previas en una sola transicion. (5) Reset coordinado consistente: tras `__resetBusinessMap()`, ambos singletons refrescan en la misma invocacion (no uno antes que el otro). | Util (unit) |
| `src/hooks/useRatingPrompt.test.ts` | Agregar `beforeEach(() => __resetBusinessMap())` para consistencia con el patron de `businessMap.test.ts` y `businessHelpers.test.ts`. Los casos existentes se mantienen sin modificacion. Verificar que el caso "business no esta en el dataset" sigue dando `promptData === null` (cubre la integracion con `getAllBusinessIdsSet`). | Hook |
| `src/hooks/useLocalTrending.test.ts` | Agregar `beforeEach(() => __resetBusinessMap())`. Los casos existentes deben seguir verdes (mismo output: lista de trending con mismos ids, mismo orden, mismas distancias). Agregar test explicito de regression bit-identical: dado un fixture controlado de `allBusinesses` + `mockTrendingData`, verificar que `result.current.businesses` (ids + orden) es identico al output esperado antes del cambio. Verificar que `distanceKm` recibe `business.lat/business.lng` desde el `Business` completo retornado por `getBusinessMap()` (cubre opcion a2 del PRD). | Hook |
| `src/components/map/MapView.markerTap.test.tsx` (NUEVO) | Mock de `useBusinesses`, `useSelection`, `useFilters`, `useUserSettings`, `@vis.gl/react-google-maps`, `getBusinessById`. **Caso (a)**: sin filtro activo — `handleMarkerClick('biz_001')` llama `setSelectedBusiness` con el business correcto (`getBusinessById('biz_001')`). **Caso (b)**: con filtro activo que excluye al business — `businesses` filtrado no contiene `biz_001`, pero `getBusinessById('biz_001')` lo devuelve igual; el handler debe seleccionarlo correctamente. Invariante: dataset estatico es fuente de verdad. **Caso (c)**: id desconocido — `getBusinessById` retorna `undefined`, no se llama `setSelectedBusiness`. | Componente |

### Notas de testing

- Toda suite que toque `businessMap.ts` (directa o indirectamente via hooks) debe llamar `__resetBusinessMap()` en `beforeEach()` — incluyendo `businessHelpers.test.ts`, `businessMap.test.ts`, `useRatingPrompt.test.ts`, `useLocalTrending.test.ts`, y el nuevo `MapView.markerTap.test.tsx`.
- El test de regression bit-identical de `useLocalTrending` debe usar fixture explicito (mock `mockAllBusinesses`), nunca el JSON real, para que el snapshot no se invalide ante cambios futuros del dataset (recomendacion explicita de Sofia en validacion Ciclo 2).
- El nuevo test `MapView.markerTap.test.tsx` debe convivir con `MapView.timeout.test.tsx` existente — usar mocks compatibles (mismo `vi.mock` de `@vis.gl/react-google-maps`).
- Cobertura nueva: la funcion `getAllBusinessIdsSet` es pequena, debe llegar a 100%.
- Tests existentes de `RankingsView` (si los hubiera) y `useRatingPrompt` deben seguir verdes — el comportamiento observable es identico.

## Analytics

Sin cambios. No se agregan ni se modifican llamadas a `trackEvent`. Los eventos existentes en `RankingsView` (`EVT_RANKINGS_ZONE_FILTER`, `EVT_TRENDING_NEAR_TAPPED`) y `useRatingPrompt` (`EVT_RATING_PROMPT_SHOWN`, `EVT_RATING_PROMPT_CLICKED`, `EVT_RATING_PROMPT_DISMISSED`, `EVT_RATING_PROMPT_CONVERTED`) no se tocan.

---

## Offline

### Cache strategy

| Dato | Estrategia | TTL | Storage |
|------|-----------|-----|---------|
| `getBusinessMap()` / `getBusinessById()` / `getAllBusinessIdsSet()` | Singleton module-level | Lifetime de la sesion (no expira) | In-memory (variable de modulo) |

### Writes offline

| Operacion | Mecanismo | Conflict resolution |
|-----------|-----------|-------------------|
| (ninguna) | — | — |

### Fallback UI

No aplica. El dataset `allBusinesses` ya esta empacado en el bundle, siempre disponible offline. No hay UI nueva.

---

## Accesibilidad y UI mobile

Cero cambios visuales/DOM/aria. El cambio es 100% interno.

| Componente | Elemento | aria-label | Min touch target | Error state |
|-----------|----------|------------|-----------------|-------------|
| (ninguno) | — | — | — | — |

### Reglas (verificacion)

- Touch targets: sin cambios — `BusinessMarker` conserva su area de tap.
- Componentes con fetch: sin cambios — `useRatingPrompt` ya tenia `try/catch` que silencia errores; no se introduce nueva surfaces.
- `<img>` con URL dinamica: no aplica.

## Textos y copy

Cero textos nuevos. No aplica.

### Reglas de copy

No aplica — no se introduce copy.

---

## Decisiones tecnicas

### D1. Por que un nuevo singleton `getAllBusinessIdsSet` en vez de derivarlo de `getBusinessMap`

Alternativa rechazada: derivar el set inline en cada uso (`new Set(getBusinessMap().keys())`). Aunque la operacion `.keys()` es O(n) (n = ~200 businesses), llamarla en cada effect run de `useRatingPrompt` reintroduce el costo que el cambio quiere evitar. El singleton dedicado paga el costo una vez y queda cacheado.

### D2. Reset coordinado Map + Set en `__resetBusinessMap()`

Alternativa rechazada: exponer `__resetBusinessIdsSet()` separado. Multiplicar entrypoints de reset es la receta para tests con cache stale (alguien resetea uno y olvida el otro). El reset coordinado bajo un nombre unico es defensa contra ese vector. Sofia lo cerro explicitamente en Ciclo 2 del PRD.

### D3. `useLocalTrending` opcion a2 (consumir `Business` completo)

Alternativa rechazada: helper paralelo `getBusinessCoordsMap(): Map<string, {lat, lng}>`. Crearia una segunda fuente de verdad sobre el mismo dataset, duplicando memoria y agregando un nuevo entrypoint de reset. La proyeccion `{lat, lng}` no aporta beneficio real — acceder `.lat/.lng` sobre el `Business` completo es la misma operacion O(1). Sofia eligio a2 en Ciclo 2.

### D4. Eliminar `businessesRef` + su `useEffect` en `MapView`

Alternativa rechazada: dejar el ref y solo cambiar el `find`. Si `handleMarkerClick` deja de leer del ref, el ref queda muerto. Mantener codigo muerto agrava el principio "no acumular deuda muerta" del PRD. La eliminacion es parte del scope explicito (S2).

### D5. Eliminar comentario L58

Alternativa rechazada: dejar el comentario. Un comentario que describe codigo que ya no existe (el ref muerto) confunde lectores futuros — es worse than no comment.

### D6. Sin barrel para `businessMap.ts`

`src/utils/` no usa barrel files (siguiendo el patron `feedback_vite_mocks` documentado en patterns). El nuevo export `getAllBusinessIdsSet` se consume directamente: `import { getAllBusinessIdsSet } from '../utils/businessMap';`. Cero cambio a `src/utils/index.ts` (que no existe).

---

## Hardening de seguridad

No aplica. Cero superficie nueva expuesta al cliente. Cero escrituras Firestore. Cero endpoints nuevos. Cero input del usuario. Cero lectura de datos sensibles. El dataset `allBusinesses` ya es publico (JSON empacado).

### Firestore rules requeridas

Ninguna.

### Rate limiting

No aplica.

### Vectores de ataque mitigados

| Ataque | Mitigacion | Archivo |
|--------|-----------|---------|
| (ninguno aplicable) | — | — |

---

## Deuda tecnica: mitigacion incorporada

`gh issue list --label security --state open --json number,title` → `[]`
`gh issue list --label "tech debt" --state open --json number,title` → `[]`

| Issue | Que se resuelve | Paso del plan |
|-------|----------------|---------------|
| #324 (cerrado) — followup directo | Completar los 4 callsites pendientes que el grep original no capturo | Fase 1 (S1+S4) y Fase 2 (S2+S3) |
| #302 (cerrado) — origen del singleton | Extender el modulo manteniendo el patron lazy + reset coordinado | Fase 1 paso "Modificar businessMap.ts" |
| Guard `R-newMap-allBusinesses` baseline 2 | Cerrar a 0 (cubre `RankingsView` + `useLocalTrending`) | Fase 4 paso "Bajar baseline a 0" |
| Comentario huerfano `MapView.tsx:58` | Eliminar comentario que justifica codigo muerto | Fase 2 paso S2 |

No hay deuda tecnica preexistente en los archivos tocados que requiera fix adicional fuera del scope del PRD.

---

## Validacion Tecnica

**Validado por**: Diego (solution architect)
**Fecha**: 2026-05-02
**Estado**: VALIDADO

### Contexto revisado

- PRD: `docs/feat/infra/333-perf-rankings-mapview-ratingprompt/prd.md` (sello Sofia: VALIDADO 2026-05-02)
- Codigo verificado contra el specs:
  - `src/utils/businessMap.ts` — singleton lazy existente; `__resetBusinessMap()` solo resetea `cachedMap` actualmente, S3 lo extiende a coordinar el Set
  - `src/components/map/MapView.tsx` L58-62 (comentario huerfano + `businessesRef` + `useEffect` de sync) y L83-92 (`handleMarkerClick` con `find`) — coinciden exactamente con lo descrito en S2
  - `src/hooks/useRatingPrompt.ts:121` (`new Set(allBusinesses.map(...))`) y L7 (`getBusinessById` ya importado) — coinciden con S3
  - `src/hooks/useLocalTrending.ts:39-42` (`businessCoords` `useMemo` con proyeccion `{lat, lng}`) y L67 (deps incluyen `businessCoords`) — coinciden con S4
  - `src/components/social/RankingsView.tsx:15,38` (`allBusinesses` import + `new Map(...)` en render body sin `useMemo`) — coinciden con S1; tras el cambio, el import `allBusinesses` queda sin uso en RankingsView (a eliminar — el specs lo deja a discrecion del linter)
- Tests existentes (colocados en mismo dir, no `__tests__/`):
  - `src/utils/businessMap.test.ts` — usa `__resetBusinessMap()` en `beforeEach`, patron a extender
  - `src/hooks/useRatingPrompt.test.ts`, `src/hooks/useLocalTrending.test.ts` — existen, S3/S4 agregan `beforeEach(__resetBusinessMap)`
  - `src/components/map/MapView.timeout.test.tsx` — existe; el nuevo `MapView.markerTap.test.tsx` debe coexistir con sus mocks (`@vis.gl/react-google-maps`, etc.)
- Guard: `.guards-baseline.json` linea 23 `"R-newMap-allBusinesses": 2`; `scripts/guards/checks.mjs:121` define el check — baseline 2->0 es operacion trivial
- Patron documentado en `docs/reference/patterns.md` L206 (`businessMap singleton (#302)`) — sera actualizado en docs por separado (PRD lo lista como tarea de cierre)

### Hallazgos

Sin hallazgos BLOQUEANTES ni IMPORTANTES. Cobertura PRD -> specs completa (4 cambios + tests + baseline). Cero superficie nueva expuesta (sin Firestore, sin rules, sin Cloud Functions, sin endpoints, sin storage keys, sin analytics events nuevos). Decisiones tecnicas D1-D6 son consistentes con los descartes ya cerrados por Sofia en PRD (a2 vs helper paralelo, reset coordinado vs entrypoints separados, eliminacion total del ref muerto vs cambio parcial). El diagrama de impacto y la preventive checklist cubren los vectores que mas suelen romperse en este tipo de followup (silent .catch, stale props, duplicated constants).

### Observaciones

- **OBSERVACION**: la decision D6 referencia `feedback_vite_mocks` como justificacion de "no barrel para `src/utils/`". La entrada real en `patterns.md` es la #330 ("No barrel para `src/hooks/`") con justificacion vitest tree-shake; aplica por analogia a `src/utils/` (que tambien carece de `index.ts`) pero el slug del feedback citado no aparece textualmente en patterns. El comportamiento descrito (no agregar barrel, import directo) es correcto — solo la referencia interna es imprecisa. No bloquea implementacion.
- **OBSERVACION**: el specs deja a discrecion del linter la eliminacion del import `allBusinesses` en `RankingsView.tsx` y `useLocalTrending.ts` ("queda sin uso tras el cambio — eliminarlo. El linter lo detecta"). El proyecto usa `noUnusedLocals` en `tsconfig`, asi que el build fallaria si no se elimina — el implementador lo va a ver enseguida. Esta bien delegarlo al linter.

### Para el plan (Pablo)

- Verificar orden de implementacion: el plan deberia tocar `businessMap.ts` (nueva fn + reset coordinado) **antes** que `useRatingPrompt.ts` (S3 depende de la fn nueva). El diagrama del specs ya lo refleja con la flecha desde `businessMap.ts` hacia abajo.
- El test de regression bit-identical de `useLocalTrending` requiere fixture explicito de `allBusinesses` (recomendacion de Sofia C2 anclada en specs L167). El plan deberia listarlo como step concreto, no solo como "agregar test".
- Baseline guard `R-newMap-allBusinesses`: 2 -> 0 en `.guards-baseline.json` linea 23 — operacion trivial pero debe ir en el commit final para que pre-push no rompa antes de tener los 4 cambios mergeados.
- No hay scope de docs site / sidebar / changelog en este PRD — la actualizacion de `patterns.md` (entrada businessMap singleton) y `project-reference.md` van en el cierre, no en la implementacion principal.

### Listo para pasar a plan?

Si.
