# PRD: Recomendaciones entre usuarios

**Feature:** recomendaciones-usuarios
**Categoria:** social
**Fecha:** 2026-03-25
**Issue:** #135
**Prioridad:** Media
**Milestone:** v2.26.0
**Depende de:** #129 (Seguir usuarios) -- ya implementado en v2.28.0

---

## Contexto

Modo Mapa (v2.28.0) cuenta con un sistema social de seguir usuarios (#129) que incluye: coleccion `follows` con doc ID compuesto `{followerId}__{followedId}`, activity feed con fan-out writes, busqueda de usuarios por prefijo (`searchUsers` en `services/users.ts` sobre campo `displayNameLower`), `useUserSearch` hook con debounce 300ms, `UserSearchField` component, `FollowButton` con optimistic toggle + offline support, y notificaciones de nuevos seguidores. Tambien existe compartir comercios via deep link externo (Web Share API / clipboard). Sin embargo, no hay un mecanismo para recomendar un comercio directamente a otro usuario dentro de la app, manteniendo el contexto social ("Juan te recomienda Cafe Roma").

## Problema

- No se pueden recomendar comercios a otros usuarios dentro de la plataforma; la unica opcion es copiar un link y enviarlo por WhatsApp u otra app externa, perdiendo el contexto de quien lo recomendo y por que.
- El receptor de un link externo no sabe quien lo recomendo, eliminando el factor de confianza personal que impulsa el descubrimiento de comercios.
- No hay forma de ver un historial de recomendaciones recibidas, por lo que las sugerencias de amigos se pierden si no se actua inmediatamente.

## Solucion

### S1: Boton "Recomendar" en BusinessSheet

- Nuevo boton con icono `Send` (o `PersonAdd`) en la barra de acciones del BusinessSheet (junto a favorito, direcciones, compartir).
- Al tocar, abre un dialog (`RecommendDialog`) con:
  - Buscador de usuarios reutilizando `UserSearchField` de #129 (misma logica: debounce 300ms, prefijo `displayNameLower`, solo perfiles publicos, max 10 resultados). El campo es identico al de la seccion Seguidos.
  - Campo opcional de mensaje corto (max 200 chars) con contador de caracteres.
  - Boton "Recomendar" que crea el documento en Firestore y cierra el dialog.
- Optimistic UI siguiendo el patron de `useFollow`: toast de exito inmediato via `useToast()`, rollback si falla.
- Offline: wrappear con `withOfflineSupport` (nuevo `OfflineActionType`: `'recommendation'`), encolando en IndexedDB si offline.
- Rate limit: max 20 recomendaciones/dia. Precheck en UI (contador como `BusinessComments`) + server-side en trigger via `checkRateLimit`.
- Solo para usuarios autenticados con email (no anonimos), dado que requiere perfil publico para el remitente.

### S2: Notificacion in-app al destinatario

- Nuevo tipo de notificacion `recommendation` generado por Cloud Function trigger `onRecommendationCreated`.
- Formato: "{senderName} te recomienda {businessName}".
- Click en la notificacion abre el BusinessSheet del comercio (usa `relatedId` con el `businessId`, patron existente).
- Respeta el setting de notificaciones del destinatario: nuevo toggle `notifyRecommendations` en `userSettings` (default `true`). Se agrega a la seccion de notificaciones granulares en `SettingsPanel`, junto a los toggles existentes (likes, fotos, rankings, feedback, replies, seguidores).
- Trigger sigue el patron de `onFollowCreated`: lee `userSettings` del destinatario, verifica master toggle + toggle especifico, crea doc en `notifications` via `createNotification` helper.

### S3: Bandeja de recomendaciones recibidas

- Nueva seccion "Recomendaciones" en SideMenu, entre "Actividad" y "Sugeridos para vos".
- Lista paginada (20 items/pagina) usando `usePaginatedQuery` (patron existente en FollowedList, CommentsList, ActivityFeedView).
- Cada item muestra: avatar con inicial del remitente, nombre del remitente (clickeable, abre perfil publico), nombre del comercio, mensaje opcional (truncado a 2 lineas), fecha relativa via `formatRelativeTime`.
- Click en item navega al comercio (cierra menu, abre BusinessSheet via `onSelectBusiness`).
- Badge con count de no leidas en el item del menu lateral (patron de comentarios con respuestas no leidas).
- Mark as read al abrir la seccion o al hacer click en un item individual.
- Pull-to-refresh via `PullToRefreshWrapper`.
- Envuelto en `PaginatedListShell` para estados loading/error/empty consistentes.
- Empty state: "Todavia no recibiste recomendaciones. Segui a otros usuarios para empezar!"
- Lazy-loaded via `React.lazy()` (patron de todas las secciones del menu).

---

## Scope

| Item | Prioridad | Esfuerzo |
|------|-----------|----------|
| Coleccion `recommendations` + Firestore rules + converter | Alta | S |
| `COLLECTIONS.RECOMMENDATIONS` en `collections.ts` | Alta | XS |
| `services/recommendations.ts` (create, fetchReceived, markAsRead, countUnread) | Alta | S |
| `useRecommendations` hook (fetch paginado + unread count + mark read) | Alta | S |
| `RecommendDialog` (reutiliza `UserSearchField` + mensaje + submit) | Alta | M |
| Boton "Recomendar" en BusinessSheet action bar | Alta | S |
| Cloud Function trigger `onRecommendationCreated` (rate limit + moderacion + notificacion) | Alta | M |
| `ReceivedRecommendations.tsx` seccion SideMenu | Media | M |
| Toggle `notifyRecommendations` en userSettings + SettingsPanel | Media | S |
| `OfflineActionType` `'recommendation'` + sync handler en `syncEngine.ts` | Media | S |
| Analytics events (`recommendation_sent`, `recommendation_opened`, `recommendation_list_viewed`) | Media | S |
| Admin: counter en `config/counters` + columna en tab Actividad | Baja | S |
| Seccion en HelpSection.tsx | Baja | XS |

**Esfuerzo total estimado:** L

---

## Out of Scope

- Recomendaciones algoritmicas ("Te podria gustar...") -- ya cubierto por "Sugeridos para vos" (`useSuggestions` hook).
- Recomendaciones grupales (a multiples usuarios a la vez en un solo envio).
- Historial de recomendaciones enviadas por el usuario (solo bandeja de recibidas).
- Integracion con activity feed de seguidos (las recomendaciones son privadas entre dos usuarios, no aparecen en el feed publico).
- Chat o respuestas a recomendaciones (es una accion unidireccional).
- Fan-out a seguidores (a diferencia de ratings/comments/favorites, las recomendaciones son punto a punto).

---

## Tests

### Archivos que necesitaran tests

| Archivo | Tipo | Que testear |
|---------|------|-------------|
| `src/services/recommendations.ts` | Service | `createRecommendation`: validacion inputs (businessId, recipientId, message length), Firestore addDoc call con campos correctos, cache invalidation. `fetchReceivedRecommendations`: query con filtro recipientId, ordering, paginacion. `markAsRead`: updateDoc con campo `read: true`. `countUnread`: query con `read == false` |
| `src/hooks/useRecommendations.ts` | Hook | Fetch paginado, unread count reactivo, mark as read side effect, loading/error states |
| `functions/src/triggers/recommendations.ts` | Trigger | Rate limit (20/dia) respetado, notificacion creada cuando `notifyRecommendations` habilitado, notificacion omitida cuando deshabilitado, moderacion del mensaje, counter increment, self-recommendation bloqueado |
| `src/components/RecommendDialog.tsx` | Component | Busqueda de usuarios muestra resultados, seleccion de usuario, submit con businessId + recipientId + mensaje, validacion mensaje max 200 chars, loading/disabled states, error toast |

### Criterios de testing

- Cobertura >= 80% del codigo nuevo
- Tests de validacion para todos los inputs del usuario (mensaje max 200, recipientId != senderId)
- Todos los paths condicionales cubiertos (offline enqueue, rate limit precheck, notificacion respetando settings)
- Side effects verificados (cache invalidation via `invalidateQueryCache`, analytics via `trackEvent`, notificacion creada en Firestore)

---

## Seguridad

- [ ] Firestore rules para `recommendations`: `request.auth != null` en read/write
- [ ] Create: `request.resource.data.senderId == request.auth.uid` (ownership del remitente)
- [ ] Read: `resource.data.recipientId == request.auth.uid || isAdmin()` (solo el destinatario o admin)
- [ ] `keys().hasOnly(['senderId', 'recipientId', 'businessId', 'businessName', 'senderName', 'message', 'read', 'createdAt'])` en create
- [ ] `createdAt == request.time` validacion de timestamp server-side
- [ ] Validacion de longitud de mensaje: `message.size() <= 200` en rules
- [ ] No update por cliente (excepto `read` field via `affectedKeys().hasOnly(['read'])` por el destinatario)
- [ ] No delete por cliente (las recomendaciones son permanentes)
- [ ] Rate limit server-side (20/dia) via `checkRateLimit` en trigger `onRecommendationCreated`
- [ ] Moderacion del mensaje opcional via `checkModeration` en trigger
- [ ] No exponer existencia de usuarios: busqueda reutiliza `searchUsers` que solo retorna perfiles publicos (patron #129, nunca se revela si un usuario privado existe)
- [ ] `senderId != recipientId` validado en rules (no auto-recomendaciones)
- [ ] Agregar `recommendations` a la tabla de Firestore rules en `security.md`

---

## Offline

### Data flows

| Operacion | Tipo (read/write) | Estrategia offline | Fallback UI |
|-----------|-------------------|-------------------|-------------|
| Enviar recomendacion | write | Encolar en IndexedDB via `withOfflineSupport` (nuevo tipo `'recommendation'`) | Toast "Se enviara cuando vuelvas a conectar", `OfflineIndicator` muestra pendientes |
| Listar recomendaciones recibidas | read | Firestore `persistentLocalCache` en prod (patron existente) | Datos cacheados en IndexedDB, `OfflineIndicator` visible si offline |
| Marcar como leida | write | Encolar en IndexedDB via `withOfflineSupport` | Optimistic UI (marca local inmediata), sync al reconectar |
| Buscar usuarios (en RecommendDialog) | read | Firestore persistent cache para resultados previos | Mensaje "Sin conexion, no se puede buscar usuarios" en `UserSearchField` |

### Checklist offline

- [x] Reads de Firestore: usan persistencia offline? Si, `persistentLocalCache` + `persistentMultipleTabManager` en prod
- [ ] Writes: tienen queue offline o optimistic UI? Implementar `withOfflineSupport` wrapper para create y markAsRead
- [x] APIs externas: hay manejo de error de red? N/A (solo Firestore)
- [x] UI: hay indicador de estado offline en contextos relevantes? Si, `OfflineIndicator` global
- [x] Datos criticos: disponibles en cache para primera carga? Si, Firestore persistent cache

### Esfuerzo offline adicional: S

---

## Modelo de datos

### Coleccion `recommendations`

```text
recommendations/{autoId}
  senderId:     string    // userId del remitente (== auth.uid en create)
  senderName:   string    // displayName del remitente (denormalizado para evitar join)
  recipientId:  string    // userId del destinatario
  businessId:   string    // ID del comercio recomendado
  businessName: string    // nombre del comercio (denormalizado)
  message?:     string    // mensaje opcional, max 200 chars
  read:         boolean   // false por default, true al abrir
  createdAt:    Timestamp // serverTimestamp()
```

**Indices necesarios:**
- `recipientId ASC, createdAt DESC` (query principal: recomendaciones recibidas ordenadas por fecha)
- `recipientId ASC, read ASC` (count de no leidas)

**Patron de doc ID:** auto-generated (no compuesto, porque un usuario puede recomendar el mismo comercio a la misma persona multiples veces con distintos mensajes).

---

## Modularizacion

La solucion debe mantener separacion estricta UI/logica siguiendo patrones existentes:

- `useRecommendations` hook encapsula fetch paginado (via `usePaginatedQuery`), mark as read, unread count
- `RecommendDialog` recibe `businessId`/`businessName` via props, reutiliza `UserSearchField` de #129
- `ReceivedRecommendations` usa `PaginatedListShell`, sin logica en SideMenu
- `services/recommendations.ts` maneja toda la interaccion con Firestore, siguiendo el patron de `services/follows.ts`

### Checklist modularizacion

- [ ] Logica de negocio en hooks/services (no inline en componentes de layout)
- [ ] Componentes nuevos son reutilizables fuera del contexto actual de layout
- [ ] No se agregan useState de logica de negocio a AppShell o SideMenu
- [ ] Props explicitas en vez de dependencias implicitas a contextos de layout

---

## Success Criteria

1. Un usuario autenticado (email, no anonimo) puede recomendar un comercio a otro usuario con perfil publico desde el BusinessSheet, y el destinatario recibe notificacion in-app.
2. La bandeja "Recomendaciones" en SideMenu muestra todas las recomendaciones recibidas con nombre del remitente, comercio, mensaje opcional y fecha relativa.
3. Click en una recomendacion abre el BusinessSheet del comercio.
4. Rate limit de 20 recomendaciones/dia se aplica correctamente (UI precheck + server-side trigger).
5. La funcionalidad respeta configuracion de notificaciones del destinatario (`notifyRecommendations` toggle en SettingsPanel).
6. Enviar una recomendacion offline la encola en IndexedDB y se sincroniza al reconectar.
