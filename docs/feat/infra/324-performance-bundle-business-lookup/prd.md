# PRD: Tech debt: performance — allBusinesses.find() x13, lazy <img>, MUI chunk split

**Feature:** 324-performance-bundle-business-lookup
**Categoria:** infra
**Fecha:** 2026-04-25
**Issue:** #324
**Prioridad:** Alta

---

## Contexto

El health-check 2026-04-25 del performance agent identifico una regresion del guard #302 (performance) en 13 callsites que volvieron a usar `allBusinesses.find()` en vez de `getBusinessMap()`/`getBusinessById()`, mas dos `<img>` en `MenuPhotoSection`/`MenuPhotoViewer` sin `loading="lazy"`/`decoding="async"` y dos manualChunks en `vite.config.ts` que violan reglas R7 y R8 (MUI icons no separado del core; `firebase/storage` sigue en el chunk critico de firebase). Bundle inicial actual ~1.6 MB raw, target <= 1 MB raw / <= 700 KB gzipped.

Este issue es el **followup directo de #302**: las reglas R4/R6/R7/R8 del guard `docs/reference/guards/302-performance.md` ya estaban escritas, pero no se enforzan automaticamente y nuevos features (#306 BusinessScopeContext, hooks nuevos como `useRatingPrompt`, `useNavigateToBusiness`, `useBusinessById`) re-introdujeron el patron O(n).

## Problema

- **13 callsites con `allBusinesses.find((b) => b.id === id)`** — viola R4 del guard #302. Cada lookup es O(n) sobre 40 comercios. En listas (FavoritesList, RatingsList, ReceivedRecommendations, ListDetailScreen, useCommentsListFilters) el find() corre dentro de un map() — O(n*m). El singleton `getBusinessMap()` ya existe en `src/utils/businessMap.ts` con tests, pero no se esta usando.
- **2 `<img>` sin `loading="lazy"` ni `decoding="async"`** en `MenuPhotoSection.tsx:82` y `MenuPhotoViewer.tsx:78` — viola R6. La foto de menu del business sheet entra en el LCP path en 3G aunque no este above-the-fold cuando el sheet esta cerrado, y el viewer modal decodifica sincronamente.
- **MUI chunk monolitico de 474 KB** mezcla `@mui/material` (critical-path, ~150 KB) con `@mui/icons-material` (~250-300 KB, los icons son inline SVG por componente y no son critical-path) — viola R7. Separarlos permite diferir la carga de icons.
- **`firebase/storage` (~40-60 KB) en el chunk critico de firebase** — viola R8. Storage solo se usa en uploads de menu photos / avatares (paths ya lazy via `await import('firebase/storage')` en `MenuPhotoUpload`). No tiene que estar en el bundle inicial.
- **Medium: getDocs sin `limit()` en specials/achievements/sharedLists/follows** — riesgo de billing DoS si las colecciones crecen. `fetchSpecials`, `fetchActiveSpecials`, `saveAllSpecials`, `fetchAchievements`, `saveAllAchievements`, `fetchUserLists`, `fetchSharedWithMe`, `fetchListItems`, `fetchFollowersCount`. Los specials/achievements son admin-managed (cap natural), pero las listas y follows pueden crecer linealmente con el uso.
- **Medium: `firebase` chunk size** — derivado del problema de storage; al sacar storage se reduce el chunk a ~390 KB.
- **Low: chunk `index-BuuweED0` de 296 KB sin identificar** — necesita inspeccion via `npm run analyze` para entender que esta colapsando. Posible candidato a manualChunks o lazy split.
- **Low: srcset/responsive variants** para menu photos — fuera de scope inmediato pero dejado para el roadmap.

## Solucion

### S1 — Migrar 13 callsites a `getBusinessById()` / `getBusinessMap()`

Para los lookups simples por id, usar `getBusinessById(id)` (helper exportado de `src/utils/businessMap.ts`). Para iteraciones que necesiten el Map crudo, usar `getBusinessMap()`. Sin construir Maps locales y sin appendear nuevos exports al singleton.

Callsites a migrar:

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

**Caso especial — `useRatingPrompt.ts:120`**: usa `new Set(allBusinesses.map((b) => b.id))` para `allBizIds`. Reemplazar por `getBusinessMap()` directamente: `getBusinessMap().has(checkIn.businessId)` en el loop de check-ins.

**No-append**: ningun callsite agrega exports nuevos al modulo `businessMap.ts`. Solo se cambia el callsite.

### S2 — Lazy + async decode en `<img>` de menu photo

Agregar `loading="lazy"`, `decoding="async"`, y dimensiones explicitas (px) a las dos imagenes:

- `src/components/business/MenuPhotoSection.tsx:82` — thumbnail ~200px de alto. Setear `width="100%"` ya esta implicito por style. Agregar `width={400} height={200}` como atributos HTML para reservar layout. Mantener `objectFit: 'cover'`.
- `src/components/business/MenuPhotoViewer.tsx:78` — viewer fullscreen, no es above-the-fold (modal). Setear `loading="lazy"` y `decoding="async"`. Dimensiones intrinsecas no aplican (objectFit contain), pero los atributos siguen ayudando al layout reserve.

**No usar excepcion `loading="eager"`**: ninguno de estos dos casos es hero ni LCP.

### S3 — Split MUI chunk: `mui-core` + `mui-icons`

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

Cambios:

- `firebase`: drop `'firebase/storage'`. `MenuPhotoUpload`, `AvatarPicker` y otros consumers ya usan `await import('firebase/storage')` (verificar antes; si hay un consumer eager, migrarlo a dynamic import como parte de este feature).
- `mui-core` + `mui-icons` separados — el bundler emite dos chunks distintos y los icons se cargan cuando algun componente que los importa se carga. La mayoria de icons aparecen en menus desplegables, dialogs e interacciones — no critical-path.

### S4 — `limit()` en getDocs sin paginar (medium)

Agregar `limit()` con caps razonables a las queries que no tienen pagination:

| Service | Funcion | Cap propuesto | Justificacion |
|---------|---------|---------------|---------------|
| `services/specials.ts` | `fetchSpecials` | `limit(50)` | Admin-managed, cap natural pequeno |
| `services/specials.ts` | `fetchActiveSpecials` | `limit(20)` | Solo activos, user-facing |
| `services/specials.ts` | `saveAllSpecials` (existingSnap) | `limit(100)` | Cleanup loop, cap defensivo |
| `services/achievements.ts` | `fetchAchievements` | `limit(100)` | Definiciones admin-managed |
| `services/achievements.ts` | `saveAllAchievements` (existingSnap) | `limit(100)` | Cleanup defensivo |
| `services/sharedLists.ts` | `fetchUserLists` | `limit(100)` | Cap razonable; rate limit ya impone 10/dia (#289) |
| `services/sharedLists.ts` | `fetchSharedWithMe` | `limit(100)` | Cap razonable |
| `services/sharedLists.ts` | `fetchListItems` | `limit(500)` | Hard cap por lista — Firestore batch limit |
| `services/sharedLists.ts` | `deleteList` (itemsSnap) | mantener sin limit (cascade delete necesita todos) | Documentar comentario |
| `services/follows.ts` | `fetchFollowersCount` | mantener — ya usa `getCountOfflineSafe` con server-side count | N/A (es count, no get) |

### S5 — Investigar chunk `index-BuuweED0` (296 KB) — low priority

Ejecutar `ANALYZE=1 npm run build` (o `npm run analyze` si existe) para ver el contenido del segundo chunk `index-*`. Si es codigo de admin, separar via manualChunk. Si es duplicado del main entry, investigar imports cruzados. Documentar finding en specs.

## UX considerations

Este feature es 100% perf y no cambia ningun flow visible para el usuario. Beneficios percibidos:

- TTI mas rapido en redes lentas (target -300/-500ms en 3G por bundle reducido).
- Listas largas (FavoritesList, RatingsList, ReceivedRecommendations con N>=20 items) sentiran scroll mas fluido por O(1) lookups.
- Menu photos: en 3G no bloquean el render del business sheet header (lazy + async decode).

---

## Scope

| Item | Prioridad | Esfuerzo |
|------|-----------|----------|
| S1 — 13 callsites a `getBusinessById` (incl. set en `useRatingPrompt`) | Alta | M |
| S2 — `loading="lazy"` + `decoding="async"` en 2 `<img>` | Alta | XS |
| S3 — Split MUI chunk + drop firebase/storage | Alta | S |
| S4 — `limit()` en 7 queries sin paginar | Media | S |
| S5 — Investigar `index-BuuweED0` 296 KB | Baja | S |
| Tests unitarios para callsites no cubiertos | Alta | S |
| Bundle baseline measurement + verificacion post-cambio | Alta | XS |

**Esfuerzo total estimado:** M

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
| `vite.config.ts` | N/A | Verificacion manual via `npm run build` + `dist/stats.html` |
| `src/services/specials.test.ts` | Unit (nuevo) | `fetchActiveSpecials` aplica `limit(20)` (verificar via mock de `query`) |
| `src/services/achievements.test.ts` | Unit (nuevo) | Idem para `fetchAchievements` |
| `src/services/sharedLists.test.ts` | Unit (existente) | Agregar caso para `fetchUserLists` con `limit(100)` |

### Criterios de testing

- Cobertura >= 80% del codigo nuevo
- Tests de validacion para todos los inputs del usuario (no aplica — refactor)
- Todos los paths condicionales cubiertos (found / not_found / invalid_id)
- Side effects verificados:
  - `getBusinessMap()` se construye una sola vez (verificar con `__resetBusinessMap` en `beforeEach`)
  - `loading`/`decoding` attrs presentes en DOM despues del render
  - manualChunks emite `mui-core`, `mui-icons`, `firebase` (sin storage) — verificacion via output del build, no test unitario

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
- [ ] **`limit()` en queries sin paginar** — S4 agrega caps en specials/achievements/sharedLists
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

- **Re-enforce guard #302**: las 13 violaciones de R4 se cierran. Agregar al checklist de merge un grep automatico para `allBusinesses\.find` (ya documentado en `docs/reference/guards/302-performance.md` "Check 2"). Considerar un test dedicado o un step de CI.
- **Defense-in-depth contra billing DoS**: caps `limit()` en colecciones que actualmente no tienen paginacion (specials, achievements, sharedLists) reduce blast radius si un bug futuro o un atacante con cuenta valida intenta inflar la coleccion.
- **Verification step**: agregar al PR description el output de `npm run build` con tamanos de chunks antes/despues. Target documentado: <= 1 MB raw initial.

### Seguimiento

Si durante la implementacion aparece un consumer eager de `firebase/storage` que bloquea S3, abrir issue separado para migrarlo a dynamic import (no romper el flujo de upload existente).

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

Este feature **reduce** acoplamiento al consolidar 13 callsites al singleton `getBusinessMap()` (un punto de mantenimiento) en vez de tener `allBusinesses.find()` disperso. Tambien reduce el bundle inicial al separar chunks que actualmente colapsan codigo no critical-path.

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
| Acoplamiento de componentes | - | Consolida 13 callsites a 1 helper compartido (`getBusinessById`) — menos duplicacion |
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

## Success Criteria

1. **Cero matches de `allBusinesses\.find` en `src/`** (verificar via `grep -rn "allBusinesses\.find" src/`). Solo permitido en `src/utils/businessMap.ts` no aplica — alli se construye el Map con `.map()`, no `.find()`.
2. **Bundle inicial raw <= 1 MB / gzipped <= 700 KB** post-build (verificar via `npm run build` output). Documentar tamanos antes/despues en el PR description.
3. **Chunks `mui-core` y `mui-icons` aparecen separados en `dist/stats.html`** (verificar manualmente). El chunk `firebase` no contiene codigo de `firebase/storage`.
4. **Las 2 `<img>` de MenuPhotoSection y MenuPhotoViewer tienen `loading="lazy"` + `decoding="async"`** (verificar via DOM inspection en tests + grep en codigo: `grep -rn "<img" src/components/ --include="*.tsx" | grep -v "loading=\"lazy\""` deberia retornar 0 matches).
5. **Tests existentes siguen pasando + nuevos tests cubren los hooks tocados** (cobertura >= 80% en archivos modificados).
6. **`docs/reference/guards/302-performance.md` Check 2 sigue verde** post-merge (ningun nuevo `allBusinesses.find` introducido).

---

## Validacion Funcional

**Auditor:** Sofia (analisis funcional)
**Fecha:** 2026-04-25
**Ciclos:** 1 (sin segundo ciclo — el agente auditor no tiene tool para spawnear prd-writer en esta sesion)
**Veredicto:** **NO VALIDADO** — hay 4 BLOQUEANTES y 5 IMPORTANTES abiertos que requieren reescritura por prd-writer antes de pasar a specs/plan.

### BLOQUEANTES abiertos

#### BLOQUEANTE #1 — Faltan callsites del rule `R-newMap-allBusinesses`

El rule `R-newMap-allBusinesses` del guard runner (`scripts/guards/checks.mjs`) detecta dos hits que el PRD no lista en S1:

- `src/hooks/useLocalTrending.ts:40` — `new Map(allBusinesses.map((b) => [b.id, { lat: b.lat, lng: b.lng }]))`. Subset lat/lng cacheado. Definir si se reemplaza por iteracion sobre `getBusinessMap().values()` o se justifica exencion.
- `src/components/social/RankingsView.tsx:38` — `new Map(allBusinesses.map((b) => [b.id, b]))`. Mismo shape que el singleton, drop-in trivial: `getBusinessMap()`. Ademas hoy se reconstruye en cada render (esta fuera de `useMemo`).

Sin tocar estos dos, `npm run guards --guard 302` queda rojo post-merge.

#### BLOQUEANTE #2 — Tercer `<img>` no listado: `MenuPhotoUpload.tsx:129`

El grep de `<img` en `src/components/` con `--include="*.tsx"` devuelve 3 hits, no 2. El tercero (`MenuPhotoUpload.tsx:129`) es preview de upload local pero el guard `R6-img-without-lazy` no distingue origen. Decidir: agregar a S2 con su patron objetivo, o documentar excepcion explicita en el guard y en este PRD.

#### BLOQUEANTE #3 — Premisa falsa sobre `firebase/storage` lazy en consumers

El PRD afirma en S3 que "MenuPhotoUpload, AvatarPicker y otros consumers ya usan `await import('firebase/storage')`". Verificacion en codigo demuestra lo contrario — todos los consumers son **eager**:

- `src/config/firebase.ts:12` — `import { getStorage, connectStorageEmulator } from 'firebase/storage'` + `export const storage = getStorage(app)`.
- `src/services/feedback.ts:5` — eager `ref, uploadBytes, getDownloadURL`.
- `src/services/menuPhotos.ts:5` — eager `ref, uploadBytesResumable, getDownloadURL` + import de `UploadTask`.
- `src/components/admin/PhotoReviewCard.tsx:4` — eager (admin esta lazy a nivel ruta, pero el grafo de imports ata storage al chunk principal).

Sacar `firebase/storage` del manualChunk **no** lo va a sacar del bundle inicial mientras estos imports sean eager — Rollup lo va a colapsar igualmente. La promesa "1.6 MB → <= 1 MB raw" depende de esto.

Decision a tomar:
- Opcion A: ampliar S3 para migrar los 4 consumers a dynamic import dentro de este feature (esfuerzo M en vez de S).
- Opcion B: dejar S3 como esta, abrir issue separado bloqueante (#324b), bajar la promesa de bundle del Success Criteria mientras tanto.

#### BLOQUEANTE #4 — Success Criteria sin baseline numerico

El criterio #2 dice "<= 1 MB raw / <= 700 KB gzipped" pero el PRD no documenta el numero **actual** por chunk. Sin baseline (mui actual KB raw+gzipped, firebase actual, index actual, index-BuuweED0, recharts, google-maps), no es auditable la diferencia entre cumplir el target y rozarlo.

Agregar una tabla "Baseline (medido 2026-04-25)" con tamanos por chunk antes del cambio + total raw + total gzipped + comando de reproduccion.

### IMPORTANTES abiertos

#### IMPORTANTE #5 — Sin criterio de exito post-deploy

Los 6 criterios actuales son todos de build-time. La promesa "−300/−500ms TTI en 3G" del bloque "UX considerations" no esta como criterio. Para una feature 100% perf, vale agregar al menos un threshold observable post-deploy (LCP p75 o web vital reportado por GA4) — o justificar explicitamente "post-deploy no se mide" si no hay infra de RUM.

#### IMPORTANTE #6 — Riesgo de race / orden de hidratacion no abordado

`getBusinessMap()` construye el Map en el primer call. En tests con `__resetBusinessMap()` global, dos `renderHook` paralelos pueden disparar dos builds (no destructivo, pero ruidoso en coverage). En produccion, no hay impacto. Vale 1 parrafo en "Robustez" o "Tests" especificando:

- `beforeEach(() => __resetBusinessMap())` para tests deterministas.
- El Map es modulo-level — no requiere Provider, no afecta orden de mount.
- Costo amortizado: primer call construye, resto O(1).

#### IMPORTANTE #7 — Cuenta de queries inconsistente entre secciones

3 cuentas distintas para el trabajo de S4:
- "Problema" (medium bullet): 9 nombres de funciones.
- "S4" (tabla): 10 filas (incluye `deleteList` con "mantener sin limit" y `fetchFollowersCount` con "N/A").
- "Scope" (tabla): "limit() en 7 queries sin paginar".
- Consigna del usuario: "7 queries getDocs sin limit".

Alinear las 4 referencias a un numero canonico unico, idealmente derivado de la tabla S4 (que es la detallada). Aclarar si `deleteList` y `fetchFollowersCount` cuentan o no.

#### IMPORTANTE #8 — PRD no referencia el guard runner automatizado

`npm run guards --guard 302` ya automatiza R4, R-newMap-allBusinesses, R6, R7, R8. Cambiar Success Criteria #1, #6 y "Mitigacion incorporada" para referenciarlo en lugar de greps manuales. Listar explicitamente que rules deben quedar verdes:

- `302/R4-allBusinesses-find`
- `302/R-newMap-allBusinesses`
- `302/R6-img-without-lazy`
- `302/R7-mui-icons-not-split`
- `302/R8-firebase-storage-in-critical`

#### IMPORTANTE #9 — Falta seccion de staging por workstream

El contexto pide "risk staging por workstream S1-S5" y el PRD no dice nada sobre dependencias entre Sx ni nivel de riesgo de cada uno. No es plan de merge (eso es manu/tech-lead); es input necesario para cualquier plan de merge. Agregar una seccion "Staging / dependencias entre workstreams" indicando:

- Independencias: S1 ⊥ S2 ⊥ S3 ⊥ S4 (asumiendo BLOQUEANTE #3 resuelto).
- Dependencias: S5 (investigar 296KB) depende de baseline post-S2+S3 para no medir ruido.
- Riesgo por workstream:
  - S1 → bajo (refactor mecanico, mismo shape de retorno).
  - S2 → bajo (atributos HTML, fallback `onError` preservado).
  - S3 → medio si BLOQUEANTE #3 entra en scope (toca config + 4 consumers); bajo si se difiere.
  - S4 → bajo (defensivo, no cambia comportamiento happy path).
  - S5 → bajo (investigacion sin cambios obligatorios).

### OBSERVACIONES (no bloquean)

- **#10**: `useSuggestions.ts:66` (`allBusinesses.map` para iterar) no viola ningun rule — vale 1 linea en S1 aclarando que iteraciones puras no se tocan, solo lookups por id.
- **#11**: La tabla de Tests dice "vite.config.ts: verificacion manual" — `npm run guards` ya automatiza R7/R8. Reemplazar "manual" por referencia al guard runner.
- **#12**: Success Criteria #1 tiene una frase rota: "Solo permitido en `src/utils/businessMap.ts` no aplica — alli se construye el Map con `.map()`, no `.find()`." Reformular a: "El grep `allBusinesses\.find` en `src/` debe devolver 0 matches. (`businessMap.ts` construye el Map con `.map()`; no aparece en el grep de `\.find`, no es excepcion.)"

### Listo para specs-plan-writer?

**No.** Antes de specs/plan se necesita un segundo ciclo con prd-writer que:

1. Cierre los 4 BLOQUEANTES (decision sobre BLOQUEANTE #3 sobre todo — define si el feature crece a M-grande o se parte).
2. Resuelva los 5 IMPORTANTES (al menos #7 y #8 son triviales; #5 requiere decision; #6 y #9 son redaccion).
3. Las observaciones pueden ir o no — bajo riesgo si quedan abiertas.

Una vez actualizado el PRD, re-correr esta validacion (Ciclo 2) confirmando que cada hallazgo se cerro o quedo justificado por escrito en el PRD.

---

