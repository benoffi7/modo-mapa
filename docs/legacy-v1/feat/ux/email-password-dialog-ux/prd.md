# PRD — Mejoras UX en EmailPasswordDialog (registro/login)

**Feature:** email-password-dialog-ux
**Categoria:** ux
**Fecha:** 2026-03-19
**Issue:** [#163](https://github.com/benoffi7/modo-mapa/issues/163)
**Prioridad:** Media
**Milestone:** v2.20.0

---

## Contexto

El `EmailPasswordDialog` es el único punto de entrada para que usuarios anónimos creen cuenta o inicien sesión. Con el onboarding implementado en v2.19.0 (#157), más usuarios van a llegar a este dialog — y sus problemas de usabilidad se van a notar más.

### Estado actual

| Aspecto | Estado | Problema |
|---------|--------|----------|
| Cambio de tab | `resetForm()` borra todo | Email se pierde al cambiar entre Crear cuenta ↔ Iniciar sesión |
| Visibilidad de contraseña | Solo `type="password"` | No hay ojito toggle, frustrante en mobile |
| Validación de contraseña | Solo longitud >= 8 | Sin requisitos de complejidad (número, mayúscula, símbolo) |
| Indicador de fortaleza | No existe | El usuario no sabe si su contraseña es buena |
| Enter para submit | No implementado | Solo el botón funciona, no Enter |
| Autofocus | No hay | El campo email no recibe foco al abrir |
| Recordar email | No hay | El usuario tiene que tipear el email cada vez |
| Errores de Firebase | Mapeados en `AUTH_ERRORS` | Cobertura parcial — email-already-in-use usa mensaje genérico por seguridad |
| Integración navegador | `autoComplete` parcial | `email` y `new-password`/`current-password` correctos, pero no hay soporte explícito para Credential Management API |
| Transición entre tabs | Corte abrupto | Contenido cambia sin animación |

### Componentes y archivos involucrados

| Archivo | Rol |
|---------|-----|
| `src/components/auth/EmailPasswordDialog.tsx` | Dialog principal (222 líneas) |
| `src/constants/auth.ts` | `PASSWORD_MIN_LENGTH`, `EMAIL_REGEX`, `AUTH_ERRORS` |
| `src/services/emailAuth.ts` | Service layer de auth |
| `src/components/auth/EmailPasswordDialog.test.tsx` | Tests existentes (10 tests) |

---

## Problema

1. Usuarios pierden el email al cambiar de tab (bug reportado directamente).
2. No pueden ver la contraseña que están tipeando en mobile.
3. La contraseña solo requiere 8 caracteres — sin complejidad.
4. No hay indicación de qué tan segura es la contraseña durante el registro.
5. Enter no submitea el formulario.
6. No hay autofocus en el campo email al abrir.
7. No se ofrece recordar el email para futuras sesiones.
8. Falta integración con gestores de contraseñas del navegador.

---

## Solución

### S1: Preservar email entre tabs (Bug fix)

**Qué:** Al cambiar de tab, solo resetear contraseñas y errores. El email se mantiene.

**Cambio:**
```typescript
const handleTabChange = (_: unknown, value: TabValue) => {
  setTab(value);
  setPassword('');
  setConfirmPassword('');
  setLocalError(null);
  setResetSent(false);
  // email se preserva
};
```

### S2: Toggle de visibilidad de contraseña

**Qué:** Ícono `Visibility`/`VisibilityOff` en el `InputAdornment` end de los campos de contraseña.

**Comportamiento:**
- Click toggle entre `type="password"` y `type="text"`.
- Estado independiente por campo (contraseña y confirmar contraseña).
- El toggle no afecta `autoComplete` — sigue siendo `new-password` o `current-password`.
- `aria-label="Mostrar contraseña"` / `"Ocultar contraseña"`.

### S3: Requisitos de contraseña + indicador de fortaleza

**Qué:** Reemplazar la validación de solo longitud por requisitos de complejidad + indicador visual.

**Requisitos mínimos (registro):**
- 8+ caracteres (ya existe)
- Al menos 1 número
- Al menos 1 mayúscula
- Al menos 1 símbolo (`!@#$%^&*()_+-=[]{}|;:',.<>?/~`)

**Indicador visual:**
- Debajo del campo contraseña en tab registro.
- Checks individuales que se marcan en verde al cumplirse (lista compacta).
- Color: rojo (0-1 cumplidos), amarillo (2-3), verde (4).

**Constantes en `auth.ts`:**
```typescript
export const PASSWORD_RULES = {
  minLength: 8,
  requireNumber: true,
  requireUppercase: true,
  requireSymbol: true,
};
```

**Nota:** En tab login, NO mostrar indicador ni validar complejidad (cuentas existentes pueden tener contraseñas legacy).

### S4: Enter para submit

**Qué:** `onKeyDown` en los TextFields que dispare submit al presionar Enter.

**Comportamiento:**
- En tab registro: Enter en el último campo visible (confirmar contraseña) → `handleRegister()`.
- En tab login: Enter en contraseña → `handleLogin()`.
- Enter en email (ambos tabs) → foco al campo contraseña.
- No submite si el botón está disabled (validación incompleta).

### S5: Autofocus en email

**Qué:** `autoFocus` en el TextField de email.

**Comportamiento:**
- Al abrir el dialog, el campo email recibe foco automáticamente.
- Al cambiar de tab, el campo email recibe foco (ya que contraseñas se limpiaron).
- Usar un `ref` + `useEffect` para refocus en tab change ya que el TextField no se desmonta.

### S6: Recordar email

**Qué:** Checkbox "Recordar mi email" debajo del campo email. Si está activado, el email se guarda en localStorage y se precarga la próxima vez.

**Storage key:** `STORAGE_KEY_REMEMBERED_EMAIL` en `constants/storage.ts`.

**Comportamiento:**
- Default: desactivado.
- Si hay email guardado, se precarga al abrir el dialog.
- Al desactivar, se borra el email de localStorage.
- Al hacer login/register exitoso con checkbox activado, se guarda.

### S7: Integración con el navegador (Credential Management)

**Qué:** Asegurar que los atributos `autoComplete`, `name`, y `form` estén correctos para que los navegadores ofrezcan guardar/autocompletar credenciales.

**Cambios:**
- Envolver los campos en un `<form>` con `onSubmit` (reemplaza `onKeyDown` individual).
- Atributos `name="email"`, `name="password"`, `name="confirm-password"`.
- `autoComplete="username"` en email (en vez de `email`) para mejor detección por gestores.
- `autoComplete="new-password"` en registro, `autoComplete="current-password"` en login (ya existe).
- Después de register/login exitoso, el navegador debería ofrecer guardar las credenciales automáticamente.

### S8: Transición suave entre tabs

**Qué:** Fade/slide animation al cambiar entre tabs de registro y login.

**Implementación:** Wrap del contenido del tab en `<Fade in={true} key={tab}>` de MUI. Esto da una transición sutil de 200ms sin complejidad extra.

---

## Requisitos funcionales

| ID | Requisito | Prioridad | Solución |
|----|-----------|-----------|----------|
| RF-1 | Email se preserva al cambiar de tab | Alta | S1 |
| RF-2 | Toggle de visibilidad de contraseña en todos los campos password | Alta | S2 |
| RF-3 | Requisitos de complejidad: número + mayúscula + símbolo | Alta | S3 |
| RF-4 | Indicador visual de fortaleza con checks individuales | Media | S3 |
| RF-5 | Enter submite el formulario activo | Alta | S4 |
| RF-6 | Autofocus en campo email al abrir y al cambiar tab | Media | S5 |
| RF-7 | Checkbox "Recordar mi email" con persistencia en localStorage | Baja | S6 |
| RF-8 | Atributos correctos para gestores de contraseñas del navegador | Alta | S7 |
| RF-9 | Transición suave entre tabs | Baja | S8 |

---

## Requisitos no funcionales

- El dialog no debe crecer significativamente en altura al agregar el indicador de fortaleza.
- Los checks de fortaleza deben usar tipografía compacta (caption, 0.75rem).
- Dark mode: todos los colores via tokens MUI.
- Mobile (360px): el dialog sigue siendo usable con teclado abierto.
- No agregar dependencias externas para validación de contraseña — lógica pura.

---

## Plan de implementación por fases

### Fase 1 — Bug fix + core UX (S1, S2, S4, S5)

| Tarea | Detalle |
|-------|---------|
| S1: Preservar email en tab change | Cambiar `handleTabChange` para no resetear email |
| S2: Password visibility toggle | `InputAdornment` con `IconButton` Visibility/VisibilityOff |
| S4: Enter submit | `<form onSubmit>` wrapping the fields |
| S5: Autofocus | `autoFocus` + ref para refocus en tab change |

### Fase 2 — Contraseña robusta (S3, S7)

| Tarea | Detalle |
|-------|---------|
| S3: Password rules | Nuevas constantes en `auth.ts`, validación multi-criterio |
| S3: Indicador visual | Componente `PasswordStrength` con checks individuales |
| S7: Form + autoComplete | Wrap en `<form>`, atributos name/autoComplete correctos |

### Fase 3 — Polish (S6, S8)

| Tarea | Detalle |
|-------|---------|
| S6: Recordar email | Checkbox + localStorage |
| S8: Fade transition | `<Fade key={tab}>` en el contenido |

---

## Scope

| Item | Prioridad | Esfuerzo |
|------|-----------|----------|
| S1: Preservar email entre tabs | Alta | XS |
| S2: Toggle visibilidad contraseña | Alta | S |
| S3: Requisitos + indicador fortaleza | Alta | S |
| S4: Enter para submit | Alta | XS |
| S5: Autofocus en email | Media | XS |
| S6: Recordar email | Baja | S |
| S7: Integración navegador | Alta | S |
| S8: Transición entre tabs | Baja | XS |

**Esfuerzo total estimado:** S-M

---

## Fuera de scope

- OAuth providers adicionales (Google/Apple sign-in para usuarios regulares).
- 2FA / autenticación multifactor.
- CAPTCHA en el formulario de registro.
- Migración de contraseñas existentes a los nuevos requisitos de complejidad.
- Cambios en `ChangePasswordDialog` (aunque podría beneficiarse de S2 y S3 en un futuro PR).

---

## Tests

| Archivo / Componente | Qué testear | Cobertura target |
|---|---|---|
| `EmailPasswordDialog.test.tsx` | Email se preserva al cambiar tab, password visibility toggle, Enter submit, autofocus | ≥ 80% |
| Password strength logic | Cada regla individual (length, number, uppercase, symbol), combinaciones, edge cases | ≥ 80% |
| Recordar email | Checkbox toggle, localStorage read/write, precarga al abrir | ≥ 80% |
| Form submission | `onSubmit` previene default, dispara register/login correctamente | ≥ 80% |

```bash
npx vitest run src/components/auth/EmailPasswordDialog.test.tsx
```

---

## Criterios de aceptación

- [ ] Al cambiar de tab, el email se preserva (solo se limpian contraseñas).
- [ ] Los campos de contraseña tienen toggle de visibilidad (ojito).
- [ ] En registro, la contraseña requiere 8+ chars + número + mayúscula + símbolo.
- [ ] En registro, el indicador muestra checks individuales debajo del campo.
- [ ] En login, NO se valida complejidad (cuentas legacy).
- [ ] Enter en el último campo submitea el formulario.
- [ ] El campo email recibe foco automático al abrir el dialog.
- [ ] Los navegadores ofrecen guardar credenciales después de register/login exitoso.
- [ ] Checkbox "Recordar mi email" funciona y persiste.
- [ ] Transición suave al cambiar entre tabs.
- [ ] Dark mode: sin colores hardcodeados.
- [ ] Tests con ≥ 80% cobertura.

---

## Riesgos

| Riesgo | Mitigación |
|--------|-----------|
| Requisitos de complejidad frustran al usuario | Indicador visual con checks muestra progreso claro; no bloquea login |
| Cuentas existentes con contraseñas legacy fallan validación | Solo validar complejidad en registro, no en login |
| `autoComplete` inconsistente entre navegadores | Testear en Chrome, Firefox, Safari mobile; usar atributos estándar |
| Checkbox "Recordar email" es un riesgo de privacidad en dispositivos compartidos | Default desactivado; borrar al desactivar |
| Form wrapper rompe layout del Dialog | Usar `<Box component="form">` sin margen/padding extra |

---

## Para el review

- [ ] El problema está bien definido?
- [ ] La solución propuesta tiene sentido?
- [ ] El scope es correcto? (algo sobra o falta?)
- [ ] Las prioridades están bien?
- [ ] Los requisitos de complejidad de contraseña son adecuados?
- [ ] Algún concern de seguridad?
