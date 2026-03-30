# Specs: Trending por Zona

**PRD:** [prd.md](prd.md)
**Fecha:** 2026-03-30

## Modelo de datos

No se crean nuevas collections ni documentos. Se reutiliza la data existente.

### Tipos nuevos

```typescript
// src/types/index.ts
type LocationSource = 'gps' | 'locality' | 'office';

interface LocalTrendingResult {
  businesses: TrendingBusiness[];
  source: LocationSource;
  localityName: string | null;  // null cuando source es 'office'
  radiusKm: number;
}
```

### Constantes

```typescript
// src/constants/trending.ts
export const LOCAL_TRENDING_RADII = [1, 2, 5]; // km, expansión progresiva
export const LOCAL_TRENDING_MIN_RESULTS = 5;
export const LOCAL_TRENDING_MAX_RESULTS = 8;
export const STORAGE_KEY_DISMISS_LOCALITY_HINT = 'mm_dismiss_locality_hint';
```

## Firestore Rules

Sin cambios. No hay nuevas queries ni collections.

## Cloud Functions

Sin cambios. El filtrado es 100% client-side sobre datos ya cacheados por `useTrending()`.

## Componentes

### `TrendingNearYouSection` (nuevo)

| Propiedad | Detalle |
|---|---|
| Archivo | `src/components/home/TrendingNearYouSection.tsx` |
| Props | Ninguna (consume hooks internamente) |
| Hooks | `useLocalTrending()`, `useNavigateToBusiness()`, `useTabNavigation()` |
| Render | Carrusel horizontal de `TrendingBusinessCard` + subtítulo dinámico |

**Lógica de render:**

1. Llama a `useLocalTrending()` → obtiene `{ businesses, source, localityName, radiusKm, loading }`
2. Muestra título "Trending cerca tuyo"
3. Subtítulo según `source`:
   - `'gps'` → "Cerca tuyo"
   - `'locality'` → `"En ${localityName}"`
   - `'office'` → "En tu zona"
4. Si `source === 'office'` y no dismisseado → label caption: "Configurá tu localidad para resultados más precisos"
5. Carrusel horizontal reutilizando `TrendingBusinessCard` existente
6. Chip "Ver todos" → `navigateToSearchWithFilter` o abre RankingsView

### `HomeScreen` (modificar)

| Archivo | `src/components/home/HomeScreen.tsx` |
|---|---|
| Cambio | Agregar `<TrendingNearYouSection />` entre `<SpecialsSection />` y `<RecentSearches />` |

### `RankingsView` (modificar)

| Archivo | `src/components/social/RankingsView.tsx` |
|---|---|
| Cambio | Agregar chip "Mi zona" junto a chips de período |

**Lógica:**
- Nuevo state: `zoneFilter: boolean` (default false)
- Chip "Mi zona" con icono `PlaceIcon`
- Cuando activo: filtra `ranking.rankings` cruzando `businessId` con negocios en radio usando `useSortLocation()`
- El chip de zona es independiente de los chips de período (se combinan)

## Hooks

### `useLocalTrending()` (nuevo)

| Propiedad | Detalle |
|---|---|
| Archivo | `src/hooks/useLocalTrending.ts` |
| Params | Ninguno |
| Return | `{ businesses: TrendingBusiness[], source: LocationSource, localityName: string \| null, radiusKm: number, loading: boolean }` |
| Deps | `useTrending()`, `useSortLocation()`, `useUserSettings()`, `useFilters()` |

**Lógica:**
1. Obtiene coordenadas de `useSortLocation()` (GPS → localidad → oficina)
2. Determina `source`: si `userLocation` de FiltersContext existe → `'gps'`; si `settings.localityLat` → `'locality'`; else → `'office'`
3. Obtiene `localityName` de `settings.locality` (null si source es office)
4. Filtra `trending.businesses` por distancia haversine al punto
5. Expansión progresiva de radio: intenta 1km, si < 5 resultados → 2km, si < 5 → 5km
6. Retorna máximo 8 resultados ordenados por score descendente

### Función utilitaria `haversineDistance`

```typescript
// src/utils/geo.ts
export function haversineDistance(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number; // retorna km
```

Verificar si ya existe en el proyecto; si no, crear.

## Servicios

Sin nuevos servicios. Se reutiliza `useTrending()` existente.

## Integración

| Archivo | Cambio |
|---|---|
| `src/components/home/HomeScreen.tsx` | Import + render `TrendingNearYouSection` |
| `src/components/social/RankingsView.tsx` | Chip "Mi zona" + filtrado |
| `src/types/index.ts` | Agregar `LocationSource` type |
| `src/constants/trending.ts` | Nuevo archivo con constantes |

## Tests

| Archivo | Casos |
|---|---|
| `src/hooks/useLocalTrending.test.ts` | Filtrado por radio 1km, expansión a 2km/5km, detección correcta de source (gps/locality/office), max 8 resultados |
| `src/components/home/TrendingNearYouSection.test.tsx` | Render con GPS (muestra "Cerca tuyo"), render con localidad (muestra "En X"), render con office (muestra label sugerencia), dismiss del label |
| `src/utils/geo.test.ts` | Haversine: distancia conocida Buenos Aires-Palermo, distancia 0, antípodas |

**Mocks:** `useTrending` mockeado con datos fijos, `useSortLocation` mockeado por source.

## Analytics

| Evento | Params | Cuándo |
|---|---|---|
| `trending_near_viewed` | `{ source, radius_km, count }` | Sección visible |
| `trending_near_tapped` | `{ business_id, rank, source }` | Tap en card |
| `trending_near_configure_tapped` | `{ source: 'office' }` | Tap en label configurar |
| `rankings_zone_filter` | `{ enabled: boolean }` | Toggle chip "Mi zona" |

## Offline

- `useTrending()` ya tiene cache de 10 minutos en memoria
- `allBusinesses` se carga al inicio y persiste
- La sección funciona offline con datos cacheados
- Sin writes: no hay operaciones offline a encolar

## Decisiones técnicas

1. **Filtrado client-side**: el dataset de trending es pequeño (top ~50 negocios). No justifica una Cloud Function dedicada por zona
2. **Reutilizar `useSortLocation`**: ya resuelve la cadena GPS → localidad → oficina, no duplicar lógica
3. **Haversine vs bounding box**: haversine es más preciso para radios pequeños (1-5km). El costo computacional es despreciable con < 50 items
4. **No persistir el radio**: se calcula dinámicamente. Evita estado stale si el usuario cambia de ubicación
