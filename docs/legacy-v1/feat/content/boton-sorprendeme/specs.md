# Specs: Botón Sorpréndeme

**Feature:** boton-sorprendeme
**Issue:** #139
**Fecha:** 2026-03-16

---

## Implementación

### 1. Botón en SideMenu

- Agregar item "Sorpréndeme" en la lista de navegación del SideMenu, después de "Sugeridos para vos".
- Ícono: `Casino` (dado) de MUI Icons.
- Al tocar, ejecuta la lógica de selección random y cierra el menú.
- No es una sección con vista propia — es una acción directa.

### 2. Lógica de selección

- Obtener `allBusinesses` del módulo estático.
- Obtener IDs de comercios visitados de `useVisitHistory()` (localStorage).
- Filtrar: `allBusinesses` minus visitados.
- Si quedan comercios no visitados, elegir uno al azar con `Math.random()`.
- Si no quedan, elegir cualquiera al azar y mostrar toast info "¡Ya visitaste todos! Te sorprendemos con uno al azar."
- Llamar `setSelectedBusiness(business)` para abrir el BusinessSheet.

### 3. Feedback visual

- Toast success: "¡Sorpresa! Descubrí {nombre del comercio}".
- Si no hay comercios disponibles (edge case imposible con 40 businesses), toast warning.

---

## Archivos

| Archivo | Acción |
|---------|--------|
| `src/components/layout/SideMenu.tsx` | Agregar botón + lógica |

**Nota:** Todo en 1 archivo. No se necesitan nuevos componentes, servicios ni hooks.

---

## Decisiones

1. **No hacer queries a Firestore** — solo excluir por localStorage visits (rápido, sin red).
2. **No excluir por ratings/favorites** — solo por visitas. Mantiene simple.
3. **Acción directa, no sección** — click → elige → abre. Sin vista intermedia.
4. **Sin filtros** — v1 sin filtro por categoría. Se puede agregar después.
