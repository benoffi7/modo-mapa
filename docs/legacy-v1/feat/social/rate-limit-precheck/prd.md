# PRD: Pre-check de rate limit en comentarios

**Feature:** rate-limit-precheck
**Categoria:** social
**Fecha:** 2026-03-16
**Issue:** #133
**Prioridad:** Alta

---

## Contexto

El sistema de comentarios tiene un rate limit de 5 comentarios por día por usuario. Actualmente la validación solo ocurre post-submit: el usuario escribe el comentario, lo envía, y recién ahí recibe el error de rate limit.

## Problema

- El usuario pierde tiempo escribiendo un comentario que no podrá publicar.
- La experiencia es frustrante: el error aparece después del esfuerzo de redacción.
- No hay indicación visual de cuántos comentarios quedan disponibles.

## Solución

### S1: Verificación pre-input

- Antes de mostrar el campo de texto de comentario, consultar cuántos comentarios hizo el usuario hoy.
- Si alcanzó el límite (5/día), mostrar mensaje informativo en lugar del input.
- Texto: "Alcanzaste el límite de 5 comentarios por hoy. Podés comentar de nuevo mañana."

### S2: Contador visual

- Mostrar indicador sutil "X/5 comentarios hoy" cerca del input de comentario.
- Cambiar color a warning cuando quedan 1-2 comentarios disponibles.

### S3: Reutilizar lógica existente

- La Cloud Function ya valida el rate limit. Reutilizar la misma query del lado del cliente.
- Consultar `comments` donde `userId == currentUser` y `createdAt >= hoy 00:00`.

---

## Scope

| Item | Prioridad | Esfuerzo |
|------|-----------|----------|
| Query de conteo de comentarios del día | Alta | XS |
| Bloqueo visual del input si límite alcanzado | Alta | S |
| Contador X/5 junto al input | Media | XS |
| Caché del conteo (evitar re-queries) | Media | XS |

**Esfuerzo total estimado:** S

---

## Out of Scope

- Cambiar el límite de 5/día (configuración existente).
- Rate limit en otros tipos de contenido (ratings, tags).
- Rate limit diferenciado por tipo de usuario.

---

## Success Criteria

1. Si el usuario alcanzó 5 comentarios hoy, el input no se muestra y aparece un mensaje claro.
2. El contador X/5 es visible junto al input de comentario.
3. No se realizan queries innecesarias (caché del conteo en la sesión).
4. La UX es consistente entre BusinessSheet y cualquier otro punto de entrada de comentarios.
