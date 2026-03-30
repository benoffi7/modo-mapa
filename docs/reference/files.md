# Estructura de archivos

## Frontend (`src/`)

```text
src/
├── App.tsx                          # Routing: /admin (lazy) vs /* (mapa)
├── main.tsx                         # Entry point (StrictMode)
├── index.css                        # Estilos globales minimos
├── config/
│   ├── firebase.ts                  # Init Firebase + emuladores en DEV + App Check (prod) + persistent cache (prod)
│   ├── collections.ts               # Nombres de colecciones Firestore centralizados (incl. COMMENT_LIKES, PERF_METRICS)
│   ├── converters.ts                # FirestoreDataConverter<T> tipados por coleccion (incl. feedback, commentLike)
│   ├── adminConverters.ts           # Converters para AdminCounters (incl. commentLikes), DailyMetrics, AbuseLog
│   └── metricsConverter.ts          # Converter para PublicMetrics (solo campos publicos)
├── constants/
│   ├── index.ts                    # Barrel re-export de todos los módulos + COLLECTIONS
│   ├── validation.ts               # MAX_COMMENT_LENGTH, MAX_DISPLAY_NAME_LENGTH, SCORE_OPTIONS, etc.
│   ├── cache.ts                    # BUSINESS_CACHE_TTL_MS, QUERY_CACHE_TTL_MS, PROFILE_CACHE_TTL_MS
│   ├── storage.ts                  # STORAGE_KEY_COLOR_MODE, STORAGE_KEY_VISITS, STORAGE_KEY_ANALYTICS_CONSENT
│   ├── timing.ts                   # POLL_INTERVAL_MS, AUTO_DISMISS_MS, SIX_MONTHS_MS
│   ├── feedback.ts                 # VALID_CATEGORIES, FEEDBACK_STATUSES (label+color), MAX_ADMIN_RESPONSE_LENGTH, MAX_FEEDBACK_MEDIA_SIZE
│   ├── ui.ts                       # CHART_COLORS, ADD_BUSINESS_URL
│   ├── map.ts                      # BUENOS_AIRES_CENTER, CATEGORY_COLORS
│   ├── tags.ts                     # PREDEFINED_TAGS, VALID_TAG_IDS
│   ├── rankings.ts                 # SCORING, MEDALS, ACTION_LABELS, PERIOD_OPTIONS
│   ├── business.ts                 # LEVELS, LEVEL_SYMBOLS, PRICE_CHIPS, PRICE_LEVEL_LABELS, CATEGORY_LABELS
│   ├── criteria.ts                 # RATING_CRITERIA (CriterionConfig[] con id y label para multi-criterio)
│   ├── suggestions.ts              # SUGGESTION_WEIGHTS, MAX_SUGGESTIONS, NEARBY_RADIUS_KM
│   ├── admin.ts                    # ADMIN_EMAIL, ADMIN_PAGE_SIZE, STATUS_CHIP, STATUS_LABELS, ABUSE_TYPE_*
│   ├── performance.ts              # PERF_THRESHOLDS (green/red por vital), PERF_FLUSH_DELAY_MS
│   └── verificationBadges.ts       # VERIFICATION_BADGES (3 badges de verificacion), cache key + TTL
├── context/
│   ├── AuthContext.tsx               # Auth anonima + Google Sign-In + displayName
│   ├── ColorModeContext.tsx          # Dark/light mode provider + localStorage persistence
│   └── NotificationsContext.tsx      # Notificaciones: instancia unica compartida (unread count, mark read, polling)
├── services/
│   ├── favorites.ts                 # addFavorite, removeFavorite
│   ├── ratings.ts                   # upsertRating
│   ├── comments.ts                  # addComment, editComment, deleteComment, likeComment, unlikeComment
│   ├── tags.ts                      # addUserTag, removeUserTag, createCustomTag, updateCustomTag, deleteCustomTag
│   ├── feedback.ts                  # sendFeedback (with media upload), fetchUserFeedback, markFeedbackViewed
│   ├── adminFeedback.ts             # respondToFeedback, resolveFeedback, createGithubIssueFromFeedback (callable wrappers)
│   ├── menuPhotos.ts                # uploadMenuPhoto (con AbortSignal), getUserPendingPhotos
│   ├── priceLevels.ts               # upsertPriceLevel, deletePriceLevel, getBusinessPriceLevels
│   ├── rankings.ts                  # fetchLatestRanking (ranking mensual/semanal)
│   ├── userProfile.ts               # fetchUserProfile (stats, comentarios, ranking position)
│   ├── suggestions.ts               # fetchUserSuggestionData (favorites, ratings, tags para sugerencias)
│   └── admin.ts                     # fetchCounters, fetchRecent*, fetchUsersPanelData (incl. commentLikes/likesGiven), fetchDailyMetrics, fetchAbuseLogs, fetchAllPhotos, fetchAuthStats, fetchNotificationStats, fetchSettingsAggregates, fetchPriceLevelStats, fetchCommentLikeStats, fetchCommentStats, fetchPerfMetrics, fetchStorageStats
├── types/
│   ├── index.ts                     # Business, Rating, Comment, CommentLike, CustomTag, UserTag, Favorite, Feedback, FeedbackStatus, FeedbackCategory, MenuPhoto, MenuPhotoStatus, PriceLevel, NotificationType (incl. feedback_response, comment_reply), UserSettings (incl. notifyFeedback, notifyReplies) + re-exports PREDEFINED_TAGS, PRICE_LEVEL_LABELS, CATEGORY_LABELS from constants
│   ├── admin.ts                     # AdminCounters (incl. commentLikes), DailyMetrics (extends PublicMetrics), AbuseLog, AuthStats, NotificationStats, SettingsAggregates, PriceLevelStats, CommentLikeStats
│   ├── metrics.ts                   # PublicMetrics, TopTagEntry, TopBusinessEntry, TopRatedEntry
│   └── perfMetrics.ts               # PerfVitals, QueryTiming, DeviceInfo, PerfMetricsDoc
├── theme/
│   └── index.ts                     # MUI theme with getDesignTokens(mode) for light/dark
├── data/
│   └── businesses.json              # 40 comercios
├── hooks/
│   ├── useAsyncData.ts              # Hook generico para fetch async con loading/error states
│   ├── useBusinesses.ts             # Filtra businesses por searchQuery + activeFilters
│   ├── useBusinessData.ts           # Orquesta 7 queries del business view con Promise.all + cache + patchedRef race condition fix
│   ├── useBusinessDataCache.ts      # Cache client-side para datos del business view (5 min TTL) + patchBusinessCache
│   ├── useColorMode.ts              # Hook for dark/light mode toggle (consumes ColorModeContext)
│   ├── useListFilters.ts            # Filtrado generico: busqueda (debounced), categoria, estrellas, ordenamiento
│   ├── usePaginatedQuery.ts         # Paginacion generica con cursores Firestore + cache primera pagina (2 min TTL) + loadAll + QueryConstraint[]
│   ├── useUndoDelete.ts            # Hook para undo-delete con timer cleanup, Map de pending deletes, snackbar props
│   ├── useSwipeActions.ts          # Hook para swipe-to-reveal en mobile (touch events, threshold 80px)
│   ├── usePriceLevelFilter.ts       # Cache global de promedios de precio para filtro de mapa (limit 20K + TTL 5min)
│   ├── useNotifications.ts          # Hook para notificaciones in-app con polling visibility-aware
│   ├── useProfileVisibility.ts      # Hook para visibilidad de perfil publico (cache TTL 60s)
│   ├── useVisitHistory.ts           # Historial de visitas en localStorage (ultimos 20)
│   ├── useUserLocation.ts           # Geolocalizacion del navegador
│   ├── usePublicMetrics.ts          # Hook para metricas publicas de dailyMetrics
│   ├── useUserProfile.ts           # Hook para perfil publico de usuario (stats + ranking)
│   ├── useSuggestions.ts           # Hook para sugerencias personalizadas (scoring client-side)
│   ├── useOnboardingHint.ts        # Logica de display del hint de onboarding (extraida de AppShell)
│   ├── useOnboardingFlow.ts        # Manejo de pasos del flujo de onboarding (extraida de AppShell)
│   ├── useSurpriseMe.ts            # Logica de seleccion aleatoria de comercio "sorprendeme" (extraida de SideMenu)
│   └── useVerificationBadges.ts    # Badges de verificacion: Local Guide, Visitante Verificado, Opinion Confiable (cache 24h)
├── utils/
│   ├── businessHelpers.ts           # getBusinessName, getTagLabel (compartidos)
│   ├── formatDate.ts                # toDate, formatDateShort, formatDateMedium, formatRelativeTime, formatDateFull (compartidos)
│   ├── text.ts                     # truncate (compartido entre CommentsList y UserProfileSheet)
│   ├── perfMetrics.ts               # initPerfMetrics, measureAsync — Web Vitals + query timing capture (prod only)
│   └── perfMetrics.test.ts          # Tests unitarios para calculatePercentile, getDeviceInfo
├── pages/
│   ├── AdminDashboard.tsx           # Entry point admin (AdminGuard + AdminLayout)
│   ├── ThemePlayground.tsx          # Dev-only color playground with palette generator + output
│   ├── ConstantsDashboard.tsx       # Dev-only constants browser with search, filter, copy import
│   └── constantsRegistry.ts        # Auto-discovers all constants modules via Object.entries
├── components/
│   ├── admin/
│   │   ├── AdminGuard.tsx           # Google Sign-In + verificacion email + dev auto-login in emulator
│   │   ├── AdminLayout.tsx          # AppBar + Tabs (10 secciones)
│   │   ├── AdminPanelWrapper.tsx    # Wrapper compartido loading/error/empty para paneles admin
│   │   ├── DashboardOverview.tsx    # StatCards (incl. Likes) + PieCharts + TopLists + Custom Tags ranking + "Salud de comentarios" section
│   │   ├── ActivityFeed.tsx         # Tabs por coleccion (ultimos 20 items). Comments: Likes, Resp. columns + editado/Respuesta chips
│   │   ├── FeedbackList.tsx         # Tabla de feedback: status filters, respond/resolve/create-issue actions, GitHub issue link
│   │   ├── TrendsPanel.tsx          # Graficos evolucion + selector dia/semana/mes/ano + commentLikes line
│   │   ├── UsersPanel.tsx           # Rankings por usuario (comments, ratings, favs, tags, feedback, likesGiven) + "Mas likes dados" TopList
│   │   ├── FirebaseUsage.tsx        # LineCharts + PieCharts + barras de cuota
│   │   ├── AbuseAlerts.tsx          # Tabla de abuse logs (orquestador, helpers en alerts/)
│   │   ├── alerts/
│   │   │   ├── alertsHelpers.ts    # Tipos, constantes, computeKpis, exportToCsv, getDateThreshold
│   │   │   └── KpiCard.tsx         # Card resumen KPI reutilizable
│   │   ├── BackupsPanel.tsx         # Gestion de backups Firestore (orquestacion)
│   │   ├── BackupTable.tsx          # Tabla de backups (memoizada con React.memo)
│   │   ├── BackupConfirmDialog.tsx  # Dialog de confirmacion restore/delete (memoizado)
│   │   ├── FeaturesPanel.tsx        # Panel admin: métricas por funcionalidad, adopción, gráficos 30 días
│   │   ├── PerformancePanel.tsx     # Panel admin: orquestador (importa subcomponentes de perf/)
│   │   ├── perf/
│   │   │   ├── perfHelpers.ts       # Tipos, agregación, filtros, formateo de vitals
│   │   │   ├── SemaphoreCard.tsx    # Card con semáforo verde/amarillo/rojo
│   │   │   ├── QueryLatencyTable.tsx # Tabla p50/p95 de queries
│   │   │   ├── FunctionTimingTable.tsx # Tabla p50/p95 de Cloud Functions
│   │   │   └── StorageCard.tsx      # Card de uso de Firebase Storage
│   │   ├── PhotoReviewPanel.tsx     # Panel admin: filtro por status, lista de fotos
│   │   ├── PhotoReviewCard.tsx      # Card individual: approve/reject/delete + revert actions + report count
│   │   ├── backupTypes.ts           # Tipos: BackupEntry, ConfirmAction
│   │   ├── backupUtils.ts           # formatBackupDate, extractErrorMessage, mapErrorToUserMessage
│   │   ├── StatCard.tsx             # Card con numero grande
│   │   ├── ActivityTable.tsx        # Tabla generica
│   │   └── charts/
│   │       └── LineChartCard.tsx    # Wrapper recharts line (click legend toggle)
│   ├── stats/                       # Componentes compartidos de estadisticas
│   │   ├── PieChartCard.tsx         # Wrapper recharts pie (compartido admin + publico)
│   │   ├── TopList.tsx              # Tabla con barras de progreso, auto-sort descendente
│   │   └── index.ts                 # Barrel export
│   ├── auth/
│   │   └── NameDialog.tsx
│   ├── layout/
│   │   ├── TabShell.tsx              # Shell principal: 5 tabs + TabBar + deep links
│   │   ├── TabBar.tsx               # BottomNavigation con 5 tabs, boton central elevado
│   │   ├── ErrorBoundary.tsx
│   │   └── MapAppShell.tsx           # Provider tree: Selection + Tab + Onboarding → TabShell
│   ├── map/
│   │   ├── MapView.tsx
│   │   ├── BusinessMarker.tsx
│   │   └── LocationFAB.tsx
│   ├── search/
│   │   ├── SearchBar.tsx
│   │   └── FilterChips.tsx
│   ├── business/
│   │   ├── BusinessSheet.tsx        # Bottom sheet — orquesta useBusinessData + pasa props
│   │   ├── BusinessHeader.tsx       # Nombre, categoria, direccion, telefono, favorito (prop), direcciones
│   │   ├── BusinessRating.tsx       # Rating promedio + estrellas del usuario (props-driven)
│   │   ├── BusinessTags.tsx         # Tags predefinidos (voto) + custom tags (orquestacion, props-driven)
│   │   ├── CustomTagDialog.tsx      # Dialog crear/editar custom tag (memoizado)
│   │   ├── DeleteTagDialog.tsx      # Dialog confirmacion eliminacion tag (memoizado)
│   │   ├── BusinessComments.tsx     # Comentarios + formulario + editar + undo delete + likes + sorting (props-driven)
│   │   ├── CommentInput.tsx        # Formulario de nuevo comentario (memo). Rate limit precheck, contador diario
│   │   ├── CommentRow.tsx          # Fila individual de comentario (memo). Extraido de BusinessComments
│   │   ├── BusinessPriceLevel.tsx   # Nivel de gasto $/$$/$$$ con optimistic UI (pendingLevel + key remount)
│   │   ├── MenuPhotoSection.tsx     # Foto de menu: preview, staleness chip, upload/viewer toggle
│   │   ├── MenuPhotoUpload.tsx      # Dialog upload con preview, progress, AbortController cancel
│   │   ├── MenuPhotoViewer.tsx      # Dialog fullscreen foto + report button
│   │   ├── FavoriteButton.tsx       # Corazon toggle (props-driven)
│   │   ├── ShareButton.tsx          # Compartir comercio (Web Share API + clipboard fallback)
│   │   └── DirectionsButton.tsx     # Abre Google Maps Directions
│   ├── user/
│   │   ├── UserProfileSheet.tsx     # Bottom sheet perfil publico: stats, ranking badge, comentarios recientes
│   │   └── UserStatsRow.tsx         # Fila individual de stats (icono + label + count)
│   ├── ui/
│   │   ├── OfflineIndicator.tsx     # Chip MUI offline (PWA)
│   │   └── OfflineIndicator.test.tsx
│   ├── common/
│   │   ├── PaginatedListShell.tsx   # Shell reutilizable: skeleton/error/empty/no-results/pagination
│   │   ├── ListFilters.tsx          # Filtros compartidos entre listas
│   │   └── PullToRefreshWrapper.tsx # Wrapper pull-to-refresh
│   ├── home/
│   │   ├── HomeScreen.tsx           # Pantalla principal: mapa, specials, trending, sugerencias
│   │   ├── TrendingList.tsx         # Lista de comercios trending
│   │   └── TrendingBusinessCard.tsx # Card individual trending
│   ├── social/
│   │   ├── SocialScreen.tsx         # Pantalla social: actividad, seguidos, recomendaciones, rankings
│   │   ├── ActivityFeedView.tsx     # Feed de actividad de seguidos
│   │   ├── ActivityFeedItem.tsx     # Item individual del feed
│   │   ├── FollowedList.tsx         # Lista de usuarios seguidos
│   │   ├── ReceivedRecommendations.tsx # Recomendaciones recibidas
│   │   ├── RankingsView.tsx         # Rankings semanal/mensual con medallas
│   │   ├── RankingItem.tsx          # Fila individual del ranking
│   │   ├── RankingsEmptyState.tsx   # Estado vacio del ranking
│   │   ├── UserProfileModal.tsx     # Modal perfil de usuario
│   │   ├── UserScoreCard.tsx        # Card de puntaje del usuario
│   │   ├── BadgesList.tsx           # Lista de badges/medallas + verificacion
│   │   ├── VerificationBadge.tsx    # Badge de verificacion (compact/normal)
│   │   └── ScoreSparkline.tsx       # Mini grafico de puntaje
│   ├── profile/
│   │   ├── ProfileScreen.tsx        # Pantalla perfil: settings, stats, comments, ratings
│   │   ├── SettingsPanel.tsx        # Configuracion de usuario (apariencia, privacidad, notificaciones)
│   │   ├── AccountSection.tsx       # Seccion de cuenta (email, password)
│   │   ├── EditDisplayNameDialog.tsx # Dialog editar nombre de usuario
│   │   ├── LocalityPicker.tsx       # Selector de localidad
│   │   ├── OnboardingChecklist.tsx  # Checklist de onboarding
│   │   ├── PendingActionsSection.tsx # Acciones pendientes
│   │   ├── CommentsList.tsx         # Mis comentarios: orquestador (227 lineas)
│   │   ├── CommentsListItem.tsx     # Item individual de comentario (memo, 226 lineas)
│   │   ├── CommentsStats.tsx        # Estadisticas de comentarios
│   │   ├── CommentsToolbar.tsx      # Toolbar de filtros/sort para comentarios
│   │   ├── useCommentsListFilters.ts # Hook para filtros de CommentsList
│   │   ├── useVirtualizedList.ts    # Hook para virtualizacion condicional
│   │   ├── RatingsList.tsx          # Lista de ratings del usuario
│   │   ├── StatsView.tsx            # Vista publica de estadisticas
│   │   ├── FeedbackForm.tsx         # Tabs: Enviar + Mis envios
│   │   ├── MyFeedbackList.tsx       # Lista de feedback del usuario
│   │   ├── HelpSection.tsx          # 7 topics de ayuda en Accordion
│   │   └── PrivacyPolicy.tsx        # Politica de privacidad
│   └── lists/
│       ├── ListsScreen.tsx          # Pantalla listas: favoritos, compartidas, recientes, colaborativas
│       ├── FavoritesList.tsx         # Lista de favoritos
│       ├── SharedListsView.tsx      # Orquestador de listas compartidas
│       ├── ListDetailScreen.tsx     # Detalle de lista: toolbar (color, icon, visibilidad, editores), items
│       ├── CreateListDialog.tsx     # Dialog crear nueva lista (con icon picker)
│       ├── IconPicker.tsx           # Selector de icono para listas (30 opciones)
│       ├── ColorPicker.tsx          # Selector de color para listas (8 opciones)
│       ├── CollaborativeTab.tsx     # Tab de listas colaborativas
│       ├── EditorsDialog.tsx        # Dialog gestionar editores
│       └── InviteEditorDialog.tsx   # Dialog invitar editores
```

## Otros archivos clave

| Archivo | Descripcion |
|---------|-------------|
| `firestore.rules` | Reglas de seguridad: auth, ownership, admin (email check, tolerant to missing fields), timestamps server-side, isValidCriteria, replyCount rules (threads), priceLevels delete rule, feedback update rules (admin respond + user viewedByUser) |
| `storage.rules` | Reglas de Firebase Storage para fotos de menu + feedback media (10MB, image/*) |
| `firebase.json` | Config de hosting (CSP), functions, emuladores, reglas. Multi-site hosting (production + staging). Firestore config para `(default)` + `staging` named DB |
| `.firebaserc` | Proyecto: `modo-mapa-app`. Hosting targets: `production` → `modo-mapa-app`, `staging` → `modo-mapa-staging` |
| `vite.config.ts` | Plugin React + VitePWA + Sentry + `__APP_VERSION__` desde package.json |
| `src/config/sentry.ts` | Inicializacion condicional de Sentry (frontend, lazy-loaded via dynamic import) |
| `functions/src/admin/authStats.ts` | Cloud Function callable `getAuthStats`: consulta Firebase Auth para auth method breakdown y email verification stats |
| `functions/src/admin/storageStats.ts` | Cloud Function callable `getStorageStats`: calcula total bytes y fileCount en `menuPhotos/` de Cloud Storage |
| `functions/src/admin/perfMetrics.ts` | Cloud Function callable `writePerfMetrics` — escribe Web Vitals + query metrics via Admin SDK con rate limiting (5/dia por usuario) |
| `functions/src/utils/perfTracker.ts` | `trackFunctionTiming(name, startMs)` + `calculatePercentile` — acumula timings de Cloud Functions en `config/perfCounters` |
| `functions/src/__tests__/admin/authStats.test.ts` | Tests unitarios para `getAuthStats` |
| `functions/src/utils/sentry.ts` | Inicializacion + captureException de Sentry (Cloud Functions) |
| `firestore.indexes.json` | Indices compuestos Firestore (comments, ratings, favorites, feedback por userId+timestamp) |
| `.github/workflows/deploy.yml` | CI/CD: build + deploy Firestore rules/indexes + hosting en push a main |
| `.github/workflows/deploy-staging.yml` | CI/CD staging: lint + test + build (con `VITE_FIRESTORE_DATABASE_ID=staging`) + deploy `hosting:staging` en push a branch `staging` |
| `.github/workflows/preview.yml` | CI: lint + test + build + deploy preview channel en PRs |
| `PROCEDURES.md` | Flujo de desarrollo (PRD -> specs -> plan -> implementar) |
| `.env.example` | Template de variables de entorno |
| `functions/.env` | Variables de entorno de Cloud Functions (ADMIN_EMAIL) |
| `scripts/dev-env.sh` | Gestion de entorno dev: status, start, stop, restart, seed, health, logs. Self-contained PATH, robust health checks |
| `scripts/seed-admin-data.mjs` | Seed de datos de prueba para emuladores |
| `functions/seed-prod-ranking.mjs` | Script para computar y guardar ranking mensual en Firestore produccion |
| `docs/reference/coding-standards.md` | Estandares de codigo: service layer, patrones de componentes, convenciones TS |
| `docs/reference/security.md` | Seguridad unificada: App Check, Firestore rules, Cloud Functions, CSP, Storage, checklist |
| `docs/reference/tests.md` | Inventario de tests, política de cobertura (≥80%), patrones de mock, template para PRDs |
| `docs/INFORME_SEGURIDAD.md` | Informe de auditoria de seguridad |
| `docs/INFORME_MEJORAS_FUNCIONALES_v1.md` | Informe de mejoras funcionales con estado de implementacion |
| `docs/reports/security-audit-v1.4.md` | Auditoria de seguridad v1.4 |
| `docs/reports/architecture-audit-v1.4.md` | Auditoria de arquitectura v1.4 |
| `docs/reports/audit-phase4-v1.md` | Auditoria de seguridad y arquitectura post-phase4 (threads, criteria, suggestions) |
| `docs/reports/pre-launch-audit.md` | Auditoria pre-lanzamiento: seguridad, arquitectura, performance, tests, recomendaciones |
