# Specs: Loading infinito en AuthContext ante fallo de lectura de perfil

**PRD:** [prd.md](prd.md)
**Fecha:** 2026-06-10
**Issue:** #341

---

## Resumen ejecutivo

Fix de correctness en el camino critico de autenticacion. Tres archivos:
`src/context/AuthContext.tsx`, `src/services/userProfile.ts`, `firestore.rules`.
Sin UI nueva, sin tipos nuevos, sin colecciones nuevas.

El trabajo se separa en dos tracks **independientes** (alineado con la
observacion de Sofia):

- **S1 (loading infinito)** — core del issue. NO depende de la decision D1.
  Se implementa y mergea **solo y primero**.
- **S2 (`updateUserAvatar` fallback + rule)** — depende de la decision de
  producto D1 (¿user doc con `avatarId` sin `displayName` valido?). Se
  implementa en una fase posterior, gateada por D1. NO bloquea a S1.

> **Decision D1 (Gonzalo) — RESUELTA 2026-06-12: Camino (a) = SI.** Es valido
> un user doc con `avatarId` sin `displayName`. S2 relaja la regla de create
> para permitir create solo-avatar (displayName/displayNameLower ausentes XOR
> ambos presentes-y-sincronizados; preserva hasOnly, ownership, createdAt
> server-side e invariante #322 R12). El limite `avatarId .size() <= 50` se
> aplica en create + update. Camino (b) descartado. S1 ya estaba desbloqueado
> (no depende de D1); con D1 resuelta, S2 queda habilitado para implementacion.

---

## Modelo de datos

No se agregan colecciones ni campos. La coleccion `users` y el campo
`avatarId` ya existen (ver `src/config/converters/userConverters.ts` y
`firestore.rules:22-77`).

Tipos involucrados (existentes, no se modifican):

- `UserProfile` (`src/types/user.ts`) — devuelto por `fetchUserProfileDoc`.
- `UserProfileData` (`src/services/userProfile.ts`) — agregacion del perfil
  publico, NO se toca.

El contrato semantico que cambia (no el shape): `fetchUserProfileDoc` pasa a
ser **best-effort** — puede devolver `null` ante fallo de lectura, igual que
`fetchUserProfile` ya lo es (`userProfile.ts:80-81`). No es un cambio de tipo:
la firma `Promise<UserProfile | null>` ya admite `null`; lo que cambia es que
ahora `null` tambien cubre el caso "la lectura fallo" (antes solo cubria
"el doc no existe").

### Estado de auth tras fallo de lectura (S4, observable)

Cuando `fetchUserProfileDoc` falla, `displayName`/`avatarId` quedan `null`
momentaneamente — estado identico al de un anonimo nuevo, ya soportado por la
app. No hay re-fetch automatico (retry fuera de scope). Rehidratacion en el
proximo `onAuthStateChanged` (token refresh) o cuando el usuario setee nombre/
avatar. La app renderiza normalmente; `isLoading` siempre llega a `false`.

> **Read-back de doc solo-avatar (SOLO si D1 = camino (a)).** Tras un
> `setDoc({ avatarId, createdAt })` solo-avatar, cuando AuthContext re-lee el doc
> via `fetchUserProfileDoc` (que usa `userProfileConverter`), el `fromFirestore`
> devuelve `displayName: undefined` (el campo no esta en el doc). El caller lo
> normaliza con `setDisplayNameState(profile.displayName || null)` → queda
> `null`. **Estado ya soportado, no crashea** (`toDate(createdAt)` tambien esta
> cubierto). Constancia para el implementador: NO es necesario "arreglar" el
> converter ni agregar defaults; `displayName=null` es el resultado esperado y
> correcto del read-back de un doc solo-avatar.

## Firestore Rules

> **Solo aplica si D1 = camino (a).** Si D1 = camino (b), NO se tocan las rules
> y esta seccion se omite en implementacion (excepto el limite `.size() <= 50`
> de `avatarId`, ver mas abajo, que se aplica **independientemente de D1**).

### Limite `avatarId .size() <= 50` (independiente de D1)

El checklist de seguridad del PRD (L125) exige validar longitud de `avatarId`.
Hoy la regla solo valida `is string` en create (L44) y update (L61). Se agrega
`.size() <= 50` en **ambos** paths (create + update), conforme la observacion
de Sofia: el limite NO debe quedar solo en el create nuevo.

Create (`firestore.rules:44`), reemplazar:

```
&& (!('avatarId' in request.resource.data) || request.resource.data.avatarId is string)
```

por:

```
&& (!('avatarId' in request.resource.data)
    || (request.resource.data.avatarId is string
        && request.resource.data.avatarId.size() <= 50))
```

Update (`firestore.rules:61`), reemplazar:

```
&& (!('avatarId' in request.resource.data) || request.resource.data.avatarId is string)
```

por:

```
&& (!('avatarId' in request.resource.data)
    || (request.resource.data.avatarId is string
        && request.resource.data.avatarId.size() <= 50))
```

> Nota: el update usa `request.resource.data.avatarId` (no `affectedKeys`)
> porque el doc resultante siempre contiene `avatarId` si el cliente lo escribe;
> el guard `'avatarId' in request.resource.data` es suficiente. Este patron
> matchea el existente en L61.

### Create solo-avatar (SOLO si D1 = camino (a))

Hoy el create (`firestore.rules:28-45`) exige `displayName` presente, `> 0`,
`<= 30`, charset, y `displayNameLower == displayName.lower()`. Un create con
solo `avatarId` + `createdAt` es **DENEGADO** (confirmado, test #2 en
`users.rules.test.ts:88` cubre el deny actual).

Camino (a) relaja la **obligatoriedad** de `displayName`/`displayNameLower`
manteniendo: `hasOnly` estricto, ownership por doc ID, `createdAt` server-side,
y la invariante #322 R12 (`displayNameLower == displayName.lower()`). La regla
debe permitir **ambos ausentes XOR ambos presentes-y-sincronizados** — nunca
`displayNameLower` solo (cierra el hueco de desincronizacion B5).

Nueva regla de create propuesta (reemplaza L28-45):

```
allow create: if request.auth != null && request.auth.uid == userId
  && request.resource.data.keys().hasOnly(['displayName', 'displayNameLower', 'avatarId', 'createdAt'])
  // displayName y displayNameLower: ambos ausentes (create solo-avatar) XOR
  // ambos presentes-y-sincronizados. Nunca uno sin el otro.
  && (
    (!('displayName' in request.resource.data) && !('displayNameLower' in request.resource.data))
    || (
      request.resource.data.displayName is string
      && request.resource.data.displayName.size() > 0
      && request.resource.data.displayName.size() <= 30
      && request.resource.data.displayName.matches('^[A-Za-z0-9À-ÿ_-]([A-Za-z0-9À-ÿ ._-]*[A-Za-z0-9À-ÿ_-])?$')
      && request.resource.data.displayNameLower is string
      && request.resource.data.displayNameLower == request.resource.data.displayName.lower()
    )
  )
  // create solo-avatar requiere al menos avatarId (no permitir doc vacio
  // solo-createdAt sin proposito)
  && ('avatarId' in request.resource.data || 'displayName' in request.resource.data)
  && (!('avatarId' in request.resource.data)
      || (request.resource.data.avatarId is string
          && request.resource.data.avatarId.size() <= 50))
  && request.resource.data.createdAt == request.time;
```

> Invariante preservada: si `displayName` esta ausente, `displayNameLower`
> tambien debe estarlo (rama 1). No existe forma de enviar `displayNameLower`
> sin `displayName` valido y sincronizado. El `hasOnly` sigue siendo la misma
> whitelist de 4 campos — no se agrega ningun campo.

### Rules impact analysis

| Query (service file) | Collection | Auth context | Rule que la permite | Cambio? |
|---------------------|------------|-------------|---------------------|---------|
| `fetchUserProfileDoc(uid)` (`userProfile.ts`) | users | owner leyendo su doc | `allow read: request.auth.uid == userId` | No |
| `updateUserAvatar` updateDoc (`userProfile.ts`) | users | owner editando su doc | `allow update` (L46-76) | No (avatarId ya en `affectedKeys` whitelist) |
| `updateUserAvatar` setDoc create solo-avatar (S2, camino a) | users | owner creando su doc | `allow create` modificado (arriba) | **SI — solo si D1=(a)** |

> El fix de S1 NO agrega ninguna query nueva: `fetchUserProfileDoc` ya existia.
> Solo cambia el manejo de su fallo. No hay riesgo de permission error nuevo.

### Field whitelist check

| Collection | Campo nuevo/modificado | En create `hasOnly()`? | En update `affectedKeys().hasOnly()`? | Cambio? |
|-----------|------------------------|------------------------|---------------------------------------|---------|
| users | avatarId (limite `.size()<=50`) | SI (ya en whitelist) | SI (ya en whitelist) | NO whitelist; SI validacion de tamaño en ambos paths |
| users | displayName/displayNameLower opcionales en create (camino a) | SI (ya en whitelist) | N/A | NO whitelist; SI obligatoriedad relajada |

> No se agrega ningun campo nuevo al `hasOnly`. El cambio es de **validacion**
> (tamaño de avatarId, obligatoriedad de displayName), no de whitelist.

## Cloud Functions

Ninguna. El fix no agrega triggers, scheduled ni callables. `users` no requiere
trigger de rate limit (1 doc por usuario, campos idempotentes — confirmado en
PRD L120/L127).

## Seed Data

No aplica. No se crean colecciones nuevas ni campos requeridos nuevos. La
coleccion `users` y `avatarId` ya existen en los seeds actuales.

## Componentes

Ninguno nuevo ni modificado. El fix vive en context + service + rules. Sin UI.

### Mutable prop audit

No aplica. No hay componentes que reciban data como prop y la muten.

## Textos de usuario

No hay copy user-facing nuevo. Los unicos strings nuevos son mensajes de
`logger.error` (internos, no visibles al usuario, van a Sentry en prod):

| Texto | Donde se usa | Notas |
|-------|-------------|-------|
| `[AuthContext] fetchUserProfileDoc failed on auth state change:` | catch en callback de `onAuthStateChanged` | interno, Sentry — no user-facing |
| `[userProfile] fetchUserProfileDoc getDoc failed:` | `.catch` defensivo en `fetchUserProfileDoc` | interno, Sentry — no user-facing |

## Hooks

Ninguno nuevo. No se modifica ningun hook.

## Servicios

### `src/services/userProfile.ts`

#### `fetchUserProfileDoc(uid: string): Promise<UserProfile | null>` (S1 — modificado)

Agregar `.catch` defensivo al `measuredGetDoc`, alineando el contrato con
`fetchUserProfile` (L80-81). Devuelve `null` ante fallo en vez de re-throw.

```ts
export async function fetchUserProfileDoc(uid: string): Promise<UserProfile | null> {
  const ref = doc(db, COLLECTIONS.USERS, uid).withConverter(userProfileConverter);
  const snap = await measuredGetDoc('userProfile_doc', ref)
    .catch((err) => {
      logger.error('[userProfile] fetchUserProfileDoc getDoc failed:', err);
      return null;
    });
  return snap?.exists() ? snap.data() : null;
}
```

> `logger.error` NUNCA dentro de `if (import.meta.env.DEV)` (patron #294 — rompe
> Sentry). `measuredGetDoc` se mantiene (instrumentacion de perf intacta).

#### `updateUserAvatar(uid: string, avatarId: string): Promise<void>` (S2 — depende de D1)

**Camino (a) — D1 = SI (user doc puede tener avatar sin nombre):** paridad con
`updateUserDisplayName`. Chequea existencia y crea con `setDoc` (incluyendo
`createdAt: serverTimestamp()`) si no existe, o `updateDoc` si si.

```ts
export async function updateUserAvatar(uid: string, avatarId: string): Promise<void> {
  const ref = doc(db, COLLECTIONS.USERS, uid);
  const snap = await measuredGetDoc('userProfile_existsCheck', ref);
  if (snap.exists()) {
    await updateDoc(ref, { avatarId });
  } else {
    await setDoc(ref, { avatarId, createdAt: serverTimestamp() });
  }
}
```

**Camino (b) — D1 = NO (displayName es campo primario):** NO crea el doc. El
catch debe **discriminar** el error: SOLO el `not-found` (doc aun no creado
porque el usuario no seteo displayName) se traga con `logger.warn` y sin
re-throw, dejando el estado optimista en memoria. **Cualquier otro error
(`permission-denied`, red transitoria, etc.) se RE-LANZA** para que el caller
`setAvatarId` (`AuthContext.tsx:141-144`) ejecute su revert legitimo del
optimistic update.

> **Por que la discriminacion es obligatoria:** `setAvatarId` revierte el avatar
> ante cualquier throw de `updateUserAvatar`. Un catch que se traga TODO romperia
> ese revert: el usuario online con doc existente cuyo `updateDoc` falla por
> `permission-denied` o error de red veria el avatar nuevo en la UI sin que se
> haya persistido, **sin enterarse** (hoy, sin el fix, ese caso SI revierte).
> Tragar solo `not-found` preserva el comportamiento actual para todos los demas
> errores y honra el Criterio de aceptacion ("optimistic revert de avatar solo
> en error real").

Mecanismo de discriminacion: inspeccionar el `code` del `FirestoreError`
(`err.code === 'not-found'`). Solo ese codigo se traga; el resto se re-lanza.

```ts
export async function updateUserAvatar(uid: string, avatarId: string): Promise<void> {
  const ref = doc(db, COLLECTIONS.USERS, uid);
  try {
    await updateDoc(ref, { avatarId });
  } catch (err) {
    // SOLO not-found se traga: el doc aun no existe (usuario sin displayName).
    // Se persiste en la proxima oportunidad (cuando setee displayName). El caller
    // mantiene el optimistic update en memoria.
    if ((err as { code?: string }).code === 'not-found') {
      logger.warn('[userProfile] updateUserAvatar skipped (doc not found yet):', err);
      return;
    }
    // Cualquier otro error (permission-denied, red, etc.) se RE-LANZA para que
    // el caller (setAvatarId) revierta el optimistic update. No swallow.
    throw err;
  }
}
```

> **CRUCE CON #344 — no pisar el fallback.** #344 agrega offline guard
> (`withOfflineSupport`) sobre el MISMO callsite (`setAvatarId` en
> `AuthContext.tsx:134-145`, que llama a `updateUserAvatar`). Coordinacion:
> este PRD toca el cuerpo de `updateUserAvatar` (service); #344 wrappea la
> llamada desde el context. Son capas distintas (service vs callsite del
> context) y NO deben colisionar. **Quien mergee segundo NO debe revertir el
> fallback setDoc/catch de este PRD.** Dejar nota en el PR. En camino (b), el
> `logger.warn` interno NO interfiere con el offline enqueue de #344: el offline
> guard intercepta ANTES de llamar al service cuando esta offline; el
> `try/catch` del service solo actua online cuando el doc no existe.

## Integracion

### S1 — `src/context/AuthContext.tsx` (callback de `onAuthStateChanged`)

Envolver el cuerpo del callback en try/finally para garantizar
`setIsLoading(false)` siempre. El `finally` cubre **ambas ramas** (firebaseUser
presente y ausente/anonimo).

```ts
const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
  try {
    if (firebaseUser) {
      setUser(firebaseUser);
      const method = getAuthMethod(firebaseUser);
      setAuthMethod(method);
      setEmailVerified(firebaseUser.emailVerified);
      setUserProperty('auth_type', method);
      const profile = await fetchUserProfileDoc(firebaseUser.uid);
      if (profile) {
        setDisplayNameState(profile.displayName || null);
        setAvatarIdState(profile.avatarId ?? null);
      }
    } else {
      const isAdminRoute = pathnameRef.current.startsWith('/admin');
      if (isAdminRoute) {
        setUser(null);
      } else {
        try {
          await signInAnonymously(auth);
        } catch (error) {
          logger.error('Error signing in anonymously:', error);
        }
      }
    }
  } catch (error) {
    // Defensa del camino critico: cualquier fallo (lectura de perfil, etc.)
    // no debe dejar la app en loading infinito. La app entra igual.
    logger.error('[AuthContext] fetchUserProfileDoc failed on auth state change:', error);
  } finally {
    setIsLoading(false);
  }
});
```

> Doble defensa (defense-in-depth): el `.catch` en el service (S1) hace que
> `fetchUserProfileDoc` ya no lance, y el try/finally del callback garantiza
> `setIsLoading(false)` aun si otra linea del callback fallara (ej: un
> `setUserProperty` que tire). Ambas capas son intencionales — no es redundancia
> a eliminar.

### Preventive checklist

- [x] **Service layer**: AuthContext usa `userProfile.ts` (service) para reads/
  writes. No importa `firebase/firestore` directamente. Se mantiene.
- [x] **Duplicated constants**: no se agregan constantes.
- [x] **Context-first data**: `avatarId`/`displayName` siguen viniendo de
  AuthContext. No se agrega `getDoc` extra en componentes.
- [x] **Silent .catch**: el `.catch` de `fetchUserProfileDoc` usa `logger.error`
  (no `() => {}`). El `try/catch` de camino (b) de `updateUserAvatar` usa
  `logger.warn`. Cumple la regla "No silent .catch".
- [x] **Stale props**: no aplica (sin componentes nuevos).

## Tests

| Archivo test | Que testear | Tipo |
|-------------|-------------|------|
| `src/context/AuthContext.test.tsx` (existe, 35 casos) | **S1.** Nuevo: `fetchUserProfileDoc` rechaza (mock `getDoc` reject) → `isLoading` queda `false` (no infinito). Nuevo: rechaza → `displayName`/`avatarId` quedan `null` y no crashea. Nuevo: verificar `logger.error` invocado (senal Sentry, Success Criteria #2). Nuevo: rama anonima sigue llamando `setIsLoading(false)` en `finally`. | Context |
| `src/services/__tests__/userProfile.test.ts` (existe, 8 casos) | **S1.** Reemplazar test "propagates errors" de `fetchUserProfileDoc` (L80-85): ahora `getDoc` rechaza → devuelve `null` (no lanza) + `logger.error` llamado. **S2 (camino a):** `updateUserAvatar` doc existe → `updateDoc`; doc no existe → `setDoc` con `avatarId` + `createdAt`. **S2 (camino b):** `updateUserAvatar` `updateDoc` rechaza `{code:'not-found'}` → NO lanza + `logger.warn` llamado (swallow). **Nuevo (camino b):** `updateDoc` rechaza `{code:'permission-denied'}` (u otro code) → SI re-lanza (para que el caller revierta) + `logger.warn` NO llamado. | Service |
| `tests/rules/users.rules.test.ts` (existe, 16 casos) | **S2 (solo camino a).** ALLOW: owner crea user doc solo con `avatarId` + `createdAt` (sin displayName). DENY: create con `displayNameLower` sin `displayName` (hueco de desincronizacion). DENY: create con `avatarId` > 50 chars. ALLOW/DENY: update avatarId <= 50 / > 50. Marcar checkbox `users` en inventario de tests.md (ya esta `[x] [x]`; agregar nota del nuevo invariante). | Rules |

### Mock strategy

- Firestore: mock SDK (`getDoc`, `setDoc`, `updateDoc`, `serverTimestamp`) —
  patron existente en ambos tests (ver `userProfile.test.ts:35-46` y
  `AuthContext.test.tsx:37-45`).
- `logger`: mock `{ error: vi.fn(), warn: vi.fn() }` — verificar invocacion para
  Success Criteria #2. Ya mockeado en `userProfile.test.ts:53`.
- `measuredGetDoc`/`measuredGetDocs`: mock que delega a `getDoc`/`getDocs` (ya
  existe en `userProfile.test.ts:30-33`).
- Rules: harness `@firebase/rules-unit-testing` (`tests/rules/setup.ts`),
  `authedContext` + `expectAllow`/`expectDeny`.

### Criterio de aceptacion

- Cobertura >= 80% del codigo modificado.
- Paths condicionales cubiertos: profile null, profile rechaza, doc existe/no
  existe, rama anonima, `logger.error`/`logger.warn` invocados.
- Side effects verificados: `setIsLoading(false)` siempre corre (incluso en
  error), optimistic revert de avatar solo en error real (camino b).

## Analytics

Sin `trackEvent` nuevos. El fix es de correctness. La unica senal observable es
`logger.error` → Sentry (Success Criteria #2), que da visibilidad de cuantas
veces falla la lectura de perfil en el camino critico — dato que hoy se pierde
con la app colgada.

---

## Offline

### Cache strategy

| Dato | Estrategia | TTL | Storage |
|------|-----------|-----|---------|
| `fetchUserProfileDoc` en arranque | Firestore persistent cache (prod, ya configurada). Si falla igual → `.catch` devuelve `null`, app entra sin perfil | n/a | IndexedDB (Firestore SDK) |

### Writes offline

| Operacion | Mecanismo | Conflict resolution |
|-----------|-----------|---------------------|
| `updateUserAvatar` | Optimistic update local + revert si falla (actual, mantenido). Offline queue queda para #344 — este PRD no agrega el guard pero no lo bloquea | last-write-wins (1 campo idempotente) |

### Fallback UI

Ninguna. El arranque offline (uno de los disparadores del bug) ahora funciona
en vez de colgarse: la app entra sin perfil, degrada con gracia, sin toast
(la falla de lectura en arranque no debe interrumpir al usuario).

---

## Accesibilidad y UI mobile

No aplica — sin elementos interactivos ni componentes nuevos. El splash de
loading existente sigue igual; el unico cambio observable es que ahora siempre
termina (deja de mostrarse) en vez de colgarse.

## Textos y copy

No hay copy user-facing nuevo. Mensajes de `logger.error`/`logger.warn` son
internos (no se aplican reglas de voseo/tildes user-facing, pero deben ser
claros para debugging).

---

## Decisiones tecnicas

| Decision | Rationale | Alternativa rechazada |
|----------|-----------|-----------------------|
| Doble defensa S1 (`.catch` en service + try/finally en callback) | El `.catch` alinea el contrato del service; el try/finally protege contra cualquier otro throw del callback (no solo el fetch). Defense-in-depth en el camino mas critico de la app | Solo try/finally en el callback: dejaria `fetchUserProfileDoc` con contrato inconsistente respecto a `fetchUserProfile`. Solo `.catch` en service: no protegeria si otra linea del callback tira |
| S1 independiente de S2 (fases separadas) | S1 es el core del issue (bloqueo total). No depende de D1. Separar permite mergear el fix critico sin esperar la decision de producto | Bundle S1+S2 en un solo merge: ataria el fix critico a una decision abierta |
| `avatarId .size() <= 50` en create **Y** update | Sofia: el limite no debe quedar solo en el create nuevo. El update existente tambien acepta avatarId arbitrario hoy | Solo en create: dejaria el update sin validacion de tamaño |
| Camino (a) vs (b) diferido a D1 | Es decision de producto (¿doc avatar-sin-nombre es valido?). El implementador no la decide | Asumir (a): el PRD lo recomienda pero requiere confirmacion explicita |

---

## Hardening de seguridad

### Firestore rules requeridas

Ver seccion "Firestore Rules". Resumen:

1. **Independiente de D1:** `avatarId .size() <= 50` en create (L44) y update
   (L61).
2. **Solo camino (a):** create solo-avatar con `displayName`/`displayNameLower`
   opcionales (ambos ausentes XOR ambos sincronizados), manteniendo `hasOnly`,
   ownership, `createdAt` server-side, e invariante #322 R12.

### Rate limiting

| Coleccion | Limite | Implementacion |
|-----------|--------|----------------|
| users | n/a | No requiere rate limit nuevo (1 doc por usuario, campos idempotentes — PRD L120/L127). El create solo-avatar no introduce coleccion de items |

### Vectores de ataque mitigados

| Ataque | Mitigacion | Archivo |
|--------|-----------|---------|
| Crear `users/{otroUid}` con avatarId arbitrario | `request.auth.uid == userId` (doc ID) se mantiene en el create solo-avatar — no se relaja | firestore.rules |
| Field injection en create solo-avatar | `hasOnly(['displayName','displayNameLower','avatarId','createdAt'])` intacto | firestore.rules |
| `displayNameLower` desincronizado (hijack B5 #322) | create solo-avatar exige ambos ausentes XOR ambos sincronizados; nunca lower sin name | firestore.rules |
| `avatarId` gigante (storage/cost abuse) | `.size() <= 50` en create + update | firestore.rules |
| Lectura de perfil de otros via el fix | El fix solo cambia el manejo del fallo del read; el read sigue restringido a owner/admin/public | firestore.rules |

---

## Deuda tecnica: mitigacion incorporada

Issues consultados (PRD L135): no hay labels `security`/`tech debt` poblados;
deuda usa `enhancement` con prefijo "Tech debt:". Relevantes: #342, #343-#349,
#168.

| Issue | Que se resuelve | Paso del plan |
|-------|-----------------|---------------|
| #344 (profile mutations sin offline guard) | NO se resuelve aca; se coordina el callsite para no pisar el fallback setDoc/catch | Fase 2, nota de coordinacion |
| #322 R12 (displayNameLower sync) | El create solo-avatar (camino a) preserva la invariante sin abrir hueco | Fase 2 (camino a) |
| #332 (rules tests harness) | Se aprovecha `users.rules.test.ts` para agregar tests del create solo-avatar y limite avatarId | Fase 2 |

Mitigaciones de inconsistencia (no son issues, pero se cierran):

- `fetchUserProfileDoc` alcanza el mismo contrato best-effort que
  `fetchUserProfile` (ambas con `.catch`) — elimina la divergencia que origino
  el bug.
- `updateUserAvatar` (camino a) alcanza paridad con `updateUserDisplayName` —
  elimina la divergencia entre dos mutadores del mismo doc.

---

## Estimacion de tamaño de archivos

| Archivo | Lineas actuales | Delta estimado | Resultante | Supera 400? |
|---------|-----------------|----------------|------------|-------------|
| `src/context/AuthContext.tsx` | 266 | +6 (try/finally + catch) | ~272 | No |
| `src/services/userProfile.ts` | 161 | +8 (catch en fetch + branch en avatar) | ~169 | No |
| `firestore.rules` | 778 | +12 (avatarId size + create solo-avatar) | ~790 | No (no es TS) |
| `src/context/AuthContext.test.tsx` | 684 | +40 (4 casos nuevos) | ~724 | Test file (sin limite) |
| `src/services/__tests__/userProfile.test.ts` | 279 | +30 (catch + avatar paths) | ~309 | No |
| `tests/rules/users.rules.test.ts` | 271 | +50 (camino a) | ~321 | No |

Ningun archivo de produccion supera 400 lineas. No requiere decomposicion.

---

## Validacion Tecnica

**Estado:** VALIDADO CON OBSERVACIONES
**Fecha:** 2026-06-12
**Revisor:** Diego (solution architect)

**Observaciones:** S1 (loading infinito: try/finally en el callback de onAuthStateChanged + `.catch` defensivo en `fetchUserProfileDoc`) queda **VALIDADO y es implementable YA** — NO depende de D1, no toca rules, mergea solo y primero. Cobertura técnica vs PRD completa, claims de código verificados (AuthContext.tsx:104/121, userProfile.ts:80-81/131-135, firestore.rules:28-45), contrato best-effort de `fetchUserProfileDoc` correcto y alineado con `fetchUserProfile`, edge cases cubiertos (estado null = anónimo nuevo, rehidratación en próximo onAuthStateChanged, doble defensa intencional).

El límite `avatarId .size() <= 50` (independiente de D1) queda validado en create y update; los avatarIds son slugs cortos predefinidos (`cat`, `dog`...) y el caller ya valida `getAvatarById` — el límite server-side es backstop correcto.

S2 (`updateUserAvatar` fallback + create solo-avatar) queda **GATEADO por D1** — NO implementable hasta que Gonzalo resuelva D1 (¿user doc con avatarId sin displayName válido?). El modelo de ambos caminos es técnicamente sólido: camino (a) relaja la obligatoriedad de displayName manteniendo hasOnly, ownership, createdAt server-side e invariante #322 R12 (ambos ausentes XOR ambos sincronizados — cierra el hueco B5); camino (b) deja el optimistic en memoria.

Cerrado en el ciclo con specs-plan-writer:
- IMPORTANTE (S2 camino b): el catch ahora discrimina — solo `not-found` se traga, el resto se re-lanza para preservar el revert legítimo de `setAvatarId`. Resuelto.
- OBSERVACION (S2 camino a): documentado en S4 que el read-back de un doc solo-avatar produce `displayName=null` (estado soportado, no tocar el converter). Resuelto.

Para Pablo (plan): S1 y S2 deben ir en fases separadas — S1 sin esperar a D1, S2 detrás del gate D1. La coordinación con #344 (mismo callsite `setAvatarId`) ya está notada en specs; el plan debe garantizar que quien mergee segundo no revierta el fallback de S2.
