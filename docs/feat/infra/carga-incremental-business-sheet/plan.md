# Plan: Carga incremental en BusinessSheet

**Specs:** [specs.md](specs.md)
**Fecha:** 2026-03-27

---

## Fases de implementacion

### Fase 1: Hook — carga en dos fases

**Branch:** `feat/incremental-business-sheet`

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `src/constants/analyticsEvents.ts` | Agregar `EVT_BUSINESS_SHEET_PHASE1`, `EVT_BUSINESS_SHEET_PHASE2`, `EVT_BUSINESS_SHEET_CACHE_HIT` |
| 2 | `src/hooks/useBusinessData.ts` | Agregar state `isLoadingComments` con `useState<boolean>(false)` |
| 3 | `src/hooks/useBusinessData.ts` | Crear funcion `fetchBusinessDataPhased(bId, uid, onPhase1)` que ejecuta fase 1 (favorites, ratings, userTags, customTags, priceLevels, menuPhotos) en `Promise.all`, llama `onPhase1` con resultado parcial, luego ejecuta fase 2 (comments + fetchUserLikes) y retorna resultado completo |
| 4 | `src/hooks/useBusinessData.ts` | Refactorizar `load` callback: medir `startTime = Date.now()` al inicio. En cache hit: `setIsLoadingComments(false)` y emitir `trackEvent(EVT_BUSINESS_SHEET_CACHE_HIT, { business_id: bId })`. En cache miss: `setIsLoadingComments(true)`, llamar `fetchBusinessDataPhased` con `onPhase1` callback que (a) verifica `fetchIdRef.current === id`, (b) mergea con patchedRef, (c) llama `setData`, (d) `setIsLoading(false)`, (e) emite `trackEvent(EVT_BUSINESS_SHEET_PHASE1, ...)` |
| 5 | `src/hooks/useBusinessData.ts` | En `load`, al completar fase 2: verificar `fetchIdRef.current === id`, mergear con patchedRef (ahora cubriendo tambien colecciones patcheadas durante fase 2), llamar `setData(fullResult)`, `setIsLoadingComments(false)`, `setBusinessCache(bId, fullResult)`, emitir `trackEvent(EVT_BUSINESS_SHEET_PHASE2, ...)` |
| 6 | `src/hooks/useBusinessData.ts` | Manejar error de fase 2: si fase 2 falla pero fase 1 ya resolvio, `setIsLoadingComments(false)`, `setError(true)`. Los datos de fase 1 permanecen visibles |
| 7 | `src/hooks/useBusinessData.ts` | Actualizar `EMPTY` constant: agregar `isLoadingComments: false` |
| 8 | `src/hooks/useBusinessData.ts` | Actualizar `UseBusinessDataReturn` interface: agregar `isLoadingComments: boolean` |
| 9 | `src/hooks/useBusinessData.ts` | Actualizar return: incluir `isLoadingComments` |
| 10 | `src/hooks/useBusinessData.ts` | Agregar import de `trackEvent` y los tres `EVT_*` constants |

### Fase 2: UI — render inmediato y skeletons por seccion

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `src/components/business/BusinessSheet.tsx` | Eliminar import de `BusinessSheetSkeleton` |
| 2 | `src/components/business/BusinessSheet.tsx` | Agregar import de `Skeleton` de `@mui/material` (ya importado Box, Divider, etc.) |
| 3 | `src/components/business/BusinessSheet.tsx` | Eliminar `const showSkeleton = data.isLoading;` |
| 4 | `src/components/business/BusinessSheet.tsx` | Reestructurar JSX: reemplazar el ternario `{showSkeleton ? <BusinessSheetSkeleton /> : <Box ...>...</Box>}` con renderizado directo del `<Box>` siempre. El header (BusinessHeader + CheckInButton) se renderiza siempre. FavoriteButton sigue recibiendo `isLoading={data.isLoading}` |
| 5 | `src/components/business/BusinessSheet.tsx` | Envolver BusinessRating con ternario: `{data.isLoading ? <RatingSkeleton> : <BusinessRating .../>}` donde `<RatingSkeleton>` es `<><Skeleton variant="text" width="50%" height={24} /><Skeleton variant="text" width="40%" height={20} sx={{ mt: 0.5 }} /></>` |
| 6 | `src/components/business/BusinessSheet.tsx` | Envolver BusinessPriceLevel con ternario: `{data.isLoading ? <Skeleton variant="text" width="45%" height={24} /> : <BusinessPriceLevel .../>}` |
| 7 | `src/components/business/BusinessSheet.tsx` | Envolver BusinessTags con ternario: `{data.isLoading ? <Box sx={{ display: 'flex', gap: 1 }}><Skeleton variant="rounded" width={60} height={28} /><Skeleton variant="rounded" width={60} height={28} /><Skeleton variant="rounded" width={60} height={28} /></Box> : <BusinessTags .../>}` |
| 8 | `src/components/business/BusinessSheet.tsx` | Envolver MenuPhotoSection con ternario: `{data.isLoading ? <Skeleton variant="rectangular" width="100%" height={80} sx={{ borderRadius: 1 }} /> : <MenuPhotoSection .../>}` |
| 9 | `src/components/business/BusinessSheet.tsx` | Cambiar `isLoading` de BusinessComments y BusinessQuestions: reemplazar `isLoading={data.isLoading}` con `isLoading={data.isLoadingComments}` |
| 10 | `src/components/business/BusinessSheet.tsx` | Envolver tabs + comments/questions con ternario: `{data.isLoadingComments ? <><Skeleton variant="text" width="90%" height={18} /><Skeleton variant="text" width="90%" height={18} sx={{ mt: 0.5 }} /></> : <><Tabs .../>...</>}` |
| 11 | `src/components/business/BusinessSheet.tsx` | Mantener la animacion fadeIn en el Box wrapper, pero excluir el header (que aparece instantaneo). Mover el `@keyframes fadeIn` al Box que envuelve las secciones post-header |

### Fase 3: Tests

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `src/hooks/useBusinessData.test.ts` | Crear archivo de test. Setup: mock firebase, collections, converters, auth, cache, analytics |
| 2 | `src/hooks/useBusinessData.test.ts` | Test: "returns EMPTY when businessId is null" |
| 3 | `src/hooks/useBusinessData.test.ts` | Test: "cache hit — sets all data immediately, isLoading and isLoadingComments false, emits cache_hit event" |
| 4 | `src/hooks/useBusinessData.test.ts` | Test: "cold cache — phase 1 resolves first: isLoading becomes false, isLoadingComments stays true, data has ratings/favorites/tags/priceLevels/menuPhoto but empty comments" |
| 5 | `src/hooks/useBusinessData.test.ts` | Test: "cold cache — phase 2 resolves: isLoadingComments becomes false, data has comments and userCommentLikes, setBusinessCache called with full data" |
| 6 | `src/hooks/useBusinessData.test.ts` | Test: "phase 2 failure — phase 1 data preserved, error is true, isLoadingComments is false" |
| 7 | `src/hooks/useBusinessData.test.ts` | Test: "businessId change during load — stale phases discarded via fetchIdRef" |
| 8 | `src/hooks/useBusinessData.test.ts` | Test: "partial refetch during phase 1 — patchedRef preserves refetched collection in phase 1 merge" |
| 9 | `src/hooks/useBusinessData.test.ts` | Test: "refetch('comments') works independently of phased loading" |
| 10 | `src/hooks/useBusinessData.test.ts` | Test: "analytics — emits phase1_ms and phase2_ms with duration on cold cache" |

### Fase 4: Cleanup

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `src/components/business/BusinessSheetSkeleton.tsx` | Eliminar archivo (sin consumidores) |
| 2 | `src/components/business/BusinessSheet.tsx` | Verificar que no queden imports de BusinessSheetSkeleton |

---

## Orden de implementacion

1. `src/constants/analyticsEvents.ts` — agregar EVT constants (sin dependencias)
2. `src/hooks/useBusinessData.ts` — refactorizar con fases + isLoadingComments + analytics (depende de paso 1)
3. `src/components/business/BusinessSheet.tsx` — render inmediato + skeletons por seccion (depende de paso 2)
4. `src/hooks/useBusinessData.test.ts` — tests del hook refactorizado (depende de paso 2)
5. `src/components/business/BusinessSheetSkeleton.tsx` — eliminar (depende de paso 3)

Los pasos 3 y 4 pueden ejecutarse en paralelo.

---

## Riesgos

1. **Flickering en transicion fase 1 a fase 2:** Si fase 2 resuelve muy rapido (< 50ms despues de fase 1), el usuario podria ver un flash del skeleton de comentarios. **Mitigacion:** En la practica, fase 2 siempre tarda mas que fase 1 (comments es la query mas pesada). Si se detecta flickering en QA, se puede agregar un `minLoadingTime` de 200ms al skeleton de comments.

2. **Regresion en componentes hijos que asumen `isLoading` cubre todo:** Si algun componente hijo usa `isLoading` para decidir si mostrar un estado "sin datos" (ej: "No hay comentarios"), y ahora recibe `isLoadingComments`, la semantica es la misma. Pero hay que verificar que BusinessComments y BusinessQuestions no tengan logica que dependa de `isLoading` para ocultar elementos antes de que comments cargue. **Mitigacion:** Revisar el uso de `isLoading` en BusinessComments (linea 349: muestra "..." en count, linea 445: condiciona mensaje vacio). Ambos ya usan el patron correcto y funcionaran con `isLoadingComments`.

3. **Performance de dos `Promise.all` vs uno:** Separar en dos fases agrega un await secuencial (fase 1 completa, luego arranca fase 2). Esto podria aumentar ligeramente el tiempo total si todas las queries son rapidas. **Mitigacion:** El objetivo no es reducir tiempo total sino mejorar Time to Interactive. El header se muestra inmediatamente y las secciones rapidas aparecen antes, mejorando la percepcion del usuario.

---

## Criterios de done

- [ ] Al abrir BusinessSheet con cache frio, el header se muestra inmediatamente (< 100ms)
- [ ] Las secciones de rating, tags, precio y foto se renderizan al completar fase 1
- [ ] La seccion de comentarios muestra skeleton independiente mientras carga fase 2
- [ ] Con cache caliente, toda la data aparece de una vez (comportamiento identico al actual)
- [ ] `isLoadingComments` expuesto por `useBusinessData` y consumido por BusinessSheet
- [ ] Analytics: `business_sheet_phase1_ms`, `business_sheet_phase2_ms`, `business_sheet_cache_hit` emitidos correctamente
- [ ] Tests de `useBusinessData` cubren flujos de dos fases con >= 80% cobertura
- [ ] No lint errors
- [ ] Build succeeds
- [ ] BusinessSheetSkeleton eliminado (sin consumidores)
