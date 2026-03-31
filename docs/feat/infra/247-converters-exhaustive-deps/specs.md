# Specs: exhaustive-deps fix + useVerificationBadges split

**PRD:** [prd.md](prd.md)
**Fecha:** 2026-03-30

---

## Modelo de datos

No se agregan ni modifican colecciones ni campos en Firestore. Este feature es un refactor interno de hooks existentes.

### Tipos existentes utilizados

```typescript
// src/types/index.ts (sin cambios)
export type VerificationBadgeId = 'local_guide' | 'verified_visitor' | 'trusted_reviewer';

export interface VerificationBadge {
  id: VerificationBadgeId;
  name: string;
  description: string;
  icon: string;
  earned: boolean;
  progress: number;     // 0-100
  current: number;
  target: number;
}

// UserSettings ya tiene followedTags?: string[]
```

No se crean tipos nuevos. Los 3 sub-hooks de badges reutilizan `VerificationBadge`, `Rating` y `CheckIn` de `src/types/`.

---

## Firestore Rules

No se modifican. No hay queries nuevas ni campos nuevos.

### Rules impact analysis

| Query (service file) | Collection | Auth context | Rule que lo permite | Cambio necesario? |
|---------------------|------------|-------------|-------------------|----------------|
| `fetchUserRatings(userId)` (nuevo en `services/ratings.ts`) | ratings | Autenticado | `allow read: if request.auth != null` | No |
| `fetchUserCheckIns(userId)` (nuevo en `services/checkins.ts`) | checkins | Owner | `allow read: if request.auth.uid == resource.data.userId` | No (el userId es el owner) |
| `fetchRatingsByBusinessIds(ids)` (nuevo en `services/ratings.ts`) | ratings | Autenticado | `allow read: if request.auth != null` | No |

### Field whitelist check

No aplica. No se agregan ni modifican campos en ninguna coleccion.

---

## Cloud Functions

No se requieren cambios en Cloud Functions.

---

## Componentes

No se crean ni modifican componentes. Los consumidores de `useVerificationBadges` (`AchievementsGrid`, `UserProfileModal`) no cambian porque la API publica del hook se mantiene identica.

### Mutable prop audit

No aplica. No hay componentes editables nuevos.

---

## Textos de usuario

No hay textos nuevos. Los textos existentes de badges no cambian.

---

## Hooks

### Hook 1: `useFollowedTags` (modificacion)

- **Archivo:** `src/hooks/useFollowedTags.ts`
- **Cambios:**
  1. Envolver `serverTags` en `useMemo` para estabilizar la referencia:

     ```typescript
     const serverTags = useMemo(
       () => settings?.followedTags ?? [],
       [settings?.followedTags],
     );
     ```

  2. Eliminar `eslint-disable-next-line react-hooks/exhaustive-deps` de linea 36.
  3. Agregar `optimisticTags` a las dependencias del `useEffect` de sincronizacion (linea 31-37), ya que el efecto lee `optimisticTags` dentro del cuerpo. Con `useMemo` en `serverTags`, el efecto se dispara solo cuando `settings` cambia de referencia, que es el comportamiento correcto.
- **Return type:** Sin cambios.
- **Lineas estimadas post-cambio:** ~96 (sin cambio significativo).

### Hook 2: `useLocalGuideBadge` (nuevo)

- **Archivo:** `src/hooks/useLocalGuideBadge.ts`
- **Params:** `(userRatings: Rating[], userLocality: string | undefined)`
- **Return:** `{ current: number; target: number }`
- **Logica:** Extrae `calcLocalGuide` y `buildBusinessLocalityMap` / `extractLocality` del hook actual. Funcion pura (no es un React hook, sino una funcion helper). Se exporta como funcion calculadora, no como hook con estado.
- **Lineas estimadas:** ~35

### Hook 3: `useVerifiedVisitorBadge` (nuevo)

- **Archivo:** `src/hooks/useVerifiedVisitorBadge.ts`
- **Params:** `(userCheckIns: CheckIn[])`
- **Return:** `{ current: number; target: number }`
- **Logica:** Extrae `calcVerifiedVisitor` y `buildBusinessCoordsMap`. Funcion pura.
- **Lineas estimadas:** ~30

### Hook 4: `useTrustedReviewerBadge` (nuevo)

- **Archivo:** `src/hooks/useTrustedReviewerBadge.ts`
- **Params:** `(userRatings: Rating[])`
- **Return:** `Promise<{ current: number; target: number }>`
- **Logica:** Extrae `calcTrustedReviewer`. Usa servicio `fetchRatingsByBusinessIds` en vez de importar `firebase/firestore` directamente.
- **Dependencias:** `src/services/ratings.ts` (nueva funcion `fetchRatingsByBusinessIds`).
- **Lineas estimadas:** ~45

### Hook 5: `useVerificationBadges` (refactor a orquestador)

- **Archivo:** `src/hooks/useVerificationBadges.ts`
- **Cambios:**
  1. Eliminar imports de `firebase/firestore` (violacion de service layer).
  2. Usar servicios `fetchUserRatings` y `fetchUserCheckIns` para obtener datos.
  3. Llamar a los 3 calculadores (`calcLocalGuide`, `calcVerifiedVisitor`, `calcTrustedReviewer`) importados de los nuevos archivos.
  4. Mantener cache (getCached/setCache), `buildBadge`, analytics tracking, y la API publica `UseVerificationBadgesReturn`.
- **Return type:** Sin cambios (`{ badges: VerificationBadge[]; loading: boolean }`).
- **Lineas estimadas post-refactor:** ~80

---

## Servicios

### Servicio 1: `fetchUserRatings` (nuevo en `src/services/ratings.ts`)

```typescript
export async function fetchUserRatings(userId: string): Promise<Rating[]>
```

- **Operacion:** `getDocs(query(collection(db, COLLECTIONS.RATINGS).withConverter(ratingConverter), where('userId', '==', userId)))`
- **Return:** Array de `Rating`.

### Servicio 2: `fetchRatingsByBusinessIds` (nuevo en `src/services/ratings.ts`)

```typescript
export async function fetchRatingsByBusinessIds(businessIds: string[]): Promise<Rating[]>
```

- **Operacion:** Queries en batches de 10 (limite de `in` de Firestore). Para cada batch: `getDocs(query(collection(db, COLLECTIONS.RATINGS).withConverter(ratingConverter), where('businessId', 'in', batch)))`.
- **Return:** Array consolidado de `Rating`.

### Servicio 3: `fetchUserCheckIns` (nuevo en `src/services/checkins.ts` - NUEVO ARCHIVO)

```typescript
export async function fetchUserCheckIns(userId: string): Promise<CheckIn[]>
```

- **Operacion:** `getDocs(query(collection(db, COLLECTIONS.CHECKINS).withConverter(checkinConverter), where('userId', '==', userId)))`
- **Return:** Array de `CheckIn`.

Nota: `src/services/checkins.ts` no existe actualmente. Se crea como nuevo archivo de servicio para check-ins.

---

## Integracion

### Consumidores de `useVerificationBadges` (sin cambios necesarios)

| Archivo | Uso | Cambio |
|---------|-----|--------|
| `src/components/profile/AchievementsGrid.tsx` | Llama `useVerificationBadges(userId, locality)` | Ninguno (API identica) |
| `src/components/social/UserProfileModal.tsx` | Llama `useVerificationBadges(userId)` | Ninguno (API identica) |

### Consumidores de `useFollowedTags` (sin cambios necesarios)

| Archivo | Uso | Cambio |
|---------|-----|--------|
| `src/hooks/useInterestsFeed.ts` | Usa `tags` del hook | Ninguno |
| `src/components/business/BusinessTags.tsx` | Usa `followTag`, `unfollowTag`, `isFollowed` | Ninguno |
| `src/components/home/YourInterestsSection.tsx` | Usa `tags`, `followTag`, `unfollowTag` | Ninguno |
| `src/components/profile/InterestsSection.tsx` | Usa `tags`, `followTag`, `unfollowTag` | Ninguno |

### Preventive checklist

- [x] **Service layer**: `useVerificationBadges.ts` importa `firebase/firestore` directamente para writes/reads -> Se corrige migrando a `src/services/ratings.ts` y nuevo `src/services/checkins.ts`.
- [x] **Duplicated constants**: No hay constantes duplicadas. `VERIFICATION_BADGES`, `VERIFICATION_CACHE_KEY`, `VERIFICATION_CACHE_TTL` siguen en `constants/verificationBadges.ts`.
- [x] **Context-first data**: No aplica. Ratings y check-ins no estan en ningun Context.
- [x] **Silent .catch**: El `.catch` de `useFollowedTags` ya usa `logger.error`. El `.catch` de `useVerificationBadges` tambien usa `logger.error`/`logger.warn`. OK.
- [x] **Stale props**: No aplica. Estos hooks no reciben props mutables.

---

## Tests

### Archivos existentes a actualizar

| Archivo test | Que testear | Tipo |
|-------------|-------------|------|
| `src/hooks/useFollowedTags.test.ts` | Agregar test que verifica ausencia de `eslint-disable` en fuente. Agregar test de sincronizacion con serverTags via useMemo. | Hook |
| `src/hooks/useVerificationBadges.test.ts` | Actualizar mocks para usar servicios en vez de `firebase/firestore` directo. Verificar que el orquestador delega a los calculadores. | Hook |

### Archivos nuevos

| Archivo test | Que testear | Tipo |
|-------------|-------------|------|
| `src/hooks/useLocalGuideBadge.test.ts` | calcLocalGuide: 0 ratings, ratings en otra localidad, ratings en localidad correcta, sin localidad, threshold exacto (50). | Funcion pura |
| `src/hooks/useVerifiedVisitorBadge.test.ts` | calcVerifiedVisitor: 0 check-ins, check-in lejano (>100m), check-in cercano (<100m), sin location, threshold exacto (5). | Funcion pura |
| `src/hooks/useTrustedReviewerBadge.test.ts` | calcTrustedReviewer: 0 ratings, ratings consistentes (100%), ratings inconsistentes, mix, threshold (80%), batching >10 businesses. | Funcion async |
| `src/services/checkins.test.ts` | fetchUserCheckIns: retorna check-ins del usuario, retorna vacio si no hay. | Service |

### Mock strategy

- **Nuevos sub-hooks (calc functions):** Son funciones puras. No necesitan mocks de Firebase. Solo mockear `allBusinesses` para `buildBusinessLocalityMap`/`buildBusinessCoordsMap`.
- **`useTrustedReviewerBadge`:** Mockear `services/ratings.ts` (`fetchRatingsByBusinessIds`).
- **`useVerificationBadges` (orquestador):** Mockear los 3 calculadores + `services/ratings.ts` + `services/checkins.ts`. Ya no mockea `firebase/firestore` directamente.
- **`services/checkins.ts`:** Mock de `firebase/firestore` (patron estandar).

### Criterio de aceptacion

- Cobertura >= 80% del codigo nuevo
- Todos los paths condicionales cubiertos
- Tests de edge cases para thresholds de cada badge

---

## Analytics

No hay eventos nuevos. El tracking existente (`verification_badge_earned`) se mantiene en el orquestador.

---

## Offline

### Cache strategy

| Dato | Estrategia | TTL | Storage |
|------|-----------|-----|---------|
| Verification badges | localStorage cache (existente, sin cambios) | 24h | `mm_verification_badges_{userId}` |
| User ratings | Firestore persistent cache (existente) | N/A | IndexedDB (Firestore SDK) |
| User check-ins | Firestore persistent cache (existente) | N/A | IndexedDB (Firestore SDK) |
| Followed tags | Firestore persistent cache via userSettings (existente) | N/A | IndexedDB (Firestore SDK) |

### Writes offline

| Operacion | Mecanismo | Conflict resolution |
|-----------|-----------|-------------------|
| followTag/unfollowTag | Optimistic UI + rollback on error (existente, sin cambios) | Rollback a `null` (re-sync con server) |

### Fallback UI

Sin cambios. Los estados de loading y empty ya existen.

---

## Decisiones tecnicas

### D1: Calculadores como funciones puras, no como React hooks

Las 3 funciones de calculo de badges (`calcLocalGuide`, `calcVerifiedVisitor`, `calcTrustedReviewer`) se exportan como funciones puras en archivos separados, no como hooks con `useState`/`useEffect`. Esto facilita el testing (no requieren `renderHook`) y permite que el orquestador controle cuando se ejecutan. La alternativa (hooks con estado propio) agregaria complejidad de sincronizacion sin beneficio.

### D2: Migrar Firestore queries a service layer

`useVerificationBadges.ts` actualmente importa `firebase/firestore` directamente (lineas 2-3), violando el patron de service layer documentado en `patterns.md`. El refactor aprovecha para crear `fetchUserRatings` y `fetchRatingsByBusinessIds` en `services/ratings.ts` y `fetchUserCheckIns` en un nuevo `services/checkins.ts`. Esto alinea el hook con las convenciones del proyecto.

### D3: useMemo para serverTags en useFollowedTags

El `eslint-disable` actual suprime un warning valido: el `useEffect` lee `optimisticTags` pero no lo declara como dependencia. Envolver `serverTags` en `useMemo` estabiliza la referencia y permite que `followTag`/`unfollowTag` tengan dependencias correctas sin re-renders innecesarios. Alternativa rechazada: `useRef` para serverTags (pierde reactividad).

---

## Hardening de seguridad

### Firestore rules requeridas

No se requieren cambios. Las queries nuevas (`fetchUserRatings`, `fetchUserCheckIns`, `fetchRatingsByBusinessIds`) usan las mismas colecciones con las mismas condiciones de lectura ya autorizadas.

### Rate limiting

No aplica. No hay escrituras nuevas.

### Vectores de ataque mitigados

No hay superficies nuevas. El refactor reduce la superficie de service layer violations al eliminar imports directos de `firebase/firestore` en `useVerificationBadges.ts`.

---

## Deuda tecnica: mitigacion incorporada

| Issue | Que se resuelve | Paso del plan |
|-------|----------------|---------------|
| #247 (este issue) | eslint-disable en useFollowedTags | Fase 1, paso 1-2 |
| #247 (este issue) | useVerificationBadges >250 lineas con 3 logicas acopladas | Fase 2, pasos 1-6 |
| (no registrado) | Service layer violation en useVerificationBadges (import firebase/firestore) | Fase 2, paso 4 |
