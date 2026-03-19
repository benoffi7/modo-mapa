# Plan — Mejoras UX en EmailPasswordDialog (#163)

**Fecha:** 2026-03-19

---

## Paso 1: Shared components + constants (base)

| Archivo | Acción | Detalle |
|---------|--------|---------|
| `src/constants/auth.ts` | Editar | Agregar `PASSWORD_RULES`, `PasswordValidation`, `validatePassword()` |
| `src/constants/storage.ts` | Editar | Agregar `STORAGE_KEY_REMEMBERED_EMAIL` |
| `src/components/auth/PasswordField.tsx` | Crear | TextField con visibility toggle |
| `src/components/auth/PasswordStrength.tsx` | Crear | Indicador visual de requisitos |
| `src/components/auth/PasswordField.test.tsx` | Crear | 4 tests |
| `src/constants/auth.test.ts` | Crear | 6 tests para `validatePassword()` |

**Validar:** `npx tsc --noEmit` + tests pasan

## Paso 2: EmailPasswordDialog refactor (S1-S5, S7, S8)

| Archivo | Acción | Detalle |
|---------|--------|---------|
| `src/components/auth/EmailPasswordDialog.tsx` | Editar | Reemplazar TextFields por PasswordField, agregar PasswordStrength, form wrapper, preservar email en tab change, autofocus, Fade, autoComplete attrs |
| `src/components/auth/EmailPasswordDialog.test.tsx` | Editar | Actualizar test de tab change + agregar ~8 tests nuevos |

**Validar:**
- `npx tsc --noEmit`
- `npx vitest run src/components/auth/`
- Lint 0 errors

## Paso 3: Recordar email (S6)

| Archivo | Acción | Detalle |
|---------|--------|---------|
| `src/components/auth/EmailPasswordDialog.tsx` | Editar | Agregar Checkbox + localStorage read/write |
| `src/components/auth/EmailPasswordDialog.test.tsx` | Editar | 2 tests nuevos (save + load) |

**Validar:** Tests pasan

## Paso 4: Full test run + coverage check

```bash
npx vitest run --dir src
npx vitest run --coverage src/components/auth/ src/constants/auth.test.ts
```

Target: ≥ 80% en todos los archivos nuevos/modificados.

---

## Archivos a modificar/crear

| Archivo | Operación |
|---------|-----------|
| `src/constants/auth.ts` | Editar |
| `src/constants/auth.test.ts` | Crear |
| `src/constants/storage.ts` | Editar |
| `src/components/auth/PasswordField.tsx` | Crear |
| `src/components/auth/PasswordField.test.tsx` | Crear |
| `src/components/auth/PasswordStrength.tsx` | Crear |
| `src/components/auth/EmailPasswordDialog.tsx` | Editar |
| `src/components/auth/EmailPasswordDialog.test.tsx` | Editar |

**Total:** 3 nuevos, 5 editados
