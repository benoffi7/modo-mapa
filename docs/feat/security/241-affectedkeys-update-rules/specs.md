# Specs: affectedKeys() Update Rules para ratings, customTags y priceLevels

**PRD:** [prd.md](prd.md)
**Fecha:** 2026-03-29

---

## Modelo de datos

No hay cambios en el modelo de datos. Las colecciones afectadas son:

- `ratings` — doc ID `{userId}__{businessId}`
- `customTags` — doc ID auto-generated
- `priceLevels` — doc ID `{userId}__{businessId}`

Los tipos TypeScript existentes en `src/types/` no requieren modificaciones.

---

## Firestore Rules

### ratings update (lineas 87-95 actuales)

**Problema:** No tiene `affectedKeys().hasOnly()`. No valida immutabilidad de `businessId` ni `createdAt`. Un atacante puede re-apuntar su rating a otro comercio.

**Regla actual:**

```
allow update: if request.auth != null
  && resource.data.userId == request.auth.uid
  && request.resource.data.userId == resource.data.userId
  && request.resource.data.score is int
  && request.resource.data.score >= 1
  && request.resource.data.score <= 5
  && request.resource.data.updatedAt == request.time
  && isValidCriteria(request.resource.data);
```

**Regla nueva:**

```
allow update: if request.auth != null
  && resource.data.userId == request.auth.uid
  && request.resource.data.diff(resource.data).affectedKeys()
     .hasOnly(['score', 'updatedAt', 'criteria'])
  && request.resource.data.score is int
  && request.resource.data.score >= 1
  && request.resource.data.score <= 5
  && request.resource.data.updatedAt == request.time
  && isValidCriteria(request.resource.data);
```

**Cambios:**
1. Se agrega `affectedKeys().hasOnly(['score', 'updatedAt', 'criteria'])` — restringe campos modificables
2. Se remueve `request.resource.data.userId == resource.data.userId` — redundante con `affectedKeys()` que ya impide cambiar `userId`

### customTags update (lineas 204-209 actuales)

**Problema:** No tiene `affectedKeys().hasOnly()`. No valida immutabilidad de `businessId`. Un atacante puede re-asignar tags a otro comercio.

**Regla actual:**

```
allow update: if request.auth != null
  && resource.data.userId == request.auth.uid
  && request.resource.data.userId == resource.data.userId
  && request.resource.data.label is string
  && request.resource.data.label.size() > 0
  && request.resource.data.label.size() <= 30;
```

**Regla nueva:**

```
allow update: if request.auth != null
  && resource.data.userId == request.auth.uid
  && request.resource.data.diff(resource.data).affectedKeys()
     .hasOnly(['label'])
  && request.resource.data.label is string
  && request.resource.data.label.size() > 0
  && request.resource.data.label.size() <= 30;
```

**Cambios:**
1. Se agrega `affectedKeys().hasOnly(['label'])` — el servicio solo envia `label`
2. Se remueve `request.resource.data.userId == resource.data.userId` — redundante con `affectedKeys()`

### priceLevels update (lineas 274-280 actuales)

**Problema:** No tiene `affectedKeys().hasOnly()`. No valida immutabilidad de `businessId`. Un atacante puede mover su voto a otro comercio.

**Regla actual:**

```
allow update: if request.auth != null
  && resource.data.userId == request.auth.uid
  && request.resource.data.userId == resource.data.userId
  && request.resource.data.level is int
  && request.resource.data.level >= 1
  && request.resource.data.level <= 3
  && request.resource.data.updatedAt == request.time;
```

**Regla nueva:**

```
allow update: if request.auth != null
  && resource.data.userId == request.auth.uid
  && request.resource.data.diff(resource.data).affectedKeys()
     .hasOnly(['level', 'updatedAt'])
  && request.resource.data.level is int
  && request.resource.data.level >= 1
  && request.resource.data.level <= 3
  && request.resource.data.updatedAt == request.time;
```

**Cambios:**
1. Se agrega `affectedKeys().hasOnly(['level', 'updatedAt'])` — campos que el servicio envia
2. Se remueve `request.resource.data.userId == resource.data.userId` — redundante con `affectedKeys()`

### Rules impact analysis

No hay queries nuevas. Solo se modifican reglas de `update` existentes.

| Query (service file) | Collection | Auth context | Rule que permite | Cambio necesario? |
|---------------------|------------|-------------|-----------------|-------------------|
| `upsertRating` update path (`services/ratings.ts`) | ratings | Owner (auth.uid == userId) | `allow update` con owner check | SI — agregar `affectedKeys()` |
| `upsertCriteriaRating` (`services/ratings.ts`) | ratings | Owner | `allow update` con owner check | SI — agregar `affectedKeys()` |
| `updateCustomTag` (`services/tags.ts`) | customTags | Owner | `allow update` con owner check | SI — agregar `affectedKeys()` |
| `upsertPriceLevel` update path (`services/priceLevels.ts`) | priceLevels | Owner | `allow update` con owner check | SI — agregar `affectedKeys()` |

### Verificacion de compatibilidad servicio-regla

| Servicio | Campos enviados en updateDoc | affectedKeys permitidos | Compatible? |
|----------|------------------------------|------------------------|-------------|
| `upsertRating` | `score`, `criteria` (opcional), `updatedAt` | `['score', 'updatedAt', 'criteria']` | SI |
| `upsertCriteriaRating` | `criteria`, `updatedAt` | `['score', 'updatedAt', 'criteria']` | SI |
| `updateCustomTag` | `label` | `['label']` | SI |
| `upsertPriceLevel` | `level`, `updatedAt` | `['level', 'updatedAt']` | SI |

### Field whitelist check

No se agregan campos nuevos a ninguna coleccion. Solo se restringe cuales campos son modificables en updates.

| Collection | Campo | En create `hasOnly()`? | En update `affectedKeys().hasOnly()`? | Cambio necesario? |
|-----------|-------|----------------------|--------------------------------------|-------------------|
| ratings | score | SI | NO (se agrega) | SI |
| ratings | updatedAt | SI | NO (se agrega) | SI |
| ratings | criteria | SI | NO (se agrega) | SI |
| customTags | label | SI (via `keys().hasOnly`) | NO (se agrega) | SI |
| priceLevels | level | SI | NO (se agrega) | SI |
| priceLevels | updatedAt | SI | NO (se agrega) | SI |

---

## Cloud Functions

No hay cambios en Cloud Functions. Los triggers de `onRatingCreated`, `onCustomTagCreated` y `onPriceLevelCreated` no se ven afectados porque operan sobre creates, no updates. Los triggers de update (si existen) usan Admin SDK que bypasea rules.

---

## Componentes

No hay cambios en componentes React.

---

## Textos de usuario

No hay textos nuevos de usuario. Este cambio es invisible para el usuario.

---

## Hooks

No hay cambios en hooks.

---

## Servicios

No hay cambios en servicios. Los servicios ya envian exactamente los campos permitidos:

- `ratings.ts`: `upsertRating` envia `{ score, criteria?, updatedAt }` / `upsertCriteriaRating` envia `{ criteria, updatedAt }`
- `tags.ts`: `updateCustomTag` envia `{ label }`
- `priceLevels.ts`: `upsertPriceLevel` envia `{ level, updatedAt }`

---

## Integracion

No hay cambios de integracion. Este feature es exclusivamente una modificacion de `firestore.rules`.

### Preventive checklist

- [x] **Service layer**: No aplica — no hay cambios en componentes
- [x] **Duplicated constants**: No aplica
- [x] **Context-first data**: No aplica
- [x] **Silent .catch**: No aplica
- [x] **Stale props**: No aplica

---

## Tests

No se agregan tests automatizados (no hay framework de Firestore rules testing configurado). La verificacion se hace via emuladores.

| Archivo test | Que testear | Tipo |
|-------------|-------------|------|
| `firestore.rules` | Update de rating con `businessId` diferente es rechazado | Manual / Emulador |
| `firestore.rules` | Update de rating con `createdAt` diferente es rechazado | Manual / Emulador |
| `firestore.rules` | Update de rating con solo `score`/`criteria`/`updatedAt` funciona | Manual / Emulador |
| `firestore.rules` | Update de customTag con `businessId` diferente es rechazado | Manual / Emulador |
| `firestore.rules` | Update de customTag con solo `label` funciona | Manual / Emulador |
| `firestore.rules` | Update de priceLevel con `businessId` diferente es rechazado | Manual / Emulador |
| `firestore.rules` | Update de priceLevel con solo `level`/`updatedAt` funciona | Manual / Emulador |

---

## Analytics

No hay eventos nuevos de analytics.

---

## Offline

No hay impacto en la estrategia offline. Las Firestore rules se evaluan server-side al sincronizar; los writes en cola offline se validan al reconectar. Si un write malicioso fue encolado offline, sera rechazado al sincronizar.

---

## Decisiones tecnicas

1. **Remocion de validacion explicita de `userId` immutability**: Al agregar `affectedKeys().hasOnly()`, la validacion `request.resource.data.userId == resource.data.userId` se vuelve redundante, ya que `affectedKeys()` no incluye `userId` en la lista permitida, ergo cualquier intento de cambiar `userId` sera rechazado antes. Se remueve por claridad y consistencia con el patron usado en `comments` update rule.

2. **`criteria` incluido en affectedKeys de ratings**: Aunque `upsertCriteriaRating` solo envia `criteria` + `updatedAt`, el `upsertRating` puede enviar `score` + `criteria` + `updatedAt`. Se incluyen los tres para cubrir ambos paths.

3. **`label` es el unico campo editable en customTags**: El servicio `updateCustomTag` no envia `updatedAt` (a diferencia de ratings y priceLevels). Esto es correcto: la coleccion no tiene campo `updatedAt`.

---

## Hardening de seguridad

### Firestore rules requeridas

El codigo exacto de las tres reglas se encuentra arriba en la seccion "Firestore Rules".

### Rate limiting

No se agregan colecciones nuevas escribibles. Las colecciones ya tienen rate limiting server-side via Cloud Functions triggers.

### Vectores de ataque mitigados

| Ataque | Mitigacion | Archivo |
|--------|-----------|---------|
| Re-targeting de `businessId` en ratings | `affectedKeys().hasOnly(['score','updatedAt','criteria'])` impide modificar `businessId` | `firestore.rules` |
| Re-targeting de `businessId` en customTags | `affectedKeys().hasOnly(['label'])` impide modificar `businessId` | `firestore.rules` |
| Re-targeting de `businessId` en priceLevels | `affectedKeys().hasOnly(['level','updatedAt'])` impide modificar `businessId` | `firestore.rules` |
| Cambio de `userId` para impersonar otro usuario | `affectedKeys()` no incluye `userId` en ninguna de las tres reglas | `firestore.rules` |
| Cambio de `createdAt` para manipular timestamps | `affectedKeys()` no incluye `createdAt` en ninguna de las tres reglas | `firestore.rules` |
| Field injection (agregar campos arbitrarios) | `affectedKeys().hasOnly()` rechaza cualquier campo no listado | `firestore.rules` |

---

## Deuda tecnica: mitigacion incorporada

No hay issues abiertos de security ni tech debt en GitHub. Este fix cierra la brecha identificada en la auditoria post-v2.32.0 y alinea las tres colecciones con el patron `affectedKeys().hasOnly()` ya establecido en `comments`, `notifications`, `abuseLogs`, `feedback`, `recommendations`, `users` y `sharedLists`.
