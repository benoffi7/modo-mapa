# Specs Técnicas: Mitigaciones de Cuota Firebase

## Fase 1 — Firestore Offline Persistence

### Cambio en `src/config/firebase.ts`

Reemplazar `getFirestore(app)` por `initializeFirestore` con persistent cache:

```typescript
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';

// Producción: cache persistente en IndexedDB
// DEV: sin cache persistente (emuladores no lo soportan bien)
export const db = import.meta.env.DEV
  ? getFirestore(app)
  : initializeFirestore(app, {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager(),
      }),
    });
```

### Comportamiento esperado

- En producción: Firestore cachea documentos en IndexedDB automáticamente
- Queries posteriores al mismo documento se sirven desde cache (0 reads)
- Firestore sincroniza en background cuando hay conexión
- En DEV: comportamiento actual sin cambios (emuladores)

### Archivos modificados

| Archivo | Cambio |
|---------|--------|
| `src/config/firebase.ts` | `getFirestore` → `initializeFirestore` con `persistentLocalCache` |

---

## Fase 2 — Cache Client-Side para Business View

### Nuevo hook: `src/hooks/useBusinessDataCache.ts`

Cache en memoria con TTL para los datos del business view.

```typescript
interface BusinessCacheEntry {
  isFavorite: boolean;
  ratings: Rating[];
  comments: Comment[];
  userTags: UserTag[];
  customTags: CustomTag[];
  timestamp: number;
}

interface BusinessDataCache {
  get(businessId: string): BusinessCacheEntry | null;
  set(businessId: string, data: BusinessCacheEntry): void;
  invalidate(businessId: string): void;
  invalidateCollection(businessId: string, collection: 'favorites' | 'ratings' | 'comments' | 'userTags' | 'customTags'): void;
}
```

**TTL:** 5 minutos (300,000 ms).

**Storage:** `Map<string, BusinessCacheEntry>` a nivel de módulo (singleton, persiste durante la sesión del tab).

### Nuevo hook: `src/hooks/useBusinessData.ts`

Hook que orquesta la carga de datos del business view, usando cache o Firestore.

```typescript
interface UseBusinessDataReturn {
  isFavorite: boolean;
  ratings: Rating[];
  comments: Comment[];
  userTags: UserTag[];
  customTags: CustomTag[];
  isLoading: boolean;
  error: boolean;
  refetch: (collection?: 'favorites' | 'ratings' | 'comments' | 'userTags' | 'customTags') => void;
}

function useBusinessData(businessId: string | null): UseBusinessDataReturn;
```

**Lógica:**

1. Si `businessId` es null → retorna estado vacío
2. Si hay cache válido (TTL no expirado) → retorna datos del cache
3. Si no → ejecuta las 5 queries en paralelo con `Promise.all`:
   - `getDoc` favorito
   - `getDocs` ratings (where businessId)
   - `getDocs` comments (where businessId)
   - `getDocs` userTags (where businessId)
   - `getDocs` customTags (where userId + businessId)
4. Guarda resultado en cache
5. `refetch(collection)` invalida cache de esa colección y recarga

### Cambios en `BusinessSheet.tsx`

```typescript
// Antes: pasa solo businessId a cada hijo
<BusinessRating businessId={businessId} />

// Después: usa useBusinessData y pasa datos como props
const businessData = useBusinessData(selectedBusiness?.id ?? null);
<BusinessRating
  businessId={businessId}
  ratings={businessData.ratings}
  isLoading={businessData.isLoading}
  onRatingChange={() => businessData.refetch('ratings')}
/>
```

### Cambios en componentes hijos

#### `FavoriteButton.tsx`

```typescript
// Antes
interface Props {
  businessId: string;
}
// Estado interno: isFavorite, isLoading
// useEffect: getDoc al montar

// Después
interface Props {
  businessId: string;
  isFavorite: boolean;
  isLoading: boolean;
  onToggle: () => void;
}
// Sin estado de carga propio
// Sin useEffect de lectura
// Al toggle: hace write a Firestore + llama onToggle para invalidar cache
```

#### `BusinessRating.tsx`

```typescript
// Antes
interface Props {
  businessId: string;
}
// Estado interno: averageRating, totalRatings, myRating
// useEffect: getDocs al montar

// Después
interface Props {
  businessId: string;
  ratings: Rating[];
  isLoading: boolean;
  onRatingChange: () => void;
}
// Calcula averageRating, totalRatings, myRating desde props (useMemo)
// Sin useEffect de lectura
// Al calificar: write a Firestore + llama onRatingChange
```

#### `BusinessComments.tsx`

```typescript
// Antes
interface Props {
  businessId: string;
}
// Estado interno: comments[], newComment, isSubmitting, etc.
// useEffect: getDocs al montar

// Después
interface Props {
  businessId: string;
  comments: Comment[];
  isLoading: boolean;
  onCommentsChange: () => void;
}
// comments viene de props, estado local solo para UI (newComment, isSubmitting, confirmDeleteId)
// Sin useEffect de lectura
// Al crear/eliminar: write a Firestore + llama onCommentsChange
```

#### `BusinessTags.tsx`

```typescript
// Antes
interface Props {
  businessId: string;
  seedTags: string[];
}
// Estado interno: tagCounts[], customTags[]
// useEffect: 2x getDocs al montar

// Después
interface Props {
  businessId: string;
  seedTags: string[];
  userTags: UserTag[];
  customTags: CustomTag[];
  isLoading: boolean;
  onTagsChange: () => void;
}
// Calcula tagCounts desde props (useMemo sobre userTags + seedTags)
// Sin useEffect de lectura
// Al toggle/crear/editar/eliminar: write a Firestore + llama onTagsChange
```

### Archivos nuevos

| Archivo | Descripción |
|---------|-------------|
| `src/hooks/useBusinessDataCache.ts` | Cache singleton con TTL |
| `src/hooks/useBusinessData.ts` | Hook orquestador de datos del business view |

### Archivos modificados

| Archivo | Cambio |
|---------|--------|
| `src/components/business/BusinessSheet.tsx` | Usa `useBusinessData`, pasa datos como props |
| `src/components/business/FavoriteButton.tsx` | Props-driven, sin fetch propio |
| `src/components/business/BusinessRating.tsx` | Props-driven, sin fetch propio |
| `src/components/business/BusinessComments.tsx` | Props-driven, sin fetch propio |
| `src/components/business/BusinessTags.tsx` | Props-driven, sin fetch propio |

---

## Fase 3 — Cache de Listas del Menú

### Cambios en `src/hooks/usePaginatedQuery.ts`

Agregar cache de primera página con TTL.

```typescript
// Cache a nivel de módulo
const queryCache = new Map<string, { items: unknown[]; lastDoc: unknown; hasMore: boolean; timestamp: number }>();

// TTL: 2 minutos
const CACHE_TTL = 2 * 60 * 1000;

// Generar cache key
function getCacheKey(collectionPath: string, userId: string): string {
  return `${collectionPath}__${userId}`;
}

// Nueva función exportada para invalidar
export function invalidateQueryCache(collectionPath: string, userId: string): void {
  queryCache.delete(getCacheKey(collectionPath, userId));
}
```

**Lógica modificada en `loadPage`:**

1. Si es primera página y hay cache válido → usar cache, no hacer query
2. Si es primera página y no hay cache → hacer query y guardar en cache
3. Si es "Cargar más" → siempre hacer query (no cachear páginas subsiguientes)
4. `reload()` → invalida cache y recarga

### Invalidación desde componentes de write

Los componentes que hacen writes deben invalidar el cache de la colección afectada:

| Componente | Acción | Invalidar |
|-----------|--------|-----------|
| `FavoriteButton` | toggle favorito | `favorites` cache |
| `BusinessComments` | crear/eliminar comentario | `comments` cache |
| `BusinessRating` | calificar | `ratings` cache |

La invalidación se hace llamando `invalidateQueryCache(collectionPath, userId)` después del write exitoso.

### Archivos modificados

| Archivo | Cambio |
|---------|--------|
| `src/hooks/usePaginatedQuery.ts` | Cache de primera página + export `invalidateQueryCache` |
| `src/components/business/FavoriteButton.tsx` | Llama `invalidateQueryCache` en toggle |
| `src/components/business/BusinessComments.tsx` | Llama `invalidateQueryCache` en create/delete |
| `src/components/business/BusinessRating.tsx` | Llama `invalidateQueryCache` en rate |

---

## Resumen de archivos totales

### Archivos nuevos (2)

| Archivo | Fase |
|---------|------|
| `src/hooks/useBusinessDataCache.ts` | 2 |
| `src/hooks/useBusinessData.ts` | 2 |

### Archivos modificados (7)

| Archivo | Fases | Cambios |
|---------|-------|---------|
| `src/config/firebase.ts` | 1 | `initializeFirestore` con persistent cache |
| `src/components/business/BusinessSheet.tsx` | 2 | `useBusinessData` + props a hijos |
| `src/components/business/FavoriteButton.tsx` | 2, 3 | Props-driven + invalidar query cache |
| `src/components/business/BusinessRating.tsx` | 2, 3 | Props-driven + invalidar query cache |
| `src/components/business/BusinessComments.tsx` | 2, 3 | Props-driven + invalidar query cache |
| `src/components/business/BusinessTags.tsx` | 2 | Props-driven |
| `src/hooks/usePaginatedQuery.ts` | 3 | Cache de primera página |

### Sin archivos eliminados

---

## Testing

### Tests unitarios nuevos

| Test | Qué valida |
|------|-----------|
| `useBusinessDataCache.test.ts` | TTL expira, invalidate borra entrada, invalidateCollection recarga solo esa |
| `useBusinessData.test.ts` | Cache hit no hace queries, cache miss hace 5 queries, refetch invalida y recarga |
| `usePaginatedQuery.test.ts` (actualizar) | Cache hit en primera página, cache miss hace query, loadMore no usa cache, reload invalida |

### Tests manuales

| Escenario | Verificar |
|-----------|----------|
| Abrir comercio → cerrar → reabrir (< 5 min) | No hay queries a Firestore (cache hit) |
| Abrir comercio → comentar → cerrar → reabrir | Comentario nuevo visible (cache invalidado) |
| Abrir favoritos → cerrar → reabrir (< 2 min) | No hay query a Firestore |
| Agregar favorito → abrir lista favoritos | Favorito nuevo visible (cache invalidado) |
| Cerrar tab → reabrir app | Datos se cargan desde IndexedDB (persistence) |
| Modo avión → abrir comercio visitado | Datos visibles desde IndexedDB cache |

---

## Dependencias

No se agregan dependencias nuevas. Todo se implementa con APIs existentes de Firebase y React.
