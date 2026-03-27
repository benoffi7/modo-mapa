# Specs: Offline read caching -- businesses, comments, profile

**PRD:** [prd.md](prd.md)
**Fecha:** 2026-03-27

---

## Modelo de datos

No hay colecciones nuevas de Firestore. Esta feature opera exclusivamente client-side con IndexedDB.

### IndexedDB schema

**Database:** `modo-mapa-read-cache` (separada de `modo-mapa-offline` del offline queue)
**Version:** 1
**Object store:** `businessData`

- **keyPath:** `businessId`
- **Indexes:**
  - `accessedAt` (unique: false) -- para LRU eviction

### TypeScript interfaces

```typescript
// src/types/readCache.ts (nuevo)

/** Entry serializada en IndexedDB. Sets se convierten a arrays para serialization. */
export interface ReadCacheEntry {
  businessId: string;
  isFavorite: boolean;
  ratings: Rating[];
  comments: Comment[];
  userTags: UserTag[];
  customTags: CustomTag[];
  userCommentLikeIds: string[];   // Set<string> serializado como array
  priceLevels: PriceLevel[];
  menuPhoto: MenuPhoto | null;
  cachedAt: number;               // Date.now() al momento del cache
  accessedAt: number;             // Date.now() al ultimo acceso (para LRU)
}

/** Resultado de leer del cache con metadata de staleness */
export interface ReadCacheResult {
  data: Omit<ReadCacheEntry, 'cachedAt' | 'accessedAt' | 'userCommentLikeIds'> & {
    userCommentLikes: Set<string>;  // deserializado de userCommentLikeIds
  };
  stale: boolean;                   // true si cachedAt + TTL < now
}
```

Las interfaces reutilizan `Rating`, `Comment`, `UserTag`, `CustomTag`, `PriceLevel`, `MenuPhoto` de `src/types/index.ts`.

## Firestore Rules

Sin cambios. Esta feature no agrega queries ni modifica colecciones de Firestore.

### Rules impact analysis

| Query (service file) | Collection | Auth context | Rule that allows it | Change needed? |
|---------------------|------------|-------------|-------------------|----------------|
| N/A | N/A | N/A | N/A | No |

No hay queries nuevas a Firestore. Todos los datos se leen de IndexedDB local.

## Cloud Functions

Sin cambios. No se requieren triggers, scheduled functions ni callable functions.

## Componentes

### `StaleBanner` (nuevo)

- **Archivo:** `src/components/business/StaleBanner.tsx`
- **Props:**
  ```typescript
  interface StaleBannerProps {
    stale: boolean;
    onDismiss: () => void;
  }
  ```
- **Render:** Dentro de `BusinessSheet`, debajo del header y encima del contenido principal.
- **Comportamiento:**
  - Muestra `Alert` severity="info" con texto "Datos pueden no estar actualizados" cuando `stale === true`.
  - Dismissible via boton de cerrar (`onDismiss` setea estado local a false).
  - No renderiza nada cuando `stale === false`.
  - Patron visual alineado con `OfflineIndicator`: compacto, informativo, no bloqueante.
- **Accesibilidad:** `role="status"`, `aria-live="polite"`.

### `BusinessSheet` (modificado)

- **Archivo:** `src/components/business/BusinessSheet.tsx`
- **Cambios:**
  - Recibe `stale` de `useBusinessData` (nuevo campo en el return type).
  - Renderiza `<StaleBanner stale={stale} onDismiss={handleDismissStale} />` debajo del header.
  - `handleDismissStale` es un `useState(false)` local que oculta el banner para la sesion actual de ese negocio. Se resetea cuando cambia `businessId`.

### `SearchScreen` / `SearchListView` (modificado)

- **Archivo:** `src/components/search/SearchListView.tsx`
- **Cambios:**
  - Cuando `isOffline` (de `useConnectivity`), mostrar un `Chip` label="Resultados offline" color="warning" size="small" encima de la lista.
  - Los datos de `useBusinesses()` ya usan `allBusinesses` del JSON estatico, que esta siempre disponible en memoria. No se requiere cambio en la logica de filtrado.
  - El cruce con datos dinamicos (ratings, price levels) del cache de IndexedDB se hace opcionalmente para enriquecer la vista de lista offline. Esto se maneja a traves de una funcion helper exportada por `readCache.ts` (`getCachedBusinessIds`) que permite saber que negocios tienen datos cacheados.

## Hooks

### `useBusinessData` (modificado)

- **Archivo:** `src/hooks/useBusinessData.ts`
- **Cambios en return type:**
  ```typescript
  interface UseBusinessDataReturn {
    // ... campos existentes ...
    stale: boolean;   // nuevo: true si datos vienen de IndexedDB (no frescos)
  }
  ```
- **Cambios en logica de `load()`:**
  1. Check in-memory cache (existente, sin cambios).
  2. **Nuevo:** Si in-memory miss, check IndexedDB via `getReadCacheEntry(businessId)`.
     - Si IndexedDB hit: setear datos con `stale: true` (independientemente del TTL de IndexedDB, porque no son frescos de Firestore). Continuar con fetch a Firestore en background.
     - Si IndexedDB miss: continuar con fetch normal.
  3. Fetch a Firestore (existente).
  4. **Nuevo:** Al completar fetch exitoso, llamar `setReadCacheEntry(businessId, data)` para persistir en IndexedDB.
  5. Al completar fetch exitoso, setear `stale: false`.
- **Cambios en error path:**
  - Si Firestore falla y hay datos en IndexedDB, mantener los datos cacheados con `stale: true` en vez de mostrar error.
  - Si Firestore falla y no hay datos en IndexedDB, mantener el comportamiento existente (`error: true`).

### `useBusinessDataCache` (modificado)

- **Archivo:** `src/hooks/useBusinessDataCache.ts`
- **Cambios:**
  - `clearAllBusinessCache()`: ademas de limpiar el `Map` in-memory, llamar `clearReadCache()` de `readCache.ts` para limpiar IndexedDB.

## Servicios

### `readCache.ts` (nuevo)

- **Archivo:** `src/services/readCache.ts`
- **Dependencias:** Solo `src/constants/cache.ts` para constantes. Sin dependencias de React ni Firebase.
- **Patron:** Alineado con `offlineQueue.ts` -- IndexedDB nativa, singleton DB, async functions.
- **Funciones exportadas:**

```typescript
/** Abre (o reutiliza) la conexion a IndexedDB del read cache. */
export function openReadCacheDb(): Promise<IDBDatabase>;

/**
 * Lee una entrada del cache.
 * Retorna null si no existe.
 * Retorna { data, stale } donde stale indica si paso el TTL.
 * Actualiza accessedAt para LRU tracking.
 */
export async function getReadCacheEntry(businessId: string): Promise<ReadCacheResult | null>;

/**
 * Escribe una entrada en el cache.
 * Si ya hay MAX_ENTRIES, evicta la mas antigua por accessedAt (LRU).
 * Serializa Set<string> a string[] para IndexedDB compat.
 */
export async function setReadCacheEntry(
  businessId: string,
  data: {
    isFavorite: boolean;
    ratings: Rating[];
    comments: Comment[];
    userTags: UserTag[];
    customTags: CustomTag[];
    userCommentLikes: Set<string>;
    priceLevels: PriceLevel[];
    menuPhoto: MenuPhoto | null;
  },
): Promise<void>;

/** Retorna la lista de businessIds que tienen datos en cache. */
export async function getCachedBusinessIds(): Promise<string[]>;

/** Elimina todas las entradas del cache (para logout/delete account). */
export async function clearReadCache(): Promise<void>;

/** Reset singleton para testing. Solo disponible en DEV. */
export const _resetForTest: (() => void) | undefined;
```

- **Detalles de implementacion:**
  - Singleton `dbInstance` con lazy init (mismo patron que `offlineQueue.ts`).
  - `getReadCacheEntry`: lee con `store.get(businessId)`, compara `cachedAt` con `READ_CACHE_TTL_MS` para determinar `stale`, actualiza `accessedAt` con `store.put` en misma transaccion readwrite.
  - `setReadCacheEntry`: antes de `put`, cuenta entries con `store.count()`. Si `count >= READ_CACHE_MAX_ENTRIES`, abre cursor en index `accessedAt` con direction ascending, elimina el primer resultado (LRU eviction), luego hace `put`.
  - `clearReadCache`: abre transaccion readwrite, llama `store.clear()`.
  - Serialization de `Set<string>` a `string[]`: `userCommentLikes` se convierte con `Array.from()` al escribir y `new Set()` al leer.

## Integracion

### Archivos existentes que requieren modificacion

| Archivo | Cambio |
|---------|--------|
| `src/hooks/useBusinessData.ts` | Integrar fallback a `readCache.ts`, exponer `stale` en return, persistir en IndexedDB tras fetch exitoso |
| `src/hooks/useBusinessDataCache.ts` | `clearAllBusinessCache()` tambien limpia IndexedDB |
| `src/components/business/BusinessSheet.tsx` | Renderizar `StaleBanner` con datos de `useBusinessData().stale`, handler `onDismiss` |
| `src/components/search/SearchListView.tsx` | Chip "Resultados offline" cuando `isOffline` |
| `src/services/emailAuth.ts` | `signOutAndReset()` y `deleteAccount()` llaman `clearReadCache()` (via `clearAllBusinessCache` que ya se limpia, pero tambien directamente por seguridad) |
| `src/constants/cache.ts` | Agregar 3 constantes nuevas |
| `src/constants/analyticsEvents.ts` | Agregar 3 eventos nuevos |

### Wiring de props

- `BusinessSheet` -> `StaleBanner`: `stale` viene de `useBusinessData(businessId).stale`. `onDismiss` es `() => setStaleDismissed(true)` donde `staleDismissed` es estado local de `BusinessSheet` reseteado en `useEffect` cuando cambia `businessId`.
- `SearchListView` -> `Chip`: `isOffline` viene de `useConnectivity()` hook.

## Tests

| Archivo test | Que testear | Tipo |
|-------------|-------------|------|
| `src/services/readCache.test.ts` (nuevo) | openReadCacheDb, getReadCacheEntry (hit/miss/stale), setReadCacheEntry (normal/LRU eviction), getCachedBusinessIds, clearReadCache, serialization Set<->Array | Service |
| `src/hooks/useBusinessDataCache.test.ts` (extender) | clearAllBusinessCache llama clearReadCache | Hook |
| `src/components/business/StaleBanner.test.tsx` (nuevo) | Render cuando stale=true, no render cuando stale=false, dismiss callback | Component |

### Casos clave para `readCache.test.ts`

1. **openReadCacheDb** -- abre DB y crea object store con index.
2. **getReadCacheEntry miss** -- retorna null para businessId no cacheado.
3. **getReadCacheEntry hit fresh** -- retorna datos con `stale: false` cuando dentro de TTL.
4. **getReadCacheEntry hit stale** -- retorna datos con `stale: true` cuando fuera de TTL.
5. **getReadCacheEntry actualiza accessedAt** -- verifica que accessedAt se actualiza al leer.
6. **setReadCacheEntry serializa Set** -- verifica que `userCommentLikes` Set se guarda como array y se reconstruye al leer.
7. **setReadCacheEntry LRU eviction** -- con MAX_ENTRIES=20, al escribir el entry 21, el menos reciente se elimina.
8. **getCachedBusinessIds** -- retorna lista de IDs cacheados.
9. **clearReadCache** -- vacia el store completo.
10. **Concurrent access** -- dos escrituras rapidas no corrompen datos.

### Mock strategy

- Usar `fake-indexeddb/auto` (mismo patron que `offlineQueue.test.ts`).
- Fake timers para TTL expiry tests.
- `_resetForTest` para limpiar singleton entre tests.

### Criterio de aceptacion

- Cobertura >= 80% del codigo nuevo.
- Todos los paths condicionales cubiertos (in-memory hit, IndexedDB hit stale, IndexedDB hit fresh, full miss, error with cache fallback, error without cache).

## Analytics

| Evento | Parametros | Cuando |
|--------|-----------|--------|
| `EVT_READ_CACHE_HIT` | `business_id`, `stale` (boolean) | IndexedDB hit en `useBusinessData` |
| `EVT_READ_CACHE_MISS` | `business_id` | IndexedDB miss y Firestore fetch requerido |
| `EVT_READ_CACHE_FALLBACK` | `business_id` | Firestore falla, datos servidos desde IndexedDB |

Constantes nuevas en `src/constants/analyticsEvents.ts`:

```typescript
export const EVT_READ_CACHE_HIT = 'read_cache_hit';
export const EVT_READ_CACHE_MISS = 'read_cache_miss';
export const EVT_READ_CACHE_FALLBACK = 'read_cache_fallback';
```

---

## Offline

### Cache strategy

| Dato | Estrategia | TTL | Storage |
|------|-----------|-----|---------|
| Business data (ratings, comments, tags, prices, photo, favorite) | Read-through: in-memory -> IndexedDB -> Firestore | In-memory: 5 min. IndexedDB: 24h | `Map` (in-memory) + IndexedDB `modo-mapa-read-cache` |
| Static business info (name, address, category, location) | Always available | N/A (bundled) | `businesses.json` importado en memoria |
| Visit history (IDs + counts) | localStorage | Indefinido | `STORAGE_KEY_VISITS` en localStorage |

### Writes offline

| Operacion | Mecanismo | Conflict resolution |
|-----------|-----------|-------------------|
| N/A | N/A | N/A |

Este feature es read-only. Las escrituras offline ya estan cubiertas por `withOfflineSupport` + `offlineQueue.ts` (issue #136).

### Fallback UI

| Escenario | UI |
|-----------|-----|
| Business visitado, datos en IndexedDB | Contenido completo + `StaleBanner` ("Datos pueden no estar actualizados") |
| Business no visitado, sin datos en IndexedDB | `BusinessSheet` muestra error state existente. El usuario ve "No disponible offline" (ya cubierto por error state). |
| Busqueda offline | Lista de resultados estaticos de `businesses.json` + `Chip` "Resultados offline". Datos dinamicos (ratings, price) solo disponibles para negocios cacheados. |
| Firestore falla pero IndexedDB tiene datos | Muestra datos cacheados + `StaleBanner`, en vez de error state. |

---

## Decisiones tecnicas

### 1. IndexedDB nativa vs libreria (idb, Dexie)

**Decision:** IndexedDB nativa.
**Razon:** Alineado con el patron existente en `offlineQueue.ts`. El PRD explicitamente marca "sin dependencias externas" como out of scope. El volumen de datos es bajo (max 20 entries) y las operaciones son simples.

### 2. TTL de IndexedDB: 24 horas

**Decision:** 24h para el TTL del cache persistente.
**Razon:** Suficiente para cubrir sesiones offline tipicas (perdida temporal de conexion, transporte). Datos mas viejos de 24h son poco confiables. El TTL no evicta automaticamente -- solo marca `stale: true`. Los datos se sirven aunque sean stale, priorizando disponibilidad sobre frescura.

### 3. Stale siempre true al servir de IndexedDB

**Decision:** Cualquier dato servido desde IndexedDB (incluso dentro del TTL de 24h) se marca como `stale: true` en la primera render.
**Razon:** Los datos de IndexedDB no reflejan el estado actual del servidor. El fetch a Firestore en background actualiza los datos y setea `stale: false`. Esto evita que el usuario asuma que datos de cache son autoritativos.

### 4. LRU con max 20 entries

**Decision:** Maximo 20 negocios en cache, eviccion LRU basada en `accessedAt`.
**Razon:** 20 entries coincide con el limite de visit history existente (`MAX_VISIT_HISTORY`). Mantiene el tamanio de IndexedDB acotado. Un negocio cacheado con datos completos ocupa ~5-10 KB (comments son el bulk), por lo que 20 entries ~ 100-200 KB.

### 5. Stale banner dismissible por sesion de negocio

**Decision:** El banner se puede cerrar y no reaparece mientras el mismo negocio este abierto.
**Razon:** El usuario ya fue informado. Reapareceria molestamente si se cierra y reabre el mismo sheet. Se resetea al cambiar de negocio para informar nuevamente.
