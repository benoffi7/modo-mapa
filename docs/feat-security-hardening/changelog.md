# Changelog: Security Hardening

## Documentación

- `docs/feat-security-hardening/prd.md`
- `docs/feat-security-hardening/specs.md`
- `docs/feat-security-hardening/plan.md`
- `docs/feat-security-hardening/changelog.md`

## Cloud Functions (nuevo directorio `functions/`)

- `functions/package.json` — Dependencias y scripts
- `functions/tsconfig.json` — TypeScript config (CommonJS, strict)
- `functions/vitest.config.ts` — Config de tests
- `functions/src/index.ts` — Entry point, exporta todos los triggers y scheduled
- `functions/src/utils/rateLimiter.ts` — Rate limiting (daily/per-entity)
- `functions/src/utils/moderator.ts` — Moderación de contenido (banned words con caché)
- `functions/src/utils/counters.ts` — Helpers para incrementar/decrementar counters
- `functions/src/utils/abuseLogger.ts` — Logger de abuso a colección `abuseLogs`
- `functions/src/triggers/comments.ts` — onCommentCreated (rate limit + moderación + counters), onCommentDeleted
- `functions/src/triggers/customTags.ts` — onCustomTagCreated (rate limit + moderación + counters), onCustomTagDeleted
- `functions/src/triggers/feedback.ts` — onFeedbackCreated (rate limit + moderación + counters)
- `functions/src/triggers/ratings.ts` — onRatingWritten (counters para create/update/delete)
- `functions/src/triggers/favorites.ts` — onFavoriteCreated/Deleted (counters)
- `functions/src/triggers/users.ts` — onUserCreated (counters)
- `functions/src/scheduled/dailyMetrics.ts` — Cron diario: distribución ratings, tops, active users, reset counters
- `functions/src/__tests__/utils/rateLimiter.test.ts` — 4 tests
- `functions/src/__tests__/utils/moderator.test.ts` — 6 tests
- `functions/src/__tests__/utils/counters.test.ts` — 3 tests

## Frontend — Admin Dashboard (nuevos)

- `src/pages/AdminDashboard.tsx` — Entry point con AdminGuard
- `src/components/admin/AdminGuard.tsx` — Google Sign-In + verificación email
- `src/components/admin/AdminLayout.tsx` — AppBar + Tabs (4 secciones)
- `src/components/admin/DashboardOverview.tsx` — StatCards + PieCharts + TopLists
- `src/components/admin/ActivityFeed.tsx` — Tabs por colección (comentarios, ratings, favoritos, tags)
- `src/components/admin/FirebaseUsage.tsx` — LineCharts + PieCharts + barras de cuota
- `src/components/admin/AbuseAlerts.tsx` — Tabla de logs de abuso
- `src/components/admin/StatCard.tsx` — Card con número grande
- `src/components/admin/TopList.tsx` — Tabla con barras de progreso
- `src/components/admin/ActivityTable.tsx` — Tabla genérica
- `src/components/admin/charts/PieChartCard.tsx` — Wrapper recharts pie
- `src/components/admin/charts/LineChartCard.tsx` — Wrapper recharts line

## Frontend — Tipos y config (nuevos)

- `src/types/admin.ts` — AdminCounters, DailyMetrics, AbuseLog
- `src/config/adminConverters.ts` — countersConverter, dailyMetricsConverter, abuseLogConverter

## Archivos modificados

- `src/types/index.ts` — Agregado `flagged?: boolean` a `Comment`
- `src/config/collections.ts` — Agregado `CONFIG`, `DAILY_METRICS`, `ABUSE_LOGS`
- `src/config/converters.ts` — commentConverter lee campo `flagged`
- `src/context/AuthContext.tsx` — Agregado `signInWithGoogle()`, `signOut()`, `GoogleAuthProvider`
- `src/App.tsx` — Ruta `/admin` con lazy loading (sin MapProvider/APIProvider)
- `src/components/business/BusinessComments.tsx` — Filtro client-side de comments flaggeados
- `firestore.rules` — Helper `isAdmin()`, admin read en `users`/`feedback`, reglas para `config/*`, `dailyMetrics`, `abuseLogs`
- `firebase.json` — Sección `functions`, emulador de functions en port 5001
- `package.json` — Agregado `recharts`, actualizado `dev:full` y `emulators` para incluir functions
