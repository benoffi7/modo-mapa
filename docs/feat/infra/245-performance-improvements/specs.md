# Specs: Performance Improvements

**PRD:** [prd.md](prd.md)
**Fecha:** 2026-03-29

---

## Modelo de datos

No se crean ni modifican colecciones de Firestore. Este feature es exclusivamente de optimizacion de frontend (bundle, runtime, contexto).

---

## Firestore Rules

Sin cambios en reglas de Firestore.

### Rules impact analysis

| Query (service file) | Collection | Auth context | Rule que permite | Cambio necesario? |
|---------------------|------------|-------------|-----------------|-------------------|
| `fetchUserLikes(uid, commentIds)` en `services/businessData.ts` | commentLikes | Authenticated user | `allow read: if request.auth != null` | No |

No se agregan nuevas queries. `fetchUserLikes` ya existe; solo cambia de batches secuenciales a paralelos.

### Field whitelist check

No se agregan ni modifican campos en ninguna coleccion. Sin impacto en `hasOnly()`.

---

## Cloud Functions

Sin cambios en Cloud Functions.

---

## Componentes

### MenuPhotoUpload (modificacion)

**Archivo:** `src/components/business/MenuPhotoUpload.tsx`
**Cambio:** Reemplazar import estatico de `browser-image-compression` por dynamic import dentro de `handleSubmit`.

```typescript
// Antes:
import imageCompression from 'browser-image-compression';

// Despues:
import type imageCompressionType from 'browser-image-compression';
// ... dentro de handleSubmit:
const { default: imageCompression } = await import('browser-image-compression');
```

**Manejo de error offline:** Si el chunk no esta cacheado y el usuario esta offline, el `catch` existente captura el error de import y muestra el mensaje de error en el Dialog. No se requiere UI adicional.

### StatsView — SIN CAMBIOS

**Hallazgo:** `StatsView` ya se carga via `React.lazy()` en `ProfileScreen.tsx` (linea 27). `PieChartCard` importa `recharts` estaticamente, pero como `StatsView` es lazy, `recharts` ya esta en un chunk separado. El admin panel tambien es lazy. **S5 del PRD ya esta implementado.** No se requiere trabajo adicional.

### Mutable prop audit

No aplica. No hay componentes nuevos que reciban datos editables como props.

---

## Textos de usuario

No se agregan textos nuevos visibles al usuario. Los mensajes de error existentes en `MenuPhotoUpload` se preservan sin cambios.

---

## Hooks

### useAuthState (nuevo)

**Archivo:** `src/context/AuthContext.tsx` (exportado desde el mismo archivo)
**Params:** ninguno
**Return:** `AuthStateContextType` (user, displayName, avatarId, isLoading, authError, authMethod, emailVerified)
**Dependencias:** `AuthStateContext`

```typescript
interface AuthStateContextType {
  user: User | null;
  displayName: string | null;
  avatarId: string | null;
  isLoading: boolean;
  authError: string | null;
  authMethod: AuthMethod;
  emailVerified: boolean;
}
```

### useAuthActions (nuevo)

**Archivo:** `src/context/AuthContext.tsx` (exportado desde el mismo archivo)
**Params:** ninguno
**Return:** `AuthActionsContextType` (todas las funciones mutadoras)

```typescript
interface AuthActionsContextType {
  setDisplayName: (name: string) => Promise<void>;
  setAvatarId: (id: string) => Promise<void>;
  clearAuthError: () => void;
  signInWithGoogle: () => Promise<User | null>;
  signOut: () => Promise<void>;
  linkEmailPassword: (email: string, password: string) => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  resendVerification: () => Promise<void>;
  refreshEmailVerified: () => Promise<boolean>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
}
```

### useAuth (wrapper backward compat)

**Archivo:** `src/context/AuthContext.tsx`
**Cambio:** Mantener `useAuth()` como wrapper que consume ambos contextos y retorna la union `AuthContextType` original. Todos los 52 consumidores existentes siguen funcionando sin cambios.

```typescript
export const useAuth = (): AuthContextType => {
  const state = useAuthState();
  const actions = useAuthActions();
  return { ...state, ...actions };
};
```

**Migracion gradual:** Los consumidores que solo leen `{ user }` pueden migrarse a `useAuthState()` en un PR separado para capturar el beneficio de re-renders reducidos. En este PR solo se hace el split interno; la migracion de consumidores es out of scope.

---

## Servicios

### businessData.ts — fetchUserLikes (modificacion)

**Archivo:** `src/services/businessData.ts`
**Cambio:** Reemplazar `for` loop secuencial por `Promise.all`.

```typescript
// Antes:
for (let i = 0; i < docIds.length; i += BATCH_SIZE) {
  const batch = docIds.slice(i, i + BATCH_SIZE);
  const snap = await getDocs(...);
  // ...
}

// Despues:
const batches: string[][] = [];
for (let i = 0; i < docIds.length; i += BATCH_SIZE) {
  batches.push(docIds.slice(i, i + BATCH_SIZE));
}
const snaps = await Promise.all(batches.map((batch) =>
  getDocs(query(
    collection(db, COLLECTIONS.COMMENT_LIKES),
    where(documentId(), 'in', batch),
  ))
));
for (const snap of snaps) {
  for (const d of snap.docs) {
    const commentId = d.id.split('__')[1];
    liked.add(commentId);
  }
}
```

**Semantica:** Identica. Mismos resultados, mismos IDs. Solo cambia latencia (paralelo vs secuencial).

---

## Dead code a eliminar

Verificacion con grep confirma que ninguna de estas funciones es importada en el codebase (excepto en sus propios tests):

| Funcion | Archivo | Linea | Notas |
|---------|---------|-------|-------|
| `deleteAchievement` | `src/services/achievements.ts` | 37 | Sin consumidores |
| `addFavoritesBatch` | `src/services/favorites.ts` | 44 | Solo importada en `favorites.test.ts` |
| `fetchUserFavoriteIds` | `src/services/favorites.ts` | 74 | Sin consumidores |
| `fetchFollowers` | `src/services/follows.ts` | 86 | Sin consumidores |
| `copyList` | `src/services/sharedLists.ts` | 125 | Sin consumidores |
| `deleteSpecial` | `src/services/specials.ts` | 45 | Sin consumidores |
| `invalidatePriceLevelCache` | `src/hooks/usePriceLevelFilter.ts` | 78 | Sin consumidores |
| `formatDateFull` | `src/utils/formatDate.ts` | 53 | Sin consumidores |

**Nota sobre tests:** `addFavoritesBatch` tiene tests en `favorites.test.ts`. Esos tests se eliminan junto con la funcion. `formatDateFull` tiene tests en `formatDate.test.ts` que tambien se eliminan.

---

## Integracion

### Archivos que se modifican

| Archivo | Tipo de cambio |
|---------|---------------|
| `src/components/business/MenuPhotoUpload.tsx` | Dynamic import |
| `src/services/businessData.ts` | Promise.all en fetchUserLikes |
| `src/context/AuthContext.tsx` | Split en 2 contextos + wrapper |
| `src/services/favorites.ts` | Eliminar `addFavoritesBatch`, `fetchUserFavoriteIds` |
| `src/services/follows.ts` | Eliminar `fetchFollowers` |
| `src/services/sharedLists.ts` | Eliminar `copyList` |
| `src/services/specials.ts` | Eliminar `deleteSpecial` |
| `src/services/achievements.ts` | Eliminar `deleteAchievement` |
| `src/hooks/usePriceLevelFilter.ts` | Eliminar `invalidatePriceLevelCache` |
| `src/utils/formatDate.ts` | Eliminar `formatDateFull` |

### Archivos de test afectados

| Archivo | Cambio |
|---------|--------|
| `src/context/AuthContext.test.tsx` | Actualizar 35 tests para nuevo split; agregar tests de `useAuthState`/`useAuthActions` |
| `src/services/favorites.test.ts` | Eliminar tests de `addFavoritesBatch` |
| `src/utils/formatDate.test.ts` | Eliminar tests de `formatDateFull` |
| `src/hooks/useBusinessData.test.ts` | Verificar que mock de `fetchUserLikes` sigue funcionando |

### Preventive checklist

- [x] **Service layer**: Ningun componente importa `firebase/firestore` para writes nuevos
- [x] **Duplicated constants**: No se definen nuevas constantes duplicadas
- [x] **Context-first data**: No se agregan getDoc innecesarios
- [x] **Silent .catch**: No se agregan `.catch(() => {})` nuevos
- [x] **Stale props**: No aplica (no hay componentes con props mutables nuevos)

---

## Tests

| Archivo test | Que testear | Tipo |
|-------------|-------------|------|
| `src/context/AuthContext.test.tsx` | `useAuthState` retorna solo datos de estado; `useAuthActions` retorna solo funciones; `useAuth` wrapper retorna ambos; re-renders: cambio de accion no re-renderiza consumidor de state | Unit |
| `src/services/businessData.test.ts` | `fetchUserLikes` con 0 IDs retorna Set vacio; con <30 IDs hace 1 query; con 90 IDs hace 3 queries en paralelo (verificar con Promise.all); resultados identicos al secuencial | Unit |

### Casos a cubrir

- `useAuthState` expone exactamente los 7 campos de estado
- `useAuthActions` expone exactamente las 10 funciones
- `useAuth` wrapper retorna los 17 campos combinados (backward compat)
- `fetchUserLikes` con batches paralelos: mismos resultados que antes
- `fetchUserLikes` con array vacio: retorna Set vacio

### Mock strategy

- Firestore: mock SDK functions existentes (sin cambios al patron actual)
- AuthContext: mock `onAuthStateChanged` existente
- `browser-image-compression`: no necesita test unitario del dynamic import (es un cambio de import, no de logica)

### Criterio de aceptacion

- Cobertura >= 80% del codigo nuevo/modificado
- Tests existentes de AuthContext (35 cases) siguen pasando con `useAuth` wrapper
- No hay regresiones en `fetchUserLikes` (mismos resultados)

---

## Analytics

Sin nuevos eventos de analytics. Los eventos existentes se preservan sin cambios.

---

## Offline

### Cache strategy

| Dato | Estrategia | TTL | Storage |
|------|-----------|-----|---------|
| `browser-image-compression` chunk | Service Worker cache | Indefinido (hash en nombre) | Cache API |
| `fetchUserLikes` resultados | Firestore persistent cache | Session | IndexedDB |

### Writes offline

No hay writes nuevos.

### Fallback UI

| Escenario | Comportamiento |
|-----------|---------------|
| `import('browser-image-compression')` falla offline | El catch existente en `handleSubmit` muestra "No se pudo subir la foto" en el Dialog |

---

## Decisiones tecnicas

### D1: Split AuthContext en mismo archivo vs archivos separados

**Decision:** Mantener todo en `AuthContext.tsx` con 2 contextos internos.
**Razon:** El archivo tiene 259 lineas. Con el split (agregar ~20 lineas de boilerplate para contextos extra), quedara en ~280 lineas, bien debajo del limite de 400. Separar en archivos introduce complejidad de imports circular (el Provider necesita ambos contextos, los hooks necesitan sus respectivos contextos).

### D2: Migrar consumidores de useAuth a useAuthState/useAuthActions

**Decision:** No migrar en este PR. Mantener `useAuth()` wrapper para backward compatibility.
**Razon:** La migracion de 52 consumidores es mecanica pero ruidosa. El beneficio de re-renders reducidos se captura gradualmente. Este PR establece la infraestructura; la migracion se puede hacer por dominio en PRs separados.

### D3: S5 (recharts lazy) descartado

**Decision:** No implementar S5.
**Razon:** `StatsView` ya se carga via `React.lazy()` en `ProfileScreen.tsx`. Esto significa que `recharts` (importado por `PieChartCard`) ya esta en un chunk separado del main bundle. El admin panel tambien es lazy. No hay trabajo pendiente.

### D4: type-only import para browser-image-compression

**Decision:** Usar `import type` para el tipo si se necesita para TypeScript, y dynamic `import()` para el valor.
**Razon:** `import type` se elimina en compilacion (no agrega bytes al bundle). El dynamic import carga el modulo solo cuando el usuario sube una foto.

---

## Hardening de seguridad

### Firestore rules requeridas

Sin cambios. Todas las queries existentes mantienen sus reglas actuales.

### Rate limiting

Sin nuevas colecciones escribibles.

### Vectores de ataque mitigados

| Ataque | Mitigacion | Archivo |
|--------|-----------|---------|
| N/A | Optimizaciones internas sin nuevas superficies de ataque | N/A |

El split de AuthContext no expone datos adicionales: ambos contextos estan dentro del mismo `AuthProvider` con el mismo scope. El dynamic import de `browser-image-compression` no introduce nuevos vectores (es un modulo npm existente cargado de forma diferente).

---

## Deuda tecnica: mitigacion incorporada

| Issue | Que se resuelve | Paso del plan |
|-------|----------------|---------------|
| #245 (self) | 8 funciones dead code eliminadas | Fase 1 |
| #245 (self) | AuthContext god-context de 17 campos spliteado | Fase 2 |
| #243 (parcial) | AuthContext tiene writes directos a Firestore (`setDisplayName`, `setAvatarId`); se documenta pero no se extrae en este PR (prerequisito #243) | Documentado en D2 |

Nota: El PRD menciona #243 como prerequisito parcial. Las escrituras directas de Firestore en AuthContext (`getDoc`, `setDoc`, `updateDoc` en lineas 98, 127-135, 145) son violaciones del service layer que se resuelven en #243, no en este PR.
