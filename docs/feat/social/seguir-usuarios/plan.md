# Plan: Seguir usuarios

**Specs:** [specs.md](specs.md)
**Fecha:** 2026-03-25

---

## Fases de implementacion

### Fase 1: Modelo de datos y service layer

**Branch:** `feat/seguir-usuarios`

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `src/types/index.ts` | Agregar interfaces `Follow`, `ActivityType`, `ActivityFeedItem` |
| 2 | `src/types/offline.ts` | Agregar `'follow_add' \| 'follow_remove'` a `OfflineActionType`, agregar `FollowPayload` |
| 3 | `src/config/collections.ts` | Agregar `FOLLOWS: 'follows'` y `ACTIVITY_FEED: 'activityFeed'` a `COLLECTIONS` |
| 4 | `src/config/converters.ts` | Agregar `followConverter` y `activityFeedItemConverter` |
| 5 | `src/constants/analyticsEvents.ts` | Agregar `EVT_FOLLOW`, `EVT_UNFOLLOW`, `EVT_FEED_VIEWED`, `EVT_FEED_ITEM_CLICKED` |
| 6 | `src/services/follows.ts` | Crear servicio: `followUser`, `unfollowUser`, `isFollowing`, `fetchFollowing`, `fetchFollowers`, `searchUsers` |
| 7 | `src/services/activityFeed.ts` | Crear servicio: `getActivityFeedCollection` con converter |
| 8 | `src/services/follows.test.ts` | Tests para todas las funciones del servicio |
| 9 | `src/services/activityFeed.test.ts` | Tests para collection getter |
| 10 | `src/services/syncEngine.ts` | Agregar handlers para `follow_add`/`follow_remove` |

### Fase 2: Cloud Functions (triggers y scheduled)

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `functions/src/triggers/follows.ts` | Crear `onFollowCreated` (rate limit, profilePublic check, max 200 check, counters, notification) y `onFollowDeleted` (counters con floor 0) |
| 2 | `functions/src/utils/notifications.ts` | Agregar `'new_follower'` a `NotificationType`, agregar `notifyFollowers: true` a `DEFAULT_SETTINGS` y `TYPE_TO_SETTING` |
| 3 | `functions/src/utils/fanOut.ts` | Crear helper `fanOutToFollowers(db, actorId, activityData)`: query followers, check profilePublic, batch write a `activityFeed/{followerId}/items` |
| 4 | `functions/src/triggers/ratings.ts` | Importar y llamar `fanOutToFollowers` en el path de create |
| 5 | `functions/src/triggers/comments.ts` | Importar y llamar `fanOutToFollowers` en `onCommentCreated` |
| 6 | `functions/src/triggers/favorites.ts` | Importar y llamar `fanOutToFollowers` en `onFavoriteCreated` |
| 7 | `functions/src/triggers/users.ts` | Agregar `displayNameLower: displayName.toLowerCase()` en `onUserCreated` |
| 8 | `functions/src/scheduled/cleanupActivityFeed.ts` | Crear scheduled function: collection group query `items` donde `expiresAt < now()`, batch delete |
| 9 | `functions/src/index.ts` | Exportar `onFollowCreated`, `onFollowDeleted`, `cleanupActivityFeed` |
| 10 | `functions/src/triggers/follows.test.ts` | Tests: rate limit, max 200, profilePublic check, counters, floor 0, notification |
| 11 | `functions/src/triggers/ratings.test.ts` | Extender tests: fan-out write |
| 12 | `functions/src/triggers/comments.test.ts` | Extender tests: fan-out write |
| 13 | `functions/src/scheduled/cleanupActivityFeed.test.ts` | Tests: cleanup de items expirados |

### Fase 3: Firestore rules

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `firestore.rules` | Agregar reglas para `follows`: read auth, create owner con keys validation, delete owner, update false |
| 2 | `firestore.rules` | Agregar reglas para `activityFeed/{userId}/items/{itemId}`: read owner, write false |

### Fase 4: Hooks

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `src/hooks/useFollow.ts` | Crear hook: optimistic toggle con derived state, offline support, cache invalidation |
| 2 | `src/hooks/useUserSearch.ts` | Crear hook: query con displayNameLower prefix match, privacy filter |
| 3 | `src/hooks/useActivityFeed.ts` | Crear hook: wrapper sobre `usePaginatedQuery` para subcollection del feed |
| 4 | `src/hooks/useFollow.test.ts` | Tests: optimistic toggle, error rollback, offline, self-follow prevention |
| 5 | `src/hooks/useUserSearch.test.ts` | Tests: query, privacy filter, empty results |
| 6 | `src/hooks/useActivityFeed.test.ts` | Tests: paginacion, refresh, empty state |

### Fase 5: Componentes UI

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `src/components/FollowButton.tsx` | Crear: boton toggle follow/unfollow con optimistic UI, disabled para self |
| 2 | `src/components/UserSearchField.tsx` | Crear: TextField con resultados desplegables, mensaje generico para sin resultados |
| 3 | `src/components/FollowedList.tsx` | Crear: lista de seguidos con avatar, nombre, badge ranking, busqueda, pull-to-refresh |
| 4 | `src/components/ActivityFeedView.tsx` | Crear: feed paginado con skeleton loader, pull-to-refresh |
| 5 | `src/components/ActivityFeedItem.tsx` | Crear: fila del feed con icono por tipo, texto, tiempo relativo |

### Fase 6: Integracion en app existente

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `src/components/SideMenu.tsx` | Agregar items de nav "Seguidos" y "Actividad" con lazy imports, iconos People y RssFeed |
| 2 | `src/services/userProfile.ts` | Agregar `followersCount` y `followingCount` a `UserProfileData`, leer de doc `users` |
| 3 | `src/components/UserProfileSheet.tsx` | Agregar FollowButton, mostrar followersCount/followingCount, tab de favoritos publicos |

### Fase 7: Migracion displayNameLower

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `scripts/migrateDisplayNameLower.ts` | Script one-off: iterar todos los docs de `users`, escribir `displayNameLower` |
| 2 | `src/services/userSettings.ts` | Al editar displayName, tambien actualizar `displayNameLower` en doc `users` |

---

## Orden de implementacion

1. **Tipos e interfaces** (`src/types/index.ts`, `src/types/offline.ts`) -- sin dependencias
2. **Config** (`collections.ts`, `converters.ts`, `analyticsEvents.ts`) -- depende de tipos
3. **Servicios** (`follows.ts`, `activityFeed.ts`) + tests -- depende de config
4. **Cloud Functions triggers** (`follows.ts`, fan-out helper, extensiones de triggers existentes) + tests -- independiente del frontend
5. **Firestore rules** -- independiente, pero necesita deploy junto con Cloud Functions
6. **Hooks** (`useFollow`, `useUserSearch`, `useActivityFeed`) + tests -- depende de servicios
7. **Componentes UI** (`FollowButton`, `UserSearchField`, `FollowedList`, `ActivityFeedView`, `ActivityFeedItem`) -- depende de hooks
8. **Integracion** (SideMenu, UserProfileSheet, userProfile service) -- depende de componentes
9. **Migracion displayNameLower** -- puede ejecutarse en cualquier momento despues del deploy de rules
10. **SyncEngine** offline handlers -- depende de servicios

---

## Riesgos

1. **Fan-out write scaling:** Si un usuario popular tiene 200 followers y hace muchas acciones, cada accion genera 200 escrituras. Mitigacion: max 200 followers por usuario (hardcoded limit). Monitor de escrituras diarias en admin dashboard.

2. **Collection group query para cleanup:** El scheduled cleanup necesita iterar `activityFeed/*/items` como collection group. Esto requiere un index de collection group en `expiresAt`. Mitigacion: crear el index en `firestore.indexes.json` antes del deploy.

3. **displayNameLower migracion:** Si hay muchos usuarios, la migracion one-off puede tomar tiempo y generar escrituras. Mitigacion: ejecutar en horario bajo (madrugada), batch de 500 docs. Dado la escala actual del proyecto (pocos usuarios), el riesgo es bajo.

---

## Criterios de done

- [ ] All items from PRD scope implemented
- [ ] Tests pass with >= 80% coverage on new code
- [ ] No lint errors
- [ ] Build succeeds
- [ ] Seed data updated (follows collection, activityFeed examples)
- [ ] Privacy policy reviewed (new data: follows relationship, activity feed)
- [ ] Firestore indexes deployed (follows composite indexes, activityFeed collection group)
- [ ] displayNameLower migration executed
- [ ] Counter fields initialized (followersCount, followingCount default 0)
