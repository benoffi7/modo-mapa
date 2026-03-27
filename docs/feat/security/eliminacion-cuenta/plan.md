# Plan: Eliminacion de cuenta de usuario

**Specs:** [specs.md](specs.md)
**Fecha:** 2026-03-27

---

## Fases de implementacion

### Fase 1: Registry y cache helpers

**Branch:** `feat/delete-account`

| Paso | Archivo | Cambio |
|---|---|---|
| 1 | `src/config/collections.ts` | Add `UserOwnedCollection` interface and `USER_OWNED_COLLECTIONS` array after the existing `COLLECTIONS` const |
| 2 | `src/services/queryCache.ts` | Add `invalidateAllQueryCache()` function that calls `queryCache.clear()` |
| 3 | `src/hooks/useBusinessDataCache.ts` | Add `clearAllBusinessCache()` function that calls `cache.clear()` |
| 4 | `src/constants/analyticsEvents.ts` | Add `export const EVT_ACCOUNT_DELETED = 'account_deleted'` |
| 5 | `src/config/collections.test.ts` | Create validation test: scan `src/services/*.ts` for `where('userId'` etc., verify each collection+field pair exists in `USER_OWNED_COLLECTIONS`. Also validate array structure (no duplicates, valid types, required fields per type) |

### Fase 2: Cloud Function

| Paso | Archivo | Cambio |
|---|---|---|
| 1 | `functions/src/config/userOwnedCollections.ts` | Create file with duplicated `UserOwnedCollection` interface and `USER_OWNED_COLLECTIONS` array (same values as `src/config/collections.ts`) |
| 2 | `functions/src/callable/deleteUserAccount.ts` | Create callable: validate auth + email token, rate limit check, iterate `USER_OWNED_COLLECTIONS` with strategy per type (doc-by-uid, query, query+biField, subcollection), handle `hasStorage`/`subcollections`/`cascade`, Storage prefix cleanup (`feedback-media/{uid}/`, `menu-photos/{uid}/`), `admin.auth().deleteUser(uid)`, log with hashed uid |
| 3 | `functions/src/index.ts` | Add `export { deleteUserAccount } from './callable/deleteUserAccount'` |
| 4 | `functions/src/callable/deleteUserAccount.test.ts` | Create test file: mock Admin SDK (Firestore, Auth, Storage), test unauthenticated rejection, anonymous rejection, rate limit, all collection type strategies, Storage cleanup, auth deletion, idempotency, `user-not-found` graceful handling |
| 5 | `functions/src/callable/deleteUserAccount.parity.test.ts` | Create parity test: read both `src/config/collections.ts` and `functions/src/config/userOwnedCollections.ts`, compare arrays field by field, fail if mismatch |

### Fase 3: Service function

| Paso | Archivo | Cambio |
|---|---|---|
| 1 | `src/services/emailAuth.ts` | Add `deleteAccount(currentUser, password)` function: re-auth with `reauthenticateWithCredential`, dynamic import `firebase/functions`, call `httpsCallable(functions, 'deleteUserAccount')`, clear localStorage keys (`STORAGE_KEY_VISITS` and all user-related `STORAGE_KEY_*`), call `invalidateAllQueryCache()`, call `clearAllBusinessCache()`, call `firebaseSignOut(auth)` |
| 2 | `src/services/emailAuth.test.ts` | Extend: add 6-8 test cases for `deleteAccount()` -- mock `httpsCallable` via dynamic import, mock cache invalidation, test re-auth success/failure, callable invocation, cache cleanup, signOut, error propagation |

### Fase 4: UI components

| Paso | Archivo | Cambio |
|---|---|---|
| 1 | `src/components/auth/DeleteAccountDialog.tsx` | Create component: Dialog with warning text, `PasswordField` for current password, "Eliminar cuenta permanentemente" button (error color, disabled until password entered), CircularProgress during loading, Alert for errors, Alert for success with auto-close after 1.5s, `useAuth()` for user/clearAuthError, `useToast()` for confirmation, `useConnectivity()` for offline guard, calls `deleteAccount()` from services. Pattern: follow `ChangePasswordDialog` structure |
| 2 | `src/components/auth/DeleteAccountDialog.test.tsx` | Create test file: mock `useAuth`, `useToast`, `useConnectivity`, `deleteAccount`. Test: renders warning + password field, submit disabled when empty, submit calls deleteAccount, loading state, error display, success flow with toast, cancel closes, offline disables submit |
| 3 | `src/components/menu/SettingsPanel.tsx` | Add `deleteDialogOpen` state. Add lazy import for `DeleteAccountDialog`. In `authMethod === 'email'` section, add "Eliminar cuenta" `Button` with `color="error"`, `variant="text"`, `startIcon={<DeleteOutlineIcon />}` below the existing buttons `Box`. Add `Suspense` + `DeleteAccountDialog` block after the `ChangePasswordDialog` block |

---

## Orden de implementacion

1. `src/config/collections.ts` -- registry (no dependencies)
2. `src/services/queryCache.ts` -- `invalidateAllQueryCache` helper (no dependencies)
3. `src/hooks/useBusinessDataCache.ts` -- `clearAllBusinessCache` helper (no dependencies)
4. `src/constants/analyticsEvents.ts` -- new event constant (no dependencies)
5. `src/config/collections.test.ts` -- registry validation test (depends on 1)
6. `functions/src/config/userOwnedCollections.ts` -- duplicated registry (depends on 1 for values)
7. `functions/src/callable/deleteUserAccount.ts` -- Cloud Function (depends on 6)
8. `functions/src/index.ts` -- export (depends on 7)
9. `functions/src/callable/deleteUserAccount.test.ts` -- callable test (depends on 7)
10. `functions/src/callable/deleteUserAccount.parity.test.ts` -- parity test (depends on 1, 6)
11. `src/services/emailAuth.ts` -- `deleteAccount` service function (depends on 2, 3, 4)
12. `src/services/emailAuth.test.ts` -- service test extension (depends on 11)
13. `src/components/auth/DeleteAccountDialog.tsx` -- dialog component (depends on 11)
14. `src/components/auth/DeleteAccountDialog.test.tsx` -- dialog test (depends on 13)
15. `src/components/menu/SettingsPanel.tsx` -- button + lazy dialog integration (depends on 13)

---

## Riesgos

1. **Partial deletion on Cloud Function timeout.** The callable iterates many collections sequentially. If the function times out (default 60s for v2 callables), some data may be left behind. **Mitigation:** The function is idempotent -- the user can retry, and queries on already-deleted collections return empty results. Consider increasing timeout to 120s via `timeoutSeconds` option on the `onCall` config.

2. **Registry parity drift.** The `USER_OWNED_COLLECTIONS` array is duplicated between `src/` and `functions/`. A developer could update one and forget the other. **Mitigation:** The parity test in `functions/` fails CI if the arrays diverge. The registry validation test in `src/` catches new user-owned collections added to services without registry entries.

3. **Storage files not deleted.** If a feedback doc has a `mediaUrl` pointing to a full HTTPS URL rather than a storage path, the prefix-based deletion may miss it. **Mitigation:** The callable uses both prefix deletion (`feedback-media/{uid}/`) and explicit path extraction from docs. Menu photos use `menu-photos/{userId}/` prefix which covers all files for that user.

---

## Criterios de done

- [ ] All items from PRD scope implemented
- [ ] Tests pass with >= 80% coverage on new code
- [ ] No lint errors
- [ ] Build succeeds (both `src/` and `functions/`)
- [ ] Registry validation test passes (no unregistered user-owned collections)
- [ ] Parity test passes (functions/ registry matches src/ registry)
- [ ] Manual test: delete an email account in emulators, verify all collections are clean
- [ ] Manual test: retry deletion after partial failure completes without errors
- [ ] Privacy policy reviewed (no new data collection, but deletion capability should be documented)
