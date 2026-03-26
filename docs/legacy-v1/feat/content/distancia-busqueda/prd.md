# PRD: Distancia al usuario en búsqueda y favoritos

**Feature:** distancia-busqueda
**Categoria:** content
**Fecha:** 2026-03-16
**Issue:** #147
**Prioridad:** Alta

---

## Contexto

Las listas de búsqueda y favoritos muestran nombre, dirección y categoría del comercio, pero no la distancia al usuario. La función Haversine ya está implementada en el módulo de suggestions y se puede reutilizar.

## Problema

- El usuario no sabe qué tan lejos está un comercio sin mirar el mapa.
- En listas largas, no puede priorizar por proximidad de un vistazo.
- La distancia es información crítica para decidir a dónde ir.

## Solución

### S1: Mostrar distancia en resultados de búsqueda

- Debajo del nombre/dirección de cada comercio, mostrar "a 300m", "a 1.2km".
- Usar la ubicación actual del usuario y calcular con Haversine.
- Formato: metros si <1km, kilómetros con 1 decimal si >=1km.

### S2: Mostrar distancia en favoritos

- Misma lógica aplicada a la lista de favoritos.
- La distancia se recalcula en cada apertura de la lista.

### S3: Performance

- Calcular distancias client-side (Haversine es O(1) por item).
- No hacer queries adicionales a Firestore.
- Cachear la ubicación del usuario por 30 segundos.

---

## Scope

| Item | Prioridad | Esfuerzo |
|------|-----------|----------|
| Reutilizar función Haversine existente | Alta | XS |
| Mostrar distancia en resultados de búsqueda | Alta | S |
| Mostrar distancia en favoritos | Alta | S |
| Formato inteligente (m/km) | Alta | XS |
| Fallback sin ubicación (ocultar distancia) | Media | XS |

**Esfuerzo total estimado:** S

---

## Out of Scope

- Distancia en el mapa (ya implícita por la visualización).
- Tiempo estimado de viaje.
- Ordenar por distancia — ver issue #137.
- Distancia en tiempo real (actualización continua).

---

## Success Criteria

1. Cada comercio en búsqueda y favoritos muestra la distancia al usuario.
2. Formato correcto: metros (<1km) y kilómetros (>=1km).
3. Sin ubicación disponible, la distancia simplemente no se muestra.
4. No hay impacto perceptible en performance.
