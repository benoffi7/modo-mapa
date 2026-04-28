# Plan: Offline — services not using offlineQueue / withOfflineSupport

**Specs:** [specs.md](specs.md)
**PRD:** [prd.md](prd.md)
**Fecha:** 2026-04-25
**Issue:** [#323](https://github.com/benoffi7/modo-mapa/issues/323)

---

## Resumen ejecutivo

- **5 workstreams** (Fases A-E) con dependencia lineal estricta: Foundation → HIGH → MEDIUM → LOW + indicator → Docs.
- **31 commits base** (1 paso = 1 commit), agrupados por dominio (NO mezclar comments con lists con ratings). 33 worst-case si se extraen sub-hooks B1a/B6a.
- **2 owners**: `nico` (types/offline.ts + syncEngine branches + pre-staging-check.sh + tests de service), `luna` (callers en components/hooks + tests de UI).
- **Risk staging**: types y branches primero (foundation, sin breaking), HIGH callers (mayor riesgo data loss), MEDIUM callers, LOW + indicator al final, docs cierran.
- **Branch unico**: `feat/323-offline-services-queue-coverage` (sin sub-branches por issue).
- **Coordinacion cross-issue**: orden de merge debe negociarse con #322 y #324 antes de abrir PR (overlap en `ListDetailScreen.tsx` y hooks de comments).

---

## File ownership map

| Archivo / superficie | Owner | Razon |
|---------------------|-------|-------|
| `src/types/offline.ts` | nico | Tipos + payloads = capa de servicio core |
| `src/services/syncEngine.ts` | nico | Branches de replay = service layer |
| `src/services/__tests__/syncEngine.*.test.ts` | nico | Co-ownership con el branch |
| `src/constants/messages/offline.ts` | nico | Strings centralizados, no UI |
| `src/constants/messages/__tests__/offline.test.ts` | nico | Co-ownership con messages |
| `scripts/pre-staging-check.sh` | nico | Bash script + grep heuristic = ownership infra |
| `scripts/__tests__/pre-staging-check.test.sh` | nico | Co-ownership con script |
| `src/hooks/useUserSettings.ts` (+ flush) | luna | Hook React, integration con UI |
| `src/hooks/useFollowedTags.ts`, `useInterestsFeed.ts` (flush local) | luna | Hooks React |
| `src/hooks/useBusinessRating.ts` (wrapper criteria) | luna | Hook React |
| `src/hooks/useCommentListBase.ts` (wrapper delete) | luna | Hook React |
| Cualquier archivo en `src/components/**` | luna | UI |
| `src/App.tsx` (mover OfflineIndicator) | luna | App shell UI |
| `src/components/layout/TabShell.tsx` (quitar OfflineIndicator) | luna | UI |
| Tests `src/components/**/__tests__/**` y `src/hooks/__tests__/**` | luna | Co-ownership con cambio |
| Docs `docs/reference/patterns.md`, `features.md`, `guards/304-offline.md` | luna (con review nico) | Cierre del feature |

**Coordinacion**: cuando un step toque tanto un service (nico) como un caller (luna), el commit pertenece al owner que tiene el cambio mas grande. Para foundation (paso 1-6) nico mergea primero al branch unificado; luna sigue desde paso 7 sin conflictos.

---

## Estimacion de LOC (guard #306 R2 — 400 LOC max)

LOC actuales medidos en disco al 2026-04-25 (`wc -l`). Re-medir **antes** del primer commit de la fase B (B1) y **despues** del ultimo commit de la fase B (B9). Si supera 400 LOC, extraer sub-hook ANTES de continuar a fase C.

| Archivo | LOC actual (en disco) | LOC despues (estimado wrap) | Riesgo | Mitigacion |
|---------|----------------------|------------------------------|--------|------------|
| `src/types/offline.ts` | 155 | ~185 | Bajo | Solo agrega 3 types + 3 interfaces |
| `src/services/syncEngine.ts` | 218 | ~250 | Bajo | 3 branches nuevos lazy-imported |
| `src/services/offlineInterceptor.ts` | ~80 | ~80 | Nulo | Sin cambios |
| `src/hooks/useUserSettings.ts` | 106 | ~175 | Bajo | Extraer `flushPendingSettings()` ya planificado |
| `src/hooks/useCommentListBase.ts` | 200 | ~220-230 | Bajo | Margen de >170 LOC contra el limite; B1a queda como salvaguarda no esperada |
| `src/components/lists/ListDetailScreen.tsx` | 289 | ~325-345 | Bajo | Margen de >55 LOC contra el limite; B6a queda como salvaguarda no esperada |
| `src/components/business/BusinessComments.tsx` | ~250 | ~270 | Bajo | Solo wrappear handler |
| `src/components/profile/CommentsList.tsx` | ~280 | ~310 | Bajo | Wrappear + snackbar diff |
| `src/hooks/useBusinessRating.ts` | ~220 | ~245 | Bajo | Wrappear handler |
| `scripts/pre-staging-check.sh` | 98 | ~200 | Medio | Two new checks + helpers |

**Decision binding**: la pre-condicion operativa de Fase B exige medir `wc -l` real antes del wrap y reportar en PR description. Si pasa de 380 LOC en ese momento, planificar extraccion en B1a o B6a antes de wrappear. Con los valores actuales (200 / 289) la probabilidad es baja, pero la salvaguarda se preserva por contrato.

---

## Fases de implementacion

### Branch

`feat/323-offline-services-queue-coverage` (desde `new-home`, base branch del proyecto).

Sin sub-branches. Commits atomicos secuenciales. Rebase con `new-home` antes de PR.

---

### Fase A — Foundation (HIGH risk control, NO breaking changes)

**Objetivo**: Tener types + branches + script + messages disponibles para que la fase B pueda wrappear sin friccion. Nada user-facing en esta fase, todo es infra.

**Owner principal**: nico

**Commits**: 8 (A1 + A2 + A3 + A4 + A5 + A6 + A6b + A7)

| Paso | Commit | Owner | Archivo(s) | Cambio | Rollback |
|------|--------|-------|-----------|--------|----------|
| A1 | `feat(#323): add 3 OfflineActionType + payloads (comment_edit/delete, rating_criteria_upsert)` | nico | `src/types/offline.ts` | Agregar `comment_edit`, `comment_delete`, `rating_criteria_upsert` al union `OfflineActionType`. Agregar `CommentEditPayload`, `CommentDeletePayload`, `RatingCriteriaUpsertPayload`. Agregar a la union `OfflineActionPayload`. **No tocar `list_delete` ni los list_* existentes.** | `git revert` — sin consumidores, no rompe nada |
| A2 | `feat(#323): add 3 syncEngine branches (comment_edit/delete, rating_criteria_upsert)` | nico | `src/services/syncEngine.ts` | Agregar 3 `case` despues de `'list_item_remove'`. Lazy-import de `editComment`, `deleteComment`, `upsertCriteriaRating`. **Branch defensivo `case 'list_delete'` queda intacto.** | `git revert` — branches no se invocan hasta que un caller enquee |
| A3 | `test(#323): syncEngine branches comment_edit/delete + rating_criteria_upsert + list_delete defensive` | nico | `src/services/__tests__/syncEngine.commentEdit.test.ts`, `syncEngine.commentDelete.test.ts`, `syncEngine.criteriaUpsert.test.ts`, `syncEngine.listDelete.defensive.test.ts` | 4 tests nuevos: happy path para los 3 branches + branch defensivo `list_delete` que sigue replayando correctamente. Mock de `editComment`/`deleteComment`/`upsertCriteriaRating`/`deleteList`. | `git revert` |
| A4 | `test(#323): syncEngine doc-not-found path for comment_edit/delete (B1 known limitation)` | nico | `src/services/__tests__/syncEngine.commentEdit.docNotFound.test.ts`, `syncEngine.commentDelete.docNotFound.test.ts` | 2 tests que cubren el path `comment_create + comment_edit` offline cuando el commentId no existe en server: throw → `OFFLINE_MAX_RETRIES` → `failed` → analytics `EVT_OFFLINE_ACTION_FAILED`. | `git revert` |
| A5 | `feat(#323): add 8 new keys to MSG_OFFLINE` | nico | `src/constants/messages/offline.ts`, `src/constants/messages/__tests__/offline.test.ts` | Agregar 8 keys nuevas (`deleteListBlocked`, `commentDeletedOffline`, `commentEditingSync`, `deleteAccountOffline`, `feedbackOffline`, `cleanAnonOffline`, `uploadPhotoOffline`, `requiresConnection`). **No tocar las keys actuales.** Extender el test para cubrir las 8 nuevas + verificar voseo y tildes. | `git revert` |
| A6 | `chore(#323): pre-staging-check.sh — Check 6 (mutators) + Check 7 (list_delete veto), allow REPO_ROOT override` | nico | `scripts/pre-staging-check.sh` | (a) **Modificar la asignacion existente en `pre-staging-check.sh:7`** de `REPO_ROOT="$(git rev-parse --show-toplevel)"` a `REPO_ROOT="${REPO_ROOT:-$(git rev-parse --show-toplevel)}"` para que el test del paso A7 pueda override via env var apuntando a un fixture temporal (O3 Diego). La variable ya existe; el cambio es la forma de asignacion para respetar override externo. (b) Agregar Check 6 con la lista de ~30 mutadores y heuristica de cumplimiento. **Marcar Check 6 como WARN-only** en este commit (no `fail=1`); sera promovido a `fail` en paso A7 tras sweep legacy. (c) Agregar Check 7 que veta `withOfflineSupport('list_delete'...)` con `fail=1` desde el inicio. Whitelist documentada. | `git revert` — sin enforcement, no bloquea nada; vuelve la asignacion original de REPO_ROOT |
| A6b | `chore(#323): sweep legacy matches of Check 6 — whitelist or refactor` | nico | (multiple — segun los hits) | **Sweep legacy** (recomendacion Diego + Pablo). Correr `pre-staging-check.sh` con Check 6 en modo WARN, listar todos los hits existentes. Para cada hit: (a) si es falso positivo legitimo → comentario `// pre-staging-check:allow: <razon>`; (b) si es violacion real → arreglar el caller wrappeando o gateando (mover a fase B si el cambio es grande); (c) si es codigo en `services/admin/` ya whitelisted → confirmar match de regex y ajustar whitelist. Generar listado en commit message para auditoria. | Multiple reverts caso por caso |
| A7 | `chore(#323): pre-staging-check.sh — promote Check 6 to fail mode + regression test` | nico | `scripts/pre-staging-check.sh`, `scripts/__tests__/pre-staging-check.test.sh` (nuevo), `.github/workflows/guards.yml` | (a) Cambiar Check 6 de WARN a `fail=1` (gate completo). (b) Crear `scripts/__tests__/pre-staging-check.test.sh` con `REPO_ROOT="${REPO_ROOT:-$(git rev-parse --show-toplevel)}"`. Crea fixture temporal con `editComment(...)` directo en componente y verifica exit 1 + nombre del archivo en output. (c) Integrar el test en CI: agregar nuevo step en `.github/workflows/guards.yml` job `guards` (workflow real verificado en disco — los workflows existentes son `guards.yml`, `deploy.yml`, `deploy-staging.yml`, `preview.yml`; **NO existe `ci.yml`**). El step nuevo se agrega DESPUES del step "Run guards (baseline check)" y ANTES de "Generate full report on failure". Nombre del step: "Run pre-staging-check regression test" con `run: bash scripts/__tests__/pre-staging-check.test.sh`. **No correr `pre-staging-check.sh` completo en CI** (tiene checks que dependen de `npm run build` y de archivos no presentes en el runner) — solo el test del propio script. | `git revert` — vuelve a WARN-only y quita el step de `guards.yml` |

**Cierre Fase A**: `npm test` y `bash scripts/pre-staging-check.sh` deben pasar verde sobre `feat/323` rebased en `new-home`.

---

### Fase B — HIGH callers (S2 PRD — data loss real)

**Objetivo**: Wrappear/gatear los 15 callsites HIGH. Agrupados por dominio. Cada commit toca un solo dominio (NO mezclar comments con lists con ratings).

**Owner principal**: luna (todos los componentes y hooks user-facing).

**Pre-condicion (sin commit)**: ANTES de empezar B1, luna corre `wc -l src/hooks/useCommentListBase.ts src/components/lists/ListDetailScreen.tsx` y reporta los valores en el PR description (seccion "LOC baseline"). Medicion al 2026-04-25 en disco: `useCommentListBase.ts` = 200 LOC, `ListDetailScreen.tsx` = 289 LOC. Si en el momento de implementar supera 380 LOC, planificar extraccion (B1a antes de B1, o B6a antes de B6) en commits dedicados antes del wrap. **Esta pre-condicion no genera commit propio** — es un check operativo previo a Fase B.

**Commits**: 9 (B1 + B2 + B3 + B4 + B5 + B6 + B7 + B8 + B9; con extracciones opcionales B1a y/o B6a si LOC > 380)

| Paso | Commit | Owner | Archivo(s) | Cambio | Rollback |
|------|--------|-------|-----------|--------|----------|
| B1 | `refactor(#323): wrap deleteComment in useCommentListBase via withOfflineSupport (comment_delete)` | luna | `src/hooks/useCommentListBase.ts`, `src/hooks/__tests__/useCommentListBase.deleteOffline.test.ts` | (a) Agregar `import { withOfflineSupport }` y `useConnectivity`. (b) En `onConfirmDeleteComment`, wrappear `deleteComment(...)` con `withOfflineSupport('comment_delete', { userId, businessId, businessName }, { commentId }, () => deleteComment(...), toast)`. (c) Test nuevo: offline → enquea, online → llama directo. (d) **Si LOC supera 400**, extraer `useCommentMutations()` en paso B1a antes. | `git revert` |
| B2 | `feat(#323): wrap edit/delete comment in BusinessComments + CommentsList + diff snackbar offline` | luna | `src/components/business/BusinessComments.tsx`, `src/components/profile/CommentsList.tsx`, `src/components/business/__tests__/BusinessComments.editOffline.test.tsx`, `src/components/profile/__tests__/CommentsList.snackbarOffline.test.tsx` | (a) En `BusinessComments.handleSaveEdit` (line 163), wrappear `editComment(...)` con `withOfflineSupport('comment_edit', ...)`. (b) En `CommentsList` (line 70 edit, line 52 delete), wrappear ambos. (c) Snackbar diferenciado: leer `isOffline` de `useConnectivity()` y sustituir `message` + omitir `action="Deshacer"` cuando offline. **NO modificar `useUndoDelete`**. **NO agregar gate por `hasPendingCreate`** (B1 Ciclo 2 — out of scope). (d) 2 tests nuevos con paths online/offline. | `git revert` (rollback completo del dominio comments) |
| B3 | `feat(#323): wrap upsertCriteriaRating in useBusinessRating (rating_criteria_upsert)` | luna | `src/hooks/useBusinessRating.ts`, `src/hooks/__tests__/useBusinessRating.criteriaOffline.test.ts` | (a) Wrappear `upsertCriteriaRating(...)` (line 147) con `withOfflineSupport('rating_criteria_upsert', { userId, businessId, businessName }, { criterionId, value }, () => upsertCriteriaRating(...), toast)`. (b) Test nuevo: offline enquea, online llama directo, replay merge no destructivo. | `git revert` |
| B4 | `feat(#323): wrap createList in CreateListDialog + AddToListDialog (list_create with optimistic id)` | luna | `src/components/lists/CreateListDialog.tsx`, `src/components/business/AddToListDialog.tsx`, `src/components/lists/__tests__/CreateListDialog.offline.test.tsx`, `src/components/business/__tests__/AddToListDialog.offline.test.tsx` | (a) En ambos componentes, generar `listId` cliente-side via `generateListId()` antes del wrap. (b) Wrappear `createList(...)` con `withOfflineSupport('list_create', ...)` pasando el `listId` pre-generado. (c) `onCreated(listId, ...)` se invoca igual offline. (d) 2 tests de offline path. | `git revert` |
| B5 | `feat(#323): wrap add/remove business in AddToListDialog (list_item_add/remove) — second touch after B4` | luna | `src/components/business/AddToListDialog.tsx` (segundo touch del archivo despues de B4; commit dedicado por tipo de mutation), `src/components/business/__tests__/AddToListDialog.offline.test.tsx` (extender) | Wrappear `addBusinessToList` (lines 100, 118) con `'list_item_add'` y `removeBusinessFromList` (line 95) con `'list_item_remove'`. Extender el test con casos add/remove offline. **Commit message body**: dejar nota explicita de que B4 ya wrappeo `createList` en el mismo archivo y que este commit cubre las otras dos mutations por tipo, no por archivo (split intencional para mantener atomicidad por dominio: create vs add/remove). | `git revert` |
| B6 | `refactor(#323): wrap CRUD in ListDetailScreen + gate deleteList (list_update/toggle/item_remove)` | luna | `src/components/lists/ListDetailScreen.tsx`, `src/components/lists/__tests__/ListDetailScreen.offline.test.tsx` | (a) `handleColorChange` (line 77) y `handleIconChange` (line 142): wrappear `updateList` con `'list_update'`. (b) `handleTogglePublic` (line 88): wrappear `toggleListPublic` con `'list_toggle_public'`. (c) `handleRemoveItem` (line 121): wrappear `removeBusinessFromList` con `'list_item_remove'`. (d) `handleDelete` (line 108): **GATED** — `if (isOffline) { toast.warning(MSG_OFFLINE.deleteListBlocked); setConfirmDeleteOpen(false); return; }`. (e) Boton toolbar (line 181) `disabled={isOffline}`. Boton confirmar Dialog (line 284) `disabled={isOffline}` con tooltip "Requiere conexión". (f) Test cubre cada CTA online/offline. **NO wrappear `list_delete`** (Check 7 lo veta). **Si LOC pasa de 400, ejecutar B6a (extraer `useListMutations`).** | `git revert` (rollback completo lists CRUD) |
| B7 | `feat(#323): wrap removeFavorite in FavoritesList (favorite_remove)` | luna | `src/components/lists/FavoritesList.tsx`, `src/components/lists/__tests__/FavoritesList.removeOffline.test.tsx` | Wrappear `removeFavorite(...)` (line 100) con `withOfflineSupport('favorite_remove', ...)`. Test offline path. | `git revert` |
| B8 | `test(#323): confirm existing offline gates in EditorsDialog + InviteEditorDialog + DeleteAccountDialog` | luna | `src/components/lists/__tests__/EditorsDialog.offline.test.tsx`, `InviteEditorDialog.offline.test.tsx`, `src/components/auth/__tests__/DeleteAccountDialog.offline.test.tsx` | **No code change** en componentes (ya estan gated). Agregar tests que verifican: boton disabled offline + click cuando offline no llama service. Para `DeleteAccountDialog`, verificar copy en voseo del Alert (line 95-99). | `git revert` |
| B9 | `feat(#323): gate cleanAnonymousData in SettingsMenu (offline guard + error message)` | luna | `src/components/profile/SettingsMenu.tsx`, `src/components/profile/__tests__/SettingsMenu.offline.test.tsx` | En `handleConfirm` (line 56), agregar `if (isAnonymous && isOffline) { setError(MSG_OFFLINE.cleanAnonOffline); setLoading(false); return; }`. Boton "Empezar de cero" `disabled={loading || (isAnonymous && isOffline)}`. Test con caso anonimo offline. | `git revert` |

**Cierre Fase B**: re-medir LOC de `useCommentListBase.ts` y `ListDetailScreen.tsx`. Reportar en PR description. Confirmar que CI verde con Check 6 en `fail` mode. Confirmar que `EVT_OFFLINE_ACTION_QUEUED` se emite con los 3 nuevos `action_type`.

---

### Fase C — MEDIUM callers (S3 PRD — silent fail, no data loss critico)

**Objetivo**: Gatear los 6 callsites MEDIUM y agregar el flush effect a settings hooks. Agrupados por dominio (settings, feedback, recomendaciones, photos).

**Owner principal**: luna

**Commits**: 6

| Paso | Commit | Owner | Archivo(s) | Cambio | Rollback |
|------|--------|-------|-----------|--------|----------|
| C1 | `feat(#323): useUserSettings — pendingRef + flushPendingSettings + offline gate` | luna | `src/hooks/useUserSettings.ts`, `src/hooks/__tests__/useUserSettings.flush.test.ts` | (a) Agregar `pendingSettingsRef` (useRef), `useConnectivity()` en el hook. (b) En `updateSetting` (lines 53, 70, 83, 96): si `isOffline` → acumular en ref + `setOptimistic(prev)`, no llamar service. Si online → flujo actual. (c) **Extraer `flushPendingSettings()` como `useCallback` nombrada** (O4 Diego — exposicion en return del hook). (d) `useEffect` que invoca `flushPendingSettings()` cuando `isOffline === false` y hay pending (con `let cancelled = false; return () => { cancelled = true; }`). (e) Aplicar el patron a `updateLocality`, `clearLocality`, `updateDigestFrequency`. (f) Test (SC2.2 PRD) verifica: pendingRef acumula offline, flush effect dispara online, `flushPendingSettings()` invocada manualmente flushea sin esperar effect, cleanup en unmount. | `git revert` |
| C2 | `feat(#323): useFollowedTags + useInterestsFeed local pendingRef + flush effect` | luna | `src/hooks/useFollowedTags.ts`, `src/hooks/useInterestsFeed.ts`, `src/hooks/__tests__/useFollowedTags.flushOffline.test.ts`, `src/hooks/__tests__/useInterestsFeed.flushOffline.test.ts` | Replicar el patron de `useUserSettings` localmente en cada hook (decision Diego I2 — no centralizar). Cada hook: `pendingRef` propia, flush effect local, sin consumir `flushPendingSettings()` del hook centralizado. 2 tests nuevos. | `git revert` |
| C3 | `feat(#323): gate sendFeedback in FeedbackForm (disabled + Alert)` | luna | `src/components/profile/FeedbackForm.tsx`, `src/components/profile/__tests__/FeedbackForm.offline.test.tsx` | (a) Boton submit `disabled={isSubmitting \|\| !message.trim() \|\| isOffline}`. (b) Si el form abierto y va offline, mostrar `<Alert>` con `MSG_OFFLINE.feedbackOffline`. (c) Test verifica disabled + alert visible. | `git revert` |
| C4 | `feat(#323): gate markFeedbackViewed in MyFeedbackList (silent return)` | luna | `src/components/profile/MyFeedbackList.tsx` | En `handleToggle` (line 63), agregar `if (isOffline) return;` antes del `markFeedbackViewed(fb.id)`. Sin feedback al usuario (fire-and-forget no critico). **No test nuevo** (cobertura del path es trivial). | `git revert` |
| C5 | `feat(#323): gate markAllRecommendationsAsRead in ReceivedRecommendations` | luna | `src/components/social/ReceivedRecommendations.tsx`, `src/components/social/__tests__/ReceivedRecommendations.offline.test.tsx` | En el `useEffect` (lines 52-59), agregar `if (isOffline) return;` antes del `markAllRecommendationsAsRead(userId).catch(...)`. Test verifica que offline no llama el service. | `git revert` |
| C6 | `feat(#323): gate uploadMenuPhoto in MenuPhotoUpload (disabled + Alert)` | luna | `src/components/business/MenuPhotoUpload.tsx`, (test si no existe; sino confirmar) | Boton seleccionar archivo `disabled={isOffline}` + `<Alert>` con `MSG_OFFLINE.uploadPhotoOffline` cuando offline. Test verifica disabled state. | `git revert` |

**Cierre Fase C**: `npm test` verde. Confirmar que `pre-staging-check.sh` Check 6 sigue verde (gates nuevos no introducen violaciones).

---

### Fase D — LOW + indicator (S4 PRD)

**Objetivo**: Gatear admin panels y mover `<OfflineIndicator />` al root del arbol.

**Owner principal**: luna

**Commits**: 3

| Paso | Commit | Owner | Archivo(s) | Cambio | Rollback |
|------|--------|-------|-----------|--------|----------|
| D1 | `feat(#323): gate saveAllSpecials + saveAllAchievements in admin panels` | luna | `src/components/admin/SpecialsPanel.tsx`, `src/components/admin/AchievementsPanel.tsx`, `src/components/admin/__tests__/SpecialsPanel.offline.test.tsx`, `src/components/admin/__tests__/AchievementsPanel.offline.test.tsx` | Boton "Guardar" `disabled={saving \|\| isOffline}` + tooltip `MSG_OFFLINE.requiresConnection`. 2 tests nuevos. | `git revert` |
| D2 | `refactor(#323): hoist OfflineIndicator from TabShell to App.tsx root` | luna | `src/App.tsx`, `src/components/layout/TabShell.tsx` | (a) Quitar `<OfflineIndicator />` de `TabShell.tsx:71`. (b) Agregar `<OfflineIndicator />` en `App.tsx` dentro de `<ConnectivityProvider>` y por encima de `<Routes>`. (c) Verificar que ningun otro arbol tiene un duplicado (preserva la garantia de `role="status"` unico). | `git revert` |
| D3 | `test(#323): OfflineIndicator visible in ListDetailScreen (route ajena a TabShell)` | luna | `src/components/lists/__tests__/ListDetailScreen.indicator.test.tsx` | Render test (SC2.3 PRD): mount `ListDetailScreen` con `isOffline=true` mockeado en `ConnectivityContext` → `OfflineIndicator` chip CloudOff esta presente en el viewport. Sin asercion sobre route — solo presencia del componente. | `git revert` |

**Cierre Fase D**: smoke test manual: `npm run dev:full`, abrir DevTools → throttling Offline. Navegar `BusinessDetailScreen`, `ListDetailScreen`, `MenuPhotoViewer`, `DeleteAccountDialog`. Verificar que el chip CloudOff aparece en cada viewport.

---

### Fase E — Documentacion (OBLIGATORIA)

**Objetivo**: Reflejar el estado post-merge en `patterns.md`, `features.md`, `guards/304-offline.md`. Abrir issue de follow-up para id correlacionable.

**Owner principal**: luna (con review nico para guards/304)

**Commits**: 5

| Paso | Commit | Owner | Archivo(s) | Cambio | Rollback |
|------|--------|-------|-----------|--------|----------|
| E1 | `docs(#323): patterns.md — offline contract S1 + 3 new OfflineActionType` | luna | `docs/reference/patterns.md` | Agregar seccion "Offline contract" en `patterns.md` con: regla S1 PRD (toda mutacion user-facing va por wrapper o gate), 3 nuevos types listados, ejemplo de wrap en caller, ejemplo de gate (boton disabled + tooltip). | `git revert` |
| E2 | `docs(#323): features.md — offline coverage extended` | luna | `docs/reference/features.md` | Actualizar la entry de "Offline" con la nueva cobertura (15 callsites HIGH wrappeados/gated, 6 MEDIUM, 2 admin LOW, indicator en root). | `git revert` |
| E3 | `docs(#323): guards/304-offline.md — new types, list_delete decision, mutators list, sweep legacy` | luna + review nico | `docs/reference/guards/304-offline.md` | (a) Agregar regla 6 "User-facing mutators wrapped/gated" con la lista de ~30 mutadores y el comando `pre-staging-check.sh` paso Check 6. (b) Documentar la decision sobre `list_delete` (S2.1 PRD): tipo + branch defensivo conservados, callers gated, Check 7 veta nuevos wraps. (c) Agregar la limitacion conocida B1 ("edit/delete de comment con `comment_create` pendiente puede fallar tras reconectar"). (d) Agregar lista de archivos cubiertos en este feature. | `git revert` |
| E4 | `chore(#323): _sidebar.md references updated` | luna | `docs/_sidebar.md` | Verificar que `docs/feat/infra/323-offline-services-queue-coverage/{prd,specs,plan}.md` esten linkeados en el sidebar. | `git revert` |
| E5 | `chore(#323): open follow-up issue for correlatable comment id (B1 known limitation)` | luna | (no file edits — `gh issue create`) | Abrir issue follow-up via `gh issue create` titulado "Offline: id correlacionable para edit/delete de comments offline-created" referenciando `docs/reference/guards/304-offline.md` y la limitacion conocida B1. **No bloquea el merge.** Documentar el numero de issue en el PR description de #323. | Cerrar el issue manualmente |

**Cierre Fase E**: `npm test`, `bash scripts/pre-staging-check.sh`, `npm run lint` verdes. Doc lints pasan. PR listo para review.

---

## Total commits

- Fase A: 8 (A1 + A2 + A3 + A4 + A5 + A6 + A6b + A7)
- Fase B: 9 (B1-B9; pre-check operativo previo, sin commit) + opcionales B1a/B6a si LOC > 380
- Fase C: 6 (C1-C6)
- Fase D: 3 (D1-D3)
- Fase E: 5 (E1-E5)

**Total base**: 31 commits.
**Con extracciones de sub-hooks (worst case)**: 33 commits.

---

## Orden de implementacion (dependencias)

```
A1 (types) → A2 (branches) → A3,A4 (tests service) → A5 (messages) → A6 (script + WARN) → A6b (sweep) → A7 (script + FAIL + CI)
                                                                                                              ↓
                                                                                                            (Fase A cerrada — todo lo de fase B necesita los types y los messages)
                                                                                                              ↓
[B pre-check sin commit: wc -l reporting] → B1 (useCommentListBase) → B2 (BusinessComments + CommentsList) → B3 (useBusinessRating)
                                                                                              ↓
                                                                       B4 (CreateListDialog + AddToListDialog create) → B5 (AddToListDialog add/remove)
                                                                                              ↓
                                                                                  B6 (ListDetailScreen) → B7 (FavoritesList) → B8 (existing gates tests) → B9 (SettingsMenu)
                                                                                              ↓
                                                                                  C1 (useUserSettings) → C2 (followed tags + interests) → C3 (FeedbackForm) → C4 (MyFeedback) → C5 (Recommendations) → C6 (MenuPhoto)
                                                                                              ↓
                                                                                            D1 (admin panels) → D2 (hoist OfflineIndicator) → D3 (indicator render test)
                                                                                              ↓
                                                                                            E1 → E2 → E3 → E4 → E5
```

**Reglas de orden**:
- Foundation (A1-A7) DEBE estar mergeada al branch `feat/323` antes de empezar B1. Sin types y messages, los wraps no compilan.
- Dentro de B, los pasos B1-B3 son independientes entre dominios (comments, ratings) — pueden ejecutarse en paralelo si nico/luna trabajan en simultaneo. **Pero los commits van en orden.**
- B4-B6 son secuenciales dentro del dominio lists (B4 toca CreateListDialog, B5 extiende AddToListDialog del mismo archivo, B6 toca ListDetailScreen).
- C1 (useUserSettings) bloquea C2 (followed tags + interests) por convencion del patron.
- D2 (hoist OfflineIndicator) bloquea D3 (test que verifica visibility en ListDetailScreen).
- E1-E5 son independientes pero se ordenan por convencion.

---

## Coordinacion cross-issue

**Issues activos con overlap potencial**:
- **#322** (security: firestore rules type guards + bootstrap admin path) — sin overlap directo de archivos, pero los nuevos types (`comment_edit`, `comment_delete`, `rating_criteria_upsert`) replayan via services que pasan por las rules. **Accion**: si #322 endurece guards de comments/ratings, re-correr los tests de syncEngine (paso A3) tras rebase. Coordinar orden de merge — si #322 mergea primero, no hay impacto. Si #323 mergea primero, #322 debe testear que el replay sigue pasando.
- **#324** (performance: `allBusinesses.find()` x13) — overlap de archivos en `ListDetailScreen.tsx` y hooks de comments. **Accion**: el equipo decide quien mergea primero. Si #324 mergea primero, #323 hace rebase y resuelve conflicts en B6 (ListDetailScreen). Si #323 mergea primero, #324 hace rebase. **Recomendacion**: mergear #323 primero porque es contracto de UX (data loss) vs perf (latencia); #324 absorbe el rebase.

**Comunicacion**: postear comentario en #322 y #324 cuando #323 abra PR para anunciar el orden propuesto.

---

## Test plan integrado

### Cobertura por fase

| Fase | Tests nuevos | Cobertura objetivo |
|------|-------------|-------------------|
| A | 6 (4 en A3 + 2 en A4 + 1 en A5 extension + 1 en A7) | >= 90% del codigo nuevo de syncEngine + script |
| B | 11 tests nuevos (B1-B9 cada uno con 1+ test) | >= 80% del codigo modificado |
| C | 5 tests nuevos (C1-C3 + C5-C6) | >= 80% del codigo modificado |
| D | 3 tests nuevos (D1 x2 + D3) | Render test minimo |
| E | 0 (solo docs) | n/a |

**Total tests nuevos**: ~25 tests.

### Test runs obligatorios

- `npm test` al final de cada fase. Si rojo, no avanzar a la siguiente fase.
- `bash scripts/pre-staging-check.sh` despues de A7 y al cierre de cada fase posterior.
- `npm run lint` y `npm run typecheck` antes de cada commit (pre-commit hook).
- `npm run build` antes de A6 (asegurar baseline) y al cierre de fase E (asegurar produccion).

### Mock strategy (consistente con `feedback_vitest_mock_patterns.md`)

- `useConnectivity` mock con `vi.hoisted()` — todos los tests de UI offline.
- `vi.mock('../services/offlineInterceptor')` para spy `withOfflineSupport`.
- `vi.mock('../services/comments|ratings|sharedLists')` para spy llamadas.
- `useAuth` mock con `user.uid`. `useToast` mock con `vi.fn()`.
- En tests de syncEngine: usar `_resetSyncingForTest` y `_resetForTest` cuando aplique.

---

## Riesgos

### R1 — `useCommentListBase.ts` y `ListDetailScreen.tsx` superan 400 LOC tras los wraps

**Probabilidad**: Baja (medicion en disco al 2026-04-25: `useCommentListBase.ts` = 200 LOC, `ListDetailScreen.tsx` = 289 LOC; OBS Pablo Ciclo 1 #2 corrigio la sobreestimacion previa).
**Impacto**: Bloquea merge por guard #306 R2.
**Mitigacion**: paso B0 mide LOC antes de wrappear (salvaguarda preservada por si el wrap suma mas de lo estimado). Si supera 380, agregar paso B1a (`refactor: extract useCommentMutations from useCommentListBase`) ANTES de B1, o B6a (`refactor: extract useListMutations from ListDetailScreen`) ANTES de B6. Cada extraccion es 1 commit propio que solo extrae logica sin cambiar comportamiento.

### R2 — Sweep legacy del Check 6 destapa muchos falsos positivos

**Probabilidad**: Media.
**Impacto**: Atrasa fase A (paso A6b puede convertirse en multi-dia si hay muchos hits).
**Mitigacion**: el script en modo WARN-only en A6 permite explorar sin bloquear. A6b es tan grande como necesario; A7 (promocion a `fail`) solo se ejecuta cuando A6b cierra. Si A6b destapa una violacion real grande (ej: un componente con 5 mutators sin gate), mover el fix a la fase B correspondiente y mantener el match en whitelist temporal con TODO.

### R3 — Cross-issue conflicts con #322 / #324

**Probabilidad**: Media (#324 tiene overlap real de archivos).
**Impacto**: Rebase manual, posible re-corrida de tests.
**Mitigacion**: comunicar orden de merge antes de abrir PR. Si #324 mergea primero, planificar 1 hora extra para rebase de B6. Tests automatizados de fase A no se ven afectados (services + script no overlap con #322/#324).

### R4 — `flushPendingSettings()` no se extrae como funcion nombrada (O4 Diego)

**Probabilidad**: Baja (paso C1 lo lista explicito).
**Impacto**: `useUserSettings.flush.test.ts` falla, regresion en API estable.
**Mitigacion**: el commit message del paso C1 debe mencionar "extracts flushPendingSettings as named useCallback exposed in hook return". Code review de luna verifica.

### R5 — Limitacion conocida B1 genera UX feedback negativo en produccion

**Probabilidad**: Baja (caso edge: usuario crea comment offline + edit antes de reconectar).
**Impacto**: Toast.error tras reconectar.
**Mitigacion**: documentado como follow-up issue (paso E5). Si el feedback aparece, priorizar el follow-up en sprint siguiente.

---

## Guardrails de modularidad

- [ ] Ningun componente nuevo importa `firebase/firestore` directamente — verificado en cada paso de fase B/C/D (los services siguen intactos).
- [ ] Archivos nuevos en carpeta de dominio correcta — no se crean carpetas nuevas; todos los cambios viven en su carpeta de origen (`hooks/`, `components/X/`, `services/`).
- [ ] Logica de negocio en hooks/services, no en componentes — los wraps son orquestacion en el caller, la logica de queue vive en `withOfflineSupport`/`syncEngine`.
- [ ] Si se toca un archivo con deuda tecnica, se incluye el fix — `useCommentListBase` y `ListDetailScreen` cerca de 400 LOC: B0 mide, B1a/B6a extraen si hace falta.
- [ ] Ningun archivo resultante supera 400 lineas — chequeado en cierre de fase B.

## Guardrails de seguridad

- [ ] Toda coleccion nueva tiene `hasOnly()` + `affectedKeys().hasOnly()` — n/a, no hay colecciones nuevas.
- [ ] Todo campo string tiene `.size()` en rules — n/a, sin rules nuevas.
- [ ] Counter decrements en triggers usan `Math.max(0, ...)` — n/a, sin triggers nuevos.
- [ ] Rate limits en CF triggers — n/a, sin CF nuevos.
- [ ] Toda coleccion nueva escribible tiene CF trigger con rate limit — n/a.
- [ ] No hay secrets, admin emails, ni credenciales en commits — verificado.
- [ ] `getCountFromServer` → `getCountOfflineSafe` siempre — n/a, no se usa.

## Guardrails de observabilidad

- [ ] Todo CF trigger nuevo tiene `trackFunctionTiming` — n/a, sin CF nuevos.
- [ ] Todo service nuevo con queries Firestore tiene `measureAsync` — n/a, sin services nuevos.
- [ ] Todo `trackEvent` nuevo registrado en `GA4_EVENT_NAMES` — n/a, no se agrega `EVT_OFFLINE_GATE_BLOCKED` (decision Sofia Ciclo 1).
- [ ] `logger.error` NUNCA dentro de `if (import.meta.env.DEV)` — verificado en C1 (flush effect logger).

## Guardrails de accesibilidad y UI

- [ ] Todo `<IconButton>` tiene `aria-label` — verificado en B6 (ListDetailScreen toolbar) y B8 (EditorsDialog confirmacion).
- [ ] No hay `<Typography onClick>` — verificado, no se introduce.
- [ ] Touch targets minimo 44x44px — verificado, no se cambian sizes.
- [ ] Componentes con fetch tienen error state con retry — n/a, no hay fetches nuevos.
- [ ] `<img>` con URL dinamica tiene `onError` fallback — `MenuPhotoSection.tsx:83` y `MenuPhotoViewer.tsx:79` ya lo tienen (PRD line 90).
- [ ] httpsCallable en componentes user-facing tienen guard offline — todos los callsites en B8/B9/D1 verificados.

## Guardrails de copy

- [ ] Todos los textos nuevos usan voseo — verificado en `MSG_OFFLINE` paso A5.
- [ ] Tildes correctas — verificado en A5 + extension de `offline.test.ts` que las assert.
- [ ] Terminologia consistente: "comercios" no "negocios" — n/a, no se introduce esa palabra.
- [ ] Strings reutilizables en `src/constants/messages/` — verificado, todo en `MSG_OFFLINE`.

---

## Fase final: Documentacion (OBLIGATORIA)

Cubierta en Fase E (pasos E1-E5). Resumen de archivos tocados:

| Paso | Archivo | Cambio |
|------|---------|--------|
| E1 | `docs/reference/patterns.md` | Seccion "Offline contract" + 3 nuevos types listados |
| E2 | `docs/reference/features.md` | Cobertura offline extendida (HIGH/MEDIUM/LOW + indicator root) |
| E3 | `docs/reference/guards/304-offline.md` | Regla 6 mutadores, decision `list_delete`, limitacion B1, lista archivos cubiertos |
| E4 | `docs/_sidebar.md` | Verificar links a prd/specs/plan de #323 |
| E5 | (gh issue create) | Follow-up issue para id correlacionable |

`docs/reference/firestore.md` — **N/A** (no hay colecciones ni campos nuevos).
`docs/reference/security.md` — **N/A** (no hay rules ni rate limits nuevos).
`docs/reference/project-reference.md` — **se actualiza en /merge** con la version bumped.
`src/components/menu/HelpSection.tsx` — **N/A** (sin cambios visibles al usuario que requieran ayuda).

---

## Criterios de done

- [ ] Todos los 15 callsites HIGH (S2 PRD) wrappeados o gated, con tests.
- [ ] Todos los 6 callsites MEDIUM (S3 PRD) gated, con flush effect en settings hooks.
- [ ] Los 2 callsites LOW (S4 PRD) gated, con tests.
- [ ] `<OfflineIndicator />` montado en `App.tsx` root, removido de `TabShell.tsx`.
- [ ] 3 nuevos `OfflineActionType` definidos en `src/types/offline.ts`, con payloads y branches en syncEngine.
- [ ] 8 nuevas keys en `MSG_OFFLINE`, todas en voseo + tildes correctas.
- [ ] `pre-staging-check.sh` Check 6 (mutadores) en `fail` mode + Check 7 (`list_delete` veto) en `fail` mode + test de regresion del propio script integrado en CI.
- [ ] Sweep legacy de Check 6 cerrado: todo hit es violacion arreglada o whitelist documentada.
- [ ] Tests >= 80% cobertura de codigo nuevo (3 branches syncEngine + nuevos guards en componentes).
- [ ] No regresion en operaciones existentes (re-correr tests de `useCheckIn`, `useFollow`, `useBusinessRating.handleRate`, `FavoriteButton`, etc.).
- [ ] `useCommentListBase.ts` y `ListDetailScreen.tsx` <= 400 LOC. Si superaron, sub-hooks extraidos.
- [ ] Branch defensivo `list_delete` en syncEngine sigue replayando queues pre-#323.
- [ ] Issue follow-up para id correlacionable abierto.
- [ ] Docs actualizados (`patterns.md`, `features.md`, `guards/304-offline.md`).
- [ ] No lint errors, build verde, `pre-staging-check.sh` exit 0.
- [ ] Coordinacion con #322 y #324 documentada en PR description.

---

## Validacion de Plan

**Delivery Lead**: Pablo
**Fecha Ciclo 1**: 2026-04-25 — **NO VALIDADO** (1 BLOQUEANTE + 3 IMPORTANTE + 4 OBSERVACION)
**Fecha Ciclo 2**: 2026-04-25 — **VALIDADO CON OBSERVACIONES**

### Contexto revisado (Ciclo 2)

- PRD: `docs/feat/infra/323-offline-services-queue-coverage/prd.md` (sello Sofia: VALIDADO CON OBSERVACIONES, Ciclo 2)
- Specs: `docs/feat/infra/323-offline-services-queue-coverage/specs.md` (sello Diego: VALIDADO CON OBSERVACIONES, Ciclo 2)
- Plan: este archivo
- Total pasos: 31 commits base / 33 worst-case (con extracciones B1a/B6a si LOC > 380)
- Owners: nico (Fase A), luna (Fases B-E)
- Branch base: `new-home`

### Verificaciones positivas (Ciclo 2)

- **Cobertura specs -> plan**: cada superficie del specs (3 types + 3 payloads + 3 syncEngine branches + 8 MSG_OFFLINE keys + Check 6 + Check 7 + 15 HIGH + 6 MEDIUM + 2 LOW + indicator hoist + 4 doc files + 1 follow-up issue) tiene paso explicito. Nada del "out of scope" aparece como paso.
- **Orden A -> B -> C -> D -> E** correcto. Foundation entrega types + branches + messages + script antes que cualquier wrap.
- **Sweep legacy A6b -> A7 promote-to-fail** atende OBS Diego sobre Check 6.
- **O4 Diego (extraer `flushPendingSettings()` como named useCallback)** recogido en C1.
- **Coordinacion cross-issue #322/#324** documentada con orden propuesto.
- **B6 gate vs wrap de `list_delete`** alineado con Check 7. Tipo y branch defensivo conservados.
- **B1 known limitation** cubierta (tests doc-not-found en A4 + follow-up issue en E5 + doc en E3).
- **Test plan integrado**: cada paso de B/C/D incluye test propio en el mismo commit.
- **File ownership sin overlap intra-fase**: nico mergea 100% Fase A antes de B1; B4/B5 secuenciados sobre `AddToListDialog.tsx`; B6 (`ListDetailScreen.tsx`) un solo owner.
- **Rollback declarado por paso**: cada commit tiene `git revert` o, en A6b, multiple reverts caso por caso.
- **Doc updates** cubiertos en Fase E: `patterns.md`, `features.md`, `guards/304-offline.md`, `_sidebar.md`, follow-up issue. `firestore.md`, `security.md`, `HelpSection.tsx` declarados N/A con justificacion.

### Cerrado en Ciclo 2

- **BLOQUEANTE #1** (ruta `.github/workflows/ci.yml` inexistente) -> **CERRADO**. Verifique workflows en disco: `deploy-staging.yml`, `deploy.yml`, `guards.yml`, `preview.yml` (no existe `ci.yml`). El paso A7 ahora especifica que el step se agrega en `guards.yml` job `guards`, despues de "Run guards (baseline check)" y antes de "Generate full report on failure", con `run: bash scripts/__tests__/pre-staging-check.test.sh`. Step names verificados en `guards.yml:38` y `guards.yml:41`. Documentado que solo se corre el test del propio script en CI, no `pre-staging-check.sh` completo (que depende de `npm run build` y artefactos no presentes en runner).

- **IMPORTANTE #1** (pre-condicion B y R1 referenciaban B3) -> **CERRADO**. Pre-condicion Fase B (linea 106) ahora dice `ListDetailScreen.tsx` con extraccion B6a antes de B6. R1 (linea 275) ahora dice "B6a antes de B6" en vez de "B3a antes de B3".

- **IMPORTANTE #2** (Fase A son 8 commits, no 7) -> **CERRADO**. Encabezado Fase A (linea 83) dice "Commits: 8 (A1 + A2 + A3 + A4 + A5 + A6 + A6b + A7)". Resumen ejecutivo (linea 13) dice "31 commits base / 33 worst-case". Seccion "Total commits" (lineas 187-194) suma 8+9+6+3+5 = 31 base. Coherente.

- **IMPORTANTE #3** (A6(a) "definir" cuando ya existe) -> **CERRADO**. A6(a) ahora dice explicitamente "Modificar la asignacion existente en `pre-staging-check.sh:7` de `REPO_ROOT="$(git rev-parse --show-toplevel)"` a `REPO_ROOT="${REPO_ROOT:-$(git rev-parse --show-toplevel)}"`". Verifique en disco: `scripts/pre-staging-check.sh:7` esta en la forma original, lista para ser modificada. Coherente.

- **OBSERVACION #1** (B0 ambiguo) -> **CERRADO**. B0 retirado de la tabla y convertido en bloque "Pre-condicion (sin commit)" antes de la tabla de Fase B. Conteo de commits Fase B = 9 (B1-B9). Coherente.

- **OBSERVACION #2** (estimaciones LOC ~2x reales) -> **CERRADO**. Tabla de LOC actualizada con valores en disco al 2026-04-25 (verificados con `wc -l`: useCommentListBase=200, ListDetailScreen=289, useUserSettings=106, offline.ts=155, syncEngine=218, pre-staging-check.sh=98). R1 ahora marca probabilidad Baja con justificacion y referencia a la observacion Pablo Ciclo 1. Salvaguarda B1a/B6a preservada por contrato.

- **OBSERVACION #3** (totales inconsistentes) -> **CERRADO**. Resumen ejecutivo, "Total commits", y "Total pasos planeados" todos coinciden en 31 base / 33 worst-case.

- **OBSERVACION #4** (B5 sobre archivo de B4) -> **CERRADO**. Commit message de B5 (linea 116) ahora incluye " — second touch after B4" en el header y body explicito sobre el split intencional por tipo de mutation. El paso de "ownership" tambien lo refuerza en linea 411.

### Observaciones nuevas (Ciclo 2) — no bloqueantes

Tres regresiones menores de prosa quedaron en el plan tras el barrido del specs-plan-writer. Ninguna afecta orden, ownership, ni granularidad de commits — son referencias huerfanas a "B0" y un total desalineado en la seccion de validacion. Las anoto para que la implementacion las absorba sin volver a ciclo:

- **OBS Ciclo 2 #1** (linea 275, R1 mitigacion): aun dice "paso B0 mide LOC antes de wrappear". B0 ya no existe como paso numerado — fue reformulado como "Pre-condicion (sin commit)". El sentido se mantiene (la pre-condicion sigue midiendo), pero la referencia textual es huerfana. Sugerencia para luna al implementar: leer "Pre-condicion (sin commit) de Fase B" donde diga "B0".

- **OBS Ciclo 2 #2** (linea 308, Guardrails de modularidad): dice "B0 mide, B1a/B6a extraen si hace falta". Misma referencia huerfana. Mismo entendimiento operativo.

- **OBS Ciclo 2 #3** (linea 397, "Total pasos planeados: 30 (con 2 opcionales B1a/B6a si LOC > 400)"): inconsistente con resumen ejecutivo y "Total commits" (que dicen 31 base / 33 worst-case con umbral LOC > 380). Sugerencia: el conteo correcto es 31 base / 33 worst-case, umbral 380.

Ninguna de las tres bloquea el delivery: las cifras correctas existen en otras secciones del plan (resumen ejecutivo y Total commits son consistentes), y la operativa de B0 esta bien definida en la pre-condicion textual. Si manu prefiere un ciclo extra para limpiar prosa, es libre de pedirlo, pero a juicio de Pablo no justifica un Ciclo 3.

### Observaciones para la implementacion

- **Cross-issue order**: confirmar con #322 y #324 antes de abrir PR. La nota de coordinacion (linea 230-234) propone que #323 mergea primero porque es contracto de UX (data loss) vs perf; comunicar esa propuesta en comentarios de los issues afectados.
- **Pre-staging-check.sh CI integration**: el step nuevo en `guards.yml` corre solo `bash scripts/__tests__/pre-staging-check.test.sh`. Si en el futuro se quiere correr el script completo en CI, sera otro feature (necesita instalar deps de runtime + npm build).
- **B6a extraccion**: aunque la probabilidad es baja con LOC actuales (289 + ~30-50 LOC de wraps = ~325-345), la pre-condicion de medir antes de wrappear queda como gate operativo. Si pasa de 380 al medir, hacer B6a antes de B6.
- **Sweep A6b**: planificar como sesion dedicada. Si destapa muchos hits (>10), nico tiene autorizacion para fragmentar A6b en multiples commits siguiendo el patron `chore(#323): sweep legacy mutators in <area>`.
- **Pre-push hook (~90s en Pi)**: cada commit que toque codigo dispara `tsc + vite build`. Para sesiones largas con multiples commits seguidos, prever ~90s extra por commit.

### Veredicto Pablo — Ciclo 1

**Estado**: NO VALIDADO (1 BLOQUEANTE + 3 IMPORTANTE + 4 OBSERVACION)

### Veredicto Pablo — Ciclo 2

**Estado**: VALIDADO CON OBSERVACIONES

Todos los hallazgos del Ciclo 1 (1 bloqueante + 3 importantes + 4 observaciones) quedan cerrados con verificacion en disco. Las 3 observaciones nuevas del Ciclo 2 son regresiones menores de prosa que no afectan orden de commits, ownership, granularidad, test plan ni rollback — solo dejan referencias textuales huerfanas a "B0" y un conteo desalineado en una seccion. La implementacion puede proceder sin volver a Ciclo 3.

### Listo para pasar a implementacion?

**Si, con observaciones**. Las observaciones de Ciclo 2 (referencias huerfanas a "B0" y total desalineado en linea 397) deben absorberse durante la implementacion: leer "Pre-condicion sin commit" donde el plan diga "B0", y usar 31 base / 33 worst-case como referencia de conteo (no 30/32). El plan esta listo para que manu lo dispatch a nico (Fase A) y luna (Fases B-E).

— Pablo, 2026-04-25 (Ciclo 1: NO VALIDADO; Ciclo 2: VALIDADO CON OBSERVACIONES)
