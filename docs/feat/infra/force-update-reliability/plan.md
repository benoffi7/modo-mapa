# Plan: Force Update Reliability (followup #191)

**PRD:** [prd.md](prd.md) — sellado por Sofia (commit `7bd2f38`, 2026-04-22)
**Specs:** [specs.md](specs.md) — sellado por Diego (commit `d9618b1`, 2026-04-22)
**Fecha:** 2026-04-22
**Autor:** Pablo (specs-plan-writer)

---

## 1. Contexto y scope

El PRD implementa seis cambios coordinados para cerrar los cinco gaps del pipeline force-update (CI → Firestore → cliente → refresh) que hacen que algunos bumps no se propaguen: CI condicional, cache de Firestore, falta de re-check en `visibilitychange`/`online`, SW "waiting" indefinido y ausencia de telemetria de adopcion. Se suma un busy-flag (`withBusyFlag`) para no interrumpir uploads/submits in-flight. Los specs resolvieron 13 hallazgos tecnicos de Diego en 2 ciclos: helper en `src/utils/busyFlag.ts` con refcount + heartbeat visibility-aware, `fetchAppVersionConfig` con retries + `source` discriminado, `registerType: 'prompt'` con triple guard, test gate en `main.tsx`, `BUSY_FLAG_MAX_AGE_MS = 180s` (3 min) y test del script CI.

**Estimacion total: L (large) — ~2-3 dias efectivos de implementacion + 1 dia de verificacion staging.** El grueso es integracion de `withBusyFlag` en 15+ callsites con tests nuevos/modificados (muchos componentes no tienen test hoy), mas el refactor del script de CI y el cambio de estrategia de registro del SW.

---

## 2. Fases + pasos atomicos

**Branch:** `feat/force-update-reliability`
**Convencion de agentes:** `luna` = frontend (components/hooks), `nico` = backend/infra (CI, scripts, Cloud Functions, Firestore), `testing` = tests, `documentation` = docs.

### Fase 0 — Refactor precondicion del script CI

> Precede a Fase 1 porque el test del script requiere inyeccion de dependencias (Admin SDK + package.json + flag --set). Bloquea cualquier paso de test en Fase 7.

| Paso | Archivo | Cambio | Agente | Test |
|------|---------|--------|--------|------|
| 0.1 | `scripts/update-min-version.js` | Refactorizar a funciones inyectables exportadas: `readPackageVersion(path?)`, `getDb()`, `resolveVersion(argv, pkgVersion)`, `run({ db?, version? })`. Guard de ejecucion directa con `import.meta.url === ... file://${process.argv[1]}`. Agregar parseo del flag `--set=X.Y.Z` con validacion regex `^\d+\.\d+\.\d+$`; exit code 1 si `--set=bad`. Mantener comportamiento default sin flag (lee `pkg.version`). | nico | Cubierto en 7.2 |

Rollback: `git checkout scripts/update-min-version.js` — el script anterior es funcionalmente equivalente para el path default.

---

### Fase 1 — Constantes, tipos base y evento analytics

> Los pasos de esta fase son independientes entre si y se pueden ejecutar en paralelo. Son precondicion de toda la Fase 2+.

| Paso | Archivo | Cambio | Agente | Test |
|------|---------|--------|--------|------|
| 1.1 | `src/constants/timing.ts` | Agregar `PWA_FALLBACK_GRACE_MS = 60 * 60 * 1000`, `BUSY_FLAG_MAX_AGE_MS = 3 * 60 * 1000` (180s), `BUSY_FLAG_HEARTBEAT_MS = 30 * 1000`. | luna | — |
| 1.2 | `src/constants/storage.ts` | Agregar tres keys: `STORAGE_KEY_FORCE_UPDATE_LAST_CHECK` (localStorage), `STORAGE_KEY_FORCE_UPDATE_BUSY` (sessionStorage), `STORAGE_KEY_APP_VERSION_EVENT_EMITTED` (sessionStorage). Copiar JSDoc de specs §"Nuevas claves de storage". | luna | — |
| 1.3 | `src/constants/analyticsEvents/system.ts` | Agregar `export const EVT_APP_VERSION_ACTIVE = 'app_version_active'`. El barrel `index.ts` ya re-exporta desde `system.ts` (grep-verificado). | luna | — |
| 1.4 | `src/services/config.ts` (tipo solamente) | Extender `AppVersionConfig` con `updatedAt?: Timestamp` y `source: 'server' \| 'server-retry' \| 'cache' \| 'empty'`. Import de `Timestamp` desde `firebase/firestore`. No tocar la logica todavia (va en Fase 2). | luna | — |

Rollback: revert individual de cada archivo — ninguno introduce comportamiento.

---

### Fase 2 — Helper `busyFlag` y servicio `fetchAppVersionConfig`

> Precede Fase 3 (el hook consume ambos). Ambos pasos son independientes entre si y paralelizables.

| Paso | Archivo | Cambio | Agente | Test |
|------|---------|--------|--------|------|
| 2.1 | `src/utils/busyFlag.ts` **(nuevo)** | Implementar segun specs §"Servicios > withBusyFlag y isBusyFlagActive": `withBusyFlag(kind, fn)`, `isBusyFlagActive()`, helpers privados `readFlag`/`writeFlag`/`incrementBusyFlag`/`decrementBusyFlag`/`refreshBusyFlagIfVisible`. Exports `_writeBusyFlag`/`_readBusyFlag` para tests. Heartbeat solo refresca si `document.visibilityState === 'visible'`. Refcount para concurrencia. `finally` libera en success/fail/AbortError. | luna | 2.2 |
| 2.2 | `src/utils/busyFlag.test.ts` **(nuevo)** | Todos los casos de specs §Tests: prende/apaga en success; libera en `AbortError`; stale >180s → `false`; count=0 → `false`; JSON malformado → `false` sin crashear; heartbeat refresca con `visibilityState='visible'`; heartbeat no-op con `'hidden'`; refcount con dos `withBusyFlag` concurrentes. Usar `vi.useFakeTimers()` + `vi.setSystemTime()`. | testing | — |
| 2.3 | `src/services/config.ts` | Implementar retry pattern de specs §"Servicios > fetchAppVersionConfig": 1 intento + 2 retries con backoff `[500, 1500]` ms en `FirestoreError` `unavailable`/`deadline-exceeded`. Fallback a `getDoc` tras 3 fallos retryables. Error no-retryable → salto directo a cache. Retorna `source: 'server' \| 'server-retry' \| 'cache' \| 'empty'`. `logger.warn` (no `.error`) en fallback. | luna | 2.4 |
| 2.4 | `src/services/config.test.ts` (modificar) | Agregar casos de specs §Tests fila "config.test.ts": (a) happy server `source: 'server'`; (b) resuelve en intento 2 tras `unavailable` (`source: 'server-retry'`, backoff verificado con fake timers); (c) 3 fallos retryables → fallback cache (`source: 'cache'`); (d) error no-retryable salta directo a cache; (e) doc no existe → `{ minVersion: undefined, source: 'empty' }`; (f) cache tambien falla → re-throw. | testing | — |

Rollback: el proyecto funciona sin `busyFlag.ts` (no referenciado aun). Rollback de `config.ts` al estado con `getDoc` directo.

---

### Fase 3 — Hook `useForceUpdate` refactor

> Consume Fase 1 (constantes + storage keys) y Fase 2 (`isBusyFlagActive`). Bloquea Fase 5 (fallback PWA requiere `STORAGE_KEY_FORCE_UPDATE_LAST_CHECK` seteado por el hook).

| Paso | Archivo | Cambio | Agente | Test |
|------|---------|--------|--------|------|
| 3.1 | `src/hooks/useForceUpdate.ts` | Cambios PRD 2, 3, 4, 5 + specs §Hooks: (a) `checkVersion` retorna `{ status, minVersion, source }`; (b) escribe `STORAGE_KEY_FORCE_UPDATE_LAST_CHECK = String(Date.now())` al final de cada check incluso en `'error'`; (c) early-return `'up-to-date'` si `isBusyFlagActive() === true` (log info); (d) agrega listeners `document.visibilitychange` (solo dispara `run()` cuando `state === 'visible'`) y `window.online`; cleanup en el return del `useEffect`; (e) emite `EVT_APP_VERSION_ACTIVE` una sola vez por sesion **solo si** `source ∈ {'server', 'server-retry', 'empty'}` y `status ∈ {'up-to-date', 'reloading', 'limit-reached'}`; payload `{ version: __APP_VERSION__, minVersionSeen, gap, source }`; guard con `STORAGE_KEY_APP_VERSION_EVENT_EMITTED` seteado **despues** de emitir. Mantiene API publica `{ updateAvailable }`. | luna | 3.2 |
| 3.2 | `src/hooks/useForceUpdate.test.ts` (modificar) | Agregar tests de specs §Tests fila "useForceUpdate.test.ts": LAST_CHECK se escribe en todos los paths (up-to-date, reloading, limit-reached, error); listener visibilitychange dispara `run()` con state `visible`, no con `hidden`; listener `online` dispara `run()`; `EVT_APP_VERSION_ACTIVE` se emite con `source ∈ {server, server-retry, empty}` y status `≠ error`; no se emite en `source: cache` ni `status: error`; flag one-shot setea solo despues de emision exitosa; con `isBusyFlagActive() === true` NO recarga aunque haya gap. `sessionStorage.clear()` + `localStorage.clear()` en `beforeEach`. Usar `Object.defineProperty(document, 'visibilityState', ...)` y `window.dispatchEvent(new Event('online'))`. | testing | — |

Rollback: git revert del hook; la API publica no cambia, solo el comportamiento interno.

---

### Fase 4 — Catalogos GA4

> Independiente; solo depende de Fase 1.3 (constante `EVT_APP_VERSION_ACTIVE`). Asignar UN owner (`luna`) para evitar conflictos de edicion en `ga4FeatureDefinitions.ts`.

| Paso | Archivo | Cambio | Agente | Test |
|------|---------|--------|--------|------|
| 4.1 | `src/components/admin/features/ga4FeatureDefinitions.ts` | En linea ~173, agregar `'app_version_active'` al array `eventNames` del feature existente `force_update` (grupo `system`). NO crear card separado — decision tecnica en specs §"Decisiones tecnicas #5". | luna | 4.2 |
| 4.2 | `src/components/admin/features/__tests__/ga4FeatureDefinitions.test.ts` (modificar) | Agregar assert: `const forceUpdate = ... find(c => c.id === 'system').features.find(f => f.key === 'force_update'); expect(forceUpdate.eventNames).toContain('app_version_active')`. | testing | — |
| 4.3 | `functions/src/admin/analyticsReport.ts` | Linea 127-130 (seccion `// System`), agregar `'app_version_active'` **inmediatamente despues** de `'force_update_limit_reached'` (orden: agrupado por sub-dominio, los 3 eventos de force-update juntos). | nico | — |

Rollback: revert de los tres archivos; los nuevos eventos dejarian de aparecer en admin pero no rompen nada.

---

### Fase 5 — Registro PWA manual (Cambio 4)

> Consume Fase 1, Fase 2 (`isBusyFlagActive`) y Fase 3 (hook escribe `LAST_CHECK`). **No paralelizar con Fase 3** — si el fallback se deploya antes del hook, el grace guard falla porque `LAST_CHECK` nunca se setea, y el fallback dispara prematuramente.

| Paso | Archivo | Cambio | Agente | Test |
|------|---------|--------|--------|------|
| 5.1 | `vite.config.ts` | Cambiar `registerType: 'autoUpdate'` a `registerType: 'prompt'`. Mantener el resto de la config `VitePWA` intacta. | luna | — |
| 5.2 | `src/pwa/registerPwa.ts` **(nuevo, carpeta nueva)** | Implementar exactamente como specs §"Estrategia de registro del Service Worker": `registerSW` con `immediate: true`, `onNeedRefresh` con triple guard (`isCooldownActive`, `isBusyFlagActive`, `isHookAlive`), `updateSW(true)` + escribe `STORAGE_KEY_FORCE_UPDATE_LAST_REFRESH`. `onOfflineReady` no-op. Early-return en `import.meta.env.DEV`. Usa `logger.log` para cada path de defer. | luna | 5.4 |
| 5.3 | `src/main.tsx` | Importar `registerPwa` desde `./pwa/registerPwa` e invocar despues de `initSentry()`. | luna | 5.5 |
| 5.4 | `src/pwa/registerPwa.test.ts` **(nuevo)** | Mockear `virtual:pwa-register` con `vi.mock('virtual:pwa-register', () => ({ registerSW: vi.fn(() => vi.fn()) }))`. Casos de specs §Tests: `immediate: true`; `onNeedRefresh` respeta cooldown (no llama `updateSW(true)` si <5 min); respeta busy-flag; respeta hook-grace (no llama si LAST_CHECK <60 min); llama `updateSW(true)` + escribe LAST_REFRESH cuando las 3 condiciones se cumplen; DEV retorna sin registrar. | testing | — |
| 5.5 | `src/main.test.ts` **(nuevo)** | Gate test: `vi.mock('./pwa/registerPwa', () => ({ registerPwa: vi.fn() }))` + `vi.mock('./config/sentry', ...)` + `vi.mock('react-dom/client', ...)`. Importar `./main` (side-effect) y verificar `registerPwa` invocado 1 vez. Previene regresion IMPORTANTE #9. | testing | — |

Rollback: revert de `vite.config.ts` a `autoUpdate` + borrar `src/pwa/`. El comportamiento vuelve al baseline pre-feature (perdemos el fallback pasivo pero el hook de Firestore sigue funcionando).

---

### Fase 6 — Integracion de `withBusyFlag` en callsites

> Consume Fase 2 (`withBusyFlag` ya disponible). Paralelizable por archivo. **Regla dura reiterada:** `withBusyFlag` va en el callsite (hook/component) — NUNCA en el service. `syncEngine` no se toca.

**Hooks:**

| Paso | Archivo | Cambio | Agente | Test |
|------|---------|--------|--------|------|
| 6.1 | `src/hooks/useBusinessRating.ts` | Linea 94 (`handleRate`): envolver el bloque `await withOfflineSupport(..., () => upsertRating(...))` (linea 98) con `withBusyFlag('rating_submit', async () => { ... })`. Linea 139 (`handleCriterionRate`): envolver `upsertCriteriaRating` con `withBusyFlag('rating_submit', ...)`. | luna | 6.2 |
| 6.2 | `src/hooks/useBusinessRating.test.ts` **(nuevo — no existe)** | Crear test minimo: mount del hook + spy `vi.mock('../utils/busyFlag', () => ({ withBusyFlag: vi.fn((_, fn) => fn(() => {})), isBusyFlagActive: vi.fn(() => false) }))`. Verificar que `withBusyFlag` es llamado con `kind: 'rating_submit'` al invocar `handleRate` y `handleCriterionRate`. Sin coverage full de render — dimension S (≤50 LOC). | testing | — |
| 6.3 | `src/hooks/useCommentListBase.ts` | Linea 141 (`handleSubmitReply`): envolver el bloque `await withOfflineSupport(..., () => addComment(...))` con `withBusyFlag('comment_submit', ...)`. NO tocar `handleToggleLike` (es toggle optimista, explicitamente excluido en specs). | luna | 6.4 |
| 6.4 | `src/hooks/__tests__/useCommentListBase.test.ts` (modificar) | Agregar caso: `handleSubmitReply` invoca `withBusyFlag` con `kind: 'comment_submit'`. Spy sobre el helper (ya mockeable por patron establecido en 6.2). | testing | — |
| 6.5 | `src/hooks/useCheckIn.ts` | Lineas 98 y 125: envolver ambos `withOfflineSupport` (create + delete) con `withBusyFlag('checkin_submit', ...)`. | luna | 6.6 |
| 6.6 | `src/hooks/useCheckIn.test.ts` (modificar) | Agregar casos para ambos callsites. Mock pattern igual que 6.2. | testing | — |

**Componentes (tests minimos):**

Los siguientes componentes **no tienen test hoy** (Diego lo confirmo); el plan dimensiona cada test como S (mount + spy sobre `withBusyFlag`). Coverage parcial es aceptable per specs §"Cobertura esperada".

| Paso | Archivo | Cambio | Agente | Test |
|------|---------|--------|--------|------|
| 6.7 | `src/components/profile/FeedbackForm.tsx` | `handleSubmit` (linea 80): envolver cuerpo del `try` (`sendFeedback(...)`) con `withBusyFlag('feedback_submit', async () => { ... })`. Service intacto. | luna | 6.8 |
| 6.8 | `src/components/profile/FeedbackForm.test.tsx` **(nuevo)** | Mount minimo; usuario completa form y submit; verificar `withBusyFlag` invocado con `'feedback_submit'`. Mockear `sendFeedback` y `useAuth`. | testing | — |
| 6.9 | `src/components/business/MenuPhotoUpload.tsx` | `handleSubmit` (linea 38): envolver `uploadMenuPhoto(...)` con `withBusyFlag('menu_photo_upload', async (heartbeat) => { ... })`. Wirear `heartbeat()` dentro del callback `onProgress` que se pasa a `uploadMenuPhoto` — el service ya expone `onProgress` (verificado en `menuPhotos.test.ts`). Service intacto. | luna | 6.10 |
| 6.10 | `src/components/business/MenuPhotoUpload.test.tsx` **(nuevo)** | Mount + mock `uploadMenuPhoto` para que invoque `onProgress` varias veces; verificar `withBusyFlag` invocado con `'menu_photo_upload'`; spy sobre `_writeBusyFlag` para confirmar que `heartbeat` refresca `startedAt`. | testing | — |
| 6.11 | `src/components/business/BusinessComments.tsx` | `handleSubmitText` (line 123): envolver el `await withOfflineSupport(..., () => addComment(...))` con `withBusyFlag('comment_submit', ...)`. | luna | Covered by 6.4 (mismo kind, mismo patron) + smoke manual. No test nuevo. |
| 6.12 | `src/components/lists/CreateListDialog.tsx` | `handleCreate` (linea 39): envolver `await createList(user.uid, name, desc, selectedIcon)` con `withBusyFlag('list_create', ...)`. | luna | 6.13 |
| 6.13 | `src/components/lists/CreateListDialog.test.tsx` **(nuevo)** | Mount + llenar form + submit; verificar `withBusyFlag('list_create', ...)`. Mock `createList`. | testing | — |
| 6.14 | `src/components/business/AddToListDialog.tsx` | `handleCreate` (linea 110): envolver el bloque `createList` + `addBusinessToList` con `withBusyFlag('list_create', ...)`. | luna | 6.15 |
| 6.15 | `src/components/business/AddToListDialog.test.tsx` **(nuevo)** | Mount + submit crear lista + agregar business; verificar `withBusyFlag('list_create', ...)` llamado una vez cubriendo ambos services. | testing | — |
| 6.16 | `src/components/auth/ChangePasswordDialog.tsx` | `handleSubmit` (linea 55): envolver `await changePassword(currentPassword, newPassword)` con `withBusyFlag('password_change', ...)`. | luna | 6.17 |
| 6.17 | `src/components/auth/ChangePasswordDialog.test.tsx` (modificar — existe) | Agregar caso: al submitear, `withBusyFlag` se invoca con `'password_change'`. Mock del service. | testing | — |
| 6.18 | `src/components/auth/NameDialog.tsx` | `handleSubmit` (linea 31): envolver `await setDisplayName(name.trim())` con `withBusyFlag('profile_save', ...)`. | luna | 6.19 |
| 6.19 | `src/components/auth/NameDialog.test.tsx` **(nuevo)** | Mount + submit; verificar `withBusyFlag('profile_save', ...)`. Mock `AuthContext.setDisplayName`. | testing | — |
| 6.20 | `src/components/auth/EmailPasswordDialog.tsx` | **Decision autonoma (Diego observo line mismatch):** el `handleSubmit` en `:137` solo delega a `handleRegister`/`handleLogin`. Los submits reales (que escriben displayName + credenciales) estan en esos dos handlers. Envolver **ambos**: `handleRegister` completo y `handleLogin` completo con `withBusyFlag('profile_save', async () => { ... })`. Esto captura correctamente el "submit explicito del usuario" para ambos tabs. | luna | 6.21 |
| 6.21 | `src/components/auth/EmailPasswordDialog.test.tsx` (modificar — existe) | Agregar casos: tab `register` submit → `withBusyFlag('profile_save', ...)`; tab `login` submit → idem. | testing | — |
| 6.22 | `src/components/profile/EditDisplayNameDialog.tsx` | `handleSave`: envolver `await setDisplayName(trimmed)` con `withBusyFlag('profile_save', ...)`. | luna | 6.23 |
| 6.23 | `src/components/profile/EditDisplayNameDialog.test.tsx` **(nuevo)** | Mount + submit; verificar `withBusyFlag('profile_save', ...)`. | testing | — |
| 6.24 | `src/components/lists/InviteEditorDialog.tsx` | **Path corregido (Diego):** componente real es `InviteEditorDialog.tsx` (no `ListEditorsDialog`). Handler `handleInvite` en `:33`. Envolver `await inviteEditor(listId, email.trim())` con `withBusyFlag('list_editor_invite', ...)`. | luna | 6.25 |
| 6.25 | `src/components/lists/InviteEditorDialog.test.tsx` **(nuevo)** | Mount + submit invitacion; verificar `withBusyFlag('list_editor_invite', ...)`. Mock `inviteEditor`. | testing | — |

**Verificacion no-regresion en services:**

| Paso | Archivo | Cambio | Agente | Test |
|------|---------|--------|--------|------|
| 6.26 | `src/services/syncEngine.ts` | **No se modifica.** Verificar via grep post-implementacion que `syncEngine.ts` NO importa `withBusyFlag` de `utils/busyFlag`. Agregar comentario en el plan de revision del PR para que el reviewer confirme. | luna | — |

Rollback por paso: cada envoltura es local y reversible con un `git checkout` del archivo. Si se revierte solo uno, el feature sigue funcionando (solo pierde cobertura busy-flag para ese callsite).

---

### Fase 7 — CI workflow + test del script

> Paralelo con Fase 6 (independientes). Consume Fase 0 (script ya inyectable).

| Paso | Archivo | Cambio | Agente | Test |
|------|---------|--------|--------|------|
| 7.1 | `.github/workflows/deploy.yml` | Lineas 109-120: eliminar el step `Check if src/ or functions/ changed` (y su `id`). Eliminar el `if: steps.check-changes.outputs.changed == 'true'` del step `Update minVersion in Firestore`. Resultado: `update-min-version.js` corre en todo deploy exitoso. | nico | — |
| 7.2 | `scripts/update-min-version.test.js` **(nuevo)** | Runner Vitest (el `exclude` de `vitest.config.ts` no excluye `scripts/` — Diego confirmo; no requiere cambio de config). 5 casos: (a) `readPackageVersion('./fixtures/pkg.json')` retorna `version`; (b) `run({ db: mockDb, version: '2.36.5' })` llama `mockDb.doc('config/appVersion').set` con `{ minVersion: '2.36.5', updatedAt: FieldValue.serverTimestamp() }`; (c) `run` retorna exit code !=0 si el write rechaza (propaga error); (d) `resolveVersion(['--set=2.36.5'], '2.30.0')` retorna `'2.36.5'` (override); (e) `resolveVersion(['--set=bad'], ...)` lanza. Estrategia mock: inyectar `db` directo a `run({db: mock})`, no usar `vi.mock` de `firebase-admin`. | testing | — |

Rollback: revert del workflow restaura check condicional. Borrar el test file.

---

### Fase 8 — Documentacion (obligatoria)

> Consume todas las fases previas. Gate de merge: `rollback.md` DEBE existir antes de aprobar el PR (criterio de aceptacion del PRD + observacion abierta de Sofia).

| Paso | Archivo | Cambio | Agente |
|------|---------|--------|--------|
| 8.1 | `docs/procedures/rollback.md` **(nuevo — gate de merge)** | Crear con contenido exacto de specs §"Decisiones tecnicas #6": cuando hacer rollback, procedimiento en 5 pasos (identificar version, revertir `minVersion` con `--set=X.Y.Z` ANTES del rollback de hosting, rollback hosting, verificar, post-rollback), notas. | documentation |
| 8.2 | `docs/reference/features.md` | Agregar entrada en seccion correspondiente (sistema / updates): "Force update reliability: re-check en visibilitychange + online, busy-flag para uploads in-flight, fallback PWA con triple guard, telemetria `app_version_active`." Una linea, link al PRD. | documentation |
| 8.3 | `docs/reference/patterns.md` | Agregar sub-seccion breve: **Busy-flag pattern** — cuando usarlo (submits explicitos del usuario), cuando NO (toggles optimistas, reads, fire-and-forget), ejemplo de uso con heartbeat para uploads, por que en callsite y no en service (auto-sync). | documentation |
| 8.4 | `docs/reference/project-reference.md` | Actualizar fecha/version segun convencion del repo. | documentation |
| 8.5 | `docs/reference/security.md` | No aplica rules ni rate limits nuevos; **pero** agregar nota breve sobre el vector "Pisa de cache Firestore local" y su mitigacion (`getDocFromServer` con fallback). Mantiene traza auditable. | documentation |
| 8.6 | `docs/_sidebar.md` | Agregar fila `    - [Plan](/feat/infra/force-update-reliability/plan.md)` inmediatamente despues de la existente `    - [Specs](/feat/infra/force-update-reliability/specs.md)` (linea 135). **No** hay cambio user-visible → HelpSection.tsx NO se toca. | documentation |
| 8.7 | `docs/reference/firestore.md` | No se agregan colecciones ni campos en frontend; el doc `config/appVersion` ya esta documentado. Agregar una linea mencionando el campo `updatedAt` (opcional, escrito por CI) si no existe. | documentation |

Rollback: revert de los docs es trivial; no tienen impacto runtime.

---

### Fase 9 — Verificacion manual + quality gates

> Secuencial y terminal. Nada puede fusionarse sin completar esta fase.

| Paso | Accion | Agente | Notas |
|------|--------|--------|-------|
| 9.1 | Pre-push hook local: `tsc -b && vite build` debe pasar (~90s en Pi, normal). | luna | Memoria explicita del usuario. |
| 9.2 | `npm run lint` limpio. | luna | — |
| 9.3 | `npm run test` full suite verde; cobertura de `busyFlag.ts` =100%, `registerPwa.ts` >=90%, `config.ts` =100%, `useForceUpdate.ts` mantiene o supera baseline. | testing | — |
| 9.4 | `npm run build` OK con `registerType: 'prompt'` (verifica que `virtual:pwa-register` resuelve en runtime). | luna | — |
| 9.5 | **Smoke test manual SW post-deploy en staging (obligatorio — observacion Diego #5).** Deployar a staging. Abrir la PWA. Verificar via devtools Application > Service Workers que: (a) `registerSW` corre (hay un SW activo registrado por `vite-plugin-pwa`); (b) push de un cambio dummy (chore: bump) dispara nuevo SW en "waiting"; (c) con el hook vivo (`LAST_CHECK` fresco), el fallback NO activa (permanece en waiting hasta que el hook decida); (d) simulando hook muerto (`localStorage.removeItem(STORAGE_KEY_FORCE_UPDATE_LAST_CHECK)` + esperar >60 min, o adelantar `LAST_CHECK` a `Date.now() - 61*60*1000`), el fallback activa `updateSW(true)` en la siguiente visita a la tab. | luna + Gonzalo | Bloqueante para merge a prod. |
| 9.6 | **Validacion telemetria en staging.** Verificar que `app_version_active` aparece en GA4 Exploration/DebugView una sola vez por sesion, con payload correcto. | luna | — |
| 9.7 | **Validacion de busy-flag manual.** Iniciar upload de foto de menu en staging (red throttled a 3G) → durante el upload, correr `localStorage.setItem('force_update_min_version', '99.99.99')` (o adelantar `minVersion` via script admin a un valor inalcanzable) → verificar: NO hay reload durante el upload; al terminar el upload y pasar `BUSY_FLAG_MAX_AGE_MS`, el proximo tick recarga. | luna + Gonzalo | — |
| 9.8 | Quality gates del skill `/merge`: lint + typecheck + tests + build + audits (seguridad, copy, a11y). | luna | — |
| 9.9 | **Confirmacion Gonzalo:** staging + primer release prod post-merge, no se requirio hard-reset. | Gonzalo | Criterio explicito PRD. |
| 9.10 | Ventana 3 releases: GA4 Exploration sobre `app_version_active` filtrado por `gap=true` < 5% en T0+30min. **Observacion Sofia:** la ventana puede abreviarse por decision manual ante falla evidente. | Gonzalo | Post-merge, no bloqueante para el merge inicial. |

Rollback fase 9: ninguno — son validaciones.

---

## 3. Orden de implementacion

Cadena de dependencias:

1. **Fase 0** (refactor script CI) — bloquea 7.2.
2. **Fase 1** (constantes + tipo) — bloquea Fases 2, 3, 5.
3. **Fase 2** (busyFlag + config retries) — bloquea Fase 3 y Fase 6.
4. **Fase 3** (hook refactor) — bloquea Fase 5 (hook escribe `LAST_CHECK` que el fallback lee).
5. **Fase 4** (catalogos GA4) — paralelo con Fase 3+ (solo depende de 1.3).
6. **Fase 5** (PWA register) — consume 1, 2, 3.
7. **Fase 6** (integracion callsites) — paralelo con 3/4/5 una vez que 2 termino; paralelizable por archivo.
8. **Fase 7** (CI workflow + test script) — paralelo con 6; consume 0.
9. **Fase 8** (docs) — ultima fase editorial antes de merge; consume toda la logica para poder describirla.
10. **Fase 9** (verificacion + gates) — terminal y secuencial.

**Paralelizacion recomendada** (asumiendo 2 implementadores):

- Track A (luna): 0 → 1 → 2.1/2.3 → 3.1 → 5.1/5.2/5.3 → 6.x (ir bajando la tabla).
- Track B (testing): arranca cuando 2.1 termina (2.2) y sigue 2.4, 3.2, 5.4, 5.5, 7.2, 6.2/6.4/6.6/... (tests de cada callsite una vez que el codigo esta).
- Track C (nico): 0 (coordinar con luna), luego 4.3 + 7.1 independientes.
- Track D (documentation): empieza en paralelo con Fase 8 cuando Fase 6 termina al 80%.

## 4. Riesgos

1. **`registerType: 'prompt'` cambia lifecycle del SW — primer deploy tiene comportamiento transicional.** Clientes con SW instalado via `autoUpdate` reciben el SW nuevo por flujo normal de `updateSW`; el primer bump post-merge **puede** ser el ultimo donde el usuario siente el bug (esperado, es el fix). **Mitigacion:** smoke test obligatorio en staging (paso 9.5), observacion de Diego #5. Ventana 3 releases permite detectar si el lifecycle transicional dejo clientes colgados.

2. **Tests de componentes que no existen son dimensionados como "minimos" (mount + spy).** Coverage full de render queda fuera — si el componente tiene regresiones funcionales, este test no las detecta. **Mitigacion:** specs §"Cobertura esperada" acepta cobertura parcial explicitamente; los servicios subyacentes ya tienen tests que cubren la logica de negocio (`menuPhotos.test.ts`, `sendFeedback.test.ts`, etc.). Si aparece bug, se amplia el test en un issue separado.

3. **Refactor del script `update-min-version.js` puede romper CI si el guard de ejecucion directa (`import.meta.url === file://${process.argv[1]}`) no dispara correctamente.** Es codigo top-level que se ejecutaba antes y ahora es condicional. **Mitigacion:** (a) test local del script con `node scripts/update-min-version.js --set=2.36.5` contra un proyecto dummy de Firebase antes de mergear; (b) rollback del workflow es trivial (revert del archivo).

4. **Busy-flag en `EmailPasswordDialog`: decision autonoma de envolver `handleRegister` y `handleLogin` (no el `handleSubmit` delegador).** Si en un refactor futuro alguien los unifica en `handleSubmit`, el wrap se pierde sin que haya falla visible (el flag simplemente no se prende). **Mitigacion:** comentario `// busy-flag: wrap here, handleSubmit only delegates` en el codigo; reglas de copy + audit en PR.

5. **Heartbeat de `uploadMenuPhoto` depende de que `onProgress` dispare suficientemente seguido (<`BUSY_FLAG_MAX_AGE_MS` de 3 min).** En redes muy lentas o con uploads atascados sin progreso visible, el flag puede caducar aunque el upload siga "vivo". **Mitigacion:** el specs acepta este caso (§"Resolucion del tradeoff busy-flag vs uploads largos"); si pasa, el peor caso es que el hook recargue durante un upload atascado → el usuario pierde ese upload, pero la UX en redes tan malas ya es degradada. Se re-evalua con telemetria.

## 5. Ownership entre agentes

Archivos compartidos que requieren owner unico o secuenciacion:

| Archivo | Owner | Razon |
|---------|-------|-------|
| `src/components/admin/features/ga4FeatureDefinitions.ts` | luna (4.1) | Edit de array literal, conflictos triviales pero evitables. |
| `src/constants/analyticsEvents/system.ts` | luna (1.3) | Unico write en este feature. |
| `src/hooks/useForceUpdate.ts` | luna (3.1) | Un solo refactor grande, no fragmentar. |
| `functions/src/admin/analyticsReport.ts` | nico (4.3) | Orden dentro del array `GA4_EVENT_NAMES` es parte del contrato. |
| `src/hooks/__tests__/useCommentListBase.test.ts` | testing (6.4) | Existe, modificar solo en este feature. |
| `src/services/config.ts` | luna (1.4 + 2.3) | Fase 1 solo toca tipos; Fase 2 toca logica. Secuenciado. |
| `vite.config.ts` | luna (5.1) | Un solo cambio puntual. |

Si aparece conflicto con otro feature en curso sobre `ga4FeatureDefinitions.ts` o `system.ts`, resolver via merge manual (son agregados, no re-ordenamientos).

## 6. Test plan consolidado

| Archivo | Estado | Fase |
|---------|--------|------|
| `src/utils/busyFlag.test.ts` | **nuevo** | 2.2 |
| `src/services/config.test.ts` | **modificar** | 2.4 |
| `src/hooks/useForceUpdate.test.ts` | **modificar** | 3.2 |
| `src/components/admin/features/__tests__/ga4FeatureDefinitions.test.ts` | **modificar** | 4.2 |
| `src/pwa/registerPwa.test.ts` | **nuevo** | 5.4 |
| `src/main.test.ts` | **nuevo (gate test)** | 5.5 |
| `src/hooks/useBusinessRating.test.ts` | **nuevo (minimo)** | 6.2 |
| `src/hooks/__tests__/useCommentListBase.test.ts` | **modificar** | 6.4 |
| `src/hooks/useCheckIn.test.ts` | **modificar** | 6.6 |
| `src/components/profile/FeedbackForm.test.tsx` | **nuevo (minimo)** | 6.8 |
| `src/components/business/MenuPhotoUpload.test.tsx` | **nuevo (minimo)** | 6.10 |
| `src/components/lists/CreateListDialog.test.tsx` | **nuevo (minimo)** | 6.13 |
| `src/components/business/AddToListDialog.test.tsx` | **nuevo (minimo)** | 6.15 |
| `src/components/auth/ChangePasswordDialog.test.tsx` | **modificar** | 6.17 |
| `src/components/auth/NameDialog.test.tsx` | **nuevo (minimo)** | 6.19 |
| `src/components/auth/EmailPasswordDialog.test.tsx` | **modificar (existe)** | 6.21 |
| `src/components/profile/EditDisplayNameDialog.test.tsx` | **nuevo (minimo)** | 6.23 |
| `src/components/lists/InviteEditorDialog.test.tsx` | **nuevo (minimo)** | 6.25 |
| `scripts/update-min-version.test.js` | **nuevo** | 7.2 |

**Total tests nuevos:** 14. **Total tests modificados:** 5.

**Coverage target:** 100% en `busyFlag.ts` y `config.ts`; >=90% en `registerPwa.ts`; mantener baseline en hooks/componentes tocados; tests "minimos" de componentes = cobertura de la ruta submit solamente (acceptance documented en specs).

## 7. Rollback por paso

Pasos criticos con rollback declarado:

| Paso | Accion de rollback |
|------|-------------------|
| 0.1 (refactor script) | `git checkout scripts/update-min-version.js` — vuelve al script top-level simple. |
| 5.1 (`registerType: 'prompt'`) | Revertir a `'autoUpdate'`; el `registerPwa()` en main.tsx se vuelve no-op porque `virtual:pwa-register` ya no se usa desde el app (plugin lo maneja internamente). |
| 5.3 (`registerPwa()` en main.tsx) | Comentar la invocacion; combinado con rollback 5.1. |
| 7.1 (deploy.yml) | Revertir al workflow con check condicional. |
| Fase 6 (callsites) | Revert individual por archivo — cada wrap es independiente. |
| Feature completo post-deploy (ver specs §"Migracion / rollout plan") | (a) revertir `vite.config.ts`; (b) quitar wraps de busy-flag (opcional); (c) actualizar `minVersion` a version target via `scripts/update-min-version.js --set=X.Y.Z`. Cambios 1-3 (CI siempre escribe, `getDocFromServer`, listeners) son low-risk y quedan. |

## 8. Estimacion total

| Fase | Effort | Paralelizable? |
|------|--------|---------------|
| 0 — Refactor script | S (1h) | — |
| 1 — Constantes y tipos | S (30 min) | Si, pasos entre si |
| 2 — busyFlag + config | M (3-4h incl tests) | 2.1↔2.3 paralelo |
| 3 — useForceUpdate | M (3-4h incl tests) | Secuencial |
| 4 — Catalogos GA4 | S (1h) | — |
| 5 — PWA register | M (2-3h incl tests) | Secuencial |
| 6 — Callsites (15+) | **L (8-12h incl tests minimos)** | Si, paralelizable por archivo |
| 7 — CI + test script | M (2-3h) | Paralelo con Fase 6 |
| 8 — Docs | S (1-2h) | — |
| 9 — Verificacion | M (half-day staging + manual) | — |

**Total:** ~2-3 dias efectivos de implementacion con 2 implementadores paralelizando, + half-day de verificacion staging. Coherente con rotulo **L** del PRD (y cercano a XL si se incluye la ventana de observacion de 3 releases).

---

## 9. Guardrails de modularidad

- [x] Ningun componente nuevo importa `firebase/firestore` directamente. `registerPwa.ts` solo importa `virtual:pwa-register` + constantes/utils.
- [x] Archivos nuevos en carpetas de dominio correctas: `src/utils/busyFlag.ts`, `src/pwa/registerPwa.ts`, `scripts/update-min-version.test.js`. **No** van a `components/menu/`.
- [x] Logica de negocio en hooks/services, no en componentes. Los wraps de `withBusyFlag` son instrumentacion, no logica.
- [x] Si se toca un archivo con deuda tecnica, se incluye el fix en el plan. **No hay** deuda tecnica abierta sobre los archivos tocados (verificar con `gh issue list --label "tech debt"` al arrancar la implementacion).
- [x] Ningun archivo resultante supera 400 lineas. Estimacion:
  - `src/utils/busyFlag.ts`: ~120 LOC.
  - `src/pwa/registerPwa.ts`: ~60 LOC.
  - `src/services/config.ts`: 25→80 LOC (retries + types).
  - `src/hooks/useForceUpdate.ts`: 150→230 LOC (agrega listeners + emit + busy-flag guard; sigue bajo 400).

## 10. Guardrails de seguridad

- [x] Toda coleccion nueva tiene `hasOnly()` — **no aplica, cero colecciones nuevas.**
- [x] Todo campo string tiene `.size() <= N` — **no aplica, cero campos escritos desde cliente.**
- [x] Admin writes (`update-min-version.js`) no requieren rules (Admin SDK bypasea).
- [x] Counter decrements — no aplica.
- [x] Rate limits — no aplica.
- [x] No hay secrets, admin emails, ni credenciales en archivos commiteados.
- [x] `getCountFromServer` — no se usa.

## 11. Guardrails de observabilidad

- [x] Todo CF trigger nuevo con `trackFunctionTiming` — **no hay CF triggers nuevos.**
- [x] Todo service nuevo con queries Firestore con `measureAsync` — `fetchAppVersionConfig` ya es instrumentable; **opcional** envolver con `measureAsync` si `src/utils/perfMetrics.ts` lo soporta. Decision autonoma: dejarlo fuera — el hook solo corre cada 30 min, metric noise > signal.
- [x] `EVT_APP_VERSION_ACTIVE` registrado en `GA4_EVENT_NAMES` (analyticsReport.ts, paso 4.3).
- [x] `EVT_APP_VERSION_ACTIVE` tiene feature card en `ga4FeatureDefinitions.ts` (bajo feature `force_update` existente, paso 4.1).
- [x] `logger.error` NUNCA dentro de `if (import.meta.env.DEV)` — verificar en 9.2 (`registerPwa.ts` usa `logger.log`, no `.error`; `busyFlag.ts` usa `.warn`).

## 12. Guardrails de accesibilidad y UI

- [x] `<IconButton>` con `aria-label` — **no hay UI nueva.**
- [x] `<Typography onClick>` — **no aplica.**
- [x] Touch targets 44x44 — no aplica.
- [x] Componentes con fetch error state — `useForceUpdate` no expone UI en error; comportamiento inalterado.
- [x] `<img>` con URL dinamica — no aplica.
- [x] `httpsCallable` con guard offline — **no se invoca ningun httpsCallable nuevo.**

## 13. Guardrails de copy

- [x] Voseo — **no hay textos nuevos.**
- [x] Tildes — no aplica.
- [x] Terminologia "comercios" / "reseñas" — no aplica.
- [x] Strings reutilizables en `src/constants/messages/` — no aplica.

---

## 14. Observaciones heredadas

### De Sofia (no bloqueantes, observadas al implementador)

1. **Uploads >90s en red lenta:** el timeout `BUSY_FLAG_MAX_AGE_MS = 180s` + heartbeat visibility-aware cubre el escenario documentado en el PRD. Casos patologicos (>3 min sin progreso) caen al proximo tick del hook — aceptado v1.
2. **Hotfix urgente vs ventana "3 releases" del 95%:** la ventana puede abreviarse por decision manual ante falla evidente (reload en loop, usuarios reportando). El criterio no es commit ciego. Owner: Gonzalo.
3. **`rollback.md` como gate de merge:** el doc DEBE existir en el mismo PR (paso 8.1). Sin el, no se aprueba.

### De Diego (operativas, aplicadas a pasos concretos)

1. **Path real del dialog de invitar editor:** `src/components/lists/InviteEditorDialog.tsx`, handler `handleInvite` en `:33`. Aplicado en paso 6.24.
2. **`EmailPasswordDialog.handleSubmit` en `:137`** (no `:94`) y solo delega a `handleRegister`/`handleLogin`. Decision autonoma (paso 6.20): envolver ambos handlers reales, no el delegador. Comentario en codigo + razon en riesgo #4.
3. **Tests inexistentes** (FeedbackForm, MenuPhotoUpload, CreateListDialog, AddToListDialog, NameDialog, EditDisplayNameDialog, useBusinessRating, InviteEditorDialog, EmailPasswordDialog): dimensionados como "minimos" (mount + spy sobre `withBusyFlag`). Sin exigir coverage full de render. Aceptado en specs §"Cobertura esperada".
4. **`BUSY_FLAG_MAX_AGE_MS = 180s`** (delta vs PRD 90s): aplicado en paso 1.1 y reflejado en tests 2.2. Justificacion en specs §"Nota de coherencia con PRD".
5. **`registerType: 'prompt'` + smoke test SW post-deploy:** paso 9.5 explicito y bloqueante para merge a prod.
6. **`uploadMenuPhoto onProgress` ya expuesto:** heartbeat se wirea en el componente `MenuPhotoUpload.tsx` (paso 6.9), no en el service.
7. **`scripts/` no excluido en `vitest.config.ts`:** paso 7.2 no requiere cambio de config. Confirmado.
8. **Decisiones autonomas del plan** (esperadas por Diego):
   - **Feature GA4:** usar `force_update` existente, no crear card nuevo (paso 4.1 + specs §"Decisiones tecnicas #5").
   - **`EmailPasswordDialog`:** envolver `handleRegister` y `handleLogin` por separado (paso 6.20).
   - **`BusinessComments.tsx` no tiene test nuevo:** usa el mismo kind `'comment_submit'` que `useCommentListBase` (paso 6.11), cubierto por 6.4 + smoke manual.

---

## 15. Criterios de done

- [ ] Todos los items del scope del PRD (Cambios 1-6) implementados.
- [ ] Tests pasan con cobertura >= 80% en codigo nuevo; 100% en `busyFlag.ts` y `config.ts`.
- [ ] `npm run lint` sin errores.
- [ ] `npm run build` OK con `registerType: 'prompt'`.
- [ ] Seed data — no aplica (no hay colecciones nuevas).
- [ ] Privacy policy — no aplica (no hay data collection nueva; `app_version_active` no tiene PII).
- [ ] Reference docs actualizados (`features.md`, `patterns.md`, `security.md`, `project-reference.md`, `firestore.md` si aplica).
- [ ] `docs/procedures/rollback.md` creado (gate).
- [ ] Sidebar actualizado.
- [ ] Smoke test SW manual post-deploy en staging OK (paso 9.5).
- [ ] Validacion manual de busy-flag durante upload OK (paso 9.7).
- [ ] Gonzalo confirma en staging + primer release prod que no requirio hard-reset (paso 9.9).
- [ ] Ventana 3 releases: adopcion >=95% en T0+30min (observacion post-merge; no bloquea el merge inicial).

---

## Validacion de Plan — Pablo

**Estado:** VALIDADO CON OBSERVACIONES
**Revisor:** Pablo (Delivery Lead)
**Fecha:** 2026-04-22
**Ciclos:** 1

### Hallazgos cerrados

**Ciclo 1 (0 bloqueantes, 0 importantes, 6 observaciones):** no se abrio dialogo; todos los hallazgos son de aclaracion operativa que no requieren cambios al cuerpo del plan. Correcciones factuales triviales (OBS #3 y OBS #4) aplicadas directo al plan antes del sello.

- Cobertura specs→plan completa (6 cambios + helper + tests + rollback).
- Orden de fases correcto (0→1→2/3→5, paralelos 4/6/7 con dependencias declaradas en §3).
- Test plan integrado (14 nuevos + 5 modificados distribuidos junto al codigo, no al final).
- Rollback por paso declarado en §7 y por fase.
- Estimacion L coherente con PRD (§8).
- Guardrails 400-LOC verificados por archivo (§9).
- Sofia gate "rollback.md antes de merge" mapeado en 8.1.
- Diego gate "smoke SW post-deploy bloqueante" mapeado en 9.5.

### Observaciones para el/los implementador/es

1. **Paso 8.6 (sidebar):** el cambio en `docs/_sidebar.md` ya esta en el working tree (no commiteado). El agente `documentation` solo commitea; no re-agrega la linea.
2. **Paso 8.4 (project-reference.md):** o citar el campo exacto a actualizar, o marcar este paso como opcional — tal como esta, `documentation` agent no sabe que escribir.
3. **Paso 6.11 (`BusinessComments.tsx`):** referencia explicita `handleSubmitText (line 123)` ya aplicada al plan antes del sello.
4. **Paso 6.21 (`EmailPasswordDialog.test.tsx`):** ajustado a "modificar (existe)" antes del sello.
5. **Coordinacion nico (0.1 ↔ 7.1 ↔ 7.2):** commitear el refactor del script (0.1) antes que el workflow (7.1) para que el test (7.2) pueda correr contra la version inyectable. En un PR unico es trivial; si se splittea, secuenciar.
6. **Branch base:** aclarar si `feat/force-update-reliability` se crea desde `feat/force-update-reliability-specs-plan` (que tiene los docs sellados) o se cherry-pickean los 3 commits de docs a un branch nuevo desde `new-home`. Cuestion operativa, no altera el plan de implementacion.
7. **Paralelizacion sugerida:** `luna` carga 15+ callsites en Fase 6. Si se quiere mas throughput, split luna-A (hooks: 6.1/6.3/6.5) vs luna-B (components: 6.7+) — son totalmente independientes por archivo.

### Listo para implementacion

**Si.** Ninguna observacion bloquea. Plan coherente con PRD+specs, cobertura total, tests integrados, rollback declarado, guardrails verificados. Implementadores (`luna`, `nico`, `testing`, `documentation`) pueden arrancar.
