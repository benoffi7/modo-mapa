# PRD: Botón Sorpréndeme

**Feature:** boton-sorprendeme
**Categoria:** content
**Fecha:** 2026-03-16
**Issue:** #139
**Prioridad:** Baja

---

## Contexto

El descubrimiento de comercios depende de búsqueda activa, rankings y favoritos. No hay una forma lúdica de explorar comercios nuevos, especialmente para usuarios que ya conocen los más populares.

## Problema

- Los usuarios habituales tienden a visitar siempre los mismos comercios.
- No hay incentivo ni mecanismo para descubrir lugares nuevos o menos conocidos.
- La exploración del mapa es manual y puede ser tediosa.

## Solución

### S1: Botón "Sorpréndeme"

- Botón flotante o en el menú que selecciona un comercio al azar.
- El comercio seleccionado no debe haber sido visitado/calificado por el usuario.
- Al tocar, abre directamente el BusinessSheet del comercio elegido y centra el mapa.

### S2: Filtros opcionales

- El usuario puede limitar la sorpresa por categoría ("Sorpréndeme con un café").
- Opción de limitar por radio de distancia.

### S3: Lógica de selección

- Priorizar comercios con buenas calificaciones promedio que el usuario no conoce.
- Excluir comercios ya calificados, comentados o agregados a favoritos.

---

## Scope

| Item | Prioridad | Esfuerzo |
|------|-----------|----------|
| Botón UI en mapa o menú | Alta | S |
| Lógica de selección random excluyendo visitados | Alta | M |
| Apertura de BusinessSheet + centrar mapa | Alta | S |
| Filtro por categoría | Baja | S |
| Filtro por distancia | Baja | S |

**Esfuerzo total estimado:** M

---

## Out of Scope

- Recomendaciones personalizadas basadas en historial (algorítmico).
- Integración con sistema de gamificación.
- Compartir el resultado de "Sorpréndeme".

---

## Success Criteria

1. El botón selecciona un comercio que el usuario no ha visitado/calificado.
2. El mapa se centra en el comercio y se abre el BusinessSheet.
3. Si no hay comercios no visitados, se muestra mensaje adecuado.
4. La selección es percibida como aleatoria por el usuario.
