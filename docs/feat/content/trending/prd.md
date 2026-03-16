# PRD: Trending — comercios populares esta semana

**Feature:** trending
**Categoria:** content
**Fecha:** 2026-03-16
**Issue:** #140
**Prioridad:** Media

---

## Contexto

Los rankings actuales muestran comercios ordenados por rating promedio acumulado. No hay una vista de "tendencias" que refleje actividad reciente, lo cual beneficiaría el descubrimiento de comercios que están ganando popularidad.

## Problema

- Los rankings favorecen comercios con historial largo, dificultando que comercios nuevos o recientemente populares destaquen.
- No hay visibilidad de qué comercios están recibiendo más atención esta semana.
- Los usuarios no tienen forma de ver "qué está de moda" en su zona.

## Solución

### S1: Sección Trending

- Nueva sección accesible desde el menú lateral o como tab en Rankings.
- Muestra comercios ordenados por actividad de los últimos 7 días.
- Actividad = suma ponderada de ratings + comentarios + favoritos nuevos.

### S2: Cálculo de tendencia

- Query a Firestore filtrando por `createdAt >= hace 7 días` en ratings, comments y favorites.
- Agrupar por `businessId` y sumar actividad.
- Ordenar por score descendente, mostrar top 10-20.

### S3: Indicador visual

- Badge "Trending" en comercios que aparecen en la lista.
- Mostrar métricas resumidas: "+12 ratings esta semana", "+5 comentarios".

---

## Scope

| Item | Prioridad | Esfuerzo |
|------|-----------|----------|
| Query de actividad semanal | Alta | M |
| UI sección Trending | Alta | M |
| Ordenamiento por score de actividad | Alta | S |
| Badge trending en BusinessSheet | Baja | XS |
| Indicadores de métricas semanales | Media | S |

**Esfuerzo total estimado:** M

---

## Out of Scope

- Trending por categoría.
- Trending por zona geográfica.
- Notificaciones de trending ("X comercio es tendencia").
- Algoritmo de trending decay (por ahora, ventana fija de 7 días).

---

## Success Criteria

1. La sección Trending muestra los comercios con más actividad en los últimos 7 días.
2. El cálculo considera ratings, comentarios y favoritos recientes.
3. La lista se actualiza diariamente o en cada visita.
4. Los comercios trending se distinguen visualmente del ranking general.
