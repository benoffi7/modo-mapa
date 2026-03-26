# PRD: Autenticación por Email/Password (#80)

**Issue:** [#80](https://github.com/benoffi7/modo-mapa/issues/80)
**Categoría:** security
**Prioridad:** Alta
**Version objetivo:** 2.4.0

---

## Problema

Los usuarios de Modo Mapa son anónimos por defecto. Si quieren acceder desde otro dispositivo, no tienen forma de sincronizar su cuenta sin vincular Google. Muchos usuarios prefieren no compartir su cuenta de Google — necesitan una alternativa con email y contraseña.

## Objetivo

Permitir que los usuarios creen una cuenta con email/password para sincronizar su información entre dispositivos, manteniendo la experiencia anónima como default.

## Decisiones de diseño

| Decisión | Resolución |
|----------|-----------|
| Google Sign-In para usuarios | NO — solo email/password (Google queda solo para admin) |
| Delivery | 2 PRs secuenciales (no paralelo) |
| UI ubicación | SideMenu (botón prominente) + SettingsPanel (gestión detallada) |
| Datos anónimos al hacer login | Se pierden con advertencia clara al usuario |
| Indicador tipo de cuenta | SideMenu (badge) + SettingsPanel (sección Cuenta) |
| Email verificación | No bloqueante — cuenta funcional sin verificar |
| Emulador | Email verification/reset no envían emails reales — ok, se testea en staging |

---

## PR 1: Registro + Login + Logout

### Registro (upgrade anónimo → email/password)

1. Usuario anónimo ve botón "Crear cuenta" en SideMenu y en SettingsPanel
2. Click abre `EmailPasswordDialog` en modo registro
3. Campos: email + contraseña (min 8 chars) + confirmar contraseña
4. Validación inline: formato email, largo mínimo, passwords coinciden
5. `linkWithCredential(EmailAuthProvider.credential(email, password))` vincula cuenta anónima
6. El UID no cambia → todos los datos (ratings, comments, favorites, tags, fotos, ranking) se preservan
7. Post-registro: `sendEmailVerification()` automático
8. Snackbar: "Cuenta creada. Ya podés iniciar sesión desde cualquier dispositivo"

### Login (desde otro dispositivo)

1. Usuario anónimo ve botón "Iniciar sesión" en SideMenu y en SettingsPanel
2. Click abre `EmailPasswordDialog` en modo login
3. Campos: email + contraseña
4. **Advertencia antes de login**: "Si tenés datos en esta sesión anónima, se van a perder al iniciar sesión con tu cuenta existente"
5. `signInWithEmailAndPassword(auth, email, password)`
6. Se cargan datos de la cuenta existente
7. La cuenta anónima temporal se descarta

### Logout

1. Botón "Cerrar sesión" visible en SettingsPanel para usuarios con email/password
2. Dialog de confirmación: "¿Cerrar sesión? Vas a necesitar tu email y contraseña para volver a entrar"
3. `signOut(auth)` → app crea nueva cuenta anónima automáticamente
4. Limpiar localStorage (recientes, preferencias transitorias)
5. Redirect a mapa principal

### UI

#### SideMenu

- Badge debajo del nombre indicando tipo de cuenta:
  - Anónimo: "Cuenta temporal" (color warning)
  - Email: email del usuario (color success) + ícono verificado/no verificado
- Botón prominente:
  - Si anónimo: "Crear cuenta" (primary) + "Iniciar sesión" (text)
  - Si logueado: no muestra botones (gestión en Settings)

#### SettingsPanel — nueva sección "Cuenta" (primera sección)

- **Si anónimo:**
  - Texto: "Tu cuenta es temporal. Creá una cuenta para no perder tus datos"
  - Botón "Crear cuenta con email"
  - Link "Ya tengo cuenta → Iniciar sesión"
- **Si email/password:**
  - Email mostrado (read-only)
  - Estado de verificación (badge Verificado / No verificado + botón re-enviar)
  - Botón "Cerrar sesión"

#### EmailPasswordDialog

- Dialog MUI con tabs: "Crear cuenta" / "Iniciar sesión"
- Tab registro: email + password + confirm password + submit
- Tab login: email + password + submit
- Advertencia en tab login si usuario tiene datos anónimos
- Validación inline en todos los campos
- Loading state en submit
- Error handling: email ya registrado, password incorrecta, etc.

### Cambios técnicos

#### AuthContext.tsx — extender

```typescript
interface AuthContextType {
  // ... existentes ...
  linkEmailPassword: (email: string, password: string) => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  authMethod: 'anonymous' | 'email' | 'google';
  emailVerified: boolean;
}
```

#### Nuevos archivos

| Archivo | Descripción |
|---------|-------------|
| `src/components/auth/EmailPasswordDialog.tsx` | Dialog de registro/login |
| `src/services/emailAuth.ts` | Funciones de auth: link, signIn, sendVerification |
| `src/constants/auth.ts` | Constantes: min password length, error messages |

#### Archivos modificados

| Archivo | Cambio |
|---------|--------|
| `src/context/AuthContext.tsx` | Agregar linkEmailPassword, signInWithEmail, authMethod, emailVerified |
| `src/components/layout/SideMenu.tsx` | Botones crear cuenta/login + badge tipo cuenta |
| `src/components/menu/SettingsPanel.tsx` | Nueva sección "Cuenta" |
| `src/types/index.ts` | AuthMethod type si necesario |
| `src/constants/validation.ts` | PASSWORD_MIN_LENGTH, EMAIL_REGEX |

### Edge cases

- Email ya registrado → error: "Este email ya tiene una cuenta"
- Password incorrecta → error: "Email o contraseña incorrectos"
- Red caída durante registro → error genérico + retry
- Usuario anónimo sin datos hace login → no mostrar advertencia de pérdida de datos
- Rate limit en login → Firebase lo maneja nativamente
- Logout accidental → datos accesibles re-logueándose

---

## PR 2: Verificación de email + Recuperación + Cambio de contraseña

### Verificación de email

- Banner sutil post-registro: "Verificá tu email para mayor seguridad"
- Badge "No verificado" en SideMenu y SettingsPanel
- Botón "Re-enviar verificación" en SettingsPanel
- `sendEmailVerification()` — no bloqueante, cuenta funciona sin verificar
- Polling de `emailVerified` en `onAuthStateChanged` o `user.reload()`

### Recuperación de contraseña

- Link "Olvidé mi contraseña" en tab login del EmailPasswordDialog
- `sendPasswordResetEmail(auth, email)`
- Snackbar: "Te enviamos un email para restablecer tu contraseña"

### Cambio de contraseña

- `ChangePasswordDialog.tsx` — solo visible si auth method es email/password
- Campos: contraseña actual + nueva + confirmar
- `reauthenticateWithCredential()` → `updatePassword()`
- Error: "Contraseña actual incorrecta"
- Success: "Contraseña actualizada"

### UI adicional

- Botón "Cambiar contraseña" en SettingsPanel sección Cuenta
- Botón "Olvidé mi contraseña" en EmailPasswordDialog

---

## Out of scope

- Google Sign-In para usuarios regulares
- Merge de datos entre cuentas
- Magic link / passwordless auth
- 2FA / MFA
- Eliminación de cuenta (GDPR)

---

## Métricas de éxito

- Usuarios que crean cuenta email/password (analytics event: `account_created`)
- Usuarios que hacen login cross-device (analytics event: `email_sign_in`)
- Tasa de verificación de email
- Tasa de abandono del flujo de registro

---

## Checklist post-implementación (por PR)

### Auditoría de Admin Dashboard

Correr el agente `admin-metrics-auditor` para verificar que todos los datos y métricas nuevos tengan visibilidad en el panel de administración. Si se detectan gaps, generar un PRD en `docs/feat/admin/` listo para crear un issue aparte.

Datos nuevos a verificar en admin:

- Conteo de usuarios por tipo de auth (anónimo / email / google)
- Estado de verificación de email por usuario
- Eventos de analytics nuevos (`account_created`, `email_sign_in`)
- Actividad de registro/login en el tab de actividad

### Documentación

Actualizar documentación funcional del proyecto con los cambios nuevos, en convivencia con los estándares existentes:

- **`docs/reference/features.md`** — Agregar sección de auth email/password
- **`docs/reference/patterns.md`** — Documentar patrón de linking y auth method detection
- **`docs/reference/architecture.md`** — Actualizar árbol de componentes con nuevos archivos
- **`docs/reference/security.md`** — Análisis de seguridad de los flujos nuevos (credential linking, password storage, rate limiting, email verification)
- **`docs/reference/PROJECT_REFERENCE.md`** — Actualizar resumen con nueva funcionalidad

### Auditorías obligatorias

- **Política de privacidad** — Correr agente `privacy-policy` para verificar que la recolección de email y datos de auth estén reflejados
- **Sección de ayuda** — Correr agente `help-docs-reviewer` para verificar que la ayuda in-app refleje las nuevas funcionalidades de cuenta
- **Arquitectura** — Correr agente `architecture` para validar que los nuevos componentes/services siguen los patrones establecidos
- **Seguridad** — Correr agente `security` solo sobre los archivos nuevos/modificados para detectar vulnerabilidades
