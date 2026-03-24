# Specs: Security — Storage Rules, App Check, User Enumeration

**PRD:** [prd.md](prd.md)
**Issue:** #176
**Fecha:** 2026-03-24

---

## S1: Storage Rules — Ownership enforcement

### S1a: Menu photos path restructure

**Problema:** `menus/{businessId}/{fileName}` no incluye userId. Cualquier usuario puede crear archivos en el mismo path.

**Solucion:** No cambiar el path. El path actual `menus/{businessId}/{docRef.id}_original` ya usa el ID del documento Firestore (`menuPhotos/{docId}`) como nombre de archivo, lo cual es unico por diseño. El riesgo real de sobreescritura es bajo porque el fileName incluye el docId.

Sin embargo, agregar validacion de que el usuario solo puede crear archivos cuyo nombre empiece con un prefix predecible no es viable en Storage rules (no hay acceso a Firestore desde storage rules).

**Decision:** Mantener path actual. El doc ID ya previene colisiones. El riesgo original era teorico — un atacante necesitaria adivinar el docId autogenerado de otro usuario.

### S1b: Feedback media ownership

**Problema:** `feedback-media/{feedbackId}/{fileName}` permite `delete: if request.auth != null` — cualquier usuario autenticado puede borrar media de feedback de otros.

**Solucion:** Cambiar el path a `feedback-media/{userId}/{feedbackId}/{fileName}` para poder validar ownership en rules.

**Archivos a modificar:**

1. **`storage.rules`** — Cambiar match path y agregar ownership check:
   ```
   match /feedback-media/{userId}/{feedbackId}/{fileName} {
     allow read: if request.auth != null;
     allow create: if request.auth != null
       && request.auth.uid == userId
       && request.resource.size < 10 * 1024 * 1024
       && request.resource.contentType.matches('image/(jpeg|png|webp)');
     allow delete: if request.auth != null
       && request.auth.uid == userId;
   }
   ```

2. **`src/services/feedback.ts`** — Cambiar el path de upload:
   ```typescript
   // Antes:
   const storagePath = `feedback-media/${docRef.id}/${mediaFile.name}`;
   // Despues:
   const storagePath = `feedback-media/${userId}/${docRef.id}/${mediaFile.name}`;
   ```

3. **Cloud Functions** — Verificar si alguna function referencia el path viejo de feedback-media para delete/read. Buscar en triggers y admin functions.

**Migracion:** No necesaria. Los archivos existentes en el path viejo quedaran huerfanos pero no son accesibles desde la app (la app usa la URL de download, no el path). Las rules viejas dejaran de matchear el path viejo al cambiar el match pattern, lo cual efectivamente los hace inaccesibles excepto via admin SDK. Limpiar con un script manual despues si se quiere.

### S1c: Feedback mediaUrl validation en Firestore rules

**Problema:** `firestore.rules:173-174` permite al owner actualizar `mediaUrl` a cualquier valor.

**Solucion:** No agregar validacion de patron en rules. La razon: el campo `mediaUrl` se setea en `feedback.ts` despues del upload exitoso usando `getDownloadURL()` que devuelve una URL de Firebase Storage con token. Validar un patron especifico en rules es fragil (la URL incluye tokens que cambian). El campo solo es actualizable por el owner de su propio feedback, y se muestra solo al admin.

**Decision:** Aceptar el riesgo actual. Es bajo: un usuario solo puede manipular su propia media URL, y el admin que la ve deberia tratar cualquier URL externa como potencialmente maliciosa de todas formas.

---

## S2: App Check — Enforcement condicional

**Problema:** `ENFORCE_APP_CHECK = false` hardcoded en `functions/src/helpers/env.ts:19`.

**Contexto:** El comentario explica que staging y produccion comparten el mismo deployment de Cloud Functions. Staging no tiene reCAPTCHA key.

**Solucion:** Enforcement parcial por funcion, no global.

**Archivos a modificar:**

1. **`functions/src/helpers/env.ts`** — Agregar constante para admin-only enforcement:
   ```typescript
   // App Check para funciones user-facing: disabled (staging sin reCAPTCHA)
   export const ENFORCE_APP_CHECK = false;
   // App Check para funciones admin-only: enabled (admin siempre usa prod)
   export const ENFORCE_APP_CHECK_ADMIN = !IS_EMULATOR;
   ```

2. **Callable admin functions** — Cambiar a `ENFORCE_APP_CHECK_ADMIN`:
   - `functions/src/admin/menuPhotos.ts` — approveMenuPhoto, rejectMenuPhoto, deleteMenuPhoto, reportMenuPhoto
   - `functions/src/admin/claims.ts` — setAdminClaim, bootstrapAdmin
   - `functions/src/admin/backups.ts` — createBackup, restoreBackup
   - `functions/src/admin/feedback.ts` — respondToFeedback, resolveFeedback, createGithubIssueFromFeedback
   - `functions/src/admin/perfMetrics.ts` — writePerfMetrics (este es user-facing, mantener ENFORCE_APP_CHECK)

3. **User-facing callables** — Mantener `ENFORCE_APP_CHECK` (false por ahora):
   - `inviteListEditor.ts`
   - `reportMenuPhoto` (este es user-facing, mover a ENFORCE_APP_CHECK)

**Nota:** `reportMenuPhoto` es user-facing (cualquier usuario puede reportar), no admin. Mantener con `ENFORCE_APP_CHECK`. Las funciones admin (`approve`, `reject`, `delete`) si son admin-only.

---

## S3: User enumeration fix

**Problema:** `inviteListEditor.ts:36` expone `'Usuario no encontrado con ese email'`.

**Solucion:**

**Archivo:** `functions/src/callable/inviteListEditor.ts`

```typescript
// Antes:
} catch {
  throw new HttpsError('not-found', 'Usuario no encontrado con ese email');
}

// Despues:
} catch {
  throw new HttpsError('not-found', 'No se pudo enviar la invitacion. Verifica el email e intenta de nuevo.');
}
```

El mensaje generico no revela si el email existe o no. Tambien cubre el caso de error de red/timeout al llamar a `getUserByEmail`.

---

## S4: Firestore Rules — Privacy hardening

### S4a: userSettings read restriction

**Problema:** `firestore.rules:284` permite `allow read: if request.auth != null` — cualquier usuario lee locality de otros.

**Contexto critico:** `useProfileVisibility.ts` lee `userSettings` de otros usuarios para obtener `profilePublic`. Si restringimos read a owner-only, este hook se rompe.

**Solucion:** Firestore no soporta field-level read restrictions. Las opciones son:

1. ~~Coleccion separada `publicProfiles`~~ — Over-engineering, agrega sync complexity
2. ~~Cloud Function proxy~~ — Agrega latencia y costo
3. **Aceptar el tradeoff actual con documentacion** — Los datos en userSettings (locality, notification prefs) son de bajo riesgo. El `profilePublic` flag necesita ser legible por otros usuarios para que el feature funcione.

**Decision:** Mantener la regla actual. Documentar la decision en `security.md` como riesgo aceptado. La razon: los datos expuestos (localidad del usuario, notification preferences) no son sensibles per se, y el costo de la solucion (coleccion extra o Cloud Function) no justifica el beneficio.

**Archivo:** `docs/reference/security.md` — Agregar nota en la tabla de reglas de userSettings:
```
| `userSettings` | auth (nota: expone locality a otros usuarios; riesgo aceptado para soportar profilePublic check) | owner | owner | - |
```

### S4b: listItems read restriction

**Problema:** `firestore.rules:365` permite `allow read: if request.auth != null` — items de listas privadas son visibles.

**Contexto:** Los listItems tienen `listId` que referencia el parent `sharedLists` doc. Las reglas de create/delete ya hacen `get()` al parent para validar ownership/editor.

**Solucion:** Agregar `get()` call en la regla de read para validar que el usuario es owner, editor, o la lista es publica/featured.

**Archivo:** `firestore.rules`

```
match /listItems/{docId} {
  function canReadListItem() {
    let list = get(/databases/$(database)/documents/sharedLists/$(resource.data.listId));
    return list != null
      && (list.data.ownerId == request.auth.uid
          || request.auth.uid in list.data.get('editorIds', [])
          || list.data.isPublic == true
          || list.data.get('featured', false) == true);
  }

  allow read: if request.auth != null && canReadListItem();
```

**Impacto en performance:** Cada read de listItem ahora hace un `get()` extra a sharedLists. Esto impacta queries que traen multiples items. Sin embargo:
- `get()` results son cacheados por Firestore rules engine dentro de la misma request
- Las queries de listItems siempre filtran por `listId`, asi que el `get()` al parent se hace una vez por batch
- El costo adicional es ~1 read por query (no por item)

**Frontend impact:** Verificar que las queries de listItems siempre incluyan `where('listId', '==', ...)`. Si hay algun query sin filtro de listId, el `resource.data.listId` en la regla podria fallar.

---

## S5: Fixes menores

### S5a: reportMenuPhoto transaction

**Archivo:** `functions/src/admin/menuPhotos.ts:170-177`

Wrappear el check de reportSnap + set + increment en una transaction:

```typescript
await db.runTransaction(async (tx) => {
  const reportSnap = await tx.get(reportRef);
  if (reportSnap.exists) {
    throw new HttpsError('already-exists', 'Ya reportaste esta foto');
  }
  tx.set(reportRef, { createdAt: FieldValue.serverTimestamp() });
  tx.update(photoRef, { reportCount: FieldValue.increment(1) });
});
```

### S5b: businessId regex

**Archivo:** `firestore.rules:13`

```
// Antes:
return bizId is string && bizId.matches('^biz_[0-9]{3}$');
// Despues:
return bizId is string && bizId.matches('^biz_[0-9]{1,6}$');
```

Tambien actualizar la misma regex en la regla de feedback (`firestore.rules:162`):
```
&& request.resource.data.businessId.matches('^biz_[0-9]{1,6}$')
```

### S5c: Admin email a env var

**Archivo:** `src/components/admin/AdminGuard.tsx:10-11`

```typescript
// Antes:
const ADMIN_EMAIL = 'benoffi11@gmail.com';
const DEV_PASSWORD = 'dev123456';
// Despues:
const ADMIN_EMAIL = import.meta.env.VITE_ADMIN_EMAIL ?? '';
const DEV_PASSWORD = import.meta.env.VITE_DEV_PASSWORD ?? 'dev123456';
```

Agregar a `.env.example`:
```
VITE_ADMIN_EMAIL=
VITE_DEV_PASSWORD=
```

Agregar a `.env` (no committed):
```
VITE_ADMIN_EMAIL=benoffi11@gmail.com
VITE_DEV_PASSWORD=dev123456
```

### S5d: functions/.env warning

**Archivo:** `functions/.env` — Agregar comentario al inicio:

```
# WARNING: This file IS committed to git (un-ignored in .gitignore).
# Do NOT add secrets, tokens, or API keys here.
# Use Firebase environment config or Secret Manager for sensitive values.
```

---

## Tests

### Archivos a testear

| Archivo | Tipo | Que testear |
|---------|------|-------------|
| `functions/src/callable/inviteListEditor.ts` | Unit (existente?) | Error generico cuando email no existe |
| `functions/src/admin/menuPhotos.ts` | Unit | Transaction en reportMenuPhoto |
| `src/services/feedback.ts` | Unit | Nuevo path con userId |

### Tests de Firestore/Storage rules

No hay test suite de rules en el proyecto actualmente (las rules se validan manualmente o via emuladores). Agregar tests de rules esta fuera de scope de este issue — es un esfuerzo separado.

### Criterios de testing

- Tests unitarios para los cambios en Cloud Functions
- Verificar path de upload en feedback.ts
- Cobertura >= 80% del codigo modificado
