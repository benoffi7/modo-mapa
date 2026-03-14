# Technical Specs: Email/Password Auth (#80) — PR 1

## Scope PR 1

Registro (link anónimo → email/password) + Login cross-device + Logout + UI (SideMenu + SettingsPanel).

---

## 1. Nuevas constantes

### `src/constants/auth.ts` (nuevo)

```typescript
export const PASSWORD_MIN_LENGTH = 8;

export const AUTH_ERRORS: Record<string, string> = {
  'auth/email-already-in-use': 'Este email ya tiene una cuenta.',
  'auth/invalid-email': 'El formato del email no es válido.',
  'auth/weak-password': 'La contraseña debe tener al menos 8 caracteres.',
  'auth/wrong-password': 'Email o contraseña incorrectos.',
  'auth/user-not-found': 'Email o contraseña incorrectos.',
  'auth/invalid-credential': 'Email o contraseña incorrectos.',
  'auth/too-many-requests': 'Demasiados intentos. Intentá de nuevo más tarde.',
  'auth/network-request-failed': 'Error de conexión. Verificá tu internet.',
  default: 'Ocurrió un error. Intentá de nuevo.',
};
```

### `src/constants/validation.ts` (agregar)

```typescript
export const PASSWORD_MIN_LENGTH = 8;
```

> Nota: se exporta desde `validation.ts` para uso en UI y desde `auth.ts` para el mapa de errores. Evaluar si centralizar en uno solo — recomiendo solo `auth.ts`.

### `src/constants/storage.ts` (agregar)

```typescript
export const STORAGE_KEY_VISITS = 'modo-mapa-visits';
// Ya existe — se usa para limpiar en logout
```

---

## 2. Service layer

### `src/services/emailAuth.ts` (nuevo)

```typescript
import {
  EmailAuthProvider,
  linkWithCredential,
  signInWithEmailAndPassword,
  sendEmailVerification,
  signOut as firebaseSignOut,
  signInAnonymously,
} from 'firebase/auth';
import type { User } from 'firebase/auth';
import { auth } from '../config/firebase';
import { AUTH_ERRORS } from '../constants/auth';
import { STORAGE_KEY_VISITS, STORAGE_KEY_ANALYTICS_CONSENT } from '../constants/storage';

/** Traduce un error de Firebase Auth a un mensaje en español */
function getAuthErrorMessage(error: unknown): string {
  if (error instanceof Error && 'code' in error) {
    const code = (error as { code: string }).code;
    return AUTH_ERRORS[code] ?? AUTH_ERRORS.default;
  }
  return AUTH_ERRORS.default;
}

/**
 * Vincula la cuenta anónima actual con email/password.
 * El UID NO cambia — los datos del usuario se preservan.
 */
export async function linkAnonymousWithEmail(
  currentUser: User,
  email: string,
  password: string,
): Promise<void> {
  const credential = EmailAuthProvider.credential(email, password);
  const result = await linkWithCredential(currentUser, credential);
  // Enviar verificación de email automáticamente
  await sendEmailVerification(result.user);
}

/**
 * Inicia sesión con email/password desde otro dispositivo.
 * Reemplaza la sesión anónima temporal.
 */
export async function signInWithEmail(
  email: string,
  password: string,
): Promise<User> {
  const result = await signInWithEmailAndPassword(auth, email, password);
  return result.user;
}

/**
 * Cierra sesión y crea una nueva cuenta anónima.
 * Limpia estado local (visitas, etc.).
 */
export async function signOutAndReset(): Promise<void> {
  await firebaseSignOut(auth);
  // Limpiar localStorage transient data
  localStorage.removeItem(STORAGE_KEY_VISITS);
  // No limpiar STORAGE_KEY_COLOR_MODE ni STORAGE_KEY_ANALYTICS_CONSENT
  // (preferencias de dispositivo, no de cuenta)
  // signInAnonymously se dispara automáticamente via onAuthStateChanged
}

export { getAuthErrorMessage };
```

**Decisiones:**

- `linkWithCredential` (no `createUserWithEmailAndPassword`) para preservar el UID anónimo
- `sendEmailVerification` automático post-link (no bloqueante)
- `signOutAndReset` limpia solo datos de sesión, no preferencias de dispositivo
- Error mapping centralizado en español — Firebase arroja codes en inglés
- No se crea `signInAnonymously` acá — ya lo maneja `AuthContext.onAuthStateChanged`

---

## 3. AuthContext — extensión

### `src/context/AuthContext.tsx` (modificar)

#### Nuevos imports

```typescript
import {
  EmailAuthProvider,
  linkWithCredential,
  signInWithEmailAndPassword,
  sendEmailVerification,
} from 'firebase/auth';
import { linkAnonymousWithEmail, signInWithEmail, signOutAndReset, getAuthErrorMessage } from '../services/emailAuth';
```

#### Interface extendida

```typescript
type AuthMethod = 'anonymous' | 'email' | 'google';

interface AuthContextType {
  user: User | null;
  displayName: string | null;
  setDisplayName: (name: string) => Promise<void>;
  isLoading: boolean;
  authError: string | null;
  signInWithGoogle: () => Promise<User | null>;
  signOut: () => Promise<void>;
  // Nuevos PR 1
  authMethod: AuthMethod;
  emailVerified: boolean;
  linkEmailPassword: (email: string, password: string) => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
}
```

#### Helper para detectar auth method

```typescript
function getAuthMethod(user: User | null): AuthMethod {
  if (!user) return 'anonymous';
  if (user.isAnonymous) return 'anonymous';
  const providers = user.providerData.map((p) => p.providerId);
  if (providers.includes('password')) return 'email';
  if (providers.includes('google.com')) return 'google';
  return 'anonymous';
}
```

#### Nuevos estados y callbacks

```typescript
const [authMethod, setAuthMethod] = useState<AuthMethod>('anonymous');
const [emailVerified, setEmailVerified] = useState(false);
```

En `onAuthStateChanged`:

```typescript
if (firebaseUser) {
  setUser(firebaseUser);
  const method = getAuthMethod(firebaseUser);
  setAuthMethod(method);
  setEmailVerified(firebaseUser.emailVerified);
  setUserProperty('auth_type', method);
  // ... existente: cargar displayName
}
```

#### linkEmailPassword callback

```typescript
const linkEmailPassword = useCallback(async (email: string, password: string): Promise<void> => {
  if (!user) throw new Error('No user');
  setAuthError(null);
  try {
    await linkAnonymousWithEmail(user, email, password);
    // Forzar reload del user para que providerData se actualice
    await user.reload();
    const refreshed = auth.currentUser;
    if (refreshed) {
      setUser(refreshed);
      setAuthMethod(getAuthMethod(refreshed));
      setEmailVerified(refreshed.emailVerified);
    }
  } catch (error) {
    const message = getAuthErrorMessage(error);
    setAuthError(message);
    throw error; // Re-throw para que el dialog pueda manejarlo
  }
}, [user]);
```

#### signInWithEmailCallback

```typescript
const signInWithEmailCb = useCallback(async (email: string, password: string): Promise<void> => {
  setAuthError(null);
  try {
    await signInWithEmail(email, password);
    // onAuthStateChanged se encarga del resto
  } catch (error) {
    const message = getAuthErrorMessage(error);
    setAuthError(message);
    throw error;
  }
}, []);
```

#### signOut override

```typescript
const signOut = useCallback(async (): Promise<void> => {
  try {
    await signOutAndReset();
    // onAuthStateChanged dispara signInAnonymously automáticamente
  } catch (error) {
    if (import.meta.env.DEV) console.error('Error signing out:', error);
  }
}, []);
```

#### Context value actualizado

```typescript
const value = useMemo<AuthContextType>(() => ({
  user, displayName, setDisplayName, isLoading, authError,
  signInWithGoogle, signOut,
  authMethod, emailVerified, linkEmailPassword, signInWithEmail: signInWithEmailCb,
}), [user, displayName, setDisplayName, isLoading, authError,
  signInWithGoogle, signOut,
  authMethod, emailVerified, linkEmailPassword, signInWithEmailCb]);
```

---

## 4. Componentes UI

### `src/components/auth/EmailPasswordDialog.tsx` (nuevo)

**Props:**

```typescript
interface EmailPasswordDialogProps {
  open: boolean;
  onClose: () => void;
  initialTab?: 'register' | 'login';
}
```

**Estructura:**

- Dialog MUI `maxWidth="xs" fullWidth`
- Tabs MUI: "Crear cuenta" / "Iniciar sesión"
- Tab Registro:
  - TextField email (type="email", autoComplete="email")
  - TextField password (type="password", autoComplete="new-password")
  - TextField confirmar password (type="password")
  - Validación inline:
    - Email: regex básico + TextField error/helperText
    - Password: `length >= PASSWORD_MIN_LENGTH`
    - Confirm: passwords coinciden
  - Button "Crear cuenta" (variant="contained", loading state)
  - On submit: `linkEmailPassword(email, password)`
  - On success: `onClose()` + snackbar "Cuenta creada..."
- Tab Login:
  - Alert (severity="warning"): "Si tenés datos en esta sesión, se van a perder al iniciar sesión con otra cuenta" — solo visible si usuario tiene datos (ratings/comments/favorites count > 0 via hook)
  - TextField email + TextField password
  - Button "Iniciar sesión" (variant="contained", loading state)
  - On submit: `signInWithEmail(email, password)`
  - On success: `onClose()`
- Error display: `authError` del context mostrado como Alert severity="error"
- Resetear form state al cambiar de tab y al abrir/cerrar

**Dependencias:**

- `useAuth()` → `linkEmailPassword`, `signInWithEmail`, `authError`, `user`
- `useState` para form fields, loading, tab activa
- MUI: Dialog, DialogTitle, DialogContent, DialogActions, Tabs, Tab, TextField, Button, Alert, CircularProgress

**Detección de datos anónimos (para warning en login):**

Usar un hook simple o query directa. Opción más liviana: pasar un prop `hasAnonymousData: boolean` desde el padre que lo sepa. El SideMenu ya tiene acceso a favoritos/recientes. SettingsPanel no. Evaluar:

- **Opción A**: prop desde padre — más simple, SideMenu ya lo tiene
- **Opción B**: hook `useHasUserData(userId)` que hace 3 queries con `limit(1)` — más robusto
- **Recomendación**: Opción A — `hasAnonymousData` como prop opcional, default `false`

### `src/components/layout/SideMenu.tsx` (modificar)

#### Cambios en el header del usuario

Debajo del nombre, agregar badge de tipo de cuenta:

```tsx
{/* Debajo del nombre actual */}
<Typography
  variant="caption"
  sx={{
    color: authMethod === 'anonymous' ? 'warning.main' : 'success.main',
    display: 'flex',
    alignItems: 'center',
    gap: 0.5,
  }}
>
  {authMethod === 'anonymous' ? (
    'Cuenta temporal'
  ) : (
    <>
      {user?.email}
      {emailVerified ? <VerifiedIcon sx={{ fontSize: 14 }} /> : <ErrorOutlineIcon sx={{ fontSize: 14 }} />}
    </>
  )}
</Typography>
```

#### Botones de acción (solo para anónimos)

Después del badge, antes del Divider:

```tsx
{authMethod === 'anonymous' && (
  <Box sx={{ mt: 1, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
    <Button
      variant="contained"
      size="small"
      fullWidth
      onClick={() => setEmailDialogOpen(true)}  // initialTab='register'
    >
      Crear cuenta
    </Button>
    <Button
      variant="text"
      size="small"
      fullWidth
      onClick={() => setEmailDialogOpen(true)}  // initialTab='login'
    >
      Ya tengo cuenta
    </Button>
  </Box>
)}
```

#### Nuevo estado

```typescript
const [emailDialogOpen, setEmailDialogOpen] = useState(false);
const [emailDialogTab, setEmailDialogTab] = useState<'register' | 'login'>('register');
```

#### Lazy load del dialog

```typescript
const EmailPasswordDialog = lazy(() => import('../auth/EmailPasswordDialog'));
```

Renderizar dentro del Suspense existente, fuera del Drawer:

```tsx
<Suspense fallback={null}>
  {emailDialogOpen && (
    <EmailPasswordDialog
      open={emailDialogOpen}
      onClose={() => setEmailDialogOpen(false)}
      initialTab={emailDialogTab}
    />
  )}
</Suspense>
```

### `src/components/menu/SettingsPanel.tsx` (modificar)

#### Nueva sección "Cuenta" (primera sección, antes de Privacidad)

```tsx
{/* Cuenta */}
<Typography variant="overline" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
  Cuenta
</Typography>

{authMethod === 'anonymous' ? (
  <Box sx={{ mb: 1 }}>
    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
      Tu cuenta es temporal. Creá una cuenta para no perder tus datos.
    </Typography>
    <Button
      variant="contained"
      size="small"
      fullWidth
      startIcon={<EmailIcon />}
      onClick={() => setEmailDialogOpen(true)}
    >
      Crear cuenta con email
    </Button>
    <Button
      variant="text"
      size="small"
      fullWidth
      onClick={() => { setEmailDialogTab('login'); setEmailDialogOpen(true); }}
      sx={{ mt: 0.5 }}
    >
      Ya tengo cuenta → Iniciar sesión
    </Button>
  </Box>
) : (
  <Box sx={{ mb: 1 }}>
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
      <Typography variant="body2" sx={{ fontWeight: 500 }}>
        {user?.email}
      </Typography>
      <Chip
        label={emailVerified ? 'Verificado' : 'No verificado'}
        size="small"
        color={emailVerified ? 'success' : 'warning'}
        variant="outlined"
      />
    </Box>
    <Button
      variant="outlined"
      size="small"
      color="error"
      onClick={() => setLogoutDialogOpen(true)}
    >
      Cerrar sesión
    </Button>
  </Box>
)}

<Divider sx={{ my: 1.5 }} />
```

#### Dialog de confirmación de logout

```tsx
<Dialog open={logoutDialogOpen} onClose={() => setLogoutDialogOpen(false)} maxWidth="xs">
  <DialogTitle>¿Cerrar sesión?</DialogTitle>
  <DialogContent>
    <Typography variant="body2">
      Vas a necesitar tu email y contraseña para volver a entrar.
    </Typography>
  </DialogContent>
  <DialogActions>
    <Button onClick={() => setLogoutDialogOpen(false)}>Cancelar</Button>
    <Button
      onClick={handleLogout}
      color="error"
      variant="contained"
    >
      Cerrar sesión
    </Button>
  </DialogActions>
</Dialog>
```

**Dependencias nuevas del SettingsPanel:**

- `useAuth()` → `authMethod`, `emailVerified`, `user`, `signOut`
- Lazy-loaded `EmailPasswordDialog`
- MUI: Button, Chip, Dialog, DialogTitle, DialogContent, DialogActions

---

## 5. Analytics events

| Evento | Cuándo | Params |
|--------|--------|--------|
| `account_created` | Post `linkEmailPassword` exitoso | `{ method: 'email' }` |
| `email_sign_in` | Post `signInWithEmail` exitoso | — |
| `sign_out` | Post `signOut` exitoso | `{ method: authMethod }` |

Disparados en AuthContext callbacks, no en los componentes UI.

---

## 6. Firebase Console

Habilitar **Email/Password** provider en Firebase Auth console (acción manual, no code).

- Firebase Console → Authentication → Sign-in method → Email/Password → Enable
- Email link (passwordless) → **NO habilitar** (out of scope)

---

## 7. Tests

### `src/context/AuthContext.test.tsx` (extender)

Tests nuevos:

```
describe('linkEmailPassword')
  ✓ links anonymous user with email/password
  ✓ sets authMethod to "email" after linking
  ✓ sets authError on failure (email-already-in-use)
  ✓ re-throws error for dialog handling

describe('signInWithEmail')
  ✓ signs in with email/password
  ✓ sets authError on wrong credentials
  ✓ re-throws error for dialog handling

describe('authMethod')
  ✓ returns "anonymous" for anonymous user
  ✓ returns "email" for email/password user
  ✓ returns "google" for google user

describe('signOut')
  ✓ calls firebaseSignOut
  ✓ clears localStorage visits
```

### `src/services/emailAuth.test.ts` (nuevo)

Tests:

```
describe('getAuthErrorMessage')
  ✓ maps known Firebase error codes to Spanish messages
  ✓ returns default message for unknown errors
  ✓ handles non-Error objects

describe('linkAnonymousWithEmail')
  ✓ calls linkWithCredential + sendEmailVerification
  ✓ throws on linkWithCredential failure

describe('signOutAndReset')
  ✓ calls firebaseSignOut
  ✓ removes STORAGE_KEY_VISITS from localStorage
  ✓ does NOT remove color mode preference
```

### `src/components/auth/EmailPasswordDialog.test.tsx` (nuevo)

Tests:

```
describe('EmailPasswordDialog')
  ✓ renders register tab by default
  ✓ switches to login tab
  ✓ validates email format
  ✓ validates password minimum length
  ✓ validates password confirmation match
  ✓ disables submit when form is invalid
  ✓ calls linkEmailPassword on register submit
  ✓ calls signInWithEmail on login submit
  ✓ shows auth error from context
  ✓ shows anonymous data warning on login tab
  ✓ resets form on tab change
  ✓ resets form on close
```

---

## 8. Archivos — resumen de cambios

| Archivo | Acción | Descripción |
|---------|--------|-------------|
| `src/constants/auth.ts` | **Crear** | PASSWORD_MIN_LENGTH, AUTH_ERRORS map |
| `src/services/emailAuth.ts` | **Crear** | linkAnonymousWithEmail, signInWithEmail, signOutAndReset, getAuthErrorMessage |
| `src/services/emailAuth.test.ts` | **Crear** | Tests del service |
| `src/components/auth/EmailPasswordDialog.tsx` | **Crear** | Dialog de registro/login |
| `src/components/auth/EmailPasswordDialog.test.tsx` | **Crear** | Tests del dialog |
| `src/context/AuthContext.tsx` | **Modificar** | +authMethod, +emailVerified, +linkEmailPassword, +signInWithEmail, refactor signOut |
| `src/context/AuthContext.test.tsx` | **Modificar** | +tests para nuevos métodos |
| `src/components/layout/SideMenu.tsx` | **Modificar** | +badge tipo cuenta, +botones crear/login, +lazy EmailPasswordDialog |
| `src/components/menu/SettingsPanel.tsx` | **Modificar** | +sección Cuenta (primera), +logout dialog |

---

## 9. Diagrama de flujo

```text
┌─────────────┐     linkWithCredential      ┌──────────────┐
│  Anonymous   │ ──────────────────────────▸ │ Email/Pass   │
│  (uid: abc)  │     uid preserved           │ (uid: abc)   │
└─────────────┘                              └──────────────┘
                                                    │
                                              signOut │
                                                    ▾
                                             ┌──────────────┐
                                             │ New Anonymous │
                                             │ (uid: xyz)   │
                                             └──────────────┘
                                                    │
                                        signInWithEmail │
                                                    ▾
                                             ┌──────────────┐
                                             │ Email/Pass   │
                                             │ (uid: abc)   │
                                             └──────────────┘
```

---

## 10. Riesgos y mitigaciones

| Riesgo | Mitigación |
|--------|-----------|
| `linkWithCredential` falla si email ya existe | Catch `auth/email-already-in-use`, mostrar error claro |
| Usuario pierde datos anónimos al hacer login | Warning explícito en UI antes de confirmar |
| `sendEmailVerification` falla silenciosamente en emulador | No bloqueante — se testea en staging |
| `user.reload()` puede fallar si no hay red | Catch silencioso — estado se actualiza en próximo `onAuthStateChanged` |
| Race condition: signOut + signInAnonymously | `onAuthStateChanged` es el single source of truth — no hay race |
