# Plan: Force App Update

**Specs:** [191-specs.md](191-specs.md)
**Fecha:** 2026-03-26

---

## Fases de implementacion

### Fase 1: Utilidad semver y constantes

**Branch:** `feat/191-force-update`

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `src/utils/version.ts` | Crear archivo con `compareSemver(a, b)` y `isUpdateRequired(required, current)`. Split por `.`, parseInt, compara major > minor > patch. |
| 2 | `src/utils/version.test.ts` | Crear tests: iguales (`"1.0.0"` vs `"1.0.0"` = 0), major mayor (`"2.0.0"` vs `"1.0.0"` = 1), minor mayor (`"1.2.0"` vs `"1.1.0"` = 1), patch mayor (`"1.0.2"` vs `"1.0.1"` = 1), menor en cada nivel, `isUpdateRequired` retorna true/false correctamente, edge case `"0.0.1"` vs `"0.0.0"`. |
| 3 | `src/constants/timing.ts` | Agregar `FORCE_UPDATE_CHECK_INTERVAL_MS = 30 * 60 * 1000` y `FORCE_UPDATE_COOLDOWN_MS = 5 * 60 * 1000`. |
| 4 | `src/constants/storage.ts` | Agregar `SESSION_KEY_FORCE_UPDATE_LAST_REFRESH = 'force_update_last_refresh'`. |
| 5 | `src/constants/analyticsEvents.ts` | Agregar `EVT_FORCE_UPDATE_TRIGGERED = 'force_update_triggered'`. |

### Fase 2: Hook useForceUpdate

| Paso | Archivo | Cambio |
|------|---------|--------|
| 6 | `src/hooks/useForceUpdate.ts` | Crear hook. Importar `db`, `doc`, `getDoc`, `COLLECTIONS`, `isUpdateRequired`, `logger`, `trackEvent`, constantes de timing/storage/analytics. Implementar `checkVersion()` con getDoc, comparacion, cooldown check, `performHardRefresh()` con SW unregister + cache clear + reload. useEffect con setInterval + cleanup. |
| 7 | `src/hooks/useForceUpdate.test.ts` | Crear tests con mocks de firebase, navigator.serviceWorker, caches, window.location.reload, sessionStorage. Casos: version mayor trigger reload, version igual no reload, version menor no reload, doc inexistente no error, getDoc error (offline) no crash, cooldown respetado, interval setup y cleanup. |

### Fase 3: Integracion en App.tsx

| Paso | Archivo | Cambio |
|------|---------|--------|
| 8 | `src/App.tsx` | Agregar `import { useForceUpdate } from './hooks/useForceUpdate'`. Agregar `useForceUpdate()` dentro de `App()` despues de `useScreenTracking()`. |

### Fase 4: Firestore rules

| Paso | Archivo | Cambio |
|------|---------|--------|
| 9 | `firestore.rules` | Agregar regla especifica ANTES de la wildcard `config/{document=**}`: `match /config/appVersion { allow read: if true; allow write: if false; }`. Incluir comentario explicativo. |

### Fase 5: CI/CD pipeline

| Paso | Archivo | Cambio |
|------|---------|--------|
| 10 | `scripts/update-min-version.js` | Crear script Node.js con ESM. Usa `firebase-admin/app` (applicationDefault), `firebase-admin/firestore`. Lee version de `package.json`, escribe `config/appVersion` con `minVersion` y `updatedAt: FieldValue.serverTimestamp()`. |
| 11 | `.github/workflows/deploy.yml` | En job `build-and-deploy-hosting`, despues del step "Deploy to production hosting", agregar step "Update minVersion in Firestore". Condicion: `if: contains(github.event.head_commit.modified, 'src/') || contains(github.event.head_commit.modified, 'functions/')` (o usar `git diff` para detectar cambios en src/functions). Ejecuta: `node scripts/update-min-version.js`. Requiere que `google-github-actions/auth` ya haya corrido (ya esta en el job). |

### Fase 6: Documentacion

| Paso | Archivo | Cambio |
|------|---------|--------|
| 12 | `docs/reference/patterns.md` | Agregar entrada en seccion "Server-side": `Force update check -- useForceUpdate lee config/appVersion, compara con __APP_VERSION__, hard refresh si server > client`. |
| 13 | `docs/reference/firestore.md` | Actualizar tabla de coleccion `config`: agregar doc `appVersion` con campos `minVersion`, `updatedAt` y regla "Read public; write false (Admin SDK only)". |
| 14 | `docs/_sidebar.md` | Agregar bajo la entrada de PRD #167: `- [#191 Force App Update](/prd/191-force-app-update.md)` con sub-entries para Specs y Plan. |

---

## Orden de implementacion

1. `src/utils/version.ts` -- funcion pura sin dependencias
2. `src/utils/version.test.ts` -- verificar la utilidad
3. `src/constants/timing.ts` -- agregar constantes de timing
4. `src/constants/storage.ts` -- agregar key de sessionStorage
5. `src/constants/analyticsEvents.ts` -- agregar evento
6. `src/hooks/useForceUpdate.ts` -- depende de 1, 3, 4, 5
7. `src/hooks/useForceUpdate.test.ts` -- depende de 6
8. `src/App.tsx` -- depende de 6
9. `firestore.rules` -- independiente (puede ser paralelo con 6-8)
10. `scripts/update-min-version.js` -- independiente
11. `.github/workflows/deploy.yml` -- depende de 10
12. `docs/reference/patterns.md` -- despues de implementacion
13. `docs/reference/firestore.md` -- despues de implementacion
14. `docs/_sidebar.md` -- despues de implementacion

---

## Riesgos

### 1. Loop infinito de reloads

**Riesgo:** Si el CDN sirve assets viejos despues del reload, `__APP_VERSION__` sigue siendo vieja y el hook fuerza otro reload.
**Mitigacion:** Cooldown de 5 minutos via `sessionStorage`. Despues de un refresh forzado, no se intenta otro por 5 minutos. Esto da tiempo al CDN para invalidar su cache. Firebase Hosting invalida cache automaticamente en deploy, pero edge caches pueden tener delay.

### 2. Interrupcion de accion del usuario

**Riesgo:** El reload interrumpe al usuario en medio de una operacion (escribiendo un comentario, etc.).
**Mitigacion:** Aceptable segun PRD: la app no tiene formularios largos. Las escrituras a Firestore son atomicas. Si el usuario estaba mid-typing, el texto se pierde (menor impacto). Se puede mitigar en el futuro con un delay configurable.

### 3. Script de CI falla silenciosamente

**Riesgo:** Si el step de CI que escribe `minVersion` falla, los usuarios no seran forzados a actualizar. No es critico (fail-safe), pero podria pasar inadvertido.
**Mitigacion:** El step debe tener `continue-on-error: false` (default en GitHub Actions). Si falla, el workflow se marca como fallido y se notifica. Agregar un `console.log` de confirmacion en el script.

---

## Criterios de done

- [ ] `compareSemver` y `isUpdateRequired` funcionan con todos los edge cases
- [ ] `useForceUpdate` lee `config/appVersion` y fuerza reload cuando `minVersion > __APP_VERSION__`
- [ ] `useForceUpdate` no hace nada si doc no existe, version igual, o version menor
- [ ] Cooldown de 5 min previene loops de reload
- [ ] Firestore rule permite lectura publica de `config/appVersion`
- [ ] Script CI escribe `minVersion` correctamente
- [ ] Workflow deploy.yml ejecuta el script post-deploy condicionalmente
- [ ] Tests pasan con >= 80% coverage en codigo nuevo
- [ ] No lint errors
- [ ] Build succeeds
- [ ] Documentacion actualizada (patterns, firestore, sidebar)
