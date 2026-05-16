# PRD: Tech debt — RankingsView/MapView O(n) lookups + useRatingPrompt Set construction

**Feature:** 333-perf-rankings-mapview-ratingprompt
**Categoria:** infra
**Fecha:** 2026-05-16
**Issue:** #333
**Prioridad:** Media

---

## Contexto

Followup directo de #324 ("Performance — allBusinesses.find x13, lazy img, MUI chunk split", cerrado en v2.43.0). #324 migro 13 callsites del patron `allBusinesses.find()` al singleton `getBusinessMap()` / `getBusinessById()` de `src/utils/businessMap.ts` y separo `@mui/icons-material` del chunk core de MUI. Los audits postmerge (luna + thanos + performance auditor) detectaron 4 callsites adicionales que el grep original de #324 no capturo porque no son el patron exacto `allBusinesses.find()` — son variantes: dos construcciones locales de `Map` en cada render/effect, hotpath `find()` en handler de marker tap, y construccion de `Set` en cada effect run. La baseline del guard `R-newMap-allBusinesses` (302) esta en 2 y este PRD la deja en 0 — los 2 hits actuales son `RankingsView.tsx:38` y `useLocalTrending.ts:40`.

## Problema

- `RankingsView.tsx:38` ejecuta `new Map(allBusinesses.map(...))` en cada render del componente (no esta envuelto en `useMemo`), aunque el dataset `allBusinesses` es estatico. Es exactamente el patron que `getBusinessMap()` esta disenado para reemplazar y contribuye 1 de los 2 hits del guard `R-newMap-allBusinesses`.
- `MapView.tsx:85` hace `businessesRef.current.find((b) => b.id === businessId)` en el callback `handleMarkerClick`, que corre en cada tap a un marker del mapa. Con 40 markers visibles + un usuario activo, el costo O(n) por click es marginal pero no nulo, y rompe la consistencia que #324 establecio para todos los lookups por id.
- `useRatingPrompt.ts:121` construye `new Set(allBusinesses.map((b) => b.id))` adentro del effect de eligibility, que se re-evalua en cada cambio de `user`. El Set se descarta apenas el effect termina. No hay memoizacion ni reuso entre invocaciones.
- `useLocalTrending.ts:40` construye `new Map(allBusinesses.map((b) => [b.id, { lat: b.lat, lng: b.lng }]))` en cada invocacion del hook, proyectando solo `{lat, lng}`. Aporta el segundo hit del guard `R-newMap-allBusinesses`. La proyeccion no aporta beneficio real — `getBusinessMap()` ya retorna el `Business` completo y consumir `.lat/.lng` directo evita mantener dos caches paralelas con la misma fuente de verdad.

## Solucion

**S1. RankingsView: reemplazar `new Map(allBusinesses.map(...))` por `getBusinessMap()`**

Cambio de 1 linea. La variable local `businessMap` ya tiene el tipo correcto (`Map<string, Business>`), solo cambia la fuente. Mantiene la misma API para todos los consumidores downstream del componente. Patron canonico documentado en `patterns.md` ("businessMap singleton").

**S2. MapView: migrar el find del hotpath a `getBusinessById`**

`handleMarkerClick` deja de depender de `businessesRef.current`. Pasa de `businessesRef.current.find((b) => b.id === businessId)` a `getBusinessById(businessId)`. Como consecuencia, **`businessesRef` deja de ser necesario** porque ya no lo usa ningun otro callback del componente — el `useEffect` que lo sincroniza tambien se elimina (no acumular deuda muerta). Limpieza adicional: eliminar el comentario aislado en `MapView.tsx:58` que justificaba el ref ahora removido — no debe quedar comentario huerfano referenciando codigo que ya no existe.

Nota: el `find()` actual opera sobre `businesses` filtrados (post-filters) en lugar de `allBusinesses`, pero `getBusinessById()` resuelve sobre el dataset completo. Esto es correcto: el marker solo se renderiza si el business pasa el filtro, asi que cualquier id que llegue a `handleMarkerClick` ya esta en `businesses` y por extension en `allBusinesses`. La eleccion del business para setear `selectedBusiness` no debe depender del filtro activo — un click siempre debe seleccionar el comercio correcto, y el dataset estatico es la fuente de verdad. La validacion comportamental va en specs (test de marker tap, incluyendo el escenario "filtro activo excluye al business, `getBusinessById` lo devuelve igual" como invariante: dataset estatico es fuente de verdad).

**S3. useRatingPrompt: cachear `allBusinessIdsSet` a nivel modulo en `businessMap.ts`**

Exponer `getAllBusinessIdsSet(): Set<string>` desde `src/utils/businessMap.ts` con el mismo patron lazy de `getBusinessMap()` — construido en el primer acceso, compartido entre llamadas. Reemplazar `new Set(allBusinesses.map((b) => b.id))` en `useRatingPrompt.ts:121` por `getAllBusinessIdsSet()`. Agregar reset a `__resetBusinessMap()` para que los tests existentes que llaman a `__resetBusinessMap()` antes del setup queden consistentes (el reset del Map y del Set deben ir juntos para evitar derive cache stale).

**S4. useLocalTrending: migrar `new Map(allBusinesses.map(...))` a `getBusinessMap()`**

Reemplazar la construccion local en `useLocalTrending.ts:40` por una lectura directa de `getBusinessMap()`. La proyeccion actual a `{lat, lng}` se elimina: los call-sites downstream que consumian `.lat/.lng` desde el `Map<string, { lat, lng }>` ahora consumen `.lat/.lng` desde el `Business` completo retornado por `getBusinessMap()`. No hay overhead real (acceso a propiedad de un objeto ya cacheado) y se elimina la duplicacion de cache. Cierra el segundo hit del guard `R-newMap-allBusinesses` para llevarlo a 0. Decision documentada: opcion (a2) — consumir el `Business` completo, no introducir un `getBusinessCoordsMap()` paralelo. La validacion de que `useLocalTrending` solo usa `{lat, lng}` (y por ende es seguro pasar el `Business` completo) va en specs.

**UX**: cero cambio visible. Es 100% interno. No hay flag, no hay rollout, no hay copy nuevo, no hay nuevas rutas. La invariante observable es: en RankingsView, ningun click cambia de comportamiento; en el mapa, el tap a un marker selecciona exactamente el mismo business que hoy; en el rating prompt, exactamente los mismos check-ins son elegibles.

---

## Scope

| Item | Prioridad | Esfuerzo |
|------|-----------|----------|
| S1 RankingsView: `getBusinessMap()` | Alta | XS |
| S2 MapView: `getBusinessById()` + remove `businessesRef` y su `useEffect` + cleanup comentario L58 | Alta | S |
| S3 `getAllBusinessIdsSet()` en `businessMap.ts` + uso en `useRatingPrompt.ts` | Alta | S |
| S4 useLocalTrending: `getBusinessMap()` (consumo directo de `Business.lat/lng`) | Alta | XS |
| Test: `businessMap.test.ts` cubre nuevo `getAllBusinessIdsSet()` + reset coordinado | Alta | S |
| Test: `useRatingPrompt.test.ts` agrega `beforeEach(__resetBusinessMap)` (consistencia con suites businessMap/businessHelpers) | Alta | XS |
| Test: `MapView.test.tsx` regression de marker tap (no romper la seleccion, con y sin filtro activo) | Media | S |
| Test: `useLocalTrending.test.ts` regression — output identico antes/despues (orden y valores de trending) | Media | XS |
| Baseline guard `R-newMap-allBusinesses`: 2 → 0 en `.guards-baseline.json` | Alta | XS |

**Esfuerzo total estimado:** M

---

## Out of Scope

- Refactor general de `MapView.tsx` (es un archivo grande con varios `useEffect` y manejo de errores que no se tocan).
- Migracion del marker render loop (`businesses.map((business) => <BusinessMarker .../>)`) — el iterador sobre `businesses` filtrados es el comportamiento correcto, no es deuda.
- Memoizacion del propio render de `RankingsView` (no se va a envolver el componente en `React.memo` ni se va a refactorizar la lista virtualizada — fuera de alcance).
- Cualquier optimizacion ADICIONAL de `useLocalTrending` que no sea el reemplazo del `new Map(...)` por `getBusinessMap()` — no se toca el algoritmo de trending, el rate decay, ni los pesos. S4 es estrictamente el cambio de fuente de cache.
- `useNavigateToBusiness` y cualquier otro consumidor de `allBusinesses` no listado en S1-S4 (no son parte de los callsites del guard).
- Introducir un helper paralelo `getBusinessCoordsMap()` o similar (decision documentada en S4: opcion a2, no duplicar cache).

---

## Tests

### Archivos que necesitaran tests

| Archivo | Tipo | Que testear |
|---------|------|-------------|
| `src/utils/__tests__/businessMap.test.ts` | Util | Nuevo: `getAllBusinessIdsSet()` devuelve `Set<string>` con todos los ids; misma instancia entre llamadas (singleton); `__resetBusinessMap()` resetea tambien el Set; size === `allBusinesses.length` |
| `src/components/map/__tests__/MapView.test.tsx` (nuevo) o smoke local | Componente | Marker tap llama a `setSelectedBusiness` con el business correcto (mock de `useBusinesses` + mock de `useSelection`). Cubrir dos escenarios: (a) sin filtro activo, (b) **con filtro activo que excluye al business** → `getBusinessById` lo devuelve igual (invariante: dataset estatico es fuente de verdad). Garantiza que el cambio S2 preserva la semantica de seleccion. Cubre el remove del `businessesRef`/`useEffect`. |
| `src/hooks/__tests__/useRatingPrompt.test.ts` | Hook | Agregar `beforeEach(() => __resetBusinessMap())` para alinear con el patron de `businessMap.test.ts` y `businessHelpers.test.ts` (consistencia de reset coordinado del Map + Set). Si el test no existe, crear el archivo cubriendo el caso donde `allBusinesses` no contiene el `businessId` del check-in → no se elige como elegible (verifica el Set check). |
| `src/hooks/__tests__/useLocalTrending.test.ts` | Hook | Regression de S4: dado un set de check-ins/rates input, la salida (lista de trending) es identica antes y despues del cambio (mismos ids, misma posicion, mismas distancias). Verifica que consumir `Business.lat/lng` directo desde `getBusinessMap()` no rompe el calculo. Agregar `beforeEach(() => __resetBusinessMap())`. |

### Criterios de testing

- Cobertura >= 80% del codigo nuevo (la funcion `getAllBusinessIdsSet` es pequena y debe llegar a 100%).
- Test de invariante singleton para el Set (igual al patron de `getBusinessMap`).
- Regression test del marker tap en MapView verificando que el business seleccionado es exactamente el mismo que hoy, incluyendo el caso explicito **"filtro activo excluye al business, `getBusinessById` lo devuelve igual"** (invariante: dataset estatico es fuente de verdad, no `businesses` filtrado).
- Regression test de `useLocalTrending` verificando salida bit-identical antes/despues de S4 (orden, ids, distancias).
- Tests existentes de `RankingsView`, `useRatingPrompt` y `useLocalTrending` deben seguir verdes sin cambios — el comportamiento observable es identico.
- Todos los tests que tocan el modulo `businessMap.ts` (incluyendo `businessHelpers.test.ts`, `businessMap.test.ts`, `useRatingPrompt.test.ts` y `useLocalTrending.test.ts`) deben llamar a `__resetBusinessMap()` en `beforeEach()` para evitar cache pollution entre tests.

---

## Seguridad

No aplica. Cero superficie nueva expuesta al cliente. No hay escritura a Firestore, no hay endpoint nuevo, no hay input del usuario, no hay lectura de datos sensibles. El dataset `allBusinesses` ya es publico (viene de un JSON empacado en el bundle).

### Vectores de ataque automatizado

| Superficie | Ataque posible | Mitigacion requerida |
|-----------|---------------|---------------------|
| (ninguna) | — | — |

---

## Deuda tecnica y seguridad

```bash
gh issue list --label security --state open --json number,title
gh issue list --label "tech debt" --state open --json number,title
```

No hay issues abiertos con labels `security` ni `tech debt` (ambos comandos devuelven `[]` al momento de escribir este PRD; los issues 333-338 estan abiertos pero llevan label `enhancement`). Issues relacionados por tematica:

### Issues relacionados

| Issue | Relacion | Accion |
|-------|----------|--------|
| #324 (cerrado) | Origen — definio el patron `getBusinessMap()`/`getBusinessById()` y migro 13 callsites | Completar la migracion con los 4 callsites pendientes (RankingsView, MapView, useRatingPrompt, useLocalTrending) |
| #334 (abierto, "#324 plan deferrals — firebase/storage refactor + bundle gate + perf baselines") | Sibling del mismo workstream de #324 | No tocar — distinto scope (Firebase Storage refactor + bundle gate) |
| #302 (cerrado) | Introdujo el singleton `businessMap.ts` | No agravar — extender el modulo manteniendo el patron lazy + reset coordinado |

### Mitigacion incorporada

- Bajar la baseline del guard `R-newMap-allBusinesses` de 2 a 0 — cierra el cap que dejo #324 abierto. Cubre los dos hits actuales: `RankingsView.tsx` (via S1) y `useLocalTrending.ts` (via S4). No quedan grep hits.
- Limpiar `businessesRef` muerto en `MapView.tsx` apenas su unico consumidor (`handleMarkerClick`) deja de usarlo (S2). Eliminar el comentario huerfano de L58 que justificaba el ref. Evita acumular deuda muerta tipo "ref que nadie referencia" y "comentario que documenta codigo que ya no existe".
- Coherencia con principio "no acumular deuda muerta": migrar `useLocalTrending` como parte de este PRD en vez de dejarlo Out of Scope. La alternativa (dejarlo para un PRD posterior) hubiera dejado un hit del guard inalcanzable desde el cierre de #333 — contradiccion explicita con el Success Criteria #2.

---

## Robustez del codigo

### Checklist de hooks async

- [x] El effect de `useRatingPrompt` ya tiene patron de cancelacion (`let cancelled = false; return () => { cancelled = true; }`) — el cambio S3 no toca eso, solo reemplaza la construccion del Set.
- [x] No se introduce ningun nuevo handler async ni nuevo `useEffect`.
- [x] El cambio S2 ELIMINA un `useEffect` (`businessesRef` sync) — no agrega, no acumula.
- [x] `getAllBusinessIdsSet()` es pura, sincronica, sin side effects ni async.
- [x] El nuevo export de `businessMap.ts` mantiene el archivo bajo 60 lineas (lejos del limite 300/400).
- [x] `logger.error` no se introduce ni se toca.

### Checklist de observabilidad

- [x] No hay Cloud Function tocada — no aplica `trackFunctionTiming`.
- [x] No hay nueva query Firestore — no aplica `measureAsync`.
- [x] No hay nuevo `trackEvent` (los existentes en `RankingsView` y `useRatingPrompt` no se tocan).

### Checklist offline

- [x] El cambio no modifica writes a Firestore — el comportamiento offline existente se preserva.
- [x] Los lookups O(1) son siempre client-side y trabajan sobre el dataset estatico — son intrinsecamente offline-safe.

### Checklist de documentacion

- [x] Actualizar `docs/reference/patterns.md` en la entrada **businessMap singleton (#302, expandido en #324)** para mencionar la cobertura completa post-#333 (RankingsView + MapView + useRatingPrompt + useLocalTrending) y la nueva funcion `getAllBusinessIdsSet()`.
- [x] Actualizar `docs/reference/project-reference.md` en la linea del summary para reflejar el cierre del guard `R-newMap-allBusinesses` y el patron expandido.
- [x] Sin cambios a `firestore.md` ni `features.md` (no es feature de usuario).

---

## Offline

### Data flows

| Operacion | Tipo (read/write) | Estrategia offline | Fallback UI |
|-----------|-------------------|-------------------|-------------|
| `getBusinessMap()` / `getBusinessById()` / `getAllBusinessIdsSet()` | Read (in-memory, dataset estatico) | N/A — siempre disponible offline | N/A |

### Checklist offline

- [x] No hay reads de Firestore en el codigo modificado.
- [x] No hay writes en el codigo modificado.
- [x] No hay APIs externas.
- [x] La UI ya tiene los indicadores offline existentes — no se tocan.
- [x] El dataset estatico `allBusinesses` ya esta empacado en el bundle; primera carga offline funciona igual.

### Esfuerzo offline adicional: S (efectivamente 0, evaluado y descartado)

---

## Modularizacion y % monolitico

- La logica vive en `src/utils/businessMap.ts` (util puro, sin React, sin Firebase).
- Los consumidores son el componente (`MapView`), el componente con render (`RankingsView`) y los hooks (`useRatingPrompt`, `useLocalTrending`). Nadie nuevo importa de Firebase SDK.
- No se agrega estado global, contexto ni hook nuevo.

### Checklist modularizacion

- [x] Logica de business lookup en util, no inline en componente.
- [x] `getAllBusinessIdsSet()` es reutilizable fuera de `useRatingPrompt` (cualquier otro consumidor que necesite "el set de todos los ids" puede importarlo).
- [x] No se agregan `useState` ni Context.
- [x] No hay nuevas props ni handlers — los existentes mantienen su signatura.
- [x] Ningun componente nuevo importa de `firebase/firestore` / `firebase/functions` / `firebase/storage`.
- [x] `src/utils/businessMap.ts` permanece como util puro (sin React hooks).
- [x] Archivos nuevos / modificados se mantienen muy por debajo de 300 lineas.
- [x] No se agregan converters.
- [x] El componente `MapView` se queda en `components/map/` (su domain correcto, sin tocar).
- [x] No se introduce estado global.

### Impacto en % monolitico

| Aspecto | Impacto | Justificacion |
|---------|---------|---------------|
| Acoplamiento de componentes | = | Cero acoplamiento nuevo; reduce ligeramente al eliminar `businessesRef` muerto en `MapView` |
| Estado global | = | Sin cambios |
| Firebase coupling | = | Sin cambios; el codigo modificado ya no toca Firebase |
| Organizacion por dominio | = | Sin cambios; cada archivo se queda donde esta |

---

## Accesibilidad y UI mobile

### Checklist de accesibilidad

- [x] Cero cambios visuales / DOM / aria — no aplica.
- [x] Touch targets no cambian.
- [x] Marker tap conserva el handler — la semantica `onClick` se preserva.
- [x] No se introducen `<Box onClick>` ni `<Avatar onClick>`.

### Checklist de copy

- [x] No hay copy nuevo.

---

## Success Criteria

1. Los 4 callsites detectados estan migrados: `RankingsView.tsx:38` usa `getBusinessMap()`, `MapView.tsx:85` usa `getBusinessById()`, `useRatingPrompt.ts:121` usa `getAllBusinessIdsSet()`, `useLocalTrending.ts:40` usa `getBusinessMap()` directo (sin proyeccion paralela).
2. La baseline del guard `R-newMap-allBusinesses` (en `.guards-baseline.json` seccion `"302"`) pasa de 2 a 0, y el guard sigue verde (cero grep hits restantes).
3. `MapView.tsx` ya no contiene `businessesRef` (ni su `useEffect` de sincronizacion, ni el comentario huerfano en L58 que lo justificaba) — porque ya nadie lo usa.
4. `src/utils/businessMap.ts` exporta `getAllBusinessIdsSet()` con la misma semantica lazy + singleton + reset coordinado que `getBusinessMap()`, cubierto por tests.
5. `useLocalTrending` consume `Business.lat/lng` directo desde `getBusinessMap()` y su salida es bit-identical a la anterior (verificado por test de regression).
6. Todos los tests existentes pasan sin modificacion funcional. Los tests que tocan `businessMap` (incluyendo `useRatingPrompt.test.ts` y `useLocalTrending.test.ts`) llaman `__resetBusinessMap()` en `beforeEach()`. El comportamiento observable de RankingsView, MapView, rating prompt y trending local es identico al actual.

---

## Validacion Funcional

**Validado por**: Sofia (analista funcional)
**Fecha**: 2026-05-02
**Estado**: VALIDADO

### Decisiones cerradas en validacion

- **Scope incluye `useLocalTrending` (S4)**: la opcion elegida es **a2** — consumir el `Business` completo retornado por `getBusinessMap()` y acceder `.lat/.lng` directo en los call-sites downstream. No se introduce un helper paralelo `getBusinessCoordsMap()` para evitar duplicar cache sobre la misma fuente de verdad. Esto deja la baseline del guard `R-newMap-allBusinesses` en 0 y completa la cobertura de los 4 callsites pendientes de #324.
- **Reset coordinado Map + Set**: `__resetBusinessMap()` debe resetear tambien la instancia singleton de `getAllBusinessIdsSet()`. Todos los tests que toquen `businessMap.ts` (incluyendo `useRatingPrompt.test.ts` y `useLocalTrending.test.ts`) llaman a `__resetBusinessMap()` en `beforeEach()`. Cubierto explicitamente en Scope, Tests y Success Criteria #6.
- **MapView limpia deuda muerta completa**: S2 elimina `businessesRef`, su `useEffect` de sincronizacion y el comentario huerfano en `MapView.tsx:58` que justificaba el ref. No se acumula deuda muerta.
- **Invariante de seleccion en MapView**: el click a un marker resuelve contra el dataset estatico (`getBusinessById`), no contra `businesses` filtrado. Tests cubren explicitamente el escenario "filtro activo excluye al business → `getBusinessById` lo devuelve igual".

### Observaciones para el implementador

- Reset coordinado Map + Set es la zona de mayor riesgo de regression sutil: cubrirlo con un test que invoque `__resetBusinessMap()`, llame a `getBusinessMap()` y `getAllBusinessIdsSet()` y verifique que ambos refrescan en la misma transicion.
- El test de regression bit-identical de `useLocalTrending` (S4) debe usar fixture explicito de `allBusinesses`, no el JSON empacado real, para que cambios futuros al dataset no falseen el snapshot.
- El borrado de `businessesRef` y su `useEffect` en `MapView.tsx` debe verificar que no hay otro consumidor del ref no listado en el PRD; si aparece uno, escalar antes de borrar.

### Listo para specs-plan-writer

Si.
