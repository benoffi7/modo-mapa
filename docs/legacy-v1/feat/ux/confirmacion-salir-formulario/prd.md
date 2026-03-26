# PRD: Confirmación al salir de formulario con texto

**Feature:** confirmacion-salir-formulario
**Categoria:** ux
**Fecha:** 2026-03-16
**Issue:** #130
**Prioridad:** Media

---

## Contexto

Los formularios de comentarios en Modo Mapa se cierran al tocar fuera del área de input o al navegar a otra sección. Si el usuario estaba escribiendo un comentario largo, el texto se pierde sin confirmación.

## Problema

- El usuario pierde texto escrito si toca accidentalmente fuera del formulario.
- No hay diálogo de confirmación "¿Descartar borrador?".
- Especialmente frustrante en dispositivos móviles donde los toques accidentales son frecuentes.
- Aplica también a edición inline de comentarios existentes.

## Solución

### S1: Detección de contenido no guardado

- Trackear si el campo de texto tiene contenido (length > 0).
- Solo activar la confirmación si hay texto escrito (no para campos vacíos).

### S2: Diálogo de confirmación

- Al intentar cerrar/navegar con texto no guardado, mostrar diálogo MUI:
  - "¿Descartar comentario?"
  - Botones: "Descartar" (secondary) | "Seguir editando" (primary)
- Aplicar en: cierre del BusinessSheet, navegación a otra sección, backdrop click.

### S3: Guardar borrador (opcional)

- Guardar el borrador en localStorage keyed por businessId.
- Al reabrir el BusinessSheet del mismo comercio, restaurar el borrador.
- Auto-limpiar borradores después de 24 horas.

---

## Scope

| Item | Prioridad | Esfuerzo |
|------|-----------|----------|
| Detección de contenido no guardado | Alta | XS |
| Diálogo de confirmación al cerrar | Alta | S |
| Interceptar navegación con texto pendiente | Alta | S |
| Guardar/restaurar borrador (localStorage) | Baja | S |

**Esfuerzo total estimado:** S

---

## Out of Scope

- Autoguardado periódico de borradores.
- Confirmación para otros formularios (settings, perfil).
- Undo/redo en el campo de texto.

---

## Success Criteria

1. Al cerrar con texto escrito, aparece diálogo de confirmación.
2. "Seguir editando" mantiene el texto intacto.
3. "Descartar" limpia el formulario y cierra.
4. Campos vacíos no activan la confirmación.
