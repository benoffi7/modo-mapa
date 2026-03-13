# Changelog: Sección Comentarios en menú lateral

**Issue:** #9
**Fecha:** 2026-03-11

## Archivos creados

| Archivo | Descripción |
|---------|-------------|
| `src/components/menu/CommentsList.tsx` | Lista de comentarios del usuario con navegación al comercio y eliminación |
| `docs/feat-menu-comentarios/prd.md` | PRD |
| `docs/feat-menu-comentarios/specs.md` | Especificaciones técnicas |
| `docs/feat-menu-comentarios/plan.md` | Plan técnico |
| `docs/feat-menu-comentarios/changelog.md` | Este archivo |

## Archivos modificados

| Archivo | Cambio |
|---------|--------|
| `firestore.rules` | Agregada regla `allow delete` en `comments` con validación de userId |
| `src/components/layout/SideMenu.tsx` | Habilitada sección Comentarios, ampliado tipo Section, agregado render de CommentsList |
| `src/components/business/BusinessComments.tsx` | Agregado botón eliminar en comentarios propios con dialog de confirmación |
