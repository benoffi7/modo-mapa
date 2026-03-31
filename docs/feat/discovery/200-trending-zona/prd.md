# PRD: Trending por Zona — Sección Home

**Issue:** #200
**Fecha:** 2026-03-30
**Estado:** Draft

## Problema

Los rankings y trending actuales son globales. Un usuario en Palermo no tiene visibilidad de qué es popular *en su zona*. La Home tiene secciones genéricas (Especiales, Para Ti) pero no ofrece descubrimiento hiperlocal.

## Propuesta

Agregar una nueva sección **"Trending cerca tuyo"** en la Home, entre `SpecialsSection` y `RecentSearches`, que muestre los negocios más populares en la zona del usuario.

### Sección en Home: `TrendingNearYouSection`

**Siempre hay datos.** La sección usa la cadena de fallback de ubicación ya existente en `useSortLocation`: GPS → localidad del usuario → oficina. Siempre hay un punto de referencia, por lo tanto siempre hay resultados.

**Fuente de ubicación y label:**

| Fuente | Subtítulo mostrado | Ejemplo |
|---|---|---|
| GPS activo | "Cerca tuyo" | "Cerca tuyo" |
| Localidad configurada | "En [localidad]" | "En Palermo" |
| Oficina (fallback) | "En tu zona" + label sugerencia | "En tu zona · Configurá tu localidad" |

- Título: "Trending cerca tuyo"
- Carrusel horizontal con 5-8 `TrendingBusinessCard` filtrados por proximidad
- Chip "Ver todos" que abre el RankingsView filtrado por zona

**Label de sugerencia (solo cuando se usa fallback oficina):**
- Debajo del subtítulo: link sutil "Configurá tu localidad para resultados más precisos" → navega a Settings > Localidad
- Se muestra como `Typography variant="caption"` con color `primary.main`, no como banner intrusivo
- Se puede dismissear (persist en localStorage) para no repetir

### Filtro en RankingsView

- Agregar chip "Mi zona" junto a los chips de período (Semanal/Mensual/Anual)
- Cuando está activo, filtra el ranking por negocios dentro del radio de la localidad del usuario
- Radio configurable: 500m en zonas densas, hasta 2km en zonas con pocos datos (threshold: mínimo 5 negocios)

## Datos disponibles

- `useSortLocation()` — cadena de fallback GPS → localidad → oficina (siempre retorna coordenadas)
- `userSettings.locality`, `userSettings.localityLat`, `userSettings.localityLng` — localidad del usuario
- `OFFICE_LOCATION` en `src/constants/map.ts` — fallback final
- `allBusinesses` — tienen coordenadas (lat/lng)
- `useTrending()` — trending ya calculado por Cloud Function cron
- Rankings por período ya calculados

## Lógica de filtrado

1. Obtener coordenadas usando `useSortLocation()` (GPS → localidad → oficina). Siempre retorna un punto
2. Filtrar `trending.businesses` por distancia haversine al punto obtenido
3. Radio inicial: 1km. Si < 5 resultados, expandir a 2km. Si < 5 a 2km, expandir a 5km
4. Siempre habrá resultados porque el dataset cubre toda la zona de la app
5. No requiere nueva Cloud Function: el filtrado es client-side sobre datos ya existentes

## Componentes

| Componente | Tipo | Ubicación |
|---|---|---|
| `TrendingNearYouSection` | Nuevo | `src/components/home/` |
| `HomeScreen` | Modificar | Agregar sección entre Specials y RecentSearches |
| `RankingsView` | Modificar | Agregar chip "Mi zona" y lógica de filtrado |
| `useLocalTrending` | Nuevo hook | `src/hooks/` — usa `useSortLocation` + filtra trending por proximidad |

## Diseño UX

- La sección sigue el patrón visual de `ForYouSection`: carrusel horizontal con cards
- Cards reutilizan `TrendingBusinessCard` existente
- Siempre muestra datos (nunca estado vacío gracias a la cadena de fallback)
- Cuando se usa fallback oficina: label sutil sugiriendo configurar localidad

## Analytics

| Evento | Cuándo |
|---|---|
| `trending_near_viewed` | Sección visible en viewport |
| `trending_near_tapped` | Tap en un negocio del carrusel |
| `trending_near_configure_tapped` | Tap en label "Configurá tu localidad" |
| `rankings_zone_filter` | Activación del chip "Mi zona" en Rankings |

## Tests

- `TrendingNearYouSection`: render con GPS, render con localidad, render con fallback oficina + label
- `useLocalTrending`: filtrado por radio, expansión de radio, detección de fuente (GPS/localidad/oficina)
- `RankingsView`: chip "Mi zona" filtra correctamente

## Seguridad

- Coordenadas del usuario solo se usan client-side para filtrado, nunca se envían a otros usuarios
- No se expone la ubicación exacta: solo se muestra la localidad (texto) ya configurada
- Sin nuevas Cloud Functions ni queries a Firestore adicionales

## Fuera de alcance

- Rankings calculados server-side por zona (optimización futura si hay volumen)
- Mapa de calor de trending
- Notificaciones de trending local
