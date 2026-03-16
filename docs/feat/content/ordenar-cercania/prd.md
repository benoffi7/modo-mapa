# PRD: Ordenar comercios por cercanía

**Feature:** ordenar-cercania
**Categoria:** content
**Fecha:** 2026-03-16
**Issue:** #137
**Prioridad:** Alta

---

## Contexto

Las listas de favoritos y sugerencias muestran comercios en un orden fijo (por nombre o por fecha de agregado). No hay opción para ordenar por distancia al usuario, que es el criterio más relevante cuando se busca un lugar cercano.

## Problema

- El usuario con muchos favoritos no puede encontrar rápidamente el más cercano.
- Las sugerencias no priorizan proximidad, mostrando comercios lejanos con el mismo peso.
- La función Haversine ya existe en el módulo de suggestions pero no se expone como opción de sorting.

## Solución

### S1: Opción de ordenamiento por distancia

- Agregar selector de orden en listas de favoritos y sugerencias: "Más cercanos", "Nombre A-Z", "Recientes".
- Usar la ubicación actual del usuario (ya disponible vía geolocation).
- Calcular distancia con Haversine (reutilizar implementación existente).

### S2: Indicador de distancia

- Junto a cada comercio en la lista, mostrar la distancia aproximada ("a 300m", "a 1.2km").
- Actualizar distancias si el usuario se mueve significativamente (>100m).

### S3: Fallback sin ubicación

- Si la ubicación no está disponible, deshabilitar la opción "Más cercanos" con tooltip explicativo.
- No solicitar permisos de ubicación solo para esta función (usar si ya están concedidos).

---

## Scope

| Item | Prioridad | Esfuerzo |
|------|-----------|----------|
| Selector de ordenamiento en favoritos | Alta | S |
| Selector de ordenamiento en sugerencias | Alta | S |
| Cálculo de distancia con Haversine | Alta | XS |
| Indicador visual de distancia por item | Alta | S |
| Fallback sin ubicación | Media | XS |

**Esfuerzo total estimado:** S-M

---

## Out of Scope

- Ordenar por tiempo de viaje (requiere API de rutas).
- Filtro por radio ("solo comercios a menos de 1km").
- Ordenar el mapa por cercanía (ya lo hace implícitamente por viewport).

---

## Success Criteria

1. El usuario puede ordenar favoritos y sugerencias por distancia.
2. La distancia se muestra junto a cada comercio en la lista.
3. El cálculo reutiliza la función Haversine existente.
4. Sin ubicación disponible, la opción se deshabilita con mensaje claro.
