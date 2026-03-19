# Specs — Mejoras UX en ChangePasswordDialog (#164)

**Fecha:** 2026-03-19
**Depende de:** #163 (componentes `PasswordField`, `PasswordStrength`, `validatePassword`)

---

## Cambios en ChangePasswordDialog

### S1: Reemplazar TextFields por PasswordField

Los 3 campos actuales se reemplazan:

```tsx
// Antes
<TextField label="Contraseña actual" type="password" autoComplete="current-password" ... />
<TextField label="Nueva contraseña" type="password" autoComplete="new-password" ... />
<TextField label="Confirmar nueva contraseña" type="password" autoComplete="new-password" ... />

// Después
<PasswordField label="Contraseña actual" autoComplete="current-password" autoFocus name="current-password" ... />
<PasswordField label="Nueva contraseña" autoComplete="new-password" name="new-password" ... />
<PasswordField label="Confirmar nueva contraseña" autoComplete="new-password" name="confirm-password" ... />
```

### S2: Validación de complejidad + indicador

- Reemplazar `newPasswordValid = newPassword.length >= PASSWORD_MIN_LENGTH` por:
  ```typescript
  const newPasswordValidation = validatePassword(newPassword);
  const newPasswordValid = newPasswordValidation.valid;
  ```
- Agregar `<PasswordStrength password={newPassword} />` debajo del campo "Nueva contraseña".
- Remover `helperText` de "Mínimo 8 caracteres" (lo cubre PasswordStrength).
- La contraseña actual NO se valida con complejidad.

### S3: Form wrapper + Enter submit

```tsx
<Box component="form" onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
  {/* campos */}
</Box>
```

Mover `onClick={handleSubmit}` del botón a `type="submit"`.

### S3: Autofocus

Agregar `autoFocus` al primer `PasswordField` ("Contraseña actual").

---

## Tests nuevos/modificados

### ChangePasswordDialog.test.tsx

| Test | Tipo | Descripción |
|------|------|-------------|
| `shows visibility toggle on all fields` | Nuevo | Los 3 campos tienen botón ojito |
| `validates new password complexity` | Nuevo | "newpass" sin mayúscula/número/símbolo → disabled |
| `shows password strength indicator` | Nuevo | PasswordStrength visible debajo de nueva contraseña |
| `does not show strength for current password` | Nuevo | No hay indicador en contraseña actual |
| `submits on Enter` | Nuevo | Enter en último campo → handleSubmit |
| `validates password minimum length` | Modificar | Actualizar: "short" sin complejidad → mensaje cambia |
| `calls changePassword on submit` | Modificar | Password debe cumplir complejidad: "NewPass1!" |

---

## Archivos a modificar

| Archivo | Operación |
|---------|-----------|
| `src/components/auth/ChangePasswordDialog.tsx` | Editar |
| `src/components/auth/ChangePasswordDialog.test.tsx` | Editar |

**Total:** 2 editados (todo reutiliza de #163)
