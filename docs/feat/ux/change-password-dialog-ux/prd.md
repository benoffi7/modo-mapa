# PRD — Mejoras UX en ChangePasswordDialog

**Feature:** change-password-dialog-ux
**Categoria:** ux
**Fecha:** 2026-03-19
**Issue:** [#164](https://github.com/benoffi7/modo-mapa/issues/164)
**Prioridad:** Baja
**Depende de:** [#163](https://github.com/benoffi7/modo-mapa/issues/163) (componentes compartidos)

---

## Contexto

El `ChangePasswordDialog` permite a usuarios con cuenta email cambiar su contraseña. Tiene los mismos problemas de usabilidad que el `EmailPasswordDialog` — sin ojito, sin requisitos de complejidad, sin Enter submit. A diferencia de #163 donde el usuario tipea una contraseña, acá tipea **tres** (actual + nueva + confirmación), haciendo el ojito aún más crítico.

### Estado actual

| Aspecto | Estado | Problema |
|---------|--------|----------|
| Visibilidad contraseña | Solo `type="password"` | 3 campos sin ojito — muy propenso a error |
| Validación nueva contraseña | Solo longitud >= 8 | Sin complejidad |
| Indicador fortaleza | No existe | — |
| Enter submit | No implementado | — |
| Autofocus | No hay | — |
| Integración navegador | `autoComplete` correcto | `current-password` y `new-password` OK |

### Archivo

| Archivo | Líneas | Tests |
|---------|--------|-------|
| `src/components/auth/ChangePasswordDialog.tsx` | 132 | 6 tests |

---

## Problema

1. El usuario no puede ver ninguna de las 3 contraseñas que tipea — frustrante si se equivoca en una.
2. La nueva contraseña puede ser débil (solo 8 chars).
3. No hay feedback de fortaleza.
4. Enter no submitea.
5. No hay autofocus.

---

## Solución

Reutilizar los componentes compartidos creados en #163:

### S1: Toggle de visibilidad (reutilizar `PasswordField`)

Reemplazar los 3 `TextField type="password"` por el componente `PasswordField` de #163 que incluye el ojito toggle.

### S2: Requisitos de complejidad en nueva contraseña

Usar `PASSWORD_RULES` y la función `validatePassword()` de #163 para validar la nueva contraseña. Mostrar `PasswordStrength` debajo del campo "Nueva contraseña".

**Nota:** La contraseña actual NO se valida con complejidad (puede ser legacy).

### S3: Enter submit + autofocus

Envolver los campos en `<Box component="form" onSubmit>`. Autofocus en "Contraseña actual".

---

## Requisitos funcionales

| ID | Requisito | Prioridad | Solución |
|----|-----------|-----------|----------|
| RF-1 | Toggle visibilidad en los 3 campos de contraseña | Alta | S1 |
| RF-2 | Requisitos de complejidad en nueva contraseña | Alta | S2 |
| RF-3 | Indicador de fortaleza debajo de nueva contraseña | Media | S2 |
| RF-4 | Enter submitea el formulario | Alta | S3 |
| RF-5 | Autofocus en contraseña actual al abrir | Media | S3 |

---

## Requisitos no funcionales

- Reutilizar `PasswordField` y `PasswordStrength` de #163 — no duplicar.
- Dark mode via tokens MUI.
- Mobile 360px compatible.

---

## Scope

| Item | Prioridad | Esfuerzo |
|------|-----------|----------|
| S1: Visibilidad en 3 campos | Alta | XS |
| S2: Complejidad + indicador | Alta | XS |
| S3: Enter + autofocus | Alta | XS |

**Esfuerzo total:** XS (reutiliza todo de #163)

---

## Fuera de scope

- Validar que la nueva contraseña sea diferente a la actual (Firebase lo maneja).
- Expiración de contraseña.
- Historial de contraseñas.

---

## Tests

| Qué testear | Cobertura target |
|---|---|
| PasswordField toggle funciona en los 3 campos | ≥ 80% |
| Nueva contraseña valida complejidad | ≥ 80% |
| Enter submitea el form | ≥ 80% |
| Autofocus en campo actual | ≥ 80% |

---

## Criterios de aceptación

- [ ] Los 3 campos de contraseña tienen toggle de visibilidad.
- [ ] La nueva contraseña requiere número + mayúscula + símbolo.
- [ ] Indicador de fortaleza debajo de "Nueva contraseña".
- [ ] Enter submitea si el formulario es válido.
- [ ] Autofocus en "Contraseña actual" al abrir.
- [ ] Tests con ≥ 80% cobertura.

---

## Para el review

- [ ] El scope es correcto?
- [ ] Algún concern de seguridad?
