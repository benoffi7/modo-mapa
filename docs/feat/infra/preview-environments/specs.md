# Specs: Preview environments para PRs

## Workflow: `.github/workflows/preview.yml`

### Trigger

```yaml
on:
  pull_request:
    branches: [main]
    types: [opened, synchronize, reopened]
```

### Entorno

- Runner: `ubuntu-latest`
- Node: 22
- Variable de entorno global: `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24: true`

### Steps

1. **Checkout** — `actions/checkout@v4`
2. **Setup Node** — `actions/setup-node@v4` con `node-version: 22` y `cache: npm`
3. **Install** — `npm ci`
4. **Lint** — `npm run lint`
5. **Test** — `npm run test:run`
6. **Build** — `npm run build` con los mismos secrets `VITE_*` que usa `deploy.yml`
7. **Deploy preview** — `FirebaseExtended/action-hosting-deploy@v0`

### Configuracion del deploy

```yaml
- uses: FirebaseExtended/action-hosting-deploy@v0
  with:
    repoToken: ${{ secrets.GITHUB_TOKEN }}
    firebaseServiceAccount: ${{ secrets.FIREBASE_SERVICE_ACCOUNT }}
    projectId: modo-mapa-app
    expires: 7d
```

Diferencias clave con el workflow de produccion (`deploy.yml`):

| Aspecto | `deploy.yml` (produccion) | `preview.yml` (preview) |
|---------|--------------------------|------------------------|
| Trigger | `push` a `main` | `pull_request` a `main` |
| `channelId` | `live` | No se especifica (auto-genera preview channel) |
| `expires` | No aplica | `7d` |
| Firestore rules | Si | No |
| Cloud Functions | Si | No |
| `npm audit` | Si (continue-on-error) | No (no bloquea el preview) |

### Variables de entorno (build)

Las mismas secrets que produccion — apuntan al mismo proyecto Firebase:

- `VITE_GOOGLE_MAPS_API_KEY`
- `VITE_GOOGLE_MAPS_MAP_ID`
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`

### Infraestructura compartida

El preview channel comparte con produccion:

- Cloud Firestore (misma base de datos)
- Firebase Auth (mismos usuarios)
- Cloud Functions (mismas funciones)
- Firebase App Check (misma configuracion)

Solo el **hosting** es independiente (URL efimera por PR).

## Archivos

| Accion | Archivo |
|--------|---------|
| Crear | `.github/workflows/preview.yml` |
| Modificar | Ninguno |

## Dependencias

- Secrets de GitHub ya configurados (usados por `deploy.yml`).
- Firebase Hosting ya configurado en `firebase.json`.
- No se requieren cambios en Firebase console.
