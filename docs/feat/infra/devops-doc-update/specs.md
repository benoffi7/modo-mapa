# Specs: devops.md missing staging workflow, Sentry, and incorrect commands

**PRD:** [prd.md](prd.md)
**Fecha:** 2026-03-29

---

## Modelo de datos

N/A -- Este feature es puramente de documentacion. No hay cambios en Firestore.

## Firestore Rules

N/A -- Sin cambios en rules.

### Rules impact analysis

N/A -- Sin queries nuevas.

### Field whitelist check

N/A -- Sin campos nuevos.

## Cloud Functions

N/A -- Sin cambios en Cloud Functions.

## Componentes

N/A -- Sin cambios en componentes React.

## Textos de usuario

N/A -- Sin textos user-facing nuevos.

## Hooks

N/A -- Sin cambios en hooks.

## Servicios

N/A -- Sin cambios en servicios.

## Integracion

Este feature modifica un unico archivo: `docs/reference/devops.md`. No impacta codigo fuente.

### Preventive checklist

N/A -- Solo cambios de documentacion.

## Tests

N/A -- Feature de documentacion pura. Verificacion manual contra archivos fuente.

| Archivo test | Que testear | Tipo |
|-------------|-------------|------|
| N/A | N/A | N/A |

### Verificacion manual requerida

Los siguientes archivos fuente deben consultarse para validar la exactitud de la documentacion:

| Archivo fuente | Que verificar |
|---------------|---------------|
| `package.json` (scripts) | Que los comandos documentados coincidan exactamente |
| `.github/workflows/deploy.yml` | Steps, env vars, test commands de produccion |
| `.github/workflows/deploy-staging.yml` | Steps, env vars, diferencias con produccion |
| `.github/workflows/preview.yml` | Steps y permisos del preview workflow |
| `scripts/pre-staging-check.sh` | Que las validaciones documentadas coincidan |
| `scripts/update-min-version.js` | Que el paso de minVersion este documentado correctamente |
| `docs/reference/staging.md` | Que el cross-reference sea correcto y no duplique info |

## Analytics

N/A -- Sin eventos nuevos.

---

## Offline

N/A -- Feature de documentacion.

---

## Decisiones tecnicas

### DT1: No duplicar contenido de staging.md

El staging workflow tiene un documento dedicado (`docs/reference/staging.md`) con detalles sobre la DB staging, patrones de Cloud Functions, limitaciones de triggers, y procedimiento de deploy de rules via REST API. La seccion nueva en devops.md debe ser un resumen con cross-reference, no una copia.

**Alternativa rechazada:** Mover todo el contenido de staging.md a devops.md. Rechazada porque staging.md tiene un alcance mas amplio (patrones de Cloud Functions, limitaciones de triggers) que excede el scope de devops.md.

### DT2: Corregir seed command a la realidad de package.json

El PRD indica que el comando correcto es `node scripts/seed-admin-data.mjs`. Sin embargo, el `package.json` real define `seed` como:

```bash
cp scripts/seed-admin-data.ts functions/seed.ts && cd functions && npx tsx seed.ts; rm -f seed.ts
```

La documentacion debe reflejar que `npm run seed` existe y funciona, pero el script subyacente no es `node scripts/seed-admin-data.mjs` sino una cadena de copia + ejecucion con tsx. Documentaremos `npm run seed` como el comando correcto para el usuario, con una nota sobre lo que hace internamente.

### DT3: Agregar VITE_ADMIN_EMAIL a la lista de env vars

Al revisar `deploy.yml` y `deploy-staging.yml`, se encontro que `VITE_ADMIN_EMAIL` tambien esta inyectada como secret y no esta documentada en devops.md. Se agrega junto con las otras variables faltantes.

### DT4: Agregar variables Sentry de CI

El workflow `deploy.yml` inyecta `SENTRY_AUTH_TOKEN`, `SENTRY_ORG` y `SENTRY_PROJECT` como env vars en el paso de build. Estas no son VITE_ (no llegan al frontend) pero son necesarias para el source map upload de Sentry durante CI. Deben documentarse en una seccion de env vars de CI.

### DT5: Corregir descripcion de test commands en CI

La seccion de CI/CD de devops.md dice que se ejecuta `npm run test:run`. Esto es parcialmente correcto:

- `deploy.yml` (produccion) usa `npm run test:coverage` (con coverage thresholds)
- `deploy-staging.yml` (staging) usa `npm run test:run` (sin coverage)
- `preview.yml` (preview) usa `npm run test:run` (sin coverage)

La documentacion debe reflejar esta diferencia por workflow.

---

## Hardening de seguridad

N/A -- Feature de documentacion. Validar que no se expongan valores reales de secrets, solo nombres de variables con placeholder.

### Checklist de seguridad documental

- [ ] No incluir valores reales de env vars
- [ ] Nombres de service accounts genericos o anonimizados
- [ ] No incluir tokens, DSNs, ni credenciales

---

## Deuda tecnica: mitigacion incorporada

No hay issues abiertos de security ni tech debt al momento.

La actualizacion de devops.md es en si misma una mitigacion de deuda tecnica de documentacion. Las discrepancias acumuladas entre la documentacion y la realidad son una forma de deuda que este feature resuelve.

---

## Cambios concretos a `docs/reference/devops.md`

### C1: Seccion de Variables de entorno -- agregar faltantes

Agregar al bloque de env vars frontend:

```bash
VITE_SENTRY_DSN=                 # DSN de Sentry para error tracking
VITE_FIRESTORE_DATABASE_ID=      # ID de base Firestore (staging: "staging", prod: omitir o "(default)")
VITE_FIREBASE_MEASUREMENT_ID=    # ID de medicion Firebase Analytics (GA4)
VITE_ADMIN_EMAIL=                # Email del admin (usado por AdminGuard en frontend)
```

Agregar nueva subseccion de env vars de CI (no VITE_):

```bash
SENTRY_AUTH_TOKEN=               # Token de Sentry para upload de source maps en CI
SENTRY_ORG=                      # Organizacion de Sentry
SENTRY_PROJECT=                  # Proyecto de Sentry
```

### C2: Tabla de Scripts -- corregir seed

Reemplazar la fila de seed:

| Antes | Despues |
|-------|---------|
| `npm run seed` — Poblar emulador Firestore con datos de prueba | `npm run seed` — Copia `seed-admin-data.ts` a `functions/`, ejecuta con tsx, y limpia. Requiere emuladores corriendo |

Agregar fila de `test:coverage`:

| Comando | Descripcion |
|---------|-------------|
| `npm run test:coverage` | Vitest single run con coverage (enforces 80% thresholds) |

### C3: Seccion CI/CD -- corregir test command en produccion

Cambiar `npm run test:run` a `npm run test:coverage` en la descripcion del paso 5 de deploy.yml.

### C4: Seccion CI/CD -- agregar staging workflow

Nueva subseccion documentando `deploy-staging.yml`:

- **Trigger:** push a branch `staging`
- **Diferencias con produccion:**
  - Lint job incluye `pre-staging-check.sh` (valida patrones problematicos)
  - Tests usan `npm run test:run` (sin coverage enforcement)
  - Rules se deployan a DB `staging` via `scripts/deploy-staging-rules.sh` (REST API)
  - Functions deploy es condicional: solo si `git diff origin/main -- functions/src/ functions/package.json` detecta cambios
  - Build inyecta `VITE_FIRESTORE_DATABASE_ID=staging` hardcodeado (no secret)
  - Hosting se deploya a `hosting:staging` (no `hosting:production`)
  - No tiene paso de minVersion update
  - No inyecta `VITE_SENTRY_DSN` ni secrets de Sentry
- **Cross-reference:** detalle completo en [`docs/reference/staging.md`](staging.md)

### C5: Seccion CI/CD produccion -- agregar paso minVersion

Documentar el paso condicional post-deploy:

- Chequea si `src/` o `functions/` cambiaron vs HEAD~1
- Si cambiaron, ejecuta `node scripts/update-min-version.js` que actualiza `config/appVersion.minVersion` en Firestore
- Referencia al patron de force-update documentado en patterns.md

### C6: Seccion dev-env.sh -- documentar auto-seed

Agregar nota en la fila de `start`: "Auto-seed al detectar emuladores frescos" ya esta documentado. Verificar que sea correcto.
