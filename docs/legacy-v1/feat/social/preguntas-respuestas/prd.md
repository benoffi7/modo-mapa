# PRD: Preguntas y respuestas en comercios

**Feature:** preguntas-respuestas
**Categoria:** social
**Fecha:** 2026-03-16 (actualizado 2026-03-20)
**Issue:** #127
**Prioridad:** Media

---

## Contexto

Actualmente los usuarios pueden dejar comentarios y ratings en comercios, pero no existe un canal para hacer preguntas puntuales ("¿Tienen opción vegana?", "¿Aceptan mascotas?") que otros usuarios o el comercio puedan responder.

La infraestructura de comentarios (`comments` collection, `commentLikes`, Cloud Function triggers, Firestore rules, rate limits) ya existe y es reutilizable. En lugar de crear una colección separada, Q&A se implementa como una extensión del modelo de comentarios con un campo `type`.

## Problema

- Los comentarios mezclan opiniones con preguntas, dificultando encontrar información práctica.
- No hay forma de obtener respuestas de la comunidad sobre dudas específicas de un comercio.
- Información útil queda enterrada en comentarios largos sin estructura.

## Solución

### S1: Sección Q&A en BusinessSheet (reusa infraestructura de comentarios)

- Agregar campo opcional `type: 'question'` al modelo `Comment`. Comentarios existentes sin `type` se tratan como comentarios normales (backward compatible).
- Toggle/tabs en BusinessSheet para alternar entre "Comentarios" y "Preguntas".
- Las preguntas usan `parentId` para respuestas (igual que replies en comentarios).
- Las preguntas se ordenan por fecha o por cantidad de respuestas.
- Las respuestas a preguntas son comments con `parentId` apuntando a la pregunta (no necesitan `type`).

### S2: Votación de respuestas

- Reutiliza `commentLikes` existente: dar like a una respuesta = votarla como útil.
- La respuesta con más `likeCount` se muestra primero (best answer highlighted).
- No se requiere nueva colección ni nueva lógica de Cloud Functions para likes.

### S3: Moderación

- Mismas reglas de rate limit (20/día compartidos entre comentarios y preguntas) y moderación que los comentarios.
- Los admins pueden eliminar preguntas/respuestas inapropiadas con la misma mecánica existente.
- Cloud Function triggers existentes (`onCommentCreated`, `onCommentUpdated`, `onCommentDeleted`) manejan preguntas sin cambios.

---

## Scope

| Item | Prioridad | Esfuerzo |
|------|-----------|----------|
| Data model (agregar `type` a Comment, converter) | Alta | XS |
| Firestore rules (permitir campo `type`) | Alta | XS |
| Service functions (fetchQuestions, createQuestion) | Alta | S |
| UI BusinessQuestions component | Alta | M |
| UI toggle tabs en BusinessSheet | Alta | S |
| Votación de respuestas (reusa commentLikes) | Media | XS |
| Analytics events | Baja | XS |
| Tests (componente, servicio, CF) | Alta | S |

**Esfuerzo total estimado:** M

---

## Out of Scope

- Notificaciones cuando alguien responde a tu pregunta (issue separado).
- Respuestas verificadas por el comercio (requiere cuentas de comercio).
- Búsqueda global de preguntas.
- Preguntas anónimas.

---

## Tests

- **Component test:** `BusinessQuestions` renderiza preguntas, muestra respuestas, permite crear pregunta.
- **Service test:** `fetchQuestions` filtra por `type === 'question'`, `createQuestion` setea `type` correctamente.
- **CF trigger test:** `onCommentCreated` maneja correctamente documentos con `type: 'question'`.
- **Cobertura mínima:** >= 80%.

---

## Success Criteria

1. Los usuarios pueden crear preguntas en cualquier comercio.
2. Otros usuarios pueden responder preguntas existentes.
3. Las respuestas se pueden votar como útiles (like = voto).
4. La sección Q&A es visualmente distinta de los comentarios (toggle/tabs).
5. Rate limit y moderación aplicados correctamente (compartidos con comentarios).
6. Best answer (más likes) se destaca visualmente.
7. Tests con cobertura >= 80%.
