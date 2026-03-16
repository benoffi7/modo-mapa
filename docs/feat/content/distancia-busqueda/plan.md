# Plan: Distancia al usuario en búsqueda y favoritos

**Feature:** distancia-busqueda
**Issue:** #147

---

## Paso 1: Crear src/utils/distance.ts

- Extraer `distanceKm()` de `useSuggestions.ts`.
- Agregar `formatDistance(km)` para formato "a Xm" / "a X.Xkm".

## Paso 2: Refactorizar useSuggestions.ts

- Reemplazar función local `distanceKm` con import de `src/utils/distance.ts`.

## Paso 3: Agregar distancia en SuggestionsView

- Importar `useFilters` y utils de distancia.
- Calcular y mostrar distancia por cada sugerencia.

## Paso 4: Agregar distancia en FavoritesList

- Importar `useFilters` y utils de distancia.
- Calcular y mostrar distancia por cada favorito.

## Paso 5: Tests

- Test unitario de `distanceKm` y `formatDistance`.

---

## Criterios de merge

- [ ] Distancia visible en sugerencias cuando hay ubicación
- [ ] Distancia visible en favoritos cuando hay ubicación
- [ ] Sin ubicación, no se muestra nada extra
- [ ] Formato correcto: metros (<1km) y kilómetros (>=1km)
- [ ] `useSuggestions` sigue funcionando correctamente
- [ ] Lint y tests pasan
