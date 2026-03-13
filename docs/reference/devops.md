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

# App Check con reCAPTCHA Enterprise (ver docs/SECURITY_GUIDELINES.md)
VITE_RECAPTCHA_ENTERPRISE_SITE_KEY=
```

### Cloud Functions (`functions/.env`)

```bash
ADMIN_EMAIL=benoffi11@gmail.com  # Email del admin (usado por defineString en backups.ts)
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
| `npm run test` | Vitest watch mode |
| `npm run test:run` | Vitest single run |
| `npm run seed` | Poblar emulador Firestore con datos de prueba (requiere emuladores corriendo) |
| `npm run analyze` | Build + genera `dist/stats.html` con analisis del bundle |

### `scripts/dev-env.sh`

Script de gestion del entorno de desarrollo local. Maneja emuladores Firebase y datos de prueba.

| Subcomando | Descripcion |
|------------|-------------|
| `status` | Muestra el estado de todos los puertos (Vite, Firestore, Auth, Storage, Functions, UI) |
| `start` | Inicia emuladores Firebase + Vite dev server. Auto-seed al detectar emuladores frescos |
| `stop` | Mata procesos en los puertos de emuladores (solo los relacionados a Firebase) |
| `restart` | Stop + start |
| `seed` | Ejecuta `npm run seed` contra los emuladores corriendo |
| `health` | Check de salud: verifica HTTP responses de cada emulador + existencia de datos de prueba |
| `logs` | Muestra logs recientes de los emuladores |

**Puertos gestionados:**

- `5173` — Vite dev server
- `8080` — Firestore emulator
- `9099` — Auth emulator
- `9199` — Storage emulator
- `5001` — Functions emulator
- `4000` — Emulator UI

---

## CI/CD

**GitHub Actions** (`.github/workflows/deploy.yml`):

1. Trigger: push a `main`
2. Setup: Node 22 + npm cache
3. `npm audit --audit-level=high` (continue-on-error)
4. `npm run lint`
5. `npm run test:run`
6. `npm run build` con secrets como env vars
7. Auth: `google-github-actions/auth@v2` con service account
8. Deploy Firestore rules + indexes: `firebase deploy --only firestore:rules,firestore:indexes`
9. Deploy Cloud Functions: `cd functions && npm ci && firebase deploy --only functions`
10. Deploy Hosting: Firebase Hosting (canal `live`) via `FirebaseExtended/action-hosting-deploy@v0`

**Preview** (`.github/workflows/preview.yml`):

- Trigger: PR a `main`
- Lint + test + build + deploy preview channel

**Todo se despliega automaticamente** en cada push a main: hosting, Firestore rules/indexes, y Cloud Functions.

### IAM roles requeridos

**Service account de CI/CD:**

- `roles/serviceusage.serviceUsageConsumer` — para invocar APIs de Firebase
- `roles/firebase.admin` — para deploy de rules/indexes

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
