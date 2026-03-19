# Plan — Mejoras UX en ChangePasswordDialog (#164)

**Fecha:** 2026-03-19
**Prerequisito:** #163 mergeado (PasswordField, PasswordStrength, validatePassword disponibles)

---

## Paso 1: Refactor ChangePasswordDialog

| Archivo | Acción | Detalle |
|---------|--------|---------|
| `src/components/auth/ChangePasswordDialog.tsx` | Editar | Reemplazar 3 TextFields por PasswordField, agregar PasswordStrength debajo de nueva contraseña, usar validatePassword(), form wrapper, autofocus |

**Validar:** `npx tsc --noEmit`

## Paso 2: Actualizar tests

| Archivo | Acción | Detalle |
|---------|--------|---------|
| `src/components/auth/ChangePasswordDialog.test.tsx` | Editar | Actualizar tests existentes (passwords deben cumplir complejidad), agregar ~5 tests nuevos |

**Validar:**
```bash
npx vitest run src/components/auth/ChangePasswordDialog.test.tsx
```

## Paso 3: Full validation

```bash
npx tsc --noEmit -p tsconfig.app.json
npm run lint
npx vitest run --dir src
```

---

## Archivos a modificar

| Archivo | Operación |
|---------|-----------|
| `src/components/auth/ChangePasswordDialog.tsx` | Editar |
| `src/components/auth/ChangePasswordDialog.test.tsx` | Editar |

**Total:** 2 editados
**Esfuerzo:** XS (todo reutiliza componentes de #163)
