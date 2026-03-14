# Issue #80: Cross-device sync con autenticación por contraseña (email/password)

**Source**: https://github.com/benoffi7/modo-mapa/issues/80
**State**: OPEN
**Downloaded**: 2026-03-14

## Descripción

Permitir que los usuarios sincronicen su cuenta entre múltiples dispositivos (teléfono → PC → tablet) mediante un sistema de autenticación por email y contraseña. Actualmente los usuarios son anónimos por defecto y pueden vincular Google Sign-In, pero se necesita una opción de login con contraseña para usuarios que prefieren no usar Google.

## Motivación

Un usuario que ingresa por primera vez desde su teléfono genera una cuenta anónima. Si luego quiere acceder desde la PC u otro dispositivo, no tiene forma de "logearse" con la misma cuenta a menos que use Google Sign-In. Muchos usuarios prefieren no vincular su cuenta de Google — necesitan una alternativa simple con email + contraseña.

## Flujo propuesto

### Registro (upgrade de anónimo → email/password)

1. Usuario anónimo va a Configuración → "Crear cuenta"
2. Ingresa email + contraseña (min 8 chars)
3. Firebase `linkWithCredential(EmailAuthProvider)` vincula la cuenta anónima existente
4. Se preservan TODOS los datos (ratings, comments, favorites, tags, fotos, ranking)
5. Confirmación: "Cuenta creada. Ahora podés iniciar sesión desde cualquier dispositivo"

### Login (desde otro dispositivo)

1. Usuario abre la app en nuevo dispositivo → se crea cuenta anónima temporal
2. Va a Configuración → "Iniciar sesión"
3. Ingresa email + contraseña
4. Firebase `signInWithEmailAndPassword()` reemplaza la sesión anónima
5. Se cargan todos los datos del usuario original
6. La cuenta anónima temporal se descarta

### Recuperación de contraseña

1. En pantalla de login → "Olvidé mi contraseña"
2. Firebase `sendPasswordResetEmail()`
3. Usuario recibe email con link de reset

### Verificación de email

1. Post-registro → Firebase envía email de verificación automáticamente (`sendEmailVerification()`)
2. Banner sutil en la app: "Verificá tu email para mayor seguridad"
3. Hasta verificar: cuenta funcional pero con badge "No verificado" en perfil
4. Re-enviar verificación disponible desde Configuración
5. Estado `emailVerified` se chequea en `onAuthStateChanged`

### Cambio de contraseña

1. Configuración → "Cambiar contraseña" (solo visible si auth method es email/password)
2. Requiere contraseña actual + nueva contraseña + confirmación
3. Firebase `reauthenticateWithCredential()` → `updatePassword()`
4. Si falla re-auth: "Contraseña actual incorrecta"
5. Success: "Contraseña actualizada"

### Logout

1. Configuración → "Cerrar sesión" (visible para usuarios autenticados con email o Google)
2. Confirmar con dialog: "¿Cerrar sesión? Vas a necesitar tu email y contraseña para volver a entrar"
3. Firebase `signOut()` → app crea nueva cuenta anónima automáticamente
4. Limpiar estado local (localStorage: recientes, preferencias transitorias)
5. Redirect a mapa principal

## Consideraciones técnicas

### Firebase Auth

- Usar `EmailAuthProvider` de Firebase Auth (habilitar en consola)
- `linkWithCredential()` para upgrade anónimo → email/password (mismo patrón que Google)
- `signInWithEmailAndPassword()` para login cross-device
- `sendEmailVerification()` post-registro
- `reauthenticateWithCredential()` + `updatePassword()` para cambio de contraseña
- `sendPasswordResetEmail()` para recuperación
- `signOut()` para logout
- Manejar conflicto: si el email ya está registrado, mostrar error claro

### UI Components

- `EmailPasswordDialog.tsx` — formulario de registro/login con tabs
- `ChangePasswordDialog.tsx` — formulario de cambio de contraseña
- Botón "Crear cuenta" / "Iniciar sesión" / "Cerrar sesión" en SettingsPanel
- Indicador de tipo de cuenta en perfil (anónimo / email / Google)
- Badge de verificación de email
- Validación inline: email format, password strength (min 8 chars)

### Firestore

- No requiere cambios en el modelo de datos (userId se mantiene)
- Al vincular, el uid de Firebase Auth NO cambia → datos intactos

### Edge cases

- Usuario con Google Sign-In quiere agregar también email/password → `linkWithCredential`
- Usuario intenta registrar email ya en uso → error: "Este email ya tiene cuenta"
- Usuario anónimo con datos vs login en cuenta existente → preguntar si quiere fusionar o descartar datos anónimos
- Rate limit en intentos de login (Firebase lo maneja nativamente)
- Logout accidental → datos anónimos nuevos, datos anteriores accesibles re-logueándose
- Cambio de contraseña con sesión expirada → re-auth requerido

## Prioridad vs Google Sign-In

| Aspecto | Email/Password | Google Sign-In |
|---------|---------------|----------------|
| Fricción | Media (llenar form) | Baja (1 click) |
| Privacidad | Alta (no comparte datos Google) | Media |
| Recuperación | Email reset | Automático |
| Cross-device | Manual (recordar password) | Automático (cuenta Google) |

Ambos métodos deberían coexistir. Email/password es la opción para usuarios privacy-conscious.

## Scope

### In scope

- Habilitar Email/Password provider en Firebase Console
- Dialog de registro (email + password + confirmación)
- Dialog de login (email + password)
- Recuperación de contraseña (send reset email)
- Verificación de email (envío automático + banner + re-send)
- Cambio de contraseña (re-auth + update)
- Logout con confirmación + limpieza de estado local
- Link con cuenta anónima existente (preservar datos)
- UI en Settings para gestionar cuenta
- Indicador visual de tipo de cuenta + estado de verificación

### Out of scope (futuro)

- Merge de datos entre dos cuentas con historial
- Magic link / passwordless auth
- 2FA / MFA
- Eliminación de cuenta (GDPR)
