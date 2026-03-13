# Changelog: Feedback, Ratings, Agregar comercio y versión

**Issue:** #11
**Fecha:** 2026-03-11

## Archivos creados

| Archivo | Descripción |
|---------|-------------|
| `src/components/menu/RatingsList.tsx` | Lista de calificaciones del usuario con estrellas y navegación |
| `src/components/menu/FeedbackForm.tsx` | Formulario de feedback con categorías y agradecimiento |
| `docs/feat-menu-feedback-ratings-version/prd.md` | PRD |
| `docs/feat-menu-feedback-ratings-version/specs.md` | Especificaciones técnicas |
| `docs/feat-menu-feedback-ratings-version/plan.md` | Plan técnico |
| `docs/feat-menu-feedback-ratings-version/changelog.md` | Este archivo |
| `src/hooks/useListFilters.ts` | Hook genérico de filtrado y ordenamiento para listas con business |
| `src/components/menu/ListFilters.tsx` | Componente visual de filtros: búsqueda, categoría, estrellas, orden |
| `docs/feat-menu-feedback-ratings-version/prd-filters.md` | PRD de filtros |
| `docs/feat-menu-feedback-ratings-version/specs-filters.md` | Specs de filtros |
| `docs/feat-menu-feedback-ratings-version/plan-filters.md` | Plan técnico de filtros |

## Archivos modificados

| Archivo | Cambio |
|---------|--------|
| `src/components/layout/SideMenu.tsx` | Agregadas secciones Ratings, Feedback, Agregar comercio (link externo), footer con versión |
| `src/components/menu/RatingsList.tsx` | Integrado hook useListFilters y componente ListFilters con filtro por estrellas |
| `src/components/menu/FavoritesList.tsx` | Integrado hook useListFilters y componente ListFilters |
| `firestore.rules` | Agregada regla para colección `feedback` (solo create) |
| `package.json` | Versión actualizada a 1.1.0 |
| `vite.config.ts` | Agregado `define` para exponer `__APP_VERSION__` |
