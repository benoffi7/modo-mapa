# Testing — Modo Mapa

## Resumen

| Metrica | Valor |
|---------|-------|
| **Framework** | Vitest 4.x |
| **Testing Library** | @testing-library/react + jest-dom |
| **Total test files** | 108 (74 React + 34 Functions) |
| **Total test cases** | ~1200+ (estimado post-#229/#230/#231/#232) |
| **Cobertura minima requerida** | 80% global (enforced en CI) |

### Cobertura actual (2026-03-27)

**Frontend (src/):**

| Metrica | % |
|---------|---|
| Statements | 96.1% |
| Branches | 90.7% |
| Functions | 90.1% |
| Lines | 97.3% |

**Cloud Functions (functions/):**

| Metrica | % |
|---------|---|
| Statements | 98.5% |
| Branches | 89.4% |
| Functions | 100% |
| Lines | 98.4% |

---

## Configuracion

### React App (`vitest.config.ts`)
- Environment: `jsdom`
- Globals: `enabled`
- Setup: `./src/test/setup.ts`
- Coverage provider: `v8` (`@vitest/coverage-v8`)
- Coverage thresholds: 80% en statements, branches, functions, lines
- Exclusiones: `functions/**`, `node_modules/**`
- Comando: `npm test` (watch) / `npm run test:run` (single run) / `npm run test:coverage` (con coverage + thresholds)

### Cloud Functions (`functions/vitest.config.ts`)
- Environment: `node`
- Root: `src`
- Coverage provider: `v8`
- Coverage thresholds: 80% en statements, branches, functions, lines
- Comando: `cd functions && npx vitest run` / `npm run test:coverage`

### CI enforcement
- El workflow de deploy (`.github/workflows/deploy.yml`) ejecuta coverage check
- Si alguna metrica baja del 80%, el push falla

---

## Politica de Testing

### Regla: toda nueva funcion/feature debe tener tests con >= 80% de cobertura

1. **PRDs y Specs** deben incluir una seccion `## Tests` que defina:
   - Que archivos necesitan tests
   - Que logica cubrir (validacion, edge cases, integracion)
   - Mock strategy (que se mockea, que no)
   - Criterio de aceptacion de cobertura

2. **No se mergea codigo sin tests** para:
   - Funciones con logica condicional
   - Validaciones de input
   - Servicios con side effects (cache, analytics, Firestore)
   - Cloud Functions (triggers, scheduled, callable)
   - Hooks con state management complejo

3. **Excepciones** (no requieren tests unitarios):
   - Componentes puramente visuales sin logica (skeletons, layouts estaticos)
   - Re-exports simples
   - Constantes sin logica

---

## Inventario de Tests

### React App — Utilidades (`src/utils/`)

| Archivo | Test | Cases | Cobertura |
|---------|------|-------|-----------|
| `distance.ts` | `distance.test.ts` | 9 | 100% |
| `formatDate.ts` | `formatDate.test.ts` | 15 | 96% stmts, 100% branches/funcs |
| `text.ts` | `text.test.ts` | 6 | 100% |
| `businessHelpers.ts` | `businessHelpers.test.ts` | 5 | 100% |
| `perfMetrics.ts` | `perfMetrics.test.ts` | 27 | 95% stmts, 81% branches |
| `analytics.ts` | `analytics.test.ts` | 11 | 100% stmts/lines, 95% branches |

### React App — Config (`src/config/`)

| Archivo | Test | Cases | Cobertura |
|---------|------|-------|-----------|
| `converters/userConverters.ts` | `converters/userConverters.test.ts` | 5 | 100% |
| `converters/businessConverters.ts` | `converters/businessConverters.test.ts` | 23 | 100% |
| `converters/socialConverters.ts` | `converters/socialConverters.test.ts` | 12 | 100% |
| `converters/listConverters.ts` | `converters/listConverters.test.ts` | 6 | 100% |
| `converters/rankingConverters.ts` | `converters/rankingConverters.test.ts` | 10 | 100% |
| `converters/feedbackConverters.ts` | `converters/feedbackConverters.test.ts` | 6 | 100% |

### React App — Servicios (`src/services/`)

| Archivo | Test | Cases | Cobertura |
|---------|------|-------|-----------|
| `ratings.ts` | `ratings.test.ts` | 17 | 100% (incluye fetchUserRatings, fetchRatingsByBusinessIds) |
| `checkins.ts` | `checkins.test.ts` | 13 | 100% (incluye fetchUserCheckIns) |
| `emailAuth.ts` | `emailAuth.test.ts` | 14 | 100% |
| `comments.ts` | `comments.test.ts` | 16 | 100% |
| `favorites.ts` | `favorites.test.ts` | 7 | 100% |
| `tags.ts` | `tags.test.ts` | 8 | 100% |
| `priceLevels.ts` | `priceLevels.test.ts` | 9 | 100% |
| `rankings.ts` | `rankings.test.ts` | 26 | 98% stmts, 89% branches |
| `queryCache.ts` | `queryCache.test.ts` | 7 | 100% |
| `sharedLists.ts` | `sharedLists.test.ts` | — | Parcial (createList, updateList con icon) |
| `userProfile.ts` | `__tests__/userProfile.test.ts` | 8 | Parcial (fetchUserProfileDoc, updateUserDisplayName, updateUserAvatar) |
| `userSettings.ts` | — | — | ⏳ Optimistic update rollback |
| `suggestions.ts` | — | — | 🔻 Baja prioridad (simple aggregation) |
| `feedback.ts` | — | — | ⏳ |
| `notifications.ts` | — | — | ⏳ |
| `admin.ts` | — | — | ⏳ |
| `adminFeedback.ts` | — | — | ⏳ |
| `menuPhotos.ts` | `__tests__/menuPhotos.test.ts` | 4 | Parcial (reportMenuPhoto, getMenuPhotoUrl) |

### React App — Hooks (`src/hooks/`)

| Archivo | Test | Cases | Cobertura |
|---------|------|-------|-----------|
| `useBusinesses.ts` | `useBusinesses.test.ts` | 4 | 100% |
| `useBusinessDataCache.ts` | `useBusinessDataCache.test.ts` | 9 | 100% |
| `useListFilters.ts` | `useListFilters.test.ts` | 12 | 100% |
| `usePaginatedQuery.ts` | `usePaginatedQuery.test.ts` | 11 | 100% |
| `useSuggestions.ts` | `useSuggestions.test.ts` | 10 | 100% |
| `usePriceLevelFilter.ts` | `usePriceLevelFilter.test.ts` | 7 | 100% stmts/lines, 93% branches |
| `useLocalGuideBadge.ts` | `useLocalGuideBadge.test.ts` | 9 | 100% (funcion pura calcLocalGuide) |
| `useVerifiedVisitorBadge.ts` | `useVerifiedVisitorBadge.test.ts` | 7 | 100% (funcion pura calcVerifiedVisitor) |
| `useTrustedReviewerBadge.ts` | `useTrustedReviewerBadge.test.ts` | 7 | 100% (funcion async calcTrustedReviewer) |
| `useVerificationBadges.ts` | `useVerificationBadges.test.ts` | 6 | 100% (orquestador con mocks de servicios) |
| `useFollowedTags.ts` | `useFollowedTags.test.ts` | 10 | 100% |
| `useUndoDelete.ts` | — | — | ⏳ Timer management, ref sync |
| `useAsyncData.ts` | — | — | ⏳ Race conditions, cleanup |
| `useUnsavedChanges.ts` | — | — | ⏳ Dialog state machine |
| `useRankings.ts` | — | — | ⏳ Position delta calc |
| `useUserSettings.ts` | — | — | ⏳ Optimistic updates |
| `useColorMode.ts` | — | — | 🔻 Simple wrapper (covered via ColorModeContext tests) |
| otros (13 hooks) | — | — | ⏳ |

### React App — Contexts (`src/context/`)

| Archivo | Test | Cases | Cobertura |
|---------|------|-------|-----------|
| `AuthContext.tsx` | `AuthContext.test.tsx` | 35 | 77% stmts, 81% branches |
| `ColorModeContext.tsx` | — | — | ⏳ (planned in #231) |
| `NotificationsContext.tsx` | — | — | ⏳ |
| `ToastContext.tsx` | — | — | ⏳ |

### React App — Componentes (`src/components/`)

| Archivo | Test | Cases | Cobertura |
|---------|------|-------|-----------|
| `ChangePasswordDialog.tsx` | `ChangePasswordDialog.test.tsx` | 11 | 100% |
| `EmailPasswordDialog.tsx` | `EmailPasswordDialog.test.tsx` | 17 | 100% |
| `ErrorBoundary.tsx` | `ErrorBoundary.test.tsx` | 3 | 100% |
| `OfflineIndicator.tsx` | `OfflineIndicator.test.tsx` | 5 | 100% |
| `EditorsDialog.tsx` | `EditorsDialog.test.tsx` | 2 | 100% (UID leak + secondary text) |
| otros (87 componentes) | — | — | 🔻 Mayoria visual |

### Cloud Functions — Utils (`functions/src/utils/`)

| Archivo | Test | Cases | Cobertura |
|---------|------|-------|-----------|
| `counters.ts` | `counters.test.ts` | 3 | 100% |
| `moderator.ts` | `moderator.test.ts` | 6 | 95% stmts, 63% branches |
| `notifications.ts` | `notifications.test.ts` | 9 | 100% stmts, 86% branches |
| `rateLimiter.ts` | `rateLimiter.test.ts` | 4 | 100% stmts, 83% branches |
| `callableRateLimit.ts` | `callableRateLimit.test.ts` | 4 | 100% |
| `aggregates.ts` | `aggregates.test.ts` | 6 | 100% |
| `abuseLogger.ts` | `abuseLogger.test.ts` | 5 | 100% stmts, 50% branches |
| `perfTracker.ts` | `perfTracker.test.ts` | 15 | 100% |

### Cloud Functions — Helpers (`functions/src/helpers/`)

| Archivo | Test | Cases | Cobertura |
|---------|------|-------|-----------|
| `assertAdmin.ts` | `assertAdmin.test.ts` | 6 | 100% |
| `env.ts` | — | — | 🔻 Constante simple |

### Cloud Functions — Triggers (`functions/src/triggers/`)

| Archivo | Test | Cases | Cobertura |
|---------|------|-------|-----------|
| `comments.ts` | `comments.test.ts` | 21 | 100% stmts, 91% branches |
| `commentLikes.ts` | `commentLikes.test.ts` | 10 | 100% stmts, 92% branches |
| `ratings.ts` | `ratings.test.ts` | 5 | 100% stmts, 93% branches |
| `favorites.ts` | — | — | ⏳ Dual counter ops |
| `customTags.ts` | — | — | ⏳ Rate limit + moderation |
| `feedback.ts` | — | — | ⏳ Complex branching |
| `menuPhotos.ts` | — | — | ⏳ Cloud Storage I/O |
| `users.ts` | — | — | 🔻 Simple counter |
| `priceLevels.ts` | — | — | 🔻 Simple counter |

### Cloud Functions — Callables (`functions/src/callable/`)

| Archivo | Test | Cases | Cobertura |
|---------|------|-------|-----------|
| `inviteListEditor.ts` | `inviteListEditor.test.ts` | 11 | 100% |
| `removeListEditor.ts` | `removeListEditor.test.ts` | 6 | 100% |
| `deleteUserAccount.ts` | `deleteUserAccount.test.ts` | — | ⏳ |

### Cloud Functions — Admin (`functions/src/admin/`)

| Archivo | Test | Cases | Cobertura |
|---------|------|-------|-----------|
| `authStats.ts` | `authStats.test.ts` | 6 | 89% stmts, 92% branches |
| `feedback.ts` | — | — | ⏳ GitHub API, notifications |
| `claims.ts` | — | — | ⏳ Auth claims, bootstrap |
| otros (5 admin) | — | — | ⏳ |

### Cloud Functions — Scheduled (`functions/src/scheduled/`)

| Archivo | Test | Cases | Cobertura |
|---------|------|-------|-----------|
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

### Mock de Firebase Analytics (dynamic imports)

```typescript
vi.mock('firebase/analytics', () => ({
  getAnalytics: vi.fn(() => ({})),
  setAnalyticsCollectionEnabled: vi.fn(),
  logEvent: vi.fn(),
  setUserProperties: vi.fn(),
}));
```

### Mock de PerformanceObserver

```typescript
class MockPerformanceObserver {
  callback: (list: { getEntries: () => object[] }) => void;
  constructor(cb) { this.callback = cb; }
  observe() {}
  disconnect() {}
  // Simular entries: instance.callback({ getEntries: () => [{ startTime: 100 }] })
}
vi.stubGlobal('PerformanceObserver', MockPerformanceObserver);
```

### Fresh module state (para modulos con estado interno)

```typescript
// Cuando un modulo tiene variables a nivel de modulo (cache, flags, etc.)
beforeEach(() => {
  vi.resetModules();
});

it('test with fresh state', async () => {
  const { myFunction } = await import('../path/to/module');
  // myFunction tiene estado limpio
});
```

### Fake timers (fechas y timeouts)

```typescript
vi.useFakeTimers();
vi.setSystemTime(new Date('2025-06-01T12:00:00'));
// ... test ...
vi.useRealTimers();
```

### Firestore converter testing

```typescript
// Helper para simular QueryDocumentSnapshot
function mockSnapshot(data: Record<string, unknown>, id = 'test-id') {
  return { data: () => data, id } as any;
}

// Test toFirestore/fromFirestore
const result = converter.toFirestore(input as any);
const doc = converter.fromFirestore(mockSnapshot(data, 'id'));
```

---

## Prioridades pendientes

### Alta (bloquean features en desarrollo)
1. `customTags.ts` trigger — rate limit + moderation branching
2. `feedback.ts` trigger — conditional delete/flag
3. `sharedLists.ts` service — cascade delete, counter atomics
4. `useUndoDelete.ts` hook — timer safety

### Media (deuda tecnica)
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

## Template para seccion Tests en PRD/Specs

Toda nueva feature debe incluir en su **specs.md**:

```markdown
## Tests

### Archivos a testear
| Archivo | Tipo | Tests nuevos |
|---------|------|-------------|
| `src/services/newFeature.ts` | Service | Validacion, CRUD, side effects |
| `src/hooks/useNewFeature.ts` | Hook | State transitions, error handling |
| `functions/src/triggers/newFeature.ts` | Trigger | Create/update/delete paths |

### Casos a cubrir
- [ ] Validacion de inputs (limites, tipos, vacios)
- [ ] Happy path completo
- [ ] Error handling (Firestore errors, network)
- [ ] Side effects (cache invalidation, analytics, notifications)
- [ ] Edge cases especificos del feature

### Mock strategy
- Firestore: mock SDK functions (getDoc, setDoc, etc.)
- Analytics: mock trackEvent
- Auth: mock useAuth() context

### Criterio de aceptacion
- Cobertura >= 80% del codigo nuevo
- Todos los paths condicionales cubiertos
- Tests de validacion para todos los inputs del usuario
```
