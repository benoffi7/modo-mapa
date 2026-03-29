# Specs: Anti-scraping — Restringir lectura masiva via anonymous auth

**PRD:** [prd.md](prd.md)
**Fecha:** 2026-03-28

---

## Modelo de datos

No se crean colecciones ni tipos nuevos. Los cambios son exclusivamente en Firestore rules y configuracion de Firebase.

La unica adicion potencial es un nuevo tipo de abuse log:

```typescript
// Extension del tipo existente en functions/src/utils/abuseLogger.ts
export interface AbuseLogEntry {
  userId: string;
  type: 'rate_limit' | 'flagged' | 'top_writers' | 'scraping_suspect';
  collection: string;
  detail: string;
}
```

## Firestore Rules

### Cambio 1: `favorites` — restringir read a ownership

```rules
match /favorites/{docId} {
  allow read: if request.auth != null
    && resource.data.userId == request.auth.uid;
  // create y delete sin cambios
}
```

### Cambio 2: `commentLikes` — restringir read a ownership

```rules
match /commentLikes/{docId} {
  allow read: if request.auth != null
    && resource.data.userId == request.auth.uid;
  // create y delete sin cambios
}
```

### Rules impact analysis

| Query (service/hook file) | Collection | Auth context | Rule that allows it | Change needed? |
|--------------------------|------------|-------------|-------------------|----------------|
| `getDoc(favorites, uid__bizId)` en `useBusinessData.fetchBusinessData` | favorites | Owner reading own doc | `resource.data.userId == request.auth.uid` | NO — uid matches |
| `getDocs(favorites, where userId == uid)` en `favorites.addFavoritesBatch` | favorites | Owner querying own docs | `resource.data.userId == request.auth.uid` | NO — userId filter matches auth.uid |
| `getDocs(favorites, where userId == uid)` en `favorites.fetchUserFavoriteIds` | favorites | Owner querying own docs | `resource.data.userId == request.auth.uid` | NO — userId filter matches auth.uid |
| `usePaginatedQuery` en `FavoritesList` | favorites | Owner querying own docs | `resource.data.userId == request.auth.uid` | NO — always filters by userId |
| `getDocs(commentLikes, documentId in batch)` en `useBusinessData.fetchUserLikes` | commentLikes | Owner reading own likes (doc IDs are `{uid}__commentId`) | `resource.data.userId == request.auth.uid` | NO — docs have userId == caller uid |
| `likeComment/unlikeComment` en `comments.ts` | commentLikes | Owner writing own doc | create/delete rules unchanged | NO |
| `usePaginatedQuery` en `CommentsList` (if likes filtered) | commentLikes | Owner reading own likes | `resource.data.userId == request.auth.uid` | NO — already filters by userId |
| `fetchCommentLikeStats` en `admin.ts` | commentLikes | Admin reading all | `resource.data.userId == request.auth.uid` | YES — admin cannot read all. See note below |

**Admin query note:** `fetchCommentLikeStats` in `src/services/admin.ts` reads all `commentLikes` docs (no userId filter) to compute stats. This will break with the ownership rule. Solution: add `|| isAdmin()` to the read rule for `commentLikes`.

**Updated `commentLikes` rule:**

```rules
match /commentLikes/{docId} {
  allow read: if request.auth != null
    && (resource.data.userId == request.auth.uid || isAdmin());
  // create y delete sin cambios
}
```

### Field whitelist check

No new fields are added to any collection. No changes needed to `hasOnly()` whitelists.

| Collection | New/modified field | In create `hasOnly()`? | In update `affectedKeys().hasOnly()`? | Rule change needed? |
|-----------|-------------------|----------------------|--------------------------------------|-------------------|
| N/A | N/A | N/A | N/A | NO |

## Cloud Functions

### Existing: `logAbuse` extension

Add `'scraping_suspect'` to the `AbuseLogEntry.type` union in `functions/src/utils/abuseLogger.ts`. Update the `SEVERITY_MAP` to assign it `'high'` severity.

### New: Scheduled function `detectScrapingPatterns` (Should priority)

A scheduled function that runs every hour, queries `config/counters` or Firestore usage metrics to detect anomalous read patterns per anonymous UID. This is a **Should** item from the PRD and can be deferred to a follow-up phase.

**Logic sketch:**

1. Query `dailyMetrics` for the current day
2. Check if anonymous users have unusually high read counts (heuristic TBD via Firebase monitoring)
3. If anomaly detected, call `logAbuse()` with type `'scraping_suspect'`

**Note:** Firestore does not expose per-UID read counts natively. The practical approach is to monitor via Firebase Console > Usage tab and set up Google Cloud Monitoring alerts manually. The Cloud Function approach would require client-side instrumentation (logging reads to a counter collection), which adds write overhead and is out of scope for v1.

**Recommended v1 approach:** Configure a Google Cloud Monitoring alert on `firestore.googleapis.com/document/read_count` with threshold-based alerting. No code needed.

## Componentes

No new components. No UI changes.

### Mutable prop audit

No editable components involved.

## Textos de usuario

No user-facing text changes. The feature is invisible to end users.

## Hooks

No new or modified hooks. Existing hooks already filter by `userId` or `businessId`.

**Audit of existing hooks confirming no breakage:**

| Hook | Collection | Query pattern | Compatible with new rules? |
|------|-----------|--------------|---------------------------|
| `useBusinessData` | favorites | `getDoc(uid__bizId)` — single doc, own userId | YES |
| `useBusinessData` | commentLikes | `documentId('in', [uid__cId, ...])` — own docs only | YES |
| `useBusinessData` | ratings, comments, userTags, customTags, priceLevels, menuPhotos | `where('businessId', '==', bId)` — unchanged read rules | YES |
| `useOptimisticLikes` | commentLikes | read/write own likes only | YES |
| `usePaginatedQuery` (FavoritesList) | favorites | `where('userId', '==', uid)` | YES |

## Servicios

No new services. Existing services already comply with ownership patterns.

**Audit of existing services confirming no breakage:**

| Service | Function | Collection | Query | Compatible? |
|---------|----------|-----------|-------|-------------|
| `favorites.ts` | `addFavorite` | favorites | write own doc | YES |
| `favorites.ts` | `removeFavorite` | favorites | delete own doc | YES |
| `favorites.ts` | `addFavoritesBatch` | favorites | `where('userId', '==', userId)` | YES |
| `favorites.ts` | `fetchUserFavoriteIds` | favorites | `where('userId', '==', userId)` | YES |
| `comments.ts` | `likeComment` | commentLikes | write own doc | YES |
| `comments.ts` | `unlikeComment` | commentLikes | delete own doc | YES |
| `admin.ts` | `fetchCommentLikeStats` | commentLikes | reads all docs (no filter) | NO — needs `isAdmin()` in rule |

## Integracion

### App Check enforcement en Firestore (produccion)

**Estado actual:**

- Frontend: App Check inicializado con `ReCaptchaEnterpriseProvider` en produccion (linea 68 de `src/config/firebase.ts`)
- Cloud Functions: `ENFORCE_APP_CHECK = false` y `ENFORCE_APP_CHECK_ADMIN = false` (ambos deshabilitados porque staging comparte deployment)
- Firestore Console: App Check enforcement **no activado**

**Accion:**

1. Activar App Check enforcement en Firebase Console > Firestore > App Check > Enforce
2. Esto bloquea requests de Firestore que no pasen attestation (scripts sin reCAPTCHA)
3. El frontend en produccion ya pasa attestation (ya inicializa App Check)

**Impacto en staging:**

- Staging no tiene reCAPTCHA key y no inicializa App Check (lineas 65-67 de `firebase.ts`: `isStaging` check skips App Check)
- Con enforcement activo, staging queries a Firestore default database serian rechazadas
- Staging usa named database `'staging'` (linea 44 de `firebase.ts`), que es una DB separada
- **Solucion:** App Check enforcement es per-database en Firebase Console. Activar enforcement solo en la database default (produccion), no en la database `staging`

**Si la database staging comparte enforcement config:** Usar debug token en staging:

1. Generar debug token en Firebase Console > App Check > Debug tokens
2. Configurar `VITE_APPCHECK_DEBUG_TOKEN` en el deploy de staging
3. Actualizar `src/config/firebase.ts` para usar `DebugProvider` cuando `isStaging && debugToken`

### Cloud Functions App Check

El enforcement de App Check en Firestore no afecta a Cloud Functions que usan Admin SDK (el Admin SDK bypasea rules y App Check). Los callable functions seguiran funcionando porque usan Admin SDK para reads/writes.

### Preventive checklist

- [x] **Service layer**: No hay componentes que importen `firebase/firestore` para writes directamente. Todo va via `src/services/`.
- [x] **Duplicated constants**: No se agregan constantes nuevas.
- [x] **Context-first data**: No aplica (no hay nuevos datos).
- [x] **Silent .catch**: No se agrega codigo con `.catch`.
- [x] **Stale props**: No aplica (no hay componentes modificados).

## Tests

| Archivo test | Que testear | Tipo |
|-------------|-------------|------|
| `firestore.rules` test (emulator) | 1. User A no puede leer favoritos de User B. 2. User A puede leer sus propios favoritos. 3. User A no puede leer commentLikes de User B. 4. User A puede leer sus propios commentLikes. 5. Admin puede leer commentLikes de cualquier usuario. 6. Queries existentes con `where('userId', '==', uid)` siguen funcionando. | Firestore rules (emulator) |
| `src/services/__tests__/favorites.test.ts` | Confirmar que `fetchUserFavoriteIds` y `addFavoritesBatch` siempre incluyen `where('userId', '==', uid)` | Service unit (ya existente, verificar cobertura) |
| `src/services/__tests__/comments.test.ts` | Confirmar que `likeComment`/`unlikeComment` usan doc ID con el userId del caller | Service unit (ya existente, verificar cobertura) |

### Criterios de testing

- Cobertura >= 80% del codigo nuevo (reglas)
- Tests de rules criticos: verificar que un usuario anonimo B no pueda leer favoritos/likes del usuario A
- Tests de admin access: verificar que admin puede leer commentLikes de cualquier usuario
- Tests de regresion: queries existentes del cliente siguen funcionando

### Mock strategy

- Firestore rules tests: usar Firebase emulator con `@firebase/rules-unit-testing`
- Service tests: ya existen, solo verificar que queries incluyen userId filter

## Analytics

No new analytics events. El feature es transparente para el usuario.

---

## Offline

### Cache strategy

| Dato | Estrategia | TTL | Storage |
|------|-----------|-----|---------|
| Favoritos propios | Firestore persistent cache (ya habilitado) | Indefinido (hasta eviction) | IndexedDB (Firestore SDK) |
| CommentLikes propios | Firestore persistent cache (ya habilitado) | Indefinido (hasta eviction) | IndexedDB (Firestore SDK) |
| App Check token | Firebase SDK cache | ~1 hora | Memory |

### Writes offline

| Operacion | Mecanismo | Conflict resolution |
|-----------|-----------|-------------------|
| N/A | N/A — este feature solo cambia reglas de read | N/A |

### Fallback UI

No se necesitan cambios en fallback UI. Las mismas pantallas de error existentes capturan errores de permisos. Si un usuario legitimo con reCAPTCHA bloqueado intenta leer, el ErrorBoundary existente lo maneja.

---

## Decisiones tecnicas

### DT1: Ownership read en favorites y commentLikes en vez de Cloud Functions proxy

**Decision:** Restringir read a ownership via Firestore rules.

**Alternativa descartada:** Proxy de reads via Cloud Functions. Descartada por overhead (latencia adicional de ~200ms por request, costo de Cloud Functions, complejidad de mantener un layer de caching adicional).

**Rationale:** El frontend ya filtra por userId en todas las queries. El cambio de regla es retrocompatible y no agrega latencia.

### DT2: App Check enforcement per-database

**Decision:** Activar enforcement solo en la database default (produccion), no en staging.

**Alternativa considerada:** Debug token para staging. Viable pero agrega complejidad de configuracion y env vars. Si Firebase Console permite enforcement per-database, es la opcion mas simple.

**Fallback:** Si enforcement es global (ambas databases), implementar debug token en staging.

### DT3: Monitoreo de scraping via Google Cloud Monitoring en vez de Cloud Function

**Decision:** Usar alertas nativas de Google Cloud Monitoring en Firestore read counts.

**Alternativa descartada:** Cloud Function scheduled que monitorea counters. Requeriria instrumentar reads del cliente (agregar writes a un counter por cada read, lo cual duplica el costo de Firestore).

**Rationale:** Google Cloud Monitoring ya tiene acceso a metricas de Firestore sin codigo adicional.

### DT4: isAdmin() en commentLikes read rule

**Decision:** Agregar `|| isAdmin()` al read de commentLikes para que el admin dashboard pueda seguir leyendo stats.

**Rationale:** `fetchCommentLikeStats` en `src/services/admin.ts` necesita leer todos los commentLikes. Sin la excepcion de admin, el panel se romperia.

## Estimacion de archivos

| Archivo | Lineas estimadas | Accion |
|---------|-----------------|--------|
| `firestore.rules` | ~510 (actual 508 + 2 lineas cambiadas) | OK |
| `functions/src/utils/abuseLogger.ts` | ~30 (actual 26 + 4 lineas) | OK |
| `docs/reference/security.md` | ~310 (actual 284 + ~20 lineas) | OK |
