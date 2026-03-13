# Estructura de archivos

## Frontend (`src/`)

```text
src/
├── App.tsx                          # Routing: /admin (lazy) vs /* (mapa)
├── main.tsx                         # Entry point (StrictMode)
├── index.css                        # Estilos globales minimos
├── config/
│   ├── firebase.ts                  # Init Firebase + emuladores en DEV + App Check (prod) + persistent cache (prod)
│   ├── collections.ts               # Nombres de colecciones Firestore centralizados (incl. COMMENT_LIKES)
│   ├── converters.ts                # FirestoreDataConverter<T> tipados por coleccion (incl. feedback, commentLike)
│   ├── adminConverters.ts           # Converters para AdminCounters, DailyMetrics, AbuseLog
│   └── metricsConverter.ts          # Converter para PublicMetrics (solo campos publicos)
├── constants/
│   ├── index.ts                    # Barrel re-export de todos los módulos + COLLECTIONS
│   ├── validation.ts               # MAX_COMMENT_LENGTH, MAX_DISPLAY_NAME_LENGTH, SCORE_OPTIONS, etc.
│   ├── cache.ts                    # BUSINESS_CACHE_TTL_MS, QUERY_CACHE_TTL_MS, PROFILE_CACHE_TTL_MS
│   ├── storage.ts                  # STORAGE_KEY_COLOR_MODE, STORAGE_KEY_VISITS, STORAGE_KEY_ANALYTICS_CONSENT
│   ├── timing.ts                   # POLL_INTERVAL_MS, AUTO_DISMISS_MS, SIX_MONTHS_MS
│   ├── feedback.ts                 # VALID_CATEGORIES
│   ├── ui.ts                       # CHART_COLORS, ADD_BUSINESS_URL
│   ├── map.ts                      # BUENOS_AIRES_CENTER, CATEGORY_COLORS
│   ├── tags.ts                     # PREDEFINED_TAGS, VALID_TAG_IDS
│   ├── rankings.ts                 # SCORING, MEDALS, ACTION_LABELS, PERIOD_OPTIONS
│   ├── business.ts                 # LEVELS, LEVEL_SYMBOLS, PRICE_CHIPS, PRICE_LEVEL_LABELS, CATEGORY_LABELS
│   ├── criteria.ts                 # RATING_CRITERIA (CriterionConfig[] con id y label para multi-criterio)
│   ├── suggestions.ts              # SUGGESTION_WEIGHTS, MAX_SUGGESTIONS, NEARBY_RADIUS_KM
│   └── admin.ts                    # ADMIN_EMAIL, ADMIN_PAGE_SIZE, STATUS_CHIP, STATUS_LABELS, ABUSE_TYPE_*
├── context/
│   ├── AuthContext.tsx               # Auth anonima + Google Sign-In + displayName
│   ├── ColorModeContext.tsx          # Dark/light mode provider + localStorage persistence
│   └── MapContext.tsx                # Estado del mapa (selected, search, filters)
├── services/
│   ├── index.ts                     # Barrel export de todas las operaciones CRUD
│   ├── favorites.ts                 # addFavorite, removeFavorite
│   ├── ratings.ts                   # upsertRating
│   ├── comments.ts                  # addComment, editComment, deleteComment, likeComment, unlikeComment
│   ├── tags.ts                      # addUserTag, removeUserTag, createCustomTag, updateCustomTag, deleteCustomTag
│   ├── feedback.ts                  # sendFeedback
│   ├── menuPhotos.ts                # uploadMenuPhoto (con AbortSignal), getUserPendingPhotos
│   ├── priceLevels.ts               # upsertPriceLevel, deletePriceLevel, getBusinessPriceLevels
│   ├── rankings.ts                  # fetchLatestRanking (ranking mensual/semanal)
│   ├── userProfile.ts               # fetchUserProfile (stats, comentarios, ranking position)
│   ├── suggestions.ts               # fetchUserSuggestionData (favorites, ratings, tags para sugerencias)
│   └── admin.ts                     # fetchCounters, fetchRecent*, fetchUsersPanelData, fetchDailyMetrics, fetchAbuseLogs, fetchAllPhotos
├── types/
│   ├── index.ts                     # Business, Rating, Comment, CommentLike, CustomTag, UserTag, Favorite, Feedback, MenuPhoto, MenuPhotoStatus, PriceLevel + re-exports PREDEFINED_TAGS, PRICE_LEVEL_LABELS, CATEGORY_LABELS from constants
│   ├── admin.ts                     # AdminCounters, DailyMetrics (extends PublicMetrics), AbuseLog
│   └── metrics.ts                   # PublicMetrics, TopTagEntry, TopBusinessEntry, TopRatedEntry
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
│   ├── usePaginatedQuery.ts         # Paginacion generica con cursores Firestore + cache primera pagina (2 min TTL)
│   ├── usePriceLevelFilter.ts       # Cache global de promedios de precio para filtro de mapa (limit 20K + TTL 5min)
│   ├── useNotifications.ts          # Hook para notificaciones in-app con polling visibility-aware
│   ├── useProfileVisibility.ts      # Hook para visibilidad de perfil publico (cache TTL 60s)
│   ├── useVisitHistory.ts           # Historial de visitas en localStorage (ultimos 20)
│   ├── useUserLocation.ts           # Geolocalizacion del navegador
│   ├── usePublicMetrics.ts          # Hook para metricas publicas de dailyMetrics
│   ├── useUserProfile.ts           # Hook para perfil publico de usuario (stats + ranking)
│   └── useSuggestions.ts           # Hook para sugerencias personalizadas (scoring client-side)
├── utils/
│   ├── businessHelpers.ts           # getBusinessName, getTagLabel (compartidos)
│   └── formatDate.ts                # toDate, formatDateShort, formatDateMedium, formatDateFull (compartidos)
├── pages/
│   ├── AdminDashboard.tsx           # Entry point admin (AdminGuard + AdminLayout)
│   ├── ThemePlayground.tsx          # Dev-only color playground with palette generator + output
│   ├── ConstantsDashboard.tsx       # Dev-only constants browser with search, filter, copy import
│   └── constantsRegistry.ts        # Auto-discovers all constants modules via Object.entries
├── components/
│   ├── admin/
│   │   ├── AdminGuard.tsx           # Google Sign-In + verificacion email
│   │   ├── AdminLayout.tsx          # AppBar + Tabs (9 secciones)
│   │   ├── AdminPanelWrapper.tsx    # Wrapper compartido loading/error/empty para paneles admin
│   │   ├── DashboardOverview.tsx    # StatCards + PieCharts + TopLists + Custom Tags ranking
│   │   ├── ActivityFeed.tsx         # Tabs por coleccion (ultimos 20 items)
│   │   ├── FeedbackList.tsx         # Tabla de feedback con categoria y flagged
│   │   ├── TrendsPanel.tsx          # Graficos evolucion + selector dia/semana/mes/ano
│   │   ├── UsersPanel.tsx           # Rankings por usuario (comments, ratings, favs, tags, feedback)
│   │   ├── FirebaseUsage.tsx        # LineCharts + PieCharts + barras de cuota
│   │   ├── AbuseAlerts.tsx          # Tabla de abuse logs
│   │   ├── BackupsPanel.tsx         # Gestion de backups Firestore (orquestacion)
│   │   ├── BackupTable.tsx          # Tabla de backups (memoizada con React.memo)
│   │   ├── BackupConfirmDialog.tsx  # Dialog de confirmacion restore/delete (memoizado)
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
│   │   ├── AppShell.tsx
│   │   ├── ErrorBoundary.tsx
│   │   └── SideMenu.tsx
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
│   └── menu/
│       ├── FavoritesList.tsx
│       ├── CommentsList.tsx
│       ├── RatingsList.tsx
│       ├── RecentVisits.tsx         # Lista de comercios visitados recientemente (localStorage)
│       ├── SuggestionsView.tsx       # Sugerencias personalizadas (useSuggestions)
│       ├── FeedbackForm.tsx
│       ├── StatsView.tsx            # Vista publica de estadisticas (usePublicMetrics)
│       ├── RankingsView.tsx         # Rankings semanal/mensual con medallas
│       ├── SettingsPanel.tsx        # Configuracion de usuario (privacidad, notificaciones)
│       ├── PrivacyPolicy.tsx        # Politica de privacidad
│       └── ListFilters.tsx
```

## Otros archivos clave

| Archivo | Descripcion |
|---------|-------------|
| `firestore.rules` | Reglas de seguridad: auth, ownership, admin (email check), timestamps server-side, isValidCriteria, replyCount rules (threads), priceLevels delete rule |
| `storage.rules` | Reglas de Firebase Storage para fotos de menu |
| `firebase.json` | Config de hosting (CSP), functions, emuladores, reglas |
| `.firebaserc` | Proyecto: `modo-mapa-app` |
| `vite.config.ts` | Plugin React + VitePWA + Sentry + `__APP_VERSION__` desde package.json |
| `src/config/sentry.ts` | Inicializacion condicional de Sentry (frontend, lazy-loaded via dynamic import) |
| `functions/src/utils/sentry.ts` | Inicializacion + captureException de Sentry (Cloud Functions) |
| `firestore.indexes.json` | Indices compuestos Firestore (comments, ratings, favorites por userId+timestamp) |
| `.github/workflows/deploy.yml` | CI/CD: build + deploy Firestore rules/indexes + hosting en push a main |
| `.github/workflows/preview.yml` | CI: lint + test + build + deploy preview channel en PRs |
| `PROCEDURES.md` | Flujo de desarrollo (PRD -> specs -> plan -> implementar) |
| `.env.example` | Template de variables de entorno |
| `functions/.env` | Variables de entorno de Cloud Functions (ADMIN_EMAIL) |
| `scripts/dev-env.sh` | Gestion de entorno dev: status, start, stop, restart, seed, health, logs |
| `scripts/seed-admin-data.mjs` | Seed de datos de prueba para emuladores |
| `functions/seed-prod-ranking.mjs` | Script para computar y guardar ranking mensual en Firestore produccion |
| `docs/CODING_STANDARDS.md` | Estandares de codigo: service layer, patrones de componentes, convenciones TS |
| `docs/SECURITY_GUIDELINES.md` | Guia de seguridad: App Check, timestamps, converters, patrones |
| `docs/INFORME_SEGURIDAD.md` | Informe de auditoria de seguridad |
| `docs/INFORME_MEJORAS_FUNCIONALES_v1.md` | Informe de mejoras funcionales con estado de implementacion |
| `docs/reports/security-audit-v1.4.md` | Auditoria de seguridad v1.4 |
| `docs/reports/architecture-audit-v1.4.md` | Auditoria de arquitectura v1.4 |
| `docs/reports/audit-phase4-v1.md` | Auditoria de seguridad y arquitectura post-phase4 (threads, criteria, suggestions) |
| `docs/reports/pre-launch-audit.md` | Auditoria pre-lanzamiento: seguridad, arquitectura, performance, tests, recomendaciones |
