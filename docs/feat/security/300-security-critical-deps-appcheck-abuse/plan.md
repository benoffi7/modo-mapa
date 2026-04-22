# Plan: Tech debt de seguridad — dependencias criticas, App Check y vectores de abuso

**PRD:** [prd.md](./prd.md)
**Specs:** [specs.md](./specs.md)
**Issue:** #300

---

## Estrategia

5 PRs incrementales ordenados por riesgo/impacto. Cada PR es mergeable independientemente. El orden permite rollback granular si algo falla.

PR1 resuelve la vulnerabilidad critica en horas. PR2-5 bajan severidad progresivamente y dan tiempo a monitorear cada cambio server-side antes del siguiente.

---

## PR 1 — Dependencias criticas + CI gate + changelog skeleton

**Objetivo:** Cerrar C-1 (protobufjs critical) y H-2 (vite 3 high) en la primera pasada. Zero breaking para usuarios.

### Pasos

1. Ejecutar `npm audit fix` en root. Verificar que el diff solo toca `package-lock.json` (no package.json con bumps riesgosos).
2. Ejecutar `npm run test:run` y `npm run build` en root — confirmar zero regresiones.
3. En `functions/`: ejecutar `npm audit fix` (sin `--force`) primero. Si quedan vulnerabilidades:
   a. Correr `npm audit fix --force` con review manual del diff (especialmente `@google-cloud/storage` major bump).
   b. Correr `cd functions && npx vitest run` — cobertura al 98.5% sirve como gate.
   c. Si tests fallan, abrir issue separado y merger PR 1 con solo `npm audit fix` (sin `--force`) — resuelve protobufjs transitivo minimo.
4. Bump explicito de `vite` en `package.json` a `^7.3.1` (o el ultimo parche disponible al momento del PR). Re-correr `npm install` + tests + build.
5. Agregar step al workflow `.github/workflows/deploy.yml` despues de `npm ci`:
   ```yaml
   - name: Audit dependencies (high+)
     run: |
       npm audit --audit-level=high
       cd functions && npm audit --audit-level=high
   ```
6. Entry en `docs/reports/changelog.md` describiendo C-1 fix.

### Tests

- `npm run test:coverage` root: coverage no baja.
- `cd functions && npm run test:coverage`: coverage no baja.
- `npm audit --audit-level=high`: retorna 0 vulnerabilidades.
- Build local (`npm run build`) y deploy a staging.

### Rollback

- Revertir PR. El commit de lockfile es atomico — rollback limpio.

### Criterios de merge

- CI pasa incluyendo el nuevo step de audit
- Tests de frontend y functions pasan
- Deploy a staging exitoso

---

## PR 2 — IPv6 bucketing + listItems rate limit reorder + fanOut dedup + admin lists paginacion

**Objetivo:** Cerrar H-3 (fan-out), H-4 (IPv6), M-1 (scraping), M-5 (listItems counter drift) en un solo PR server-side con tests.

### Pasos

1. **IPv6 bucketing:**
   a. Editar `functions/src/utils/ipRateLimiter.ts`: agregar `isIpv6()`, `bucketIpv6()` helpers; modificar `hashIp` para bucketear IPv6 antes del SHA-256. IPv6 mapped IPv4 (`::ffff:...`) se extrae como IPv4.
   b. Agregar tests en `functions/src/__tests__/utils/ipRateLimiter.test.ts`: IPv4, IPv6 full, IPv6 /64 diferentes, IPv6 mapped, IP invalida.

2. **listItems reorder (M-5):**
   a. Editar `functions/src/triggers/listItems.ts`: mover el query `count().get()` y el chequeo exceeded ANTES de `incrementCounter` y `trackWrite`. Si exceeded, borrar y log abuse sin incrementar.
   b. Auditar `functions/src/triggers/userSettings.ts` y `functions/src/triggers/sharedLists.ts` para el mismo patron (M-7). Si ya estan en el orden correcto tras #289, dejar nota.
   c. Tests en `functions/src/__tests__/triggers/listItems.test.ts` (nuevo o existente): exceeded no incrementa.

3. **fanOut dedup (H-3):**
   a. Crear `functions/src/constants/fanOut.ts` con `FANOUT_DEDUP_WINDOW_HOURS` y `FANOUT_MAX_RECIPIENTS_PER_ACTION`.
   b. Editar `functions/src/utils/fanOut.ts`: helper `fanOutDedupKey()` SHA-256(actor|type|business|follower); antes de cada `batch.set(feedRef, ...)` chequear `_fanoutDedup/{key}` con lectura paralela por batch (usar `Promise.all` por chunk de 500). Si existe y `createdAt > now - 24h`, skip. Si no, `batch.set(dedupRef, ...)` ademas del feed item. Cap total en `FANOUT_MAX_RECIPIENTS_PER_ACTION`.
   c. Agregar regla en `firestore.rules`: `match /_fanoutDedup/{docId} { allow read, write: if false; }`.
   d. Tests en `functions/src/__tests__/utils/fanOut.test.ts`: happy path, dedup hit, dedup expirado (actualiza doc), skip si `profilePublic=false`, cap.
   e. Instrumentar con `trackFunctionTiming('fanOutToFollowers', startMs)` al final.

4. **Admin lists paginacion (M-1):**
   a. Editar `functions/src/admin/featuredLists.ts`: `getFeaturedLists` y `getPublicLists` aceptan `pageSize` (default 100, max 500) y `startAfter` (doc ID). Devuelven `{ lists, nextCursor }`.
   b. Editar `src/services/admin.ts` (o el service que llama): agregar paginacion en la firma.
   c. Editar `src/components/admin/ListsPanel.tsx`: consumir el cursor con boton "Cargar mas" o `usePaginatedQuery` pattern.
   d. Tests en `functions/src/__tests__/admin/featuredLists.test.ts`: pageSize respetado, nextCursor correcto, startAfter retorna siguiente pagina.

5. Entry en `docs/reports/changelog.md` describiendo H-3, H-4, M-1, M-5 fixes.

### Tests

- `cd functions && npx vitest run` pasa con nuevos tests.
- `npm run test:run` pasa (frontend no cambia excepto ListsPanel).
- Deploy a staging + smoke manual:
  - Crear una cuenta con IPv6 simulada (multiples `/128` del mismo `/64`) — verificar que 10 cuentas del mismo /64 son bloqueadas a partir de la 10ma.
  - Trigger 2 ratings del mismo user en el mismo business en 1 min — verificar que solo se escribe 1 activityFeed item por follower.
  - Usuario con 150 listItems intenta crear la 151ra — verificar counter no incrementa y doc se borra.

### Rollback

- Revertir PR. `_fanoutDedup` collection queda huerfana pero inofensiva (rule deniega todo read/write).
- Eliminar entries del `_fanoutDedup` es opcional — no expone data.

### Criterios de merge

- Tests +80% cobertura para archivos tocados
- Smoke manual en staging exitoso
- Monitoreo 24h post-deploy: `_fanoutDedup` growth razonable, `abuseLogs` sin spike falso

---

## PR 3 — ADMIN_EMAIL a Secret Manager + App Check enforcement verification

**Objetivo:** Cerrar H-1 (App Check no verificado) y L-3 (ADMIN_EMAIL commiteado). Requiere configurar GitHub Secrets previamente.

### Pre-requisitos

- GitHub Secret `APP_CHECK_ENFORCEMENT=enabled` configurado en prod.
- Secret Manager secret `ADMIN_EMAIL` creado en Google Cloud con valor actual.
- IAM role `roles/secretmanager.secretAccessor` agregado a la Cloud Functions service account.

### Pasos

1. **ADMIN_EMAIL a Secret Manager:**
   a. En Google Cloud Console: crear secret `ADMIN_EMAIL` con el valor actual.
   b. Editar `functions/src/helpers/assertAdmin.ts`: reemplazar `process.env.ADMIN_EMAIL` por `defineSecret('ADMIN_EMAIL').value()`.
   c. Editar cada callable admin que importa `assertAdmin` para agregar `ADMIN_EMAIL` a `secrets: [...]` en la config de `onCall`.
   d. Remover `ADMIN_EMAIL=benoffi11@gmail.com` de `functions/.env`.
   e. Tests de `assertAdmin` con mock de `defineSecret`.

2. **App Check enforcement verification:**
   a. Editar `.github/workflows/deploy.yml`: agregar env var al step de deploy:
      ```yaml
      env:
        APP_CHECK_ENFORCEMENT: ${{ secrets.APP_CHECK_ENFORCEMENT }}
      ```
      o pasarlo via `firebase functions:secrets:access` / `params` segun como esta configurado el proyecto.
   b. Remover `APP_CHECK_ENFORCEMENT=enabled` de `functions/.env` (o dejar solo en staging).
   c. Crear `functions/src/__tests__/appCheckEnforcement.test.ts`: mockear `process.env` con 4 combinaciones (enabled/disabled x emulator/prod) y validar valor de `ENFORCE_APP_CHECK`.
   d. Agregar post-deploy check en workflow:
      ```yaml
      - name: Verify App Check enforcement
        run: |
          # Llamar cleanAnonymousData sin App Check token y esperar 403
          curl -X POST "$FUNCTION_URL/cleanAnonymousData" \
            -H "Authorization: Bearer $ID_TOKEN" \
            -d '{"data":{}}' | grep -q '"code":"failed-precondition"' || exit 1
      ```
   e. Actualizar `docs/reference/security.md` seccion App Check con subseccion "Deploy verification".

3. Entry en `docs/reports/changelog.md`.

### Tests

- Tests unitarios de `assertAdmin` con secret mock.
- Tests de `ENFORCE_APP_CHECK` matrix.
- Deploy a staging: confirmar que funciones siguen operativas (admin callables no rompen).
- Post-deploy check corre y falla si enforcement esta roto.

### Rollback

- Revertir PR. `functions/.env` vuelve a tener los valores.
- Importante: el secret `ADMIN_EMAIL` en Secret Manager queda — no borrar hasta confirmar merge.

### Criterios de merge

- Admin panel funcional en staging post-deploy
- Post-deploy check pasa
- Secret Manager role configurado y verificado

---

## PR 4 — Backfill profilePublic + users/follows/feedback rules hardening

**Objetivo:** Cerrar M-2 (users enumeration), M-3 (displayName charset), M-4 (feedback.mediaUrl), M-6 (follows TOCTOU). Requiere backfill previo y coordinacion.

### Pasos

1. **Backfill script:**
   a. Crear `scripts/backfill-profile-public.mjs`: admin SDK via ADC; itera `users` en batches de 500; lee `userSettings/{uid}`; escribe `users/{uid}.profilePublic` con el valor (default `false` si no existe userSettings). Idempotente. Flags: `--dry-run` (default), `--apply`, `--database=staging|default`.
   b. Correr dry-run en staging, validar output.
   c. Correr `--apply` en staging. Validar con query admin: "users con profilePublic=undefined" → 0.

2. **Seed userSettings en beforeUserCreated / onUserCreated:**
   a. Editar `functions/src/triggers/authBlocking.ts`: si user pasa rate limit, seed `userSettings/{uid}` con `{ profilePublic: false, notificationsEnabled: true, ..., updatedAt: FieldValue.serverTimestamp() }`. Usar defaults de `services/userSettings.ts` via shared constants si existen.
   b. Auditar `functions/src/triggers/users.ts` (o donde se haga `onUserCreated`) — si ya seeda, confirmar. Si no, agregar.

3. **Rules hardening (deploy DESPUES del backfill en prod):**
   a. Correr `--apply` en prod con admin approval. Validar con query admin.
   b. Editar `firestore.rules`:
      - `match /users/{userId}` read: agregar condicion `resource.data.profilePublic == true || request.auth.uid == userId || isAdmin()`.
      - `match /users/{userId}` create/update: agregar `displayName.matches('^[A-Za-z0-9À-ÿ ._-]+$')`.
      - `match /follows/{docId}` create: cambiar `!exists(...) || ... != false` a `exists(...) && ... == true`.
      - `match /feedback/{docId}` create: `mediaUrl` regex estricto con `feedback-media/{auth.uid}/`. Idem update rule.
   c. Tests de rules con `@firebase/rules-unit-testing`.

4. Entry en `docs/reports/changelog.md`.

### Tests

- Tests del backfill script (unit con mock admin SDK + integracion con emulador).
- Tests de rules: matriz de casos positivo/negativo para cada cambio.
- Smoke manual:
  - User A (privado) no puede leer doc de User B (privado) — deniega.
  - User A (publico) puede leer doc de User B (publico) — permite.
  - User A intenta crear displayName "abc\u202Edefg" (RTL) — deniega.
  - User A intenta crear follow a User B sin userSettings — deniega.
  - User A sube feedback con mediaUrl de otro user — deniega.

### Rollback

- Revertir `firestore.rules` (deploy anterior). Backfill no se rollbackea — `profilePublic` en `users` es informacion redundante de `userSettings`, no rompe nada.

### Criterios de merge

- Backfill completo en prod (0 users sin `profilePublic`)
- Tests de rules pasan
- Smoke manual exitoso
- `searchUsers` sigue devolviendo resultados esperados

---

## PR 5 — Docs, features.md, patterns.md, firestore.md

**Objetivo:** Cerrar documentacion de todos los cambios.

### Pasos

1. **`docs/reference/security.md`:**
   - Seccion App Check: agregar subseccion "Deploy verification" con el post-deploy check.
   - Seccion Rate limiting: agregar fila "fanout dedup — 1/(actor,type,business,follower)/24h".
   - Seccion IP-based rate limiting: agregar nota sobre IPv6 /64 bucketing.
   - Seccion Firestore rules: actualizar tabla de users, follows, feedback con los nuevos campos/validaciones.

2. **`docs/reference/firestore.md`:**
   - Agregar fila `_fanoutDedup` a la tabla de colecciones.

3. **`docs/reference/patterns.md`:**
   - Bajo "Follows y activity feed", agregar "Fan-out dedup" con descripcion del patron.
   - Bajo "Server-side", actualizar "Rate limiting (3 capas)" para mencionar IPv6 /64.

4. **`docs/reference/features.md`:**
   - No agrega features nuevos user-facing. Opcionalmente actualizar seccion "Seguridad" del resumen rapido.

5. **`docs/_sidebar.md`:**
   - Ya incluye entrada para este PRD/specs/plan.

6. Entry final en `docs/reports/changelog.md` consolidando los 4 PRs anteriores.

### Tests

- `markdownlint docs/**/*.md` pasa.
- Revision manual del indice de GH Pages post-deploy.

### Rollback

- N/A (solo docs).

### Criterios de merge

- Docs coherentes con el codigo mergeado en PR 1-4
- Changelog completo
- Issue #300 referenciado en cada entry

---

## Orden recomendado y timeline

| PR | Contenido | Duracion estimada | Bloqueantes |
|----|-----------|-------------------|-------------|
| PR 1 | deps + CI gate | 1 dia | — |
| PR 2 | server-side abuse fixes | 2-3 dias | PR 1 mergeado |
| PR 3 | App Check + ADMIN_EMAIL | 1-2 dias | GitHub Secrets + Secret Manager configurados |
| PR 4 | backfill + rules hardening | 2-3 dias | Backfill ejecutado en prod |
| PR 5 | docs | 0.5 dia | PR 1-4 mergeados |

**Total:** 7-10 dias de trabajo efectivo, distribuidos en 2 semanas calendario.

---

## Success Criteria (validacion final)

1. `npm audit --audit-level=high` retorna 0 vulnerabilidades en root y functions.
2. Test `appCheckEnforcement.test.ts` pasa con matriz completa.
3. Post-deploy check de App Check en workflow pasa.
4. Monitor 7 dias post-PR 2: `_fanoutDedup` growth estable, `abuseLogs` sin spike falso, sin regresion en activityFeed delivery legitima (comparar con baseline pre-deploy).
5. Monitor 7 dias post-PR 4: `searchUsers` analytics (`user_search`) sin drop mayor al 5%, sin spike en errores `permission-denied` en Firestore.
6. Issues abiertos #303 (perf instrumentation) tiene datos de las nuevas funciones fanOut dedup y listItems reorder para instrumentar.

---

## Comandos rapidos

```bash
# PR 1
npm audit fix
cd functions && npm audit fix
# Si queda protobufjs, correr con --force y validar tests
cd functions && npm audit fix --force

# Validar
npm run test:run && npm run build
cd functions && npx vitest run

# PR 4 backfill
node scripts/backfill-profile-public.mjs --dry-run --database=staging
node scripts/backfill-profile-public.mjs --apply --database=staging
# Validar, luego prod
node scripts/backfill-profile-public.mjs --apply
```
