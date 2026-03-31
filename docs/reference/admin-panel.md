# Admin Panel Reference

> Canonical reference for the Modo Mapa admin dashboard. Updated with each merge that touches admin components.

## Tabs (AdminLayout.tsx)

| Index | Label | Component | Domain |
|-------|-------|-----------|--------|
| 0 | Resumen | DashboardOverview | Overview |
| 1 | Actividad | ActivityFeed | Content |
| 2 | Feedback | FeedbackList | Content |
| 3 | Tendencias | TrendsPanel | Analytics |
| 4 | Usuarios | UsersPanel | Users |
| 5 | Social | SocialPanel | Social |
| 6 | Uso Firebase | FirebaseUsage | Infra |
| 7 | Alertas | AbuseAlerts | Security |
| 8 | Backups | BackupsPanel | Infra |
| 9 | Fotos | PhotoReviewPanel | Content |
| 10 | Listas | FeaturedListsPanel | Content |
| 11 | Rendimiento | PerformancePanel | Infra |
| 12 | Funcionalidades | FeaturesPanel | Analytics |
| 13 | Notificaciones | NotificationsPanel | Social |
| 14 | Especiales | SpecialsPanel | Content |
| 15 | Logros | AchievementsPanel | Content |
| 16 | Configuracion | ConfigPanel | Infra |
| 17 | Auditorias | DeletionAuditPanel | Security |

## Cloud Functions (Admin)

All in `functions/src/admin/`. Every callable uses `assertAdmin` + `ENFORCE_APP_CHECK_ADMIN`.

| File | Exports | Purpose |
|------|---------|---------|
| backups.ts | createBackup, listBackups, restoreBackup, deleteBackup | Firestore backup management |
| menuPhotos.ts | approveMenuPhoto, rejectMenuPhoto, deleteMenuPhoto, reportMenuPhoto | Photo moderation |
| feedback.ts | respondToFeedback, resolveFeedback, createGithubIssueFromFeedback | Feedback management |
| authStats.ts | getAuthStats | Auth method statistics |
| claims.ts | setAdminClaim, removeAdminClaim | Admin role management |
| storageStats.ts | getStorageStats | Storage usage stats |
| perfMetrics.ts | writePerfMetrics | Performance metrics |
| analyticsReport.ts | getAnalyticsReport | GA4 analytics with ~70 event names |
| featuredLists.ts | toggleFeaturedList, getPublicLists, getFeaturedLists | Featured list management |
| moderation.ts | moderateComment, moderateRating, moderateCustomTag | Content moderation (delete/hide) |
| moderationConfig.ts | updateModerationConfig | Banned words editor |
| activityFeedDiag.ts | getActivityFeedDiag | Activity feed diagnostics |
| deletionAuditLogs.ts | fetchDeletionAuditLogs | Deletion audit log viewer |

## Service Layer (Frontend)

All in `src/services/admin/`. Barrel: `index.ts`.

| File | Key Exports | Notes |
|------|-------------|-------|
| counters.ts | fetchCounters, fetchDailyMetrics | Dashboard overview data |
| activity.ts | fetchRecent{Comments,Ratings,Favorites,UserTags,CustomTags,CommentLikes,PriceLevels,Checkins} | ActivityFeed tab data |
| users.ts | fetchUsersPanelData, fetchCommentStats, fetchAuthStats, fetchSettingsAggregates | Users tab |
| social.ts | fetchRecentFollows, fetchRecentRecommendations, fetchFollowStats, fetchRecommendationStats | Social tab |
| content.ts | fetchRecentFeedback, fetchPendingPhotos, fetchAbuseLogs, reviewAbuseLog, dismissAbuseLog, fetchLatestRanking, fetchTrendingCurrent, fetchNotificationDetails, fetchListStats, fetchPerfMetrics, fetchStorageStats, fetchAnalyticsReport, fetchCronHealthStatus | Multi-domain |
| moderation.ts | moderateComment, moderateRating, moderateCustomTag, fetchModerationLogs | Content moderation |
| config.ts | fetchConfigDocs, fetchConfigDoc, updateModerationBannedWords, fetchActivityFeedDiag | Config viewer/editor |
| audit.ts | fetchDeletionAuditLogs | Deletion audit logs |

## Firestore Collections (Admin-Only)

| Collection | Admin Access | Client Write? | Purpose |
|-----------|-------------|--------------|---------|
| config/* | read: isAdmin() | write: false (Admin SDK) | App configuration |
| abuseLogs/* | read+update: isAdmin() | create: false | Abuse tracking |
| moderationLogs/* | read: isAdmin() | write: false | Moderation audit trail |
| deletionAuditLogs/* | read: isAdmin() | write: false | Account deletion audit |
| perfMetrics/* | read: isAdmin() | write: false | Performance metrics |
| _cronRuns/* | read: isAdmin() | write: false | Cron heartbeat status |
| specials/* | read: authenticated | write: isAdmin() | Homepage specials |
| achievements/* | read: authenticated | write: isAdmin() | Achievement definitions |

## Component Architecture

```
src/components/admin/
  AdminLayout.tsx          — Tab router (18 tabs)
  AdminGuard.tsx           — Route protection (isAdmin claim)
  AdminPanelWrapper.tsx    — Loading/error wrapper pattern
  ActivityTable.tsx        — Reusable table for activity data
  StatCard.tsx             — Metric display card
  HealthIndicator.tsx      — ok/warning/error indicator
  CronCard.tsx             — Cron job status card
  CronHealthSection.tsx    — Cron grid + visualizations
  ModerationActions.tsx    — Delete/hide actions with confirmation
  ModerationLogTable.tsx   — Moderation audit log viewer
  ConfigPanel.tsx          — Config collection viewer/editor
  alerts/                  — Abuse alerts subsystem
  audit/                   — Deletion audit panel + KPIs
  charts/                  — LineChartCard for trends
  config/                  — ConfigDocViewer, ModerationEditor, ActivityFeedDiag
  features/                — GA4FeatureCard, GA4CategorySection, TrendIcon, definitions
  perf/                    — FunctionTimingTable, QueryLatencyTable, SemaphoreCard, StorageCard
```

## Patterns

1. **Tab panel pattern**: Each tab is a standalone component using `useAsyncData` + `AdminPanelWrapper`
2. **Service layer**: Components never import firebase directly — always through `src/services/admin/`
3. **Callable pattern**: Admin actions use `httpsCallable` wrappers in service files
4. **Optimistic UI**: Moderation uses local `removedIds` set instead of refetching
5. **Rate limiting**: All admin callables have `checkCallableRateLimit`
6. **Audit trail**: Moderation and config changes logged to dedicated collections

## Types

All admin types in `src/types/admin.ts`. Key interfaces:
- AdminCounters, DailyMetrics, AuthStats, SettingsAggregates
- AbuseLog (8 types), AbuseSeverity
- DeletionAuditLogEntry
- StorageStats, GA4EventCount, AnalyticsReportResponse
- CronRunStatus, HealthStatus
- NotificationDetails, ListStats
- Special, Achievement
- ConfigDocument, ModerationConfig
- ActivityFeedDiagItem/Response
- ModerationLog, ModerationAction, ModerationTargetCollection

## What To Add When a New Feature Ships

When a new user-facing feature merges to main, ask:

1. **Does it create new data?** → Admin needs visibility (tab, column, or section)
2. **Does it track new events?** → Admin needs analytics coverage (FeaturesPanel)
3. **Does it introduce new user states?** → Admin needs user filtering/stats
4. **Does it add new user content?** → Admin needs moderation capability
5. **Does it add new Cloud Functions?** → Admin needs monitoring (cron health, perf)

If any answer is "yes" and admin doesn't cover it → **create tech debt issue**.
