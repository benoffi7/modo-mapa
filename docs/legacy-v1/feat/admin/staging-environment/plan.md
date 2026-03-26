# Plan: Entorno Staging (Pre-producción)

**Issue:** #29
**Base branch:** `feat/performance-semaphores`

---

## Arquitectura

```text
                    mismo proyecto Firebase (modo-mapa-app)
                    misma Auth, mismas API keys
                    ┌────────────────────┬────────────────────┐
                    │     STAGING        │    PRODUCCIÓN      │
                    ├────────────────────┼────────────────────┤
  Firestore DB      │  staging (named)   │  (default)         │
  Hosting URL       │  staging.web.app   │  app.web.app       │
  Branch            │  staging           │  main              │
  Deploy trigger    │  push to staging   │  push to main      │
  Sentry/Analytics  │  deshabilitado     │  habilitado         │
  App Check         │  deshabilitado     │  habilitado         │
                    └────────────────────┴────────────────────┘
```

## Pasos

### Paso 1: Multi-site hosting en Firebase

Configurar `firebase.json` con hosting targets:
- `production` → `modo-mapa-app` (site existente)
- `staging` → `modo-mapa-staging` (site nuevo)

Actualizar `.firebaserc` con los targets.

### Paso 2: Named database support en el cliente

Agregar `VITE_FIRESTORE_DATABASE_ID` (opcional, default `(default)`).
Modificar `src/config/firebase.ts` para pasar el database ID.

### Paso 3: GitHub Action para staging

Crear `.github/workflows/deploy-staging.yml`:
- Trigger: push a branch `staging`
- Build con `VITE_FIRESTORE_DATABASE_ID=staging`
- Deploy hosting only (no functions/rules — mismas que prod)
- Sin Sentry, sin App Check

### Paso 4: Documentación

Actualizar `.env.example` con la nueva variable.

---

## Seguridad

- Mismas Firestore rules (se aplican a todas las DBs del proyecto)
- Auth compartida (tu cuenta admin funciona en ambos)
- API keys son las mismas (públicas, protegidas por App Check en prod)
- Staging no tiene App Check — aceptable porque la DB staging es descartable
- Cloud Functions operan sobre `(default)` — staging no se ve afectado

## Setup manual requerido (una vez)

1. Crear named database `staging` en Firebase Console:
   Console → Firestore → "Create database" → ID: `staging`
2. Crear hosting site `modo-mapa-staging` en Firebase Console:
   Console → Hosting → "Add another site" → `modo-mapa-staging`
3. No se necesitan secrets nuevos en GitHub (mismas keys)
4. Agregar un solo secret: `VITE_FIRESTORE_DATABASE_ID_STAGING=staging`
   (o hardcodear en el workflow)
