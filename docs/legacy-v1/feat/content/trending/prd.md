# PRD: Trending — comercios populares esta semana

**Feature:** trending
**Categoria:** content
**Fecha:** 2026-03-20
**Issue:** #140
**Prioridad:** Media

---

## Contexto

Los rankings actuales muestran **usuarios** ordenados por contribuciones acumuladas. La seccion "Sugeridos" recomienda comercios basandose en preferencias del usuario, pero no refleja actividad reciente. No hay una vista de "tendencias" que muestre **comercios** ganando popularidad esta semana.

## Problema

- Los rankings favorecen comercios con historial largo, dificultando que comercios nuevos o recientemente populares destaquen.
- No hay visibilidad de que comercios estan recibiendo mas atencion esta semana.
- Los usuarios no tienen forma de ver "que esta de moda" en su zona.

## Solucion

### S1: Tab Trending en Sugeridos

- Nueva pestana "Tendencia" dentro de la seccion **Sugeridos** existente.
- Al seleccionar el tab, se muestra una lista de **comercios** ordenados por actividad recibida en los ultimos 7 dias.
- Top 10 comercios.
- La UI muestra nombre del comercio, categoria, score y desglose de actividad.

### S2: Cloud Function scheduled para computo

- **No se hace client-side.** Una Cloud Function scheduled (`computeTrendingBusinesses`) corre diariamente a las 3 AM ART.
- Consulta las siguientes senales de actividad con `createdAt >= hace 7 dias`:
  - **Ratings** (calificaciones)
  - **Comments** (comentarios)
  - **Tags** (etiquetas de usuario)
  - **Prices** (aportes de precios)
  - **Favorites/Listas** (agregados a listas)
- Agrupa por `businessId`, calcula score ponderado:
  - `ratings*2 + comments*3 + tags*1 + prices*2 + favorites*1`
- Escribe el top 10 en un unico documento Firestore: `trendingBusinesses/current`.
- El frontend simplemente lee ese documento, sin queries complejas.

### S3: Indicador visual

- Badge "Tendencia" en el header de BusinessSheet para comercios que aparecen en la lista trending.
- Metricas resumidas en la card: "+12 calificaciones esta semana", "+5 comentarios".

---

## Scope

| Item | Prioridad | Esfuerzo |
|------|-----------|----------|
| Cloud Function computeTrendingBusinesses | Alta | M |
| Tab Trending en Sugeridos | Alta | M |
| Servicio + hook frontend | Alta | S |
| Componente TrendingList | Alta | S |
| Badge trending en BusinessSheet | Baja | XS |
| Indicadores de metricas semanales | Media | S |

**Esfuerzo total estimado:** M

---

## Out of Scope

- Trending por categoria.
- Trending por zona geografica.
- Notificaciones de trending ("X comercio es tendencia").
- Algoritmo de trending decay (por ahora, ventana fija de 7 dias).
- Fotos de menu como senal (se excluyen por ahora).

---

## Tests

- **Cloud Function**: test unitario de `computeTrendingBusinesses` con datos mock, verificando scoring correcto, ordenamiento y limite de 10. Cobertura >= 80%.
- **Hook `useTrending`**: test con mock de servicio, verificando estados loading/data/error.
- **Servicio `fetchTrending`**: test con mock de Firestore, verificando parsing correcto del documento.
- **Componente `TrendingList`**: test de rendering con datos mock, verificando que muestra cards con breakdown.

---

## Success Criteria

1. El tab "Tendencia" en Sugeridos muestra los 10 comercios con mas actividad en los ultimos 7 dias.
2. El calculo se realiza server-side via Cloud Function scheduled, no client-side.
3. El documento `trendingBusinesses/current` se actualiza diariamente.
4. Las senales de actividad incluyen: ratings, comments, tags, prices y favorites.
5. Tests con cobertura >= 80% en CF, hook y servicio.
