# Specs: Carga incremental en BusinessSheet

**PRD:** [prd.md](prd.md)
**Fecha:** 2026-03-27

---

## Modelo de datos

Sin cambios al modelo de datos de Firestore. Este feature es una optimizacion client-side que reorganiza el orden de ejecucion de queries existentes.

### Tipos modificados

```typescript
// src/hooks/useBusinessData.ts — return type extendido
interface UseBusinessDataReturn {
  isFavorite: boolean;
  ratings: Rating[];
  comments: Comment[];
  userTags: UserTag[];
  customTags: CustomTag[];
  userCommentLikes: Set<string>;
  priceLevels: PriceLevel[];
  menuPhoto: MenuPhoto | null;
  isLoading: boolean;            // true mientras fase 1 no completa
  isLoadingComments: boolean;    // NUEVO — true mientras fase 2 no completa
  error: boolean;
  refetch: (collectionName?: CollectionName) => void;
}
```

No se crean tipos nuevos en `src/types/`. La interfaz `UseBusinessDataReturn` es local al hook.

---

## Firestore Rules

Sin cambios. Las queries son identicas a las actuales, solo se reorganiza el orden de ejecucion.

### Rules impact analysis

| Query (service file) | Collection | Auth context | Rule that allows it | Change needed? |
|---------------------|------------|-------------|-------------------|----------------|
| `getDoc(favorites/{uid}__{bId})` | favorites | Owner | `allow read: if request.auth != null` | No |
| `getDocs(ratings where businessId)` | ratings | Any authenticated | `allow read: if request.auth != null` | No |
| `getDocs(comments where businessId)` | comments | Any authenticated | `allow read: if request.auth != null` | No |
| `getDocs(userTags where businessId)` | userTags | Any authenticated | `allow read: if request.auth != null` | No |
| `getDocs(customTags where userId+businessId)` | customTags | Owner | `allow read: if request.auth != null` | No |
| `getDocs(priceLevels where businessId)` | priceLevels | Any authenticated | `allow read: if request.auth != null` | No |
| `getDocs(menuPhotos where businessId+status)` | menuPhotos | Any authenticated | `allow read: if request.auth != null` | No |
| `getDocs(commentLikes where documentId in)` | commentLikes | Any authenticated | `allow read: if request.auth != null` | No |

Todas las queries son identicas a las actuales. No se requieren cambios a rules.

---

## Cloud Functions

Sin cambios. No se necesitan funciones nuevas ni modificaciones a triggers existentes.

---

## Componentes

### BusinessSheet (modificar)

**Archivo:** `src/components/business/BusinessSheet.tsx`

Cambios:

1. **Render inmediato del header:** Cuando `selectedBusiness` no es null, renderizar `BusinessHeader` inmediatamente sin esperar a `data.isLoading`. El header usa datos del JSON estatico (`selectedBusiness`), no de Firestore.

2. **FavoriteButton en estado indeterminado:** Mientras `data.isLoading` es true, pasar `isLoading={true}` al FavoriteButton (ya soportado). El boton se muestra disabled.

3. **Skeletons por seccion:** Reemplazar el bloque ternario `showSkeleton ? <BusinessSheetSkeleton /> : <content>` con renderizado siempre del contenido, donde cada seccion muestra su propio skeleton inline cuando `isLoading` o `isLoadingComments` es true.

4. **Consumir `isLoadingComments`:** Pasar `data.isLoadingComments` a `BusinessComments` y `BusinessQuestions` en vez de `data.isLoading`.

Props nuevas consumidas del hook: `isLoadingComments`.

### BusinessSheetSkeleton (eliminar uso, mantener archivo)

**Archivo:** `src/components/business/BusinessSheetSkeleton.tsx`

El componente deja de usarse en BusinessSheet. Se puede mantener el archivo por si se necesita en otro contexto, o eliminarlo. Dado que no tiene otros consumidores, se elimina el import y uso en BusinessSheet. El archivo se puede eliminar en la fase de cleanup.

---

## Hooks

### useBusinessData (modificar)

**Archivo:** `src/hooks/useBusinessData.ts`

Cambios a la funcion `fetchBusinessData`:

**Antes:** Un solo `Promise.all` con las 7 queries + `fetchUserLikes` secuencial.

**Despues:** Dos fases:

```typescript
async function fetchBusinessDataPhased(
  bId: string,
  uid: string,
  onPhase1: (data: Phase1Data) => void,
): Promise<FullBusinessData> {
  // Fase 1: queries rapidas en paralelo
  const [favSnap, ratingsSnap, userTagsSnap, customTagsSnap, priceLevelsSnap, menuPhotoSnap] =
    await Promise.all([
      getDoc(doc(db, COLLECTIONS.FAVORITES, `${uid}__${bId}`)),
      getDocs(query(collection(db, COLLECTIONS.RATINGS).withConverter(ratingConverter), where('businessId', '==', bId))),
      getDocs(query(collection(db, COLLECTIONS.USER_TAGS).withConverter(userTagConverter), where('businessId', '==', bId))),
      getDocs(query(collection(db, COLLECTIONS.CUSTOM_TAGS).withConverter(customTagConverter), where('userId', '==', uid), where('businessId', '==', bId))),
      getDocs(query(collection(db, COLLECTIONS.PRICE_LEVELS).withConverter(priceLevelConverter), where('businessId', '==', bId))),
      getDocs(query(collection(db, COLLECTIONS.MENU_PHOTOS).withConverter(menuPhotoConverter), where('businessId', '==', bId), where('status', '==', 'approved'))),
    ]);

  const phase1 = {
    isFavorite: favSnap.exists(),
    ratings: ratingsSnap.docs.map(d => d.data()),
    userTags: userTagsSnap.docs.map(d => d.data()),
    customTags: /* sorted */,
    priceLevels: priceLevelsSnap.docs.map(d => d.data()),
    menuPhoto: menuPhotoSnap.empty ? null : menuPhotoSnap.docs[0].data(),
  };

  onPhase1(phase1);

  // Fase 2: comments + userLikes (potencialmente lenta)
  const commentsSnap = await getDocs(query(
    collection(db, COLLECTIONS.COMMENTS).withConverter(commentConverter),
    where('businessId', '==', bId),
  ));
  const commentsResult = commentsSnap.docs.map(d => d.data()).filter(c => !c.flagged);
  commentsResult.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  const userCommentLikes = await fetchUserLikes(uid, commentsResult.map(c => c.id));

  return { ...phase1, comments: commentsResult, userCommentLikes };
}
```

Cambios al hook `useBusinessData`:

1. **Nuevo state `isLoadingComments`:** `useState<boolean>(false)`.

2. **Callback `load` refactorizado:**
   - Si cache hit: inyectar toda la data de una vez, `isLoading=false`, `isLoadingComments=false`. Sin cambios.
   - Si cache miss: `isLoading=true`, `isLoadingComments=true`. Llamar a `fetchBusinessDataPhased` con callback `onPhase1` que hace `setData(prev => ({...prev, ...phase1Data, comments: prev.comments, userCommentLikes: prev.userCommentLikes}))`, `setIsLoading(false)`. Al completar fase 2: `setData(fullResult)`, `setIsLoadingComments(false)`, `setBusinessCache(bId, fullResult)`.

3. **`patchedRef` entre fases:** Si un refetch parcial ocurre durante la fase 1, `patchedRef` marca la coleccion. Al resolver fase 1, el merge respeta las colecciones patcheadas (igual que hoy). Al resolver fase 2, tambien respeta patchedRef.

4. **`fetchIdRef` entre fases:** Si `fetchIdRef.current !== id` al resolver fase 1 o fase 2, se descarta el resultado (stale request). Esto cubre el caso de cambio de businessId durante la carga.

5. **Cache:** Solo se llama `setBusinessCache` al completar fase 2 (con datos completos). No se cachean datos parciales de fase 1.

6. **Return:** Agregar `isLoadingComments` al return.

7. **EMPTY constant:** Agregar `isLoadingComments: false` al objeto EMPTY.

### useBusinessDataCache (sin cambios)

No se necesitan cambios en el cache module. `setBusinessCache` sigue recibiendo datos completos (solo se llama al completar fase 2). `patchBusinessCache` sigue funcionando igual para refetches parciales.

---

## Servicios

Sin cambios a archivos en `src/services/`. Toda la logica de fases vive en `useBusinessData.ts`.

---

## Integracion

### BusinessSheet.tsx

1. Extraer `isLoadingComments` de `useBusinessData`:
   ```typescript
   const data = useBusinessData(businessId);
   // data.isLoadingComments ahora disponible
   ```

2. Eliminar `const showSkeleton = data.isLoading;` y el import de `BusinessSheetSkeleton`.

3. Reestructurar el JSX: siempre renderizar el contenido (no el ternario skeleton vs contenido). Cada seccion maneja su propio loading:

   - **Header:** Se renderiza siempre (datos locales). `FavoriteButton` recibe `isLoading={data.isLoading}`.
   - **CheckInButton:** Se renderiza siempre (no depende de Firestore data).
   - **BusinessRating:** Recibe `isLoading={data.isLoading}` (ya lo recibe hoy, ya maneja skeleton internamente o muestra datos vacios).
   - **BusinessPriceLevel:** Recibe `isLoading={data.isLoading}`.
   - **BusinessTags:** Recibe `isLoading={data.isLoading}`.
   - **MenuPhotoSection:** Recibe `isLoading={data.isLoading}`.
   - **BusinessComments:** Cambia `isLoading={data.isLoading}` a `isLoading={data.isLoadingComments}`.
   - **BusinessQuestions:** Cambia `isLoading={data.isLoading}` a `isLoading={data.isLoadingComments}`.

4. Agregar skeletons inline con `<Skeleton>` de MUI en BusinessSheet para las secciones que no manejan su propio skeleton internamente. Dado que los componentes hijos (BusinessRating, BusinessPriceLevel, BusinessTags, MenuPhotoSection) ya reciben `isLoading` como prop pero no renderizan skeletons propios, agregar guards condicionales en BusinessSheet que muestren `<Skeleton>` por seccion mientras `data.isLoading`:

   ```tsx
   {data.isLoading ? (
     <>
       <Skeleton variant="text" width="50%" height={24} />
       <Skeleton variant="text" width="40%" height={20} sx={{ mt: 0.5 }} />
     </>
   ) : (
     <BusinessRating ... />
   )}
   ```

   Idem para PriceLevel, Tags, MenuPhoto. Para Comments/Questions, usar `data.isLoadingComments`.

### Analytics events

Agregar tres constantes nuevas en `src/constants/analyticsEvents.ts`:

```typescript
// BusinessSheet performance (#198)
export const EVT_BUSINESS_SHEET_PHASE1 = 'business_sheet_phase1_ms';
export const EVT_BUSINESS_SHEET_PHASE2 = 'business_sheet_phase2_ms';
export const EVT_BUSINESS_SHEET_CACHE_HIT = 'business_sheet_cache_hit';
```

Emitir en `useBusinessData.load`:
- Al resolver cache hit: `trackEvent(EVT_BUSINESS_SHEET_CACHE_HIT, { business_id: bId })`.
- Al resolver fase 1: `trackEvent(EVT_BUSINESS_SHEET_PHASE1, { business_id: bId, duration_ms: Date.now() - startTime })`.
- Al resolver fase 2: `trackEvent(EVT_BUSINESS_SHEET_PHASE2, { business_id: bId, duration_ms: Date.now() - startTime })`.

---

## Tests

| Archivo test | Que testear | Tipo |
|-------------|-------------|------|
| `src/hooks/useBusinessData.test.ts` | Carga en dos fases, state parcial, isLoadingComments, cache hit bypass, patchedRef entre fases, fetchIdRef stale handling, analytics events | Hook (nuevo) |
| `src/hooks/useBusinessDataCache.test.ts` | Sin cambios requeridos (la interfaz del cache no cambia) | Hook (existente) |

### Casos a cubrir en `useBusinessData.test.ts`

1. **Fase 1 completa, fase 2 pendiente:** Despues de que fase 1 resuelve, state tiene ratings, favorites, tags, priceLevels, menuPhoto; `isLoading` es false; `isLoadingComments` es true; comments sigue vacio.

2. **Fase 2 completa:** Despues de que fase 2 resuelve, state tiene comments + userCommentLikes; `isLoadingComments` es false.

3. **Cache hit:** Ambos `isLoading` e `isLoadingComments` son false inmediatamente. No se ejecutan queries. Se emite `EVT_BUSINESS_SHEET_CACHE_HIT`.

4. **Fase 1 completa, fase 2 falla:** Datos de fase 1 visibles; `error` es true; `isLoadingComments` es false (pasa a false en el finally/catch).

5. **Refetch parcial durante fase 1:** `patchedRef` contiene la coleccion refetcheada; al resolver fase 1, el merge preserva el valor del refetch parcial.

6. **Cambio de businessId durante carga:** `fetchIdRef` invalida ambas fases. State no se actualiza con datos stale.

7. **`refetch('comments')`:** Funciona independiente de fases, usa `fetchSingleCollection` como hoy.

8. **Analytics:** `trackEvent` se llama con `EVT_BUSINESS_SHEET_PHASE1` y `EVT_BUSINESS_SHEET_PHASE2` con `duration_ms` al resolver cada fase.

### Mock strategy

```typescript
vi.mock('../config/firebase', () => ({ db: {} }));
vi.mock('../config/collections', () => ({ COLLECTIONS: { FAVORITES: 'favorites', RATINGS: 'ratings', COMMENTS: 'comments', USER_TAGS: 'userTags', CUSTOM_TAGS: 'customTags', PRICE_LEVELS: 'priceLevels', MENU_PHOTOS: 'menuPhotos', COMMENT_LIKES: 'commentLikes' } }));
vi.mock('../utils/analytics', () => ({ trackEvent: vi.fn() }));
vi.mock('../context/AuthContext', () => ({ useAuth: vi.fn() }));
vi.mock('./useBusinessDataCache', () => ({
  getBusinessCache: vi.fn(),
  setBusinessCache: vi.fn(),
  invalidateBusinessCache: vi.fn(),
  patchBusinessCache: vi.fn(),
}));

const mockGetDoc = vi.fn();
const mockGetDocs = vi.fn();
vi.mock('firebase/firestore', () => ({
  collection: vi.fn().mockReturnValue({ withConverter: vi.fn().mockReturnThis() }),
  doc: vi.fn().mockReturnValue({}),
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
  query: vi.fn(),
  where: vi.fn(),
  documentId: vi.fn(),
}));
```

Para controlar la resolucion de fases independientemente, mockear `mockGetDocs` para que las queries de fase 1 resuelvan con `Promise.resolve()` y las de fase 2 (comments) resuelvan con un `Deferred` controlable.

---

## Analytics

| Evento | Parametros | Cuando |
|--------|-----------|--------|
| `business_sheet_phase1_ms` | `{ business_id: string, duration_ms: number }` | Al completar fase 1 (cold cache) |
| `business_sheet_phase2_ms` | `{ business_id: string, duration_ms: number }` | Al completar fase 2 (cold cache) |
| `business_sheet_cache_hit` | `{ business_id: string }` | Al servir desde cache |

Constantes: `EVT_BUSINESS_SHEET_PHASE1`, `EVT_BUSINESS_SHEET_PHASE2`, `EVT_BUSINESS_SHEET_CACHE_HIT` en `src/constants/analyticsEvents.ts`.

---

## Offline

### Cache strategy

| Dato | Estrategia | TTL | Storage |
|------|-----------|-----|---------|
| Business data (7 queries) | Client-side Map cache + Firestore persistent cache (IndexedDB) | 5 min (Map) / sesion (IndexedDB) | In-memory Map + IndexedDB |
| Header (nombre, direccion, etc) | JSON estatico local (`businesses.json`) | Permanente | Bundle JS |

Sin cambios a la estrategia de cache existente. El cache solo almacena datos completos (post fase 2).

### Writes offline

No aplica. Este feature es read-only.

### Fallback UI

- **Header:** Siempre disponible (JSON local). Sin fallback necesario.
- **Secciones fase 1:** Skeleton inline de MUI por seccion mientras Firestore resuelve (online) o mientras persistent cache resuelve (offline).
- **Seccion comments:** Skeleton independiente de comentarios mientras fase 2 resuelve.
- **Offline total sin cache:** El header se muestra; las secciones de Firestore muestran skeleton indefinidamente (Firestore SDK queda pendiente).

---

## Decisiones tecnicas

### 1. Fases en `fetchBusinessData` vs hook-level splitting

**Decision:** Implementar las fases dentro de una nueva funcion `fetchBusinessDataPhased` con un callback `onPhase1`, en vez de dividir el hook en dos `useEffect` separados.

**Razon:** Mantener una sola invocacion controlada por `fetchIdRef` simplifica el manejo de race conditions y stale requests. Dos `useEffect` separados tendrian dependencias cruzadas y race conditions mas complejas.

### 2. No cachear datos parciales de fase 1

**Decision:** Solo llamar `setBusinessCache` al completar fase 2.

**Razon:** Si se cachearan datos de fase 1, un posterior `getBusinessCache` devolveria un objeto sin comments, rompiendo el contrato de `BusinessCacheEntry`. Mantener el cache como "todo o nada" es mas simple y evita estados inconsistentes.

### 3. Skeletons inline vs componentes wrapper

**Decision:** Usar `<Skeleton>` de MUI directamente en BusinessSheet con ternarios por seccion, no crear componentes skeleton nuevos.

**Razon:** Cada seccion necesita 2-3 lineas de Skeleton. Crear componentes wrapper agrega indirecccion sin beneficio dado que los skeletons son especificos de cada seccion y no se reutilizan.

### 4. Eliminar BusinessSheetSkeleton vs mantener

**Decision:** Eliminar el import y uso en BusinessSheet. Marcar el archivo para eliminacion en cleanup posterior.

**Razon:** El componente ya no tiene consumidores. Se puede eliminar el archivo directamente o en un PR de cleanup.
