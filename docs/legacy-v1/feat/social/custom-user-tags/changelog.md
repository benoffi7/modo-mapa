# Changelog: Tags personalizados por usuario

**Issue:** #5
**Fecha:** 2026-03-11

## Archivos modificados

| Archivo | Cambio |
|---------|--------|
| `firestore.rules` | Agregada regla para colección `customTags` (read/create/update/delete con validaciones) |
| `src/components/business/BusinessTags.tsx` | Reescrito para soportar tags personalizados: crear, editar, eliminar con dialogs y menú contextual |

## Archivos creados

| Archivo | Descripción |
|---------|-------------|
| `docs/feat-custom-user-tags/prd.md` | Product Requirements Document |
| `docs/feat-custom-user-tags/specs.md` | Especificaciones técnicas |
| `docs/feat-custom-user-tags/plan.md` | Plan técnico |
| `docs/feat-custom-user-tags/changelog.md` | Este archivo |

## Archivos existentes sin cambios

| Archivo | Nota |
|---------|------|
| `src/types/index.ts` | Interface `CustomTag` ya existía (agregada previamente) |
