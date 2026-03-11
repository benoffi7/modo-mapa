# PRD: Menú lateral con sección Favoritos

**Issue:** #7
**Fecha:** 2026-03-11

## Descripción

Agregar un menú lateral (hamburger menu) a la app, accesible desde el ícono de menú en el SearchBar (actualmente placeholder sin funcionalidad). En esta primera iteración se implementa la estructura del menú + la sección Favoritos. Las secciones Comentarios y Feedback quedan como placeholders para futuros issues.

## Contexto del proyecto

- **SearchBar** (`src/components/search/SearchBar.tsx`): ya tiene un `IconButton` con `MenuIcon` sin onClick handler.
- **FavoriteButton** (`src/components/business/FavoriteButton.tsx`): guarda favoritos en Firestore colección `favorites` con doc ID `{uid}__{businessId}`.
- **AuthContext** (`src/context/AuthContext.tsx`): provee `user`, `displayName`, `setDisplayName`.
- **MapContext** (`src/context/MapContext.tsx`): provee `setSelectedBusiness()` para abrir un comercio en el mapa.
- **useBusinesses** (`src/hooks/useBusinesses.ts`): exporta `allBusinesses` para resolver businessId → Business.
- **AppShell** (`src/components/layout/AppShell.tsx`): contenedor principal donde se agregaría el drawer.

## Requisitos funcionales

### Menú lateral (drawer)
1. El ícono hamburguesa en SearchBar abre un drawer lateral (desde la izquierda).
2. Header del drawer: avatar con inicial del nombre, displayName, botón para editar nombre (reutiliza NameDialog).
3. Lista de navegación: Favoritos, Comentarios (placeholder), Feedback (placeholder).
4. Click en "Favoritos" → muestra la lista inline en el drawer.
5. Botón "atrás" para volver a la lista de navegación.

### Sección Favoritos
6. Lista de comercios favoritos ordenados por fecha (más reciente primero).
7. Cada item: nombre del comercio, chip de categoría, dirección.
8. Click en un favorito → cierra drawer, centra mapa, abre BusinessSheet.
9. Botón para quitar favorito directamente desde la lista.
10. Estado vacío: "No tenés favoritos todavía".

## Requisitos no funcionales
- Drawer responsive: ancho ~300px, máximo 80vw.
- Lista de favoritos se carga al abrir la sección (no al abrir el drawer).
- Cruzar favoritos con JSON local (no queries extra por comercio).

## Consideraciones UX
- Estilo consistente con Google Maps.
- Drawer se cierra al tocar fuera o al navegar a un comercio.
- Secciones deshabilitadas en gris con "Próximamente".
- Avatar con color primario (#1a73e8).

## Buenas prácticas
- Reutilizar `allBusinesses` de `useBusinesses.ts`.
- Reutilizar `NameDialog` existente.
- No crear colecciones nuevas en Firestore.
- Firestore rules sin cambios.
