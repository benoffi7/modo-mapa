# Plan: Recomendaciones entre usuarios

**Specs:** [specs.md](specs.md)
**Fecha:** 2026-03-25

---

## Fases de implementacion

### Fase 1: Modelo de datos y service layer

**Branch:** `feat/recomendaciones-usuarios`

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `src/types/index.ts` | Agregar interface `Recommendation` (id, senderId, senderName, recipientId, businessId, businessName, message, read, createdAt). Agregar `'recommendation'` a union `NotificationType`. Agregar `notifyRecommendations: boolean` a interface `UserSettings`. Re-export `RecommendationPayload` de `types/offline.ts`. |
| 2 | `src/types/offline.ts` | Agregar `'recommendation_create' \| 'recommendation_read'` a `OfflineActionType`. Agregar `RecommendationPayload` interface (`recipientId: string, businessName: string, senderName: string, message: string`). Agregar a union `OfflineActionPayload`. |
| 3 | `src/config/collections.ts` | Agregar `RECOMMENDATIONS: 'recommendations'` al objeto `COLLECTIONS`. |
| 4 | `src/config/converters.ts` | Agregar `recommendationConverter: FirestoreDataConverter<Recommendation>` siguiendo patron de `followConverter`. `fromFirestore` mapea todos los campos con `toDate(d.createdAt)`. |
| 5 | `src/constants/validation.ts` | Agregar `MAX_RECOMMENDATION_MESSAGE_LENGTH = 200` y `MAX_RECOMMENDATIONS_PER_DAY = 20`. |
| 6 | `src/constants/analyticsEvents.ts` | Agregar `EVT_RECOMMENDATION_SENT = 'recommendation_sent'`, `EVT_RECOMMENDATION_OPENED = 'recommendation_opened'`, `EVT_RECOMMENDATION_LIST_VIEWED = 'recommendation_list_viewed'`. |
| 7 | `src/services/recommendations.ts` | Crear service completo: `getRecommendationsCollection()`, `createRecommendation()`, `markRecommendationAsRead()`, `markAllRecommendationsAsRead()`, `countUnreadRecommendations()`, `countRecommendationsSentToday()`. Seguir patron de `services/follows.ts`. |
| 8 | `src/services/userSettings.ts` | Agregar `notifyRecommendations: true` a `DEFAULT_SETTINGS`. |
| 9 | `src/services/recommendations.test.ts` | Tests para las 5 funciones del service: validacion inputs, Firestore calls correctos, cache invalidation, analytics. |

### Fase 2: Cloud Function trigger

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `functions/src/triggers/recommendations.ts` | Crear `onRecommendationCreated` trigger: rate limit (20/dia via `checkRateLimit`), self-recommend guard, moderacion mensaje (via `checkModeration`), notificacion (via `createNotification`), counter increment. Seguir patron de `functions/src/triggers/follows.ts`. |
| 2 | `functions/src/utils/notifications.ts` | Agregar `'recommendation'` a local `NotificationType` union. Agregar `recommendation: 'notifyRecommendations'` a `TYPE_TO_SETTING`. Agregar `notifyRecommendations: true` a `DEFAULT_SETTINGS`. |
| 3 | `functions/src/index.ts` | Exportar `onRecommendationCreated` desde `triggers/recommendations`. |
| 4 | `functions/src/triggers/recommendations.test.ts` | Tests: rate limit exceeded elimina doc + logAbuse, self-recommend eliminado, mensaje flagged eliminado, notificacion creada/omitida segun settings, counter increment. Seguir patron de `functions/src/triggers/comments.test.ts`. |

### Fase 3: Firestore rules y offline

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `firestore.rules` | Agregar bloque `match /recommendations/{docId}` con reglas de read (recipientId o admin), create (senderId==auth.uid, no self, fields validados, message<=200, read==false, createdAt==request.time), update (solo recipientId, affectedKeys read), delete false. |
| 2 | `firestore.rules` | Modificar bloque `userSettings`: agregar `'notifyRecommendations'` a `keys().hasOnly(...)`, agregar `&& request.resource.data.notifyRecommendations is bool`. |
| 3 | `src/services/syncEngine.ts` | Agregar cases `'recommendation_create'` (importa `createRecommendation`, extrae payload) y `'recommendation_read'` (importa `markRecommendationAsRead`). Agregar import type `RecommendationPayload`. |

### Fase 4: Componentes UI -- RecommendDialog + boton

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `src/components/business/RecommendDialog.tsx` | Crear dialog: `UserSearchField` para buscar destinatario, `TextField` para mensaje (max 200 chars con contador), boton "Recomendar". Rate limit precheck con `countRecommendationsSentToday` mostrando Alert si excede. Submit via `withOfflineSupport`. Toast success/error. |
| 2 | `src/components/business/RecommendButton.tsx` | Crear: `IconButton` con `SendIcon`, abre `RecommendDialog`. Solo visible si usuario no anonimo. |
| 3 | `src/components/business/BusinessHeader.tsx` | Agregar prop `recommendButton?: ReactNode`. Renderizar entre `addToListButton` y `shareButton` en el flex container de acciones. |
| 4 | `src/components/business/BusinessSheet.tsx` | Importar `RecommendButton`. Crear instancia con `businessId` y `businessName` del `selectedBusiness`. Pasar a `BusinessHeader` como prop `recommendButton` (guard: `user && !user.isAnonymous`). |
| 5 | `src/components/business/RecommendDialog.test.tsx` | Tests: render, busqueda y seleccion de usuario, submit con campos correctos, mensaje max 200 validado, rate limit precheck Alert, loading/disabled states, error toast. |

### Fase 5: Bandeja de recomendaciones recibidas

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `src/hooks/useUnreadRecommendations.ts` | Crear hook: query `countUnreadRecommendations` on mount, retorna `{ unreadCount, loading }`. Solo ejecuta si `user` autenticado. |
| 2 | `src/components/menu/ReceivedRecommendations.tsx` | Crear componente: `usePaginatedQuery` con constraints `[where('recipientId', '==', userId), orderBy('createdAt', 'desc')]`. Cada item con avatar inicial, senderName, businessName, mensaje truncado, `formatRelativeTime`. Click navega a comercio + markAsRead. `PaginatedListShell` + `PullToRefreshWrapper`. Empty state. `markAllRecommendationsAsRead` on mount. Analytics `EVT_RECOMMENDATION_LIST_VIEWED`. |
| 3 | `src/components/layout/SideMenu.tsx` | Agregar `'recommendations'` a `Section` type. Agregar a `SECTION_TITLES`: `recommendations: 'Recomendaciones'`. Lazy import: `const ReceivedRecommendations = lazy(() => import('../menu/ReceivedRecommendations'))`. Agregar rendering: `{activeSection === 'recommendations' && <ReceivedRecommendations onSelectBusiness={handleSelectBusiness} />}`. |
| 4 | `src/components/layout/SideMenuNav.tsx` | Importar `useUnreadRecommendations`, `SendIcon` de MUI. Agregar `ListItemButton` para "Recomendaciones" con `Badge` (unreadCount) entre "Actividad" y "Comentarios" items. Agregar a `Props` si needed. |
| 5 | `src/hooks/useUnreadRecommendations.test.ts` | Tests: retorna count, loading state, no query si no auth. |

### Fase 6: Settings y finalizacion

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `src/components/menu/SettingsPanel.tsx` | Agregar `SettingRow` para "Recomendaciones" con `checked={settings.notifyRecommendations}` y `onChange={(val) => updateSetting('notifyRecommendations', val)}`, indented, disabled si `!settings.notificationsEnabled`. Posicionar despues de "Nuevos seguidores". |
| 2 | `src/components/menu/HelpSection.tsx` | Agregar Accordion topic: "Recomendaciones" con texto explicativo sobre como recomendar y ver recomendaciones recibidas. |
| 3 | `scripts/seed-admin-data.mjs` | Agregar `notifyRecommendations: true` al seed de `userSettings`. |
| 4 | `src/config/converters.ts` | Agregar `notifyRecommendations` al `userSettingsConverter.fromFirestore` con default `true`. |
| 5 | `src/config/converters.test.ts` | Agregar test case para `recommendationConverter` (fromFirestore/toFirestore). Actualizar test de `userSettingsConverter` para incluir `notifyRecommendations`. |

---

## Orden de implementacion

1. **Tipos** (`types/index.ts`, `types/offline.ts`) -- base para todo lo demas.
2. **Config** (`collections.ts`, `converters.ts`, `validation.ts`, `analyticsEvents.ts`) -- depende de tipos.
3. **Service** (`services/recommendations.ts`, `services/userSettings.ts`) -- depende de config.
4. **Service tests** (`services/recommendations.test.ts`) -- valida service antes de UI.
5. **Cloud Function trigger** (`functions/src/triggers/recommendations.ts`, `notifications.ts`, `index.ts`) -- depende de coleccion.
6. **Cloud Function tests** (`triggers/recommendations.test.ts`) -- valida trigger.
7. **Firestore rules** (`firestore.rules`) -- puede hacerse en paralelo con 5-6.
8. **Offline integration** (`syncEngine.ts`) -- depende de service y tipos offline.
9. **RecommendDialog + RecommendButton** -- depende de service.
10. **BusinessHeader + BusinessSheet** integration -- depende de RecommendButton.
11. **RecommendDialog tests** -- valida UI.
12. **useUnreadRecommendations hook** -- depende de service.
13. **ReceivedRecommendations** -- depende de hook, service, converters.
14. **SideMenu + SideMenuNav** integration -- depende de ReceivedRecommendations.
15. **useUnreadRecommendations tests** -- valida hook.
16. **SettingsPanel** -- depende de userSettings update.
17. **HelpSection, seed, converter tests** -- finalizacion.

---

## Riesgos

### 1. Rate limit TOCTOU entre UI precheck y server trigger

**Riesgo:** El precheck en UI cuenta recomendaciones del dia pero entre ese check y el create, otro write podria pasar el limite.

**Mitigacion:** El Cloud Function trigger `onRecommendationCreated` ejecuta `checkRateLimit` server-side y elimina el doc si excede. El precheck en UI es solo UX (evitar que el usuario escriba un mensaje que no se publicara). Defense in depth, igual que en `BusinessComments`.

### 2. Incremento de reads en SideMenuNav por unread count

**Riesgo:** `useUnreadRecommendations` ejecuta una query cada vez que se abre el SideMenu, sumando reads de Firestore.

**Mitigacion:** La query usa `getCountFromServer` que es una sola read. Ademas, Firestore persistent cache en prod mitiga si offline. Si el volumen crece, se puede migrar a un campo `unreadRecommendationsCount` denormalizado en el doc `users` (mantenido por Cloud Function), pero no es necesario en v1.

### 3. Abuso de recomendaciones como spam

**Riesgo:** Un usuario podria enviar muchas recomendaciones a distintos destinatarios como forma de spam.

**Mitigacion:** Rate limit de 20/dia server-side. Moderacion del mensaje. El destinatario puede deshabilitar notificaciones de recomendaciones. Si se detecta abuso sistematico, `logAbuse` lo registra para revision admin.

---

## Criterios de done

- [ ] All items from PRD scope implemented
- [ ] Tests pass with >= 80% coverage on new code
- [ ] No lint errors
- [ ] Build succeeds
- [ ] Seed data updated (notifyRecommendations in userSettings)
- [ ] Privacy policy reviewed (new data collection: recommendations between users)
- [ ] Firestore indexes created (recipientId+createdAt, recipientId+read+createdAt, senderId+createdAt)
- [ ] `docs/reference/firestore.md` updated with `recommendations` collection
- [ ] `docs/reference/security.md` updated with rules impact table
- [ ] `docs/reference/patterns.md` updated if new patterns introduced
