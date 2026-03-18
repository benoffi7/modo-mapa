# Testing — Modo Mapa

## Resumen

| Métrica | Valor |
|---------|-------|
| **Framework** | Vitest 4.x |
| **Testing Library** | @testing-library/react + jest-dom |
| **Total test files** | 36 (24 React + 12 Functions) |
| **Total test cases** | 338 (248 React + 90 Functions) |
| **Cobertura mínima requerida** | 80% por nueva función/feature |

---

## Configuración

### React App (`vitest.config.ts`)
- Environment: `jsdom`
- Globals: `enabled`
- Setup: `./src/test/setup.ts`
- Exclusiones: `functions/**`, `node_modules/**`
- Comando: `npm test` (watch) / `npm run test:run` (single run)

### Cloud Functions (`functions/vitest.config.ts`)
- Environment: `node`
- Root: `src`
- Comando: `cd functions && npx vitest run`

---

## Política de Testing

### Regla: toda nueva función/feature debe tener tests con ≥80% de cobertura

1. **PRDs y Specs** deben incluir una sección `## Tests` que defina:
   - Qué archivos necesitan tests
   - Qué lógica cubrir (validación, edge cases, integración)
   - Mock strategy (qué se mockea, qué no)
   - Criterio de aceptación de cobertura

2. **No se mergea código sin tests** para:
   - Funciones con lógica condicional
   - Validaciones de input
   - Servicios con side effects (cache, analytics, Firestore)
   - Cloud Functions (triggers, scheduled, callable)
   - Hooks con state management complejo

3. **Excepciones** (no requieren tests unitarios):
   - Componentes puramente visuales sin lógica (skeletons, layouts estáticos)
   - Re-exports simples
   - Constantes sin lógica

---

## Inventario de Tests

### React App — Utilidades (`src/utils/`)

| Archivo | Test | Cases | Estado |
|---------|------|-------|--------|
| `distance.ts` | `distance.test.ts` | 9 | ✅ |
| `formatDate.ts` | `formatDate.test.ts` | 10 | ✅ |
| `text.ts` | `text.test.ts` | 6 | ✅ |
| `businessHelpers.ts` | `businessHelpers.test.ts` | 5 | ✅ |
| `perfMetrics.ts` | `perfMetrics.test.ts` | 10 | ✅ |
| `analytics.ts` | — | — | ⏳ Requiere mock complejo de Firebase dynamic import |

### React App — Servicios (`src/services/`)

| Archivo | Test | Cases | Estado |
|---------|------|-------|--------|
| `ratings.ts` | `ratings.test.ts` | 13 | ✅ |
| `emailAuth.ts` | `emailAuth.test.ts` | 14 | ✅ |
| `comments.ts` | `comments.test.ts` | 11 | ✅ |
| `favorites.ts` | `favorites.test.ts` | 7 | ✅ |
| `tags.ts` | `tags.test.ts` | 8 | ✅ |
| `priceLevels.ts` | `priceLevels.test.ts` | 9 | ✅ |
| `rankings.ts` | `rankings.test.ts` | 11 | ✅ |
| `queryCache.ts` | `queryCache.test.ts` | 7 | ✅ |
| `sharedLists.ts` | — | — | ⏳ Cascade deletes, counter atomics |
| `userProfile.ts` | — | — | ⏳ Complex aggregation, 7 parallel queries |
| `userSettings.ts` | — | — | ⏳ Optimistic update rollback |
| `suggestions.ts` | — | — | 🔻 Baja prioridad (simple aggregation) |
| `feedback.ts` | — | — | ⏳ |
| `notifications.ts` | — | — | ⏳ |
| `admin.ts` | — | — | ⏳ |
| `adminFeedback.ts` | — | — | ⏳ |
| `menuPhotos.ts` | — | — | ⏳ |

### React App — Hooks (`src/hooks/`)

| Archivo | Test | Cases | Estado |
|---------|------|-------|--------|
| `useBusinesses.ts` | `useBusinesses.test.ts` | 4 | ✅ |
| `useBusinessDataCache.ts` | `useBusinessDataCache.test.ts` | 9 | ✅ |
| `useListFilters.ts` | `useListFilters.test.ts` | 12 | ✅ |
| `usePaginatedQuery.ts` | `usePaginatedQuery.test.ts` | 11 | ✅ |
| `useSuggestions.ts` | `useSuggestions.test.ts` | 10 | ✅ |
| `useUndoDelete.ts` | — | — | ⏳ Timer management, ref sync |
| `useAsyncData.ts` | — | — | ⏳ Race conditions, cleanup |
| `useUnsavedChanges.ts` | — | — | ⏳ Dialog state machine |
| `useRankings.ts` | — | — | ⏳ Position delta calc |
| `useUserSettings.ts` | — | — | ⏳ Optimistic updates |
| `useColorMode.ts` | — | — | 🔻 Simple wrapper |
| otros (13 hooks) | — | — | ⏳ |

### React App — Contexts (`src/context/`)

| Archivo | Test | Cases | Estado |
|---------|------|-------|--------|
| `AuthContext.tsx` | `AuthContext.test.tsx` | 9 | ✅ |
| `MapContext.tsx` | `MapContext.test.tsx` | 4 | ✅ |
| `ColorModeContext.tsx` | — | — | ⏳ |
| `NotificationsContext.tsx` | — | — | ⏳ |
| `ToastContext.tsx` | — | — | ⏳ |

### React App — Componentes (`src/components/`)

| Archivo | Test | Cases | Estado |
|---------|------|-------|--------|
| `ChangePasswordDialog.tsx` | `ChangePasswordDialog.test.tsx` | 11 | ✅ |
| `EmailPasswordDialog.tsx` | `EmailPasswordDialog.test.tsx` | 17 | ✅ |
| `ErrorBoundary.tsx` | `ErrorBoundary.test.tsx` | 3 | ✅ |
| `OfflineIndicator.tsx` | `OfflineIndicator.test.tsx` | 5 | ✅ |
| otros (87 componentes) | — | — | 🔻 Mayoría visual |

### Cloud Functions — Utils (`functions/src/utils/`)

| Archivo | Test | Cases | Estado |
|---------|------|-------|--------|
| `counters.ts` | `counters.test.ts` | 3 | ✅ |
| `moderator.ts` | `moderator.test.ts` | 6 | ✅ |
| `notifications.ts` | `notifications.test.ts` | 9 | ✅ |
| `rateLimiter.ts` | `rateLimiter.test.ts` | 4 | ✅ |
| `aggregates.ts` | `aggregates.test.ts` | 6 | ✅ |
| `abuseLogger.ts` | `abuseLogger.test.ts` | 5 | ✅ |
| `perfTracker.ts` | `perfTracker.test.ts` | 9 | ✅ |

### Cloud Functions — Helpers (`functions/src/helpers/`)

| Archivo | Test | Cases | Estado |
|---------|------|-------|--------|
| `assertAdmin.ts` | `assertAdmin.test.ts` | 6 | ✅ |
| `env.ts` | — | — | 🔻 Constante simple |

### Cloud Functions — Triggers (`functions/src/triggers/`)

| Archivo | Test | Cases | Estado |
|---------|------|-------|--------|
| `comments.ts` | `comments.test.ts` | 21 | ✅ |
| `commentLikes.ts` | `commentLikes.test.ts` | 10 | ✅ |
| `ratings.ts` | `ratings.test.ts` | 5 | ✅ |
| `favorites.ts` | — | — | ⏳ Dual counter ops |
| `customTags.ts` | — | — | ⏳ Rate limit + moderation |
| `feedback.ts` | — | — | ⏳ Complex branching |
| `menuPhotos.ts` | — | — | ⏳ Cloud Storage I/O |
| `users.ts` | — | — | 🔻 Simple counter |
| `priceLevels.ts` | — | — | 🔻 Simple counter |

### Cloud Functions — Admin (`functions/src/admin/`)

| Archivo | Test | Cases | Estado |
|---------|------|-------|--------|
| `authStats.ts` | `authStats.test.ts` | 6 | ✅ |
| `feedback.ts` | — | — | ⏳ GitHub API, notifications |
| `claims.ts` | — | — | ⏳ Auth claims, bootstrap |
| otros (5 admin) | — | — | ⏳ |

### Cloud Functions — Scheduled (`functions/src/scheduled/`)

| Archivo | Test | Cases | Estado |
|---------|------|-------|--------|
| `rankings.ts` | — | — | ⏳ Complex aggregation |
| `dailyMetrics.ts` | — | — | ⏳ Heavy aggregation |
| `cleanupNotifications.ts` | — | — | ⏳ Batch delete |
| `cleanupPhotos.ts` | — | — | ⏳ Storage cleanup |

---

## Patrones de Testing

### Mock de Firestore (React App)

```typescript
vi.mock('../config/firebase', () => ({ db: {} }));
vi.mock('../config/collections', () => ({ COLLECTIONS: { ... } }));
vi.mock('./queryCache', () => ({ invalidateQueryCache: vi.fn() }));
vi.mock('../utils/analytics', () => ({ trackEvent: vi.fn() }));

const mockGetDoc = vi.fn();
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  doc: vi.fn().mockReturnValue({}),
  getDoc: (...args) => mockGetDoc(...args),
  setDoc: vi.fn().mockResolvedValue(undefined),
  // ...
}));
```

### Mock de Firestore (Cloud Functions)

```typescript
const mockIncrement = vi.hoisted(() => vi.fn((n) => ({ __increment: n })));
vi.mock('firebase-admin/firestore', () => ({
  FieldValue: { increment: mockIncrement },
}));

function mockDb() {
  const set = vi.fn().mockResolvedValue(undefined);
  return { doc: vi.fn().mockReturnValue({ set }), _set: set };
}
```

### Mock de Cloud Function triggers

```typescript
vi.mock('firebase-functions/v2/firestore', () => ({
  onDocumentWritten: (_path, handler) => handler,
}));
// Import devuelve el handler directamente, llamable con evento fake
```

### Fake timers (fechas y timeouts)

```typescript
vi.useFakeTimers();
vi.setSystemTime(new Date('2025-06-01T12:00:00'));
// ... test ...
vi.useRealTimers();
```

---

## Prioridades pendientes

### Alta (bloquean features en desarrollo)
1. `customTags.ts` trigger — rate limit + moderation branching
2. `feedback.ts` trigger — conditional delete/flag
3. `sharedLists.ts` service — cascade delete, counter atomics
4. `useUndoDelete.ts` hook — timer safety

### Media (deuda técnica)
5. `rankings.ts` scheduled — ISO week math, score computation
6. `dailyMetrics.ts` — percentile calculation, counter reset
7. `admin/feedback.ts` — GitHub API integration
8. `admin/claims.ts` — auth claim management
9. `useAsyncData.ts` — race condition prevention
10. `useUnsavedChanges.ts` — dialog state

### Baja (bajo riesgo)
11. Componentes puramente visuales
12. Context wrappers simples
13. Constantes y re-exports

---

## Template para sección Tests en PRD/Specs

Toda nueva feature debe incluir en su **specs.md**:

```markdown
## Tests

### Archivos a testear
| Archivo | Tipo | Tests nuevos |
|---------|------|-------------|
| `src/services/newFeature.ts` | Service | Validación, CRUD, side effects |
| `src/hooks/useNewFeature.ts` | Hook | State transitions, error handling |
| `functions/src/triggers/newFeature.ts` | Trigger | Create/update/delete paths |

### Casos a cubrir
- [ ] Validación de inputs (límites, tipos, vacíos)
- [ ] Happy path completo
- [ ] Error handling (Firestore errors, network)
- [ ] Side effects (cache invalidation, analytics, notifications)
- [ ] Edge cases específicos del feature

### Mock strategy
- Firestore: mock SDK functions (getDoc, setDoc, etc.)
- Analytics: mock trackEvent
- Auth: mock useAuth() context

### Criterio de aceptación
- Cobertura ≥ 80% del código nuevo
- Todos los paths condicionales cubiertos
- Tests de validación para todos los inputs del usuario
```
