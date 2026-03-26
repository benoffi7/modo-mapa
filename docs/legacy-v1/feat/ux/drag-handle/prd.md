# PRD: Drag handle del BusinessSheet poco visible

**Feature:** drag-handle
**Categoria:** ux
**Fecha:** 2026-03-16
**Issue:** #128
**Prioridad:** Alta

---

## Contexto

El BusinessSheet es un bottom sheet draggable que muestra la información del comercio. Tiene una barra gris (drag handle) en la parte superior que indica que se puede arrastrar para expandir o colapsar.

## Problema

- La barra gris es muy sutil y pasa desapercibida, especialmente en pantallas con brillo alto.
- Usuarios nuevos no descubren que pueden arrastrar el sheet para ver más información.
- Esto reduce la visibilidad de contenido importante (comentarios, fotos, ratings detallados) que está "debajo del fold".

## Solución

### S1: Handle más prominente

- Aumentar el ancho y grosor de la barra de drag.
- Usar color con mayor contraste (ej: de `#E0E0E0` a `#BDBDBD` o más oscuro).
- Agregar sombra sutil o borde para mayor visibilidad.

### S2: Indicador visual de contenido

- Agregar un chevron (flecha ↑) animado que sugiera "arrastrá para ver más".
- El chevron se muestra solo cuando el sheet está en posición colapsada.
- Desaparece después de la primera interacción o después de 3 segundos.

### S3: Tooltip para nuevos usuarios

- Primera vez que el usuario ve el BusinessSheet, mostrar tooltip: "Arrastrá hacia arriba para ver más".
- Se muestra una sola vez (flag en localStorage).

---

## Scope

| Item | Prioridad | Esfuerzo |
|------|-----------|----------|
| Rediseño visual del drag handle | Alta | XS |
| Chevron animado | Media | S |
| Tooltip primera vez | Media | S |
| Flag de "ya visto" en localStorage | Media | XS |

**Esfuerzo total estimado:** S

---

## Out of Scope

- Rediseño completo del BusinessSheet.
- Cambiar el comportamiento del drag (snap points, velocidad).
- Animación de bounce al abrir.

---

## Success Criteria

1. El drag handle es visualmente prominente y distinguible del fondo.
2. Usuarios nuevos reciben indicación de que pueden arrastrar.
3. La mejora no interfiere con la funcionalidad de drag existente.
4. El tooltip se muestra solo una vez por usuario.
