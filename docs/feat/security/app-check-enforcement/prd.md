# PRD: App Check deshabilitado en todas las Cloud Functions

**Feature:** app-check-enforcement
**Categoria:** security
**Fecha:** 2026-03-28
**Issue:** #209
**Prioridad:** Critica

---

## Contexto

Modo Mapa usa Firebase App Check con reCAPTCHA Enterprise en el frontend de produccion, pero las Cloud Functions tienen `ENFORCE_APP_CHECK` y `ENFORCE_APP_CHECK_ADMIN` hardcodeados a `false` en `functions/src/helpers/env.ts`. La causa raiz es que staging y produccion comparten el mismo deployment de Cloud Functions, y staging no tiene reCAPTCHA key configurada. Actualmente hay 14 callable functions y 6 scheduled functions expuestas sin attestation.

## Problema

- **Sin defensa contra bots/scripts:** Cualquier HTTP client (curl, Postman, scripts automatizados) puede invocar callable functions sin ningun tipo de verificacion de dispositivo. Esto anula el proposito de App Check como capa de proteccion.
- **Abuso automatizado a escala:** Combinado con Firebase Anonymous Auth (que permite creacion ilimitada de cuentas anonimas), un atacante puede automatizar creacion de cuentas + invocacion de callables para generar spam, manipular ratings, o abusar de funcionalidades como recomendaciones y comentarios.
- **Admin callables desprotegidas:** Aunque `assertAdmin()` valida email + custom claims, las admin callables (backups, claims, feedback admin, menuPhotos admin, authStats, featuredLists, storageStats, analyticsReport) tambien perdieron la capa extra de App Check que antes tenian con `ENFORCE_APP_CHECK_ADMIN = !IS_EMULATOR`.

## Solucion

### S1. Enforcement condicional por entorno (runtime config)

Usar Firebase Runtime Config o variables de entorno para controlar App Check enforcement per-environment en vez de hardcodear `false`. Esto permite que produccion tenga enforcement habilitado mientras staging lo mantiene deshabilitado.

**Enfoque:**

- Agregar una variable de entorno `APP_CHECK_ENFORCEMENT` (`'enabled' | 'disabled'`) configurable por proyecto Firebase
- Modificar `functions/src/helpers/env.ts` para leer esta variable en vez de usar constantes hardcodeadas
- En produccion: `APP_CHECK_ENFORCEMENT=enabled`
- En emuladores: siempre deshabilitado (ya cubierto por `IS_EMULATOR`)
- En staging: `APP_CHECK_ENFORCEMENT=disabled` (hasta tener proyecto separado)

### S2. Habilitar App Check para admin callables como paso inmediato

Dado que las admin callables usan Google Sign-In (no anonimo), el admin siempre accede desde produccion. Esto significa que se puede habilitar `ENFORCE_APP_CHECK_ADMIN = !IS_EMULATOR` de forma segura e inmediata, sin depender de la solucion de staging.

**Callables afectadas:** `backupFirestore`, `listBackups`, `restoreBackup`, `deleteBackup`, `setAdminClaim`, `respondToFeedback`, `resolveFeedback`, `createGithubIssueFromFeedback`, `approveMenuPhoto`, `rejectMenuPhoto`, `getAuthStats`, `setFeaturedLists`, `getStorageStats`, `getAnalyticsReport`.

### S3. Plan para enforcement completo en user-facing callables

Para habilitar App Check en las 4 callables user-facing (`inviteListEditor`, `removeListEditor`, `reportMenuPhoto`, `writePerfMetrics`), se necesita resolver el problema de staging. Opciones evaluadas:

- **Opcion A: Proyecto Firebase separado para staging** -- Solucion ideal. Cada proyecto tiene su propia reCAPTCHA key. Permite enforcement completo en ambos entornos. Esfuerzo alto (requiere migrar datos de staging, actualizar CI/CD, mantener dos proyectos).
- **Opcion B: Debug token para staging** -- Firebase App Check soporta debug tokens para entornos de prueba. Se puede configurar un debug token en staging sin reCAPTCHA Enterprise. Esfuerzo bajo, pero el debug token necesita proteccion.
- **Opcion C: Enforcement solo en produccion via runtime config** -- S1 ya cubre esto. Las user-facing callables tendrian enforcement solo en produccion. Staging sigue sin App Check, aceptando el riesgo en ese entorno.

**Recomendacion:** Implementar S1 + S2 inmediatamente (esfuerzo bajo-medio). Evaluar Opcion B como paso intermedio antes de Opcion A.

---

## Scope

| Item | Prioridad | Esfuerzo |
|------|-----------|----------|
| S2: Restaurar `ENFORCE_APP_CHECK_ADMIN = !IS_EMULATOR` en env.ts | Alta | S |
| S1: Implementar runtime config para `ENFORCE_APP_CHECK` | Alta | M |
| Actualizar `functions/src/helpers/env.ts` con lectura de env var | Alta | S |
| Configurar env var en produccion (Firebase Functions config o `.env`) | Alta | S |
| Verificar que App Check se inicializa correctamente en frontend prod | Alta | S |
| Verificar reCAPTCHA Enterprise site key en Firebase Console | Alta | S |
| Documentar configuracion en `docs/reference/security.md` | Media | S |
| S3: Evaluar debug token para staging | Baja | S |
| S3: Evaluar proyecto Firebase separado para staging | Baja | L |

**Esfuerzo total estimado:** M

---

## Out of Scope

- Migrar a un proyecto Firebase separado para staging (evaluacion solamente, no implementacion)
- Implementar rate limiting adicional en Cloud Functions (ya existe rate limiting server-side via `_rateLimits`)
- Cambiar el provider de App Check de reCAPTCHA Enterprise a otro (SafetyNet, DeviceCheck)
- Modificar Firestore rules (ya son robustas con `keys().hasOnly()`, ownership, y validacion de campos)

---

## Tests

### Archivos que necesitaran tests

| Archivo | Tipo | Que testear |
|---------|------|-------------|
| `functions/src/helpers/env.ts` | Unit | Lectura correcta de env var, fallback a `false` cuando no esta definida, emulador siempre `false` |
| `functions/src/helpers/env.test.ts` | Unit (nuevo) | `ENFORCE_APP_CHECK` refleja env var, `ENFORCE_APP_CHECK_ADMIN` es `!IS_EMULATOR`, `getDb` sigue funcionando |

### Criterios de testing

- Cobertura >= 80% del codigo nuevo
- Tests de validacion para todos los inputs del usuario
- Todos los paths condicionales cubiertos (emulador, staging, produccion)
- Side effects verificados (que callable functions rechacen requests sin App Check token en modo enforcement)

---

## Seguridad

- [x] App Check enforcement restaurado para admin callables (S2)
- [ ] App Check enforcement habilitado para user-facing callables via runtime config (S1)
- [ ] Verificar que `VITE_RECAPTCHA_ENTERPRISE_SITE_KEY` esta configurada en produccion
- [ ] Verificar que Firebase Console tiene App Check enforcement activado para Firestore
- [ ] No exponer debug tokens en codigo fuente ni en logs
- [ ] Documentar que staging NO tiene App Check y que el riesgo es aceptado
- [ ] Verificar que `assertAdmin()` sigue siendo la defensa primaria para admin callables (email + `email_verified` + `ADMIN_EMAIL`)
- [ ] Confirmar que rate limiting server-side (`_rateLimits`, 5/min/user) sigue activo como capa adicional

---

## Offline

### Data flows

| Operacion | Tipo (read/write) | Estrategia offline | Fallback UI |
|-----------|-------------------|-------------------|-------------|
| Callable functions con App Check | write | N/A -- callables requieren conexion | Error de red manejado por `withOfflineSupport` |

### Checklist offline

- [x] Reads de Firestore: usan persistencia offline (no afectado por este cambio)
- [x] Writes: tienen queue offline via `withOfflineSupport` (callables no se encolan, solo writes directos)
- [ ] APIs externas: App Check token refresh requiere red -- Firebase SDK maneja retry automatico
- [x] UI: no se necesita indicador adicional (el error de callable ya muestra toast)
- [x] Datos criticos: no aplica (este cambio es server-side)

### Esfuerzo offline adicional: S

---

## Modularizacion

Este cambio es puramente server-side (Cloud Functions) y de configuracion. No afecta componentes de UI ni hooks del frontend.

### Checklist modularizacion

- [x] Logica de negocio en hooks/services (no inline en componentes de layout) -- no aplica, cambio server-side
- [x] Componentes nuevos son reutilizables fuera del contexto actual de layout -- no se crean componentes
- [x] No se agregan useState de logica de negocio a AppShell o SideMenu
- [x] Props explicitas en vez de dependencias implicitas a contextos de layout -- no aplica
- [x] Cada prop de accion tiene un handler real especificado -- no aplica

---

## Success Criteria

1. `ENFORCE_APP_CHECK_ADMIN` vuelve a ser `!IS_EMULATOR`, bloqueando requests sin App Check token a todas las admin callables en produccion
2. `ENFORCE_APP_CHECK` es configurable via variable de entorno, habilitado en produccion y deshabilitado en staging/emuladores
3. Callable functions en produccion rechazan requests sin App Check token valido con error 401/UNAUTHENTICATED
4. Emuladores y staging siguen funcionando sin App Check (sin regresion en flujo de desarrollo)
5. `docs/reference/security.md` actualizado reflejando el nuevo estado de enforcement
