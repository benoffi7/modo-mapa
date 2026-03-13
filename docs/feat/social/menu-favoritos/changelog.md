# Changelog: Menú lateral con sección Favoritos

**Issue:** #7
**Fecha:** 2026-03-11

## Archivos creados

| Archivo | Descripción |
|---------|-------------|
| `src/components/layout/SideMenu.tsx` | Drawer lateral con header de usuario, navegación y secciones |
| `src/components/menu/FavoritesList.tsx` | Lista de comercios favoritos con quitar favorito y navegación al mapa |
| `docs/feat-menu-favoritos/prd.md` | PRD |
| `docs/feat-menu-favoritos/specs.md` | Especificaciones técnicas |
| `docs/feat-menu-favoritos/plan.md` | Plan técnico |
| `docs/feat-menu-favoritos/changelog.md` | Este archivo |

## Archivos modificados

| Archivo | Cambio |
|---------|--------|
| `src/components/search/SearchBar.tsx` | Agregada prop `onMenuClick` y conectada al IconButton del menú |
| `src/components/layout/AppShell.tsx` | Agregado estado `menuOpen`, renderizado de SideMenu, prop `onMenuClick` a SearchBar |
