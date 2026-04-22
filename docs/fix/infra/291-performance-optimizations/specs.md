# Specs: #291 Performance Optimizations

**Fecha:** 2026-04-01

---

## Modelo de datos

Sin cambios al modelo de datos ni a las colecciones de Firestore. Todas las modificaciones son
internas a los servicios y componentes; no se agregan ni modifican campos.

## Firestore Rules

Sin cambios. Las cinco correcciones no agregan ni modifican lecturas ni escrituras con
semántica diferente a las ya existentes.

### Rules impact analysis

| Query (service file) | Collection | Auth context | Rule que lo permite | Cambio necesario? |
|---------------------|------------|--------------|---------------------|------------------|
| `fetchRatingsByBusinessIds` — `getDocs` `where('businessId','in',batch)` | `ratings` | Cualquier usuario auth | `allow read: if request.auth != null` | No |
| `followUser` — `getCountOfflineSafe` `where('followerId','==',followerId)` | `follows` | Usuario auth propietario | `allow read: if request.auth.uid == resource.data.followerId` | No — count no retorna documentos |

### Field whitelist check

No se agregan ni modifican campos de documentos. No aplica.

---

## Cloud Functions

Sin cambios a Cloud Functions.

---

## Seed Data

Sin cambios a colecciones ni campos. No se requiere actualización de seeds.

---

## Componentes

### SearchListView (`src/components/search/SearchListView.tsx`)

**Problema:** `sorted` se recalcula en cada render porque el array `[...businesses].sort(...)` y los
cálculos de distancia se ejecutan inline. Con un catálogo de ~120 comercios, esto ocurre en cada
keystroke del buscador y en cada scroll del parent.

**Cambio:** envolver la expresión en `useMemo` con dependencias `[businesses, sortLocation]`.

```tsx
// ANTES (línea 53)
const sorted = [...businesses].sort((a, b) => {
  const dA = distanceKm(sortLocation.lat, sortLocation.lng, a.lat, a.lng);
  const dB = distanceKm(sortLocation.lat, sortLocation.lng, b.lat, b.lng);
  return dA - dB;
});

// DESPUES
const sorted = useMemo(() => {
  return [...businesses].sort((a, b) => {
    const dA = distanceKm(sortLocation.lat, sortLocation.lng, a.lat, a.lng);
    const dB = distanceKm(sortLocation.lat, sortLocation.lng, b.lat, b.lng);
    return dA - dB;
  });
}, [businesses, sortLocation]);
```

Import a agregar: `useMemo` desde `'react'`.

### SocialScreen (`src/components/social/SocialScreen.tsx`)

**Problema:** `handleChipClick` y `handleSelectBusiness` se recrean en cada render. Aunque
`SocialScreen` no es un componente que re-renderice frecuentemente, los handlers se pasan como
props a sub-componentes lazy-loaded (`FollowedList`, `ReceivedRecommendations`,
`ActivityFeedView`). Sin `useCallback`, estos sub-componentes no pueden beneficiarse de
`React.memo` en el futuro.

**Cambio:** envolver ambas funciones en `useCallback`.

```tsx
// ANTES (líneas 33-38)
const handleChipClick = (tab: SocialSubTab) => {
  trackEvent(EVT_SUB_TAB_SWITCHED, { parent: 'social', sub_tab: tab });
  setSocialSubTab(tab);
};

const handleSelectBusiness = (biz: Business) => navigateToBusiness(biz);

// DESPUES
const handleChipClick = useCallback((tab: SocialSubTab) => {
  trackEvent(EVT_SUB_TAB_SWITCHED, { parent: 'social', sub_tab: tab });
  setSocialSubTab(tab);
}, [setSocialSubTab]);

const handleSelectBusiness = useCallback(
  (biz: Business) => navigateToBusiness(biz),
  [navigateToBusiness],
);
```

Import a agregar: `useCallback` desde `'react'`.

### Mutable prop audit

Ninguno de los componentes modificados recibe datos como props mutables. No aplica.

---

## Textos de usuario

Sin textos nuevos visibles al usuario.

---

## Hooks

### useProfileStats (`src/hooks/useProfileStats.ts`)

**Problema (línea 33):** `useEffect` declara `user` (objeto `FirebaseUser`) como dependencia.
Firebase puede emitir un nuevo objeto `user` idéntico en identidad referencial tras un refresh del
token de ID, lo que provoca que el efecto se re-ejecute y lance tres consultas Firestore
innecesarias. El único campo que se necesita del objeto `user` dentro del efecto es `uid`.

**Cambio:** reemplazar `[user]` por `[user?.uid]` en el array de dependencias.

```ts
// ANTES (línea 33)
  }, [user]);

// DESPUES
  }, [user?.uid]);
```

La variable `uid` ya se captura en el cuerpo del efecto (`const uid = user.uid`), por lo que no
se requiere ningún otro cambio.

---

## Servicios

### ratings.ts — `fetchRatingsByBusinessIds` (líneas 127-140)

**Problema:** cada batch de 10 IDs espera al anterior con `await getDocs(...)` dentro de un `for`
loop. Para un usuario con 30 comercios en favoritos, esto implica 3 round-trips secuenciales
(~300-450ms). El fix lanza todos los batches en paralelo con `Promise.all`.

```ts
// ANTES
export async function fetchRatingsByBusinessIds(businessIds: string[]): Promise<Rating[]> {
  const BATCH_SIZE = 10;
  const results: Rating[] = [];
  for (let i = 0; i < businessIds.length; i += BATCH_SIZE) {
    const batch = businessIds.slice(i, i + BATCH_SIZE);
    const snap = await getDocs(
      query(getRatingsCollection(), where('businessId', 'in', batch)),
    );
    for (const d of snap.docs) {
      results.push(d.data());
    }
  }
  return results;
}

// DESPUES
export async function fetchRatingsByBusinessIds(businessIds: string[]): Promise<Rating[]> {
  if (businessIds.length === 0) return [];
  const BATCH_SIZE = 10;
  const batches: string[][] = [];
  for (let i = 0; i < businessIds.length; i += BATCH_SIZE) {
    batches.push(businessIds.slice(i, i + BATCH_SIZE));
  }
  const snaps = await Promise.all(
    batches.map((batch) =>
      getDocs(query(getRatingsCollection(), where('businessId', 'in', batch))),
    ),
  );
  return snaps.flatMap((snap) => snap.docs.map((d) => d.data()));
}
```

Nota: el early-return para `businessIds.length === 0` ya existía implícitamente (el loop no
iteraba), pero se hace explícito para mayor claridad.

### follows.ts — `followUser` (líneas 40-43)

**Problema:** `getDocs(query(...where('followerId','==',followerId)))` descarga todos los
documentos de follows del usuario solo para leer `followingSnap.size`. Con 200 follows (el
máximo), esto transfiere 200 documentos y sus campos innecesariamente.

**Cambio:** reemplazar `getDocs` por `getCountOfflineSafe`.

```ts
// ANTES (líneas 40-44)
  const followingSnap = await getDocs(
    query(collection(db, COLLECTIONS.FOLLOWS), where('followerId', '==', followerId)),
  );
  if (followingSnap.size >= MAX_FOLLOWS) {
    throw new Error('Has alcanzado el limite de 200 usuarios seguidos');
  }

// DESPUES
  const followingCount = await getCountOfflineSafe(
    query(collection(db, COLLECTIONS.FOLLOWS), where('followerId', '==', followerId)),
  );
  if (followingCount >= MAX_FOLLOWS) {
    throw new Error('Has alcanzado el limite de 200 usuarios seguidos');
  }
```

El import de `getDocs` puede ser removido del archivo si ya no se usa en ningún otro lugar del
módulo (verificar antes de commit). El import de `getCountOfflineSafe` ya existe en la línea 19.

---

## Integración

Ninguna integración externa necesita modificarse: los cambios son internos a los módulos
individuales y mantienen las firmas públicas existentes.

### Preventive checklist

- [x] **Service layer**: Ningún componente importa `firebase/firestore` directamente en estas modificaciones.
- [x] **Duplicated constants**: No se crean arrays u objetos nuevos.
- [x] **Context-first data**: No se agrega ningún `getDoc` para datos disponibles en contexto.
- [x] **Silent .catch**: No se agregan bloques `.catch`.
- [x] **Stale props**: Ningún componente modificado recibe props mutables.

---

## Tests

Los tests existentes cubren los casos actuales. Se deben actualizar/agregar casos para reflejar
el comportamiento paralelo y el uso de `getCountOfflineSafe`.

| Archivo test | Que testear | Tipo |
|-------------|-------------|------|
| `src/services/ratings.test.ts` | Parallelism: verificar que `getDocs` se llama en paralelo (todas las calls antes de que alguna resuelva) para 15+ IDs; caso 0 IDs retorna `[]` sin llamar `getDocs` | Service unit |
| `src/services/follows.test.ts` | `followUser` usa `getCountOfflineSafe` (no `getDocs`) para el check de límite; mock de `getCountOfflineSafe` retorna número en vez de objeto con `.size` | Service unit |

### Casos a cubrir en `ratings.test.ts`

- `fetchRatingsByBusinessIds` con 11 IDs llama `getDocs` 2 veces — ambas invocaciones deben
  resolverse (comportamiento actual ya cubierto por el test "batches queries for >10 IDs")
- Agregar: verificar que las dos llamadas ocurren en paralelo (ambas `getDocs` son invocadas
  antes de que resuelva la primera) — se puede testear con `mockGetDocs` que trackea el momento
  de invocación.
- El test "returns empty for empty input" ya cubre el early-return.

### Casos a cubrir en `follows.test.ts`

- Remover dependencia del mock `getDocs` para el test "throws when max follows limit is reached" —
  reemplazar por mock de `getCountOfflineSafe` que retorna `200`.
- Agregar: "succeeds when count is below limit" — mock de `getCountOfflineSafe` retorna `5`.
- El mock de `getDocs` sigue siendo necesario para `fetchFollowing`.

### Mock strategy

```ts
// Para follows.test.ts — agregar mock de getCountOfflineSafe
vi.mock('./getCountOfflineSafe', () => ({
  getCountOfflineSafe: vi.fn(),
}));
import { getCountOfflineSafe } from './getCountOfflineSafe';
// En tests: vi.mocked(getCountOfflineSafe).mockResolvedValue(5);
```

---

## Analytics

Sin eventos nuevos.

---

## Offline

Los cambios son compatibles con el comportamiento offline existente:

- `fetchRatingsByBusinessIds` con `Promise.all` falla en bloque si la red no está disponible, igual que antes.
- `followUser` ya usa `getCountOfflineSafe` en otras funciones del módulo; si está offline, retorna `0` y el usuario puede seguir (el server-side limit aplica igualmente via Firestore rules).
- `useMemo` y `useCallback` no afectan el comportamiento offline.
- `user?.uid` en el efecto no afecta el comportamiento offline.

### Cache strategy

| Dato | Estrategia | TTL | Storage |
|------|-----------|-----|---------|
| Sin cambios — se mantiene la cache existente de `queryCache` | — | — | — |

---

## Accesibilidad y UI mobile

Sin elementos interactivos nuevos. No aplica.

---

## Decisiones técnicas

**Promise.all vs. loop secuencial en ratings.ts:** `Promise.all` puede lanzar más lecturas
simultáneas a Firestore. Para los tamaños de datos actuales (~3 batches máximos con el catálogo
existente), el riesgo de throttling es negligible. El patrón ya existe en `useBusinessData` para
sus 7 queries paralelas.

**getCountOfflineSafe en followUser:** la función ya existe en el módulo (`import` en línea 19) y
se usa en `fetchFollowersCount`. El cambio es de consistencia además de performance.

**user?.uid en useProfileStats:** la alternativa `useRef` + comparación manual sería más robusta
pero sobredimensionada para este caso. La dependencia correcta es el `uid` (que no cambia en
token refresh), no el objeto `user` completo.

**useCallback en SocialScreen:** los handlers ya eran funciones de un solo nivel sin closures
complejos. El cambio es preventivo para habilitar `React.memo` en subcomponentes en el futuro.

---

## Hardening de seguridad

Sin superficies nuevas. No aplica.

---

## Deuda técnica: mitigación incorporada

El issue #291 fue generado por el health-check audit v2.35.5. No hay issues de tech debt o
seguridad abiertos que se resuelvan directamente con estas correcciones más allá de los ya
listados en el propio issue.

| Issue | Que se resuelve | Paso del plan |
|-------|----------------|---------------|
| #291 (HIGH) `fetchRatingsByBusinessIds` sequential batches | Promise.all en lugar de await en loop | Fase 1, paso 1 |
| #291 (HIGH) `followUser` full-collection fetch | getCountOfflineSafe para count | Fase 1, paso 2 |
| #291 (MEDIUM) `SearchListView` inline sort | useMemo con deps correctas | Fase 1, paso 3 |
| #291 (MEDIUM) `useProfileStats` user object dep | user?.uid en array de deps | Fase 1, paso 4 |
| #291 (MEDIUM) `SocialScreen` handlers sin useCallback | useCallback con deps correctas | Fase 1, paso 5 |
