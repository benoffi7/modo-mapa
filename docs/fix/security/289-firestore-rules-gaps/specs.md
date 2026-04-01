# Specs: Security — sharedLists rate limit + Firestore rules field gaps + admin email

**Issue:** [#289](https://github.com/benoffi7/modo-mapa/issues/289)
**Fecha:** 2026-04-01

---

## Resumen de hallazgos

| ID | Severidad | Descripcion |
|----|-----------|-------------|
| H-01 | HIGH | Admin email expuesto en `functions/.env` commiteado — mover a Secret Manager + purgar historial git |
| H-02 | HIGH | Sin rate limit server-side en `sharedLists` — agregar trigger `onSharedListCreated` con limite 10/dia + `snap.ref.delete()` |
| H-03 | HIGH | Items de `followedTags` (lista en `userSettings`) sin validacion de longitud por elemento en Firestore rules |
| M-01 | MEDIUM | `listItems.businessId` no pasa `isValidBusinessId()` |
| M-02 | MEDIUM | `follows.followedId` sin limite de longitud (agregar `<= 128`) |
| M-03 | MEDIUM | `listItems.listId` sin limite de longitud (agregar `<= 128`) |

Hallazgos M-04 (recommendations dedup) y M-05 (git history purge de admin email) y los LOW se documentan en sus secciones correspondientes. M-05 es parte del trabajo de H-01.

---

## Modelo de datos

No se agregan colecciones nuevas. Los cambios son:

1. `userSettings.followedTags`: ya es `list`, pero los elementos individuales no validan `is string && size() <= 50`. Se agrega la validacion en rules.
2. `listItems.businessId`: ya existe pero no pasa `isValidBusinessId()`. Se agrega el check.
3. `listItems.listId`: ya existe pero sin `size() <= 128`. Se agrega el limite.
4. `follows.followedId`: ya existe pero sin `size() <= 128`. Se agrega el limite.
5. `sharedLists`: sin cambio de schema. Se agrega trigger para rate limit.

No hay interfaces TypeScript nuevas.

---

## Firestore Rules

### H-03: followedTags per-item validation

En `userSettings`, el bloque `create` y `update` validan que `followedTags` sea una lista con `size() <= 20`, pero no validan que cada elemento sea un string de longitud razonable. Un atacante podria enviar 20 strings de 1 MB cada uno.

Agregar una funcion auxiliar `isValidFollowedTags`:

```
function isValidFollowedTags(tags) {
  return tags is list
    && tags.size() <= 20
    && (tags.size() == 0
        || (tags[0] is string && tags[0].size() <= 50))
    && (tags.size() <= 1
        || (tags[1] is string && tags[1].size() <= 50))
    && (tags.size() <= 2
        || (tags[2] is string && tags[2].size() <= 50))
    && (tags.size() <= 3
        || (tags[3] is string && tags[3].size() <= 50))
    && (tags.size() <= 4
        || (tags[4] is string && tags[4].size() <= 50))
    && (tags.size() <= 5
        || (tags[5] is string && tags[5].size() <= 50))
    && (tags.size() <= 6
        || (tags[6] is string && tags[6].size() <= 50))
    && (tags.size() <= 7
        || (tags[7] is string && tags[7].size() <= 50))
    && (tags.size() <= 8
        || (tags[8] is string && tags[8].size() <= 50))
    && (tags.size() <= 9
        || (tags[9] is string && tags[9].size() <= 50))
    && (tags.size() <= 10
        || (tags[10] is string && tags[10].size() <= 50))
    && (tags.size() <= 11
        || (tags[11] is string && tags[11].size() <= 50))
    && (tags.size() <= 12
        || (tags[12] is string && tags[12].size() <= 50))
    && (tags.size() <= 13
        || (tags[13] is string && tags[13].size() <= 50))
    && (tags.size() <= 14
        || (tags[14] is string && tags[14].size() <= 50))
    && (tags.size() <= 15
        || (tags[15] is string && tags[15].size() <= 50))
    && (tags.size() <= 16
        || (tags[16] is string && tags[16].size() <= 50))
    && (tags.size() <= 17
        || (tags[17] is string && tags[17].size() <= 50))
    && (tags.size() <= 18
        || (tags[18] is string && tags[18].size() <= 50))
    && (tags.size() <= 19
        || (tags[19] is string && tags[19].size() <= 50));
}
```

Nota: Firestore Rules CEL no soporta iteracion de listas con `all()` para datos variables. El patron standard para validar todos los elementos es la enumeracion exhaustiva por indice, acotada al maximo de la lista (20 en este caso). Esta es la unica forma de lograrlo en CEL sin depender de Cloud Functions.

En `create`: reemplazar la linea existente:
```
&& (!('followedTags' in request.resource.data) || (request.resource.data.followedTags is list && request.resource.data.followedTags.size() <= 20))
```
por:
```
&& (!('followedTags' in request.resource.data) || isValidFollowedTags(request.resource.data.followedTags))
```

Aplicar el mismo reemplazo en `update`.

### M-01: listItems.businessId — agregar isValidBusinessId()

En `listItems` create, la linea actual:
```
&& request.resource.data.businessId is string
```
debe ser reemplazada por:
```
&& isValidBusinessId(request.resource.data.businessId)
```
Esto valida el formato `biz_NNN` usando la funcion ya existente en el archivo.

### M-02: follows.followedId — agregar size() <= 128

En `follows` create, despues de:
```
&& request.resource.data.followedId is string
&& request.resource.data.followedId.size() > 0
```
agregar:
```
&& request.resource.data.followedId.size() <= 128
```

### M-03: listItems.listId — agregar size() <= 128

En `listItems` create, despues de:
```
&& request.resource.data.listId is string
&& request.resource.data.listId.size() > 0
```
agregar:
```
&& request.resource.data.listId.size() <= 128
```

---

### Rules impact analysis

| Query (service file) | Collection | Auth context | Rule que lo permite | Cambio necesario? |
|---------------------|------------|-------------|-------------------|----------------|
| `checkRateLimit` en trigger `sharedLists.ts` | sharedLists | Admin SDK (trigger) | bypasses rules | No |
| Reads en `listItems` para `isItemListOwnerOrEditor()` | sharedLists | Owner/editor del list | `isAdmin() \|\| isListOwner() \|\| isListEditor() \|\| isPublic \|\| featured` | No |
| `onSharedListCreated` count query | sharedLists | Admin SDK (trigger) | bypasses rules | No |

Ningun cambio de rules nuevo afecta queries existentes en services del cliente.

### Field whitelist check

Los cambios son restricciones adicionales dentro de reglas ya existentes (nuevas validaciones de tipo/longitud). No se agregan campos nuevos a ninguna coleccion. No hay riesgo de rechazo silencioso por `hasOnly()`.

| Collection | Campo modificado | En create `hasOnly()`? | En update `affectedKeys().hasOnly()`? | Cambio de rules necesario? |
|-----------|-----------------|----------------------|--------------------------------------|--------------------------|
| userSettings | followedTags (validacion interna) | Si (ya estaba) | Si (ya estaba) | Solo logica interna — no hasOnly() |
| listItems | businessId (agregar isValidBusinessId) | Si (ya estaba) | N/A (no hay update) | No |
| listItems | listId (agregar size limit) | Si (ya estaba) | N/A (no hay update) | No |
| follows | followedId (agregar size limit) | Si (ya estaba) | N/A (no hay update) | No |

---

## Cloud Functions

### H-02: Nuevo trigger `onSharedListCreated`

**Archivo:** `functions/src/triggers/sharedLists.ts`

**Patron:** Identico a `onListItemCreated` en `functions/src/triggers/listItems.ts`.

```typescript
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { getDb } from '../helpers/env';
import { incrementCounter, trackWrite } from '../utils/counters';
import { logAbuse } from '../utils/abuseLogger';

export const onSharedListCreated = onDocumentCreated(
  'sharedLists/{listId}',
  async (event) => {
    const snap = event.data;
    if (!snap) return;
    const data = snap.data();
    const db = getDb();
    const ownerId = data.ownerId as string | undefined;

    // Always increment counters (write was already accepted by rules)
    await incrementCounter(db, 'sharedLists', 1);
    await trackWrite(db, 'sharedLists');

    // Rate limit: 10 sharedLists per day per user
    if (!ownerId) return;

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const snapshot = await db.collection('sharedLists')
      .where('ownerId', '==', ownerId)
      .where('createdAt', '>=', startOfDay)
      .count().get();
    const exceeded = snapshot.data().count > 10;

    if (exceeded) {
      await snap.ref.delete();
      await logAbuse(db, {
        userId: ownerId,
        type: 'rate_limit',
        collection: 'sharedLists',
        detail: 'Exceeded 10 sharedLists/day — document deleted',
      });
    }
  },
);
```

**Exportar en `functions/src/index.ts`:**
```typescript
export { onSharedListCreated } from './triggers/sharedLists';
```

### H-01: Admin email — mover a Secret Manager

**Situacion actual:**
`functions/.env` contiene `ADMIN_EMAIL=benoffi11@gmail.com` en texto plano y esta commiteado en git.

`functions/src/admin/claims.ts` lo consume via `defineString('ADMIN_EMAIL', ...)` de `firebase-functions/params`.

**Solucion:**

1. Crear el secret en Firebase Secret Manager:
   ```bash
   firebase functions:secrets:set ADMIN_EMAIL
   # ingresar el valor cuando se solicite
   ```

2. Modificar `functions/src/admin/claims.ts` — cambiar `defineString` por `defineSecret`:
   ```typescript
   import { defineSecret } from 'firebase-functions/params';

   const ADMIN_EMAIL_SECRET = defineSecret('ADMIN_EMAIL');

   export const setAdminClaim = onCall<{ targetUid: string }, Promise<{ success: true }>>(
     { enforceAppCheck: ENFORCE_APP_CHECK_ADMIN, secrets: [ADMIN_EMAIL_SECRET] },
     async (request) => {
       // ...
       const isBootstrap =
         request.auth?.token.email_verified === true &&
         request.auth?.token.email === ADMIN_EMAIL_SECRET.value();
       // ...
     }
   );
   ```
   Nota: al usar `defineSecret`, la funcion debe declarar `secrets: [ADMIN_EMAIL_SECRET]` en sus opciones. El valor solo esta disponible en runtime de la funcion, nunca en el bundle deployado.

3. Eliminar `ADMIN_EMAIL` de `functions/.env`. El archivo puede quedar solo con las otras variables no sensibles.

4. Purga del historial git (M-05): Requiere `git filter-repo --path functions/.env --invert-paths` o rewrite de commits. Esto es una operacion destructiva sobre el historial publico que requiere force-push. Se coordina por separado como una tarea de infraestructura. Este fix implementa el paso 1-3 (mitiga el riesgo activo) y el paso 4 se ejecuta manualmente por el admin del repo.

---

## Seed Data

No se agregan colecciones nuevas ni campos requeridos nuevos. No se requiere seed data.

---

## Componentes

No hay cambios de UI. Este fix es exclusivamente backend (Cloud Functions + Firestore rules).

---

## Hooks

No hay cambios de hooks.

---

## Servicios

No hay cambios en servicios del cliente.

---

## Integracion

El trigger `onSharedListCreated` se exporta desde `functions/src/index.ts`. No hay cambios en el cliente.

### Preventive checklist

- [x] **Service layer**: No hay imports directos de `firebase/firestore` — cambios son solo en `functions/` y `firestore.rules`
- [x] **Duplicated constants**: Sin constantes nuevas
- [x] **Context-first data**: No aplica
- [x] **Silent .catch**: El trigger no tiene `.catch(() => {})` — sigue el patron de `listItems.ts`
- [x] **Stale props**: No aplica (no hay UI)

---

## Tests

| Archivo test | Que testear | Tipo |
|-------------|-------------|------|
| `functions/src/__tests__/triggers/sharedLists.test.ts` | Nuevo trigger `onSharedListCreated` | Unit |
| `functions/src/__tests__/admin/claims.test.ts` | Actualizar mocks para `defineSecret` en vez de `defineString` | Unit |

### Escenarios para `sharedLists.test.ts`

Siguiendo el patron exacto de `listItems.test.ts`:

1. `skips if no snapshot data` — `event.data = null` no llama a `incrementCounter`
2. `increments counters without rate limit check when ownerId is missing` — sin `ownerId`, llama counters pero no hace query de conteo
3. `increments counters and does not log abuse when rate limit not exceeded` — count = 5, no llama `logAbuse`
4. `deletes document and logs abuse when rate limit exceeded` — count = 11, llama `snap.ref.delete()` y `logAbuse` con detail correcto
5. `does not delete document when rate limit not exceeded` — count = 5, `mockDelete` no se llama
6. `logs correct detail message` — verifica string `'Exceeded 10 sharedLists/day — document deleted'`

### Actualizacion de `claims.test.ts`

El mock de `firebase-functions/params` actualmente define `defineString`. Agregar `defineSecret` al mock con el mismo patron (`vi.fn().mockReturnValue({ value: () => 'admin@test.com' })`).

---

## Analytics

Sin nuevos eventos de analytics.

---

## Offline

No aplica. Los cambios son en reglas de seguridad y triggers de backend.

---

## Accesibilidad y UI mobile

No aplica. No hay cambios de UI.

---

## Textos y copy

No aplica. No hay textos de usuario.

---

## Decisiones tecnicas

### Por que 10/dia para sharedLists (no mas ni menos)

El limite de `listItems` es 100/dia porque un usuario activo puede agregar muchos items a listas. Para la creacion de listas en si, 10/dia es generoso para uso legitimo (un usuario rara vez crea mas de 2-3 listas por dia) pero suficiente para bloquear ataques de spam que intentan crear miles de documentos para llenar storage o inflar contadores.

### Por que no usar `checkRateLimit` de `utils/rateLimiter.ts`

`checkRateLimit` usa el campo `userId` para el query. `sharedLists` usa `ownerId`. Igual que `listItems` (que usa `addedBy`), se hace el query inline para evitar un parametro adicional en la interfaz de `checkRateLimit`. La alternativa de agregar un parametro `userField` a `checkRateLimit` fue descartada para no romper la interfaz del util sin necesidad.

### Por que `defineSecret` y no seguir usando `defineString`

`defineString` lee de `functions/.env` o de Firebase environment config — el valor queda en texto plano en el repositorio. `defineSecret` almacena el valor en GCP Secret Manager y solo lo expone en runtime de la funcion especifica que lo declara. Para un email de admin que habilita bootstrap de privilegios, esto es la mitigacion correcta.

### Historial git (M-05)

La purga de historial requiere `git filter-repo` y force-push al repo publico, lo cual rompe el historial de todos los forks y clones existentes. Es una operacion con impacto de coordinacion no trivial. Se implementa en paso separado despues de mergear este fix, con aviso a colaboradores. Este issue solo resuelve el riesgo activo (el secret sigue disponible en el sistema en produccion hasta que el nuevo secret este deployado).

---

## Hardening de seguridad

### Firestore rules requeridas

Ver seccion "Firestore Rules" arriba para el codigo exacto de cada cambio.

### Rate limiting

| Coleccion | Limite | Implementacion |
|-----------|--------|---------------|
| sharedLists | 10/dia por usuario | `onSharedListCreated` en `functions/src/triggers/sharedLists.ts` |

Los decrementos de contadores en triggers ya existentes usan `Math.max(0, ...)` donde aplica. El nuevo trigger solo incrementa (no hay decremento en `onSharedListCreated`).

### Vectores de ataque mitigados

| Ataque | Mitigacion | Archivo |
|--------|-----------|---------|
| Spam de creacion de listas (storage exhaustion, counter inflation) | Rate limit 10/dia + `snap.ref.delete()` | `functions/src/triggers/sharedLists.ts` |
| Payload inflado en `followedTags` (lista de strings gigantes) | Validacion `size() <= 50` por elemento | `firestore.rules` |
| `listItems` con `businessId` arbitrario (formato invalido) | `isValidBusinessId()` check | `firestore.rules` |
| `follows` con `followedId` exageradamente largo | `size() <= 128` | `firestore.rules` |
| `listItems` con `listId` exageradamente largo | `size() <= 128` | `firestore.rules` |
| Bootstrap de admin via email expuesto en historial git | Email movido a Secret Manager | `functions/src/admin/claims.ts` |

---

## Deuda tecnica: mitigacion incorporada

```bash
gh issue list --label security --state open --json number,title
```

| Issue | Que se resuelve | Paso del plan |
|-------|----------------|---------------|
| #289 H-01 | Admin email en `.env` commiteado | Fase 2, pasos 1-3 |
| #289 H-02 | Sin rate limit en sharedLists | Fase 1, pasos 1-3 |
| #289 H-03 | followedTags items sin size validation | Fase 3, paso 1 |
| #289 M-01 | listItems.businessId sin isValidBusinessId | Fase 3, paso 2 |
| #289 M-02 | follows.followedId sin size limit | Fase 3, paso 3 |
| #289 M-03 | listItems.listId sin size limit | Fase 3, paso 4 |
