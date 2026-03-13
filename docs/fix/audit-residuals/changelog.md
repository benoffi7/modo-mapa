# Changelog - Correccion de Hallazgos Residuales

## Archivos modificados

### Seguridad

- `src/hooks/useAsyncData.ts` — Guard `import.meta.env.DEV` en `console.error`
- `src/components/menu/FeedbackForm.tsx` — Guard DEV + migrar a servicio
- `src/services/feedback.ts` — Tipo `FeedbackCategory` + validacion de entrada
- `src/services/comments.ts` — Validacion de texto (1-500) y nombre (1-30)
- `src/services/favorites.ts` — Validacion de userId/businessId no vacios
- `src/services/ratings.ts` — Separar create/update (preservar createdAt) + validacion score 1-5
- `src/services/tags.ts` — Validacion tagId contra whitelist + label custom tag 1-30
- `.github/workflows/deploy.yml` — Agregar lint, npm audit, deploy de Cloud Functions

### Arquitectura

- `src/config/converters.ts` — Importar `toDate` desde `utils/formatDate.ts` (eliminar copia local)
- `src/components/business/BusinessTags.tsx` — Descomponer en sub-componentes + useCallback
- `src/components/business/CustomTagDialog.tsx` — **Nuevo** — Dialog para crear/editar custom tags
- `src/components/business/DeleteTagDialog.tsx` — **Nuevo** — Dialog de confirmacion de eliminacion

### Tests

- `src/context/AuthContext.test.tsx` — Actualizar tests para create/update separados + test de updateDoc

### Documentacion

- `docs/fix-audit-residuals/prd.md` — PRD de la iteracion
- `docs/fix-audit-residuals/specs.md` — Specs tecnicas
- `docs/fix-audit-residuals/changelog.md` — Este archivo
