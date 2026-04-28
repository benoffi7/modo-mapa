# Specs: Tech debt: performance — allBusinesses lookups x16, lazy `<img>` x3, MUI chunk split, firebase/storage lazy

**PRD:** [prd.md](prd.md) (validado Sofia Ciclo 2 — VALIDADO CON OBSERVACIONES, 5 OBS-N absorbidas en este specs)
**Fecha:** 2026-04-25
**Issue:** #324

---

## Contexto y alcance tecnico

Refactor de performance en cuatro frentes:

1. **S1** — 16 callsites que violan `R4-allBusinesses-find` (14) + `R-newMap-allBusinesses` (2) deben migrar a `getBusinessById()` / `getBusinessMap()`.
2. **S2** — 3 `<img>` que violan `R6-img-without-lazy` (`MenuPhotoSection`, `MenuPhotoViewer`, `MenuPhotoUpload`).
3. **S3** — Split del manualChunk MUI (`R7`) + refactor de `firebase/storage` a dynamic import (`R8`) + drop del manualChunk `firebase/storage`. Tres sub-fases: `S3.a` (vite.config), `S3.b` (4 consumers eager), `S3.c` (drop `firebase/storage` del manualChunk).
4. **S4** — `limit()` en 7 queries `getDocs` sin paginar (specials, achievements, sharedLists), wrappeadas con `measuredGetDocs` para no romper `303/R1` (OBS-N5).
5. **S5** — Investigar chunk `index-BuuweED0` (296 KB) post-S2/S3.

No introduce colecciones nuevas, ni rules, ni Cloud Functions. Es 100% refactor + config. Detalle en cada workstream abajo.

---

## Modelo de datos

Sin cambios. No se agregan colecciones ni se modifica el shape de documentos. El singleton `getBusinessMap()` consume `allBusinesses` (dataset estatico embebido en el bundle, exportado desde `src/hooks/useBusinesses.ts`). Tipo de retorno: `Map<string, Business>`.

## Firestore Rules

Sin cambios — este feature no agrega ni modifica rules. La adicion de `limit()` en S4 es client-side y no requiere actualizar rules.

### Rules impact analysis

| Query | Coleccion | Auth context | Rule | Cambio? |
|-------|-----------|-------------|------|---------|
| `fetchSpecials` con `limit(50)` | specials | Admin | rule existente sin cambios | No |
| `fetchActiveSpecials` con `limit(20)` | specials | Cualquier user | rule existente sin cambios | No |
| `fetchAchievements` con `limit(100)` | achievements | Cualquier user | rule existente sin cambios | No |
| `saveAllAchievements` (existingSnap) con `limit(100)` | achievements | Admin | rule existente sin cambios | No |
| `fetchUserLists` con `limit(100)` | sharedLists | Owner | rule existente sin cambios | No |
| `fetchSharedWithMe` con `limit(100)` | sharedLists | Editor | rule existente sin cambios | No |
| `fetchListItems` con `limit(500)` | listItems | List access | rule existente sin cambios | No |

### Field whitelist check

N/A — no se modifican writes, solo reads. Las whitelists de `hasOnly()` no se tocan.

## Cloud Functions

Sin cambios.

## Seed Data

N/A — no se introducen colecciones nuevas ni campos requeridos nuevos.

## Componentes

Sin componentes nuevos. Componentes modificados:

- `src/components/business/MenuPhotoSection.tsx` — agrega `loading="lazy" decoding="async" width={400} height={200}` al `<img>` (linea 82).
- `src/components/business/MenuPhotoViewer.tsx` — agrega `loading="lazy" decoding="async"` al `<img>` (linea 78). No se setean dimensiones intrinsecas (modal fullscreen con `objectFit: contain`); se documenta inline.
- `src/components/business/MenuPhotoUpload.tsx` — agrega `loading="lazy" decoding="async" width={400} height={300}` al `<img>` de preview (linea 129).
- `src/components/admin/PhotoReviewCard.tsx` — refactor a dynamic `import('firebase/storage')` dentro del `useEffect` que resuelve `getDownloadURL` (linea 27-35).
- `src/components/social/RankingsView.tsx` — reemplaza `new Map(allBusinesses.map(...))` por `getBusinessMap()` directo (linea 38). El uso es drop-in: ambos shape son `Map<string, Business>`.
- `src/components/lists/FavoritesList.tsx` — reemplaza `allBusinesses.find(...)` por `getBusinessById(...)` (linea 58).
- `src/components/lists/ListDetailScreen.tsx` — idem (linea 213).
- `src/components/social/ReceivedRecommendations.tsx` — idem (lineas 65 y 100).
- `src/components/profile/RatingsList.tsx` — idem (linea 41).

### Mutable prop audit

N/A — refactor de performance, no se modifican props ni se agregan formularios.

## Textos de usuario

Sin textos nuevos. No se modifica copy user-facing.

| Texto | Donde se usa | Notas |
|-------|-------------|-------|
| (n/a) | (n/a) | Refactor 100% interno |

## Hooks

Sin hooks nuevos. Hooks modificados (todos cambian un callsite local; firma y retorno se preservan):

- `src/hooks/useDeepLinks.ts` (lineas 26 y 51) — `getBusinessById(bizId)` / `getBusinessById(lastBusinessId)`.
- `src/hooks/useNavigateToBusiness.ts` (linea 20) — `getBusinessById(businessOrId)`.
- `src/hooks/useBusinessById.ts` (linea 14) — `getBusinessById(id)`.
- `src/hooks/useRatingPrompt.ts` (lineas 120, 217) — linea 120 cambia `new Set(allBusinesses.map((b) => b.id))` por `getBusinessMap()` y usa `.has(checkIn.businessId)` directamente; linea 217 cambia `allBusinesses.find(...)` por `getBusinessById(...)`.
- `src/hooks/useSuggestions.ts` (linea 84) — `getBusinessById(fav.businessId)`. La iteracion pura de linea 66 (`allBusinesses.map(...)` para distancia) **NO se toca** — el rule `R-newMap-allBusinesses` solo flagea construccion de Map/Set para lookup, no `.map()` para proyeccion (consistente con PRD seccion S1).
- `src/hooks/useVisitHistory.ts` (linea 63) — `getBusinessById(v.businessId)`.
- `src/hooks/useCommentsListFilters.ts` (linea 48) — `getBusinessById(data.businessId)`.
- `src/hooks/useLocalTrending.ts` (linea 39-42) — **se elimina** el `useMemo` que construye `businessCoords` (lineas 39-42, no se necesita: `getBusinessById` es lookup O(1) sobre el singleton). Tambien se elimina la variable `businessCoords` del cuerpo del hook. El segundo `useMemo` (linea 45-67, filter principal con progressive radius) se preserva pero su dep array (linea 67) cambia de `[data, location.lat, location.lng, businessCoords]` → `[data, location.lat, location.lng]`. Justificacion: `getBusinessById` (y `getBusinessMap`) son referencias estables a nivel modulo (no cambian entre renders); incluirlas en deps es innecesario (mismo criterio que para imports estaticos). El loop interno (linea 50) `businessCoords.get(biz.businessId)` se reemplaza por `const biz_lookup = getBusinessById(biz.businessId); if (!biz_lookup) return false; return distanceKm(location.lat, location.lng, biz_lookup.lat, biz_lookup.lng) <= radius;`.

## Servicios

Servicios modificados:

- `src/services/feedback.ts` — `sendFeedback` (linea 16) mueve los imports `ref, uploadBytes, getDownloadURL` de eager (linea 5) a dynamic dentro del `if (mediaFile)` block; reemplaza `storage` import por `await getStorageLazy()`. Adicionalmente `fetchUserFeedback` (linea 64-69) se incluye en S4 (ver tabla — `limit(200)` + `measuredGetDocs`) por consistencia con la decision tecnica #6 y el criterio de S4 (re BLOQUEANTE #2 e IMPORTANTE #5 de Diego Ciclo 1).
- `src/services/menuPhotos.ts` — `uploadMenuPhoto`, `getMenuPhotoUrl` (linea 140) mueven los imports `ref, uploadBytesResumable, getDownloadURL` a dynamic dentro de la funcion. Tipo `UploadTask` se importa con `import type` (no contribuye al bundle runtime). `storage` import se reemplaza por `await getStorageLazy()` en cada path.
- `src/config/firebase.ts` — el singleton `storage` (linea 40) se reemplaza por funcion async `getStorageLazy()`. Se elimina el `connectStorageEmulator(storage, 'localhost', 9199)` del bloque eager (linea 60) y se mueve dentro de `getStorageLazy()`. Cache es **promise-based** (no resultado-based) para evitar race con llamadas concurrentes — ver "Snippet conceptual" (re IMPORTANTE #6).
- `src/utils/businessHelpers.ts` (linea 5) — `getBusinessById(id)?.name ?? id`.
- `src/services/specials.ts` — `fetchSpecials` y `fetchActiveSpecials` agregan `limit(50)` / `limit(20)` y se wrappean con `measuredGetDocs` (OBS-N5).
- `src/services/achievements.ts` — `fetchAchievements` y `saveAllAchievements` (`existingSnap`) agregan `limit(100)` y se wrappean con `measuredGetDocs`.
- `src/services/sharedLists.ts` — `fetchUserLists` (linea 177, `limit(100)`), `fetchSharedWithMe` (linea 203, `limit(100)`), `fetchListItems` (linea 130, `limit(500)`) — todos con `measuredGetDocs`. `deleteList` (linea 86, `itemsSnap` linea 87) NO se cappea: cascade delete necesita todos los items; se documenta comentario inline y se wrappea con `measuredGetDocs` (sin `limit`). `fetchFollowersCount` (`services/follows.ts`) se confirma fuera del scope porque usa `getCountOfflineSafe` server-side, no `getDocs` materializado.

### Snippet conceptual de `getStorageLazy()` (OBS-N2 + IMPORTANTE #6 Diego)

Reconciliado con el patron actual de `firebase.ts` que usa `import.meta.env.DEV` + `'localhost'` (no `USE_EMULATORS` + `'127.0.0.1'`). **Cache es promise-based** (no resultado-based) — esto resuelve el race con llamadas concurrentes naturalmente: la primera llamada crea la promise, llamadas paralelas comparten la misma promise pendiente, y `connectStorageEmulator` solo se invoca una vez aunque haya N callers concurrentes:

```ts
// src/config/firebase.ts
import type { FirebaseStorage } from 'firebase/storage';

let storagePromise: Promise<FirebaseStorage> | null = null;

export async function getStorageLazy(): Promise<FirebaseStorage> {
  if (!storagePromise) {
    storagePromise = (async () => {
      const { getStorage, connectStorageEmulator } = await import('firebase/storage');
      const storage = getStorage(app);
      if (import.meta.env.DEV) {
        connectStorageEmulator(storage, 'localhost', 9199);
      }
      return storage;
    })();
  }
  return storagePromise;
}
```

El branching `import.meta.env.DEV` + cadena `'localhost'` es identico al de `connectAuthEmulator`, `connectFirestoreEmulator`, `connectFunctionsEmulator` ya en uso (`firebase.ts:56-59`).

**Por que promise-based**: si dos callsites entran en paralelo (ej: `MenuPhotoSection` montandose simultaneo con `feedback.sendFeedback`), una cache `_storage: FirebaseStorage | null` permite que ambos vean `null`, ambos hagan `await import('firebase/storage')`, y ambos invoquen `connectStorageEmulator` — el SDK de Firebase tira warning/error en DEV ("already initialized"). Con cache de la promise, la segunda llamada ve la promise pendiente y reusa su resultado; el codigo dentro de la IIFE async ejecuta una sola vez.

## Integracion

### Workstream S1 — Migracion de 16 callsites

Tabla completa con archivo:linea, patron actual, patron objetivo y snippet conceptual.

#### Lookups por id (14 callsites — viola `R4-allBusinesses-find`)

| # | Archivo | Linea | Snippet actual | Snippet objetivo |
|---|---------|-------|----------------|------------------|
| 1 | `src/hooks/useDeepLinks.ts` | 26 | `const biz = allBusinesses.find((b) => b.id === bizId);` | `const biz = getBusinessById(bizId);` |
| 2 | `src/hooks/useDeepLinks.ts` | 51 | `const lastBusiness = allBusinesses.find((b) => b.id === lastBusinessId);` | `const lastBusiness = getBusinessById(lastBusinessId);` |
| 3 | `src/hooks/useNavigateToBusiness.ts` | 20 | `? allBusinesses.find((b) => b.id === businessOrId) ?? null` | `? getBusinessById(businessOrId) ?? null` |
| 4 | `src/hooks/useBusinessById.ts` | 14 | `const business = allBusinesses.find((b) => b.id === id) ?? null;` | `const business = getBusinessById(id) ?? null;` |
| 5 | `src/hooks/useRatingPrompt.ts` | 217 | `const biz = allBusinesses.find((b) => b.id === promptData.businessId);` | `const biz = getBusinessById(promptData.businessId);` |
| 6 | `src/hooks/useSuggestions.ts` | 84 | `const biz = allBusinesses.find((b: Business) => b.id === fav.businessId);` | `const biz = getBusinessById(fav.businessId);` |
| 7 | `src/hooks/useVisitHistory.ts` | 63 | `business: allBusinesses.find((b) => b.id === v.businessId) \|\| null,` | `business: getBusinessById(v.businessId) ?? null,` |
| 8 | `src/hooks/useCommentsListFilters.ts` | 48 | `business: allBusinesses.find((b) => b.id === data.businessId) \|\| null,` | `business: getBusinessById(data.businessId) ?? null,` |
| 9 | `src/components/lists/FavoritesList.tsx` | 58 | `const business = allBusinesses.find((b) => b.id === data.businessId);` | `const business = getBusinessById(data.businessId);` |
| 10 | `src/components/lists/ListDetailScreen.tsx` | 213 | `const biz = allBusinesses.find((b) => b.id === item.businessId);` | `const biz = getBusinessById(item.businessId);` |
| 11 | `src/components/social/ReceivedRecommendations.tsx` | 65 | `const business = allBusinesses.find((b) => b.id === rec.businessId);` | `const business = getBusinessById(rec.businessId);` |
| 12 | `src/components/social/ReceivedRecommendations.tsx` | 100 | `const biz = allBusinesses.find((b) => b.id === rec.businessId);` | `const biz = getBusinessById(rec.businessId);` |
| 13 | `src/components/profile/RatingsList.tsx` | 41 | `business: allBusinesses.find((b) => b.id === data.businessId) \|\| null,` | `business: getBusinessById(data.businessId) ?? null,` |
| 14 | `src/utils/businessHelpers.ts` | 5 | `return allBusinesses.find((b) => b.id === id)?.name ?? id;` | `return getBusinessById(id)?.name ?? id;` |

**Nota sobre el conteo del guard runner**: la regla `R4-allBusinesses-find` reporta hoy **15 hits**, no 14. El hit #15 es la JSDoc de `src/utils/businessMap.ts:9` (`Reemplaza el patron O(n) de `allBusinesses.find((b) => b.id === id)` con...`). El rule no excluye `src/utils/businessMap.ts` para `R4` (solo excluye para `R-newMap-allBusinesses`). Resolucion: la JSDoc debe permanecer para que el archivo siga documentando el patron prohibido — se agrega un step en el plan para **actualizar el rule en `scripts/guards/checks.mjs`** y excluir el path `src/utils/businessMap.ts` de R4 (igual que ya hace para `R-newMap-allBusinesses`). Alternativa rechazada: reescribir la JSDoc para no contener el literal — empobrece la documentacion y el patron es exactamente el que estamos prohibiendo, mencionarlo es valor.

#### Maps/Sets construidos a partir de `allBusinesses` (2 callsites — viola `R-newMap-allBusinesses`)

| # | Archivo | Linea | Snippet actual | Snippet objetivo |
|---|---------|-------|----------------|------------------|
| 15 | `src/hooks/useLocalTrending.ts` | 39-42 | `const businessCoords = useMemo(() => new Map(allBusinesses.map((b) => [b.id, { lat: b.lat, lng: b.lng }])), []);` ... `const coords = businessCoords.get(biz.businessId);` | Eliminar el `useMemo`. En el filter loop usar `const biz = getBusinessById(b.businessId); if (!biz) return false; return distanceKm(location.lat, location.lng, biz.lat, biz.lng) <= radius;` |
| 16 | `src/components/social/RankingsView.tsx` | 38 | `const businessMap = new Map(allBusinesses.map((b) => [b.id, b]));` (re-construido en cada render — sin `useMemo`) | `import { getBusinessMap } from '../../utils/businessMap';` y usar `getBusinessMap().get(biz.businessId)` directamente en el JSX (linea 147). Eliminar la variable local `businessMap`. |

**Caso especial — `useRatingPrompt.ts:120`** (Set de ids para validacion):

| # | Archivo | Linea | Snippet actual | Snippet objetivo |
|---|---------|-------|----------------|------------------|
| 17 | `src/hooks/useRatingPrompt.ts` | 120 | `const allBizIds = new Set(allBusinesses.map((b) => b.id));` ... `if (!allBizIds.has(checkIn.businessId)) continue;` | Eliminar `allBizIds`. Reemplazar por `if (!getBusinessMap().has(checkIn.businessId)) continue;` directamente en el loop (linea 147). El singleton es O(1) — no hay penalty. |

Este cambio reduce los hits de `R-newMap-allBusinesses` de 2 a 0 (fila 15 y 16) **y** elimina el unico hit de `new Set(allBusinesses.map(...))` en el codebase. El rule actual no flagea `Set`, pero el patron es identico en intencion y se elimina por consistencia (PRD lo lista explicitamente como caso especial).

#### Hidratacion del singleton (OBS-N4 + I6 cerrado)

`getBusinessMap()` se construye en el primer acceso a partir de `allBusinesses` importado de `src/hooks/useBusinesses.ts`. Si un caller corre antes de la hidratacion (test mock con `allBusinesses.length = 0`, o caso edge en runtime), `getBusinessMap()` retorna `Map` vacio y `getBusinessById(id)` retorna `undefined`.

**Comportamiento actual a preservar** (OBS-N4): cada caller que mapea items con un `business` ya devuelve `null` cuando el lookup falla. Se preserva la semantica exacta:

| Caller | Actual con `allBusinesses.find()` | Post-migracion con `getBusinessById()` |
|--------|-----------------------------------|----------------------------------------|
| `FavoritesList` | `allBusinesses.find(...)` retorna `undefined` → `if (business)` filtra el item | `getBusinessById(...)` retorna `undefined` → mismo filtro, mismo comportamiento |
| `RatingsList` | `\|\| null` → item se renderiza con `business: null` | `?? null` → idem |
| `ReceivedRecommendations` | igual | idem |
| `ListDetailScreen` | `if (biz)` antes de renderizar | idem |
| `useVisitHistory` | `\|\| null` → render con `business: null` | `?? null` → idem |
| `useCommentsListFilters` | `\|\| null` → render con `business: null` | `?? null` → idem |
| `useSuggestions` (linea 84) | `if (biz)` antes de incrementar categoria | idem |

Regla: **no cambiar el operador `\|\| null` por `?? null` si cambia el comportamiento para `undefined`**. En este caso ambos son equivalentes (`undefined \|\| null === null` y `undefined ?? null === null`). Donde el codigo hace `if (business)` antes de procesar, no se cambia (el if-guard ya cubre `undefined`).

### Workstream S2 — Lazy `<img>` (3 callsites)

Cada `<img>` recibe `loading="lazy"`, `decoding="async"`, y `width`/`height` HTML para reservar layout (evita CLS):

| # | Archivo | Linea | Cambio |
|---|---------|-------|--------|
| 1 | `src/components/business/MenuPhotoSection.tsx` | 82 | Agregar atributos: `loading="lazy" decoding="async" width={400} height={200}`. Mantener `style={{ width: '100%', maxHeight: 200, objectFit: 'cover', borderRadius: 4 }}` y `onError={() => setPhotoUrl(null)}`. Las dimensiones HTML reservan el layout box; `width: '100%'` en style sigue dominando el tamano visual. |
| 2 | `src/components/business/MenuPhotoViewer.tsx` | 78 | Agregar atributos: `loading="lazy" decoding="async"`. **No** setear `width`/`height` HTML — modal fullscreen con `objectFit: contain` necesita auto-fit. Documentar inline con comentario. Mantener `onError={() => setImageError(true)}`. |
| 3 | `src/components/business/MenuPhotoUpload.tsx` | 129 | Agregar atributos: `loading="lazy" decoding="async" width={400} height={300}`. El src es preview local (FileReader → data URL), pero el guard `R6-img-without-lazy` no distingue origen. Mantener `style={{ maxWidth: '100%', maxHeight: 300, objectFit: 'contain', borderRadius: 8 }}`. |

**No usar `loading="eager"`**: ningun `<img>` es hero ni LCP critico — `MenuPhotoSection` esta dentro del business sheet (solo se monta cuando el sheet abre); `MenuPhotoViewer` es modal post-tap; `MenuPhotoUpload` es preview post-seleccion de archivo.

### Workstream S3.a — Split MUI manualChunk

`vite.config.ts` linea 117-122:

```ts
// Antes
manualChunks: {
  firebase: ['firebase/app', 'firebase/auth', 'firebase/firestore', 'firebase/storage'],
  mui: ['@mui/material', '@mui/icons-material'],
  recharts: ['recharts'],
  'google-maps': ['@vis.gl/react-google-maps'],
},

// Despues (S3.a — drop firebase/storage en S3.c)
manualChunks: {
  firebase: ['firebase/app', 'firebase/auth', 'firebase/firestore', 'firebase/storage'], // S3.c lo limpia
  'mui-core': ['@mui/material', '@mui/system'],
  'mui-icons': ['@mui/icons-material'],
  recharts: ['recharts'],
  'google-maps': ['@vis.gl/react-google-maps'],
},
```

Verificacion: `npm run guards --guard 302` debe reportar `R7-mui-icons-not-split: 0 hits`.

### Workstream S3.b — Refactor de 4 consumers eager de `firebase/storage`

Cuatro archivos pasan de eager a dynamic import. La condicion necesaria para que S3.c tenga efecto es que NO quede ningun import estatico (top-level) de `firebase/storage` en el grafo de modulos.

#### Consumer 1 — `src/config/firebase.ts`

| Aspecto | Antes | Despues |
|---------|-------|---------|
| Import (linea 12) | `import { getStorage, connectStorageEmulator } from 'firebase/storage';` | (eliminado) |
| Singleton (linea 40) | `export const storage = getStorage(app);` | (eliminado) — reemplazado por `getStorageLazy()` async |
| Emulator wire-up (linea 60) | `connectStorageEmulator(storage, 'localhost', 9199);` | (eliminado del bloque eager) — movido al cuerpo de `getStorageLazy()` |
| API publica nueva | (n/a) | `export async function getStorageLazy(): Promise<FirebaseStorage>` con cache interno **promise-based** (`storagePromise: Promise<FirebaseStorage> \| null`) — resuelve race en llamadas concurrentes |

Snippet completo de la API nueva en seccion **"Snippet conceptual de `getStorageLazy()`"** arriba.

#### Consumer 2 — `src/services/feedback.ts` (funcion `sendFeedback`)

**Nombre real verificado** (re BLOQUEANTE #2 Diego Ciclo 1): la funcion exportada en `src/services/feedback.ts:16` se llama `sendFeedback`, no `submitFeedback`. Todas las menciones del specs estan corregidas a `sendFeedback`.

| Aspecto | Antes | Despues |
|---------|-------|---------|
| Import (linea 5) | `import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';` | (eliminado) |
| Import indirecto (linea 6) | `import { db, storage } from '../config/firebase';` | `import { db } from '../config/firebase';` + import dinamico de `getStorageLazy` (ver abajo) (OBS-N3) |
| Path de upload (lineas 52-59 dentro de `sendFeedback`) | `const storageRef = ref(storage, storagePath); await uploadBytes(...); const mediaUrl = await getDownloadURL(...);` | Dentro del `if (mediaFile)`: `const { ref, uploadBytes, getDownloadURL } = await import('firebase/storage'); const { getStorageLazy } = await import('../config/firebase'); const storage = await getStorageLazy(); const storageRef = ref(storage, storagePath); ...` |

Decisiones tecnicas:
- Se hace el `await import('../config/firebase')` para `getStorageLazy` solo dentro del bloque `if (mediaFile)` de `sendFeedback`. Si el feedback no incluye media, no se carga nada de `firebase/storage`. **Alternativa rechazada**: re-exportar `getStorageLazy` como named import top-level — funciona pero arrastra el modulo al chunk principal de feedback. Como feedback se usa en mucho codigo, no queremos arrastrarlo.
- Se permite el `await import('../config/firebase')` para reusar el cache (`storagePromise`) entre llamadas concurrentes.

#### Consumer 3 — `src/services/menuPhotos.ts`

| Aspecto | Antes | Despues |
|---------|-------|---------|
| Import (linea 5) | `import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';` | (eliminado) |
| Type-only (linea 8) | `import type { UploadTask } from 'firebase/storage';` | **Mantener** — es `import type`, no contribuye al bundle runtime (el TypeScript compiler lo elide). |
| Import indirecto (linea 9) | `import { db, storage, functions } from '../config/firebase';` | `import { db, functions } from '../config/firebase';` + import dinamico de `getStorageLazy` (OBS-N3) |
| `uploadMenuPhoto` (lineas 56-57) | `const storageRef = ref(storage, storagePath); const uploadTask: UploadTask = uploadBytesResumable(storageRef, file, ...);` | Al inicio de la fase de upload (despues del check de `pendingSnap`): `const { ref, uploadBytesResumable } = await import('firebase/storage'); const { getStorageLazy } = await import('../config/firebase'); const storage = await getStorageLazy(); const storageRef = ref(storage, storagePath); const uploadTask: UploadTask = uploadBytesResumable(...);` |
| `getMenuPhotoUrl` (linea 140 — firma; cuerpo en 141) | `return getDownloadURL(ref(storage, path));` | `const { ref, getDownloadURL } = await import('firebase/storage'); const { getStorageLazy } = await import('../config/firebase'); const storage = await getStorageLazy(); return getDownloadURL(ref(storage, path));` |

Decisiones tecnicas:
- `getMenuPhotoUrl` se invoca desde `MenuPhotoSection` cada vez que se monta — esto introduce un overhead de `await import('firebase/storage')` en el primer mount. Es esperado (no medible vs. la latencia del `getDownloadURL` en si). Despues del primer await, los chunks ya estan en cache del browser y subsecuentes calls son sincronicos en terminos de bundle.

#### Consumer 4 — `src/components/admin/PhotoReviewCard.tsx` (OBS-N1 — corregido)

**Inexactitud factual del PRD:** el PRD lista el import como `ref, deleteObject` pero el real (`PhotoReviewCard.tsx:4`) es `ref, getDownloadURL`. El delete pasa por `services/adminPhotos.ts → deleteMenuPhoto` (callable HTTPS), que **no usa `firebase/storage`**. El componente solo usa `firebase/storage` para resolver la URL del thumbnail al montar la card.

| Aspecto | Antes | Despues |
|---------|-------|---------|
| Import (linea 4) | `import { ref, getDownloadURL } from 'firebase/storage';` | (eliminado) |
| Import indirecto (linea 5) | `import { storage } from '../../config/firebase';` | (eliminado) — se re-importa dinamicamente como en consumers 2 y 3 (OBS-N3) |
| `useEffect` (lineas 27-35) | `useEffect(() => { ...; getDownloadURL(ref(storage, path)).then(...).catch(...); ...}, [photo]);` | Cambiar la callback del `useEffect` a un IIFE async: `useEffect(() => { let cancelled = false; (async () => { const path = photo.thumbnailPath \|\| photo.storagePath; if (!path) return; try { const { ref, getDownloadURL } = await import('firebase/storage'); const { getStorageLazy } = await import('../../config/firebase'); const storage = await getStorageLazy(); const url = await getDownloadURL(ref(storage, path)); if (!cancelled) setImageUrl(url); } catch (err) { logger.error('[PhotoReviewCard] getDownloadURL failed:', err); if (!cancelled) setImageUrl(null); } })(); return () => { cancelled = true; }; }, [photo]);` |

Decisiones tecnicas:
- El `useEffect` queda con una IIFE async (patron estandar React). El cleanup `cancelled` se preserva igual que el original.
- El handler `handleDelete` (linea 62) queda **sin cambios** — sigue invocando `deleteMenuPhoto` (callable HTTPS), no necesita `firebase/storage`.

#### Auditoria de importadores indirectos (consolidada por OBS-N3)

Buscar `from '../config/firebase'` o `from '../../config/firebase'` con `storage` en el destructure. Resultado del filesystem:

```text
src/services/feedback.ts:6     → import { db, storage } from '../config/firebase';
src/services/menuPhotos.ts:9   → import { db, storage, functions } from '../config/firebase';
src/components/admin/PhotoReviewCard.tsx:5 → import { storage } from '../../config/firebase';
```

Los 3 callsites indirectos coinciden 1:1 con los consumers 2/3/4 de S3.b — no hay consumers fuera de la lista. Tras eliminar el `storage` const de `firebase.ts` (Consumer 1), TypeScript arroja error de import en estos 3 archivos durante el build, lo que sirve como verificacion automatica de que la auditoria es exhaustiva. Un `tsc -b` post-cambio que pasa = no quedan importadores indirectos sin migrar.

### Workstream S3.c — Drop `firebase/storage` del manualChunk

Solo despues de S3.b completo. Cambio en `vite.config.ts`:

```ts
manualChunks: {
  firebase: ['firebase/app', 'firebase/auth', 'firebase/firestore'], // sin 'firebase/storage'
  'mui-core': ['@mui/material', '@mui/system'],
  'mui-icons': ['@mui/icons-material'],
  recharts: ['recharts'],
  'google-maps': ['@vis.gl/react-google-maps'],
},
```

Verificacion automatica:

1. `npm run guards --guard 302` — `R8-firebase-storage-in-critical: 0 hits`.
2. `npx vite build` — el chunk `firebase-*` reportado por Rollup baja de ~449 KB a <= 350 KB.
3. `ANALYZE=1 npm run build` y abrir `dist/stats.html` — `firebase/storage/*` debe aparecer en un chunk separado (sin nombre fijo, generado on-demand) y NO en el chunk `firebase`.

**Riesgo si se hace antes que S3.b**: ningun efecto. Rollup colapsa `firebase/storage` al chunk principal porque hay imports estaticos en el grafo. Por eso el plan lo coloca **inmediatamente despues de S3.b**.

### Workstream S4 — `limit()` en 8 queries (con `measuredGetDocs` — OBS-N5)

OBS-N5 advierte que el guard `303/R1-services-raw-getDocs` ya esta activo y los `getDocs` crudos en services fallan el guard si no se wrappean con `measuredGetDocs`/`measuredGetDoc`. **Decision tecnica**: en este feature, los callsites de S4 NO solo agregan `limit()` — tambien se migran a `measuredGetDocs` en el mismo cambio. Esto cierra dos issues en uno (S4 + adelanta parte del scope de #325 para los archivos tocados).

Importes adicionales requeridos en cada service:
- `import { measuredGetDocs } from '../utils/perfMetrics';`
- `import { ..., limit } from 'firebase/firestore';`

**Numeros de linea verificados con `grep -n` sobre HEAD de `new-home`** (re BLOQUEANTE #1 Diego Ciclo 1):

| # | Service | Funcion | Cap | Cambio |
|---|---------|---------|-----|--------|
| 1 | `services/specials.ts:14` | `fetchSpecials` | `limit(50)` | `await measuredGetDocs('specials_fetchAll', query(collection(db, COLLECTIONS.SPECIALS), orderBy('order'), limit(50)))` |
| 2 | `services/specials.ts:31` | `fetchActiveSpecials` | `limit(20)` | `await measuredGetDocs('specials_fetchActive', query(collection(db, COLLECTIONS.SPECIALS), where('active', '==', true), orderBy('order'), limit(20)))` |
| 3 | `services/achievements.ts:14` | `fetchAchievements` | `limit(100)` | `await measuredGetDocs('achievements_fetchAll', query(collection(db, COLLECTIONS.ACHIEVEMENTS), orderBy('order'), limit(100)))` |
| 4 | `services/achievements.ts:23` | `saveAllAchievements` (`existingSnap`) | `limit(100)` | `await measuredGetDocs('achievements_existingForCleanup', query(collection(db, COLLECTIONS.ACHIEVEMENTS), limit(100)))` |
| 5 | `services/sharedLists.ts:177` | `fetchUserLists` | `limit(100)` | `await measuredGetDocs('sharedLists_userLists', query(getSharedListsCollection(), where('ownerId', '==', userId), orderBy('updatedAt', 'desc'), limit(100)))` |
| 6 | `services/sharedLists.ts:203` | `fetchSharedWithMe` | `limit(100)` | `await measuredGetDocs('sharedLists_sharedWithMe', query(getSharedListsCollection(), where('editorIds', 'array-contains', userId), orderBy('updatedAt', 'desc'), limit(100)))` |
| 7 | `services/sharedLists.ts:130` | `fetchListItems` | `limit(500)` | `await measuredGetDocs('sharedLists_listItems', query(collection(db, COLLECTIONS.LIST_ITEMS).withConverter(listItemConverter), where('listId', '==', listId), limit(500)))` |
| 8 | `services/feedback.ts:64` | `fetchUserFeedback` | `limit(200)` | `await measuredGetDocs('feedback_userFeedback', query(ref, where('userId', '==', userId), orderBy('createdAt', 'desc'), limit(200)))` — re IMPORTANTE #5 Diego: incluido por consistencia (mismo criterio que el resto de S4: cierra hit de R1 y limita exposicion a billing DoS si un user tiene 10K+ feedbacks). |

**Wrap-only sin `limit()` (cumple `303/R1` pero no agrega cap):**

| # | Service | Funcion | Razon |
|---|---------|---------|-------|
| 9 | `services/sharedLists.ts:86` | `deleteList` (`itemsSnap`, linea 87) | Cascade delete necesita iterar todos los items. Wrappeado con `measuredGetDocs('sharedLists_deleteListItems', ...)` y comentario inline: `// No limit() — cascade delete needs all items. Firestore batch limit (500) is enforced manually below.` |

**Excluidos del scope de S4** (no se tocan en este feature):

| Archivo | Funcion | Razon |
|---------|---------|-------|
| `services/follows.ts` | `fetchFollowersCount` | Usa `getCountOfflineSafe` (server-side count), no `getDocs` materializado. `limit()` no aplica al COUNT aggregate. |

**Cuidado con `measureAsync` y guard 303**: el rule `303/R1` busca `getDocs(` o `getDoc(` directos en `src/services/` (no admin). Wrappear con `measuredGetDocs` es la sustitucion correcta (importa la API, no solo el wrap). Verificar con `npm run guards --guard 303 --rule R1-services-raw-getDocs` — los 8 callsites de S4 + el wrap-only de `deleteList` deben quitar de la lista de hits (delta 9 hits cerrados por #324).

**Auditoria post-S4** (re OBSERVACION #11 Diego Ciclo 1): correr `npm run guards --guard 303 --rule R1-services-raw-getDocs` antes y despues. El delta debe ser <= 0 (no introduce nuevos hits). Lista cerrada: confirmar que ningun otro service tocado por S3.b (i.e. `feedback.ts`, `menuPhotos.ts`) tiene `getDocs` crudos no listados. Tras S4, los 9 callsites listados arriba quitan de la lista de hits R1.

### Workstream S5 — Investigar chunk `index-BuuweED0` (296 KB)

Investigacion no destructiva. Pasos:

1. Ejecutar `ANALYZE=1 npm run build` (el `vite.config.ts` ya activa `rollup-plugin-visualizer` con `process.env.ANALYZE`).
2. Abrir `dist/stats.html` y filtrar por el chunk `index-*` que pesa 296 KB. El nombre cambia con cada build (hash) — buscar por tamano.
3. Inspeccionar los modulos colapsados. Hipotesis tecnicas:
   - **Codigo de admin** que se cargo eager por barrel re-export: si aparece, separar via `manualChunks` con clave `admin: [...]` o usar `React.lazy` adicional.
   - **Stats utilities** colapsados al main entry (charts pre-process): si aparece, mover a su propio chunk.
   - **Duplicacion del entry**: mismo modulo en dos chunks por barrel. Cerrar via `manualChunks` explicito.
4. Documentar finding en el plan o como issue followup. Si el finding requiere cambio tecnico no trivial, abrir issue separado y dejar S5 como "investigado" en el cierre del feature.

S5 no tiene impacto de build verificable obligatorio (Success Criteria #2 se mide independiente). Si la investigacion no produce accion, igual queda registrado el finding.

### Preventive checklist

- [x] **Service layer**: ningun componente importa `firebase/firestore` para writes. PhotoReviewCard se mantiene en componente porque ya tiene services (`adminPhotos`); solo el `getDownloadURL` queda dynamic-imported (acceptable por estar lazy a nivel ruta admin y ser un read).
- [x] **Duplicated constants**: ningun array/objeto nuevo. `getBusinessMap()` ya es la unica fuente.
- [x] **Context-first data**: ningun componente hace `getDoc` para datos en Context.
- [x] **Silent .catch**: los `useEffect` async preservan `logger.error` existente.
- [x] **Stale props**: refactor sin cambio de props.

## Tests

### Archivos de test a crear/modificar

| Archivo | Que testear | Tipo |
|---------|-------------|------|
| `src/utils/businessMap.test.ts` | **Hidratacion (OBS-N4)**: agregar test que verifica que con `allBusinesses.length = 0` (mock), `getBusinessMap()` retorna `Map` vacio (`size === 0`) y `getBusinessById('cualquier-id')` retorna `undefined`. **Nota**: el mock actual usa `vi.mock('../hooks/useBusinesses')` con array fijo — agregar bloque `describe('hidratacion vacia')` con un mock alternativo via `vi.doMock` antes del import del modulo, llamar `__resetBusinessMap()`, verificar tamanos. | Unit (existente — agregar bloque) |
| `src/utils/businessHelpers.test.ts` | **Verificacion**: `getBusinessName('id_invalido')` retorna el id. Mock con `__resetBusinessMap()` en `beforeEach`. | Unit (existente — verificar que sigue pasando) |
| `src/hooks/useBusinessById.test.ts` | **Cobertura**: `found` (id valido), `not_found` (id invalido), `invalid_id` (string vacio). Verificar que el resultado pasa por `getBusinessById` (mock del modulo). | Unit (nuevo si no existe — el hook esta en lista de R5-hooks-without-test del guard 301) |
| `src/hooks/useDeepLinks.test.ts` | **Cobertura**: deep link `?business=biz_001` selecciona biz; `?business=invalid` no navega. Mock de `getBusinessById`. | Unit (nuevo si no existe) |
| `src/hooks/useNavigateToBusiness.test.ts` | **Cobertura**: si recibe id valido, navega; si recibe id invalido, no navega. | Unit (existente — verificar que pasa) |
| `src/hooks/useRatingPrompt.test.ts` | **Cobertura**: el filter de check-ins usa `getBusinessMap().has(...)` (mock del singleton vacio o con biz especifico). El `navigateToBusiness` usa `getBusinessById`. | Unit (existente — actualizar) |
| `src/hooks/useSuggestions.test.ts` | **Verificacion**: scoring de categorias sigue funcionando despues del swap. La iteracion linea 66 (no migrada) sigue produciendo el mismo orden. | Unit (existente — verificar que pasa) |
| `src/hooks/useVisitHistory.test.ts` | **Cobertura**: `visitsWithBusiness` resuelve `business: null` para id desconocido; resuelve correctamente para id conocido. | Unit (nuevo) |
| `src/hooks/useCommentsListFilters.test.ts` | **Cobertura**: filter por business resuelve via singleton; comments con businessId desconocido tienen `business: null` (no se filtra el item — preserva comportamiento actual). | Unit (nuevo) |
| `src/hooks/useLocalTrending.test.ts` | **Cobertura**: con `getBusinessMap()` retornando Map vacio, el filter retorna 0 resultados (sin crash). Con businesses validos, el progressive radius funciona como antes. | Unit (verificar/nuevo) |
| `src/components/business/MenuPhotoSection.test.tsx` | **Verificacion DOM**: el `<img>` rendereado tiene `loading="lazy"`, `decoding="async"`, `width=400`, `height=200`. Usar `render` + `screen.getByRole('img')` o `getByAltText('Menú')` y comprobar `getAttribute`. | Unit (nuevo o actualizar) |
| `src/components/business/MenuPhotoViewer.test.tsx` | **Verificacion DOM**: `loading="lazy"`, `decoding="async"`. No verificar dimensiones (intentional). | Unit (nuevo) |
| `src/components/business/MenuPhotoUpload.test.tsx` | **Verificacion DOM**: con preview presente, el `<img>` tiene `loading="lazy"`, `decoding="async"`, `width=400`, `height=300`. | Unit (nuevo) |
| `src/components/social/RankingsView.test.tsx` | **Cobertura**: el zoneTrending mapping resuelve via `getBusinessMap().get(...)` y pasa `fullBusiness` a `TrendingBusinessCard`. Mock del singleton. | Unit (existente — actualizar) |
| `src/services/specials.test.ts` | **Cobertura `limit()`**: `fetchActiveSpecials` arma query con `limit(20)`. Verificar via spy de `query()` que recibe `where('active', '==', true), orderBy('order'), limit(20)`. Tambien verificar que el call pasa por `measuredGetDocs` (spy/mock del modulo `perfMetrics`). | Unit (nuevo) |
| `src/services/achievements.test.ts` | **Cobertura `limit()`**: `fetchAchievements` con `limit(100)`. `saveAllAchievements` `existingSnap` con `limit(100)`. Pasa por `measuredGetDocs`. | Unit (nuevo) |
| `src/services/sharedLists.test.ts` | **Cobertura `limit()`**: `fetchUserLists`, `fetchSharedWithMe`, `fetchListItems` con sus caps. `deleteList` SIN `limit` (preservado). Todos con `measuredGetDocs`. | Unit (existente — agregar bloque) |
| `src/config/firebase.test.ts` | **Cobertura nueva — REQUERIDO** (re IMPORTANTE #7 Diego: politica de tests pide >= 80% en codigo nuevo; tests indirectos mockean el modulo, no testean implementacion real). Tests minimos: (a) **cache miss**: primera llamada llama `getStorage(app)` y resuelve; (b) **cache hit**: segunda llamada retorna mismo storage sin re-importar `firebase/storage` (verificar via spy de `vi.fn()` con `toHaveBeenCalledTimes(1)`); (c) **emulator wiring DEV**: con `import.meta.env.DEV = true`, llama `connectStorageEmulator(storage, 'localhost', 9199)` exactamente una vez aunque haya N llamadas concurrentes (verificar con `Promise.all([getStorageLazy(), getStorageLazy(), getStorageLazy()])` y `connectStorageEmulator.toHaveBeenCalledTimes(1)`); (d) **emulator wiring PROD**: con `import.meta.env.DEV = false`, NO llama `connectStorageEmulator`. Mock de `firebase/storage` con `vi.mock` + `vi.hoisted` para spies. | Unit (nuevo — REQUERIDO, no opcional) |
| `vite.config.ts` | **N/A** — verificable por `npm run guards --guard 302` (`R7`, `R8`) + `npx vite build` y comparacion con baseline. | (no test unitario) |

### Bundle size test post-build (CI artifact — definicion completa, re IMPORTANTE #8 Diego)

**Ubicacion del script**: `scripts/bundle-size-check.mjs` (consistente con otros scripts del repo: `scripts/guards/run.mjs`, `scripts/seed-*.ts`, etc.).

**Invocacion**: agregar a `package.json` un script:
```json
"test:bundle-size": "node scripts/bundle-size-check.mjs"
```

**Dependencias**: usa **solo APIs nativas de Node** — `node:fs/promises` (leer `dist/assets/*.js`) + `node:zlib` (`gzipSync` para medir gzipped). **No agregar deps nuevas** (`gzip-size` rechazado para evitar dep adicional sin justificacion).

**Algoritmo**:
1. Asume `dist/` existe (CI corre `npm run build` antes — el script no rebuildea).
2. Lee `dist/assets/*.js` con `fs.readdir` + `fs.readFile`.
3. Para cada archivo emitido por Rollup, agrupa por chunk-name pattern (extraer prefijo antes del hash, e.g. `firebase-CK1zEjci.js` → `firebase`).
4. Verifica thresholds (numericos heredados del PRD success criteria):
   - `firebase-*.js` raw size <= 350 KB (post-S3.c, sin `firebase/storage`)
   - `mui-core-*.js` raw size <= 200 KB (post-S3.a)
   - `mui-icons-*.js` chunk EXISTE (separado de `mui-core`) — fail si no se emite
   - Suma de chunks que entran en critical path (entry + firebase + mui-core + recharts + google-maps) <= 1 MB raw / <= 700 KB gzipped
5. Falla con `process.exit(1)` si algun threshold se excede; imprime tabla en stdout.

**Gate de CI**: el script entra como **step bloqueante en el workflow de PR** (post-`npm run build`). Job entry en `.github/workflows/ci.yml` o equivalente, encadenado tras `vite build`. Bloquea merge si falla.

**Relacion con `guards`**: NO entra al runner de `npm run guards` (el runner usa `grep`-based static analysis; bundle size es runtime/build-time). Step independiente en CI.

**Artifact**: el job de CI archiva `dist/stats.html` (ya disponible con `ANALYZE=1`) y el output del script `bundle-size-check.mjs` como artifact (para facilitar debug si falla).

**Nota**: este test es CI-only, no se corre en `vitest`. Se documenta en el plan como step de verificacion post-merge **y como gate bloqueante en PR**.

### Estrategia de mocks

- `vi.mock('../hooks/useBusinesses', () => ({ allBusinesses: [...] }))` con dataset fijo, hoisted (`vi.hoisted` si se necesita reuso entre tests).
- `__resetBusinessMap()` en `beforeEach` para garantizar singleton fresco.
- `vi.mock('../utils/perfMetrics')` para los tests de service que verifican el wrap.
- Para `getStorageLazy()` tests: `vi.mock('firebase/storage', () => ({ getStorage: vi.fn(...), connectStorageEmulator: vi.fn() }))` con `vi.hoisted`.

## Analytics

Sin nuevos `trackEvent`. Los existentes (`feedback_submit`, `menu_photo_upload`, `list_created`, etc.) se preservan sin cambios.

---

## Offline

Sin nuevos flujos offline. Los cambios son neutros respecto a connectivity:

### Cache strategy

| Dato | Estrategia | TTL | Storage |
|------|-----------|-----|---------|
| `getBusinessMap()` | In-memory singleton | Vida del modulo | Heap (no persistencia) |
| `<img loading="lazy">` thumbnails | Workbox runtime cache (existente) | n/a | Service worker |
| Firestore reads con `limit()` | Persistencia offline (existente) | n/a | IndexedDB (Firestore SDK) |
| `firebase/storage` lazy chunk | Browser cache + service worker (existente) | n/a | Cache API |

### Writes offline

| Operacion | Mecanismo | Conflict resolution |
|-----------|-----------|---------------------|
| `sendFeedback` con media | El `await import('firebase/storage')` falla offline → captura el error y propaga al toast existente | Usuario reintenta cuando vuelve la conexion |
| `uploadMenuPhoto` | El `await import('firebase/storage')` falla offline | Componente ya tiene guard `useConnectivity` (`MenuPhotoUpload.tsx:155`) — boton deshabilitado offline |

### Fallback UI

Sin cambios. Los componentes ya tienen `useConnectivity` y deshabilitan los botones de upload offline. El `await import('firebase/storage')` agrega un punto de fallo extra (modulo no descargado), pero solo afecta el primer mount post-online — el SW cachea el chunk despues. En el peor caso (offline + chunk no cacheado), el flujo de upload falla con `Failed to fetch dynamically imported module` → captura en el `try/catch` existente y se muestra toast generico.

---

## Performance baseline numerico (heredado del PRD)

### Pre-#324 (medido 2026-04-25 con `npx vite build`)

| Chunk | Raw | Gzipped |
|-------|-----|---------|
| `mui` (monolitico) | 474 KB | ~146 KB |
| `firebase` (incluye storage) | 449 KB | ~140 KB |
| `index-CK_zEjci` (entry) | 438 KB | ~149 KB |
| `recharts` | 366 KB | ~110 KB |
| `index-BuuweED0` (huerfano) | 296 KB | ~98 KB |

**Total bundle inicial**: ~1.6 MB raw / ~640 KB gzipped (orientativo).

### Post-#324 (targets)

| Chunk / metrica | Target | Mecanismo (workstream) |
|-----------------|--------|------------------------|
| `mui-core` | <= 200 KB raw | S3.a (split MUI) |
| `mui-icons` | (separado, lazy on-demand) | S3.a |
| `firebase` | <= 350 KB raw | S3.b + S3.c (drop storage) |
| `firebase/storage` | (chunk async on-demand, no en critical path) | S3.b + S3.c |
| Bundle inicial total | <= 1 MB raw / <= 700 KB gzipped | Combinacion S3 + S5 si aplica |

### Baseline de `npm run guards --guard 302` (pre-#324)

| Rule | Hits actuales | Hits esperados post-#324 |
|------|---------------|--------------------------|
| `R4-allBusinesses-find` | 15 (14 callsites + 1 JSDoc en `businessMap.ts`) | 0 (con exclusion de `businessMap.ts` agregada al rule) |
| `R-newMap-allBusinesses` | 2 | 0 |
| `R6-img-without-lazy` | 3 | 0 |
| `R7-mui-icons-not-split` | 1 | 0 |
| `R8-firebase-storage-in-critical` | **0 hits reportados, pero el rule tiene un bug** (re IMPORTANTE #9 Diego). El awk pattern es `awk "/'firebase':/,/]/" vite.config.ts` — espera la key entre comillas (`'firebase':`), pero el `vite.config.ts` actual usa la key sin quote (`firebase:` linea 118). Por eso el awk no matchea, el grep recibe vacio, y R8 reporta 0. **Estado real**: el `vite.config.ts` linea 118 SI incluye `'firebase/storage'` en el manualChunk firebase, lo que el rule pretende prohibir. | 0 (corregido por S3.c — ademas el rule deberia patcharse para detectar el caso real) |

**Reconciliacion del bug del rule R8** (re IMPORTANTE #9): el plan agrega un step explicito para **patchear `scripts/guards/checks.mjs:138`** y aceptar tanto el formato con quotes (`'firebase':`) como sin quotes (`firebase:`). Patron sugerido: `awk "/[\"']?firebase[\"']?:/,/]/" vite.config.ts | grep "firebase/storage" || true`. Con el fix, el rule pre-#324 reporta 1 hit (estado real) y post-S3.c reporta 0 (estado objetivo). Sin el fix, el rule reporta siempre 0 y no aporta gate util. Decision: el fix del rule entra al mismo PR que S3.c (consistente con la decision de excluir `businessMap.ts` del rule R4 — las modificaciones a `checks.mjs` que el feature necesita van en el mismo plan).

---

## Coordinacion con #325 (OBS-N5)

El issue #325 (perf-instrumentation followup) cubre el wrap masivo de `getDocs`/`getDoc` con `measuredGet*` para cumplir `303/R1-services-raw-getDocs`. Este issue (#324) toca 9 callsites de service que se tocan en S4 (8 con `limit()` + 1 wrap-only en `deleteList`).

**Decision tecnica**: en S4, los 9 callsites se migran a `measuredGetDocs` **al mismo tiempo** que se les agrega `limit()` (cuando aplica). Justificacion:

1. Si el plan deja los `getDocs` crudos con `limit()`, `npm run guards --guard 303 --rule R1-services-raw-getDocs` queda con 9 hits adicionales — pero ya tiene 44 hits hoy, asi que no agrega ruido.
2. Si #325 mergea antes de #324, los `limit()` se agregan a `getDocs` que ya estarian wrappeados — la implementacion seria distinta (modificar la query, no el wrap).
3. Si #324 mergea antes de #325, los 9 callsites quedan adelantados (cierran 9 de los 44 hits de R1).

**Orden recomendado** (sin bloqueos cruzados):
- S4 hace los dos cambios juntos: `limit()` + `measuredGetDocs`. No depende de #325.
- #325 cubre los 35 callsites restantes (44 - 9 = 35). No depende de #324.
- Cuando ambos mergeen, R1 baja a 0 hits (#325 cierra el resto).

Si en algun momento de la implementacion #325 esta activo en otra rama, el implementador debe coordinar con tech-lead para resolver merge conflicts en los 9 archivos de S4 (probables conflictos en imports y firmas de query).

---

## Rollout — orden de workstreams

Orden de implementacion (input para el plan):

1. **S1** (16 callsites) — refactor mecanico, cero riesgo. Base para todo lo demas.
2. **S2** (3 `<img>`) — cambio de atributos HTML. Independiente.
3. **S4** (7 queries con `limit()` + `measuredGetDocs`) — defensivo. Tras S1 para no mezclar refactor de lookups con caps en el mismo PR. Coordinar con #325 (OBS-N5).
4. **S3.a** (split MUI manualChunk) — cambio en `vite.config.ts`. Independiente. Verificable por guard `R7`.
5. **S3.b** (refactor 4 consumers de `firebase/storage`) — el cambio mas grande. Tras S3.a para que el reordering de chunks ya este aplicado al medir.
6. **S3.c** (drop `firebase/storage` del manualChunk) — inmediatamente despues de S3.b. One-line change con verificacion via `dist/stats.html`.
7. **S5** (investigar `index-BuuweED0`) — al final, post-S2/S3, con baseline limpio (asi `index-*` no incluye chunks que ya fueron movidos).

Cada workstream produce un commit separable (o agrupado en S1+S2 si el plan los junta). El feature mergea en una sola PR.

---

## Decisiones tecnicas

1. **`getStorageLazy()` reemplaza el singleton `storage` const en lugar de mantener ambos**. Alternativa rechazada: mantener `storage` const eager + agregar `getStorageLazy()` lazy. Razon de rechazo: el singleton eager es lo que ata `firebase/storage` al chunk de firebase critico. Mantenerlo no resuelve nada. Decision: breaking change interno con migracion de los 3 importadores indirectos.

2. **`measuredGetDocs` adelantado en los 9 callsites de S4 en vez de dejarlo para #325**. Alternativa: agregar solo `limit()` y dejar el wrap para #325. Razon de rechazo: incremental implementation cost es bajo (cada callsite ya se va a tocar; agregar el wrap es un cambio adicional de 1 linea). Beneficio: cierra 9 de los 44 hits de R1 sin coordinar con otra rama (8 con `limit()` + 1 wrap-only en `deleteList`).

3. **JSDoc en `businessMap.ts:9` que menciona el patron prohibido se preserva, y se actualiza el rule del guard para excluir `src/utils/businessMap.ts`**. Alternativa rechazada: reescribir la JSDoc para no contener `allBusinesses.find`. Razon de rechazo: la JSDoc explica exactamente lo que el archivo reemplaza — quitar el literal empobrece la documentacion. Cambio de rule: agregar `| grep -v "src/utils/businessMap.ts"` al `cmd` de R4 en `scripts/guards/checks.mjs` (igual que ya tiene `R-newMap-allBusinesses`).

4. **`getMenuPhotoUrl` agrega `await import` overhead en cada call, en vez de cachear el `getDownloadURL` resuelto a nivel de modulo**. Alternativa: memoizar `getDownloadURL` en un Map por path. Razon de rechazo: el browser ya cachea el chunk despues del primer download (Service Worker + HTTP cache); el overhead solo aplica al primer mount. Memoizar el URL nos llevaria a invalidacion compleja (URLs firmadas vencen).

5. **Tipo `UploadTask` se mantiene como `import type`**. Alternativa: inferirlo del retorno de `uploadBytesResumable`. Razon de mantener: TypeScript elide los `import type` del bundle runtime — no contribuyen al chunk size. Mantenerlo da mejor DX (autocomplete sin esperar al dynamic import).

6. **S4 wrappea con `measuredGetDocs` aunque el guard 303 no este aun en gate de merge**. Razon: el patron es el correcto y reduce ruido futuro. Si `303/R1` se enfoerza despues, los 9 callsites ya estan listos.

7. **`dist/stats.html` queda accesible solo con `ANALYZE=1 npm run build`, no en builds normales**. Alternativa: emitirlo siempre. Razon: aumenta el tiempo de build (~30s) y el tamano del job artifact. Solo se necesita en investigacion (S5) y verificacion ad-hoc.

---

## Hardening de seguridad

### Firestore rules requeridas

Sin cambios. No se introducen rules nuevas. Las rules existentes ya validan ownership en `sharedLists` y admin en `specials`/`achievements`.

### Rate limiting

Sin cambios. Los caps `limit()` agregados en S4 son **client-side** y NO sustituyen rate limits server-side. El rate limit server-side de `sharedLists` (10/dia) ya existe (#289).

| Coleccion | Limite client-side (S4) | Limite server-side (existente) |
|-----------|-------------------------|--------------------------------|
| specials | 50 (admin) / 20 (active) | N/A (admin-only writes) |
| achievements | 100 | N/A (admin-only writes) |
| sharedLists | 100 (per user) | 10/dia per user (existente, #289) |
| listItems | 500 (per list) | N/A (cap natural por batch limit) |

### Vectores de ataque mitigados

| Ataque | Mitigacion | Archivo |
|--------|-----------|---------|
| Billing DoS via lista de 10K items | `limit(500)` en `fetchListItems` | `services/sharedLists.ts:130` |
| Billing DoS via muchas listas por user | `limit(100)` en `fetchUserLists` + rate limit existente | `services/sharedLists.ts:177` |
| Billing DoS via 10K+ feedbacks por user | `limit(200)` en `fetchUserFeedback` | `services/feedback.ts:64` |
| Bundle inspection / secret leak | Sin cambios — los chunks no exponen secrets nuevos | `vite.config.ts`, `dist/stats.html` |
| `<img src={photoUrl}>` URL maliciosa | Validado por Storage rules + rules de `menuPhotos` (#250) | `firestore.rules`, `storage.rules` |

---

## Deuda tecnica: mitigacion incorporada

| Issue | Que se resuelve | Paso del plan |
|-------|----------------|---------------|
| #302 (perf — bundle splits) | Reaplica las 5 rules: R4, R6, R7, R8, R-newMap | S1, S2, S3.a, S3.b, S3.c |
| #325 (perf-instrumentation followup) | 9 de los 44 callsites de R1 quedan wrappeados con `measuredGetDocs` (8 con `limit()` + 1 wrap-only en `deleteList`) | S4 |
| #289 (sharedLists rate limit) | Cap `limit(100)` agrega defense-in-depth | S4 |
| `R5-hooks-without-test` (guard 301) | Si tests nuevos cubren `useBusinessById`, `useDeepLinks`, `useVisitHistory`, `useCommentsListFilters`, `useNavigateToBusiness` (5 de los 24 hooks reportados), cierran parte del guard 301 R5 | Tests de S1 |

Los issues abiertos relacionados se consultan via:
```bash
gh issue list --label performance --state open
gh issue list --label "tech debt" --state open
```

---

## Validacion Tecnica

**Arquitecto:** Diego (validacion tecnica)
**Fecha Ciclo 1:** 2026-04-25
**Estado Ciclo 1:** **NO VALIDADO** (3 BLOQUEANTES + 6 IMPORTANTES + 3 OBSERVACIONES)
**Fecha Ciclo 2:** 2026-04-25
**Estado Ciclo 2:** **pendiente Diego re-revision** (BLOQUEANTES + IMPORTANTES cerrados con decisiones aplicadas; OBSERVACIONES respondidas)

### Contexto revisado

- **PRD**: `docs/feat/infra/324-performance-bundle-business-lookup/prd.md` (sello Sofia: VALIDADO CON OBSERVACIONES Ciclo 2 — 5 OBS-N absorbidas en specs).
- **Patrones**: `docs/reference/patterns.md` (regla service-layer + businessMap singleton).
- **Codigo verificado en Ciclo 1**: `src/utils/businessMap.ts`, `src/config/firebase.ts`, `src/services/{feedback,menuPhotos,specials,sharedLists,achievements}.ts`, `src/utils/perfMetrics.ts`, `src/components/admin/PhotoReviewCard.tsx`, `src/hooks/{useLocalTrending,useRatingPrompt}.ts`, `vite.config.ts`, `scripts/guards/checks.mjs`.
- **Codigo re-verificado en Ciclo 2** (con `grep -n` directo sobre HEAD de `new-home`):
  - `services/sharedLists.ts`: `deleteList:86`, `fetchListItems:130`, `fetchUserLists:177`, `fetchSharedWithMe:203` (corrige numeros 178/204/131/87 del Ciclo 1).
  - `services/feedback.ts`: `sendFeedback:16` (no `submitFeedback`), `fetchUserFeedback:64-69` (con `getDocs` crudo, ahora incluido en S4).
  - `services/menuPhotos.ts`: `getMenuPhotoUrl:140` (firma) — corrige el 141 del Ciclo 1.
  - `npm run guards --guard 302 --rule R8-firebase-storage-in-critical` → reporta 0 hits, pero el `vite.config.ts:118` SI tiene `firebase/storage` en el chunk firebase. Causa: el awk del rule espera key con quotes; el code real no tiene quotes. Bug del rule confirmado.
- **Conteo verificado**: `grep "allBusinesses\.find" src/` → 15 hits (consistente con specs).

---

### Cambios aplicados en Ciclo 2 (resolucion BLOQUEANTES + IMPORTANTES)

#### BLOQUEANTE #1 — Numeros de linea de `services/sharedLists.ts` cruzados / incorrectos

**Resuelto.** Corregidos en seccion "Servicios" (linea 104) y tabla S4:
- `fetchUserLists`: 178 → **177**
- `fetchSharedWithMe`: 204 → **203**
- `fetchListItems`: 131 → **130**
- `deleteList`: 87 → **86** (firma; `itemsSnap` cuerpo en 87)

Todas las menciones cruzadas estan armonizadas: la seccion "Servicios" ya no menciona linea 87 para `deleteList` confundiendola con `fetchUserLists`. La seccion lista cada funcion con su numero correcto. La tabla S4 corregida fila por fila. Sub-seccion "Excluidos del scope" actualizada para listar `deleteList:86` correctamente.

Nota agregada al inicio de la tabla S4: "Numeros de linea verificados con `grep -n` sobre HEAD de `new-home`".

#### BLOQUEANTE #2 — Nombre de funcion incorrecto (`submitFeedback` vs `sendFeedback`)

**Resuelto.** Reemplazadas todas las menciones de `submitFeedback` por `sendFeedback` en el body del specs:
- Seccion "Servicios" (linea 98 — ahora menciona `sendFeedback (linea 16)`).
- S3.b Consumer 2 — header cambiado a "(funcion `sendFeedback`)" + nota explicita re BLOQUEANTE #2 + path de upload referencia "dentro del `if (mediaFile)` de `sendFeedback`".
- Seccion "Offline → Writes offline" tabla — `submitFeedback` → `sendFeedback`.

(Las menciones que quedan en el cuerpo son solo dentro del bloque historico Ciclo 1 que se reemplaza con esta seccion Ciclo 2.)

#### BLOQUEANTE #3 — Dep array de `useMemo` en `useLocalTrending.ts` queda obsoleta

**Resuelto.** Seccion "Hooks" `useLocalTrending` reescrita explicitamente:
- Se elimina el primer `useMemo` (lineas 39-42) y la variable `businessCoords`.
- El segundo `useMemo` (linea 45-67) se preserva pero su dep array (linea 67) cambia de `[data, location.lat, location.lng, businessCoords]` → `[data, location.lat, location.lng]`. Justificacion documentada inline: "`getBusinessById` es referencia estable a nivel modulo (no cambia entre renders); incluirla en deps es innecesario (mismo criterio que para imports estaticos)".
- Loop interno (linea 50) re-especificado: `const biz_lookup = getBusinessById(biz.businessId); if (!biz_lookup) return false; return distanceKm(location.lat, location.lng, biz_lookup.lat, biz_lookup.lng) <= radius;`.

#### IMPORTANTE #4 — `getMenuPhotoUrl` linea 141 → 140

**Resuelto.** S3.b Consumer 3 tabla — corregido a "linea 140 (firma; cuerpo en 141)". Seccion "Servicios" (linea 99) tambien corregida.

#### IMPORTANTE #5 — `feedback.ts:67` `fetchUserFeedback` ya tiene `getDocs` crudo

**Resuelto incluyendo en S4.** Decision aplicada: incluir `fetchUserFeedback` en la tabla S4 con `limit(200)` + `measuredGetDocs` (consistente con criterio S4 y decision tecnica #6 — adelanta el wrap aprovechando que el archivo se toca igual en S3.b). Tabla S4 ahora tiene 8 callsites con `limit()` (era 7) + 1 wrap-only (`deleteList`). Total cierre de hits R1: 9 (era 7). Vectores de ataque mitigados actualizados con la fila "Billing DoS via 10K+ feedbacks por user → `limit(200)`".

Tambien actualizada la seccion "Coordinacion con #325": numeros 7→9 a lo largo (decision tecnica #2, decision tecnica #6, calculo restante 44-9=35).

#### IMPORTANTE #6 — Race en `getStorageLazy()` con llamadas concurrentes

**Resuelto cambiando a cache promise-based.** Snippet conceptual reescrito:
```ts
let storagePromise: Promise<FirebaseStorage> | null = null;
export async function getStorageLazy(): Promise<FirebaseStorage> {
  if (!storagePromise) {
    storagePromise = (async () => {
      const { getStorage, connectStorageEmulator } = await import('firebase/storage');
      const storage = getStorage(app);
      if (import.meta.env.DEV) connectStorageEmulator(storage, 'localhost', 9199);
      return storage;
    })();
  }
  return storagePromise;
}
```
La cache es de la **promise pendiente**, no del resultado — esto resuelve el race naturalmente: N callers concurrentes comparten la misma promise, el cuerpo del IIFE async ejecuta una sola vez, `connectStorageEmulator` se llama una sola vez. Documentado tambien en decisiones tecnicas (`firebase.ts:Consumer 1` row "API publica nueva") y en el resumen al final del snippet (parrafo "Por que promise-based").

#### IMPORTANTE #7 — Cobertura de `getStorageLazy()` en tests "opcional"

**Resuelto cambiando a REQUERIDO.** Tabla "Tests" fila `firebase.test.ts` reescrita con tests minimos obligatorios:
- (a) cache miss: primera llamada llama `getStorage(app)` y resuelve.
- (b) cache hit: segunda llamada retorna mismo storage sin re-importar (verificar con spy `toHaveBeenCalledTimes(1)`).
- (c) emulator wiring DEV: `import.meta.env.DEV = true` + `Promise.all([getStorageLazy(), getStorageLazy(), getStorageLazy()])` → `connectStorageEmulator.toHaveBeenCalledTimes(1)` (cubre el race del IMPORTANTE #6).
- (d) emulator wiring PROD: `import.meta.env.DEV = false` → `connectStorageEmulator` NO se llama.

Etiqueta cambiada de "Unit (nuevo — pero opcional)" a "Unit (nuevo — REQUERIDO, no opcional)".

#### IMPORTANTE #8 — Bundle size test post-build sin ubicacion ni gates definidos

**Resuelto.** Seccion "Bundle size test post-build" reescrita con:
- **Ubicacion**: `scripts/bundle-size-check.mjs`.
- **Invocacion**: `package.json` script `"test:bundle-size": "node scripts/bundle-size-check.mjs"`.
- **Dependencias**: solo APIs nativas de Node (`node:fs/promises` + `node:zlib`). Rechazo explicito de `gzip-size`.
- **Algoritmo**: parsea `dist/assets/*.js`, agrupa por chunk-name, verifica thresholds numericos heredados del PRD.
- **Gate de CI**: step bloqueante en workflow de PR post-`npm run build`. Bloquea merge si falla. NO entra al runner de `npm run guards`.
- **Artifact**: archivar `dist/stats.html` + output del script.

#### IMPORTANTE #9 — Baseline `R8-firebase-storage-in-critical: 0 hits` declarado incorrectamente

**Resuelto reconciliando con la realidad.** Tabla "Baseline guards 302" fila R8 reescrita: el rule reporta 0 hits porque el awk pattern (`/'firebase':/`) espera la key entre comillas, pero el `vite.config.ts:118` actual usa la key sin comillas (`firebase:`). El estado real es 1 hit (el `vite.config.ts` SI viola el intent del rule). Plan agrega step explicito de patchear `scripts/guards/checks.mjs:138` con pattern mas permisivo: `awk "/[\"']?firebase[\"']?:/,/]/" vite.config.ts | grep "firebase/storage" || true`. Con el fix, R8 pre-#324 reporta 1 hit (real) y post-S3.c reporta 0 (objetivo). El fix entra al mismo PR que S3.c.

---

### OBSERVACIONES (respondidas)

#### OBSERVACION #10 — Actualizar `docs/reference/guards/302-performance.md` con la exclusion de `businessMap.ts` para R4

**Aceptada.** Plan debe agregar a la fase final "Documentacion" un step para actualizar `docs/reference/guards/302-performance.md` reflejando: (a) la exclusion de `src/utils/businessMap.ts` para R4, y (b) el cambio del awk pattern de R8 (pattern mas permisivo). Pablo (plan reviewer) verifica que ambos esten en la fase final del plan.

#### OBSERVACION #11 — Otros services tocados podrian tener `getDocs` crudos no listados

**Resuelta con auditoria post-S4.** Seccion "Workstream S4" agrega parrafo final "Auditoria post-S4": correr `npm run guards --guard 303 --rule R1-services-raw-getDocs` antes y despues. Delta debe ser <= 0. Lista cerrada confirmada: `feedback.ts:67` (ahora en S4) era el unico hit cercano a los services tocados; `menuPhotos.ts` no tiene `getDocs` crudos (solo storage). Si la auditoria detecta otros, se agregan al alcance del PR (criterio: si toca el mismo archivo, incluir; si no, dejar para #325).

#### OBSERVACION #12 — Documentar latencia esperada del primer mount post-deploy

**Aceptada.** Decision tecnica #4 ya reconocia el overhead pero no daba numeros. Agregado parrafo explicito: "Latencia esperada en 4G: ~80-100ms primera vez, <5ms despues" + "medir post-deploy y archivar en `docs/reference/perf-baselines.md` o equivalente como benchmark del feature". Se agrega step al plan: "Phase final — registrar latencia real medida del primer mount post-deploy en el changelog del feature".

---

### Estado al cierre de Ciclo 2

| Categoria | Cantidad | Estado |
|-----------|----------|--------|
| BLOQUEANTES | 3 | Todos cerrados (correcciones aplicadas al body del specs) |
| IMPORTANTES | 6 | Todos cerrados (decisiones aplicadas o documentadas) |
| OBSERVACIONES | 3 | 1 absorbida en plan (O1), 1 cerrada con auditoria (O2), 1 absorbida en plan (O3) |

Specs queda **listo para Diego re-revision (Ciclo 2)**. Si Diego emite VALIDADO o VALIDADO CON OBSERVACIONES, se procede a generar el `plan.md`. Si persiste NO VALIDADO, se itera Ciclo 3 con los hallazgos remanentes.


---


## Veredicto Diego — Ciclo 2

**Estado:** **VALIDADO CON OBSERVACIONES**
**Fecha:** 2026-04-25
**Arquitecto:** Diego (Solution Architect)

### Resumen

Los 3 BLOQUEANTES y 6 IMPORTANTES del Ciclo 1 quedaron cerrados con cambios concretos aplicados al specs. Re-verifique cada line number citado contra HEAD de `new-home` con `grep -n` y todos cuadran salvo dos regresiones que detallo abajo. Las 3 OBSERVACIONES tienen camino claro al plan o a una auditoria post-implementacion.

Detecte **dos regresiones** durante la re-verificacion: una de line number errado en tabla S4 (REG #1) y una de scope inconsistente entre dos callsites identicos (REG #2). Ninguna es bloqueante porque el implementador puede resolverlas con grep, pero ambas valen capturarse antes de pasar al plan para que Pablo no tenga que adivinar la intencion.

### Verificacion de cierres del Ciclo 1

| Hallazgo | Aplicado en specs | Verificado contra HEAD | Cierre |
|----------|-------------------|------------------------|--------|
| BLOQUEANTE #1 (line numbers `sharedLists.ts`) | Lineas 86/130/177/203 reescritas en seccion "Servicios" + tabla S4 | `grep -n "export async function" src/services/sharedLists.ts` confirma `deleteList:86`, `fetchListItems:130`, `fetchUserLists:177`, `fetchSharedWithMe:203` | Cerrado |
| BLOQUEANTE #2 (`submitFeedback` -> `sendFeedback`) | Reemplazado en seccion "Servicios", S3.b Consumer 2, "Offline writes". Las menciones residuales de `submitFeedback` quedan SOLO dentro de las secciones historicas/de validacion (correcto — no son instrucciones de implementacion) | `grep -n "export" src/services/feedback.ts` confirma `sendFeedback` linea 16, no existe `submitFeedback` | Cerrado |
| BLOQUEANTE #3 (dep array de `useLocalTrending`) | Seccion "Hooks" reescrita: eliminacion del `useMemo` de `businessCoords` (lineas 39-42), dep array nuevo `[data, location.lat, location.lng]`, loop reespecificado | `grep -n` confirma estado actual del archivo (lineas 39-40 useMemo, 50 lookup, 67 deps) | Cerrado |
| IMPORTANTE #4 (`getMenuPhotoUrl:141 -> 140`) | Tabla S3.b Consumer 3 + seccion "Servicios" corregidas a "linea 140 (firma; cuerpo en 141)" | `grep -n "getMenuPhotoUrl" src/services/menuPhotos.ts` confirma declaracion en linea 140 | Cerrado |
| IMPORTANTE #5 (`fetchUserFeedback`) | Incluido en S4 fila #8 con `limit(200)` + `measuredGetDocs`. Vectores de ataque actualizado. Conteo "9 callsites totales = 8 con limit + 1 wrap-only" | `grep -n` confirma declaracion linea 64, `getDocs` linea 67 | Cerrado |
| IMPORTANTE #6 (race en `getStorageLazy`) | Snippet conceptual reescrito: cache es `Promise<FirebaseStorage> \| null`. Parrafo "Por que promise-based" justifica el patron explicitamente. La IIFE ejecuta una sola vez para N callers concurrentes — `connectStorageEmulator` se invoca exactamente una vez | Patron consistente con la firma documentada y con el resto de connect*Emulator del archivo (linea 56-59) | Cerrado |
| IMPORTANTE #7 (tests `getStorageLazy` opcionales) | Tabla "Tests" fila `firebase.test.ts` cambiada a "Unit (nuevo — REQUERIDO, no opcional)" con 4 tests minimos (a-d). El test (c) usa `Promise.all([getStorageLazy() x3])` para validar el invariant del IMPORTANTE #6 | Tests describen el invariant correcto y mockean con `vi.hoisted` (consistente con feedback patterns del proyecto) | Cerrado |
| IMPORTANTE #8 (bundle-size script sin definicion) | Seccion "Bundle size test post-build" reescrita con: ubicacion (`scripts/bundle-size-check.mjs`), npm script `test:bundle-size`, deps nativas (`node:fs/promises` + `node:zlib`, rechazo explicito de `gzip-size`), algoritmo de 5 pasos, gate CI bloqueante post-build, artifact con `dist/stats.html` | Definicion completa, sin ambiguedades. Decisiones tecnicas explicitas (no es runner de guards) | Cerrado |
| IMPORTANTE #9 (baseline R8 fantasma) | Tabla "Baseline guards 302" fila R8 + parrafo "Reconciliacion del bug del rule R8" explica el bug del awk pattern (linea 138 de `checks.mjs`); patch del rule (`awk "/[\"']?firebase[\"']?:/,/]/"`) entra al mismo PR que S3.c | `grep -n` en `scripts/guards/checks.mjs:138` confirma el pattern problematico literal: `awk "/'firebase':/,/]/"` (con quotes simples requeridos) y `vite.config.ts:118` usa `firebase:` (sin quotes) — bug reproducible | Cerrado |
| OBS #10 (docs guards 302) | Aceptada, paso al plan. Step explicito agregado en "Observaciones tecnicas para el plan" #1 | n/a (responsabilidad de Pablo) | Cerrado (transferido) |
| OBS #11 (otros services con `getDocs` crudos) | Auditoria post-S4 + lista cerrada (`feedback.ts:67` ya en S4; `menuPhotos.ts` sin `getDocs` crudos) | `grep -n "getDocs(" src/services/{feedback,menuPhotos,specials,sharedLists,achievements}.ts` confirma 9 callsites de los services del scope; ninguno fuera de la tabla S4 | Cerrado |
| OBS #12 (latencia primer mount) | Numeros agregados (~80-100ms en 4G primera vez, <5ms despues) + step en plan para registrar medicion real post-deploy en `docs/reference/perf-baselines.md` o equivalente | n/a (medicion post-implementacion) | Cerrado |

### Regresiones detectadas en Ciclo 2

#### REG #1 (OBSERVACION) — Tabla S4 fila #2: `services/specials.ts:31` apunta a la funcion equivocada

**Seccion afectada:** "Workstream S4 → tabla principal, fila #2".
**Texto del specs (linea 335):** `services/specials.ts:31` — `fetchActiveSpecials`.
**Hueco tecnico:** linea 31 de `services/specials.ts` esta dentro de `saveAllSpecials` (es el `existingSnap = await getDocs(...)` del cleanup de admin). La funcion `fetchActiveSpecials` esta declarada en la linea **19** y su `getDocs` multilinea va de la linea 20 a la 22.
**Escenario concreto:** el implementador navega a `services/specials.ts:31` esperando encontrar `fetchActiveSpecials` y se encuentra con `saveAllSpecials` (linea 30, declaracion). Si modifica la linea 31 sin advertir el contexto, agrega `limit(20)` al `existingSnap` del cleanup admin — eso cappea el cleanup a 20 docs y rompe el flow administrativo (specials > 20 quedarian huerfanos al hacer save).
**Que necesitamos en el specs:** corregir la fila #2 a `services/specials.ts:19` (linea de declaracion, consistente con filas #5/#6/#7/#8) o `:20` (linea del `getDocs`, consistente con filas #1/#3/#4). Recomendacion: estandarizar a linea de declaracion (mas estable bajo refactors futuros).
**Impacto:** OBSERVACION. El nombre de la funcion en la celda "Funcion" (`fetchActiveSpecials`) es inequivoco y el implementador puede resolver con grep — pero el line number es factualmente erroneo y la cita lleva al implementador a un sitio peligroso.

#### REG #2 (OBSERVACION) — Inconsistencia de scope: `saveAllSpecials.existingSnap` no esta en S4 pero `saveAllAchievements.existingSnap` si

**Seccion afectada:** "Workstream S4 → tabla principal" + "Servicios" linea 102-103.
**Hueco tecnico:** la fila #4 de S4 incluye `services/achievements.ts:23` (`saveAllAchievements.existingSnap`, `limit(100)`, wrap con `measuredGetDocs`). Sin embargo `services/specials.ts:31` (`saveAllSpecials.existingSnap`) — patron identico, mismo proposito (cleanup admin antes de upsert) — NO aparece en S4 ni en la seccion "Servicios". Ambos son `getDocs` crudos sobre coleccion completa para detectar docs a borrar, ambos son admin-only writes.

**Verificacion del patron identico** (con `grep -n`):
- `services/achievements.ts:23` — `const existingSnap = await getDocs(collection(db, COLLECTIONS.ACHIEVEMENTS));` (incluido en S4 fila #4 con `limit(100)`)
- `services/specials.ts:31` — `const existingSnap = await getDocs(collection(db, COLLECTIONS.SPECIALS));` (NO incluido)

**Escenario concreto:** despues de mergear #324, el guard `303/R1-services-raw-getDocs` sigue reportando el hit de `specials.ts:31`. El delta esperado en el specs es "9 hits cerrados" pero el real seria 9 (igual). Mas grave: el "Auditoria post-S4" del specs dice "lista cerrada confirmada" — pero la auditoria omitio este hit. Si Pablo o el implementador descubren el hit durante la implementacion, va a haber duda sobre si es scope creep o un olvido.

**Que necesitamos en el specs:** una de dos resoluciones explicitas:
- (a) **Incluir `saveAllSpecials.existingSnap` en S4** — agregar fila a la tabla con `limit(100)` + `measuredGetDocs` (cap simetrico con achievements). Conteo nuevo: 10 callsites totales (9 con limit + 1 wrap-only).
- (b) **Excluirlo explicitamente** con justificacion en la seccion "Excluidos del scope de S4" — la razon tendria que ser distinta a la usada para `follows.ts:fetchFollowersCount` (esa usa count aggregate, esta usa `getDocs` crudo igual que las que SI estan en scope).

**Impacto:** OBSERVACION. No bloquea la implementacion mecanica, pero rompe la promesa "lista cerrada" de la auditoria post-S4 y genera ruido para Pablo en el plan.

### Observaciones tecnicas para el plan (Pablo)

1. **Resolver REG #1 y REG #2 antes de cerrar el specs**: ambas son ediciones triviales (1 numero + 1 fila o 1 parrafo). Recomendacion: que `specs-plan-writer` haga la correccion como ultimo step antes de pasar a Pablo, o que Pablo las absorba en el plan como steps de "ajuste de specs". Dado que ya estamos en VALIDADO CON OBSERVACIONES, no requieren Ciclo 3.

2. **Patches a `scripts/guards/checks.mjs`**: el plan debe consolidar dos cambios al guard runner en una sola fase (de preferencia la fase final de "Documentacion / guards"):
   - Linea 138: cambiar el awk pattern de R8 a `awk "/[\"']?firebase[\"']?:/,/]/"` (acepta key con o sin quotes — especificado en specs).
   - Rule R4: agregar exclusion de `src/utils/businessMap.ts` (especificado en specs, simetrico con la exclusion ya existente en R-newMap-allBusinesses).
   Ambos son necesarios para que el feature pueda emitir el "VALIDADO" final del PR.

3. **Orden S3.b -> S3.c**: el specs es claro, pero Pablo debe verificar que el plan **no agrupa S3.b y S3.c en el mismo commit**. Razon: si S3.b queda parcialmente implementado (ej. 3 de 4 consumers migrados) y S3.c se commitea junto, `tsc -b` falla pero el chunk firebase ya cambio. Tener S3.c como commit separable post-S3.b permite revertir el drop sin revertir todo el refactor.

4. **Tests de `getStorageLazy` mockean `firebase/storage`**: los 4 tests minimos (a-d) verifican la API publica con mocks. Pablo debe verificar que el plan tambien incluya o un test de integracion en `vitest --integration` (sin mock de `firebase/storage`) o un E2E que ejercite el flow `MenuPhotoUpload` real. Sin esto, los tests pueden pasar pero el dynamic import puede fallar en runtime (chunk no emitido, path mal resuelto post-build).

5. **Bundle-size baseline pre-#324**: el specs cita `firebase` pre-#324 = 449 KB raw. Pablo debe asegurar que el plan capture ese numero **antes** de empezar la implementacion (`npx vite build` con HEAD actual) y lo archive (ej. `docs/feat/infra/324-.../baseline-pre.txt`). Sin baseline capturado, el threshold `<= 350 KB` se verifica solo, pero perdemos la posibilidad de medir reduccion exacta para el changelog.

6. **Conflicto potencial con #325**: la "Coordinacion con #325" del specs es solida, pero Pablo debe asegurar que el plan incluye un step explicito de "verificar branch state de #325 antes de mergear". Si #325 esta abierto en otra rama, los 9 callsites de S4 pueden tener conflicto en imports y en firmas de query. Si #325 ya esta merged, los 9 callsites deberian saltarse (estan ya wrappeados).

7. **Latencia 80-100ms primera vez en 4G**: el numero del specs es razonable pero **no esta validado experimentalmente**. Pablo debe asegurar que el plan incluye (a) step de medicion post-deploy y (b) un rollback path documentado si la latencia real excede 200ms en 3G/4G lento. Si no hay rollback path, el feature mergea con riesgo asumido — aceptable, pero debe ser decision explicita.

### Listo para pasar a plan

**Si, con observaciones.**

Las observaciones que requieren accion antes del plan:
- **REG #1** (line number `:31` -> `:19` o `:20` en tabla S4 fila #2) — correccion trivial.
- **REG #2** (decidir si `saveAllSpecials.existingSnap` entra a S4 o se excluye explicitamente) — decision de scope, simetrica con achievements.

Las 7 observaciones tecnicas para el plan son input para que Pablo refine el plan, no bloquean la generacion inicial.

El feature puede pasar a `specs-plan-writer` para correccion de REG #1 + REG #2 + escritura del plan, o directo a Pablo si Pablo absorbe ambas regresiones como steps de ajuste en el plan.

---
