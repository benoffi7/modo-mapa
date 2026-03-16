# PRD: Sugerencias contextuales para usuarios nuevos

**Feature:** sugerencias-contextuales
**Categoria:** ux
**Fecha:** 2026-03-16
**Issue:** #134
**Prioridad:** Media

---

## Contexto

Los usuarios nuevos llegan al mapa sin guía de qué hacer primero. No hay indicaciones contextuales que los orienten hacia las acciones principales (calificar, comentar, favoritear).

## Problema

- Usuarios con 0 ratings no saben que pueden tocar un marker para calificar.
- La funcionalidad principal de la app (calificar comercios) no se descubre intuitivamente.
- No hay diferencia en la experiencia entre un usuario nuevo y uno recurrente.

## Solución

### S1: Tooltip en el mapa

- Si el usuario tiene 0 ratings, mostrar tooltip flotante: "Tocá un comercio para calificarlo".
- El tooltip apunta al marker más cercano o al centro del mapa.
- Se dismissea al tocar cualquier marker o después de 5 segundos.

### S2: Sugerencias progresivas

- Después del primer rating: "¡Genial! Podés agregar un comentario también."
- Después del primer comentario: "Guardá tus favoritos tocando el ♡".
- Cada sugerencia se muestra una sola vez.

### S3: Tracking de progreso

- Mantener contadores en el perfil del usuario (totalRatings, totalComments, totalFavorites).
- Las sugerencias se basan en estos contadores (ya existen en Firestore).

---

## Scope

| Item | Prioridad | Esfuerzo |
|------|-----------|----------|
| Tooltip inicial (0 ratings) | Alta | S |
| Sugerencia post-primer-rating | Media | S |
| Sugerencia post-primer-comentario | Media | S |
| Flag "ya mostrado" por tipo de sugerencia | Alta | XS |
| Lógica basada en contadores existentes | Alta | XS |

**Esfuerzo total estimado:** S

---

## Out of Scope

- Onboarding completo paso a paso — ver issue #144.
- Gamificación con rewards — ver issue #145.
- Tour interactivo con highlights.
- Sugerencias para features avanzados (tags, listas).

---

## Success Criteria

1. Usuarios nuevos (0 ratings) ven tooltip orientativo en el mapa.
2. Las sugerencias progresivas guían las primeras 3 acciones.
3. Cada sugerencia se muestra exactamente una vez.
4. Las sugerencias no son intrusivas (dismisseables, auto-hide).
