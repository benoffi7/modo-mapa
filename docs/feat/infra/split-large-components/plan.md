# Plan: Split large components

**Specs:** [specs.md](specs.md)
**Fecha:** 2026-03-27

---

## Fases de implementacion

### Fase 1: Hooks compartidos

**Branch:** `refactor/split-large-components`

Crear los hooks reutilizables que no dependen de componentes especificos.

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `src/hooks/useOptimisticLikes.ts` | Crear hook. Interface `UseOptimisticLikesParams` con `userCommentLikes: Set<string>`. State: single `Map<string, {toggled: boolean; delta: number}>`. Exportar `isLiked(id)`, `getLikeCount(comment)`, `handleToggleLike(id, toggleAction)`. El `handleToggleLike` aplica optimistic update, llama `toggleAction`, revierte Map entry on catch. |
| 2 | `src/hooks/useOptimisticLikes.test.ts` | Tests: toggle state flip, delta +1/-1, double toggle same id, isLiked falls back to userCommentLikes, getLikeCount floors at 0, revert on error deletes entry from Map, unknown commentId returns server state. |
| 3 | `src/hooks/useCommentSort.ts` | Crear hook generico. Params: `items: T[]`, `isPendingDelete: (id: string) => boolean`, `getId: (item: T) => string`. State: `sortMode`. Memo: filter pending deletes, sort by mode. Export `sortMode`, `setSortMode`, `sortedItems`. |
| 4 | `src/hooks/useCommentSort.test.ts` | Tests: sort recent (default), sort oldest, sort useful (by likeCount), filters pending deletes, empty array, single item. |
| 5 | `src/hooks/useCommentEdit.ts` | Crear hook. Params: `onSave: (id, text) => Promise<void>`, `onComplete?: () => void`. State: `editingId`, `editText`, `isSavingEdit`. Export `startEdit(comment)`, `saveEdit()`, `cancelEdit()`, `setEditText`. `saveEdit` guards empty text, calls onSave, resets state, calls onComplete. |
| 6 | `src/hooks/useCommentEdit.test.ts` | Tests: startEdit sets id+text, cancelEdit resets, saveEdit calls onSave with trimmed text, saveEdit guards empty, isSavingEdit flag transitions, onComplete called after save, onSave error keeps state. |
| 7 | `src/hooks/useCommentThreads.ts` | Crear hook. Params: `comments: Comment[]`. Memo: group top-level vs replies by parentId, sort replies chronologically. State: `expandedThreads: Set<string>`, `replyingTo`, `replyText`. Export: `topLevelComments`, `repliesByParent`, `toggleThread`, `startReply` (auto-expands + setTimeout focus), `cancelReply`, `replyInputRef`. |
| 8 | `src/hooks/useCommentThreads.test.ts` | Tests: groups correctly, replies sorted by createdAt, toggleThread add/remove, startReply sets replyingTo + expands thread, cancelReply resets. |
| 9 | `src/hooks/useVerificationCooldown.ts` | Crear hook. No params. State: `cooldown: number`. Effect: if cooldown > 0, setInterval decrement every 1s, cleanup on unmount and when cooldown reaches 0. Export `cooldown`, `startCooldown(seconds)`, `isActive`. |
| 10 | `src/hooks/useVerificationCooldown.test.ts` | Tests: initial cooldown is 0, startCooldown sets value, countdown decrements, reaches 0 and stops, cleanup on unmount clears interval, re-trigger resets timer. Use `vi.useFakeTimers()`. |

### Fase 2: Hooks co-localizados

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `src/components/business/useQuestionThreads.ts` | Crear hook. Params: `comments`, `isPendingDelete`. Memos: separate questions (type=question, no parentId) from answers (has parentId), filter answers by question IDs, sort answers by likeCount desc, sort questions by date desc. State: `expandedQuestions`, `replyingTo`, `replyText`. Export: `questions`, `filteredAnswersByQuestion`, `visibleQuestions`, `expandedQuestions`, `toggleQuestion` (with trackEvent), `getAnswerCount`, reply state. |
| 2 | `src/components/business/useQuestionThreads.test.ts` | Tests: separates questions from answers, filters answers to question parents only, sorts answers by likeCount desc, sorts questions by date desc, toggleQuestion fires trackEvent, getAnswerCount uses replyCount fallback, isPendingDelete filters visibleQuestions. Mock `trackEvent`. |
| 3 | `src/components/menu/useCommentsListFilters.ts` | Crear hook. Params: `comments` array con `{id, comment, business}`. State: `sortMode`, `searchInput`, `filterBusiness`. Uses `useDeferredValue(searchInput)`. Three chained memos: sort -> search filter -> business filter. Derives `businessOptions`, `isFiltered`, `showControls`. |
| 4 | `src/components/menu/useVirtualizedList.ts` | Crear hook. Params: `itemCount`, `hasMore`, `isLoadingMore`, `searchActive`, `loadMore`. Const `VIRTUALIZE_THRESHOLD = 20`. `shouldVirtualize = itemCount >= threshold`. Ref: `scrollContainerRef`. Setup `useVirtualizer` with estimateSize 72, overscan 5. Effect: auto-loadMore when last virtual item near end. |

### Fase 3: Subcomponentes UI

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `src/components/business/QuestionInput.tsx` | Crear componente. `memo` wrapper. Internal `text` state. TextField con placeholder "Hace una pregunta...", `MAX_QUESTION_LENGTH`, helperText con character count, rounded input. IconButton con `SendIcon`. Alert cuando `userCommentsToday >= MAX_COMMENTS_PER_DAY`. Enter key submit. |
| 2 | `src/components/business/QuestionInput.test.tsx` | Tests: renders input, submit calls onSubmit with trimmed text, clears after submit, Enter key submits, Shift+Enter does not submit, shows Alert at daily limit, max length enforced, disabled when submitting or empty. |
| 3 | `src/components/menu/SettingRow.tsx` | Extraer `SettingRow` de `SettingsPanel.tsx`. Mover interface `SettingRowProps` y el componente `SettingRow` (~30 lineas) a archivo propio. Export default. |
| 4 | `src/components/menu/AccountSection.tsx` | Crear componente. Recibe `authMethod`, `emailVerified`, `userEmail`, `onSignOut`, `onResendVerification`, `onRefreshVerified`. Usa `useVerificationCooldown` internamente. Contiene 6 estados: `emailDialogOpen`, `emailDialogTab`, `logoutDialogOpen`, `changePasswordOpen`, `deleteAccountOpen`, `verificationSent`, `verificationLoading`. Lazy-loads los 3 dialogs. Renderiza anonymous CTA o email section con verification + buttons. |
| 5 | `src/components/menu/AccountSection.test.tsx` | Tests: renders anonymous CTA when authMethod=anonymous, renders email when authMethod=email, shows verification chip, resend button triggers cooldown, logout dialog opens/closes, change password button only for email auth. Mock lazy dialogs. |
| 6 | `src/components/menu/NotificationsSection.tsx` | Crear componente. Recibe `settings` y `onUpdateSetting`. Renderiza master toggle + 7 granular toggles con disabled cascading via `SettingRow`. |

### Fase 4: Refactorizar componentes padres

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `src/components/business/BusinessComments.tsx` | Reemplazar state+logic inline con imports de `useCommentSort`, `useOptimisticLikes`, `useCommentThreads`, `useCommentEdit`. Eliminar: sortMode state (linea 52), editingId/editText/isSavingEdit state (lineas 55-57), optimistic Maps (lineas 74-75), reply state (lineas 81-84), grouping memo (lineas 96-116), sortedTopLevel memo (lineas 125-135), isLiked/getLikeCount callbacks (lineas 138-147), handleStartEdit/handleCancelEdit/handleSaveEdit (lineas 175-199), handleToggleLike (lineas 205-249), reply handlers (lineas 252-299), handleEditTextChange (lineas 305-307). Mantener: handleSubmitText, handleDelete, renderCommentRow, dirty detection effect, JSX. El `handleToggleLike` del hook recibe un callback que wrappea `withOfflineSupport`. Target: ~200 lineas. |
| 2 | `src/components/business/BusinessQuestions.tsx` | Reemplazar state+logic inline con imports de `useOptimisticLikes`, `useQuestionThreads`, `QuestionInput`. Eliminar: optimisticLikes state (linea 75), questions/answersByQuestion memo (lineas 78-102), questionIds/filteredAnswersByQuestion memos (lineas 105-114), isLiked/getLikeCount (lineas 122-131), handleToggleLike (lineas 156-191), reply state (lineas 51-54), reply handlers (lineas 197-231, 233-244), noopEdit/noopEditText (lineas 251-252), getAnswerCount (lineas 254-257), visibleQuestions (lineas 259-262). Reemplazar inline question input (lineas 274-314) con `<QuestionInput>`. Target: ~180 lineas. |
| 3 | `src/components/menu/SettingsPanel.tsx` | Extraer `SettingRow` a import de `./SettingRow`. Reemplazar bloque Cuenta (lineas 128-221) con `<AccountSection authMethod={authMethod} emailVerified={emailVerified} userEmail={user?.email ?? null} onSignOut={signOut} onResendVerification={resendVerification} onRefreshVerified={refreshEmailVerified} />`. Reemplazar bloque Notificaciones (lineas 253-311) con `<NotificationsSection settings={settings} onUpdateSetting={updateSetting} />`. Eliminar: emailDialog/logout/changePassword/deleteAccount state (lineas 72-80), cooldown effect (lineas 82-91), handleLogout/handleResendVerification/handleRefreshVerified (lineas 93-113), lazy imports de dialogs (lineas 22-24), dialog JSX (lineas 340-384). Target: ~150 lineas. |
| 4 | `src/components/menu/CommentsList.tsx` | Reemplazar filter/sort/search state (lineas 60-73) y memos (lineas 124-172) con import de `useCommentsListFilters`. Reemplazar virtualizer setup (lineas 215-233) con import de `useVirtualizedList`. Eliminar: `VIRTUALIZE_THRESHOLD` const (linea 26), `SortMode` type (linea 28), `sortMode`/`searchInput`/`filterBusiness` state, `sortedComments`/`searchedComments`/`filteredComments`/`businessOptions`/`stats` memos, `shouldVirtualize`/`scrollContainerRef`/`virtualizer` setup, auto-loadMore effect. Target: ~200 lineas. |

### Fase 5: Verificacion

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | (terminal) | `npm run test:run` — verificar que todos los tests existentes pasan sin modificaciones. |
| 2 | (terminal) | `npm run test:coverage` — verificar >= 80% coverage global y en archivos nuevos. |
| 3 | (terminal) | `npm run lint` — verificar cero errores de lint. |
| 4 | (terminal) | `npm run build` — verificar build exitoso. |
| 5 | (terminal) | `wc -l` en los 4 componentes refactorizados para confirmar: BusinessComments <250, BusinessQuestions <250, SettingsPanel <200, CommentsList <250. |

---

## Orden de implementacion

1. `src/hooks/useOptimisticLikes.ts` + test (sin dependencias)
2. `src/hooks/useCommentSort.ts` + test (sin dependencias)
3. `src/hooks/useCommentEdit.ts` + test (sin dependencias)
4. `src/hooks/useCommentThreads.ts` + test (depende de `Comment` type)
5. `src/hooks/useVerificationCooldown.ts` + test (sin dependencias)
6. `src/components/business/useQuestionThreads.ts` + test (depende de `Comment` type, `trackEvent`)
7. `src/components/menu/useCommentsListFilters.ts` (depende de `Comment`, `Business` types)
8. `src/components/menu/useVirtualizedList.ts` (depende de `@tanstack/react-virtual`)
9. `src/components/business/QuestionInput.tsx` + test (depende de constants)
10. `src/components/menu/SettingRow.tsx` (extraido de SettingsPanel, sin deps nuevas)
11. `src/components/menu/AccountSection.tsx` + test (depende de `useVerificationCooldown`, auth types)
12. `src/components/menu/NotificationsSection.tsx` (depende de `SettingRow`, settings types)
13. `src/components/business/BusinessComments.tsx` (refactorizar, depende de pasos 1-4)
14. `src/components/business/BusinessQuestions.tsx` (refactorizar, depende de pasos 1, 6, 9)
15. `src/components/menu/SettingsPanel.tsx` (refactorizar, depende de pasos 10-12)
16. `src/components/menu/CommentsList.tsx` (refactorizar, depende de pasos 7-8)
17. Verificacion final (tests, coverage, lint, build, line counts)

---

## Riesgos

1. **Regresion en comportamiento de likes optimisticos.** La unificacion de dos implementaciones diferentes (dos Maps vs una Map con objeto) podria introducir bugs sutiles en el timing de revert. **Mitigacion:** Tests unitarios exhaustivos del hook incluyendo double toggle y error revert. Verificacion manual en emuladores.

2. **Refs y focus en reply forms.** Los hooks `useCommentThreads` y `useQuestionThreads` mueven `replyInputRef` y `setTimeout(() => ref.current?.focus(), 100)` fuera del componente. Si el ref no se pasado correctamente, el auto-focus se pierde silenciosamente. **Mitigacion:** El hook exporta `replyInputRef` y el componente padre lo pasa a `InlineReplyForm` igual que antes.

3. **SettingsPanel props drilling en AccountSection.** Los 3 lazy-loaded dialogs y el logout dialog se mueven a `AccountSection`, pero los dialogs dependen de `useAuth()` directamente. Si `AccountSection` recibe props en vez de usar el context, cualquier cambio en la API de auth requiere actualizar las props. **Mitigacion:** `AccountSection` recibe las props minimas necesarias para rendering; los dialogs internos pueden usar `useAuth()` directamente ya que estan dentro del provider tree.

---

## Criterios de done

- [ ] Ningun archivo `.tsx`/`.ts` en `src/components/` supera 400 lineas
- [ ] BusinessComments y BusinessQuestions < 250 lineas cada uno
- [ ] SettingsPanel < 200 lineas
- [ ] `useOptimisticLikes` compartido entre BusinessComments y BusinessQuestions
- [ ] Todos los tests existentes pasan sin modificaciones
- [ ] Tests nuevos con >= 80% coverage en codigo nuevo
- [ ] `npm run lint` sin errores
- [ ] `npm run build` exitoso
- [ ] No se cambia la API publica de ningun componente (mismas props)
