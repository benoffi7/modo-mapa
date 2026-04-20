# Plan: Tech debt architecture — prop-drilling, sabanas, console.error bypass

**PRD:** [prd.md](prd.md)
**Specs:** [specs.md](specs.md)
**Issue:** #306
**Fecha:** 2026-04-18

---

## Branch

`feat/306-architecture-tech-debt` basado en `new-home`.

---

## Fases

### Fase 0 — Preparacion (5 min)

- [ ] `git fetch origin && git checkout -b feat/306-architecture-tech-debt origin/new-home`
- [ ] `npm ci`
- [ ] Verificar baseline: `npm run lint && npm run test:run`
- [ ] Tomar snapshot LOC de archivos objetivo:
  - `wc -l src/components/admin/{ModerationActions,FeedbackList,AbuseAlerts}.tsx src/components/business/{BusinessSheetContent,InfoTab,BusinessQuestions,BusinessComments,OpinionesTab,FavoriteButton,BusinessTags,BusinessPriceLevel,CheckInButton,AddToListDialog,RecommendDialog,MenuPhotoUpload,MenuPhotoSection}.tsx`

### Fase 1 — S1 Logger bypass (10 min)

- [ ] Editar `src/components/admin/ModerationActions.tsx`:
  - Agregar `import { logger } from '../../utils/logger';`
  - Reemplazar `console.error('Moderation error:', err)` por `logger.error('Moderation error:', err)`
- [ ] Verificar: `grep -rn "console\.error" src/` → 0 resultados (fuera de tests)
- [ ] `npm run lint -- --max-warnings 0`
- [ ] Commit: `fix(#306): replace console.error with logger.error in ModerationActions`

### Fase 2 — S2 BusinessScopeContext (crear + provider) (20 min)

- [ ] Crear `src/context/BusinessScopeContext.tsx` con `BusinessScope`, `BusinessScopeProvider`, `useBusinessScope`.
- [ ] Crear `src/context/BusinessScopeContext.test.tsx` con 4 casos:
  - Provider provee valor
  - Hook fuera de provider tira error
  - Memoizacion: mismo scope primitives no re-crea value
  - Update cuando cambia businessId
- [ ] Modificar `src/components/business/BusinessSheetContent.tsx`:
  - Agregar `useMemo` para `scope`
  - Envolver children con `<BusinessScopeProvider scope={scope}>`
- [ ] `npm run test:run -- src/context/BusinessScopeContext`
- [ ] Commit: `feat(#306): add BusinessScopeContext to eliminate prop-drilling`

### Fase 3 — S2 Migrar componentes (40 min)

Migrar en orden de dependencia (hojas primero):

- [ ] `FavoriteButton.tsx` — eliminar props, usar `useBusinessScope`. Actualizar tests si existen.
- [ ] `BusinessTags.tsx` — mismo patron.
- [ ] `BusinessPriceLevel.tsx` — mismo patron. Verificar que `key={business.id}` sigue en el padre.
- [ ] `CheckInButton.tsx` — eliminar props `businessId`, `businessName`, `businessLocation`.
- [ ] `AddToListDialog.tsx` — eliminar props.
- [ ] `RecommendDialog.tsx` — eliminar props.
- [ ] `BusinessComments.tsx` — eliminar props `businessId`, `businessName`.
- [ ] `BusinessQuestions.tsx` — eliminar props (tambien se descompone en Fase 7).
- [ ] `OpinionesTab.tsx` — eliminar props `businessId`, `businessName` (solo pasa-through).
- [ ] `MenuPhotoUpload.tsx` — eliminar prop `businessId`.
- [ ] `MenuPhotoSection.tsx` — eliminar prop `businessId`.
- [ ] Simplificar JSX en `BusinessSheetContent.tsx` (eliminar props `businessId`/`businessName`/`businessLocation` de callsites).
- [ ] `npm run lint` y `npm run test:run`
- [ ] Test manual en dev (emulators) — abrir BusinessSheet, verificar favorito, tags, price level, check-in, recomendar, add to list, foto.
- [ ] Commit: `refactor(#306): migrate business components to BusinessScopeContext`

### Fase 4 — Test helper para scope (15 min)

- [ ] Crear/agregar en `src/test/setup.ts` o archivo de utils de test: helper `renderWithBusinessScope({ businessId, businessName, location }, element)`.
- [ ] Actualizar tests existentes de componentes migrados que hagan mount sin provider para usar el helper.
- [ ] `npm run test:run`
- [ ] Commit: `test(#306): add renderWithBusinessScope helper`

### Fase 5 — S3 InfoTab slim API (20 min)

- [ ] Modificar `src/components/business/InfoTab.tsx`:
  - Cambiar props a `{ ratingData, priceLevelData, tagsData, photoData, isLoading }`
  - Hijos ya no reciben `businessId`/`businessName` (lo toman de scope)
- [ ] Modificar `BusinessSheetContent.tsx`:
  - Memoizar `priceLevelData`, `tagsData`, `photoData` con `useMemo` para evitar re-renders
  - Cambiar llamada a `<InfoTab>`
- [ ] `npm run test:run`
- [ ] Commit: `refactor(#306): slim InfoTab prop surface via grouped data objects`

### Fase 6 — S5 Split AbuseAlerts (30 min)

- [ ] Crear `src/components/admin/alerts/AlertsFilters.tsx` (extraer grid de filtros + export).
- [ ] Crear `src/components/admin/alerts/AlertsTable.tsx` (extraer tabla + expanded row).
- [ ] Simplificar `src/components/admin/AbuseAlerts.tsx` a orquestador (<=180 LOC).
- [ ] Crear `AlertsFilters.test.tsx` y `AlertsTable.test.tsx` (3 cases cada uno).
- [ ] `npm run test:run -- src/components/admin/alerts`
- [ ] Verificar LOC: `wc -l src/components/admin/AbuseAlerts.tsx` <= 200.
- [ ] Commit: `refactor(#306): split AbuseAlerts into filters + table subcomponents`

### Fase 7 — S5 Split FeedbackList (25 min)

- [ ] Crear `src/components/admin/feedback/FeedbackRespondForm.tsx`.
- [ ] Crear `src/components/admin/feedback/FeedbackBusinessDialog.tsx`.
- [ ] Crear `src/components/admin/feedback/FeedbackMediaPreview.tsx`.
- [ ] Simplificar `src/components/admin/FeedbackList.tsx` a orquestador (<=220 LOC).
- [ ] Crear `FeedbackRespondForm.test.tsx` (2 cases).
- [ ] `npm run test:run`
- [ ] Commit: `refactor(#306): split FeedbackList into respond form + business dialog + media preview`

### Fase 8 — S5 Split BusinessQuestions (30 min)

- [ ] Crear `src/components/business/QuestionForm.tsx` (input + daily limit alert).
- [ ] Crear `src/components/business/QuestionAnswerThread.tsx` (render de pregunta + respuestas + badge + reply).
- [ ] Simplificar `src/components/business/BusinessQuestions.tsx` a orquestador (<=220 LOC).
- [ ] Crear `QuestionForm.test.tsx` (3 cases).
- [ ] `npm run test:run`
- [ ] Test manual: abrir BusinessSheet → tab Opiniones → sub-tab Preguntas → hacer pregunta → responder → colapsar/expandir thread → eliminar pregunta.
- [ ] Commit: `refactor(#306): split BusinessQuestions into form + answer thread subcomponents`

### Fase 9 — S4 Dirty-tracking (opcional, 10 min)

- [ ] Re-evaluar si un hook `useCommentsDirtyBridge` reduce complejidad de `BusinessSheetContent`.
  - Si SI: crear hook y refactorizar.
  - Si NO (dejar como esta): skip.
- [ ] Commit: `refactor(#306): localize comments dirty state` (solo si se hace)

### Fase 10 — Docs (15 min)

- [ ] Actualizar `docs/reference/patterns.md`:
  - Agregar entrada en "Datos y estado" para BusinessScopeContext
  - Anti-sabana: confirmar que patron sigue vigente
- [ ] Actualizar `docs/reference/architecture.md`:
  - Agregar `BusinessScopeContext` en tabla de Contextos con scope "Solo BusinessSheetContent"
- [ ] Actualizar `docs/_sidebar.md`:
  - Agregar entrada de PRD/Specs/Plan bajo Infra
- [ ] Commit: `docs(#306): document BusinessScopeContext and scope pattern`

### Fase 11 — Verificacion final (15 min)

- [ ] `npm run lint -- --max-warnings 0`
- [ ] `npm run test:coverage`
- [ ] Verificar coverage >= 80% (statements, branches, functions, lines)
- [ ] `grep -rn "console\.error" src/` → 0 resultados fuera de tests
- [ ] `wc -l src/components/admin/*.tsx src/components/business/*.tsx` → ningun archivo > 300 LOC
- [ ] Verificar baseline manual end-to-end en emuladores:
  - BusinessSheet completo (Info + Opiniones + Preguntas)
  - Admin AbuseAlerts (filtros + tabla + expand + review/dismiss)
  - Admin FeedbackList (respond inline + business detail dialog + media preview)
  - ModerationActions (trigger error → ver en consola DEV)
- [ ] `npm run build` (verificar que compila en produccion sin warnings)
- [ ] Push branch

### Fase 12 — PR (10 min)

- [ ] `gh pr create --base new-home` con titulo: `feat(#306): tech debt — architecture prop-drilling + sabanas + logger bypass`
- [ ] Body con resumen por seccion (S1–S5) + metrica de LOC antes/despues + test plan
- [ ] Asignar labels (`enhancement`, `tech-debt`)

---

## Verificacion por criterio de exito

| Criterio | Comando / verificacion |
|----------|-----------------------|
| Lint + tests pasan | `npm run lint && npm run test:run` |
| Coverage >= 80% | `npm run test:coverage` |
| No `console.error` en src/ | `grep -rn "console\.error" src/ \| grep -v test` |
| Sin props `businessId`/`businessName` en 11 componentes migrados | `grep -l "businessId: string" src/components/business/` excluyendo `BusinessSheetHeader`, `BusinessSheet`, `BusinessSheetContent`, hooks |
| SettingsPanel sin cambios | `git diff src/components/profile/SettingsPanel.tsx` vacio |
| Ningun archivo > 300 LOC | `find src/components/admin src/components/business -name "*.tsx" -exec wc -l {} + \| awk '$1 > 300'` vacio |

---

## Rollback plan

Cada fase es un commit independiente. Si una fase falla:

- Fase 1 (logger): `git revert` del commit, fix en fase separada.
- Fase 2–4 (scope context): `git revert` secuencial — los componentes migrados se restauran a props.
- Fase 5 (InfoTab): `git revert` aislado.
- Fase 6–8 (splits): cada split es commit independiente — revertible uno a uno.
- Fase 10 (docs): trivial revert.

---

## Notas para el agente implementador

1. **Respetar merge skill**: al finalizar, correr `npm run lint`, `npm run test:coverage`, `npm run build` antes de push.
2. **Respetar PR reviewer**: no usar `.catch(() => {})` — usar `logger.warn` o dejar que el error se propague con try/catch y toast.
3. **Respetar architecture agent**: el nuevo contexto va en `src/context/` (no en `src/hooks/`).
4. **Memos en BusinessSheetContent**: los 3 objetos data de InfoTab deben estar memoizados — sino `InfoTab memo` no sirve.
5. **Tests con scope**: todos los componentes migrados que tengan tests deben envolverse con `renderWithBusinessScope`. Si el test no existia, crear uno minimo (smoke test) para el componente migrado.
6. **No tocar SettingsPanel**: el "sabana" queda out-of-scope. Confirmar `git diff` vacio para ese archivo al final.
7. **Verificar `BusinessSheetHeader` NO migra**: sigue recibiendo `business` completo.
8. **Verificar `useBusinessData` y `useCommentListBase`**: siguen recibiendo `businessId` como parametro (contexto solo reemplaza prop-drilling en componentes, no en hooks).
