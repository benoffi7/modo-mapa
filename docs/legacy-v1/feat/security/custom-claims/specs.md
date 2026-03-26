# Technical Specs: Admin Custom Claims

## Estado actual

El admin se verifica comparando email en 4 capas con 3 patrones distintos:

### Patron 1: `verifyAdmin()` con `defineString` (backups.ts, authStats.ts)

```typescript
const ADMIN_EMAIL_PARAM = defineString('ADMIN_EMAIL', { ... });
// ...
if (email !== ADMIN_EMAIL_PARAM.value()) throw ...
```

### Patron 2: `assertAdmin()` con `process.env` (feedback.ts, menuPhotos.ts)

```typescript
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'benoffi11@gmail.com';
// ...
if (!auth?.token.email_verified || auth?.token.email !== ADMIN_EMAIL) throw ...
```

### Patron 3: Inline check (menuPhotos.ts approveMenuPhoto, rejectMenuPhoto, deleteMenuPhoto)

```typescript
if (!auth?.token.email_verified || auth.token.email !== ADMIN_EMAIL) throw ...
```

### Frontend (AdminGuard.tsx)

```typescript
import { ADMIN_EMAIL } from '../../constants/admin';
// ...
if (result.email !== ADMIN_EMAIL || !result.emailVerified) { ... }
```

### Firestore Rules

```text
request.auth.token.email == 'benoffi11@gmail.com'
```

---

## Arquitectura objetivo

### Principio

Un unico mecanismo de verificacion: **`admin: true` en custom claims del token**.

### Diagrama de flujo

```text
Bootstrap (una vez):
  Admin login → setAdminClaim(targetUid) → setCustomUserClaims(uid, {admin:true})
  → Admin logout/login → token tiene admin:true

Runtime:
  Request llega →
    Firestore Rules: request.auth.token.admin == true
    Cloud Functions: request.auth?.token.admin === true
    Frontend:        idTokenResult.claims.admin === true
```

---

## Spec 1: Cloud Function `setAdminClaim`

### Ubicacion

`functions/src/admin/claims.ts`

### Firma

```typescript
export const setAdminClaim = onCall<{ targetUid: string }, Promise<{ success: true }>>(
  { enforceAppCheck: !IS_EMULATOR },
  async (request) => { ... }
);
```

### Logica

1. Validar `targetUid` (string, no vacio).
2. **Autorizacion**:
   - Si `IS_EMULATOR`: permitir sin verificacion (bootstrap en dev).
   - Si el caller ya tiene `request.auth.token.admin === true`: permitir (admin existente agrega otro).
   - Si no hay admins aun (bootstrap en produccion): verificar que `request.auth.token.email === ADMIN_EMAIL_PARAM.value()` y `email_verified === true`. Esto es el unico lugar donde se usa el email como fallback.
3. Llamar `getAuth().setCustomUserClaims(targetUid, { admin: true })`.
4. Loguear la accion (quien seteo a quien).
5. Retornar `{ success: true }`.

### Deteccion de "no hay admins"

Para evitar complejidad, el bootstrap simplifica: si el caller tiene email === ADMIN_EMAIL_PARAM y emailVerified, puede setear claims. Esto es identico al comportamiento actual pero solo se usa en esta funcion.

### Rate limit

No se aplica rate limit a esta funcion (accion rara y protegida).

---

## Spec 2: Cloud Function `removeAdminClaim`

### Ubicacion

`functions/src/admin/claims.ts`

### Firma

```typescript
export const removeAdminClaim = onCall<{ targetUid: string }, Promise<{ success: true }>>(
  { enforceAppCheck: !IS_EMULATOR },
  async (request) => { ... }
);
```

### Logica

1. Validar `targetUid`.
2. Solo un admin con claim puede remover otro admin: `request.auth.token.admin === true`.
3. Prevenir auto-remocion: `targetUid !== request.auth.uid`.
4. Llamar `getAuth().setCustomUserClaims(targetUid, { admin: false })`.
5. Loguear.
6. Retornar `{ success: true }`.

---

## Spec 3: Helper centralizado `assertAdmin`

### Ubicacion

`functions/src/helpers/assertAdmin.ts`

### Implementacion

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

### Migracion

Todos los archivos que verifican admin (`backups.ts`, `authStats.ts`, `feedback.ts`, `menuPhotos.ts`) reemplazan su verificacion local por:

```typescript
import { assertAdmin } from '../helpers/assertAdmin';
// ...
assertAdmin(request.auth);
```

Se eliminan:

- `ADMIN_EMAIL_PARAM` de `backups.ts` y `authStats.ts`
- `ADMIN_EMAIL` constante de `feedback.ts` y `menuPhotos.ts`
- Las funciones `verifyAdmin()` / `assertAdmin()` locales
- La constante `ADMIN_EMAIL` de `authStats.ts` (usada para excluir admin de stats)

### Nota: authStats.ts excluye admin de stats

Actualmente filtra por email:

```typescript
if (user.email === adminEmail) continue;
```

Con claims, cambia a verificar custom claims del UserRecord:

```typescript
if (user.customClaims?.admin === true) continue;
```

---

## Spec 4: Firestore Rules

### Cambio

```diff
 function isAdmin() {
   return request.auth != null
-    && ('email_verified' in request.auth.token)
-    && request.auth.token.email_verified == true
-    && request.auth.token.email == 'benoffi11@gmail.com';
+    && request.auth.token.admin == true;
 }
```

### Nota

Custom claims se propagan al token automaticamente. Firestore rules lee `request.auth.token.<claim>` directamente. No requiere `email_verified` check porque el claim ya implica que el admin fue verificado al momento de setearlo.

---

## Spec 5: Frontend — AdminGuard.tsx

### Cambio principal

En vez de comparar email, verificar el custom claim:

```typescript
// Antes
if (result.email !== ADMIN_EMAIL || !result.emailVerified) {
  setAccessDenied(true);
}

// Despues
const idTokenResult = await auth.currentUser!.getIdTokenResult();
if (idTokenResult.claims.admin !== true) {
  setAccessDenied(true);
}
```

### DevAdminGuard (emulador)

En dev mode, despues de crear/logear al usuario admin, se llama a la Cloud Function `setAdminClaim` para setear el claim en el emulador:

```typescript
// Despues de sign-in y emailVerified setup:
const { httpsCallable } = await import('firebase/functions');
const { functions } = await import('../../config/firebase');
const setAdmin = httpsCallable(functions, 'setAdminClaim');
await setAdmin({ targetUid: auth.currentUser!.uid });
// Force token refresh to pick up new claim
await auth.currentUser!.getIdToken(true);
```

### Mensaje de acceso denegado

Cambia de:

```text
Acceso denegado. Solo benoffi11@gmail.com puede acceder al panel de administracion.
```

A:

```text
Acceso denegado. Tu cuenta no tiene permisos de administrador.
```

---

## Spec 6: Frontend — constants/admin.ts

### Cambio

Eliminar `ADMIN_EMAIL`:

```diff
-export const ADMIN_EMAIL = 'benoffi11@gmail.com';
```

El resto de constantes (`FREE_TIER_READS`, `STATUS_CHIP`, etc.) se mantienen.

---

## Spec 7: Seed script

### Archivo

`scripts/seed-admin-data.mjs`

### Cambio

Despues de crear el usuario admin en el emulador de Auth, setear el custom claim:

```javascript
// Usar la Auth Emulator REST API para setear custom claims
await fetch(
  `http://localhost:9099/identitytoolkit.googleapis.com/v1/accounts:update`,
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer owner' },
    body: JSON.stringify({
      localId: adminUid,
      customAttributes: JSON.stringify({ admin: true }),
    }),
  },
);
```

---

## Spec 8: .env y .env.example

### Frontend .env

- **NO se agrega `VITE_ADMIN_EMAIL`**. El email admin ya no es config del frontend.
- Sin cambios en `.env` ni `.env.example` del frontend.

### Functions .env

- `ADMIN_EMAIL=benoffi11@gmail.com` se mantiene **solo** en `functions/.env` como parametro de Firebase Functions.
- Se usa unicamente en `setAdminClaim` para el bootstrap (verificar email del primer admin).
- Despues del bootstrap, este valor ya no se consulta en runtime normal.

---

## Spec 9: CI/CD (deploy.yml)

### Sin cambios

- `firebase deploy --only functions` ya deployea todas las funciones incluyendo las nuevas.
- `firebase deploy --only firestore:rules` deployea las rules actualizadas.
- No se requieren nuevos secrets ni env vars en GitHub Actions.

---

## Spec 10: Proceso de migracion en produccion

### Orden de deploy

1. **Deploy Cloud Functions** (con `setAdminClaim` + helper `assertAdmin` que acepta claim).
   - Las funciones existentes siguen usando email check hasta el paso 3.
   - NOTA: en este paso, las funciones YA migran a claims. Esto es seguro porque el paso 2 ocurre inmediatamente despues.
2. **Bootstrap**: el admin (vos) llama `setAdminClaim({ targetUid: "TU_UID" })` desde Firebase Console > Functions > Shell, o via un script temporal.
3. **Deploy Firestore Rules** con el nuevo `isAdmin()` basado en claims.
4. **Deploy Frontend** con el nuevo `AdminGuard` que verifica claim.

### Nota sobre atomicidad

El deploy en CI (`deploy.yml`) hace functions + rules + hosting juntos. Para la primera vez:

1. Mergear el PR completo (functions + rules + frontend actualizados).
2. El CI deployea todo junto.
3. Inmediatamente despues, ejecutar el bootstrap manualmente.
4. Hacer logout/login en el admin panel.

**Riesgo**: entre el deploy y el bootstrap, el admin panel no funciona (~1 minuto). Aceptable.

### Alternativa sin downtime

Se puede hacer en 2 pasos:

1. **PR 1**: agregar `setAdminClaim` + helper que acepta AMBOS (claim OR email). Deploy. Bootstrap.
2. **PR 2**: remover fallback a email, dejar solo claim. Deploy.

Esto evita el minuto de downtime pero agrega complejidad. **Recomendacion**: hacer todo en 1 PR, el downtime de 1 minuto es aceptable para un panel admin.

---

## Archivos afectados (resumen)

| Archivo | Accion |
|---------|--------|
| `functions/src/helpers/assertAdmin.ts` | CREAR — helper centralizado |
| `functions/src/admin/claims.ts` | CREAR — setAdminClaim + removeAdminClaim |
| `functions/src/index.ts` | EDITAR — exportar nuevas funciones |
| `functions/src/admin/backups.ts` | EDITAR — usar helper, eliminar verifyAdmin local + ADMIN_EMAIL_PARAM |
| `functions/src/admin/authStats.ts` | EDITAR — usar helper, eliminar verifyAdmin local + ADMIN_EMAIL_PARAM, usar customClaims para filtro |
| `functions/src/admin/feedback.ts` | EDITAR — usar helper, eliminar assertAdmin local + ADMIN_EMAIL |
| `functions/src/admin/menuPhotos.ts` | EDITAR — usar helper, eliminar inline checks + ADMIN_EMAIL |
| `firestore.rules` | EDITAR — isAdmin() usa token.admin |
| `src/constants/admin.ts` | EDITAR — eliminar ADMIN_EMAIL |
| `src/components/admin/AdminGuard.tsx` | EDITAR — verificar claim, no email |
| `scripts/seed-admin-data.mjs` | EDITAR — setear custom claim en emulador |
| `.env` / `.env.example` | SIN CAMBIOS |
| `.github/workflows/deploy.yml` | SIN CAMBIOS |

---

## Testing

### Unit tests (Cloud Functions)

- `setAdminClaim`: bootstrap con email correcto, bootstrap con email incorrecto, admin existente agrega otro, no-admin rechazado.
- `removeAdminClaim`: admin remueve otro, auto-remocion rechazada, no-admin rechazado.
- `assertAdmin`: token con claim pasa, sin claim rechazado, emulator bypass.

### Integration test (emuladores)

1. Start emulators.
2. Seed crea admin con claim.
3. Verificar que AdminGuard permite acceso.
4. Verificar que Firestore rules permiten leer `config/counters`.
5. Verificar que Cloud Functions admin responden OK.

### Manual test (pre-merge)

1. `./scripts/dev-env.sh restart`
2. Navegar a `/admin` — debe auto-logear y mostrar dashboard.
3. Probar feedback respond, photo approve, backups list.
4. Verificar en Emulator UI que el usuario tiene `customClaims.admin === true`.
