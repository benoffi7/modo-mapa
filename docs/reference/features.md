# Funcionalidades actuales

## Mapa

- Google Maps centrado en Buenos Aires (-34.6037, -58.3816)
- 40 marcadores con color por categoria
- Click en marker abre bottom sheet con detalle
- Geolocalizacion del usuario (FAB)
- Busqueda por nombre/direccion/categoria
- Filtro por tags predefinidos (chips)
- Filtro por nivel de gasto ($/$$/$$) con chips toggle
- **Accesibilidad teclado**: markers focuseables con Tab (`tabIndex={0}`, `role="button"`), Enter/Space abre BusinessSheet, `aria-label` con nombre y rating, focus outline azul via `:focus-visible`
- **Sugerencias contextuales**: hint "Tocá un comercio para calificarlo" para usuarios nuevos (aparece después de 4h si no calificaron). Toast post-primer-rating ("dejá un comentario") y post-primer-comentario ("guardá favoritos"). Basado en localStorage timestamps, sin queries a Firestore
- **Onboarding de cuenta** (#157): nudges para conversion anonimo → email. (S1) Banner en mapa "Creá tu cuenta para no perder tus datos" despues de primera interaccion, dismisseable. (S2) Pantalla de beneficios pre-registro (solo la primera vez). (S3) Recordatorio despues de 5 ratings como anonimo (solo si S1 fue dismisseado). Reactividad via custom event `anon-interaction`. 10 analytics events para tracking de conversion. Todos los componentes lazy-loaded
- **Skeleton loader**: overlay pulsante mientras cargan los tiles del mapa (dark mode aware)

---

## Comercio (BusinessSheet)

- **Layout**: sticky header + 2 tabs (Info / Opiniones). Header siempre visible sin scroll con nombre, categoria, trending badge, action buttons y rating compacto. Tabs sticky debajo del header. Contenido de tab inactivo oculto con `display: none` para preservar estado interno (scroll, threads expandidos). Analytics: `business_sheet_tab_changed`. Deep link: `?business={id}&sheetTab=info|opiniones`
- Nombre, categoria, direccion, telefono (link `tel:`)
- Boton favorito (toggle corazon). Optimistic UI con derived state pattern. Toast de exito/error via `useToast()`. Color theme-aware (`error.main`)
- Boton check-in y boton direcciones en la misma fila (50/50 en mobile, centrado en desktop)
- Boton direcciones (abre Google Maps)
- Boton recomendar (abre `RecommendDialog` para enviar recomendacion a otro usuario). Solo visible para usuarios autenticados no anonimos. Lazy-loaded con Suspense
- Boton compartir (Web Share API con fallback a clipboard). Deep link via `?business={id}`
- **Rating**: promedio + estrellas del usuario (1-5) en header. Logica extraida a `useBusinessRating` hook. Optimistic UI con `pendingRating`. Boton X para borrar calificacion. Multi-criterio expandible en tab Info via `CriteriaSection` (comida, atencion, precio, ambiente, rapidez) con promedios por criterio. Criterios definidos en `constants/criteria.ts` (`RATING_CRITERIA`). Seccion multi-criterio deshabilitada hasta que el usuario tenga un rating global. Campo `criteria?: RatingCriteria` en tipo `Rating`. Toast de error via `useToast()` si falla la operacion
- **Tags predefinidos**: vote count + toggle del usuario. Chips con `borderRadius: 1` (design system)
- **Tags custom**: crear, editar, eliminar (privados por usuario). Chips con `borderRadius: 1`
- **Detalle por criterio**: chip expandible con `borderRadius: 1` (design system)
- **Comentarios y Preguntas** (tab Opiniones): sub-tabs "Comentarios" / "Preguntas" dentro del tab Opiniones. Logica compartida extraida a `useCommentListBase` hook. Tab Comentarios: lista + formulario + editar propios + undo delete (5s, multiples pendientes simultaneas) + likes (otros, logica optimistica inlined en componentes) + sorting (Recientes/Antiguos/Utiles, logica inlined en componentes). Flaggeados ocultos. Indicador "(editado)". Threads: responder a comentarios (1 nivel), colapsables con "Ver N respuestas" (logica inlined en componentes). Edicion via `useCommentEdit` hook. `replyCount` gestionado exclusivamente por Cloud Functions (increment en create, decrement con floor en 0 en delete). Cascade delete de replies huerfanas en `onCommentDeleted`. Campos thread: `parentId` (opcional), `replyCount` (opcional, solo en root, server-managed). **Rate limit precheck**: si el usuario alcanzo 20 comentarios/dia, el input se reemplaza por Alert informativo. Contador "X/20 comentarios hoy" en helperText con `aria-live="polite"` (solo si >0). Warning visual cuando quedan <=3. Toast de exito/error en submit/edit/reply via `useToast()`. **Tab Preguntas** (#127): seccion Q&A que reutiliza infraestructura de comentarios con campo `type: 'question'`. Formulario de pregunta integrado en componente (nota: `QuestionInput` y `useQuestionThreads` eliminados como archivos independientes en #232, logica inlined). Crear preguntas, responder preguntas de otros. Respuestas ordenadas por likes (mejor respuesta primero). Badge "Mejor respuesta" si likeCount >= 1 y es la mas votada. Rate limit compartido con comentarios (20/dia). Analytics: `question_created`, `question_answered`, `question_viewed`. En el menu lateral, las preguntas muestran badge "Pregunta" en la seccion Comentarios
- **Nivel de gasto**: $/$$/$$$ con votos y promedio. Optimistic UI con `pendingLevel`. Toggle: click en el mismo nivel remueve el voto (`deletePriceLevel`). Reset via `key={businessId}` en parent para forzar remount
- **Foto de menu**: preview con thumbnail, staleness chip si >6 meses. Upload con compresion + progress + cancel (AbortController). Viewer fullscreen con boton reportar. Overlay camera icon para subir nueva foto (reemplaza boton separado)
- Datos cargados en paralelo (`Promise.all`, 7 queries) con cache de 3 niveles: memory (5 min TTL) → IndexedDB (`readCache.ts`, LRU 20 entries) → Firestore. `isLoadingComments` y `stale` fields permiten render incremental de secciones. `StaleBanner` muestra aviso cuando los datos vienen de cache offline
- Race condition fix con `patchedRef` para evitar que full loads sobreescriban refetches parciales
- Escrituras via service layer (`src/services/`)
- Visita registrada automaticamente en localStorage al abrir
- **Skeleton loader**: mientras carga datos muestra skeleton gris que replica el layout del sheet (nombre, categoria, rating, tags, foto, comentarios). Fade-in de 200ms al cargar contenido
- **Drag handle**: barra visible (48x5px, `text.secondary`), chevron animado con `pulseUp`, tooltip "Arrastrá hacia arriba" la primera vez (localStorage). Click en desktop cierra el sheet. Respeta `prefers-reduced-motion`
- **Confirmación al salir**: si hay texto sin guardar en comentarios o feedback, dialog "Descartar cambios?" antes de cerrar. Hook reutilizable `useUnsavedChanges` + `DiscardDialog`

---

## Menu lateral (SideMenu)

- Header con avatar (seleccion de avatar persiste en Firestore `users/{uid}.avatarId`), nombre, boton editar nombre, badge tipo de cuenta (temporal/email+verificado), botones "Crear cuenta" / "Ya tengo cuenta" (solo anonimos). Badge en icono de Comentarios con cantidad de respuestas no leidas (unread `comment_reply` count). **Onboarding gamificado**: card "Primeros pasos" con 5 tareas (calificar, comentar, favoritear, agregar tag, explorar ranking). Progress bar, checks verdes al completar. Colapsable con click en header (estado persiste en localStorage). Refetch del perfil en cada apertura del menu. Dismiss permanente via localStorage. Toast de celebracion al completar todas. Solo para usuarios autenticados (no anonimos). **Nudge de verificacion** (#157): card para usuarios con email no verificado con botones "Re-enviar email" y "Ya verifique". Dismisseable por sesion, reaparece en sesiones futuras si no verifico
- **Swipe**: `SwipeableDrawer` permite cerrar con swipe izquierdo y abrir desde el borde izquierdo (swipeAreaWidth=20px, optimizaciones iOS)
- Todas las secciones lazy-loaded via `React.lazy()` + `Suspense` con spinner fallback (reduce main chunk ~25%)
- Secciones:
  - **Mis visitas (Check-in)**: historial de check-ins explicitos del usuario. Boton "Hacer check-in" en BusinessSheet registra visita con timestamp y ubicacion opcional. Cooldown de 4h por comercio. Limite diario de 10 check-ins (Cloud Function rate limit). Validacion soft de proximidad (500m, advierte pero no bloquea). Desmarcar check-in tocando el boton de nuevo. Lista cronologica con fecha relativa, click navega al comercio. Stats: total visitas y comercios unicos. Pull-to-refresh. Lazy-loaded en SideMenu
  - **Seguidos** (#129): lista de usuarios seguidos con busqueda de usuarios (debounce 300ms, prefijo `displayNameLower`). Click abre perfil publico. Pull-to-refresh. Lazy-loaded. Ver seccion "Seguir usuarios"
  - **Actividad** (#129): feed de actividad de usuarios seguidos (ratings, comentarios, favoritos). Paginado, pull-to-refresh. Items expiran a 30 dias. Ver seccion "Seguir usuarios"
  - **Recomendaciones** (#135): lista de recomendaciones recibidas de otros usuarios. Items muestran avatar, nombre del remitente, comercio recomendado, mensaje y fecha relativa. Indicador visual de no leido (`action.hover`). Click navega al comercio y marca como leida. "Marcar todas como leidas" al abrir. Badge en SideMenuNav con conteo de no leidas. Empty state con icono y mensaje. Lazy-loaded. Ver seccion "Recomendaciones entre usuarios"
  - **Recientes**: ultimos 20 comercios visitados (localStorage). Click navega al comercio en el mapa
  - **Sugeridos para vos**: 2 tabs — "Para vos" (sugerencias personalizadas) y "Tendencia" (trending). Tab "Para vos": sugerencias via `useSuggestions` hook + `services/suggestions.ts`. Fetch de favoritos, ratings y tags del usuario → scoring client-side (Haversine para cercania). Pesos en `constants/suggestions.ts` (`SUGGESTION_WEIGHTS`): categoria=3, tags=2, cercania=1, penalizacion por ya favorito=-5 o ya calificado=-3. Chips de razon (categoria, tags, cercania). Max 10 sugerencias. Distancia al usuario mostrada junto a la direccion ("a 300m", "a 1.2km") si la ubicacion esta disponible. Tab "Tendencia" (#140): top 10 comercios con mas actividad en ultimos 7 dias. Scoring ponderado: ratings*2 + comments*3 + userTags*1 + priceLevels*2 + listItems*1. Calculado diariamente por Cloud Function `computeTrendingBusinesses` (3 AM ART), escrito en `trendingBusinesses/current`. Cards con rank, nombre, categoria, score y breakdown de actividad. Badge "Tendencia" en BusinessHeader para comercios en la lista. Analytics: `trending_viewed`, `trending_business_clicked`. Componentes: `TrendingList.tsx`, `TrendingBusinessCard.tsx` (nota: `SuggestionsView.tsx` eliminado en #232, logica de sugerencias integrada en HomeScreen)
  - **Sorpréndeme**: boton que selecciona un comercio al azar no visitado. Prefiere cercanos (radio 5km) si GPS activo. Toast con nombre del comercio. Fallback a random si todos visitados
  - **Mis Listas**: listas compartidas con CRUD completo. Crear listas con nombre y descripcion. Agregar/quitar comercios desde BusinessSheet (BookmarkIcon). Toggle publico/privado por lista. Compartir link para listas publicas (`?list={id}`). Deep link abre la lista para otros usuarios autenticados. Max 10 listas por usuario, 50 items por lista. Pull-to-refresh. Solo para usuarios autenticados (no anonimos). **Color picker**: cada lista puede tener un color personalizado (guardado en Firestore, validado en rules whitelist `hasOnly`). **Icon picker** (#230): cada lista puede tener un icono (seleccionable desde 30 opciones en `constants/listIcons.ts`). Disponible en CreateListDialog y ListDetailScreen toolbar. Validado via `getListIconById()`. Analytics: `EVT_LIST_ICON_CHANGED`. Parametro `icon` en `createList`/`updateList` services. **ListCardGrid**: layout responsive con `auto-fill`, columnas minimas de 160px, cards cuadradas (`aspect-ratio: 1`), contenido centrado. Chip "Destacada" sigue design system (`borderRadius: 1`). **ListDetailScreen**: optimistic updates al volver atras (color, isPublic, itemCount), dialog de confirmacion para eliminar lista, toggle publico/privado con rollback on error, items de comercio usan `cardSx` unificado. `removeBusinessFromList` usa `listItem.id` (no `businessId`) para evitar corrupcion de datos. **Listas colaborativas** (#155, #229): invitar editores por email (max 5), ver/remover editores, editores pueden agregar/quitar comercios desde AddToListDialog. Seccion "Compartidas conmigo" con listas donde el usuario es editor. Badge "Colaborativa" e indicador "Agregado por" en items. CollaborativeTab incluye back handler para Android (hardware back button). Owner gestiona editores desde ListDetailScreen toolbar (EditorsDialog + InviteEditorDialog con Badge de count). Permisos diferenciados: `canEditConfig` (owner: color, visibilidad, eliminar, editores) vs `canEditItems` (owner + editor: agregar/quitar items). **Listas destacadas** (#156): seccion horizontal scrolleable con listas marcadas como destacadas por admin. Generacion automatica semanal (top 10 calificados, mas comentados, favoritos de la comunidad). **Mejoras de lista compartida** (#160): copiar lista ajena, agregar todos a favoritos en batch, favorito individual por comercio, navegacion persistente (volver a la lista al cerrar BusinessSheet)
  - **Favoritos**: lista con filtros (busqueda, categoria, orden). Quitar favorito inline. Click navega al comercio. Distancia al usuario junto a la direccion si la ubicacion esta disponible. Pull-to-refresh gesture
  - **Comentarios**: lista mejorada con skeleton loader, empty state motivacional, preview enriquecido (fecha relativa, indicador editado, likes, replies), busqueda de texto (con `useDeferredValue` + auto-load-all), ordenamiento (recientes/antiguos/mas likes via `ToggleButtonGroup`), filtro por comercio (Autocomplete), edicion inline, stats resumen colapsable (total, likes, promedio, mas popular), swipe actions en mobile (deslizar para editar/eliminar), undo delete con `useUndoDelete` hook. Envuelto en `PaginatedListShell` para loading/error/empty states consistentes. Pull-to-refresh gesture. Blue dot indicator en comentarios con respuestas no leidas; mark-as-read al hacer click. `CommentItem` extraido y memoizado (`React.memo`). Virtualizacion condicional via `useVirtualizedList` hook con `@tanstack/react-virtual` cuando hay >= 20 items. Filtros extraidos a `useCommentsListFilters` hook (#195)
  - **Calificaciones**: lista con estrellas y filtros (busqueda, categoria, estrellas minimas, orden). Click navega al comercio. Pull-to-refresh gesture
  - **Rankings**: ranking semanal/mensual/anual/historico (all-time) con scoring por actividad. Cards con medallas, barra de progreso y animaciones fade-in escalonadas. Indicador de tendencia (▲▼) vs periodo anterior. Sistema de tiers (Bronce/Plata/Oro/Diamante) con barra de progreso al siguiente nivel. Sistema de badges/logros (11 badges: primera reseña, comentarista, influencer, fotografo, critico, popular, todoterreno, podio, racha 7d, etc). Racha (streak) de dias consecutivos con actividad. Grafico sparkline de evolucion del score. Boton compartir (Web Share API / clipboard). Pull-to-refresh. Perfil publico al tocar un usuario (modal con desglose, badges y score). Filtro por zona (UI placeholder, proximamente). Card "Tu actividad" colapsable (2 lineas por defecto, expandible para desglose completo). Desglose con barras horizontales de colores por categoria. Live score fallback si no estas en ranking pre-computado
  - **Feedback**: formulario con 2 tabs (Enviar / Mis envios). Enviar: categoria (bug/sugerencia/datos_usuario/datos_comercio/otro) + mensaje (max 1000) + archivo adjunto opcional (max 10MB, JPG/PNG/WebP/PDF). Cuando categoria es `datos_comercio`, search bar opcional para vincular un comercio (Autocomplete con `allBusinesses`). PDF se muestra como icono + nombre (no preview embebido). Mis envios: `MyFeedbackList` muestra feedback del usuario con chips de status (pending/viewed/responded/resolved), respuestas del admin colapsables, indicador de nueva respuesta (dot verde), adjunto inline (imagen o link PDF). Al expandir un feedback respondido se marca como visto (`markFeedbackViewed`)
  - **Estadisticas**: distribucion de ratings (pie), tags mas usados (pie), top 10 favoriteados/comentados/calificados. Usa `usePublicMetrics` + componentes de `stats/`
  - **Configuracion**: seccion Cuenta (primera, extraida a `AccountSection` componente en #195): anonimos ven crear cuenta/login + "Empezar de cero", usuarios email ven email + badge verificacion + re-enviar verificacion (con cooldown via `useVerificationCooldown` hook) + cambiar contrasena + eliminar cuenta + cerrar sesion con confirmacion. **Ubicacion** (#154): campo opcional de localidad (ciudad/barrio) con Google Places Autocomplete, usado como ubicacion por defecto sin GPS. Fallback chain: GPS → localidad → oficina (via `useSortLocation` hook). Afecta mapa, sort por cercania, Sorprendeme y sugerencias. **Apariencia** (#231): toggle de dark mode ("Modo oscuro") con `useColorMode` hook, ubicado entre las secciones Ubicacion y Privacidad. Toggles de privacidad (perfil publico/privado), notificaciones (master + likes/fotos/rankings/feedback/replies/nuevos seguidores/recomendaciones), y datos de uso (analytics). Defaults todos en false excepto `notifyFollowers: true` y `notifyRecommendations: true`. Optimistic UI con revert on error
  - **Ayuda**: seccion colapsable con 14 topics en formato Accordion, agrupados por tab (Inicio, Buscar, Social, Listas, Perfil, Ajustes) con chips como separadores. Incluye items dedicados para check-in, listas colaborativas y modo oscuro. Lazy-loaded via `React.lazy()`. Componente: `HelpSection.tsx`
  - **Agregar comercio**: link externo a Google Forms
- Dark mode toggle con switch (persiste en localStorage, respeta `prefers-color-scheme`)
- Footer con version de la app (+ links a Theme Playground y Constants Dashboard en DEV)

---

## Notificaciones in-app

- Campana con badge (unread count) en la barra de busqueda
- Drawer con lista de notificaciones, tiempo relativo ("hace 2 min", "ayer")
- Marcar como leida individual o todas a la vez
- Click en notificacion navega al comercio relacionado
- Polling cada 300s (5 min) para unread count en modo `realtime` (con visibility awareness: se pausa cuando el tab esta oculto para ahorrar queries). Sin polling en modos `daily`/`weekly` (carga unica al abrir)
- **Digest frequency** (`notificationDigest`): preferencia del usuario en `userSettings`. Valores: `realtime` (default, polling 5min), `daily` (carga unica/dia), `weekly` (carga unica/semana). Selector con chips en SettingsPanel
- **ActivityDigestSection**: seccion en Home despues de ForYouSection. Muestra hasta 3 grupos de notificaciones no leidas agrupadas por tipo (ej: "3 respuestas a tus comentarios"). Estado vacio con CTA "Explorar negocios". Analytics: `digest_section_viewed`, `digest_item_tapped`, `digest_cta_tapped`, `digest_frequency_changed`
- **useNotificationDigest hook**: agrupa notificaciones no leidas por tipo, genera labels singular/plural, retorna max 3 grupos ordenados por fecha
- Tipos: `like`, `photo_approved`, `photo_rejected`, `ranking`, `feedback_response`, `comment_reply`, `new_follower`, `recommendation`
- Generadas automaticamente por Cloud Functions triggers
- `comment_reply`: notifica al autor del comentario padre cuando alguien responde. Generada por `onCommentCreated` cuando el comentario tiene `parentId`. Respeta setting `notifyReplies` del usuario destinatario. NotificationItem muestra `ReplyIcon` para este tipo
- `new_follower`: notifica cuando alguien empieza a seguirte. Generada por `onFollowCreated`. Respeta setting `notifyFollowers` del usuario destinatario. Incluye `actorId` y `actorName` del seguidor
- `recommendation`: notifica cuando alguien te recomienda un comercio. Generada por `onRecommendationCreated`. Respeta setting `notifyRecommendations` del usuario destinatario. Incluye `actorId`, `actorName` y `businessName`
- Expiran a los 30 dias (cleanup diario)
- `NotificationsContext` centralizado: instancia unica compartida por todos los consumidores (campana, badge SideMenu, etc.)

---

## Autenticacion por email/password (#80)

- **Cuenta anonima por defecto**: UID generado automaticamente al ingresar. Sin email ni contrasena
- **Registro (upgrade anonimo → email/password)**: `linkWithCredential(EmailAuthProvider)` preserva UID y todos los datos. Post-registro: `sendEmailVerification()` automatico
- **Login cross-device**: `signInWithEmailAndPassword()` desde otro dispositivo. Warning de perdida de datos anonimos
- **Verificacion de email**: no bloqueante. Badge en SideMenu y SettingsPanel. Re-enviar con cooldown 60s. Refresh via `user.reload()`
- **Recuperacion de contrasena**: `sendPasswordResetEmail()` desde dialog de login ("Olvide mi contrasena")
- **Cambio de contrasena**: `reauthenticateWithCredential()` + `updatePassword()` desde SettingsPanel
- **Logout**: `signOut()` + limpieza localStorage (visitas). Crea nueva cuenta anonima automaticamente
- **Eliminacion de cuenta (#192)**: usuarios email/password pueden eliminar permanentemente su cuenta y todos sus datos desde Configuracion. Re-autenticacion obligatoria. Cloud Function `deleteUserAccount` itera `USER_OWNED_COLLECTIONS` registry (`shared/userOwnedCollections.ts`) para borrar 19 colecciones + Storage + Firebase Auth. Corrige aggregate counters atomicamente durante el borrado. `cleanAnonymousData` callable para cleanup de datos anonimos. `deleteAllUserData` helper centralizado en `functions/src/utils/deleteUserData.ts`. Idempotente, timeout 120s, rate limit 1/min. Para anonimos: "Empezar de cero" via `SettingsMenu` (signOut, nueva sesion anonima). Componente: `DeleteAccountDialog` (lazy-loaded) con offline guard via `useConnectivity`. Cleanup de readCache (IndexedDB) en signOut y deleteAccount
- **Componentes**: `EmailPasswordDialog` (registro/login con tabs, ojito visibilidad, indicador fortaleza, recordar email, fade tabs, Enter submit, autofocus), `ChangePasswordDialog` (ojito en 3 campos, indicador fortaleza en nueva contraseña, Enter submit, autofocus), `DeleteAccountDialog` (re-auth + callable + cache cleanup), `PasswordField` (TextField con toggle visibilidad, native `helperText` con auto `aria-describedby`), `PasswordStrength` (indicador visual de requisitos), `AccountSection` (extraido de SettingsPanel, encapsula toda la logica de cuenta), seccion Cuenta en SettingsPanel
- **Service layer**: `services/emailAuth.ts` (link, signIn, signOut, verify, reset, changePassword, deleteAccount, getAuthErrorMessage)
- **Constantes**: `constants/auth.ts` (PASSWORD_MIN_LENGTH, EMAIL_REGEX, AUTH_ERRORS en espanol, PASSWORD_RULES con complejidad: 8+ chars + numero + mayuscula + simbolo, validatePassword())
- **Analytics**: `account_created`, `email_sign_in`, `sign_out`, `password_changed`, `account_deleted`, user property `auth_type`. **Onboarding conversion** (#157): `onboarding_banner_shown/clicked/dismissed`, `benefits_screen_shown/continue`, `activity_reminder_shown/clicked`, `verification_nudge_shown/resend/dismissed`
- **Seguridad**: mensajes genericos para prevenir email enumeration, cooldown en re-envio verificacion, re-auth antes de cambio de contrasena

---

## Perfil publico de usuario

- Click en nombre de usuario en comentarios abre bottom sheet
- Avatar, fecha de registro, stats (comentarios, ratings, favoritos, likes recibidos, tags, fotos aprobadas, ranking mensual)
- Badge con medalla para usuarios top-3 del ranking mensual (junto al nombre)
- Ultimos 5 comentarios con link al comercio
- **FollowButton**: boton "Seguir" / "Siguiendo" en el perfil de otros usuarios. No aparece en el perfil propio. Optimistic toggle con revert on error. Soporte offline via `withOfflineSupport`. Componente memoizado (`React.memo`)
- Graceful handling cuando el doc del usuario no es accesible (rules restringen a owner/admin)
- Fallback de nombre desde el comentario
- Visibilidad controlada por `profilePublic` en `userSettings` — cache con TTL 60s en `useProfileVisibility`

---

## Seguir usuarios (#129)

- **Follows**: un usuario puede seguir a otros usuarios con perfil publico. Doc ID compuesto `{followerId}__{followedId}` en coleccion `follows`. Limite de 200 seguidos por usuario (validado client y server side). Rate limit server-side: 50 follows/dia. Solo se puede seguir a usuarios con `profilePublic !== false`
- **Busqueda de usuarios**: `UserSearchField` con debounce (300ms) para buscar usuarios por nombre. Query por prefijo sobre campo `displayNameLower` en coleccion `users`. Solo retorna usuarios con perfil publico. Max 10 resultados. Lazy-loaded en FollowedList
- **Seccion Seguidos en SideMenu**: lista paginada de usuarios seguidos (20 por pagina) con avatar e inicial. Click abre perfil publico del usuario. Barra de busqueda de usuarios arriba. Pull-to-refresh. `PaginatedListShell` para estados loading/error/empty. Al cerrar el perfil de un usuario, la lista se refresca (via `key` remount)
- **Seccion Actividad en SideMenu**: feed de actividad de los usuarios seguidos. Muestra ratings, comentarios y favoritos de los seguidos. Items paginados (20 por pagina) via `usePaginatedQuery` sobre subcolleccion `activityFeed/{userId}/items`. Click en item navega al comercio. Pull-to-refresh. Expiran a los 30 dias. Empty state invita a seguir usuarios. Analytics: `feed_viewed`, `feed_item_clicked`
- **Fan-out writes**: cuando un usuario con perfil publico hace una accion (rating, comentario, favorito), Cloud Functions escriben un item en `activityFeed/{followerId}/items` para cada seguidor. Batch writes (max 500 por batch). Solo se ejecuta si el actor tiene perfil publico
- **Notificacion `new_follower`**: al seguir a alguien, Cloud Function `onFollowCreated` crea notificacion al usuario seguido con nombre del seguidor. Respeta setting `notifyFollowers` del destinatario
- **Contadores**: `followingCount` y `followersCount` en docs de `users`, gestionados por Cloud Functions triggers (`onFollowCreated` incrementa, `onFollowDeleted` decrementa con floor 0)
- **Configuracion**: toggle "Nuevos seguidores" en SettingsPanel bajo notificaciones. Default: habilitado (`notifyFollowers: true`)
- **Analytics**: eventos `follow`, `unfollow`, `feed_viewed`, `feed_item_clicked`
- **Componentes**: `FollowButton.tsx`, `FollowedList.tsx`, `ActivityFeedView.tsx`, `ActivityFeedItem.tsx`, `UserSearchField.tsx`
- **Hooks**: `useFollow` (optimistic toggle + offline), `useUserSearch` (debounced prefix search), `useActivityFeed` (wrapper sobre `usePaginatedQuery`)
- **Services**: `services/follows.ts` (followUser, unfollowUser, isFollowing, fetchFollowing, fetchFollowers), `services/activityFeed.ts` (getActivityFeedCollection), `services/users.ts` (searchUsers, fetchUserDisplayNames)

---

## Recomendaciones entre usuarios (#135)

- **Recomendaciones**: un usuario puede recomendar un comercio a otro usuario. Doc en coleccion `recommendations` con campos: `senderId`, `senderName`, `recipientId`, `businessId`, `businessName`, `message` (opcional, max 200 chars), `read`, `createdAt`
- **Enviar recomendacion**: boton en `BusinessHeader` abre `RecommendDialog`. Busqueda de usuario destinatario via `UserSearchField` (reutilizado de follows). Campo de mensaje opcional (max 200 chars). Rate limit client-side: max 20/dia (`MAX_RECOMMENDATIONS_PER_DAY`). Warning visual cuando quedan ≤3. No se puede recomendar a uno mismo (validado client + server). Offline support via `withOfflineSupport`
- **Recibir recomendaciones**: seccion "Recomendaciones" en SideMenu (`ReceivedRecommendations`). Lista paginada (20 por pagina) via `PaginatedListShell`. Items muestran avatar con inicial, nombre del remitente, nombre del comercio, mensaje entre comillas, fecha relativa. Indicador visual de no leido (`action.hover` background). Click navega al comercio y marca como leida. "Marcar todas como leidas" al abrir la seccion
- **Badge**: `SideMenuNav` muestra badge `color="error"` con conteo de recomendaciones no leidas via `useUnreadRecommendations` hook (`getCountFromServer`)
- **Notificacion `recommendation`**: Cloud Function `onRecommendationCreated` crea notificacion al destinatario con nombre del remitente y comercio. Respeta setting `notifyRecommendations`. Rate limit server-side via `checkRateLimit` (20/dia). Validacion: no self-recommend, campos requeridos, moderacion de mensaje
- **Configuracion**: toggle "Recomendaciones" en SettingsPanel bajo notificaciones. Default: habilitado (`notifyRecommendations: true`)
- **Analytics**: eventos `recommendation_sent`, `recommendation_opened`, `recommendation_list_viewed`
- **Componentes**: `RecommendDialog.tsx` (lazy-loaded en BusinessSheet), `ReceivedRecommendations.tsx` (lazy-loaded en SideMenu)
- **Hooks**: `useUnreadRecommendations` (conteo no leidas con polling)
- **Services**: `services/recommendations.ts` (createRecommendation, getReceivedRecommendations, markRecommendationAsRead, markAllRecommendationsAsRead, countRecommendationsSentToday, countUnreadRecommendations)

---

## Constants Dashboard (`/dev/constants`, DEV only)

- Browser de todas las constantes centralizadas en `src/constants/`
- Busqueda por nombre o valor
- Filtro por modulo (chips toggle)
- Cada constante muestra: nombre (monospace), tipo (badge), valor (formateado)
- Edicion inline con validacion: JSON format, hex colors, numeros, booleanos
- Color swatches para valores hex, ms→human-readable hints para tiempos

## Textos centralizados (`src/constants/messages/`)

- Toasts y mensajes user-facing centralizados por dominio: `lists.ts`, `auth.ts`, `business.ts`, `common.ts`, `social.ts`, `checkin.ts`, `feedback.ts`, `admin.ts`, `onboarding.ts`
- Barrel export en `messages/index.ts` como `MSG_LIST`, `MSG_AUTH`, `MSG_BIZ`, `MSG_COMMON`, `MSG_SOCIAL`, `MSG_CHECKIN`, `MSG_FEEDBACK`, `MSG_ADMIN`, `MSG_ONBOARDING`
- Componentes importan `import { MSG_LIST } from '../../constants/messages'`
- Textos con variables usan funciones template
- Todos los textos con tildes correctas y signos de apertura
- Botones separados: copiar nombre (gris) y copiar valor (morado)
- Deteccion automatica de valores duplicados entre modulos (banner warning)
- Stats footer: N de M constantes visibles, total modulos, duplicados
- Registry auto-descubre constantes via `Object.entries` sobre cada modulo
- Lazy-loaded con `React.lazy()`, solo incluido en bundle DEV
- Accesible desde link en footer del SideMenu

---

## Firebase Analytics

- Firebase Analytics (GA4) integrado solo en produccion (`import.meta.env.PROD`)
- Lazy-loaded via dynamic import para no impactar bundle size
- Utilidad centralizada en `src/utils/analytics.ts`: `initAnalytics`, `trackEvent`, `setUserProperty`
- Eventos trackeados:
  - `business_view` (id, nombre, categoria)
  - `business_search` (query)
  - `business_filter_tag` / `business_filter_price`
  - `rating_submit` (business_id, score)
  - `side_menu_open`, `dark_mode_toggle`
- Inicializado en `main.tsx` despues de crear la app Firebase

---

## Dashboard Admin (`/admin`)

- Login con Google Sign-In (solo `benoffi11@gmail.com`)
- Verificacion en frontend (AdminGuard) y server-side (Firestore rules)
- 16 tabs con paneles que usan `useAsyncData` + `AdminPanelWrapper`:

| Tab | Descripcion |
|-----|-------------|
| **Resumen** | Totales (comercios, usuarios, comentarios, ratings, favoritos, feedback, commentLikes, check-ins, follows, recomendaciones, precios), distribucion de ratings (pie), tags mas usados (pie), top 10 comercios, custom tags candidatas a promover, auth method breakdown (pie: anonimos vs email), notification read rate (StatCard), "Salud de comentarios" section, **Estado de Crons**: health indicators para Rankings (freshness, distribucion de tiers pie chart, top 5) y Trending (freshness, lista de comercios trending con scores) |
| **Actividad** | Feed por seccion (comentarios, ratings, favoritos, tags, price levels, comment likes) con ultimos 20 items, indicador de flagged. Comentarios: columnas Likes y Resp. (replyCount), chips "editado" (si `updatedAt`) y "Respuesta" (si `parentId`) |
| **Feedback** | Tabla de feedback con categoria, mensaje, status (pending/viewed/responded/resolved), filtro por status. Columna "Comercio" con chip clickeable que abre dialog con detalles (nombre, ID, dirección, tags). Filtro por comercio (Autocomplete). Preview de PDF adjunto como link. Acciones admin: responder (respondToFeedback callable), resolver (resolveFeedback callable), crear issue en GitHub (createGithubIssueFromFeedback callable). Link a GitHub issue si existe |
| **Tendencias** | Graficos de evolucion temporal con selector dia/semana/mes/ano — actividad por tipo (incl. commentLikes line), usuarios activos, total escrituras, new accounts trend. Click en leyenda para mostrar/ocultar series |
| **Usuarios** | Rankings top 10 por metrica (comentarios, ratings, favoritos, tags, feedback, likesGiven, total), stats generales (total, activos, promedio acciones), auth method breakdown (anonimos vs email), email verified stats, settings aggregates (privacidad, notificaciones, analytics), "Mas likes dados" TopList |
| **Uso Firebase** | Graficos lineales de reads/writes/deletes y usuarios activos (ultimos 30 dias), pie charts por coleccion, barras de cuota vs free tier |
| **Alertas** | Logs de abuso (rate limit excedido, contenido flaggeado, top writers). KPI cards resumen (alertas hoy con tendencia vs ayer, tipo más frecuente, usuario más activo, total). Filtros organizados en grid 2 columnas: periodo (Hoy/Semana/Mes), estado (Pendientes/Revisadas/Descartadas/Todas), tipo, severidad (Baja/Media/Alta), colección, búsqueda por userId. Acciones: Revisar y Descartar alertas. Detalle inline con total alertas del usuario y badge "Reincidente" (>3 alertas). Export CSV. **Realtime**: `onSnapshot` con toast de nuevas alertas. Badge de pendientes en tab. **Reincidentes**: pestaña con tabla de usuarios con >N alertas (filtros >3, >5, >10), historial expandible por usuario |
| **Backups** | Crear backup manual, listar con paginacion (20/pagina), restaurar con backup de seguridad automatico, eliminar con confirmacion. Usa Cloud Functions callable |
| **Fotos** | Panel de revision de fotos de menu. Filtro por status (todas/pendientes/aprobadas/rechazadas) con contadores. Acciones contextuales por status: aprobar pendientes/rechazadas, rechazar con razon, eliminar aprobadas/rechazadas. Badge de reportes en cada card |
| **Rendimiento** | Web Vitals (LCP, INP, CLS, TTFB) con semaforos verde/amarillo/rojo segun umbrales. Percentiles p50/p75/p95. Graficos de tendencia temporal. Latencia de queries Firestore (p50/p95). Timing de Cloud Functions (p50/p95/count, agregado por `dailyMetrics`). Storage stats (bytes, archivos, barra de cuota). Filtros: periodo (hoy/7d/30d), dispositivo (all/mobile/desktop), conexion (all/wifi/4g/3g). Descompuesto en subcomponentes en `admin/perf/` |
| **Listas** | Stats globales (total, publicas, privadas, colaborativas, total items, promedio items/lista), top 10 listas por tamano. Toggle listas destacadas (callable getPublicLists/toggleFeaturedList) |
| **Funcionalidades** | Metricas por funcionalidad: cards con numero de hoy (prominente) + total acumulado. Tendencia vs ayer (flecha). Click expande grafico lineal 30 dias. Features Firestore: ratings, comments, likes, favorites, tags, feedback, check-ins, follows, recomendaciones, nivel de gasto. Features GA4: Sorprendeme, listas, busqueda, compartir, fotos, dark mode, preguntas Q&A. Cache en `config/analyticsCache` con TTL 1h. Graceful degradation si GA4 API falla. Seccion Adopcion: usuarios totales, activos hoy, tasa de actividad |
| **Notificaciones** | Stats globales (total, leidas, no leidas, tasa de lectura). Tabla desglose por tipo (8 tipos) con total, leidas, tasa de lectura con barra de progreso. Highlight rojo si tasa <20% |
| **Social** | Panel de metricas sociales (follows, activity feed, recomendaciones). Stats y actividad reciente |
| **Especiales** | CRUD de tarjetas especiales para la pantalla Inicio. Campos: titulo, subtitulo, icono, tipo, referenceId, orden, activo |
| **Logros** | CRUD de definiciones de logros. Campos: label, descripcion, icono, condicion (metrica+umbral), orden, activo |

---

## Cloud Functions (server-side)

### Funciones callable

| Funcion | Acceso | Descripcion | Timeout |
|---------|--------|-------------|---------|
| `createBackup` | admin | Firestore export → GCS (`modo-mapa-app-backups`) | 300s |
| `listBackups` | admin | Lista prefijos en GCS con paginacion (max 100/pagina) | 60s |
| `restoreBackup` | admin | Crea backup de seguridad pre-restore + Firestore import ← GCS | 300s |
| `deleteBackup` | admin | Elimina todos los archivos del backup en GCS | 120s |
| `approveMenuPhoto` | admin | Aprueba foto pendiente o rechazada. Cambia status a `approved`, registra `reviewedBy` y `reviewedAt` | 30s |
| `rejectMenuPhoto` | admin | Rechaza foto con razon obligatoria. Cambia status a `rejected` | 30s |
| `deleteMenuPhoto` | admin | Elimina archivos de Storage (original + thumbnail) y documento de Firestore | 60s |
| `reportMenuPhoto` | auth | Reporta foto. Crea doc en subcollection `reports/{userId}` (previene duplicados). Incrementa `reportCount` atomicamente | 30s |
| `respondToFeedback` | admin | Responde a feedback de usuario. Actualiza status a `responded`, guarda `adminResponse`/`respondedAt`/`respondedBy`. Crea notificacion `feedback_response` | 60s |
| `resolveFeedback` | admin | Marca feedback como resuelto. Actualiza status a `resolved`. Crea notificacion `feedback_response` | 60s |
| `createGithubIssueFromFeedback` | admin | Crea issue en GitHub desde feedback. Usa `@octokit/rest` + `GITHUB_TOKEN` secret. Mapea categoria a label (bug/enhancement/feedback). Guarda `githubIssueUrl` en doc. Previene duplicados | 30s |
| `getAuthStats` | admin | Consulta Firebase Auth para devolver breakdown de metodos de autenticacion (anonimos vs email) y stats de verificacion de email | 30s |
| `getStorageStats` | admin | Calcula total bytes y cantidad de archivos en `menuPhotos/` de Cloud Storage. Memory: 256MiB | 60s |
| `getAnalyticsReport` | admin | Consulta GA4 Data API para eventos de features. Cache en `config/analyticsCache` con TTL 1h. Secret: `GA4_PROPERTY_ID` | 30s |
| `writePerfMetrics` | auth | Escribe Web Vitals + query metrics via Admin SDK. Rate limit: 5/dia por usuario (`_rateLimits/perf_{userId}`) | 30s |
| `deleteUserAccount` | auth | Elimina permanentemente cuenta y todos los datos del usuario. Itera `USER_OWNED_COLLECTIONS` (19 colecciones) + Storage + Firebase Auth. Corrige aggregate counters. Idempotente. Rate limit: 1/min | 120s |
| `cleanAnonymousData` | auth | Limpia datos de sesion anonima al hacer "Empezar de cero". Elimina datos de usuario sin borrar Firebase Auth record | 60s |

Todas las callable admin:

- Verifican admin (email + `email_verified`)
- Rate limit: 5 llamadas/minuto por usuario (Firestore-backed)
- `enforceAppCheck: !IS_EMULATOR` (deshabilitado en emuladores)
- Logging con email enmascarado

### Triggers

| Trigger | Coleccion | Acciones |
|---------|-----------|----------|
| `onCommentCreated` | `comments` | Rate limit (20/dia) + moderacion + increment parent `replyCount` (si es reply) + counters + notificacion `comment_reply` al autor del comentario padre (si es reply, respeta `notifyReplies` setting) |
| `onCommentUpdated` | `comments` | Re-moderacion del texto editado (flag/unflag) |
| `onCommentDeleted` | `comments` | Decrement parent `replyCount` (floor 0) + cascade delete orphaned replies + decrement counters |
| `onCommentLikeCreated` | `commentLikes` | Increment likeCount + rate limit (50/dia) + counters + notificacion al autor (si no es self-like) |
| `onCommentLikeDeleted` | `commentLikes` | Decrement likeCount + counters |
| `onCustomTagCreated` | `customTags` | Rate limit (10/business) + moderacion + counters |
| `onCustomTagDeleted` | `customTags` | Decrement counters |
| `onFeedbackCreated` | `feedback` | Rate limit (5/dia) + moderacion + counters |
| `onRatingWritten` | `ratings` | Counters (create/update/delete) |
| `onFavoriteCreated/Deleted` | `favorites` | Counters |
| `onUserCreated` | `users` | Counters |
| `onMenuPhotoCreated` | `menuPhotos` | Thumbnail generation con sharp + counters |
| `onPriceLevelCreated/Updated` | `priceLevels` | Counters |
| `onFollowCreated` | `follows` | Rate limit (50/dia) + max 200 follows check + profile public check + increment followingCount/followersCount en users + notificacion `new_follower` + counters |
| `onFollowDeleted` | `follows` | Decrement followingCount/followersCount (floor 0) + counters |
| `onRecommendationCreated` | `recommendations` | Rate limit (20/dia) + no self-recommend + moderacion mensaje + notificacion `recommendation` + counters |

### Scheduled

| Funcion | Schedule | Descripcion |
|---------|----------|-------------|
| `dailyMetrics` | 3:00 AM | Calcula distribucion, tops, active users, newAccounts. Agrega performance data: vitals (p50/p75/p95 de perfMetrics del dia anterior), queries (p50/p95), Cloud Function timings (de `config/perfCounters`). Reset daily counters + perfCounters |
| `cleanupRejectedPhotos` | Diario | Elimina fotos rechazadas con mas de 7 dias (Storage + Firestore) |
| `computeWeeklyRanking` | Lunes 4:00 AM | Calcula ranking semanal. Scoring: Comment=3, Rating=2, Like/Tag/Favorite=1, Photo=5 |
| `computeMonthlyRanking` | 1ro de mes 4:00 AM | Calcula ranking mensual con misma formula |
| `computeAlltimeRanking` | Lunes 5:00 AM | Calcula ranking historico all-time. Memory: 1GiB, timeout: 540s |
| `cleanupExpiredNotifications` | 5:00 AM | Elimina notificaciones expiradas (>30 dias) |
| `computeTrendingBusinesses` | 3:00 AM ART | Calcula top 10 comercios trending (7 dias). Scoring: ratings*2 + comments*3 + userTags*1 + priceLevels*2 + listItems*1. Escribe a `trendingBusinesses/current` |

---

## Performance Metrics

- **Web Vitals capture**: LCP, INP, CLS, TTFB via `PerformanceObserver` API. Solo en produccion y si `analyticsEnabled`. Una sesion = un flush a Firestore (al `visibilitychange:hidden` o tras 30s timeout)
- **Query timing**: `measureAsync(name, fn)` wrapper que mide duracion de queries Firestore y acumula percentiles por sesion
- **Cloud Function timing**: `trackFunctionTiming(name, startMs)` acumula tiempos en `config/perfCounters` (array union). Actualmente instrumentado en `onRatingWritten` y `onCommentCreated`
- **Daily aggregation**: `dailyMetrics` lee `perfMetrics` del dia anterior + `config/perfCounters`, calcula p50/p75/p95 de vitals y queries, p50/p95/count de functions, y escribe en `dailyMetrics/{date}.performance`. Borra `config/perfCounters` post-agregacion
- **Admin panel**: tab Performance con semaforos (verde/amarillo/rojo), graficos de tendencia, tablas de latencia, storage stats
- **Thresholds** (`constants/performance.ts`): LCP green<=2500ms, INP green<=200ms, CLS green<=0.1, TTFB green<=800ms

---

## Toast global (feedback de acciones)

- `ToastContext` provider con hook `useToast()` que expone `success()`, `error()`, `warning()`, `info()`
- Snackbar MUI + Alert con auto-dismiss 4s, dismiss manual con X
- Integrado en: BusinessRating (error), BusinessComments (exito + error en submit/edit/reply/like), FavoriteButton (exito add/remove + error)
- Sin toast de exito en ratings (las estrellas son feedback visual suficiente)
- Un toast a la vez (reemplaza el anterior si llega otro)
- Posicion: bottom-center

---

## Modo offline mejorado (#136)

- **Cola offline en IndexedDB**: cuando no hay conexion, las acciones del usuario (ratings, comments, favorites, price levels, tags) se encolan en IndexedDB (`modo-mapa-offline`) en vez de fallar. Max 50 acciones, TTL 7 dias
- **Sync automatico**: al reconectar, `ConnectivityContext` verifica conectividad real (HEAD a favicon.ico) y dispara `syncEngine.processQueue()`. Procesamiento FIFO secuencial con backoff exponencial (1s/2s/4s) y max 3 retries. Toasts de progreso: "Sincronizando N acciones...", "N acciones sincronizadas", "M acciones fallaron"
- **Wrapper pattern**: `withOfflineSupport()` envuelve las llamadas a servicios en los componentes. Los servicios (`ratings.ts`, `comments.ts`, etc.) no se modifican. UI optimista existente sigue funcionando
- **OfflineIndicator**: chip fijo en top center. Muestra "Sin conexion", "Sin conexion - N pendientes", o "Sincronizando..." con icono animado. `aria-live="polite"` para accesibilidad. zIndex 1100 (debajo de modals)
- **Seccion Pendientes en SideMenu**: visible solo si hay acciones pendientes. Lista con icono por tipo, nombre del comercio, fecha relativa. Boton descartar individual. Boton "Reintentar fallidas" si hay acciones `failed`
- **ConnectivityProvider**: debajo de ToastProvider en el arbol. Expone `isOffline`, `isSyncing`, `pendingActionsCount`, `pendingActions`, `discardAction`, `retryFailed` via `useConnectivity()` hook
- **Analytics**: 4 eventos (`offline_action_queued`, `offline_sync_completed`, `offline_sync_failed`, `offline_action_discarded`)
- **PWA**: `navigateFallback: 'index.html'` agregado a Workbox config. Service worker precachea 45 assets
- **Privacidad**: IndexedDB storage y eventos offline documentados en PrivacyPolicy

---

## Distancia al usuario

- Funcion Haversine extraida a `src/utils/distance.ts` (compartida por `useSuggestions` y componentes de lista)
- `formatDistance(km)`: "a 300m" si <1km, "a 1.2km" si >=1km
- Mostrada en SuggestionsView y FavoritesList junto a la direccion
- Solo si `userLocation` esta disponible (no se piden permisos adicionales)
- Calculo client-side, sin queries extra

---

## Pull-to-refresh

- Hook `usePullToRefresh(onRefresh)` con deteccion de touch gesture
- Componente `PullToRefreshWrapper` con CircularProgress visual (progress determinado durante pull, indeterminado durante refresh)
- Threshold: 80px, solo touch (mobile-first), solo si scrollTop === 0
- Integrado en: FavoritesList, CommentsList, RatingsList, RankingsView
- No interfiere con scroll normal ni swipe actions de items

---

## Staging environment

- **Named Firestore DB**: database `staging` en mismo proyecto Firebase (`modo-mapa-app`). Configurado via `VITE_FIRESTORE_DATABASE_ID=staging`
- **Multi-site hosting**: target `staging` en `firebase.json`, site `modo-mapa-staging` en `.firebaserc`
- **Deploy workflow**: `.github/workflows/deploy-staging.yml` — build con env staging + deploy `hosting:staging` en push a branch `staging`
- **Firebase config**: `src/config/firebase.ts` lee `VITE_FIRESTORE_DATABASE_ID` y pasa `databaseId` a `getFirestore()`. App Check deshabilitado en staging
- **Mismas rules/indexes**: staging usa los mismos `firestore.rules` y `firestore.indexes.json` que produccion

---

## Offline read caching (#197, #198)

- **readCache.ts**: servicio IndexedDB (`modo-mapa-read-cache`) que cachea datos de BusinessSheet para lectura offline. LRU eviction a 20 entries. TTL configurable via `READ_CACHE_TTL_MS`
- **3-tier lookup**: `useBusinessData` busca datos en: (1) memory cache → (2) IndexedDB readCache → (3) Firestore. Si el dato viene de cache, `stale: true` y se muestra `StaleBanner`
- **Incremental loading**: `useBusinessData` expone `isLoadingComments` ademas de `isLoading`. BusinessSheet renderiza header/rating/tags inmediatamente y muestra skeleton solo en la seccion de comentarios mientras carga
- **StaleBanner**: componente que muestra "Datos guardados - puede no estar actualizado" cuando los datos vienen de cache offline. Visible solo cuando `stale === true`
- **Cleanup**: readCache se limpia en `signOut` y `deleteAccount` (via `clearReadCache()`)
- **Servicios**: `services/readCache.ts` (getFromReadCache, saveToReadCache, clearReadCache, deleteBusinessFromReadCache)

---

## Accesibilidad (#196)

- **contrast.ts**: utilidad WCAG 2.0 en `src/utils/contrast.ts`. Calcula luminancia relativa y ratio de contraste. Funciones: `getLuminance`, `getContrastRatio`, `meetsWCAG_AA`, `meetsWCAG_AAA`
- **PasswordField helperText nativo**: usa `helperText` prop de MUI TextField que genera `aria-describedby` automaticamente, en vez de texto externo desconectado
- **aria-live en contadores dinamicos**: contadores de comentarios diarios, likes y otros elementos dinamicos usan `aria-live="polite"` para anunciar cambios a screen readers
- **role=alertdialog**: dialogs destructivos (DeleteAccountDialog, DiscardDialog) usan `role="alertdialog"` para comunicar urgencia a tecnologias asistivas

---

## Rating prompt post check-in (#199)

- **useRatingPrompt hook**: detecta check-ins recientes (ventana 2-8h) en comercios no calificados. Cap de 3 prompts por dia. Expone `businessToRate` y `dismiss()`
- **RatingPromptBanner**: banner en HomeScreen que sugiere calificar un comercio visitado recientemente. Muestra nombre del comercio y boton para ir al detalle. Dismisseable
- **Analytics**: 4 eventos (`rating_prompt_shown`, `rating_prompt_clicked`, `rating_prompt_dismissed`, `rating_prompt_converted`)
- **Componentes**: `RatingPromptBanner.tsx` (en `components/ui/`), `useRatingPrompt.ts` (en `hooks/`)

---

## HomeScreen — SpecialsSection

- **SpecialsSection**: seccion de cards en HomeScreen que muestra contenido destacado (trending, listas destacadas, logros). Cada card navega a la seccion correspondiente: `trending` abre la seccion Recientes en SideMenu, `featured_list` abre la seccion Listas en SideMenu
- **Firestore collections**: `specials` y `achievements` con rules de lectura publica y escritura admin-only

---

## Nota: Badges vs Achievements

La app implementa **dos sistemas separados** de gamificacion:

| Sistema | Archivo | Cantidad | Logica | UI |
|---------|---------|----------|--------|----|
| **Badges** | `constants/badges.ts` | 11 tipos | Computados dinamicamente via `evaluateBadges()` + `check()` contra `UserRankingEntry.breakdown` | `BadgesList.tsx` en `UserProfileModal` (rankings) |
| **Achievements** | `constants/achievements.ts` | 8 tipos | Definiciones estaticas con `AchievementDefinition` interface + `target` numerico. Servicio: `services/achievements.ts`. Coleccion Firestore `achievements` | `AchievementsGrid.tsx` + `AchievementsSection.tsx` en ProfileScreen |

**Badges** (milestones de actividad): primera resena, comentarista, influencer, primera foto, fotografo, primera calificacion, critico, popular, todoterreno, podio, racha 7d.

**Achievements** (progresion goal-based): Explorador (10 check-ins), Social (5 follows), Critico (10 ratings), Viajero (3 localidades), Coleccionista (20 favoritos), Fotografo (5 fotos), Embajador (10 recomendaciones), Racha (7 dias consecutivos).
