# Modo Mapa — Referencia del proyecto

**Version:** 2.31.0
**Repo:** <https://github.com/benoffi7/modo-mapa>
**Produccion:** <https://modo-mapa-app.web.app>
**Ultima actualizacion:** 2026-03-29

---

## Descripcion

App web mobile-first para empleados que necesitan encontrar comercios gastronomicos cercanos en un mapa interactivo. Los usuarios pueden buscar, filtrar, calificar, comentar, marcar favoritos, etiquetar comercios, subir fotos de menu y votar niveles de gasto. Localizada en espanol (es-AR), orientada a Buenos Aires.

---

## Stack tecnologico

| Capa | Tecnologia | Version |
|------|-----------|---------|
| Framework | React | 19.2 |
| Bundler | Vite | 7.3 |
| Lenguaje | TypeScript | 5.9 (strict) |
| UI | Material UI (MUI) | 7.3 |
| Mapa | @vis.gl/react-google-maps | 1.7 |
| Graficos | recharts | 3.8 |
| Auth | Firebase Anonymous Auth + Email/Password + Google Sign-In (admin) | 12.10 |
| Base de datos | Cloud Firestore | 12.10 |
| Storage | Firebase Storage | 12.10 |
| Cloud Functions | Firebase Functions v2 | 6.3 |
| Hosting | Firebase Hosting | — |
| Routing | react-router-dom | 7.x |
| Error tracking | @sentry/react + @sentry/node | latest |
| Analytics | Firebase Analytics (GA4) | 12.10 |
| PWA | vite-plugin-pwa (Workbox) | 1.2 |
| CI/CD | GitHub Actions | — |

---

## Documentacion detallada

Cada seccion esta en un archivo separado en [`docs/reference/`](reference/):

| Archivo | Contenido |
|---------|-----------|
| [architecture.md](architecture.md) | Arbol de componentes, capas, Cloud Functions structure, flujo de datos, tema visual |
| [files.md](files.md) | Estructura completa de archivos (`src/`, `functions/`, config, scripts) |
| [data-layer.md](data-layer.md) | Service layer, hooks compartidos, utilidades, AdminPanelWrapper, filtros |
| [firestore.md](firestore.md) | Colecciones, tipos TypeScript, converters, Cloud Storage (fotos + backups) |
| [security.md](security.md) | Seguridad unificada: App Check, Firestore rules, Cloud Functions, CSP, Storage rules, checklist por commit |
| [features.md](features.md) | Funcionalidades: mapa, business sheet, menu lateral, admin dashboard, Cloud Functions (callable + triggers + scheduled) |
| [patterns.md](patterns.md) | Patrones y convenciones: auth, datos, cache, UI, uploads, server-side, TypeScript, dark mode |
| [coding-standards.md](coding-standards.md) | Arquitectura, convenciones TypeScript, naming, SOLID, patrones de componentes |
| [tests.md](tests.md) | Inventario de tests, política de cobertura (≥80%), patrones de mock, template para PRDs |
| [devops.md](devops.md) | Variables de entorno, scripts npm, dev-env.sh, CI/CD, IAM roles, flujo de feature, versionado |
| [issues.md](issues.md) | Issues resueltos (tabla completa), documentacion por feature (carpetas `docs/`) |

---

## Resumen rapido

### Funcionalidades clave

- **Mapa**: Google Maps con 40 marcadores, busqueda, filtros por tags y precio
- **Business Sheet**: rating (global + multi-criterio), tags (predefinidos + custom), comentarios (editar/likes/sorting/threads), nivel de gasto ($/$$/$$), foto de menu (upload/report), compartir (deep link)
- **Menu lateral**: recientes (localStorage), **seguidos** (lista + busqueda de usuarios), **actividad** (feed de seguidos), sugeridos para vos (con distancia al usuario), **sorpréndeme** (random cercano), **mis listas** (compartidas, deep link, público/privado), favoritos (con distancia, pull-to-refresh), comentarios (busqueda, sorting, filtro por comercio, edit inline, stats, swipe actions, skeleton loader, preview enriquecido, pull-to-refresh, rate limit precheck), calificaciones (pull-to-refresh), rankings (pull-to-refresh), feedback (enviar + mis envios), ayuda, estadisticas. Onboarding gamificado (checklist 5 tareas). Toast global de exito/error. Todas las secciones lazy-loaded via `React.lazy()`
- **Notificaciones**: campana con badge, drawer, polling 60s (visibility-aware), triggers automaticos (likes, fotos, rankings, respuestas a feedback, nuevos seguidores, recomendaciones)
- **Perfil publico**: click en nombre de usuario → drawer con stats, ranking badge (top 3) y comentarios recientes
- **Autenticacion**: anonima por defecto + email/password opcional (linkWithCredential preserva UID). Registro, login cross-device, verificacion email, recuperacion contrasena, cambio contrasena, logout, **eliminacion de cuenta** (#192, permanente con re-auth, Cloud Function `deleteUserAccount` borra 19 colecciones). "Empezar de cero" para anonimos. UI en SideMenu (badge + botones) y SettingsPanel (seccion Cuenta)
- **Configuracion de usuario**: panel lateral con seccion Cuenta (auth, eliminar cuenta), perfil publico/privado, notificaciones (master + granulares incl. nuevos seguidores y recomendaciones), datos de uso (analytics)
- **Analytics**: Firebase Analytics (GA4) con eventos de negocio (business_view, rating_submit, etc.) — solo en produccion, lazy-loaded
- **Admin** (`/admin`): 11 tabs — overview, actividad, feedback (con responder/resolver/crear issue GitHub), tendencias, usuarios, Firebase usage, alertas (con revisar/descartar, filtro por estado, badge reincidente), backups, fotos, performance (descompuesto en subcomponentes), **features** (métricas por funcionalidad con gráficos 30 días)
- **Seguir usuarios** (#129): seguir a otros usuarios, feed de actividad de seguidos (ratings, comentarios, favoritos), busqueda de usuarios por nombre, FollowButton en perfil, secciones Seguidos y Actividad en SideMenu, notificacion `new_follower`, configuracion `notifyFollowers`
- **Recomendaciones** (#135): recomendar comercios a otros usuarios con mensaje opcional (max 200 chars). Rate limit 20/dia. Lista de recibidas con badge de no leidas. Notificacion `recommendation`. Soporte offline. Configuracion `notifyRecommendations`
- **Cloud Functions**: 14 callable + 17 triggers + 6 scheduled
- **Seguridad**: App Check, Firestore rules (`keys().hasOnly()` + `affectedKeys()` en todas las colecciones), rate limiting server-side (4 colecciones + `_rateLimits` in COLLECTIONS #193), moderacion, CSP, replyCount/likeCount server-only via Cloud Functions, cascade deletes, userId inmutabilidad, Storage rules para fotos de menu y feedback media. 3 rondas de auditoría completadas (0 vulnerabilidades restantes).

### Patrones clave

- **Constantes centralizadas**: `src/constants/` con 15 modulos por dominio (incl. criteria, suggestions, feedback statuses, auth), barrel re-export, sin magic numbers
- **Constants Dashboard**: `/dev/constants` (DEV only) — browser, busqueda, filtro, edicion inline con validacion, color swatches, copy nombre/valor, duplicados
- **Service layer**: componentes → `src/services/` → Firestore SDK (nunca directo)
- **Cache**: business data cache (5 min TTL) + paginated query cache (2 min TTL) + persistent cache (prod)
- **Race condition fix**: `patchedRef` en `useBusinessData` previene sobreescritura de refetches parciales
- **Optimistic UI**: pendingRating, pendingLevel, optimistic comments/likes, FavoriteButton derived state
- **Toast global**: `ToastContext` + `useToast()` hook (success/error/warning/info, 4s auto-dismiss)
- **Pull-to-refresh**: `usePullToRefresh` hook + `PullToRefreshWrapper` en todas las listas
- **Distance utils**: `src/utils/distance.ts` — Haversine + formatDistance, usado en sugerencias y favoritos
- **`key={id}` remount**: evita useEffect/refs para reset de estado, compatible con strict lint
- **`enforceAppCheck: !IS_EMULATOR`**: App Check solo en prod, deshabilitado en emuladores
- **Lazy Sentry**: `@sentry/react` cargado via dynamic `import()` (no en main chunk)
- **Batched likes**: `fetchUserLikes` usa `documentId('in')` con batches de 30 (no N+1 getDoc)
- **Price level cache**: `usePriceLevelFilter` con `limit(20K)` safety bound + TTL 5min
- **`useUndoDelete`**: hook generico para undo-delete con Map de pending, timer cleanup en unmount, snackbar props
- **`PaginatedListShell`**: wrapper reutilizable para skeleton/error/empty/no-results/pagination en listas del menu
- **`useSwipeActions`**: swipe-to-reveal en mobile con touch events, threshold 80px, fallback accesible
- **`CommentRow` (memo)**: componente memoizado extraido de BusinessComments, `isEditing` precalculado
- **3-tier read cache**: memory → IndexedDB → Firestore en `useBusinessData`, con `StaleBanner` y incremental loading
- **`shared/` folder**: codigo compartido entre frontend y functions (ej: `shared/userOwnedCollections.ts` — fuente canonica, `functions/src/shared/` contiene copia para build)
- **Extracted hooks** (#195, updated #232): 4 hooks activos — `useCommentEdit`, `useVerificationCooldown`, `useCommentsListFilters`, `useVirtualizedList`. Nota: `useOptimisticLikes`, `useCommentSort`, `useCommentThreads` y `useQuestionThreads` eliminados en #232 (logica inlined en componentes consumidores)
- **Offline read caching** (#197): IndexedDB `readCache.ts` con LRU eviction (20 entries). 3-tier lookup en `useBusinessData`: memory → IndexedDB → Firestore. `StaleBanner` para datos stale. Incremental loading (`isLoadingComments`, `stale` fields)
- **Accesibilidad** (#196): `contrast.ts` (WCAG 2.0), `aria-live` en contadores dinamicos, `role=alertdialog` en dialogs destructivos, `PasswordField` con `helperText` nativo (auto `aria-describedby`)
- **Rating prompt** (#199): `useRatingPrompt` hook detecta check-ins recientes (2-8h) sin calificar. `RatingPromptBanner` en HomeScreen. 3/dia cap. 4 analytics events
- **Tests**: 108 test files (74 frontend + 34 backend) cubriendo utils, services, hooks, contexts, auth components (PasswordField, PasswordStrength, validatePassword), onboarding, follows, activity feed, triggers, aggregates, helpers, readCache, contrast, useRatingPrompt, useCommentEdit, useVerificationCooldown, sharedLists, 34 Cloud Functions test files. Politica: >=80% cobertura para features nuevas. Ver [tests.md](tests.md)
