# PRD: Toast global de error/éxito

**Feature:** toast-global
**Categoria:** infra
**Fecha:** 2026-03-16
**Issue:** #138
**Prioridad:** Alta

---

## Contexto

La app usa UI optimista para varias acciones (ratings, comentarios, favoritos) pero no tiene un sistema centralizado de notificaciones al usuario. Los errores silenciosos pueden dejar la UI en estado inconsistente sin que el usuario lo note.

## Problema

- Las acciones exitosas no tienen confirmación visual ("Rating guardado").
- Los errores de red o rate limit no se comunican al usuario de forma consistente.
- El UI optimista no revierte si la operación falla en el servidor.
- Cada componente maneja (o no maneja) feedback de forma independiente.

## Solución

### S1: Snackbar MUI centralizado

- Crear provider/context global `ToastProvider` que wrappea la app.
- Exponer hook `useToast()` con métodos `success()`, `error()`, `warning()`, `info()`.
- Usar `Snackbar` + `Alert` de MUI con auto-dismiss configurable.

### S2: Integración con acciones existentes

- Rating guardado → `success("Rating guardado")`
- Comment publicado → `success("Comentario publicado")`
- Error de red → `error("Sin conexión. Intentá de nuevo.")`
- Rate limit → `warning("Alcanzaste el límite diario.")`
- Favorito agregado/removido → `success("Agregado a favoritos")` / `info("Removido de favoritos")`

### S3: Reversión de UI optimista

- Cuando una operación optimista falla, revertir el estado local y mostrar toast de error.
- Implementar patrón rollback en los hooks de mutación existentes.

---

## Scope

| Item | Prioridad | Esfuerzo |
|------|-----------|----------|
| ToastProvider + useToast hook | Alta | S |
| Integración con ratings | Alta | XS |
| Integración con comments | Alta | XS |
| Integración con favorites | Alta | XS |
| Mensajes de error de red | Alta | S |
| Reversión de UI optimista | Alta | M |

**Esfuerzo total estimado:** M

---

## Out of Scope

- Notificaciones push del sistema operativo.
- Toast con acciones ("Deshacer").
- Cola de toasts (mostrar de a uno, el siguiente espera).
- Persistencia de errores en log.

---

## Success Criteria

1. Toda acción del usuario tiene feedback visual (éxito o error).
2. El hook `useToast()` está disponible en toda la app.
3. Los errores de red y rate limit se comunican claramente.
4. El UI optimista se revierte correctamente cuando falla la operación.
5. Los toasts se auto-dismiss después de 3-5 segundos.
