# PRD: Performance — bundle splits + Firestore waterfalls

**Feature:** 302-performance-bundle-waterfalls
**Categoria:** infra
**Fecha:** 2026-04-18
**Issue:** #302
**Prioridad:** Alta

---

## Contexto

El `/health-check` ejecutado el 2026-04-18 en `new-home` (post v2.35.7) identifica tres cuellos de botella principales: `recharts` (374KB) se esta filtrando al bundle de usuarios regulares via el barrel de `stats/`, el main entry pesa 448KB, y el fetch de datos del BusinessSheet tiene un waterfall que agrega 150-300ms por apertura. Esta tech debt afecta directamente a LCP en 3G y a la percepcion de velocidad al abrir cualquier comercio.

## Problema

- **`recharts` (374KB, ~110KB gzip) leak a bundle de usuarios**: `StatsView.tsx:6` importa `PieChartCard` y `TopList` desde el barrel `components/stats/index.ts`. El barrel tambien re-exporta `PieChartCard` (que usa recharts), por lo que cualquier usuario que abra el tab Perfil paga el costo completo de recharts aunque solo vea las listas top. `TopList` no usa recharts pero esta en el mismo grafo de imports.
- **Main entry chunk 448KB**: aunque `TabShell` ya usa `React.lazy()` para las 5 screens (verificado en codigo), hay imports eager a helpers compartidos como `allBusinesses` y varios hooks que probablemente estan inflando el chunk principal. El health check reporta que los lazy imports no se estan aislando correctamente — habria que validar con source maps.
- **`fetchUserLikes` waterfall en `businessData.ts:144`**: la funcion se ejecuta *despues* del `Promise.all` de 7 queries, agregando un RTT adicional (150-300ms en 3G). Ya usa batching con `documentId('in')` pero esta secuenciada despues del batch principal en vez de correr en paralelo.
- **Admin panel recharts bundle**: `AdminLayout.tsx:13-26` importa `TrendsPanel`, `FirebaseUsage`, `PerformancePanel`, `FeaturesPanel` eagerly. Aunque admin es una ruta lazy-loaded, al entrar se paga 60-80KB extra sin necesidad porque el tab default es Resumen (no Tendencias).
- **Re-renders O(n) innecesarios**: `SpecialsSection.getBusinessesForSpecial` hace `[...allBusinesses].sort()` dentro del useMemo pero se podria precomputar; `SearchListView.tsx:72-82` calcula distancias 2 veces (una en `sort`, otra en `map`) y no memoiza `BusinessRow`; varios componentes (`UserProfileContent:29`, `FeedbackList:70,127`, `PhotoReviewCard:24`, `FeaturedListsPanel`) usan `allBusinesses.find()` O(n) en vez del patron `Map` que ya se usa en `TrendingList:18` y `TrendingNearYouSection:25`.

## Solucion

### S1 — Split recharts del bundle de usuarios

- Separar `components/stats/index.ts` en dos exports: uno para `TopList` (sin recharts) y otro para `PieChartCard` (con recharts).
- Cambiar la forma en que `StatsView.tsx` carga `PieChartCard`: usar `React.lazy` con `Suspense` para que recharts solo se baje si hay datos de pie charts a mostrar.
- **Nota**: `TopList` se queda eager (es MUI puro, barato).
- **Ganancia estimada**: ~374KB (~110KB gzip) off del profile path. LCP -1 a -2s en 3G.

### S2 — Paralelizar `fetchUserLikes` en `businessData.ts`

- Mover la query de `fetchUserLikes` adentro del `Promise.all` principal en `fetchBusinessData`. El problema: `fetchUserLikes` necesita los IDs de los comentarios, que solo existen despues de ejecutar `commentsSnap`. Dos opciones:
  - **Opcion A (recomendada)**: agregar un indice compuesto `commentLikes(userId, businessId)` y cambiar la query para filtrar directamente por `where('userId', '==', uid), where('businessId', '==', bId)` en paralelo con el resto. Requiere agregar campo `businessId` a `commentLikes` (actualmente solo tiene `userId`, `commentId`, `createdAt`) — afecta el trigger `onCommentLikeCreated` y la regla de rules.
  - **Opcion B (sin cambio de schema)**: dejar `fetchUserLikes` fuera del Promise.all pero ejecutarlo en paralelo con el resto del procesamiento (sort de comments) usando un patron de "fire and await later".
- **Se opta por Opcion A** — cambio de schema minimo + elimina el waterfall permanentemente.
- **Ganancia estimada**: -150 a -300ms por apertura de BusinessSheet.

### S3 — Lazy imports en AdminLayout

- Convertir `TrendsPanel`, `FirebaseUsage`, `PerformancePanel`, `FeaturesPanel` a `React.lazy` dentro de `AdminLayout.tsx`.
- Wrappear el render de tabs en `<Suspense fallback={<AdminLoader />}>`.
- **Nota**: los otros paneles tambien se pueden lazy-load para reducir el admin bundle aun mas, pero priorizamos los 4 que importan recharts.
- **Ganancia estimada**: 60-80KB off del admin first-paint. Admin LCP -500ms.

### S4 — Eliminar O(n) lookups con singleton Map

- Crear `src/utils/businessMap.ts` con un singleton `getBusinessMap(): Map<string, Business>` memoizado en module scope.
- Refactorizar los componentes identificados (`UserProfileContent`, `FeedbackList`, `PhotoReviewCard`, `FeaturedListsPanel`, `SpecialsSection`, `TrendingNearYouSection`) para usar `getBusinessMap().get(id)` en vez de `allBusinesses.find((b) => b.id === id)`.
- Actualizar `utils/businessHelpers.ts` (`getBusinessName`) para usar el Map.
- **Nota**: `TrendingList` y `TrendingNearYouSection` ya construyen el Map localmente — consolidarlos al singleton para no reconstruir 2 veces.

### S5 — Memoizar `SearchListView.BusinessRow` + evitar doble distance calc

- Wrappear `BusinessRow` en `React.memo`.
- Precomputar la distancia 1 sola vez y pasarla como prop (evitar recalcular en el `.map`).
- Extraer la sort comparator a `useMemo` con `sortedWithDistance` que devuelva `Array<{ business, distance, distanceKm }>`.

### S6 — Optimizar `SpecialsSection.getBusinessesForSpecial`

- El sort ya esta en un `useMemo`, pero se crea una nueva array cada vez que `selectedSpecial` cambia. Como `getBusinessesForSpecial` es determinista por `specialId`, memoizar el resultado en un `Map<string, Business[]>` a nivel modulo.

### Consideraciones UX

- **Sin cambios visibles** para el usuario en happy path. El unico cambio UX es un suspense fallback breve (~100ms) si recharts se baja recien al abrir Perfil la primera vez — aceptable porque ya hay spinner en StatsView.
- **BusinessSheet**: usuarios van a percibir apertura mas rapida por la paralelizacion de likes.

---

## Scope

| Item | Prioridad | Esfuerzo |
|------|-----------|----------|
| S1: Split recharts via lazy PieChartCard | Alta | S |
| S2: Paralelizar fetchUserLikes (schema + query) | Alta | M |
| S3: Lazy imports en AdminLayout | Alta | S |
| S4: Singleton businessMap + refactor 6 componentes | Media | M |
| S5: Memoizar BusinessRow en SearchListView | Media | S |
| S6: Cache de SpecialsSection shuffles | Baja | XS |

**Esfuerzo total estimado:** M

---

## Out of Scope

- Migracion completa de admin a lazy para todos los paneles (solo los 4 de recharts).
- Refactor de `useBusinessData` (solo cambia la firma de `fetchBusinessData` internamente).
- Audit de todos los `.sort()` / `.filter()` no memoizados en toda la app (solo los identificados por health-check).
- Reemplazo de recharts por libreria mas liviana (discusion aparte).

---

## Tests

### Archivos que necesitaran tests

| Archivo | Tipo | Que testear |
|---------|------|-------------|
| `src/services/businessData.ts` | Service | `fetchBusinessData` devuelve `userCommentLikes` correcto con nueva query directa; comentarios con/sin likes |
| `src/utils/businessMap.ts` (nuevo) | Util | `getBusinessMap()` devuelve mismo Map en llamadas sucesivas, lookup correcto por ID, miss devuelve undefined |
| `src/utils/businessHelpers.ts` | Util | `getBusinessName` con ID existente e inexistente (ya tiene tests, extender si es necesario) |
| `functions/src/triggers/commentLikes.ts` | Trigger | Verificar que `businessId` se guarda correctamente al crear commentLike |
| `src/components/home/SpecialsSection.tsx` | Component | Cache memoization (sin test estricto, verificar que no se rompe) |

### Criterios de testing

- Cobertura >= 80% del codigo nuevo
- Tests de validacion para todos los inputs del usuario
- Todos los paths condicionales cubiertos
- Side effects verificados (cache, analytics, notifications)
- Test de performance: assertion de que `fetchBusinessData` solo hace 1 `Promise.all` (sin waterfall)

---

## Seguridad

- [ ] Cambio de schema en `commentLikes` (agregar campo `businessId`): actualizar `firestore.rules` para validarlo en create
- [ ] `keys().hasOnly()` en create rule de `commentLikes` debe incluir el nuevo campo
- [ ] Migracion de datos existentes: los `commentLikes` antiguos no tienen `businessId`. La query nueva los va a perder. Solucion: backfill via Cloud Function one-shot o mantener fallback al patron viejo por 1 release.
- [ ] No se agregan superficies nuevas — solo se optimizan lecturas existentes

### Vectores de ataque automatizado

| Superficie | Ataque posible | Mitigacion requerida |
|-----------|---------------|---------------------|
| Nuevo campo `businessId` en commentLikes | Cliente podria mandar businessId falso | Rule valida que `businessId` corresponda al comentario real |

Como este feature no agrega colecciones ni endpoints nuevos, el vector principal es el cambio en `commentLikes`:

- [ ] Create rule tiene `hasOnly()` con whitelist actualizada (`userId`, `commentId`, `businessId`, `createdAt`)
- [ ] Validacion de tipo de `businessId` (`is string`)
- [ ] `businessId` tiene limite de longitud razonable (ej: `size() <= 50`)
- [ ] Rate limit server-side en `onCommentLikeCreated` no cambia (50/dia sigue vigente)

### Campos server-only no afectados

- `likeCount`, `flagged`, `replyCount` siguen gestionados por triggers

---

## Deuda tecnica y seguridad

### Issues relacionados

| Issue | Relacion | Accion |
|-------|----------|--------|
| #303 perf-instrumentation | Complementa | Tras S2, `fetchBusinessData` puede tener `measureAsync` wrapper |
| #300 security (deps + App Check) | Independiente | No afecta, no agrava |
| #301 coverage <80% | Afecta | Este feature debe traer tests completos para no empeorar cobertura |

### Mitigacion incorporada

- S4 consolida el patron Map que ya se usaba parcialmente — reduce inconsistencia arquitectonica
- S2 elimina el waterfall permanentemente — deuda de performance de larga data
- Tests nuevos aportan a la resolucion parcial de #301

---

## Robustez del codigo

### Checklist de hooks async

- [ ] `fetchBusinessData` refactor mantiene el patron `Promise.all` sin agregar nuevos awaits seriales
- [ ] No hay `setState` post-async sin guard (fetch es en service layer, ya cubierto por `fetchIdRef` en `useBusinessData`)
- [ ] Funciones exportadas que no se usan fuera: `fetchUserLikes` pasa a ser interna si Opcion A se confirma
- [ ] Archivos en `src/hooks/`: N/A (no hay hooks nuevos)
- [ ] Constantes nuevas: N/A
- [ ] Archivos nuevos no superan 300 lineas (businessMap util sera ~15 lineas)
- [ ] `logger.error` NUNCA dentro de `if (import.meta.env.DEV)`

### Checklist de observabilidad

- [ ] `fetchBusinessData` ya tiene o deberia tener `measureAsync` wrapper (coordinar con #303)
- [ ] Trigger `onCommentLikeCreated` ya tiene `trackFunctionTiming` (verificar)
- [ ] No hay nuevos eventos de trackEvent

### Checklist offline

- [ ] Lectura de commentLikes con campo `businessId` nuevo: si hay cache offline (IndexedDB readCache), el schema almacenado sigue siendo el mismo (comments + userCommentLikes como Set de IDs) — compatible
- [ ] Sin cambios en writes offline

### Checklist de documentacion

- [ ] `docs/reference/firestore.md` actualizado con nuevo campo `businessId` en `commentLikes`
- [ ] `docs/reference/patterns.md` actualizado con patron "singleton businessMap"
- [ ] `docs/reference/features.md` sin cambios (no hay feature nueva)
- [ ] `firestore.indexes.json` con nuevo indice compuesto

---

## Offline

### Data flows

| Operacion | Tipo (read/write) | Estrategia offline | Fallback UI |
|-----------|-------------------|-------------------|-------------|
| `fetchBusinessData` (incl. commentLikes) | read | 3-tier cache ya existente (memory → IndexedDB → Firestore) | StaleBanner |
| `createCommentLike` con `businessId` extra | write | withOfflineSupport existente (payload incluye businessId en meta) | Toast offline queue |

### Checklist offline

- [ ] Reads de Firestore: usan persistencia offline — sin cambios
- [ ] Writes: commentLikes ya tiene offline queue via `withOfflineSupport` — actualizar payload para incluir businessId
- [ ] APIs externas: N/A
- [ ] UI: sin cambios
- [ ] Datos criticos: schema compatible con readCache existente

### Esfuerzo offline adicional: S

---

## Modularizacion y % monolitico

- `businessMap` util es el patron correcto (no acoplado a contexto de layout)
- S1 reduce acoplamiento: stats barrel deja de ser "puerta de entrada de recharts"
- S3 reduce acoplamiento del admin bundle
- No se agrega UI a SideMenu/AppShell

### Checklist modularizacion

- [ ] Logica de negocio en services/utils, no en componentes
- [ ] `businessMap` util es reutilizable, sin acoplamiento a contextos
- [ ] No se agregan useState a AppShell/TabShell
- [ ] Props explicitas: N/A (no hay nuevas props)
- [ ] Cada prop de accion tiene handler real: N/A
- [ ] Ningun componente nuevo importa `firebase/firestore` directo (solo services)
- [ ] Archivos en `src/hooks/`: N/A
- [ ] Archivos nuevos <400 lineas
- [ ] Converters: N/A (no cambia, solo campo nuevo que se agrega al commentLikeConverter si existe)
- [ ] Archivos nuevos en carpeta correcta (`src/utils/`)
- [ ] Sin contexto nuevo
- [ ] Archivos nuevos <400 lineas

### Impacto en % monolitico

| Aspecto | Impacto | Justificacion |
|---------|---------|---------------|
| Acoplamiento de componentes | - | Stats barrel deja de arrastrar recharts a profile path |
| Estado global | = | No cambia |
| Firebase coupling | = | Sin cambios en patterns |
| Organizacion por dominio | = | `businessMap` en `utils/` junto a `businessHelpers` y `distance` |

---

## Accesibilidad y UI mobile

### Checklist de accesibilidad

- [ ] No se agregan IconButtons nuevos
- [ ] Suspense fallback en StatsView no regresiona accesibilidad (usa CircularProgress existente)
- [ ] Touch targets sin cambios

### Checklist de copy

- [ ] Sin copy nuevo
- [ ] Mensajes de error sin cambios

---

## Success Criteria

1. Bundle de Perfil (StatsView path) baja >=300KB gross (>=90KB gzip) — verificable con `npm run build` + analyze.
2. `fetchBusinessData` hace un solo round-trip de queries (no hay await secuencial despues del Promise.all) — verificable con test unitario que mockea Firestore y cuenta llamadas.
3. Admin `/admin` first-paint reduce bundle >=60KB — verificable con build analyze.
4. `SearchListView` con 40 businesses no re-renderiza BusinessRow al cambiar sortLocation si los valores no cambiaron — verificable con test de render count.
5. Tests nuevos cubren >=80% del codigo modificado y pasan en CI sin bajar coverage global.
