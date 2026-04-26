# PRD: Tech debt: performance — allBusinesses lookups x16, lazy <img> x3, MUI chunk split, firebase/storage lazy

**Feature:** 324-performance-bundle-business-lookup
**Categoria:** infra
**Fecha:** 2026-04-25
**Issue:** #324
**Prioridad:** Alta

---

## Contexto

El health-check 2026-04-25 del performance agent identifico una regresion del guard #302 (performance) en 14 callsites con `allBusinesses.find()` (rule `R4`) + 2 callsites con `new Map(allBusinesses.map(...))` (rule `R-newMap-allBusinesses`) en vez de `getBusinessMap()`/`getBusinessById()`, mas 3 `<img>` en `MenuPhotoSection`/`MenuPhotoViewer`/`MenuPhotoUpload` sin `loading="lazy"`/`decoding="async"` (rule `R6`), y dos manualChunks en `vite.config.ts` que violan reglas R7 y R8 (MUI icons no separado del core; `firebase/storage` sigue en el chunk critico de firebase, agravado por 4 consumers eager que requieren refactor a dynamic import). Bundle inicial actual ~1.6 MB raw, target <= 1 MB raw / <= 700 KB gzipped.

Este issue es el **followup directo de #302**: las reglas R4/R6/R7/R8 del guard `docs/reference/guards/302-performance.md` ya estaban escritas, pero no se enforzan automaticamente y nuevos features (#306 BusinessScopeContext, hooks nuevos como `useRatingPrompt`, `useNavigateToBusiness`, `useBusinessById`) re-introdujeron el patron O(n).

## Problema

- **14 callsites con `allBusinesses.find((b) => b.id === id)`** — viola R4 del guard #302. Cada lookup es O(n) sobre 40 comercios. En listas (FavoritesList, RatingsList, ReceivedRecommendations, ListDetailScreen, useCommentsListFilters) el find() corre dentro de un map() — O(n*m). El singleton `getBusinessMap()` ya existe en `src/utils/businessMap.ts` con tests, pero no se esta usando.
- **2 callsites con `new Map(allBusinesses.map(...))`** — viola `R-newMap-allBusinesses` del guard #302. En `useLocalTrending.ts:40` y `RankingsView.tsx:38` se reconstruye un Map en cada render (RankingsView no usa `useMemo`) cuando podrian consumir el singleton.
- **3 `<img>` sin `loading="lazy"` ni `decoding="async"`** en `MenuPhotoSection.tsx:82`, `MenuPhotoViewer.tsx:78` y `MenuPhotoUpload.tsx:129` — viola R6. La foto de menu del business sheet entra en el LCP path en 3G aunque no este above-the-fold cuando el sheet esta cerrado; el viewer modal decodifica sincronamente; el preview del upload tampoco difiere.
- **MUI chunk monolitico de 474 KB** mezcla `@mui/material` (critical-path, ~150 KB) con `@mui/icons-material` (~250-300 KB, los icons son inline SVG por componente y no son critical-path) — viola R7. Separarlos permite diferir la carga de icons.
- **`firebase/storage` (~40-60 KB) en el chunk critico de firebase** — viola R8, **agravado** porque los 4 consumers (`firebase.ts:12` singleton, `feedback.ts:5`, `menuPhotos.ts:5`, `PhotoReviewCard.tsx:4`) son **eager** hoy. Sacar `storage` del manualChunk solo tiene efecto si los 4 consumers se refactorizan a dynamic import.
- **Medium: 7 queries `getDocs` sin `limit()`** — riesgo de billing DoS si las colecciones crecen. Hits del scan: `services/specials.ts:14,31`, `services/achievements.ts:14,23`, `services/follows.ts:81`, `services/sharedLists.ts:87,131,178,204`. De estos hits, **7 son user-callable y se cappean** en S4: `fetchSpecials`, `fetchActiveSpecials`, `fetchAchievements`, `saveAllAchievements` (existingSnap), `fetchUserLists`, `fetchSharedWithMe`, `fetchListItems`. **Excluidos del conteo de 7**: `deleteList` (mantiene sin `limit()` — cascade delete necesita todos los items, justificado en S4) y `fetchFollowersCount` (usa `getCountOfflineSafe` server-side, no es `getDocs` materializado, no aplica `limit`). Los specials/achievements son admin-managed (cap natural), pero las listas pueden crecer linealmente con el uso.
- **Medium: `firebase` chunk size** — derivado del problema de storage; al sacar storage se reduce el chunk a ~390 KB.
- **Low: chunk `index-BuuweED0` de 296 KB sin identificar** — necesita inspeccion via `npm run analyze` para entender que esta colapsando. Posible candidato a manualChunks o lazy split.
- **Low: srcset/responsive variants** para menu photos — fuera de scope inmediato pero dejado para el roadmap.

## Solucion

### S1 — Migrar callsites a `getBusinessById()` / `getBusinessMap()`

Para los lookups simples por id, usar `getBusinessById(id)` (helper exportado de `src/utils/businessMap.ts`). Para iteraciones que necesiten el Map crudo, usar `getBusinessMap()`. Sin construir Maps locales y sin appendear nuevos exports al singleton.

**Nota sobre iteraciones puras**: las iteraciones que solo usan `allBusinesses.map(...)` para iterar sin lookup por id (ej: `useSuggestions.ts:66`) **no se tocan** — el rule `R-newMap-allBusinesses` solo apunta a casos donde se construye un Map o un Set para hacer lookup. Solo se migran lookups por id.

**Hidratacion del singleton**: el singleton `businessMap` se hidrata desde `BusinessesProvider` u origen equivalente. Si un caller corre antes de la hidratacion, `getBusinessMap()` retorna un Map vacio y `getBusinessById()` retorna `undefined`. Los hooks consumidores deben manejar el caso `undefined` graciosamente (no asumir mapa poblado). Tests deben cubrir este path (ver seccion Tests).

Callsites a migrar (lookup por id — viola `R4-allBusinesses-find`):

| # | Archivo | Linea | Patron actual | Patron objetivo |
|---|---------|-------|---------------|-----------------|
| 1 | `src/hooks/useDeepLinks.ts` | 26 | `allBusinesses.find((b) => b.id === bizId)` | `getBusinessById(bizId)` |
| 2 | `src/hooks/useDeepLinks.ts` | 51 | `allBusinesses.find((b) => b.id === lastBusinessId)` | `getBusinessById(lastBusinessId)` |
| 3 | `src/hooks/useNavigateToBusiness.ts` | 20 | `allBusinesses.find((b) => b.id === businessOrId)` | `getBusinessById(businessOrId)` |
| 4 | `src/hooks/useBusinessById.ts` | 14 | `allBusinesses.find((b) => b.id === id)` | `getBusinessById(id)` |
| 5 | `src/hooks/useRatingPrompt.ts` | 217 | `allBusinesses.find((b) => b.id === promptData.businessId)` | `getBusinessById(promptData.businessId)` |
| 6 | `src/hooks/useSuggestions.ts` | 84 | `allBusinesses.find((b: Business) => b.id === fav.businessId)` | `getBusinessById(fav.businessId)` |
| 7 | `src/hooks/useVisitHistory.ts` | 63 | `allBusinesses.find((b) => b.id === v.businessId)` | `getBusinessById(v.businessId)` |
| 8 | `src/hooks/useCommentsListFilters.ts` | 48 | `allBusinesses.find((b) => b.id === data.businessId)` | `getBusinessById(data.businessId)` |
| 9 | `src/components/lists/FavoritesList.tsx` | 58 | `allBusinesses.find((b) => b.id === data.businessId)` | `getBusinessById(data.businessId)` |
| 10 | `src/components/lists/ListDetailScreen.tsx` | 213 | `allBusinesses.find((b) => b.id === item.businessId)` | `getBusinessById(item.businessId)` |
| 11 | `src/components/social/ReceivedRecommendations.tsx` | 65 | `allBusinesses.find((b) => b.id === rec.businessId)` | `getBusinessById(rec.businessId)` |
| 12 | `src/components/social/ReceivedRecommendations.tsx` | 100 | `allBusinesses.find((b) => b.id === rec.businessId)` | `getBusinessById(rec.businessId)` |
| 13 | `src/components/profile/RatingsList.tsx` | 41 | `allBusinesses.find((b) => b.id === data.businessId)` | `getBusinessById(data.businessId)` |
| 14 | `src/utils/businessHelpers.ts` | 5 | `allBusinesses.find((b) => b.id === id)?.name ?? id` | `getBusinessById(id)?.name ?? id` |

Callsites a migrar (Map/Set construido a partir de `allBusinesses` — viola `R-newMap-allBusinesses`):

| # | Archivo | Linea | Patron actual | Patron objetivo |
|---|---------|-------|---------------|-----------------|
| 15 | `src/hooks/useLocalTrending.ts` | 40 | `new Map(allBusinesses.map((b) => [b.id, { lat: b.lat, lng: b.lng }]))` | Iterar sobre `getBusinessMap().values()` y proyectar `{ lat, lng }`, o consumir `getBusinessById(id)` dentro del loop existente |
| 16 | `src/components/social/RankingsView.tsx` | 38 | `new Map(allBusinesses.map((b) => [b.id, b]))` | `getBusinessMap()` (drop-in: mismo shape `Map<string, Business>`). Tambien hoy se reconstruye en cada render — eliminar `useMemo` redundante |

Ambos callsites adicionales (15, 16) son detectados por el rule `302/R-newMap-allBusinesses` del guard runner. Si no se migran, `npm run guards --guard 302` queda rojo y bloquea el merge.

**Caso especial — `useRatingPrompt.ts:120`**: usa `new Set(allBusinesses.map((b) => b.id))` para `allBizIds`. Reemplazar por `getBusinessMap()` directamente: `getBusinessMap().has(checkIn.businessId)` en el loop de check-ins.

**No-append**: ningun callsite agrega exports nuevos al modulo `businessMap.ts`. Solo se cambia el callsite.

### S2 — Lazy + async decode en `<img>` de menu photo

El rule `302/R6-img-without-lazy` del guard runner **no distingue por origen** (preview local vs imagen remota): cualquier `<img>` sin `loading="lazy" decoding="async"` queda flaggeado. El grep `<img` en `src/components/` con `--include="*.tsx"` devuelve **3 hits**, no 2. Todos requieren los atributos:

- `src/components/business/MenuPhotoSection.tsx:82` — thumbnail ~200px de alto, imagen remota. Agregar `loading="lazy" decoding="async"` y dimensiones HTML `width={400} height={200}` para reservar layout. Mantener `objectFit: 'cover'`.
- `src/components/business/MenuPhotoViewer.tsx:78` — viewer fullscreen modal, imagen remota. No es above-the-fold. Agregar `loading="lazy" decoding="async"`. Dimensiones intrinsecas no aplican (objectFit contain), pero los atributos siguen ayudando al layout reserve.
- `src/components/business/MenuPhotoUpload.tsx:129` — preview local del archivo seleccionado (FileReader/`URL.createObjectURL`). Aunque sea preview, el guard no distingue origen y va a flaggearlo igualmente. Agregar `loading="lazy" decoding="async"` + dimensiones explicitas. La excepcion `loading="eager"` solo se documenta si el `<img>` es above-the-fold critico (hero/LCP) — no es el caso aqui (esta dentro del dialog de upload, post-interaccion).

**No usar excepcion `loading="eager"`** en ninguno de los 3: ninguno es hero ni LCP critico.

### S3 — Split MUI chunk + refactor de `firebase/storage` a lazy dinamico

#### S3.a — Split MUI chunk: `mui-core` + `mui-icons`

`vite.config.ts:117-122`, modificar `manualChunks`:

```ts
manualChunks: {
  firebase: ['firebase/app', 'firebase/auth', 'firebase/firestore'],
  'mui-core': ['@mui/material', '@mui/system'],
  'mui-icons': ['@mui/icons-material'],
  recharts: ['recharts'],
  'google-maps': ['@vis.gl/react-google-maps'],
}
```

`mui-core` + `mui-icons` separados — el bundler emite dos chunks distintos y los icons se cargan cuando algun componente que los importa se carga. La mayoria de icons aparecen en menus desplegables, dialogs e interacciones — no critical-path.

#### S3.b — Refactor de `firebase/storage` a lazy dinamico (4 consumers)

**Premisa corregida**: contrario a lo que afirmaba la version inicial del PRD, los consumers de `firebase/storage` **son todos eager** hoy. Sacar `firebase/storage` del `manualChunks` SIN refactorizar los imports **no produce ningun efecto** — Rollup colapsa el modulo igualmente al chunk principal porque hay imports eager en el grafo. Por eso la decision es **(a) refactorizar los 4 consumers a dynamic import como parte de este feature**, y solo despues quitar la entrada del manualChunks.

Consumers eager actuales:

| # | Archivo | Linea | Import actual |
|---|---------|-------|---------------|
| 1 | `src/config/firebase.ts` | 12 | `import { getStorage, connectStorageEmulator } from 'firebase/storage'` + `export const storage = getStorage(app)` (singleton eager) |
| 2 | `src/services/feedback.ts` | 5 | `import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'` |
| 3 | `src/services/menuPhotos.ts` | 5,8 | `import { ref, uploadBytesResumable, getDownloadURL, type UploadTask } from 'firebase/storage'` |
| 4 | `src/components/admin/PhotoReviewCard.tsx` | 4 | `import { ref, deleteObject } from 'firebase/storage'` (admin esta lazy a nivel ruta, pero el import eager ata el modulo al chunk principal) |

**Refactor por consumer:**

- **`src/config/firebase.ts`**: el cambio especial. Hoy expone `storage` como const singleton. Migrar a una funcion async `getStorageLazy()` que importa y cachea internamente:

  ```ts
  let _storage: import('firebase/storage').FirebaseStorage | null = null
  export async function getStorageLazy() {
    if (_storage) return _storage
    const { getStorage, connectStorageEmulator } = await import('firebase/storage')
    _storage = getStorage(app)
    if (USE_EMULATORS) connectStorageEmulator(_storage, '127.0.0.1', 9199)
    return _storage
  }
  ```

  Auditar todos los importadores de `storage` (la const) y migrarlos a `await getStorageLazy()` en el path donde realmente se necesita el upload/delete.

- **`src/services/feedback.ts`**: mover el `import` al cuerpo de la funcion que sube el archivo (al submit del feedback). Ejemplo:

  ```ts
  export async function submitFeedback(...) {
    const { ref, uploadBytes, getDownloadURL } = await import('firebase/storage')
    const storage = await getStorageLazy()
    // ...
  }
  ```

- **`src/services/menuPhotos.ts`**: idem — `await import('firebase/storage')` dentro de la funcion que ejecuta el upload (al submit de la foto). El tipo `UploadTask` se importa con `import type` (no contribuye al bundle runtime), o se infiere por el return de `uploadBytesResumable`.

- **`src/components/admin/PhotoReviewCard.tsx`**: `await import('firebase/storage')` dentro del handler que dispara el delete (al click de revisar/eliminar).

#### S3.c — Quitar `firebase/storage` del manualChunk

**Solo despues** de que los 4 consumers de S3.b sean lazy. Si se hace antes, Rollup no tiene impacto y la `firebase` chunk sigue incluyendo storage. Verificacion: `dist/stats.html` post-build debe mostrar `firebase/storage` en un chunk async (cargado on-demand) y NO en el chunk `firebase` critico.

**Esfuerzo**: S3.b sube el esfuerzo total de S3 a **M-grande** (toca 4 archivos + singleton + audit de importadores indirectos). S3.a y S3.c son XS cada uno.

### S4 — `limit()` en getDocs sin paginar (medium)

Agregar `limit()` con caps razonables a las **7 queries** sin pagination que materializan documentos:

| # | Service | Funcion | Cap propuesto | Justificacion |
|---|---------|---------|---------------|---------------|
| 1 | `services/specials.ts` (linea 14) | `fetchSpecials` | `limit(50)` | Admin-managed, cap natural pequeno |
| 2 | `services/specials.ts` (linea 31) | `fetchActiveSpecials` | `limit(20)` | Solo activos, user-facing |
| 3 | `services/achievements.ts` (linea 14) | `fetchAchievements` | `limit(100)` | Definiciones admin-managed |
| 4 | `services/achievements.ts` (linea 23) | `saveAllAchievements` (existingSnap) | `limit(100)` | Cleanup defensivo |
| 5 | `services/sharedLists.ts` (linea 87) | `fetchUserLists` | `limit(100)` | Cap razonable; rate limit ya impone 10/dia (#289) |
| 6 | `services/sharedLists.ts` (linea 131) | `fetchSharedWithMe` | `limit(100)` | Cap razonable |
| 7 | `services/sharedLists.ts` (linea 178) | `fetchListItems` | `limit(500)` | Hard cap por lista — Firestore batch limit |

**Excluidas del conteo de 7** (no se cappean):

| Service | Funcion | Razon |
|---------|---------|-------|
| `services/sharedLists.ts` (linea 204) | `deleteList` (itemsSnap) | Cascade delete necesita todos los items — documentar comentario inline justificando la excepcion |
| `services/follows.ts` (linea 81) | `fetchFollowersCount` | Usa `getCountOfflineSafe` con server-side count — no es `getDocs` materializado, `limit()` no aplica |

### S5 — Investigar chunk `index-BuuweED0` (296 KB) — low priority

Ejecutar `ANALYZE=1 npm run build` (o `npm run analyze` si existe) para ver el contenido del segundo chunk `index-*`. Si es codigo de admin, separar via manualChunk. Si es duplicado del main entry, investigar imports cruzados. Documentar finding en specs.

---

## Baseline numerico (pre-#324)

Medido con `npx vite build` el 2026-04-25 (snapshot pre-implementacion). Comando de reproduccion: `npx vite build` y leer la tabla de chunks emitidos en stdout. Verificacion visual via `dist/stats.html` (`rollup-plugin-visualizer`).

### Tamanos actuales por chunk

| Chunk | Raw | Gzipped |
|-------|-----|---------|
| `mui` (monolitico, core + icons) | 474 KB | ~146 KB |
| `firebase` (incluye storage) | 449 KB | ~140 KB |
| `index-CK_zEjci` (entry principal) | 438 KB | ~149 KB |
| `recharts` | 366 KB | ~110 KB |
| `index-BuuweED0` (huerfano) | 296 KB | ~98 KB |

Total bundle inicial (suma de chunks que entran en el critical path): ~1.6 MB raw / ~640 KB gzipped (orientativo — depende de que chunks resuelve el browser en la primera carga).

### Targets post-#324

| Chunk / metrica | Target | Mecanismo |
|-----------------|--------|-----------|
| `mui-core` | <= 200 KB raw | Split MUI: separar icons (S3.a) |
| `mui-icons` | (separado, lazy) | Carga on-demand cuando un componente que lo importa se monta (S3.a) |
| `firebase` | <= 350 KB raw | Sacar `firebase/storage` del chunk critico (S3.b + S3.c) |
| Bundle inicial total | <= 1 MB raw / <= 700 KB gzipped | Combinacion de S3 + S5 si aplica |

### Verificacion

Post-merge, `npx vite build` debe reportar chunks dentro de los targets. CI puede archivar el output como artifact para verificacion automatica. Ver Success Criteria #2 y #3.

## UX considerations

Este feature es 100% perf y no cambia ningun flow visible para el usuario. Beneficios percibidos:

- TTI mas rapido en redes lentas (target -300/-500ms en 3G por bundle reducido).
- Listas largas (FavoritesList, RatingsList, ReceivedRecommendations con N>=20 items) sentiran scroll mas fluido por O(1) lookups.
- Menu photos: en 3G no bloquean el render del business sheet header (lazy + async decode).

---

## Scope

| Item | Prioridad | Esfuerzo |
|------|-----------|----------|
| S1 — 16 callsites a `getBusinessById` / `getBusinessMap` (14 lookups por id + 2 Maps construidos + caso especial Set en `useRatingPrompt`) | Alta | M |
| S2 — `loading="lazy"` + `decoding="async"` + dimensiones en 3 `<img>` | Alta | XS |
| S3.a — Split MUI chunk (`mui-core` + `mui-icons`) | Alta | XS |
| S3.b — Refactor de 4 consumers de `firebase/storage` a dynamic import (incluye migrar singleton de `firebase.ts`) | Alta | M-grande |
| S3.c — Drop `firebase/storage` del manualChunk + verificar via `dist/stats.html` | Alta | XS |
| S4 — `limit()` en 7 queries sin paginar (specials/achievements/sharedLists; `deleteList` y `fetchFollowersCount` excluidos del conteo) | Media | S |
| S5 — Investigar `index-BuuweED0` 296 KB (post S2+S3 para no medir ruido) | Baja | S |
| Tests unitarios para callsites no cubiertos + path de hidratacion (mapa vacio) | Alta | S |
| Bundle baseline + verificacion post-cambio (verificable via `npm run guards` y `npx vite build`) | Alta | XS |

**Esfuerzo total estimado:** M-grande (subio respecto al M original por S3.b)

---

## Out of Scope

- `srcset` / responsive variants para menu photos (item Low #8) — requiere generar variantes en el upload pipeline y guardar paths en Firestore. Issue separado.
- Audit de `AuthContext` consumers (item Medium #6) — el split state/actions ya esta implementado (#247). Auditar consumers que solo necesitan state vs actions excede el alcance de este issue de bundle/lookup.
- Migrar paginated queries existentes a `usePaginatedQuery` cuando ya tienen su propio cursor manual (ej: `fetchFollowing`).
- Pre-compresion de imagenes en upload (compression ya existe via `browser-image-compression`).

---

## Tests

Politica del proyecto: cobertura >= 80% en codigo modificado. La mayoria de cambios son refactor (sustitucion mecanica) — los tests existentes deben seguir pasando sin modificacion. Casos donde se requiere actualizar tests:

### Archivos que necesitaran tests

| Archivo | Tipo | Que testear |
|---------|------|-------------|
| `src/utils/businessHelpers.test.ts` | Unit (existente) | Verificar que `getBusinessName` sigue retornando id si no se encuentra (mockear `__resetBusinessMap()` en `beforeEach`) |
| `src/hooks/useBusinessById.test.ts` | Unit (nuevo o actualizar) | Status `found` / `not_found` / `invalid_id` con `getBusinessById` |
| `src/hooks/useSuggestions.test.ts` | Unit (existente) | Que el scoring de categorias siga funcionando despues del swap |
| `src/hooks/useDeepLinks.test.ts` | Unit (nuevo si no existe) | Deep link `?business=biz_001` selecciona biz; `?business=invalid` no navega |
| `src/hooks/useRatingPrompt.test.ts` | Unit (existente) | Set lookup `getBusinessMap().has(...)` filtra check-ins de comercios desconocidos |
| `src/hooks/useVisitHistory.test.ts` | Unit (nuevo) | `visitsWithBusiness` resuelve `business: null` para id desconocido |
| `src/hooks/useCommentsListFilters.test.ts` | Unit (nuevo) | Filter por business resuelve via singleton; comments con businessId desconocido tienen `business: null` |
| `src/components/business/MenuPhotoSection.test.tsx` | Unit (nuevo o actualizar) | El `<img>` renderizado tiene `loading="lazy"` y `decoding="async"` |
| `src/components/business/MenuPhotoViewer.test.tsx` | Unit (nuevo) | Idem |
| `vite.config.ts` | N/A | Verificable via `npm run guards --guard 302` (rules R7/R8) + `npx vite build` para confirmar tamanos de chunks (no requiere test unitario) |
| `src/services/specials.test.ts` | Unit (nuevo) | `fetchActiveSpecials` aplica `limit(20)` (verificar via mock de `query`) |
| `src/services/achievements.test.ts` | Unit (nuevo) | Idem para `fetchAchievements` |
| `src/services/sharedLists.test.ts` | Unit (existente) | Agregar caso para `fetchUserLists` con `limit(100)` |
| `src/utils/businessMap.test.ts` | Unit (existente) | **Hidratacion**: test que verifica que `getBusinessMap()` retorna mapa vacio durante hidratacion (cuando `allBusinesses` esta cargando o no hidrato aun). `getBusinessById(id)` retorna `undefined` en ese estado. Hooks consumidores deben manejar el caso graciosamente — agregar un test por hook tocado verificando comportamiento con mapa vacio (no crash, no warning) |

### Criterios de testing

- Cobertura >= 80% del codigo nuevo
- Tests de validacion para todos los inputs del usuario (no aplica — refactor)
- Todos los paths condicionales cubiertos (found / not_found / invalid_id)
- **Path de hidratacion cubierto**: cada hook tocado tiene test que verifica comportamiento cuando `getBusinessMap()` retorna mapa vacio (caller corre antes de hidratacion del singleton)
- Side effects verificados:
  - `getBusinessMap()` se construye una sola vez (verificar con `__resetBusinessMap` en `beforeEach`)
  - `loading`/`decoding` attrs presentes en DOM despues del render
  - manualChunks emite `mui-core`, `mui-icons`, `firebase` (sin storage) — verificable via `npm run guards` (rule R7/R8) y output del build (no test unitario)

---

## Seguridad

Este feature no introduce nuevas escrituras a Firestore ni nuevas superficies expuestas. Los cambios son:

- Refactor de lookups in-memory (sin tocar Firestore).
- Atributos HTML adicionales en `<img>` (no sanitizables externamente — son flags del browser).
- Reorganizacion de chunks Vite (build-time).
- Adicion de `limit()` en queries existentes — esto **mejora** la postura de seguridad (mitiga billing DoS por colecciones grandes).

### Vectores de ataque automatizado

| Superficie | Ataque posible | Mitigacion requerida |
|-----------|---------------|---------------------|
| `fetchUserLists` / `fetchSharedWithMe` | Bot crea muchas listas para inflar fetch a 1000+ items | `limit(100)` agregado en S4 + rate limit `sharedLists` 10/dia ya existe (#289) |
| `fetchSpecials` / `fetchAchievements` | N/A — solo admins escriben | Cap pequeno por defensa adicional |
| `fetchListItems` | Lista con 10K items inflada por owner | `limit(500)` agregado en S4 — mismo cap que Firestore batch limit |
| `<img src={photoUrl}>` | URL maliciosa — pero ya validado por Storage rules y rules de menuPhotos #250 | Sin cambio |
| Bundle inspection | Atacante analiza el bundle minified — sin cambio respecto a baseline | N/A |

### Checklist (relevante a este feature)

- [ ] No se introducen escrituras nuevas a Firestore — N/A
- [ ] No se introducen colecciones nuevas — N/A
- [ ] **`limit()` en 7 queries sin paginar** — S4 agrega caps en specials/achievements/sharedLists (ver tabla en S4 para el detalle de las 7 queries cappeadas y las 2 excluidas)
- [ ] No se exponen userIds ni datos privados en bundles publicos — verificar que `dist/stats.html` no incluya secrets
- [ ] CSP no requiere actualizacion — los chunks emergen del mismo origen

---

## Deuda tecnica y seguridad

### Issues relacionados

| Issue | Relacion | Accion |
|-------|----------|--------|
| #302 Performance — Bundle Splits + Firestore Waterfalls | mitiga (regresion de #302) | Re-aplicar reglas R4 (businessMap), R6 (lazy img), R7 (mui split), R8 (storage drop) del guard |
| #303 Perf instrumentation hot paths | complementa | Si las nuevas queries con `limit()` requieren `measureAsync`, agregarlo (instrumentation existente cubre la mayoria) |
| #325 Tech debt: perf-instrumentation — un-wrapped Firestore queries | complementa | No bloquea, pero coordinar para que `measureAsync` de #325 cubra los nuevos `limit()` |
| #289 sharedLists rate limit + rules field gaps | mitiga | El cap `limit(100)` en `fetchUserLists`/`fetchSharedWithMe` es defensa adicional al rate limit ya implementado |
| #312 fanOut N+1 dedup reads | informa | Patron de `Promise.all` en chunks — referencia para futuras consultas |

### Mitigacion incorporada

- **Re-enforce guard #302 via `npm run guards`**: las 14 violaciones de R4 + 2 violaciones de R-newMap-allBusinesses se cierran. La verificacion es automatica: `npm run guards --guard 302` debe quedar verde para `R4-allBusinesses-find`, `R-newMap-allBusinesses`, `R6-img-without-lazy`, `R7-mui-icons-not-split`, `R8-firebase-storage-in-critical`. El guard ya esta en CI (no requiere agregar nuevo step).
- **Defense-in-depth contra billing DoS**: caps `limit()` en las 7 queries sin paginar (specials, achievements, sharedLists) reduce blast radius si un bug futuro o un atacante con cuenta valida intenta inflar la coleccion.
- **Verification step post-build**: agregar al PR description el output de `npx vite build` con tamanos de chunks antes/despues. Targets documentados en seccion "Baseline numerico (pre-#324)". Verificable en CI artifact (output del build archivado).

### Seguimiento

Los 4 consumers eager de `firebase/storage` ya estan listados en S3.b. Si durante la auditoria de importadores indirectos aparece un consumer adicional no listado (ej: re-export de `storage` const desde un barrel), agregarlo a S3.b en el specs/plan — no abrir issue separado, esta dentro de scope.

---

## Robustez del codigo

### Checklist de hooks async

- [ ] No se modifican useEffect async en este feature — el cambio es sustitucion sincrona de lookups in-memory
- [ ] Los hooks tocados (`useDeepLinks`, `useRatingPrompt`, `useSuggestions`, `useVisitHistory`, `useCommentsListFilters`, `useBusinessById`, `useNavigateToBusiness`) ya tienen patron de cancelacion donde corresponde — no se altera
- [ ] `getBusinessMap()` retorna sincronicamente — sin guards de unmount
- [ ] No se introducen funciones exportadas nuevas — solo cambia el callsite
- [ ] Archivos en `src/hooks/` siguen siendo hooks reales (todos tienen `useMemo`, `useEffect` o `useCallback`)
- [ ] No se agregan keys nuevas de localStorage
- [ ] Ningun archivo nuevo
- [ ] `logger.error` no se introduce en nuevos paths — refactor sin cambios de error handling

### Checklist de observabilidad

- [ ] No se introducen Cloud Function triggers nuevos
- [ ] No se introducen services nuevos — los services existentes con `limit()` agregado mantienen su `measureAsync` actual (verificar `services/sharedLists.ts`, agregar si falta — coordinar con #325)
- [ ] No se introducen `trackEvent` nuevos

### Checklist offline

- [ ] No se modifican formularios — refactor de lookups
- [ ] Error handlers en catch blocks no se modifican

### Checklist de documentacion

- [ ] Actualizar `docs/reference/guards/302-performance.md` solo si se agrega un check nuevo (ej: grep de imports eager de `firebase/storage`)
- [ ] Actualizar `docs/reference/patterns.md` seccion "businessMap singleton" — confirmar que el patron sigue siendo el mismo (no se cambia, solo se refuerza)
- [ ] Actualizar `docs/reference/project-reference.md` con el nuevo numero de bundle target alcanzado (post-implementacion)
- [ ] Sin cambios en `firestore.md` — no hay colecciones nuevas

---

## Offline

Este feature es 100% perf — no introduce flujos offline nuevos.

### Data flows

| Operacion | Tipo (read/write) | Estrategia offline | Fallback UI |
|-----------|-------------------|-------------------|-------------|
| `getBusinessById(id)` | read in-memory | Sincronico, dataset estatico embebido en el bundle | Devuelve `undefined` si id invalido (mismo comportamiento) |
| `<img loading="lazy">` | read remoto | Browser respeta cache de service worker (Workbox runtime cache para Storage) | `onError` setea `null` y renderiza fallback (sin cambio) |
| `fetchSpecials` con `limit(20)` | read Firestore | Persistencia offline ya activa | `useAsyncData` muestra error si no hay cache |
| `fetchUserLists` con `limit(100)` | read Firestore | Persistencia offline ya activa | Idem |

### Checklist offline

- [x] Reads de Firestore: usan persistencia offline (ya configurado a nivel global)
- [x] Writes: no se modifican
- [x] APIs externas: no aplica
- [x] UI: indicador offline existente sigue funcionando
- [x] Datos criticos: `allBusinesses` ya esta embebido en bundle (no requiere red)

### Esfuerzo offline adicional: S (sin trabajo nuevo)

---

## Modularizacion y % monolitico

Este feature **reduce** acoplamiento al consolidar 16 callsites al singleton `getBusinessMap()` (un punto de mantenimiento) en vez de tener `allBusinesses.find()` / `new Map(allBusinesses.map(...))` disperso. Tambien reduce el bundle inicial al separar chunks que actualmente colapsan codigo no critical-path, y desacopla 4 consumers eager de `firebase/storage` migrando a dynamic import.

### Checklist modularizacion

- [x] Logica de negocio en hooks/services (sin cambios)
- [x] Componentes nuevos: ninguno
- [x] No se agregan useState a AppShell/SideMenu
- [x] Props explicitas (sin cambios)
- [x] Cada prop de accion tiene handler real (sin cambios)
- [x] Ningun componente importa Firestore directamente — services tocados son `services/specials.ts`, `services/achievements.ts`, `services/sharedLists.ts` (capa correcta)
- [x] Archivos en `src/hooks/` contienen al menos un hook (sin cambios)
- [x] Ningun archivo nuevo supera 400 lineas
- [x] Sin nuevos converters
- [x] Archivos nuevos: ninguno
- [x] Sin estado global nuevo
- [x] Ningun archivo modificado supera 400 lineas

### Impacto en % monolitico

| Aspecto | Impacto | Justificacion |
|---------|---------|---------------|
| Acoplamiento de componentes | - | Consolida 16 callsites a 1 helper compartido (`getBusinessById` / `getBusinessMap`) — menos duplicacion |
| Estado global | = | Sin cambios — `businessMap` sigue siendo modulo-level cache (no es contexto) |
| Firebase coupling | - | Sacar `firebase/storage` del chunk critico reduce coupling eager con SDK |
| Organizacion por dominio | = | Sin cambios — ningun archivo se mueve de carpeta |

---

## Accesibilidad y UI mobile

### Checklist de accesibilidad

- [x] No se agregan `<IconButton>` nuevos
- [x] Elementos interactivos sin cambios
- [x] Touch targets sin cambios
- [x] Componentes con carga de datos sin cambios
- [x] **Imagenes con URLs dinamicas tienen `onError` fallback** — ya presente en MenuPhotoSection (setea `setPhotoUrl(null)`) y MenuPhotoViewer (setea `imageError`); se preserva
- [x] Formularios sin cambios

### Checklist de copy

- [x] No se modifican textos user-facing
- [x] Tono consistente: N/A (sin copy nuevo)
- [x] Strings sin cambios

---

## Staging / dependencias entre workstreams

Para informar el plan de merge, este es el grafo de dependencias y nivel de riesgo de cada sub-tarea. **No es plan de merge** (eso lo escribe specs-plan-writer / tech-lead) — es input para que el plan ordene los workstreams.

### Dependencias

- **S1** (allBusinesses lookups + Maps construidos) — sin dependencias entre sub-callsites; cada uno es independiente. Sin dependencia con S2-S5.
- **S2** (lazy `<img>`) — sin dependencias.
- **S3.a** (split MUI) — sin dependencias.
- **S3.b** (refactor `firebase/storage` a lazy) — sin dependencias previas, pero **bloquea S3.c** (no tiene sentido sacar storage del manualChunk antes de refactorizar consumers).
- **S3.c** (drop `firebase/storage` del manualChunk) — **depende de S3.b completo**.
- **S4** (`limit()` queries) — sin dependencias. Idealmente despues de S1 para no mezclar refactor de business lookups con caps de queries en el mismo PR commit, pero no es bloqueante.
- **S5** (investigar `index-BuuweED0` 296 KB) — **depende de baseline post-S2+S3** para no medir ruido. Hacer al final.

### Riesgo por workstream

| Workstream | Riesgo | Razon | Orden sugerido |
|------------|--------|-------|----------------|
| S1 | Bajo | Refactor mecanico, mismo shape de retorno (`Business \| undefined`). Tests existentes cubren la mayoria de los hooks. | Primero (foundation, sin deps) |
| S2 | Bajo | Atributos HTML adicionales. Fallback `onError` preservado. Sin cambio de logica. | Cualquier momento (sin deps) |
| S3.a | Bajo | Cambio de config en `vite.config.ts`. Verificable con `npm run guards` rule R7. | Despues de S1 (separable del refactor de codigo) |
| S3.b | **Medio** | Toca config + 4 consumers + singleton de `firebase.ts`. Auditoria de importadores indirectos puede revelar callsites no documentados. Tests deben verificar que el upload sigue funcionando. | Despues de S1/S2 (cuando el resto del PR es estable) |
| S3.c | Bajo | One-line change en config, pero solo tiene efecto si S3.b esta completo. | Inmediatamente despues de S3.b |
| S4 | Bajo | Defensivo, no cambia comportamiento happy path. Tests verifican que `limit()` se aplica. | Despues de S1, antes o paralelo a S3 |
| S5 | Bajo | Investigacion sin cambios obligatorios. Si descubre algo, abrir issue followup. | Al final, post S2+S3 (para no medir ruido) |

### Orden recomendado para el plan

1. S1 (refactor lookups)
2. S2 (lazy imgs) — paralelo a S1 si separamos en dos commits
3. S4 (limit queries) — paralelo o despues de S1
4. S3.a (split MUI manualChunks)
5. S3.b (refactor consumers de firebase/storage)
6. S3.c (drop firebase/storage del manualChunk)
7. S5 (investigar 296 KB) — al final, con baseline limpio

---

## Success Criteria

1. **Cero hits del rule `R4-allBusinesses-find` Y cero hits del rule `R-newMap-allBusinesses` en `npm run guards --guard 302`**, excepto en `src/utils/businessMap.ts` (alli se construye el singleton — el rule lo excluye por path). El grep equivalente devuelve: `grep -rn "allBusinesses\.find" src/` = 0 matches; `grep -rn "new Map(allBusinesses" src/` = 0 matches fuera de `src/utils/businessMap.ts`.
2. **Bundle inicial post-build cumple targets**: `npx vite build` reporta chunks dentro de los targets de la seccion "Baseline numerico (pre-#324)" — `mui-core` <= 200 KB raw, `firebase` <= 350 KB raw (sin storage en chunk critico), bundle inicial total <= 1 MB raw / <= 700 KB gzipped. Verificable en CI artifact (output del build archivado por el job).
3. **Chunks `mui-core` y `mui-icons` aparecen separados en `dist/stats.html`**, y `firebase/storage` aparece en un chunk async (cargado on-demand) y NO en el chunk `firebase`. El rule `302/R7-mui-icons-not-split` y `302/R8-firebase-storage-in-critical` quedan verdes en `npm run guards`.
4. **Los 3 `<img>` de menu photo (MenuPhotoSection, MenuPhotoViewer, MenuPhotoUpload) tienen `loading="lazy"` + `decoding="async"` + dimensiones explicitas**. Verificable via DOM inspection en tests + rule `302/R6-img-without-lazy` en `npm run guards` (queda verde, 0 hits).
5. **Tests existentes siguen pasando + nuevos tests cubren los hooks tocados + path de hidratacion (mapa vacio)** — cobertura >= 80% en archivos modificados.
6. **`npm run guards --guard 302` queda verde** post-merge: rules `R4-allBusinesses-find`, `R-newMap-allBusinesses`, `R6-img-without-lazy`, `R7-mui-icons-not-split`, `R8-firebase-storage-in-critical` todas en 0 hits. Esto reemplaza la verificacion manual de `docs/reference/guards/302-performance.md`.
7. **Post-deploy a staging, Lighthouse mobile reporta LCP <= 2.5s y bundle inicial dentro de target**. Verificable via PageSpeed Insights URL post-deploy. Si no se llega al threshold, abrir issue de followup pero no bloquear el merge si los criterios 1-6 quedaron verdes (criterio 7 es signal de monitoreo, no gate de merge).

---

## Validacion Funcional

**Analista:** Sofia (analisis funcional)
**Fecha Ciclo 1:** 2026-04-25
**Fecha Ciclo 2:** 2026-04-25
**Estado:** **VALIDADO CON OBSERVACIONES**

### Veredicto Sofia (Ciclo 2)

Los 4 BLOQUEANTES de Ciclo 1 quedaron resueltos en el PRD. Los 5 IMPORTANTES tambien estan cerrados con criterio explicito. La seccion "Baseline numerico (pre-#324)" da targets verificables; el split S3.a/S3.b/S3.c documenta la dependencia entre refactor de consumers y drop del manualChunk; los callsites de R-newMap fueron agregados; el tercer `<img>` esta en S2 con justificacion clara sobre `R6` no distinguir origen.

Verifique en filesystem que la lista de callsites del PRD coincide con la realidad: 14 hits de `allBusinesses.find` + 2 hits de `new Map(allBusinesses` (`useLocalTrending.ts:40`, `RankingsView.tsx:38`) + 1 caso especial `new Set(allBusinesses.map(...))` en `useRatingPrompt.ts:120` + 3 `<img>` en `src/components/business/` + 4 imports eager de `firebase/storage`. Todo consistente con S1/S2/S3.b.

Tambien verifique que el guard runner (`scripts/guards/checks.mjs`) tiene definidas las 5 rules referenciadas (`R4-allBusinesses-find`, `R-newMap-allBusinesses`, `R6-img-without-lazy`, `R7-mui-icons-not-split`, `R8-firebase-storage-in-critical`) — las afirmaciones de Success Criteria son ejecutables hoy.

### Cerrado en Ciclo 2

- **B1 callsites R-newMap** — resuelto en S1 (filas 15 y 16 de la tabla). Verificado: `useLocalTrending.ts:40` y `RankingsView.tsx:38` existen con el patron descripto.
- **B2 tercer `<img>`** — resuelto en S2. Verificado: `MenuPhotoUpload.tsx:129` existe; aclaracion sobre `R6` y origen preview/remoto suficiente.
- **B3 premisa lazy `firebase/storage`** — resuelto. PRD reescribe S3 en S3.a/S3.b/S3.c con dependencia explicita; agrega los 4 consumers eager, refactor por archivo, y singleton `getStorageLazy()` con cache. Esfuerzo total subio a M-grande (consistente con Scope).
- **B4 baseline numerico** — resuelto en seccion "Baseline numerico (pre-#324)". Tabla pre/post + targets explicitos + verificable por CI artifact.
- **I5 criterio post-deploy** — resuelto en Success Criteria #7 (LCP <= 2.5s, signal de monitoreo, no gate).
- **I6 race / hidratacion del singleton** — resuelto en S1 (nota explicita) + tabla de Tests fila `businessMap.test.ts` + criterios de testing.
- **I7 cuenta de queries inconsistente** — resuelto. 7 cappeadas + 2 excluidas con justificacion explicita y consistente entre Problema, S4, Scope y Seguridad.
- **I8 referencia al guard runner** — resuelto. `npm run guards --guard 302` reemplaza verificacion manual en Tests, Mitigacion y Success Criteria #6.
- **I9 staging por workstream** — resuelto en seccion "Staging / dependencias entre workstreams" con grafo de dependencias, riesgo por workstream y orden recomendado (insumo para specs-plan-writer / tech-lead, no plan de merge).
- **O10/O11/O12** — todos cerrados (iteraciones puras no se tocan, vite.config.ts row, redaccion de Success Criterion #1).

### Observaciones nuevas (no bloqueantes — entrega ya con claridad suficiente)

- **OBS-N1 — Inexactitud factual en S3.b tabla, fila 4 (`PhotoReviewCard.tsx:4`).** El PRD describe el import actual como `import { ref, deleteObject } from 'firebase/storage'`. En el filesystem (`src/components/admin/PhotoReviewCard.tsx:4`) el import real es `import { ref, getDownloadURL } from 'firebase/storage'`. El borrado se hace via `deleteMenuPhoto` (importado de `services/adminPhotos.ts`, linea 6). El callsite **si** corresponde refactorizarlo a dynamic import (el `getDownloadURL` es eager y resuelve la URL del thumbnail al montar la card de admin), pero el implementador va a abrir el archivo esperando ver `deleteObject` y no lo va a encontrar. Que se necesita: que specs-plan-writer corrija el import al verdadero (`ref, getDownloadURL`) y describa el escenario real (resolver URL del thumbnail al montar) — no es bloqueante porque el path admin esta lazy a nivel ruta y el efecto de bundle es identico.

- **OBS-N2 — Ejemplo de `getStorageLazy()` divergente del codigo real.** El snippet en S3.b usa `USE_EMULATORS` (constante que no existe en `src/config/firebase.ts`) y la cadena `'127.0.0.1'`. El codigo actual usa `import.meta.env.DEV` como branching y la cadena `'localhost'` (firebase.ts:56,60). El PRD aclara que los snippets son "ejemplo" y no implementacion definitiva, pero conviene que specs-plan-writer reconcilie el branching y la cadena con el patron existente (los demas `connectXEmulator` usan `localhost` + `import.meta.env.DEV`). No bloqueante — es ajuste mecanico al specs.

- **OBS-N3 — Path lazy del singleton expone API async donde antes era sincronica.** El cambio de `export const storage = getStorage(app)` a `export async function getStorageLazy()` rompe el shape de import para todo consumer indirecto que hoy hace `import { storage } from 'config/firebase'`. El PRD lo menciona en bullet "Auditar todos los importadores de `storage` (la const) y migrarlos". Verifique en filesystem: hay 3 importadores indirectos (`feedback.ts`, `menuPhotos.ts`, `PhotoReviewCard.tsx`). Los 3 ya estan listados en S3.b por su uso del SDK, asi que la migracion del re-import cae naturalmente en el mismo refactor. Anotado para que specs-plan-writer no se olvide del re-import en cada uno cuando ataque el archivo.

- **OBS-N4 — Test de hidratacion del singleton con mapa vacio.** El PRD agrega el path en `businessMap.test.ts` y pide "agregar un test por hook tocado verificando comportamiento con mapa vacio". Para los hooks que renderizan listas (`FavoritesList`, `RatingsList`, `ReceivedRecommendations`, `ListDetailScreen`), "mapa vacio" significa que cada item se renderiza con `business: null` o no se renderiza. El comportamiento esperado deberia quedar definido en specs-plan-writer (skip / placeholder / fallback) — no es trivial decidir si la lista filtra el item o lo muestra con shell. No bloqueante porque el comportamiento actual es el mismo (`allBusinesses.find()` ya devuelve `undefined` durante hidratacion), pero el implementador deberia mantener el comportamiento actual exacto (no cambiar a "filtrar" si hoy es "mostrar con null").

- **OBS-N5 — Issue #325 (perf-instrumentation) coordinacion con S4.** El PRD menciona que "no bloquea, pero coordinar para que `measureAsync` de #325 cubra los nuevos `limit()`". Verifique en filesystem que el guard `303/R1-services-raw-getDocs` ya existe (`scripts/guards/checks.mjs:152`). Si #325 mergea antes de #324, los `getDocs` con `limit()` agregados aca van a fallar el guard 303 a menos que se les wrappee con `measureAsync`/`measuredGet*`. Anotado para que specs-plan-writer revise el orden con tech-lead.

### Listo para specs-plan-writer

**Si.** El PRD tiene la informacion suficiente para que specs-plan-writer arme el plan tecnico. Las 5 observaciones nuevas son ajustes menores (inexactitud factual, divergencia de ejemplo de codigo, ordering con #325) que no requieren re-iterar con prd-writer — el implementador y tech-lead las pueden resolver al armar el plan.

**Estado final: VALIDADO CON OBSERVACIONES**
