# Plan: Service Layer Refactor (#279)

**Specs:** [specs.md](specs.md)
**Fecha:** 2026-03-31

---

## Resumen

Cuatro fases independientes. Cada fase puede abrirse como PR separado en la misma branch o en branches separadas. Las fases no tienen dependencias entre sí.

---

## Fase 1: Migrar hooks a servicios existentes

**Branch:** `chore/279-service-layer-hooks-existing`

Cuatro hooks que delegan a servicios que ya existen. Solo se agregan funciones y se reescriben los hooks.

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `src/services/ratings.ts` | Agregar `fetchUserRatingsCount(userId): Promise<number>` usando `getCountOfflineSafe(query(collection(...), where('userId', '==', uid)))`. Agregar `hasUserRatedBusiness(userId, businessId): Promise<boolean>` usando `getDoc` por doc ID compuesto. |
| 2 | `src/services/favorites.ts` | Agregar `fetchUserFavoritesCount(userId): Promise<number>` usando `getCountOfflineSafe`. |
| 3 | `src/services/follows.ts` | Agregar `fetchFollowersCount(userId): Promise<number>` usando `getCountOfflineSafe` con `where('followedId', '==', uid)`. |
| 4 | `src/hooks/useProfileStats.ts` | Eliminar imports de `firebase/firestore`, `db`, `COLLECTIONS`, `getCountOfflineSafe`. Importar las 3 funciones count de los servicios. Reemplazar el `Promise.all` con las 3 funciones de servicio. |
| 5 | `src/hooks/useRatingPrompt.ts` | Eliminar `doc`, `getDoc` de `firebase/firestore`, `db`, `COLLECTIONS`. Importar `hasUserRatedBusiness` de `../services/ratings`. Reemplazar ambas ocurrencias de `getDoc(doc(db, COLLECTIONS.RATINGS, ratingDocId))` por `await hasUserRatedBusiness(user.uid, checkIn.businessId)` y `await hasUserRatedBusiness(user.uid, data.businessId)`. |
| 6 | `src/services/priceLevels.ts` | Agregar `fetchPriceLevelMap(maxDocs?: number): Promise<Map<string, number>>`. Mover la lógica de `fetchAllPriceLevels()` del hook al servicio, incluyendo el `withConverter`, groupBy y average. Agregar `MAX_PRICE_LEVELS = 20_000` como constante del servicio. |
| 7 | `src/hooks/usePriceLevelFilter.ts` | Eliminar imports de `firebase/firestore`, `db`, `priceLevelConverter`. Eliminar `MAX_PRICE_LEVELS` (ahora en el servicio). Importar `fetchPriceLevelMap` de `../services/priceLevels`. Reemplazar el cuerpo de `fetchAllPriceLevels()` por `return fetchPriceLevelMap()`. |
| 8 | `src/services/users.ts` | Agregar `fetchProfileVisibility(userIds: string[]): Promise<Map<string, boolean>>`. Mover la lógica de batches de 30 y el fallback a `false`. Usar `where(documentId(), 'in', batch)`. |
| 9 | `src/hooks/useProfileVisibility.ts` | Eliminar imports de `firebase/firestore`, `db`. Importar `fetchProfileVisibility` de `../services/users`. Reemplazar el cuerpo de `fetchVisibility()` (la lógica de batches) por una llamada a `fetchProfileVisibility(toFetch)` que devuelva el mapa y lo itere para poblar `visibilityCache`. |
| 10 | `src/hooks/useProfileStats.test.ts` | Crear archivo. Mockear `../services/ratings`, `../services/favorites`, `../services/follows`. Testear: counts correctos, reset cuando user es null, manejo de error (no crash). |
| 11 | `src/hooks/useRatingPrompt.test.ts` | Reemplazar `vi.mock('firebase/firestore')` y `vi.mock('../config/firebase')` por `vi.mock('../services/ratings', () => ({ hasUserRatedBusiness: mockHasRated, fetchMyCheckIns: ... }))`. Verificar que todos los tests existentes pasan. |
| 12 | `src/hooks/usePriceLevelFilter.test.ts` | Reemplazar mock de `firebase/firestore` por `vi.mock('../services/priceLevels', () => ({ fetchPriceLevelMap: mockFetchMap }))`. El comportamiento de cache/TTL/deduplication sigue siendo testeable pasando distintos valores del mock. Verificar que todos los tests existentes pasan. |
| 13 | `src/hooks/useProfileVisibility.test.ts` | Crear archivo. Mock `vi.mock('../services/users', () => ({ fetchProfileVisibility: mockFn }))`. Testear: TTL expirado refetch, usuarios no encontrados → false, pendingFetches evita duplicados. |

---

## Fase 2: Crear servicios nuevos y migrar hooks restantes

**Branch:** `chore/279-service-layer-hooks-new`

Dos hooks que necesitan servicios nuevos.

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `src/services/config.ts` | Crear archivo nuevo. Exportar `interface AppVersionConfig { minVersion: string \| undefined }` y `fetchAppVersionConfig(): Promise<AppVersionConfig>`. Usar `getDoc(doc(db, COLLECTIONS.CONFIG, 'appVersion'))`. Si el doc no existe o `minVersion` es undefined, devolver `{ minVersion: undefined }`. |
| 2 | `src/hooks/useForceUpdate.ts` | Eliminar imports de `doc`, `getDoc` de `firebase/firestore`, `db`, `COLLECTIONS`. Importar `fetchAppVersionConfig` de `../services/config`. En `checkVersion()`: reemplazar el bloque de `getDoc` + `snap.exists()` + `snap.data()` por `const { minVersion } = await fetchAppVersionConfig(); if (!minVersion) return 'up-to-date';`. Mantener exports `_checkVersion`, `_getReloadCount`, `_isReloadLimitReached`. |
| 3 | `src/services/metrics.ts` | Crear archivo nuevo. Exportar `fetchDailyMetrics(date: string): Promise<PublicMetrics \| null>`. Usar `getDoc(doc(db, COLLECTIONS.DAILY_METRICS, date).withConverter(publicMetricsConverter))`. Devolver `snap.data()` si existe, `null` si no. |
| 4 | `src/hooks/usePublicMetrics.ts` | Eliminar imports de `doc`, `getDoc` de `firebase/firestore`, `db`, `COLLECTIONS`, `publicMetricsConverter`. Importar `fetchDailyMetrics` de `../services/metrics`. Reemplazar la llamada `getDoc(...).then(snap => ...)` por `const metrics = await fetchDailyMetrics(today); if (!ignore) { setMetrics(metrics); setLoading(false); }`. |
| 5 | `src/hooks/useForceUpdate.test.ts` | Reemplazar `vi.mock('firebase/firestore')` + `vi.mock('../config/firebase')` por `vi.mock('../services/config', () => ({ fetchAppVersionConfig: mockGetConfig }))`. `mockGetConfig` devuelve `{ minVersion: '...' }` o `{ minVersion: undefined }` según el caso. Verificar que todos los tests existentes pasan. |
| 6 | `src/services/config.test.ts` | Crear archivo. Mock `firebase/firestore`. Testear: doc existente con minVersion, doc inexistente, doc sin campo minVersion, error de red. |
| 7 | `src/services/metrics.test.ts` | Crear archivo. Mock `firebase/firestore` y `../config/metricsConverter`. Testear: doc existente devuelve PublicMetrics, doc inexistente devuelve null, error de red lanzado. |
| 8 | `src/hooks/usePublicMetrics.test.ts` | Crear archivo. Mock `vi.mock('../services/metrics', () => ({ fetchDailyMetrics: mockFn }))`. Testear: happy path con datos, doc inexistente (metrics null, loading false, error false), error (error true, loading false), ignore pattern (unmount antes de resolución). |

---

## Fase 3: Descomponer archivos > 400 líneas

**Branch:** `chore/279-decompose-large-files`

Decomposición de páginas DEV-only. Sin cambios de comportamiento.

### ConstantsDashboard (563 → ~120 líneas)

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `src/pages/constants-dashboard/types.ts` | Crear. Exportar `type OverrideKey = \`${string}.${string}\`` y `type Overrides = Map<OverrideKey, unknown>`. |
| 2 | `src/pages/constants-dashboard/formatters.ts` | Crear. Extraer `formatValue()`, `formatMs()`, `detectSubtype()`. |
| 3 | `src/pages/constants-dashboard/validateConstant.ts` | Crear. Extraer `interface ValidationResult`, `function validate()`. Importar `formatMs` de `./formatters`. |
| 4 | `src/pages/constants-dashboard/ColorSwatch.tsx` | Crear. Extraer componente `ColorSwatch({ color })`. Solo el swatch cuadrado con `bgcolor`. |
| 5 | `src/pages/constants-dashboard/TypeBadge.tsx` | Crear. Extraer componente `TypeBadge({ type })`. |
| 6 | `src/pages/constants-dashboard/ConstantRow.tsx` | Crear. Extraer componente `ConstantRow`. Importar `ColorSwatch`, `TypeBadge`, `validateConstant`, `formatters`, `types`. |
| 7 | `src/pages/constants-dashboard/findDuplicates.ts` | Crear. Extraer función `findDuplicates()`. Importar `CONSTANT_MODULES` de `../constantsRegistry`. |
| 8 | `src/pages/ConstantsDashboard.tsx` | Reescribir: eliminar todo el código extraído, importar sub-componentes/funciones desde `./constants-dashboard/*`. Mantener solo estado (`searchQuery`, `activeModules`, `overrides`, `snackbar`), handlers y JSX del layout. |

### ThemePlayground (418 → ~100 líneas)

| Paso | Archivo | Cambio |
|------|---------|--------|
| 9 | `src/pages/theme-playground/colorUtils.ts` | Crear. Extraer `hexToHsl()`, `hslToHex()`, `generatePalette()`. |
| 10 | `src/pages/theme-playground/ColorSwatch.tsx` | Crear. Extraer `ColorSwatch({ label, color, onCopy })`. Importar `hexToHsl` de `./colorUtils`. |
| 11 | `src/pages/theme-playground/ColorInput.tsx` | Crear. Extraer `ColorInput({ label, value, onChange })`. |
| 12 | `src/pages/theme-playground/ComponentPreview.tsx` | Crear. Extraer `interface PreviewProps` y `ComponentPreview`. |
| 13 | `src/pages/theme-playground/outputTemplate.ts` | Crear. Extraer la función que genera el string `fullOutput` como `generateThemeOutput(colors: ThemeColors): string`. Definir `interface ThemeColors` con todos los colores. |
| 14 | `src/pages/ThemePlayground.tsx` | Reescribir: eliminar todo el código extraído, importar sub-componentes. Mantener solo estado de colores, `handleCopy`, `fullOutput` (llamando `generateThemeOutput`), layout de dos paneles y Snackbar. |

---

## Fase 4: Centralizar callables admin

**Branch:** `chore/279-admin-callable-centralization`

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `src/services/adminFeatured.ts` | Crear archivo nuevo. Mover `databaseId`, `toggleFeaturedFn` y `getPublicListsFn` callables. Exportar `fetchPublicLists(): Promise<SharedList[]>` con la lógica de transformación de fechas y `editorIds`. Exportar `toggleFeaturedList(listId: string, featured: boolean): Promise<void>`. |
| 2 | `src/components/admin/FeaturedListsPanel.tsx` | Eliminar imports de `httpsCallable`, `functions`, y el `databaseId` inline. Importar `fetchPublicLists`, `toggleFeaturedList` de `../../services/adminFeatured`. Reemplazar uso de callables inline por las funciones del servicio. La función `fetcher` pasa a `() => fetchPublicLists()`. El handler `handleToggle` usa `toggleFeaturedList(list.id, !list.featured)`. |
| 3 | `src/services/adminPhotos.ts` | Crear archivo nuevo. Exportar `approveMenuPhoto(photoId: string): Promise<void>`, `rejectMenuPhoto(photoId: string, reason: string): Promise<void>`, `deleteMenuPhoto(photoId: string): Promise<void>`. Cada función crea el callable y lo invoca internamente. |
| 4 | `src/components/admin/PhotoReviewCard.tsx` | Eliminar import de `httpsCallable`, `functions`. Importar las 3 funciones de `../../services/adminPhotos`. Reemplazar los bloques `const approve = httpsCallable(...)` por llamadas directas a las funciones del servicio. |
| 5 | `src/services/adminFeatured.test.ts` | Crear. Mock `firebase/functions`. Testear `fetchPublicLists` (transforma fechas correctamente, propaga error), `toggleFeaturedList` (llama callable con args correctos). |
| 6 | `src/services/adminPhotos.test.ts` | Crear. Mock `firebase/functions`. Testear que cada función llama el callable correcto con los args esperados. |

---

## Orden de implementacion

Las fases son independientes. Orden sugerido de menor a mayor riesgo:

1. **Fase 4** — Sin cambios en lógica. Solo mueve código de inicialización de callables.
2. **Fase 3** — Sin cambios en lógica. Solo decomposición de archivos DEV-only.
3. **Fase 1** — Migra lógica existente. Los tests deben pasar antes de mergear.
4. **Fase 2** — Crea servicios nuevos. Tests de los servicios nuevos son obligatorios.

---

## Estimacion de tamaño de archivos resultantes

| Archivo | Lineas actuales | Lineas estimadas post-refactor |
|---------|----------------|-------------------------------|
| `src/hooks/useProfileStats.ts` | 38 | ~30 |
| `src/hooks/useRatingPrompt.ts` | 231 | ~220 |
| `src/hooks/usePriceLevelFilter.ts` | 76 | ~45 |
| `src/hooks/useProfileVisibility.ts` | 108 | ~55 |
| `src/hooks/useForceUpdate.ts` | 170 | ~155 |
| `src/hooks/usePublicMetrics.ts` | 46 | ~30 |
| `src/services/ratings.ts` | 117 | ~150 |
| `src/services/favorites.ts` | 43 | ~60 |
| `src/services/follows.ts` | 87 | ~105 |
| `src/services/priceLevels.ts` | 50 | ~80 |
| `src/services/users.ts` | 75 | ~110 |
| `src/services/config.ts` | — (nuevo) | ~35 |
| `src/services/metrics.ts` | — (nuevo) | ~30 |
| `src/services/adminFeatured.ts` | — (nuevo) | ~45 |
| `src/services/adminPhotos.ts` | — (nuevo) | ~30 |
| `src/pages/ConstantsDashboard.tsx` | 563 | ~120 |
| `src/pages/ThemePlayground.tsx` | 418 | ~100 |
| `src/components/admin/FeaturedListsPanel.tsx` | 176 | ~155 |
| `src/components/admin/PhotoReviewCard.tsx` | 188 | ~170 |

Ningún archivo resultante supera 400 líneas.

---

## Riesgos

**1. Tests de `useForceUpdate` usan dynamic import con `vi.resetModules()`**

Los tests de `useForceUpdate` importan `_checkVersion` via `await import('./useForceUpdate')` porque el módulo tiene estado. Al cambiar el mock de `firebase/firestore` a `../services/config`, hay que asegurar que `vi.mock('../services/config')` se declare antes de cualquier import dinámico. Mitigacion: correr los tests después de cada cambio del test file antes de continuar.

**2. Cache module-level de `usePriceLevelFilter` se resetea entre tests via `vi.resetModules()`**

El hook actual usa `vi.resetModules()` en `beforeEach` para reiniciar el estado de cache. Con el refactor, el cache sigue en el hook, pero el fetch se delega. Los tests que verifican deduplicación de promesas seguirán funcionando porque el promise de deduplicación también está en el hook. Mitigacion: verificar explícitamente que `fetchPriceLevelMap` se llama una sola vez en el test de deduplicación.

**3. `useProfileVisibility` usa `useSyncExternalStore` — la firma del servicio debe ser async**

El hook llama `fetchVisibility()` fuera de un `useEffect` (en el cuerpo del hook, basándose en el snapshot). La función async retorna una Promise que se ignora intencionalmente. El servicio solo cambia quién hace el fetch — este patrón se mantiene. Mitigacion: ninguna adicional requerida.

---

## Guardrails de modularidad

- [x] Ningun componente nuevo importa `firebase/firestore` directamente
- [x] Archivos nuevos en carpeta de dominio correcta (`services/`, `pages/constants-dashboard/`, `pages/theme-playground/`)
- [x] Logica de negocio en hooks/services, no en componentes
- [x] Ningun archivo resultante supera 400 lineas (ver tabla de estimacion)
- [x] No se toca ningun barrel `index.ts` (los servicios nuevos se importan directamente)

## Guardrails de seguridad

- [x] Sin colecciones nuevas — no aplica `hasOnly()`
- [x] Sin campos nuevos — no aplica field whitelist
- [x] Sin secrets en archivos commiteados
- [x] `getCountOfflineSafe` usado en las funciones count (no `getCountFromServer` directo)
- [x] No hay nuevas superficies de ataque

## Guardrails de accesibilidad y UI

- [x] No hay componentes nuevos con elementos interactivos
- [x] No hay cambios en JSX visible al usuario

## Guardrails de copy

- [x] No hay textos nuevos visibles al usuario

---

## Fase final: Documentacion

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `docs/reference/patterns.md` | Agregar en la tabla "Service layer": `config.ts` y `metrics.ts` como servicios existentes. Mencionar `adminFeatured.ts` y `adminPhotos.ts`. |
| 2 | `docs/reference/architecture.md` | Sin cambios necesarios (el arbol de providers no cambia). |

---

## Criterios de done

- [x] Cero imports de `firebase/firestore` en los 6 hooks listados en el issue
- [x] Cero imports de `firebase/functions` en `FeaturedListsPanel.tsx` y `PhotoReviewCard.tsx`
- [x] `ConstantsDashboard.tsx` < 200 lineas
- [x] `ThemePlayground.tsx` < 150 lineas
- [x] Tests pasan (no regresiones en tests existentes de hooks migrados)
- [x] Tests nuevos para servicios nuevos (`config.ts`, `metrics.ts`, `adminFeatured.ts`, `adminPhotos.ts`)
- [x] Tests nuevos para hooks sin test (`useProfileStats`, `useProfileVisibility`, `usePublicMetrics`)
- [x] No lint errors (`npm run lint`)
- [x] Build succeeds (`npm run build`)
- [x] Docs actualizados (`docs/reference/patterns.md`)
