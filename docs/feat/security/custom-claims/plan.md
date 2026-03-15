# Technical Plan: Admin Custom Claims

## Fase 1: Cloud Functions (backend)

### DT-1: Helper centralizado `assertAdmin`

**Crear** `functions/src/helpers/assertAdmin.ts`

```typescript
import { HttpsError } from 'firebase-functions/v2/https';

const IS_EMULATOR = process.env.FUNCTIONS_EMULATOR === 'true';

interface AuthToken {
  admin?: boolean;
  email?: string;
  email_verified?: boolean;
}

export function assertAdmin(
  auth: { uid: string; token: AuthToken } | undefined,
): void {
  if (IS_EMULATOR) return;
  if (!auth) {
    throw new HttpsError('unauthenticated', 'Must be signed in');
  }
  if (auth.token.admin !== true) {
    throw new HttpsError('permission-denied', 'Admin only');
  }
}
```

**Validacion**: `cd functions && npm run build` compila sin errores.

---

### DT-2: Cloud Functions `setAdminClaim` y `removeAdminClaim`

**Crear** `functions/src/admin/claims.ts`

```typescript
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions/v2';
import { defineString } from 'firebase-functions/params';
import { getAuth } from 'firebase-admin/auth';

const IS_EMULATOR = process.env.FUNCTIONS_EMULATOR === 'true';

const ADMIN_EMAIL_PARAM = defineString('ADMIN_EMAIL', {
  description: 'Email of the bootstrap admin (used only for initial setup)',
});

export const setAdminClaim = onCall<{ targetUid: string }, Promise<{ success: true }>>(
  { enforceAppCheck: !IS_EMULATOR },
  async (request) => {
    const { targetUid } = request.data ?? {};
    if (!targetUid || typeof targetUid !== 'string') {
      throw new HttpsError('invalid-argument', 'targetUid required');
    }

    // Authorization: emulator bypass, existing admin, or bootstrap via email
    if (!IS_EMULATOR) {
      const isExistingAdmin = request.auth?.token.admin === true;
      const isBootstrap =
        request.auth?.token.email_verified === true &&
        request.auth?.token.email === ADMIN_EMAIL_PARAM.value();

      if (!isExistingAdmin && !isBootstrap) {
        throw new HttpsError('permission-denied', 'Not authorized to set admin claims');
      }
    }

    await getAuth().setCustomUserClaims(targetUid, { admin: true });
    logger.info('Admin claim set', {
      targetUid,
      setBy: request.auth?.uid ?? 'emulator',
    });

    return { success: true as const };
  },
);

export const removeAdminClaim = onCall<{ targetUid: string }, Promise<{ success: true }>>(
  { enforceAppCheck: !IS_EMULATOR },
  async (request) => {
    const { targetUid } = request.data ?? {};
    if (!targetUid || typeof targetUid !== 'string') {
      throw new HttpsError('invalid-argument', 'targetUid required');
    }

    if (!IS_EMULATOR && request.auth?.token.admin !== true) {
      throw new HttpsError('permission-denied', 'Admin only');
    }

    if (request.auth?.uid === targetUid) {
      throw new HttpsError('failed-precondition', 'Cannot remove your own admin claim');
    }

    await getAuth().setCustomUserClaims(targetUid, { admin: false });
    logger.info('Admin claim removed', {
      targetUid,
      removedBy: request.auth?.uid ?? 'emulator',
    });

    return { success: true as const };
  },
);
```

**Editar** `functions/src/index.ts` — agregar exports:

```typescript
export { setAdminClaim, removeAdminClaim } from './admin/claims';
```

**Validacion**: `cd functions && npm run build` compila sin errores.

---

### DT-3: Migrar funciones admin existentes al helper

**Editar** `functions/src/admin/backups.ts`:

- Eliminar `ADMIN_EMAIL_PARAM` (lineas 14-16).
- Eliminar funcion local `verifyAdmin()` (lineas 105-118). Mantener `checkRateLimit`.
- Importar `import { assertAdmin } from '../helpers/assertAdmin';`.
- En cada funcion, reemplazar `await verifyAdmin(request)` por:

```typescript
assertAdmin(request.auth);
await checkRateLimit(request.auth!.uid);
```

**Editar** `functions/src/admin/authStats.ts`:

- Eliminar `ADMIN_EMAIL_PARAM` (lineas 11-13).
- Eliminar funcion local `verifyAdmin()` (lineas 33-44).
- Importar `import { assertAdmin } from '../helpers/assertAdmin';`.
- Reemplazar `verifyAdmin(request)` por `assertAdmin(request.auth)`.
- Linea 59 (`const adminEmail = ...`): eliminar. Cambiar el filtro de admin en el loop:

```typescript
// Antes: if (user.email === adminEmail) continue;
// Despues:
if (user.customClaims?.admin === true) continue;
```

**Editar** `functions/src/admin/feedback.ts`:

- Eliminar `const ADMIN_EMAIL = ...` (linea 5).
- Eliminar funcion local `assertAdmin()` (lineas 12-17).
- Importar `import { assertAdmin } from '../helpers/assertAdmin';`.
- Las llamadas `assertAdmin(request.auth)` ya matchean la firma.

**Editar** `functions/src/admin/menuPhotos.ts`:

- Eliminar `const ADMIN_EMAIL = ...` (linea 6).
- Importar `import { assertAdmin } from '../helpers/assertAdmin';`.
- En `approveMenuPhoto` (lineas 13-15): reemplazar inline check por `assertAdmin(request.auth)`.
- En `rejectMenuPhoto` (lineas 73-75): reemplazar inline check por `assertAdmin(request.auth)`.
- En `deleteMenuPhoto` (lineas 119-121): reemplazar inline check por `assertAdmin(request.auth)`.

**Validacion**: `cd functions && npm run build` compila sin errores.

---

## Fase 2: Firestore Rules

### DT-4: Actualizar `isAdmin()` en firestore.rules

**Editar** `firestore.rules` lineas 6-11:

```diff
 function isAdmin() {
   return request.auth != null
-    && ('email_verified' in request.auth.token)
-    && request.auth.token.email_verified == true
-    && request.auth.token.email == 'benoffi11@gmail.com';
+    && request.auth.token.admin == true;
 }
```

**Validacion**: no hay linter para rules, se valida en test local.

---

## Fase 3: Frontend

### DT-5: Actualizar AdminGuard.tsx

**Editar** `src/components/admin/AdminGuard.tsx`:

1. Eliminar import de `ADMIN_EMAIL`.
2. Agregar import de `auth` y `functions` de firebase config.

**DevAdminGuard** — despues del bloque de emailVerified (linea 48), agregar llamada a `setAdminClaim`:

```typescript
// Set admin custom claim via Cloud Function
const { httpsCallable } = await import('firebase/functions');
const { functions } = await import('../../config/firebase');
const setAdmin = httpsCallable(functions, 'setAdminClaim');
await setAdmin({ targetUid: auth.currentUser!.uid });
// Force token refresh to pick up new claim
await auth.currentUser!.getIdToken(true);
```

**AdminGuard (produccion)** — `handleLogin`:

```typescript
const handleLogin = async () => {
  setSigningIn(true);
  setAccessDenied(false);
  const result = await signInWithGoogle();
  if (result) {
    // Force token refresh and check admin claim
    const { getIdTokenResult } = await import('firebase/auth');
    const tokenResult = await getIdTokenResult(result, true);
    if (tokenResult.claims.admin !== true) {
      setAccessDenied(true);
      await signOut();
    }
  }
  setSigningIn(false);
};
```

**Mensaje de acceso denegado** — linea 106:

```diff
-Acceso denegado. Solo {ADMIN_EMAIL} puede acceder al panel de administración.
+Acceso denegado. Tu cuenta no tiene permisos de administrador.
```

---

### DT-6: Limpiar constante ADMIN_EMAIL

**Editar** `src/constants/admin.ts`:

- Eliminar linea 4: `export const ADMIN_EMAIL = 'benoffi11@gmail.com';`

**Validacion**: `npx tsc --noEmit` — verificar que ningun otro archivo importa `ADMIN_EMAIL`.

---

## Fase 4: Seed + Dev environment

### DT-7: Actualizar seed script

**Editar** `scripts/seed-admin-data.mjs`:

Agregar al final del script (antes de `console.log('\n✅ Seed complete!')`) la creacion de un usuario admin en el emulador de Auth con custom claims:

```javascript
// Create admin user in Auth emulator with custom claims
console.log('Creating admin user in Auth emulator...');
const ADMIN_EMAIL = 'benoffi11@gmail.com';
const AUTH_EMULATOR = 'http://localhost:9099';

// Create user via Auth Emulator REST API
const createRes = await fetch(
  `${AUTH_EMULATOR}/identitytoolkit.googleapis.com/v1/accounts:signUp`,
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer owner' },
    body: JSON.stringify({
      email: ADMIN_EMAIL,
      password: 'dev123456',
      returnSecureToken: true,
    }),
  },
);
const createData = await createRes.json();
const adminUid = createData.localId;

if (adminUid) {
  // Set emailVerified + custom claims
  await fetch(
    `${AUTH_EMULATOR}/identitytoolkit.googleapis.com/v1/accounts:update`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer owner' },
      body: JSON.stringify({
        localId: adminUid,
        emailVerified: true,
        customAttributes: JSON.stringify({ admin: true }),
      }),
    },
  );
  console.log(`  Admin user created: ${ADMIN_EMAIL} (uid: ${adminUid})`);
} else {
  console.log('  Admin user may already exist (skipped)');
}
```

Actualizar el log final para incluir la linea del admin user.

**Validacion**: `./scripts/dev-env.sh seed` ejecuta sin errores.

---

## Fase 5: Validacion + markdownlint

### DT-8: Test local completo

1. `./scripts/dev-env.sh restart` — emulators + vite + seed.
2. Verificar en Emulator UI (`http://localhost:4000/auth`) que el admin user tiene `customClaims: { admin: true }`.
3. Navegar a `http://localhost:5173/admin` — debe auto-logear y mostrar dashboard.
4. Probar:
   - Dashboard overview carga.
   - Feedback list carga.
   - Photo review carga.
   - Backups list carga (puede estar vacio en emulator).
5. Verificar que un usuario no-admin no puede acceder (probar en incognito, navegar a `/admin`).

### DT-9: Markdownlint

Verificar que los .md creados/editados pasan markdownlint:

```bash
npx markdownlint-cli docs/feat/security/custom-claims/*.md
```

---

## Orden de implementacion

| Paso | DT | Dependencias | Descripcion |
|------|----|--------------|-------------|
| 1 | DT-1 | - | Helper assertAdmin |
| 2 | DT-2 | DT-1 | Cloud Functions claims |
| 3 | DT-3 | DT-1 | Migrar funciones existentes |
| 4 | DT-4 | - | Firestore rules |
| 5 | DT-5 | DT-2 | AdminGuard frontend |
| 6 | DT-6 | DT-5 | Limpiar constante |
| 7 | DT-7 | DT-2 | Seed script |
| 8 | DT-8 | Todos | Test local |
| 9 | DT-9 | Todos | Markdownlint |

## Proceso post-merge en produccion

1. CI deployea functions + rules + hosting.
2. Admin (vos) ejecuta bootstrap:
   - Ir a Firebase Console > Functions > Shell (o usar `firebase functions:shell`).
   - Ejecutar: `setAdminClaim({ targetUid: "TU_UID" })`.
   - Alternativa: usar un script temporal con Firebase Admin SDK.
3. Logout + login en el admin panel.
4. Verificar que todo funciona.

**Nota**: entre el deploy y el bootstrap (~1 min), el admin panel no funciona. Es aceptable.
