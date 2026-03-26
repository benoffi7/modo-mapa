# PRD: Mapa navegable por teclado

**Feature:** mapa-teclado
**Categoria:** ux
**Fecha:** 2026-03-16
**Issue:** #148
**Prioridad:** Alta

---

## Contexto

El mapa de Modo Mapa usa markers interactivos para representar comercios. Actualmente estos markers solo son accesibles via click o touch, sin soporte para navegación por teclado ni lectores de pantalla.

## Problema

- Los markers no son focuseables con Tab.
- No hay ARIA labels que describan el comercio representado por el marker.
- Usuarios con discapacidades motoras o visuales no pueden navegar el mapa.
- Incumplimiento de estándares WCAG 2.1 nivel A.

## Solución

### S1: Tab navigation en markers

- Hacer los markers focuseables (`tabIndex={0}`).
- Orden de Tab lógico: de izquierda a derecha, de arriba a abajo dentro del viewport.
- Enter/Space abre el BusinessSheet del marker enfocado.
- Indicador visual de focus (outline) en el marker activo.

### S2: ARIA labels

- Cada marker debe tener `aria-label` descriptivo: "Café Roma, 4.5 estrellas, a 200 metros".
- El BusinessSheet debe tener `role="dialog"` y `aria-labelledby` correctos.
- Anunciar cambios de estado via `aria-live` regions.

### S3: Atajos de teclado

- Flechas para navegar entre markers cercanos.
- Escape para cerrar BusinessSheet.
- `/` o `Ctrl+K` para enfocar la búsqueda.

---

## Scope

| Item | Prioridad | Esfuerzo |
|------|-----------|----------|
| Markers focuseables con Tab | Alta | M |
| ARIA labels en markers | Alta | S |
| Enter/Space para abrir BusinessSheet | Alta | S |
| Focus outline visible | Alta | XS |
| ARIA roles en BusinessSheet | Media | S |
| Navegación con flechas entre markers | Baja | M |
| Atajos de teclado globales | Baja | S |

**Esfuerzo total estimado:** M-L

---

## Out of Scope

- Screen reader completo para todo el mapa (tiles, calles, etc.) — depende del proveedor.
- Alto contraste o modo daltonismo.
- Voice navigation.
- Accesibilidad completa de todo el app (solo scope del mapa).

---

## Success Criteria

1. Todos los markers son alcanzables via Tab.
2. Cada marker tiene aria-label descriptivo con nombre y rating.
3. Enter/Space abre el BusinessSheet correctamente.
4. El focus outline es visible y no afecta el diseño.
5. El BusinessSheet tiene los ARIA roles correctos.
6. Cumplimiento WCAG 2.1 nivel A para la sección del mapa.
