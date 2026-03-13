# PRD: Filtros y ordenamiento en listas del menú lateral

**Issue:** #11 (extensión)
**Fecha:** 2026-03-11

## Descripción

Agregar filtros y ordenamiento reutilizables a las listas de Calificaciones y Favoritos del menú lateral. El componente de filtros debe ser modular para aplicarse a futuras listas.

## Requisitos funcionales

### Filtros (aplicables a Calificaciones y Favoritos)

1. **Búsqueda por nombre**: TextField compacto para filtrar por nombre del comercio.
2. **Filtro por categoría**: Chips horizontales con las categorías (Restaurante, Café, etc.). Click activa/desactiva.
3. **Filtro por estrellas** (solo Calificaciones): Selector de score mínimo (ej: "3+ estrellas").

### Ordenamiento

1. Opciones de orden:
   - Fecha (más reciente / más antiguo)
   - Nombre (A-Z / Z-A)
   - Estrellas (mayor a menor / menor a mayor) — solo en Calificaciones
2. Botón/selector compacto para elegir criterio de orden.

### Modularización

1. Componente reutilizable `ListFilters` que recibe configuración de qué filtros mostrar.
2. Hook `useListFilters` que encapsula la lógica de filtrado y ordenamiento.
3. Las listas (FavoritesList, RatingsList) consumen el hook y pasan los datos filtrados.

## Consideraciones UX

- Los filtros van entre el toolbar (botón atrás + título) y la lista.
- Diseño compacto: búsqueda colapsable (ícono que expande), chips scrollables, select pequeño para orden.
- Los filtros se resetean al salir de la sección.
- Mostrar cantidad de resultados: "3 de 8 resultados".

## Buenas prácticas

- Filtrado client-side (los datos ya están cargados en memoria).
- El hook recibe el array de items y devuelve el array filtrado + las funciones de control.
- Tipado genérico para reutilizar con cualquier tipo de item que tenga `business`.
