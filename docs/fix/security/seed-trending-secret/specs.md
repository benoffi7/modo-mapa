# Specs: #280 Remove client_secret from seed-trending.mjs

**Issue:** #280
**Fecha:** 2026-03-31

---

## Problema

`scripts/seed-trending.mjs` lines 31–39 hardcode an OAuth `client_secret` (and `client_id`) inside the
`admin.credential.refreshToken({...})` call used for `--target staging` runs.

This is the same pattern already fixed in `seed-staging.ts` (issue #260).

### Codigo actual (lines 31–39)

```js
admin.initializeApp({
  projectId: 'modo-mapa-app',
  credential: admin.credential.refreshToken({
    type: 'authorized_user',
    client_id: '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com',
    client_secret: 'j9iVZfS8kkCEFUPaAeJV0sAi',
    refresh_token: firebaseTools.tokens.refresh_token,
  }),
});
```

Additionally, lines 9–20 load `firebase-tools.json` from `~/.config/configstore/` and read a
`refresh_token` from it — this entire credential mechanism becomes unnecessary once ADC is used.

---

## Fix

Replace the hardcoded credential block with Application Default Credentials (ADC), identical to the
pattern in `seed-staging.ts`.

### Codigo propuesto (remote branch)

```js
// Replace lines 9-20 and lines 31-39 with:

import { existsSync } from 'fs';
import { resolve } from 'path';

const adcPath = resolve(process.env.HOME, '.config/gcloud/application_default_credentials.json');
if (!existsSync(adcPath)) {
  console.error('ERROR: Application Default Credentials no encontradas.');
  console.error('Ejecutar primero: gcloud auth application-default login');
  process.exit(1);
}

// ...

if (!target) {
  process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';
  admin.initializeApp({ projectId: 'modo-mapa-app' });
  console.log('Target: local emulators (default database)');
} else {
  admin.initializeApp({ projectId: 'modo-mapa-app' });
  console.log(`Target: remote database "${target}"`);
}
```

ADC is picked up automatically by `firebase-admin` when no credential is specified. No credential
object is passed in the remote branch — the SDK resolves it from the environment.

---

## Imports a eliminar

- `createRequire` call to load `firebase-admin` from `functions/node_modules` can be replaced with a
  direct ESM-compatible import, or kept as-is. The credential fix is independent of the require
  strategy — keep the existing `require` approach to minimise diff.
- Remove: `readFileSync` import (no longer needed after removing firebaseTools load).
- Remove: lines 19–20 (`firebaseToolsPath` + `firebaseTools` variables).

---

## Impacto operativo

| Aspecto | Detalle |
|---------|---------|
| Prerequisito para staging | `gcloud auth application-default login` (same as seed-staging.ts) |
| Emulador local | Sin cambio — `process.env.FIRESTORE_EMULATOR_HOST` branch unchanged |
| Secret en repo | Eliminado. No hay credenciales hardcodeadas |
| CI/CD | No aplica — seed scripts son manuales |
