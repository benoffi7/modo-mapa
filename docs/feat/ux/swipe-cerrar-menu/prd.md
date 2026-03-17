# PRD: Gesto swipe para cerrar menú lateral

**Feature:** swipe-cerrar-menu
**Categoria:** ux
**Fecha:** 2026-03-17
**Issue:** [#152](https://github.com/benoffi7/modo-mapa/issues/152)
**Prioridad:** Alta

---

## Contexto

El menú lateral (SideMenu) se abre como un Drawer desde la izquierda. Actualmente solo se cierra con el botón de flecha atrás o tocando fuera del drawer. El gesto de swipe hacia la izquierda es el patrón estándar en apps móviles para cerrar drawers/panels.

## Problema

- No hay gesto de swipe para cerrar el menú, lo que se siente anti-intuitivo en mobile.
- MUI Drawer ya soporta swipe nativo con `SwipeableDrawer`, pero actualmente se usa `Drawer` estático.

## Solución

### S1: Migrar a SwipeableDrawer

- Reemplazar `Drawer` por `SwipeableDrawer` en SideMenu.
- El swipe hacia la izquierda cierra el menú.
- El swipe edge (borde de apertura) puede habilitarse opcionalmente para abrir el menú desde el borde izquierdo de la pantalla.

### S2: Configuración del gesto

- `swipeAreaWidth`: 20px (zona de activación en el borde izquierdo).
- `disableSwipeToOpen`: false (permitir abrir con swipe desde el borde).
- `hysteresis`: 0.52 (umbral por defecto de MUI, se ajusta si es necesario).
- iOS: `disableBackdropTransition` y `disableDiscovery` para mejor performance en Safari.

---

## Scope

| Item | Prioridad | Esfuerzo |
|------|-----------|----------|
| Migrar Drawer a SwipeableDrawer | Alta | XS |
| Swipe para cerrar | Alta | XS |
| Swipe desde borde para abrir | Media | XS |
| Ajustes iOS (backdrop, discovery) | Media | XS |

**Esfuerzo total estimado:** XS

---

## Out of Scope

- Swipe en secciones internas del menú (solo el drawer principal).
- Gestos de swipe derecha/izquierda para navegar entre secciones.
- Animaciones custom de transición.

---

## Success Criteria

1. El menú se cierra al hacer swipe hacia la izquierda.
2. El menú se puede abrir con swipe desde el borde izquierdo de la pantalla.
3. No hay regresión en el comportamiento existente (botón atrás, click fuera).
4. Performance fluida en iOS Safari.
