# DevOps — Scripts, CI/CD, Entorno

## Variables de entorno

### Frontend (`/.env`)

```bash
VITE_GOOGLE_MAPS_API_KEY=       # API key de Google Maps
VITE_GOOGLE_MAPS_MAP_ID=        # Map ID para estilos
VITE_FIREBASE_API_KEY=           # Firebase web API key
VITE_FIREBASE_AUTH_DOMAIN=       # *.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=        # modo-mapa-app
VITE_FIREBASE_STORAGE_BUCKET=    # *.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_FIREBASE_MEASUREMENT_ID=    # GA4 measurement ID

# Opcional: Firestore named database (para staging). Default: (default)
VITE_FIRESTORE_DATABASE_ID=

# App Check con reCAPTCHA Enterprise (ver docs/reference/security.md)
VITE_RECAPTCHA_ENTERPRISE_SITE_KEY=

# Admin email (para el panel de administración)
VITE_ADMIN_EMAIL=

# Sentry (error tracking — solo produccion)
VITE_SENTRY_DSN=
```

### Cloud Functions (`functions/.env`)

```bash
ADMIN_EMAIL=benoffi11@gmail.com  # Email del admin (usado por defineString en backups.ts)
```

### Sentry (CI/CD — secrets de GitHub)

```bash
SENTRY_AUTH_TOKEN=   # Token de autenticacion para source maps
SENTRY_ORG=          # Organizacion en Sentry
SENTRY_PROJECT=      # Proyecto en Sentry
```

En CI/CD se inyectan como GitHub Secrets.

---

## Scripts

| Comando | Descripcion |
|---------|-------------|
| `npm run dev` | Vite dev server (sin emuladores) |
| `npm run dev:full` | Dev + emuladores Firebase (auth, firestore, functions) |
| `npm run emulators` | Solo emuladores (Auth :9099, Firestore :8080, Functions :5001, Storage :9199, UI :4000) |
| `npm run build` | tsc + vite build → `dist/` |
| `npm run lint` | ESLint check |
| `npm run preview` | Preview del build de produccion |
| `npm run test` | Vitest watch mode (`--maxWorkers=4`) |
| `npm run test:run` | Vitest single run (`--maxWorkers=4`) |
| `npm run test:coverage` | Vitest single run con reporte de cobertura |
| `npm run seed` | Copia `scripts/seed-admin-data.ts` a functions/ y ejecuta con tsx |
| `npm run analyze` | Build + genera `dist/stats.html` con analisis del bundle |

### `scripts/dev-env.sh`

Script de gestion del entorno de desarrollo local. Maneja emuladores Firebase y datos de prueba.

| Subcomando | Descripcion |
|------------|-------------|
| `status` | Muestra el estado de todos los puertos (Vite, Firestore, Auth, Storage, Functions, UI) |
| `start` | Inicia emuladores Firebase + Vite dev server. **Auto-seed al detectar emuladores frescos** |
| `stop` | Mata procesos en los puertos de emuladores (solo los relacionados a Firebase) |
| `restart` | Stop + start |
| `seed` | Ejecuta `node scripts/seed-admin-data.mjs` contra los emuladores corriendo |
| `health` | Check de salud: verifica HTTP responses de cada emulador + existencia de datos de prueba |
| `logs` | Muestra logs recientes de los emuladores |

> **Nota:** `dev-env.sh seed` usa `node scripts/seed-admin-data.mjs` directamente, NO `npm run seed` (que usa tsx y copia al directorio de functions).

**Puertos gestionados:**

- `5173` — Vite dev server
- `8080` — Firestore emulator
- `9099` — Auth emulator
- `9199` — Storage emulator
- `5001` — Functions emulator
- `4000` — Emulator UI

---

## CI/CD

### Production (`deploy.yml`)

Trigger: push a `main`

1. **lint**: Node 22 + `npm audit --audit-level=high` (continue-on-error) + `npm run lint`
2. **test**: `npm run test:coverage` (root — solo `src/`, excluye `functions/`)
3. **functions-test**: `cd functions && npm ci && npm run test:coverage`
4. **deploy-rules-and-functions** (needs lint, test, functions-test):
   - Auth: `google-github-actions/auth@v2` con service account
   - Deploy Firestore rules + indexes
   - Deploy Cloud Functions (con `--force`)
5. **build-and-deploy-hosting** (needs lint, test, functions-test):
   - `npm run build` con todos los secrets como env vars (incluyendo Sentry)
   - Deploy hosting canal `production`
   - **Update minVersion**: si `src/` o `functions/` cambiaron, ejecuta `scripts/update-min-version.js` para forzar recarga en clientes desactualizados

### Staging (`deploy-staging.yml`)

Trigger: push a `staging`

1. **lint**: Incluye `scripts/pre-staging-check.sh` para detectar patrones problematicos (ej: imports hardcodeados a DB default)
2. **test**: `npm run test:run` (sin cobertura)
3. **functions-test**: `npm run test:run`
4. **deploy-rules-and-functions**:
   - Deploy reglas con `scripts/deploy-staging-rules.sh` (apunta a database `staging`)
   - **Deploy condicional de funciones**: solo si `functions/src/` o `functions/package.json` cambiaron vs `origin/main`
5. **build-and-deploy-hosting**:
   - Build con `VITE_FIRESTORE_DATABASE_ID: staging` (hardcodeado, no secret)
   - Deploy hosting canal `staging`

**Diferencias clave staging vs production:**
- Staging usa database Firestore `staging` en vez de `(default)`
- No inyecta Sentry ni reCAPTCHA
- Deploy de functions es condicional (ahorra tiempo si solo cambiaron componentes)
- No actualiza minVersion

### Preview (`preview.yml`)

- Trigger: PR a `main`
- Lint + tests (root + functions) + build + deploy preview channel
- Permissions: `contents: read`, `checks: write`, `pull-requests: write`

### Arquitectura de tests en CI

- Root vitest (`vite.config.ts`): entorno jsdom, solo `src/`, excluye `functions/**` y `.claude/**`
- Functions vitest (`functions/vitest.config.ts`): entorno node, solo `functions/src/`
- VITE_ env vars solo disponibles en el step de build, NO en tests
- Tests que importan modulos que chainan a `firebase.ts` deben mockear la cadena

**Todo se despliega automaticamente** en cada push a main: hosting, Firestore rules/indexes, y Cloud Functions.

### IAM roles requeridos

**Service account de CI/CD:**

- `roles/serviceusage.serviceUsageConsumer` — para invocar APIs de Firebase
- `roles/firebase.admin` — para deploy de rules/indexes
- `roles/iam.serviceAccountUser` — **requerido** para deploy de Cloud Functions (`iam.serviceAccounts.ActAs`)
- `roles/cloudscheduler.admin` — para crear/actualizar scheduled functions

**Service account de Cloud Functions** (`591435782056-compute@developer.gserviceaccount.com`):

- `roles/datastore.importExportAdmin` — para backup export/import Firestore
- `roles/storage.admin` — para listar/escribir/eliminar backups en GCS

---

## Flujo de feature

1. Crear issue en GitHub
2. Branch: `feat/<N>-<descripcion>` o `fix/<N>-<descripcion>`
3. PRD → specs → plan → implementar (ver `PROCEDURES.md`)
4. Test local con `npm run dev` o `scripts/dev-env.sh start`
5. Commit con referencia al issue
6. PR con resumen y test plan
7. Merge a main → deploy automatico

---

## Versionado

- Version en `package.json` → expuesta via `__APP_VERSION__` (Vite define) → mostrada en footer del menu lateral.
- Cada 10 issues se incrementa el numero mayor (1.x → 2.0).
- Formato: `MAJOR.MINOR.PATCH` donde MINOR se incrementa por feature/fix.
- Al merge, si `src/` o `functions/` cambiaron, se actualiza `config/app.minVersion` en Firestore para forzar recarga en clientes viejos.
