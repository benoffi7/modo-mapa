# Specs: Extraer data-fetching de useBusinessData a service

**PRD:** [prd.md](prd.md)
**Fecha:** 2026-03-28

---

## Modelo de datos

No hay cambios en el modelo de datos. Este refactor mueve funciones entre archivos sin alterar queries, colecciones ni documentos.

### Tipos nuevos/movidos

```typescript
// src/services/businessData.ts (exportado)
export type BusinessDataCollectionName =
  | 'favorites'
  | 'ratings'
  | 'comments'
  | 'userTags'
  | 'customTags'
  | 'priceLevels'
  | 'menuPhotos';

// Tipo del resultado de fetchBusinessData — reutiliza BusinessCacheEntry sin timestamp
export interface BusinessDataResult {
  isFavorite: boolean;
  ratings: Rating[];
  comments: Comment[];
  userTags: UserTag[];
  customTags: CustomTag[];
  userCommentLikes: Set<string>;
  priceLevels: PriceLevel[];
  menuPhoto: MenuPhoto | null;
}
```

El tipo `BusinessDataResult` coincide con `Omit<BusinessCacheEntry, 'timestamp'>` de `useBusinessDataCache.ts`. Se exporta desde el servicio para que tanto el hook como el cache lo referencien.

## Firestore Rules

Sin cambios. Las queries son identicas, solo se mueven de archivo.

### Rules impact analysis

No hay queries nuevas. Las queries existentes se mueven tal cual al servicio:

| Query (service file) | Collection | Auth context | Rule that allows it | Change needed? |
|---------------------|------------|-------------|-------------------|----------------|
| `getDoc(favorites, uid__bId)` | favorites | Owner reading own doc | `allow read: if request.auth != null` | No |
| `getDocs(ratings, businessId==bId)` | ratings | Any authenticated | `allow read: if request.auth != null` | No |
| `getDocs(comments, businessId==bId)` | comments | Any authenticated | `allow read: if request.auth != null` | No |
| `getDocs(userTags, businessId==bId)` | userTags | Any authenticated | `allow read: if request.auth != null` | No |
| `getDocs(customTags, userId==uid, businessId==bId)` | customTags | Owner reading own docs | `allow read: if request.auth != null` | No |
| `getDocs(priceLevels, businessId==bId)` | priceLevels | Any authenticated | `allow read: if request.auth != null` | No |
| `getDocs(menuPhotos, businessId==bId, status==approved)` | menuPhotos | Any authenticated | `allow read: if request.auth != null` | No |
| `getDocs(commentLikes, documentId in batch)` | commentLikes | Any authenticated | `allow read: if request.auth != null` | No |

### Field whitelist check

No hay campos nuevos ni modificados. Sin cambios necesarios en Firestore rules.

## Cloud Functions

Sin cambios. Este refactor es puramente frontend.

## Componentes

Sin componentes nuevos ni modificados. La interfaz publica de `useBusinessData` no cambia, por lo que los consumidores (`BusinessSheet` y sus sub-componentes) no requieren cambios.

### Mutable prop audit

N/A. No hay componentes nuevos que reciban props editables.

## Textos de usuario

N/A. Este refactor no agrega ni modifica textos visibles.

## Hooks

### `useBusinessData` (modificado)

- **Cambio**: eliminar los imports de `firebase/firestore` y las funciones `fetchBusinessData`, `fetchSingleCollection`, `fetchUserLikes` que actualmente estan definidas inline (lineas 48-182).
- **Nuevo import**: `import { fetchBusinessData, fetchSingleCollection } from '../services/businessData'`
- **Nuevo import**: `import type { BusinessDataCollectionName } from '../services/businessData'`
- **Return type**: sin cambios. `UseBusinessDataReturn` permanece identico.
- **Tipo local**: `CollectionName` (linea 46) se reemplaza por `BusinessDataCollectionName` importado del servicio.
- **Dependencias despues del refactor**: React (`useState`, `useEffect`, `useCallback`, `useRef`), servicio (`fetchBusinessData`, `fetchSingleCollection`), cache (`getBusinessCache`, `setBusinessCache`, `invalidateBusinessCache`, `patchBusinessCache`), read cache (`getReadCacheEntry`, `setReadCacheEntry`), auth (`useAuth`), tipos, logger.
- **Lineas estimadas**: ~145 (actualmente 325, se eliminan ~180 lineas de funciones de fetching).

## Servicios

### `services/businessData.ts` (nuevo)

Archivo nuevo con las 3 funciones extraidas mecanicamente del hook.

**Exports:**

| Funcion | Params | Return | Descripcion |
|---------|--------|--------|-------------|
| `fetchBusinessData` | `businessId: string, userId: string` | `Promise<BusinessDataResult>` | Ejecuta 7 queries en `Promise.all`, post-procesa (filter flagged, sort, fetch likes) |
| `fetchSingleCollection` | `businessId: string, userId: string, collection: BusinessDataCollectionName` | `Promise<Partial<BusinessDataResult>>` | Refetch de una sola coleccion via switch |
| `fetchUserLikes` | `userId: string, commentIds: string[]` | `Promise<Set<string>>` | Batched likes query en grupos de 30 |

**Imports:**

- `collection, query, where, getDocs, doc, getDoc, documentId` de `firebase/firestore`
- `db` de `../config/firebase`
- `COLLECTIONS` de `../config/collections`
- `ratingConverter, commentConverter, userTagConverter, customTagConverter, priceLevelConverter, menuPhotoConverter` de `../config/converters`
- Tipos: `Rating, Comment, UserTag, CustomTag, PriceLevel, MenuPhoto` de `../types`

**Lineas estimadas**: ~140

### `services/index.ts` (modificado)

Agregar re-export:

```typescript
export { fetchBusinessData, fetchSingleCollection } from './businessData';
export type { BusinessDataCollectionName, BusinessDataResult } from './businessData';
```

## Integracion

### Archivos que cambian

| Archivo | Tipo de cambio |
|---------|---------------|
| `src/services/businessData.ts` | Nuevo |
| `src/services/index.ts` | Agregar re-exports |
| `src/hooks/useBusinessData.ts` | Eliminar funciones inline, importar del servicio |

### Consumidores que NO cambian

`BusinessSheet.tsx` y todos los sub-componentes que usan `useBusinessData` no necesitan cambios porque la interfaz publica del hook (`UseBusinessDataReturn`) permanece identica.

### Preventive checklist

- [x] **Service layer**: Despues del refactor, `useBusinessData.ts` NO importara `firebase/firestore`. Las queries pasan al service layer.
- [x] **Duplicated constants**: No se duplican constantes. Se reusan `COLLECTIONS` y converters existentes.
- [x] **Context-first data**: No aplica. El hook no lee datos de contextos que ya estarian disponibles.
- [x] **Silent .catch**: Las funciones extraidas no tienen `.catch`. El hook existente ya usa `logger.warn` y `logger.error`.
- [x] **Stale props**: No aplica. No hay componentes con props mutables en este refactor.

## Tests

| Archivo test | Que testear | Tipo |
|-------------|-------------|------|
| `src/services/businessData.test.ts` | `fetchBusinessData`: 7 queries en parallel, filter flagged comments, sort comments desc, sort customTags asc, batched likes integration. `fetchSingleCollection`: los 7 branches del switch (favorites, ratings, comments, userTags, customTags, priceLevels, menuPhotos). `fetchUserLikes`: 0 comments retorna empty set, <30 comments en un batch, >30 comments en multiples batches, extraccion correcta de commentId del doc ID compuesto. | Service unit |

### Mock strategy

```typescript
vi.mock('../config/firebase', () => ({ db: {} }));
vi.mock('../config/collections', () => ({
  COLLECTIONS: {
    FAVORITES: 'favorites',
    RATINGS: 'ratings',
    COMMENTS: 'comments',
    USER_TAGS: 'userTags',
    CUSTOM_TAGS: 'customTags',
    COMMENT_LIKES: 'commentLikes',
    PRICE_LEVELS: 'priceLevels',
    MENU_PHOTOS: 'menuPhotos',
  },
}));

const mockGetDoc = vi.fn();
const mockGetDocs = vi.fn();
vi.mock('firebase/firestore', () => ({
  collection: vi.fn().mockReturnValue({ withConverter: vi.fn().mockReturnThis() }),
  doc: vi.fn().mockReturnValue({}),
  query: vi.fn().mockReturnValue({}),
  where: vi.fn(),
  getDoc: (...args) => mockGetDoc(...args),
  getDocs: (...args) => mockGetDocs(...args),
  documentId: vi.fn(),
}));
```

### Casos a cubrir (~20 test cases estimados)

- [x] `fetchUserLikes` con 0 comments retorna `Set` vacio
- [x] `fetchUserLikes` con 5 comments hace 1 query batch
- [x] `fetchUserLikes` con 35 comments hace 2 query batches
- [x] `fetchUserLikes` extrae commentId correctamente del doc ID compuesto
- [x] `fetchSingleCollection('favorites')` retorna `{ isFavorite: true/false }`
- [x] `fetchSingleCollection('ratings')` retorna array de ratings via converter
- [x] `fetchSingleCollection('comments')` filtra flagged, ordena desc, incluye likes
- [x] `fetchSingleCollection('userTags')` retorna array via converter
- [x] `fetchSingleCollection('customTags')` filtra por userId+businessId, ordena asc
- [x] `fetchSingleCollection('priceLevels')` retorna array via converter
- [x] `fetchSingleCollection('menuPhotos')` retorna null si empty, primer doc si existe
- [x] `fetchBusinessData` ejecuta queries en parallel (Promise.all)
- [x] `fetchBusinessData` filtra comments flagged
- [x] `fetchBusinessData` ordena comments por createdAt desc
- [x] `fetchBusinessData` ordena customTags por createdAt asc
- [x] `fetchBusinessData` llama fetchUserLikes con IDs de comments filtrados
- [x] `fetchBusinessData` retorna menuPhoto null si no hay fotos aprobadas

### Criterio de aceptacion

- Cobertura >= 80% del codigo nuevo en `services/businessData.ts`
- Tests existentes de `useBusinessDataCache.test.ts` siguen pasando sin cambios
- `npm run test:run` pasa sin regresiones

## Analytics

Sin cambios. No se agregan ni modifican llamadas a `trackEvent`.

---

## Offline

Sin cambios en el comportamiento offline.

### Cache strategy

| Dato | Estrategia | TTL | Storage |
|------|-----------|-----|---------|
| Business data (7 queries) | 3-tier: memory -> IndexedDB -> Firestore persistent cache | Memory: 5min, IndexedDB: 24h | Sin cambio |

### Writes offline

N/A. Este modulo solo tiene reads.

### Fallback UI

Sin cambios. `StaleBanner` sigue funcionando identico cuando se sirven datos de IndexedDB.

---

## Decisiones tecnicas

### DT1: Tipo `BusinessDataCollectionName` en vez de `CollectionName`

El tipo `CollectionName` es demasiado generico y podria colisionar con otros usos. Se renombra a `BusinessDataCollectionName` para mayor claridad cuando se importa en otros modulos. El hook usa `type CollectionName = BusinessDataCollectionName` como alias local si se desea mantener brevedad interna, pero la interfaz publica del servicio usa el nombre completo.

### DT2: `BusinessDataResult` como interfaz explicita

En vez de reutilizar `Omit<BusinessCacheEntry, 'timestamp'>`, se define `BusinessDataResult` como interfaz independiente en el servicio. Esto evita una dependencia circular (servicio -> cache hook -> servicio) y mantiene el servicio autocontenido. `BusinessCacheEntry` en `useBusinessDataCache.ts` puede extender `BusinessDataResult` si se desea alinear en el futuro, pero eso esta fuera de scope.

### DT3: No se modifica `useBusinessDataCache.ts`

El PRD marca explicitamente que refactorizar el cache esta fuera de scope. El tipo `BusinessCacheEntry` y las funciones del cache permanecen en el hook file. La unica dependencia entre el servicio y el cache es que ambos manejan la misma forma de datos, lo cual se satisface con `BusinessDataResult`.
