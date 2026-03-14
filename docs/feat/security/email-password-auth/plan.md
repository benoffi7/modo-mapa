# Technical Plan: Email/Password Auth (#80) — PR 1

## Orden de implementación

Cada paso se commitea individualmente. Tests locales antes de cada commit.

---

### Paso 1: Constantes y service layer

**Archivos:**

1. Crear `src/constants/auth.ts` — PASSWORD_MIN_LENGTH + AUTH_ERRORS map
2. Crear `src/services/emailAuth.ts` — linkAnonymousWithEmail, signInWithEmail, signOutAndReset, getAuthErrorMessage
3. Crear `src/services/emailAuth.test.ts` — tests del service
4. Agregar `STORAGE_KEY_VISITS` export en `src/constants/storage.ts` (ya existe, verificar que se use en el service)

**Verificación:** `npm run test:run` — tests nuevos pasan, existentes no rompen.

**Commit:** `feat(auth): add email/password auth service and constants`

---

### Paso 2: Extender AuthContext

**Archivos:**

1. Modificar `src/context/AuthContext.tsx`:
   - Agregar type `AuthMethod`
   - Agregar `getAuthMethod()` helper
   - Agregar estados `authMethod`, `emailVerified`
   - Agregar callbacks `linkEmailPassword`, `signInWithEmailCb`
   - Refactorizar `signOut` para usar `signOutAndReset`
   - Actualizar `onAuthStateChanged` para setear authMethod + emailVerified
   - Actualizar `setUserProperty` para usar authMethod real
   - Extender interface + context value + default context
2. Modificar `src/context/AuthContext.test.tsx`:
   - Tests para linkEmailPassword (success + error)
   - Tests para signInWithEmail (success + error)
   - Tests para authMethod detection (anonymous / email / google)
   - Tests para signOut con limpieza

**Verificación:** `npm run test:run` — todos pasan. `npx tsc --noEmit -p tsconfig.app.json` — sin errores.

**Commit:** `feat(auth): extend AuthContext with email/password methods`

---

### Paso 3: EmailPasswordDialog

**Archivos:**

1. Crear `src/components/auth/EmailPasswordDialog.tsx`:
   - Dialog MUI con Tabs (Crear cuenta / Iniciar sesión)
   - Tab Registro: email + password + confirm + validación inline + submit
   - Tab Login: email + password + warning datos anónimos + submit
   - Loading state, error display, form reset
2. Crear `src/components/auth/EmailPasswordDialog.test.tsx`:
   - Render tabs, validación, submit calls, error display, reset

**Verificación:** `npm run test:run` + `npx tsc --noEmit -p tsconfig.app.json`

**Commit:** `feat(auth): add EmailPasswordDialog component`

---

### Paso 4: SideMenu — badge + botones

**Archivos:**

1. Modificar `src/components/layout/SideMenu.tsx`:
   - Importar `useAuth` fields: `authMethod`, `emailVerified`, `user`
   - Badge tipo de cuenta debajo del nombre
   - Botones "Crear cuenta" / "Ya tengo cuenta" (solo anónimos)
   - Estado + lazy load de EmailPasswordDialog
   - Nuevos imports MUI: `Button`, `Chip` (o Typography styled)
   - Imports icons: `VerifiedIcon`, `ErrorOutlineIcon`

**Verificación:** `npm run dev` — visual check en browser. `npx tsc --noEmit -p tsconfig.app.json`

**Commit:** `feat(auth): add account badge and auth buttons to SideMenu`

---

### Paso 5: SettingsPanel — sección Cuenta + logout

**Archivos:**

1. Modificar `src/components/menu/SettingsPanel.tsx`:
   - Importar `useAuth`: `authMethod`, `emailVerified`, `user`, `signOut`
   - Nueva sección "Cuenta" como primera sección
   - Si anónimo: texto + botón crear cuenta + link iniciar sesión
   - Si email: mostrar email + chip verificado/no verificado + botón cerrar sesión
   - Dialog confirmación logout
   - Estado para dialogs
   - Lazy load EmailPasswordDialog
   - Nuevos imports MUI: Button, Chip, Dialog, DialogTitle, DialogContent, DialogActions
   - Import icon: EmailIcon

**Verificación:** `npm run dev` — visual check. `npx tsc --noEmit -p tsconfig.app.json`

**Commit:** `feat(auth): add account section to SettingsPanel with logout`

---

### Paso 6: Analytics events

**Archivos:**

1. Modificar `src/context/AuthContext.tsx`:
   - En `linkEmailPassword` success: `trackEvent('account_created', { method: 'email' })`
   - En `signInWithEmailCb` success: `trackEvent('email_sign_in')`
   - En `signOut` success: `trackEvent('sign_out', { method: authMethod })`

**Verificación:** `npm run test:run` — mock de trackEvent no rompe tests.

**Commit:** `feat(auth): add analytics events for account actions`

---

### Paso 7: Test integral + lint

**Acciones:**

1. `npm run lint` — fix cualquier issue
2. `npm run test:run` — todos los tests pasan
3. `npx tsc --noEmit -p tsconfig.app.json` — sin errores TS
4. `npm run dev` — test manual completo:
   - Crear cuenta desde SideMenu
   - Crear cuenta desde SettingsPanel
   - Ver badge "Cuenta temporal" → cambia a email + verified/unverified
   - Logout desde SettingsPanel → vuelve a anónimo
   - Login desde SideMenu → carga datos existentes
   - Warning de pérdida de datos aparece en login
   - Errores: email duplicado, password corta, credentials incorrectas

**Commit:** `chore(auth): fix lint and test issues` (solo si hay fixes)

---

## Resumen

| Paso | Archivos | Tipo |
|------|----------|------|
| 1 | 3 nuevos + 1 mod | Service + constants |
| 2 | 2 mod | Context |
| 3 | 2 nuevos | Component + tests |
| 4 | 1 mod | UI SideMenu |
| 5 | 1 mod | UI SettingsPanel |
| 6 | 1 mod | Analytics |
| 7 | — | Verificación |

**Total: 5 archivos nuevos, 4 modificados, ~7 commits**
