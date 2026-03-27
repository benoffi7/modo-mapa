# Specs: Eliminacion de cuenta de usuario

**PRD:** [prd.md](prd.md)
**Fecha:** 2026-03-27

---

## Modelo de datos

### Nuevos tipos (`shared/userOwnedCollections.ts`)

Archivo compartido entre frontend y functions via path aliases. Vive en `shared/` en la raiz del proyecto, sin dependencias externas.

```typescript
export interface UserOwnedCollection {
  collection: string;
  type: 'doc-by-uid' | 'query' | 'subcollection';
  field?: string;
  biField?: string;
  path?: string;
  hasStorage?: boolean;
  subcollections?: string[];
  cascade?: string[];
}

export const USER_OWNED_COLLECTIONS: UserOwnedCollection[] = [
  { collection: 'userSettings', type: 'doc-by-uid' },
  { collection: 'users', type: 'doc-by-uid' },
  { collection: 'ratings', type: 'query', field: 'userId' },
  { collection: 'comments', type: 'query', field: 'userId' },
  { collection: 'commentLikes', type: 'query', field: 'userId' },
  { collection: 'favorites', type: 'query', field: 'userId' },
  { collection: 'userTags', type: 'query', field: 'userId' },
  { collection: 'customTags', type: 'query', field: 'userId' },
  { collection: 'priceLevels', type: 'query', field: 'userId' },
  { collection: 'feedback', type: 'query', field: 'userId', hasStorage: true },
  { collection: 'menuPhotos', type: 'query', field: 'userId', hasStorage: true, subcollections: ['reports'] },
  { collection: 'notifications', type: 'query', field: 'userId' },
  { collection: 'sharedLists', type: 'query', field: 'ownerId', cascade: ['listItems'] },
  { collection: 'listItems', type: 'query', field: 'addedBy' },
  { collection: 'follows', type: 'query', field: 'followerId', biField: 'followedId' },
  { collection: 'recommendations', type: 'query', field: 'fromUserId', biField: 'toUserId' },
  { collection: 'checkins', type: 'query', field: 'userId' },
  { collection: 'activityFeed', type: 'subcollection', path: 'activityFeed/{uid}/items' },
  { collection: '_rateLimits', type: 'query', field: 'userId' },
];
```

### Path aliases para compartir `shared/`

**Frontend (`tsconfig.app.json`):**
```json
"paths": { "@shared/*": ["../shared/*"] }
```

**Frontend (`vite.config.ts`):**
```ts
resolve: {
  alias: {
    '@shared': path.resolve(__dirname, 'shared'),
  }
}
```

**Functions (`functions/tsconfig.json`):**
```json
"baseUrl": ".",
"paths": { "@shared/*": ["../shared/*"] },
"include": ["src", "../shared"]
```
- Agregar `tsc-alias` como devDependency para resolver paths en el JS emitido
- Ajustar build script: `"build": "tsc && tsc-alias"`

Ambos lados importan con `import { USER_OWNED_COLLECTIONS } from '@shared/userOwnedCollections'`.

No new Firestore collections are created. No indexes needed (the callable uses Admin SDK which bypasses rules and indexes).

---

## Firestore Rules

No changes required. The `deleteUserAccount` callable uses the Admin SDK, which bypasses all Firestore security rules. Client-side code only calls `httpsCallable` and `signOut` -- neither requires new rules.

### Rules impact analysis

| Query (service file) | Collection | Auth context | Rule that allows it | Change needed? |
|---|---|---|---|---|
| `httpsCallable('deleteUserAccount')` | N/A (callable) | Authenticated email user | Admin SDK (bypasses rules) | No |
| `reauthenticateWithCredential` | N/A (Auth API) | Current user | Firebase Auth API | No |
| `signOut` post-deletion | N/A (Auth API) | Current user | Firebase Auth API | No |

No queries read or write Firestore from the client for this feature. All data deletion happens server-side via Admin SDK.

---

## Cloud Functions

### `deleteUserAccount` (callable)

**File:** `functions/src/callable/deleteUserAccount.ts`
**Export in:** `functions/src/index.ts`

```typescript
// Callable config
onCall({ enforceAppCheck: ENFORCE_APP_CHECK }, async (request) => { ... })
```

**Logic:**

1. Validate `request.auth` exists and `request.auth.token.email` is truthy (reject anonymous users)
2. Rate limit: check `_rateLimits` collection with key `delete_{uid}`, limit 1 per minute
3. Iterate `USER_OWNED_COLLECTIONS` (imported from `@shared/userOwnedCollections`):
   - `doc-by-uid`: delete `db.doc(collection/uid)`
   - `query`: `db.collection(c).where(field, '==', uid)` then batch delete (500 per batch, same pattern as `fanOut.ts`)
   - `query` + `biField`: two queries (one per field), combined results, batch delete
   - `subcollection`: `db.collection(path.replace('{uid}', uid))`, batch delete all docs
   - `hasStorage`: before deleting docs, extract storage paths (`storagePath`, `thumbnailPath` from menuPhotos; `mediaUrl` from feedback) for later cleanup
   - `subcollections`: for each matching doc, delete all docs in each named subcollection before deleting the parent doc
   - `cascade`: for each `sharedList` doc found, query `listItems` where `listId == deletedListId` and batch delete
4. Delete Storage files:
   - `feedback-media/{uid}/` prefix (using `bucket.deleteFiles({ prefix })`)
   - Individual menu photo paths collected in step 3
5. Call `admin.auth().deleteUser(uid)`
6. Log deletion: `logger.info('account_deleted', { uidHash: sha256(uid).slice(0,12), timestamp })` (no PII)

**Rate limit:** Uses `_rateLimits` collection with doc ID `delete_{uid}`. 1 invocation per minute. Same pattern as existing `rateLimiter.ts` but simpler -- just check/set a timestamp doc.

**Error handling:** If the function fails mid-execution, it is safe to re-run. All queries use `where()` which return empty results for already-deleted docs. `admin.auth().deleteUser()` on an already-deleted user throws `auth/user-not-found` which the function catches and ignores.

**Dependencies:**

- `firebase-admin/firestore` (Firestore Admin SDK)
- `firebase-admin/auth` (Auth Admin SDK)
- `firebase-admin/storage` (Storage Admin SDK)
- `functions/src/helpers/env.ts` (`ENFORCE_APP_CHECK`, `getDb`)
- `crypto` (for sha256 hash of uid in logs)

---

## Componentes

### `DeleteAccountDialog`

**File:** `src/components/auth/DeleteAccountDialog.tsx`
**Export:** default (lazy-loaded)
**Props:**

```typescript
interface DeleteAccountDialogProps {
  open: boolean;
  onClose: () => void;
}
```

**Where it renders:** Lazy-loaded inside `SettingsPanel`, same pattern as `ChangePasswordDialog`.

**Key behaviors:**

- Warning text explaining permanent deletion of all data
- `PasswordField` for re-authentication (reuses existing `src/components/auth/PasswordField.tsx`)
- Submit button "Eliminar cuenta permanentemente" with `color="error"`, `variant="contained"`, disabled until password is entered
- Cancel button, disabled during loading
- `CircularProgress` spinner on submit button during operation (same pattern as `ChangePasswordDialog`)
- Error display via `Alert` component (wrong password, network error, callable error)
- On success: shows success `Alert`, then closes after 1.5s delay (same as `ChangePasswordDialog`)
- Uses `useAuth()` for `user` and `clearAuthError`
- Uses `useToast()` for post-deletion confirmation toast
- Uses `useConnectivity()` to disable submit when offline
- Calls `deleteAccount()` from `services/emailAuth.ts`
- Cleanup: `closeTimerRef` cleared on unmount (same pattern as `ChangePasswordDialog`)

### `SettingsPanel` modifications

**File:** `src/components/menu/SettingsPanel.tsx`
**Changes:**

- Add `deleteDialogOpen` state (boolean)
- Add lazy import for `DeleteAccountDialog`
- Add "Eliminar cuenta" button below "Cerrar sesion" in the `authMethod === 'email'` branch, with `color="error"`, `variant="text"`, `startIcon={<DeleteOutlineIcon />}`
- Add `Suspense` wrapper with `DeleteAccountDialog` (same pattern as `ChangePasswordDialog`)

---

## Hooks

No new hooks are created. The feature uses existing hooks:

- `useAuth()` from `AuthContext` -- for `user`, `authMethod`, `signOut`, `authError`, `clearAuthError`
- `useToast()` from `ToastContext` -- for success confirmation
- `useConnectivity()` from `ConnectivityContext` -- for offline guard

---

## Servicios

### `deleteAccount()` (new function in `src/services/emailAuth.ts`)

```typescript
export async function deleteAccount(
  currentUser: User,
  password: string,
): Promise<void>
```

**Logic:**

1. Re-authenticate: `reauthenticateWithCredential(currentUser, EmailAuthProvider.credential(currentUser.email!, password))`
2. Call callable: dynamic import `firebase/functions`, then `httpsCallable(functions, 'deleteUserAccount')` and invoke it (same dynamic import pattern as `sharedLists.ts`)
3. Clean up localStorage: remove `STORAGE_KEY_VISITS` and all `STORAGE_KEY_*` constants that contain user data
4. Invalidate caches: call `invalidateAllQueryCache()` (new export from `queryCache.ts`) and `clearAllBusinessCache()` (new export from `useBusinessDataCache.ts`)
5. Call `signOut()` from Firebase Auth -- triggers `onAuthStateChanged` which auto-creates new anonymous account

### `invalidateAllQueryCache()` (new function in `src/services/queryCache.ts`)

```typescript
export function invalidateAllQueryCache(): void {
  queryCache.clear();
}
```

Simple helper to clear the entire module-level `Map`.

### `clearAllBusinessCache()` (new function in `src/hooks/useBusinessDataCache.ts`)

```typescript
export function clearAllBusinessCache(): void {
  cache.clear();
}
```

Simple helper to clear the entire module-level `Map`.

---

## Integracion

### `src/components/menu/SettingsPanel.tsx`

- Import `lazy` `DeleteAccountDialog` (already imports `lazy`, `Suspense`)
- Import `DeleteOutlineIcon` from MUI icons
- Add `const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)` alongside existing dialog states
- In the `authMethod === 'email'` section, after the "Cerrar sesion" button `</Box>`, add a "Eliminar cuenta" `Button` with `onClick={() => setDeleteDialogOpen(true)}`
- Add `Suspense` + `DeleteAccountDialog` block after the existing `ChangePasswordDialog` block

### `src/services/emailAuth.ts`

- Add import for `invalidateAllQueryCache` from `./queryCache`
- Add import for `clearAllBusinessCache` from `../hooks/useBusinessDataCache`
- Add dynamic import pattern for `firebase/functions` (same as `sharedLists.ts`)
- Add `deleteAccount()` function
- Import additional `STORAGE_KEY_*` constants from `../constants/storage` for cleanup

### `src/services/queryCache.ts`

- Add `invalidateAllQueryCache()` export

### `src/hooks/useBusinessDataCache.ts`

- Add `clearAllBusinessCache()` export

### `src/constants/analyticsEvents.ts`

- Add `EVT_ACCOUNT_DELETED = 'account_deleted'`

### `functions/src/index.ts`

- Add `export { deleteUserAccount } from './callable/deleteUserAccount'`

### `shared/userOwnedCollections.ts` (nuevo)

- Crear carpeta `shared/` en raiz del proyecto
- Contiene `UserOwnedCollection` interface y `USER_OWNED_COLLECTIONS` array
- Sin dependencias externas (pure types + data)

### `tsconfig.app.json`

- Agregar `"paths": { "@shared/*": ["../shared/*"] }`

### `vite.config.ts`

- Agregar alias `@shared` en `resolve.alias`

### `functions/tsconfig.json`

- Agregar `"baseUrl": "."`, `"paths": { "@shared/*": ["../shared/*"] }`
- Agregar `"../shared"` a `include`

### `functions/package.json`

- Agregar `tsc-alias` como devDependency
- Ajustar build script: `"build": "tsc && tsc-alias"`

---

## Tests

| Archivo test | Que testear | Tipo |
|---|---|---|
| `shared/userOwnedCollections.test.ts` | Registry validation: grep `src/services/*.ts` for `where('userId'`, `where('ownerId'`, etc. and verify each collection+field pair exists in `USER_OWNED_COLLECTIONS`. Also validates array structure (no duplicates, valid types). | Validacion |
| `src/services/emailAuth.test.ts` | Extend existing test file: `deleteAccount()` -- re-auth success/failure, callable invocation, cache cleanup calls, signOut call, error propagation (wrong password, network error, callable error) | Service |
| `src/components/auth/DeleteAccountDialog.test.tsx` | Render with password field, submit disabled when empty, submit flow with loading state, error display on wrong password, error display on callable failure, cancel closes dialog, success flow with toast, offline state disables submit | Component |
| `functions/src/callable/deleteUserAccount.test.ts` | Unauthenticated rejection, anonymous user rejection, rate limit enforcement, iteration over all collection types (doc-by-uid, query, query+biField, subcollection), Storage cleanup, auth deletion, idempotency (re-run after partial deletion), `user-not-found` graceful handling | Callable |

### Test details

**`shared/userOwnedCollections.test.ts`** -- Registry validation test:

- Uses `fs.readFileSync` + regex to scan `src/services/*.ts` for patterns like `where('userId'`, `where('ownerId'`, `where('followerId'`, `where('followedId'`, `where('fromUserId'`, `where('toUserId'`, `where('addedBy'`
- For each match, extracts the collection name from the surrounding `collection(COLLECTIONS.X)` or string literal
- Verifies that each discovered collection+field pair has a corresponding entry in `USER_OWNED_COLLECTIONS`
- Also verifies all entries have valid `type` values and required fields per type

**`src/services/emailAuth.test.ts`** -- Extension (6-8 new test cases):

- Mock `httpsCallable` (dynamic import pattern, same as `sharedLists.test.ts`)
- Mock `invalidateAllQueryCache` and `clearAllBusinessCache`
- Test: successful deletion calls re-auth, callable, cache cleanup, signOut in order
- Test: wrong password throws and does not call callable
- Test: callable error throws and does not call signOut
- Test: network error propagation

**`src/components/auth/DeleteAccountDialog.test.tsx`** (10-12 test cases):

- Mock `useAuth` (same pattern as `ChangePasswordDialog.test.tsx`)
- Mock `useToast`
- Mock `useConnectivity`
- Mock `deleteAccount` from services
- Test: renders warning text and password field
- Test: submit button disabled when password empty
- Test: submit calls `deleteAccount` with correct args
- Test: loading state shows spinner, disables buttons
- Test: error display on rejection
- Test: success shows alert, calls toast, closes after delay
- Test: cancel calls onClose
- Test: submit disabled when offline

**`functions/src/callable/deleteUserAccount.test.ts`** (12-15 test cases):

- Mock `firebase-admin/firestore`, `firebase-admin/auth`, `firebase-admin/storage`
- Mock `getDb` helper
- Test: rejects unauthenticated requests
- Test: rejects anonymous users (no email in token)
- Test: rate limit blocks rapid requests
- Test: deletes doc-by-uid collections
- Test: deletes query-based collections with batch writes
- Test: handles biField (two queries combined)
- Test: deletes subcollections before parent docs
- Test: handles cascade (deletes listItems for each sharedList)
- Test: extracts and deletes Storage files
- Test: calls `admin.auth().deleteUser(uid)`
- Test: idempotent -- re-run with empty collections succeeds
- Test: handles `auth/user-not-found` gracefully

### Mock strategy

- Firestore: mock Admin SDK (`getFirestore`, `collection`, `where`, `get`, `batch`, `commit`, `doc`, `delete`)
- Auth: mock `reauthenticateWithCredential` (client), `admin.auth().deleteUser` (server)
- Storage: mock `bucket.deleteFiles`, `bucket.file().delete()`
- Functions: mock `httpsCallable` via dynamic import mock
- Caches: mock `invalidateAllQueryCache`, `clearAllBusinessCache`
- Analytics: mock `trackEvent`
- Connectivity: mock `useConnectivity`

---

## Analytics

| Evento | Donde | Parametros |
|---|---|---|
| `EVT_ACCOUNT_DELETED` (`account_deleted`) | `AuthContext.deleteAccount` callback (after callable success, before signOut) | `{ method: 'email' }` |

Add to `src/constants/analyticsEvents.ts`:

```typescript
export const EVT_ACCOUNT_DELETED = 'account_deleted';
```

---

## Offline

### Cache strategy

| Dato | Estrategia | TTL | Storage |
|---|---|---|---|
| N/A | La feature no lee datos de Firestore desde el cliente | N/A | N/A |

### Writes offline

| Operacion | Mecanismo | Conflict resolution |
|---|---|---|
| Re-autenticacion | Requiere conexion (Firebase Auth API) | Error en dialog: "Necesitas conexion a internet" |
| deleteUserAccount callable | Requiere conexion (HTTPS callable) | Error en dialog: error de red |
| signOut post-eliminacion | Funciona offline (local state) | N/A |

### Fallback UI

- `DeleteAccountDialog` uses `useConnectivity()` to check `isOffline`
- When offline: submit button is disabled, helper text shows "Necesitas conexion a internet para eliminar tu cuenta"
- When online: normal flow

---

## Decisiones tecnicas

### Shared registry via `shared/` folder + path aliases

El array `USER_OWNED_COLLECTIONS` vive en `shared/userOwnedCollections.ts` en la raiz del proyecto. Ambos lados (frontend Vite y Cloud Functions CommonJS) lo importan via el alias `@shared/*`.

- **Frontend:** Vite resuelve el alias en build time (zero runtime cost)
- **Functions:** `tsc-alias` resuelve los paths en el JS emitido post-compilacion

**Alternativa descartada:** Duplicar el array en ambos lados con test de paridad. Rechazada porque agrega riesgo de drift y un test extra innecesario.

### Re-auth in service layer, not in dialog

The `deleteAccount()` service function handles re-authentication internally (same pattern as `changePassword()`). The dialog only passes the password string. This keeps the dialog free of Firebase Auth imports and makes testing simpler.

### Storage cleanup via prefix + individual paths

Feedback media uses a `feedback-media/{uid}/` prefix which can be deleted with a single `bucket.deleteFiles({ prefix })` call. Menu photos are scattered under `menu-photos/{userId}/` -- the callable reads `storagePath` and `thumbnailPath` from each `menuPhotos` doc before deleting it, then deletes each file individually. This approach is necessary because the storage path includes a timestamp, not just the uid prefix.

**Correction:** Menu photos are actually stored under `menu-photos/{userId}/`, so we can use prefix deletion for those too. The callable will use `bucket.deleteFiles({ prefix: 'menu-photos/{uid}/' })` as the primary strategy, with individual path deletion as a fallback for any paths that do not match the prefix pattern.

### Rate limit with simple timestamp doc

Instead of using the full `checkRateLimit` utility (which counts docs in a window), the callable uses a simpler approach: a single doc `_rateLimits/delete_{uid}` with a `lastAttempt` timestamp. If `lastAttempt` is less than 60 seconds ago, reject. This is lighter weight for a single-attempt operation.
