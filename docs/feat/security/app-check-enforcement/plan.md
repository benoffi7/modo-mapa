# Plan: App Check Enforcement

**Specs:** [specs.md](specs.md)
**Fecha:** 2026-03-28

---

## Fases de implementacion

### Fase 1: Restaurar App Check admin + runtime config

**Branch:** `feat/app-check-enforcement`

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `functions/src/helpers/env.ts` | Cambiar `ENFORCE_APP_CHECK_ADMIN = false` a `ENFORCE_APP_CHECK_ADMIN = !IS_EMULATOR`. Actualizar JSDoc. |
| 2 | `functions/src/helpers/env.ts` | Cambiar `ENFORCE_APP_CHECK = false` a `ENFORCE_APP_CHECK = !IS_EMULATOR && process.env.APP_CHECK_ENFORCEMENT === 'enabled'`. Actualizar JSDoc. |
| 3 | `functions/.env` | Agregar `APP_CHECK_ENFORCEMENT=enabled` al archivo `.env` de produccion. |

### Fase 2: Tests

| Paso | Archivo | Cambio |
|------|---------|--------|
| 4 | `functions/src/__tests__/helpers/env.test.ts` | Crear test file. Usar `vi.resetModules()` + dynamic import para testear cada combinacion de env vars. Mock `firebase-admin/firestore` para `getFirestore`. Cubrir: `IS_EMULATOR` true/false, `ENFORCE_APP_CHECK` con env var enabled/disabled/undefined/emulator-override, `ENFORCE_APP_CHECK_ADMIN` true/false, `getDb` con/sin database ID. |

### Fase 3: Documentacion

| Paso | Archivo | Cambio |
|------|---------|--------|
| 5 | `docs/reference/security.md` | Actualizar seccion "App Check" para reflejar el nuevo estado: admin callables con `!IS_EMULATOR`, user-facing con env var `APP_CHECK_ENFORCEMENT`. Documentar que staging no tiene App Check y que el riesgo es aceptado. Agregar instrucciones de configuracion de env var. |
| 6 | `docs/reference/patterns.md` | Actualizar la fila "App Check (prod + functions)" en la tabla de Autenticacion y acceso para reflejar la nueva logica condicional. |

### Fase 4: Verificaciones manuales (post-deploy)

| Paso | Archivo | Cambio |
|------|---------|--------|
| 7 | N/A (manual) | Verificar en Firebase Console que App Check enforcement esta activado para Cloud Functions. |
| 8 | N/A (manual) | Verificar que `VITE_RECAPTCHA_ENTERPRISE_SITE_KEY` esta configurada en produccion (GitHub Secrets + `.env`). |
| 9 | N/A (manual) | Verificar que reCAPTCHA Enterprise site key esta registrada en Google Cloud Console para el dominio de produccion. |
| 10 | N/A (manual) | Testear que admin callables funcionan desde produccion (backup, authStats, etc). |
| 11 | N/A (manual) | Testear que staging no se rompe (callables deben funcionar sin App Check token). |

---

## Orden de implementacion

1. `functions/src/helpers/env.ts` -- cambios a ambas constantes (Pasos 1-2)
2. `functions/.env` -- agregar env var (Paso 3)
3. `functions/src/__tests__/helpers/env.test.ts` -- tests unitarios (Paso 4)
4. `docs/reference/security.md` -- actualizar documentacion (Paso 5)
5. `docs/reference/patterns.md` -- actualizar patrones (Paso 6)
6. Verificaciones manuales post-deploy (Pasos 7-11)

---

## Estimacion de archivos

| Archivo | Lineas estimadas | Accion |
|---------|-----------------|--------|
| `functions/src/helpers/env.ts` | ~45 (actual 44, cambio minimo) | OK |
| `functions/src/__tests__/helpers/env.test.ts` | ~120 (nuevo) | OK |
| `docs/reference/security.md` | ~310 (actual ~300, +10) | OK |
| `docs/reference/patterns.md` | ~210 (actual ~209, cambio minimo) | OK |

---

## Riesgos

1. **Staging se rompe si la env var se configura mal.** Mitigacion: la logica usa `=== 'enabled'` (opt-in explicito). Si la variable no existe o tiene otro valor, enforcement queda deshabilitado. Staging no deberia tener la variable configurada.

2. **Admin no puede acceder a callables si App Check no esta activo en su sesion.** Mitigacion: el admin accede desde produccion donde App Check siempre se inicializa con `ReCaptchaEnterpriseProvider`. Si la reCAPTCHA key no esta configurada, `src/config/firebase.ts` lanza un error al iniciar (fail-fast). Testear manualmente post-deploy.

3. **`getFeaturedLists` es publica pero usa `ENFORCE_APP_CHECK_ADMIN`.** Mitigacion: esta callable se invoca desde la app principal en produccion donde App Check esta activo. No se rompe. Documentar como anomalia para futura limpieza.

---

## Criterios de done

- [x] `ENFORCE_APP_CHECK_ADMIN` restaurado a `!IS_EMULATOR`
- [ ] `ENFORCE_APP_CHECK` lee de `process.env.APP_CHECK_ENFORCEMENT`
- [ ] `functions/.env` tiene `APP_CHECK_ENFORCEMENT=enabled`
- [ ] Tests en `env.test.ts` pasan con >= 80% cobertura
- [ ] `docs/reference/security.md` actualizado
- [ ] `docs/reference/patterns.md` actualizado
- [ ] No lint errors
- [ ] Build succeeds (`cd functions && npm run build`)
- [ ] Emuladores funcionan sin regresion (`npm run dev:full`)
- [ ] Verificaciones manuales post-deploy completadas
