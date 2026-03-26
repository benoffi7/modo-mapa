# Specs: Distancia al usuario en búsqueda y favoritos

**Feature:** distancia-busqueda
**Issue:** #147
**Fecha:** 2026-03-16

---

## Estado actual

- Haversine ya implementada en `src/hooks/useSuggestions.ts` (líneas 13-29) como función local `distanceKm()`.
- Geolocation del usuario en `MapContext` via `useFilters().userLocation`.
- Business tiene `lat`/`lng` en el tipo (`src/types/index.ts`).
- SuggestionsView muestra nombre, categoría, dirección y chips de razón.
- FavoritesList muestra nombre, categoría y dirección.

---

## Cambios

### 1. Extraer Haversine a utilidad compartida

**Archivo nuevo:** `src/utils/distance.ts`

```typescript
/** Haversine distance in km between two lat/lng points. */
export function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number { ... }

/** Format distance for display: "a 300m" or "a 1.2km" */
export function formatDistance(km: number): string {
  if (km < 1) return `a ${Math.round(km * 1000)}m`;
  return `a ${km.toFixed(1)}km`;
}
```

- Mover la función de `useSuggestions.ts` a `src/utils/distance.ts`.
- `useSuggestions.ts` importa desde la nueva ubicación.

### 2. Mostrar distancia en SuggestionsView

**Archivo:** `src/components/menu/SuggestionsView.tsx`

- Importar `useFilters` de MapContext para obtener `userLocation`.
- Importar `distanceKm`, `formatDistance` de `src/utils/distance.ts`.
- En cada `ListItemButton`, calcular distancia si `userLocation` disponible.
- Mostrar como `Typography` caption debajo de la dirección: "a 300m".
- Si `userLocation` es null, no mostrar nada.

### 3. Mostrar distancia en FavoritesList

**Archivo:** `src/components/menu/FavoritesList.tsx`

- Misma lógica: importar utils y `useFilters`.
- Mostrar distancia debajo de la dirección de cada favorito.
- Si `userLocation` es null, no mostrar.

### 4. No agregar a búsqueda filtrada

La búsqueda usa `useBusinesses` que filtra la lista estática. Los resultados se muestran en el mapa (markers), no en una lista. No aplica mostrar distancia ahí.

---

## Archivos

| Archivo | Acción |
|---------|--------|
| `src/utils/distance.ts` | **Nuevo** — Haversine + formatDistance |
| `src/hooks/useSuggestions.ts` | Importar distanceKm desde utils |
| `src/components/menu/SuggestionsView.tsx` | Mostrar distancia por item |
| `src/components/menu/FavoritesList.tsx` | Mostrar distancia por item |

---

## Decisiones

1. **Cálculo client-side** — Haversine es O(1), no query a Firestore.
2. **Sin caché de distancias** — recalcular en cada render es trivial.
3. **Formato**: metros si <1km, km con 1 decimal si >=1km.
4. **Sin ubicación = sin distancia** — no pedir permisos, usar si ya están.
