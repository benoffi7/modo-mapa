# PRD: Admin Custom Claims

## Resumen

Migrar la verificacion de admin de email hardcodeado a **Firebase Custom Claims** (`admin: true`).
Actualmente el email `benoffi11@gmail.com` esta hardcodeado en 4 lugares:

1. `src/constants/admin.ts` — constante frontend
2. `src/components/admin/AdminGuard.tsx` — guard del panel admin
3. `firestore.rules` linea 10 — funcion `isAdmin()`
4. `functions/src/admin/*.ts` — funciones `verifyAdmin()` y `assertAdmin()`

Esto es fragil, no escala, y expone el email admin en codigo publico.

## Problema

- **Email hardcodeado en 4 capas**: frontend, rules, Cloud Functions, constantes.
- **No escala**: agregar un segundo admin requiere redeploy de rules + functions + frontend.
- **Exposicion**: el email admin esta en el repo publico y en el bundle del frontend.
- **Firestore rules no soporta env vars**: no hay forma de parametrizar el email en rules.

## Solucion

Usar **Firebase Custom Claims** para marcar usuarios como admin:

1. Cloud Function `setAdminClaim` que setee `{ admin: true }` en el token del usuario.
2. Firestore rules cambia a `request.auth.token.admin == true`.
3. Frontend verifica el claim del token en vez del email.
4. Cloud Functions verifican `request.auth?.token.admin === true`.

## Alcance

### En scope

- Cloud Function callable `setAdminClaim` (solo invocable por admin existente o setup inicial).
- Cloud Function callable `removeAdminClaim`.
- Script/mecanismo de bootstrap para el primer admin.
- Migracion de `firestore.rules` a usar custom claims.
- Migracion de `AdminGuard.tsx` a verificar claim.
- Migracion de `verifyAdmin()` y `assertAdmin()` en Cloud Functions.
- Actualizacion de la constante `ADMIN_EMAIL` — se reemplaza por claim check.
- Compatibilidad con emuladores (dev mode).

### Fuera de scope

- UI para gestionar multiples admins (futuro).
- Roles granulares (editor, viewer, etc.) — solo `admin: true/false`.
- Limpieza de historial git (el usuario decidira por separado).

## Flujo propuesto

### Bootstrap (primera vez)

```text
1. Deploy de la Cloud Function setAdminClaim
2. Llamar manualmente desde Firebase Console o script:
   setAdminClaim({ targetUid: "UID_DEL_ADMIN" })
   (esta primera llamada se autentica verificando el email contra una lista de bootstrap)
3. El usuario hace logout/login para refrescar el token
4. El claim admin:true queda en el token
```

### Verificacion (runtime)

```text
Frontend (AdminGuard):
  1. Usuario hace login con Google
  2. getIdTokenResult() → token.claims.admin === true?
  3. Si → mostrar panel admin
  4. No → "Acceso denegado"

Firestore Rules:
  isAdmin() = request.auth.token.admin == true

Cloud Functions:
  verifyAdmin() = request.auth?.token.admin === true
```

### Agregar otro admin (futuro)

```text
1. Admin existente llama setAdminClaim({ targetEmail: "nuevo@email.com" })
2. La funcion busca el UID por email y setea el claim
3. Nuevo admin hace login → tiene acceso
```

## Impacto en archivos existentes

| Archivo | Cambio |
|---------|--------|
| `functions/src/admin/claims.ts` | **NUEVO** — setAdminClaim, removeAdminClaim |
| `functions/src/index.ts` | Exportar nuevas funciones |
| `firestore.rules` | `isAdmin()` usa `request.auth.token.admin == true` |
| `src/constants/admin.ts` | Eliminar `ADMIN_EMAIL` o dejar solo para display |
| `src/components/admin/AdminGuard.tsx` | Verificar claim en vez de email |
| `functions/src/admin/backups.ts` | `verifyAdmin()` usa claim |
| `functions/src/admin/authStats.ts` | `verifyAdmin()` usa claim |
| `functions/src/admin/feedback.ts` | `assertAdmin()` usa claim |
| `functions/src/admin/menuPhotos.ts` | `assertAdmin()` usa claim |
| `functions/src/helpers/verifyAdmin.ts` | **NUEVO** — helper centralizado |

## Compatibilidad con emuladores

- En dev/emulador, `setAdminClaim` debe funcionar sin verificacion previa (bootstrap mode).
- `AdminGuard` en dev mode sigue haciendo auto-login pero ademas debe setear el claim via la Cloud Function.
- Los emuladores de Auth propagan custom claims correctamente.

## Seccion de Help

No requiere cambios en la seccion de ayuda. El admin panel sigue funcionando igual desde la perspectiva del usuario final. El unico cambio visible es que el admin necesita re-loguearse una vez despues del bootstrap.

## Seccion de Privacy Policy

- **Cambio menor**: ya no se verifica el email para determinar admin, sino un claim en el token.
- No se recopilan datos adicionales. El claim `admin: true` es metadata de autenticacion, no PII nueva.
- No requiere actualizacion de la privacy policy.

## Seed Data

- El seed script debe setear el custom claim `admin: true` en el usuario admin del emulador.
- Actualizar `dev-env.sh` o el script de seed para que configure el claim al inicializar.

## Admin Panel

- No requiere nuevas secciones en el panel admin.
- El acceso al panel sigue funcionando igual, solo cambia el mecanismo de verificacion.
- **Futuro**: podria agregarse una seccion "Gestionar admins" pero esta fuera de scope.

## Consideraciones de seguridad

- **Bootstrap seguro**: la primera invocacion de `setAdminClaim` verifica el email contra `ADMIN_EMAIL` (param de Firebase). Despues de eso, solo admins con claim pueden setear otros admins.
- **Revocacion**: `removeAdminClaim` permite quitar acceso inmediatamente. El token se invalida en el proximo refresh (~1 hora max, o forzar refresh).
- **Token refresh**: custom claims se propagan en el proximo `getIdToken(true)`. El frontend debe forzar refresh despues del bootstrap.
- **Emulador seguro**: el bypass de verificacion solo aplica cuando `IS_EMULATOR === true`.

## Rollback

Si algo falla:

1. Las Firestore rules anteriores siguen funcionando (el email sigue verificado + el claim).
2. Se puede revertir rules a la version anterior en Firebase Console.
3. Las Cloud Functions pueden volver a verificar email como fallback.

## Entornos

Esta solucion funciona igual en todos los entornos (Mac local, Raspberry Pi, CI) porque:

- El claim vive en Firebase Auth, no en env vars del frontend.
- No hay que sincronizar `VITE_ADMIN_EMAIL` entre maquinas.
- El unico requisito es que el usuario admin tenga el claim seteado (una vez).

## Metricas de exito

- Zero emails hardcodeados en `firestore.rules`.
- Zero emails hardcodeados en codigo frontend (bundle).
- Admin panel funciona identico pre/post migracion.
- Emuladores siguen funcionando sin configuracion extra.
