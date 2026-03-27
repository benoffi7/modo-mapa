# Plan: Eliminacion de cuenta de usuario

**Specs:** [specs.md](specs.md)
**Fecha:** 2026-03-27

---

## Fases de implementacion

### Fase 1: Shared registry, path aliases y cache helpers

**Branch:** `feat/delete-account`

| Paso | Archivo | Cambio |
|---|---|---|
| 1 | `shared/userOwnedCollections.ts` | Crear carpeta `shared/` en raiz. Crear archivo con `UserOwnedCollection` interface y `USER_OWNED_COLLECTIONS` array (pure types + data, zero dependencies) |
| 2 | `tsconfig.app.json` | Agregar `"paths": { "@shared/*": ["../shared/*"] }` |
| 3 | `vite.config.ts` | Agregar alias `@shared` en `resolve.alias`: `'@shared': path.resolve(__dirname, 'shared')` |
| 4 | `functions/tsconfig.json` | Agregar `"baseUrl": "."`, `"paths": { "@shared/*": ["../shared/*"] }`, `"../shared"` en `include` |
| 5 | `functions/package.json` | Agregar `tsc-alias` como devDependency. Ajustar build script: `"build": "tsc && tsc-alias"` |
| 6 | `src/services/queryCache.ts` | Agregar `invalidateAllQueryCache()` function que llama `queryCache.clear()` |
| 7 | `src/hooks/useBusinessDataCache.ts` | Agregar `clearAllBusinessCache()` function que llama `cache.clear()` |
| 8 | `src/constants/analyticsEvents.ts` | Agregar `export const EVT_ACCOUNT_DELETED = 'account_deleted'` |
| 9 | `shared/userOwnedCollections.test.ts` | Crear test de validacion: scan `src/services/*.ts` buscando `where('userId'` etc., verificar que cada par coleccion+campo existe en `USER_OWNED_COLLECTIONS`. Validar estructura del array (sin duplicados, tipos validos, campos requeridos por tipo) |

### Fase 2: Cloud Function

| Paso | Archivo | Cambio |
|---|---|---|
| 1 | `functions/src/callable/deleteUserAccount.ts` | Crear callable: validar auth + email token, rate limit check, iterar `USER_OWNED_COLLECTIONS` (importado de `@shared/userOwnedCollections`) con estrategia por tipo (doc-by-uid, query, query+biField, subcollection), manejar `hasStorage`/`subcollections`/`cascade`, Storage prefix cleanup (`feedback-media/{uid}/`, `menu-photos/{uid}/`), `admin.auth().deleteUser(uid)`, log con uid hasheado |
| 2 | `functions/src/index.ts` | Agregar `export { deleteUserAccount } from './callable/deleteUserAccount'` |
| 3 | `functions/src/callable/deleteUserAccount.test.ts` | Crear test: mock Admin SDK (Firestore, Auth, Storage), test rechazo no autenticado, rechazo anonimo, rate limit, todas las estrategias por tipo de coleccion, Storage cleanup, auth deletion, idempotencia, manejo graceful de `user-not-found` |

### Fase 3: Service function

| Paso | Archivo | Cambio |
|---|---|---|
| 1 | `src/services/emailAuth.ts` | Agregar `deleteAccount(currentUser, password)`: re-auth con `reauthenticateWithCredential`, dynamic import `firebase/functions`, llamar `httpsCallable(functions, 'deleteUserAccount')`, limpiar localStorage keys (`STORAGE_KEY_VISITS` y todos los `STORAGE_KEY_*` de usuario), llamar `invalidateAllQueryCache()`, llamar `clearAllBusinessCache()`, llamar `firebaseSignOut(auth)` |
| 2 | `src/services/emailAuth.test.ts` | Extender: agregar 6-8 test cases para `deleteAccount()` -- mock `httpsCallable` via dynamic import, mock cache invalidation, test re-auth success/failure, callable invocation, cache cleanup, signOut, error propagation |

### Fase 4: UI components

| Paso | Archivo | Cambio |
|---|---|---|
| 1 | `src/components/auth/DeleteAccountDialog.tsx` | Crear componente: Dialog con texto de advertencia, `PasswordField` para contrasena actual, boton "Eliminar cuenta permanentemente" (error color, disabled hasta ingresar contrasena), CircularProgress durante loading, Alert para errores, Alert para exito con auto-close a 1.5s, `useAuth()` para user/clearAuthError, `useToast()` para confirmacion, `useConnectivity()` para guard offline. Patron: seguir estructura de `ChangePasswordDialog` |
| 2 | `src/components/auth/DeleteAccountDialog.test.tsx` | Crear test: mock `useAuth`, `useToast`, `useConnectivity`, `deleteAccount`. Test: renders warning + password field, submit disabled when empty, submit calls deleteAccount, loading state, error display, success flow with toast, cancel closes, offline disables submit |
| 3 | `src/components/menu/SettingsPanel.tsx` | Agregar `deleteDialogOpen` state. Agregar lazy import para `DeleteAccountDialog`. En seccion `authMethod === 'email'`, agregar boton "Eliminar cuenta" con `color="error"`, `variant="text"`, `startIcon={<DeleteOutlineIcon />}` debajo del `Box` de botones existente. Agregar `Suspense` + `DeleteAccountDialog` block despues del block de `ChangePasswordDialog` |

---

## Orden de implementacion

1. `shared/userOwnedCollections.ts` -- registry (no dependencies)
2. `tsconfig.app.json` -- path alias frontend (depends on 1)
3. `vite.config.ts` -- resolve alias frontend (depends on 1)
4. `functions/tsconfig.json` -- path alias functions (depends on 1)
5. `functions/package.json` -- `tsc-alias` devDep + build script (depends on 4)
6. `src/services/queryCache.ts` -- `invalidateAllQueryCache` helper (no dependencies)
7. `src/hooks/useBusinessDataCache.ts` -- `clearAllBusinessCache` helper (no dependencies)
8. `src/constants/analyticsEvents.ts` -- new event constant (no dependencies)
9. `shared/userOwnedCollections.test.ts` -- registry validation test (depends on 1)
10. `functions/src/callable/deleteUserAccount.ts` -- Cloud Function (depends on 1, 4, 5)
11. `functions/src/index.ts` -- export (depends on 10)
12. `functions/src/callable/deleteUserAccount.test.ts` -- callable test (depends on 10)
13. `src/services/emailAuth.ts` -- `deleteAccount` service function (depends on 6, 7, 8)
14. `src/services/emailAuth.test.ts` -- service test extension (depends on 13)
15. `src/components/auth/DeleteAccountDialog.tsx` -- dialog component (depends on 13)
16. `src/components/auth/DeleteAccountDialog.test.tsx` -- dialog test (depends on 15)
17. `src/components/menu/SettingsPanel.tsx` -- button + lazy dialog integration (depends on 15)

---

## Riesgos

1. **Partial deletion on Cloud Function timeout.** El callable itera muchas colecciones secuencialmente. Si la funcion tiene timeout (default 60s para v2 callables), algunos datos pueden quedar. **Mitigacion:** La funcion es idempotente -- el usuario puede reintentar, y queries sobre colecciones ya eliminadas retornan resultados vacios. Considerar aumentar timeout a 120s via `timeoutSeconds` en config de `onCall`.

2. **Path alias en functions runtime.** `tsc` no resuelve path aliases en el JS emitido. **Mitigacion:** `tsc-alias` como post-build step reescribe los imports. Si falla, el deploy de functions rompe (detectable en CI). Alternativa de fallback: copiar `shared/` a `functions/src/shared/` en prebuild.

3. **Storage files not deleted.** Si un doc de feedback tiene `mediaUrl` apuntando a URL HTTPS completa en vez de storage path, la eliminacion por prefijo puede no encontrarlo. **Mitigacion:** El callable usa eliminacion por prefijo (`feedback-media/{uid}/`, `menu-photos/{uid}/`) como estrategia principal, mas extraccion explicita de paths de los docs como fallback.

---

## Criterios de done

- [ ] All items from PRD scope implemented
- [ ] Tests pass with >= 80% coverage on new code
- [ ] No lint errors
- [ ] Build succeeds (both `src/` and `functions/`)
- [ ] `@shared` alias resuelve correctamente en ambos lados (frontend build + functions build)
- [ ] Registry validation test passes (no unregistered user-owned collections)
- [ ] Manual test: delete an email account in emulators, verify all collections are clean
- [ ] Manual test: retry deletion after partial failure completes without errors
- [ ] Privacy policy reviewed (deletion capability should be documented)
