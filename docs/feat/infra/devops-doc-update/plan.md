# Plan: devops.md missing staging workflow, Sentry, and incorrect commands

**Specs:** [specs.md](specs.md)
**Fecha:** 2026-03-29

---

## Fases de implementacion

### Fase 1: Actualizar docs/reference/devops.md

**Branch:** `fix/225-devops-doc-update`

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `docs/reference/devops.md` | Agregar `VITE_SENTRY_DSN`, `VITE_FIRESTORE_DATABASE_ID`, `VITE_FIREBASE_MEASUREMENT_ID`, `VITE_ADMIN_EMAIL` a la seccion de env vars frontend, con comentarios descriptivos |
| 2 | `docs/reference/devops.md` | Agregar nueva subseccion "### CI/CD (`secrets`)" debajo de env vars de Cloud Functions, documentando `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT` como env vars de CI (no VITE_) |
| 3 | `docs/reference/devops.md` | Corregir fila de `npm run seed` en tabla de Scripts: actualizar descripcion para reflejar que copia `seed-admin-data.ts` a `functions/`, ejecuta con tsx, y limpia |
| 4 | `docs/reference/devops.md` | Agregar fila `npm run test:coverage` a tabla de Scripts: "Vitest single run con coverage (enforces 80% thresholds en CI)" |
| 5 | `docs/reference/devops.md` | En seccion CI/CD, paso 5: cambiar `npm run test:run` a `npm run test:coverage` para reflejar lo que `deploy.yml` realmente ejecuta |
| 6 | `docs/reference/devops.md` | Agregar subseccion "### Staging (`deploy-staging.yml`)" en CI/CD documentando: trigger (push a `staging`), `pre-staging-check.sh` en lint, tests sin coverage, deploy condicional de functions (`git diff`), `deploy-staging-rules.sh` para rules a DB staging, `VITE_FIRESTORE_DATABASE_ID=staging` hardcodeado, deploy a `hosting:staging`. Incluir cross-reference a `docs/reference/staging.md` |
| 7 | `docs/reference/devops.md` | Agregar al final de la seccion de CI/CD produccion el paso de minVersion: chequeo condicional de cambios en `src/` o `functions/`, ejecucion de `node scripts/update-min-version.js` para actualizar `config/appVersion.minVersion` en Firestore |

### Fase 2: Verificacion cruzada

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `package.json` | Solo lectura -- verificar que todos los scripts documentados existen y coinciden |
| 2 | `.github/workflows/deploy.yml` | Solo lectura -- verificar env vars, test commands, pasos documentados |
| 3 | `.github/workflows/deploy-staging.yml` | Solo lectura -- verificar diferencias documentadas correctamente |
| 4 | `.github/workflows/preview.yml` | Solo lectura -- verificar que la seccion de preview es correcta |

### Fase 3: Documentacion (OBLIGATORIA)

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `docs/_sidebar.md` | Agregar entradas de Specs y Plan bajo DevOps Doc Update |

---

## Orden de implementacion

1. `docs/reference/devops.md` -- todos los cambios (pasos 1-7 de Fase 1) en una sola edicion
2. Verificacion cruzada contra archivos fuente (Fase 2, solo lectura)
3. `docs/_sidebar.md` -- agregar entradas de specs y plan (Fase 3)

---

## Estimacion de tamano de archivos

| Archivo | Lineas actuales | Lineas estimadas post-cambio | Excede 400? |
|---------|----------------|------------------------------|-------------|
| `docs/reference/devops.md` | 135 | ~210 | No |

---

## Riesgos

1. **Drift futuro**: devops.md puede volver a quedar desactualizado cuando se modifiquen workflows o env vars. **Mitigacion**: el merge skill (Phase 1i) y el specs-plan-writer ya verifican consistencia de docs. Agregar devops.md como doc a actualizar en la fase final de documentacion de features que toquen CI/CD.

2. **Informacion duplicada con staging.md**: la nueva seccion de staging en devops.md podria diverger de staging.md con el tiempo. **Mitigacion**: mantener devops.md como resumen con cross-reference explicito, sin duplicar detalles operativos (como el procedimiento REST API de deploy de rules).

---

## Guardrails de modularidad

N/A -- Feature de documentacion. No agrega codigo al proyecto.

## Fase final: Documentacion (OBLIGATORIA)

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `docs/_sidebar.md` | Agregar Specs y Plan bajo DevOps Doc Update |

Los demas docs de referencia no requieren actualizacion porque el cambio es a devops.md mismo.

## Criterios de done

- [ ] devops.md documenta los 3 workflows de CI/CD: `deploy.yml`, `preview.yml`, y `deploy-staging.yml`
- [ ] Todos los comandos de scripts coinciden con `package.json`
- [ ] Test command en CI produccion dice `test:coverage`, no `test:run`
- [ ] `VITE_SENTRY_DSN`, `VITE_FIRESTORE_DATABASE_ID`, `VITE_FIREBASE_MEASUREMENT_ID`, `VITE_ADMIN_EMAIL` estan documentadas
- [ ] `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT` documentadas como env vars de CI
- [ ] Paso de minVersion documentado en CI produccion
- [ ] Cross-reference a staging.md presente y correcto
- [ ] No se exponen valores reales de secrets en la documentacion
- [ ] Sidebar actualizada con Specs y Plan
- [ ] Markdown lint pasa sin errores
