# Plan: Pre-check de rate limit en comentarios

**Feature:** rate-limit-precheck
**Issue:** #133
**Fecha:** 2026-03-16

---

## Fase única (cambio en 1 archivo)

### Paso 1: Agregar import de Alert

- Agregar `Alert` al import de `@mui/material` en `BusinessComments.tsx`.

### Paso 2: Condicionar input principal

- Líneas 315-354: wrappear el input existente en `{user && userCommentsToday < MAX_COMMENTS_PER_DAY && (...)}`.
- Agregar bloque `{user && userCommentsToday >= MAX_COMMENTS_PER_DAY && (...)}` con `<Alert>`.

### Paso 3: Agregar contador al helperText

- Modificar el `helperText` del TextField (línea 330) para incluir `X/20 hoy`.
- Solo mostrar si `userCommentsToday > 0`.
- Color warning si quedan ≤3.

### Paso 4: Condicionar input de reply

- Líneas 406-463: agregar misma condición al bloque de reply.
- Si límite alcanzado, mostrar Alert compacto en lugar del input de reply.

### Paso 5: Tests

- Verificar que con 20 comentarios hoy, el input no se muestra y aparece Alert.
- Verificar que con 0 comentarios, el input se muestra normal sin contador.
- Verificar que con 18 comentarios, el contador muestra warning.
- Verificar que el reply también se bloquea al alcanzar el límite.

---

## Criterios de merge

- [ ] Input oculto y Alert visible cuando se alcanza el límite
- [ ] Contador `X/20 hoy` visible cuando el usuario tiene comentarios del día
- [ ] Warning visual cuando quedan ≤3 comentarios
- [ ] Reply también bloqueado al alcanzar el límite
- [ ] No afecta funcionalidad de usuarios sin comentarios del día
- [ ] Lint y tests pasan
