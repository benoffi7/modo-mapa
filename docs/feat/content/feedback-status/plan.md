# Plan Tecnico: Feedback Status Tracking

**Issue:** #73
**Fecha:** 2026-03-14

## Pasos de implementacion

### Paso 1: Type definitions

- Agregar `FeedbackStatus` type al union en `src/types/index.ts`
- Extender `Feedback` interface con `status`, `adminResponse`, `respondedAt`, `respondedBy`, `viewedByUser`
- Agregar `'feedback_response'` a `NotificationType`
- Agregar `notifyFeedback: boolean` a `UserSettings`

### Paso 2: Constantes

- Agregar `FEEDBACK_STATUSES` map (label + color por estado) en `src/constants/feedback.ts`
- Agregar `MAX_ADMIN_RESPONSE_LENGTH = 500` en `src/constants/feedback.ts`

### Paso 3: Converters

- Actualizar `feedbackConverter` en `src/config/converters.ts`:
  - `fromFirestore`: parsear `status` (default `'pending'`), `adminResponse`, `respondedAt`, `respondedBy`, `viewedByUser`
  - `toFirestore`: incluir `status`
- Actualizar `userSettingsConverter`:
  - `fromFirestore`: parsear `notifyFeedback` (default `true`)
  - `toFirestore`: incluir `notifyFeedback`

### Paso 4: Services

- Agregar `fetchUserFeedback(userId)` en `src/services/feedback.ts`:
  - Query con `feedbackConverter`, filtro por `userId`, orden `createdAt desc`
- Agregar `markFeedbackViewed(feedbackId)` en `src/services/feedback.ts`:
  - `updateDoc` con `{ viewedByUser: true }`

### Paso 5: MyFeedbackList component

- Crear `src/components/menu/MyFeedbackList.tsx`
- Fetch feedback del usuario al montar, expandir/colapsar items
- Al expandir item con respuesta no leida, llamar `markFeedbackViewed`
- Mostrar chips de categoria y estado, bloque de respuesta admin, indicador de no leido

### Paso 6: SideMenu integration

- Ampliar `Section` type con `'my-feedback'`
- Agregar titulo en `SECTION_TITLES`
- Lazy import de `MyFeedbackList`
- Agregar item "Mis envios" con icono `InboxOutlined` en la navegacion
- Agregar render condicional en la zona de contenido

### Paso 7: Admin FeedbackList updates

- En esta iteracion, `src/components/admin/FeedbackList.tsx` no se modifica con acciones de respuesta inline
- Las operaciones admin se exponen como Cloud Functions callable (paso 8)

### Paso 8: Cloud Functions

- Crear `functions/src/admin/feedback.ts` con:
  - `respondToFeedback`: valida admin, actualiza status/response, crea notificacion
  - `resolveFeedback`: valida admin, actualiza status a `resolved`
- Actualizar `functions/src/triggers/feedback.ts`:
  - Agregar `status: 'pending'` en paso 3 del trigger `onFeedbackCreated`
- Exportar nuevas funciones desde `functions/src/index.ts`

### Paso 9: Notifications support

- Actualizar `functions/src/utils/notifications.ts`:
  - Agregar `'feedback_response'` al type local `NotificationType`
  - Agregar mapeo `feedback_response: 'notifyFeedback'` al map de preferencias
- `NotificationItem.tsx`: el tipo se maneja por el sistema existente (sin icono dedicado por ahora)

### Paso 10: SettingsPanel update

- Agregar `SettingRow` para "Respuestas a feedback" en `src/components/menu/SettingsPanel.tsx`
- Toggle controlado por `settings.notifyFeedback`, deshabilitado si `notificationsEnabled` es `false`

### Paso 11: Firestore rules

- Actualizar `match /feedback/{docId}` en `firestore.rules`:
  - Agregar `allow read` para owner y admin
  - Agregar `allow update` con dos paths: admin (campos de respuesta) y owner (`viewedByUser`)
  - Mantener `allow delete` para owner

## Archivos afectados

| Archivo | Tipo |
|---------|------|
| `src/types/index.ts` | Modificar (tipos) |
| `src/constants/feedback.ts` | Modificar (constantes) |
| `src/config/converters.ts` | Modificar (converters) |
| `src/services/feedback.ts` | Modificar (services) |
| `src/components/menu/MyFeedbackList.tsx` | Crear |
| `src/components/layout/SideMenu.tsx` | Modificar |
| `src/components/menu/SettingsPanel.tsx` | Modificar |
| `src/components/notifications/NotificationItem.tsx` | Modificar |
| `functions/src/admin/feedback.ts` | Crear |
| `functions/src/triggers/feedback.ts` | Modificar |
| `functions/src/utils/notifications.ts` | Modificar |
| `functions/src/index.ts` | Modificar |
| `firestore.rules` | Modificar |
