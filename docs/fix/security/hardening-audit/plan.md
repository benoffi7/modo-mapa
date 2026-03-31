# Plan: Hardening Audit #260-#265

**Specs:** [specs.md](specs.md)
**Fecha:** 2026-03-31

---

## Branch

`fix/security-hardening-audit`

Base: `new-home`

---

## Fases de implementacion

### Fase 1: Acciones operacionales CRITICAS (previas al codigo)

Estas acciones deben completarse ANTES de cualquier commit. No requieren cambios en el repositorio.

| Paso | Accion | Como |
|------|--------|------|
| 1 | Revocar `sa-key.json` en GCP | GCP Console > IAM & Admin > Service Accounts > seleccionar SA > Keys > Delete |
| 2 | Eliminar `sa-key.json` del disco | `rm /home/walrus/proyectos/modo-mapa/sa-key.json` |
| 3 | Crear ADC con gcloud | `gcloud auth application-default login` (abre browser) |
| 4 | Verificar ADC funciona | `gcloud auth application-default print-access-token` |
| 5 | Crear secret en Secret Manager | `echo -n "benoffi11@gmail.com" \| gcloud secrets create ADMIN_EMAIL --data-file=-` |
| 6 | Dar acceso al runtime de Functions | `gcloud secrets add-iam-policy-binding ADMIN_EMAIL --member="serviceAccount:modo-mapa-app@appspot.gserviceaccount.com" --role="roles/secretmanager.secretAccessor"` |

---

### Fase 2: Refactor seed-staging.ts (#260)

**Objetivo:** Eliminar el `client_secret` hardcodeado y todo el bloque de ADC manual.

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `scripts/seed-staging.ts` | Eliminar imports: `readFileSync`, `writeFileSync`, `unlinkSync`, `mkdirSync` |
| 2 | `scripts/seed-staging.ts` | Eliminar todo el bloque lineas 12-34 (lectura de firebase-tools config, creacion del ADC file, `process.env.GOOGLE_APPLICATION_CREDENTIALS`, `mkdirSync`, `process.on('exit')`) |
| 3 | `scripts/seed-staging.ts` | Agregar al inicio: validacion de ADC existente con `existsSync` y mensaje de error claro |
| 4 | `scripts/seed-staging.ts` | Agregar comentario en el header explicando prerequisito: `gcloud auth application-default login` |

**Codigo a eliminar (lineas 12-34):**

```typescript
// ELIMINAR todo este bloque:
import { readFileSync, writeFileSync, unlinkSync } from 'fs';
import { resolve } from 'path';
const firebaseConfig = JSON.parse(readFileSync(resolve(process.env.HOME!, '.config/configstore/firebase-tools.json'), 'utf-8'));
const adcPath = resolve(process.env.HOME!, '.config/gcloud/application_default_credentials.json');
import { mkdirSync } from 'fs';
mkdirSync(resolve(process.env.HOME!, '.config/gcloud'), { recursive: true });
const adcContent = {
  type: 'authorized_user',
  client_id: '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com',
  client_secret: 'j9iVZfS8kkCEFUPaAeJV0sAi',
  refresh_token: firebaseConfig.tokens.refresh_token,
};
writeFileSync(adcPath, JSON.stringify(adcContent));
process.env.GOOGLE_APPLICATION_CREDENTIALS = adcPath;
// ...y el process.on('exit')
```

**Codigo a agregar al inicio del archivo (despues del comentario de bloque):**

```typescript
import { existsSync } from 'fs';
import { resolve } from 'path';

const adcPath = resolve(process.env.HOME!, '.config/gcloud/application_default_credentials.json');
if (!existsSync(adcPath)) {
  console.error('ERROR: Application Default Credentials no encontradas.');
  console.error('Ejecutar primero: gcloud auth application-default login');
  process.exit(1);
}
```

---

### Fase 3: Cloud Functions — fixes (#264, #265c)

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `functions/src/triggers/commentLikes.ts` | `onCommentLikeDeleted`: reemplazar `FieldValue.increment(-1)` con transaccion `Math.max(0, current - 1)` |
| 2 | `functions/src/triggers/menuPhotos.ts` | `onMenuPhotoCreated`: agregar `await snap.ref.delete()` antes del `logAbuse` en el bloque `if (exceeded)` |
| 3 | `functions/src/triggers/menuPhotos.ts` | Actualizar el comentario que explica por que no se elimina el doc (ya no aplica) |
| 4 | `functions/src/triggers/checkins.ts` | `onCheckInDeleted`: agregar logging de rate limit de deletes (20/dia) via `_rateLimits` |

**Paso 1 — commentLikes.ts detalle:**

Reemplazar en `onCommentLikeDeleted`:

```typescript
// ANTES:
await db.doc(`comments/${commentId}`).update({
  likeCount: FieldValue.increment(-1),
});

// DESPUES:
const commentRef = db.doc(`comments/${commentId}`);
await db.runTransaction(async (tx) => {
  const commentSnap = await tx.get(commentRef);
  if (!commentSnap.exists) return;
  const current = (commentSnap.data()!.likeCount as number) ?? 0;
  tx.update(commentRef, { likeCount: Math.max(0, current - 1) });
});
```

**Paso 2 — menuPhotos.ts detalle:**

En el bloque `if (exceeded)` (actualmente lineas 54-61):

```typescript
if (exceeded) {
  await snap.ref.delete();  // AGREGAR esta linea
  await logAbuse(db, {
    userId,
    type: 'rate_limit',
    collection: 'menuPhotos',
    detail: 'Exceeded 10 menuPhotos/day',
  });
  return;
}
```

Actualizar el comentario de la linea 47:

```typescript
// ANTES: // Don't delete doc (allow delete: if false in rules), just skip processing
// DESPUES: // Trigger runs as admin SDK — delete bypasses client-facing rules
```

**Paso 4 — checkins.ts detalle:**

```typescript
export const onCheckInDeleted = onDocumentDeleted(
  'checkins/{checkinId}',
  async (event) => {
    const db = getDb();
    const snap = event.data;
    if (!snap) return;

    const data = snap.data();
    const userId = data.userId as string;

    // Rate limit check for deletes: 20 per day per user
    // We can't undo a delete, so we only log abuse when exceeded
    const today = new Date().toISOString().slice(0, 10);
    const deleteLimitRef = db.doc(`_rateLimits/checkin_delete_${userId}`);
    const limitSnap = await deleteLimitRef.get();
    const limitData = limitSnap.data();
    const deleteCount = limitData?.date === today ? (limitData.count as number) : 0;

    await deleteLimitRef.set({ date: today, count: deleteCount + 1 }, { merge: true });

    if (deleteCount >= 20) {
      await logAbuse(db, {
        userId,
        type: 'rate_limit',
        collection: 'checkins_delete',
        detail: `Exceeded 20 checkin deletes/day (count: ${deleteCount + 1})`,
      });
    }

    await incrementCounter(db, 'checkins', -1);
    await trackDelete(db, 'checkins');
  },
);
```

Agregar import de `logAbuse` al archivo:

```typescript
import { logAbuse } from '../utils/abuseLogger';
```

---

### Fase 4: Firestore rules — validacion de campos (#263, #264c, #265a, #265b)

Todos los cambios en un solo edit de `firestore.rules`.

| Paso | Seccion | Cambio |
|------|---------|--------|
| 1 | `specials` | Reemplazar `allow write: if isAdmin()` por `allow create`, `allow update`, `allow delete` separados con validacion de campos |
| 2 | `achievements` | Reemplazar `allow write: if isAdmin()` por `allow create`, `allow update`, `allow delete` separados con validacion de campos |
| 3 | `userSettings` | Reemplazar `allow write` por `allow create` + `allow update` (sin `allow delete`). Agregar `.size() <= 100` en `locality` |
| 4 | `feedback` | Agregar parentesis explicitos en la regla `allow update` |

**Orden de edicion recomendado:** Editar `firestore.rules` en un solo commit para mantener atomicidad. Correr `firebase emulators:exec` con los tests de rules despues.

---

### Fase 5: Documentacion

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `docs/reference/security.md` | Reemplazar `benoffi11@gmail.com` con `{ADMIN_EMAIL}` (2 ocurrencias: lineas 80 y 9 de patterns.md) |
| 2 | `docs/reference/security.md` | Agregar nota sobre SA keys: no se usan SA keys descargadas, usar ADC en su lugar |
| 3 | `docs/reference/security.md` | Actualizar tabla de rate limits: agregar `checkins_delete` row |
| 4 | `docs/reference/security.md` | Actualizar tabla de reglas por coleccion: `specials` y `achievements` con validacion de campos |
| 5 | `docs/reference/security.md` | Actualizar seccion "Campos server-only": nota sobre `likeCount` floor en 0 |
| 6 | `docs/reference/patterns.md` | Reemplazar `benoffi11@gmail.com` con `{ADMIN_EMAIL}` |
| 7 | `docs/reference/firestore.md` | Actualizar si hay descripcion de `specials`/`achievements` schema |

---

### Fase 6: Purga del historial git (#260)

**Importante:** Esta operacion reescribe el historial. Coordinar con todos los colaboradores antes de ejecutar.

| Paso | Accion |
|------|--------|
| 1 | Instalar `git-filter-repo`: `pip install git-filter-repo` |
| 2 | Crear archivo de replacements: `echo 'j9iVZfS8kkCEFUPaAeJV0sAi==>REDACTED_OAUTH_SECRET' > replacements.txt` |
| 3 | Ejecutar: `git filter-repo --replace-text replacements.txt` |
| 4 | Force-push: `git push origin new-home --force` |
| 5 | Notificar colaboradores que deben re-clonar o hacer `git fetch --all && git reset --hard origin/new-home` |
| 6 | Verificar: `git log --all -S 'j9iVZfS8kkCEFUPaAeJV0sAi'` debe retornar vacio |

**Nota:** Esta fase se ejecuta como el ULTIMO paso despues de mergear todos los cambios de codigo. La purga del historial invalida todos los SHAs existentes.

---

## Orden de implementacion

1. **Fase 1** — Acciones operacionales (revocar SA key, crear ADC, crear secret en Secret Manager)
2. **Fase 2** — Refactor `seed-staging.ts` (eliminar client_secret)
3. **Fase 3** — Cloud Functions fixes (commentLikes, menuPhotos, checkins)
4. **Fase 4** — Firestore rules (specials, achievements, userSettings, feedback)
5. **Fase 5** — Documentacion
6. **Commit, CI, deploy**
7. **Fase 6** — Purga del historial (post-merge, coordinar con equipo)

---

## Tests

| Archivo test | Que testear | Tipo |
|-------------|-------------|------|
| `functions/src/__tests__/commentLikes.test.ts` | `onCommentLikeDeleted`: likeCount no baja de 0 cuando ya es 0; likeCount decrementa correctamente desde > 0 | Unit |
| `functions/src/__tests__/menuPhotos.test.ts` | Rate limit exceeded: verificar que `snap.ref.delete()` es llamado | Unit |
| `functions/src/__tests__/checkins.test.ts` | `onCheckInDeleted`: 21 deletes en el mismo dia loguea abuso; 1-20 no loguea | Unit |
| `firestore.rules.test.ts` | specials: admin puede crear con campos validos; admin no puede crear con campo extra; usuario normal no puede escribir | Rules |
| `firestore.rules.test.ts` | achievements: idem specials | Rules |
| `firestore.rules.test.ts` | userSettings: owner no puede hacer delete; create con locality size > 100 rechazado; update con affectedKeys valido acepta | Rules |
| `firestore.rules.test.ts` | feedback update: admin puede actualizar campos de admin; owner puede marcar viewedByUser; owner NO puede usar campos de admin | Rules |
| `scripts/seed-staging.test.ts` | Script falla con error claro si ADC no existe; no contiene string `client_secret` en el codigo | Unit |

---

## Riesgos

| Riesgo | Probabilidad | Mitigacion |
|--------|-------------|-----------|
| `userSettings` delete ya existente en el codigo cliente (si hay algun path que llama `deleteDoc` en userSettings) | Baja | Grep `deleteDoc.*userSettings` antes de deployar las rules. Si existe, agregar antes de la Fase 4. |
| La transaccion en `onCommentLikeDeleted` aumenta latencia del trigger | Media | Transaccion es rapida (1 read + 1 write). Aceptable para un trigger de delete. |
| Purga de historial git afecta PRs abiertos y commits locales de colaboradores | Media | Ejecutar despues de mergear todo. Notificar via canal de comunicacion. Re-clonar es el camino mas seguro. |
| `specials`/`achievements` admin writes actuales pueden fallar si el schema real difiere del asumido | Baja | Revisar documentos existentes en Firestore antes de deployar las rules. Ajustar `hasOnly()` si hay campos adicionales. |

---

## Guardrails de seguridad

- [x] Toda coleccion nueva (specials, achievements split) tiene `hasOnly()` en create + `affectedKeys().hasOnly()` en update
- [x] `locality` field tiene `.size() <= 100`
- [x] `likeCount` decrement usa `Math.max(0, ...)` — nunca negativo
- [x] Rate limit de `menuPhotos` llama `snap.ref.delete()` (no solo log-only)
- [x] `userSettings` delete eliminado de las rules (campo permanente)
- [x] No hay secrets, admin emails, ni credenciales en archivos commiteados (post-fix)
- [x] `client_secret` purgado del historial git

## Criterios de done

- [ ] `scripts/seed-staging.ts` no contiene ningun secreto hardcodeado
- [ ] `sa-key.json` revocado en GCP y eliminado del disco
- [ ] `ADMIN_EMAIL` en Secret Manager, eliminado de `functions/.env`
- [ ] `specials` y `achievements` tienen `hasOnly()` + type validation en create y update
- [ ] `likeCount` no puede quedar negativo (test unitario pasa)
- [ ] `menuPhotos` elimina el doc cuando rate limit es excedido (test unitario pasa)
- [ ] `userSettings` split en create/update sin delete
- [ ] `feedback` update rule con parentesis explicitos
- [ ] `locality` limitado a 100 chars en rules
- [ ] Tests de rules pasan en emulador
- [ ] `docs/reference/security.md` actualizado (email, SA key policy, rate limits, rules table)
- [ ] Build y lint sin errores
- [ ] Historial git purgado (post-merge, Fase 6)

## Fase final: Documentacion

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `docs/reference/security.md` | Reemplazar email hardcodeado, agregar nota SA keys, actualizar tablas de rate limits y rules |
| 2 | `docs/reference/patterns.md` | Reemplazar email hardcodeado |
| 3 | `docs/reference/firestore.md` | Actualizar schema de `specials` y `achievements` si esta documentado |
