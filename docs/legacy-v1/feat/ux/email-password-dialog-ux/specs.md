# Specs — Mejoras UX en EmailPasswordDialog (#163)

**Fecha:** 2026-03-19

---

## Componentes compartidos (nuevos)

### `PasswordField` (`src/components/auth/PasswordField.tsx`)

TextField wrapper con toggle de visibilidad integrado.

```typescript
interface PasswordFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: 'new-password' | 'current-password';
  autoFocus?: boolean;
  error?: boolean;
  helperText?: string;
  name?: string;
}
```

- Usa `InputAdornment position="end"` con `IconButton` toggle.
- Íconos: `Visibility` / `VisibilityOff`.
- `aria-label="Mostrar contraseña"` / `"Ocultar contraseña"`.
- Estado `showPassword` interno (`useState(false)`).
- `type` alterna entre `"password"` y `"text"`.
- Props restantes pasadas al `TextField` (label, error, helperText, etc.).

### `PasswordStrength` (`src/components/auth/PasswordStrength.tsx`)

Indicador visual de requisitos de contraseña.

```typescript
interface PasswordStrengthProps {
  password: string;
}
```

- Muestra 4 checks con ícono + texto:
  - `✓ 8+ caracteres` / `✗ 8+ caracteres`
  - `✓ Una mayúscula` / `✗ Una mayúscula`
  - `✓ Un número` / `✗ Un número`
  - `✓ Un símbolo` / `✗ Un símbolo`
- Check cumplido: `CheckCircleIcon` verde (`success.main`) + texto `text.secondary`.
- Check pendiente: `RadioButtonUncheckedIcon` gris (`text.disabled`) + texto `text.disabled`.
- Tipografía `caption` (0.75rem), layout compacto (2 columnas en grid, gap 0.25).
- Solo se muestra si `password.length > 0`.

### `validatePassword()` (`src/constants/auth.ts`)

```typescript
export const PASSWORD_RULES = {
  minLength: 8,
  requireNumber: /\d/,
  requireUppercase: /[A-Z]/,
  requireSymbol: /[!@#$%^&*()_+\-=[\]{}|;:',.<>?/~`]/,
};

export interface PasswordValidation {
  length: boolean;
  number: boolean;
  uppercase: boolean;
  symbol: boolean;
  valid: boolean; // all true
}

export function validatePassword(password: string): PasswordValidation {
  const length = password.length >= PASSWORD_RULES.minLength;
  const number = PASSWORD_RULES.requireNumber.test(password);
  const uppercase = PASSWORD_RULES.requireUppercase.test(password);
  const symbol = PASSWORD_RULES.requireSymbol.test(password);
  return { length, number, uppercase, symbol, valid: length && number && uppercase && symbol };
}
```

---

## Cambios en EmailPasswordDialog

### S1: Preservar email entre tabs

**Cambio en `handleTabChange`:**
```typescript
const handleTabChange = (_: unknown, value: TabValue) => {
  setTab(value);
  // Solo resetear passwords y errores, preservar email
  setPassword('');
  setConfirmPassword('');
  setLocalError(null);
  setResetSent(false);
};
```

**Impacto en test:** El test `'resets form on tab change'` (línea 113) actualmente espera que el email se borre. Debe actualizarse para verificar que el email se **preserva**.

### S2: Password visibility toggle

Reemplazar los `<TextField type="password">` por `<PasswordField>`:
- Campo "Contraseña" → `<PasswordField label="Contraseña" autoComplete={tab === 'register' ? 'new-password' : 'current-password'} ... />`
- Campo "Confirmar contraseña" → `<PasswordField label="Confirmar contraseña" autoComplete="new-password" ... />`

### S3: Requisitos de complejidad + indicador

- Reemplazar `passwordValid = password.length >= PASSWORD_MIN_LENGTH` por `validatePassword(password).valid`.
- Agregar `<PasswordStrength password={password} />` debajo del campo "Contraseña", solo en tab `register`.
- En tab `login`: mantener validación simple (`password.length > 0`), sin indicador.
- Actualizar `helperText` del campo contraseña en register: remover el texto "Mínimo 8 caracteres" ya que el PasswordStrength lo cubre.

### S4: Enter submit via form

Envolver el contenido de `DialogContent` en:
```tsx
<Box component="form" onSubmit={(e) => { e.preventDefault(); tab === 'register' ? handleRegister() : handleLogin(); }}>
```

Agregar `type="submit"` al botón principal (Crear cuenta / Iniciar sesión). Remover `onClick` del botón.

### S5: Autofocus

- Agregar `autoFocus` al `PasswordField` de email (primer campo).
- En `handleTabChange`, usar `setTimeout(() => emailRef.current?.focus(), 0)` para refocus después del state update.

### S6: Recordar email

- Nuevo `STORAGE_KEY_REMEMBERED_EMAIL` en `constants/storage.ts`.
- Checkbox `<FormControlLabel control={<Checkbox size="small" />} label="Recordar mi email" />` debajo del campo email.
- Estado: `const [rememberEmail, setRememberEmail] = useState(() => !!localStorage.getItem(STORAGE_KEY_REMEMBERED_EMAIL))`.
- Inicializar email: `useState(() => localStorage.getItem(STORAGE_KEY_REMEMBERED_EMAIL) ?? '')`.
- On submit exitoso: si checked, `localStorage.setItem(STORAGE_KEY_REMEMBERED_EMAIL, email)`.
- On uncheck: `localStorage.removeItem(STORAGE_KEY_REMEMBERED_EMAIL)`.

### S7: Integración navegador

- Agregar `name="email"` al campo email.
- Cambiar `autoComplete="email"` a `autoComplete="username"` (mejor detección por gestores de credenciales).
- Agregar `name="password"` y `name="confirm-password"` a los campos de contraseña.
- El `<Box component="form">` de S4 ya provee el context necesario para que el navegador ofrezca guardar credenciales.

### S8: Fade transition

```tsx
<Fade in key={tab} timeout={200}>
  <Box>
    {/* contenido del tab */}
  </Box>
</Fade>
```

Import `Fade` de `@mui/material`.

---

## Tests nuevos/modificados

### EmailPasswordDialog.test.tsx

| Test | Tipo | Descripción |
|------|------|-------------|
| `preserves email on tab change` | Modificar existente | Cambiar expectativa: email debe **mantenerse** |
| `shows password visibility toggle` | Nuevo | Verificar que existe el botón de ojito |
| `toggles password visibility` | Nuevo | Click toggle → type cambia de password a text |
| `validates password complexity on register` | Nuevo | Contraseña sin número/mayúscula/símbolo → disabled |
| `shows password strength indicator on register` | Nuevo | Checks visibles con estado correcto |
| `does not validate complexity on login` | Nuevo | Login tab no muestra PasswordStrength |
| `submits on Enter in register` | Nuevo | keyDown Enter en confirm → handleRegister |
| `submits on Enter in login` | Nuevo | keyDown Enter en password → handleLogin |
| `remembers email when checkbox checked` | Nuevo | Submit → localStorage tiene email |
| `loads remembered email on open` | Nuevo | localStorage con email → campo precargado |

### PasswordField.test.tsx (nuevo)

| Test | Descripción |
|------|-------------|
| `renders with password type by default` | `type="password"` |
| `toggles to text on visibility click` | Click → `type="text"` |
| `toggles back to password` | Double click → `type="password"` |
| `has correct aria-label` | "Mostrar contraseña" / "Ocultar contraseña" |

### validatePassword.test.ts (en auth.test.ts o inline)

| Test | Descripción |
|------|-------------|
| `fails for short password` | "Ab1!" → length false |
| `fails without number` | "Abcdefg!" → number false |
| `fails without uppercase` | "abcdefg1!" → uppercase false |
| `fails without symbol` | "Abcdefg1" → symbol false |
| `passes with all criteria` | "Abcdefg1!" → all true, valid true |
| `empty password fails all` | "" → all false |
