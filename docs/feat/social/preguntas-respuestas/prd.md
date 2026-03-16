# PRD: Preguntas y respuestas en comercios

**Feature:** preguntas-respuestas
**Categoria:** social
**Fecha:** 2026-03-16
**Issue:** #127
**Prioridad:** Media

---

## Contexto

Actualmente los usuarios pueden dejar comentarios y ratings en comercios, pero no existe un canal para hacer preguntas puntuales ("¿Tienen opción vegana?", "¿Aceptan mascotas?") que otros usuarios o el comercio puedan responder.

## Problema

- Los comentarios mezclan opiniones con preguntas, dificultando encontrar información práctica.
- No hay forma de obtener respuestas de la comunidad sobre dudas específicas de un comercio.
- Información útil queda enterrada en comentarios largos sin estructura.

## Solución

### S1: Sección Q&A en BusinessSheet

- Agregar pestaña/sección "Preguntas" en el BusinessSheet, separada de comentarios.
- Cada pregunta permite respuestas de otros usuarios.
- Las preguntas se ordenan por fecha o por cantidad de respuestas.

### S2: Votación de respuestas

- Los usuarios pueden votar respuestas como útiles (thumbs up).
- La respuesta con más votos se muestra primero.

### S3: Moderación

- Aplicar las mismas reglas de rate limit y moderación que los comentarios.
- Los admins pueden eliminar preguntas/respuestas inapropiadas.

---

## Scope

| Item | Prioridad | Esfuerzo |
|------|-----------|----------|
| Modelo de datos (colección questions) | Alta | S |
| UI sección Q&A en BusinessSheet | Alta | M |
| Crear/responder preguntas | Alta | M |
| Votación de respuestas | Media | S |
| Moderación admin | Media | S |

**Esfuerzo total estimado:** L

---

## Out of Scope

- Notificaciones cuando alguien responde a tu pregunta (issue separado).
- Respuestas verificadas por el comercio (requiere cuentas de comercio).
- Búsqueda global de preguntas.
- Preguntas anónimas.

---

## Success Criteria

1. Los usuarios pueden crear preguntas en cualquier comercio.
2. Otros usuarios pueden responder preguntas existentes.
3. Las respuestas se pueden votar como útiles.
4. La sección Q&A es visualmente distinta de los comentarios.
5. Rate limit y moderación aplicados correctamente.
