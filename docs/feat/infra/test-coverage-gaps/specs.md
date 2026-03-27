# Specs: Test coverage gaps -- 20 hooks + 15 services untested

**PRD:** [prd.md](prd.md)
**Fecha:** 2026-03-27

---

## Modelo de datos

No hay cambios al modelo de datos. Este issue crea exclusivamente archivos de test (`*.test.ts` / `*.test.tsx`).

## Firestore Rules

No se requieren cambios a Firestore rules. Todos los tests mockean Firestore SDK.

### Rules impact analysis

No aplica -- los tests no ejecutan queries reales contra Firestore.

## Cloud Functions

No se crean ni modifican Cloud Functions. Se testean las existentes.

## Componentes

No se crean ni modifican componentes. Solo archivos de test.

---

## Hooks -- Tests nuevos

### 1. `useCheckIn` (`src/hooks/useCheckIn.ts`)

**Test file:** `src/hooks/useCheckIn.test.ts`

**Mocks necesarios:**

- `../context/AuthContext` -- `useAuth` retorna `{ user: { uid } }`
- `../context/MapContext` -- `useFilters` retorna `{ userLocation }`
- `../context/ConnectivityContext` -- `useConnectivity` retorna `{ isOffline }`
- `../context/ToastContext` -- `useToast` retorna mock objeto
- `../services/checkins` -- `createCheckIn`, `deleteCheckIn`, `fetchCheckInsForBusiness`
- `../services/offlineInterceptor` -- `withOfflineSupport`
- `../utils/analytics` -- `trackEvent`
- `../utils/distance` -- `distanceKm`
- `../constants/checkin` -- valores reales importados

**Casos a cubrir (12-15 tests):**

- Initial state: `hasCheckedInRecently=false`, `status='idle'`, `canCheckIn=true`
- Loads existing check-in and detects cooldown active
- Loads existing check-in older than 4h -- cooldown not active
- `performCheckIn` happy path: calls `withOfflineSupport`, sets `status='success'`, `hasCheckedInRecently=true`
- `performCheckIn` blocked by cooldown: tracks `checkin_cooldown_blocked` event, does not call service
- `performCheckIn` with proximity warning: tracks `checkin_proximity_warning` when not nearby
- `performCheckIn` error: sets `status='error'`, captures error message
- `undoCheckIn` happy path: calls `withOfflineSupport` with delete, resets state
- `undoCheckIn` without `recentCheckInId`: no-op
- `isNearby` calculation: true when no location, true when within radius, false when outside
- Cleanup on unmount: cancelled flag prevents state updates after unmount
- No user: `performCheckIn` is no-op

### 2. `useAsyncData` (`src/hooks/useAsyncData.ts`)

**Test file:** `src/hooks/useAsyncData.test.ts`

**Mocks necesarios:**

- `../utils/logger` -- `logger`
- `import.meta.env.DEV` -- para branch de logging

**Casos a cubrir (8-10 tests):**

- Initial state: `loading=true`, `data=null`, `error=false`
- Successful fetch: `data` populated, `loading=false`
- Failed fetch: `error=true`, `loading=false`, `data=null`
- Race condition: second fetch supersedes first (ignore flag)
- `refetch`: incrementa tick, re-fetches data
- Cleanup on unmount: stale promise ignored
- Fetcher changes: re-fetches with new fetcher
- Error then success on refetch: resets error state

### 3. `useUnsavedChanges` (`src/hooks/useUnsavedChanges.ts`)

**Test file:** `src/hooks/useUnsavedChanges.test.ts`

**Mocks necesarios:** Ninguno (hook puro).

**Casos a cubrir (8-10 tests):**

- `isDirty=false` when all values empty
- `isDirty=false` when values are whitespace only
- `isDirty=true` when any value has non-whitespace content
- `confirmClose` with `isDirty=false`: calls `onClose` immediately
- `confirmClose` with `isDirty=true`: opens dialog (`dialogProps.open=true`)
- `dialogProps.onKeepEditing`: closes dialog, does NOT call `onClose`
- `dialogProps.onDiscard`: closes dialog, calls pending `onClose`
- Multiple values: any non-empty value makes dirty
- State machine: clean -> dirty -> confirming -> discard flows correctly

### 4. `useUndoDelete` (`src/hooks/useUndoDelete.ts`)

**Test file:** `src/hooks/useUndoDelete.test.ts`

**Mocks necesarios:** `vi.useFakeTimers()`

**Casos a cubrir (10-12 tests):**

- `isPendingDelete` returns false initially
- `markForDelete`: adds item, `isPendingDelete` returns true, `snackbarProps.open=true`
- Timer fires after timeout: calls `onConfirmDelete`, clears pending
- `undoDelete`: clears timer, removes from pending, snackbar closes
- `undoLast`: undoes most recent deletion
- Multiple pending deletes: tracks all independently
- `markForDelete` same ID twice: replaces timer (clears old one)
- Cleanup on unmount: all timers cleared, no `onConfirmDelete` called
- `onDeleteComplete` callback fires after confirmed delete
- `onConfirmDelete` error: item already removed from UI, no revert
- Custom timeout: respects `timeout` option
- `snackbarProps.onClose`: clears `lastDeletedId`

### 5. `useOnboardingFlow` (`src/hooks/useOnboardingFlow.ts`)

**Test file:** `src/hooks/useOnboardingFlow.test.ts`

**Mocks necesarios:**

- `localStorage` mock (via `vi.stubGlobal` or jsdom default)
- `../constants/storage` -- `STORAGE_KEY_BENEFITS_SHOWN`

**Casos a cubrir (8-10 tests):**

- Initial state: `benefitsOpen=false`, `emailDialogOpen=false`
- `handleCreateAccount` first time (no localStorage): opens benefits dialog
- `handleCreateAccount` after benefits shown (localStorage set): opens email dialog directly
- `handleCreateAccount` with custom source: sets `benefitsSource`
- `handleLogin`: opens email dialog with `emailDialogTab='login'`
- `handleBenefitsContinue`: closes benefits, opens email dialog
- `closeBenefits`: closes benefits dialog
- `closeEmailDialog`: closes email dialog
- Full flow: createAccount -> benefits -> continue -> email dialog open

### 6. `usePasswordConfirmation` (`src/hooks/usePasswordConfirmation.ts`)

**Test file:** `src/hooks/usePasswordConfirmation.test.ts`

**Mocks necesarios:** Ninguno (pure function-like hook).

**Casos a cubrir (6-8 tests):**

- Matching passwords: `isValid=true`, `error=false`, `helperText=undefined`
- Non-matching passwords with confirm non-empty: `isValid=false`, `error=true`, `helperText` set
- Empty confirm: `error=false` regardless of match (no premature validation)
- Both empty: `isValid=true`, `error=false`
- Whitespace differences: `" abc" !== "abc"` triggers error

### 7. `useRememberedEmail` (`src/hooks/useRememberedEmail.ts`)

**Test file:** `src/hooks/useRememberedEmail.test.ts`

**Mocks necesarios:**

- `localStorage` mock
- `../constants/storage` -- `STORAGE_KEY_REMEMBERED_EMAIL`

**Casos a cubrir (7-9 tests):**

- Initial state with no saved email: `email=''`, `remember=false`
- Initial state with saved email: `email` populated, `remember=true`
- `save` when remember=true: writes to localStorage
- `save` when remember=false: does not write
- `toggleRemember(_, false)`: removes from localStorage
- `toggleRemember(_, true)`: sets remember state
- `reset`: re-reads from localStorage
- `setEmail`: updates email state

### 8. `useProfileStats` (`src/hooks/useProfileStats.ts`)

**Test file:** `src/hooks/useProfileStats.test.ts`

**Mocks necesarios:**

- `../context/AuthContext` -- `useAuth`
- `./useMyCheckIns` -- `useMyCheckIns` retorna `{ stats: { uniqueBusinesses } }`
- `firebase/firestore` -- `collection`, `query`, `where`
- `../config/firebase` -- `db`
- `../config/collections` -- `COLLECTIONS`
- `../utils/getCountOfflineSafe` -- `getCountOfflineSafe`

**Casos a cubrir (5-7 tests):**

- Aggregates reviews, followers, favorites from parallel queries
- Uses `checkInStats.uniqueBusinesses` for `places`
- No user: returns zeros
- Error handling: graceful degradation on query failure

### 9. `useProfileVisibility` (`src/hooks/useProfileVisibility.ts`)

**Test file:** `src/hooks/useProfileVisibility.test.ts`

**Mocks necesarios:**

- `firebase/firestore` -- `collection`, `query`, `where`, `documentId`, `getDocs`
- `../config/firebase` -- `db`
- `../config/collections` -- `COLLECTIONS`
- `../constants/cache` -- `PROFILE_CACHE_TTL_MS`

Nota: este hook usa `useSyncExternalStore` y module-level cache. Requiere `vi.resetModules()` en `beforeEach`.

**Casos a cubrir (6-8 tests):**

- Returns `false` for uncached user IDs (while fetching)
- Populates cache after fetch, re-renders with correct values
- Batches requests in groups of 30
- Stale cache (TTL expired): re-fetches
- Error path: defaults to `false`
- Deduplicates in-flight fetches (pendingFetches)

### 10. `useMyCheckIns` (`src/hooks/useMyCheckIns.ts`)

**Test file:** `src/hooks/useMyCheckIns.test.ts`

**Mocks necesarios:**

- `../context/AuthContext` -- `useAuth`
- `../services/checkins` -- `fetchMyCheckIns`

**Casos a cubrir (5-7 tests):**

- Loads check-ins on mount
- Computes `stats.totalCheckIns` and `stats.uniqueBusinesses`
- Error handling: sets `error` message
- `refresh`: re-fetches data
- No user: does not fetch

### 11. `useUserLocation` (`src/hooks/useUserLocation.ts`)

**Test file:** `src/hooks/useUserLocation.test.ts`

**Mocks necesarios:**

- `../context/MapContext` -- `useFilters` con `{ userLocation, setUserLocation }`
- `navigator.geolocation` -- stub global

**Casos a cubrir (6-8 tests):**

- No geolocation support: sets error message
- Success: calls `setUserLocation` with coordinates
- Permission denied (code 1): specific error message
- Other geolocation error: generic error message
- `isLocating` state transitions during request
- `requestLocation` triggers geolocation API

### 12. `usePullToRefresh` (`src/hooks/usePullToRefresh.ts`)

**Test file:** `src/hooks/usePullToRefresh.test.ts`

**Mocks necesarios:** Touch event simulation.

**Casos a cubrir (6-8 tests):**

- Returns `containerRef`, `isRefreshing=false`, `pullProgress=0`
- Pull down beyond threshold (80px): triggers `onRefresh`
- Pull down below threshold: does not trigger refresh
- Pull up (negative delta): cancels pull, resets progress
- Only activates when `scrollTop === 0`
- `isRefreshing` state during async refresh
- Touch events cleaned up on unmount

### 13. `useScreenTracking` (`src/hooks/useScreenTracking.ts`)

**Test file:** `src/hooks/useScreenTracking.test.ts`

**Mocks necesarios:**

- `react-router-dom` -- `useLocation`
- `../utils/analytics` -- `trackEvent`

**Casos a cubrir (4-5 tests):**

- Tracks `screen_view` with `screen_name='map'` for `/`
- Tracks path-based screen name for `/admin` -> `admin`
- Nested paths: `/admin/feedback` -> `admin_feedback`
- Re-tracks on location change

### 14. `useTabRefresh` (`src/hooks/useTabRefresh.ts`)

**Test file:** `src/hooks/useTabRefresh.test.ts`

**Mocks necesarios:**

- `../context/TabContext` -- `useTab`

**Casos a cubrir (6-8 tests):**

- Skips initial mount (does not call onActivate)
- Calls `onActivate` when target tab becomes active
- Does not call `onActivate` when different tab becomes active
- `useSocialSubTabRefresh`: calls when parent tab is 'social' and subTab matches
- `useListsSubTabRefresh`: calls when parent tab is 'listas' and subTab matches

### 15. `useAbuseLogsRealtime` (`src/hooks/useAbuseLogsRealtime.ts`)

**Test file:** `src/hooks/useAbuseLogsRealtime.test.ts`

**Mocks necesarios:**

- `firebase/firestore` -- `collection`, `query`, `orderBy`, `limit`, `onSnapshot`
- `../config/firebase` -- `db`
- `../config/collections` -- `COLLECTIONS`
- `../config/adminConverters` -- `abuseLogConverter`

**Casos a cubrir (6-8 tests):**

- Initial state: `loading=true`, `logs=null`
- First snapshot: populates logs, `newCount=0`
- Subsequent snapshot with new docs: increments `newCount`
- Error callback: sets `error=true`
- `resetNewCount`: resets to 0, updates initialIds
- Cleanup: unsubscribes on unmount

### 16. `ConnectivityContext` (`src/context/ConnectivityContext.tsx`)

**Test file:** `src/context/ConnectivityContext.test.tsx`

**Mocks necesarios:**

- `../services/offlineQueue` -- `getAll`, `count`, `subscribe`, `remove`, `bulkUpdateStatus`
- `../services/syncEngine` -- `processQueue`
- `./ToastContext` -- `useToast`
- `../utils/analytics` -- `trackEvent`
- `../constants/offline` -- constants
- `fetch` global mock (for `checkRealConnectivity`)
- `navigator.onLine` stub

**Casos a cubrir (8-10 tests):**

- Initial state reflects `navigator.onLine`
- `online` event: verifies real connectivity via fetch, sets `isOffline=false`, triggers sync
- `offline` event: sets `isOffline=true`
- Sync toast messages (singular/plural)
- `discardAction`: removes from queue, tracks analytics
- `retryFailed`: resets failed actions to pending, triggers sync if online
- `pendingActionsCount` updates from queue subscription
- `useConnectivity` throws outside provider

### 17. `NotificationsContext` (`src/context/NotificationsContext.tsx`)

**Test file:** `src/context/NotificationsContext.test.tsx`

**Mocks necesarios:**

- `./AuthContext` -- `useAuth`
- `../services/notifications` -- all exports
- `../constants/timing` -- `POLL_INTERVAL_MS`
- `../utils/logger` -- `logger`
- `vi.useFakeTimers()` for polling interval

**Casos a cubrir (8-10 tests):**

- Loads notifications and unread count on mount when user exists
- No user: returns empty notifications, 0 unread count
- Polling: calls `getUnreadCount` every `POLL_INTERVAL_MS`
- Polling pauses when `document.visibilityState !== 'visible'`
- Polling pauses when `navigator.onLine === false`
- `markRead`: updates local state optimistically, calls service
- `markAllRead`: marks all as read locally, calls service
- `refresh`: re-fetches notifications
- Cleanup: clears interval on unmount
- User change: reloads notifications for new user

---

## Servicios -- Tests nuevos

### 1. `feedback.ts` (`src/services/feedback.ts`)

**Test file:** `src/services/feedback.test.ts`

**Mocks necesarios:**

- `../config/firebase` -- `db`, `storage`
- `../config/collections` -- `COLLECTIONS`
- `../config/converters` -- `feedbackConverter`
- `firebase/firestore` -- standard mock
- `firebase/storage` -- `ref`, `uploadBytes`, `getDownloadURL`
- `../utils/analytics` -- `trackEvent`
- `../constants/feedback` -- `VALID_CATEGORIES`, `MAX_FEEDBACK_MEDIA_SIZE`
- `../constants/validation` -- `MAX_FEEDBACK_LENGTH`

**Casos a cubrir (12-14 tests):**

- `sendFeedback` happy path: creates doc, tracks event
- `sendFeedback` with media: uploads file, gets URL, updates doc with `mediaUrl`/`mediaType`
- `sendFeedback` with PDF media: sets `mediaType='pdf'`
- `sendFeedback` with business: includes `businessId`/`businessName`
- Validation: empty message throws
- Validation: message > 1000 chars throws
- Validation: invalid category throws
- Validation: unsupported media type throws
- Validation: media too large throws
- `fetchUserFeedback`: queries with converter, returns mapped data
- `markFeedbackViewed`: updates doc with `viewedByUser: true`

### 2. `notifications.ts` (`src/services/notifications.ts`)

**Test file:** `src/services/notifications.test.ts`

**Mocks necesarios:**

- `../config/firebase` -- `db`
- `../config/collections` -- `COLLECTIONS`
- `../config/converters` -- `notificationConverter`
- `firebase/firestore` -- standard mock
- `../utils/perfMetrics` -- `measureAsync`
- `../utils/getCountOfflineSafe` -- `getCountOfflineSafe`

**Casos a cubrir (8-10 tests):**

- `fetchUserNotifications`: queries with converter, limit, order, returns mapped data
- `fetchUserNotifications` custom limit
- `markNotificationRead`: updates doc with `read: true`
- `markAllNotificationsRead`: batch updates all unread docs
- `markAllNotificationsRead` with empty result: no batch commit
- `getUnreadCount`: queries unread, returns count

### 3. `userProfile.ts` (`src/services/userProfile.ts`)

**Test file:** `src/services/userProfile.test.ts`

**Mocks necesarios:**

- `../config/firebase` -- `db`
- `../config/collections` -- `COLLECTIONS`
- `../config/converters` -- all used converters
- `firebase/firestore` -- `doc`, `getDoc`, `getDocs`, `collection`, `query`, `where`, `orderBy`
- `../utils/businessHelpers` -- `getBusinessName`
- `./rankings` -- `fetchLatestRanking`
- `../utils/logger` -- `logger`

**Casos a cubrir (8-10 tests):**

- `fetchUserProfile` happy path: 7 parallel queries, aggregates stats correctly
- Computes `likesReceived` from comment likeCount sum
- Returns top 5 recent comments with `businessName`
- Ranking position found: returns 1-indexed position
- Ranking position not found: returns `null`
- User doc not found: uses fallback name or 'Anonimo'
- User doc fetch error: graceful fallback (does not crash)
- Ranking fetch error: graceful fallback
- `fallbackName` parameter used when user doc missing

### 4. `menuPhotos.ts` (`src/services/menuPhotos.ts`)

**Test file:** `src/services/menuPhotos.test.ts`

**Mocks necesarios:**

- `../config/firebase` -- `db`, `storage`
- `../config/collections` -- `COLLECTIONS`
- `../config/converters` -- `menuPhotoConverter`
- `firebase/firestore` -- standard mock
- `firebase/storage` -- `ref`, `uploadBytesResumable`
- `../hooks/useBusinessDataCache` -- `invalidateBusinessCache`
- `../utils/analytics` -- `trackEvent`

**Casos a cubrir (10-12 tests):**

- `uploadMenuPhoto` happy path: validates, checks pending count, uploads, creates doc
- Validation: unsupported type throws
- Validation: file too large throws
- Pending limit (>=3): throws
- AbortSignal cancellation: upload cancelled
- Progress callback invoked during upload
- `getApprovedMenuPhoto`: returns first approved photo or null
- `getUserPendingPhotos`: returns pending photos for user+business

### 5. `activityFeed.ts` (`src/services/activityFeed.ts`)

**Test file:** `src/services/activityFeed.test.ts`

**Mocks necesarios:**

- `../config/firebase` -- `db`
- `../config/collections` -- `COLLECTIONS`
- `../config/converters` -- `activityFeedItemConverter`
- `firebase/firestore` -- `collection`

**Casos a cubrir (2-3 tests):**

- `getActivityFeedCollection`: returns typed collection reference with converter
- Correct path: `activityFeed/{userId}/items`

### 6. `trending.ts` (`src/services/trending.ts`)

**Test file:** `src/services/trending.test.ts`

**Mocks necesarios:**

- `../config/firebase` -- `db`
- `../config/collections` -- `COLLECTIONS`
- `../config/converters` -- `trendingDataConverter`
- `firebase/firestore` -- `doc`, `getDoc`

**Casos a cubrir (3-4 tests):**

- `fetchTrending` returns data when document exists
- `fetchTrending` returns null when document does not exist

### 7. `suggestions.ts` (`src/services/suggestions.ts`)

**Test file:** `src/services/suggestions.test.ts`

**Mocks necesarios:**

- `../config/firebase` -- `db`
- `../config/collections` -- `COLLECTIONS`
- `../config/converters` -- converters
- `firebase/firestore` -- standard mock

**Casos a cubrir (4-5 tests):**

- `fetchUserSuggestionData`: executes 3 parallel queries
- Returns typed data: `favorites`, `ratings`, `userTags`
- Limits each query to 200 docs

### 8. `adminFeedback.ts` (`src/services/adminFeedback.ts`)

**Test file:** `src/services/adminFeedback.test.ts`

**Mocks necesarios:**

- `../config/firebase` -- `functions`
- `firebase/functions` -- `httpsCallable`

**Casos a cubrir (3-4 tests):**

- `respondToFeedback`: callable configured with correct function name
- `resolveFeedback`: callable configured correctly
- `createGithubIssueFromFeedback`: callable configured correctly

---

## Cloud Functions -- Tests nuevos

### Patron de mock compartido

Todos los tests de Cloud Functions usan el patron de `comments.test.ts`:

```typescript
const { handlers, mockIncrement, ... } = vi.hoisted(() => ({...}));

vi.mock('firebase-functions/v2/firestore', () => ({
  onDocumentCreated: (path, handler) => { handlers[`created:${path}`] = handler; return handler; },
  onDocumentDeleted: (path, handler) => { handlers[`deleted:${path}`] = handler; return handler; },
}));
```

### Triggers

#### 1. `favorites.ts` trigger

**Test file:** `functions/src/__tests__/triggers/favorites.test.ts`

**Casos a cubrir (8-10 tests):**

- `onFavoriteCreated`: increments counter, tracks write
- `onFavoriteCreated` with businessId: increments business count
- `onFavoriteCreated` with userId + businessId: fan-outs to followers
- `onFavoriteCreated` without businessId: skips business count
- `onFavoriteCreated` no data: early return
- `onFavoriteDeleted`: decrements counter, tracks delete
- `onFavoriteDeleted` with businessId: decrements business count
- `onFavoriteDeleted` no data: early return

#### 2. `customTags.ts` trigger

**Test file:** `functions/src/__tests__/triggers/customTags.test.ts`

**Casos a cubrir (8-10 tests):**

- `onCustomTagCreated` happy path: rate limit passes, moderation passes, increments counter
- `onCustomTagCreated` rate limited: deletes doc, logs abuse
- `onCustomTagCreated` flagged moderation: deletes doc, logs abuse
- `onCustomTagCreated` no data: early return
- `onCustomTagDeleted`: decrements counter, tracks delete

#### 3. `feedback.ts` trigger

**Test file:** `functions/src/__tests__/triggers/feedback.test.ts`

**Casos a cubrir (7-9 tests):**

- `onFeedbackCreated` happy path: rate limit passes, moderation passes, sets status, increments counter
- Rate limited: deletes doc, logs abuse
- Flagged content: updates doc with `flagged: true`, logs abuse (does NOT delete)
- No data: early return
- Sets initial status to `pending`

#### 4. `follows.ts` trigger

**Test file:** `functions/src/__tests__/triggers/follows.test.ts`

**Casos a cubrir (12-15 tests):**

- `onFollowCreated` happy path: increments both counters, creates notification
- Rate limited (>50/day): deletes doc, logs abuse
- Max follows exceeded (>200): deletes doc
- Followed user has `profilePublic: false`: deletes doc
- Followed user with no settings doc: allows follow
- Counter increment with update fallback (catch -> set merge)
- `onFollowDeleted` happy path: decrements counters (floor 0)
- `onFollowDeleted` counters already at 0: no decrement
- No data: early return

#### 5. `recommendations.ts` trigger

**Test file:** `functions/src/__tests__/triggers/recommendations.test.ts`

**Casos a cubrir (8-10 tests):**

- Happy path: notification created, counter incremented
- Self-recommend: deletes doc
- Rate limited (>20/day): deletes doc, logs abuse
- Flagged message: deletes doc, logs abuse
- Empty message: skips moderation, proceeds normally
- No data: early return

#### 6. `menuPhotos.ts` trigger

**Test file:** `functions/src/__tests__/triggers/menuPhotos.test.ts`

**Casos a cubrir (5-7 tests):**

- `onMenuPhotoCreated`: downloads original, generates thumbnail via sharp, updates doc
- Thumbnail generation error: logs error, still increments counters
- No data: early return
- Counter increment + trackWrite called

**Mocks adicionales:** `sharp` (mock chain: `resize().jpeg().toBuffer()`), `firebase-admin/storage` (`getStorage().bucket()`)

#### 7. `users.ts` trigger

**Test file:** `functions/src/__tests__/triggers/users.test.ts`

**Casos a cubrir (4-5 tests):**

- `onUserCreated`: increments counter, tracks write
- With displayName: updates doc with `displayNameLower`, initializes follow counters
- Without displayName: skips displayNameLower update

#### 8. `priceLevels.ts` trigger

**Test file:** `functions/src/__tests__/triggers/priceLevels.test.ts`

**Casos a cubrir (3-4 tests):**

- `onPriceLevelCreated`: increments counter, tracks write
- `onPriceLevelUpdated`: tracks write (no counter increment)

#### 9. `userSettings.ts` trigger

**Test file:** `functions/src/__tests__/triggers/userSettings.test.ts`

**Casos a cubrir (2-3 tests):** Depende del contenido actual del archivo. Tests minimos para cualquier handler definido.

### Scheduled Functions

#### 1. `rankings.ts`

**Test file:** `functions/src/__tests__/scheduled/rankings.test.ts`

**Mocks necesarios:**

- `firebase-functions/v2/scheduler` -- captura handler
- `firebase-admin/firestore` -- `Timestamp.fromDate`, `getFirestore`

**Casos a cubrir (10-12 tests):**

- `getWeekStart`: returns Monday for various days of the week
- `getISOWeekKey`: returns correct `weekly_YYYY-WNN` format
- `computeRanking`: aggregates scores from 6 collections with correct weights
- Score algorithm: `comments*3 + ratings*2 + likes*1 + tags*1 + favorites*1 + photos*5`
- No activity: returns empty scores array
- Top 50 truncation: only top 50 returned even with more participants
- `computeWeeklyRanking`: uses previous week dates
- `computeMonthlyRanking`: uses previous month dates
- `computeAlltimeRanking`: uses alltime range
- Result written to correct doc path (`userRankings/{periodKey}`)

#### 2. `cleanupNotifications.ts`

**Test file:** `functions/src/__tests__/scheduled/cleanupNotifications.test.ts`

**Casos a cubrir (4-5 tests):**

- Deletes expired notifications via batch
- Empty result: no batch commit
- Logs cleanup count

#### 3. `cleanupPhotos.ts`

**Test file:** `functions/src/__tests__/scheduled/cleanupPhotos.test.ts`

**Mocks adicionales:** `firebase-admin/storage` -- `getStorage().bucket()`

**Casos a cubrir (4-5 tests):**

- Deletes rejected photos older than 7 days from Storage + Firestore
- Deletes both storagePath and thumbnailPath
- Storage delete error: continues without failing
- Empty result: no deletions

#### 4. `cleanupActivityFeed.ts`

**Test file:** `functions/src/__tests__/scheduled/cleanupActivityFeed.test.ts`

**Casos a cubrir (4-5 tests):**

- Deletes expired activity feed items via batch
- Only deletes items under `activityFeed/*/items` path
- Empty result: no batch commit
- Limit 500 per run

#### 5. `dailyMetrics.ts`

**Test file:** `functions/src/__tests__/scheduled/dailyMetrics.test.ts`

**Casos a cubrir (6-8 tests):**

- Aggregates counts from multiple collections
- Computes rating distribution
- Computes top favorited/commented/rated businesses
- Counts active users from today's activity
- Writes to `dailyMetrics/{YYYY-MM-DD}`
- Performance data aggregation (when perf metrics exist)

### Callable Functions

#### 1. `cleanAnonymousData.ts`

**Test file:** `functions/src/__tests__/callable/cleanAnonymousData.test.ts`

**Casos a cubrir (6-8 tests):**

- Happy path: deletes all user data, returns success
- Unauthenticated: throws `unauthenticated`
- Email user (non-anonymous): throws `permission-denied`
- Rate limited (<60s since last attempt): throws `resource-exhausted`
- Sets rate limit doc before deletion

### Admin Functions

#### 1. `admin/feedback.ts`

**Test file:** `functions/src/__tests__/admin/feedback.test.ts`

**Casos a cubrir (12-14 tests):**

- `respondToFeedback` happy path: updates status, creates notification
- Missing feedbackId: throws `invalid-argument`
- Response too long / empty: throws `invalid-argument`
- Feedback not found: throws `not-found`
- Non-admin: throws (via `assertAdmin`)
- `resolveFeedback` happy path: updates status, creates notification
- `resolveFeedback` feedback not found: throws
- `createGithubIssueFromFeedback` happy path: creates issue via Octokit, updates doc
- Already has GitHub issue: throws `already-exists`
- No GITHUB_TOKEN: throws `failed-precondition`
- Label mapping: bug->bug, sugerencia->enhancement, otro->feedback

#### 2. `admin/claims.ts`

**Test file:** `functions/src/__tests__/admin/claims.test.ts`

**Mocks adicionales:** `firebase-admin/auth` -- `getAuth().getUser`, `getAuth().setCustomUserClaims`

**Casos a cubrir (8-10 tests):**

- `setAdminClaim` by existing admin: sets claim, preserves existing claims
- `setAdminClaim` by bootstrap email: sets claim
- `setAdminClaim` unauthorized: throws `permission-denied`
- `setAdminClaim` emulator bypass: allows any caller
- `removeAdminClaim` by admin: removes admin claim
- `removeAdminClaim` self-remove: throws `failed-precondition`
- Invalid targetUid: throws `invalid-argument`

#### 3. `admin/menuPhotos.ts`

**Test file:** `functions/src/__tests__/admin/menuPhotos.test.ts`

**Casos a cubrir (12-14 tests):**

- `approveMenuPhoto`: updates status, replaces existing approved, notifies user
- Photo not pending/rejected: throws `failed-precondition`
- Photo not found: throws `not-found`
- Non-admin: throws
- `rejectMenuPhoto`: updates status + reason, notifies user
- `deleteMenuPhoto`: deletes Storage files + Firestore doc
- `reportMenuPhoto`: increments reportCount via transaction, creates report subdoc
- `reportMenuPhoto` duplicate report: throws `already-exists`
- `reportMenuPhoto` non-approved photo: throws `failed-precondition`
- `reportMenuPhoto` unauthenticated: throws

#### 4. `admin/backups.ts`

**Test file:** `functions/src/__tests__/admin/backups.test.ts`

**Casos a cubrir (6-8 tests):** Tests para `createBackup`, `listBackups`, `restoreBackup`, `deleteBackup`. Admin auth verification. Input validation.

#### 5. `admin/storageStats.ts`, `admin/analyticsReport.ts`, `admin/perfMetrics.ts`

**Test files:** Respective test files in `functions/src/__tests__/admin/`

**Casos a cubrir (3-4 each):** Happy path + admin auth + input validation.

---

## Integracion

No se modifican archivos de produccion. Los tests importan los modulos existentes y los verifican. La unica integracion es:

- Agregar los test files al coverage report (automatico por Vitest)
- Verificar que coverage global no baja (deberia subir)

---

## Tests

Este issue ES la seccion de tests. Todos los archivos listados arriba son test files.

| Archivo test | Que testear | Tipo |
|---|---|---|
| `src/hooks/useCheckIn.test.ts` | Cooldown, proximity, toggle, offline | Hook |
| `src/hooks/useAsyncData.test.ts` | Loading/error/race conditions | Hook |
| `src/hooks/useUnsavedChanges.test.ts` | State machine dialog | Hook |
| `src/hooks/useUndoDelete.test.ts` | Timer management, Map pending | Hook |
| `src/hooks/useOnboardingFlow.test.ts` | Flow steps, localStorage | Hook |
| `src/hooks/usePasswordConfirmation.test.ts` | Validation logic | Hook |
| `src/hooks/useRememberedEmail.test.ts` | localStorage read/write | Hook |
| `src/hooks/useProfileStats.test.ts` | Parallel queries aggregation | Hook |
| `src/hooks/useProfileVisibility.test.ts` | Cache, batch fetch, TTL | Hook |
| `src/hooks/useMyCheckIns.test.ts` | Fetch, stats computation | Hook |
| `src/hooks/useUserLocation.test.ts` | Geolocation API mock | Hook |
| `src/hooks/usePullToRefresh.test.ts` | Touch events, threshold | Hook |
| `src/hooks/useScreenTracking.test.ts` | Analytics screen_view | Hook |
| `src/hooks/useTabRefresh.test.ts` | Tab activation callbacks | Hook |
| `src/hooks/useAbuseLogsRealtime.test.ts` | Realtime listener, newCount | Hook |
| `src/context/ConnectivityContext.test.tsx` | Online/offline, sync, queue | Context |
| `src/context/NotificationsContext.test.tsx` | Polling, mark read, refresh | Context |
| `src/services/feedback.test.ts` | CRUD, media upload, validation | Service |
| `src/services/notifications.test.ts` | Fetch, mark read, count | Service |
| `src/services/userProfile.test.ts` | 7 parallel queries, aggregation | Service |
| `src/services/menuPhotos.test.ts` | Upload, validate, fetch | Service |
| `src/services/activityFeed.test.ts` | Collection reference | Service |
| `src/services/trending.test.ts` | Fetch trending data | Service |
| `src/services/suggestions.test.ts` | Parallel queries | Service |
| `src/services/adminFeedback.test.ts` | Callable wrappers | Service |
| `functions/src/__tests__/triggers/favorites.test.ts` | Counters, fan-out | Trigger |
| `functions/src/__tests__/triggers/customTags.test.ts` | Rate limit, moderation | Trigger |
| `functions/src/__tests__/triggers/feedback.test.ts` | Rate limit, flagging | Trigger |
| `functions/src/__tests__/triggers/follows.test.ts` | Counters, notifications, guards | Trigger |
| `functions/src/__tests__/triggers/recommendations.test.ts` | Rate limit, notifications | Trigger |
| `functions/src/__tests__/triggers/menuPhotos.test.ts` | Thumbnail gen, counters | Trigger |
| `functions/src/__tests__/triggers/users.test.ts` | Counter, displayNameLower | Trigger |
| `functions/src/__tests__/triggers/priceLevels.test.ts` | Counter, trackWrite | Trigger |
| `functions/src/__tests__/scheduled/rankings.test.ts` | Score algo, date math | Scheduled |
| `functions/src/__tests__/scheduled/cleanupNotifications.test.ts` | Batch delete expired | Scheduled |
| `functions/src/__tests__/scheduled/cleanupPhotos.test.ts` | Storage + Firestore delete | Scheduled |
| `functions/src/__tests__/scheduled/cleanupActivityFeed.test.ts` | Path filter, batch delete | Scheduled |
| `functions/src/__tests__/scheduled/dailyMetrics.test.ts` | Aggregation, percentiles | Scheduled |
| `functions/src/__tests__/callable/cleanAnonymousData.test.ts` | Auth, rate limit, cascade | Callable |
| `functions/src/__tests__/admin/feedback.test.ts` | Respond, resolve, GitHub | Admin |
| `functions/src/__tests__/admin/claims.test.ts` | Set/remove claims, auth | Admin |
| `functions/src/__tests__/admin/menuPhotos.test.ts` | Approve/reject/delete/report | Admin |
| `functions/src/__tests__/admin/backups.test.ts` | CRUD, validation | Admin |
| `functions/src/__tests__/admin/storageStats.test.ts` | Aggregation | Admin |
| `functions/src/__tests__/admin/analyticsReport.test.ts` | GA4 fetch | Admin |
| `functions/src/__tests__/admin/perfMetrics.test.ts` | Write validation | Admin |

## Analytics

No se agregan nuevos eventos de analytics. Los tests verifican que los eventos existentes se disparan correctamente (via `trackEvent` mock).

---

## Offline

### Cache strategy

No aplica -- tests mockean todas las dependencias.

### Writes offline

No aplica -- tests verifican comportamiento offline via mocks.

### Fallback UI

No aplica -- no hay componentes UI nuevos.

Los tests de `ConnectivityContext` y `useCheckIn` verifican que la integracion con `withOfflineSupport` funciona correctamente.

---

## Decisiones tecnicas

### 1. Contexts testeados como Context, no como Hook re-exports

`useConnectivity` y `useNotifications` son re-exports de sus respectivos contexts. Los tests se escriben contra los contexts (`ConnectivityContext.test.tsx`, `NotificationsContext.test.tsx`) usando `renderHook` con un wrapper que incluye el provider. Esto cubre tanto el provider como el hook consumer.

**Alternativa rechazada:** Testear los hooks re-export por separado -- no aporta valor, solo verifica que el re-export funciona.

### 2. Module-level cache requiere `vi.resetModules()`

`useProfileVisibility` tiene cache a nivel de modulo (`visibilityCache` Map). Cada test debe usar `vi.resetModules()` + dynamic import para obtener estado limpio. Patron ya establecido en `src/test/` (documentado en `tests.md` "Fresh module state").

### 3. Fases incrementales priorizadas por impacto

Las fases de implementacion siguen la prioridad del PRD: hooks criticos primero (impactan UX directamente), luego services (logica de negocio), luego Cloud Functions (integridad de datos). Esto permite hacer deploys parciales si el esfuerzo total es demasiado para un solo PR.

### 4. Tests de admin functions comparten mock de `assertAdmin`

Todos los tests de admin Cloud Functions mockean `../helpers/assertAdmin` de forma estandar. Se crea un helper compartido o se repite el patron hoisted. Dado que el helper ya existe en `assertAdmin.test.ts`, se reutiliza el patron.

### 5. `usePullToRefresh` se testea con touch event simulation

Este hook escucha `touchstart`/`touchmove`/`touchend` en el `containerRef`. Los tests deben simular estos eventos usando `dispatchEvent(new TouchEvent(...))` en jsdom. Si jsdom no soporta `TouchEvent`, se usa un polyfill minimo o `new Event('touchstart')` con propiedades mock.
