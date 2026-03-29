# PRD: devops.md missing staging workflow, Sentry, and incorrect commands

**Feature:** devops-doc-update
**Categoria:** infra
**Fecha:** 2026-03-29
**Issue:** #225
**Prioridad:** Media

---

## Contexto

El archivo `docs/reference/devops.md` es la referencia principal de DevOps del proyecto (variables de entorno, scripts, CI/CD, flujo de feature). Tiene discrepancias significativas con la configuracion real: no documenta el staging workflow (`deploy-staging.yml`), tiene comandos incorrectos, y le faltan variables de entorno activamente usadas como `VITE_SENTRY_DSN`, `VITE_FIRESTORE_DATABASE_ID` y `VITE_FIREBASE_MEASUREMENT_ID`.

## Problema

- El staging workflow (`deploy-staging.yml`) esta completamente ausente de devops.md, a pesar de ser una pieza clave del pipeline de CI/CD documentada por separado en `docs/reference/staging.md`. Un desarrollador leyendo devops.md no sabria que staging existe.
- Los comandos documentados para tests en CI (`npm run test:run`) y seed (`npm run seed`) no coinciden con los que realmente se ejecutan (`npm run test:coverage` y `node scripts/seed-admin-data.mjs` respectivamente).
- Variables de entorno criticas como Sentry DSN, Firestore database ID para staging, Firebase Measurement ID, y el paso de minVersion update en produccion no estan documentadas, creando riesgo de configuracion incompleta en nuevos entornos o al onboardear contribuidores.

## Solucion

### S1. Agregar seccion de staging workflow

Documentar `deploy-staging.yml` en la seccion de CI/CD de devops.md, incluyendo:

- Trigger (push a branch `staging`)
- Steps diferenciadores: `pre-staging-check.sh`, conditional function deployment via `git diff`, `deploy-staging-rules.sh`
- Cross-reference a `docs/reference/staging.md` para detalles de la base de datos y patrones de Cloud Functions

### S2. Corregir comandos incorrectos

Actualizar la tabla de scripts y la seccion de CI/CD:

| Item | Actual en doc | Correcto |
|------|---------------|----------|
| Tests en CI (deploy.yml) | `npm run test:run` | `npm run test:coverage` |
| Seed | `npm run seed` | `node scripts/seed-admin-data.mjs` |
| Auto-seed en dev-env.sh | No documentado | Documentar que `start` hace auto-seed |

### S3. Agregar variables de entorno faltantes

Agregar a la seccion de variables de entorno frontend:

- `VITE_SENTRY_DSN` -- DSN de Sentry para error tracking (configurado en deploy.yml)
- `VITE_FIRESTORE_DATABASE_ID` -- ID de base de datos Firestore (usado en staging para apuntar a DB separada)
- `VITE_FIREBASE_MEASUREMENT_ID` -- ID de medicion de Firebase Analytics (GA4)

Agregar a la seccion de CI/CD de produccion:

- Paso de minVersion Firestore update post-deploy

---

## Scope

| Item | Prioridad | Esfuerzo |
|------|-----------|----------|
| S1. Seccion staging workflow en devops.md | Alta | S |
| S2. Corregir comandos incorrectos (scripts + CI) | Alta | S |
| S3. Agregar env vars faltantes + minVersion step | Media | S |

**Esfuerzo total estimado:** S

---

## Out of Scope

- Reescribir completamente devops.md o cambiar su estructura general
- Documentar configuracion de Sentry (proyecto, DSN, alertas) -- eso pertenece a un doc separado de observabilidad si se necesita
- Cambiar los workflows de CI/CD en si mismos -- este issue es solo de documentacion
- Unificar devops.md con staging.md -- son documentos complementarios con distinto alcance

---

## Tests

Este feature es puramente de documentacion. No hay codigo nuevo que testear.

### Archivos que necesitaran tests

| Archivo | Tipo | Que testear |
|---------|------|-------------|
| N/A | N/A | No hay codigo nuevo -- solo cambios en `docs/reference/devops.md` |

### Criterios de testing

- Verificar manualmente que los comandos documentados coinciden con los scripts reales en `package.json` y los workflows en `.github/workflows/`
- Verificar que las env vars listadas coinciden con las usadas en `deploy.yml` y `deploy-staging.yml`
- Verificar que el cross-reference a `staging.md` es correcto

---

## Seguridad

Este feature es de documentacion interna. No introduce superficies de ataque nuevas.

- [ ] No exponer valores reales de env vars (solo nombres con placeholder)
- [ ] No incluir secretos, tokens ni credenciales en la documentacion
- [ ] Verificar que los nombres de service accounts esten anonimizados o sean genericos

### Vectores de ataque automatizado

| Superficie | Ataque posible | Mitigacion requerida |
|-----------|---------------|---------------------|
| N/A | N/A | Feature de documentacion, sin superficie expuesta |

---

## Deuda tecnica y seguridad

No hay issues abiertos de seguridad ni tech debt relacionados directamente con este feature de documentacion.

### Issues relacionados

| Issue | Relacion | Accion |
|-------|----------|--------|
| N/A | N/A | Sin issues abiertos de security o tech debt al momento |

### Mitigacion incorporada

La actualizacion de devops.md en si misma es una reduccion de deuda tecnica de documentacion. Mantener documentacion sincronizada con la realidad previene errores de configuracion y facilita onboarding.

---

## Offline

N/A -- Este feature es de documentacion. No involucra data flows ni UI.

### Data flows

| Operacion | Tipo (read/write) | Estrategia offline | Fallback UI |
|-----------|-------------------|-------------------|-------------|
| N/A | N/A | N/A | N/A |

### Checklist offline

N/A -- Sin impacto en funcionalidad offline de la app.

### Esfuerzo offline adicional: N/A

---

## Modularizacion y % monolitico

N/A -- Este feature es de documentacion. No agrega codigo al proyecto.

### Checklist modularizacion

N/A

### Impacto en % monolitico

| Aspecto | Impacto | Justificacion |
|---------|---------|---------------|
| N/A | = | Solo cambia documentacion, sin impacto en codigo |

---

## Success Criteria

1. `docs/reference/devops.md` documenta los 3 workflows de CI/CD: `deploy.yml`, `preview.yml`, y `deploy-staging.yml`
2. Todos los comandos de scripts listados en devops.md coinciden exactamente con los definidos en `package.json` y los usados en los workflows
3. Las variables de entorno `VITE_SENTRY_DSN`, `VITE_FIRESTORE_DATABASE_ID` y `VITE_FIREBASE_MEASUREMENT_ID` estan documentadas con su proposito
4. El paso de minVersion Firestore update esta documentado en la seccion de CI/CD de produccion
5. Existe cross-reference claro entre devops.md y staging.md para evitar duplicacion de informacion
