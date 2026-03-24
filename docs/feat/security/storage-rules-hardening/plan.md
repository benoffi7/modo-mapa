# Plan: Security — Storage Rules, App Check, User Enumeration

**Specs:** [specs.md](specs.md)
**Issue:** #176
**Fecha:** 2026-03-24

---

## Fase 1: Storage rules + feedback path (P0)

### 1.1 Feedback media path change

1. Editar `src/services/feedback.ts` — cambiar storagePath a incluir userId
2. Editar `storage.rules` — cambiar match path de feedback-media a `{userId}/{feedbackId}/{fileName}` con ownership check
3. Verificar si Cloud Functions referencian feedback-media paths (cleanup, admin read)
4. Actualizar test de feedback.ts si existe

### 1.2 Storage rules cleanup

1. Remover `allow delete: if request.auth != null` de feedback-media (ahora con ownership)
2. Agregar comentarios explicativos a storage.rules

**Commit:** `fix: storage rules ownership for feedback media (#176)`

---

## Fase 2: App Check enforcement (P0)

1. Agregar `ENFORCE_APP_CHECK_ADMIN` a `functions/src/helpers/env.ts`
2. Cambiar admin callables a usar `ENFORCE_APP_CHECK_ADMIN`:
   - `admin/menuPhotos.ts` (approve, reject, delete — NOT report)
   - `admin/claims.ts`
   - `admin/backups.ts`
   - `admin/feedback.ts`
3. Mantener user-facing callables con `ENFORCE_APP_CHECK`
4. Actualizar test de env.ts si existe

**Commit:** `fix: enable App Check for admin callables (#176)`

---

## Fase 3: User enumeration + transaction fix (P1)

### 3.1 User enumeration

1. Editar `functions/src/callable/inviteListEditor.ts` — mensaje generico en catch
2. Actualizar/agregar test

### 3.2 reportMenuPhoto transaction

1. Editar `functions/src/admin/menuPhotos.ts` — wrappear en `db.runTransaction`
2. Actualizar test si existe

**Commit:** `fix: prevent user enumeration and add report transaction (#176)`

---

## Fase 4: Firestore rules hardening (P1)

### 4.1 listItems read restriction

1. Agregar `canReadListItem()` function en firestore.rules
2. Cambiar `allow read` de listItems a usar la nueva funcion
3. Verificar queries frontend que lean listItems — todas deben filtrar por `listId`

### 4.2 businessId regex

1. Cambiar `^biz_[0-9]{3}$` a `^biz_[0-9]{1,6}$` en isValidBusinessId
2. Cambiar la misma regex inline en la regla de feedback create

**Commit:** `fix: firestore rules privacy and businessId scalability (#176)`

---

## Fase 5: Fixes menores + docs (P2)

### 5.1 Admin email env var

1. Editar `AdminGuard.tsx` — usar env vars
2. Agregar vars a `.env.example`
3. Agregar vars a `.env` del worktree

### 5.2 functions/.env warning

1. Agregar comentario warning al inicio de `functions/.env`

### 5.3 Documentacion

1. Actualizar `docs/reference/security.md` — nota sobre userSettings tradeoff, actualizar storage rules section, actualizar App Check section
2. Actualizar tabla de reglas por coleccion

**Commit:** `fix: admin email env var and docs update (#176)`

---

## Fase 6: Tests

1. Correr tests existentes: `npx vitest run --dir src` y `cd functions && npm run test:run`
2. Agregar/actualizar tests para:
   - inviteListEditor: error generico
   - reportMenuPhoto: transaction behavior
   - feedback.ts: nuevo path
3. Correr lint y build
4. Verificar que todo pasa

**Commit:** `test: add tests for security hardening (#176)`

---

## Verificacion final

1. `npm run lint` — 0 errors
2. `npx vitest run --dir src` — all pass
3. `cd functions && npm run test:run` — all pass
4. `npx vite build` — success
5. Review manual de storage.rules y firestore.rules
