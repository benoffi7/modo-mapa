# Plan: Trending por Zona

**Specs:** [specs.md](specs.md)
**Fecha:** 2026-03-30

## Fases de implementación

### Fase 1 — Utilidad geo + tipos

| Paso | Archivo | Cambio |
|---|---|---|
| 1 | `src/types/index.ts` | Agregar type `LocationSource = 'gps' \| 'locality' \| 'office'` |
| 2 | `src/utils/geo.ts` | Crear función `haversineDistance(lat1, lng1, lat2, lng2): number` (km). Verificar primero si ya existe |
| 3 | `src/utils/geo.test.ts` | Tests de haversine con distancias conocidas |
| 4 | `src/constants/trending.ts` | Crear con `LOCAL_TRENDING_RADII`, `MIN_RESULTS`, `MAX_RESULTS`, `STORAGE_KEY_DISMISS` |

### Fase 2 — Hook `useLocalTrending`

| Paso | Archivo | Cambio |
|---|---|---|
| 1 | `src/hooks/useLocalTrending.ts` | Crear hook que consume `useTrending()`, `useSortLocation()`, `useUserSettings()`, `useFilters()`. Filtra por haversine con expansión progresiva de radio. Detecta source (gps/locality/office) |
| 2 | `src/hooks/useLocalTrending.test.ts` | Tests: filtrado por radio, expansión, detección de source, límite de 8 |

### Fase 3 — Componente `TrendingNearYouSection`

| Paso | Archivo | Cambio |
|---|---|---|
| 1 | `src/components/home/TrendingNearYouSection.tsx` | Crear componente con carrusel horizontal de `TrendingBusinessCard`, subtítulo dinámico por source, label de sugerencia dismisseable cuando source es office |
| 2 | `src/components/home/TrendingNearYouSection.test.tsx` | Tests: render por cada source, dismiss de label, analytics |
| 3 | `src/components/home/HomeScreen.tsx` | Import + agregar `<TrendingNearYouSection />` entre `SpecialsSection` y `RecentSearches` |

### Fase 4 — Filtro "Mi zona" en Rankings

| Paso | Archivo | Cambio |
|---|---|---|
| 1 | `src/components/social/RankingsView.tsx` | Agregar chip "Mi zona" con `PlaceIcon`, state `zoneFilter`, lógica de filtrado cruzando trending businesses con coordenadas |
| 2 | Tests existentes de RankingsView | Agregar caso de chip "Mi zona" |

### Fase 5 — Analytics + lint + commit

| Paso | Archivo | Cambio |
|---|---|---|
| 1 | `src/constants/analyticsEvents.ts` | Agregar eventos `trending_near_*` y `rankings_zone_filter` |
| 2 | — | Correr lint, fix, tests |
| 3 | — | Commit con mensaje descriptivo |

## Orden de implementación

1. `src/types/index.ts` (type)
2. `src/utils/geo.ts` + test
3. `src/constants/trending.ts`
4. `src/hooks/useLocalTrending.ts` + test
5. `src/components/home/TrendingNearYouSection.tsx` + test
6. `src/components/home/HomeScreen.tsx` (modificar)
7. `src/components/social/RankingsView.tsx` (modificar)
8. `src/constants/analyticsEvents.ts` (agregar)

## Riesgos

- **Coordenadas de negocios faltantes**: algunos negocios en `allBusinesses` podrían no tener lat/lng → filtrar solo los que tienen coordenadas antes de calcular distancia
- **`useTrending` sin datos**: si el cron no corrió aún, `data` es null → mostrar skeleton loader, no crashear
- **Performance**: haversine sobre 50 items es O(n), sin riesgo. Si trending crece a miles, considerar bounding box pre-filtro

## Criterios de done

- [ ] `useLocalTrending` retorna datos filtrados por proximidad con source correcto
- [ ] `TrendingNearYouSection` renderiza carrusel con subtítulo dinámico
- [ ] Label de sugerencia aparece solo con source office y se puede dismissear
- [ ] Chip "Mi zona" en RankingsView filtra correctamente
- [ ] Tests pasan para hook, componente y utilidad geo
- [ ] Analytics trackeados correctamente
- [ ] Lint sin errores
