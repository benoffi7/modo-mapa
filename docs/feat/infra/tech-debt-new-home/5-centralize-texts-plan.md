# Plan: Centralize user-facing text strings

**Specs:** [5-centralize-texts-specs.md](5-centralize-texts-specs.md)
**Fecha:** 2026-03-27

---

## Fases de implementacion

### Fase 1: Crear archivos de mensajes

**Branch:** `refactor/centralize-texts`

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `src/constants/messages/common.ts` | Crear con `MSG_COMMON` (genericError, noResults, noUsersFound, publicProfileHint) |
| 2 | `src/constants/messages/business.ts` | Crear con `MSG_BUSINESS` (rating, favorite, empty states) |
| 3 | `src/constants/messages/comment.ts` | Crear con `MSG_COMMENT` (publish, edit, like, reply, empty states) |
| 4 | `src/constants/messages/question.ts` | Crear con `MSG_QUESTION` (publish, like, reply) |
| 5 | `src/constants/messages/list.ts` | Crear con `MSG_LIST` (CRUD, visibility, editors, empty states, template functions) |
| 6 | `src/constants/messages/auth.ts` | Crear con `MSG_AUTH` (verification, delete, login required) |
| 7 | `src/constants/messages/social.ts` | Crear con `MSG_SOCIAL` (follow, recommend, empty states) |
| 8 | `src/constants/messages/checkin.ts` | Crear con `MSG_CHECKIN` (success, removed, tooFar, empty) |
| 9 | `src/constants/messages/feedback.ts` | Crear con `MSG_FEEDBACK` (mediaTooBig, empty) |
| 10 | `src/constants/messages/offline.ts` | Crear con `MSG_OFFLINE` (sync templates, noConnection templates, emptyPending) |
| 11 | `src/constants/messages/admin.ts` | Crear con `MSG_ADMIN` (featured toggle template) |
| 12 | `src/constants/messages/onboarding.ts` | Crear con `MSG_ONBOARDING` (checklist, surprise templates) |
| 13 | `src/constants/messages/index.ts` | Barrel re-export de los 12 modulos |
| 14 | `src/constants/index.ts` | Agregar `export * from './messages';` |

**Lint + verify:** `npx eslint src/constants/messages/ --ext .ts` y `npx tsc --noEmit`

### Fase 2: Tests de funciones template

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `src/constants/messages/messages.test.ts` | Crear tests para todas las funciones template: `MSG_LIST.editorInvited`, `MSG_LIST.favoritesAdded` (0, 1, N), `MSG_OFFLINE.syncing/syncSuccess/syncFailed` (1, N), `MSG_OFFLINE.noConnectionPending` (1, N), `MSG_ONBOARDING.surpriseSuccess`, `MSG_ADMIN.featuredToggleSuccess` (true/false) |

**Verify:** `npx vitest run src/constants/messages/messages.test.ts`

### Fase 3: Reemplazar toasts en componentes business

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `src/components/business/BusinessRating.tsx` | Importar `MSG_BUSINESS`, reemplazar 4 toast strings |
| 2 | `src/components/business/FavoriteButton.tsx` | Importar `MSG_BUSINESS`, reemplazar 3 toast strings |
| 3 | `src/components/business/BusinessComments.tsx` | Importar `MSG_COMMENT`, reemplazar 7 toast strings |
| 4 | `src/components/business/BusinessQuestions.tsx` | Importar `MSG_QUESTION`, reemplazar 5 toast strings |
| 5 | `src/components/business/AddToListDialog.tsx` | Importar `MSG_LIST`, reemplazar 3 toast strings |
| 6 | `src/components/business/CheckInButton.tsx` | Importar `MSG_CHECKIN` + `MSG_AUTH`, reemplazar 4 toast strings |
| 7 | `src/components/business/RecommendDialog.tsx` | Importar `MSG_SOCIAL`, reemplazar 2 toast strings |

### Fase 4: Reemplazar toasts en componentes lists/menu

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `src/components/lists/ListDetailScreen.tsx` | Importar `MSG_LIST`, reemplazar 7 toast strings |
| 2 | `src/components/menu/CreateListDialog.tsx` | Importar `MSG_LIST`, reemplazar 2 toast strings |
| 3 | `src/components/menu/SharedListDetailView.tsx` | Importar `MSG_LIST`, reemplazar 5 toast strings (incluye `favoritesAdded` template) |
| 4 | `src/components/menu/InviteEditorDialog.tsx` | Importar `MSG_LIST`, reemplazar 2 toast strings (incluye `editorInvited` template) |
| 5 | `src/components/menu/EditorsDialog.tsx` | Importar `MSG_LIST`, reemplazar 2 toast strings |
| 6 | `src/components/menu/FeedbackForm.tsx` | Importar `MSG_FEEDBACK`, reemplazar 1 toast string |
| 7 | `src/components/menu/OnboardingChecklist.tsx` | Importar `MSG_ONBOARDING`, reemplazar 1 toast string |

### Fase 5: Reemplazar toasts en auth, admin, hooks, context

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `src/components/auth/DeleteAccountDialog.tsx` | Importar `MSG_AUTH`, reemplazar 1 toast string |
| 2 | `src/components/onboarding/VerificationNudge.tsx` | Importar `MSG_AUTH`, reemplazar 4 toast strings |
| 3 | `src/components/admin/FeaturedListsPanel.tsx` | Importar `MSG_ADMIN`, reemplazar 2 toast strings (incluye template) |
| 4 | `src/context/ConnectivityContext.tsx` | Importar `MSG_OFFLINE`, reemplazar 3 toast strings (incluye templates) |
| 5 | `src/hooks/useFollow.ts` | Importar `MSG_SOCIAL`, reemplazar 1 toast string |
| 6 | `src/hooks/useSurpriseMe.ts` | Importar `MSG_ONBOARDING`, reemplazar 2 toast strings (incluye template) |

### Fase 6: Reemplazar empty states y labels (Fase 2 del PRD)

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `src/components/business/BusinessRating.tsx` | Reemplazar "Sin calificaciones aun" con `MSG_BUSINESS.emptyRatings` |
| 2 | `src/components/business/BusinessPriceLevel.tsx` | Reemplazar "Sin votos de nivel de gasto" con `MSG_BUSINESS.emptyPriceLevel` |
| 3 | `src/components/business/MenuPhotoSection.tsx` | Reemplazar "No hay foto del menu" con `MSG_BUSINESS.emptyMenuPhoto` |
| 4 | `src/components/map/BusinessMarker.tsx` | Reemplazar "sin calificaciones" con `MSG_BUSINESS.noRatingsLabel` |
| 5 | `src/components/map/MapView.tsx` | Reemplazar "No se encontraron comercios" con `MSG_BUSINESS.noBusinessesFound` |
| 6 | `src/components/search/SearchListView.tsx` | Reemplazar "No se encontraron comercios" con `MSG_BUSINESS.noBusinessesFound` |
| 7 | `src/components/menu/CommentsList.tsx` | Reemplazar 3 empty state strings con `MSG_COMMENT` constantes |
| 8 | `src/components/lists/CollaborativeTab.tsx` | Reemplazar con `MSG_LIST.emptyCollaborative` |
| 9 | `src/components/lists/RecentsUnifiedTab.tsx` | Reemplazar con `MSG_CHECKIN.emptyVisits` |
| 10 | `src/components/menu/SharedListsView.tsx` | Reemplazar con `MSG_LIST.emptyLists` |
| 11 | `src/components/business/AddToListDialog.tsx` | Reemplazar con `MSG_LIST.emptyNoLists` |
| 12 | `src/components/menu/FollowedList.tsx` | Reemplazar con `MSG_SOCIAL.emptyFollowed` |
| 13 | `src/components/menu/ActivityFeedView.tsx` | Reemplazar con `MSG_SOCIAL.emptyActivity` |
| 14 | `src/components/menu/ReceivedRecommendations.tsx` | Reemplazar con `MSG_SOCIAL.emptyRecommendations` |
| 15 | `src/components/menu/CheckInsView.tsx` | Reemplazar con `MSG_CHECKIN.emptyVisits` |
| 16 | `src/components/menu/MyFeedbackList.tsx` | Reemplazar con `MSG_FEEDBACK.emptyFeedback` |
| 17 | `src/components/menu/PendingActionsSection.tsx` | Reemplazar con `MSG_OFFLINE.emptyPending` |
| 18 | `src/components/ui/OfflineIndicator.tsx` | Reemplazar con `MSG_OFFLINE.noConnection` y `MSG_OFFLINE.noConnectionPending` |
| 19 | `src/components/UserSearchField.tsx` | Reemplazar con `MSG_COMMON.noUsersFound` y `MSG_COMMON.publicProfileHint` |

### Fase 7: Actualizar tests existentes

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `src/components/onboarding/VerificationNudge.test.tsx` | Importar `MSG_AUTH`, reemplazar 4 strings hardcodeados en assertions |
| 2 | `src/components/ui/OfflineIndicator.test.tsx` | Importar `MSG_OFFLINE`, reemplazar 3 strings hardcodeados en assertions |

### Fase 8: Verificacion final

| Paso | Accion | Comando |
|------|--------|---------|
| 1 | Lint completo | `npx eslint src/ --ext .ts,.tsx` |
| 2 | Type check | `npx tsc --noEmit` |
| 3 | Tests completos | `npx vitest run` |
| 4 | Build | `npm run build` |
| 5 | Commit | Ver seccion de commit abajo |

---

## Orden de implementacion

1. `src/constants/messages/*.ts` (12 archivos de constantes) -- sin dependencias
2. `src/constants/messages/index.ts` (barrel) -- depende de paso 1
3. `src/constants/index.ts` (actualizar barrel) -- depende de paso 2
4. `src/constants/messages/messages.test.ts` -- depende de paso 1
5. Componentes business (Fase 3) -- depende de paso 3
6. Componentes lists/menu (Fase 4) -- depende de paso 3
7. Auth/admin/hooks/context (Fase 5) -- depende de paso 3
8. Empty states y labels (Fase 6) -- depende de paso 3
9. Tests existentes (Fase 7) -- depende de pasos 5-8
10. Verificacion final (Fase 8) -- depende de todo lo anterior

Las fases 3-6 son independientes entre si y pueden ejecutarse en paralelo.

---

## Riesgos

1. **Strings con tildes inconsistentes.** Al centralizar, se van a notar diferencias entre strings que ya tenian tildes y los que no. Mitigacion: aplicar el patron de "espanol argentino consistente" a todos los strings al centralizarlos, corrigiendo tildes y signos de apertura faltantes.

2. **Tests que hacen assertions contra strings exactos.** Si un string se corrige (tildes, puntuacion) al centralizarlo, tests que verificaban el string viejo van a fallar. Mitigacion: la Fase 7 actualiza esos tests. Ejecutar tests despues de cada fase para detectar roturas temprano.

3. **Merge conflicts con branches paralelas.** Si otro branch modifica los mismos componentes (agregando toasts), habra conflictos. Mitigacion: este refactor es mecanico y los conflictos seran simples de resolver. Mergear temprano.

---

## Commit strategy

Hacer un commit por fase para facilitar review y revert parcial:

```text
refactor: create centralized message constants (Fase 1)
test: add template function tests for MSG_* constants (Fase 2)
refactor: replace toast strings in business components (Fase 3)
refactor: replace toast strings in lists/menu components (Fase 4)
refactor: replace toast strings in auth/admin/hooks (Fase 5)
refactor: replace empty state strings with MSG_* constants (Fase 6)
test: update existing tests to use MSG_* constants (Fase 7)
```

Cada commit debe pasar lint (`npx eslint src/ --ext .ts,.tsx`) y type check (`npx tsc --noEmit`).

---

## Criterios de done

- [ ] All items from PRD scope implemented
- [ ] Tests pass with >= 80% coverage on new code
- [ ] No lint errors
- [ ] Build succeeds
- [ ] 62 toast calls across 21 files replaced with MSG_* constants
- [ ] ~24 empty state strings replaced with MSG_* constants
- [ ] Template functions tested (singular/plural, edge cases)
- [ ] Existing test assertions updated to match centralized strings
- [ ] No string literals remain in toast calls (except AbuseAlerts admin context)
